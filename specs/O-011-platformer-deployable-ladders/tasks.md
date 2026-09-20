---
description: 'Task list for Platformer Deployable Ladders'
---

# Tasks: Platformer Deployable Ladders

**Input**: Design documents from `/specs/O-011-platformer-deployable-ladders/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. The project constitution (Principle II) makes TDD mandatory
and the plan explicitly lists the test files below. Write each test task before
its implementation task, confirm it fails, then implement.

**Organization**: Tasks are grouped by user story so each story can be
implemented, tested and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `[US1]`…`[US5]`, mapping to the user stories in spec.md
- Every task names the exact file it touches

## Path Conventions

Single static web app. All paths are relative to the repository root
(`D:\Workspace\cv-website`); every source change lands under
`src/themes/platformer/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the one new asset this feature depends on. No new
dependency, no project scaffolding — the codebase already exists.

- [ ] T001 Verify `public/sprites/rope_ladder.png` is a single 32×32 flat 2D pixel sheet with the spec's regions — rolled bundle 16×16 at (0,0), top cap 16×8 at (16,0), step 16×8 at (16,8), step 16×8 at (16,16), bottom cap 16×8 at (16,24) — sharing one style and palette; re-author the sheet at that path (one image, no 2.5D/3D shading) if any region is missing or wrong.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The tile types, predicates, sprite catalog, pure deployment
module and session wiring that **every** user story reads. No user-story work
can start until this phase is complete.

**⚠️ CRITICAL**: Completing this phase is what lets the render pass, physics
and editor phases proceed.

