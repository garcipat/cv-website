import { clamp01 } from '../shared/math';
import {
  advanceTimedTiles,
  armTimedTile,
  timedTileElapsedFor,
  timedTileHas,
  timedTileShakeOffsetX,
  type TimedTileConfig,
} from '../shared/timedTile';

/**
 * A crumbling floor tile's cycle phase (spec.md's Key Entities). Unlike
 * `entities/hazards/FloorSpike.ts`'s timer states (keyed by a `HazardPlacement`'s own
 * `id`), a crumbling floor tile has no placement list of its own — it's a
 * plain terrain `TileType` — so its live state is keyed by grid position
 * directly, the same convention `engine/MushroomSquash.ts` uses for cap
 * dips. `'atRest'` has no tracked timer entry at all (state PRESENCE means
 * "cycle running", same as `FloorSpikeTimerState`); every other phase is a
 * pure function of elapsed time since arming.
 */
export type CrumblingFloorPhase = 'atRest' | 'cracking' | 'broken' | 'reforming';

/** Seconds a tile spends visibly cracking (light -> medium -> heavy) before
 *  it breaks (spec FR-004). Solid the entire time. */
export const CRUMBLING_FLOOR_CRACK_SECONDS = 0.9;
/** Seconds the tile stays a bare, non-solid gap before it starts reforming
 *  (spec FR-008's "fixed delay"). */
export const CRUMBLING_FLOOR_BROKEN_SECONDS = 1.5;
/** Seconds the grow-from-small-square reform animation takes (spec FR-009).
 *  Non-solid for the whole duration. */
export const CRUMBLING_FLOOR_REFORM_SECONDS = 0.4;
/** Total cycle length — once elapsed reaches this, the tile is at rest
 *  again and its timer entry is pruned (spec FR-010). */
export const CRUMBLING_FLOOR_CYCLE_SECONDS =
  CRUMBLING_FLOOR_CRACK_SECONDS + CRUMBLING_FLOOR_BROKEN_SECONDS + CRUMBLING_FLOOR_REFORM_SECONDS;

/** One crumbling floor tile's live timer, keyed by grid position. Presence
 *  in the states array means its cycle is running. */
export interface CrumblingFloorTimerState {
  col: number;
  row: number;
  /** Seconds since this tile was first stepped on. */
  elapsed: number;
}

interface GridKey {
  col: number;
  row: number;
}

const CONFIG: TimedTileConfig<CrumblingFloorTimerState, GridKey> = {
  keyOf: (state) => ({ col: state.col, row: state.row }),
  duration: CRUMBLING_FLOOR_CYCLE_SECONDS,
  prune: true,
  rearm: 'noop',
};

/** Arms `(col, row)`'s cycle if it isn't already running — a no-op
 *  re-contact during an in-progress cycle (spec FR-007), same shape as
 *  `entities/hazards/FloorSpike.ts`'s `armFloorSpike`. */
export function armCrumblingFloor(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): CrumblingFloorTimerState[] {
  return armTimedTile(states, CONFIG, { col, row }, () => ({ col, row, elapsed: 0 }));
}

/** Advances every running cycle by `dt` and drops any that reached the full
 *  cycle duration — the tile is at rest again the instant it's dropped
 *  (spec FR-010). `dt <= 0` leaves elapsed unchanged but still prunes
 *  already-expired entries. */
export function advanceCrumblingFloors(
  states: readonly CrumblingFloorTimerState[],
  dt: number,
): CrumblingFloorTimerState[] {
  return advanceTimedTiles(states, dt, CONFIG);
}

/** Pure elapsed-time -> phase mapping. `'atRest'` is never returned here —
 *  it only applies when no timer entry exists at all (see
 *  `crumblingFloorPhaseFor`), since a running cycle starts already
 *  `'cracking'` the instant it's armed. */
export function crumblingFloorPhaseAt(elapsed: number): CrumblingFloorPhase {
  if (elapsed < CRUMBLING_FLOOR_CRACK_SECONDS) return 'cracking';
  if (elapsed < CRUMBLING_FLOOR_CRACK_SECONDS + CRUMBLING_FLOOR_BROKEN_SECONDS) return 'broken';
  return 'reforming';
}

