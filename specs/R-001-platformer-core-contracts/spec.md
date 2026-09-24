# Feature Specification: Platformer Core Contracts & Dependency Layers

**Feature Branch**: `R-001-platformer-core-contracts`
**Created**: 2026-09-24
**Status**: Draft
**Input**: GitHub issue #89 — "R-001: Platformer Core Contracts & Dependency Layers". Extract a shared `core/` contracts layer and break the `engine` ↔ `level` import cycle so the platformer folders match the dependency graph.

**Depends on**: [F-015 Platformer Theme](../F-015-platformer-theme/spec.md) (the shipped code being restructured).
**Design reference**: [`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) — Group F, findings **F1–F3**.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Shared contracts live in one bottom layer (Priority: P1)

A developer writing a new entity or engine module needs the shared contracts (`WorldType`/`Boxed`, the capability mixins, geometry, `Outcome`, `Contact`, `DrawContext`, `PhysicsConfig`). Today they are scattered across `entities/` and `engine/`, so an entity type module has to reach into `engine/` just to describe itself. After this feature every one of those contracts lives in a single `core/` layer that sits below both and imports neither.

**Why this priority**: This is the foundation the whole refactor sequence builds on. Until the contracts have one home, every later finding (lighting, effects, pickups, renderer) keeps re-creating the same cross-folder reach-up.

**Independent Test**: Inspect the new `core/` modules and the platformer import graph — each listed contract is exported from exactly one module under `core/`, and `core/` imports nothing from `engine/`, `entities/`, `level/`, or state/app code.

**Acceptance Scenarios**:

1. **Given** a developer looking for the shared contracts, **When** they search the platformer theme, **Then** `WorldType`/`Boxed`, the capability mixins, geometry, `Outcome`/`PlayerEffects`/`RewardEffects`, `Contact`/`CollisionOutcome`, `DrawContext`, and `PhysicsConfig` are each exported from exactly one module under `core/`.
2. **Given** the new `core/` layer, **When** its imports are inspected, **Then** it imports no module from `engine/`, `entities/`, `level/`, a state/feature module, or the app pages — only itself and the shared top-level `types.ts`.
3. **Given** any module that previously imported a shared contract from `entities/` or `engine/`, **When** it is inspected after the change, **Then** it imports that contract from `core/` and its behaviour is unchanged.

---

### User Story 2 - `engine/` and `level/` stop importing each other (Priority: P1)

The runtime (`engine/`) and the level-parsing/placement layer (`level/`) import each other. `level/` only reaches up for three small things — `Box`, the torch-strength authoring constants, and the hazard phase types — but that is enough to make two large folders mutually dependent. After this feature `level/` depends only downward, and the shared pieces live where both layers can reach them without a cycle.

**Why this priority**: Cycles make the tree unreadable and block a clean layering for everything that follows. It is also the cheapest half of the feature (three targeted moves).

**Independent Test**: A static import-graph check shows no `level/ → engine/` edge, and each of the three leaked items resolves from a non-`engine/` home.

**Acceptance Scenarios**:

1. **Given** the platformer module graph, **When** import edges are inspected, **Then** there is no `level/ → engine/` import edge.
2. **Given** `Box`, **When** `engine/` and `level/` need it, **Then** both import it from `core/geometry` rather than from `engine/Collision`.
3. **Given** the torch-strength constants and validator currently in `engine/Torch`, **When** `level/` parsing validates a torch marker, **Then** it resolves them from a layer `level/` is allowed to depend on (not `engine/`), with identical values and behaviour.
4. **Given** the floor-spike and falling-stalactite phase vocabulary currently in `engine/`, **When** `level/HazardMapper` describes a hazard placement, **Then** it resolves those types from the hazard kinds (or another non-`engine/` layer).

---

### User Story 3 - The engine stops depending on application state (Priority: P2)

`engine/RewardReveal` imports `collectedFacts`, `activeEffects`, `activeCounterPopups`, and `levelTotals` from `PlatformerState` and writes to them. That makes the engine folder impossible to reason about or test without the app's signals. After this feature that reveal logic lives in the state/feature layer that owns the signals, and the engine can be imported without dragging in `PlatformerState`.

**Why this priority**: It closes the last layer inversion in Group F. It is slightly higher risk than the pure moves (it relocates behaviour), so it follows the mechanical work.

**Independent Test**: No module under `engine/` imports `PlatformerState` (or any state/feature module), and defeating an enemy / opening a chest / collecting a coin still produces the same journal entry, flight effect, and counter popup.

**Acceptance Scenarios**:

1. **Given** the `engine/` folder, **When** its imports are inspected, **Then** no module under it imports `PlatformerState` or any state/feature module.
2. **Given** a fact reveal previously performed by `engine/RewardReveal`, **When** the player defeats an enemy, opens a chest, destroys a crate, or collects a coin/bonus fruit, **Then** the same collected-fact entry, flight effect, and counter popup occur, now driven by the state/feature layer.
3. **Given** the production build, **When** it runs, **Then** it succeeds and no new runtime dependency has been introduced.

---

### Edge Cases

- **A contract that references another contract from a higher layer**: moving the first into `core/` would make `core/` import upward (`DrawContext` references sprite/pot types; `Outcome` references counter-popup and pickup-kind types). The referenced type MUST also move into `core/` or be decoupled — no `core/ → engine|entities` edge may remain.
- **A type-only import that still points at `engine/` from `level/`**: type-only edges count as dependencies. The type MUST physically move; suppressing it with a re-export does not satisfy the invariant.
- **Contract modules with existing tests**: tests move with their module and keep passing. No test may be deleted, skipped, or weakened to make the refactor green.
- **Behaviour-adjacent moves (torch strength, hazard phases)**: values, units, and defaults MUST be preserved exactly so authored levels and live gameplay are unchanged.
- **A module that imported both a contract and an engine service**: only the contract import is retargeted; the service import stays until its own feature (R-002+) moves it.
- **`RewardReveal`'s state writes**: they MUST NOT simply be relocated to another module under `engine/`; the owning layer must change.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A single `core/` layer MUST exist under `src/themes/platformer/` holding the shared contracts currently scattered across `entities/` and `engine/`: `WorldType`/`Boxed`, the capability mixins, geometry (`Direction`, `Rect`, `Box`), the outcome vocabulary (`PlayerEffects`/`RewardEffects`), the contact vocabulary (`Contact`/`CollisionOutcome`), `DrawContext`, and `PhysicsConfig`.
- **FR-002**: `core/` MUST depend only on itself (and the shared top-level `types.ts`); it MUST NOT import from `engine/`, `entities/`, `level/`, a state/feature module, or the app pages.
- **FR-003**: Any contract in FR-001 that references a type owned by a higher layer MUST either move that type into `core/` or decouple from it, so FR-002 holds.
- **FR-004**: Every importer of a moved contract MUST import it from its new `core/` location; the contract's public shape, values, and behaviour MUST be unchanged.
- **FR-005**: `Box` MUST live in `core/geometry.ts` and be imported from there by both `engine/` and `level/` instead of from `engine/Collision`.
- **FR-006**: The torch-strength authoring constants and validator MUST move out of `engine/` to a layer `level/` may depend on, so no `level/` module imports `engine/Torch`.
- **FR-007**: The floor-spike and falling-stalactite phase vocabulary MUST move out of `engine/` to the hazard kinds (or another layer `level/` may depend on), so no `level/` module imports `engine/FloorSpike` or `engine/FallingStalactite`.
- **FR-008**: After FR-005–FR-007, `level/` MUST NOT import any module from `engine/`.
- **FR-009**: `engine/RewardReveal` MUST be removed from `engine/`; its reveal behaviour MUST live in the state/feature layer, or be inverted into reward data that the state/feature layer applies.
- **FR-010**: No module under `engine/` MUST import `PlatformerState` or any state/feature module.
- **FR-011**: The change MUST preserve behaviour: all existing tests MUST pass (import paths updated only) and the production build MUST succeed.
- **FR-012**: Each shared contract MUST have exactly one home; no compatibility re-export that preserves the old upward import edge is permitted.

### Key Entities

- **`core/` layer**: a new bottom layer of pure contracts and primitives under the platformer theme, importable by every other folder and importing none of them.
- **Contract modules**: `WorldType`/`Boxed`, capability mixins, geometry (including `Box`), `Outcome`, `Contact`, `DrawContext`, and `PhysicsConfig`.
- **Torch-strength authoring constants**: the default strength, valid range, and validator currently in `engine/Torch`.
- **Hazard phase vocabulary**: the floor-spike and falling-stalactite phase types (and their timer-state shapes) currently in `engine/`.
- **Reward reveal**: the fact → journal-entry / flight-effect / counter-popup logic currently in `engine/RewardReveal`, together with the `PlatformerState` signals it writes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Clean layers**: a dependency inspection finds zero imports from `core/` to any higher folder, zero imports from `level/` to `engine/`, and zero imports from `engine/` to state/feature modules.
- **SC-002 — One home per contract**: each of the contract families in FR-001 resolves to exactly one module under `core/`, with no legacy path still required for compilation.
- **SC-003 — Behaviour preserved**: the full test suite passes and the production build succeeds; a manual browser pass over a cave level (torches, floor spikes, falling stalactites) and at least one reward reveal shows no visible or behavioural difference.
- **SC-004 — Contained change**: the bodies of the moved contract modules (types, constants, pure helpers) are unchanged apart from import paths; only `RewardReveal`'s location and owning layer change, with its logic preserved.

## Assumptions

- **Scope is findings F1–F3 only.** The shared-math / `TileAtlas` / `findLandingRow` / `layoutFile` / kind-union dedup and the low-risk file merges grouped under "Phase 0" in the analysis belong to **R-002**, not this feature.
- **F3 is resolved by moving, not inverting.** The reveal logic moves to the state/feature layer rather than being inverted into reward data; inversion overlaps R-007 and carries more behavioural risk. (`/speckit.clarify` may revisit this.)
- **`core/` is a strict leaf.** Referenced higher-layer types (e.g. sprite-lookup, pot-render-plan, counter-popup-key, and pickup-kind vocabulary) either move into `core/` or are decoupled as part of FR-003. (Final landings for these settle in planning.)
- **Folder names follow the analysis doc**: `core/` for the contracts layer and a state/feature module for the reveal; the exact module name is settled during planning.
- **No data migration**: authored levels, markers, torch strengths, and hazard tuning are unchanged.
- **Later features re-verify these invariants.** This feature does not pre-empt their moves (it does not, for example, split `engine/` into services/render/features beyond what F1–F3 require).
- **The working tree's current uncommitted scaffolding** (docs, tooling) is unrelated and unaffected.

## Out of Scope

- `LightSource`, the transient-effect registry, `SpeechBubble`, pickup unification, registry-dispatch completion, world items, static-tile registry and renderer split, mapper/editor unification, damage and bomb systems, per-domain state stores, and sprite asset/atlas organisation (**R-002–R-013**).
- Any change to gameplay, balance, visuals, level data, or public behaviour.
- The wider `engine/` → `engine/render/` + `features/` reorganisation (F7) beyond the minimal move F1–F3 require.
- Journal/HUD relocations (F4/F11) and the `level.ts` data/signal split (F5/F6).
