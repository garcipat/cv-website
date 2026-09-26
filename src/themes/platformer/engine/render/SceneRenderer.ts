import {
  tileAt,
  tileToPixel,
  TILE_SIZE,
  RENDER_SCALE,
  RENDERED_TILE_SIZE,
  backgroundNeighbourMask,
} from '../../level/Terrain';
import { drawRotatedTile } from '../../tiles/draw';
import { drawTileAt, isFogExempt } from '../../tiles/registry';
import type { TerrainImages, TileDrawContext, TileTransientState } from '../../tiles/TileModule';
import { backgroundAtlasCell } from '../BackgroundAtlas';
import { backgroundRockEntry } from '../BackgroundDecorCatalog';
import type { LevelDef } from '../../level/LevelData';
import type { SignPlacement } from '../../level/SignMapper';
import {
  PLAYER_FRAME_SIZE,
  PLAYER_RENDERED_SIZE,
  JUMP_FRAME_SIZE,
  playerFrameSource,
  jumpFrameSource,
  climbFrameSource,
  hitFrameFromTimer,
  HIT_RED_FRAME_INDEX,
  heldTorchPlacement,
} from '../../entities/Player';
import type { PlayerState } from '../../entities/Player';
import { PICKUP_TYPES } from '../../entities/pickups';
import type { Pickup, PickupGroups } from '../../contracts/Pickup';
import type { PickupKind } from '../../contracts/PickupKind';
import type { PickupDrawLayer } from '../../entities/pickups/PickupType';
import { typeOf } from '../../entities/enemies';
import type { EnemyState } from '../../entities/Enemy';
import { typeOf as hazardTypeOf } from '../../entities/hazards';
import type { HazardPlacement } from '../../level/HazardMapper';
import type { DrawContext } from '../../contracts/DrawContext';
import type { PotRenderPlan } from '../../entities/blocks/potTypes';
import type { BlockState } from '../../entities/Block';
import { BLOCK_TYPES } from '../../entities/blocks';
import { DEPLOYABLE_ITEM_TYPES } from '../../entities/deployableItems';
import type {
  DeployableItemDrawLayer,
  DeployableItemState,
} from '../../entities/deployableItems/DeployableItemType';
import {
  CHECKPOINT_FLAG_SHEET,
  CHECKPOINT_FRAME_WIDTH,
  CHECKPOINT_FRAME_HEIGHT,
  CHECKPOINT_RENDERED_WIDTH,
  CHECKPOINT_RENDERED_HEIGHT,
  checkpointFrameIndex,
} from '../../entities/Checkpoint';
import type { CheckpointState } from '../../entities/Checkpoint';
import { frameSource } from '../../entities/sprites/SpriteSheet';
import { pulse } from '../../shared/math';
import { TORCH_SHEET, CRUMBLE_FLOOR_SHEET, CRUMBLE_CRACKS_SHEET } from '../../entities/sprites/sheets';
import type { CrumblingFloorTimerState } from '../../tiles/crumblingFloor';
import type { MushroomSquashState } from '../../tiles/bouncyMushroom';
import { TORCH_FRAME_WIDTH, TORCH_FRAME_HEIGHT, torchFrameIndex } from '../../tiles/torch';
import type { Point } from '../Lighting';
import type { LightSource } from '../../contracts/lighting';
import {
  localDarknessAt,
  enemyEyeOpacity,
  enemyEyeBobOffset,
  ENEMY_EYE_COLOR,
  ENEMY_EYE_SIZE_PX,
  ENEMY_EYE_GAP_PX,
  FOG_TINT_RGB,
  FOG_DENSITY,
  FOG_PUFF_PLATEAU,
  fogPuffAt,
  fogPeekStrengthAt,
  isCellDarkening,
} from '../Lighting';

/** Water tiles live in `world_tileset.png` column 4, row 9: the wave-crest
 *  (foam edge over blue). */
const WATER_TILE_SX = 4 * TILE_SIZE;
const WATER_CREST_SY = 9 * TILE_SIZE;

/** Solid water blue sampled directly from the crest tile's own body (below
 *  its foam edge, at world_tileset.png's (4,9) tile, a few rows down) — used
 *  to fill any gap the crest line itself doesn't cover (see `drawWaterForeground`). */
const WATER_BODY_COLOR = 'rgb(20, 152, 220)';

/**
 * Draws the foreground water band anchored to the LEVEL's bottom row (not
 * the viewport) — same `originX`/`originY` camera-scroll convention as
 * `drawTerrain`, so it scrolls with the level rather than the screen.
 * Overlaps the BOTTOM HALF of the level's own last terrain row (rather than
 * sitting below it) so the top of that row (and its grass edge) stays
 * readable while still reading as "waves lapping in front of the ground"
 * rather than fully submerging it.
 *
 * Tiles across the full `canvasWidth` — NOT just the level's own width —
 * starting from `originX` (always <= 0, since the horizontal camera clamps
 * to 0 rather than scrolling past the level's own edges) so tiles stay
 * aligned to world columns. A canvas wider than the level itself (the
 * horizontal camera can't scroll to compensate) would otherwise leave the
 * crest texture stopping short of the canvas's right edge.
 *
 * Below the crest line, fills solid `WATER_BODY_COLOR` across the full
 * canvas width down to the canvas bottom. The vertical camera
 * (`updateCameraY`/`initialCameraY` in Camera.ts) is deliberately unclamped,
 * so a spawn or descent low in the map can leave the level's own bottom row
 * scrolled above the canvas's bottom edge. Without this fill, that gap would
 * expose the parallax background layers behind the foreground, breaking the
 * illusion that the map simply floats in a body of water. Draws nothing
 * once the band has scrolled entirely below the visible viewport.
 */
