import type { DrawContext } from '../../engine/DrawContext';
import { STATIC_OBJECTS_SHEET } from '../sprites/sheets';
import { TILE_SIZE, RENDERED_TILE_SIZE } from '../../level/Terrain';

/** The number of clay size variants — the three single-pot sprites at row 7
 *  of `staticObjects.png`. No new art is introduced for this feature. */
export const CLAY_VARIANT_COUNT = 3;

/** Native tile column of each single-pot sprite on `staticObjects.png`'s row
 *  7 (16px tiles): 0=small round jar, 1=tall narrow urn, 2=wide square brick
 *  urn. The 2-tile-wide "cluster" sprite at row 8 is deliberately unused —
 *  see this step's plan for how these were located on the sheet and why.
 *  Moved here from `CoinPot.ts` when the variant rule became shared. */
const VARIANT_TILE_COLUMNS: readonly number[] = [0, 1, 2];
const VARIANT_ROW = 7;

/** One of the three clay size variants, matching `VARIANT_TILE_COLUMNS`'s
 *  indices. */
export type ClayVariant = 0 | 1 | 2;

function toVariant(index: number): ClayVariant {
  return index === 0 ? 0 : index === 1 ? 1 : 2;
}

/**
 * The clay size variant a base pot at this tile draws — a pure function of
 * the tile's own `(col, row)` alone, so a surviving pot keeps its size when
 * a neighbour breaks or a bunch re-forms (FR-010, SC-008).
 *
 * The `col` term steps the variant by exactly one per column (mod 3), so two
 * horizontally adjacent tiles can never share a size — the rule that makes a
 * run read as varied sizes (FR-009, SC-002). A per-row phase keeps different
 * rows from all starting on the same size. (A hashed `% 3` was tried first,
 * but its low-bit bias made long runs of adjacent tiles land on the same
 * variant, so a bunch of pots rendered as the same pot repeated.)
 */
export function clayVariantAt(col: number, row: number): ClayVariant {
  const rowPhase = (Math.imul(row, 668265263) >>> 0) % CLAY_VARIANT_COUNT;
  const index = (col + rowPhase) % CLAY_VARIANT_COUNT;
  return toVariant(index < 0 ? index + CLAY_VARIANT_COUNT : index);
}

/**
 * The clay size variant a filler pot draws on the seam between the tiles at
 * `seamCol` and `seamCol + 1`. By construction it differs from BOTH bridged
 * clay variants, so no two neighbouring rendered clay pots — base or
 * filler — ever share a variant, for a run of any length (FR-009, SC-002).
 * When the two bridged variants differ, the third value is the only one left
 * (`0+1+2 = 3`); when they are equal, the next value round the ring is used.
 */
export function fillerVariantAt(seamCol: number, row: number): ClayVariant {
  const left = clayVariantAt(seamCol, row);
  const right = clayVariantAt(seamCol + 1, row);
  return left !== right ? toVariant(3 - left - right) : toVariant((left + 1) % CLAY_VARIANT_COUNT);
}

/** Blits one clay size variant of `staticObjects.png` at the given rendered
 *  position, with an optional bump nudge offset. Shared by every base pot
 *  (via each kind's own `drawPot`) and every bunch filler. */
export function drawClayPotAt(
  dc: DrawContext,
  x: number,
  y: number,
  variantIndex: number,
  bumpOffsetY = 0,
): void {
  const image = dc.sprites[STATIC_OBJECTS_SHEET.src];
  if (!image) return;
  const sx = VARIANT_TILE_COLUMNS[variantIndex] * TILE_SIZE;
  const sy = VARIANT_ROW * TILE_SIZE;
  dc.ctx.drawImage(
    image,
    sx,
    sy,
    TILE_SIZE,
    TILE_SIZE,
    x + dc.originX,
    y + dc.originY + bumpOffsetY,
    RENDERED_TILE_SIZE,
    RENDERED_TILE_SIZE,
  );
}
