import {
  tileAt,
  isTopExposed,
  bridgeRunPosition,
  chainAttachment,
  chainRunLength,
  cobwebOrientation,
  horizontalRunPosition,
  neighbourMask,
  NEIGHBOUR_UP,
  tileToPixel,
  TILE_SIZE,
  RENDER_SCALE,
  RENDERED_TILE_SIZE,
  verticalRunRole,
  backgroundNeighbourMask,
} from '../level/Terrain';
import type { ChainAttachment } from '../level/Terrain';
import { groundAtlasCell, grassCell, GRASS_SOURCE_HEIGHT } from './GroundAtlas';
import { backgroundAtlasCell } from './BackgroundAtlas';
import { backgroundRockEntry } from './BackgroundDecorCatalog';
import {
  bushOrTreeEntry,
  staticObjectEntry,
  stalactiteEntry,
  stalagmiteEntry,
  chainRunPieces,
  ROPE_BUNDLE,
  ROPE_STEP,
  ROPE_BOTTOM_CAP,
  ropeLadderShaftPieces,
  COBWEB_CORNER_ENTRY,
  COBWEB_FLAT_ENTRY,
} from './StaticObjectsCatalog';
import {
  mushroomEntry,
  mushroomHasCap,
  MUSHROOM_CAP_SOURCE_HEIGHT,
  MUSHROOM_DECORATIVE_ENTRY,
  mushroomSquashDipAt,
} from '../entities/blocks/Mushroom';
import type { MushroomSquashState } from '../entities/blocks/Mushroom';
import {
  revealedStepCount,
  shaftCellCount,
  LADDER_STEP_NATIVE_PX,
} from './DeployableLadder';
import type { DeployableLadderState } from './DeployableLadder';
import { isFogExempt } from '../level/LevelData';
import type { LevelDef, TileType } from '../level/LevelData';
import type { SignPlacement } from '../level/SignMapper';
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
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import {
  MAX_HEARTS,
  HEART_FRAME_SIZE,
  HEART_RENDERED_SIZE,
  heartRemaining,
  heartFrameIndex,
} from '../entities/Health';
import { PICKUP_TYPES } from '../entities/pickups';
import type { Pickup, PickupGroups } from '../contracts/Pickup';
import type { PickupKind } from '../contracts/PickupKind';
import type { PickupDrawLayer } from '../entities/pickups/PickupType';
import { typeOf } from '../entities/enemies';
import type { EnemyState } from '../entities/Enemy';
import { typeOf as hazardTypeOf } from '../entities/hazards';
import type { HazardPlacement } from '../level/HazardMapper';
import type { DrawContext } from '../contracts/DrawContext';
import type { PotRenderPlan } from '../entities/blocks/potTypes';
import { KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT } from '../entities/pickups/Key';
import type { BlockState } from '../entities/Block';
import { BLOCK_TYPES } from '../entities/blocks';
import { CHEST_TYPE } from '../entities/chests';
import { CHEST_CLOSED_WIDTH, CHEST_CLOSED_HEIGHT } from '../entities/Chest';
import type { ChestState } from '../entities/Chest';
import {
  CHECKPOINT_FLAG_SHEET,
  CHECKPOINT_FRAME_WIDTH,
  CHECKPOINT_FRAME_HEIGHT,
  CHECKPOINT_RENDERED_WIDTH,
  CHECKPOINT_RENDERED_HEIGHT,
  checkpointFrameIndex,
} from '../entities/Checkpoint';
import type { CheckpointState } from '../entities/Checkpoint';
import { frameSource } from '../entities/sprites/SpriteSheet';
import { pulse } from '../shared/math';
import { fillTextWithOutline, RESTART_PROMPT_FONT_FAMILY } from './textDraw';
import { TORCH_SHEET, BOMB_SHEET, CRUMBLE_FLOOR_SHEET, CRUMBLE_CRACKS_SHEET } from '../entities/sprites/sheets';import {
  crumblingFloorPhaseFor,
  crumblingFloorCrackRatioFor,
  crumblingFloorReformRatioFor,
  crumblingFloorShakeOffsetXAt,
  crumblingFloorElapsedFor,
} from './CrumblingFloor';
import type { CrumblingFloorTimerState } from './CrumblingFloor';
import { bombFuseFrame } from './PlacedBomb';
import type { PlacedBombState } from './PlacedBomb';
import {
  TORCH_FRAME_WIDTH,
  TORCH_FRAME_HEIGHT,
  TORCH_INSET_X,
  torchFrameIndex,
} from '../entities/Torch';
import type { Point } from './Lighting';
import type { LightSource } from '../contracts/lighting';
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
} from './Lighting';

