# Data Model — Platformer Registry Dispatch Completion (R-007)

Phase 1 output. This feature adds **no runtime data**: no JSON, level, marker, sprite, or
`localStorage` shape changes (spec Assumptions: "No data migration"). The "data model" here is the
**module and type structure** the refactor introduces or changes, organized by user story and by
concept.

Conventions (from [docs/Architecture.md](../../docs/Architecture.md) and the platformer's own
conventions): named exports, `PascalCase` for type-like modules, `camelCase` for function/registry
modules, `contracts/` is a strict leaf, and co-located `.test.ts` files.

---

## 1. Enemy defeat vocabulary (US1 — D2)

### `DefeatApi` — in `contracts/Outcome.ts` (CHANGED, leaf)

| Method | Purpose |
| --- | --- |
| `spawnPickup(kind: PickupKind): void` | Spawns a pickup at the enemy's position via `PICKUP_TYPES[kind].spawn` + the generic pickup store. |
| `revealFact(fact: CollectedFact, effectId: string): void` | Reveals one fact at the enemy's position (per-fact). |
| `bumpCounter(key: CounterPopupLabelKey): void` | Stages a transient popup bump; the applier dedupes by key and flushes after the flag update. |

Leaf-safe: imports only `../types` and sibling `contracts/` types (`PickupKind`, `CounterPopupLabelKey`).

### `EnemyType<S>` — `entities/enemies/EnemyType.ts` (CHANGED)

| Member | Change |
| --- | --- |
| ~~`ItemKind`~~ | **DELETED** (no alias — FR-012/SC-001). |
| `heldItem: PickupKind \| null` | Re-typed from `ItemKind \| null`; values unchanged (`slimePurple: 'key'`, others `null`). |
| `onDefeat?(enemy: S, defeat: DefeatApi): void` | **NEW, optional.** Fires the kind's defeat consequences through the API; present only on slimePurple/slimeGreen. |

Per-kind `onDefeat` (see [contracts/enemy-defeat.md](./contracts/enemy-defeat.md)):

| Kind | `onDefeat` |
| --- | --- |
| `slimePurple` | `if (slimePurple.heldItem) defeat.spawnPickup(slimePurple.heldItem)` |
| `slimeGreen` | reveal `enemy.fact` + `enemy.extraFacts` per-fact, then `defeat.bumpCounter('enemies')` |
| `bee` | *(absent — puff only, no reward/count)* |

### The shared applier — `state/enemyRewards.ts` (NEW)

