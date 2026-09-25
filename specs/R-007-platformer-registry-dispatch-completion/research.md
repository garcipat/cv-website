# Research — Platformer Registry Dispatch Completion (R-007)

Phase 0 output. Every "NEEDS CLARIFICATION" in the Technical Context is resolved here, and every
spec assumption that touches a concrete code shape is validated against the current source.

> Method note: findings below were produced by reading the actual `src/themes/platformer/` modules
> (not the analysis doc's line numbers, which drift). Where the spec's illustrative wording and the
> current source disagree, the discrepancy is called out and a resolution is recorded.

The spec's Assumptions fix the big decisions: `onDefeat` fires consequences through a supplied defeat
API (not a returned value); the shared reward applier lives beside `RewardReveal`; the hazard arming
trigger is part of D3 with an open shape; and `hazardPlacementsForTick` keeps its orchestration while
the merge moves behind the type. This document resolves the remaining *planning* decisions those
assumptions leave open (the `DefeatApi` surface, the shared applier's exact signature and ordering, the
`HazardTickContext` bundle, and the `armTriggerRects` hook shape).

---

## R1 — The `DefeatApi` lives in `contracts/Outcome.ts` as the promised "narrow WorldApi"

**Decision.** Add the defeat hook's world interface to `contracts/Outcome.ts` (no new file), exactly
where that module's doc comment already promises it ("Anything exotic goes through an
`onDefeat(entity, world)` style hook receiving a narrow WorldApi instead"):

```ts
import type { CollectedFact } from '../types';          // already imported
import type { PickupKind } from './PickupKind';          // already imported
import type { CounterPopupLabelKey } from './counters';  // already imported

/**
 * The narrow world interface a defeated enemy's `EnemyType.onDefeat` hook uses
 * to fire its consequences. Supplied by the shared reward applier
 * (`state/enemyRewards.ts`); the kind never writes engine state directly and
 * never returns a reward value — a defeat may fire several consequences (spawn
 * a pickup, reveal several facts, bump a counter) in one call, or none (the
 * bee). This is the `onDefeat(entity, world)` hook shape this file's own doc
 * comment reserves for anything beyond a handful of `RewardEffects` fields.
 */
export interface DefeatApi {
  /** Spawns a pickup of `kind` at the enemy's position (its `x`/`y` at the
   *  moment of defeat), routed through `PICKUP_TYPES[kind].spawn` + the
   *  generic pickup store — never a page-side `spawnKeyPickup` call. */
  spawnPickup(kind: PickupKind): void;
  /** Reveals one fact at the enemy's position. Per-fact: a kind that owns
   *  several facts (a green slime with `fact` + `extraFacts`) calls this once
   *  per fact. */
  revealFact(fact: CollectedFact, effectId: string): void;
  /** Requests a transient HUD counter popup for `key`. The applier dedupes by
   *  key and flushes after the `rewardGiven`/`deathEffectGiven` update, so
   *  several same-tick defeats bump a key exactly once (FR-004 edge case). */
  bumpCounter(key: CounterPopupLabelKey): void;
}
```

**Rationale.** `Outcome.ts` is the single home for the shared contact/hit vocabulary (R-002 FR-020
folded `Contact.ts` back in for exactly this reason), it already imports all three leaf types
`DefeatApi` needs, and its doc comment already names the `onDefeat(entity, world)` shape. `contracts/`
stays a strict leaf: `DefeatApi` imports only `../types` and two sibling `contracts/` modules. Putting
it in a new `contracts/Defeat.ts` was considered but rejected as a second home for vocabulary that
`Outcome.ts` already claims.

**TypeScript note (no `any`).** The interface is plain method syntax — the same bivariance reason
R-006 R6 gives for `PickupType<S>` — but here there is no generic widening: `DefeatApi` is
non-generic, implemented once by the state layer and consumed by `EnemyType<S>` hooks.

---

## R2 — `EnemyType` gains optional `onDefeat`; `ItemKind` is deleted; `heldItem` re-types to `PickupKind`

**Decision.** In `entities/enemies/EnemyType.ts`:

```ts
import type { PickupKind } from '../../contracts/PickupKind';
import type { DefeatApi } from '../../contracts/Outcome';
// ...
export type ItemKind = 'key';            // DELETED — no compatibility alias (FR-012)
// ...
  /** What a finishing stomp drops, or null for a type that carries a CV fact
   *  instead. Re-typed to `PickupKind`: the drop is fired from this kind's own
   *  `onDefeat` via `defeat.spawnPickup(<heldItem>)`. */
  heldItem: PickupKind | null;
  /**
   * Fires this kind's defeat consequences through the supplied `defeat` API.
   * Present only on kinds whose defeat produces consequences beyond the
   * generic puff (slimePurple drops its key; slimeGreen reveals facts and
   * bumps the enemies counter). Absent on the bee and any plain enemy. The
   * shared reward applier invokes it exactly once per fresh defeat (when
   * `rewardGiven` is false) and MUST NOT branch on `enemy.type`/`heldItem`
   * in the defeat flow.
   */
  onDefeat?(enemy: S, defeat: DefeatApi): void;
```

`heldItem` values are unchanged (`slimePurple` keeps `'key'`, `slimeGreen`/`bee` keep `null`); only the
type widens from `ItemKind | null` to `PickupKind | null`. `ItemKind` has no other importer (only
`EnemyType.ts` line 14 and its consumer at line 71) and must be deleted outright, not re-exported
(FR-012/SC-001).

**Rationale.** The spec fixes this: `heldItem` stays the visual/placement declaration (the purple slime
draws its held key until `rewardGiven`), and the drop fires from inside the kind's own `onDefeat`.
`heldItem` is a type-level field (not on `BaseEnemyState`), so a kind reads its *own* `heldItem` — see
R4 — rather than `enemy.heldItem`, which the state never carried.

**Ripple.** `entities/enemies/index.test.ts`'s "heldItem drop wiring" describe (asserts
`slimePurple.heldItem === 'key'`, `slimeGreen.heldItem === null`, and "heldItemOfKey is exactly the
slimePurple type") is re-expressed as `onDefeat` wiring (R4/R10) — the `heldItem === 'key'`/`null`
assertions stay, re-typed to `PickupKind`.

---

## R3 — The shared reward applier lives in `state/enemyRewards.ts` and owns puff + gating + the `DefeatApi`

**Decision.** New module `state/enemyRewards.ts`, a sibling of `rewards.ts` (which holds
`createRewardReveal`). It exports one function:

```ts
import type { EnemyState } from '../entities/enemies';
import { typeOf } from '../entities/enemies';
import { enemyEffectAnchor } from '../entities/Enemy';
import { startPuffEffect, startCounterPopup } from '../engine/effects';
import { PICKUP_TYPES } from '../entities/pickups';
import type { DefeatApi } from '../contracts/Outcome';
import type { RevealOptions } from './rewards';
import {
  enemyStates, pickupStores, enemiesDefeated, levelTotals, spawnEffect,
} from '../PlatformerState';
import type { CollectedFact } from '../types';
import type { CounterPopupLabelKey } from '../contracts/counters';

/** The tick-scoped inputs a defeat application needs from the page. */
export interface EnemyDefeatContext {
  /** This tick's fact-reveal trigger (RewardReveal), already bound to the
   *  tick's origin/canvas/journal/slot allocator. */
  revealFact: (fact: CollectedFact, options: RevealOptions) => boolean;
  /** Camera origin for the world-event puff (world → screen). */
  originX: number;
  originY: number;
}

export function applyEnemyDefeats(
  defeated: readonly EnemyState[],
  ctx: EnemyDefeatContext,
): void;
```

Semantics, preserving today's `PlatformerPage.tsx` defeat block byte-for-byte:

1. For each `enemy` in `defeated` (already `!alive && !deathEffectGiven`):
   - Always build the unconditional world-event puff
     `startPuffEffect(enemy.id, anchor.x + originX, anchor.y + originY, anchor.scale)` and stage it.
   - **Only when `!enemy.rewardGiven`** (fresh reward): build a `DefeatApi` closing over the enemy and
     invoke `typeOf(enemy).onDefeat?.(enemy, api)`. The api's three methods are:
     - `spawnPickup(kind)` → `pickupStores[kind].append(PICKUP_TYPES[kind].spawn({ id: enemy.id,
       x: enemy.x, y: enemy.y, fact: enemy.fact }))` (the `fact` is passed for generality; `Key.spawn`
       ignores it).
     - `revealFact(fact, effectId)` → `ctx.revealFact(fact, { x: enemy.x, y: enemy.y, effectId })`.
     - `bumpCounter(key)` → `bumps.add(key)` (staged, **not** emitted yet).
2. Set `rewardGiven: true` **and** `deathEffectGiven: true` on every `defeated` id (via
   `enemyStates.value = enemyStates.value.map(...)`) — exactly the current `processedIds` update.
3. **Flush the staged bumps** — for each `key`, `spawnEffect(startCounterPopup(key,
   enemiesDefeated.value, levelTotals.value[key]))`. Reading `enemiesDefeated.value` *after* step 2 is
   what includes this tick's own defeats in the numerator (see R5).
4. `spawnEffect` every staged puff.

The applier writes `enemyStates`/`spawnEffect` directly, matching `RewardReveal`'s established
"write signals directly" convention, so the page's defeat block collapses to:

```ts
const justDefeated = enemyStates.value.filter((e) => !e.alive && !e.deathEffectGiven);
if (justDefeated.length > 0) applyEnemyDefeats(justDefeated, { revealFact, originX, originY });
```

**Layer check.** `state/` already imports `entities/` and `engine/` (see `rewards.ts` importing
`CollectiblesSummary`, `JournalEntry`, `engine/effects`); `state/enemyRewards.ts` adds
`entities/enemies`, `entities/pickups`, `entities/Enemy`, `engine/effects`, and `PlatformerState`
— all downward/peer, none of R-001's forbidden edges (`contracts/` leaf, no `level/ → engine/`, no
`engine/ → state/`, no `entities/ → state/`).

