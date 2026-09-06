/**
 * The parallax background: a combined sky/clouds/village sheet plus a
 * separate small tileable grass swatch — see
 * `specs/S-006-platformer-theme/plans/2026-09-06-background-image-layers-design.md`.
 */
export interface BackgroundLayerImages {
  layers: HTMLImageElement;
  grass: HTMLImageElement;
  river: HTMLImageElement;
}

interface SourceRect {
  sx: number;
  sy: number;
  width: number;
  height: number;
}

/** Sub-rects within `BACKGROUND_LAYERS_SHEET`'s image (see `sheets.ts`) — sky,
 *  clouds/hills, and village/treeline stacked vertically in that order, each
 *  spanning the sheet's full 160px width. Exported so tests (and any future
 *  caller) address a band by name instead of a hardcoded sy. */
export const SKY_SOURCE_RECT: SourceRect = { sx: 0, sy: 0, width: 160, height: 24 };
export const CLOUDS_SOURCE_RECT: SourceRect = { sx: 0, sy: 24, width: 160, height: 60 };
export const VILLAGE_SOURCE_RECT: SourceRect = { sx: 0, sy: 84, width: 160, height: 57 };

/** How far the village layer's bottom edge sits above the canvas bottom, in
 *  native (unscaled) pixels — chosen so typical foreground terrain height
 *  doesn't fully hide it. Scaled by `BACKGROUND_RENDER_SCALE` at the point of
 *  use, same convention as every other native-unit constant here. Tuned
 *  visually against a real level; see the design doc's Open items. */
const VILLAGE_BOTTOM_OFFSET = 64;

/** The river overlay's own water-line sits at row 5-6 within its 30px-tall
 *  frame, while the village band's baked-in river line sits at row 16-17
 *  from the village band's own top — so drawing the overlay flush with the
 *  village row (destY = villageTop) puts it 11px too high relative to the
 *  art it's meant to overlay. Confirmed via pixel sampling (16 - 5 = 11).
 *  A native (unscaled) pixel distance — scaled by `BACKGROUND_RENDER_SCALE`
 *  at the point of use, same as `VILLAGE_BOTTOM_OFFSET`. */
export const RIVER_DEST_OFFSET = 11;

/** Parallax speed factors: 0 = fixed to the viewport, 1 = full camera speed
 *  (matches the foreground terrain exactly). Clouds/hills scroll slowest,
 *  village faster than clouds but still slower than the foreground, grass
 *  matches the foreground exactly since it reads as a continuation of the
 *  same ground. */
const CLOUDS_PARALLAX_FACTOR = 0.2;
const VILLAGE_PARALLAX_FACTOR = 0.5;
const GRASS_PARALLAX_FACTOR = 1;

/** How long each of the river's 2 wave-line frames stays on screen before
 *  swapping to the other — a plain alternating flipbook, not a scroll.
 *  Expressed in seconds (500ms) to match `worldElapsedSeconds`, which is
 *  accumulated from `dt` (see GameLoop.ts's `onTick(dt)` doc comment — `dt`
 *  is seconds, not ms — the same convention Coin.ts's `elapsedSeconds`
 *  parameter uses). */
export const RIVER_FRAME_DURATION_SECONDS = 0.5;
const RIVER_FRAME_HEIGHT = 30;

/** Every static background layer (sky, clouds/hills, village, grass) renders
 *  at this uniform scale — matching the foreground terrain's own
 *  `RENDERED_TILE_SIZE` render scale, so the background's pixel density
 *  doesn't jar against it. The river overlay inherits this scale too, since
 *  it's positioned relative to the village layer. */
export const BACKGROUND_RENDER_SCALE = 2;

/** Flat fill used for whatever vertical gap remains between the single
 *  clouds/hills draw and the village layer — sampled directly from the
 *  sky/clouds art's own light-blue, so the fill blends seamlessly rather
 *  than reading as a visible seam or a mismatched color. */
const SKY_FILL_COLOR = 'rgb(66, 154, 215)';

/** Draws one source rect tiled horizontally across `canvasWidth`, with its
 *  top-left at `destY`, offset by `cameraX * parallaxFactor` (wrapped to the
 *  rect's own SOURCE width so the tiling never visibly seams). `destScale`
 *  (default 1, native size) scales only the destination rect each tile is
 *  drawn into — the source rect always stays at its own native size. */
function drawTiledRow(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: SourceRect,
  destY: number,
  canvasWidth: number,
  cameraX: number,
  parallaxFactor: number,
  destScale = 1,
): void {
  const { sx, sy, width, height } = source;
  const destWidth = width * destScale;
  const destHeight = height * destScale;
  const rawOffset = -(cameraX * parallaxFactor) % destWidth;
  // JS `%` can return a negative result; normalize into [-destWidth, 0] so
  // the very first tile always starts at or to the left of x=0.
  const offset = rawOffset > 0 ? rawOffset - destWidth : rawOffset;

  for (let x = offset; x < canvasWidth; x += destWidth) {
    ctx.drawImage(image, sx, sy, width, height, x, destY, destWidth, destHeight);
  }
}

