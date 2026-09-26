import { clamp01 } from '../shared/math';
import {
  advanceTimedTiles,
  armTimedTile,
  timedTileStateFor,
  type TimedTileConfig,
} from '../shared/timedTile';
import {
  RENDER_SCALE,
  RENDERED_TILE_SIZE,
  TILE_SIZE,
  tileAt,
  verticalRunRole,
} from '../level/Terrain';
import type { VerticalRunRole } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import { isSolidTile } from './registry';
import type { TileDrawContext, TileModule, TileStateDescriptor } from './TileModule';

/**
 * `bouncyMushroom` — the red bouncy mushroom (`§`). Non-solid, non-climbable,
 * fogged; drawn in the terrain band. Owns the squash timer + cap-role art
 * relocated from `entities/blocks/Mushroom.ts` (US4/T038) and its cap
 * `standableAt` (US2/T015).
 *
 * ## The squash timer
 *
 * The transient cosmetic dip of a cap after a bounce — the only mutable state
 * the mushroom introduces, deliberately tiny and canvas-free: one
 * `{ col, row, elapsed }` entry per recently-bounced cap cell, advanced and
 * pruned by the game loop's playing tick. A landing on an already-mid-squash cap
 * restarts its entry rather than queueing a second (the core's
 * `rearm: 'replace'`). The dip is purely visual — it never affects collision,
 * standability or bounce strength.
 *
 * The arm/advance/prune scaffolding is delegated to `shared/timedTile.ts`; this
 * module keeps only its key shape, duration, and the dip formula.
 */

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

/** The squash dip for an elapsed time, in rendered px — the declared phase/offset mapping. */
function squashDipAtElapsed(elapsed: number): number {
  const ratio = clamp01(elapsed / MUSHROOM_SQUASH_DURATION_SECONDS);
  return MUSHROOM_SQUASH_DIP_PX * (1 - ratio);
}

/** `DIP * (1 - clamp(elapsed / DURATION, 0, 1))`, in rendered px. */
export function mushroomSquashDip(state: MushroomSquashState): number {
  return squashDipAtElapsed(state.elapsed);
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

/** The native-pixel crop of a mushroom art cell. */
export interface MushroomSprite {
  sx: number;
  sy: number;
}

/** The cap rows of an `only`/`top` mushroom cell (from `mushroom.png`'s 16px
 *  grid); rows 11-15 are the stem/connector. Only the cap sub-rect moves during
 *  the squash dip, so the split height lives here as the single source of truth
 *  the draw reads. */
export const MUSHROOM_CAP_SOURCE_HEIGHT = 11;

/**
 * The four art cells of a `bouncyMushroom` vertical run, from the red row of
 * `mushroom.png`. `middle` is the plain stalk and `bottom` is the stalk with its
 * flared foot — the one cross-row read, at (48, 16), whose cell holds only the
 * shared colour-neutral tan foot art. Addressed by sx/sy, never by frame index.
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

/**
 * Whether this cell is the standable, one-way ground cap of a `bouncyMushroom`
 * vertical run — true only for the run's topmost cell, and only when the cell
 * directly above it is not solid (FR-005/FR-006). The mushroom is never `solid`
 * (so it blocks nothing horizontally and nothing from below) and never
 * `climbable`; this is consulted as a one-way ground term. A cap with a solid
 * tile directly above has no room to land, so it is not standable — and
 * out-of-bounds above resolves to `'empty'` via `tileAt`, so a cap in the
 * level's top row is standable.
 */
function standableAt(level: LevelDef, col: number, row: number): boolean {
  const above = tileAt(level, col, row - 1);
  return (
    tileAt(level, col, row) === 'bouncyMushroom' && above !== 'bouncyMushroom' && !isSolidTile(above)
  );
}

/**
 * A vertical run reads as one mushroom: the cap-bearing roles split their sprite
 * into an unshifted stem/connector sub-rect and a cap sub-rect that dips on a
 * bounce; `middle`/`bottom` draw one whole role cell. `dip` is in rendered px
 * and is 0 with no active squash.
 */
function draw(rc: TileDrawContext): void {
  const { ctx, level, col, row, destX, destY, images, transient } = rc;
  const mushroom = images.mushroom;
  if (!mushroom) return;

  const role = verticalRunRole(level, col, row, 'bouncyMushroom');
  const entry = mushroomEntry(role);
  if (mushroomHasCap(role)) {
    const dip = mushroomSquashDipAt(transient.mushroomSquashes, col, row);
    const capH = MUSHROOM_CAP_SOURCE_HEIGHT;
    // Stem/connector first, unshifted, so only the cap moves.
    ctx.drawImage(
      mushroom, entry.sx, entry.sy + capH, TILE_SIZE, TILE_SIZE - capH,
      destX, destY + capH * RENDER_SCALE, RENDERED_TILE_SIZE, (TILE_SIZE - capH) * RENDER_SCALE,
    );
    // Cap, dipped.
    ctx.drawImage(
      mushroom, entry.sx, entry.sy, TILE_SIZE, capH,
      destX, destY + dip, RENDERED_TILE_SIZE, capH * RENDER_SCALE,
    );
  } else {
    ctx.drawImage(
      mushroom, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
      destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
    );
  }
}

/**
 * The bouncy mushroom's declared transient state (R-004 owns the lifecycle):
 * key shape, duration, prune/re-arm policy and the dip offset mapping. The
 * module never implements its own arm/advance/prune loop — `shared/timedTile.ts`
 * does, driven from `PlatformerState.ts`'s single signal/tick/reset.
 */
const STATE: TileStateDescriptor = {
  keyOf: (state) => ({ col: state.col, row: state.row }),
  duration: MUSHROOM_SQUASH_DURATION_SECONDS,
  prune: true,
  rearm: 'replace',
  phaseOf: squashDipAtElapsed,
};

export const bouncyMushroomModule = {
  char: '§',
  fogExempt: false,
  drawBand: 'terrain',
  standableAt,
  draw,
  state: STATE,
} as const satisfies TileModule;
