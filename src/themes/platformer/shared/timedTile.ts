/**
 * The shared timed-tile core (R-004 US2/FR-008): the arm / advance /
 * elapsed-lookup / shake scaffolding the bouncy-mushroom squash, the floor
 * spike, the crumbling floor, and the falling stalactite each used to
 * re-implement. A pure leaf — it imports only `shared/math.ts` — so both
 * `engine/` and `entities/hazards/` may consume it without widening any
 * cross-folder edge.
 *
 * The core is parameterized purely by the caller's key accessor (grid position
 * or id — composite keys compared structurally), duration, prune policy, and
 * re-arm policy; each kind keeps only its durations and phase/offset mapping.
 */
import { shakeOffsetX } from './math';

/**
 * The neutral, dependency-free grid-timer shape (`{ col, row, elapsed }`) the
 * grid-keyed callers satisfy structurally. `entities/hazards/FallingStalactite`
 * types its `crumblingFloorStates` parameter against this, so the hazard move
 * adds no `entities/ → engine/CrumblingFloor` import.
 */
export interface GridTimerState {
  col: number;
  row: number;
  elapsed: number;
}

/** Per-caller configuration for the core. */
export interface TimedTileConfig<TState, K> {
  /** Key of an existing state entry. */
  keyOf: (state: TState) => K;
  /** Cycle length in seconds; entries at/after it are pruned when `prune` is true. */
  duration: number;
  /** `false` = never prune (the falling stalactite's `gone` persists). */
  prune: boolean;
  /** `'replace'` restarts an in-progress entry; `'noop'` leaves it running. */
  rearm: 'replace' | 'noop';
}

/** Structural equality for keys, so composite `{ col, row }` keys compare by value. */
export function timedTileKeysEqual<K>(a: K, b: K): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const aEntries = Object.keys(a as object);
  const bEntries = Object.keys(b as object);
  if (aEntries.length !== bEntries.length) return false;
  return aEntries.every((key) =>
    Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/** The state entry for a key, or `undefined` when absent. */
export function timedTileStateFor<TState, K>(
  states: readonly TState[],
  key: K,
  config: TimedTileConfig<TState, K>,
): TState | undefined {
  return states.find((state) => timedTileKeysEqual(config.keyOf(state), key));
}

/** Whether a key has a running entry at all (the trigger eligibility gate). */
export function timedTileHas<TState, K>(
  states: readonly TState[],
  key: K,
  config: TimedTileConfig<TState, K>,
): boolean {
  return timedTileStateFor(states, key, config) !== undefined;
}

/**
 * Arm the key's cycle per the re-arm policy, returning a new array. `'replace'`
 * restarts an in-progress entry (removed, then re-appended at elapsed 0);
 * `'noop'` leaves it untouched. An unarmed key is always appended.
 */
export function armTimedTile<TState, K>(
  states: readonly TState[],
  config: TimedTileConfig<TState, K>,
  armKey: K,
  makeState: (elapsed: number) => TState,
): TState[] {
  const existing = states.some((state) => timedTileKeysEqual(config.keyOf(state), armKey));
  if (!existing) return [...states, makeState(0)];
  if (config.rearm === 'noop') return [...states];
  return [
    ...states.filter((state) => !timedTileKeysEqual(config.keyOf(state), armKey)),
    makeState(0),
  ];
}

/**
 * Advance every entry by `dt` and prune per policy. `dt <= 0` leaves `elapsed`
 * unchanged yet still prunes already-expired entries (mushroom/spike/crumbling);
 * `prune: false` never prunes (stalactite).
 */
export function advanceTimedTiles<TState extends { elapsed: number }, K>(
  states: readonly TState[],
  dt: number,
  config: TimedTileConfig<TState, K>,
): TState[] {
  const next: TState[] = [];
  for (const state of states) {
    const elapsed = dt > 0 ? state.elapsed + dt : state.elapsed;
    if (!config.prune || elapsed < config.duration) {
      next.push({ ...state, elapsed });
    }
  }
  return next;
}

/** Raw elapsed for a key, or 0 when absent. */
export function timedTileElapsedFor<TState extends { elapsed: number }, K>(
  states: readonly TState[],
  key: K,
  config: TimedTileConfig<TState, K>,
): number {
  const state = timedTileStateFor(states, key, config);
  return state ? state.elapsed : 0;
}

/**
 * Deterministic horizontal shake, delegating to `shared/math.ts`'s
 * `shakeOffsetX`. The optional `window.until` gate returns 0 at/after that
 * elapsed time — the falling stalactite's shake-phase gate. No gate is applied
 * when omitted (the crumbling floor always shakes).
 */
export function timedTileShakeOffsetX(
  elapsed: number,
  amplitude: number,
  window?: { until: number },
): number {
  if (window && elapsed >= window.until) return 0;
  return shakeOffsetX(elapsed, amplitude);
}
