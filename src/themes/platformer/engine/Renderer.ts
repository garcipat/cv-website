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
  mushroomEntry,
  mushroomHasCap,
  MUSHROOM_CAP_SOURCE_HEIGHT,
  MUSHROOM_DECORATIVE_ENTRY,
} from './StaticObjectsCatalog';
import { mushroomSquashDipAt } from './MushroomSquash';
import type { MushroomSquashState } from './MushroomSquash';
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
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import {
  MAX_HEARTS,
  HEART_FRAME_SIZE,
  HEART_RENDERED_SIZE,
  heartRemaining,
  heartFrameIndex,
} from '../entities/Health';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import { PICKUP_TYPES } from '../entities/pickups';
import { key } from '../entities/pickups/Key';
import { heart } from '../entities/pickups/Heart';
import { bomb } from '../entities/pickups/Bomb';
import { bonusFruit } from '../entities/pickups/BonusFruit';
import { typeOf } from '../entities/enemies';
import type { EnemyState } from '../entities/Enemy';
import { typeOf as hazardTypeOf } from '../entities/hazards';
import type { HazardPlacement } from '../level/HazardMapper';
import type { DrawContext } from './DrawContext';
import type { KeyPickupState } from '../entities/KeyPickup';
import type { HeartPickupState } from '../entities/HeartPickup';
import type { BombPickupState } from '../entities/BombPickup';
import { KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT } from '../entities/KeyPickup';
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
import type { BonusFruitState } from '../entities/BonusFruit';
import {
  flightEffectPosition,
  sparkleParticles,
  healAuraOpacity,
  healAuraRays,
  healAuraSparkles,
  hitSplatterDroplets,
  fadeOutTextOpacity,
  crumbleDebrisPieces,
} from './CollectionEffects';
import type { FlightEffect, PuffEffect, HealAuraEffect, HitSplatterEffect, FadeOutTextEffect, ExplosionEffect, CrumbleDebrisEffect } from './CollectionEffects';
import { explosionFrameIndex } from './CollectionEffects';
import {
  TORCH_SHEET,
  BOMB_SHEET,
  EXPLOSION_SHEET,
  CRUMBLE_FLOOR_SHEET,
  CRUMBLE_CRACKS_SHEET,
  DOOR_SHEET,
  DOOR_FRAME_CLOSED_LEFT,
  DOOR_FRAME_CLOSED_RIGHT,
  DOOR_FRAME_OPEN_LEFT,
  DOOR_FRAME_OPEN_RIGHT,
} from '../entities/sprites/sheets';
import type { DoorState } from './DoorState';
import {
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
} from './Torch';
import type { Point, TorchLight } from './Lighting';
import {
  TORCH_LIGHT_RADIUS_PX,
  PLAYER_LIGHT_RADIUS_PX,
  TORCH_GLOW_COLOR,
  PLAYER_GLOW_COLOR,
  PLAYER_GLOW_INTENSITY,
  torchPulseScale,
  localDarknessAt,
  enemyEyeOpacity,
  enemyEyeBobOffset,
  ENEMY_EYE_COLOR,
  ENEMY_EYE_SIZE_PX,
  ENEMY_EYE_GAP_PX,
  FOG_TINT_RGB,
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
    case 'groundWood':
      // GROUND_WOOD_SHEET (Task 10) is its own dedicated image, addressed
      // from (0, 0) — never world_tileset.png's coordinate space. drawTerrain
      // threads a separate groundWoodImage parameter and picks it over
      // `tileset` when drawing this tile's source rect (see its own
      // sheet-selection logic).
      return isTopExposed(level, col, row)
        ? { sx: 0, sy: 0 }
        : { sx: TILE_SIZE, sy: 0 };
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
    case 'patrol':
      // An enemy patrol boundary is deliberately invisible in game — only
      // the Level Editor draws a marker for it (EditorCanvas.tsx's
      // drawTileMarkers), the same way it badges sign digits.
      return null;
    case 'blueprintConnectionPoint':
      // Editor-only, exactly like 'patrol' above: only the Level Editor
      // draws anything for a connection point (EditorCanvas.tsx's
      // drawTileMarkers). It can reach a real level's terrain at all only
      // by way of a blueprint stamped down in the editor (step 44c), and
      // even then it must stay invisible in game.
      return null;
    case 'doorLeft':
    case 'doorRight':
    case 'doorLeftOpen':
    case 'doorRightOpen':
      // Drawn by the dedicated drawDoors pass below — a leaf's art is
      // taller than its tile and bottom-anchored (bleeds upward into the
      // cell above, see design.md's "Rendering taller than the tile"),
      // which this shared single-cell lookup has no way to express.
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
 * Draws the cave-darkness overlay and the torch light pools that punch back
 * through it, over the whole play canvas. This is the one pass that maps torch
 * world positions to canvas coordinates (same `originX`/`originY` convention
 * as `drawTerrain`/`drawPlayer`), so light pools scroll with the camera
 * (FR-012).
 *
 * Full-brightness fast path (research D10 / SC-005): when `darknessLevel <= 0`
 * this draws nothing at all, so a level with no cave pieces renders exactly as
 * it did before this feature. Otherwise:
 *
 * 1. The reusable offscreen `layer` (owned and sized by `PlatformerPage.tsx`)
 *    is cleared and filled with `rgba(0, 0, 0, darknessLevel)`.
 * 2. For each torch whose glow can intersect the viewport, a soft
 *    `destination-out` radial gradient erases a light hole at the torch's
 *    screen position, radius `TORCH_LIGHT_RADIUS_PX * torchPulseScale`.
 * 3. The layer is composited onto `ctx` with `source-over`.
 * 4. Each torch then gets a smaller additive (`lighter`) warm gradient whose
 *    radius stays inside the erased hole and whose alpha scales with
 *    `darknessLevel`, so the pool reads warm without tinting the surrounding
 *    darkness (FR-008/FR-009/FR-010/FR-013/FR-014).
 *
 * When `playerLight` is given, the player's own smaller, steadier carried
 * light is punched and warmed the same way (FR-023/FR-024).
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
  torches: readonly TorchLight[] = [],
  originX = 0,
  originY = 0,
  worldElapsed = 0,
  playerLight: Point | null = null,
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

  // Only torches whose glow can touch the viewport do any work — this keeps
  // the pass O(visible torches) however many the level holds (SC-006).
  const visibleTorches = torches.filter((torch) => {
    const radius = TORCH_LIGHT_RADIUS_PX * torchPulseScale(torch, worldElapsed) * zoom;
    const screenX = torch.x * zoom + originX;
    const screenY = torch.y * zoom + originY;
    return (
      screenX + radius >= 0 &&
      screenX - radius <= canvasWidth &&
      screenY + radius >= 0 &&
      screenY - radius <= canvasHeight
    );
  });

  for (const torch of visibleTorches) {
    const screenX = torch.x * zoom + originX;
    const screenY = torch.y * zoom + originY;
    const radius = TORCH_LIGHT_RADIUS_PX * torchPulseScale(torch, worldElapsed) * zoom;

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

  const playerScreenX = playerLight ? playerLight.x * zoom + originX : 0;
  const playerScreenY = playerLight ? playerLight.y * zoom + originY : 0;
  const playerLightRadius = PLAYER_LIGHT_RADIUS_PX * zoom;
  if (playerLight) {
    // The player's own smaller pool, steadier than a torch's (FR-023).
    layerCtx.globalCompositeOperation = 'destination-out';
    const hole = layerCtx.createRadialGradient(
      playerScreenX,
      playerScreenY,
      0,
      playerScreenX,
      playerScreenY,
      playerLightRadius,
    );
    hole.addColorStop(0, 'rgba(0, 0, 0, 1)');
    hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
    layerCtx.fillStyle = hole;
    layerCtx.beginPath();
    layerCtx.arc(playerScreenX, playerScreenY, playerLightRadius, 0, Math.PI * 2);
    layerCtx.fill();
  }
  layerCtx.globalCompositeOperation = 'source-over';

  ctx.drawImage(layer, 0, 0, canvasWidth, canvasHeight);

  for (const torch of visibleTorches) {
    const screenX = torch.x * zoom + originX;
    const screenY = torch.y * zoom + originY;
    const radius = TORCH_LIGHT_RADIUS_PX * torchPulseScale(torch, worldElapsed) * zoom;
    // Stays comfortably inside the erased hole so the warm tone never bleeds
    // onto the darkened area.
    const glowRadius = radius * 0.7;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = darknessLevel;
    const glow = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowRadius);
    glow.addColorStop(0, TORCH_GLOW_COLOR);
    glow.addColorStop(0.55, 'rgba(255, 176, 74, 0.35)');
    glow.addColorStop(1, 'rgba(255, 176, 74, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (playerLight) {
    const glowRadius = playerLightRadius * 0.7;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = darknessLevel * PLAYER_GLOW_INTENSITY;
    const glow = ctx.createRadialGradient(
      playerScreenX,
      playerScreenY,
      0,
      playerScreenX,
      playerScreenY,
      glowRadius,
    );
    glow.addColorStop(0, PLAYER_GLOW_COLOR);
    glow.addColorStop(0.55, 'rgba(255, 145, 45, 0.3)');
    glow.addColorStop(1, 'rgba(255, 145, 45, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(playerScreenX, playerScreenY, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
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
  torches: readonly TorchLight[],
  worldElapsed: number,
  originX = 0,
  originY = 0,
  playerLight: Point | null = null,
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
    const localDarkness = localDarknessAt(anchorX, anchorY, darknessLevel, torches, worldElapsed, playerLight);
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
  groundWoodImage: HTMLImageElement | null = null,
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

      // groundWood sources from its own dedicated GROUND_WOOD_SHEET image
      // (Task 10), never world_tileset.png — every other plain tileSource
      // draw still comes from `tileset`.
      const sheet = tile === 'groundWood' ? groundWoodImage : tileset;
      if (!sheet) continue;

      ctx.drawImage(
        sheet, source.sx, source.sy, TILE_SIZE, TILE_SIZE,
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
 * Draws every door's two leaves. Each leaf's source frame (16x26,
 * `DOOR_SHEET`) is taller than RENDERED_TILE_SIZE, so it is drawn
 * BOTTOM-anchored to its own cell — the leaf's rendered bottom edge lines
 * up with the cell's bottom edge, and the excess height bleeds upward into
 * the cell above (design.md's "Rendering taller than the tile: bleed, not
 * squeeze" — the mirror of FloorSpike's downward bleed).
 * `imageSmoothingEnabled = false` matches every other pixel-art draw pass
 * in this file.
 */
export function drawDoors(
  ctx: CanvasRenderingContext2D,
  states: readonly DoorState[],
  doorSheet: HTMLImageElement | null,
  originX: number,
  originY: number,
): void {
  if (!doorSheet) return;
  ctx.imageSmoothingEnabled = false;
  for (const state of states) {
    const leftFrame = state.phase === 'open' ? DOOR_FRAME_OPEN_LEFT : DOOR_FRAME_CLOSED_LEFT;
    const rightFrame = state.phase === 'open' ? DOOR_FRAME_OPEN_RIGHT : DOOR_FRAME_CLOSED_RIGHT;
    drawBottomAnchoredLeaf(ctx, doorSheet, leftFrame, state.col, state.row, originX, originY);
    drawBottomAnchoredLeaf(ctx, doorSheet, rightFrame, state.col + 1, state.row, originX, originY);
  }
}

function drawBottomAnchoredLeaf(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  frameIndex: number,
  col: number,
  row: number,
  originX: number,
  originY: number,
): void {
  const { sx, sy } = frameSource(DOOR_SHEET, frameIndex);
  const width = DOOR_SHEET.frameWidth;
  const height = DOOR_SHEET.frameHeight;
  const destWidth = width * RENDER_SCALE;
  const destHeight = height * RENDER_SCALE;
  const cellBottomY = (row + 1) * RENDERED_TILE_SIZE;
  const destX = col * RENDERED_TILE_SIZE + originX;
  const destY = cellBottomY - destHeight + originY;
  ctx.drawImage(sheet, sx, sy, width, height, destX, destY, destWidth, destHeight);
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

/** Native px size of one debris quarter — a quadrant of the tile's own
 *  half-height content band (matches CRUMBLE_CRACKS_SHEET's 8px height),
 *  not a quadrant of the full 16x16 frame (most of which is transparent
 *  padding below the art). */
const DEBRIS_QUARTER_W = TILE_SIZE / 2;
const DEBRIS_QUARTER_H = CRUMBLE_CRACKS_SHEET.frameHeight / 2;

/** Native (sx, sy) of each of the 4 quarters, in the same fixed order
 *  `crumbleDebrisPieces` returns: top-left, top-right, bottom-left,
 *  bottom-right. */
const DEBRIS_QUARTER_SRC: readonly { sx: number; sy: number }[] = [
  { sx: 0, sy: 0 },
  { sx: DEBRIS_QUARTER_W, sy: 0 },
  { sx: 0, sy: DEBRIS_QUARTER_H },
  { sx: DEBRIS_QUARTER_W, sy: DEBRIS_QUARTER_H },
];

/**
 * Draws every falling crumbling-floor debris piece (O-023). Each of the 4
 * quarters is drawn as TWO layered blits — the matching quadrant of the
 * plain ledge art, then the same quadrant of the heavy crack frame on top —
 * exactly `Crate.ts`'s base-plus-crack-overlay technique, so a falling piece
 * reads as "a chunk of the cracked floor" without any dedicated debris art.
 */
export function drawCrumbleDebrisEffects(
  ctx: CanvasRenderingContext2D,
  effects: readonly CrumbleDebrisEffect[],
  dc: DrawContext,
): void {
  const ledge = dc.sprites[CRUMBLE_FLOOR_SHEET.src];
  const cracks = dc.sprites[CRUMBLE_CRACKS_SHEET.src];
  if (!ledge) return;

  const heavyFrame = frameSource(CRUMBLE_CRACKS_SHEET, 2);
  // Debris always breaks off the MIDDLE ledge frame's art, regardless of
  // which run-position frame the tile itself was actually showing — a
  // reasonable simplification for a decorative, short-lived effect (see
  // CollectionEffects.ts's doc comment on CrumbleDebrisEffect).
  const { sx: ledgeMidSx } = frameSource(CRUMBLE_FLOOR_SHEET, 1);
  const destWidth = DEBRIS_QUARTER_W * RENDER_SCALE;
  const destHeight = DEBRIS_QUARTER_H * RENDER_SCALE;

  for (const effect of effects) {
    const pieces = crumbleDebrisPieces(effect);
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      if (piece.opacity <= 0) continue;
      const quarter = DEBRIS_QUARTER_SRC[i];
      const dx = effect.x + dc.originX + quarter.sx * RENDER_SCALE + piece.dx;
      const dy = effect.y + dc.originY + quarter.sy * RENDER_SCALE + piece.dy;

      ctx.globalAlpha = piece.opacity;
      ctx.drawImage(
        ledge, ledgeMidSx + quarter.sx, quarter.sy, DEBRIS_QUARTER_W, DEBRIS_QUARTER_H,
        dx, dy, destWidth, destHeight,
      );
      if (cracks) {
        ctx.drawImage(
          cracks, heavyFrame.sx + quarter.sx, heavyFrame.sy + quarter.sy, DEBRIS_QUARTER_W, DEBRIS_QUARTER_H,
          dx, dy, destWidth, destHeight,
        );
      }
    }
  }
  ctx.globalAlpha = 1;
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
  woodBackgroundAtlas: HTMLImageElement | null = null,
): void {
  const grid = level.background ?? [];
  for (let row = 0; row < grid.length; row++) {
    const gridRow = grid[row];
    for (let col = 0; col < gridRow.length; col++) {
      const material = gridRow[col];
      if (material === null || material === undefined) continue;

      const sourceImage = material === 'wood' ? woodBackgroundAtlas : backgroundAtlas;
      if (!sourceImage) continue; // placeholder sheet not loaded yet — skip silently, like every other optional image in this file

      const { x, y } = tileToPixel(col, row);
      const destX = x + originX;
      const destY = y + originY;
      const mask = backgroundNeighbourMask(level, col, row);
      const entry = backgroundAtlasCell(material, mask);
      drawRotatedTile(ctx, sourceImage, entry, destX, destY);

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
      const puffAlpha = fogLevel * (1 - peek);
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

/** The held torch's size multiplier (native px → drawn px) and where it sits
 *  relative to the player's render-slot centre for a right-facing player
 *  (mirrored when facing left). Small and tucked against the character's hand;
 *  tuned by eye. */
const HELD_TORCH_SCALE = 1.25;
const HELD_TORCH_OFFSET_X = 0;
const HELD_TORCH_OFFSET_Y = 30;
/** The held torch is drawn a little translucent so its bright flame doesn't
 *  glare yellow against the dark (FR-025). */
const HELD_TORCH_ALPHA = 0.8;

/**
 * The world-space centre of the player's held torch — where the player's own
 * carried light sits, so the glow is centered on the flame rather than on the
 * character (FR-023). Mirrors with the player's facing.
 */
export function heldTorchLightPosition(player: PlayerState): Point {
  const width = TORCH_FRAME_WIDTH * HELD_TORCH_SCALE;
  const height = TORCH_FRAME_HEIGHT * HELD_TORCH_SCALE;
  const centerX = player.x + PLAYER_RENDERED_SIZE / 2;
  const torchCenterX =
    player.direction === 'left'
      ? centerX - HELD_TORCH_OFFSET_X - width / 2
      : centerX + HELD_TORCH_OFFSET_X + width / 2;
  return {
    x: torchCenterX,
    y: player.y + HELD_TORCH_OFFSET_Y + height / 2,
  };
}

/**
 * Draws the very small torch the player carries, but only while standing or
 * walking **and** only in the dark (FR-025/FR-026/FR-027). Reuses the wall
 * torches' own flame frames so the style matches (FR-028), mirrored to face
 * the player's direction. Drawn with the player, before the darkness overlay,
 * so the player's own light reveals it.
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
  const width = TORCH_FRAME_WIDTH * HELD_TORCH_SCALE;
  const height = TORCH_FRAME_HEIGHT * HELD_TORCH_SCALE;
  const centerX = player.x + originX + PLAYER_RENDERED_SIZE / 2;
  const topY = player.y + originY + HELD_TORCH_OFFSET_Y;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = HELD_TORCH_ALPHA;
  if (player.direction === 'left') {
    ctx.translate(centerX, topY);
    ctx.scale(-1, 1);
    ctx.drawImage(
      torchSheet,
      sx,
      sy,
      TORCH_FRAME_WIDTH,
      TORCH_FRAME_HEIGHT,
      HELD_TORCH_OFFSET_X,
      0,
      width,
      height,
    );
  } else {
    ctx.drawImage(
      torchSheet,
      sx,
      sy,
      TORCH_FRAME_WIDTH,
      TORCH_FRAME_HEIGHT,
      centerX + HELD_TORCH_OFFSET_X,
      topY,
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

/**
 * Family name registered with `document.fonts` by engine/FontLoader.ts's
 * `loadFont` call (see PlatformerPage.tsx's mount effect) for
 * `RESTART_PROMPT_FONT_URL`. Kept alongside the draw call that uses it so
 * the loaded family name and the drawn family name can't drift apart.
 */
export const RESTART_PROMPT_FONT_FAMILY = 'ByteBounce';

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
 * convention as drawTerrain/drawPlayer/drawCollectibles. Signs have no
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

const BUBBLE_FONT_SIZE = 16;
const BUBBLE_PADDING_X = 10;
const BUBBLE_PADDING_Y = 6;
const BUBBLE_BORDER_WIDTH = 2;
/** Extra vertical gap between wrapped lines, on top of BUBBLE_FONT_SIZE
 *  itself — only added BETWEEN lines (lines.length - 1 times), so a
 *  single-line bubble's height is untouched by this. */
const BUBBLE_LINE_SPACING = 4;
/** Corner radius for the bubble's rounded rect (both the border and the
 *  inset fill), drawn via `ctx.roundRect` — a smooth curve, not a pixel-art
 *  chamfer (a chamfer's cut-corner notches read as just cutting away the
 *  corners, not as a rounded shape). A curved corner is always
 *  anti-aliased regardless of `imageSmoothingEnabled` (that flag only
 *  affects `drawImage` scaling), so it reads slightly softer than this
 *  game's pixel-art tileset — an accepted, deliberate tradeoff here. */
const BUBBLE_CORNER_RADIUS = 6;
/** Nudges the text down from dead-center by a couple px — a purely visual
 *  correction: centered text reads as sitting slightly high against the
 *  box, likely due to font metrics' cap-height vs. middle-baseline not
 *  perfectly bisecting the box. */
const BUBBLE_TEXT_VERTICAL_NUDGE = 2;
/** Vertical gap between the bubble tail's tip and its anchor point
 *  (anchorBottomY), so it floats just above the character's head rather
 *  than overlapping it. Kept small — this is the gap ABOVE the anchor, which
 *  itself is already the head's own position (see PlatformerPage.tsx's
 *  anchorBottomY), not extra breathing room on top of that. */
const BUBBLE_GAP_ABOVE_ANCHOR = 16;
const BUBBLE_TAIL_HALF_WIDTH = 6;
const BUBBLE_TAIL_HEIGHT = 8;
const BUBBLE_BG_COLOR = '#f4ecd8';
const BUBBLE_BORDER_COLOR = '#241a0e';
const BUBBLE_TEXT_COLOR = '#241a0e';

/**
 * Draws a comic-style speech bubble with `text` — a cream box, a dark
 * border, and a small tail pointing down at (`anchorX`, `anchorBottomY`),
 * already origin-shifted screen-space coordinates (same convention as
 * drawPlayer's own position). Uses a bigger dark rect/triangle behind a
 * smaller inset cream one for both the box and the tail, instead of
 * `ctx.strokeRect`/`ctx.stroke` — reads as a BUBBLE_BORDER_WIDTH-thick
 * outline with only fill-based primitives.
 *
 * `growth` (default 1) scales the box's and tail's HEIGHT from 0 to their
 * full size — reading as the bubble rising out of the sign like it's
 * starting to talk — while keeping the box's BOTTOM edge
 * fixed (where the tail meets it) — the caller passes
 * `hintTooltipGrowthAndOpacity`'s `growth` straight through. `growth <= 0`
 * draws nothing at all. `opacity` (default 1) is applied via
 * `ctx.globalAlpha`, the same mechanism `Crate.ts`'s crate-shatter fade
 * already uses.
 */
/** Clamps a corner radius so `roundRect` never receives a radius bigger than
 *  half the shape's own width/height — exceeding that throws a RangeError in
 *  real browsers. The bubble's box/tail height shrinks toward 0 during the
 *  grow/shrink animation, so this matters at low `growth`, not just as a
 *  theoretical edge case. */
function clampedCornerRadius(width: number, height: number, radius: number): number {
  return Math.max(0, Math.min(radius, width / 2, height / 2));
}

export function drawSignBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchorX: number,
  anchorBottomY: number,
  growth = 1,
  opacity = 1,
): void {
  if (growth <= 0) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.font = `${BUBBLE_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Lines are `\n`-separated (a hint can be authored as a multi-line i18n
  // string) — box width fits the WIDEST line, box height grows with every
  // extra line. A single-line text (the common case) reduces to exactly the
  // old single-line formula: `lines.length - 1` is 0, so no extra spacing.
  const lines = text.split('\n');
  const boxWidth = Math.max(...lines.map((line) => ctx.measureText(line).width)) + BUBBLE_PADDING_X * 2;
  const fullBoxHeight =
    lines.length * BUBBLE_FONT_SIZE + BUBBLE_PADDING_Y * 2 + (lines.length - 1) * BUBBLE_LINE_SPACING;
  const boxHeight = fullBoxHeight * growth;
  const tailHeight = BUBBLE_TAIL_HEIGHT * growth;
  // Tail WIDTH is not scaled by growth — per the plan's explicit constraint,
  // the bubble reveals at its full width immediately and only its height
  // (box height + tail height) animates. Using the constant here (rather
  // than `BUBBLE_TAIL_HALF_WIDTH * growth`) keeps the tail from narrowing
  // to a sliver mid-grow.
  const tailHalfWidth = BUBBLE_TAIL_HALF_WIDTH;

  // Anchored at the box's fixed BOTTOM edge (independent of growth) — the
  // box grows UPWARD from there, and the tail grows DOWNWARD from there
  // toward anchorBottomY, so the whole bubble reads as rising out of that
  // fixed point rather than scaling in place. (Computing boxBottom from a
  // growth-scaled tailHeight instead would make the box's own bottom edge
  // drift as growth changes — the opposite of what "fixed bottom edge"
  // means; boxBottom must depend only on the CONSTANT BUBBLE_TAIL_HEIGHT.)
  const boxBottom = anchorBottomY - BUBBLE_GAP_ABOVE_ANCHOR - BUBBLE_TAIL_HEIGHT;
  const boxTop = boxBottom - boxHeight;
  const tailTipY = boxBottom + tailHeight;
  const boxLeft = anchorX - boxWidth / 2;

  const outerWidth = boxWidth + BUBBLE_BORDER_WIDTH * 2;
  const outerHeight = boxHeight + BUBBLE_BORDER_WIDTH * 2;

  ctx.fillStyle = BUBBLE_BORDER_COLOR;
  ctx.beginPath();
  ctx.roundRect(
    boxLeft - BUBBLE_BORDER_WIDTH,
    boxTop - BUBBLE_BORDER_WIDTH,
    outerWidth,
    outerHeight,
    clampedCornerRadius(outerWidth, outerHeight, BUBBLE_CORNER_RADIUS + BUBBLE_BORDER_WIDTH),
  );
  ctx.fill();
  ctx.fillStyle = BUBBLE_BG_COLOR;
  ctx.beginPath();
  ctx.roundRect(boxLeft, boxTop, boxWidth, boxHeight, clampedCornerRadius(boxWidth, boxHeight, BUBBLE_CORNER_RADIUS));
  ctx.fill();

  ctx.fillStyle = BUBBLE_BORDER_COLOR;
  ctx.beginPath();
  ctx.moveTo(anchorX - tailHalfWidth - BUBBLE_BORDER_WIDTH, boxBottom);
  ctx.lineTo(anchorX, tailTipY + BUBBLE_BORDER_WIDTH);
  ctx.lineTo(anchorX + tailHalfWidth + BUBBLE_BORDER_WIDTH, boxBottom);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = BUBBLE_BG_COLOR;
  ctx.beginPath();
  ctx.moveTo(anchorX - tailHalfWidth, boxBottom);
  ctx.lineTo(anchorX, tailTipY);
  ctx.lineTo(anchorX + tailHalfWidth, boxBottom);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = BUBBLE_TEXT_COLOR;
  // Lines are stacked evenly around the box's vertical center, scaling their
  // spacing by `growth` too (so they compress toward the center as the box
  // shrinks, rather than overflowing it) — reduces to a single fillText at
  // dead-center-plus-nudge when there's only one line.
  const lineStep = (BUBBLE_FONT_SIZE + BUBBLE_LINE_SPACING) * growth;
  const centerY = boxTop + boxHeight / 2 + BUBBLE_TEXT_VERTICAL_NUDGE * growth;
  const firstLineY = centerY - ((lines.length - 1) * lineStep) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, anchorX, firstLineY + i * lineStep);
  });
  ctx.restore();
}

/**
 * Draws every not-yet-collected placement — each spriteType renders itself
 * (see entities/pickups/), keyed by the item's stable position among all
 * placements of its own spriteType (matters for fruit's fixed-per-index
 * icon — see Fruit.ts — and is tracked here, unconditionally per item seen,
 * so a fruit's icon stays stable regardless of which fruits have since been
 * collected). A missing sprite for one pickup type is handled inside that
 * type's own `draw` (it simply skips), so a missing fruit sprite never hides
 * coins and vice versa.
 */
export function drawCollectibles(
  ctx: CanvasRenderingContext2D,
  placements: readonly CollectiblePlacement[],
  collectedIds: ReadonlySet<string>,
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;

  const typeCounts: Partial<Record<CollectiblePlacement['spriteType'], number>> = {};
  for (const placement of placements) {
    const index = typeCounts[placement.spriteType] ?? 0;
    typeCounts[placement.spriteType] = index + 1;
    if (collectedIds.has(placement.id)) continue;
    PICKUP_TYPES[placement.spriteType].draw(placement, dc, index);
  }
}

/**
 * Draws every not-yet-collected key pickup — each one renders itself (see
 * entities/pickups/Key.ts); this only owns the collected filter, matching
 * drawCollectibles's/drawEnemies's own not-yet-collected/alive filtering.
 */
export function drawKeyPickups(
  ctx: CanvasRenderingContext2D,
  pickups: readonly KeyPickupState[],
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    key.draw(pickup, dc);
  }
}

/** Draws every potion-pot's dropped heart — each one renders itself (see
 *  entities/pickups/Heart.ts). Unlike drawKeyPickups, there's no `collected`
 *  filter: a touched heart is removed from its live array entirely the same
 *  tick (see PlatformerState.ts's heartPickupStates doc comment), same
 *  convention as drawBonusFruits below. */
export function drawHeartPickups(
  ctx: CanvasRenderingContext2D,
  pickups: readonly HeartPickupState[],
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const pickup of pickups) {
    heart.draw(pickup, dc);
  }
}

/** Draws every dropped bomb pickup — each one renders itself (see
 *  entities/pickups/Bomb.ts). Same no-`collected`-flag convention as
 *  drawHeartPickups: a touched bomb is removed from its live array entirely
 *  the same tick (unless the inventory is at its cap — then it is left in the
 *  world and simply keeps drawing). */
export function drawBombPickups(
  ctx: CanvasRenderingContext2D,
  pickups: readonly BombPickupState[],
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const pickup of pickups) {
    bomb.draw(pickup, dc);
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
  dc: DrawContext,
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

/**
 * Extra draw multiplier for the explosion. The native 48px frame at
 * `RENDER_SCALE` (2) is 96px; at 1.5× it draws at 144px (3× native), close to
 * the 5×5 blast footprint (`BLAST_RADIUS = 2` → 5 × 32px = 160px) while
 * keeping an integer native scale so the pixels stay even.
 */
export const EXPLOSION_DRAW_SCALE = 1.5;

/**
 * Draws every active explosion — the active sheet's frame at `renderScale 2`
 * scaled by `EXPLOSION_DRAW_SCALE`, centred on the effect's world point.
 * Purely cosmetic (FR-023).
 */
export function drawExplosions(
  ctx: CanvasRenderingContext2D,
  explosions: readonly ExplosionEffect[],
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  const image = dc.sprites[EXPLOSION_SHEET.src];
  if (!image) return;

  const size = EXPLOSION_SHEET.frameWidth * RENDER_SCALE * EXPLOSION_DRAW_SCALE;
  for (const effect of explosions) {
    const { sx, sy } = frameSource(EXPLOSION_SHEET, explosionFrameIndex(effect));
    ctx.drawImage(
      image,
      sx,
      sy,
      EXPLOSION_SHEET.frameWidth,
      EXPLOSION_SHEET.frameHeight,
      effect.x + dc.originX - size / 2,
      effect.y + dc.originY - size / 2,
      size,
      size,
    );
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
    const wave = (Math.sin(t * Math.PI * 2) + 1) / 2;
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

/** Font size of a fading world-anchored label — a touch smaller than the
 *  collection-effect text so it reads as localized rather than a reward. */
const FADE_OUT_TEXT_FONT_SIZE = 16;

/**
 * Draws every currently-fading world-anchored label in place (FR-022). Each
 * effect carries its own already-localized `text`, so this pass takes no
 * string argument — the checkpoint activation label is simply its first user.
 * World-space x/y are shifted by the camera origin; the fade opacity comes
 * from `fadeOutTextOpacity`, and an expired effect draws nothing.
 */
export function drawFadeOutTexts(
  ctx: CanvasRenderingContext2D,
  effects: readonly FadeOutTextEffect[],
  dc: DrawContext,
): void {
  for (const effect of effects) {
    const opacity = fadeOutTextOpacity(effect.elapsed);
    if (opacity <= 0) continue;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#fff';
    ctx.font = `${FADE_OUT_TEXT_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fillTextWithOutline(ctx, effect.text, effect.x + dc.originX, effect.y + dc.originY);
    ctx.restore();
  }
}

/** Draws every question-mark block's spawned bonus fruit — each one renders
 *  itself (see entities/pickups/BonusFruit.ts). */
export function drawBonusFruits(
  ctx: CanvasRenderingContext2D,
  fruits: readonly BonusFruitState[],
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const fruit of fruits) {
    bonusFruit.draw(fruit, dc);
  }
}

const COLLECTION_EFFECT_FONT_SIZE = 28;
const COLLECTION_EFFECT_ICON_FONT_SIZE = 20;
const COLLECTION_EFFECT_ICON_GAP = 6;
const SPARKLE_RADIUS_PX = 3;
/** Screen-px side of one pixel-art burst square (2 native px) and its warm
 *  gold colour — the pixel burst reads as a few crisp pixels rather than the
 *  soft white dots the enemy/block puffs use. */
const SPARKLE_PIXEL_SIZE = 4;
const SPARKLE_PIXEL_COLOR = '#ffe9a8';

/** Draws one sparkle burst — a ring of small fading particles radiating
 *  outward from (x, y) — called only by drawPuffEffects (a standalone
 *  world-event puff, whose scale varies with the entity that caused it). A
 *  flight effect (drawCollectionEffects) shows only its flying text and never
 *  a sparkle — sparkle is exclusively PuffEffect's concern, decoupled from
 *  CV-fact collection. This stays the one place that draws a sparkle ring, so
 *  the visual can't drift if a future call site needs one too. `pixel` swaps
 *  the soft anti-aliased dots for small integer-aligned pixel squares; the
 *  checkpoint's activation burst uses it so it matches the game's pixel art. */
function drawSparkleBurst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  elapsedSinceCollect: number,
  scale = 1,
  pixel = false,
): void {
  const particles = sparkleParticles(elapsedSinceCollect, scale);
  if (pixel) {
    const half = SPARKLE_PIXEL_SIZE / 2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = SPARKLE_PIXEL_COLOR;
    for (const sparkle of particles) {
      ctx.globalAlpha = sparkle.opacity;
      ctx.fillRect(
        Math.round(x + sparkle.dx - half),
        Math.round(y + sparkle.dy - half),
        SPARKLE_PIXEL_SIZE,
        SPARKLE_PIXEL_SIZE,
      );
    }
    ctx.restore();
    return;
  }
  for (const sparkle of particles) {
    ctx.save();
    ctx.globalAlpha = sparkle.opacity;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + sparkle.dx, y + sparkle.dy, SPARKLE_RADIUS_PX * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawCollectionEffects(ctx: CanvasRenderingContext2D, effects: FlightEffect[]): void {
  for (const effect of effects) {
    const { x, y, opacity } = flightEffectPosition(effect);
    if (opacity > 0) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = '#fff';
      ctx.font = `${COLLECTION_EFFECT_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fillTextWithOutline(ctx, effect.text, x, y);

      // Drawn as a SEPARATE fillText, in a plain system font (not the pixel
      // font above) — a custom @font-face has no emoji glyphs, and canvas
      // text doesn't fall back to a system emoji font mid-string the way
      // DOM text does, so an emoji baked into `effect.text` silently didn't
      // render. Positioned just left of the text using the text's measured
      // half-width, rather than baked into one centered string.
      if (effect.icon) {
        const textHalfWidth = ctx.measureText(effect.text).width / 2;
        ctx.font = `${COLLECTION_EFFECT_ICON_FONT_SIZE}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(effect.icon, x - textHalfWidth - COLLECTION_EFFECT_ICON_GAP, y);
      }
      ctx.restore();
    }
  }
}

/** Draws every currently-animating world-event puff (see B-003 /
 *  CollectionEffects.ts's PuffEffect doc comment) — screen-space, same
 *  no-camera-offset convention as drawCollectionEffects. */
export function drawPuffEffects(ctx: CanvasRenderingContext2D, effects: PuffEffect[]): void {
  for (const effect of effects) {
    drawSparkleBurst(ctx, effect.x, effect.y, effect.elapsed, effect.scale, effect.pixel);
  }
}

/**
 * Draws every active heal aura — a soft golden glow, a handful of rising
 * light rays, and a few sparkle motes, all anchored at (anchorX, anchorY)
 * and sized relative to `width` (the player's own rendered width, so the
 * effect hugs the player rather than spreading across the screen — see
 * CollectionEffects.ts's HealAuraEffect doc comment). The caller re-derives
 * the anchor from the live player position every frame, unlike
 * drawPuffEffects's fixed per-effect x/y. Every part shares the same fade
 * curve (healAuraOpacity), so an expired effect (opacity 0) draws nothing.
 */
export function drawHealAuraEffects(
  ctx: CanvasRenderingContext2D,
  effects: readonly HealAuraEffect[],
  anchorX: number,
  anchorY: number,
  width: number,
): void {
  for (const effect of effects) {
    const opacity = healAuraOpacity(effect.elapsed);
    if (opacity <= 0) continue;

    const glowRadius = width * 0.9;
    ctx.save();
    ctx.globalAlpha = opacity;
    const glow = ctx.createRadialGradient(anchorX, anchorY, 0, anchorX, anchorY, glowRadius);
    glow.addColorStop(0, 'rgba(255,224,120,0.9)');
    glow.addColorStop(0.5, 'rgba(255,200,60,0.4)');
    glow.addColorStop(1, 'rgba(255,200,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (const ray of healAuraRays(effect.elapsed, width)) {
      ctx.save();
      ctx.globalAlpha = opacity;
      const rayGradient = ctx.createLinearGradient(
        anchorX + ray.dx,
        anchorY,
        anchorX + ray.dx,
        anchorY - ray.height,
      );
      rayGradient.addColorStop(0, 'rgba(255,230,140,0.95)');
      rayGradient.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = rayGradient;
      ctx.fillRect(anchorX + ray.dx - 1, anchorY - ray.height, 2, ray.height);
      ctx.restore();
    }

    for (const sparkle of healAuraSparkles(effect.elapsed, width)) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = '#fff8d6';
      ctx.beginPath();
      ctx.arc(anchorX + sparkle.dx, anchorY + sparkle.dy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

const HIT_SPLATTER_DROPLET_SIZE_PX = 4;

/** Draws every active hit splatter — one small filled square per droplet,
 *  colored per-effect (red for the player, goo-green/purple for an enemy —
 *  see CollectionEffects.ts's startPlayerHitSplatter/startEnemyHitSplatter).
 *  Screen-space, fixed per-effect x/y, same convention as drawPuffEffects. */
export function drawHitSplatterEffects(
  ctx: CanvasRenderingContext2D,
  effects: readonly HitSplatterEffect[],
): void {
  for (const effect of effects) {
    for (const droplet of hitSplatterDroplets(effect)) {
      if (droplet.opacity <= 0) continue;
      ctx.save();
      ctx.globalAlpha = droplet.opacity;
      ctx.fillStyle = effect.color;
      ctx.fillRect(
        effect.x + droplet.dx - HIT_SPLATTER_DROPLET_SIZE_PX / 2,
        effect.y + droplet.dy - HIT_SPLATTER_DROPLET_SIZE_PX / 2,
        HIT_SPLATTER_DROPLET_SIZE_PX,
        HIT_SPLATTER_DROPLET_SIZE_PX,
      );
      ctx.restore();
    }
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
  const pulse = (Math.sin((elapsedSeconds / LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS) * Math.PI * 2) + 1) / 2;
  return LOW_HEALTH_GLOW_BASE_ALPHA + pulse * LOW_HEALTH_GLOW_PULSE_ALPHA;
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

/** Outline color used behind every "collected" HUD counter's text below —
 *  matches ControlsOverlay.tsx's DOM `textShadow` treatment (four 1px
 *  diagonal offsets in the same semi-transparent black), reproduced here via
 *  four offset fillText calls since canvas has no CSS text-shadow equivalent.
 *  Without it, the counters' plain white text is easy to lose against
 *  lighter terrain/sky backgrounds. */
const COUNTER_TEXT_OUTLINE_COLOR = 'rgba(0,0,0,0.8)';

/** Draws `text` with a 1px outline in every diagonal direction before the
 *  final fill, so the caller's already-set fillStyle/font/textAlign/
 *  textBaseline are used for both the outline and the fill — callers must
 *  set those on `ctx` before calling this, exactly as they would before a
 *  plain `ctx.fillText`. */
function fillTextWithOutline(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  const fillStyle = ctx.fillStyle;
  ctx.fillStyle = COUNTER_TEXT_OUTLINE_COLOR;
  ctx.fillText(text, x - 1, y - 1);
  ctx.fillText(text, x + 1, y - 1);
  ctx.fillText(text, x - 1, y + 1);
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = fillStyle;
  ctx.fillText(text, x, y);
}

const COUNTER_POPUP_ICON_SIZE = 28;
const COUNTER_POPUP_FONT_SIZE = 24;
const COUNTER_POPUP_TEXT_GAP = 6;
// Horizontal gap between two side-by-side popups (e.g. a coin popup and a
// fruit popup both showing at once) — wider than COUNTER_POPUP_TEXT_GAP
// (which separates an icon from ITS OWN text) so the two units read as
// clearly separate, not one run-on row.
const COUNTER_POPUP_ITEM_GAP = 20;

export interface CounterPopupDrawItem {
  icon: HTMLImageElement;
  iconFrame: { sx: number; sy: number; size: number };
  collected: number;
  total: number;
  opacity: number;
  // Nudges only the icon (never the text) vertically from its default
  // centered position — same purpose, and same default, as
  // drawCollectibleCounter's iconYOffset above: Enemy.ts's slime frames are
  // bottom-anchored (no transparent padding below the feet), which reads as
  // sitting too low next to this popup's text otherwise.
  iconYOffset?: number;
}

/**
 * Draws every currently-visible "(icon) collected / total" counter popup
 * (see CollectionEffects.ts's CounterPopupEffect) side by side, the whole
 * row horizontally centered at a caller-chosen fixed screen position, above
 * the fact-flight text's stacked slots — see PlatformerPage.tsx for where
 * that position comes from and why there can be more than one: each
 * collectible type gets its own independent slot, so collecting a coin and
 * a fruit close together shows both at once. Measures
 * every item's text width up front to center the WHOLE row as a group,
 * rather than centering each item independently (which would just stack
 * them concentrically instead of laying them out left to right). */
export function drawCounterPopups(
  ctx: CanvasRenderingContext2D,
  items: CounterPopupDrawItem[],
  centerX: number,
  y: number,
): void {
  const visible = items.filter((item) => item.opacity > 0);
  if (visible.length === 0) return;

  ctx.font = `${COUNTER_POPUP_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  const itemWidths = visible.map(
    (item) => COUNTER_POPUP_ICON_SIZE + COUNTER_POPUP_TEXT_GAP + ctx.measureText(`${item.collected} / ${item.total}`).width,
  );
  const totalWidth =
    itemWidths.reduce((sum, w) => sum + w, 0) + COUNTER_POPUP_ITEM_GAP * (visible.length - 1);

  let cursorX = centerX - totalWidth / 2;
  visible.forEach((item, i) => {
    const { icon, iconFrame, collected, total, opacity, iconYOffset = 0 } = item;
    const text = `${collected} / ${total}`;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      icon,
      iconFrame.sx,
      iconFrame.sy,
      iconFrame.size,
      iconFrame.size,
      cursorX,
      y - COUNTER_POPUP_ICON_SIZE / 2 + iconYOffset,
      COUNTER_POPUP_ICON_SIZE,
      COUNTER_POPUP_ICON_SIZE,
    );

    ctx.fillStyle = '#fff';
    ctx.font = `${COUNTER_POPUP_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fillTextWithOutline(ctx, text, cursorX + COUNTER_POPUP_ICON_SIZE + COUNTER_POPUP_TEXT_GAP, y);
    ctx.restore();

    cursorX += itemWidths[i] + COUNTER_POPUP_ITEM_GAP;
  });
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
 *  PlatformerPage.tsx's render loop and its key-collection flight-effect
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
