/**
 * The transient cosmetic dip of a bouncy mushroom's cap after a bounce.
 *
 * This is the only mutable state the mushroom feature introduces, and it is
 * deliberately tiny and canvas-free: one `{ col, row, elapsed }` entry per
 * recently-bounced cap cell, advanced and pruned by the game loop's `playing`
 * tick. A landing on an already-mid-squash cap restarts its entry rather than
 * queueing a second one. The dip is purely visual — it never affects
 * collision, standability or bounce strength.
 */

import { clamp01 } from '../shared/math';

/** One cap that has just bounced: which cell, and how long ago. */
export interface MushroomSquashState {
  col: number;
  row: number;
  elapsed: number; // seconds since the bounce
}

/** How long the cap takes to return (FR-010). */
export const MUSHROOM_SQUASH_DURATION_SECONDS = 0.1;

/** Maximum downward offset of the cap, in rendered px. */
export const MUSHROOM_SQUASH_DIP_PX = 2;

/** Adds a squash for the cell, replacing any in-progress one for it. */
export function startMushroomSquash(
  states: readonly MushroomSquashState[],
  col: number,
  row: number,
): MushroomSquashState[] {
  return [...states.filter((state) => state.col !== col || state.row !== row), { col, row, elapsed: 0 }];
}

/**
 * Advances every entry by `dt` and drops those at/after the duration. `dt <= 0`
 * leaves entries unchanged (a paused/zero-step tick must not rewind a dip) but
 * still prunes any entry that is already expired.
 */
export function advanceMushroomSquashes(
  states: readonly MushroomSquashState[],
  dt: number,
): MushroomSquashState[] {
  const next: MushroomSquashState[] = [];
  for (const state of states) {
    const elapsed = dt > 0 ? state.elapsed + dt : state.elapsed;
    if (elapsed < MUSHROOM_SQUASH_DURATION_SECONDS) {
      next.push({ ...state, elapsed });
    }
  }
  return next;
}

/** `DIP * (1 - clamp(elapsed / DURATION, 0, 1))`, in rendered px. */
export function mushroomSquashDip(state: MushroomSquashState): number {
  const ratio = clamp01(state.elapsed / MUSHROOM_SQUASH_DURATION_SECONDS);
  return MUSHROOM_SQUASH_DIP_PX * (1 - ratio);
}

/** The dip for `(col, row)`, or 0 when that cap is not squashing. */
export function mushroomSquashDipAt(
  states: readonly MushroomSquashState[],
  col: number,
  row: number,
): number {
  const state = states.find((entry) => entry.col === col && entry.row === row);
  return state ? mushroomSquashDip(state) : 0;
}