- [ ] T002 [P] Add `'ladderBundle'` and `'ropeLadder'` to the `TileType` union in `src/themes/platformer/level/LevelData.ts` with doc comments matching data-model.md (bundle = non-solid, not climbable, standable from above only; ropeLadder = non-solid, climbable, never author-placeable).
- [ ] T003 [P] In `src/themes/platformer/level/LevelParser.ts`, add `'@': 'ladderBundle'` to `TERRAIN_CHARS` and `'@'` to the `TileChar` union. Do **not** add `ropeLadder` to either.
- [ ] T004 Add `findLadderBundleTiles(layout)` to `src/themes/platformer/level/LevelParser.ts`, mirroring `findTorchTiles` (scan `TERRAIN_CHARS[char] === 'ladderBundle'`, reading order). (Depends on T003.)
- [ ] T005 [P] In `src/themes/platformer/level/Terrain.ts`: add `'ropeLadder'` to the `isClimbable` disjunction, and add `isStandableLadderBundleTop(level, col, row)` returning `tileAt(level, col, row) === 'ladderBundle'` (deliberately unconditional on the cell above — FR-002/FR-009).
- [ ] T006 [P] Register `ROPE_LADDER_SHEET` (`src: '/sprites/rope_ladder.png'`, `frameWidth: TILE_SIZE`, `frameHeight: TILE_SIZE`, `columns: 2`) in `src/themes/platformer/entities/sprites/sheets.ts`.
- [ ] T007 [P] In `src/themes/platformer/engine/StaticObjectsCatalog.ts`, add `ROPE_BUNDLE` (0,0,16×16), `ROPE_TOP_CAP` (16,0,16×8), `ROPE_STEP` (16,8,16×8), `ROPE_BOTTOM_CAP` (16,24,16×8) and `ropeLadderShaftPieces(shaftCellCount)` returning `[ROPE_TOP_CAP, ROPE_STEP]` + two `ROPE_STEP` per cell below, final piece replaced by `ROPE_BOTTOM_CAP` (`n === 0` → `[ROPE_TOP_CAP, ROPE_BOTTOM_CAP]`), reusing `ChainPieceRect`.
- [ ] T008 Add `LADDER_BUNDLE_TILES` (a `computed` over `findLadderBundleTiles(currentLayout.value)`) to `src/themes/platformer/level/level.ts`, importing the new finder. (Depends on T004.)
- [ ] T009 Write `src/themes/platformer/engine/DeployableLadder.test.ts` FIRST (must fail), covering contracts/deployable-ladder.md invariants: landing scan (first solid, `bridge` stops it, level bottom, zero-length on the bottom row/under solid), `createDeployableLadderState` id/landRow, `beginDeploy`/`advanceDeployableLadder` timing + strict one-way + `dt <= 0` no-op, `shaftCellCount`/`totalStepCount`/`revealedStepCount` bounds, `ladderBundleForPlayer` (grounded + hitbox columns + feet row equal to the bundle row or one below it — matching `Physics.ts`'s `footRow`, so standing on the bundle and standing in the bundle's own cell both match — never non-`rolled`), and `applyDeployedLadders` (same-object fast path, `ropeLadder` written row…landRow, no mutation). (Depends on T002, T005.)
- [ ] T010 Implement `src/themes/platformer/engine/DeployableLadder.ts` (pure, canvas-free, DOM-free) to pass T009, exporting `DeployableLadderPhase`, `DeployableLadderState`, `UNROLL_SECONDS = 0.5`, `LADDER_STEP_NATIVE_PX = 8`, `STEPS_PER_TILE = 2`, `ladderLandingRow`, `createDeployableLadderState`, `beginDeploy`, `advanceDeployableLadder`, `shaftCellCount`, `totalStepCount`, `revealedStepCount`, `ladderBundleForPlayer`, `applyDeployedLadders` (imports `isSolid`/`tileAt` and the `Player` geometry constants only). (Depends on T009.)
- [ ] T011 [P] Extend `src/themes/platformer/level/LevelParser.test.ts`: `@` maps to `ladderBundle`, `findLadderBundleTiles` finds every `@`, `ropeLadder` is not a `TileChar`, and the existing map/`TileChar` sync assertion covers `@`. (Depends on T003, T004.)
- [ ] T012 [P] Extend `src/themes/platformer/level/Terrain.test.ts`: `isClimbable('ropeLadder')` true, `isClimbable('ladderBundle')` false, `isStandableLadderBundleTop` true for the bundle cell and false for every other tile type. (Depends on T005.)
- [ ] T013 [P] Extend `src/themes/platformer/engine/StaticObjectsCatalog.test.ts`: `ropeLadderShaftPieces` composition for 0, 1 and many cells (top cap first, bottom cap last, two steps per cell), and every rect inside the 32×32 sheet. (Depends on T007.)
- [ ] T014 Add to `src/themes/platformer/PlatformerState.ts`: `deployableLadderPlacements` (computed from `LADDER_BUNDLE_TILES` via `createDeployableLadderState`), `deployableLadderStates` (signal seeded from placements), `activeLevel` (`computed(() => applyDeployedLadders(currentLevel.value, deployableLadderStates.value))`), and `tickDeployableLadders(dt)` mapping states through `advanceDeployableLadder`; in `resetGameProgress()` rebuild states from placements (do **not** touch them in `resetGame()`). (Depends on T008, T010.)
- [ ] T015 [P] Add `isStandableLadderBundleTop(level, col, footRow)` as a term of `columnIsGround` in `src/themes/platformer/engine/Physics.ts` (mirrors the `isStandableLadderTop` term; no other physics change). (Depends on T005.)
- [ ] T016 [P] Add `case 'ladderBundle'` and `case 'ropeLadder'` to `tileSource` in `src/themes/platformer/engine/Renderer.ts`, both returning `null` with a comment pointing at `drawDeployableLadders` (keeps the exhaustiveness check satisfied). (Depends on T002.)
- [ ] T017 Extend `src/themes/platformer/PlatformerState.test.ts`: states seed one per `@` cell, `activeLevel` is the same object as the raw level when none deployed and overrides deployed cells otherwise, `resetGame()` preserves the states, `resetGameProgress()` rolls every entry back to `rolled`. (Depends on T014.)

**Checkpoint**: Foundation ready — the tile types, pure module, state and physics
ground term exist and are unit-tested. User-story phases can begin.

---

## Phase 3: User Story 1 - Deploy a Curled-up Ladder Bundle (Priority: P1) 🎯 MVP

**Goal**: A grounded character on (or one cell above) a rolled bundle presses Up;
the bundle unrolls downward over ~0.5 s to the first solid tile/level bottom,
then the bundle cell flips to its deployed top-rung appearance.

**Independent Test**: Paint `@` above a drop with solid ground below in the
editor, hit Try, stand on it, press Up, and watch the rope unroll to the ground;
press Up again and nothing further happens.

### Tests for User Story 1

