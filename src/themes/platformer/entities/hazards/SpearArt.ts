import type { Rect } from '../geometry';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';

/**
 * How many drawn rows below each spear run's own top are kept as its lethal
 * tip — pinned to 4 from the actual art (`spears.png`'s three runs top out at
 * rows 8, 0 and 8, and each pointed tip tapers over roughly four rows before
 * the shaft begins). See research D4 in
 * `specs/O-020-floor-spear-hazard/research.md`.
 */
export const SPEAR_TIP_ROWS = 4;

/**
 * A row-major 1-bit bitmap over one rendered tile: `pixels[y * width + x]` is
 * 1 for a lethal tip pixel. The spear's alpha channel is reduced to this mask
 * so only the drawn tips — never the side, shaft or transparent margin — can
 * ever be lethal (O-020 FR-003).
 */
export interface SpearMask {
  width: number;
  height: number;
  pixels: Uint8Array;
}

/**
 * One mask byte per pixel from an RGBA buffer's alpha channel: 1 when the
 * alpha is strictly greater than `alphaThreshold`, else 0. Pure; no DOM.
 */
export function buildSpearMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = 0,
): SpearMask {
  const pixels = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    pixels[i] = data[i * 4 + 3] > alphaThreshold ? 1 : 0;
  }
  return { width, height, pixels };
}

/**
 * Restricts a full mask to the top `tipRows` drawn rows of each vertical
 * spear column-run (a maximal contiguous run of columns containing drawn
 * pixels), each run judged against its OWN topmost drawn row — so the uneven
 * tips are correct and the shaft below the tip band is cleared. Pure.
 */
export function tipMaskFromMask(mask: SpearMask, tipRows = SPEAR_TIP_ROWS): SpearMask {
  const { width, height } = mask;
  const pixels = new Uint8Array(width * height);

  const columnHasDrawn = (x: number): boolean => {
    for (let y = 0; y < height; y++) {
      if (mask.pixels[y * width + x] === 1) return true;
    }
    return false;
  };

  let x = 0;
  while (x < width) {
    if (!columnHasDrawn(x)) {
      x++;
      continue;
    }
    const runStart = x;
    while (x < width && columnHasDrawn(x)) x++;
    const runEnd = x - 1;

    let top = height;
    for (let runX = runStart; runX <= runEnd; runX++) {
      for (let y = 0; y < top; y++) {
        if (mask.pixels[y * width + runX] === 1) {
          top = y;
          break;
        }
      }
    }

    const tipBottom = top + tipRows;
    for (let runX = runStart; runX <= runEnd; runX++) {
      for (let y = top; y < Math.min(tipBottom, height); y++) {
        if (mask.pixels[y * width + runX] === 1) pixels[y * width + runX] = 1;
      }
    }
  }

  return { width, height, pixels };
}

/**
 * The lethal-contact test — a fall onto the spear from above its own height.
 * True iff the player's feet crossed the spear tile's TOP edge downward this
 * step (`prevFeetY <= spear.y && feetY > spear.y`) and the hitbox horizontally
 * overlaps any drawn tip pixel.
 *
 * The tile-top crossing is what makes "only a landing from above kills"
 * correct: a jump from inside the tile that clears a shorter side spear's tip
 * but never rises above the spear's own top does not cross this edge, so it is
 * harmless (O-020 FR-003). Because the spear tile is non-solid, once the feet
 * have entered from above the player falls through the tips regardless of how
 * far they got in the same step, so a fast fall that skips the whole tip band
 * still registers. Pure; no DOM.
 */
export function spearTipSweepHits(
  hitbox: Rect,
  spear: { x: number; y: number },
  mask: SpearMask,
  prevFeetY: number,
  feetY: number,
): boolean {
  if (prevFeetY > spear.y || feetY <= spear.y) return false;

  const { width, height, pixels } = mask;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      if (pixels[py * width + px] !== 1) continue;
      const worldX = spear.x + px;
      if (worldX >= hitbox.x && worldX < hitbox.x + hitbox.width) return true;
    }
  }
  return false;
}

/** The empty mask — what `getSpearTipMask` returns until the art loads, so an
 *  unloaded spear is inert (and also renders nothing). */
const EMPTY_SPEAR_MASK: SpearMask = {
  width: RENDERED_TILE_SIZE,
  height: RENDERED_TILE_SIZE,
  pixels: new Uint8Array(RENDERED_TILE_SIZE * RENDERED_TILE_SIZE),
};

let spearTipMask: SpearMask = EMPTY_SPEAR_MASK;

/** Replaces the module-level tip mask (built once when `spears.png` loads). */
export function setSpearTipMask(mask: SpearMask): void {
  spearTipMask = mask;
}

/** The current tip mask — the empty mask until `setSpearTipMask` is called. */
export function getSpearTipMask(): SpearMask {
  return spearTipMask;
}

/**
 * Browser-only: draws the loaded image at `RENDERED_TILE_SIZE`, samples its
 * alpha channel and returns the derived tip mask. Returns `null` when no 2D
 * context is available (jsdom/tests) or when sampling throws. Never throws.
 */
export function spearTipMaskFromImage(image: CanvasImageSource): SpearMask | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = RENDERED_TILE_SIZE;
    canvas.height = RENDERED_TILE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
    const { data } = ctx.getImageData(0, 0, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
    return tipMaskFromMask(buildSpearMask(data, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE));
  } catch {
    return null;
  }
}