export function drawWaterForeground(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  tileset: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  originX = 0,
  originY = 0,
): void {
  const topY = (level.height - 1) * RENDERED_TILE_SIZE + RENDERED_TILE_SIZE / 2 + originY;
  if (topY >= canvasHeight) return;

  ctx.imageSmoothingEnabled = false;

  for (let x = originX; x < canvasWidth; x += RENDERED_TILE_SIZE) {
    ctx.drawImage(
      tileset,
      WATER_TILE_SX,
      WATER_CREST_SY,
      TILE_SIZE,
      TILE_SIZE,
      x,
      topY,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
  }

  const bodyTop = topY + RENDERED_TILE_SIZE;
  if (bodyTop < canvasHeight) {
    ctx.fillStyle = WATER_BODY_COLOR;
    ctx.fillRect(0, bodyTop, canvasWidth, canvasHeight - bodyTop);
  }
}

/**
 * Draws the cave-darkness overlay and the light pools that punch back through
 * it, over the whole play canvas. This is the one pass that maps light world
 * positions to canvas coordinates (same `originX`/`originY` convention as
 * `drawTerrain`/`drawPlayer`), so light pools scroll with the camera (FR-012).
 *
 * Full-brightness fast path (FR-008 / research D10 / SC-005): when
 * `darknessLevel <= 0` this draws nothing at all. Otherwise:
 *
 * 1. The reusable offscreen `layer` (owned and sized by `PlatformerPage.tsx`)
 *    is cleared and filled with `rgba(0, 0, 0, darknessLevel)`.
 * 2. **One punch loop** (`destination-out`): for every visible light whose
 *    `punchHole` is true, a soft radial gradient erases a hole at the light's
 *    screen position, radius `light.radius * zoom`.
 * 3. The layer is composited onto `ctx` with `source-over`.
 * 4. **One glow loop** (`lighter`): every visible light gets a smaller warm
 *    gradient (radius `light.radius * zoom * 0.7`, `globalAlpha =
 *    darknessLevel * light.intensity`, stops `light.color` /
 *    `withAlpha(light.color, light.glowMidAlpha)` / `withAlpha(light.color, 0)`),
 *    so the pool reads warm without tinting the surrounding darkness
 *    (FR-005/FR-006).
 *
 * The two loops replace the old four near-duplicated per-kind blocks, so a
 * torch, the player's carried light, and any future emitter are all just data
 * in `lights` (SC-001/SC-003). `withAlpha` derives the `rgba(r, g, b, α)` stops
 * from the light's opaque `rgb(r, g, b)` base so the exact gradient strings are
 * preserved.
 *
 * `zoom` scales every world-space position and radius before adding the
 * (unscaled) origin — callers that run this at identity transform (not inside
 * their own `ctx.scale()`) pass their current zoom level here; callers that
 * already scale the canvas themselves (the live game) leave it at the default
 * `1`. `canvasWidth`/`canvasHeight` stay raw physical pixels either way, since
 * the final composite covers the whole canvas at identity transform.
 */
export function drawDarkness(
  ctx: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  canvasWidth: number,
  canvasHeight: number,
  darknessLevel: number,
  lights: readonly LightSource[] = [],
  originX = 0,
  originY = 0,
  zoom = 1,
): void {
  if (darknessLevel <= 0) return;

  const layerCtx = layer.getContext('2d');
  if (!layerCtx) return;

  layerCtx.globalCompositeOperation = 'source-over';
  layerCtx.globalAlpha = 1;
  layerCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  layerCtx.fillStyle = `rgba(0, 0, 0, ${darknessLevel})`;
  layerCtx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Only lights whose glow can touch the viewport do any work — this keeps
  // the pass O(visible lights) however many the level holds (FR-008).
  const visibleLights = lights.filter((light) => {
    const radius = light.radius * zoom;
    const screenX = light.x * zoom + originX;
    const screenY = light.y * zoom + originY;
    return (
      screenX + radius >= 0 &&
      screenX - radius <= canvasWidth &&
      screenY + radius >= 0 &&
      screenY - radius <= canvasHeight
    );
  });

  // One punch loop: every punching light erases a soft radial hole before the
  // layer is composited.
  for (const light of visibleLights) {
    if (!light.punchHole) continue;
    const screenX = light.x * zoom + originX;
    const screenY = light.y * zoom + originY;
    const radius = light.radius * zoom;

    // A soft radial hole: opaque at the centre, transparent at the edge, so
    // the world underneath shows through with no hard rim (FR-009).
    layerCtx.globalCompositeOperation = 'destination-out';
    const hole = layerCtx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
    hole.addColorStop(0, 'rgba(0, 0, 0, 1)');
    hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
    layerCtx.fillStyle = hole;
    layerCtx.beginPath();
    layerCtx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    layerCtx.fill();
  }
  layerCtx.globalCompositeOperation = 'source-over';

  ctx.drawImage(layer, 0, 0, canvasWidth, canvasHeight);

  // One glow loop: every visible light — punching or glow-only — adds its own
  // warm additive gradient.
  for (const light of visibleLights) {
    const screenX = light.x * zoom + originX;
    const screenY = light.y * zoom + originY;
    const radius = light.radius * zoom;
    // Stays comfortably inside the erased hole so the warm tone never bleeds
    // onto the darkened area.
    const glowRadius = radius * 0.7;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = darknessLevel * light.intensity;
    const glow = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowRadius);
    glow.addColorStop(0, light.color);
    glow.addColorStop(0.55, withAlpha(light.color, light.glowMidAlpha));
    glow.addColorStop(1, withAlpha(light.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Derives an `rgba(r, g, b, alpha)` string from an opaque `'rgb(r, g, b)'`
 * base. The substitution keeps the output byte-equal to the literal stops the
 * old per-kind glow blocks used (e.g. `rgb(255, 176, 74)` →
 * `rgba(255, 176, 74, 0.35)`), so the generic glow loop preserves each light's
 * gradient exactly (FR-006).
 */
function withAlpha(color: string, alpha: number): string {
  return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
}

/**
 * Where the eye line sits down the enemy's visible silhouette (its collision
 * box, already inset to the sprite's opaque area) — about a third of the way
 * down, so the marker lands on the face rather than the top edge (FR-018).
 */
const ENEMY_EYE_LINE_FRACTION = 0.35;

/** The render-time red applied to the crouch pose during a crouched hit
 *  reaction (FR-016) — tunable in one place. */
export const CROUCH_HIT_TINT = 'rgba(230, 40, 40, 0.6)';

/**
 * Draws one sprite frame through a reusable caller-owned offscreen `layer`,
 * recolouring only the sprite's opaque pixels with `tint` (FR-016). Follows the
 * exact caller-owned-layer convention `drawDarkness` establishes, so it
 * allocates nothing per frame and stays testable with a fake layer, DOM-free.
 *
 * 1. `layer.getContext('2d')`; if `null`, falls back to a plain `ctx.drawImage`
 *    of the frame at the destination.
 * 2. Clears the layer to `destSize` and draws the frame scaled to `destSize`
 *    with `source-over`.
 * 3. Switches to `source-atop` and fills the layer with `tint`, so only the
 *    sprite's already-opaque pixels are recoloured — never a rectangle.
 * 4. Composites the layer onto `ctx` at `(destX, destY)` and restores
 *    `source-over` on the layer.
 */
export function drawTintedSprite(
  ctx: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  sheet: CanvasImageSource,
  sx: number,
  sy: number,
  frameSize: number,
  destX: number,
  destY: number,
  destSize: number,
  tint: string,
): void {
  const layerCtx = layer.getContext('2d');
  if (!layerCtx) {
    ctx.drawImage(sheet, sx, sy, frameSize, frameSize, destX, destY, destSize, destSize);
    return;
  }

  layerCtx.globalCompositeOperation = 'source-over';
  layerCtx.clearRect(0, 0, destSize, destSize);
  layerCtx.drawImage(sheet, sx, sy, frameSize, frameSize, 0, 0, destSize, destSize);
  layerCtx.globalCompositeOperation = 'source-atop';
  layerCtx.fillStyle = tint;
  layerCtx.fillRect(0, 0, destSize, destSize);
  layerCtx.globalCompositeOperation = 'source-over';

  ctx.drawImage(layer, 0, 0, destSize, destSize, destX, destY, destSize, destSize);
}

/**
 * Draws each living enemy's glowing-eye marker through the darkness. Runs
 * *after* `drawDarkness`, so the marker stays visible over the overlay
 * (FR-015). Draws nothing at full brightness (FR-016/SC-005), nothing for a
 * defeated enemy (FR-017), and nothing for an enemy whose own position is lit
 * — e.g. inside a torch pool — where it renders normally instead (FR-015).
 *
 * The marker is a pair of small integer-aligned `ENEMY_EYE_COLOR` squares
 * (`ENEMY_EYE_SIZE_PX`), separated by `ENEMY_EYE_GAP_PX` centre-to-centre and
 * symmetric about the enemy's collision-box centre, at an opacity derived from
 * the local darkness at the enemy's own effect anchor (FR-018/FR-019).
 */
export function drawEnemyEyes(
  ctx: CanvasRenderingContext2D,
  enemies: readonly EnemyState[],
  darknessLevel: number,
  lights: readonly LightSource[],
  worldElapsed: number,
  originX = 0,
  originY = 0,
): void {
  if (darknessLevel <= 0) return;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = ENEMY_EYE_COLOR;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    const box = typeOf(enemy).box(enemy);
    const anchorX = box.x + box.width / 2;
    const anchorY = box.y + box.height / 2;
    const localDarkness = localDarknessAt(anchorX, anchorY, darknessLevel, lights);
    const opacity = enemyEyeOpacity(localDarkness);
    if (opacity <= 0) continue;

    const centerX = Math.round(box.x + box.width / 2 + originX);
    const eyeY =
      Math.round(box.y + originY + box.height * ENEMY_EYE_LINE_FRACTION) +
      Math.round(enemyEyeBobOffset(worldElapsed));
    const halfGap = ENEMY_EYE_GAP_PX / 2;
    const halfSize = ENEMY_EYE_SIZE_PX / 2;
    ctx.globalAlpha = opacity;
    ctx.fillRect(
      Math.round(centerX - halfGap - halfSize),
      eyeY,
      ENEMY_EYE_SIZE_PX,
      ENEMY_EYE_SIZE_PX,
    );
    ctx.fillRect(
      Math.round(centerX + halfGap - halfSize),
      eyeY,
      ENEMY_EYE_SIZE_PX,
      ENEMY_EYE_SIZE_PX,
    );
  }

  ctx.restore();
}

/**
 * Draws the level's terrain. `originX` shifts every tile horizontally and
 * `originY` shifts every tile vertically (e.g. to anchor the level to the
 * bottom of a taller-than-the-level canvas instead of drawing it pinned to
 * the top with empty space below, or to scroll it horizontally with the
 * camera). Both default to 0 (level drawn at its raw grid position,
 * top-left origin).
 *
 * The body is a band-filtered dispatch: each cell's module owns its appearance,
 * and this pass draws only the modules whose `drawBand` is `'terrain'` (US4/T040;
 * the per-`TileType` branches and the `tileSource` lookup are gone).
 */
export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  tileset: HTMLImageElement,
  groundAtlas: HTMLImageElement,
  originX = 0,
  originY = 0,
  staticObjects: HTMLImageElement | null = null,
  decorations: HTMLImageElement | null = null,
  torch: HTMLImageElement | null = null,
  worldElapsed = 0,
  mushroom: HTMLImageElement | null = null,
  mushroomSquashes: readonly MushroomSquashState[] = [],
): void {
  ctx.imageSmoothingEnabled = false;

  const images: TerrainImages = {
    tileset,
    groundAtlas,
    staticObjects,
    decorations,
    torch,
    mushroom,
    crumblingLedge: null,
    crumblingCracks: null,
  };
  // The terrain band reads only the mushroom-squash state; the crumbling
  // floor's timers belong to the afterHazards pass below. A hook needing
  // another kind's state would be a second lifecycle, which R-015 forbids.
  const transient: TileTransientState = { crumblingFloorTimers: [], mushroomSquashes };

  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const { x, y } = tileToPixel(col, row);
      const rc: TileDrawContext = {
        ctx,
        level,
        col,
        row,
        destX: x + originX,
        destY: y + originY,
        originX,
        originY,
        worldElapsed,
        images,
        transient,
      };
      drawTileAt(rc, 'terrain');
    }
  }
}