**Alternatives considered.** (a) Returning a `RewardEffects`-like value from `onDefeat` — rejected by
the spec Assumption (a single return shape cannot express a variable-length fact reveal plus a
per-defeat counter bump). (b) Passing the `DefeatApi` a returned-value staging array — rejected: the
applier already stages the two side-effect kinds (puffs + bumps) it needs to defer; the hook fires
facts immediately through `revealFact` exactly as today, which is what keeps the reveal order
identical. (c) Putting the applier in `PlatformerPage.tsx` — rejected: the page is the one caller that
must lose every enemy/drop kind name, and the applier is state/`RewardReveal`-adjacent by the spec.

---

## R4 — Per-kind `onDefeat` implementations

**Decision.** Two kinds gain `onDefeat`; the bee and any plain enemy omit it.

`entities/enemies/SlimePurple.ts`:

```ts
heldItem: 'key',          // re-typed PickupKind — value unchanged
// ...
onDefeat: (_enemy, defeat) => {
  // The drop fires from inside the kind: read its OWN heldItem and ask the
  // defeat API to spawn it through PICKUP_TYPES['key'].spawn (FR-002).
  const item = slimePurple.heldItem;
  if (item) defeat.spawnPickup(item);
},
```

`entities/enemies/SlimeGreen.ts` (adds a `CollectedFact` type import):

