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

const FENCE_VARIANTS: StaticObjectEntry[] = [{ sx: 32, sy: 64 }];

/** A vertical hanging-chain link, uniform and seamlessly repeatable row to
 *  row — unlike BUSH_OR_TREE_VARIANTS there is no distinct top/bottom
 *  end-cap art, so (like `Renderer.ts`'s ladder sprite) the same frame is
 *  reused for every row of a shaft regardless of length. The 4 near-identical
 *  columns exist purely for `pickVariant`'s per-cell visual variety, the
 *  same reason BUSH_OR_TREE_VARIANTS.only has 4 entries. */
const CHAIN_VARIANTS: StaticObjectEntry[] = [
  { sx: 80, sy: 112 },
  { sx: 96, sy: 112 },
  { sx: 112, sy: 112 },
  { sx: 128, sy: 112 },
];

function pickVariant<T>(variants: readonly T[], col: number, row: number): T {
  // Every variants array today is a non-empty literal declared above, but
  // nothing in the types enforces that. Guard explicitly rather than
  // letting `% 0` produce NaN and silently index to `undefined` — that
  // would only surface later as a confusing "undefined.sx" crash deep in
  // the render loop, far from the actual cause.
  if (variants.length === 0) {
    throw new Error('pickVariant: no variants provided');
  }
  // A plain `(col * a + row * b) % n` cycles through variants in a fixed
  // order as col increases by 1 (period `n`) — visually that reads as
  // "small, medium, large, small, medium, large, ..." rather than varied,
  // especially when `n` is small (like 4 bush sizes). Multiplying by two
  // large, unrelated constants (Math.imul keeps this in 32-bit int math)
  // before XOR-ing scrambles the low bits enough that adjacent columns
  // don't fall into an obvious short repeating sequence.
  const hash = (Math.imul(col, 374761393) ^ Math.imul(row, 668265263)) >>> 0;
  const index = hash % variants.length;
  return variants[index];
}

export function bushOrTreeEntry(role: VerticalRunRole, col: number, row: number): StaticObjectEntry {
  return pickVariant(BUSH_OR_TREE_VARIANTS[role], col, row);
}

export function staticObjectEntry(tile: 'fence' | 'chain', col: number, row: number): StaticObjectEntry {
  return pickVariant(tile === 'fence' ? FENCE_VARIANTS : CHAIN_VARIANTS, col, row);
}