function tileSource(
  level: LevelDef,
  type: TileType,
  col: number,
  row: number,
): { sx: number; sy: number } | null {
  switch (type) {
    case 'groundGrass':
      // Drawn by drawTerrain's own atlas path — it sources from a different
      // image and may be rotated, neither of which this shared lookup models.
      return null;
    case 'groundRock':
      return isTopExposed(level, col, row)
        ? { sx: TILE_SIZE, sy: 0 }
        : { sx: TILE_SIZE, sy: TILE_SIZE };
    case 'wall':
      return { sx: 8 * TILE_SIZE, sy: 0 };
    case 'bridge': {
      const position = bridgeRunPosition(level, col, row);
      if (position === 'left') return { sx: 9 * TILE_SIZE, sy: 2 * TILE_SIZE }; // ramp down
      if (position === 'right') return { sx: 11 * TILE_SIZE, sy: 2 * TILE_SIZE }; // ramp up
      return { sx: 10 * TILE_SIZE, sy: 2 * TILE_SIZE }; // low (middle, or a lone single tile)
    }
    case 'ladder':
      return { sx: 9 * TILE_SIZE, sy: 3 * TILE_SIZE };
    case 'chain':
      // Drawn by drawTerrain's own staticObjects branch — an entire shaft is
      // composited as one run from its top cell, which this shared
      // single-tile lookup has no way to express.
      return null;
    case 'bush':
    case 'fence':
    case 'cobweb':
    case 'crystalCluster':
    case 'stalactite':
    case 'stalagmite':
      // Drawn by drawTerrain's own staticObjects/decorations branch when that
      // sheet is loaded; this shared lookup only runs when it isn't, so there
      // is nothing to draw here.
      return null;
    case 'torch':
      // Drawn by drawTerrain's own torch branch (a frame picked from
      // TORCH_SHEET by grid position + the world clock) — not a static
      // sx/sy lookup, so there is nothing to return here.
      return null;
    case 'ladderBundle':
    case 'ropeLadder':
      // Drawn by drawDeployableLadders (the rolled bundle parcel, and the
      // deployed shaft's cap/step pieces), which needs the bundle's runtime
      // state — not a static sx/sy lookup, so there is nothing to return here.
      return null;
    case 'bouncyMushroom':
    case 'decorativeMushroom':
      // Drawn by drawTerrain's own mushroom branch when the mushroom sheet is
      // loaded (the cap/stem split, the squash dip and the decorative cell are
      // all neighbour- or state-dependent) — not a static sx/sy lookup.
      return null;
    case 'crumblingFloor':
      // Drawn by the dedicated drawCrumblingFloors pass below, which needs
      // per-cell cycle state (crack stage, shake, reform scale) this shared
      // static sx/sy lookup has no way to access — not a plain tile-source
      // lookup, same reasoning as ladderBundle/bouncyMushroom above.
      return null;
    case 'empty':
      return null;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

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
    ctx.drawImage(tileset, WATER_TILE_SX, WATER_CREST_SY, TILE_SIZE, TILE_SIZE, x, topY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
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
    ctx.fillRect(Math.round(centerX - halfGap - halfSize), eyeY, ENEMY_EYE_SIZE_PX, ENEMY_EYE_SIZE_PX);
    ctx.fillRect(Math.round(centerX + halfGap - halfSize), eyeY, ENEMY_EYE_SIZE_PX, ENEMY_EYE_SIZE_PX);
  }

  ctx.restore();
}

/**
 * Draws one atlas cell into a terrain cell, applying the entry's rotation
 * about the cell's own centre (see GroundAtlas.ts). A quarter turn moves a
 * border onto an adjacent edge and would also swing a vertical brightness
 * ramp sideways, so it is only used on cells measured flat: `c1r1`, `c6r0`,
 * `c6r1`. A half turn maps every edge onto its opposite and flips the ramp
 * end-for-end, which is exactly why the isolated-tile cell `c0r0` uses one —
 * it puts that cell's bright end in the strip visible below the grass.
 */
/**
 * Draws one atlas cell into a tile-sized cell, applying the entry's rotation
 * about the cell's own centre — the shared rotation-aware draw both
 * `drawTerrain` (ground tiles) and `drawBackgroundTiles` (O-014's background
 * mass) use, since both index into a 16px-tile atlas the same way and only
 * differ in which atlas image and lookup table they use. A quarter turn moves
 * a border onto an adjacent edge (and would also swing a vertical brightness
 * ramp sideways for `GroundAtlas`, so that caller only uses one on cells
 * measured flat — see `GroundAtlas.ts`'s own doc comment); a half turn maps
 * every edge onto its opposite.
 */
function drawRotatedTile(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  entry: { sx: number; sy: number; rotation: 0 | 1 | 2 | 3 },
  destX: number,
  destY: number,
): void {
  if (entry.rotation === 0) {
    ctx.drawImage(
      atlas, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
      destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
    );
    return;
  }

  const half = RENDERED_TILE_SIZE / 2;
  ctx.save();
  ctx.translate(destX + half, destY + half);
  ctx.rotate((entry.rotation * Math.PI) / 2);
  ctx.drawImage(
    atlas, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
    -half, -half, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
  );
  ctx.restore();
}

/**
 * Grass continues into a horizontal neighbour only when that neighbour is
 * itself a grass-topped surface cell. A `groundRock` neighbour, or a
 * `groundGrass` one that is buried because the terrain steps up, caps the
 * run instead — so this adds a material check on top of the ground mask's
 * notion of exposure. Exposure is read from the mask's UP bit rather than
 * `isTopExposed` so that a bridge overhead counts as open space here exactly
 * as it does when the ground cell is chosen.
 */
function isGrassSurface(level: LevelDef, col: number, row: number): boolean {
  return (
    tileAt(level, col, row) === 'groundGrass' &&
    (neighbourMask(level, col, row) & NEIGHBOUR_UP) === 0
  );
}

/** Native-pixel offset used two ways for a wall-hugging chain shaft
 *  (left/right attachment): vertically, its TOP piece starts this far below
 *  the cell's own top (its hook art has no top-side neck margin the way
 *  ceiling/floating pieces do, so without this it reads as sitting higher
 *  than a ceiling-attached shaft's top at the same row); horizontally, every
 *  piece BELOW the top one is offset this far in from the wall tile beside
 *  it, instead of flush against it — deliberately leaving room to draw a
 *  small connector piece bridging the seam later. Never applied to the top
 *  piece's own horizontal position (its art already has that gap baked in —
 *  that's what makes the hook read as "attached to the wall"), and never
 *  applied at all to ceiling/floating shafts, which have no wall edge. */
const CHAIN_WALL_GAP = 2 * RENDER_SCALE;

/**
 * Horizontal destination for one chain piece within its cell. `left`/`right`
 * pieces are 7px (not 5) wide — the extra width is a connector bar baked
 * into the art — and only the run's TOP piece draws flush against its wall
 * (`isTopPiece`): its own art already has the wall gap baked in, which is
 * what makes the hook read as "attached" in the first place. Every piece
 * below it is a plain, symmetric shape with no such gap built in, so
 * `CHAIN_WALL_GAP` is added there instead, to land at the same offset the
 * top piece's own art already reads as. Ceiling/floating pieces are always
 * centered, having no wall to hug at all.
 */
function chainPieceDestX(
  attachment: ChainAttachment,
  isTopPiece: boolean,
  destX: number,
  renderedWidth: number,
): number {
  if (attachment === 'left') return destX + (isTopPiece ? 0 : CHAIN_WALL_GAP);
  if (attachment === 'right') return destX + RENDERED_TILE_SIZE - renderedWidth - (isTopPiece ? 0 : CHAIN_WALL_GAP);
  return destX + (RENDERED_TILE_SIZE - renderedWidth) / 2;
}

/**
 * Draws the level's terrain. `originX` shifts every tile horizontally and
 * `originY` shifts every tile vertically (e.g. to anchor the level to the
 * bottom of a taller-than-the-level canvas instead of drawing it pinned to
 * the top with empty space below, or to scroll it horizontally with the
 * camera). Both default to 0 (level drawn at its raw grid position,
 * top-left origin).
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

  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const tile = tileAt(level, col, row);
      const { x, y } = tileToPixel(col, row);
      const destX = x + originX;
      const destY = y + originY;

      if (tile === 'groundGrass') {
        const mask = neighbourMask(level, col, row);
        drawRotatedTile(ctx, groundAtlas, groundAtlasCell(mask), destX, destY);

        if ((mask & NEIGHBOUR_UP) === 0) {
          const grass = grassCell(horizontalRunPosition(level, col, row, isGrassSurface));
          ctx.drawImage(
            groundAtlas, grass.sx, grass.sy, TILE_SIZE, GRASS_SOURCE_HEIGHT,
            destX, destY, RENDERED_TILE_SIZE, GRASS_SOURCE_HEIGHT * RENDER_SCALE,
          );
        }
        continue;
      }

      if (tile === 'bush') {
        const entry = bushOrTreeEntry(verticalRunRole(level, col, row, 'bush'), col, row);
        ctx.drawImage(
          tileset, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
          destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
        );
        continue;
      }

      if (staticObjects && tile === 'fence') {
        const entry = staticObjectEntry('fence', col, row);
        ctx.drawImage(
          staticObjects, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
          destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
        );
        continue;
      }

      if (decorations && tile === 'cobweb') {
        const orientation = cobwebOrientation(level, col, row);
        if (!orientation.corner) {
          ctx.drawImage(
            decorations,
            COBWEB_FLAT_ENTRY.sx, COBWEB_FLAT_ENTRY.sy,
            COBWEB_FLAT_ENTRY.width ?? TILE_SIZE, COBWEB_FLAT_ENTRY.height ?? TILE_SIZE,
            destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
          );
        } else if (orientation.rotation === 0) {
          ctx.drawImage(
            decorations,
            COBWEB_CORNER_ENTRY.sx, COBWEB_CORNER_ENTRY.sy,
            COBWEB_CORNER_ENTRY.width ?? TILE_SIZE, COBWEB_CORNER_ENTRY.height ?? TILE_SIZE,
            destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
          );
        } else {
          const half = RENDERED_TILE_SIZE / 2;
          ctx.save();
          ctx.translate(destX + half, destY + half);
          ctx.rotate((orientation.rotation * Math.PI) / 2);
          ctx.drawImage(
            decorations,
            COBWEB_CORNER_ENTRY.sx, COBWEB_CORNER_ENTRY.sy,
            COBWEB_CORNER_ENTRY.width ?? TILE_SIZE, COBWEB_CORNER_ENTRY.height ?? TILE_SIZE,
            -half, -half, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
          );
          ctx.restore();
        }
        continue;
      }

      if (decorations && tile === 'crystalCluster') {
        const entry = staticObjectEntry('crystalCluster', col, row);
        ctx.drawImage(
          decorations, entry.sx, entry.sy, entry.width ?? TILE_SIZE, entry.height ?? TILE_SIZE,
          destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
        );
        continue;
      }

      if (decorations && tile === 'stalactite') {
        const entry = stalactiteEntry(col, row);
        ctx.drawImage(
          decorations, entry.sx, entry.sy, entry.width ?? TILE_SIZE, entry.height ?? TILE_SIZE,
          destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
        );
        continue;
      }

      if (decorations && tile === 'stalagmite') {
        const entry = stalagmiteEntry(col, row);
        ctx.drawImage(
          decorations, entry.sx, entry.sy, entry.width ?? TILE_SIZE, entry.height ?? TILE_SIZE,
          destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
        );
        continue;
      }

      if (torch && tile === 'torch') {
        // The frame is a pure function of the cell's grid position and the
        // shared world clock (engine/Torch.ts) — no per-instance state, and
        // neighbouring torches flicker out of phase. The 12x14 frame is
        // bottom-aligned and horizontally centred in the 16px cell; never
        // mirrored or rotated (single fixed front-facing sprite, spec FR-007).
        const frame = frameSource(TORCH_SHEET, torchFrameIndex(col, row, worldElapsed));
        ctx.drawImage(
          torch,
          frame.sx,
          frame.sy,
          TORCH_FRAME_WIDTH,
          TORCH_FRAME_HEIGHT,
          destX + TORCH_INSET_X * RENDER_SCALE,
          destY + (TILE_SIZE - TORCH_FRAME_HEIGHT) * RENDER_SCALE,
          TORCH_FRAME_WIDTH * RENDER_SCALE,
          TORCH_FRAME_HEIGHT * RENDER_SCALE,
        );
        continue;
      }

      if (mushroom && tile === 'decorativeMushroom') {
        // A single fixed cell; the small mushroom's art already sits in the
        // lower part of its 16px cell.
        ctx.drawImage(
          mushroom,
          MUSHROOM_DECORATIVE_ENTRY.sx, MUSHROOM_DECORATIVE_ENTRY.sy,
          TILE_SIZE, TILE_SIZE,
          destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
        );
        continue;
      }

      if (mushroom && tile === 'bouncyMushroom') {
        // A vertical run reads as one mushroom: the cap-bearing roles split
        // their sprite into an unshifted stem/connector sub-rect and a cap
        // sub-rect that dips on a bounce; `middle`/`bottom` draw one whole
        // role cell. `dip` is in rendered px and is 0 with no active squash.
        const role = verticalRunRole(level, col, row, 'bouncyMushroom');
        const entry = mushroomEntry(role);
        if (mushroomHasCap(role)) {
          const dip = mushroomSquashDipAt(mushroomSquashes, col, row);
          const capH = MUSHROOM_CAP_SOURCE_HEIGHT;
          // Stem/connector first, unshifted, so only the cap moves.
          ctx.drawImage(
            mushroom, entry.sx, entry.sy + capH, TILE_SIZE, TILE_SIZE - capH,
            destX, destY + capH * RENDER_SCALE, RENDERED_TILE_SIZE, (TILE_SIZE - capH) * RENDER_SCALE,
          );
          // Cap, dipped.
          ctx.drawImage(
            mushroom, entry.sx, entry.sy, TILE_SIZE, capH,
            destX, destY + dip, RENDERED_TILE_SIZE, capH * RENDER_SCALE,
          );
        } else {
          ctx.drawImage(
            mushroom, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
            destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
          );
        }
        continue;
      }

      if (staticObjects && tile === 'chain') {
        // Only a run's TOP cell draws anything — every cell below it is
        // part of the same composited shaft and is skipped here (drawn
        // already, from the top). Chain pieces don't fit the 16px tile grid
        // (the artist's link art has a 6px vertical repeat, not a divisor of
        // 16), so unlike every other tile in this file, a chain shaft is
        // composited as one continuous stack of native-sized pieces rather
        // than one sprite per cell.
        if (tileAt(level, col, row - 1) !== 'chain') {
          const attachment = chainAttachment(level, col, row);
          const runLength = chainRunLength(level, col, row);
          const pieces = chainRunPieces(attachment, runLength);
          const capY = destY + runLength * RENDERED_TILE_SIZE;
          // A wall-hugging shaft's top piece starts a couple of native px
          // below the cell's own top — its hook art has no top-side neck
          // margin the way the ceiling/floating pieces do, so without this
          // it reads as sitting visibly higher than a ceiling-attached
          // shaft's top would at the same row. Applies to the top piece
          // only; pieces below it continue directly, no added offset.
          const isWallAttached = attachment === 'left' || attachment === 'right';
          let drawY = isWallAttached ? destY + CHAIN_WALL_GAP : destY;
          for (let index = 0; index < pieces.length; index++) {
            const piece = pieces[index];
            const renderedWidth = piece.width * RENDER_SCALE;
            const renderedHeight = piece.height * RENDER_SCALE;
            const drawHeight = Math.min(renderedHeight, capY - drawY);
            if (drawHeight <= 0) break;
            const pieceDestX = chainPieceDestX(attachment, index === 0, destX, renderedWidth);
            ctx.drawImage(
              staticObjects, piece.sx, piece.sy, piece.width, drawHeight / RENDER_SCALE,
              pieceDestX, drawY, renderedWidth, drawHeight,
            );
            drawY += drawHeight;
          }
        }
        continue;
      }

      const source = tileSource(level, tile, col, row);
      if (!source) continue;

      ctx.drawImage(
        tileset, source.sx, source.sy, TILE_SIZE, TILE_SIZE,
        destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
      );
    }
  }
}

/**
 * Draws every deployable rope-ladder bundle and its deployed shaft — the one
 * pass that maps bundle state to canvas coordinates (same `originX`/`originY`
 * convention as `drawTerrain`), so the rope scrolls with the camera. Runs
 * immediately after `drawTerrain` so it sits over the terrain it was placed on.
 *
 * Returns immediately when the sheet is not loaded (the same optional-sheet
 * fallback every other decorative pass uses). A `rolled`/`deploying` bundle
 * draws the rolled parcel plus the steps revealed so far (a fixed ~0.5 s
 * reveal measured in 8 px steps — see `revealedStepCount`); a `deployed`
 * bundle draws the full completed shaft as one stack of cap/step pieces. The
 * bundle cell itself is always the shaft's top rung.
 *
 * `level` is accepted for signature parity with `drawTerrain` and reserved for
 * future neighbour-aware art; the state already carries everything the draw
 * needs (column, row, landing row), so it is not read here.
 */
export function drawDeployableLadders(
  ctx: CanvasRenderingContext2D,
  _level: LevelDef,
  states: readonly DeployableLadderState[],
  ropeSheet: HTMLImageElement | null,
  originX = 0,
  originY = 0,
): void {
  if (!ropeSheet) return;
  ctx.imageSmoothingEnabled = false;

  for (const state of states) {
    const destX = state.col * RENDERED_TILE_SIZE + originX;
    const destY = state.row * RENDERED_TILE_SIZE + originY;

    if (state.phase === 'deployed') {
      // Once complete, the bundle cell becomes the shaft's top rung: the top
      // cap plus a plain step fill it, and the steps below sit at exactly the
      // same rows the unroll had revealed them at, so nothing shifts.
      const pieces = ropeLadderShaftPieces(shaftCellCount(state));
      let drawY = destY;
      for (const piece of pieces) {
        ctx.drawImage(
          ropeSheet,
          piece.sx, piece.sy, piece.width, piece.height,
          destX, drawY, piece.width * RENDER_SCALE, piece.height * RENDER_SCALE,
        );
        drawY += piece.height * RENDER_SCALE;
      }
      continue;
    }

    // rolled / deploying: the rolled parcel in its cell, then the steps
    // revealed so far, starting at the bundle cell's bottom edge and clamped
    // so no step spills past the landing cell's bottom. The bottom-most
    // revealed step is the ladder's end (the knotted bottom cap), so it lands
    // in the same place the completed shaft's bottom cap will.
    ctx.drawImage(
      ropeSheet,
      ROPE_BUNDLE.sx, ROPE_BUNDLE.sy, ROPE_BUNDLE.width, ROPE_BUNDLE.height,
      destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
    );

    const stepHeight = LADDER_STEP_NATIVE_PX * RENDER_SCALE;
    const shaftBottomY = (state.landRow + 1) * RENDERED_TILE_SIZE + originY;
    let drawY = destY + RENDERED_TILE_SIZE;
    let remaining = revealedStepCount(state);
    while (remaining > 0 && drawY + stepHeight <= shaftBottomY) {
      const piece = remaining === 1 ? ROPE_BOTTOM_CAP : ROPE_STEP;
      ctx.drawImage(
        ropeSheet,
        piece.sx, piece.sy, piece.width, piece.height,
        destX, drawY, piece.width * RENDER_SCALE, piece.height * RENDER_SCALE,
      );
      drawY += stepHeight;
      remaining -= 1;
    }
  }
}

/**
 * Draws every crumbling floor tile (O-023) at its current cycle phase —
 * exempted from `drawTerrain`/`tileSource` (see that function's
 * `'crumblingFloor'` case) because it needs per-cell timer state, the same
 * reason `drawDeployableLadders` is its own pass. Takes the whole
 * `DrawContext` (like `drawHazards`/`drawBlocks`) rather than raw image
 * refs, since it reads two sprites out of `dc.sprites` by source path.
 *
 * `'broken'` draws nothing (the bare gap). `'atRest'`/`'cracking'` draw the
 * full ledge, with the crack overlay's frame 0/1/2 composited on top once
 * cracking starts (picked from the continuous crack ratio) plus a small
 * horizontal shake jitter. `'reforming'` draws the ledge scaled from small
 * to full, anchored to the cell's own top-center so it grows toward where
 * its collision boundary already sits.
 */
function isCrumblingFloorTile(level: LevelDef, col: number, row: number): boolean {
  return tileAt(level, col, row) === 'crumblingFloor';
}

export function drawCrumblingFloors(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  states: readonly CrumblingFloorTimerState[],
  dc: DrawContext,
): void {
  const ledge = dc.sprites[CRUMBLE_FLOOR_SHEET.src];
  if (!ledge) return;
  const cracks = dc.sprites[CRUMBLE_CRACKS_SHEET.src];

  ctx.imageSmoothingEnabled = false;

  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      if (tileAt(level, col, row) !== 'crumblingFloor') continue;

      const phase = crumblingFloorPhaseFor(states, col, row);
      if (phase === 'broken') continue;

      const { x, y } = tileToPixel(col, row);
      const destX = x + dc.originX;
      const destY = y + dc.originY;

      // 'single' (an isolated tile with no crumblingFloor neighbour on
      // either side) gets its own frame, rounded on both edges — not the
      // flat middle frame a run's interior tiles use.
      const runPosition = horizontalRunPosition(level, col, row, isCrumblingFloorTile);
      const frameIndex =
        runPosition === 'left' ? 0 : runPosition === 'right' ? 2 : runPosition === 'single' ? 3 : 1;
      const { sx: ledgeSx } = frameSource(CRUMBLE_FLOOR_SHEET, frameIndex);

      if (phase === 'reforming') {
        const ratio = crumblingFloorReformRatioFor(states, col, row);
        if (ratio <= 0) continue;
        const w = RENDERED_TILE_SIZE * ratio;
        const h = RENDERED_TILE_SIZE * ratio;
        const dx = destX + (RENDERED_TILE_SIZE - w) / 2;
        ctx.drawImage(ledge, ledgeSx, 0, TILE_SIZE, TILE_SIZE, dx, destY, w, h);
        continue;
      }

      // atRest or cracking.
      const elapsedSeconds = phase === 'cracking' ? crumblingFloorElapsedFor(states, col, row) : 0;
      const shakeX =
        phase === 'cracking' ? crumblingFloorShakeOffsetXAt(elapsedSeconds) * RENDER_SCALE : 0;
      ctx.drawImage(ledge, ledgeSx, 0, TILE_SIZE, TILE_SIZE, destX + shakeX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);

      if (phase === 'cracking' && cracks) {
        const ratio = crumblingFloorCrackRatioFor(states, col, row);
        const frameIndex = Math.min(2, Math.floor(ratio * 3));
        const { sx, sy } = frameSource(CRUMBLE_CRACKS_SHEET, frameIndex);
        const destHeight = (CRUMBLE_CRACKS_SHEET.frameHeight / TILE_SIZE) * RENDERED_TILE_SIZE;
        ctx.drawImage(
          cracks, sx, sy, CRUMBLE_CRACKS_SHEET.frameWidth, CRUMBLE_CRACKS_SHEET.frameHeight,
          destX + shakeX, destY, RENDERED_TILE_SIZE, destHeight,
        );
      }
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
          decorations, rock.sx, rock.sy, TILE_SIZE, TILE_SIZE,
          destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
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

const HUD_MARGIN = 16;
const HEART_SPACING = 4;

/**
 * Reserves room at the HUD's top-left for the journal icon button (a DOM
 * `<img>`/`<button>`, not canvas-drawn — see `PlatformerPage.tsx`) so the
 * heart HUD doesn't render underneath it. 40 is the icon button's size
 * (`size-10` in Tailwind), 8 is the gap between it and the first heart —
 * both must stay in sync with `PlatformerPage.tsx`'s icon button sizing if
 * either changes.
 */
export const HEARTS_START_X = HUD_MARGIN + 40 + 8;

/**
 * Draws the heart HUD at a fixed screen position (top-left by default),
 * unlike `drawTerrain`/`drawPlayer` which take camera-scroll
 * `originX`/`originY` — the HUD must stay put on screen regardless of how
 * far the camera has scrolled into the level. `startX` defaults to
 * `HUD_MARGIN` (the original, unshifted position) so existing callers are
 * unaffected; `PlatformerPage.tsx` passes `HEARTS_START_X` explicitly to
 * make room for the journal icon button.
 */
export function drawHearts(
  ctx: CanvasRenderingContext2D,
  halfHearts: number,
  heartsSheet: HTMLImageElement,
  startX: number = HUD_MARGIN,
): void {
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < MAX_HEARTS; i++) {
    const remaining = heartRemaining(halfHearts, i);
    const sx = heartFrameIndex(remaining) * HEART_FRAME_SIZE;
    const x = startX + i * (HEART_RENDERED_SIZE + HEART_SPACING);
    ctx.drawImage(
      heartsSheet,
      sx,
      0,
      HEART_FRAME_SIZE,
      HEART_FRAME_SIZE,
      x,
      HUD_MARGIN,
      HEART_RENDERED_SIZE,
      HEART_RENDERED_SIZE,
    );
  }
}

/**
 * Paints solid black over the whole canvas except a circular hole of
 * `radius` centered on (centerX, centerY), using the canvas 2D API's
 * even-odd fill rule on two subpaths (the full-canvas rect, then the
 * circle) instead of an offscreen buffer + composite-operation punch —
 * simpler and avoids an extra canvas. `centerX`/`centerY` are screen-space
 * (caller adds the camera originX/originY, matching drawTerrain/drawPlayer's
 * convention). `radius <= 0` draws solid black with no hole at all — the
 * `awaitingRestart` phase and the very start of a death both rely on this.
 */
export function drawIrisOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.rect(0, 0, canvasWidth, canvasHeight);
  if (radius > 0) {
    ctx.moveTo(centerX + radius, centerY);
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
  }
  ctx.fill('evenodd');
  ctx.restore();
}

