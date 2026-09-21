/**
 * A floor spike's cycle phase (spec.md's Key Entities). `'atRest'` is the
 * only phase with no tracked timer entry at all — everything else is driven
 * by elapsed time since arming, same shape as `PlacedBomb.ts`'s
 * `fuseElapsed`. `'delay'` and `'atRest'` render identically (the ground
 * tell only) but are distinct states so a second contact during the delay
 * is a no-op rather than a fresh trigger (spec FR-008). `'fullExtend'`
 * covers both the spec's "full-extend" and "holding" phases — both are
 * hazardous and render identically, so nothing observable distinguishes
 * them (see this plan's Architecture Decisions §1).
 */
export type FloorSpikePhase = 'atRest' | 'delay' | 'warning' | 'fullExtend' | 'retracting';

/** Seconds between first contact and the warning pose appearing (FR-003/004). */
export const FLOOR_SPIKE_DELAY_SECONDS = 0.6;
/** Seconds the partial-rise warning pose is shown (FR-004). */
export const FLOOR_SPIKE_WARNING_SECONDS = 0.25;
/** Seconds the spike stays fully extended and hazardous (FR-005/FR-007). */
export const FLOOR_SPIKE_FULL_EXTEND_SECONDS = 0.6;
/** Seconds the retract animation takes before re-arming (FR-007/FR-009). */
export const FLOOR_SPIKE_RETRACT_SECONDS = 0.3;
/** Total cycle length — once elapsed reaches this, the tile is at rest again. */
export const FLOOR_SPIKE_CYCLE_SECONDS =
  FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS + FLOOR_SPIKE_FULL_EXTEND_SECONDS + FLOOR_SPIKE_RETRACT_SECONDS;

/** One floor spike's live timer. Presence in the states array means its
 *  cycle is running; absence means at rest and triggerable. */
export interface FloorSpikeTimerState {
  id: string;
  /** Seconds since this tile was armed. */
  elapsed: number;
}

/** Arms `id`'s cycle if it isn't already running — a no-op re-contact during
 *  an in-progress cycle (spec FR-008), matching `startMushroomSquash`'s
 *  "replace an in-progress entry" shape except here a running cycle is left
 *  untouched rather than restarted. */
export function armFloorSpike(
  states: readonly FloorSpikeTimerState[],
  id: string,
): FloorSpikeTimerState[] {
  if (states.some((state) => state.id === id)) return [...states];
  return [...states, { id, elapsed: 0 }];
}

/** Advances every running cycle by `dt` and drops any that reached the full
 *  cycle duration — the tile is at rest again the instant it's dropped
 *  (spec FR-009). `dt <= 0` leaves elapsed unchanged but still prunes
 *  already-expired entries, matching `advanceMushroomSquashes`. */
export function advanceFloorSpikes(
  states: readonly FloorSpikeTimerState[],
  dt: number,
): FloorSpikeTimerState[] {
  const next: FloorSpikeTimerState[] = [];
  for (const state of states) {
    const elapsed = dt > 0 ? state.elapsed + dt : state.elapsed;
    if (elapsed < FLOOR_SPIKE_CYCLE_SECONDS) next.push({ ...state, elapsed });
  }
  return next;
}

/** Pure elapsed-time → phase mapping, same technique as `bombFuseFrame`. */
export function floorSpikePhaseAt(elapsed: number): FloorSpikePhase {
  if (elapsed < FLOOR_SPIKE_DELAY_SECONDS) return 'delay';
  if (elapsed < FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS) return 'warning';
  if (elapsed < FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS + FLOOR_SPIKE_FULL_EXTEND_SECONDS) {
    return 'fullExtend';
  }
  return 'retracting';
}

/** `id`'s current phase — `'atRest'` when no timer entry exists for it. */
export function floorSpikePhaseFor(
  states: readonly FloorSpikeTimerState[],
  id: string,
): FloorSpikePhase {
  const state = states.find((entry) => entry.id === id);
  return state ? floorSpikePhaseAt(state.elapsed) : 'atRest';
}

/** Whether `id` has a running cycle at all — the eligibility gate for
 *  trigger detection (only an unarmed tile can start a new cycle). */
export function isFloorSpikeArmed(states: readonly FloorSpikeTimerState[], id: string): boolean {
  return states.some((state) => state.id === id);
}

/**
 * How far out the spike currently is, from 0 (flush with the ground) to 1
 * (fully extended) — the continuous counterpart to `floorSpikePhaseAt`'s
 * discrete phase name. `'atRest'`/`'delay'` are both 0 (nothing has started
 * rising yet — the delay phase shows a separate "armed" pose, not a
 * partially-risen spike); it rises linearly 0→1 across the warning phase,
 * holds at 1 through full-extend, then falls linearly 1→0 across retract.
 * `entities/hazards/FloorSpike.ts`'s `draw` uses this to crop a variable-
 * height slice of the spike art rather than picking between fixed poses.
 */
export function floorSpikeExtensionAt(elapsed: number): number {
  const warningStart = FLOOR_SPIKE_DELAY_SECONDS;
  const warningEnd = warningStart + FLOOR_SPIKE_WARNING_SECONDS;
  const fullExtendEnd = warningEnd + FLOOR_SPIKE_FULL_EXTEND_SECONDS;
  const retractEnd = fullExtendEnd + FLOOR_SPIKE_RETRACT_SECONDS;

  if (elapsed < warningStart) return 0;
  if (elapsed < warningEnd) return (elapsed - warningStart) / FLOOR_SPIKE_WARNING_SECONDS;
  if (elapsed < fullExtendEnd) return 1;
  if (elapsed < retractEnd) return 1 - (elapsed - fullExtendEnd) / FLOOR_SPIKE_RETRACT_SECONDS;
  return 0;
}

/** `id`'s current extension ratio — 0 when no timer entry exists for it
 *  (at rest, nothing rising). */
export function floorSpikeExtensionFor(states: readonly FloorSpikeTimerState[], id: string): number {
  const state = states.find((entry) => entry.id === id);
  return state ? floorSpikeExtensionAt(state.elapsed) : 0;
}