/** Draws one source rect tiled across both axes, filling from `top` to
 *  `bottom` (inclusive of any partial tile at the bottom edge) and across the
 *  full canvas width. `destScale` (default 1) is forwarded to `drawTiledRow`
 *  and also steps the row loop by the SCALED tile height, so a scaled tile
 *  neither leaves gaps nor overdraws past `bottom`. */
function drawTiledArea(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: SourceRect,
  top: number,
  bottom: number,
  canvasWidth: number,
  cameraX: number,
  parallaxFactor: number,
  destScale = 1,
): void {
  const destHeight = source.height * destScale;
  for (let y = top; y < bottom; y += destHeight) {
    drawTiledRow(ctx, image, source, y, canvasWidth, cameraX, parallaxFactor, destScale);
  }
}

/**
 * Draws the 5-layer parallax background, replacing the old procedural
 * `drawSkyBackground`. Fixed to the viewport (no `originX`/`originY`
 * level-camera convention — same reasoning as the old sky) except that each
 * layer scrolls horizontally at its own fraction of `cameraX` for a parallax
 * depth effect. All static layers render at `BACKGROUND_RENDER_SCALE`:
 *
 * - **Sky**: pinned to y=0, never scrolls (`cameraX` ignored).
 * - **Clouds/hills**: drawn exactly ONCE, directly under the sky — not tiled
 *   vertically (an earlier version tiled it to fill the gap down to the
 *   village layer, which read as a visibly repeating stack on a tall
 *   window). Slow parallax.
 * - **Sky-color fill**: whatever vertical gap remains between the bottom of
 *   the single clouds draw and the top of the village layer is filled with
 *   `SKY_FILL_COLOR`, a flat color matching the art rather than a second
 *   copy of the clouds tile.
 * - **Village/treeline**: pinned `VILLAGE_BOTTOM_OFFSET` (scaled) px above
 *   the canvas bottom. Medium parallax.
 * - **River overlay**: a 2-frame alternating flipbook drawn on top of the
 *   village row, at `villageTop + RIVER_DEST_OFFSET * BACKGROUND_RENDER_SCALE`
 *   so its own water-line aligns with the village band's baked-in river line
 *   (see `RIVER_DEST_OFFSET`'s doc comment). Same parallax speed and scale as
 *   the village.
 * - **Grass**: tiles both axes, filling from the village layer's bottom edge
 *   down to the canvas bottom. Drawn last, so it covers any seam at the
 *   village layer's own bottom edge. Full camera speed — matches the
 *   foreground terrain's own scroll exactly.
 */
export function drawBackgroundLayers(
  ctx: CanvasRenderingContext2D,
  images: BackgroundLayerImages,
  canvasWidth: number,
  canvasHeight: number,
  cameraX: number,
  worldElapsedSeconds: number,
): void {
  ctx.imageSmoothingEnabled = false;

  drawTiledRow(ctx, images.layers, SKY_SOURCE_RECT, 0, canvasWidth, cameraX, 0, BACKGROUND_RENDER_SCALE);

  const cloudsTop = SKY_SOURCE_RECT.height * BACKGROUND_RENDER_SCALE;
  drawTiledRow(
    ctx, images.layers, CLOUDS_SOURCE_RECT, cloudsTop, canvasWidth, cameraX, CLOUDS_PARALLAX_FACTOR,
    BACKGROUND_RENDER_SCALE,
  );
  const cloudsBottom = cloudsTop + CLOUDS_SOURCE_RECT.height * BACKGROUND_RENDER_SCALE;

  const villageDestHeight = VILLAGE_SOURCE_RECT.height * BACKGROUND_RENDER_SCALE;
  const villageTop = canvasHeight - VILLAGE_BOTTOM_OFFSET * BACKGROUND_RENDER_SCALE - villageDestHeight;
  const villageBottom = villageTop + villageDestHeight;

  if (villageTop > cloudsBottom) {
    ctx.fillStyle = SKY_FILL_COLOR;
    ctx.fillRect(0, cloudsBottom, canvasWidth, villageTop - cloudsBottom);
  }

  drawTiledRow(
    ctx, images.layers, VILLAGE_SOURCE_RECT, villageTop, canvasWidth, cameraX, VILLAGE_PARALLAX_FACTOR,
    BACKGROUND_RENDER_SCALE,
  );

  const riverFrameIndex = Math.floor(worldElapsedSeconds / RIVER_FRAME_DURATION_SECONDS) % 2;
  const riverRect: SourceRect = { sx: 0, sy: riverFrameIndex * RIVER_FRAME_HEIGHT, width: 160, height: RIVER_FRAME_HEIGHT };
  drawTiledRow(
    ctx, images.river, riverRect, villageTop + RIVER_DEST_OFFSET * BACKGROUND_RENDER_SCALE,
    canvasWidth, cameraX, VILLAGE_PARALLAX_FACTOR, BACKGROUND_RENDER_SCALE,
  );

  const grassSource: SourceRect = { sx: 0, sy: 0, width: images.grass.width, height: images.grass.height };
  drawTiledArea(
    ctx, images.grass, grassSource, villageBottom, canvasHeight, canvasWidth, cameraX, GRASS_PARALLAX_FACTOR,
    BACKGROUND_RENDER_SCALE,
  );
}