const RESTART_PROMPT_TEXT = 'Press any button to restart';

/** Public path to the font file loaded for RESTART_PROMPT_FONT_FAMILY. */
export const RESTART_PROMPT_FONT_URL = '/fonts/bytebounce.medium.ttf';

/** Draws the death-screen restart prompt, centered on the canvas. Only ever
 *  drawn on top of a fully-closed drawIrisOverlay (radius 0), so no
 *  background/contrast handling is needed here. Falls back to the
 *  sans-serif stack if RESTART_PROMPT_FONT_FAMILY hasn't finished loading
 *  (or failed to) by the time this is drawn. */
export function drawRestartPrompt(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): void {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `24px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(RESTART_PROMPT_TEXT, canvasWidth / 2, canvasHeight / 2);
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

/**
 * Draws every live placed bomb at its fuse frame (see `bombFuseFrame`),
 * scaled about its tile centre — the orange pre-detonation frame is drawn
 * slightly larger (FR-017). A still-falling bomb is drawn at its current `y`.
 * Frame 0 (the unlit icon) is never drawn on a placed bomb.
 */
export function drawPlacedBombs(
  ctx: CanvasRenderingContext2D,
  bombs: readonly PlacedBombState[],
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  const image = dc.sprites[BOMB_SHEET.src];
  if (!image) return;

  for (const placed of bombs) {
    const { frame, scale } = bombFuseFrame(placed.fuseElapsed);
    const { sx, sy } = frameSource(BOMB_SHEET, frame);
    const centerX = placed.x + RENDERED_TILE_SIZE / 2 + dc.originX;
    const centerY = placed.y + RENDERED_TILE_SIZE / 2 + dc.originY;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.drawImage(
      image,
      sx,
      sy,
      BOMB_SHEET.frameWidth,
      BOMB_SHEET.frameHeight,
      -RENDERED_TILE_SIZE / 2,
      -RENDERED_TILE_SIZE / 2,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
    ctx.restore();
  }
}

/** Draws every chest at its current open/closed sprite — each one renders
 *  itself (see entities/chests/Chest.ts). */
export function drawChests(
  ctx: CanvasRenderingContext2D,
  chests: readonly ChestState[],
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const chest of chests) {
    CHEST_TYPE.draw(chest, dc);
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

/** Border thickness of the low-health glow, in canvas px — a fixed HUD-style
 *  size, not scaled to canvas width/height (same convention as the fixed-size
 *  heart/journal HUD icons). */
export const LOW_HEALTH_GLOW_WIDTH_PX = 18;
/** Full breathe-in/breathe-out cycle length for the pulse. */
export const LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS = 1.4;
const LOW_HEALTH_GLOW_BASE_ALPHA = 0.25;
const LOW_HEALTH_GLOW_PULSE_ALPHA = 0.45;
const LOW_HEALTH_GLOW_COLOR = '#ff1f1f';

/** 0..1 sine breathing curve mapped to [BASE, BASE+PULSE] alpha, driven by a
 *  plain elapsed-seconds counter (not tied to any one effect's lifetime —
 *  the glow is ambient and open-ended for as long as health stays critical,
 *  see PlatformerPage.tsx's `worldAnimElapsed`). */
export function lowHealthGlowAlpha(elapsedSeconds: number): number {
  const wave = (pulse(elapsedSeconds / LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS) + 1) / 2;
  return LOW_HEALTH_GLOW_BASE_ALPHA + wave * LOW_HEALTH_GLOW_PULSE_ALPHA;
}

/** Draws a soft red glow pulsing inward from all four canvas edges — the
 *  low-health warning (spec.md FR-007/FR-008). The caller gates WHETHER
 *  this is called at all (critical health, live gameplay only); this
 *  function only draws, unconditionally, whenever it's invoked. */
export function drawLowHealthGlow(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  elapsedSeconds: number,
): void {
  const alpha = lowHealthGlowAlpha(elapsedSeconds);
  const w = LOW_HEALTH_GLOW_WIDTH_PX;
  ctx.save();
  ctx.globalAlpha = alpha;

  const left = ctx.createLinearGradient(0, 0, w, 0);
  left.addColorStop(0, LOW_HEALTH_GLOW_COLOR);
  left.addColorStop(1, 'rgba(255,31,31,0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, w, canvasHeight);

  const right = ctx.createLinearGradient(canvasWidth, 0, canvasWidth - w, 0);
  right.addColorStop(0, LOW_HEALTH_GLOW_COLOR);
  right.addColorStop(1, 'rgba(255,31,31,0)');
  ctx.fillStyle = right;
  ctx.fillRect(canvasWidth - w, 0, w, canvasHeight);

  const top = ctx.createLinearGradient(0, 0, 0, w);
  top.addColorStop(0, LOW_HEALTH_GLOW_COLOR);
  top.addColorStop(1, 'rgba(255,31,31,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, canvasWidth, w);

  const bottom = ctx.createLinearGradient(0, canvasHeight, 0, canvasHeight - w);
  bottom.addColorStop(0, LOW_HEALTH_GLOW_COLOR);
  bottom.addColorStop(1, 'rgba(255,31,31,0)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, canvasHeight - w, canvasWidth, w);

  ctx.restore();
}

// Matches HEART_RENDERED_SIZE so the coin/fruit counter icons read as the
// same HUD "row height" as the hearts, not a smaller secondary element.
const COUNTER_ICON_SIZE = HEART_RENDERED_SIZE;
const COUNTER_TEXT_GAP = 6;

/**
 * Draws one "[icon] collected / max" counter at a caller-chosen fixed screen
 * position — generalized from step 11's single hardcoded-position
 * drawCoinCounter so PlatformerPage.tsx (Task 8) can place a coin counter
 * and a fruit counter side by side, each with its own sprite icon so it's
 * visually unambiguous which counter measures what.
 */
export function drawCollectibleCounter(
  ctx: CanvasRenderingContext2D,
  icon: HTMLImageElement,
  iconFrame: { sx: number; sy: number; size: number },
  collected: number,
  max: number,
  x: number,
  y: number,
  // Nudges only the icon (never the text) vertically from its default
  // centered position — coin.png/fruit.png's artwork is already centered
  // within its native frame, but a slime's sprite frames (entities/sprites/
  // sheets.ts, drawn via each type's sprite descriptor) are bottom-anchored
  // (no transparent padding below the feet, per enemyTileOffsetY's doc
  // comment in Enemy.ts), which reads as sitting too low once scaled into this counter's
  // fixed-size icon box. Defaults to 0 (coin/fruit's existing behavior,
  // unchanged); the enemy-defeated counter (PlatformerPage.tsx) passes a
  // small negative value to compensate.
  iconYOffset = 0,
  // Shrinks only the drawn icon (never the text's start position, which
  // stays anchored to the full COUNTER_ICON_SIZE-wide slot) — a crate's
  // edge-to-edge terrain art (no transparent padding the way
  // coin.png/fruit.png's centered icons have) reads as noticeably bigger
  // than the other counters' icons at the same draw size otherwise.
  // Defaults to COUNTER_ICON_SIZE (every pre-existing call site's unchanged
  // behavior).
  iconDisplaySize = COUNTER_ICON_SIZE,
): void {
  ctx.imageSmoothingEnabled = false;
  const iconX = x + (COUNTER_ICON_SIZE - iconDisplaySize) / 2;
  const iconY = y - iconDisplaySize / 2 + iconYOffset;
  ctx.drawImage(
    icon,
    iconFrame.sx,
    iconFrame.sy,
    iconFrame.size,
    iconFrame.size,
    iconX,
    iconY,
    iconDisplaySize,
    iconDisplaySize,
  );

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `22px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fillTextWithOutline(ctx, `${collected} / ${max}`, x + COUNTER_ICON_SIZE + COUNTER_TEXT_GAP, y);
  ctx.restore();
}

