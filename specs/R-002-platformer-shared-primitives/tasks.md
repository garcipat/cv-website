# Tasks: Platformer Shared Primitives & Dedup

**Feature**: R-002 Platformer Shared Primitives & Dedup
**Input**: Design documents from `/specs/R-002-platformer-shared-primitives/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (all present)

**Nature of this feature**: A **behavior-preserving refactor**. The acceptance bar is byte-for-byte
behavior preservation (FR-024, SC-006) — no gameplay, visual, or level-data change. Every task is a
deduplication, import retargeting, merge, or dead-code removal. Tests are **relocated, never deleted
or weakened**, and new pure modules get co-located unit tests (constitution Principle II, plan.md).

**Tests**: New pure modules (`shared/math.ts`, `TileAtlas.ts`, `layoutFile.ts`, `findLandingRow`) are
TDD'd — their co-located unit tests are written first (failing), then the module is implemented to pass
them (constitution Principle II). Retarget/merge tasks are behavior-preserving (green-to-green): the
existing suite is the guard, and tests are relocated, never deleted or weakened (FR-024, SC-006, SC-007).

**Path convention**: single project under `src/themes/platformer/`. All paths below are relative to
the repo root `D:\Workspace\cv-website`.

---

## Phase 1: Setup (Baseline)

**Purpose**: Establish the pre-refactor green baseline that every later phase must not regress.

- [X] T001 Run the full test suite (`npm test`) and production build (`npm run build`) from repo root `D:\Workspace\cv-website`; confirm both pass and record the result as the FR-024/SC-006 baseline before any edits.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the pure-leaf `shared/` math module. This is the single blocking prerequisite —
US1 (retarget math), US3 (`pickVariant` → `hash2D`), and US6 (`lerp` for the IrisTransition merge)
all import from it.

**⚠️ CRITICAL**: No user story that consumes math may begin until this phase is complete.

- [X] T002 Create co-located `src/themes/platformer/shared/math.test.ts` with `{method}-{condition}-{expected-result}` unit tests for all six primitives, asserting byte-equivalence to the former inline formulas (`hash2D` uint32 identity at salt 0/1/2/3, `shakeOffsetX` at amplitude 1 and 1.5, `pulse(0|0.25|0.5)`, `lerp(a,b,0|1)`) (TDD — written first, red).
- [X] T003 Create `src/themes/platformer/shared/math.ts` exporting `clamp01`, `smoothstep`, `lerp`, `hash2D`, `pulse`, and `shakeOffsetX` with the exact signatures from `specs/R-002-platformer-shared-primitives/contracts/math.md`; it MUST be a pure leaf that imports nothing (FR-001, FR-002, FR-004). Makes T002 green.

**Checkpoint**: `shared/math.ts` + tests green; US1/US3/US6 can import from it.

---

## Phase 3: User Story 1 — Shared math primitives live in one module (Priority: P1) 🎯 MVP

**Goal**: Every duplicated scalar/position math formula now lives once in `shared/math.ts`; every former
inline site imports it (FR-003). No inline re-implementation remains in `engine/`, `entities/`, or `level/`.

**Independent Test** (SC-001, quickstart §3):
```bash
rg "t \* t \* \(3 - 2 \* t\)" src/themes/platformer     # smoothstep → shared/math.ts only
rg "374761393" src/themes/platformer                     # hash constant → shared/math.ts only
rg "Math\.sin\(elapsed \* 40\)" src/themes/platformer    # shake → shared/math.ts only
```

### Implementation for User Story 1

> Files touched by US3 (`StaticObjectsCatalog`, `BackgroundDecorCatalog` — `pickVariant`→`hash2D`)
> and US6 (`IrisTransition`→`lerp`, `BonusFruit`→`Fruit` `clamp01`) are intentionally excluded here to
> avoid double-editing; those call sites are retargeted in their owning story.

- [X] T004 [P] [US1] Retarget `src/themes/platformer/engine/Lighting.ts` — replace the four inline `smoothstep` sites (`fogPeekStrengthAt`, `torchGlowStrengthAt`, `playerGlowStrengthAt`, `enemyEyeOpacity`), the `clamp01` in `enemyEyeOpacity`, the salted position hash (`cellHash01` → `hash2D(col, row, salt)`), and the repeating `pulse` sites (`torchPulseScale`, `enemyEyeBobOffset`, fog pulse) with imports from `shared/math.ts`; leave the geometric `Math.sin(jitterAngle)` in `fogPuffAt` as-is (FR-003, FR-004, FR-005, research R1.2/R1.3).
- [X] T005 [P] [US1] Retarget `src/themes/platformer/engine/CrumblingFloor.ts` — `clamp01` (`crackRatioAt`, `reformRatioAt`) and `shakeOffsetX(elapsed, 1)` from `shared/math.ts` (FR-003, FR-006).
- [X] T006 [P] [US1] Retarget `src/themes/platformer/engine/BlockAI.ts` — `clamp01` from `shared/math.ts` (FR-003).
- [X] T007 [P] [US1] Retarget `src/themes/platformer/engine/MushroomSquash.ts` — `clamp01` from `shared/math.ts` (FR-003).
- [X] T008 [P] [US1] Retarget `src/themes/platformer/engine/CollectionEffects.ts` — `clamp01` and the two inline `lerp` sites from `shared/math.ts` (FR-003).
- [X] T009 [P] [US1] Retarget `src/themes/platformer/engine/DeployableLadder.ts` — `clamp01` (`revealedStepCount`) from `shared/math.ts` (FR-003).
- [X] T010 [P] [US1] Retarget `src/themes/platformer/engine/FallingStalactite.ts` — `shakeOffsetX(elapsed, 1.5)` from `shared/math.ts` (FR-003, FR-006).
- [X] T011 [P] [US1] Retarget `src/themes/platformer/entities/Torch.ts` — `hash2D` (`torchPhase`) from `shared/math.ts` (FR-003).
- [X] T012 [P] [US1] Retarget `src/themes/platformer/entities/hazards/FloorSpike.ts` — `clamp01` from `shared/math.ts` (FR-003, research R1.3 extra site).
- [X] T013 [P] [US1] Retarget `src/themes/platformer/engine/Renderer.ts` — the two `(sin(…) + 1) / 2` pulse waves from `shared/math.ts` (FR-003).

**Checkpoint**: The six primitives are defined exactly once; `rg` for each formula hits only `shared/math.ts`.

---

## Phase 4: User Story 2 — One landing-row scan for every falling item (Priority: P1)

**Goal**: `DeployableLadder`, `PlacedBomb`, and `FallingStalactite` all call one `findLandingRow`
in `engine/Standable.ts`, each passing its own standability predicate (FR-007, FR-008).

**Independent Test** (SC-002, quickstart §3): point each caller at `findLandingRow` and verify a placed
bomb, deployable ladder, and falling stalactite rest on the same row they do today (incl. crumbly/occupied
cells and the open-shaft `null` behavior).

### Implementation for User Story 2

- [X] T014 [US2] Extend `src/themes/platformer/engine/Standable.test.ts` with `findLandingRow` unit tests: first-solid-row return, `null` on an open shaft, predicate parameterization, `fromRow + 1` (strictly-below) semantics (TDD — written first, red).
- [X] T015 [US2] Add `LandingSolidPredicate` type and `findLandingRow(level, col, fromRow, isSolidForKind)` to `src/themes/platformer/engine/Standable.ts` per `specs/R-002-platformer-shared-primitives/contracts/landing-row.md` — scans `fromRow + 1 … level.height - 1`, returns the first solid row or `null` (FR-007). Makes T014 green.
- [X] T016 [P] [US2] Retarget `src/themes/platformer/engine/FallingStalactite.ts` — `fallingStalactiteLandingRow` calls `findLandingRow` with predicate `(l,c,r) => isStandableCell(l, blocks, crumblingFloorStates, c, r)`, returns the row as-is (FR-008).
- [X] T017 [P] [US2] Retarget `src/themes/platformer/engine/PlacedBomb.ts` — `bombLandingRow` calls `findLandingRow` with predicate `(l,c,r) => tileGround(l,c,r) || isBlockOccupied(blocks,c,r)`; map `null → null`, else `row - 1` (preserves crumbling-floor special case) (FR-008).
- [X] T018 [P] [US2] Retarget `src/themes/platformer/engine/DeployableLadder.ts` — `ladderLandingRow` calls `findLandingRow` with predicate `(l,c,r) => isSolid(tileAt(l,c,r))`; map `null → level.height - 1`, else `row - 1` (FR-008).

**Checkpoint**: No module contains its own downward scan; all three call `findLandingRow`.

---

## Phase 5: User Story 3 — One TileAtlas type for both atlases (Priority: P2)

**Goal**: A single shared `TileAtlas` type + helpers is imported by `GroundAtlas` and `BackgroundAtlas`;
the duplicated `pickVariant` collapses into one `hash2D`-backed export (FR-009, FR-010, FR-011).

**Independent Test** (SC-003): neither atlas declares its own quarter-turn/stride/cell shape; both import
`TileAtlas`; `StaticObjectsCatalog` and `BackgroundDecorCatalog` route variant selection through one `pickVariant`.

### Implementation for User Story 3

- [X] T019 [US3] Create co-located `src/themes/platformer/engine/TileAtlas.test.ts` covering `atlasCell` stride math and the `QuarterTurns`/`TileAtlasEntry` shape (TDD — written first, red).
- [X] T020 [US3] Create `src/themes/platformer/engine/TileAtlas.ts` exporting `QuarterTurns`, `TileAtlasEntry`, `ATLAS_STRIDE = 19`, and `atlasCell(col, row)` per `specs/R-002-platformer-shared-primitives/contracts/tile-atlas.md` (FR-009). Makes T019 green.
- [X] T021 [P] [US3] Retarget `src/themes/platformer/engine/GroundAtlas.ts` — import `QuarterTurns`/`ATLAS_STRIDE`/`atlasCell`; define `GroundAtlasEntry extends TileAtlasEntry { kind: GroundTileKind }`; keep `GROUND_ATLAS`, `groundTileKind`, `GRASS_CELLS`, `GRASS_SOURCE_HEIGHT` (FR-010).
- [X] T022 [P] [US3] Retarget `src/themes/platformer/engine/BackgroundAtlas.ts` — import `QuarterTurns`/`ATLAS_STRIDE`/`TileAtlasEntry`; define `BackgroundAtlasEntry extends TileAtlasEntry`; keep `BACKGROUND_ATLAS_ROW_PITCH = 60` and its material-pitched `cell` (FR-010, research R3.1).
- [X] T023 [P] [US3] Reimplement and export `pickVariant<T>(variants, col, row)` in `src/themes/platformer/engine/StaticObjectsCatalog.ts` over `hash2D` (`hash2D(col,row) % variants.length`), preserving the empty-array guard (FR-011, research R3.2).
- [X] T024 [US3] Retarget `src/themes/platformer/engine/BackgroundDecorCatalog.ts` — remove its duplicated `pickVariant` (and inline hash) and import `pickVariant` from `StaticObjectsCatalog.ts` (FR-011).

**Checkpoint**: `QuarterTurns`, `ATLAS_STRIDE`, and the entry shape each appear once; `pickVariant` is shared.

---

## Phase 6: User Story 4 — One layout-file validation module (fixes the dropped-torch bug) (Priority: P2)

**Goal**: One `level/layoutFile.ts` owns raw-file validation/parsing; all four consumers use it; the
editor's marker guard is fixed so torch markers survive a save→reload round-trip (FR-012–FR-015).

**Independent Test** (SC-004, quickstart §4.1): in the editor, place a torch marker, save, reload, confirm
the torch is still present; separately confirm the level and blueprint registries still load their files.

### Implementation for User Story 4

- [X] T025 [P] [US4] Export `normalizeMarkerEntry` from `src/themes/platformer/level/LevelParser.ts` (currently private) so the editor can reuse the complete validator (FR-014).
- [X] T026 [US4] Create co-located `src/themes/platformer/level/layoutFile.test.ts` covering `idFromPath`, each validator (including the non-empty/empty asymmetry), and both parsers (TDD — written first, red).
- [X] T027 [US4] Create `src/themes/platformer/level/layoutFile.ts` exporting `idFromPath`, `isLayout`, `isBackground`, `isMarkers`, `parseLevelModules`, and `parseBlueprintModules` per `specs/R-002-platformer-shared-primitives/contracts/layout-file.md`; preserve the `isLayout` non-empty vs `isBackground` may-be-empty asymmetry; no `engine/` import (FR-012). Makes T026 green.
- [X] T028 [P] [US4] Retarget `src/themes/platformer/level/levelRegistry.ts` — import `idFromPath`, `isLayout`, `isBackground`, `isMarkers`, `parseLevelModules` from `layoutFile.ts`; delete its local copies (FR-013).
- [X] T029 [P] [US4] Retarget `src/themes/platformer/level/BlueprintData.ts` — import `isLayout`, `isBackground`, `isMarkers` from `layoutFile.ts`; delete its local copies (FR-013).
- [X] T030 [P] [US4] Retarget `src/themes/platformer/level/blueprintRegistry.ts` — import `idFromPath`, `parseBlueprintModules` from `layoutFile.ts`; delete its local copies (FR-013).
- [X] T031 [US4] Retarget `src/themes/platformer/editor/editorState.ts` — replace the weaker `isMarkerEntry` with `normalizeMarkerEntry(value) !== null` (imported from `level/LevelParser.ts`), fixing the torch-marker-drop bug; confirm persisted marker entries are normalized so an out-of-range torch `strength` cannot leak (FR-014, FR-015, research R4.2).

**Checkpoint**: All four consumers import from `layoutFile.ts`; a torch marker round-trips in the editor.

---

## Phase 7: User Story 5 — Hazard and block kind unions derive from their registries (Priority: P2)

**Goal**: `HazardKind` and `BlockKind` are derived as `keyof typeof <REGISTRY>`; the character map and
`BlockDef.blockKind` are typed against them (FR-016, FR-017).

**Independent Test** (SC-005): referencing a kind absent from a registry no longer type-checks; adding a
registry entry auto-extends the union.

### Implementation for User Story 5

- [X] T032 [P] [US5] In `src/themes/platformer/entities/hazards/index.ts`, export `HazardKind = keyof typeof HAZARD_TYPES` as the single canonical name, consolidating the existing `HazardTypeKey` alias (FR-016, FR-023).
- [X] T033 [US5] Retarget `src/themes/platformer/level/LevelParser.ts` — remove the hand-written `HazardKind` union and import `HazardKind` from `entities/hazards/index.ts`; keep `HAZARD_CHARS` as a complete typed `Record<string, { hazardType: HazardKind; facing: HazardFacing } | undefined>` (FR-016).
- [X] T034 [P] [US5] In `src/themes/platformer/entities/blocks/index.ts`, export `BlockKind = keyof typeof BLOCK_TYPES` (FR-017).
- [X] T035 [US5] Retarget `src/themes/platformer/entities/Block.ts` — replace the hand-written `BlockKind` union with an import of `BlockKind` from `./blocks` (FR-017).
- [X] T036 [US5] Retarget `src/themes/platformer/types.ts` — change `BlockDef.blockKind` from the literal union to imported `BlockKind` (FR-017).

**Checkpoint**: `keyof typeof` derives both unions; a new registry line extends them without a parallel edit.

---

## Phase 8: User Story 6 — Low-risk merges and dead-code removal (Priority: P3)

**Goal**: Remove the `EnemyAI` shim, `IrisTransition`, the `Contact`+`Outcome` split, `coinFrameSource`,
and the dormant placed-fruit pickup; rename the live `bonusFruit` → `fruit` (FR-018–FR-022). Runs last
(lowest risk), touching `PlatformerPage.tsx` and many small files.

**Independent Test** (SC-007, quickstart §3): no import resolves to a removed module; no remaining
`coinFrameSource`/`bonusFruit` reference; the full test suite passes.

### Implementation for User Story 6

- [X] T037 [P] [US6] Migrate `stepEnemyHitReaction` from `src/themes/platformer/engine/EnemyAI.ts` into `src/themes/platformer/entities/enemies/shared.ts` (the enemy family owns its hit reaction); remove the dead `stepEnemyPatrol`; retarget `src/themes/platformer/PlatformerPage.tsx` (`stepEnemyHitReaction` import) and any other importer; delete `src/themes/platformer/engine/EnemyAI.ts` (FR-018, research R6.1).
- [X] T038 [US6] Relocate `src/themes/platformer/engine/EnemyAI.test.ts` coverage — move the `stepEnemyHitReaction` describe block into `src/themes/platformer/entities/enemies/shared.test.ts`; migrate the `stepEnemyPatrol` characterization tests to call `typeOf(enemy).movement.step(...)` directly (preserving coverage); delete `src/themes/platformer/engine/EnemyAI.test.ts` (FR-018).
- [X] T039 [P] [US6] Merge `src/themes/platformer/engine/IrisTransition.ts` into `src/themes/platformer/engine/GameLifecycle.ts` — move the iris constants and `maxIrisRadius`; replace `lerpRadius` with the shared `lerp` from `shared/math.ts`; retarget `src/themes/platformer/PlatformerPage.tsx` (`maxIrisRadius` import); delete `src/themes/platformer/engine/IrisTransition.ts` (FR-019, research R6.2).
- [X] T040 [US6] Merge `src/themes/platformer/engine/IrisTransition.test.ts` coverage into `src/themes/platformer/engine/GameLifecycle.test.ts`; delete `src/themes/platformer/engine/IrisTransition.test.ts` (FR-019).
- [X] T041 [P] [US6] Fold the contact vocabulary (`ContactSide`, `Contact`, `CollisionOutcome`) from `src/themes/platformer/contracts/Contact.ts` into `src/themes/platformer/contracts/Outcome.ts` (staying a `contracts/` leaf); retarget `src/themes/platformer/engine/Collision.ts`; delete `src/themes/platformer/contracts/Contact.ts` (FR-020, research R6.3).
- [X] T042 [P] [US6] Remove `coinFrameSource` from `src/themes/platformer/entities/Coin.ts`; retarget the HUD coin-counter icon in `src/themes/platformer/PlatformerPage.tsx` from `{ ...coinFrameSource(0), size: COIN_FRAME_SIZE }` to `{ ...frameSource(COIN_SHEET, 0), size: COIN_FRAME_SIZE }` (FR-021, research R6.4).
- [X] T043 [US6] Update `src/themes/platformer/entities/Coin.test.ts` (delete the `coinFrameSource` describe block) and `src/themes/platformer/entities/pickups/PickupType.test.ts` (drop the `coinFrameSource` import/equivalence assertion) (FR-021).
- [X] T044 [P] [US6] Update `src/themes/platformer/contracts/PickupKind.ts` to `'coin' | 'fruit' | 'key' | 'heart' | 'bomb'` (drop both the dead placed `'fruit'` and `'bonusFruit'`; `fruit` now names the question-mark reward) and `src/themes/platformer/entities/pickups/index.ts` `PICKUP_TYPES = { coin, fruit, key, heart, bomb }` (FR-022).
- [X] T045 [US6] Delete the dormant placed-fruit `src/themes/platformer/entities/pickups/Fruit.ts`; rename `src/themes/platformer/entities/pickups/BonusFruit.ts` → `src/themes/platformer/entities/pickups/Fruit.ts` with key `'fruit'` and `PickupType<FruitState>` (FR-022).
- [X] T046 [US6] Merge `src/themes/platformer/entities/BonusFruit.ts` into `src/themes/platformer/entities/Fruit.ts` (constants + `FruitState`/`spawnFruit`/`tickFruit`/`fruitY`/`FRUIT_RISE_DURATION_SECONDS`); retarget its rise `clamp01` to `shared/math.ts`; apply the FR-022 identifier rename (`bonusFruitStates`→`fruitStates`, `spawnBonusFruit`→`spawnFruit`, `tickBonusFruit`→`tickFruit`, `bonusFruitY`→`fruitY`, `checkBonusFruitCollisions`→`checkFruitCollisions`, `drawBonusFruits`→`drawFruits`, `BonusFruitState`→`FruitState`, `BONUS_FRUIT_RISE_DURATION_SECONDS`→`FRUIT_RISE_DURATION_SECONDS`) across `src/themes/platformer/`; delete `src/themes/platformer/entities/BonusFruit.ts` (FR-022).
- [X] T047 [P] [US6] Narrow `CollectiblePlacement.spriteType` to `'coin'`, drop `CollectibleMarkerPositions.fruit`, and remove the fruit branch in `placeCollectibles` in `src/themes/platformer/level/CollectibleMapper.ts` (FR-022).
- [X] T048 [US6] Retarget `src/themes/platformer/PlatformerState.ts` — change `placeCollectibles({ coin: COIN_TILES.value, fruit: [] })` to `placeCollectibles(COIN_TILES.value)` (FR-022).
- [X] T049 [US6] Update tests for the fruit consolidation: drop fruit fixtures from `src/themes/platformer/level/CollectibleMapper.test.ts`; fix `makeFruitPlacement` in `src/themes/platformer/engine/Renderer.test.ts`; point the `fruit` assertion in `src/themes/platformer/entities/pickups/index.test.ts` at the renamed bonus-fruit pickup; rename/fold `src/themes/platformer/entities/BonusFruit.test.ts` into `src/themes/platformer/entities/Fruit.test.ts` (FR-022).

**Checkpoint**: No `bonusFruit`, `BonusFruit`, `coinFrameSource`, `IrisTransition`, or `Contact` reference remains (grep returns nothing except docs); `src/themes/platformer/engine/EnemyAI.ts`, `contracts/Contact.ts`, and the dormant `pickups/Fruit.ts` are gone.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Full-suite verification, static-inspection acceptance, manual browser pass, and feature-tracking update.

- [X] T050 Run the full test suite (`npm test`) and production build (`npm run build`) from repo root; both MUST pass with no new dependency and no bundle regression (FR-024, SC-006).
- [X] T051 Run the static-inspection greps from `specs/R-002-platformer-shared-primitives/quickstart.md` §3 (SC-001–SC-005, SC-007) and the layer-invariant check (FR-025); confirm each primitive/helper has exactly one home and no `level/ → engine/`, `engine/ → state`, or `contracts/`/`shared/` higher-layer import.
- [ ] T052 Perform the manual browser pass from `quickstart.md` §4 over a cave level (torches incl. save→reload, falling stalactites, bombs, ladders, ground/background terrain, player light/fog/enemy eyes, HUD coin icon) and confirm no visible difference (SC-006).
- [X] T053 Update `docs/Features.md` — prefix the `R002` node label with `✅ ` and add `class R002 done` to the dependency diagram (per `AGENTS.md` feature-tracking rules). Do not commit; wait for an explicit request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run first to capture the baseline.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS** US1, US3, US6 (the math consumers).
- **User Stories (Phase 3–8)**: All depend on Foundational. Recommended order P1 → P2 → P3.
- **Polish (Phase 9)**: Depends on all desired user stories being complete.

### User Story Dependencies

| Story | Priority | Depends on | Notes |
| --- | --- | --- | --- |
| US1 (math retarget) | P1 | Foundational (`shared/math.ts`) | Independent of US2–US6. |
| US2 (`findLandingRow`) | P1 | None beyond Foundational | Independent of US1/US3–US6. |
| US3 (TileAtlas + `pickVariant`) | P2 | Foundational (`hash2D`) | Completes US1's "StaticObjectsCatalog/BackgroundDecorCatalog call hash2D" acceptance. |
| US4 (`layoutFile` + torch fix) | P2 | None beyond Foundational | Independent. |
| US5 (kind unions) | P2 | None beyond Foundational | Independent. |
| US6 (merges/dead code) | P3 | Foundational (`lerp`) | Runs last — touches `PlatformerPage.tsx` and the fruit/`PickupKind` files. |

### Within Each User Story

- Each shared module/helper is TDD'd (test first, then impl) **before** its consumers are retargeted (e.g., T015 before T016–T018; T020 before T021–T022; T027 before T028–T030).
- New module's unit test is written first (TDD), then the module implemented to pass it; a consumer retarget follows.
- Deletions happen **after** migrations/retargets (e.g., T037 migrates before deleting `EnemyAI.ts`; T039 before deleting `IrisTransition.ts`).
- The fruit consolidation (T044–T049) is a strict sequence: `PickupKind`/`PICKUP_TYPES` first (T044), then file delete/rename (T045), then entity merge + identifier rename (T046), then mapper/state (T047/T048), then tests (T049).

### Parallel Opportunities

- **Phase 3 (US1)**: all ten retarget tasks (T004–T013) touch different files → all `[P]`.
- **Phase 4 (US2)**: T016–T018 touch different caller files → `[P]` after T015.
- **Phase 5 (US3)**: T021/T022/T023 touch different files → `[P]` after T020.
- **Phase 6 (US4)**: T028–T030 touch different consumer files → `[P]` after T027; T025 and T031 are parallel with T026–T030.
- **Phase 7 (US5)**: hazard side (T032→T033) and block side (T034→T035/T036) are independent tracks.
- **Phase 8 (US6)**: T037, T039, T041, T042, T044, T047 are independent files → `[P]`; each has a dependent test/follow-up task.
- **Cross-story**: US1, US2, US4, US5 are fully parallel after Foundational (US3 and US6 also only need Foundational, but are ordered later to keep `pickVariant` and `PlatformerPage.tsx` edits isolated).

---

## Parallel Example: User Story 1

```bash
# After Foundational (shared/math.ts) is green, launch all ten retargets together:
Task: "Retarget engine/Lighting.ts math sites from shared/math.ts"
Task: "Retarget engine/CrumblingFloor.ts clamp01 + shakeOffsetX from shared/math.ts"
Task: "Retarget engine/BlockAI.ts clamp01 from shared/math.ts"
Task: "Retarget engine/MushroomSquash.ts clamp01 from shared/math.ts"
Task: "Retarget engine/CollectionEffects.ts clamp01 + lerp from shared/math.ts"
Task: "Retarget engine/DeployableLadder.ts clamp01 from shared/math.ts"
Task: "Retarget engine/FallingStalactite.ts shakeOffsetX from shared/math.ts"
Task: "Retarget entities/Torch.ts hash2D from shared/math.ts"
Task: "Retarget entities/hazards/FloorSpike.ts clamp01 from shared/math.ts"
Task: "Retarget engine/Renderer.ts pulse from shared/math.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (baseline).
2. Phase 2: Foundational — `shared/math.ts` + tests.
3. Phase 3: User Story 1 — retarget all math call sites.
4. **STOP and VALIDATE**: `npm test` + the SC-001 grep (formula appears only in `shared/math.ts`).

