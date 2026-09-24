# Feature Specification: Platformer Shared Primitives & Dedup

**Feature Branch**: `R-002-platformer-shared-primitives`
**Created**: 2026-09-24
**Status**: Draft
**Input**: GitHub issue #90 — "R-002: Platformer Shared Primitives & Dedup". Introduce shared math/atlas primitives and remove low-risk duplication and dead code across the platformer theme.

**Depends on**: [R-001 Platformer Core Contracts & Dependency Layers](../R-001-platformer-core-contracts/spec.md) (the `contracts/` bottom layer established there is the sibling the new `shared/` math leaf sits beside).
**Design reference**: [`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) — Phase 0, findings **L4, L5, L6, P3, M4, M5**, and **Group X**.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Shared math primitives live in one module (Priority: P1)

A developer adding a new effect, light, or movement module needs basic scalar and position math (`clamp01`, `smoothstep`, `lerp`, `hash2D`, `pulse`, `shakeOffsetX`). Today these are re-typed inline in a dozen places across `engine/` and `entities/` — the smoothstep formula is written four times, `clamp01` nine times, the same position hash appears in four modules, and the shake formula is copy-pasted with only its amplitude differing. After this feature each of those primitives exists exactly once in `shared/math.ts`, and every former inline copy imports it.

**Why this priority**: This is the primitive layer the rest of the refactor sequence (abstract light sources in R-003, the transient-effect registry in R-004) builds on, and it is the single largest dedup in the phase (~15 call sites).

**Independent Test**: Inspect `shared/math.ts` and the platformer import graph — each listed primitive is defined exactly once, and no module still contains an inline re-implementation of the same formula.

**Acceptance Scenarios**:

1. **Given** a search for the smoothstep formula across the platformer theme, **When** the code is inspected, **Then** it appears only in `shared/math.ts`; the four former sites in `Lighting.ts` (torch, player, enemy-eye, and fog falloff) import it.
2. **Given** a search for the position-hash expression, **When** the code is inspected, **Then** it appears only in `shared/math.ts` as `hash2D`; `Torch`, `StaticObjectsCatalog`, `BackgroundDecorCatalog`, and `Lighting`'s salted variant all call it.
3. **Given** a search for `clamp01`, **When** the code is inspected, **Then** it is defined once and imported by every former inline clamp site (`Lighting`, `CrumblingFloor`, `BlockAI`, `DeployableLadder`, `MushroomSquash`, `CollectionEffects`, `FloorSpike`, `Fruit`).
4. **Given** the fog effect in `Lighting`, **When** its falloff is inspected, **Then** it reuses the shared `smoothstep`/`hash2D` rather than re-deriving them.
5. **Given** `CrumblingFloor` and `FallingStalactite`, **When** their shake offset is computed, **Then** both call `shakeOffsetX` with their own amplitude and the resulting offset is unchanged.

---

### User Story 2 - One landing-row scan for every falling item (Priority: P1)

Placed bombs, deployable ladders, and falling stalactites each need to find "the first row below this column where the item comes to rest." That downward scan is written three times and has drifted: only the stalactite uses the sanctioned `isStandableCell` rule; the bomb and ladder re-derive standability from weaker predicates. After this feature all three call one `findLandingRow` in `engine/Standable.ts`, each passing its own standability predicate.

**Why this priority**: Three copies of the same physics rule have already diverged in a way that can place an item on a tile that is not actually standable. Consolidating removes a correctness trap.

**Independent Test**: Point each caller at `findLandingRow` and verify a placed bomb, deployable ladder, and falling stalactite each rest on the same row they do today, including over crumbly or occupied cells.

**Acceptance Scenarios**:

1. **Given** `Standable.ts`, **When** it is inspected, **Then** it exports `findLandingRow(level, col, fromRow, isSolidForKind)` — a downward scan parameterized by a caller-supplied standability predicate, returning `number | null` (null when no satisfying row exists before the level's bottom).
2. **Given** `DeployableLadder`, `PlacedBomb`, and `FallingStalactite`, **When** their landing-row logic is inspected, **Then** none contains its own downward scan; all three call `findLandingRow`.
3. **Given** a bomb falling onto a cell occupied by a block, **When** it is placed, **Then** its landing row is identical to the pre-refactor result (behavior preserved).

---

### User Story 3 - One TileAtlas type for both atlases (Priority: P2)

Ground and background terrain are drawn from two near-duplicate atlas modules. Both define their own quarter-turn enum, their own stride constant and `cell()` helper, and the same `mask → {sx, sy, rotation}` entry shape. After this feature a single shared `TileAtlas` type (plus its helpers) is imported by both, and each module keeps only its own tile table.

**Why this priority**: It removes a whole duplicated rendering primitive and pairs naturally with the shared `hash2D`/`pickVariant` from Story 1 (the two catalogs' variant pickers are also duplicated).

**Independent Test**: Inspect `GroundAtlas` and `BackgroundAtlas` — neither declares its own quarter-turn/stride/cell shape, and both import one `TileAtlas`.

**Acceptance Scenarios**:

1. **Given** a search for the quarter-turn enum and the stride/`cell` helper, **When** the code is inspected, **Then** each is defined once in the shared `TileAtlas` module and imported by both atlases.
2. **Given** `GroundAtlas` and `BackgroundAtlas`, **When** each is inspected, **Then** each retains only its own tile table and entry data.
3. **Given** the variant picker, **When** the catalogs select a variant, **Then** `StaticObjectsCatalog` and `BackgroundDecorCatalog` route through one shared `pickVariant` backed by `hash2D`.

---

### User Story 4 - One layout-file validation module (fixes the dropped-torch bug) (Priority: P2)

Raw level/blueprint files are validated and parsed in four places: the level registry, the blueprint data/registry, and the editor's state initializer. The validation logic is copy-pasted and has actually diverged — the editor's marker check omits the `torch` kind, so a level saved with a torch marker silently loses that torch on reload. After this feature one `layoutFile.ts` module owns that validation/parsing, all four consumers use it, and torch markers survive a save/reload round-trip.

**Why this priority**: This is the only user-visible bug in the phase (a data-loss bug in the level editor), so it carries real value beyond tidiness.

**Independent Test**: In the editor, place a torch marker, save, reload, and confirm the torch is still present; separately confirm the level and blueprint registries still load their files.

**Acceptance Scenarios**:

1. **Given** `layoutFile.ts`, **When** it is inspected, **Then** it exports the shared file-shape validators (`isLayout`, `isBackground`, `isMarkers`), `idFromPath`, and the level/blueprint module parser.
2. **Given** `level/levelRegistry`, `level/BlueprintData`, `level/blueprintRegistry`, and `editor/editorState`, **When** each is inspected, **Then** it imports from `layoutFile.ts` instead of holding its own copy.
3. **Given** a level with a torch marker, **When** it is saved then reloaded in the editor, **Then** the torch marker is retained (the bug is fixed).

---

### User Story 5 - Hazard and block kind unions derive from their registries (Priority: P2)

Hazard and block kinds are declared in three parallel places each (`HazardKind` vs `HAZARD_TYPES` vs `HAZARD_CHARS`; `BlockKind` vs `BlockDef.blockKind` vs `BLOCK_TYPES`), so adding a kind means editing several lists and risking drift. After this feature `HazardKind` and `BlockKind` are derived from their registry keys, and the character maps are typed against them, matching how enemies already do it.

**Why this priority**: It removes a known drift source and completes the registry pattern the codebase's own docs promise ("add a kind = one registry line").

**Independent Test**: Reference a kind that is not in the registry — it no longer type-checks; adding a registry entry automatically extends the kind union.

**Acceptance Scenarios**:

1. **Given** the hazard registry, **When** the types are inspected, **Then** `HazardKind` is `keyof typeof HAZARD_TYPES` and `HAZARD_CHARS` is a complete, typed map over it.
2. **Given** the block registry, **When** the types are inspected, **Then** `BlockKind` is `keyof typeof BLOCK_TYPES` and `BlockDef.blockKind` conforms to it.
3. **Given** the compiled code, **When** a kind is added to a registry, **Then** its union extends automatically without editing a parallel list.

---

### User Story 6 - Low-risk merges and dead-code removal (Priority: P3)

A handful of files are compatibility shims, single-consumer wrappers, or dead code: `EnemyAI` is a shim with one live function, `IrisTransition` is used only by the game-lifecycle, `Contact` and `Outcome` are two mutually dependent outcome-vocabulary modules, and `Coin` carries a proven-dead `coinFrameSource`. Separately, the theme carries two fruit pickups that should be one: a dormant placed-fruit `PickupType` (`entities/pickups/Fruit.ts`) whose `PickupKind`/`CollectibleMapper` plumbing is never exercised (no fruit marker exists and `placeCollectibles` is always called with an empty fruit list), and the live `bonusFruit` the question-mark block spawns. After this feature the dead placed fruit is deleted and the live `bonusFruit` is renamed to `fruit` (its `BonusFruit.ts` entity merges into the existing `entities/Fruit.ts`), so exactly one fruit pickup remains and the question-mark reward is unchanged.

**Why this priority**: Pure cleanup with no new capability; lowest risk, so it runs last.

**Independent Test**: No imports resolve to the removed modules, no remaining reference to the dead `coinFrameSource`, and the full test suite passes.

**Acceptance Scenarios**:

1. **Given** `EnemyAI`, **When** its live `stepEnemyHitReaction` behavior is migrated and its tests moved, **Then** the shim file is deleted with no dangling imports.
2. **Given** `IrisTransition`, **When** its math is merged into the game-lifecycle module, **Then** the transition behaves identically and the standalone file is deleted.
3. **Given** `Contact` and `Outcome`, **When** they are merged into one outcome-vocabulary module, **Then** both are importable from that single home and their mutual dependency is gone.
4. **Given** `Coin`, **When** `coinFrameSource` is removed, **Then** no code references it and all tests pass.
5. **Given** the two fruit pickups, **When** they are consolidated, **Then** the dormant placed fruit is deleted (`CollectiblePlacement.spriteType` narrows to `'coin'`, `placeCollectibles` drops fruit positions) and the live `bonusFruit` is renamed to `fruit` — `PickupKind` becomes `'coin' | 'fruit' | 'key' | 'heart' | 'bomb'` with `fruit` naming the question-mark reward, `PICKUP_TYPES.fruit` is the former `bonusFruit` pickup, and every `bonusFruit*`/`BonusFruit*`/`BONUS_FRUIT_*` identifier is renamed to `fruit*`/`Fruit*`/`FRUIT_*`. The question-mark block still pops one fruit that rises to the tile above and carries its fact; no `bonusFruit` reference remains.

---

### Edge Cases

- ✅ **A primitive's formula must stay byte-equivalent** (e.g., the salted hash variant, the amplitude-scaled shake) — moving it must not change any output, or the dedup is not "safe". Resolved by FR-004/FR-006 (salt & amplitude parameters) and the byte-for-byte preservation assumption.
- ✅ **A caller whose local copy used slightly different constants or types than the shared primitive** — the shared primitive must accept the caller's parameters (hash salt, shake amplitude) so no behavior changes. Resolved by FR-004/FR-006/FR-007 (parameterized salt, amplitude, predicate).
- ✅ **The editor's `isMarkerEntry` is weaker than `LevelParser.normalizeMarkerEntry`** — after unifying, the editor must use the stricter, complete validator so `torch` (and any future marker kinds) round-trip. Resolved by FR-014/FR-015.
- ✅ **Kind derivation must not loosen typing** — `HAZARD_CHARS`/`BLOCK_TYPES` must remain exhaustive so an unhandled kind is a compile error, not a runtime miss. Resolved by FR-016/FR-017 and SC-005.
- ✅ **Merging `Contact`+`Outcome` must not reintroduce a higher-layer import** — the merged module stays a `contracts/` leaf. Resolved by FR-020.
- ✅ **Removed files (`EnemyAI`, `IrisTransition`, `coinFrameSource`, and the placed-fruit `PickupType`) must leave no dangling import or test path.** Resolved by FR-024 and SC-007.
- ✅ **The `bonusFruit` → `fruit` rename must not change the question-mark reward** — the renamed fruit still rises from the block into the tile above (`FRUIT_RISE_DURATION_SECONDS`), still carries its Certificate/Project fact, still has no bob (its rise tween is the motion), and still counts in `levelTotals.fruits`. Only identifiers move; the dead placed-fruit `PickupType` and its marker plumbing are deleted. Resolved by FR-022 and US6 scenario 5.
- ✅ **`findLandingRow` must return `null` when no landing row exists** — the bomb and stalactite depend on `null` (bomb falls out, stalactite goes `gone`); the ladder clamps to `fromRow` and must keep that by mapping `null` back to its own fallback. Unifying must not turn an open shaft into a hard floor. Resolved by FR-007/FR-008 and the null-return assumption.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A single math module `shared/math.ts` MUST exist and export `clamp01`, `smoothstep`, `lerp`, `hash2D`, `pulse`, and `shakeOffsetX`.
- **FR-002**: `shared/math.ts` MUST be a pure leaf: it MUST import nothing from `engine/`, `entities/`, `level/`, editor, state, or `contracts/` modules.
- **FR-003**: Every duplicated site MUST import the shared primitive; no inline re-implementation of these formulas may remain in `engine/`, `entities/`, or `level/`.
- **FR-004**: `hash2D` MUST accept a salt so `Lighting`'s salted position hash uses the same function.
- **FR-005**: `Lighting`'s fog falloff MUST reuse the shared `smoothstep` and `hash2D` rather than re-deriving them.
- **FR-006**: `CrumblingFloor` and `FallingStalactite` MUST compute their shake via `shakeOffsetX`, each passing its own amplitude; resulting offsets MUST be unchanged.
- **FR-007**: `engine/Standable.ts` MUST export `findLandingRow(level, col, fromRow, isSolidForKind)` that returns the first row at or below `fromRow` satisfying the caller-supplied standability predicate, or `null` when no such row exists before the level's bottom.
- **FR-008**: `DeployableLadder`, `PlacedBomb`, and `FallingStalactite` MUST route their downward landing scans through `findLandingRow` with their own predicate; each MUST preserve its current placement behavior.
- **FR-009**: A shared `TileAtlas` type and its helpers (quarter-turn, stride/`cell`, and the `mask → {sx, sy, rotation}` entry shape) MUST exist and be imported by both `GroundAtlas` and `BackgroundAtlas`.
- **FR-010**: `GroundAtlas` and `BackgroundAtlas` MUST keep only their own tile tables, importing everything shared from the `TileAtlas` module.
- **FR-011**: The variant picker (`pickVariant`) MUST be shared, backed by `hash2D`; `BackgroundDecorCatalog`'s duplicated picker MUST be folded into the shared variant catalog.
- **FR-012**: A single `layoutFile.ts` module MUST own the raw-file validation/parsing vocabulary: `isLayout`/`isBackground`/`isMarkers`, `idFromPath`, and the level/blueprint module parser.
- **FR-013**: `level/levelRegistry`, `level/BlueprintData`, `level/blueprintRegistry`, and `editor/editorState` MUST import from `layoutFile.ts` and hold no duplicated copy.
- **FR-014**: The editor's marker validation MUST use the same complete validator as `LevelParser.normalizeMarkerEntry` (including the `torch` kind), fixing the torch-marker-drop bug.
- **FR-015**: A persisted torch marker MUST survive a save → reload round-trip in the editor.
- **FR-016**: `HazardKind` MUST be derived as `keyof typeof HAZARD_TYPES`, with `HAZARD_CHARS` a complete typed map over it.
- **FR-017**: `BlockKind` MUST be derived as `keyof typeof BLOCK_TYPES`, with `BlockDef.blockKind` conforming to it.
- **FR-018**: The dead `EnemyAI` compatibility shim MUST be removed after its live `stepEnemyHitReaction` behavior is migrated and its tests relocated; behavior MUST be preserved.
- **FR-019**: `IrisTransition` MUST be merged into the game-lifecycle module (its only consumer) with its math preserved, and the standalone file removed.
- **FR-020**: `Contact` and `Outcome` MUST merge into a single outcome-vocabulary module under `contracts/`, resolving their mutual dependency; the merged module MUST remain a `contracts/` leaf.
- **FR-021**: The dead `coinFrameSource` (in `Coin.ts`) MUST be removed, with no remaining references.
- **FR-022**: The two fruit pickups MUST consolidate into one `fruit`. The dormant placed-fruit `PickupType` (`entities/pickups/Fruit.ts`) is deleted, `CollectiblePlacement.spriteType` narrows to `'coin'`, and `placeCollectibles` no longer accepts a `fruit` position list. The live `bonusFruit` MUST be renamed to `fruit`: `BonusFruit.ts` merges into `entities/Fruit.ts` (constants + entity), `PickupKind` drops `'bonusFruit'` (its `fruit` member now names the question-mark reward), `PICKUP_TYPES.fruit` is the former `bonusFruit` pickup, and every `bonusFruit*`/`BonusFruit*`/`BONUS_FRUIT_*` identifier is renamed (`bonusFruitStates` → `fruitStates`, `spawnBonusFruit` → `spawnFruit`, `tickBonusFruit` → `tickFruit`, `bonusFruitY` → `fruitY`, `checkBonusFruitCollisions` → `checkFruitCollisions`, `drawBonusFruits` → `drawFruits`, `BonusFruitState` → `FruitState`, `BONUS_FRUIT_RISE_DURATION_SECONDS` → `FRUIT_RISE_DURATION_SECONDS`). The question-mark reward's behavior MUST be unchanged. The consolidation keeps the two-file split — `entities/Fruit.ts` (model) and `pickups/Fruit.ts` (`PickupType` descriptor) — matching coin/key/heart/bomb; merging them into a single file is R-006, out of scope here.
- **FR-023**: Each shared primitive/helper MUST have exactly one home; no compatibility re-export that preserves a duplicated or obsolete path is permitted.
- **FR-024**: The change MUST preserve behavior: the full test suite MUST pass (import paths updated, tests relocated only) and the production build MUST succeed.
- **FR-025**: The change MUST NOT regress R-001's layer invariants (no `level/ → engine/`, no `engine/ → state`, `contracts/` stays a leaf).

### Key Entities

- **Math primitives** (`shared/math.ts`): `clamp01`, `smoothstep`, `lerp`, `hash2D`, `pulse`, `shakeOffsetX` — the single home for duplicated scalar/position math.
- **TileAtlas**: the shared atlas type + helpers (quarter-turn, stride/`cell`, entry shape) imported by `GroundAtlas` and `BackgroundAtlas`.
- **Variant picker** (`pickVariant` + `hash2D`): the shared deterministic position-based variant selection used by the static-object and background-decor catalogs.
- **`findLandingRow`**: the shared downward landing-row scan in `engine/Standable.ts`.
- **`layoutFile.ts`**: the shared raw-file validation/parsing module, plus the corrected marker validator (including `torch`).
- **Kind unions**: `HazardKind`/`BlockKind` derived from their registries.
- **Merged/removed modules**: `EnemyAI` (removed), `IrisTransition` (merged), `Contact`+`Outcome` (merged), `coinFrameSource` (removed), placed-fruit `PickupType` + marker plumbing (removed), `bonusFruit` → `fruit` (renamed/merged into `entities/Fruit.ts`).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A static inspection finds each of the six math primitives defined exactly once (zero duplicated re-implementations across the platformer theme).
- **SC-002**: The three landing-row scans resolve to a single `findLandingRow`; no module contains its own downward scan.
- **SC-003**: `GroundAtlas` and `BackgroundAtlas` share one `TileAtlas` type; quarter-turn, stride, and cell logic each appear once.
- **SC-004**: The torch-marker-drop bug is fixed — a level saved with a torch marker retains it after reload.
- **SC-005**: `HazardKind` and `BlockKind` are derived from their registries; a kind added to a registry extends its union without editing a parallel list.
- **SC-006**: The full test suite passes and the production build succeeds; a manual browser pass over a cave level (torches, falling stalactites, bombs, ladders, ground/background terrain) shows no visible or behavioral difference.
- **SC-007**: Dead code is removed with no remaining references — the `EnemyAI` shim, `coinFrameSource`, and the placed-fruit `PickupType` are gone and nothing imports them; no `bonusFruit` identifier survives the rename (a grep for `bonusFruit` returns nothing).

## Assumptions

- **`core/math.ts` in the issue maps to `shared/math.ts`.** Issue #90 names the target `core/math.ts`; the six primitives are pure logic (not layer-boundary vocabulary), so they live in a new `shared/` folder (`src/themes/platformer/shared/math.ts`) — a pure-leaf sibling to `contracts/` — rather than inside it. `shared/` imports nothing, exactly like `contracts/`.
- **`TileAtlas` lives in `engine/`.** Its only consumers are the two engine atlas modules, and it is render-specific, so it is not promoted to `contracts/`.
- **`layoutFile.ts` lives in `level/`.** It is raw-file parsing/validation vocabulary, and the editor already consumes `level/` parsing modules; the editor imports it from `level/`.
- **`pickVariant` is shared as part of the variant-catalog dedup (L4 + X3),** colocated with the static-object/background-decor catalog rather than inside the pure math module.
- **`findLandingRow` preserves each caller's predicate.** The three scans legitimately differ in what counts as a standable/resting cell; the helper parameterizes the predicate instead of forcing one rule.
- **`findLandingRow` returns `null`, never clamps.** The bomb (`bombLandingRow`) and stalactite (`fallingStalactiteLandingRow`) already return `null` when the column has no floor before the bottom — the bomb falls out and the stalactite goes `gone`. Unifying must keep `null` (not clamp to the last row, which would turn open shafts into floors); the ladder (`ladderLandingRow`), which today returns `row` at minimum, keeps that by mapping `null` back to its own fallback.
- **The three scans return different rows (off-by-one).** The bomb and ladder return the *resting* row (the last non-solid cell, one above the first solid); the stalactite returns the *standable* row (the solid itself, with `fallingStalactiteRestOffsetY` offsetting one sprite-height above). Each caller keeps its own one-row adjustment; the shared helper only parameterizes the solidity predicate, so behavior is byte-preserved.
- **Behavior is byte-for-byte preserved.** The only sanctioned body changes are deduplication into shared helpers, import retargeting, the Contact/Outcome and IrisTransition merges, the `bonusFruit`→`fruit` rename (a pure identifier rename), and the dead-code removals — never a change to gameplay, visuals, or level data.
- **`GridCell` is out of scope.** The analysis mentions it alongside Phase-0 math, but issue #90 does not list it and no such shared type exists today; it is deferred to the feature that actually needs it.
- **No data migration.** Authored levels, markers, torch strengths, and tuning are unchanged.

## Out of Scope

- The `LightSource` abstraction and the rest of the lighting rework (L1–L3) — **R-003**.
- The transient-effect registry and the full timed-tile state-machine unification (E1–E4) beyond extracting `shakeOffsetX` — **R-004**.
- `SpeechBubble`, **full** pickup unification — R-006's `kind` discriminator, generic collision/draw + `spawn`/`onCollect`, and folding each pickup's model + `PickupType` descriptor into a single file per family (X6/F9) — is out of scope. Only the fruit consolidation scoped to US6 (the placed-fruit removal plus the `bonusFruit`→`fruit` rename, which keeps the two-file model/descriptor split) is in scope here. Also out of scope: registry-dispatch completion, world items, static-tile registry/renderer split, mapper/editor unification, damage and bomb systems, per-domain state stores, and sprite asset/atlas organization — **R-003, R-005–R-013**.
- Any change to gameplay, balance, visuals, level data, or public behavior.
- The `X5` (Torch + Lighting merge), `X7` (chest registry), and `X8` (pot semantics) findings — those belong to later features.
- `GridCell` (see Assumptions).