/**
 * Draws every live deployable item whose kind's `drawLayer` matches `layer`
 * (or every entry when `layer` is omitted), delegating to each kind's own
 * `draw`. Replaces the shipped `drawPlacedBombs`/`drawDeployableLadders`/
 * `drawChests` passes: the page calls it once per band, so no call site names a
 * deployable-item kind and a new kind needs no edit here.
 */
export function drawDeployableItems(
  ctx: CanvasRenderingContext2D,
  items: readonly DeployableItemState[],
  dc: DrawContext,
  layer?: DeployableItemDrawLayer,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const item of items) {
    const type = DEPLOYABLE_ITEM_TYPES[item.kind];
    if (layer !== undefined && type.drawLayer !== layer) continue;
    type.draw(item, dc);
  }
}

/**
 * Draws the crumbling floor cells through their module's own `draw` — the
 * `afterHazards` band, preserving this pass's depth between the hazard and
 * deployable bands exactly as before. The module owns the ledge/crack/rebuild
 * geometry; this pass only resolves the two sheet images (which a `tiles/`
 * module cannot import) and hands them to the dispatch.
 */
export function drawCrumblingFloors(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  states: readonly CrumblingFloorTimerState[],
  dc: DrawContext,
): void {
  const ledge = dc.sprites[CRUMBLE_FLOOR_SHEET.src];
  if (!ledge) return;
  const cracks = dc.sprites[CRUMBLE_CRACKS_SHEET.src] ?? null;

  ctx.imageSmoothingEnabled = false;

  // The crumbling floor module reads only `crumblingLedge`/`crumblingCracks`
  // (and its own transient state) — the other roles are unused by this pass,
  // so they are filled with the already-loaded ledge image rather than being
  // resolved again.
  const images: TerrainImages = {
    tileset: ledge,
    groundAtlas: ledge,
    staticObjects: null,
    decorations: null,
    torch: null,
    mushroom: null,
    crumblingLedge: ledge,
    crumblingCracks: cracks,
  };
  const transient: TileTransientState = { crumblingFloorTimers: states, mushroomSquashes: [] };

  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const { x, y } = tileToPixel(col, row);
      const rc: TileDrawContext = {
        ctx,
        level,
        col,
        row,
        destX: x + dc.originX,
        destY: y + dc.originY,
        originX: dc.originX,
        originY: dc.originY,
        worldElapsed: 0,
        images,
        transient,
      };
      drawTileAt(rc, 'afterHazards');
    }
  }
}