- [ ] T018 [P] [US1] Extend `src/themes/platformer/engine/Renderer.test.ts` for `drawDeployableLadders`: returns immediately when the rope sheet is `null`; draws the bundle sprite while `rolled`; draws exactly `revealedStepCount(state)` step pieces starting one full cell below the bundle and clamped to the landing cell while `deploying`; draws the top cap in the bundle cell once `deployed`.
- [ ] T019 [P] [US1] Extend `src/themes/platformer/PlatformerPage.test.tsx`: Up while grounded on/above a rolled bundle moves it to `deploying`; a second Up does nothing; Up while airborne or off the bundle column does not deploy; the unroll reaches `deployed` after ~`UNROLL_SECONDS`.

### Implementation for User Story 1

- [ ] T020 [US1] Implement `drawDeployableLadders(ctx, level, states, ropeSheet, originX = 0, originY = 0)` in `src/themes/platformer/engine/Renderer.ts` per contracts/rendering-editor.md: `imageSmoothingEnabled = false`; `rolled`/`deploying` draw `ROPE_BUNDLE` scaled to `RENDERED_TILE_SIZE` plus the revealed `ROPE_STEP` pieces; `deployed` draws `ROPE_TOP_CAP` in the bundle cell (the full completed shaft is added in US2). (Depends on T010, T013, T016.)
- [ ] T021 [US1] Wire the deploy into `src/themes/platformer/PlatformerPage.tsx`: add a `ropeLadderRef` + `loadImage(ROPE_LADDER_SHEET.src)`; call `tickDeployableLadders(dt)` in the `playing` branch beside `tickDarkness(dt)`; after `interactPressed` is computed and **before** the chest-open and hint-reveal blocks, compute `ladderBundleForPlayer(...)` and on a match map `beginDeploy` into `deployableLadderStates` and set `bundleDeployedThisTick`; guard the chest-open and hint-reveal blocks on `!bundleDeployedThisTick`; call `drawDeployableLadders` immediately after `drawTerrain`, passing `currentLevel.value`, `deployableLadderStates.value`, the loaded rope sheet, and the **same `originX`/`originY` `drawTerrain` receives** (the camera origin). (Depends on T014, T020.)

**Checkpoint**: User Story 1 works and is independently testable — a bundle
deploys and visually unrolls. This is the MVP.

---

## Phase 4: User Story 2 - Climb the Deployed Ladder (Priority: P1)

**Goal**: Every filled cell (bundle cell included) climbs exactly like an
authored `ladder`/`chain`, including the standable top; a partial shaft is air.

**Independent Test**: Deploy a ladder, then climb up/down, hang, shimmy off,
jump off, and stand on its top rung — each matches an authored `H` ladder; walk
into a mid-unroll column and pass through it.

### Tests for User Story 2

- [ ] T022 [P] [US2] Extend `src/themes/platformer/engine/Physics.test.ts`: a player lands and stands on a rolled `ladderBundle`; a rolled bundle is not climbable; a deployed `ropeLadder` shaft climbs in both directions and its top rung is standable; a partial/mid-unroll shaft is not climbable.
- [ ] T023 [P] [US2] Extend `src/themes/platformer/engine/Renderer.test.ts`: a `deployed` state draws the full `ropeLadderShaftPieces(shaftCellCount)` sequence — top cap first, bottom cap last, two steps per cell — starting at the bundle cell's top in its column.

### Implementation for User Story 2

- [ ] T024 [US2] In `src/themes/platformer/PlatformerPage.tsx`, import `activeLevel` from `PlatformerState.ts` and pass `activeLevel.value` (not `currentLevel.value`) as the level argument to `stepPlayerPhysics`; leave every other subsystem reading `currentLevel.value`. (Depends on T014.)
- [ ] T025 [US2] Extend the `deployed` branch of `drawDeployableLadders` in `src/themes/platformer/engine/Renderer.ts` to draw `ropeLadderShaftPieces(shaftCellCount(state))` starting at the bundle cell's top (replacing the top-cap-only branch from T020), each piece `height * RENDER_SCALE` tall. (Depends on T020.)

**Checkpoint**: A deployed shaft is climbable and rendered exactly like an
authored ladder in behaviour, while staying visually a rope ladder.

---

## Phase 5: User Story 3 - Deployment Is Permanent and One-Way (Priority: P2)

