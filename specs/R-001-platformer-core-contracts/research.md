# Phase 0 Research — Platformer Core Contracts & Dependency Layers

**Feature**: R-001 | **Date**: 2026-09-24 | **Plan**: [plan.md](./plan.md)

The spec's clarification session already settled the high-level placements
(`contracts/` name, torch → `entities/Torch.ts`, hazard phases → `entities/hazards/`,
`PhysicsConfig` → `contracts/`). This document resolves the remaining technical
unknowns: how to keep `contracts/` a strict leaf when its contracts reference
higher-layer types, where each referenced vocabulary lands, the exact module
homes, and how the change is verified.

---

## 1. How `contracts/` stays a strict leaf (FR-002 / FR-003)

`FR-002` forbids any `contracts/ → engine|entities|level|state|app` import, including
type-only imports. Two moving contracts reference types owned by higher layers:

- `DrawContext` references `SpriteLookup` (sprite layer) and `PotRenderPlan` (block layer).
- `Outcome` references `PickupKind` (pickup vocabulary), `CounterPopupLabelKey` (counter vocabulary), and `CollectedFact` (shared `types.ts`).

`CollectedFact` is legal as-is: `FR-002` explicitly permits depending on the
shared top-level `types.ts` (`../types`). That module's own `import type {
EnemyTypeKey }` from `entities/enemies` is erased at build time and is the
sanctioned shared-type edge, not a new one. The other four referenced types are
resolved below.

| Referenced type          | Owner today                       | Resolution                                                                                                  | FR-003 path          |
| ------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------- |
| `SpriteLookup`           | `entities/sprites/SpriteSheet.ts` | Move to `contracts/SpriteLookup.ts`; `SpriteSheet.ts` and consumers import it from contracts                          | Move into `contracts/`    |
| `PickupKind`             | `entities/pickups/index.ts`       | Move the union to `contracts/PickupKind.ts`; the registry `satisfies Record<PickupKind, unknown>` for conformance | Move into `contracts/`    |
| `CounterPopupLabelKey`   | `engine/CollectionEffects.ts`     | Move with `CounterKey` to `contracts/counters.ts`                                                                | Move into `contracts/`    |
| `PotRenderPlan`          | `entities/blocks/potTypes.ts`     | Decouple: `DrawContext<TPotPlan = unknown>`; the block layer specializes to `DrawContext<PotRenderPlan>`     | Decouple             |

### Decision 1a — `SpriteLookup` moves to contracts

**Decision**: `SpriteLookup` (`Record<string, HTMLImageElement | null>`) is
extracted from `entities/sprites/SpriteSheet.ts` into `contracts/SpriteLookup.ts`.
`DrawContext` imports it from `./SpriteLookup`; `PlatformerPage.tsx` and the
sprite layer import it from `contracts/`.

**Rationale**: It is a zero-dependency type that is part of the draw contract
and belongs below the sprite layer.

**Alternatives considered**: Leaving it in `SpriteSheet.ts` and re-declaring a
duplicate in contracts — rejected (two homes); typing `sprites` as a raw
`Record<string, …>` inline in `DrawContext` — rejected (loses the named
contract and its documentation).

### Decision 1b — `PickupKind` vocabulary moves to contracts

**Decision**: The literal union `PickupKind` moves to `contracts/PickupKind.ts`.
`entities/pickups/index.ts` keeps `PICKUP_TYPES` and adds a `satisfies
Record<PickupKind, unknown>` clause so a kind added to one side without the other
fails to compile.

**Rationale**: `RewardEffects.spawnPickup` is the shared reward vocabulary, so
its key type must sit with it. The union is small and stable; R-006's pickup
*unification* (discriminators, generic collision/draw) is untouched.

**Alternatives considered**: Deriving the union from `PICKUP_TYPES` and having
contracts import it — rejected (upward edge); widening `spawnPickup` to `string` or
`unknown` — rejected (weakens the typed-data contract).

### Decision 1c — Counter vocabulary moves to contracts

**Decision**: `CounterKey` and `CounterPopupLabelKey` (derived as
`Exclude<CounterKey, 'chests'>`) move to `contracts/counters.ts`.
`entities/CollectiblesSummary.ts` imports `CounterKey` from contracts (its
`COUNTER_SECTIONS: Record<CounterKey, …>` keeps the registry exhaustive);
`engine/CollectionEffects.ts` imports `CounterPopupLabelKey` from contracts.

**Rationale**: `RewardEffects.counterKey` is shared reward vocabulary; the
counter keys are a small, fixed union the engine already treats as vocabulary.

**Alternatives considered**: Defining `CounterPopupLabelKey` inline in contracts
while keeping `CounterKey` in entities — rejected (the `Exclude` relationship
would no longer be enforced); re-exporting from `CollectionEffects` — rejected
(a legacy second path).

### Decision 1d — `PotRenderPlan` is decoupled from `DrawContext`, not moved

**Decision**: `contracts/DrawContext.ts` becomes generic:

```ts
export interface DrawContext<TPotPlan = unknown> {
  ctx: CanvasRenderingContext2D;
  sprites: SpriteLookup;
  originX: number;
  originY: number;
  worldElapsed: number;
  /** Block-layer detail carried through opaquely; defined in potTypes.ts. */
  potPlan?: TPotPlan;
}
```

The block layer specializes the type — `BlockType.draw`,
`PotKind.drawPot`, `drawPotBunch`, and `drawBlocks` use
`DrawContext<PotRenderPlan>`; `potTypes.ts` keeps owning the concrete
`PotRenderPlan`. The contracts layer never names it.

**Rationale**: `PotRenderPlan` transitively requires `BlockState` and `PotKind`,
which pull in `BLOCK_TYPES` and the entity mixins. Moving it into `contracts/` would
drag the whole block family down. A generic parameter carries the plan through
`DrawContext` opaquely while preserving full type safety at the one layer that
consumes it — no casts, no `any`. `DrawContext<PotRenderPlan>` is structurally
assignable to the `DrawContext` (default) used by every other entity family, so
call sites are unaffected. This is the single intentional shape change in a
moved contract (see SC-004 caveat below).

**Alternatives considered**: Typing the field `unknown` and casting inside
`drawPotBunch` — rejected (casts, weakens the block contract, and forces test
casts); importing `PotRenderPlan` into contracts — rejected (breaks FR-002/FR-003).

---

## 2. `level/` stops importing `engine/` (FR-005–FR-008)

Three leaked items, three retargets:

| Leak today                                        | New home                                    | Rationale                                                                                     |
| ------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `level/SignMapper.ts` → `engine/Collision` (`Box`) | `contracts/geometry.ts`                          | `Box` is a geometry primitive shared by engine and level (FR-005).                            |
| `level/LevelParser.ts` → `engine/Torch`            | `entities/Torch.ts`                 | The torch module moves whole; `level/` reaches it through `entities/` (FR-006).               |
| `level/HazardMapper.ts` → `engine/FloorSpike`, `engine/FallingStalactite` (phase types) | `entities/hazards/phases.ts` | Hazard kinds own their phases (FR-007).                                                        |

### Decision 2a — `Box` lives in `contracts/geometry.ts`

**Decision**: Move the `Box` interface out of `engine/Collision.ts` into
`contracts/geometry.ts`, keeping `Rect` as a distinct named interface. `Collision.ts`
imports `Box` from contracts; all importers (`Blast.ts`, `Crouch.ts`, `Checkpoint.ts`,
`SignMapper.ts`, and the tests) import from `contracts/geometry`. No re-export is left
in `Collision.ts`.

**Rationale**: Satisfies FR-005 and SC-002 (one home). `Box` and `Rect` are
structurally identical but carry different documentation; keeping both named
interfaces avoids a semantic rename (out of scope) and avoids touching the many
`Rect` importers.

**Alternatives considered**: Aliasing `Box = Rect` — rejected (loses the `Box`
doc/name and is a needless semantic merge); re-exporting from `Collision.ts` —
rejected (violates the acceptance scenario that importers resolve from contracts).

### Decision 2b — Torch module moves whole to `entities/Torch.ts`

**Decision**: `engine/Torch.ts` → `entities/Torch.ts`; `engine/Torch.test.ts`
→ `entities/Torch.test.ts`. The `TorchStrength` type moves from
`level/LevelData.ts` into the same module so the torch module is whole (FR-006).
`LevelData.ts` then imports `TorchStrength` from `entities/Torch`
(accepted `level/ → entities/` edge).

**Rationale**: FR-006 and the spec assumption require the type, constants,
frame animation, and validator to stay together. Putting `TorchStrength` in the
torch module removes its only `level/` dependency and makes the module
self-contained.

**Alternatives considered**: Leaving `TorchStrength` in `level/LevelData.ts` —
rejected (the module would not be "whole", and torch would still reach into
level); a `torches/` folder with a barrel — rejected (unnecessary for a single-file module).

### Decision 2c — Hazard phase vocabulary in `entities/hazards/phases.ts`

**Decision**: Extract `FloorSpikePhase`, `FloorSpikeTimerState`,
`FallingStalactitePhase`, and `FallingStalactiteTimerState` into a new
dependency-free module `entities/hazards/phases.ts`. `engine/FloorSpike.ts` and
`engine/FallingStalactite.ts` import them and keep all behaviour/constants;
`level/HazardMapper.ts` imports the phase types from `entities/hazards/phases`.

**Rationale**: FR-007 says the hazard kinds own their phases. A dedicated
type-only module avoids the module cycle that would arise from putting the type
directly in `entities/hazards/FloorSpike.ts` — that module imports
`HazardPlacement` from `level/HazardMapper`, which would then import back from
it. `phases.ts` imports nothing, so `level/ → entities/hazards/phases` is a clean
one-way edge.

**Alternatives considered**: Phase type inside the kind module and accept the
module cycle — rejected (reintroduces a cycle, the thing this feature removes);
keeping phases in `engine/` — rejected (FR-007).

---

## 3. `engine/` stops depending on application state (FR-009 / FR-010)

### Decision — `RewardReveal` moves to `state/rewards.ts`

**Decision**: `engine/RewardReveal.ts` → `state/rewards.ts` (new `state/`
folder); `engine/RewardReveal.test.ts` → `state/rewards.test.ts`.
`PlatformerPage.tsx` imports `createRewardReveal` from `./state/rewards`. The
file keeps its public surface (`RevealContext`, `RevealOptions`,
`createRewardReveal`) and its logic unchanged.

**Rationale**: The module writes `collectedFacts` / `activeEffects` /
`activeCounterPopups` / `levelTotals` — application state that owns those signals
— so it belongs in the state layer. The analysis doc proposed `state/rewards.ts`
or `features/rewards/`; `state/` is the smaller, earlier move and seeds the
`state/` folder the later D7 work grows.

**Alternatives considered**: `features/rewards/` — deferred (the `features/`
split is R-011, out of scope); inverting reveal into `RewardEffects` data —
rejected by the spec's clarification (overlaps R-007, more behavioural risk).

After this move, no module under `engine/` imports `PlatformerState` or any
state module (verified in quickstart).

---

## 4. Test relocation policy (FR-011 / SC-004)

**Decision**: Tests move with their module, **except** the two entity-conformance
tests, which stay in `entities/`:

- `engine/Outcome.test.ts` → `contracts/Outcome.test.ts` (imports only `Outcome`).
- `engine/Torch.test.ts` → `entities/Torch.test.ts`.
- `engine/RewardReveal.test.ts` → `state/rewards.test.ts`.
- `entities/WorldType.test.ts` **stays** — it asserts that every entry in the
  entity registries (`ENEMY_TYPES`, `PICKUP_TYPES`, `BLOCK_TYPES`, `CHEST_TYPE`)
  exposes `draw`/`box`; it never imports the moved `WorldType.ts`.
- `entities/capabilities.test.ts` **stays** — its first block asserts that
  `EnemyState` structurally satisfies the capability mixins, so it necessarily
  imports entity and level modules. Only its `./capabilities` import path
  changes to `../../contracts/capabilities`.

**Rationale**: SC-001 requires zero `contracts/ → higher` imports. Moving those two
conformance tests into `contracts/` would introduce exactly that violated edge (test
file or not). Keeping them in `entities/` preserves every assertion while keeping
`contracts/` clean.

**Alternatives considered**: Splitting `capabilities.test.ts` into a pure
`contracts/` half and an integration `entities/` half — rejected as extra churn with
no behaviour benefit; renaming the two conformance files — cosmetic, deferred to
opportunistic cleanup (F12).

No test is deleted, skipped, or weakened. Import paths only.

---

## 5. Verification approach

**Decision**: Verify with (a) the documented manual import inspection in
[quickstart.md](./quickstart.md) (the SC-001 check the clarification chose over a
new automated test), (b) the full existing test suite, (c) the production build,
and (d) a manual browser pass over a cave level (torches, floor spikes, falling
stalactites) plus at least one reward reveal (SC-003).

**Rationale**: The spec explicitly excludes an automated boundary test and
requires the browser check for a change with visible behaviour potential
(constitution's manual-check rule).

**Alternatives considered**: Adding an ESLint `no-restricted-imports` boundary
rule — attractive but out of scope per the clarification; can be a later
refactor.

---

## 6. Implications of moving `DrawContext`'s pot plan (SC-004 caveat)

SC-004 states moved contract module bodies are unchanged "apart from import
paths". There are two bounded exceptions: (1) `DrawContext` gains the `TPotPlan`
type parameter (required by FR-002/FR-003); and (2) three vocabularies
(`SpriteLookup`, `PickupKind`, counter keys) are extracted into their own
`contracts/` modules, so their former owner modules lose that declaration. The
field is still named `potPlan` and is
still optional; only its *type expression* becomes the parameter. Every existing
`DrawContext` construction and consumption keeps the same runtime shape. This is
recorded here so the SC-004 review has an explicit, bounded exception rather than
an unexplained diff.

---

## Summary of decisions

1. `contracts/` is a strict leaf; `SpriteLookup`, `PickupKind`, and the counter
   vocabulary move in; `PotRenderPlan` is decoupled via `DrawContext<TPotPlan>`.
2. `Box` → `contracts/geometry.ts`; torch module → `entities/Torch.ts` (with
   `TorchStrength`); hazard phases → `entities/hazards/phases.ts`.
3. `RewardReveal` → `state/rewards.ts`; no `engine/ → PlatformerState` edge remains.
4. Tests move with modules except the two entity-conformance tests, to preserve
   the `contracts/` leaf.
5. Verification is a documented manual import inspection plus suite, build, and
   browser pass.