/**
 * Draws the level's purely-decorative autotiled background mass (O-014) —
 * one atlas cell per non-empty background cell, same double-loop shape as
 * `drawTerrain`, same `originX`/`originY` scroll convention. Levels with no
 * `background` field draw nothing.
 *
 * For each non-empty cell: computes its same-material neighbour mask, looks
 * up the atlas entry for that material/mask, and draws it via the shared
 * `drawRotatedTile` helper. A cell whose material is a stale/unrecognized id
 * would already have been filtered to `null` at load time (FR-012), so every
 * cell reaching this loop resolves to a real atlas entry. On top of a fully
 * interior cell (mask 15 — the one shape guaranteed to carry no border art a
 * rock could overlap), also draws a deterministic rock decoration from the
 * decorations sheet (FR-008), when one is loaded.
 */
export function drawBackgroundTiles(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  backgroundAtlas: HTMLImageElement,
  originX = 0,
  originY = 0,
  decorations: HTMLImageElement | null = null,
): void {
  const grid = level.background ?? [];
  for (let row = 0; row < grid.length; row++) {
    const gridRow = grid[row];
    for (let col = 0; col < gridRow.length; col++) {
      const material = gridRow[col];
      if (material === null || material === undefined) continue;

      const { x, y } = tileToPixel(col, row);
      const destX = x + originX;
      const destY = y + originY;
      const mask = backgroundNeighbourMask(level, col, row);
      const entry = backgroundAtlasCell(material, mask);
      drawRotatedTile(ctx, backgroundAtlas, entry, destX, destY);

      if (decorations && mask === 15) {
        const rock = backgroundRockEntry(col, row);
        ctx.drawImage(
          decorations,
          rock.sx,
          rock.sy,
          TILE_SIZE,
          TILE_SIZE,
          destX,
          destY,
          RENDERED_TILE_SIZE,
          RENDERED_TILE_SIZE,
        );
      }
    }
  }
}

