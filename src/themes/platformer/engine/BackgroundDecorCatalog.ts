/**
 * Rock accents scattered across fully-interior background cells (FR-008),
 * scoped to background decor only — a new, small catalog rather than an
 * extension of `StaticObjectsCatalog.ts` (see design.md's "Why rocks are a
 * new small catalog instead of extending `StaticObjectsCatalog`").
 */

import { pickVariant } from './StaticObjectsCatalog';

export interface BackgroundDecorEntry {
  sx: number;
  sy: number;
}

/**
 * One rock accent, a standard 16x16 tile crop (like `FENCE_VARIANTS` in
 * `StaticObjectsCatalog.ts`, no explicit `width`/`height` — those only appear
 * on the hand-spaced entries that AREN'T a plain 16x16 tile) taken from
 * `decorations.png`'s spare bottom-right corner, the one region of that
 * 67x35 sheet none of `StaticObjectsCatalog`'s cobweb/crystal/stalactite/
 * stalagmite entries reach into. A single-entry array, same convention
 * `FENCE_VARIANTS`/`CRYSTAL_CLUSTER_VARIANTS` use for a decoration with only
 * one variant today — `pickVariant` still routes through the same
 * deterministic hash, so a second variant is a one-line addition later.
 */
const ROCK_VARIANTS: BackgroundDecorEntry[] = [{ sx: 51, sy: 17 }];

/**
 * The rock sprite for a fully-interior background cell at `(col, row)`.
 * Deterministic from grid position alone (FR-008's Acceptance Scenario 2) —
 * the same level always renders the same rocks in the same places. The
 * caller (`Renderer.ts`'s `drawBackgroundTiles`) only calls this for a cell
 * whose `backgroundNeighbourMask` is 15 (fully interior/middle) — the one
 * shape guaranteed to carry no border art a rock could overlap.
 */
export function backgroundRockEntry(col: number, row: number): BackgroundDecorEntry {
  return pickVariant(ROCK_VARIANTS, col, row);
}