/** Total on-screen width of the 3-heart row (drawHearts), used to position
 *  the chest counter just past it in the same HUD row. */
const HEARTS_ROW_WIDTH = MAX_HEARTS * HEART_RENDERED_SIZE + (MAX_HEARTS - 1) * HEART_SPACING;

/** Shared horizontal gap between HUD groups (hearts→chest, chest→key) — one
 *  constant reused for every gap on this row, rather than separately
 *  hand-tuned numbers, so the rhythm between groups is equal by
 *  construction instead of by coincidence. */
export const HUD_GROUP_GAP = 24;

/** Horizontal screen position for the persistent chest counter — placed
 *  just to the right of the heart row, same HUD row as the hearts (not a
 *  second row below them). */
export const CHEST_COUNTER_X = HEARTS_START_X + HEARTS_ROW_WIDTH + HUD_GROUP_GAP;

/** Vertical screen position for the persistent chest counter — vertically
 *  centered on the same row the hearts occupy (drawHearts draws hearts with
 *  their top edge at HUD_MARGIN; drawChestCounter treats its y as a
 *  vertical CENTER, so this is offset by half a heart's height to align). */
export const CHEST_COUNTER_Y = HUD_MARGIN + HEART_RENDERED_SIZE / 2;

/**
 * Draws the persistent "[chest icon] collected / total" HUD counter —
 * unlike drawCollectibleCounter (which crops one frame out of a shared
 * sheet), chest_closed.png is always the icon (a chest, once opened, still
 * represents "one of the objectives" the same way) and is a standalone
 * image at its own native aspect ratio, scaled to match the hearts' row
 * height rather than forced into a square icon box.
 */
