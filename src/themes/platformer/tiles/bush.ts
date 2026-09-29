import { RENDERED_TILE_SIZE, TILE_SIZE, verticalRunRole } from '../level/Terrain';
import type { VerticalRunRole } from '../level/Terrain';
import { pickVariant } from '../shared/variants';
import type { StaticObjectEntry } from './spriteRects';
import type { TileDrawContext, TileModule } from './TileModule';

/**
 * `bush` — the bush/tree run decoration (`n`). Non-solid, non-climbable, fogged;
 * drawn in the terrain band. Owns the bush/tree variant table relocated from
 * `engine/StaticObjectsCatalog.ts`.
 */

/** One or more sprite variants per run role. A cell's variant is picked
 * deterministically from its own column and row (see `pickVariant`) so
 * neighbouring cells of the same role don't all look identical once a role
 * gains more than one variant — with exactly one variant per role today, every
 * position resolves to that single entry. */
const BUSH_OR_TREE_VARIANTS: Record<VerticalRunRole, StaticObjectEntry[]> = {
  only: [
    { sx: 16, sy: 48 },
    { sx: 16, sy: 64 },
    { sx: 16, sy: 80 },
    { sx: 16, sy: 96 },
  ],
  bottom: [{ sx: 0, sy: 80 }],
  middle: [{ sx: 0, sy: 64 }],
  top: [{ sx: 0, sy: 48 }],
};

export function bushOrTreeEntry(
  role: VerticalRunRole,
  col: number,
  row: number,
): StaticObjectEntry {
  return pickVariant(BUSH_OR_TREE_VARIANTS[role], col, row);
}

function draw(rc: TileDrawContext): void {
  const { ctx, level, col, row, destX, destY, images } = rc;
  const entry = bushOrTreeEntry(verticalRunRole(level, col, row, 'bush'), col, row);
  ctx.drawImage(
    images.tileset,
    entry.sx,
    entry.sy,
    TILE_SIZE,
    TILE_SIZE,
    destX,
    destY,
    RENDERED_TILE_SIZE,
    RENDERED_TILE_SIZE,
  );
}

export const bushModule = {
  char: 'n',
  fogExempt: false,
  drawBand: 'terrain',
  draw,
} as const satisfies TileModule;