**Goal**: An unroll always finishes, a finished ladder never rolls back, it
survives death/respawn, and only Reset Game (or a reload) re-rolls it.

**Independent Test**: Deploy a ladder, die, respawn → still deployed and
climbable; click Reset Game → the bundle is rolled up again; deploy one of two
bundles in the same column → the other stays rolled.

### Tests for User Story 3

- [ ] T026 [P] [US3] Extend `src/themes/platformer/PlatformerState.test.ts`: `resetGame()` leaves `deployableLadderStates` untouched; `resetGameProgress()` rebuilds every entry `rolled`; two bundles in one column stay independent entries (deploying one leaves the other `rolled`).
- [ ] T027 [P] [US3] Extend `src/themes/platformer/engine/DeployableLadder.test.ts` with the FR-011 one-way invariants: `beginDeploy`/`advanceDeployableLadder` are idempotent for states already past their input phase and never return to `rolled`/`deploying` from `deployed`; an in-progress unroll cannot be cancelled and always reaches `deployed` at or after `UNROLL_SECONDS`.
- [ ] T028 [P] [US3] Extend `src/themes/platformer/PlatformerPage.test.tsx`: a deployed ladder survives a death/respawn (`resetGame()`), and a mid-unroll deploy continues to completion while the player moves and presses other keys.

### Implementation for User Story 3

No new production code is expected: the lifetime rule is already implemented by
T014 (`resetGame()` untouched, `resetGameProgress()` rebuild) and the one-way
transitions by T010. If T026–T028 surface a gap, fix it in
`src/themes/platformer/PlatformerState.ts` or
`src/themes/platformer/engine/DeployableLadder.ts` respectively.

**Checkpoint**: Deployment is a safe, permanent traversal aid with a single,
documented reset seam.

---

## Phase 6: User Story 4 - Author Bundles with a Landing Preview (Priority: P3)

**Goal**: `@` is a paintable palette tile with a label/description, and the
editor draws a faint marker on the cell where the ladder would land — never in
game.

**Independent Test**: In the editor, paint a bundle above a shaft → a faint
marker appears on the first solid cell below; remove the solid tile → the marker
moves to the level's bottom; place one on solid ground → the marker sits on the
bundle's own cell; hit Try → no marker in game.

### Tests for User Story 4

- [ ] T029 [P] [US4] Extend `src/themes/platformer/editor/paletteTiles.test.ts`: the `@` sprite spec exists and points at `/sprites/rope_ladder.png`, and `PALETTE_TILE_LABELS['@']` / `PALETTE_TILE_DESCRIPTIONS['@']` are non-empty and describe the Up-to-deploy behavior.
- [ ] T030 [P] [US4] Extend `src/themes/platformer/editor/EditorCanvas.test.tsx`: a `@` over solid ground produces a landing marker on its own cell; a `@` above open space marks the lowest rung (the last empty cell above the first solid below); with no solid below, it marks the level's bottom cell.

### Implementation for User Story 4

- [ ] T031 [P] [US4] In `src/themes/platformer/editor/paletteTiles.ts`, add the `'@'` entry to `PALETTE_TILE_SPRITES` (`/sprites/rope_ladder.png`, sheet 32×32, `sx: 0, sy: 0`, 16×16), `PALETTE_TILE_LABELS` (`'Rope Ladder Bundle'`) and `PALETTE_TILE_DESCRIPTIONS` (press Up while standing on it to unroll a rope ladder down to the ground below).
- [ ] T032 [P] [US4] Add `synthesizeLadderBundleStates(grid)` to `src/themes/platformer/editor/gridRenderState.ts`, returning one rolled `createDeployableLadderState(gridToLevelDef(grid), col, row)` per `@` cell (mirrors `findAllPositions`).
- [ ] T033 [US4] Add `ropeLadder: HTMLImageElement | null` to `EditorImages` and to `EMPTY_IMAGES` + `IMAGE_SOURCES` (`ROPE_LADDER_SHEET.src`) in `src/themes/platformer/editor/LevelEditorPage.tsx`, and to the `EditorImages` interface in `src/themes/platformer/editor/EditorCanvas.tsx` (and `ropeLadder: null` in the local `EMPTY_IMAGES` inside `editor/EditorCanvas.test.tsx`, or TypeScript fails).
- [ ] T034 [US4] In `src/themes/platformer/editor/EditorCanvas.tsx`: after `drawTerrain`, call `drawDeployableLadders(ctx, gridToLevelDef(grid), synthesizeLadderBundleStates(grid), images.ropeLadder, panOffset.x, panOffset.y)`; add an editor-only `drawLadderBundleLandingMarkers(ctx, level, originX, originY)` that draws a faint translucent fill + soft/dashed outline (reusing the `MARKER_HALO_*` legibility approach) on `ladderLandingRow(level, col, row)` for every `ladderBundle` cell, called only from the editor render path. (Depends on T033.)