// Chest art is edge-to-edge with no transparent padding (unlike hearts), so
// it reads oversized at HEART_RENDERED_SIZE — shrunk down from that, but not
// all the way to 20 (read as too small next to the other HUD icons).
export const CHEST_COUNTER_ICON_HEIGHT = 26;

// Wider gap than the shared COUNTER_TEXT_GAP (used by drawCollectibleCounter)
// between the chest icon and its "N / M" text — a dedicated constant so this
// counter's spacing can be tuned without affecting the unrelated
// drawCollectibleCounter. Exported so tests can pin the exact text x
// position instead of only asserting `any(Number)`.
export const CHEST_COUNTER_TEXT_GAP = 12;

export function drawChestCounter(
  ctx: CanvasRenderingContext2D,
  chestClosedSprite: HTMLImageElement,
  collected: number,
  total: number,
  x: number,
  y: number,
): void {
  ctx.imageSmoothingEnabled = false;
  const iconHeight = CHEST_COUNTER_ICON_HEIGHT;
  const iconWidth = (CHEST_CLOSED_WIDTH / CHEST_CLOSED_HEIGHT) * iconHeight;
  ctx.drawImage(
    chestClosedSprite,
    0,
    0,
    CHEST_CLOSED_WIDTH,
    CHEST_CLOSED_HEIGHT,
    x,
    y - iconHeight / 2,
    iconWidth,
    iconHeight,
  );

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `22px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fillTextWithOutline(ctx, `${collected} / ${total}`, x + iconWidth + CHEST_COUNTER_TEXT_GAP, y);
  ctx.restore();
}

/**
 * The chest counter's actual on-screen content width (icon + gap + the real
 * measured "N / M" text, via ctx.measureText — NOT a hand-picked estimate).
 * Used to position the key counter's X so the chest→key gap always exactly
 * matches HUD_GROUP_GAP regardless of how many digits `collected`/`total`
 * happen to have, instead of drifting whenever the guessed text width and
 * the real one disagree. `ctx.font` is set here to the same font
 * drawChestCounter itself uses, so the measurement is accurate regardless of
 * whatever the context's font was left at beforehand.
 */
export function chestCounterWidth(ctx: CanvasRenderingContext2D, collected: number, total: number): number {
  const iconWidth = (CHEST_CLOSED_WIDTH / CHEST_CLOSED_HEIGHT) * CHEST_COUNTER_ICON_HEIGHT;
  ctx.font = `22px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  const textWidth = ctx.measureText(`${collected} / ${total}`).width;
  return iconWidth + CHEST_COUNTER_TEXT_GAP + textWidth;
}

