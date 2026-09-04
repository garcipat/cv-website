import { TILE_SIZE } from '../level/Terrain';
import type { VerticalRunRole } from '../level/Terrain';

export interface StaticObjectEntry {
  sx: number;
  sy: number;
}

/** One or more sprite variants per role. A cell's variant is picked
 *  deterministically from its own column and row (see `pickVariant`) so
 *  neighbouring cells of the same role don't all look identical once a
 *  role gains more than one variant — with exactly one variant per role
 *  today, every position resolves to that single entry. */
const BUSH_OR_TREE_VARIANTS: Record<VerticalRunRole, StaticObjectEntry[]> = {
  only: [{ sx: 0, sy: 0 }],
  bottom: [{ sx: 0, sy: 48 }],
  middle: [{ sx: 0, sy: 64 }],
  top: [{ sx: 0, sy: 16 }],
};

const FENCE_VARIANTS: StaticObjectEntry[] = [{ sx: 96, sy: 128 }];

function pickVariant<T>(variants: readonly T[], col: number, row: number): T {
  const index = (col * 31 + row * 17) % variants.length;
  return variants[index];
}

export function bushOrTreeEntry(role: VerticalRunRole, col: number, row: number): StaticObjectEntry {
  return pickVariant(BUSH_OR_TREE_VARIANTS[role], col, row);
}

export function staticObjectEntry(tile: 'fence', col: number, row: number): StaticObjectEntry {
  void tile; // only one static-object kind uses this function today
  return pickVariant(FENCE_VARIANTS, col, row);
}