```ts
onDefeat: (enemy, defeat) => {
  const facts = [enemy.fact, ...(enemy.extraFacts ?? [])].filter(
    (fact): fact is CollectedFact => fact !== undefined,
  );
  // Reveal per-fact (effectId unique per fact, not per enemy), then bump the
  // enemies popup once per defeated slime (per-defeat, not per-fact).
  facts.forEach((fact, index) => defeat.revealFact(fact, `${enemy.id}-${index}`));
  defeat.bumpCounter('enemies');
},
```

This reproduces the current page block's `[enemy.fact, ...(enemy.extraFacts ?? [])]` filter, its
`effectId: `${enemy.id}-${index}`` convention, and the `greenDefeatedThisTick` bump — with the
per-fact reveal and the per-defeat bump now expressed as the two `DefeatApi` methods (spec edge case:
"facts reveal per-fact; the enemies popup bumps per defeated slime").

**The bee** (`Bee.ts`) keeps no `onDefeat` — it earns its puff and rewards/counts nothing (FR-004/SC).

---

## R5 — The "bump once per tick" and numerator-after-flag-set ordering are preserved

**Decision.** The current code bumps the enemies popup exactly once per tick *after* the
`rewardGiven` update, reading `enemiesDefeated.value` (a `computed` off `enemyStates`) so this tick's
defeats are included. The applier preserves this by (a) staging `bumpCounter(key)` into a per-tick
`Set<CounterPopupLabelKey>` during the loop and (b) flushing it in step 3 of R3, *after* the
`rewardGiven`/`deathEffectGiven` map. A green slime defeated alongside a second green slime (or a bee)
still yields exactly one `'enemies'` popup with the tick-final numerator.

