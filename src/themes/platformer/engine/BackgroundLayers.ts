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

/** Flat fill used for whatever vertical gap remains between the sky's bottom
 *  edge and the clouds/hills layer (now positioned just above the village,
 *  not directly under the sky) — sampled directly from the sky/clouds art's
 *  own light-blue, so the fill blends seamlessly. */
const SKY_FILL_COLOR = 'rgb(66, 154, 215)';

/** Extra flat dark-blue margin drawn above the sky image itself, in native
 *  (unscaled) pixels — gives HUD elements (hearts, coins, journal icon, drawn
 *  elsewhere) more dark-blue backdrop to sit against at the very top of the
 *  canvas, instead of extending into the sky's lighter blue. Sampled from the
 *  sky art's own top-row color so it blends seamlessly with the image below
 *  it. Scaled by `BACKGROUND_RENDER_SCALE` at the point of use, same
 *  convention as every other native-unit constant here. Tunable — adjust to
 *  taste. */
export const SKY_TOP_MARGIN = 16;
const SKY_DARK_COLOR = 'rgb(72, 102, 197)';

/** Extra gap between the clouds/hills layer's bottom edge and the village
 *  layer's top edge, in native (unscaled) pixels — so clouds read as
 *  floating a bit above the treeline rather than touching it directly.
 *  Filled by `CLOUDS_VILLAGE_GAP_COLOR` (see `drawBackgroundLayers`).
 *  Scaled by `BACKGROUND_RENDER_SCALE` at the point of use. Tunable. */
export const CLOUDS_VILLAGE_GAP = 8;

/** Flat fill for the small gap between the clouds/hills layer's bottom edge
 *  and the village layer's top edge (see `CLOUDS_VILLAGE_GAP`) — sampled
 *  directly from the clouds/hills band's own cyan hill-wave tone (the only
 *  "hill" color present in that band, confirmed by sampling every distinct
 *  color in the band: sky-blue, white clouds, and this cyan — no darker
 *  shade exists in the current art), so the small gap reads as a
 *  continuation of the hills rather than a bare gap. */
const CLOUDS_VILLAGE_GAP_COLOR = 'rgb(127, 213, 205)';

/** Flat fill used below the single grass draw, down to the canvas bottom —
 *  sampled directly from `background_layer_grass.png`'s own solid bottom
 *  rows (10-19), so it blends seamlessly with the tile's own bottom edge
 *  instead of needing the tile to repeat. */
const GRASS_FILL_COLOR = 'rgb(46, 74, 68)';

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
  const unrounded = rawOffset > 0 ? rawOffset - destWidth : rawOffset;
  // Round to the nearest whole pixel — a fractional offset here (from a
  // non-integer cameraX * parallaxFactor product) causes a visible 1px seam
  // between adjacent tiles once imageSmoothingEnabled is false, since each
  // tile's edge would otherwise land on a different sub-pixel boundary.
  const offset = Math.round(unrounded);

  for (let x = offset; x < canvasWidth; x += destWidth) {
    ctx.drawImage(image, sx, sy, width, height, x, destY, destWidth, destHeight);
  }
}

