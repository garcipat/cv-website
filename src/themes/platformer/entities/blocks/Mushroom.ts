/**
 * The bouncy-mushroom's own home: its grid-cell-keyed squash timer and the
 * mushroom-specific cap-role art helpers, kept together beside the mushroom
 * they serve and deliberately **not** registered in the transient effect
 * registry (R-005 US3/FR-010/D10).
 *
 * ## The squash timer
 *
 * The transient cosmetic dip of a bouncy mushroom's cap after a bounce. This
 * is the only mutable state the mushroom feature introduces, and it is
 * deliberately tiny and canvas-free: one `{ col, row, elapsed }` entry per
 * recently-bounced cap cell, advanced and pruned by the game loop's `playing`
 * tick. A landing on an already-mid-squash cap restarts its entry rather than
 * queueing a second one (the core's `rearm: 'replace'`). The dip is purely
 * visual — it never affects collision, standability or bounce strength.
 *
 * The arm/advance/prune scaffolding is delegated to `shared/timedTile.ts`; this
 * module keeps only its key shape, duration, and the dip formula.
 *
 * ## The cap-role art helpers
 *
 * Moved here from `engine/StaticObjectsCatalog.ts` so the mushroom's art and
 * its timer share one home. They use the local structural `MushroomSprite`
 * type rather than the catalog's `StaticObjectEntry` (which lives in
 * `engine/`), so this module introduces no `entities/ → engine/` import;
 * `VerticalRunRole` stays in `level/Terrain.ts`.
 */

import { clamp01 } from '../../shared/math';
import {
  advanceTimedTiles,
  armTimedTile,
  timedTileStateFor,
  type TimedTileConfig,
} from '../../shared/timedTile';
import type { VerticalRunRole } from '../../level/Terrain';

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

interface GridKey {
  col: number;
  row: number;
}

const CONFIG: TimedTileConfig<MushroomSquashState, GridKey> = {
  keyOf: (state) => ({ col: state.col, row: state.row }),
  duration: MUSHROOM_SQUASH_DURATION_SECONDS,
  prune: true,
  rearm: 'replace',
};

/** Adds a squash for the cell, replacing any in-progress one for it. */
export function startMushroomSquash(
  states: readonly MushroomSquashState[],
  col: number,
  row: number,
): MushroomSquashState[] {
  return armTimedTile(states, CONFIG, { col, row }, () => ({ col, row, elapsed: 0 }));
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
  return advanceTimedTiles(states, dt, CONFIG);
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
  const state = timedTileStateFor(states, { col, row }, CONFIG);
  return state ? mushroomSquashDip(state) : 0;
}

/** The native-pixel crop of a mushroom art cell (structural, local type —
 *  the catalog's `StaticObjectEntry` lives in `engine/` and is not imported
 *  here, so this module adds no `entities/ → engine/` edge). */
export interface MushroomSprite {
  sx: number;
  sy: number;
}

/** The cap rows of an `only`/`top` mushroom cell (from `mushroom.png`'s 16px
 *  grid); rows 11-15 are the stem/connector. Only the cap sub-rect moves during
 *  the squash dip, so the split height lives here as the single source of
 *  truth the renderer reads. */
export const MUSHROOM_CAP_SOURCE_HEIGHT = 11;

/**
 * The four art cells of a `bouncyMushroom` vertical run, from the red row of
 * `mushroom.png` (see `MUSHROOM_SHEET`). `middle` is the plain stalk and
 * `bottom` is the stalk with its flared foot — the one cross-row read, at
 * (48, 16), whose cell holds only the shared colour-neutral tan foot art (see
 * `sheets.ts`'s `MUSHROOM_SHEET` doc comment). Addressed by sx/sy, never by
 * frame index.
 */
const MUSHROOM_ROLE_ENTRIES: Record<VerticalRunRole, MushroomSprite> = {
  only: { sx: 0, sy: 0 },
  top: { sx: 16, sy: 0 },
  middle: { sx: 48, sy: 0 },
  bottom: { sx: 48, sy: 16 },
};

/** The sprite rect for a bouncy mushroom's run role. */
export function mushroomEntry(role: VerticalRunRole): MushroomSprite {
  return MUSHROOM_ROLE_ENTRIES[role];
}

/** Whether a run role carries a cap (`only`/`top`) and therefore needs the
 *  cap/stem split the squash dip animates. */
export function mushroomHasCap(role: VerticalRunRole): boolean {
  return role === 'only' || role === 'top';
}

/** The small decorative mushroom's fixed cell (col 2, row 0 of the red row of
 *  `mushroom.png`) — drawn whole, never split and never squashed. */
export const MUSHROOM_DECORATIVE_ENTRY: MushroomSprite = { sx: 32, sy: 0 };