**Honest boundary (recorded).** The applier's flush computes the numerator as `enemiesDefeated.value`
for every staged key. This is exact today because the only key an enemy `onDefeat` bumps is `'enemies'`
and `enemiesDefeated` *is* the enemies numerator. A future enemy that bumped a *different* counter
would need the applier to learn that counter's numerator — out of scope.

---

## R6 — `HazardType.knocksBack` replaces the page's per-kind knockback branch

**Decision.** In `entities/hazards/HazardType.ts`, add a required field:

```ts
  /** Whether a qualifying non-lethal contact knocks the player back. `false`
   *  for the floor spike and falling stalactite (half-heart, no knockback);
   *  `true` for the spike and spear. The crouch suppression is player-side and
   *  is NOT this flag — a crouched hit never knocks back regardless. */
  knocksBack: boolean;
```

Per-kind values: `floorSpike: false`, `fallingStalactite: false`, `spike: true`, `spear: true`. The
page's damage block (currently `hazard.hazardType === 'floorSpike' || 'fallingStalactite' ||
crouching`) becomes:

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

`hazard` here is the `resolveHazardContacts` result (a merged `HazardPlacement`), so `hazardTypeOf`
(the hazards `typeOf`, imported with that alias the way `Collision.ts` already does) resolves its kind.
The crouch term stays player-side and unchanged (FR-005 edge case: "the crouch suppression is
player-side, not hazard-side").

---

## R7 — `HazardType.withTickState(placement, timers)` with a caller-supplied `HazardTickContext`

**Decision.** In `entities/hazards/HazardType.ts`, define the context bundle and the optional hook:

```ts
import type { LevelDef } from '../../level/LevelData';
import type { BlockPlacement } from '../../level/BlockMapper';
import type { GridTimerState } from '../../shared/timedTile';
import type { FloorSpikeTimerState } from './FloorSpike';
import type { FallingStalactiteTimerState } from './FallingStalactite';
import type { HazardPlacement } from '../../level/HazardMapper';

/** The caller-supplied inputs a stateful hazard kind reads to merge its live
 *  per-tick state. Assembled once per tick by `hazardPlacementsForTick()` and
 *  passed as a parameter, so the hook reads no state directly (no new
 *  `entities/ → state/` edge). `crumblingFloorTimers` is typed against the
 *  dependency-free `GridTimerState` shape so this module gains no
 *  `entities/ → engine/CrumblingFloor` import. */
export interface HazardTickContext {
  floorSpikeTimers: readonly FloorSpikeTimerState[];
  fallingStalactiteTimers: readonly FallingStalactiteTimerState[];
  activeLevel: LevelDef;
  blockStates: readonly BlockPlacement[];
  crumblingFloorTimers: readonly GridTimerState[];
}
```

and on `HazardType<S>`:

```ts
  /** Merges this kind's live per-tick state into the placement, returning a
   *  new placement. Only stateful kinds implement it (floor spike:
   *  phase/extension; falling stalactite: phase/offset/shake); every other
   *  kind passes through unchanged by omitting it (`?? placement`). */
  withTickState?(placement: HazardPlacement, timers: HazardTickContext): HazardPlacement;
