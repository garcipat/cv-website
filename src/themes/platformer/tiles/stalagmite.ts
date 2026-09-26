import { RENDERED_TILE_SIZE, TILE_SIZE } from '../level/Terrain';
import { pickVariant } from '../shared/variants';
import type { StaticObjectEntry } from './spriteRects';
import type { TileDrawContext, TileModule } from './TileModule';

/**
 * `stalagmite` — the floor-standing cave decoration (`⊥`). Non-solid,
 * non-climbable, fogged; drawn in the terrain band. Owns its variant table +
 * draw relocated from `engine/StaticObjectsCatalog.ts` (US4/T035).
 */

/**
 * Size variants for `stalagmite` — which size (large or twin) renders at a given
 * cell is picked deterministically from its own position (see `pickVariant`).
 */
const STALAGMITE_VARIANTS: StaticObjectEntry[] = [
  { sx: 17, sy: 17, width: 16, height: 18 }, // large
  { sx: 34, sy: 25, width: 16, height: 10 }, // twin
];

export function stalagmiteEntry(col: number, row: number): StaticObjectEntry {
  return pickVariant(STALAGMITE_VARIANTS, col, row);
}

function draw(rc: TileDrawContext): void {
  const { ctx, col, row, destX, destY, images } = rc;
  const decorations = images.decorations;
  if (!decorations) return;
  const entry = stalagmiteEntry(col, row);
  ctx.drawImage(
    decorations, entry.sx, entry.sy, entry.width ?? TILE_SIZE, entry.height ?? TILE_SIZE,
    destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
  );
}

export const stalagmiteModule = {
  char: '⊥',
  fogExempt: false,
  drawBand: 'terrain',
  draw,
} as const satisfies TileModule;
