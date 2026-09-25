# Contract: Shared Timed-Tile Core

**Feature**: R-004 | **Module home**: `src/themes/platformer/shared/timedTile.ts`

A pure leaf (imports only `shared/math.ts`) consumed by `engine/MushroomSquash.ts`, `engine/CrumblingFloor.ts`, `entities/hazards/FloorSpike.ts`, and `entities/hazards/FallingStalactite.ts` (FR-008/FR-009).

---

## Configuration

```ts
export interface TimedTileConfig<TState, K> {
  /** Key of an existing state entry. */
  keyOf: (state: TState) => K;
  /** Key of an arm request (composite structural keys supported). */
  keyOfArm: (...armArgs: never[]) => K;
  /** Cycle length in seconds; entries at/after it are pruned when prune is true. */
  duration: number;
  /** false = never prune (falling stalactite's `gone` persists). */
  prune: boolean;
  /** 'replace' restarts an in-progress entry; 'noop' leaves it running. */
  rearm: 'replace' | 'noop';
}
```

`TState` is the caller's `{ ...key, elapsed }` shape (`MushroomSquashState`, `CrumblingFloorTimerState`, `FloorSpikeTimerState`, `FallingStalactiteTimerState`). Composite keys are compared structurally.

The core also exports the neutral, dependency-free grid-timer shape used where a caller needs a tile-timer parameter without importing another module:

```ts
/** A grid-keyed timer entry: the shared shape the four callers' states satisfy structurally. */
export interface GridTimerState {
  col: number;
  row: number;
  elapsed: number;
}
```

`entities/hazards/FallingStalactite.ts` types its `crumblingFloorStates` parameter as `readonly GridTimerState[]` (which `CrumblingFloorTimerState` satisfies structurally), so no `entities/ → engine/CrumblingFloor` import is added.

## Provided helpers

```ts
/** Arm the key's cycle per rearm policy; returns a new array. */
export function armTimedTile<TState, K>(
  states: readonly TState[],
  config: TimedTileConfig<TState, K>,
  armKey: K,
  makeState: (elapsed: number) => TState,
): TState[];

/** Advance every entry by dt; dt <= 0 leaves elapsed unchanged; prune per policy. */
export function advanceTimedTiles<TState, K>(
  states: readonly TState[],
  dt: number,
  config: TimedTileConfig<TState, K>,
): TState[];

/** Raw elapsed for a key, or 0 when absent. */
export function timedTileElapsedFor<TState, K>(
  states: readonly TState[],
  key: K,
  config: TimedTileConfig<TState, K>,
): number;

/** Deterministic horizontal shake; optional window gate (until, in seconds). */
export function timedTileShakeOffsetX(
  elapsed: number,
  amplitude: number,
  window?: { until: number },
): number;
```

The exact helper parameter shapes may be adapted to the four call sites, but must remain parameterized by key accessor, duration, prune policy, and re-arm policy.

## Guarantees (must not regress)

1. `dt <= 0` leaves `elapsed` unchanged yet still prunes already-expired entries (mushroom/spike/crumbling) — US2/edge case.
2. Stalactite advance never prunes (`gone` persists for the attempt) — US2-4.
3. Mushroom re-arm replaces an in-progress entry; spike/crumbling/stalactite re-arm is a no-op — US2-3.
4. Shake uses the shared `shakeOffsetX` formula and per-family amplitude; stalactite gating returns `0` outside its shake phase, crumbling-floor gating always shakes — US2-5.
5. The four modules keep only their durations, key shape, arm/prune semantics, and phase/offset mappings (FR-009/SC-004).

## Invariants

- No dependency on `engine/`, `entities/`, `level/`, `editor/`, or state — a strict leaf, so both `engine/` and `entities/hazards/` may import it without widening any cross-folder edge.