/**
 * Draws the outside-a-cave fog (O-028): every cell NOT exempt
 * (`isFogExempt`) whose background material belongs to the cave family
 * gets a soft radial-gradient "puff" (`fogPuffAt`) at `fogLevel`'s alpha,
 * hiding everything on that cell — background, blocks and entities alike
 * (FR-001/FR-002 — see `FOG_PUFF_PLATEAU`'s doc comment for a known
 * tradeoff on isolated single-cell patches). Solid terrain
 * (`groundGrass`/`groundRock`/`wall`/`bridge`) is exempt today: a cave's
 * walls and floor are just rock, carrying no information a visitor could
 * act on, so leaving them visible reads as "you can see the cave's shape,
 * not what's inside it" — the open interior, where anything worth hiding
 * (enemies, hazards, a pit, a chest) would actually be, still fogs.
 * `isFogExempt`'s table (declared once, exhaustively, in
 * `level/LevelData.ts`) is the single place that decision lives, so a new
 * terrain tile forces an explicit choice rather than silently inheriting
 * an unrelated helper's answer. Blocks are unaffected by exemption: a
 * block sits on an otherwise-open cell, not a solid terrain tile, so a
 * fogged cell with a block on it stays fogged.
 *
 * Each puff is opaque at its core out to `FOG_PUFF_PLATEAU` of its radius,
 * then fades to transparent by the rim, and is sized a little larger than
 * a tile so it bleeds into a neighbouring clear cell rather than stopping
 * dead at the grid line — a flat per-cell rect read as a painted tile
 * stamp rather than fog. A puff's centre jitters (within `FOG_PUFF_JITTER_PX`)
 * and its radius breathes gently over time, both deterministic per cell
 * (`fogPuffAt`), so a bank of fog looks organic rather than perfectly
 * grid-aligned or static.
 *
 * Iterates the level's full background grid, the same shape
 * `drawBackgroundTiles` uses, rather than a viewport-culled range — levels
 * are small enough that this is cheap, and it keeps the two passes'
 * looping identical. Each puff needs its own gradient, so (unlike a flat
 * fill) this can't be batched into a single path/fill call; puffs overlap
 * generously enough (`FOG_PUFF_RADIUS_PX` vs. tile spacing) that adjacent
 * cells' soft edges blend into each other rather than leaving seams.
 *
 * Callers are expected to keep `fogLevel` and `darknessLevel` mutually
 * exclusive (only one is ever above zero at a time — FR-003); this function
 * does not itself check `darknessLevel`.
 *
 * When `playerPosition` is given, a puff within `FOG_PEEK_RADIUS_PX` of it
 * thins smoothly toward fully clear the closer the player gets
 * (`fogPeekStrengthAt`) — the same local-falloff technique the player's
 * carried torch already uses against darkness, applied to fog instead, so a
 * visitor gets a beat of warning before actually crossing into a fogged
 * cell rather than stepping in blind. A puff whose peeked alpha reaches
 * zero is skipped entirely.
 *
 * Fast path (SC-005): when `fogLevel <= 0` this draws nothing, so a level
 * with no cave-family background renders exactly as it did before this
 * feature.
 */
