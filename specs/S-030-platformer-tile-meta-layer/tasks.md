---
description: 'Task list for the Platformer Tile Meta Layer feature'
---

# Tasks: Platformer Tile Meta Layer

**Input**: Design documents from `/specs/S-030-platformer-tile-meta-layer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included and required — the project constitution (Principle II) mandates TDD
(`{method}-{condition}-{expected}` naming, Vitest + RTL + jsdom, all tests green before merge).
Every test task below is written **first** and must fail before its implementation task lands.

**Organization**: Tasks are grouped by user story so each story is independently implementable
and testable. The tile meta layer's typed vocabulary and its runtime reading are shared
foundational infrastructure; each story then adds its own behavior on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`US1`–`US5`); setup, foundational and
  polish tasks carry no story label
- Exact file paths are given for every task
- IDs are assigned in creation order, so a phase's tasks are not necessarily contiguous
  (remediation inserted T070–T073 into earlier phases)

## Path Conventions

Single static frontend project. All source under `src/themes/platformer/`, all docs under
`docs/`. Specs under `specs/`. No backend.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean baseline and the feature's "no new dependency / no new asset" constraint.

- [x] T001 Run `npm install` then `npm test` from the repository root and confirm the suite is green before any tile-meta-layer change.
- [x] T002 [P] Confirm plan.md's Constraints hold — no new dependency and no new asset: the marker glyphs and the sign/falling-stalactite presentation already exist in `src/themes/platformer/editor/paletteTiles.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The tile meta layer's typed vocabulary, its parser/migration, its runtime reading, and the editor's shared marker primitives. **No user story can be implemented until this phase is complete.**

**⚠️ CRITICAL**: Complete this phase before starting any user story.

