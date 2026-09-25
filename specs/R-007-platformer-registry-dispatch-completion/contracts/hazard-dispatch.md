# Contract — Hazard dispatch (`knocksBack`, `withTickState`, `armTriggerRects`)

Covers FR-005, FR-006, FR-007, FR-010, FR-013 and SC-003/SC-007/SC-008.

## Goal

A hazard kind's knockback decision, its per-tick state merge, and its arming-trigger detection all live
behind `HazardType` — so no engine layer branches on a hazard kind name, and a new hazard kind is one
module plus one registry line.

## `HazardType<S>` — `entities/hazards/HazardType.ts` (additions)

```ts
export interface HazardType<S> extends WorldType<S>, Boxed<S> {
  // ...existing key/damage/lethal?/isContact?/box/draw...
  /** Whether a qualifying non-lethal contact knocks the player back. `false`
   *  for the floor spike and falling stalactite; `true` for the spike and
   *  spear. Crouch suppression is player-side, NOT this flag. */
  knocksBack: boolean;
  /** Merges this kind's live per-tick state into the placement. Only stateful
   *  kinds implement it; every other kind passes through unchanged by omitting
   *  it. Reads only its parameters (no state import). */
  withTickState?(placement: HazardPlacement, timers: HazardTickContext): HazardPlacement;
  /** The player-overlap rects that arm this hazard, only when it is eligible
   *  to be newly armed. Present only on armed-then-cycle kinds; a static kind
   *  omits it. Reads only its parameters. */
  armTriggerRects?(hazard: HazardPlacement, timers: HazardTickContext): readonly Rect[];
}
```

## `HazardTickContext` — `entities/hazards/HazardType.ts` (caller-supplied bundle)

```ts
export interface HazardTickContext {
  floorSpikeTimers: readonly FloorSpikeTimerState[];
  fallingStalactiteTimers: readonly FallingStalactiteTimerState[];
  activeLevel: LevelDef;
  blockStates: readonly BlockPlacement[];
  crumblingFloorTimers: readonly GridTimerState[];   // dependency-free shape, not engine/CrumblingFloor
}
```

`crumblingFloorTimers` is typed against `shared/timedTile`'s `GridTimerState` (structurally what
`CrumblingFloorTimerState` satisfies), so `entities/hazards/` gains no `entities/ → engine/CrumblingFloor`
import (FR-013).

## Knockback decision (`PlatformerPage.tsx`)

```ts
if (!hazardTypeOf(hazard).knocksBack || playerState.value.crouching) {
  playerState.value = applyHitReaction(playerState.value);
} else {
  const knockbackDirection: -1 | 1 = contactSide === 1 ? -1 : 1;
  playerState.value = applyHitReaction(playerState.value, {
    direction: knockbackDirection,
    vx: PHYSICS_CONFIG.sideHitKnockbackVx,
    duration: PHYSICS_CONFIG.sideHitKnockbackDuration,
  });
}
```

The crouch term stays player-side and unchanged; `knocksBack: false` for floor spike/stalactite is the
separate hazard-side rule (FR-005 edge case).

## State merge (`PlatformerState.ts` `hazardPlacementsForTick`)

```ts
export function hazardPlacementsForTick(): HazardPlacement[] {
  const ctx: HazardTickContext = {
    floorSpikeTimers: floorSpikeTimerStates.value,
    fallingStalactiteTimers: fallingStalactiteTimerStates.value,
    activeLevel: activeLevel.value,
    blockStates: blockStates.value,
    crumblingFloorTimers: crumblingFloorTimerStates.value,
  };
  return hazardPlacements.value.map((hazard) =>
    hazardTypeOf(hazard).withTickState?.(hazard, ctx) ?? hazard,
  );
}
```

Per-kind merge (byte-identical to today's branches):

| Kind | `withTickState` merges |
| --- | --- |
| `floorSpike` | `floorSpikePhase` = `floorSpikePhaseFor(timers.floorSpikeTimers, id)`; `floorSpikeExtension` = `floorSpikeExtensionFor(...)` |
| `fallingStalactite` | `fallingStalactitePhase` = `fallingStalactitePhaseFor(timers.fallingStalactiteTimers, hazard, activeLevel, blockStates, crumblingFloorTimers)`; `OffsetY`/`ShakeOffsetX` from `elapsed` |
| `spike` / `spear` | *(pass through — omit `withTickState`)* |

## Arming detection (`engine/Collision.ts`)

```ts
export function checkHazardArmTriggers(
  player: PlayerState,
  hazards: readonly HazardPlacement[],
  ctx: HazardTickContext,
): string[];
```

Semantics: for each hazard, `hazardTypeOf(hazard).armTriggerRects?.(hazard, ctx)` (absent → skip); if
any rect overlaps `playerHitbox(player)`, push `hazard.id`. Detection uses **raw** `hazardPlacements`
(phase-unaware), exactly as the two replaced functions did.

Per-kind `armTriggerRects`:

| Kind | Returns |
| --- | --- |
| `floorSpike` | `[]` when `isFloorSpikeArmed(timers.floorSpikeTimers, id)`; else `[floorSpikeTriggerBox(hazard)]` (the trigger box, now owned by `FloorSpike.ts`) |
| `fallingStalactite` | `[]` when `isFallingStalactiteArmed(timers.fallingStalactiteTimers, id)`; else `detectionZoneCells(...)` mapped to tile rects |
| `spike` / `spear` | *(absent)* |

## Arming action (`PlatformerState.ts`)

```ts
export function armHazardTrigger(id: string): void;
```

Dispatches via `hazardTimerStores[hazard.hazardType]?.arm(id)` — a `Partial<Record<HazardKind,
{ arm(id): void }>>` whose `floorSpike`/`fallingStalactite` entries write their own timer signals.
Replaces `armFloorSpikeTrigger`/`armFallingStalactiteTrigger` (deleted).

## Invariants

1. **No engine kind branch** — `hazardPlacementsForTick`, `checkHazardArmTriggers`, and the page's
   damage block contain no `hazardType ===`/`!==`; knockback and merge come from `typeOf(hazard)`
   (FR-005/FR-006/SC-003).
2. **Byte-identical** — damage/lethality/knockback direction+magnitude, the crouch suppression, the
   merge output, and the arming eligibility (grounded overlap arms once; already-armed not re-eligible)
   are unchanged (FR-007/FR-010).
3. **No new `entities/ → state/` edge** — `withTickState`/`armTriggerRects` read parameters only; the
   timer bundle is caller-supplied (FR-013).
4. **One home** — `floorSpikeTriggerBox` moves into `FloorSpike.ts`; the removed trigger functions and
   arm wrappers have no shim/re-export (FR-012).
5. **Honest boundary** — a brand-new armed-then-cycle kind also declares its timer signal + a
   `hazardTimerStores` entry in `PlatformerState.ts` (where signals live); `Collision.ts`, the merge,
   and the page need no edit (SC-007).