**Checkpoint**: Authors can place and confidently predict a bundle's landing
without ever seeing the marker during play.

---

## Phase 7: User Story 5 - The Rope Ladder Reads Distinctly (Priority: P3)

**Goal**: The rolled bundle and deployed shaft are drawn as a rope ladder,
visually distinct from the wooden `ladder` and the `chain`, from the single
`rope_ladder.png` sheet; the bundle stays rolled while the shaft reveals, then
flips to the deployed top rung.

**Independent Test**: Place a `@`, an `H` and an `I` side by side, deploy the
bundle, and confirm all three shafts are distinguishable at a glance.

### Tests for User Story 5

- [ ] T035 [P] [US5] Extend `src/themes/platformer/engine/StaticObjectsCatalog.test.ts`: every `ROPE_*` rect lies inside the 32×32 `rope_ladder.png` sheet and `ropeLadderShaftPieces` composes only `ROPE_*` rects (never the ladder/chain rects).
- [ ] T036 [P] [US5] Extend `src/themes/platformer/engine/Renderer.test.ts`: the deployable-ladder pass sources the `ROPE_LADDER_SHEET` image for the bundle, steps and caps, while `tileSource('ladder')`/`chain` continue to source their own sheets — proving the three shafts are not drawn from the same sprites.

### Implementation for User Story 5

No new production code is expected: the art sheet (T001), rects/pieces (T007)
and the draw pass (T020/T025) already deliver the distinct rendering.

- [ ] T037 [US5] Verify in-browser (quickstart.md §5) that the rolled bundle, an authored `H` ladder and an authored `I` chain are distinguishable, and that a deploy keeps the rolled sprite while the rope segments appear progressively then flips the bundle cell to the top-rung appearance. If T035/T036 or this check surface a mismatch, fix `public/sprites/rope_ladder.png`, `src/themes/platformer/engine/StaticObjectsCatalog.ts` or `src/themes/platformer/engine/Renderer.ts`.

**Checkpoint**: The rope ladder is unambiguous next to the existing climbables.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full-suite validation and feature bookkeeping.

