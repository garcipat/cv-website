import {
  tileAt,
  isTopExposed,
  bridgeRunPosition,
  horizontalRunPosition,
  neighbourMask,
  NEIGHBOUR_UP,
  tileToPixel,
  TILE_SIZE,
  RENDER_SCALE,
  RENDERED_TILE_SIZE,
} from '../level/Terrain';
import { groundAtlasCell, grassCell, GRASS_SOURCE_HEIGHT } from './GroundAtlas';
import type { GroundAtlasEntry } from './GroundAtlas';
import type { LevelDef, TileType } from '../level/LevelData';
import type { SignPlacement } from '../level/SignMapper';
import {
  PLAYER_FRAME_SIZE,
  PLAYER_RENDERED_SIZE,
  JUMP_FRAME_SIZE,
  playerFrameSource,
  jumpFrameSource,
  climbFrameSource,
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
import { bonusFruit } from '../entities/pickups/BonusFruit';
import { typeOf } from '../entities/enemies';
import type { EnemyState } from '../entities/Enemy';
import type { DrawContext } from './DrawContext';
import type { KeyPickupState } from '../entities/KeyPickup';
import { KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT } from '../entities/KeyPickup';
import type { BlockState } from '../entities/Block';
import { BLOCK_TYPES } from '../entities/blocks';
import { CHEST_TYPE } from '../entities/chests';
import { CHEST_CLOSED_WIDTH, CHEST_CLOSED_HEIGHT } from '../entities/Chest';
import type { ChestState } from '../entities/Chest';
import type { BonusFruitState } from '../entities/BonusFruit';
import { flightEffectPosition, sparkleParticles } from './CollectionEffects';
import type { FlightEffect, PuffEffect } from './CollectionEffects';

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
    case 'empty':
      return null;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/** Sky tiles live in `world_tileset.png` column 0: row 9 is solid white, row
 *  10 has white cloud silhouettes cut into blue. The fill below the clouds
 *  uses `skyColor` (the theme's own `--background` CSS value) rather than
 *  that sheet's row-11 solid-blue tile — the tileset's blue reads more
 *  saturated/darker than the theme's original flat sky color, which is what
 *  this is meant to preserve. */
const SKY_TILE_SX = 0;
const SKY_WHITE_SY = 9 * TILE_SIZE;
const SKY_CLOUD_SY = 10 * TILE_SIZE;

/** How many solid-white rows sit above the cloud band — tunable without
 *  touching the draw loop itself. Exported so tests can address rows by
 *  position instead of a hardcoded count. */
export const SKY_WHITE_ROW_COUNT = 2;

/** The cloud tile is drawn larger than the other sky tiles (which are all
 *  exactly RENDERED_TILE_SIZE) — the tileset's cloud silhouette reads as too
 *  fine/busy at native size once recolored to blend with the flat sky below
 *  it; scaling it up reads as fewer, chunkier, more legible clouds. Its own
 *  tiling stride (see the `cloudCols` loop below) is independent of the
 *  white rows' stride, since it's a different tile size. */
const CLOUD_TILE_SCALE = 1.5;

/** A channel value at or above this (out of 255) counts as "near white" when
 *  recoloring the cloud tile below — the tileset's cloud silhouette is a
 *  flat white, so this is a generous cutoff, not a fine-tuned threshold. */
const CLOUD_TILE_WHITE_THRESHOLD = 200;

/** Cache of the cloud tile with its own blue background cut to fully
 *  transparent, keyed by `skyColor` — recomputed only when `skyColor`
 *  changes (a theme switch), not on every frame. A 16x16 getImageData/
 *  putImageData pass is unnecessary work to repeat 60 times a second when
 *  the tileset and the theme's sky color are both static between frames. */
let recoloredCloudTileCache: { skyColor: string; tile: HTMLCanvasElement } | null = null;

/**
 * Returns a `TILE_SIZE`-square canvas holding the cloud tile with every
 * pixel that isn't near-white (the tileset's own blue background — see this
 * file's `SKY_CLOUD_SY` comment) cut to fully transparent. Drawing this over
 * a `skyColor`-filled rect lets the cloud silhouette blend into the theme's
 * own sky color instead of showing the tileset's more saturated blue as a
 * visible seam against the flat sky fill below it.
 */
function recoloredCloudTile(tileset: HTMLImageElement, skyColor: string): HTMLCanvasElement {
  if (recoloredCloudTileCache && recoloredCloudTileCache.skyColor === skyColor) {
    return recoloredCloudTileCache.tile;
  }
  const tile = document.createElement('canvas');
  tile.width = TILE_SIZE;
  tile.height = TILE_SIZE;
  const tileCtx = tile.getContext('2d')!;
  tileCtx.drawImage(tileset, SKY_TILE_SX, SKY_CLOUD_SY, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  const imageData = tileCtx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    if (
      data[i] < CLOUD_TILE_WHITE_THRESHOLD ||
      data[i + 1] < CLOUD_TILE_WHITE_THRESHOLD ||
      data[i + 2] < CLOUD_TILE_WHITE_THRESHOLD
    ) {
      data[i + 3] = 0;
    }
  }
  tileCtx.putImageData(imageData, 0, 0);
  recoloredCloudTileCache = { skyColor, tile };
  return tile;
}

/**
 * Draws the background sky — fixed to the viewport, not the camera or the
 * level (same "no originX/originY" convention as `drawHearts`'s HUD) — so it
 * always covers the same screen area regardless of how far the camera has
 * scrolled. `SKY_WHITE_ROW_COUNT` rows of solid white, one row of the
 * recolored cloud tile (see `recoloredCloudTile`) over a `skyColor` backing
 * fill, then `skyColor` filling the rest of the canvas height.
 */
export function drawSkyBackground(
  ctx: CanvasRenderingContext2D,
  tileset: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  skyColor: string,
): void {
  ctx.imageSmoothingEnabled = false;

  const cols = Math.ceil(canvasWidth / RENDERED_TILE_SIZE);
  const cloudRowY = SKY_WHITE_ROW_COUNT * RENDERED_TILE_SIZE;
  const cloudTileSize = RENDERED_TILE_SIZE * CLOUD_TILE_SCALE;
  // Must clear the full height of the (larger) cloud tile, not just one
  // RENDERED_TILE_SIZE row — otherwise the flat sky fill below would paint
  // over the bottom of the enlarged cloud tile, cutting it off.
  const blueStartY = cloudRowY + cloudTileSize;
  const cloudTile = recoloredCloudTile(tileset, skyColor);

  for (let col = 0; col < cols; col++) {
    const x = col * RENDERED_TILE_SIZE;
    for (let row = 0; row < SKY_WHITE_ROW_COUNT; row++) {
      const y = row * RENDERED_TILE_SIZE;
      ctx.drawImage(tileset, SKY_TILE_SX, SKY_WHITE_SY, TILE_SIZE, TILE_SIZE, x, y, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
    }
  }

  // Filled BEHIND the cloud row first — the recolored tile's cut-out pixels
  // are fully transparent, so without this the cloud row would show
  // whatever was drawn underneath (or nothing) instead of the flat sky.
  ctx.fillStyle = skyColor;
  ctx.fillRect(0, cloudRowY, canvasWidth, cloudTileSize);

  // A separate loop/stride from the white rows above: the cloud tile's own
  // size (cloudTileSize) differs from RENDERED_TILE_SIZE, so it tiles at a
  // different column width.
  const cloudCols = Math.ceil(canvasWidth / cloudTileSize);
  for (let col = 0; col < cloudCols; col++) {
    const x = col * cloudTileSize;
    ctx.drawImage(cloudTile, 0, 0, TILE_SIZE, TILE_SIZE, x, cloudRowY, cloudTileSize, cloudTileSize);
  }

  if (blueStartY < canvasHeight) {
    ctx.fillStyle = skyColor;
    ctx.fillRect(0, blueStartY, canvasWidth, canvasHeight - blueStartY);
  }
}

/** Water tiles live in `world_tileset.png` column 4: row 9 is the wave-crest
 *  (foam edge over blue), row 10 is the plain solid-blue body beneath it. */
const WATER_TILE_SX = 4 * TILE_SIZE;
const WATER_CREST_SY = 9 * TILE_SIZE;
const WATER_BODY_SY = 10 * TILE_SIZE;

/**
 * Draws the foreground water band anchored to the LEVEL's bottom row (not
 * the viewport) — same `originX`/`originY` camera-scroll convention as
 * `drawTerrain`, so it scrolls with the level rather than the screen.
 * Overlaps the BOTTOM HALF of the level's own last terrain row (rather than
 * sitting below it) because the camera formula in PlatformerPage.tsx already
 * bottom-anchors that row flush against the canvas edge — a band drawn
 * strictly beneath it would always land at/past the canvas edge and never
 * actually be visible. Half a tile keeps the top of that row (and its grass
 * edge) readable while still reading as "waves lapping in front of the
 * ground" rather than fully submerging it. The crest tile tiles across the
 * full level width at that half-tile line; the plain body tile fills every
 * row beneath it down to the bottom of the canvas. Draws nothing once the
 * band has scrolled entirely below the visible viewport.
 */
export function drawWaterForeground(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  tileset: HTMLImageElement,
  canvasHeight: number,
  originX = 0,
  originY = 0,
): void {
  const topY = (level.height - 1) * RENDERED_TILE_SIZE + RENDERED_TILE_SIZE / 2 + originY;
  if (topY >= canvasHeight) return;

  ctx.imageSmoothingEnabled = false;

  for (let col = 0; col < level.width; col++) {
    const x = col * RENDERED_TILE_SIZE + originX;
    ctx.drawImage(tileset, WATER_TILE_SX, WATER_CREST_SY, TILE_SIZE, TILE_SIZE, x, topY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
    for (let y = topY + RENDERED_TILE_SIZE; y < canvasHeight; y += RENDERED_TILE_SIZE) {
      ctx.drawImage(tileset, WATER_TILE_SX, WATER_BODY_SY, TILE_SIZE, TILE_SIZE, x, y, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
    }
  }
}

/**
 * Draws one atlas cell into a terrain cell, applying the entry's rotation
 * about the cell's own centre. Only the flat dark tiles are ever rotated
 * (see GroundAtlas.ts) — a vertical brightness ramp turned sideways reads as
 * broken.
 */
function drawGroundTile(
  ctx: CanvasRenderingContext2D,
  groundAtlas: HTMLImageElement,
  entry: GroundAtlasEntry,
  destX: number,
  destY: number,
): void {
  if (entry.rotation === 0) {
    ctx.drawImage(
      groundAtlas, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
      destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
    );
    return;
  }

  const half = RENDERED_TILE_SIZE / 2;
  ctx.save();
  ctx.translate(destX + half, destY + half);
  ctx.rotate((entry.rotation * Math.PI) / 2);
  ctx.drawImage(
    groundAtlas, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
    -half, -half, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
  );
  ctx.restore();
}

/**
 * Grass continues into a horizontal neighbour only when that neighbour is
 * itself a grass-topped surface cell. A `groundRock` neighbour, or a
 * `groundGrass` one that is buried because the terrain steps up, caps the
 * run instead — which is why this is not the same predicate the ground
 * mask uses (that one is about facing air, not matching material).
 */
function isGrassSurface(level: LevelDef, col: number, row: number): boolean {
  return tileAt(level, col, row) === 'groundGrass' && isTopExposed(level, col, row);
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
        drawGroundTile(ctx, groundAtlas, groundAtlasCell(mask), destX, destY);

        if ((mask & NEIGHBOUR_UP) === 0) {
          const grass = grassCell(horizontalRunPosition(level, col, row, isGrassSurface));
          ctx.drawImage(
            groundAtlas, grass.sx, grass.sy, TILE_SIZE, GRASS_SOURCE_HEIGHT,
            destX, destY, RENDERED_TILE_SIZE, GRASS_SOURCE_HEIGHT * RENDER_SCALE,
          );
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
): void {
  if (!visible) return;
  ctx.imageSmoothingEnabled = false;

  const useHighResSheet =
    (player.animState === 'jump' || player.animState === 'climb') && jumpSpriteSheet !== null;
  const frameSize = useHighResSheet ? JUMP_FRAME_SIZE : PLAYER_FRAME_SIZE;
  const sheet = useHighResSheet ? jumpSpriteSheet : spriteSheet;
  const { sx, sy } = !useHighResSheet
    ? playerFrameSource(player.animState, player.animFrame)
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

/** Draws one sparkle burst — a ring of small fading dots radiating outward
 *  from (x, y) — called only by drawPuffEffects (a standalone world-event
 *  puff, whose scale varies with the entity that caused it). A flight effect
 *  (drawCollectionEffects) shows only its flying text and never a sparkle —
 *  sparkle is exclusively PuffEffect's concern, decoupled from CV-fact
 *  collection. This stays the one place that draws a sparkle ring, so the
 *  visual can't drift if a future call site needs one too. */
function drawSparkleBurst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  elapsedSinceCollect: number,
  scale = 1,
): void {
  for (const sparkle of sparkleParticles(elapsedSinceCollect, scale)) {
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
    drawSparkleBurst(ctx, effect.x, effect.y, effect.elapsed, effect.scale);
  }
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
