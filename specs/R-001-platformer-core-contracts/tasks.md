---
description: 'Task list for R-001 Platformer Core Contracts & Dependency Layers'
---

# Tasks: Platformer Core Contracts & Dependency Layers

**Input**: Design documents from `/specs/R-001-platformer-core-contracts/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/layer-boundaries.md, quickstart.md

**Tests**: No new tests are authored. The spec clarification excludes an automated boundary test, and
the constitution's Principle II is satisfied by the existing suite for this behaviour-preserving
refactor (FR-011). The ONLY test work is relocating the three tests that move with their module and
updating import paths — no test may be deleted, skipped, or weakened (I6).

**Organization**: Tasks are grouped by the three user stories from spec.md so each can be verified
against its own Independent Test. US1 (P1) is the foundation the other two build on.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names exact file paths

## Path Conventions

Single static SPA. All paths are under `src/themes/platformer/` unless stated otherwise.
Relative-import depth matters: `contracts/` is a sibling of `entities/`, `engine/`, `level/`, `editor/`,
`components/`; the platformer theme root files use `./`; and `contracts/` may import only itself and
`../types.ts`.

## Layer invariants (must hold at the end — FR-002/FR-008/FR-010)

- `contracts/**` imports only `contracts/**` and `../types` (no `import type` from higher folders).
- No `level/**` file imports `engine/**`.
- No `engine/**` file imports `PlatformerState` or any `state/**` module.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a green baseline and the new folders before any move.

- [X] T001 Verify a green baseline on the untouched tree: run `npm test`, `npm run build`, and `npm run lint` from the repo root and confirm all three pass. Do not start editing until they do.
- [X] T002 Create the new folders `src/themes/platformer/contracts/` and `src/themes/platformer/state/` (empty is fine; files land in later tasks).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The dependency-free leaf vocabulary modules that US1's contracts AND US2's `level/`
retargets both consume. None may import any higher layer.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `src/themes/platformer/contracts/SpriteLookup.ts` exporting `SpriteLookup` (`Record<string, HTMLImageElement | null>`), copied verbatim from the declaration in `src/themes/platformer/entities/sprites/SpriteSheet.ts` (FR-003).
- [X] T004 [P] Create `src/themes/platformer/contracts/PickupKind.ts` exporting the `PickupKind` **literal union written out explicitly** (the members currently produced by `keyof typeof PICKUP_TYPES` in `src/themes/platformer/entities/pickups/index.ts`); it must not import the registry (FR-003).
- [X] T005 [P] Create `src/themes/platformer/contracts/counters.ts` exporting `CounterKey` (copied verbatim from `src/themes/platformer/entities/CollectiblesSummary.ts`) and `CounterPopupLabelKey = Exclude<CounterKey, 'chests'>` (copied verbatim from `src/themes/platformer/engine/CollectionEffects.ts`) (FR-003).
- [X] T006 [P] Create `src/themes/platformer/contracts/geometry.ts` containing `Direction` and `Rect` copied verbatim from `src/themes/platformer/entities/geometry.ts`, plus the `Box` interface copied from `src/themes/platformer/engine/Collision.ts`. The old `Box` declaration in `engine/Collision.ts` stays until T029 deletes it, so `Box` temporarily has two homes through US1; its single-home invariant is established at T029 (FR-001/FR-005).

**Checkpoint**: Leaf contracts exist; `rg "from '" src/themes/platformer/contracts` names no other folder.

---

## Phase 3: User Story 1 - Shared contracts live in one bottom layer (Priority: P1) 🎯 MVP

**Goal**: Every shared contract (`WorldType`/`Boxed`, capability mixins, geometry, `Outcome`,
`Contact`, `DrawContext`, `PhysicsConfig`, plus the extracted `SpriteLookup`/`PickupKind`/counter
vocabulary) is exported from exactly one module under `contracts/`, and every importer points there.

**Independent Test**: Each contract family resolves to exactly one `contracts/` module; `contracts/`
imports nothing from `engine/`, `entities/`, `level/`, state, or app code (quickstart §1.1); and all
existing tests + the production build pass.

### Contract modules for US1

- [X] T007 [P] [US1] Create `src/themes/platformer/contracts/WorldType.ts` by moving `src/themes/platformer/entities/WorldType.ts` verbatim, changing its `Rect` import to `./geometry` and its `DrawContext` import to `./DrawContext` (FR-001).
- [X] T008 [P] [US1] Create `src/themes/platformer/contracts/capabilities.ts` by moving `src/themes/platformer/entities/capabilities.ts` verbatim, changing its `Direction` import to `./geometry` (FR-001).
- [X] T009 [P] [US1] Create `src/themes/platformer/contracts/Outcome.ts` by moving `src/themes/platformer/engine/Outcome.ts` verbatim, importing `PickupKind` from `./PickupKind`, `CounterPopupLabelKey` from `./counters`, and `CollectedFact` from `../types` (FR-001, FR-003).
- [X] T010 [P] [US1] Create `src/themes/platformer/contracts/Contact.ts` by moving `src/themes/platformer/engine/Contact.ts` verbatim, changing its `Rect` import to `./geometry` and its `PlayerEffects` import to `./Outcome` (FR-001).
- [X] T011 [P] [US1] Create `src/themes/platformer/contracts/DrawContext.ts` from `src/themes/platformer/engine/DrawContext.ts`, importing `SpriteLookup` from `./SpriteLookup`, dropping the `potTypes` import, and making the interface generic: `DrawContext<TPotPlan = unknown>` with `potPlan?: TPotPlan` (research §1d change 6) (FR-001/FR-003).
- [X] T012 [P] [US1] Create `src/themes/platformer/contracts/PhysicsConfig.ts` by moving `src/themes/platformer/engine/PhysicsConfig.ts` verbatim, values unchanged (FR-001).

### Owner-side extractions (remove the old declarations)

- [X] T013 [P] [US1] Update `src/themes/platformer/entities/sprites/SpriteSheet.ts`: import `SpriteLookup` from `../../contracts/SpriteLookup` and delete the local `export type SpriteLookup` declaration; keep `SpriteSheet`, `SpriteDescriptor`, `frameSource`, and `collectSheetSources` unchanged (FR-012).
- [X] T014 [P] [US1] Update `src/themes/platformer/entities/pickups/index.ts`: import the `PickupKind` type from `../../contracts/PickupKind`, delete the local `export type PickupKind`, and add `satisfies Record<PickupKind, unknown>` to `PICKUP_TYPES` so the registry and the vocabulary cannot drift (FR-003, conformance).
- [X] T015 [P] [US1] Update `src/themes/platformer/entities/CollectiblesSummary.ts`: import `CounterKey` from `../../contracts/counters` and delete the local `export type CounterKey`; `COUNTER_SECTIONS: Record<CounterKey, …>` stays exhaustive (FR-003, FR-012).
- [X] T016 [P] [US1] Update `src/themes/platformer/engine/CollectionEffects.ts`: import `CounterKey`/`CounterPopupLabelKey` from `../contracts/counters` and delete the local `export type CounterPopupLabelKey` (FR-003, FR-012).

### DrawContext specialization (block layer owns the concrete pot plan)

- [X] T017 [P] [US1] Specialize the pot-consuming block-layer signatures to `DrawContext<PotRenderPlan>` and retarget their contract imports: `src/themes/platformer/entities/blocks/potTypes.ts` (`PotKind.drawPot`), `src/themes/platformer/entities/blocks/BlockType.ts` (`draw`), `src/themes/platformer/entities/blocks/pot.ts` (`drawPotBunch`), and `src/themes/platformer/entities/blocks/CoinPot.ts` (`drawPot`). Import `DrawContext` from `../../contracts/DrawContext` and `PotRenderPlan` from `./potTypes`; no cast, no `any` (research §1d).
- [X] T018 [P] [US1] Update `src/themes/platformer/engine/Renderer.ts`: import `DrawContext` from `../contracts/DrawContext` and type `drawBlocks`'s parameter as `DrawContext<PotRenderPlan>` (import `PotRenderPlan` from `../entities/blocks/potTypes`). Leave the torch import for US2. Update `src/themes/platformer/engine/Renderer.test.ts`'s `DrawContext` import path to `../contracts/DrawContext`.
- [X] T019 [US1] Update the DrawContext-consuming test helpers so they compile against the specialization: `src/themes/platformer/entities/blocks/pot.test.ts` (`makeDc` returns `DrawContext<PotRenderPlan>`) and `src/themes/platformer/entities/blocks/BombPot.test.ts` (`makeDrawContext` returns `DrawContext<PotRenderPlan>`) (FR-011; type-only edits, no assertions changed). (`Renderer.test.ts`'s `DrawContext` import is handled in T018.)

### Test relocation

- [X] T020 [P] [US1] Move `src/themes/platformer/engine/Outcome.test.ts` to `src/themes/platformer/contracts/Outcome.test.ts` and update its import to `./Outcome`; assertions unchanged (FR-011, research §4).

### Retarget importers (every moved contract resolves from `contracts/`)

- [X] T021 [P] [US1] Retarget contract imports in `src/themes/platformer/entities/blocks/**` to the new homes: `DrawContext` → `../../contracts/DrawContext`, `PickupKind` → `../../contracts/PickupKind`, `PHYSICS_CONFIG` → `../../contracts/PhysicsConfig`, `PlayerEffects`/`RewardEffects` → `../../contracts/Outcome`, `WorldType` → `../../contracts/WorldType`. Files: `clayVariants.ts`, `drawBlockTile.ts`, `CoinPot.test.ts`, `BombPot.test.ts`, `pot.test.ts`, `PotionPot.test.ts`, `potRenderPlan.test.ts` (plus any of `potTypes.ts`/`BlockType.ts`/`pot.ts`/`CoinPot.ts` import paths not already fixed by T017) (FR-004).
- [X] T022 [P] [US1] Retarget contract imports in `src/themes/platformer/entities/enemies/**`: `DrawContext` → `../../contracts/DrawContext`, `Contact`/`ContactSide`/`CollisionOutcome` → `../../contracts/Contact`, `WorldType`/`Boxed` → `../../contracts/WorldType`, `capabilities` → `../../contracts/capabilities`, `Rect`/`Direction` → `../../contracts/geometry`, `PHYSICS_CONFIG` → `../../contracts/PhysicsConfig`. Files: `EnemyType.ts`, `SlimePurple.ts`, `SlimePurple.test.ts`, `SlimeGreen.ts`, `Bee.ts`, `Bee.test.ts`, `shared.test.ts`, `drawSpriteSheetEntity.ts`, `spriteSheetHitbox.ts`, `movement/patrol.ts`, `movement/patrol.test.ts`, `movement/contract.test.ts` (FR-004).
- [X] T023 [P] [US1] Retarget contract imports in `src/themes/platformer/entities/hazards/**`: `Rect` → `../../contracts/geometry`, `DrawContext` → `../../contracts/DrawContext`, `WorldType`/`Boxed` → `../../contracts/WorldType`. Files: `HazardType.ts`, `Spike.ts`, `SpearArt.ts`, `Spear.test.ts`, `SpearArt.test.ts`, `FloorSpike.ts`, `FallingStalactite.ts`, `FallingStalactite.test.ts` (phase-type retargets are US2, do not touch those here) (FR-004).
- [X] T024 [P] [US1] Retarget contract imports in the remaining `src/themes/platformer/entities/` files: `Player.ts` + `Player.test.ts` (`./capabilities` → `../contracts/capabilities`), `capabilities.test.ts` (`./capabilities` → `../../contracts/capabilities`), `Enemy.test.ts` (`DrawContext`), `Enemy.ts` (re-export `Direction as EnemyDirection` from `../contracts/geometry`), `chests/ChestType.ts` (`WorldType`/`Boxed` + `Rect`), `pickups/PickupType.ts` (`WorldType`/`Boxed` + `Rect` + `DrawContext`) (FR-004).
- [X] T025 [P] [US1] Retarget contract imports in the rest of `src/themes/platformer/engine/**`: `Collision.ts` (`ContactSide` → `../contracts/Contact`, `strongerBounce` → `../contracts/Outcome`), `Collision.test.ts` and `EnemyAI.test.ts` (`PHYSICS_CONFIG`), `Physics.ts` (`isInvulnerable` → `../contracts/capabilities`, `PHYSICS_CONFIG`), `Physics.test.ts` and `PlacedBomb.ts` (`PHYSICS_CONFIG`). Do not touch `Box`/torch/phase-type imports here (US2) (FR-004).
- [X] T026 [US1] Retarget contract imports in the app/state layer: `src/themes/platformer/PlatformerPage.tsx` (`DrawContext` → `./contracts/DrawContext`, `PHYSICS_CONFIG` → `./contracts/PhysicsConfig`, `strongerBounce` → `./contracts/Outcome`, `isInvulnerable` → `./contracts/capabilities`, `SpriteLookup` → `./contracts/SpriteLookup`), `PlatformerPage.test.tsx` (`isInvulnerable`, `PHYSICS_CONFIG`), `PlatformerState.ts` (move `CounterPopupLabelKey` out of the `./engine/CollectionEffects` import block into `./contracts/counters`), `PlatformerState.test.ts` (`PHYSICS_CONFIG` → `./contracts/PhysicsConfig`), `editor/EditorCanvas.tsx` (`DrawContext` → `../contracts/DrawContext`), and `components/ControlsOverlay.tsx` (`PHYSICS_CONFIG` → `../contracts/PhysicsConfig`) (FR-004).

### Remove legacy modules and verify US1

- [X] T027 [US1] Delete the moved/empty legacy modules so no compatibility re-export path survives (FR-012): `src/themes/platformer/entities/WorldType.ts`, `src/themes/platformer/entities/capabilities.ts`, `src/themes/platformer/entities/geometry.ts`, `src/themes/platformer/engine/Outcome.ts`, `src/themes/platformer/engine/Contact.ts`, `src/themes/platformer/engine/DrawContext.ts`, `src/themes/platformer/engine/PhysicsConfig.ts`. (`entities/WorldType.test.ts` and `entities/capabilities.test.ts` stay put.)
- [X] T028 [US1] Verify US1: run `npm run build`, `npm test`, and `npm run lint` (all pass); run quickstart §1.1 (`rg "from '(\.\./)+((engine|entities|level|state|editor|components)/|PlatformerState|PlatformerPage)" src/themes/platformer/contracts` → no output) and quickstart §1.4 (`rg "engine/(Outcome|Contact|DrawContext|PhysicsConfig)" src/themes/platformer` and `rg "entities/(WorldType|capabilities|geometry)" src/themes/platformer` → no `import … from` matches, doc comments only; abbreviated §1.4 — `Torch`/`RewardReveal` are deferred to T036/T040 and the full §1.4 runs in T045). No test deleted/skipped/weakened (FR-002/SC-001/I1/I6).

**Checkpoint**: US1 independently testable — contracts have one home and `contracts/` is a strict leaf.

---

## Phase 4: User Story 2 - `level/` stops importing `engine/` (Priority: P1)

**Goal**: Break the `level/ → engine/` edge by relocating `Box`, the whole torch module, and the
hazard phase vocabulary to `contracts/` or `entities/`.

**Depends on US1**: `contracts/geometry.ts` (T006) and the US1 retargets to `engine/Collision.ts` must
land first (same files).

**Independent Test**: No `level/**` file imports `engine/**` (quickstart §1.2); `Box`, torch, and hazard
phases all resolve from a non-`engine/` home; tests + build pass.

- [X] T029 [US2] Move `Box` usage to contracts (FR-005): in `src/themes/platformer/engine/Collision.ts` import `Box` from `../contracts/geometry` and delete the local `export interface Box`; retarget `type Box` importers `src/themes/platformer/engine/Blast.ts`, `src/themes/platformer/engine/Crouch.ts`, `src/themes/platformer/engine/Blast.test.ts`, `src/themes/platformer/engine/Collision.test.ts`, `src/themes/platformer/entities/Checkpoint.ts`, and `src/themes/platformer/level/SignMapper.ts` to `contracts/geometry` (`../contracts/geometry` or `../../contracts/geometry` as appropriate; `Blast.ts`/`Crouch.ts` keep `aabbOverlap` from `./Collision`).
- [X] T030 [US2] Move the whole torch module (FR-006): create `src/themes/platformer/entities/Torch.ts` from `src/themes/platformer/engine/Torch.ts` verbatim, defining `TorchStrength = 0 | … | 9` locally (moved from `src/themes/platformer/level/LevelData.ts`) instead of importing it from `level/`; delete `src/themes/platformer/engine/Torch.ts`; update `src/themes/platformer/level/LevelData.ts` to import `TorchStrength` from `../entities/Torch` (remove its local `export type TorchStrength`, keep the torch marker union using it). Values, constants, and validator logic unchanged.
- [X] T031 [US2] Move `src/themes/platformer/engine/Torch.test.ts` to `src/themes/platformer/entities/Torch.test.ts`, changing its `./Torch` import to `./Torch` (same name, new folder) and leaving every assertion unchanged (FR-011).
- [X] T032 [US2] Retarget every torch importer (FR-006): `engine/Lighting.ts` (`./Torch` → `../entities/Torch`; import `TorchStrength` from `../entities/Torch` rather than `level/LevelData`), `engine/Renderer.ts` (`./Torch` → `../entities/Torch`), `level/LevelParser.ts` (`../engine/Torch` → `../entities/Torch`), `level/LevelParser.test.ts` (`DEFAULT_TORCH_STRENGTH` and `TorchStrength` → `../entities/Torch`), `PlatformerState.ts` (`./engine/Torch` → `./entities/Torch`), `editor/EditorCanvas.tsx`, `editor/paintMarkerCell.ts`, and `editor/caveLightingPreview.ts` (`../engine/Torch` → `../entities/Torch`).
- [X] T033 [US2] Create `src/themes/platformer/entities/hazards/phases.ts` (FR-007) exporting, verbatim, `FloorSpikePhase` + `FloorSpikeTimerState` from `engine/FloorSpike.ts` and `FallingStalactitePhase` + `FallingStalactiteTimerState` from `engine/FallingStalactite.ts`. It must import nothing (research §2c).
- [X] T034 [US2] Repoint the phase/timer vocabulary to `entities/hazards/phases.ts` and delete the local declarations: `engine/FloorSpike.ts` and `engine/FallingStalactite.ts` (import their types from `../entities/hazards/phases`, keep all constants/functions/behaviour), `engine/Collision.ts` (`FloorSpikeTimerState`/`FallingStalactiteTimerState`), `engine/Collision.test.ts` (`FallingStalactiteTimerState`), `engine/FallingStalactite.test.ts` (`FallingStalactiteTimerState`/`FallingStalactitePhase`), `PlatformerState.ts` (both timer-state types → `./entities/hazards/phases`), `entities/hazards/FloorSpike.ts` and `entities/hazards/FloorSpike.test.ts` (`FloorSpikePhase` → `./phases`).
- [X] T035 [US2] Retarget `src/themes/platformer/level/HazardMapper.ts` to import `FloorSpikePhase` and `FallingStalactitePhase` from `../entities/hazards/phases` (FR-007/FR-008).
- [X] T036 [US2] Verify US2: run quickstart §1.2 (`rg "from '(\.\./)?engine/" src/themes/platformer/level` → no output), `npm run build`, `npm test`, `npm run lint`. Confirm torch/hazard values are unchanged (SC-004/I5).

**Checkpoint**: US1 AND US2 both hold — no `level/ → engine/` edge remains.

---

## Phase 5: User Story 3 - The engine stops depending on application state (Priority: P2)

**Goal**: Relocate the fact-reveal behaviour out of `engine/` into the state layer so `engine/` no
longer imports `PlatformerState`.

**Depends on US1**: the counter vocabulary move (T005/T016/T026) and the contract retargets must land
first.

**Independent Test**: No `engine/**` file imports `PlatformerState` or `state/**` (quickstart §1.3);
defeating an enemy / opening a chest / destroying a crate / collecting a coin still yields the same
journal entry, flight effect, and counter popup.

- [X] T037 [US3] Move `src/themes/platformer/engine/RewardReveal.ts` to `src/themes/platformer/state/rewards.ts` (FR-009), keeping the public surface `RevealContext`, `RevealOptions`, `createRewardReveal` and the logic unchanged. Update its imports to the new depth: `PlatformerState` → `../PlatformerState`; `startFlightEffect`/`startCounterPopup`/`SlotAllocator` → `../engine/CollectionEffects`; `CounterPopupLabelKey` → `../contracts/counters`; `countCollectedFor` → `../entities/CollectiblesSummary`; `formatJournalEntry` → `../entities/JournalEntry`; `CollectedFact` → `../types`.
- [X] T038 [US3] Move `src/themes/platformer/engine/RewardReveal.test.ts` to `src/themes/platformer/state/rewards.test.ts`, updating imports to `./rewards`, `../PlatformerState`, and `../engine/CollectionEffects`; assertions unchanged (FR-011).
- [X] T039 [US3] Update `src/themes/platformer/PlatformerPage.tsx` to import `createRewardReveal` from `./state/rewards` (was `./engine/RewardReveal`) (FR-009).
- [X] T040 [US3] Verify US3: run quickstart §1.3 (`rg "PlatformerState|from '.*state/" src/themes/platformer/engine` → no `import` matches, comments allowed), `npm run build`, `npm test`, `npm run lint`, and quickstart §1.4's `rg "engine/RewardReveal" src/themes/platformer` (comments only). Confirm `engine/RewardReveal.ts` no longer exists (FR-010/SC-001/I3).

**Checkpoint**: All three stories independently functional; no `engine/ → state` edge remains.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full verification, manual boundary inspection, and feature tracking.

- [X] T041 [P] Run the full gates from the repo root and confirm all pass: `npm test` (no test deleted, skipped, or weakened — I6), `npm run build`, `npm run lint` (SC-003/FR-011).
- [X] T042 Run the one-time manual import inspection from quickstart §1 (contracts leaf, no `level/ → engine/`, no `engine/ → state`, no legacy paths still required, new homes have importers) and record the results (SC-001/SC-002).
- [ ] T043 Perform the manual browser pass from quickstart §4 (`npm run dev`): torches, floor spikes, falling stalactites, a reward reveal (enemy/chest/crate/coin), and editor pot-run seam fillers all behave identically (SC-003).
- [X] T044 Update `docs/Features.md`'s dependency diagram: prefix the `R001` node label with `✅ ` and add `class R001 done` alongside its existing category class (Principle IV / quickstart §5).
- [X] T045 Final consistency sweep: confirm `contracts/` contains exactly the FR-001 modules with one home each, no legacy re-export remains (FR-012), and the four moved/extracted behaviour modules preserve their public shapes (SC-002/SC-004).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately (T001 baseline first).
- **Foundational (Phase 2)**: Depends on Setup — creates the leaf vocabulary that blocks everything.
- **User Story 1 (Phase 3)**: Depends on Foundational. Delivers the `contracts/` layer and all retargets.
- **User Story 2 (Phase 4)**: Depends on **US1** (shares `engine/Collision.ts`, `engine/Renderer.ts`, `PlatformerState.ts`, `entities/hazards/FloorSpike.ts`).
- **User Story 3 (Phase 5)**: Depends on **US1** (counter vocabulary + `engine/CollectionEffects.ts`).
- **Polish (Phase 6)**: Depends on all desired stories.

### User Story Dependencies

- **US1 (P1)**: Foundational only. No dependency on US2/US3.
- **US2 (P1)**: On US1 — `Box` needs `contracts/geometry.ts`; several US2 files are also US1 retarget sites.
- **US3 (P2)**: On US1 — the reward module imports the moved `CounterPopupLabelKey` and the retargeted `CollectionEffects`.

### Within US1

1. Foundational leaf contracts (T003–T006) → contract modules (T007–T012).
2. Owner-side extractions (T013–T016) after their leaf exists.
3. Specialization (T017–T019) after `contracts/DrawContext.ts` (T011).
4. Retargets (T021–T026) after their target modules exist; then delete old files (T027); verify (T028).

### Parallel Opportunities

- T003–T006 are four independent leaf files.
- T007–T012 are six independent contract files (after T003–T006).
- T013–T016 are four independent owner files.
- T017/T018 are independent (block layer vs Renderer).
- T020 (test move) is independent.
- T021–T025 touch disjoint folder trees and can run in parallel once their targets exist.
- T041 (verification) is independent of T042–T044 documentation.

---

## Parallel Example: User Story 1

```bash
# Leaf contracts (after Setup):
Task: "Create contracts/SpriteLookup.ts"
Task: "Create contracts/PickupKind.ts"
Task: "Create contracts/counters.ts"
Task: "Create contracts/geometry.ts"

# Contract modules (after the leaves):
Task: "Create contracts/WorldType.ts"
Task: "Create contracts/capabilities.ts"
Task: "Create contracts/Outcome.ts"
Task: "Create contracts/Contact.ts"
Task: "Create contracts/DrawContext.ts"
Task: "Create contracts/PhysicsConfig.ts"

# Folder-scoped retargets (disjoint trees, after targets exist):
Task: "Retarget entities/blocks/** contract imports (T021)"
Task: "Retarget entities/enemies/** contract imports (T022)"
Task: "Retarget entities/hazards/** contract imports (T023)"
Task: "Retarget remaining entities/ contract imports (T024)"
Task: "Retarget remaining engine/** contract imports (T025)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001–T002) and Phase 2 (T003–T006).
2. Complete Phase 3 (T007–T028) — the full `contracts/` layer.
3. **STOP and VALIDATE**: run T028's independent checks (contracts leaf + suite + build).

### Incremental Delivery

1. Setup + Foundational → leaf vocabulary ready.
2. US1 → `contracts/` layer + retargets → validate (MVP).
3. US2 → break `level/ → engine/` → validate no edge + suite.
4. US3 → move reward reveal to `state/` → validate no `engine/ → state` edge + suite.
5. Polish → full gates, manual inspection, browser pass, `docs/Features.md`.

### Notes

- [P] tasks touch different files with no incomplete dependencies.
- Behaviour-preserving: moved module bodies are copied verbatim apart from import paths, the
  `DrawContext<TPotPlan>` type-parameter change (research §1d / document §6), the three vocabulary
  extractions (`SpriteLookup`, `PickupKind`, counter keys), and the `PICKUP_TYPES` conformance
  clause. No constants, values, or logic change (SC-004/I5).
- Delete legacy modules only after their importers are retargeted; never add a compatibility re-export.
- Commit after each logical group; do not create a new branch/commit unless the user asks.
- Avoid: leaving a second home for any contract, changing hazard/torch values, or weakening any test.