/** `(col, row)`'s current phase — `'atRest'` when no timer entry exists. */
export function crumblingFloorPhaseFor(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): CrumblingFloorPhase {
  const state = states.find((entry) => entry.col === col && entry.row === row);
  return state ? crumblingFloorPhaseAt(state.elapsed) : 'atRest';
}

/** `(col, row)`'s raw elapsed time since arming — 0 when no timer entry
 *  exists. Unlike the ratio/phase accessors, this is seconds, not a
 *  normalized [0,1] value; the draw's shake jitter needs the real
 *  elapsed time since `crumblingFloorShakeOffsetXAt` is tuned in seconds
 *  (see its own doc comment), not a phase-relative ratio. */
export function crumblingFloorElapsedFor(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): number {
  return timedTileElapsedFor(states, { col, row }, CONFIG);
}

/** Whether `(col, row)` has a running cycle at all — the eligibility gate
 *  for trigger detection (only an unarmed tile can start a new cycle). */
export function isCrumblingFloorArmed(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): boolean {
  return timedTileHas(states, { col, row }, CONFIG);
}

/** Whether a phase is solid ground (spec's Key Entities: at-rest and
 *  cracking are solid; broken and reforming are not). */
export function isCrumblingFloorSolidPhase(phase: CrumblingFloorPhase): boolean {
  return phase === 'atRest' || phase === 'cracking';
}

/** Whether `(col, row)` is CURRENTLY non-solid — covers both the broken gap
 *  and the still-growing reform, since both are non-solid per spec FR-009.
 *  This is the one predicate `engine/Physics.ts` actually consults. */
export function isCrumblingFloorBroken(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): boolean {
  return !isCrumblingFloorSolidPhase(crumblingFloorPhaseFor(states, col, row));
}

/** How far through the cracking phase `elapsed` is, from 0 (just armed, no
 *  cracks) to 1 (fully cracked, about to break) — `entities`-side rendering
 *  uses this to pick between the 3 crack frames. Clamped to [0, 1] so a
 *  broken/reforming elapsed value (past the crack phase) still returns a
 *  sane value rather than growing unbounded. */
export function crumblingFloorCrackRatioAt(elapsed: number): number {
  return clamp01(elapsed / CRUMBLING_FLOOR_CRACK_SECONDS);
}

/** `(col, row)`'s current crack ratio — 0 when no timer entry exists (at
 *  rest, no cracks). */
export function crumblingFloorCrackRatioFor(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): number {
  const state = states.find((entry) => entry.col === col && entry.row === row);
  return state ? crumblingFloorCrackRatioAt(state.elapsed) : 0;
}

/** How far through the reform animation `elapsed` is, from 0 (just started
 *  reforming, a small square) to 1 (fully grown) — 0 for every elapsed value
 *  before reforming starts (cracking/broken read as "nothing to grow yet"),
 *  matching `entities/hazards/FloorSpike.ts`'s `floorSpikeExtensionAt` shape. */
export function crumblingFloorReformRatioAt(elapsed: number): number {
  const reformStart = CRUMBLING_FLOOR_CRACK_SECONDS + CRUMBLING_FLOOR_BROKEN_SECONDS;
  if (elapsed < reformStart) return 0;
  return clamp01((elapsed - reformStart) / CRUMBLING_FLOOR_REFORM_SECONDS);
}

/** `(col, row)`'s current reform ratio — 0 when no timer entry exists. */
export function crumblingFloorReformRatioFor(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): number {
  const state = states.find((entry) => entry.col === col && entry.row === row);
  return state ? crumblingFloorReformRatioAt(state.elapsed) : 0;
}

/** Small deterministic horizontal jitter (native px) for the shake tell
 *  during cracking (spec FR-004) — a sine wave rather than `Math.random()`
 *  so rendering stays a pure function of elapsed time, matching
 *  `Torch.ts`'s `torchFrameIndex` convention of deriving animation from the
 *  clock rather than mutable random state. Routes through the shared core's
 *  shake helper; the crumbling floor always shakes (no window gate). */
const SHAKE_AMPLITUDE_NATIVE_PX = 1;
export function crumblingFloorShakeOffsetXAt(elapsed: number): number {
  return timedTileShakeOffsetX(elapsed, SHAKE_AMPLITUDE_NATIVE_PX);
}
