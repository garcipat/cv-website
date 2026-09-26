# Phase 0 Research — R-010 Platformer Mapper & Editor Unification

**Feature**: `R-010-platformer-mapper-editor-unification` | **Date**: 2026-09-27

This refactor has no external technology unknowns; the two spec ambiguities were resolved in the
2026-09-27 clarification session (palette read-model scope; import/crop unification scope). The
research below fixes the module boundaries, helper signatures and guard checks the spec leaves to
planning (spec Assumptions), plus one newly discovered parity issue (OQ-1). Each entry is
**Decision / Rationale / Alternatives considered**.

---

## D1 — The editor preview reuses the runtime finder + mapper chain via one grid→layout adapter

- **Decision**: `editor/ops/gridLayout.ts` exports the single adapter:
  - `gridToLayout(grid: TileChar[][]): readonly string[]` — serializes the **whole** rectangular
    grid to raw layout rows (one string per row) using the generic grid-crop primitive (D7).
  - `markerGridToPlacements(markers: MarkerGrid): MarkerPlacement[]` — dense marker grid → sparse
    stored placements (the export shape `parseLevel`/parse-side reads).
  `editor/ops/previewPlacements.ts` then builds every preview collection by calling the **runtime**
  finders and mappers directly: `placeCollectibles(findCoinTiles(layout))`,
  `placeEnemies(mapCVDataToEnemies(cv), { slimeGreen: findGreenEnemyTiles(layout), slimePurple: findPurpleEnemyTiles(layout), bee: findBeeTiles(layout) }).map(toEnemyState)`,
  `placeBlocks(mapCVDataToBlocks(cv), { crate: findCrateTiles(layout), … }).map(toBlockState)`,
  `placeChests(padChestDefs(mapCVDataToChests(cv), findChestTiles(layout)), findChestTiles(layout)).map(toChestState)`
  (the def list is padded so every `$` marker previews — see OQ-1),
  `placeCheckpoints(findCheckpointTiles(layout)).map(toCheckpointState)`,
  `placeSigns(findSignTiles(layout, markers))`, `placeHazards(findHazardTiles(layout, markers))`,
  `findLadderBundleTiles(layout).map(({col,row}) => createRopeLadderState(level, col, row))`.
  `editor/ops/gridRenderState.ts`'s `findAllPositions` and every `synthesize*` (except the player
  placeholder, D2) are deleted.