- [ ] T038 [P] Update `docs/themes/platformer/Terrain.md`: add the two `TileType` members to the union table, document `isStandableLadderBundleTop`, and add a **Runtime overrides** section explaining `applyDeployedLadders` and the raw-vs-effective split (the knowledge the spec's Key Entities section points at).
- [ ] T039 [P] Update `docs/themes/platformer/LevelFormat.md`: add `@` → `ladderBundle` to the terrain character table (and note `ropeLadder` has no character).
- [ ] T040 Run `npm test` (Vitest) and `npm run lint` (ESLint) plus a TypeScript build/typecheck; fix any failures and confirm strict typing (no `any`) and no new runtime dependency.
- [ ] T041 Run the full `specs/O-011-platformer-deployable-ladders/quickstart.md` manual checklist — deploy (solid/bottom/zero-length/no re-deploy), climb (both directions, hang, shimmy, jump, top rung, partial-shaft pass-through, blocked top), permanence (death/respawn, Reset Game, two bundles), editor preview, rope-vs-ladder-vs-chain distinctness, edge cases (pause mid-unroll, stand-on-deploy, authored ladder overlap) and the shipped `main` level regression. This manual pass is also the only coverage for SC-003 (deployment never traps).
- [ ] T042 Update `docs/Features.md` per AGENTS.md: change the O-011 feature bullet to `- [x]`, set the Implementation Status row (line 91) to `✅ Done` / `✅` / `✅`, set its Spec column link to `../specs/O-011-platformer-deployable-ladders/spec.md`, and prefix the dependency-diagram node `O011` with `✅ ` plus add `class O011 done` alongside its existing category class.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — can start immediately.
- **Foundational (Phase 2)**: depends on Setup; **blocks every user story**.
- **User Stories (Phase 3–7)**: depend on Foundational.
  - US1 (P1) has no story dependency and is the MVP.
  - US2 (P1) depends on US1 (it climbs the shaft US1 deploys).
  - US3 (P2) depends on US1 (it settles the deploy's lifetime).
  - US4 (P3) depends on Foundational only (editor-only preview; uses `ladderLandingRow`).
  - US5 (P3) depends on US1/US2 (it verifies the deploy/shaft rendering).
- **Polish (Phase 8)**: depends on all targeted stories being complete.

### Within Each User Story

- Tests are written and confirmed failing before the implementation task.
- Pure module/state before render pass; render pass before game-loop wiring.
- Each story is complete and demoable before the next priority starts.

### Task-level dependencies (beyond phase order)

- T004 → T003; T008 → T004.
- T009 → T002, T005; T010 → T009.
- T011 → T003, T004; T012 → T005; T013 → T007.
- T014 → T008, T010; T017 → T014.
- T015 → T005; T016 → T002.
- T020 → T010, T013, T016; T021 → T014, T020.
- T025 → T020.
- T033 → T034.
- T042 → T040, T041.

### Parallel Opportunities

- Setup: T001 alone.
- Foundational: T002, T003, T005, T006, T007 all start in parallel; then T004 → T008 and T009 → T010; T011/T012/T013 run in parallel; T015/T016 are independent.
- US1: T018 and T019 (test files) in parallel; then T020 → T021.
- US2: T022 and T023 in parallel; T024 and T025 are independent of each other.
- US3: T026/T027/T028 in parallel.
- US4: T029/T030/T031/T032 in parallel; then T033 → T034.
- US5: T035/T036 in parallel.
- Polish: T038/T039 in parallel.

---

## Parallel Example: User Story 1

```text
# Launch the US1 test tasks together:
T018  Renderer.test.ts — drawDeployableLadders coverage
T019  PlatformerPage.test.tsx — Up deploys / unroll completes

# Then the implementation:
T020  Implement drawDeployableLadders in Renderer.ts
T021  Wire trigger + tick + render into PlatformerPage.tsx
```

## Parallel Example: Foundational

```text
# Start these together (different files):
T002  LevelData.ts   — two new TileType members
T003  LevelParser.ts — '@' char + TileChar
T005  Terrain.ts     — ropeLadder climbable + bundle-top predicate
T006  sheets.ts      — ROPE_LADDER_SHEET
T007  StaticObjectsCatalog.ts — ROPE_* rects + ropeLadderShaftPieces

# Then, in order:
T004 findLadderBundleTiles → T008 LADDER_BUNDLE_TILES
T009 DeployableLadder.test.ts → T010 DeployableLadder.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational) — this is the bulk of
   the pure logic and is fully unit-tested.
2. Complete Phase 3 (US1): the deploy trigger, the unroll render and the
   game-loop wiring.
3. **STOP and VALIDATE**: run quickstart.md §1 in the browser and `npm test`.
4. Demo the MVP: a bundle that unrolls to the ground on Up.

### Incremental Delivery

1. Setup + Foundational → foundation ready, no visible change.
2. US1 → deploy + unroll (MVP).
3. US2 → the deployed shaft climbs and renders fully.
4. US3 → permanence is proven and the reset seam is documented.
5. US4 → the editor palette entry and landing preview.
6. US5 → readability verification.
7. Polish → docs, lint/test, quickstart and `docs/Features.md`.

### Parallel Team Strategy

After Foundational, one developer can take US1 → US2 → US3 while a second takes
US4 (editor) independently; US5 is a short verification pass once US1/US2 land.

---

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependencies.
- Every task names its file; no task is vague.
- Tests MUST fail before the matching implementation task.
- The `ropeLadder` tile is deliberately never author-placeable — it exists only
  in the effective grid produced by `applyDeployedLadders`.
- The effective grid is consumed by `stepPlayerPhysics` only; rendering and
  every other subsystem read the raw `currentLevel`.
- Do not add a general per-tile animation/state framework — the override is
  scoped to bundles (spec Assumptions / Out of Scope).
