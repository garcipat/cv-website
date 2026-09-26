---
description: "Task list for R-010 Platformer Mapper & Editor Unification"
---

# Tasks: Platformer Mapper & Editor Unification (R-010)

**Input**: Design documents from `/specs/R-010-platformer-mapper-editor-unification/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required; user stories + Clarifications 2026-09-27), [research.md](./research.md) (decisions D1–D13, OQ-1 resolved), [data-model.md](./data-model.md), [contracts/](./contracts/) ([grid-pipeline](./contracts/grid-pipeline.md), [mapper-placement](./contracts/mapper-placement.md), [palette-descriptor](./contracts/palette-descriptor.md), [save-module](./contracts/save-module.md), [layer-invariants](./contracts/layer-invariants.md)), [quickstart.md](./quickstart.md), [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)

**Nature of this feature**: A **behaviour-preserving refactor** of the already-shipped platformer mapper + editor pipeline. The acceptance bar is byte-for-byte behaviour preservation (FR-015, SC-007): the editor preview, palette metadata, painted cells, imported/exported/cropped layout strings, saved level/blueprint JSON and the runtime level output MUST be identical to before. Only TypeScript module homes, imports, types and helper APIs move. No new tile, tool, gameplay, art, tuning, level data or translation change.

**Tests**: Tests are **required** (not optional) — constitution Principle II (NON-NEGOTIABLE), FR-016 and FR-017. New pure helpers get co-located `{method}-{condition}-{expected-result}` unit tests written first where practical; every existing test migrates with its module and keeps its assertions (only import-path/module-home edits and the sanctioned internal-preview-id updates are permitted). The new `editor/editorStructure.test.ts` guard (T041) enforces the single-implementation invariants.

**Out of scope (do NOT do)**: R-015's `tiles/` tile-module registry itself. It is **shipped** and is only **consumed** by the palette descriptor (kind membership + `char`/`fogExempt`/`drawBand`). R-010 MUST NOT build its own tile registry, add a second tile-kind/palette table, or extend R-015's contract. Also out of scope: R-009 renderer split, R-011–R-014, the already-landed M4/M5/F5/F6 findings, and any `entity/` or `features/` regroup.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete work)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Every task names exact file paths. Paths are relative to `src/themes/platformer/` unless they start with `docs/`/`specs/` (repo root `D:\Workspace\cv-website`).

## Path Conventions

Single project. New cross-cutting, React-free primitives live in `level/`; editor-only pure transforms live under `editor/ops/`; save/dev infrastructure lives under `editor/dev/`; React UI plus `editorState.ts`/`editorActions.ts` stay at `editor/`.

## Story ↔ phase map (dependency order)

This is a **dependency-ordered restructure** (the suite must stay green at every checkpoint), so the phases follow the real dependency chain rather than strict priority order. Story labels ride on the phases:

| Phase | Work group | User story | Findings |
| --- | --- | --- | --- |
| 3 | Editor preview from the runtime finder + mapper chain | **US1** (P1) 🎯 MVP | M1 |
| 4 | One mapper placement helper set + one CV flattening path | **US2** (P1) | M2/M3 |
| 5 | One paint, import/export and save path | **US3** (P1) | M7 |
| 6 | The palette is one descriptor table | **US4** (P1) | M6 |
| 7 | One raw-file shape and one editor taxonomy | **US5** (P2) | M8/F8 |
| 8 | The unification is invisible (verification + guard) | **US6** (P1) | acceptance |

US1 precedes US2 because the preview builders consume the mapper public APIs; US2 then makes those mappers descriptor-based without changing their outputs. US3 depends on Foundational's grid-crop primitive and (for `importLayout`) its own `layoutChars` walk. US4 is independent. US5's `LayoutFile` alias is independent; its folder moves are safest after the modules it relocates have stopped changing (deduplicated to a light final sweep, since US3/US4 move the modules they rewrite into place). US6 runs last over the combined change.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a green pre-refactor baseline and capture the parity artifacts US6 diffs against.

- [ ] T001 Confirm branch `R-010-platformer-mapper-editor-unification` is checked out; run `npm install`, then `npm test`, `npm run build` and `npm run lint` from the repo root — all MUST pass before any edit. No source file changes.
- [ ] T002 [P] Capture the pre-refactor parity artifacts for US6 byte-comparison: save the de-prettified output of exporting/cropping a shipped level (`level/levels/main.json`) and a shipped blueprint, and the exact `layoutFileJson`-equivalent JSON for a level and a blueprint (record the strings in the completion notes). This is the SC-007 diff baseline.

**Checkpoint**: Baseline green; parity artifacts captured.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one shared row-serialization primitive (generic grid-crop) and the low-level grow primitive both US1's grid→layout adapter and US3's export/crop path build on. Also establishes the `editor/ops/` home so later stories land modules in their final place.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [ ] T003 [P] Move `src/themes/platformer/editor/growGrid.ts` → `src/themes/platformer/editor/ops/growGrid.ts` and `growGrid.test.ts` → `ops/growGrid.test.ts` (import-path only, assertions unchanged); retarget its importers `editor/paintCell.ts`, `editor/paintBackgroundCell.ts`, `editor/placeBlueprint.ts`. The low-level grow primitive used by the FR-009 paint/stamp primitive (T021).
- [ ] T004 [P] Generalize and move the one grid-crop primitive: `src/themes/platformer/editor/exportLayout.ts` → `src/themes/platformer/editor/ops/exportLayout.ts`, making `cropLayoutToBox<T>(grid, box, emptyValue)`, `boundingBoxOfContent<T>(grid, emptyValue)`, `unionBoxes` and `exportLayout` generic over the cell type (foreground `TileChar` empty `'.'`; background `BackgroundChar` empty `'.'`) per [contracts/grid-pipeline.md](./contracts/grid-pipeline.md) §3. Move `exportLayout.test.ts` → `ops/exportLayout.test.ts` (assertions unchanged); retarget `editor/cropLevelForExport.ts`, `editor/EditorToolbar.tsx`, `editor/LevelEditorPage.test.tsx`, `editor/saveLevelFile.test.ts`. This is the **one** grid sub-rectangle → rows serializer (FR-002/FR-010), consumed by US1's `gridToLayout` and US3's `cropLevelForExport`.
- [ ] T005 Run `npm test` from the repo root; the full suite MUST stay green after the two relocations. **Checkpoint — Foundational.** Do NOT create the FR-017 guard yet (it would be red until the structure lands; it is written in T041).

**Checkpoint**: `editor/ops/` exists; the one crop primitive and the low-level grow primitive are in their final homes with the suite green.

---

## Phase 3: User Story 1 - The editor preview is produced by the runtime finder + mapper chain (Priority: P1) 🎯 MVP

**Goal**: Delete `editor/gridRenderState.ts`'s parallel pipeline (`findAllPositions` + every `synthesize*`) and feed the editor's in-memory grid (and marker grid) through one grid→layout adapter into the **same** `LevelParser` finders + `*Mapper` place functions the running game uses (FR-001/FR-002, D1/D2). The one sanctioned editor-only preview helper (the static player placeholder) survives, rebuilt on the shared `findOptionalSpawnTile`.

**Independent Test**: `rg "findAllPositions|synthesize" src/themes/platformer/editor` finds no parallel finder/synthesizer (only the renamed `previewPlayerState`); a grid containing each entity/hazard/marker character produces preview placements equal to the runtime finder + mapper chain for the equivalent layout, with the chest-def list padded so all 7 `$` markers preview (OQ-1).

### Implementation for User Story 1

- [ ] T006 [US1] Add `findOptionalSpawnTile(layout: readonly string[]): { col: number; row: number } | null` to `src/themes/platformer/level/LevelParser.ts` as a null-returning companion to the existing `findSpawnTile` (D2), plus its unit tests in `level/LevelParser.test.ts` (present → the `S` cell; absent → `null`). It removes the last copy of the editor's local `S` scan.
- [ ] T007 [US1] Create `src/themes/platformer/editor/ops/gridLayout.ts` per [contracts/grid-pipeline.md](./contracts/grid-pipeline.md) §2: `gridToLayout(grid: TileChar[][]): readonly string[]` (= `cropLayoutToBox(grid, fullBox, '.')`, the **only** editor function that derives raw layout rows from a grid), `markerGridToPlacements(markers: MarkerGrid): MarkerPlacement[]` (dense → sparse), and `previewLevelDef(grid, markers): LevelDef` = `parseLevel(gridToLayout(grid), markerGridToPlacements(markers))` — markers always passed (even `[]`) so a bare `T` maps to `'empty'` (sign), not decorative `stalactite`. Add `ops/gridLayout.test.ts` (TDD). Depends on T004.
- [ ] T008 [US1] Create `src/themes/platformer/editor/ops/previewPlacements.ts` (D1): build every preview collection by calling the **runtime** finders and mappers directly — `placeCollectibles(findCoinTiles(layout))`, `placeEnemies(mapCVDataToEnemies(cv), { slimeGreen: findGreenEnemyTiles(layout), slimePurple: findPurpleEnemyTiles(layout), bee: findBeeTiles(layout) }).map(toEnemyState)`, `placeBlocks(mapCVDataToBlocks(cv), { crate: findCrateTiles(layout),… }).map(toBlockState)`, `placeChests(padChestDefs(mapCVDataToChests(cv), findChestTiles(layout)), findChestTiles(layout)).map(toChestState)`, `placeCheckpoints(findCheckpointTiles(layout)).map(toCheckpointState)`, `placeSigns(findSignTiles(layout, markers))`, `placeHazards(findHazardTiles(layout, markers))`, `findLadderBundleTiles(layout).map(({col,row}) => createRopeLadderState(level, col, row))`; plus `previewPlayerState(layout)` using `findOptionalSpawnTile`. **OQ-1**: implement `padChestDefs(defs, markers)` to append placeholder-fact defs until `defs.length === markers.length`, so every `$` marker previews and stays deletable — the shared `findChestTiles`/`placeChests` do the work and the runtime list stays unpadded. No editor-local finder or place loop may be re-implemented. Depends on T006, T007.
- [ ] T009 [US1] Rewire every `gridRenderState` consumer onto the new ops modules and delete the parallel pipeline: `src/themes/platformer/editor/EditorCanvas.tsx` and `src/themes/platformer/editor/caveLightingPreview.ts` import from `./ops/gridLayout` + `./ops/previewPlacements` instead of `./gridRenderState`; delete `src/themes/platformer/editor/gridRenderState.ts` (`findAllPositions` + all `synthesize*`). Depends on T008.
- [ ] T010 [US1] Migrate `src/themes/platformer/editor/gridRenderState.test.ts` → `src/themes/platformer/editor/ops/previewPlacements.test.ts` (and add `ops/gridLayout.test.ts` coverage): assert each builder's output equals the corresponding runtime finder + mapper chain for `gridToLayout(grid)` (same kinds, positions, appearance fields); update only the sanctioned internal preview ids (e.g. `editor-crate-0` → `crate-${col}-${row}`), never weaken assertions; assert the chest preview shows one chest per `$` marker (7 for the shipped level) while the runtime list is unpadded (SC-001/OQ-1). Depends on T008.
- [ ] T011 [US1] Run `npm test`; then run the SC-001 grep from [quickstart.md](./quickstart.md) §2 (`rg "findAllPositions|synthesizeCollectiblePlacements|…|synthesizeRopeLadderBundleStates" src/themes/platformer/editor`) and confirm no match survives. **Checkpoint — US1 MVP.** Do not commit.

**Checkpoint**: The editor preview is the runtime chain via the one adapter; the parallel pipeline is gone.

---

## Phase 4: User Story 2 - One mapper placement helper set and one CV flattening path (Priority: P1)

**Goal**: Collapse the seven `*Mapper` place loops onto one `placeAtMarkers`, the duplicated proportional fact-pool slice onto one `placeWithFactPool`, the CVData→fact flattening onto one `cvFact`, and move `slugify`/derived ids to `level/ids.ts` (FR-003–FR-006, D4/D5). Every produced id stays byte-identical.

**Independent Test**: `rg "function placeAtMarkers|function placeWithFactPool" src/themes/platformer/level` → one each; `rg "function slugify" src/themes/platformer/level` → only `level/ids.ts`; no mapper imports `slugify` from `./CollectibleMapper`; no `markers.map(`/`markers.forEach(` place loop remains in a mapper.

### Implementation for User Story 2

- [ ] T012 [US2] Create `src/themes/platformer/level/ids.ts` per [contracts/mapper-placement.md](./contracts/mapper-placement.md) §3: move `slugify` out of `level/CollectibleMapper.ts` **verbatim** and add `slugId(prefix, ...parts)`. **Remove the `slugify` export from `CollectibleMapper.ts` entirely (no re-export)** and retarget every importer (`level/BlockMapper.ts`, `level/EnemyMapper.ts`, `level/ChestMapper.ts`, `level/CollectibleMapper.ts`) to `./ids`. Add/repurpose `level/ids.test.ts`. Not `[P]` — it edits four mappers.
- [ ] T013 [P] [US2] Create `src/themes/platformer/level/cvFacts.ts` (D5): the one `cvFact(sectionId, sectionLabel, sourceType, id, data): CollectedFact` constructor for the `{ id, sectionId, sectionLabel, data, sourceType }` shape currently copied across the block/enemy/chest/collectible converters, plus `level/cvFacts.test.ts`.
- [ ] T014 [US2] Create `src/themes/platformer/level/placement.ts` (D4) per [contracts/mapper-placement.md](./contracts/mapper-placement.md) §1–§2: `MarkerPosition`, `PlaceAtMarkersDescriptor<M, P>` (`idPrefix`, optional `id`, `build`), `placeAtMarkers` (id = `descriptor.id?.(m,i) ?? \`${idPrefix}-${m.col}-${m.row}\``; `x`/`y` = `tileToPixel`), `FactPoolPlacement`, and `placeWithFactPool` implemented **on top of** `placeAtMarkers` (slice = `pool.slice(revealedFactCountFor(i,n,|pool|), revealedFactCountFor(i+1,n,|pool|))`). Add `level/placement.test.ts`. Depends on T012 (ids for builders) — not `[P]`.
- [ ] T015 [US2] Retarget `src/themes/platformer/level/BlockMapper.ts`: `placeBlocks`/`placeCrates`/fragileRock/coinPot/potionPot/bombPot and the question-mark 1:1 zip route through `placeAtMarkers` (crates through `placeWithFactPool`); collapse the five `educationToBlock`/… converters to `slugId` + `cvFact`; every id (`block-edu-…`, `qmark-cert-…`, `fragileRock-…`, `crate-…`) byte-identical. Depends on T012–T014.
- [ ] T016 [P] [US2] Retarget `src/themes/platformer/level/EnemyMapper.ts`: `placePurpleSlimes`/`placeBees` → `placeAtMarkers` and `placeGreenSlimes` → `placeWithFactPool` (delete its private slice loop); `courseToEnemy` collapses to `slugId` + `cvFact`; ids (`enemy-slimeGreen-…`, `enemy-slimePurple-…`, `enemy-bee-…`) byte-identical. Depends on T012–T014.
- [ ] T017 [P] [US2] Retarget `src/themes/platformer/level/ChestMapper.ts`: `placeChests` → `placeAtMarkers(markers.slice(0, defs.length), { idPrefix:'chest', id:(m,i)=>defs[i].id, build:(m,i)=>({ ...defs[i], col:m.col, row:m.row }) })`, preserving today's exact def-driven zip and the reversed `cv.experience` order; `experienceToChest` collapses to `slugId` + `cvFact`.
- [ ] T018 [P] [US2] Retarget `src/themes/platformer/level/CollectibleMapper.ts`: `placeCollectibles` → `placeAtMarkers(..., { idPrefix:'coin', build: () => ({ kind:'coin', collected:false }) })`; `mapCVDataToSkillFactPool` and `categoryToSkillFact` route through `cvFacts`; no `slugify` home remains.
- [ ] T019 [P] [US2] Retarget `src/themes/platformer/level/CheckpointMapper.ts`, `src/themes/platformer/level/SignMapper.ts` and `src/themes/platformer/level/HazardMapper.ts` → `placeAtMarkers` with the `id` override preserving `sign-${hintId}-…` and `hazard-${type}-…`; keep `signBox` behaviour.
- [ ] T020 [US2] Migrate the mapper tests (`level/BlockMapper.test.ts`, `EnemyMapper.test.ts`, `ChestMapper.test.ts`, `CollectibleMapper.test.ts`, `CheckpointMapper.test.ts`, `SignMapper.test.ts`, `HazardMapper.test.ts`) to the generic form — assertions preserved (ids/positions/kinds byte-identical); a test for a per-mapper place loop is rewritten against `placeAtMarkers`, never weakened. Depends on T015–T019.
- [ ] T021 [US2] Run `npm test`; then run the SC-002 greps from [quickstart.md](./quickstart.md) §2 (`placeAtMarkers`/`placeWithFactPool` exactly one each; `slugify` declared only in `level/ids.ts`; no `from './CollectibleMapper'` slugify import). **Checkpoint — US2.** Do not commit.

**Checkpoint**: One marker→placement loop, one fact-pool slice, one flattening helper, one id home; mappers are descriptors + builders.

---

## Phase 5: User Story 3 - One paint, import/export and save path (Priority: P1)

**Goal**: Replace the repeated grid-copy/grow/write bodies with one generic paint primitive; share one layout-character walk between `parseLevel` and `importLayout`; make `cropLevelForExport` a wrapper over the one generic crop primitive; collapse the per-tool canvas semantics into the shared ops; and replace `saveLevelFile`/`saveBlueprintFile` with one parametrised save module (FR-009–FR-012, D3/D7/D8/D9).

**Independent Test**: `rg` finds exactly one `stampGridCells`/`paintGridCell` (paint), one `walkLayout` (layout walk), one `cropLayoutToBox` (crop) and one `saveFile` (save); `cropLevelForExport` defines no crop loop; `EditorCanvas.applyToolAt` holds no per-tool placement rule; painting foreground/background/markers, importing/exporting/cropping and saving a level or blueprint produce byte-identical results.

### Implementation for User Story 3

- [ ] T022 [US3] Create `src/themes/platformer/editor/ops/paintGrid.ts` (D7) per [data-model.md](./data-model.md) §7: `stampGridCells<T>(grid, cells, emptyValue, grow?)` and `paintGridCell<T>(grid, col, row, value, emptyValue, grow?)` (the single-cell case), built on `ops/growGrid.ts`; add `ops/paintGrid.test.ts` (TDD). Depends on T003.
- [ ] T023 [US3] Rewire the per-layer paints onto `paintGridCell` with per-layer behaviour as **data**, moving them under `editor/ops/`: `paintCell.ts` (foreground; `grow=true`, spawn-clearing and hazard-facing cycle stay in this module's rules), `paintBackgroundCell.ts` (`grow=true`), `paintMarkerCell.ts`/`eraseMarkerCell` (`grow=false`). No per-layer body repeats the copy/grow/write loop. Move their tests to `ops/` (assertions unchanged). Depends on T022.
- [ ] T024 [P] [US3] Rewire `src/themes/platformer/editor/ops/placeBlueprint.ts`: `placeBlueprint` and `rebaseBlueprintBackground` use `stampGridCells` (blueprint writes every cell; rebase filters `.`), keeping the existing `importMarkerGrid` dependency and `BlueprintCell` type. Move `placeBlueprint.test.ts` to `ops/`.
- [ ] T025 [US3] Create `src/themes/platformer/level/layoutChars.ts` (D3) per [contracts/grid-pipeline.md](./contracts/grid-pipeline.md) §1: `walkLayout(layout, visit)` yielding `{ char, col, row }` for in-bounds cells (`width = max(row.length)`, short rows skipped) and `layoutWidth(layout)`; rewire `level/LevelParser.parseLevel` (still returns `LevelDef`) and `editor/ops/importLayout.ts`'s `importLayout` (still returns `TileChar[][]` with legacy-marker migration) as visitors, with no local `for row … for col …` walk left in either; add `level/layoutChars.test.ts`.
- [ ] T026 [US3] Rewire `src/themes/platformer/editor/ops/cropLevelForExport.ts` as a **wrapper** over `cropLayoutToBox` (T004): keep the public `{ layout, background, markers }` shape and exact semantics (box = union of non-`.` foreground cells and non-null markers; all-empty ⇒ `layout: ['.']`, `background: []`, `markers: []`), obtaining both `layout` and `background` from `cropLayoutToBox`; define no column loop. `ops/cropLevelForExport.test.ts` assertions unchanged. Depends on T004.
- [ ] T027 [US3] Extract `src/themes/platformer/editor/ops/applyTool.ts` (D8): `applyTool(grid, markers, col, row, tool, isErase): { paint: PaintResult; markers: MarkerGrid | null; target: { col, row } }` composing the shared primitives (`paintCell`, `paintMarkerCell`, `paintSignMarker`, `paintTorchMarker`, `eraseMarkerCell`, `shiftMarkerGrid`) and exporting `markerRemovedOnRepaint(kind)` for the "clear marker on repaint" set (`sign`/`fallingStalactite`/`torch` removed; `patrolBoundary`/`connectionPoint` survive). Rewire `src/themes/platformer/editor/EditorCanvas.tsx`'s `applyToolAt` to call it (no per-tool placement semantics left in the component) (FR-012). Depends on T023.
- [ ] T028 [US3] Create `src/themes/platformer/editor/dev/saveFile.ts` (`saveFile({ endpoint, fileName, contents })` owning the exact POST-with-download fallback, plus the once-defined `downloadFile`) and `src/themes/platformer/editor/dev/layoutFileJson.ts` (`layoutFileJson(name, layout, background, markers)` — the one prettified, newline-terminated serializer with the `hasBackgroundContent` rule) per [contracts/save-module.md](./contracts/save-module.md) §1; add co-located tests. Depends on T004 (no; independent) — `[P]` with T025/T026.
- [ ] T029 [US3] Thin `src/themes/platformer/editor/dev/saveLevelFile.ts` and `src/themes/platformer/editor/dev/saveBlueprintFile.ts` over `saveFile` + `layoutFileJson` (level/blueprint endpoints, `levelFileName`/`blueprintFileName` with the `'new'`→`'new-1'` guard; `LEVELS_FOLDER`/`BLUEPRINTS_FOLDER` stay exported); migrate the endpoint modules to `editor/dev/` (`saveLevelEndpoint.ts`, `saveBlueprintEndpoint.ts`). Retarget consumers `editor/editorActions.ts`, `editor/EditorToolbar.tsx`, `editor/EditorSaveDialog.tsx` and the related tests, keeping produced JSON byte-identical. Depends on T028.
- [ ] T030 [US3] Migrate the paint/import/export/crop/save tests to their final homes and forms (assertions unchanged): `ops/paintCell.test.ts`, `ops/paintBackgroundCell.test.ts`, `ops/paintMarkerCell.test.ts`, `ops/importLayout.test.ts`, `ops/exportLayout.test.ts`, `ops/cropLevelForExport.test.ts`, `ops/placeBlueprint.test.ts`, `ops/applyTool.test.ts` (extracted from `EditorCanvas.test.tsx`'s `applyToolAt` cases), `dev/saveLevelFile.test.ts`, `dev/saveBlueprintFile.test.ts`, `dev/layoutFileJson.test.ts`. `level/blueprintRegistry.test.ts`'s `blueprintFileJson` import moves to `dev/layoutFileJson`. Depends on T023–T029.
- [ ] T031 [US3] Run `npm test`; then run the SC-004 greps from [quickstart.md](./quickstart.md) §2 (`stampGridCells`/`paintGridCell`, `walkLayout`, `cropLayoutToBox`, `saveFile` exactly one each; `cropLevelForExport` defines no crop loop). **Checkpoint — US3.** Do not commit.

**Checkpoint**: One paint primitive, one layout-character walk, one grid-crop wrapper, one save module; canvas clicks and ops share the same rules.

---

## Phase 6: User Story 4 - The palette is one descriptor table (Priority: P1)

**Goal**: Collapse `paletteTiles.ts`'s four parallel tables into one `PALETTE_TOOLS` descriptor keyed by `EditorTool`, with terrain entries reading kind membership + `char`/`fogExempt`/`drawBand` from R-015's shipped `TILE_MODULES` registry (FR-007/FR-008, D6). R-015 is consumed, never rebuilt or extended; palette icon sprite specs stay in the descriptor.

**Independent Test**: One `PALETTE_TOOLS` declaration and none of `PALETTE_TILE_SPRITES`/`_GLYPHS`/`_DESCRIPTIONS`/`_LABELS`; every tool's label, description, sprite, glyph and grouping is unchanged; a terrain entry's `char`/`fogExempt`/`drawBand` resolve from `TILE_MODULES`.

### Implementation for User Story 4

- [ ] T032 [US4] Move `src/themes/platformer/editor/paletteTiles.ts` → `src/themes/platformer/editor/ops/paletteTiles.ts` and replace the four tables with the one descriptor per [contracts/palette-descriptor.md](./contracts/palette-descriptor.md): `PaletteGroup`, `PaletteTool { label, description, sprite: TileSpriteSpec | null, glyph?, group }`, `PALETTE_TOOLS: Record<EditorTool, PaletteTool>` (values are the merged old tables' values — unchanged output), and `terrainPaletteTools(): TerrainPaletteTool[]` enumerating `TILE_MODULES` and joining each author-placeable module with its descriptor entry, exposing the registry-owned `char`/`fogExempt`/`drawBand`. **Do NOT modify `tiles/registry.ts` or `TileModule`** (R-015 stays frozen). Delete `PALETTE_TILE_SPRITES`/`PALETTE_TILE_GLYPHS`/`PALETTE_TILE_DESCRIPTIONS`/`PALETTE_TILE_LABELS`; keep the derived helpers `HAZARD_PALETTE_KEYS`, `PATROL_GLYPH`, `CONNECTION_POINT_GLYPH`, `BLUEPRINT_GLYPH`, `TileSpriteSpec`.
- [ ] T033 [US4] Rewire `src/themes/platformer/editor/Palette.tsx` to build the Terrain/Decoration/Entities/Hazards/Tools groups from `PALETTE_TOOLS[...].group` and `terrainPaletteTools()` (remove the local `DECORATION_CHARS` grouping and the four table imports); update `src/themes/platformer/editor/PaletteTile.tsx` props to read from the descriptor. Move `backgroundPaletteTiles.ts` (+ test) to `editor/ops/` and retarget. Depends on T032.
- [ ] T034 [P] [US4] Retarget `src/themes/platformer/editor/EditorCanvas.tsx` (`PALETTE_TILE_SPRITES['fallingStalactite']?.tint` → the `PALETTE_TOOLS.fallingStalactite.sprite?.tint`) and its test, keeping the falling-stalactite camouflage tint behaviour byte-identical.
- [ ] T035 [US4] Migrate `src/themes/platformer/editor/ops/paletteTiles.test.ts`, `Palette.test.tsx` and `PaletteTile.test.tsx` to the descriptor (every label, description, sprite spec, glyph and grouping assertion preserved; `editor-palette-tile-*` test handles kept) and add the FR-008 check that a terrain entry's `char`/`fogExempt`/`drawBand` resolve from `TILE_MODULES` and that no palette-local tile table exists. Depends on T032, T033.
- [ ] T036 [US4] Run `npm test`; then run the SC-003 greps from [quickstart.md](./quickstart.md) §2 (no `PALETTE_TILE_*`; one `PALETTE_TOOLS`). **Checkpoint — US4.** Do not commit.

**Checkpoint**: Palette is one descriptor; R-015 consumed for terrain flags; adding a tool is one entry.

---

## Phase 7: User Story 5 - One raw-file shape and one editor taxonomy (Priority: P2)

**Goal**: Introduce the one `LayoutFile` raw shape aliased by `LevelEntry` and `Blueprint` (FR-013, D10), and finish the `editor/` split into UI + `editor/ops/` + `editor/dev/` with no React under either (FR-014, D11).

**Independent Test**: Exactly one `LayoutFile` type; `LevelEntry` and `Blueprint` extend it and declare no `layout`/`background`/`markers` of their own; `editor/ops/` and `editor/dev/` exist with no `.tsx`/React import; the editor root holds only `.tsx` UI + `editorState.ts` + `editorActions.ts`.

### Implementation for User Story 5

- [ ] T037 [US5] Create `src/themes/platformer/level/LayoutFile.ts` per [contracts/save-module.md](./contracts/save-module.md) §2: `LayoutFile { name?; layout: readonly string[]; background?: readonly string[]; markers?: readonly MarkerPlacement[] }`. Make `LevelEntry` (`level/levelRegistry.ts`) and `Blueprint` (`level/BlueprintData.ts`) `extend LayoutFile { id: string; name: string }` with no redeclared fields; `level/level.ts`/`LevelData.ts`'s `LevelDef` is **not** aliased to it. M4's `level/layoutFile.ts` validation home is unchanged. Add a compile/type assertion in `level/layoutFile.test.ts` that both satisfy `LayoutFile` without redeclaring its fields.
- [ ] T038 [US5] Move the remaining pure transforms to `src/themes/platformer/editor/ops/` (each with its test, import-path only): `blueprintCells.ts`, `blueprintFit.ts`, `caveLightingPreview.ts`, `EditorPan.ts`, `EditorZoom.ts` (the modules US1–US4 already relocated are left in place). Retarget all importers.
- [ ] T039 [US5] Move the remaining dev infra to `src/themes/platformer/editor/dev/` (each with its test): `devEnvironment.ts`, `devEnvironmentEndpoint.ts` (the save modules/endpoints already moved in T029). Retarget `EditorToolbar.tsx` and the editor tests.
- [ ] T040 [US5] Confirm the concern split: `editor/` root holds only React `*.tsx` UI plus `editorState.ts` (signals + tool unions) and `editorActions.ts` (controller); no React/`.tsx` under `ops/` or `dev/`; `ops/` transforms do not import UI modules. Move any straggler. Depends on T038, T039.
- [ ] T041 [US5] Run `npm test`; then run the SC-005/SC-006 greps from [quickstart.md](./quickstart.md) §2 (exactly one `LayoutFile`; no React import under `ops/`/`dev/`; no `.tsx` there). **Checkpoint — US5.** Do not commit.

**Checkpoint**: One raw-file shape; editor/ is UI + ops + dev with clean boundaries.

---

## Phase 8: User Story 6 - The unification is invisible (Priority: P1)

**Goal**: Prove the refactor changed nothing visible and lock the structure with the FR-017 guard: test migration complete, parity byte-identical, R-001 edges unwidened, and a manual browser check of the game and editor (FR-015–FR-018, SC-007/SC-008/SC-009).

**Independent Test**: The full suite, production build and lint pass; the FR-017 guard fails if any invariant regresses; exported/cropped layout strings and saved JSON are byte-identical to T002's artifacts; the manual browser pass shows no visible difference.

### Implementation for User Story 6

- [ ] T042 [US6] Write `src/themes/platformer/editor/editorStructure.test.ts` — the FR-017 structural guard (Vitest, test-only `node:fs`/`node:path` scan mirroring `tiles/registry.test.ts`) asserting the seven checks in [contracts/layer-invariants.md](./contracts/layer-invariants.md) §3 with frozen expectations: (1) no `gridRenderState.finders`/`findAllPositions`/`synthesize*` except the sanctioned `previewPlayerState` calling `findOptionalSpawnTile`; (2) exactly one `PALETTE_TOOLS` and zero `PALETTE_TILE_*` tables, every `EditorTool` key present, terrain chars resolve from `TILE_MODULES`, no palette-local tile registry; (3) exactly one `placeAtMarkers`/`placeWithFactPool`, every `level/*Mapper.ts` imports one, no mapper place loop, `slugify` only in `level/ids.ts`; (4) exactly one `stampGridCells`/`paintGridCell`, one `walkLayout`, one `cropLayoutToBox`, one `saveFile`, `cropLevelForExport` calls `cropLayoutToBox` and defines no loop; (5) exactly one `LayoutFile`, `LevelEntry`/`Blueprint` extend it without redeclaring; (6) `ops/`+`dev/` exist, no React/`.tsx` there, no D11 pure-transform left at the editor root; (7) layer edges — no new `level/ → engine/`, no new `engine/ → state/`, `contracts/` still a leaf, `level/` React-free (FR-018). Use `{method}-{condition}-{expected-result}` names.
- [ ] T043 [US6] Confirm the guard is non-vacuous and fails the suite on regression: temporarily introduce one regression (e.g. re-add a `PALETTE_TILE_LABELS` table or a mapper place loop), run `npx vitest run src/themes/platformer/editor/editorStructure.test.ts`, confirm a failure, then revert. Record the result. Depends on T042.
- [ ] T044 [US6] Test-preservation audit (FR-016): diff the pre-refactor and post-refactor `src/themes/platformer/**/*.test.ts(x)` sets and assertion counts; confirm zero deleted, skipped (`it.skip`/`describe.skip`) or weakened tests, and that only the sanctioned internal-preview-id assertions were updated. Record the audit in the completion report. Depends on T030, T035, T041.
- [ ] T045 [US6] Behavioural parity check (FR-015): regenerate the layout/crop strings and the level + blueprint JSON for the T002 inputs and diff them byte-for-byte against the captured artifacts; confirm palette metadata and the editor preview placements (kinds/positions/appearance; internal ids excluded) are unchanged. Run `npm test`, `npm run build` and `npm run lint` — all MUST pass with no new dependency and no bundle regression. Depends on T042.
- [ ] T046 [US6] Verify FR-018/R-001 layer invariants explicitly: `contracts/` is still a leaf; no new `level/ → engine/`; no new `engine/ → state/`; `level/ids.ts` and `level/cvFacts.ts` import `level/**`, `tiles/` reads, `shared/`, `contracts/`, `@/types` only (no React, no `engine/`). Cross-check with the T042 guard's edge scan. Record the result.
- [ ] T047 [US6] Manual browser check per [quickstart.md](./quickstart.md) §4 (constitution Dev Workflow, SC-007), comparing against the pre-refactor build: load the shipped level and confirm every enemy/block/chest/checkpoint/coin/sign/hazard/rope-ladder bundle previews identically (all 7 `$` markers still preview as chests, OQ-1); open every palette group and confirm identical tools/icons/labels/tooltips/grouping; paint and erase foreground/background/markers (hazard facing cycle, single-spawn rule, sign hint cycle, torch strength cycle) and confirm identical cells; save a level and a blueprint and diff the JSON; use **Try** and confirm identical gameplay; confirm identical light/dark appearance. **Checkpoint — US6 (behaviour gate).** Do not commit.

**Checkpoint**: The restructuring is invisible; the guard locks it in.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Feature-completion tracking and a final structural/behaviour audit.

- [ ] T048 [P] Update `docs/Features.md`'s dependency diagram per `AGENTS.md`: prefix the `R010` node label with `✅ ` and add `class R010 done` alongside its existing category class. Do not add a feature list or status table (the file holds only the dependency map).
- [ ] T049 [P] Run the [quickstart.md](./quickstart.md) §2 structural greps and §3 unit-level parity checks end-to-end as a final cross-check (SC-001–SC-006, SC-008), and confirm no palette-local tile registry/table exists and `tiles/registry.ts` is unmodified (R-015 not rebuilt/extended).
- [ ] T050 Final audit: confirm no compatibility re-export or second implementation survives (no re-export in `CollectibleMapper.ts`, no `gridRenderState.ts`, no second save/crop/paint/palette table, no `LevelDef`↔`LayoutFile` conflation); confirm no new tile/tool/gameplay/art/tuning/level-data/translation change (FR-015); run `npm test`, `npm run build`, `npm run lint` one last time. **No auto-commit** — leave all changes in the working tree for review (constitution + `AGENTS.md`).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — run first to capture the baseline/parity artifacts.
- **Foundational (Phase 2)**: depends on Setup; **BLOCKS** US1 (grid adapter) and US3 (crop wrapper).
- **US1 (Phase 3)**: depends on Foundational (crop primitive) + T006.
- **US2 (Phase 4)**: depends on Foundational; independent of US1 (but US1's preview builders consume the mapper public APIs, so run US1 first or in parallel).
- **US3 (Phase 5)**: depends on Foundational (crop) + T025 (its own walk); its `importLayout` piece also feeds US1's `previewLevelDef` only through `parseLevel` (already available).
- **US4 (Phase 6)**: depends on Foundational only; fully independent (consumes R-015's shipped registry).
- **US5 (Phase 7)**: depends on US1/US3/US4 for the final homes of the modules it sweeps (it moves only modules they have stopped changing).
- **US6 (Phase 8)**: depends on all of US1–US5 (the guard and parity checks assert the combined result).
- **Polish (Phase 9)**: depends on all phases.

### User Story Dependencies

| Story | Priority | Depends on | Notes |
| --- | --- | --- | --- |
| US1 (preview) | P1 | Foundational (T004) | Deletes `gridRenderState`; OQ-1 chest padding (T008). |
| US2 (mappers) | P1 | Foundational | Independent of US1; the shared `level/` helpers it creates are consumed by US1's builders if US2 lands first. |
| US3 (paint/import/save) | P1 | Foundational (T004); T025 creates the walk | Independent of US1/US2/US4. |
| US4 (palette) | P1 | R-015 (shipped) | Independent; must not extend R-015. |
| US5 (LayoutFile + split) | P2 | US1/US3/US4 (final homes) | `LayoutFile` (T037) is independent; the sweeps run last. |
| US6 (invisible + guard) | P1 | US1–US5 | Writes the FR-017 guard; runs the parity + manual gates last. |

### Within Each User Story

- Shared helper created (with its test) **before** its consumers are retargeted (T012–T014 before T015–T019; T022 before T023–T024; T032 before T033–T035).
- The parallel pipeline is deleted (T009) only after its replacement (T007/T008) exists.
- Tests migrate alongside their module and keep their assertions; only the sanctioned preview ids change.

### Parallel Opportunities

- **Foundational**: T003 and T004 touch different files → `[P]`.
- **US2**: T013 (`cvFacts`) is parallel with T012; after T014, the mapper retargets T015–T019 touch disjoint files → `[P]`.
- **US3**: T024, T025, T026, T028 touch disjoint files and can run in parallel where their dependencies allow; T023 precedes T027.
- **US4**: T033 depends on T032; T034 is a disjoint file → `[P]`.
- **US5**: T037 (`LayoutFile`) is independent of T038/T039; T038 and T039 touch disjoint file sets → `[P]`.
- **Polish**: T048 and T049 are independent.

---

## Parallel Example: User Story 2 (mapper dedup)

```bash
# After T012 (ids.ts) + T013 (cvFacts.ts) + T014 (placement.ts) are green:
Task: "T015 Retarget level/BlockMapper.ts onto placeAtMarkers/placeWithFactPool"
Task: "T016 Retarget level/EnemyMapper.ts onto placeAtMarkers/placeWithFactPool"
Task: "T017 Retarget level/ChestMapper.ts onto placeAtMarkers"
Task: "T018 Retarget level/CollectibleMapper.ts onto placeAtMarkers"
Task: "T019 Retarget level/CheckpointMapper.ts, SignMapper.ts, HazardMapper.ts onto placeAtMarkers"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup (baseline + parity artifacts) → Phase 2 Foundational (crop primitive + grow primitive).
2. Phase 3 US1: the grid→layout adapter, the runtime-fed preview builders (with OQ-1 chest padding), delete `gridRenderState`.
3. **STOP and VALIDATE**: run the SC-001 grep and the preview-vs-runtime-chain parity test; confirm `gridRenderState.ts` is gone.

### Incremental Delivery

1. Setup + Foundational → the one row-serializer + grow primitive in `ops/`.
2. US1 → editor preview is the runtime chain (MVP).
3. US2 → mappers are descriptors + builders on one place loop.
4. US3 → one paint primitive, one layout walk, one crop wrapper, one save module.
5. US4 → one `PALETTE_TOOLS` descriptor consuming R-015.
6. US5 → one `LayoutFile`; editor/ → UI + `ops/` + `dev/`.
7. US6 → FR-017 guard + test-migration audit + byte-identical parity + manual browser gate.
8. Polish → `docs/Features.md` tracker + final audit; leave uncommitted.

Each increment keeps the suite green and is a behaviour-preserving restructure.

---

## Requirements Coverage

| Requirement | Tasks |
| --- | --- |
| FR-001 (preview via runtime chain; OQ-1 chest padding) | T007, T008, T009, T010 |
| FR-002 (one grid→layout adapter; one row serializer) | T004, T007 |
| FR-003 (`placeAtMarkers`) | T014, T015–T019 |
| FR-004 (`placeWithFactPool`) | T014, T015, T016 |
| FR-005 (one placement contract) | T014, T015–T019 |
| FR-006 (one CV flattening + `level/ids.ts`) | T012, T013, T015–T019 |
| FR-007 (`PALETTE_TOOLS`) | T032, T033, T035 |
| FR-008 (terrain flags from R-015; no registry build) | T032, T035, T049 |
| FR-009 (one paint primitive) | T022, T023, T024 |
| FR-010 (one layout walk + one grid-crop wrapper) | T004, T025, T026 |
| FR-011 (one save module) | T028, T029 |
| FR-012 (`applyToolAt` shares ops rules) | T027 |
| FR-013 (`LayoutFile`) | T037 |
| FR-014 (editor/ split) | T038, T039, T040 |
| FR-015 (behaviour unchanged) | T002, T010, T030, T035, T045, T047 |
| FR-016 (tests migrate/pass/build) | T020, T030, T035, T044, T045 |
| FR-017 (guard test) | T042, T043 |
| FR-018 (R-001 edges) | T042 (check 7), T046 |
| SC-001 | T005, T010, T011 |
| SC-002 | T012–T021 |
| SC-003 | T032–T036, T049 |
| SC-004 | T022–T031 |
| SC-005 | T037, T041 |
| SC-006 | T038–T041, T049 |
| SC-007 | T002, T045, T047 |
| SC-008 | T042 (check 7), T046 |
| SC-009 | T042, T043 |

---

## Notes

- **Pure restructuring**: preview output, palette metadata, painted cells, imported/exported/cropped strings, saved JSON and runtime output are byte-for-byte preserved (FR-015). No new tile, tool, gameplay, art, tuning, level-data or translation change. Internal preview ids MAY change (they come from the shared mappers); visible placements MUST NOT (spec Edge Case).
- **OQ-1**: the editor pads the CV-derived chest-def list to the `$` marker count so every marker previews and stays deletable; the runtime passes the unpadded list, so gameplay is unchanged. The padding is a preview **input** difference only and MUST NOT re-implement the finder or place function.
- **R-015 is consumed, not rebuilt**: the palette reads `TILE_MODULES`/`TERRAIN_CHARS` for terrain membership and `char`/`fogExempt`/`drawBand`; `tiles/registry.ts` and the `TileModule` contract are not modified, and no palette-local tile table/registry is introduced.
- **Layer invariants** (FR-018, enforced by T042's guard): `contracts/` stays a leaf; no new `level/ → engine/`; no new `engine/ → state/`; `level/ids.ts`/`level/cvFacts.ts` stay React-free.
- **[P] tasks** = different files, no dependency on incomplete work in the same phase; verify before running.
- **No auto-commit**: the project never auto-commits; the `before_tasks`/`after_tasks` git hooks are optional and MUST NOT be run. Leave all changes uncommitted for review.
- **Out of scope**: R-015's registry itself, the R-009 renderer split, R-011–R-014, the already-landed M4/M5/F5/F6 findings, and any `entity/`/`features/` regroup.