- **Rationale**: It is FR-001/M1 verbatim, and it makes SC-001 ("preview placements equal the
  runtime chain") a direct consequence rather than a second implementation kept in sync.
- **Alternatives considered**: (a) Keep `gridRenderState` and add a shared-mapper adapter only for
  some kinds — rejected, leaves the divergence FR-001 forbids. (b) Have the editor call
  `parseLevel` for placements too — rejected: finders read the raw layout by contract, and several
  (`findSignTiles`/`findHazardTiles`) additionally take the marker grid.

## D2 — `gridToLevelDef` routes through the adapter; the player placeholder stays editor-only

- **Decision**: `previewLevelDef(grid, markers)` = `parseLevel(gridToLayout(grid), markerGridToPlacements(markers))`
  (terrain fields used; the returned marker layer discarded). Passing a **defined** marker array is
  mandatory: `parseLevel`'s `T`-generation rule maps a bare `T` to the decorative `stalactite`
  terrain when `storedMarkers === undefined`, but the editor's `T` is always the sign character, so
  markers must be supplied so `T → 'empty'`. The static player placeholder is renamed
  `previewPlayerState(layout)` and gets its spawn from a new exported
  `findOptionalSpawnTile(layout)` (a null-returning companion to `findSpawnTile`); its position
  formula is the only editor-only preview helper allowed to remain (spec Edge Case; it mirrors the
  state-layer `PlatformerState.spawnPlayerState`, which `ops/` must not import).
- **Rationale**: FR-002 ("one row-serialization primitive") and the spec Edge Case that the player
  placeholder "MAY remain, but MUST NOT duplicate a shared finder or mapper". Using
  `findOptionalSpawnTile` removes the last copy of `findAllPositions`.
- **Alternatives considered**: Reusing `spawnPlayerState` — rejected, `state/ → editor/` is wrong
  direction and would add an editor→state edge the spec avoids. Keeping the local `S` scan —
  rejected, it is a copy of `findAllOfKind`.

## D3 — One shared layout-character walk in `level/layoutChars.ts`

- **Decision**: `level/layoutChars.ts` exports `walkLayout(layout, visit)` yielding
  `{ char, col, row }` for every in-bounds cell, with `width = max(row.length)` and short rows
  skipped (as both callers already do). `LevelParser.parseLevel` and `editor/ops/importLayout`'s
  `importLayout` are re-expressed as visitors over it; the per-path mapping (terrain+markers+unknown
  warning vs `TileChar[][]`+legacy migration) stays in each caller. A `layoutWidth(layout)` helper
  lives beside it (both callers already compute the same reduce).
- **Rationale**: FR-010 requires one walk primitive shared by the *parse* side (the registries
  parse and never crop), with signatures kept distinct. `level/` is the lowest layer both can
  import (editor imports level; level must not import editor).
- **Alternatives considered**: A `string[]`-returning normalizer — rejected, the two paths return
  different artifacts (`LevelDef` vs `TileChar[][]`), which the clarification explicitly preserves.

## D4 — `placeAtMarkers` and `placeWithFactPool` in `level/placement.ts`

- **Decision**: One shared placement contract:
  ```ts
  export interface MarkerPosition { col: number; row: number }
  export interface PlaceAtMarkersDescriptor<M extends MarkerPosition, P> {
    idPrefix: string;
    /** Override for ids embedding more than prefix+cell (sign hintId, hazard type). */
    id?: (marker: M, index: number) => string;
    /** Everything except the helper-assigned `id`/`x`/`y`. */
    build: (marker: M, index: number) => Omit<P, 'id' | 'x' | 'y'>;
  }
  export function placeAtMarkers<M extends MarkerPosition, P>(
    markers: readonly M[], d: PlaceAtMarkersDescriptor<M, P>,
  ): P[]  // id = d.id?.(m,i) ?? `${d.idPrefix}-${m.col}-${m.row}`; x/y = tileToPixel
  ```
  `placeWithFactPool(markers, pool, { idPrefix, build })` is implemented **on top of**
  `placeAtMarkers` (it computes the `revealedFactCountFor` slice inside the builder and writes
  `fact`/`extraFacts`), so `placeAtMarkers` is the only loop. `placeCrates`/`placeGreenSlimes`
  become descriptors (`{ idPrefix: 'crate', build: () => ({ blockKind: 'crate' }) }` /
  `{ idPrefix: 'enemy-slimeGreen', build: () => ({ type: 'slimeGreen' }) }`). The chest and
  question-mark 1:1 zips also route through `placeAtMarkers` (chests slice `markers` to
  `defs.length` first, preserving today's exact zip; question-marks place every marker with an
  optional def, using `id` to keep the def id or the `qmark-cell` fallback).
- **Rationale**: FR-003/FR-004/FR-005. `idPrefix` matches the spec's wording while the optional
  `id` preserves the sign/hazard/chest id formats **byte-for-byte**. Every current id
  (`coin-…`, `checkpoint-…`, `enemy-slimePurple-…`, `fragileRock-…`, `sign-${hintId}-…`,
  `hazard-${type}-…`, block def ids) is reproduced exactly.
- **Alternatives considered**: A factory-per-mapper contract with seven bespoke builders —
  rejected (FR-005 rejects seven unrelated ad-hoc conversions). A single mega-helper that also owns
  def-building — rejected, the sections/defs differ per mapper.

## D5 — One CV-flattening helper + one `level/ids.ts`

- **Decision**: `level/ids.ts` owns `slugify` (moved verbatim from `CollectibleMapper.ts`) and
  `slugId(prefix, ...parts)` (=`${prefix}-${slugify(parts.join('-'))}`). **No re-export remains in
  `CollectibleMapper.ts`.** `level/cvFacts.ts` owns `cvFact(sectionId, sectionLabel, sourceType, id, data): CollectedFact`,
  the one constructor for the `{ id, sectionId, sectionLabel, data, sourceType }` shape currently
  copied across the block/enemy/chest/collectible converters. The five `educationToBlock`/…,
  `courseToEnemy`, `experienceToChest`, `categoryToSkillFact` collapse to one-liners over
  `slugId`+`cvFact`.
- **Rationale**: FR-006 and the spec Edge Case (`slugify` must have exactly one home; a re-export
  is not allowed). `level/` is React-free and imports only `@/types`, `level/LevelData`.
- **Alternatives considered**: Putting `slugify` in `shared/` — rejected: it is CV-id vocabulary
  and `level/` is where its consumers live; `@/types` is already an allowed `level/` import.

## D6 — One `PALETTE_TOOLS` descriptor consuming R-015's `TILE_MODULES`

- **Decision**: `editor/ops/paletteTiles.ts` exports
  ```ts
  export type PaletteGroup = 'terrain' | 'decoration' | 'entities' | 'hazards' | 'tools' | 'blueprints';
  export interface PaletteTool {
    label: string; description: string; sprite: TileSpriteSpec | null; glyph?: string; group: PaletteGroup;
  }
  export const PALETTE_TOOLS: Record<EditorTool, PaletteTool>
  ```
  plus `terrainPaletteTools()` which enumerates `TILE_MODULES`, keeps modules with a `char`, and
  joins each with its descriptor, exposing the registry-owned `char`, `fogExempt`, `drawBand`.
  `Palette.tsx` builds the Terrain/Decoration/Entities/Hazards/Tools groups from `PALETTE_TOOLS`
  (`group`) and `terrainPaletteTools()` instead of the four tables and the local `DECORATION_CHARS`
  array. Entity/hazard/marker/eraser/blueprint tools carry their own descriptor fields; no palette
  icon is derived from R-015. `PALETTE_TILE_SPRITES`/`_GLYPHS`/`_DESCRIPTIONS`/`_LABELS` are
  deleted. `HAZARD_PALETTE_KEYS`, `PATROL_GLYPH`, `CONNECTION_POINT_GLYPH`, `BLUEPRINT_GLYPH` stay
  (they are derived helpers, not one of the four tables).
- **Rationale**: FR-007/FR-008 + the 2026-09-27 clarification: terrain membership/flags come from
  R-015, label/description/glyph/icon sprite spec + grouping stay in the descriptor, R-015 is not
  extended. This makes adding a tool (and adding a tile kind) one descriptor entry / one registry
  line respectively.
- **Alternatives considered**: Extending `TileModule` with palette metadata — forbidden by the
  clarification (R-010 must not extend R-015's contract). Deriving grouping from `drawBand` —
  rejected, grouping is authoring metadata the registry does not carry.

## D7 — One generic paint primitive and one generic grid-crop primitive

- **Decision**: `editor/ops/paintGrid.ts` exports
  ```ts
  export function stampGridCells<T>(grid: T[][], cells: readonly {col,row,value}[], emptyValue: T, grow = true): GrowResult<T>
  export function paintGridCell<T>(grid: T[][], col, row, value, emptyValue, grow = true): GrowResult<T>  // = stampGridCells with one cell
  ```
  built on the existing `growGrid`. `paintCell` (foreground rules: spawn clearing, hazard cycle) and
  `paintBackgroundCell` use `paintGridCell` with `grow=true`; `paintMarkerCell`/`eraseMarkerCell`
  use `grow=false` (their "never grow" per-layer rule); `placeBlueprint`/`rebaseBlueprintBackground`
  use `stampGridCells` (blueprint writes every cell, rebase filters `.`). `editor/ops/growGrid.ts`
  stays the low-level grow primitive. `editor/ops/exportLayout.ts`'s
  `cropLayoutToBox<T>(grid, box, emptyValue)` is genericized and becomes the **one** grid-crop
  serializer; `cropLevelForExport`'s inline background loop is replaced by a second
  `cropLayoutToBox` call, and `exportLayout`/`gridToLayout` are the whole-grid applications.
- **Rationale**: FR-009/FR-010 and FR-002 ("the grid→layout adapter and the generic grid-crop
  primitive … the one row-serialization primitive applied two ways"). Per-layer rules stay data
  (`grow` flag, explicit cell list) rather than a lowest-common-denominator write.
- **Alternatives considered**: A single `paintCell` with a big `switch` — rejected (the spec wants
  per-layer behaviour as data/callbacks, and the callers are different layers). Keeping the
  background crop loop — rejected (SC-004 requires the duplicated crop loop gone).

## D8 — One shared per-tool paint/marker op (`editor/ops/applyTool.ts`)

- **Decision**: Extract `EditorCanvas.applyToolAt`'s per-tool branches into
  `applyTool(grid, markers, col, row, tool, isErase): { paint: PaintResult; markers: MarkerGrid | null; target: {col,row} }`
  in `ops/`. It composes the existing primitives (`paintCell`, `paintMarkerCell`, `paintSignMarker`,
  `paintTorchMarker`, `eraseMarkerCell`, `shiftMarkerGrid`) and exports the shared
  `markerRemovedOnRepaint(kind)` predicate for the "clear marker on repaint" set
  (`sign`/`fallingStalactite`/`torch`; `patrolBoundary`/`connectionPoint` survive). `EditorCanvas`
  calls it and writes the results through `onPaint`/`onPaintMarker`.
- **Rationale**: FR-012 — canvas-click behaviour and the ops cannot diverge. The tool↔marker tables
  are now shared with `paintMarkerCell`'s marker kinds and `parseMarkers`' `SIGN_CHAR`/legacy map.
- **Alternatives considered**: Leaving the branches in `EditorCanvas` and only sharing the paint
  primitives — rejected (FR-012 names the per-tool semantics specifically).

## D9 — One generic save module (`editor/dev/saveFile.ts`) + shared JSON serializer

- **Decision**: `saveFile({ endpoint, fileName, contents }): Promise<SaveResult>` owns the
  POST-with-download fallback; `downloadFile(fileName, contents)` owns the anchor/object-URL
  download; `layoutFileJson(name, layout, background, markers)` owns the pretty-printed,
  newline-terminated `{ name, layout, background?, markers? }` JSON (background included only when
  it has a non-`.` cell). `saveLevel`/`saveBlueprint` become thin calls supplying
  `SAVE_LEVEL_ENDPOINT`/`SAVE_BLUEPRINT_ENDPOINT` and `levelFileName(name)`/`blueprintFileName(name)`
  (the latter keeps its `'new'`→`'new-1'` guard). `LEVELS_FOLDER`/`BLUEPRINTS_FOLDER` stay exported
  for the vite plugins and tests.
- **Rationale**: FR-011 — one module parametrised by endpoint/filename; identical slug,
  `hasBackgroundContent` rule and fallback. `editor/dev/` has no React UI.
- **Alternatives considered**: A class/factory — rejected, no state; a functional module is
  smaller and matches the codebase.

## D10 — `LayoutFile` in `level/LayoutFile.ts`, aliased by `LevelEntry` and `Blueprint`

- **Decision**: `level/LayoutFile.ts` declares
  ```ts
  export interface LayoutFile {
    name?: string;
    layout: readonly string[];
    background?: readonly string[];
    markers?: readonly MarkerPlacement[];
  }
  ```
  `LevelEntry extends LayoutFile { id: string; name: string }`; `Blueprint extends LayoutFile { id: string; name: string }`.
  Neither redeclares `layout`/`background`/`markers`. M4's `level/layoutFile.ts` keeps being the
  single validation home (`isLayout`/`isBackground`/`isMarkers`/`idFromPath`/`parse*Modules`) and
  imports the type. `LevelDef` is **not** conflated with `LayoutFile`.
- **Rationale**: FR-013 + spec Edge Case (M4's single validation home must not be undone; `LevelDef`
  stays the parsed runtime artifact). A dedicated leaf module avoids adding a runtime import to
  `layoutFile.ts`'s existing type-only cycle with `levelRegistry`/`BlueprintData`.
- **Alternatives considered**: Declaring `LayoutFile` inside `level/layoutFile.ts` — acceptable
  (type-only cycle already exists) but a sibling file keeps the type import direction one-way and
  is easier to guard.

## D11 — `editor/ops/` vs `editor/dev/` membership

- **Decision**:
  - `editor/ops/` (pure, no React import, directly unit-testable): `paletteTiles`,
    `backgroundPaletteTiles`, `gridLayout`, `exportLayout`, `cropLevelForExport`, `paintGrid`,
    `paintCell`, `paintBackgroundCell`, `paintMarkerCell`, `placeBlueprint`, `previewPlacements`,
    `applyTool`, `importLayout`, `blueprintCells`, `blueprintFit`, `caveLightingPreview`,
    `EditorPan`, `EditorZoom`.
  - `editor/dev/` (save + dev-environment plumbing, no React UI): `saveFile`, `saveLevelFile`,
    `saveBlueprintFile`, `layoutFileJson`, `saveLevelEndpoint`, `saveBlueprintEndpoint`,
    `devEnvironmentEndpoint`, `devEnvironment`.
  - `editor/` root keeps only React UI (`.tsx`) plus `editorState.ts` (signals + the
    `EditorTool`/`MarkerTool`/`EditorLayer`… type unions) and `editorActions.ts` (the editor
    controller wiring). These are neither pure transforms nor dev infra; keeping them at the root
    avoids putting a `@preact/signals-react` import under `ops/`/`dev/`, which the spec's
    "importable without a React render" rule would otherwise complicate.
- **Rationale**: FR-014 + spec Edge Case (no React under `ops/`/`dev/`, `ops/` transforms must not
  depend on UI modules). The spec leaves `editorState`/`editorActions` placement to planning.
- **Alternatives considered**: Moving `editorState`/`editorActions` into `ops/` — rejected (they
  are not pure transforms and import signals + `@/state`, `PlatformerState`). A fourth
  `editor/state/` folder — rejected: not named by F8 and would exceed the spec's three concerns.

## D12 — FR-017 guard test and test migration

- **Decision**: A new `src/themes/platformer/editor/editorStructure.test.ts` (Vitest, test-only
  `node:fs` scan, mirroring `tiles/registry.test.ts`) asserts: no `gridRenderState`
  `findAllPositions`/`synthesize*`; exactly one `PALETTE_TOOLS` and none of the four
  `PALETTE_TILE_*` tables; exactly one `placeAtMarkers`/`placeWithFactPool` and one `slugify`
  (in `level/ids.ts`); one paint primitive, one layout-character walk, one grid-crop, one save
  module; one `LayoutFile`; `ops/`+`dev/` exist with no `.tsx`/`react` imports and no
  pure-transform module left at the editor root; R-001/R-015 forbidden edges absent.
  Existing tests migrate with assertions preserved; only the editor-only preview ids change
  (`editor-crate-0` → `crate-${col}-${row}`, etc.), which the Edge Case explicitly allows and
  which the tests are rewritten (not weakened) to assert against the shared-mapper outputs.
- **Rationale**: FR-016/FR-017, SC-009, constitution Principle II.
- **Alternatives considered**: A lint rule — out of scope (R-014 owns the lint guard).

## D13 — Layer invariants preserved

- **Decision**: New `level/*` modules import only `level/**`, `tiles/` (registry reads),
  `shared/`, `contracts/` and `@/types`; no React, no `engine/`. `editor/**` imports downward and
  may import `level/`/`state/`. The generic save module stays under `editor/dev/` (never imported
  by `level/`). No `contracts/` module changes.
- **Rationale**: FR-018 / R-001 / R-015.

---

## OQ-1 — Chest placement parity (resolved 2026-09-27)

**Finding.** The editor preview and the runtime already disagree on chest count. Evidence:

- `gridRenderState.synthesizeChestStates` placed **one chest per `$` marker** (stub fact).
- `PlatformerState` uses `placeChests(mapCVDataToChests(cv), CHEST_TILES.value)`, and
  `placeChests` iterates **defs**, stopping at `defs.length` (not markers): it places
  `min(#experience, #chestMarkers)`.
- `level/levels/main.json` contains **7** `$` markers; `cv.en.json` and `cv.de.json` each contain
  **5** experience entries. So the runtime shows 5 chests and today's editor preview shows 7.

**Decision (user, 2026-09-27): preserve the 7-chest preview.** Routing chests through the runtime
`placeChests` alone would show only 5, and a marker the author cannot see is a marker the author
cannot delete — the editor must keep every placed marker visible. The editor therefore pads the
CV-derived def list with placeholder defs up to the marker count and calls the **same** shared
finder (`findChestTiles`) and place function (`placeChests`); the runtime keeps passing the
unpadded list, so gameplay is unchanged. FR-001 is honoured (one shared finder + place function);
only the preview's def *input* differs, which is a preview-visibility concern rather than a second
placement implementation. FR-015/SC-007 hold as written because the visible preview is still 7
chests, and SC-001 carries the padding carve-out.

**Alternatives rejected:**
- *Accept the 5-chest runtime preview.* Would make surplus `$` markers invisible and undeletable in
  the editor, defeating level authoring.
- *Reduce the shipped level to 5 `$` markers.* A level-data edit, explicitly out of scope
  ("No data migration"; "No new … level-data change").

All other preview kinds are marker-driven and unaffected: `placeGreenSlimes`/`placeCrates`/
`placeBlocks` place one placement per marker regardless of def count; collectibles/checkpoints/
signs/hazards/rope-ladders carry no CVData zip. `placeChests` is the sole def-driven zip that can
drop a marker.
