---
description: "Task list for R-015 Platformer Tile Module Registry"
---

# Tasks: Platformer Tile Module Registry (R-015)

**Input**: Design documents from `/specs/R-015-platformer-tile-module-registry/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md) (decisions D1–D13), [data-model.md](./data-model.md), [contracts/tile-module.md](./contracts/tile-module.md), [contracts/layer-invariants.md](./contracts/layer-invariants.md), [quickstart.md](./quickstart.md), [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)

**Tests**: Tests are **required** (not optional) for this feature — constitution Principle II (TDD, NON-NEGOTIABLE) and FR-013/FR-014. The FR-014 structural guard test is written first; every existing behavioural test migrates with its module and passes; the suite is the behavioural contract.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Every task names exact file paths.

## Path Conventions

Single project. All paths are relative to `src/themes/platformer/` unless they start with `docs/` or `specs/`. New tile layer lives at `src/themes/platformer/tiles/`.

## Story ↔ phase map (dependency order)

The plan's six implementation steps are the phase backbone, because this is a **dependency-ordered restructure** (each step must keep the suite green) and the plan explicitly warns that step 1's stubs are replaced in step 2 and the guard is relaxed until step 4. The story labels ride on the phases:

| Phase | Plan step | User story |
| --- | --- | --- |
| 3 | Step 1 — contract + registry skeleton | **US1** (P1) 🎯 MVP |
| 4 | Step 2 — rule extraction | **US2** (P1) |
| 5 | Step 3 — art + draw extraction | **US4** (P2), plus the two stateful kinds' file moves (**US3**, T037/T038 — they land here because they must precede the Renderer rewire; their state declaration/tests follow in Phase 6) |
| 6 | Step 4 — stateful-kind wiring | **US3** (P2) |
| 7 | Step 5 — test migration | **US5** (P1) |
| 8 | Step 6 — docs + verification | **US6** (P3), closing with **US5** verification |
| 9 | Polish & cross-cutting | **US5** (P1) |

**Out of scope (do NOT do)**: editor palette unification (**R-010**), the `SceneRenderer`/`HudRenderer` split (**R-009**). R-015 only *exposes* a consumable `TILE_MODULES` contract; it must not change editor behaviour or build a second palette/registry table.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a green pre-refactor baseline on the feature branch.

- [x] T001 Confirm branch `R-015-platformer-tile-module-registry` is checked out and record the pre-refactor baseline: run `npm install`, then `npm test`, `npm run build`, `npm run lint`; all MUST pass before any edit. No source file changes.

**Checkpoint**: Baseline green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `TileModule` contract type and the two leaf helpers that both `engine/` and `tiles/` must share. These block every tile module.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [x] T002 [P] Create `src/themes/platformer/tiles/TileModule.ts` with the contract from `contracts/tile-module.md` §1: `TileSolidRegion`, `TileRuleContext` (`transient: TileTransientState`, `excludeOneWay?: boolean`), a neutral `GridTimerState` (`{ col, row, elapsed }`) and a **structurally-typed** `TileTransientState` (`crumblingFloorTimers`, `mushroomSquashes` as `GridTimerState[]` — no `import('./crumblingFloor')`/`import('./bouncyMushroom')`, so the contract type-checks before those modules exist), `TileStateDescriptor` (`keyOf`, `duration`, `prune`, `rearm`, optional `phaseOf`), `TerrainImages` (`tileset`, `groundAtlas`, `staticObjects`, `decorations`, `torch`, `mushroom`, `crumblingLedge`, `crumblingCracks`), `TileDrawContext`, `TileDrawBand = 'terrain' | 'afterHazards' | 'deployable'`, and `TileModule` (`char?`, `fogExempt`, `solid?`, `oneWay?`, `climbable?`, `dropThrough?`, `drawBand`, `solidRegionAt?`, `standableAt?`, `draw?`, `state?`). Types only — no runtime code.
- [x] T003 [P] Move `src/themes/platformer/engine/TileAtlas.ts` → `src/themes/platformer/shared/tileAtlas.ts` (vocabulary `QuarterTurns`, `TileAtlasEntry`, `ATLAS_STRIDE`, `atlasCell`); move `src/themes/platformer/engine/TileAtlas.test.ts` → `src/themes/platformer/shared/tileAtlas.test.ts` (import-path only). Retarget **every** importer for now to `../shared/tileAtlas`: `engine/BackgroundAtlas.ts`, `engine/GroundAtlas.ts`, plus the two tests `engine/GroundAtlas.test.ts` and `engine/BackgroundAtlas.test.ts` (their `ATLAS_STRIDE` imports) — the Phase 2 `npm test` checkpoint must stay green.
- [x] T004 [P] Create `src/themes/platformer/shared/variants.ts` moving `pickVariant<T>(variants, col, row)` out of `engine/StaticObjectsCatalog.ts` verbatim (empty-array throw preserved; delegates to `shared/math.hash2D`). Retarget `engine/StaticObjectsCatalog.ts` and `engine/BackgroundDecorCatalog.ts` to import it from `../shared/variants`.

**Checkpoint**: Contract and shared leaves exist; `npm test` still green.

---

## Phase 3: User Story 1 - One tile kind is one self-contained module (Priority: P1) 🎯 MVP

**Goal**: Plan step 1 — a `tiles/` layer with one module per kind, an exhaustive `TILE_MODULES` registry that drives kind membership, and `TileType`/`TERRAIN_CHARS`/`TILE_FOG_EXEMPT` derived from it. Module bodies are declared **capabilities/`drawBand` stubs only** at this stage; their rule hooks are filled in US2 and their `draw` in US4.

**Independent Test**: `TILE_MODULES` resolves every shipped `TileType` to exactly one distinct module; `TileType = keyof typeof TILE_MODULES`; `TERRAIN_CHARS` covers every author-placeable kind once and never `ropeLadder`; `TILE_FOG_EXEMPT` is exhaustive.

### Tests for User Story 1 (write FIRST, ensure they FAIL) ⚠️

- [x] T005 [US1] Write `src/themes/platformer/tiles/registry.test.ts` — the FR-014 structural guard, running under Vitest with `node:fs`/`node:path` (test-only). Assert, per `contracts/layer-invariants.md` §4: (1) one distinct module object per `TileType` with `Object.keys(TILE_MODULES)` equal to the **frozen 19-name shipped kind list** (and therefore the derived `TileType` set) and no duplicate module references; (2) `TERRAIN_CHARS` maps every author-placeable kind exactly once and never `ropeLadder`, every parsed char resolves to a real module, and `tileAt` never returns a marker; (4) layer edges (scan every `src/themes/platformer/**/*.ts(x)` import specifier: no `tiles/ → entities/`, no `tiles/ → engine/`, no `level/ → engine/`, no `engine/ → state/`, `contracts/` a leaf); (5) `TILE_FOG_EXEMPT` has a boolean entry for every `TileType`. The rule-branch check (3) is written but **relaxed** in this step (skip the `Physics.ts`/`Standable.ts`/`Terrain.ts` scan until T053). Use `{method}-{condition}-{expected-result}` names and `// Arrange / Act / Assert`. The test MUST fail before T006.

