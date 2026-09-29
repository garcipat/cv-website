import { RENDERED_TILE_SIZE, TILE_SIZE } from '../level/Terrain';
import { pickVariant } from '../shared/variants';
import type { StaticObjectEntry } from './spriteRects';
import type { TileDrawContext, TileModule } from './TileModule';

/**
 * `crystalCluster` — a single-sprite cave decoration (`c`). Non-solid,
 * non-climbable, fogged; drawn in the terrain band. Owns its variant table +
 * lookup relocated from `engine/StaticObjectsCatalog.ts`.
 */

/**
 * One fixed sprite from the separate `decorations.png` sheet — same "one variant
 * per role" convention as the fence: it never forms multi-tile runs and never
 * varies by position, so it's a length-1 array rather than a
 * `VerticalRunRole`-keyed record.
 */
const CRYSTAL_CLUSTER_VARIANTS: StaticObjectEntry[] = [{ sx: 33, sy: 0, width: 18, height: 18 }];

export function crystalClusterEntry(col: number, row: number): StaticObjectEntry {
  return pickVariant(CRYSTAL_CLUSTER_VARIANTS, col, row);
}

function draw(rc: TileDrawContext): void {
  const { ctx, col, row, destX, destY, images } = rc;
  const decorations = images.decorations;
  if (!decorations) return;
  const entry = crystalClusterEntry(col, row);
  ctx.drawImage(
    decorations,
    entry.sx,
    entry.sy,
    entry.width ?? TILE_SIZE,
    entry.height ?? TILE_SIZE,
    destX,
    destY,
    RENDERED_TILE_SIZE,
    RENDERED_TILE_SIZE,
  );
}

export const crystalClusterModule = {
  char: 'c',
  fogExempt: false,
  drawBand: 'terrain',
  draw,
} as const satisfies TileModule;