/** Horizontal screen position for the key counter — placed just to the right
 *  of the chest counter's actual measured width, same HUD row, separated by
 *  the same HUD_GROUP_GAP the hearts→chest gap uses. Callers (both
 *  PlatformerPage.tsx's render loop and its key-collection flying-text effect
 *  target) must call this with the CURRENT chest collected/total — it is a
 *  function, not a static constant, precisely because that width isn't
 *  fixed. */
export function keyCounterX(ctx: CanvasRenderingContext2D, chestCollected: number, chestTotal: number): number {
  return CHEST_COUNTER_X + chestCounterWidth(ctx, chestCollected, chestTotal) + HUD_GROUP_GAP;
}

export const KEY_COUNTER_Y = CHEST_COUNTER_Y;

/** Between CHEST_COUNTER_ICON_HEIGHT (26) and HEART_RENDERED_SIZE (32) — the
 *  current key.png is a bold, chunky shape (unlike an earlier thin 14x28
 *  version, which needed the full heart height to avoid looking shrunk), so
 *  a smaller HUD icon than the world sprite reads fine without looking
 *  undersized next to the hearts/chest icons on the same row. */
const KEY_COUNTER_ICON_HEIGHT = 24;

/** Draws the "[key icon] N" HUD counter — no "/ total" denominator (unlike
 *  drawChestCounter): a key count has no fixed total to compare against, it
 *  just goes up and down as keys are found and spent. */
