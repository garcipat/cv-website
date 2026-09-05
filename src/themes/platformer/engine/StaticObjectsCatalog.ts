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

/** A vertical hanging-chain link at `staticObjects.png` row 7 (native
 *  y=112), columns 5-8 (native sx 80/96/112/128) — but NOT 4 interchangeable
 *  variants of one centered design. Pixel inspection shows the link art
 *  sits left-of-center (native x 2-6) at sx:80/sx:112, and right-of-center
 *  (native x 9-13) at sx:96/sx:128. `chainEntry` below uses this directly:
 *  the left-leaning pair renders a chain hugging a wall to its LEFT, the
 *  right-leaning pair hugs a wall to its RIGHT, with no destination-rect
 *  offset needed — the art itself already reads as attached to that side. */
const CHAIN_LEFT_VARIANTS: StaticObjectEntry[] = [
  { sx: 80, sy: 112 },
  { sx: 112, sy: 112 },
];
const CHAIN_RIGHT_VARIANTS: StaticObjectEntry[] = [
  { sx: 96, sy: 112 },
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

export function staticObjectEntry(tile: 'fence', col: number, row: number): StaticObjectEntry {
  void tile; // only one static-object kind uses this function today
  return pickVariant(FENCE_VARIANTS, col, row);
}

/**
 * Picks a chain-link sprite for a cell, given its resolved attachment
 * (`Terrain.ts`'s `chainAttachment`) and column. Deliberately hashes on
 * `col` ONLY (via `pickVariant(..., col, 0)`), unlike `bushOrTreeEntry`/
 * `staticObjectEntry` which hash on `col`+`row`: a chain shaft's cells all
 * share the same column, so hashing on column alone keeps every cell of one
 * shaft picking the SAME variant — hashing in `row` too (the original,
 * buggy approach) made adjacent rows of one shaft pick different left/right-
 * leaning art at random, a visible zig-zag.
 *
 * `'left'`/`'right'` pick from the matching leaning pair — the art itself
 * provides the "hugs that wall" look, no pixel offset needed. `'ceiling'`
 * (hanging free, no wall to match) has no "correct" side, so it alternates
 * between the two pairs by column parity purely for visual variety.
 */
export function chainEntry(attachment: 'ceiling' | 'left' | 'right', col: number): StaticObjectEntry {
  const variants =
    attachment === 'left' ? CHAIN_LEFT_VARIANTS :
    attachment === 'right' ? CHAIN_RIGHT_VARIANTS :
    col % 2 === 0 ? CHAIN_LEFT_VARIANTS : CHAIN_RIGHT_VARIANTS;
  return pickVariant(variants, col, 0);
}