### Implementation for User Story 1

- [x] T006 [US1] Create `src/themes/platformer/tiles/registry.ts` (depends on T002, T005): `export const TILE_MODULES = { …19 literal keys… } satisfies Record<string, TileModule>` with exactly 19 literal keys (`groundGrass`, `groundRock`, `wall`, `bridge`, `ladder`, `chain`, `bush`, `fence`, `cobweb`, `crystalCluster`, `stalactite`, `stalagmite`, `torch`, `ladderBundle`, `ropeLadder`, `bouncyMushroom`, `decorativeMushroom`, `crumblingFloor`, `empty`); derive `TERRAIN_CHARS: Record<string, TileType | undefined>` from each module's `char` literal and `TerrainChar` from the char literals; derive `TILE_FOG_EXEMPT: Record<TileType, boolean>` + `isFogExempt` from each module's `fogExempt`; expose dispatch helpers `isSolidTile`, `isSolidExcludingOneWay` (relocated `isSolidExcludingBridge`), `isClimbableTile`, `tileSolidRegionAt`, `isStandableTileAt`, `claimsDropThrough`, `drawTileAt`. Dispatch helpers MUST read `TILE_MODULES` lazily at call time (the accepted `level/ ↔ tiles/` cycle must not dead-lock on TDZ). `ropeLadder` declares no `char`.
- [x] T007 [P] [US1] Create the solid/air module skeletons in `src/themes/platformer/tiles/`: `groundGrass.ts`, `groundRock.ts`, `wall.ts`, `bridge.ts`, `empty.ts`. Capability flags only, matching today's rules exactly: `groundGrass`/`groundRock`/`wall` → `solid: true`; `bridge` → `solid: true, oneWay: true, dropThrough: true`; `empty` → no rules. `char`s: `G`, `R`, `#`, `B`, and `empty` declares `'.'`. `fogExempt` from `TILE_FOG_EXEMPT` today: `groundGrass/groundRock/wall/bridge` → `true`, `empty` → `false`. `drawBand: 'terrain'` for all except `empty` (any — declare `'terrain'`).
- [x] T008 [P] [US1] Create the climb/run module skeletons in `src/themes/platformer/tiles/`: `ladder.ts`, `chain.ts`, `ladderBundle.ts`, `ropeLadder.ts`. Flags: `ladder`/`chain`/`ropeLadder` → `climbable: true`; `ladderBundle` → no rules yet (its `standableAt` lands in US2). `char`s: `H`, `I`, `@`; `ropeLadder` declares **no** `char`. `fogExempt: false` for all four. `drawBand`: `ladder`/`chain` → `'terrain'`; `ladderBundle`/`ropeLadder` → `'deployable'`.
- [x] T009 [P] [US1] Create the decoration module skeletons in `src/themes/platformer/tiles/`: `bush.ts`, `fence.ts`, `cobweb.ts`, `crystalCluster.ts`, `stalactite.ts`, `stalagmite.ts`, `torch.ts`. No rules (all non-solid, non-climbable, `fogExempt: false`). `char`s: `n`, `N`, `X`, `c`, `⊤`, `⊥`, `¥`. `drawBand: 'terrain'` for all. (`torch.ts` is only a skeleton here; its whole module moves in US4/T036.)
- [x] T010 [P] [US1] Create the mushroom/crumbling module skeletons in `src/themes/platformer/tiles/`: `bouncyMushroom.ts`, `decorativeMushroom.ts`, `crumblingFloor.ts`. No rules yet (the mushroom `standableAt` and the crumbling `solidRegionAt` land in US2). `char`s: `§`, `s`, `g`. `fogExempt: false` for all. `drawBand`: mushrooms → `'terrain'`; `crumblingFloor` → `'afterHazards'`.
- [x] T011 [US1] Update `src/themes/platformer/level/LevelData.ts`: replace the hand-written `TileType` union with `export type TileType = keyof typeof TILE_MODULES;` via a **type-only** import from `../tiles/registry`; move `TILE_FOG_EXEMPT`/`isFogExempt` out (now in the registry); leave the `TorchStrength` import on `../entities/Torch` for now (it retargets to `../tiles/torch` in T036 — do NOT add a compatibility re-export, FR-018). `MarkerEntry`/`MarkerGrid`/`TileMap`/`LevelDef`/background types unchanged.
- [x] T012 [US1] Update `src/themes/platformer/level/LevelParser.ts`: import `TERRAIN_CHARS` from `../tiles/registry` (remove the local literal); compose `TileChar` from the derived `TerrainChar` plus the existing entity/sign/hazard char literals it already owns; keep `ENTITY_CHARS`/`SIGN_CHAR`/`LEGACY_MARKER_CHARS`/`HAZARD_CHARS`/`BACKGROUND_CHARS` and every finder function unchanged. Retarget the `TERRAIN_CHARS` imports in `editor/Palette.test.tsx` and `editor/paletteTiles.test.ts` to `../tiles/registry` (import-path only).
- [x] T013 [US1] Run `npx vitest run src/themes/platformer/tiles/registry.test.ts` and `npm test`; the guard's checks 1, 2, 4, 5 MUST pass and the full existing suite MUST stay green (checks reference the new registry; the relaxed branch check is a no-op). **Checkpoint — US1 MVP.**