```

`hazardPlacementsForTick()` in `PlatformerState.ts` keeps its orchestration but loses every kind
branch:

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

`FloorSpike.ts` implements `withTickState` merging `floorSpikePhaseFor`/`floorSpikeExtensionFor`; the
`FallingStalactite.ts` merges `fallingStalactitePhaseFor`/`fallingStalactiteOffsetYAt`/
`fallingStalactiteShakeOffsetXAt`. The six phase/offset helpers move *into* those modules' own
`withTickState` (they already live there; `PlatformerState.ts` just stops importing them), leaving the
state layer importing only `hazardTypeOf`. The merged output is byte-identical to today (R7's hook
bodies are the exact current branch bodies).

**Layer check (FR-013).** `HazardTickContext` references only `level/` types (`LevelDef`,
`BlockPlacement`), `shared/timedTile` (`GridTimerState`), and sibling hazard timer types — all
`entities/`-downward. No `entities/ → state/` edge is introduced: the hook reads its parameters only.

---

## R8 — `HazardType.armTriggerRects?` + one generic `checkHazardArmTriggers`

**Decision.** The arming *detection* becomes kind-owned. On `HazardType<S>`:

```ts
  /** The player-overlap rects (world space) that arm this hazard, returned
   *  only when the hazard is eligible to be newly armed (not already armed).
   *  Present only on armed-then-cycle kinds (floor spike: its trigger band;
   *  falling stalactite: its detection-zone cells as rects); a static kind
   *  (spike/spear) omits it. The engine overlaps the player's hitbox against
   *  each rect and arms the hazard once. */
  armTriggerRects?(hazard: HazardPlacement, timers: HazardTickContext): readonly Rect[];
```

`Collision.ts` deletes `checkFloorSpikeTriggers`, `checkFallingStalactiteTriggers`, and the private
`floorSpikeTriggerBox`, and gains one generic function:

```ts
export function checkHazardArmTriggers(
  player: PlayerState,
  hazards: readonly HazardPlacement[],
  ctx: HazardTickContext,
): string[] {
  const playerBox = playerHitbox(player);
  const ids: string[] = [];
  for (const hazard of hazards) {
    const rects = hazardTypeOf(hazard).armTriggerRects?.(hazard, ctx);
    if (!rects) continue;
    if (rects.some((rect) => aabbOverlap(playerBox, rect))) ids.push(hazard.id);
  }
  return ids;
}
```

`FloorSpike.ts`'s hook returns `[]` when `isFloorSpikeArmed(ctx.floorSpikeTimers, hazard.id)` else
`[floorSpikeTriggerBox(hazard)]` (the box moves from `Collision.ts` into `FloorSpike.ts`, keeping its
"TRIGGER box, not the phase-varying damage box" doc). `FallingStalactite.ts`'s hook returns `[]` when
`isFallingStalactiteArmed(ctx.fallingStalactiteTimers, hazard.id)` else
`detectionZoneCells(hazard, ctx.activeLevel, ctx.blockStates, ctx.crumblingFloorTimers).map(cell => ({
x: cell.col * RENDERED_TILE_SIZE, y: cell.row * RENDERED_TILE_SIZE, width: RENDERED_TILE_SIZE,
height: RENDERED_TILE_SIZE }))`.

**Byte-identical check.** `checkFloorSpikeTriggers` was `overlappingTriggers(player, hazards,
floorSpikeTriggerBox, eligible)` = `aabbOverlap(hitbox, box) && eligible` per item; the generic form
is `rects.some(aabbOverlap)`, where `rects` is `[]` when ineligible and `[box]` when eligible —
identical. `checkFallingStalactiteTriggers` did `zone.some(cell => aabbOverlap(hitbox, cellRect))` per
non-armed stalactite; the generic form is the same `rects.some(aabbOverlap)` over the same rects.
Order is preserved (both iterated `hazards` in array order). No explicit `grounded` check existed in
either function, and none is added.

---

## R9 — A generic `armHazardTrigger` via a `hazardTimerStores` registry (the honest boundary)

**Decision.** Because the arming *action* writes kind-specific timer signals (which live in
`PlatformerState`, where `entities/` must not reach), the state layer keeps a tiny data-driven store
registry and a single `armHazardTrigger(id)`, replacing `armFloorSpikeTrigger`/`armFallingStalactiteTrigger`
at the page's call sites:

```ts
interface HazardTimerStore { arm(id: string): void }

