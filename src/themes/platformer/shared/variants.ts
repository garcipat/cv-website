/**
 * The shared position-hashed variant picker: relocated verbatim from
 * `engine/StaticObjectsCatalog.ts` so both the engine catalogs and the `tiles/`
 * modules can use it without introducing a `tiles/ → engine/` edge. Pure
 * delegates to `shared/math.hash2D`.
 */

import { hash2D } from './math';

/**
 * Picks a variant deterministically from a cell's grid position. Backed by
 * `shared/math.ts`'s `hash2D(col, row)`; the two large unrelated multipliers in
 * that hash scramble the low bits enough that adjacent columns don't fall into
 * an obvious short repeating sequence.
 */
export function pickVariant<T>(variants: readonly T[], col: number, row: number): T {
  // Every variants array today is a non-empty literal declared above, but
  // nothing in the types enforces that. Guard explicitly rather than
  // letting `% 0` produce NaN and silently index to `undefined` — that
  // would only surface later as a confusing "undefined.sx" crash deep in
  // the render loop, far from the actual cause.
  if (variants.length === 0) {
    throw new Error('pickVariant: no variants provided');
  }
  const hash = hash2D(col, row);
  const index = hash % variants.length;
  return variants[index];
}