**Checkpoint**: US1 fully functional and independently testable — one module per kind, exhaustive registry, derived membership.

---

## Phase 4: User Story 2 - Tile rules live with the kind, not in scattered predicates (Priority: P1)

**Goal**: Plan step 2 — each rule is declared by its kind's module and reached through the registry; `level/Terrain.ts`, `engine/Physics.ts` and `engine/Standable.ts` consume the registry instead of comparing `TileType` values directly.

**Independent Test**: A source search of `engine/Physics.ts`, `engine/Standable.ts` and `level/Terrain.ts` finds no bare `=== '<tileType>'` rule comparison outside the registry-dispatch helpers; every existing `isSolid`/`isClimbable`/`isStandable*` observable result is unchanged.

### Implementation for User Story 2

- [x] T014 [P] [US2] Add the phase/inset-aware rule hook to `src/themes/platformer/tiles/crumblingFloor.ts`: move `CRUMBLING_FLOOR_SOLID_HEIGHT = RENDERED_TILE_SIZE / 2` out of `level/Terrain.ts` into this module and implement `solidRegionAt(level, col, row, ctx)` returning `{ top: 0, bottom: CRUMBLING_FLOOR_SOLID_HEIGHT }` while the cell's timer phase is `atRest`/`cracking` (i.e. `!isCrumblingFloorBroken(ctx.transient.crumblingFloorTimers, col, row)`) and `null` while `broken`/`reforming`. `crumblingFloor` deliberately omits the plain `solid` flag. (Depends on T002; do NOT yet move the whole state machine file — only the constant + hook.)
- [x] T015 [P] [US2] Add `standableAt(level, col, row, ctx)` hooks, reproducing today's predicates byte-for-byte: `tiles/ladder.ts` + `tiles/chain.ts` + `tiles/ropeLadder.ts` → `isClimbable`-style ladder-top rule over `{ top: 0, bottom: RENDERED_TILE_SIZE }` context (`isClimbable(tileAt(level,col,row)) && !isClimbable(above) && !isSolid(above)`); `tiles/ladderBundle.ts` → unconditional `tileAt(level,col,row) === 'ladderBundle'`; `tiles/bouncyMushroom.ts` → `tileAt(level,col,row) === 'bouncyMushroom' && above !== 'bouncyMushroom' && !isSolid(above)`. The `ladder`/`chain`/`ropeLadder` hooks read the shared pure grid readers from `level/Terrain` (`tileAt`) and the registry dispatch helpers (`isClimbableTile`, `isSolidTile`) — **not** `level/Terrain.isClimbable` if that would re-introduce a cycle through `Terrain`; use the registry helpers directly to keep dispatch single-sourced.
- [x] T016 [US2] Rewire `src/themes/platformer/level/Terrain.ts`: keep every pure grid reader (`TILE_SIZE`, `RENDER_SCALE`, `RENDERED_TILE_SIZE`, `tileAt`, `tileToPixel`, `backgroundAt`, `markerAt`, `backgroundNeighbourMask`, `neighbourMask` + bit constants, `horizontalRunPosition`, `bridgeRunPosition`, `verticalRunRole`, `chainAttachment`, `chainRunLength`, `cobwebOrientation`, `isTopExposed`); keep `isSolid`/`isSolidExcludingBridge`/`isClimbable` as **thin wrappers delegating to the registry's one implementations** (`isSolidTile`/`isSolidExcludingOneWay`/`isClimbableTile` from `../tiles/registry`) so there is a single dispatch body and no second rule path (FR-018); **delete** `isStandableLadderTop`/`isStandableLadderBundleTop`/`isStandableMushroomCap`; re-export `isStandableTileAt(level, col, row, ctx)`, `tileSolidRegionAt(level, col, row, ctx)` (full-cell region when `solid` and not one-way-excluded, else `null`) and `claimsDropThrough(level, col, row)` from the registry; remove `CRUMBLING_FLOOR_SOLID_HEIGHT`. No compatibility re-exports (FR-018).
- [x] T017 [US2] Migrate `src/themes/platformer/level/Terrain.test.ts`: keep the `isSolid`/`isSolidExcludingBridge`/`isClimbable`/torch-exception assertions unchanged; repoint the removed `isStandableLadderTop` and `isStandableMushroomCap` describes to `isStandableTileAt(level, col, row, ctx)` with the same cells and expected results (pass a `ctx` built from empty transient arrays). No assertion deleted, skipped or weakened.
- [x] T018 [US2] Rewire `src/themes/platformer/engine/Physics.ts`: replace `preStepColumnsHaveBridge`/`standingOnBridge`/`=== 'bridge'` checks with `claimsDropThrough`; replace the crumbling-floor `wallTileIsSolid` literals and the ceiling-branch `tile === 'crumblingFloor'`/`CRUMBLING_FLOOR_SOLID_HEIGHT` handling with `tileSolidRegionAt(..., { excludeOneWay })` resolving the same planes; replace direct `isStandableMushroomCap` with `isStandableTileAt` in `playerOnMushroomCap`; keep `isClimbable`/`isSolidExcludingBridge` call sites as registry-backed helpers. Behaviour byte-for-byte identical.
- [x] T019 [US2] Rewire `src/themes/platformer/engine/Standable.ts`'s `isStandableCell`: resolve the terrain ground term through `tileSolidRegionAt(level, col, row, { transient, excludeOneWay: options.excludeBridge })` and the one-way ground terms through `isStandableTileAt(level, col, row, { transient })`; drop the `tile === 'crumblingFloor'` special case and the `isStandableLadderTop`/`isStandableLadderBundleTop`/`isStandableMushroomCap` imports. `findLandingRow`/`LandingSolidPredicate` unchanged.
- [x] T020 [P] [US2] Rewire `src/themes/platformer/entities/enemies/movement/patrol.ts`'s `tileIsGroundFor` (around line 98) to use `tileSolidRegionAt`/`isSolidTile` registry dispatch instead of `tile === 'crumblingFloor' ? !isCrumblingFloorBroken(...) : isSolid(tile)`; note `entities/enemies/movement/MovementStrategy.ts` also imports `CrumblingFloorTimerState` and is retargeted in T037. Keep the `engine/CrumblingFloor` import for now (it has not moved yet).
- [x] T021 [P] [US2] Rewire `src/themes/platformer/entities/deployableItems/Bomb.ts`'s `bombLandingRow` (around line 106) the same way as T020 (registry dispatch for the crumbling/bridge ground rule); keep `isBlockOccupied` and `findLandingRow`.
- [x] T022 [US2] Run `npm test`; the guard's check 3 is still relaxed but every behavioural test (including the migrated `Terrain.test.ts`) MUST pass. Confirm a search of `engine/Physics.ts`/`engine/Standable.ts`/`level/Terrain.ts` finds no remaining tile-type rule comparison. **Checkpoint — US2.**

