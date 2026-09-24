# Feature Specification: Platformer Core Contracts & Dependency Layers

**Feature Branch**: `R-001-platformer-core-contracts`
**Created**: 2026-09-24
**Status**: Draft
**Input**: GitHub issue #89 — "R-001: Platformer Core Contracts & Dependency Layers". Extract a shared `contracts/` layer and break the `engine` ↔ `level` import cycle so the platformer folders match the dependency graph.

**Depends on**: [F-015 Platformer Theme](../F-015-platformer-theme/spec.md) (the shipped code being restructured).
**Design reference**: [`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) — Group F, findings **F1–F3**.

## Clarifications

### Session 2026-09-24

- Q: Where should the leaked `level/`-facing vocabulary (torch constants + hazard phase types) move to? → A: Hazard phase types move to `entities/hazards/` (the hazard kinds own their phases); all torch code stays together (see below).
- Q: Should torch-strength authoring constants live in `level/` or `contracts/`? → A: Everything torch-related stays in one module; the torch module relocates wholesale.
- Q: Where should the self-contained torch module live? → A: `entities/Torch.ts` (torch as an entity kind); `level/`, `engine/`, `editor/`, and `PlatformerState` import from there.
- Q: Does `PhysicsConfig` belong in `contracts/` or `engine/`? → A: `contracts/`, per the architecture plan (F1); the shared bottom layer keeps the plan's `contracts/` name.
- Q: How should the layer invariants (SC-001) be verified? → A: A one-time manual import inspection documented in the quickstart; no new automated boundary test.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Shared contracts live in one bottom layer (Priority: P1)

A developer writing a new entity or engine module needs the shared contracts (`WorldType`/`Boxed`, the capability mixins, geometry, `Outcome`, `Contact`, `DrawContext`, `PhysicsConfig`). Today they are scattered across `entities/` and `engine/`, so an entity type module has to reach into `engine/` just to describe itself. After this feature every one of those contracts lives in a single `contracts/` layer that sits below both and imports neither.

**Why this priority**: This is the foundation the whole refactor sequence builds on. Until the contracts have one home, every later finding (lighting, effects, pickups, renderer) keeps re-creating the same cross-folder reach-up.

**Independent Test**: Inspect the new `contracts/` modules and the platformer import graph — each listed contract is exported from exactly one module under `contracts/`, and `contracts/` imports nothing from `engine/`, `entities/`, `level/`, or state/app code.

**Acceptance Scenarios**:

1. **Given** a developer looking for the shared contracts, **When** they search the platformer theme, **Then** `WorldType`/`Boxed`, the capability mixins, geometry, `Outcome`/`PlayerEffects`/`RewardEffects`/`strongerBounce`, `Contact`/`ContactSide`/`CollisionOutcome`, `DrawContext`, and `PhysicsConfig` are each exported from exactly one module under `contracts/`.
2. **Given** the new `contracts/` layer, **When** its imports are inspected, **Then** it imports no module from `engine/`, `entities/`, `level/`, a state module, or the app pages — only itself and the shared top-level `types.ts`.
3. **Given** any module that previously imported a shared contract from `entities/` or `engine/`, **When** it is inspected after the change, **Then** it imports that contract from `contracts/` and its behaviour is unchanged.

---

### User Story 2 - `level/` stops importing `engine/` (Priority: P1)

The runtime (`engine/`) and the level-parsing/placement layer (`level/`) import each other. `level/` only reaches up for three small things — `Box`, the torch module (its type, constants, and validator), and the hazard phase types — but that is enough to make two large folders mutually dependent. After this feature `level/` no longer reaches into `engine/`, and the shared pieces live where `level/` can reach them through `contracts/` or `entities/`.

This is **not** a severing of the two layers: `engine/` continues to depend on `level/`, consuming the `LevelDef`, the terrain helpers, and the placement records that `level/` produces. That one-way dependency is the intended connection; the app layer (`PlatformerPage`/`PlatformerState`) parses a level and hands it to the engine's render loop. Removing the `level/ → engine/` arrow leaves that single direction intact and closes the cycle.

**Why this priority**: Cycles make the tree unreadable and block a clean layering for everything that follows. It is also the cheapest half of the feature (three targeted moves).

**Independent Test**: A static import-graph check shows no `level/ → engine/` edge, and each of the three leaked items resolves from a non-`engine/` home.

**Acceptance Scenarios**:

1. **Given** the platformer module graph, **When** import edges are inspected, **Then** there is no `level/ → engine/` import edge.
2. **Given** `Box`, **When** `engine/` and `level/` need it, **Then** both import it from `contracts/geometry` rather than from `engine/Collision`.
3. **Given** the torch module currently under `engine/` (flame animation, strength constants, and validator) and the `TorchStrength` type currently in `level/LevelData.ts`, **When** `level/` parsing validates a torch marker, **Then** they resolve from `entities/Torch.ts` with identical values and behaviour, and the whole torch module stays together there.
4. **Given** the floor-spike and falling-stalactite phase vocabulary currently in `engine/`, **When** `level/HazardMapper` describes a hazard placement, **Then** it resolves those types from `entities/hazards/` (the hazard kinds own their phases).

---

### User Story 3 - The engine stops depending on application state (Priority: P2)

`engine/RewardReveal` imports `collectedFacts`, `activeEffects`, `activeCounterPopups`, and `levelTotals` from `PlatformerState` and writes to them. That makes the engine folder impossible to reason about or test without the app's signals. After this feature that reveal logic lives in the state layer that owns the signals, and the engine can be imported without dragging in `PlatformerState`.

**Why this priority**: It closes the last layer inversion in Group F. It is slightly higher risk than the pure moves (it relocates behaviour), so it follows the mechanical work.

**Independent Test**: No module under `engine/` imports `PlatformerState` (or any state module), and defeating an enemy / opening a chest / collecting a coin still produces the same journal entry, flight effect, and counter popup.

**Acceptance Scenarios**:

1. **Given** the `engine/` folder, **When** its imports are inspected, **Then** no module under it imports `PlatformerState` or any state module.
2. **Given** a fact reveal previously performed by `engine/RewardReveal`, **When** the player defeats an enemy, opens a chest, destroys a crate, or collects a coin/bonus fruit, **Then** the same collected-fact entry, flight effect, and counter popup occur, now driven by the state layer.
3. **Given** the production build, **When** it runs, **Then** it succeeds and no new runtime dependency has been introduced.

---

### Edge Cases

- ✅ **A contract that references a higher-layer type** — see FR-003: the referenced type MUST also move into `contracts/` or be decoupled (e.g. `DrawContext` references sprite types; `Outcome` references counter-popup and pickup-kind types), so no `contracts/ → engine|entities` edge remains.
- ✅ **A type-only import that still points at `engine/` from `level/`** — type-only edges count as dependencies. The type MUST physically move; suppressing it with a re-export does not satisfy the invariant.
- ✅ **Contract modules with existing tests** — tests move with their module and keep passing. No test may be deleted, skipped, or weakened to make the refactor green.
- ✅ **Behaviour-adjacent moves (torch strength, hazard phases)** — values, units, and defaults MUST be preserved exactly so authored levels and live gameplay are unchanged.
- ✅ **A module that imported both a contract and an engine service** — only the contract import is retargeted; the service import stays until its own feature (R-002+) moves it.
- ✅ **`RewardReveal`'s state writes** — they MUST NOT simply be relocated to another module under `engine/`; the owning layer must change.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A single `contracts/` layer MUST exist under `src/themes/platformer/` holding the shared contracts currently scattered across `entities/` and `engine/`: `WorldType`/`Boxed`, the capability mixins, geometry (`Direction`, `Rect`, `Box`), the outcome vocabulary (`PlayerEffects`/`RewardEffects`/`strongerBounce`), the contact vocabulary (`ContactSide`/`Contact`/`CollisionOutcome`), `DrawContext`, and `PhysicsConfig`.
- **FR-002**: `contracts/` MUST depend only on itself (and the shared top-level `types.ts`); it MUST NOT import from `engine/`, `entities/`, `level/`, a state module, or the app pages.
- **FR-003**: Any contract in FR-001 that references a type owned by a higher layer MUST either move that type into `contracts/` or decouple from it, so FR-002 holds.
- **FR-004**: Every importer of a moved contract MUST import it from its new `contracts/` location; the contract's public shape, values, and behaviour MUST be unchanged.
- **FR-005**: Both `engine/` and `level/` MUST import `Box` from `contracts/geometry.ts` instead of from `engine/Collision` (its single home in `contracts/` is fixed by FR-001/FR-012).
- **FR-006**: The torch module — the flame animation, the strength constants, and the validator currently in `engine/Torch.ts` — MUST move out of `engine/` to `entities/Torch.ts`, and the `TorchStrength` type MUST move there from `level/LevelData.ts`, so the module is whole and no `level/` module imports `engine/Torch`.
- **FR-007**: The floor-spike and falling-stalactite phase vocabulary MUST move out of `engine/` into `entities/hazards/` (the hazard kinds own their phases), so no `level/` module imports `engine/FloorSpike` or `engine/FallingStalactite`.
- **FR-008**: After FR-005–FR-007, `level/` MUST NOT import any module from `engine/`.
- **FR-009**: `engine/RewardReveal` MUST be removed from `engine/`; its reveal behaviour MUST move into the state layer (`state/rewards.ts`), with its logic preserved.
- **FR-010**: No module under `engine/` MUST import `PlatformerState` or any state module.
- **FR-011**: The change MUST preserve behaviour: all existing tests MUST pass (import paths updated only) and the production build MUST succeed.
- **FR-012**: Each shared contract MUST have exactly one home; no compatibility re-export that preserves the old upward import edge is permitted.

### Key Entities

- **`contracts/` layer**: a new bottom layer of pure contracts and primitives under the platformer theme, importable by every other folder and importing none of them.
- **Contract modules**: `WorldType`/`Boxed`, capability mixins, geometry (including `Box`), `Outcome` (incl. `strongerBounce`), `Contact` (incl. `ContactSide`), `DrawContext`, and `PhysicsConfig`.
- **Torch module**: the flame animation, the strength constants, and the validator currently in `engine/Torch`, plus the `TorchStrength` type currently in `level/LevelData.ts`; they move together to `entities/Torch.ts`.
- **Hazard phase vocabulary**: the floor-spike and falling-stalactite phase types (and their timer-state shapes) currently in `engine/`; they move to `entities/hazards/`.
- **Reward reveal**: the fact → journal-entry / flight-effect / counter-popup logic currently in `engine/RewardReveal`, together with the `PlatformerState` signals it writes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Clean layers**: a dependency inspection finds zero imports from `contracts/` to any higher folder, zero imports from `level/` to `engine/`, and zero imports from `engine/` to state modules.
- **SC-002 — One home per contract**: each of the contract families in FR-001 resolves to exactly one module under `contracts/`, with no legacy path still required for compilation.
- **SC-003 — Behaviour preserved**: the full test suite passes and the production build succeeds; a manual browser pass (quickstart §4) over a cave level (torches, floor spikes, falling stalactites) and at least one reward reveal shows no visible or behavioural difference.
- **SC-004 — Contained change**: moved contract modules keep their values and logic; the only sanctioned body changes are (a) retargeted import paths, (b) `DrawContext` made generic over the pot plan (`DrawContext<TPotPlan = unknown>`), (c) the `SpriteLookup`, `PickupKind`, and counter-key vocabularies extracted into their own `contracts/` modules, and (d) `PickupKind` written out explicitly with `PICKUP_TYPES` conforming via `satisfies Record<PickupKind, unknown>`. `RewardReveal` moves to `state/rewards.ts` with its logic preserved.

## Assumptions

- **Scope is findings F1–F3 only.** The shared-math / `TileAtlas` / `findLandingRow` / `layoutFile` / kind-union dedup and the low-risk file merges grouped under "Phase 0" in the analysis belong to **R-002**, not this feature.
- **F3 is resolved by moving, not inverting (confirmed).** The reveal logic moves to the state layer rather than being inverted into reward data; inversion overlaps R-007 and carries more behavioural risk.
- **`contracts/` is a strict leaf (confirmed).** Referenced higher-layer types (e.g. sprite-lookup, pot-render-plan, counter-popup-key, and pickup-kind vocabulary) either move into `contracts/` or are decoupled as part of FR-003.
- **The shared bottom layer keeps the plan's `contracts/` name.** It is not renamed, and `PhysicsConfig` moves into it (FR-001).
- **Torch and hazards refine the plan's placement options.** The torch module moves whole to `entities/Torch.ts` (the plan allowed `level/` or `contracts/`); the hazard phase types move to `entities/hazards/` (as the plan suggested). `level/` therefore reaches these through `entities/`, never through `engine/`.
- **A folder-level `level/ ↔ entities/` relationship remains (accepted).** `entities/` already imports `level/` (e.g. `Terrain`, the `*Mapper` placement types), so importing torch and hazard phases from `entities/` keeps a mutual folder relationship. R-001 only removes the `level/ → engine/` edge and the `engine/ → PlatformerState` edge; breaking the `level/ ↔ entities/` relationship (by moving shared terrain primitives to `contracts/`) belongs to R-002's Phase 0 primitives and is out of scope here.
- **Layer invariants are verified by a one-time manual import inspection** documented in the quickstart; R-001 adds no automated boundary test.
- **Folder names follow the analysis doc**: `contracts/` for the contracts layer and a state module for the reveal; the exact module name is settled during planning.
- **No data migration**: authored levels, markers, torch strengths, and hazard tuning are unchanged.
- **Later features re-verify these invariants.** This feature does not pre-empt their moves (it does not, for example, split `engine/` into services/render/features beyond what F1–F3 require).
- **The working tree's current uncommitted scaffolding** (docs, tooling) is unrelated and unaffected.

## Out of Scope

- `LightSource`, the transient-effect registry, `SpeechBubble`, pickup unification, registry-dispatch completion, world items, static-tile registry and renderer split, mapper/editor unification, damage and bomb systems, per-domain state stores, and sprite asset/atlas organisation (**R-002–R-013**).
- Any change to gameplay, balance, visuals, level data, or public behaviour.
- The wider `engine/` → `engine/render/` + `features/` reorganisation (F7) beyond the minimal move F1–F3 require.
- Journal/HUD relocations (F4/F11) and the `level.ts` data/signal split (F5/F6).