| Export | Type | Purpose |
| --- | --- | --- |
| `EnemyDefeatContext` | `{ revealFact: (fact, RevealOptions) => boolean; originX: number; originY: number }` | The tick-scoped inputs (the tick's reveal trigger + camera origin). |
| `applyEnemyDefeats(defeated, ctx): void` | function | The single consumer of a defeated enemy: unconditional puff per death, `rewardGiven`/`deathEffectGiven` gating, invokes `onDefeat` once per fresh defeat, flushes staged bumps after the flag update. |

**Gating semantics (unchanged):** `rewardGiven` (permanent, one payout ever) and `deathEffectGiven`
(per-life, one puff, reset on revive) stay on `BaseEnemyState`; the applier owns both flags and the
unconditional puff, and invokes the hook only when `!rewardGiven`.

---

## 2. Hazard hooks (US2 — D3)

### `HazardTickContext` — in `entities/hazards/HazardType.ts` (NEW)

| Field | Type | Source (assembled in `hazardPlacementsForTick`) |
| --- | --- | --- |
| `floorSpikeTimers` | `readonly FloorSpikeTimerState[]` | `floorSpikeTimerStates.value` |
| `fallingStalactiteTimers` | `readonly FallingStalactiteTimerState[]` | `fallingStalactiteTimerStates.value` |
| `activeLevel` | `LevelDef` | `activeLevel.value` |
| `blockStates` | `readonly BlockPlacement[]` | `blockStates.value` |
| `crumblingFloorTimers` | `readonly GridTimerState[]` | `crumblingFloorTimerStates.value` (structurally `GridTimerState`) |

Typed against `GridTimerState` (not `engine/CrumblingFloor`'s `CrumblingFloorTimerState`) so the
hazard layer gains no `entities/ → engine/` import (matching `FallingStalactite.ts`'s existing choice).

### `HazardType<S>` — `entities/hazards/HazardType.ts` (CHANGED)

| Member | Change |
| --- | --- |
| `knocksBack: boolean` | **NEW, required.** `false` floorSpike/fallingStalactite, `true` spike/spear. |
| `withTickState?(placement, timers): HazardPlacement` | **NEW, optional.** Merges the kind's live per-tick state; absent = pass-through. |
| `armTriggerRects?(hazard, timers): readonly Rect[]` | **NEW, optional.** The arming-trigger rects; returns `[]` when armed; absent on static kinds. |

Per-kind values:

| Kind | `knocksBack` | `withTickState` | `armTriggerRects` |
| --- | --- | --- | --- |
| `spike` | `true` | — (pass-through) | — (static) |
| `spear` | `true` | — (pass-through) | — (static) |
| `floorSpike` | `false` | merge `floorSpikePhase`/`floorSpikeExtension` | `[floorSpikeTriggerBox]` when not armed |
| `fallingStalactite` | `false` | merge `fallingStalactitePhase`/`OffsetY`/`ShakeOffsetX` | `detectionZoneCells` → rects when not armed |

### Generic dispatch

| Function | Home | Replaces |
| --- | --- | --- |
| `hazardPlacementsForTick()` | `PlatformerState.ts` | its own per-kind branches → `hazardTypeOf(hazard).withTickState?.(hazard, ctx) ?? hazard` |
| `checkHazardArmTriggers(player, hazards, ctx): string[]` | `engine/Collision.ts` | `checkFloorSpikeTriggers` + `checkFallingStalactiteTriggers` + `floorSpikeTriggerBox` (all deleted) |
| `armHazardTrigger(id): void` | `PlatformerState.ts` | `armFloorSpikeTrigger` + `armFallingStalactiteTrigger` (both deleted), via `hazardTimerStores` |

### `hazardTimerStores` — `PlatformerState.ts` (NEW)

`Partial<Record<HazardKind, { arm(id): void }>>` with `floorSpike`/`fallingStalactite` entries writing
their own timer signals; the honest boundary for a brand-new armed-then-cycle kind (declares its signal
+ store entry where signals live).

---

## 4. Module map (created / changed / deleted)

- **Created:** `state/enemyRewards.ts` (the shared reward applier).
- **Changed (contracts):** `contracts/Outcome.ts` (adds `DefeatApi`).
- **Changed (entities):** `entities/enemies/EnemyType.ts` (delete `ItemKind`, re-type `heldItem`, add
  `onDefeat`), `entities/enemies/{SlimePurple,SlimeGreen}.ts` (add `onDefeat`),
  `entities/hazards/HazardType.ts` (`knocksBack`/`withTickState`/`armTriggerRects`/`HazardTickContext`),
  `entities/hazards/{Spike,Spear,FloorSpike,FallingStalactite}.ts` (`knocksBack`; FloorSpike/
  FallingStalactite add `withTickState` + `armTriggerRects`; `floorSpikeTriggerBox` moves into
  FloorSpike).
- **Changed (engine):** `engine/Collision.ts` (`checkHazardArmTriggers` replaces the two trigger fns +
  `floorSpikeTriggerBox`).
- **Changed (state):** `PlatformerState.ts` (generic `hazardPlacementsForTick`; `armHazardTrigger` +
  `hazardTimerStores`; drops six phase-helper imports).
- **Changed (page):** `PlatformerPage.tsx` (defeat block → `applyEnemyDefeats`; damage →
  `hazardTypeOf(hazard).knocksBack`; arming → `checkHazardArmTriggers` + `armHazardTrigger`; drops
  `spawnKeyPickup` import).
- **Deleted (symbols, no shim — FR-012):** `ItemKind`, `checkFloorSpikeTriggers`,
  `checkFallingStalactiteTriggers`, `armFloorSpikeTrigger`, `armFallingStalactiteTrigger`,
  `floorSpikeTriggerBox` (in `Collision.ts`).

---

## 5. Relationships

```
contracts/Outcome       ──adds──▶ DefeatApi (spawnPickup/revealFact/bumpCounter)
entities/enemies/EnemyType ──consumes──▶ DefeatApi, PickupKind, onDefeat?
entities/enemies/SlimePurple ──onDefeat──▶ defeat.spawnPickup(slimePurple.heldItem)
entities/enemies/SlimeGreen  ──onDefeat──▶ defeat.revealFact(…) + defeat.bumpCounter('enemies')
entities/hazards/HazardType  ──owns──▶ knocksBack, withTickState?, armTriggerRects?, HazardTickContext
entities/hazards/FloorSpike  ──implements──▶ withTickState + armTriggerRects (owns trigger box)
entities/hazards/FallingStalactite ──implements──▶ withTickState + armTriggerRects (detection zone)
state/enemyRewards    ──implements──▶ DefeatApi; drives applyEnemyDefeats (puff + gates + hooks)
engine/Collision      ──reads──▶ HAZARD_TYPES + armTriggerRects (checkHazardArmTriggers)
PlatformerState       ──provides──▶ HazardTickContext, hazardTimerStores, armHazardTrigger
PlatformerPage        ──drives──▶ applyEnemyDefeats, checkHazardArmTriggers, typeOf(hazard).knocksBack
```