### Tests for Foundational

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [x] T003 [P] Write `src/themes/platformer/level/HintCatalog.test.ts` — `HINT_IDS` order preserves the old digits `1`–`6`, `DEFAULT_HINT_ID` is `HINT_IDS[0]`, `hintCode` returns `'1'`–`'6'`, `nextHintId` wraps through the list, `isHintId` accepts every id and rejects non-ids.
- [x] T004 [P] Update `src/themes/platformer/level/LevelParser.test.ts` — `P`/`+` and `'1'`–`'6'` are no longer `TERRAIN_CHARS`/`TileChar` keys (`'T'` remains, as the sign char); `T` is not a `HAZARD_CHARS` key; `SIGN_CHAR === 'T'`; `LEGACY_MARKER_CHARS` maps `P`/`+`/`1`–`6`; `parseLevel(layout, storedMarkers?)` lifts legacy chars to markers and empties the terrain (`⊤` for a legacy `T`), merges stored markers, ignores unknown kinds/out-of-bounds, and applies the `T` generation rule; `findSignTiles(layout, markers)` pairs `T` with its `sign.hintId` else `DEFAULT_HINT_ID`; `findHazardTiles(layout, markers)` returns the character hazards and the marker-derived falling stalactites in one reading-order list.
- [x] T005 [P] Update `src/themes/platformer/level/Terrain.test.ts` — `markerAt` returns the marker for a marked cell and `null` for an absent/out-of-bounds cell or a missing grid; assert `patrol`/`blueprintConnectionPoint` are no longer `TileType` members.
- [x] T006 [P] Update `src/themes/platformer/level/level.test.ts` — `currentLevel` merges `currentMarkers`; `SIGN_TILES`/`HAZARD_TILES` read the layer.
- [x] T007 [P] Update `src/themes/platformer/engine/Renderer.test.ts` — a `LevelDef` with markers renders nothing for them; the `⊤` falling-stalactite art still draws from marker-derived placements.
- [x] T008 [P] Write `src/themes/platformer/editor/paintMarkerCell.test.ts` — write, overwrite, erase, never-grow, out-of-bounds no-op, and `paintSignMarker` default/cycle.
- [x] T009 [P] Update `src/themes/platformer/editor/editorState.test.ts` — `editorMarkerGridSignal` selects the active canvas's grid; a persisted marker grid is validated forgivingly.
- [x] T010 [P] Update `src/themes/platformer/editor/importLayout.test.ts` — `importMarkerGrid` lifts legacy `P`/`+`/digits/`T`; `importLayout` maps a legacy digit to `T` and a legacy `T` hazard to `⊤`.
- [x] T011 [P] Update `src/themes/platformer/editor/gridRenderState.test.ts` — `synthesizeSignPlacements`/`synthesizeHazardPlacements` read the marker grid (default hint when a sign marker is absent; falling hazard from the marker).
- [x] T012 [P] Update `src/themes/platformer/editor/paletteTiles.test.ts` — the palette maps are keyed by `EditorTool`, the marker tools carry a glyph/label/description, and the falling tint moved off the removed `T` hazard key.
- [x] T070 [P] Update `src/themes/platformer/editor/paintCell.test.ts` — remove the sign-marker/digit-cycle describe block (`paintCell` no longer cycles a sign's hint; the sign tool writes a uniform `T` and the cycle moves to `paintSignMarker` in US4); keep the hazard-facing cycle cases for `^`/`v`/`<`/`>`/`¦`/`A`.
- [x] T071 [P] Update `src/themes/platformer/editor/PaletteTile.test.tsx` — the falling-stalactite tint no longer keys off the removed `T` hazard character; the palette renders the marker and variant tools from `paletteTiles.ts`'s `EditorTool` maps.

### Implementation for Foundational

- [x] T013 [P] Add `MarkerEntry` (4-member discriminated union), `MarkerGrid`, `MarkerPlacement` and `LevelDef.markers` to `src/themes/platformer/level/LevelData.ts`; remove `'patrol'`/`'blueprintConnectionPoint'` from `TileType` and `TILE_FOG_EXEMPT`.
- [x] T014 Create `src/themes/platformer/level/HintCatalog.ts` — `HINT_IDS`, `DEFAULT_HINT_ID`, `hintCode`, `nextHintId`, `isHintId` (depends on T003).
- [x] T015 Update `src/themes/platformer/level/LevelParser.ts` — add `SIGN_CHAR = 'T'`, `LEGACY_MARKER_CHARS`, `parseMarkers`, `parseLevel(layout, storedMarkers?)`, marker-aware `findSignTiles`, and a `findHazardTiles(layout, markers?)` that merges the character hazards with the marker-derived falling stalactites; drop `P`/`+` and `'1'`–`'6'` from `TERRAIN_CHARS`/`TileChar` (keep `'T'` as the sign char) and `T` from `HAZARD_CHARS`; update the shared-key guard (depends on T013, T014).
- [x] T016 Add `markerAt(level, col, row)` to `src/themes/platformer/level/Terrain.ts` with the same forgiving out-of-bounds contract as `backgroundAt` (depends on T013).
- [x] T017 Update `src/themes/platformer/level/level.ts` — add the `currentMarkers` signal, merge it in `currentLevel`, compose `SIGN_TILES`/`HAZARD_TILES` from the layer, and update `LEVEL_1_LAYOUT` to the new shape plus a new `LEVEL_1_MARKERS` (depends on T015, T016).
- [x] T018 [P] Update `src/themes/platformer/engine/Renderer.ts` — drop the `patrol`/`blueprintConnectionPoint` cases from `tileSource`'s exhaustive switch (depends on T013).
- [x] T019 [P] Update `src/themes/platformer/editor/editorState.ts` — add `MarkerTool`, `EditorTool`, `editorMarkerSignal`, `editorBlueprintMarkerSignal`, `editorMarkerGridSignal`, widen `editorSelectedToolSignal`, and add `PlacementSnapshot.markers` (depends on T013).
- [x] T020 Create `src/themes/platformer/editor/paintMarkerCell.ts` — `paintMarkerCell`, `eraseMarkerCell`, `paintSignMarker`; single-cell writes that never grow (depends on T013, T014).
- [x] T021 [P] Update `src/themes/platformer/editor/paletteTiles.ts` — widen `PALETTE_TILE_SPRITES`/`LABELS`/`DESCRIPTIONS`/`GLYPHS` to `EditorTool`, add the marker tools' presentation, and move the falling-stalactite tint off the removed `T` hazard key (depends on T019).
- [x] T022 [P] Update `src/themes/platformer/editor/importLayout.ts` — add `importMarkerGrid` (legacy lift) and map a legacy digit to `T` / a legacy `T` hazard to `⊤` in `importLayout` (depends on T015).
- [x] T023 [P] Update `src/themes/platformer/editor/gridRenderState.ts` — `synthesizeSignPlacements`/`synthesizeHazardPlacements` read the marker grid (depends on T019, T015).
- [x] T024 [P] Update `src/themes/platformer/editor/paintCell.ts` — drop the `SIGN_CHARS` cycle (the sign tool always writes `T`; the hint cycle moves to `paintSignMarker` in US4) and keep the hazard cycle for `^`/`v`/`<`/`>`/`¦`/`A` (depends on T015).

**Checkpoint**: The typed layer exists, the parser migrates legacy files, the runtime reads it, and the editor's shared marker primitives compile. User stories can now begin.

---

## Phase 3: User Story 1 - Mark a room's border without punching a hole (Priority: P1) 🎯 MVP

**Goal**: A developer paints a marker (patrol boundary / connection point) onto a cell and the
cell keeps its terrain; the marker draws over the terrain regardless of the active layer; the
running game ignores it entirely; erasing or repainting leaves the terrain untouched.

**Independent Test**: Paint a wall cell, paint a connection point on it, play the level and
confirm the cell blocks the player and renders as a wall, then erase the marker and confirm the
wall is still there.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [x] T025 [P] [US1] Update `src/themes/platformer/editor/Palette.test.tsx` — the patrol-boundary tool appears on both canvases and the connection-point tool on the blueprint canvas only.
- [x] T026 [P] [US1] Update `src/themes/platformer/editor/EditorCanvas.test.tsx` — a pure-marker-tool click writes the marker grid (never terrain), a terrain-tool click leaves the marker grid alone, markers draw regardless of the active layer, and the erase gesture clears only the selected marker tool's marker. Also assert FR-013: an entity, hazard or background tool click leaves the marker grid untouched.
- [x] T027 [P] [US1] Update `src/themes/platformer/editor/editorActions.test.ts` — `applyMarkerPaint` sets dirty and clears the snapshot; a left/up growth shifts the marker grid; an out-of-bounds marker click is a no-op.
- [x] T028 [P] [US1] Update `src/themes/platformer/PlatformerState.test.ts` and `src/themes/platformer/PlatformerPage.test.tsx` — a marked cell's solidity/collision is decided by its tile alone and nothing renders for a marker.

### Implementation for User Story 1

- [x] T029 [US1] Update `src/themes/platformer/editor/editorActions.ts` — add `applyMarkerPaint` and `shiftMarkerGrid` (called by `applyPaint`), and widen `selectTool`/`setCanvasMode` to `EditorTool` (swap the removed `'+'` fallback for `'connectionPoint'`).
- [x] T030 [US1] Update `src/themes/platformer/editor/Palette.tsx` — add the marker tools (and the sign/decorative/falling stalactite tools) to the Tools group, gating the connection point to the blueprint canvas and offering no marker tool where it does not apply.
- [x] T031 [US1] Update `src/themes/platformer/editor/EditorCanvas.tsx` — add the `markerGrid` prop and `onPaintMarker`, a pure-marker-tool paint/erase branch that never calls `paintCell` and never grows, and draw the patrol/connection glyphs from the marker grid over the terrain, independent of the active layer.
- [x] T032 [US1] Update `src/themes/platformer/editor/EditorCanvasPane.tsx` — pass the active marker grid and `onPaintMarker` through.
- [x] T033 [US1] Update `src/themes/platformer/editor/EditorWorkspace.tsx` — pass the active marker grid and `onPaintMarker` through.

**Checkpoint**: User Story 1 is fully functional and independently testable — a marker can be painted on any cell without changing that cell's terrain or gameplay.

---

## Phase 4: User Story 2 - Save, reload and stamp rooms with their markers (Priority: P1)

**Goal**: Markers survive save/reload and travel with a stamped blueprint; levels and
blueprints authored before this feature load with their markers lifted out of the terrain
layout and their terrain unchanged; the Export control shows the complete level JSON.

**Independent Test**: Save a blueprint with a marker on a wall, reload it, stamp it into a
level, save the level, reload it, and play it — the wall is solid at the marked cell and the
marker is still shown in the editor.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [x] T034 [P] [US2] Update `src/themes/platformer/level/levelRegistry.test.ts` and `src/themes/platformer/level/blueprintRegistry.test.ts` — `markers` is parsed and validated forgivingly, a malformed `markers` costs only that field, and a missing field means the file is pre-feature.
- [x] T035 [P] [US2] Update `src/themes/platformer/level/BlueprintData.test.ts` — `Blueprint.markers` and the `isBlueprint` `markers` shape check.
- [x] T036 [P] [US2] Update `src/themes/platformer/editor/exportLayout.test.ts` and `src/themes/platformer/editor/cropLevelForExport.test.ts` — the crop box includes a marker on an empty cell, markers serialize relative to the crop origin, and an unmarked crop is unchanged.
- [x] T037 [P] [US2] Update `src/themes/platformer/editor/saveLevelFile.test.ts` and `src/themes/platformer/editor/saveBlueprintFile.test.ts` — `markers` is omitted when empty and present when not, and the typed object shape round-trips.
- [x] T038 [P] [US2] Update `src/themes/platformer/editor/placeBlueprint.test.ts` and `src/themes/platformer/editor/blueprintFit.test.ts` — markers are stamped at the anchor, an existing marker is replaced, and a marker in the target grid never blocks a placement.
- [x] T039 [P] [US2] Update `src/themes/platformer/editor/editorActions.test.ts` — a level with markers round-trips through `loadLevel` (including the legacy migration), Undo restores markers, and `commitPlacement` stamps/overwrites markers.
- [x] T040 [P] [US2] Update `src/themes/platformer/editor/EditorToolbar.test.tsx` — the Export textarea shows the complete level JSON (`levelFileJson`) with markers, and Copy copies that exact text.
- [x] T072 [P] [US2] Update `src/themes/platformer/editor/LevelEditorPage.test.tsx` — the Export dialog shows the complete JSON rather than the old `formatRows`/`// LEVEL_1_BACKGROUND` text, and `cropLevelForExport` is exercised with its three-layer signature (terrain, background, markers).

### Implementation for User Story 2

- [x] T041 [P] [US2] Update `src/themes/platformer/level/levelRegistry.ts` — add `LevelEntry.markers`, forgiving validation, and the `LEVEL_1_MARKERS` wiring.
- [x] T042 [P] [US2] Update `src/themes/platformer/level/BlueprintData.ts` — add `Blueprint.markers` and its validation.
- [x] T043 [P] [US2] Update `src/themes/platformer/level/blueprintRegistry.ts` — parse the `markers` field.
- [x] T044 [US2] Update `src/themes/platformer/editor/exportLayout.ts` — add `unionBoxes` and `cropLayoutToBox` so all three layers share one crop origin.
- [x] T045 [US2] Update `src/themes/platformer/editor/cropLevelForExport.ts` — compute the box over terrain **∪** markers and serialize `markers` relative to it.
- [x] T046 [P] [US2] Update `src/themes/platformer/editor/saveLevelFile.ts` — add the `markers` parameter and include the JSON field only when non-empty.
- [x] T047 [P] [US2] Update `src/themes/platformer/editor/saveBlueprintFile.ts` — add the `markers` parameter and include the JSON field only when non-empty.
- [x] T048 [P] [US2] Update `src/themes/platformer/editor/blueprintCells.ts` (terrain-only doc note) and `src/themes/platformer/editor/placeBlueprint.ts` (`blueprintMarkers`, `placeBlueprintMarkers`).
- [x] T049 [US2] Update `src/themes/platformer/editor/editorActions.ts` — snapshot/undo/load/save/try carry markers; `commitPlacement` stamps the blueprint's markers at the anchor, overwriting.
- [x] T050 [US2] Update `src/themes/platformer/editor/EditorToolbar.tsx` — the Export dialog renders `levelFileJson(...)` (the complete JSON), removing the old `formatRows`/`// LEVEL_1_BACKGROUND` rendering.
- [x] T051 [US2] Update `src/themes/platformer/editor/EditorCanvasPane.tsx` — the placement preview includes the blueprint's marker cells.

**Checkpoint**: User Stories 1 and 2 both work independently — markers round-trip through save, reload and placement, and legacy files migrate at load.

---

## Phase 5: User Story 3 - Bound a patrol without losing the terrain (Priority: P2)

**Goal**: A patrol boundary painted on a cell that also holds terrain still reverses an enemy
at exactly the marked cell while the player passes through according to the tile alone.

**Independent Test**: Paint a solid tile, paint a patrol boundary on it, run a level with an
enemy patrolling toward it, and confirm the enemy turns at exactly the marked cell while the
player still walks through it.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [x] T052 [P] [US3] Update `src/themes/platformer/entities/enemies/movement/patrol.test.ts` — move the fixtures from terrain `'patrol'` cells to a `markers` grid carrying `{ kind: 'patrolBoundary' }`, with the same expected turn cells.
- [x] T053 [P] [US3] Update `src/themes/platformer/engine/EnemyAI.test.ts` — the wall-reversal characterization fixtures use the tile meta layer instead of `'patrol'` terrain.
- [x] T054 [P] [US3] Update `src/themes/platformer/PlatformerPage.test.tsx` — an enemy turns at a `patrolBoundary` marker and the player passes through it.

### Implementation for User Story 3

- [x] T055 [US3] Update `src/themes/platformer/entities/enemies/movement/patrol.ts` — `stepHorizontal`'s `wallAhead` reads `markerAt(level, leadingCol, r)?.kind === 'patrolBoundary'` in place of the `'patrol'` tile test, leaving the turn geometry untouched.

**Checkpoint**: User Story 3 works independently — patrol behaviour is unchanged (SC-004).

---

## Phase 6: User Story 4 - A sign shows its hint without needing its own character (Priority: P2)

**Goal**: Every sign is the uniform `T` layout character; its hint lives in the tile meta layer.
The editor badges the sign's corner with the hint's short code and shows the hint's own text on
hover; the game shows the same translated hint. Legacy `1`–`6` signs migrate at load.

**Independent Test**: Place a sign, cycle it to a hint, save and reload, hover it to read the
hint, then play the level and interact with it — the badge, the tooltip and the in-game text all
agree.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [x] T056 [P] [US4] Update `src/themes/platformer/editor/EditorCanvas.test.tsx` — the sign tool paints `T` + a `sign` marker, a re-click cycles the hint, the corner badge shows `hintCode`, and hover shows the hint's own text.
- [x] T057 [P] [US4] Update `src/themes/platformer/editor/editorActions.test.ts` — the sign tool's post-growth ordering (`applyPaint` first, then the marker write at `col + colShift`, `row + rowShift`).
- [x] T058 [P] [US4] Update `src/themes/platformer/PlatformerState.test.ts` and `src/themes/platformer/PlatformerPage.test.tsx` — `signPlacements`/the in-game bubble show the marker's `hintId`, and a bare `T` falls back to `DEFAULT_HINT_ID`.

### Implementation for User Story 4

- [x] T059 [US4] Update `src/themes/platformer/editor/EditorCanvas.tsx` — the sign tool calls `paintCell(grid, …, 'T')` + `paintSignMarker` at the post-growth coordinates; `drawSignBadges` reads the marker grid; add the hover tooltip naming the marker and, for a sign, its hint text.
- [x] T060 [US4] Verify the in-game sign path in `src/themes/platformer/level/SignMapper.ts` and `src/themes/platformer/PlatformerState.ts` reads the marker-derived `hintId` with no change (expected: no source change — confirm via T058; only adjust if the test proves otherwise).

**Checkpoint**: User Story 4 works independently — a sign's hint round-trips and the badge, tooltip and in-game bubble agree (SC-007).

---

## Phase 7: User Story 5 - The falling stalactite stops needing its own character (Priority: P2)

**Goal**: The falling stalactite is a `fallingStalactite` marker on the decorative `⊤` tile; the
editor tints it red, and the game shakes and drops it exactly as before. Legacy `T` hazards
migrate to `⊤` + marker.

**Independent Test**: Paint a falling stalactite, confirm the `⊤` art with the red tint, play
the level, walk beneath it and confirm it shakes and drops; confirm a decorative `⊤` never falls.

### Tests for User Story 5

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [x] T061 [P] [US5] Update `src/themes/platformer/editor/EditorCanvas.test.tsx` — the decorative `⊤` tool paints `⊤` alone and untinted; the falling-stalactite tool paints `⊤` + a `fallingStalactite` marker and shows the red tint.
- [x] T062 [P] [US5] Update `src/themes/platformer/engine/Renderer.test.ts` and `src/themes/platformer/engine/FallingStalactite.test.ts` — the marker-derived placement still shakes and drops, and the decorative `⊤` never falls.
- [x] T063 [P] [US5] Update `src/themes/platformer/PlatformerState.test.ts` — `hazardPlacements` includes the marker-derived falling stalactite and `HAZARD_TYPES` still resolves the behavior.

### Implementation for User Story 5

- [x] T064 [US5] Update `src/themes/platformer/editor/EditorCanvas.tsx` — the falling-stalactite tool paints `⊤` + the marker, and `drawTileTint` reads the marker grid for the red tint while the decorative `⊤` stays untinted.

**Checkpoint**: All five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, the extension recipe and end-to-end validation.

- [x] T065 [P] Update `docs/themes/platformer/LevelFormat.md` — the typed tile meta layer and the `markers` field, `T` as the sign character, `T` removed from hazards, `P`/`+` removed from terrain, the migration and the `T` generation rule, and the "Adding a new marker kind" recipe (FR-035).
- [x] T066 [P] Update `docs/themes/platformer/Terrain.md` — remove `patrol`/`blueprintConnectionPoint` from the `TileType` table and the decorative-tiles paragraph, document `markerAt`, and note `⊤` + marker. Also update `docs/themes/platformer/Enemies.md` — patrol reversal is described against a `patrolBoundary` marker rather than the removed `'patrol'` tile.
- [ ] T067 Run the `quickstart.md` browser scenarios (`npm run dev`, `/platformer/editor`, `/platformer`) and fix anything the automated tests miss.
- [x] T068 Run `npm test` and `npm run build` and resolve any remaining fallout.
- [x] T073 [P] Verify the "Adding a new marker kind" recipe (SC-011, FR-035): follow `docs/themes/platformer/LevelFormat.md` to add a throwaway marker kind (union member + registry/tool/presentation + a test), confirm it compiles and passes, then revert it. Record any step the doc omits.
- [x] T069 Update `docs/Features.md` — add the missing `S030["S-030: Platformer Tile Meta Layer"]` node and its dependency edges (`S030 --> F019`, `S030 --> O006`) to the platformer subgraph, then prefix its label with `✅ ` and add `class S030 done` in the dependency diagram (only once implementation **and** tests are fully done).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**.
- **User Stories (Phase 3–7)**: All depend on Foundational completion. US1 and US2 are P1; US3–US5 are P2. US2 depends on US1's editor marker grid; US3 depends only on Foundational (no editor work); US4/US5 depend on US1's editor layer.
- **Polish (Phase 8)**: Depends on all user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational. No dependency on other stories.
- **US2 (P1)**: Can start after Foundational; its editor load/save/placement tasks build on US1's editor marker grid (T019/T029) but the storage/crop/registry tasks are independent.
- **US3 (P2)**: Can start after Foundational. Independent of US1/US2 (runtime only).
- **US4 (P2)**: Depends on Foundational and US1's `EditorCanvas` marker plumbing.
- **US5 (P2)**: Depends on Foundational and US1's `EditorCanvas` marker plumbing.

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation.
- Pure modules before their consumers; canvas wiring before its story's tool behavior.
- Story complete before moving to the next priority.

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel.
- All Foundational tests (T003–T012) are [P] and can be written together.
- Foundational implementation tasks T013, T018, T019, T021, T022, T023, T024 are [P] once their declared dependencies are met.
- Once Foundational completes, US1 and US3 can run in parallel; US2's storage tasks (T041–T048) can run in parallel with US1's editor wiring.
- Within each story, all `[P]` test tasks can run in parallel.

---

## Parallel Example: Foundational Tests

```text
Task: "Write src/themes/platformer/level/HintCatalog.test.ts"
Task: "Update src/themes/platformer/level/LevelParser.test.ts"
Task: "Update src/themes/platformer/level/Terrain.test.ts"
Task: "Update src/themes/platformer/level/level.test.ts"
Task: "Update src/themes/platformer/engine/Renderer.test.ts"
Task: "Write src/themes/platformer/editor/paintMarkerCell.test.ts"
Task: "Update src/themes/platformer/editor/editorState.test.ts"
Task: "Update src/themes/platformer/editor/importLayout.test.ts"
Task: "Update src/themes/platformer/editor/gridRenderState.test.ts"
Task: "Update src/themes/platformer/editor/paletteTiles.test.ts"
```

## Parallel Example: User Story 1

```text
Task: "Update src/themes/platformer/editor/Palette.test.tsx"
Task: "Update src/themes/platformer/editor/EditorCanvas.test.tsx"
Task: "Update src/themes/platformer/editor/editorActions.test.ts"
Task: "Update src/themes/platformer/PlatformerState.test.ts + PlatformerPage.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (**critical** — blocks every story).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: mark a wall with a connection point, play the level, confirm the wall is solid and the marker renders nothing.
5. Deploy/demo if ready — this is the defect the feature exists to fix.

### Incremental Delivery

1. Setup + Foundational → the typed layer exists and legacy files migrate.
2. US1 → marking is non-destructive (MVP).
3. US2 → markers persist, round-trip and stamp; Export shows the whole level.
4. US3 → patrol behaviour unchanged.
5. US4 → sign hints live on the layer.
6. US5 → the falling stalactite is a marker on `⊤`.
7. Polish → docs, the extension recipe, quickstart validation and `Features.md`.

---

## Notes

- `[P]` tasks touch different files and have no dependency on an incomplete task.
- `[Story]` labels map each task to its user story for traceability; setup, foundational and polish tasks intentionally have none.
- Every story is independently completable and testable; stop at any checkpoint to validate it.
- Verify tests fail before implementing.
- Commit after each task or logical group (only when the user explicitly asks — no auto-commits).
- The `editorActions.ts` and `EditorCanvas.tsx` files are intentionally touched by more than one phase; keep the edits scoped to the labeled story.