export function drawFog(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  fogLevel: number,
  originX = 0,
  originY = 0,
  worldElapsed = 0,
  playerPosition: Point | null = null,
): void {
  if (fogLevel <= 0) return;

  const grid = level.background ?? [];
  for (let row = 0; row < grid.length; row++) {
    const gridRow = grid[row];
    for (let col = 0; col < gridRow.length; col++) {
      if (!isCellDarkening(level, col, row)) continue;
      if (isFogExempt(tileAt(level, col, row))) continue;

      const puff = fogPuffAt(col, row, worldElapsed);
      const peek = playerPosition ? fogPeekStrengthAt(puff.x, puff.y, playerPosition) : 0;
      const puffAlpha = fogLevel * FOG_DENSITY * (1 - peek);
      if (puffAlpha <= 0) continue;

      const screenX = puff.x + originX;
      const screenY = puff.y + originY;

      const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, puff.radius);
      gradient.addColorStop(0, `rgba(${FOG_TINT_RGB}, ${puffAlpha})`);
      gradient.addColorStop(FOG_PUFF_PLATEAU, `rgba(${FOG_TINT_RGB}, ${puffAlpha})`);
      gradient.addColorStop(1, `rgba(${FOG_TINT_RGB}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, puff.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draws the player sprite. `originX` and `originY` shift it horizontally and
 * vertically by the same amounts as `drawTerrain`'s `originX`/`originY`, so
 * the player stays aligned with the terrain (bottom-anchored, camera-scrolled,
 * or both). When `player.direction` is `'left'`, the sprite is mirrored
 * horizontally around its own bounding box — the sheet only needs to depict
 * the character facing one direction. `jumpSpriteSheet` is a separate,
 * higher-resolution sheet used only while `animState === 'jump'` (the
 * placeholder primary sheet has no jump row); if it hasn't loaded yet, this
 * falls back to the primary sheet's current frame rather than drawing
 * nothing.
 *
 * A crouched hit reaction (`player.crouching && animState === 'hit'`) is the
 * one special branch: it draws the crouch pose (DUCK row) through the reusable
 * `drawTintedSprite` red tint when a caller-owned `tintLayer` is given, or
 * plainly when it is not — never the baked `hit` row a standing hit draws
 * (FR-016).
 */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  spriteSheet: HTMLImageElement,
  originX = 0,
  originY = 0,
  jumpSpriteSheet: HTMLImageElement | null = null,
  // Invulnerability blink: PlatformerPage.tsx toggles this
  // every ~0.1s while the player is invulnerable instead of drawing a tinted
  // sprite — simpler, and consistent with this renderer having no
  // alpha/tint effects anywhere else.
  visible = true,
  // Caller-owned 64×64 scratch layer for the crouched-hit red tint (FR-016),
  // reused across frames exactly like drawDarkness's lighting layer. Null
  // (the default, e.g. the editor preview) draws the crouch pose plainly.
  tintLayer: HTMLCanvasElement | null = null,
): void {
  if (!visible) return;
  ctx.imageSmoothingEnabled = false;

  // Crouched hit reaction (FR-016): the red reaction is a render-time tint on
  // the crouch pose, so no red-tinted crouch art exists and the standing hit's
  // baked red frame stays byte-for-byte unchanged (handled below). The tint
  // pulses on the same `hit` row cadence the standing flash uses — red only on
  // HIT_RED_FRAME_INDEX — so it does not stay red for the whole reaction window.
  if (player.crouching && player.animState === 'hit') {
    const { sx, sy } = playerFrameSource('crouch', player.animFrame);
    const redFlashOn = hitFrameFromTimer(player.hitTimer) === HIT_RED_FRAME_INDEX;
    const drawCrouchFrame = (destX: number, destY: number): void => {
      if (tintLayer && redFlashOn) {
        drawTintedSprite(
          ctx,
          tintLayer,
          spriteSheet,
          sx,
          sy,
          PLAYER_FRAME_SIZE,
          destX,
          destY,
          PLAYER_RENDERED_SIZE,
          CROUCH_HIT_TINT,
        );
      } else {
        ctx.drawImage(
          spriteSheet,
          sx,
          sy,
          PLAYER_FRAME_SIZE,
          PLAYER_FRAME_SIZE,
          destX,
          destY,
          PLAYER_RENDERED_SIZE,
          PLAYER_RENDERED_SIZE,
        );
      }
    };

    if (player.direction === 'left') {
      ctx.save();
      ctx.translate(player.x + originX + PLAYER_RENDERED_SIZE, player.y + originY);
      ctx.scale(-1, 1);
      drawCrouchFrame(0, 0);
      ctx.restore();
    } else {
      drawCrouchFrame(player.x + originX, player.y + originY);
    }
    return;
  }

  const useHighResSheet =
    (player.animState === 'jump' || player.animState === 'climb') && jumpSpriteSheet !== null;
  const frameSize = useHighResSheet ? JUMP_FRAME_SIZE : PLAYER_FRAME_SIZE;
  const sheet = useHighResSheet ? jumpSpriteSheet : spriteSheet;
  // `hit`'s frame comes from `hitTimer` directly (see hitFrameFromTimer's
  // doc comment) rather than from `player.animFrame` — every other state
  // still uses the incrementally-advanced counter.
  const { sx, sy } = !useHighResSheet
    ? playerFrameSource(
        player.animState,
        player.animState === 'hit' ? hitFrameFromTimer(player.hitTimer) : player.animFrame,
      )
    : player.animState === 'climb'
      ? climbFrameSource(player.animFrame)
      : jumpFrameSource(player.vy, player.animFrame);

  if (player.direction === 'left') {
    ctx.save();
    ctx.translate(player.x + originX + PLAYER_RENDERED_SIZE, player.y + originY);
    ctx.scale(-1, 1);
    ctx.drawImage(
      sheet,
      sx,
      sy,
      frameSize,
      frameSize,
      0,
      0,
      PLAYER_RENDERED_SIZE,
      PLAYER_RENDERED_SIZE,
    );
    ctx.restore();
    return;
  }

  ctx.drawImage(
    sheet,
    sx,
    sy,
    frameSize,
    frameSize,
    player.x + originX,
    player.y + originY,
    PLAYER_RENDERED_SIZE,
    PLAYER_RENDERED_SIZE,
  );
}

/** The held torch is drawn a little translucent so its bright flame doesn't
 *  glare yellow against the dark (FR-025). The offset/scale geometry it shares
 *  with the player's carried light now lives in `entities/Player.ts`
 *  (`heldTorchPlacement`), so the drawn flame and the light cannot drift
 *  (FR-004/SC-007). */
const HELD_TORCH_ALPHA = 0.8;

/**
 * Draws the very small torch the player carries, but only while standing or
 * walking **and** only in the dark (FR-025/FR-026/FR-027). Reuses the wall
 * torches' own flame frames so the style matches (FR-028), mirrored to face
 * the player's direction. Drawn with the player, before the darkness overlay,
 * so the player's own light reveals it.
 *
 * The placement comes from `entities/Player.ts`'s `heldTorchPlacement(player)`
 * — the same geometry the player's `LightSource` adapter reads — so the flame
 * and its light cannot drift (SC-007). `centerX` is the flame/image centre, so
 * the image's left edge is `centerX - width / 2` for a right-facing player and
 * the mirror anchor is `centerX + width / 2` for a left-facing one.
 */
export function drawHeldTorch(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  torchSheet: HTMLImageElement | null,
  darknessLevel: number,
  originX = 0,
  originY = 0,
  worldElapsed = 0,
): void {
  if (!torchSheet) return;
  if (darknessLevel <= 0) return;
  if (player.animState !== 'walk' && player.animState !== 'idle') return;

  const { sx, sy } = frameSource(TORCH_SHEET, torchFrameIndex(0, 0, worldElapsed));
  const { centerX, topY, width, height } = heldTorchPlacement(player);
  const drawCenterX = centerX + originX;
  const drawTopY = topY + originY;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = HELD_TORCH_ALPHA;
  if (player.direction === 'left') {
    ctx.translate(drawCenterX + width / 2, drawTopY);
    ctx.scale(-1, 1);
    ctx.drawImage(torchSheet, sx, sy, TORCH_FRAME_WIDTH, TORCH_FRAME_HEIGHT, 0, 0, width, height);
  } else {
    ctx.drawImage(
      torchSheet,
      sx,
      sy,
      TORCH_FRAME_WIDTH,
      TORCH_FRAME_HEIGHT,
      drawCenterX - width / 2,
      drawTopY,
      width,
      height,
    );
  }
  ctx.restore();
}

/** Tile coordinates of the signpost sprite within world_tileset.png (col 8,
 *  row 3 -> pixel 128,48) — sits immediately right of the crate tile (col 7,
 *  row 3). */
const SIGN_TILE_SX = 8 * TILE_SIZE;
const SIGN_TILE_SY = 3 * TILE_SIZE;

/**
 * Draws every hint sign's static signpost sprite. Same originX/originY
 * convention as drawTerrain/drawPlayer/drawPickups. Signs have no
 * animation and no collected/removed state (unlike collectibles) — every
 * placement in `signs` is always drawn.
 */
export function drawSigns(
  ctx: CanvasRenderingContext2D,
  signs: readonly SignPlacement[],
  tileset: HTMLImageElement,
  originX = 0,
  originY = 0,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const sign of signs) {
    ctx.drawImage(
      tileset,
      SIGN_TILE_SX,
      SIGN_TILE_SY,
      TILE_SIZE,
      TILE_SIZE,
      sign.x + originX,
      sign.y + originY,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
  }
}

/**
 * THE one generic pickup draw path — dispatches each entry to its own kind's
 * `draw`, so the renderer names no kind. When `layer` is given, only kinds
 * whose `drawLayer` matches are drawn; the page invokes it at three bands to
 * preserve the current draw order (fruit before blocks, coins after mid-world
 * effects but before enemies, key/heart/bomb after enemies), while the editor
 * preview omits the layer and draws every present kind.
 *
 * A per-kind index is tracked over ALL items (incremented before the
 * visibility test), so a coin's frame/placement index stays stable regardless
 * of which entries have been collected. An item whose shared `collected` flag
 * is true is skipped — that is the one visibility rule; there is no
 * collected-id set and no per-kind `isVisible`. A missing sprite for one type
 * is handled inside that type's own `draw` (it simply skips), so a missing
 * sprite never hides the others.
 */
export function drawPickups(
  ctx: CanvasRenderingContext2D,
  groups: PickupGroups,
  dc: DrawContext,
  layer?: PickupDrawLayer,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const kind of Object.keys(groups) as PickupKind[]) {
    const items = groups[kind];
    if (!items) continue;
    const type = PICKUP_TYPES[kind];
    if (layer !== undefined && type.drawLayer !== layer) continue;
    let index = 0;
    for (const item of items) {
      const itemIndex = index;
      index += 1;
      if (item.collected) continue;
      type.draw(item as Pickup, dc, itemIndex);
    }
  }
}

/** Draws every spike hazard. Knows nothing about any specific hazard kind —
 *  each one renders itself (see entities/hazards/). */
export function drawHazards(
  ctx: CanvasRenderingContext2D,
  hazards: readonly HazardPlacement[],
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const hazard of hazards) {
    hazardTypeOf(hazard).draw(hazard, dc);
  }
}

/** Draws every living enemy. Knows nothing about any specific enemy type —
 *  each one renders itself (see entities/enemies/). */
export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: readonly EnemyState[],
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    typeOf(enemy).draw(enemy, dc);
  }
}

/** Draws every block. Knows nothing about any specific kind — each one renders
 *  itself (see entities/blocks/). */
export function drawBlocks(
  ctx: CanvasRenderingContext2D,
  blocks: readonly BlockState[],
  dc: DrawContext<PotRenderPlan>,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const block of blocks) {
    BLOCK_TYPES[block.blockKind].draw(block, dc);
  }
}

const CHECKPOINT_TWINKLE_COLOR = '#ffe9a8';
/** Seconds per twinkle blink. */
const CHECKPOINT_TWINKLE_PERIOD_SECONDS = 1.1;
/** Arm length of one twinkle plus, in native px (1 -> a 3x3 plus). */
const CHECKPOINT_TWINKLE_ARM = 1;
/** Fixed twinkle spots, in screen px relative to the flag art's drawn
 *  top-left, each with its own phase so they don't blink in unison. Kept few
 *  and near the flag so the active marker stays subtle. */
const CHECKPOINT_TWINKLE_SPOTS: readonly { dx: number; dy: number; phase: number }[] = [
  { dx: 16, dy: -5, phase: 0 },
  { dx: 30, dy: 9, phase: 0.45 },
  { dx: 2, dy: 15, phase: 0.75 },
];

/** Draws one small pixel-art sparkle — an integer-aligned plus of native
 *  pixels — so it stays crisp against the game's pixel art. */
function drawPixelSparkle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  arm: number,
  color: string,
  alpha: number,
): void {
  const s = RENDER_SCALE;
  const nx = Math.round(cx / s) * s;
  const ny = Math.round(cy / s) * s;
  const a = arm * s;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(nx - a, ny, a * 2 + s, s);
  ctx.fillRect(nx, ny - a, s, a * 2 + s);
}

/**
 * Draws the subtle pixel-art twinkles marking the active respawn target
 * (FR-021). A rendered pass rather than a sprite frame, so exactly one
 * checkpoint — the one whose id matches `activeCheckpointId` — twinkles while
 * every touched flag still reads as raised. Each spot blinks on its own phase
 * from the shared world clock (so it freezes with the rest of the world
 * during death/pause). Draws nothing when `isActive` is false.
 */
export function drawCheckpointTwinkles(
  state: CheckpointState,
  dc: DrawContext,
  isActive: boolean,
): void {
  if (!isActive) return;
  const { ctx } = dc;
  const flagX = state.x + dc.originX + (RENDERED_TILE_SIZE - CHECKPOINT_RENDERED_WIDTH) / 2;
  const flagY = state.y + dc.originY + RENDERED_TILE_SIZE - CHECKPOINT_RENDERED_HEIGHT;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const spot of CHECKPOINT_TWINKLE_SPOTS) {
    const t = dc.worldElapsed / CHECKPOINT_TWINKLE_PERIOD_SECONDS + spot.phase;
    const wave = (pulse(t) + 1) / 2;
    drawPixelSparkle(
      ctx,
      flagX + spot.dx,
      flagY + spot.dy,
      CHECKPOINT_TWINKLE_ARM,
      CHECKPOINT_TWINKLE_COLOR,
      0.25 + 0.75 * wave,
    );
  }
  ctx.restore();
}

/**
 * Draws every checkpoint flag. A checkpoint is never removed, so nothing is
 * skipped — the frame comes from the state's derived raise index (frame 0
 * dormant, advancing to frame 3 as the shared clock passes
 * `activatedAt`). The flag is bottom-anchored and centred on its tile
 * (its art is taller than a cell). The active target's twinkles are drawn
 * after its flag, so they sit on top (FR-021).
 */
export function drawCheckpoints(
  ctx: CanvasRenderingContext2D,
  states: readonly CheckpointState[],
  image: HTMLImageElement | null,
  activeCheckpointId: string | null,
  dc: DrawContext,
): void {
  if (!image) return;
  ctx.imageSmoothingEnabled = false;

  for (const state of states) {
    const frame = checkpointFrameIndex(state, dc.worldElapsed);
    const { sx } = frameSource(CHECKPOINT_FLAG_SHEET, frame);
    const destX = state.x + dc.originX + (RENDERED_TILE_SIZE - CHECKPOINT_RENDERED_WIDTH) / 2;
    const destY = state.y + dc.originY + RENDERED_TILE_SIZE - CHECKPOINT_RENDERED_HEIGHT;
    ctx.drawImage(
      image,
      sx,
      0,
      CHECKPOINT_FRAME_WIDTH,
      CHECKPOINT_FRAME_HEIGHT,
      destX,
      destY,
      CHECKPOINT_RENDERED_WIDTH,
      CHECKPOINT_RENDERED_HEIGHT,
    );

    drawCheckpointTwinkles(state, dc, state.id === activeCheckpointId);
  }
}