/**
 * Draws the 5-layer parallax background, replacing the old procedural
 * `drawSkyBackground`. Fixed to the viewport (no `originX`/`originY`
 * level-camera convention) except that each layer scrolls horizontally at
 * its own fraction of `cameraX` for a parallax depth effect. All static
 * layers render at `BACKGROUND_RENDER_SCALE`:
 *
 * - **Sky top margin**: a flat `SKY_DARK_COLOR` fill, `SKY_TOP_MARGIN`
 *   (scaled) px tall, drawn above the sky image itself so HUD elements have
 *   more dark-blue backdrop at the very top of the canvas.
 * - **Sky**: pinned just below the top margin, never scrolls (`cameraX`
 *   ignored).
 * - **Sky-color fill**: fills the gap between the sky's bottom edge and the
 *   clouds/hills layer's top edge (now widened by `CLOUDS_VILLAGE_GAP`) with
 *   `SKY_FILL_COLOR`.
 * - **Clouds/hills**: drawn exactly ONCE, positioned `CLOUDS_VILLAGE_GAP`
 *   (scaled) px ABOVE the village layer (not directly under the sky) — reads
 *   as floating a bit above the treeline rather than touching it. Slow
 *   parallax.
 * - **Clouds-to-village gap fill**: fills the `CLOUDS_VILLAGE_GAP` (scaled)
 *   px gap between the clouds/hills layer's bottom edge and the village
 *   layer's top edge with `CLOUDS_VILLAGE_GAP_COLOR`, so it reads as a
 *   continuation of the hills rather than a bare gap.
 * - **Village/treeline**: pinned `VILLAGE_BOTTOM_OFFSET` (scaled) px above
 *   the canvas bottom. Medium parallax.
 * - **River overlay**: a 2-frame alternating flipbook drawn on top of the
 *   village row, at `villageTop + RIVER_DEST_OFFSET * BACKGROUND_RENDER_SCALE`
 *   so its own water-line aligns with the village band's baked-in river line.
 *   Same parallax speed and scale as the village.
 * - **Grass**: drawn exactly ONCE at the village layer's bottom edge, with
 *   `GRASS_FILL_COLOR` filling everything below it down to the canvas
 *   bottom — not tiled repeatedly. Full camera speed — matches the
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

  const skyTopMarginHeight = SKY_TOP_MARGIN * BACKGROUND_RENDER_SCALE;
  ctx.fillStyle = SKY_DARK_COLOR;
  ctx.fillRect(0, 0, canvasWidth, skyTopMarginHeight);

  drawTiledRow(ctx, images.layers, SKY_SOURCE_RECT, skyTopMarginHeight, canvasWidth, cameraX, 0, BACKGROUND_RENDER_SCALE);
  const skyBottom = skyTopMarginHeight + SKY_SOURCE_RECT.height * BACKGROUND_RENDER_SCALE;

  const villageDestHeight = VILLAGE_SOURCE_RECT.height * BACKGROUND_RENDER_SCALE;
  const villageTop = canvasHeight - VILLAGE_BOTTOM_OFFSET * BACKGROUND_RENDER_SCALE - villageDestHeight;
  const villageBottom = villageTop + villageDestHeight;

  const cloudsDestHeight = CLOUDS_SOURCE_RECT.height * BACKGROUND_RENDER_SCALE;
  const cloudsTop = villageTop - cloudsDestHeight - CLOUDS_VILLAGE_GAP * BACKGROUND_RENDER_SCALE;

  if (cloudsTop > skyBottom) {
    ctx.fillStyle = SKY_FILL_COLOR;
    ctx.fillRect(0, skyBottom, canvasWidth, cloudsTop - skyBottom);
  }

  drawTiledRow(
    ctx, images.layers, CLOUDS_SOURCE_RECT, cloudsTop, canvasWidth, cameraX, CLOUDS_PARALLAX_FACTOR,
    BACKGROUND_RENDER_SCALE,
  );

  const cloudsBottom = cloudsTop + cloudsDestHeight;
  if (villageTop > cloudsBottom) {
    ctx.fillStyle = CLOUDS_VILLAGE_GAP_COLOR;
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

  const grassDestHeight = images.grass.height * BACKGROUND_RENDER_SCALE;
  const grassSource: SourceRect = { sx: 0, sy: 0, width: images.grass.width, height: images.grass.height };
  drawTiledRow(
    ctx, images.grass, grassSource, villageBottom, canvasWidth, cameraX, GRASS_PARALLAX_FACTOR,
    BACKGROUND_RENDER_SCALE,
  );
  const grassBottom = villageBottom + grassDestHeight;

  if (grassBottom < canvasHeight) {
    ctx.fillStyle = GRASS_FILL_COLOR;
    ctx.fillRect(0, grassBottom, canvasWidth, canvasHeight - grassBottom);
  }
}