export function drawKeyCounter(
  ctx: CanvasRenderingContext2D,
  keySprite: HTMLImageElement,
  count: number,
  x: number,
  y: number,
): void {
  ctx.imageSmoothingEnabled = false;
  const iconHeight = KEY_COUNTER_ICON_HEIGHT;
  const iconWidth = (KEY_FRAME_WIDTH / KEY_FRAME_HEIGHT) * iconHeight;
  ctx.drawImage(keySprite, 0, 0, KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT, x, y - iconHeight / 2, iconWidth, iconHeight);

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `22px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fillTextWithOutline(ctx, `${count}`, x + iconWidth + CHEST_COUNTER_TEXT_GAP, y);
  ctx.restore();
}

/** Between CHEST_COUNTER_ICON_HEIGHT (26) and HEART_RENDERED_SIZE (32) —
 *  matches the key counter's own icon height so the two HUD groups read at
 *  the same scale. */
const BOMB_COUNTER_ICON_HEIGHT = 24;

/** Draws the "[bomb icon] N" HUD counter — the unlit bomb (bomb.png frame 0)
 *  plus the carried count, no denominator (FR-010). Called only while the
 *  count is at least 1; at 0 the whole group is hidden. */
export function drawBombCounter(
  ctx: CanvasRenderingContext2D,
  bombSprite: HTMLImageElement,
  count: number,
  x: number,
  y: number,
): void {
  ctx.imageSmoothingEnabled = false;
  const iconHeight = BOMB_COUNTER_ICON_HEIGHT;
  const iconWidth = (BOMB_SHEET.frameWidth / BOMB_SHEET.frameHeight) * iconHeight;
  ctx.drawImage(
    bombSprite,
    0,
    0,
    BOMB_SHEET.frameWidth,
    BOMB_SHEET.frameHeight,
    x,
    y - iconHeight / 2,
    iconWidth,
    iconHeight,
  );

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `22px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fillTextWithOutline(ctx, `${count}`, x + iconWidth + CHEST_COUNTER_TEXT_GAP, y);
  ctx.restore();
}

/** The key counter's actual on-screen content width — the same measurement
 *  `chestCounterWidth` does for the chest counter, used to position the bomb
 *  counter just past it. */
function keyCounterWidth(ctx: CanvasRenderingContext2D, count: number): number {
  const iconWidth = (KEY_FRAME_WIDTH / KEY_FRAME_HEIGHT) * KEY_COUNTER_ICON_HEIGHT;
  ctx.font = `22px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  const textWidth = ctx.measureText(`${count}`).width;
  return iconWidth + CHEST_COUNTER_TEXT_GAP + textWidth;
}

/**
 * Horizontal screen position for the bomb counter — placed just to the right
 * of the key counter, separated by `HUD_GROUP_GAP`. The key counter is itself
 * hidden while `keyCount` is 0, so this adds its measured width plus the gap
 * only when keys are actually shown; otherwise the bomb group takes the key
 * counter's own position (FR-010).
 */
export function bombCounterX(
  ctx: CanvasRenderingContext2D,
  chestCollected: number,
  chestTotal: number,
  keyCount: number,
): number {
  const base = keyCounterX(ctx, chestCollected, chestTotal);
  if (keyCount <= 0) return base;
  return base + keyCounterWidth(ctx, keyCount) + HUD_GROUP_GAP;
}