const hazardTimerStores: Partial<Record<HazardKind, HazardTimerStore>> = {
  floorSpike: {
    arm: (id) => { floorSpikeTimerStates.value = armFloorSpike(floorSpikeTimerStates.value, id); },
  },
  fallingStalactite: {
    arm: (id) => { fallingStalactiteTimerStates.value = armFallingStalactite(fallingStalactiteTimerStates.value, id); },
  },
};

export function armHazardTrigger(id: string): void {
  const hazard = hazardPlacements.value.find((h) => h.id === id);
  if (!hazard) return;
  hazardTimerStores[hazard.hazardType]?.arm(id);
}
```

The page's two arming loops collapse to one:

```ts
for (const id of checkHazardArmTriggers(playerState.value, hazardPlacements.value, hazardTickContext)) {
  armHazardTrigger(id);
}
```

(where `hazardTickContext` is the same bundle the page already builds for the merge — see R7 — built
once and shared; it is *raw* `hazardPlacements.value`, not `hazardPlacementsForTick()`, matching
today's trigger calls).

**Honest boundary (FR-007/SC-007).** A *brand-new* armed-then-cycle hazard kind still declares its
timer signal and a `hazardTimerStores` entry in `PlatformerState.ts` (where signals live), exactly as
R-006 R9 records for a new pickup *family*. The detection (`Collision.ts`), the merge
(`hazardPlacementsForTick`), and the damage/knockback (`PlatformerPage.tsx`) need **no** edit — which
is the SC-007 "one module + one registry line" guarantee, stated against the three layers the issue
names. `armFloorSpikeTrigger`/`armFallingStalactiteTrigger` are **deleted** (no shim — FR-012), with
their bodies moved into `hazardTimerStores`.

---

## R12 — Layer and constitution re-check

- `contracts/Outcome.ts` gains `DefeatApi` using only already-imported `../types` + sibling
  `contracts/` types — `contracts/` stays a strict leaf (FR-013/SC-008).
- No new `level/ → engine/` edge: `HazardTickContext` (`entities/hazards/`) imports `level/LevelData`/
  `level/BlockMapper` downward, the pre-existing `level/ → entities/` hazard-phase direction.
- No new `engine/ → state/` edge: `checkHazardArmTriggers` takes `hazards` + `HazardTickContext` as
  parameters; the state layer supplies them.
- No new `entities/ → state/` edge: `withTickState`/`armTriggerRects` read their parameters only; the
  `DefeatApi` is implemented in `state/`, not `entities/`.
- FR-010 behaviour preservation holds: the reward gates (`rewardGiven`/`deathEffectGiven`), the
  per-tick vs per-fact counter bump, the crouch suppression, and the knockback magnitude/direction are
  unchanged in value and observable effect.
- SC-001/SC-002/SC-003 hold: no `ItemKind` symbol; the page's defeat block has no
  `heldItem === 'key'` / `enemy.type === 'slimeGreen'` / `spawnKeyPickup`; `hazardPlacementsForTick`,
  `Collision.ts`'s trigger function, and the page's damage block have no `hazardType ===`/`!==`.
- Post-Phase-1 Constitution Check: **PASS** (Principles I–V; no violation, no complexity exception).

## R13 — Out of scope (unchanged plan)

The generic speech bubble / mushroom-squash-as-effect (R-005); pickup unification (R-006, shipped);
placeable world items / bomb subsystem (R-008); the Renderer split (R-009); mapper/editor unification
(R-010); player damage/bomb domain stores (R-011/R-012); sprite atlas (R-013); layer-boundary lint
(R-014); the tile-module registry (R-015); the broader grid-object/actor split (§3.5). The counter-metadata
refactor (analysis D4) is **dropped** from R-007 — the static totals stay hardcoded. R-007 folds each
touched family's kind-specific knowledge into its registry but introduces no shared `GridObject`
interface.