### Incremental Delivery

1. Setup + Foundational → `shared/` math leaf ready.
2. US1 (math dedup) → validate → the largest dedup (~15 sites).
3. US2 (`findLandingRow`) → validate → single landing scan.
4. US3 (TileAtlas + `pickVariant`) → validate.
5. US4 (`layoutFile` + torch fix) → validate → the one user-visible bug fix.
6. US5 (kind unions) → validate.
7. US6 (merges/dead code) → validate → lowest-risk cleanup.
8. Polish: full suite + build + static inspection + manual pass + `docs/Features.md`.

### Parallel Team Strategy

With multiple developers, after Foundational is complete:
- Developer A: US1 (math retarget) + US3 (`pickVariant`)
- Developer B: US2 (`findLandingRow`) + US4 (`layoutFile`/torch)
- Developer C: US5 (kind unions), then US6 (merges/dead code) once others land.

Each story lands independently; the full suite + build must stay green at every checkpoint.

---

## Notes

- `[P]` tasks = different files, no dependency on incomplete work in the same phase.
- `[Story]` label maps each task to its user story for traceability.
- Line numbers are intentionally avoided (they drift) — tasks reference symbol/function names from
  `research.md`/`contracts/`, which are authoritative.
- Behavior must be byte-for-byte preserved; run the suite frequently and never delete/weaken a test.
- Do not commit; wait for an explicit request (per `AGENTS.md`).
