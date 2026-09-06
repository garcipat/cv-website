/**
 * The parallax background: a combined sky/clouds/village sheet plus a
 * separate small tileable grass swatch — see
 * `specs/S-006-platformer-theme/plans/2026-09-06-background-image-layers-design.md`.
 */
export interface BackgroundLayerImages {
  layers: HTMLImageElement;
  grass: HTMLImageElement;
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
 *  doesn't fully hide it. Tuned visually against a real level; see the
 *  design doc's Open items. */
const VILLAGE_BOTTOM_OFFSET = 64;

/** Parallax speed factors: 0 = fixed to the viewport, 1 = full camera speed
 *  (matches the foreground terrain exactly). Clouds/hills scroll slowest,
 *  village faster than clouds but still slower than the foreground, grass
 *  matches the foreground exactly since it reads as a continuation of the
 *  same ground. */
const CLOUDS_PARALLAX_FACTOR = 0.2;
const VILLAGE_PARALLAX_FACTOR = 0.5;
const GRASS_PARALLAX_FACTOR = 1;

/** Draws one source rect tiled horizontally across `canvasWidth`, at native
 *  size, with its top-left at `destY`, offset by `cameraX * parallaxFactor`
 *  (wrapped to the rect's own width so the tiling never visibly seams). */
function drawTiledRow(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: SourceRect,
  destY: number,
  canvasWidth: number,
  cameraX: number,
  parallaxFactor: number,
): void {
  const { sx, sy, width, height } = source;
  const rawOffset = -(cameraX * parallaxFactor) % width;
  // JS `%` can return a negative result; normalize into [-width, 0] so the
  // very first tile always starts at or to the left of x=0.
  const offset = rawOffset > 0 ? rawOffset - width : rawOffset;

  for (let x = offset; x < canvasWidth; x += width) {
    ctx.drawImage(image, sx, sy, width, height, x, destY, width, height);
  }
}

/** Draws one source rect tiled across both axes, filling from `top` to
 *  `bottom` (inclusive of any partial tile at the bottom edge) and across the
 *  full canvas width. */
function drawTiledArea(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: SourceRect,
  top: number,
  bottom: number,
  canvasWidth: number,
  cameraX: number,
  parallaxFactor: number,
): void {
  for (let y = top; y < bottom; y += source.height) {
    drawTiledRow(ctx, image, source, y, canvasWidth, cameraX, parallaxFactor);
  }
}

/**
 * Draws the 4-layer parallax background, replacing the old procedural
 * `drawSkyBackground`. Fixed to the viewport (no `originX`/`originY`
 * level-camera convention — same reasoning as the old sky) except that each
 * layer scrolls horizontally at its own fraction of `cameraX` for a parallax
 * depth effect:
 *
 * - **Sky**: pinned to y=0, never scrolls (`cameraX` ignored).
 * - **Clouds/hills**: tiles to fill the gap between the sky's bottom edge and
 *   the village layer's top edge — this gap grows/shrinks with canvas height.
 *   Slow parallax.
 * - **Village/treeline**: pinned `VILLAGE_BOTTOM_OFFSET` px above the canvas
 *   bottom. Medium parallax.
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
): void {
  ctx.imageSmoothingEnabled = false;

  drawTiledRow(ctx, images.layers, SKY_SOURCE_RECT, 0, canvasWidth, cameraX, 0);

  const villageTop = canvasHeight - VILLAGE_BOTTOM_OFFSET - VILLAGE_SOURCE_RECT.height;
  const villageBottom = villageTop + VILLAGE_SOURCE_RECT.height;
  drawTiledArea(
    ctx, images.layers, CLOUDS_SOURCE_RECT,
    SKY_SOURCE_RECT.height, villageTop, canvasWidth, cameraX, CLOUDS_PARALLAX_FACTOR,
  );

  drawTiledRow(ctx, images.layers, VILLAGE_SOURCE_RECT, villageTop, canvasWidth, cameraX, VILLAGE_PARALLAX_FACTOR);

  const grassSource: SourceRect = { sx: 0, sy: 0, width: images.grass.width, height: images.grass.height };
  drawTiledArea(ctx, images.grass, grassSource, villageBottom, canvasHeight, canvasWidth, cameraX, GRASS_PARALLAX_FACTOR);
}