**Checkpoint**: US1 + US2 both work independently; rules dispatch through the registry.

---

## Phase 5: User Story 4 - Appearance dispatches through the module (Priority: P2)

**Goal**: Plan step 3 — each kind's module owns its `draw`; `drawTerrain` iterates cells and dispatches to the module, with no per-`TileType` branch and no `tileSource`; per-kind sprite tables live with the module. This phase also physically moves the two stateful kinds' files (their state *declaration* is completed/tested in US3/Phase 6).

**Independent Test**: `drawTerrain` is a band-filtered loop dispatching to `TILE_MODULES[...].draw`; every tile renders pixel-identically, including grass autotiling, bush/tree runs, cobwebs, bridge run sprites, torches, both mushrooms, chain shafts and the crumbling floor.

### Implementation for User Story 4

- [x] T023 [P] [US4] Create `src/themes/platformer/tiles/draw.ts` with the shared tile-draw primitives moved out of `engine/Renderer.ts`: `drawRotatedTile(ctx, atlas, entry, destX, destY)` (verbatim, using `TILE_SIZE`/`RENDERED_TILE_SIZE` from `level/Terrain`). No React/canvas-sheet imports.
- [x] T024 [US4] Fill `src/themes/platformer/tiles/groundGrass.ts` (skeleton from T007): relocate `GROUND_ATLAS`, `GRASS_CELLS`, `groundTileKind`, `groundAtlasCell`, `grassCell`, `GRASS_SOURCE_HEIGHT`, `GroundTileKind`/`GroundAtlasEntry` out of `engine/GroundAtlas.ts` (the source file is deleted in T039); implement `draw` (the atlas cell via `drawRotatedTile` + the grass overlay via a module-local `isGrassSurface` reading `neighbourMask`'s UP bit and `horizontalRunPosition`); `images.groundAtlas`.
- [x] T025 [P] [US4] Implement `tiles/groundRock.ts`'s `draw` (two-sprite `isTopExposed` lookup from the `tileset`: `{sx:TILE_SIZE,sy:0}` exposed / `{sx:TILE_SIZE,sy:TILE_SIZE}` buried) — the `groundRock` case of `tileSource` relocates here.
- [x] T026 [P] [US4] Implement `tiles/wall.ts`'s `draw` (`{sx:8*TILE_SIZE, sy:0}` from the `tileset`).
- [x] T027 [P] [US4] Implement `tiles/bridge.ts`'s `draw` (the `bridgeRunPosition` ramp-down/low/ramp-up lookup: left `{9*TILE_SIZE,2*TILE_SIZE}`, right `{11*TILE_SIZE,2*TILE_SIZE}`, else `{10*TILE_SIZE,2*TILE_SIZE}`).
- [x] T028 [P] [US4] Implement `tiles/ladder.ts`'s `draw` (`{9*TILE_SIZE, 3*TILE_SIZE}` from the `tileset`).
- [x] T029 [P] [US4] Implement `tiles/chain.ts`: relocate the chain pieces/helpers (`ChainPieceRect`, `CHAIN_CAP`, `CHAIN_CONTINUES`, `CHAIN_MIDDLE`, `CHAIN_BOTTOM`, `chainRunPieces`, `CHAIN_WALL_GAP`, `chainPieceDestX`) out of `engine/StaticObjectsCatalog.ts`/`engine/Renderer.ts` (the source catalog is deleted in T039); implement `draw` as the whole-run composite from the top cell only (`tileAt(level,col,row-1) !== 'chain'` guard, `chainAttachment`/`chainRunLength`, clamped `capY`, `images.staticObjects`).
- [x] T030 [P] [US4] Implement `tiles/bush.ts`: move `BUSH_OR_TREE_VARIANTS` + `bushOrTreeEntry` (now importing `pickVariant` from `shared/variants`); `draw` uses `verticalRunRole(level,col,row,'bush')` and the `tileset`.
- [x] T031 [P] [US4] Implement `tiles/fence.ts`: move `FENCE_VARIANTS` + the fence half of `staticObjectEntry`; `draw` from `images.staticObjects`.
- [x] T032 [P] [US4] Implement `tiles/cobweb.ts`: move `COBWEB_CORNER_ENTRY`/`COBWEB_FLAT_ENTRY`; `draw` uses `cobwebOrientation` (corner rotation via the same quarter-turn about the cell centre) from `images.decorations`.
- [x] T033 [P] [US4] Implement `tiles/crystalCluster.ts`: move `CRYSTAL_CLUSTER_VARIANTS`; `draw` from `images.decorations`.
- [x] T034 [P] [US4] Implement `tiles/stalactite.ts`: move `STALACTITE_VARIANTS`, `stalactiteEntry`, `isStalactiteTwin`, `TWIN_LEFT_RECT`, `TWIN_RIGHT_RECT`; `draw` skips a cell carrying a `{kind:'fallingStalactite'}` marker (`markerAt`) and draws the variant from `images.decorations`.
- [x] T035 [P] [US4] Implement `tiles/stalagmite.ts`: move `STALAGMITE_VARIANTS` + `stalagmiteEntry`; `draw` from `images.decorations`.
- [x] T036 [US4] Populate the whole torch module in `src/themes/platformer/tiles/torch.ts` (skeleton from T009) by moving the body of `src/themes/platformer/entities/Torch.ts` into it (frame animation, authoring vocabulary, light descriptor, `TorchStrength`, `torchFrameIndex`, etc.) and deleting `entities/Torch.ts`; add its `draw` (frame via `torchFrameIndex` + `TORCH_INSET_X`/`TORCH_FRAME_*`, `images.torch`). Retarget every importer: `level/LevelData.ts`, `level/LevelParser.ts`, `PlatformerState.ts`, `PlatformerPage.tsx`, `entities/Player.ts`, `editor/caveLightingPreview.ts`, `editor/paintMarkerCell.ts`, `editor/EditorCanvas.tsx`, `engine/Renderer.ts`, `engine/Lighting.ts` (if any), and tests (`entities/Torch.test.ts` → `tiles/torch.test.ts`, `entities/Player.test.ts`, `level/LevelParser.test.ts`, `editor/caveLightingPreview.test.ts`, `engine/Renderer.test.ts`). No compatibility re-export (FR-018).
- [x] T037 [US3] Move `src/themes/platformer/engine/CrumblingFloor.ts` → `src/themes/platformer/tiles/crumblingFloor.ts` (state type, durations, phase/offset helpers **and** its `draw`); move `engine/CrumblingFloor.test.ts` → `tiles/crumblingFloor.test.ts` (import-path only). The `draw` is the moved `drawCrumblingFloors` body for one cell (band `afterHazards`: `'broken'` draws nothing; `'atRest'`/`'cracking'` draw the ledge + crack overlay + shake; `'reforming'` grows from a small top-centre square), reading `images.crumblingLedge`/`images.crumblingCracks`. Retarget every remaining importer of `engine/CrumblingFloor`: `PlatformerState.ts`, `engine/Renderer.ts`, `PlatformerPage.tsx`, `entities/deployableItems/DeployableItemType.ts`, `entities/deployableItems/Bomb.ts`, `entities/enemies/movement/patrol.ts`, `entities/enemies/movement/MovementStrategy.ts`, `engine/Collision.ts` (`CrumblingFloorTimerState`/`isCrumblingFloorArmed`), plus their tests. **Not [P]** — retargets `engine/Renderer.ts`/`PlatformerState.ts`, which T036/T038/T040 also touch.
- [x] T038 [US3] Split `src/themes/platformer/entities/blocks/Mushroom.ts` into `tiles/bouncyMushroom.ts` (squash timer, `MushroomSquashState`, `startMushroomSquash`, `advanceMushroomSquashes`, `mushroomSquashDip*`, cap-role art helpers, **and** `draw` with the cap/stem split + squash dip) and `tiles/decorativeMushroom.ts` (the fixed `MUSHROOM_DECORATIVE_ENTRY` `draw`); delete `entities/blocks/Mushroom.ts`. Move `entities/blocks/Mushroom.test.ts` → `tiles/bouncyMushroom.test.ts` and add `tiles/decorativeMushroom.test.ts` for the decorative art assertions (no assertion deleted/weakened). Retarget every importer (`PlatformerState.ts`, `engine/Renderer.ts`, `PlatformerPage.tsx`) and any test imports to `tiles/bouncyMushroom`. **Do NOT run in parallel with T037** — both retarget `PlatformerState.ts`/`engine/Renderer.ts`.
- [x] T039 [US4] Delete `src/themes/platformer/engine/StaticObjectsCatalog.ts` and `src/themes/platformer/engine/GroundAtlas.ts` (no compatibility re-export, FR-018); move `engine/GroundAtlas.test.ts` → `tiles/groundGrass.test.ts` (retarget its `ATLAS_STRIDE` import to `../shared/tileAtlas`); split/move `engine/StaticObjectsCatalog.test.ts` → `tiles/bush.test.ts`, `tiles/fence.test.ts`, `tiles/crystalCluster.test.ts`, `tiles/cobweb.test.ts`, `tiles/stalactite.test.ts`, `tiles/stalagmite.test.ts`, `tiles/chain.test.ts`, `tiles/ropeLadder.test.ts` (each keeps its assertions, import-path/home only).
- [x] T040 [US4] Rewire `src/themes/platformer/engine/Renderer.ts`: `drawTerrain` becomes a band-filtered loop (`for row, for col: const module = TILE_MODULES[tileAt(level,col,row)]; if (module.drawBand === 'terrain') module.draw?.(buildTileDrawContext(...))`) and **delete** `tileSource` and every per-tile `if` branch (including the chain/mushroom/torch branches, now module-owned). Keep the `drawTerrain` entry signature stable (R-009 depends on it). Resolve `TileDrawContext.images` from the already-held image params + `dc.sprites` (`CRUMBLE_FLOOR_SHEET`/`CRUMBLE_CRACKS_SHEET`); build `transient` from the mushroom-squash + crumbling-floor state args. Convert `drawCrumblingFloors` into a thin `afterHazards`-band dispatch to the `crumblingFloor` module's `draw`, preserving its depth-separated pass; `drawDeployableItems` unchanged (owns the `deployable` band for `ladderBundle`/`ropeLadder`).
- [x] T041 [P] [US4] Retarget `src/themes/platformer/entities/deployableItems/RopeLadder.ts`: import `ROPE_BUNDLE`/`ROPE_STEP`/`ROPE_BOTTOM_CAP`/`ropeLadderShaftPieces` from `tiles/ropeLadder` (the lifecycle `draw`, phase machine and effective-terrain contribution stay untouched — the allowed `entities/ → tiles/` edge).
- [x] T042 [P] [US4] Retarget `src/themes/platformer/entities/hazards/FallingStalactite.ts` (and its test) to import `isStalactiteTwin`/`stalactiteEntry`/`TWIN_LEFT_RECT`/`TWIN_RIGHT_RECT` from `tiles/stalactite` (allowed `entities/ → tiles/` edge).
- [x] T043 [P] [US4] Retarget `src/themes/platformer/engine/BackgroundDecorCatalog.ts`'s `pickVariant` import to `shared/variants` (T004 already did the move; confirm and remove the stale `./StaticObjectsCatalog` import).
- [x] T044 [P] [US4] Retarget `src/themes/platformer/engine/BackgroundAtlas.ts`'s `TileAtlas` import to `shared/tileAtlas`.
- [x] T045 [P] [US4] Retarget `src/themes/platformer/entities/Player.ts`'s held-torch frame-dimension imports to `tiles/torch` (allowed `entities/ → tiles/` edge).
- [x] T046 [US4] Run `npm test` + `npm run build`; confirm every migrated draw test passes, no `tileSource` remains, and `level/LevelParser.ts`/`engine/Renderer.ts` no longer branch on tile types. **Checkpoint — US4 (and the two stateful kinds' files have moved).**

**Checkpoint**: US1 + US2 + US4 work; appearance dispatches through the registry.

---

## Phase 6: User Story 3 - A stateful tile declares its state; R-004 owns the lifecycle (Priority: P2)

**Goal**: Plan step 4 — the bouncy mushroom and crumbling floor **declare** their transient state through their tile modules (routed through `shared/timedTile.ts`), while `PlatformerState.ts`'s signals/ticks/reset remain the sole lifecycle. No new signal, tick call or reset list is introduced; the effect registry stays untouched.

**Independent Test**: Each stateful module declares its state descriptor and delegates arm/advance/prune to `shared/timedTile.ts`; the only store/tick/reset remain the existing `PlatformerState.ts` signals and the R-004 core; `neverDeclaresAMushroomSquashKind` still passes.

### Implementation for User Story 3

- [x] T047 [US3] Declare the `state` descriptor on `src/themes/platformer/tiles/bouncyMushroom.ts` and `src/themes/platformer/tiles/crumblingFloor.ts` per `data-model.md` §5, quoting the frozen values verbatim: bouncy mushroom — key shape `{ col, row }`, duration `MUSHROOM_SQUASH_DURATION_SECONDS = 0.1`, prune, re-arm `'replace'`, phase/offset mapping `mushroomSquashDip`; crumbling floor — key shape `{ col, row }`, duration `CRUMBLING_FLOOR_CYCLE_SECONDS = CRACK 0.9 + BROKEN 1.5 + REFORM 0.4` (= 2.8 s), prune, re-arm `'noop'`, phase/offset mapping `crumblingFloorPhaseAt`/`crumblingFloorCrackRatioAt`/`crumblingFloorReformRatioAt`. No module contains its own arm/advance/prune loop; both delegate to `shared/timedTile.ts`.
- [x] T048 [US3] Retarget `src/themes/platformer/PlatformerState.ts` imports only: `advanceMushroomSquashes`/`MushroomSquashState` from `tiles/bouncyMushroom`; `armCrumblingFloor`/`advanceCrumblingFloors`/`CrumblingFloorTimerState` from `tiles/crumblingFloor`; `DEFAULT_TORCH_STRENGTH`/`TorchLight` from `tiles/torch`. Keep `mushroomSquashStates`, `tickMushroomSquashes`, `crumblingFloorTimerStates`, `armCrumblingFloorTrigger`, `tickCrumblingFloors` and every `resetGame()` entry **unchanged** — no new signal, tick call or reset list (SC-004).
- [x] T049 [US3] Migrate `src/themes/platformer/PlatformerState.test.ts` and `src/themes/platformer/PlatformerPage.test.tsx` imports of `MUSHROOM_SQUASH_DURATION_SECONDS`/mushroom+crumbling symbols to their `tiles/` homes (import-path only; no assertion changed). Retarget any remaining `engine/CrumblingFloor`/`entities/blocks/Mushroom` test imports.
- [x] T050 [US3] Verify the effect registry is untouched: `src/themes/platformer/engine/effects/effectRegistry.test.ts`'s `neverDeclaresAMushroomSquashKind` passes unchanged; no `EFFECT_REGISTRY`/`shared/timedTile.ts` edit; `docs/TransientEffectRecipe.md`'s "not every timed visual is an effect" note still holds. Run `npm test`. **Checkpoint — US3.**

**Checkpoint**: All P1/P2 stories functional and independently testable.

---

## Phase 7: User Story 5 - The restructuring is invisible (Priority: P1)

**Goal**: Plan step 5 — every remaining existing test migrates with its module (home/import-path only), nothing is deleted/skipped/weakened, and the FR-014 guard is tightened to full strictness.

**Independent Test**: The full suite passes with only import-path/module-home edits; the guard fails if any structural invariant regresses; a diff of the test-file set shows no deletions/skips/weakened assertions.

### Implementation for User Story 5

- [x] T051 [US5] Migrate every remaining test whose module moved, by home/import path only: `level/Terrain.test.ts` (symbol repoints already in T017), `engine/Physics.test.ts`, `engine/Standable.test.ts`, `engine/Renderer.test.ts`, `engine/BackgroundAtlas.test.ts`, `engine/BackgroundDecorCatalog.test.ts`, `level/LevelParser.test.ts`, `entities/deployableItems/RopeLadder.test.ts`, `entities/enemies/movement/patrol.test.ts`, `editor/paletteTiles.test.ts`, `editor/Palette.test.tsx`, `PlatformerPage.test.tsx`. No assertion deleted, skipped (`it.skip`/`describe.skip`) or weakened (no loosened matchers, no removed `expect`).
- [x] T052 [US5] Tighten the FR-014 guard's rule-branch check in `src/themes/platformer/tiles/registry.test.ts` to full strictness: for each of `engine/Physics.ts`, `engine/Standable.ts`, `level/Terrain.ts`, assert the source contains no `=== '<tileType>'` / `!== '<tileType>'` comparison against a known `TileType` literal outside the registry-dispatch helpers (comparisons against non-tile literals such as phase names are permitted; the pure run classifiers `bridgeRunPosition`/`chainRunLength` in `level/Terrain.ts` are explicitly exempt — they select run sprites, not rules). Remove the step-1 relaxation.
- [x] T053 [US5] Audit test preservation across `src/themes/platformer/**/*.test.ts(x)`: compare the pre-refactor and post-refactor test-file sets and assertion counts; confirm zero deleted/skipped/weakened tests (the moved files are the same assertions at new homes, e.g. `tiles/groundGrass.test.ts` from `engine/GroundAtlas.test.ts`). Record the audit in the completion report.
- [x] T054 [US5] Run `npm test` — full suite green including the strict guard. **Checkpoint — US5 (behaviour-preservation automated gate).**

**Checkpoint**: The restructuring is invisible to the automated suite.

---

## Phase 8: User Story 6 - Documented recipe for adding a tile (Priority: P3)

**Goal**: Plan step 6 — collapse the "Adding a tile" recipe to one module + one registry line, close the F-018 open gap, and update the dependent docs; then run the full verification gate.

**Independent Test**: Follow the recipe to add a throwaway tile kind with only a new module and one registry line; the F-018 gap note is recorded as closed.

### Implementation for User Story 6

- [x] T055 [US6] Rewrite the "Adding a tile" section of `docs/themes/platformer/Terrain.md` to the one-module-plus-one-registry-line form: (1) add `src/themes/platformer/tiles/<kind>.ts` declaring `char`/`fogExempt`/`drawBand` and any rule/draw hooks; (2) add one line to `TILE_MODULES` in `tiles/registry.ts`; `TileType`/`TERRAIN_CHARS`/`TILE_FOG_EXEMPT` derive automatically. Name the module contract (draw, rule capabilities, state declaration), where the registry lives, and how the union/char table derive from it. Remove the ten-step cross-file recipe.
- [x] T056 [US6] Close the F-018 gap in `docs/themes/platformer/Terrain.md`: replace the "**Open gap:** terrain kinds still do not own their own rules … a future feature may still lift these predicates into a registry." note with a statement that R-015 closed it — terrain kinds now own their rules through `TILE_MODULES`. Also update the "three behavioral axes" and "Runtime overrides"/mushroom-squash prose where it names the removed predicates or old file homes (`isStandableLadderTop`, `isStandableMushroomCap`, `engine/MushroomSquash.ts`, `engine/CrumblingFloor.ts`, `engine/StaticObjectsCatalog.ts`, `engine/GroundAtlas.ts`, `engine/Torch.ts`).
- [x] T057 [US6] Update `docs/themes/platformer/LevelFormat.md`: the `TERRAIN_CHARS`/terrain-`TileChar` pointer now names `src/themes/platformer/tiles/registry.ts` (composed by `level/LevelParser.ts`); keep the entity/sign/hazard char tables' home unchanged.
- [x] T058 [US6] Update the `docs/TransientEffectRecipe.md` "Not every timed visual is an effect" note's path reference from `entities/blocks/Mushroom.ts` to `tiles/bouncyMushroom.ts` (the note that it is a keyed timed tile, not an effect, stays valid).
- [x] T059 [US6] Run the full verification gate per `quickstart.md` §1–§4: `npm test`, `npm run build`, `npm run lint`; then `npm run dev` and perform the browser pass (§4: grass autotiling, rock/wall, bridge drop-through, ladder/chain climb + standable tops, rolled bundle deploy, bouncy mushroom bounce/squash, decorative mushroom, crumbling-floor cycle, torches/cobweb/crystal/stalactite/stalagmite/fence/bush, cave fog, editor preview/palette unchanged). **Checkpoint — US6 + behaviour gate.**

**Checkpoint**: All user stories complete; recipe collapsed and gap closed.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Feature-completion tracking and a final independent structural/behaviour audit.

- [x] T060 [P] Update `docs/Features.md`'s dependency diagram: prefix the `R015` node label with `✅ ` and add `class R015 done` (per `AGENTS.md`). No status table exists in that file; do not add one.
- [x] T061 [P] Run the quickstart §3 demonstration (`quickstart.md`): add a throwaway `tiles/` module + one registry line, confirm it parses/renders/reports its rules with zero edits to `level/Terrain.ts`, `engine/Physics.ts`, `engine/Standable.ts`, `engine/Renderer.ts`, `level/LevelParser.ts`, `level/LevelData.ts` or the editor palette (SC-002/SC-008), then revert the throwaway.
- [x] T062 Final audit of `src/themes/platformer/tiles/registry.test.ts` + `level/Terrain.ts`, `engine/Physics.ts`, `engine/Standable.ts`, `engine/Renderer.ts`, `level/LevelParser.ts`: confirm no compatibility re-export/alias/second dispatch path survives (FR-018); confirm `contracts/` is a leaf and no forbidden layer edge exists (FR-011/SC-006); confirm no new tile kind/gameplay/visual/tuning/level-data/editor behaviour was introduced (FR-012); run `npm test`, `npm run build`, `npm run lint` one last time. No auto-commit (per constitution and `AGENTS.md`).
- [x] T063 [US6] Add the FR-009 palette read-model assertion to `src/themes/platformer/tiles/registry.test.ts`: every palette-relevant kind exposes `char` (where author-placeable), `fogExempt`, `drawBand` and its `draw`-hook presence through `TILE_MODULES`, so R-010 can build the palette from the registry alone with no second table; assert `editor/paletteTiles.ts` holds no module-local tile table and that `TILE_MODULES` is the single source (SC-008).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all module work.
- **US1 (Phase 3)**: depends on Foundational; depends on the FR-014 guard written first (T005).
- **US2 (Phase 4)**: depends on US1 (registry + modules exist).
- **US4 (Phase 5)**: depends on US1; the stateful-kind moves (T037/T038) also feed US3.
- **US3 (Phase 6)**: depends on US4's file moves (T037/T038) and US2's `solidRegionAt` (T014).
- **US5 (Phase 7)**: depends on US2 + US4 + US3 (all files at final homes).
- **US6 (Phase 8)**: depends on US5 (docs describe the shipped structure).
- **Polish (Phase 9)**: depends on all phases.

### Within each story

- Tests first (T005 before T006).
- Registry before module dispatch; module hooks before dispatch rewiring.
- Terrain dispatch (T016) before Physics/Standable/patrol/Bomb rewiring.
- File moves (T037/T038/T039) before Renderer rewiring (T040).

### Parallel Opportunities

- Foundational: T003, T004 run in parallel (different files); T002 in parallel with them.
- US1 module skeletons: T007, T008, T009, T010 run in parallel (disjoint files); T006 depends on T002.
- US2: T020 and T021 run in parallel; T014 and T015 run in parallel.
- US4 draws: T025–T035, T043, T044, T045 are all disjoint files and run in parallel once T023 exists. T036 edits `engine/Renderer.ts`/`PlatformerState.ts`, so it is **not** `[P]` and must serialize with T037/T038 before the T040 Renderer rewire.
- US3: T049's test retargets are independent (T047 edits two files — `bouncyMushroom.ts` and `crumblingFloor.ts` — and is not `[P]`).
- Polish: T060 and T061 are independent.

---

## Parallel Example: US4 (draw extraction)

```bash
# All disjoint tile draw modules (after T023 creates tiles/draw.ts):
Task: "T025 Implement tiles/groundRock.ts draw"
Task: "T026 Implement tiles/wall.ts draw"
Task: "T027 Implement tiles/bridge.ts draw"
Task: "T028 Implement tiles/ladder.ts draw"
Task: "T029 Implement tiles/chain.ts draw + pieces"
Task: "T030 Implement tiles/bush.ts draw + variants"
Task: "T031 Implement tiles/fence.ts draw"
Task: "T032 Implement tiles/cobweb.ts draw"
Task: "T033 Implement tiles/crystalCluster.ts draw"
Task: "T034 Implement tiles/stalactite.ts draw + twin geometry"
Task: "T035 Implement tiles/stalagmite.ts draw"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2 Foundational → 3 US1 (registry + modules + guard).
2. **STOP and VALIDATE**: run `npx vitest run src/themes/platformer/tiles/registry.test.ts` and `npm test`; every `TileType` resolves to one module and one registry entry.
3. This is the structural contract R-008/R-009/R-010 consume.

### Incremental Delivery

1. Setup + Foundational → skeleton ready.
2. US1 → registry MVP (guard green).
3. US2 → rules dispatch; engine/level branch-free.
4. US4 → appearance dispatch; `tileSource` deleted; sprite tables distributed.
5. US3 → stateful kinds declare state; R-004 lifecycle untouched.
6. US5 → every test migrated; guard strict.
7. US6 → docs + full verification gate.
8. Polish → `docs/Features.md`, SC-002 demonstration, final audit.

Each increment keeps the suite green and is a behaviour-preserving restructure.

---

## Notes

- **Pure restructuring**: behaviour/tuning/art/level data/editor behaviour are byte-for-byte preserved; no new tile kinds (FR-010/FR-012).
- **Layer invariants** (enforced by T052's guard): `contracts/` a leaf; no `level/ → engine/`; no `engine/ → state/`; no `tiles/ → entities/`; no `tiles/ → engine/`. Allowed narrow back-edges: `entities/ → tiles/` for RopeLadder art (T041) and FallingStalactite geometry (T042); accepted mutual edge `level/ ↔ tiles/`.
- **[P] tasks** = different files, no dependencies; verify before running.
- **No auto-commit**: the project never auto-commits; the before/after-tasks git hooks are optional and MUST NOT be run.
- **Out of scope**: R-010 palette unification, R-009 SceneRenderer/HudRenderer split; R-015 only exposes the consumable contract.
