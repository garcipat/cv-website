# Feature Specification: Platformer Mapper & Editor Unification

**Feature Branch**: `R-010-platformer-mapper-editor-unification`

**Created**: 2026-09-27

**Status**: Draft

**Input**: GitHub issue #98 — "R-010: Platformer Mapper & Editor Unification". Make the editor reuse the runtime level pipeline and unify the mapper, palette, paint, import/export and save duplication. Covers findings **M1/M2/M3/M6/M7/M8** and **F8**; findings **M4/M5/F5/F6** already landed and are out of scope (issue #98 "Already completed").

**Depends on**: [R-002 Platformer Shared Primitives & Dedup](../R-002-platformer-shared-primitives/spec.md) (shipped: the kind unions derived from `HAZARD_TYPES`/`BLOCK_TYPES`, and the shared fact-pool pacing helper the mappers build on), [R-015 Platformer Tile Module Registry](../R-015-platformer-tile-module-registry/spec.md) (shipped: the `tiles/` tile-module registry and its `TILE_MODULES` read model — per-kind `char`/`fogExempt`/`drawBand`/appearance — the palette consumes), [O-015 Editor Dark Mode](../O-015-editor-dark-mode/spec.md), [O-016 Editor UI Rework](../O-016-editor-ui-rework/spec.md) and [O-019 Level Editor Zoom](../O-019-level-editor-zoom/spec.md) (shipped: the editor UI, appearance and zoom/pan this refactor restructures), [S-030 Platformer Tile Meta Layer](../S-030-platformer-tile-meta-layer/spec.md) (shipped: the `markers`/`MarkerGrid` layer the mappers and the palette now carry).

**Dependency satisfied**: [R-015 Platformer Tile Module Registry](https://github.com/garcipat/cv-website/issues/111) — **shipped** (merged to `main`). The editor palette (M6) consumes R-015's `tiles/` tile-module registry (`TILE_MODULES`) rather than declaring its own tile table. R-010 MUST NOT build a competing tile registry. R-015 deliberately left `paletteTiles.ts` behaviour untouched and exposed the read model the palette now consumes.

**Design reference**: [`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) — Phase 8 (mapper and editor unification), group M findings **M1** (gridRenderState duplicates the finder + mapper pipeline), **M2** (seven mapper files with no shared interface), **M3** (CVData→fact flattening duplicated across four files/eight converters), **M6** (palette metadata is four parallel tables), **M7** (editor paint/import/save duplication), **M8** (three overlapping raw-file shapes), and group F finding **F8** (`editor/` mixes three concerns).

## Clarifications

### Session 2026-09-27

- Q: Which palette tools must source their membership and appearance/placement from R-015's `TILE_MODULES` registry, given that registry only covers terrain tile kinds (not entity/hazard characters, marker tools, the eraser or the blueprint) and carries no palette icon sprite-crop spec? → A: Only *terrain* tile tools consult `TILE_MODULES`, and only for kind membership plus `fogExempt`/`drawBand` rule/appearance flags; every tool's label, description, glyph and icon sprite spec stay in the one `PALETTE_TOOLS` descriptor, and entity/hazard/marker/eraser/blueprint tools declare their own descriptor fields. R-015's contract is not extended.
- Q: FR-010 requires one layout-import adapter and one crop/export path "shared by the editor and the runtime registries" — what must actually be unified, given `importLayout` returns the editor `TileChar[][]` while `parseLevel` returns a `LevelDef`, `cropLevelForExport` already delegates to `cropLayoutToBox`, and the registries never crop? → A: Share the underlying primitive, not the signature — one shared layout-character walk used by both `importLayout` and `parseLevel` (each keeping its own return type), and `cropLayoutToBox` stays the one generic grid-crop primitive with `cropLevelForExport` a wrapper over it; "shared with the runtime registries" applies to the parse/import side only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The editor preview is produced by the runtime finder + mapper chain (Priority: P1)

Today `editor/gridRenderState.ts` re-synthesizes every preview placement. It carries its own `findAllPositions` (a copy of `LevelParser`'s `findAllOfKind`) and one `synthesize*` function per kind — `synthesizeCollectiblePlacements`, `synthesizeEnemyStates`, `synthesizeBlockStates`, `synthesizeChestStates`, `synthesizeCheckpointStates`, `synthesizeSignPlacements`, `synthesizeHazardPlacements`, `synthesizeRopeLadderBundleStates` — each a parallel copy of a `LevelParser` finder plus a `*Mapper` place function. The doc comments admit the duplication. After this feature the editor feeds its in-memory `TileChar[][]` grid (and marker grid) through a grid→layout adapter into the same finder + mapper chain the running game uses, and the parallel pipeline is deleted — so a change to a finder or mapper can never silently diverge from what the editor draws.

**Why this priority**: This is the issue's headline instruction for M1 ("editor reuses the `LevelParser` finders + `*Mapper` place functions via a grid adapter (deletes the parallel `gridRenderState` pipeline)") and the structural prerequisite for the whole "one placement path" story.

**Independent Test**: Search the theme for `gridRenderState`'s finder/synthesizer copies — they no longer exist. Feed a grid containing each entity, hazard and marker character through the editor preview and confirm the resulting placements equal what the runtime finder + mapper chain produces for the equivalent raw layout.

**Acceptance Scenarios**:

1. **Given** an editor grid containing entity, hazard and marker characters, **When** the editor computes preview placements, **Then** they come from the runtime `LevelParser` finders and `*Mapper` place functions through a grid→layout adapter, not from editor-local synthesizers.
2. **Given** the source tree, **When** `editor/gridRenderState.ts` is inspected, **Then** its parallel `findAllPositions` and `synthesize*` functions are removed; any surviving editor-only preview helper (e.g. the static player placeholder at the `S` spawn) is not a second copy of a shared finder or mapper.
3. **Given** a shared finder or mapper is changed, **When** the editor preview and the running game are both exercised, **Then** both reflect the change from the one implementation, with no editor-side edit required.

---

### User Story 2 - One mapper placement helper set and one CV flattening path (Priority: P1)

Today the seven `*Mapper` files each hand-roll the same place loop, all reducing to `markers.map(({col,row}) => ({ id: \`${prefix}-${col}-${row}\`, ...tileToPixel(col, row) }))`, and two of them — `BlockMapper.placeCrates` and `EnemyMapper.placeGreenSlimes` — hold the same proportional fact-pool slice algorithm written twice. The CVData→fact flattening is likewise copied across four files (five converters in `BlockMapper.ts`, one each in `EnemyMapper.ts`/`ChestMapper.ts`/`CollectibleMapper.ts`), and `slugify` lives in `CollectibleMapper.ts` yet is imported by the block, enemy and chest mappers. After this feature one `placeAtMarkers` and one `placeWithFactPool` helper, plus one shared flattening helper and a `level/ids.ts` home, replace the copies.

**Why this priority**: It is findings M2 and M3, and it is what makes adding a mapper a small, consistent module rather than a new copy of an existing one.

**Independent Test**: Search the mappers for the per-file place loops and for the `slugify`-from-`CollectibleMapper` import — they are gone. Confirm `placeAtMarkers`/`placeWithFactPool` are the only place loops, that the fact-pool slice exists once, and that `slugify`/id helpers live in `level/ids.ts`.

**Acceptance Scenarios**:

1. **Given** a mapper with marker positions, **When** it places them, **Then** it routes through `placeAtMarkers` (or `placeWithFactPool`) rather than an inline `markers.map(...)` loop.
2. **Given** the crate and green-slime placements, **When** inspected, **Then** both route through the one fact-pool slice helper and neither carries its own copy of the algorithm.
3. **Given** a CVData source, **When** a mapper builds its defs/facts, **Then** all mappers route through the one shared flattening helper and one `level/ids.ts`, and no mapper imports `slugify` from another mapper.
4. **Given** a new mapper, **When** it is added, **Then** it is expressed against the shared placement contract rather than a fresh ad-hoc conversion.

---

### User Story 3 - One paint, import/export and save path (Priority: P1)

Today `paintCell`, `paintBackgroundCell`, `paintMarkerCell`, `placeBlueprint` and `rebaseBlueprintBackground` each repeat the same "copy the grid, grow it, write one cell" body; `EditorCanvas.applyToolAt` re-encodes per-tool semantics (marker tools, sign/falling-stalactite, torch, and a "clear marker on repaint" set) that duplicate `paintMarkerCell` and `parseMarkers`; `importLayout` and the parse side of `parseLevel` walk the layout characters independently; `cropLevelForExport` re-implements its background crop loop instead of routing it through `cropLayoutToBox`; and `saveLevelFile` and `saveBlueprintFile` are near-identical (same slug body, same `hasBackgroundContent`, same POST-with-download fallback). After this feature there is one generic paint primitive, one shared layout-character walk primitive, one generic grid-crop primitive (with the multi-layer crop a wrapper over it), and one generic save module, with per-layer/per-target behaviour expressed as data.

**Why this priority**: It is finding M7; it is the half of the unification that removes the largest amount of duplicated editor code and closes the "canvas click and ops can drift" gap.

**Independent Test**: Search the editor for the per-layer paint bodies, the duplicate import adapter, the duplicate cropper and the second save module — each has one implementation. Confirm painting foreground, background and markers, importing/exporting/cropping, and saving a level or a blueprint still produce byte-identical results.

**Acceptance Scenarios**:

1. **Given** a foreground, background or marker cell to paint, **When** it is written, **Then** the write goes through the one generic paint primitive; no per-layer paint body repeats the grow-and-write loop.
2. **Given** an editor canvas click, **When** the tool is a marker tool, a sign, a falling stalactite, a torch, or a re-painted cell, **Then** the per-tool rule is applied from the shared ops (the same code `paintMarkerCell`/`parseMarkers` use) rather than a second copy inside `EditorCanvas`'s `applyToolAt`.
3. **Given** a raw layout or a grid, **When** it is imported or exported/cropped, **Then** `importLayout` and `parseLevel` share the one layout-character walk primitive (each still returning its own artifact type), and the multi-layer `cropLevelForExport` routes through the one generic grid-crop primitive rather than re-implementing the crop loop.
4. **Given** a level or a blueprint save, **When** it runs, **Then** both go through the one generic save module parametrised by endpoint/filename, and the produced JSON and download fallback are byte-identical to today.

---

### User Story 4 - The palette is one descriptor table (Priority: P1)

Today `paletteTiles.ts` holds four parallel tables — `PALETTE_TILE_SPRITES`, `PALETTE_TILE_GLYPHS`, `PALETTE_TILE_DESCRIPTIONS`, `PALETTE_TILE_LABELS` — plus the `EditorTool`/`MarkerTool` unions and `Palette.tsx`'s local `DECORATION_CHARS` grouping, so adding or changing a tool touches up to six places. After this feature one `PALETTE_TOOLS` descriptor keyed by `EditorTool` carries the label, description, sprite spec and grouping for every tool, and the four tables are gone. Terrain tile tools additionally read their kind membership and rule/appearance flags (`char`, `fogExempt`, `drawBand`) from R-015's shipped `tiles/` tile-module registry (`TILE_MODULES`) rather than from a palette-local tile table; entity, hazard, marker, eraser and blueprint tools declare their own descriptor fields, and no palette icon is derived from R-015 (which carries no palette icon crop spec).

**Why this priority**: It is finding M6, one of the issue's named headline findings. It is P1 now that R-015 has shipped — the palette consumes R-015's read model instead of waiting on it, so the consolidation is no longer gated behind another feature.

**Independent Test**: Count the places that must change to add a palette tool: with the unified descriptor it is one entry. Confirm the four tables no longer exist as separate sources and that every palette entry still shows the same label, description, sprite, glyph and grouping.

**Acceptance Scenarios**:

1. **Given** the palette, **When** the tool metadata is inspected, **Then** one `PALETTE_TOOLS` descriptor keyed by `EditorTool` is the source of each tool's label, description, sprite spec, glyph and grouping; `PALETTE_TILE_SPRITES`/`PALETTE_TILE_GLYPHS`/`PALETTE_TILE_DESCRIPTIONS`/`PALETTE_TILE_LABELS` no longer exist as four parallel tables.
2. **Given** a new or changed tool, **When** it is added, **Then** it is one descriptor entry, not edits to four or more tables.
3. **Given** R-015 is shipped, **When** a terrain tile kind's palette entry is built, **Then** its kind membership and rule/appearance flags (`char`, `fogExempt`, `drawBand`) are read from R-015's tile-module registry (`TILE_MODULES`) rather than from a palette-local tile table, while its label, description, glyph and icon sprite spec come from the one `PALETTE_TOOLS` descriptor. Non-terrain tools (entity/hazard characters, marker tools, eraser, blueprint) declare their own descriptor fields; no palette icon is derived from R-015.
4. **Given** the palette, **When** it is inspected, **Then** it holds no second tile registry and no palette-local tile-kind table.

---

### User Story 5 - One raw-file shape and one editor taxonomy (Priority: P2)

Today `LevelEntry` and `Blueprint` declare two near-identical raw shapes (`{ id, name, layout, background?, markers? }`), and `editor/` is a flat list of 36 modules mixing React UI, pure editing transforms and dev/save infrastructure. After this feature one `LayoutFile` type describes the raw `{ name?, layout, background?, markers? }` shape and both registry entries alias it, and `editor/` is split into UI plus `editor/ops/` (pure transforms) and `editor/dev/` (save endpoints + dev environment).

**Why this priority**: It is findings M8 and F8 — small but high-clarity structural wins that make the "where does a new editor module go?" question answerable.

**Independent Test**: Confirm `LevelEntry` and `Blueprint` no longer declare separate raw shapes but alias one `LayoutFile` type, and that `editor/ops/` and `editor/dev/` exist with the expected concern boundaries (no React under `ops/` or `dev/`).

**Acceptance Scenarios**:

1. **Given** the raw file shape, **When** the types are inspected, **Then** exactly one `LayoutFile` type exists and both `LevelEntry` and `Blueprint` alias (or extend) it with their own id; neither redeclares `layout`/`background`/`markers` independently.
2. **Given** the `editor/` folder, **When** it is inspected, **Then** React UI modules live at `editor/`, pure transforms live under `editor/ops/`, and save-endpoint/dev-environment modules live under `editor/dev/`.
3. **Given** `editor/ops/` and `editor/dev/`, **When** their imports are inspected, **Then** neither pulls in React UI, and the pure transforms do not depend on the UI modules.

---

### User Story 6 - The unification is invisible (Priority: P1)

This is a refactor of already-shipped behaviour, so the acceptance bar is that nothing a visitor or a level author sees changes: the editor still previews the same enemies, blocks, chests, checkpoints, coins, signs, hazards and rope-ladder bundles at the same positions; the palette still shows the same tools with the same labels, tooltips, icons and grouping; painting/erasing still writes the same cells; import/export/crop still produce the same layout strings; and saving a level or blueprint still writes the same JSON. The editor is also what the game's level files are authored through, so its preview must stay an exact mirror of the runtime.

**Why this priority**: It is the acceptance bar for every finding in this phase and the verification story that runs last over the combined change.

**Independent Test**: Open the level editor and the game against the pre-refactor build and compare: place each tool and confirm the same preview; paint/erase foreground, background and markers and confirm the same cells; save a level and a blueprint and diff the JSON; play the resulting level and confirm identical behaviour. Separately unit-test the shared helpers and the generic save/paint paths.

**Acceptance Scenarios**:

1. **Given** the editor canvas, **When** any tool is painted or erased, **Then** the resulting grid, marker grid and background grid are identical to today's, including the hazard facing cycle, the single-spawn rule, the sign/torch cycle and the "clear marker on repaint" set.
2. **Given** the editor preview, **When** a level with every character kind is loaded, **Then** every visible placement (kind, position, appearance) is identical to today's, even where the internal preview ids now come from the shared mappers.
3. **Given** a save, export or crop, **When** it runs on the same input, **Then** the produced JSON and layout strings are byte-identical to today's.
4. **Given** the game, **When** a level authored through the unified editor is played, **Then** it behaves identically to one authored before the refactor.

---

### Edge Cases

- ✅ **The editor preview currently uses a `PLACEHOLDER_FACT` and index-based ids.** `gridRenderState.ts` fabricates a fixed `CollectedFact` stub and ids like `editor-crate-0` because none of the reused draw functions read `fact`. Reusing the shared mappers changes the preview's internal ids (e.g. to `crate-${col}-${row}`) and may bind real CVData-derived facts instead of the stub; this is allowed because ids/facts are not user-visible, but every visible placement (kind, position, appearance) MUST be unchanged and tests asserting the old editor-only ids MUST be updated rather than weakened.
- ✅ **The editor preview has one helper with no runtime equivalent.** The static player placeholder at the `S` spawn (`synthesizePlayerState`) mirrors `PlatformerState`'s `spawnPlayerState`, which lives in the state layer. If reusing it would add a forbidden edge, this one editor-only preview helper may remain, but it MUST NOT be a copy of a shared finder or mapper.
- ✅ **`LevelDef` is not the raw file shape.** `LevelDef` (`terrain`, `width`, `height`, `background?`, `markers?`) is the parsed runtime artifact, distinct from the raw `{ name?, layout, background?, markers? }` file shape. M8's single `LayoutFile` type aliases `LevelEntry` and `Blueprint` only; `LevelDef` is not conflated with it.
- ✅ **`slugify` is imported across mappers.** `CollectibleMapper.ts` currently exports `slugify`, imported by `BlockMapper.ts`/`EnemyMapper.ts`/`ChestMapper.ts`. Moving it to `level/ids.ts` must update every importer; leaving a re-export in `CollectibleMapper.ts` would preserve the second home and is not allowed.
- ✅ **`layoutFile.ts` already owns raw-file validation.** M4 already collapsed `isLayout`/`isBackground`/`isMarkers`/`idFromPath`/`parse*Modules` into `level/layoutFile.ts`. The new `LayoutFile` type should live beside that module's existing role, but the type unification MUST NOT undo M4's single validation home.
- ✅ **The paint paths differ per layer.** Foreground paint cycles hazard facing and clears rival spawns; background paint writes a material char; marker paint sets/clears a typed marker and shifts/resizes with the grid. The one generic paint primitive must express these as data/callbacks, not collapse them into a lowest-common-denominator write.
- ✅ **`saveLevelFile` and `saveBlueprintFile` fall back to a client download** when the dev-server POST endpoint is unavailable, and the two endpoints/folders differ. The generic save module must preserve the POST-with-download fallback and still resolve the correct endpoint/folder/file name per target.
- ✅ **The editor folder split must not create a React dependency in pure code.** `editor/ops/` must stay importable without a React render (the pure transforms are unit-tested directly); `editor/dev/` holds endpoint and dev-environment plumbing, not components.
- ✅ **R-015 is shipped and consumed, not rebuilt.** The palette reads R-015's `tiles/` tile-module registry (`TILE_MODULES`) for terrain-kind membership and `char`/`fogExempt`/`drawBand`; no palette-local tile registry or second tile-kind table may be introduced. R-015 carries no palette icon metadata, so each tool's icon sprite spec stays in the `PALETTE_TOOLS` descriptor and R-015's contract is not extended (resolved in the 2026-09-27 clarification session).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The editor MUST compute every preview placement (collectibles, enemies, blocks, chests, checkpoints, signs, hazards, rope-ladder bundles) through the SAME `LevelParser` finders and `*Mapper` place functions the runtime uses, fed by a grid→layout adapter that converts the editor's `TileChar[][]` grid plus its marker grid into the raw layout form those functions read. The parallel `gridRenderState` pipeline — its `findAllPositions` and its `synthesize*` functions — MUST be removed.
- **FR-002**: Exactly ONE grid→layout adapter MUST exist, and it MUST be the only place the editor re-derives raw layout rows from its in-memory grid. The editor preview and the editor's export path MUST share it rather than each translating characters. The grid→layout adapter and the generic grid-crop primitive (FR-010) MUST be the one row-serialization primitive applied two ways — to the whole grid for the preview, and to a bounded sub-rectangle for export — not two serializers. An editor-only preview helper that has no runtime counterpart (the static player placeholder) MAY remain, but MUST NOT duplicate a shared finder or mapper.
- **FR-003**: Exactly ONE `placeAtMarkers` helper MUST replace the near-identical per-mapper place loops. It MUST take the marker positions plus a descriptor (id prefix and a per-marker builder) and MUST be the only place loop used by the `*Mapper` files.
- **FR-004**: Exactly ONE `placeWithFactPool` helper MUST replace the duplicated proportional fact-pool slice algorithm shared today by `BlockMapper.placeCrates` and `EnemyMapper.placeGreenSlimes`.
- **FR-005**: The `*Mapper` files MUST express placement against ONE shared contract (marker positions + a def/builder → a placement) rather than seven unrelated ad-hoc conversions, so a new mapper is a descriptor and a builder.
- **FR-006**: CVData→fact/def flattening MUST live in ONE shared helper used by the block, enemy, chest and collectible mappers. `slugify` and every derived id helper MUST move to a shared `level/ids.ts`; no mapper may import `slugify` from another mapper, and no re-export may preserve a second home.
- **FR-007**: Palette metadata MUST be ONE `PALETTE_TOOLS` descriptor keyed by `EditorTool`, each entry carrying at least the label, description, glyph and sprite spec (plus the palette grouping). `PALETTE_TILE_SPRITES`, `PALETTE_TILE_GLYPHS`, `PALETTE_TILE_DESCRIPTIONS` and `PALETTE_TILE_LABELS` MUST collapse into it; adding a tool MUST be one descriptor entry.
- **FR-008**: For terrain tile tools ONLY, the palette descriptor MUST source kind membership and the rule/appearance flags R-015 exposes (`char`, `fogExempt`, `drawBand`) from R-015's shipped `tiles/` tile-module registry (`TILE_MODULES`), rather than holding a palette-local tile table. Entity characters, hazard characters, marker tools, the eraser and the blueprint MUST carry their own descriptor fields. Palette icon sprite specs (sheet/crop/frame size) MUST live in the descriptor, because R-015's registry carries no palette icon metadata and R-010 MUST NOT extend it. R-010 MUST NOT build its own tile registry or a second palette table.
- **FR-009**: Exactly ONE generic paint primitive MUST replace the repeated "copy the grid, grow it, write one cell" bodies in `paintCell`, `paintBackgroundCell`, `paintMarkerCell`, `placeBlueprint` and `rebaseBlueprintBackground`. Per-layer and per-tool behaviour (hazard facing cycle, single-spawn clearing, marker set/clear, blueprint rebasing) MUST be expressed as data or callbacks, not repeated loops.
- **FR-010**: The layout-character walk/validation MUST live in ONE shared primitive that both the editor's `importLayout` (which still returns the editor `TileChar[][]` grid with legacy-marker migration) and the runtime `parseLevel` (which still returns a `LevelDef` terrain map with its marker layer) build on — the primitive is shared, the signatures are not; neither path may keep its own copy of the character walk. Exactly ONE generic grid-crop primitive MUST serialize a grid sub-rectangle to raw rows; the multi-layer `cropLevelForExport` MUST remain a wrapper over it rather than re-implementing the crop loop. "Shared by the editor and the runtime registries" applies to the parse/import primitive, since the registries parse layouts and never crop.
- **FR-011**: Exactly ONE generic save module MUST replace the near-identical `saveLevelFile` and `saveBlueprintFile`, parametrised by endpoint, folder and file name. It MUST preserve the same slug/file-name derivation, the same `hasBackgroundContent` rule and the same POST-with-download fallback. `saveLevelEndpoint`, `saveBlueprintEndpoint` and the dev-environment endpoint MUST remain the only target-specific values.
- **FR-012**: `EditorCanvas`'s `applyToolAt` MUST stop re-encoding per-tool placement semantics (marker tools, sign/falling-stalactite, torch, and the "clear marker on repaint" set); those rules MUST live in the shared ops that `paintMarkerCell` and `parseMarkers` also use, so canvas-click behaviour and the ops cannot diverge.
- **FR-013**: Exactly ONE `LayoutFile` type MUST describe the raw `{ name?, layout, background?, markers? }` shape, and both `LevelEntry` and `Blueprint` MUST alias (or extend) it with their own id rather than declaring two separate shapes.
- **FR-014**: `editor/` MUST be split into three concerns: React UI modules at `editor/`, pure editing transforms under `editor/ops/`, and dev/save infrastructure under `editor/dev/`. No React UI may live under `ops/` or `dev/`; the UI folder MUST NOT hold pure transforms.
- **FR-015**: No user-visible or editor-visible behaviour may change. The editor preview, the palette entries (label, description, sprite, glyph, grouping), paint/erase results, imported/exported/cropped layout strings, saved level/blueprint JSON and the runtime level output MUST be identical to before. No new tile, tool, gameplay, art, tuning or level-data change is allowed. Internal preview placement ids MAY change (they now come from the shared mappers) but every visible placement MUST not.
- **FR-016**: All existing tests MUST migrate and MUST pass, with assertions unchanged wherever only a module home or import path changed. Tests for a symbol consolidated into a generic helper MUST be rewritten against the generic form, never weakened, skipped or deleted. The production build MUST succeed.
- **FR-017**: An automated guard test MUST assert the structural invariants this feature creates: the editor-local finder/synthesizer pipeline no longer exists; exactly one palette descriptor (no parallel tables); one paint primitive, one shared layout-character walk primitive and one generic grid-crop primitive; one save module; one `LayoutFile` shape; and the `editor/ops/` + `editor/dev/` split with no React under either. The guard MUST fail the suite if an invariant regresses.
- **FR-018**: The change MUST NOT widen R-001's forbidden edges: `contracts/` stays a leaf, no new `level/ → engine/`, and no new `engine/ → state/`. `level/ids.ts` and the shared flattening helper MUST keep `level/` free of React.

### Key Entities

- **Runtime finder + mapper chain**: the `LevelParser` finders and the `*Mapper` place functions the game already uses; the single placement implementation the editor must reuse.
- **Grid→layout adapter**: the one conversion from the editor's in-memory `TileChar[][]` grid (plus marker grid) to the raw layout form the finders read; shared by the preview and export paths.
- **`placeAtMarkers`**: the one marker→placement loop helper shared by every mapper (id prefix + per-marker builder).
- **`placeWithFactPool`**: the one proportional fact-pool slice helper shared by the crate and green-slime placements.
- **`level/ids.ts`**: the single home for `slugify` and derived id helpers, replacing the current cross-mapper import.
- **Shared CV flattening helper**: the one CVData→def/fact conversion used by the block, enemy, chest and collectible mappers.
- **`PALETTE_TOOLS` descriptor**: one `Record<EditorTool, { label, description, sprite, glyph, group }>` replacing the four parallel palette tables; terrain tile entries also read kind membership and `fogExempt`/`drawBand` from R-015's tile module, while every entry's own label/description/glyph/icon sprite spec stays in the descriptor.
- **Generic paint primitive**: the one grid-copy/grow/write used by foreground, background, marker, blueprint and rebase paints.
- **Shared import/export/crop path**: the one layout-character walk primitive shared by `importLayout` (editor grid) and `parseLevel` (`LevelDef`), plus the one generic grid-crop primitive the multi-layer `cropLevelForExport` wraps.
- **Generic save module**: the one parametrised level/blueprint saver (endpoint/folder/file name) preserving the POST-with-download fallback.
- **`LayoutFile` type**: the one raw `{ name?, layout, background?, markers? }` shape `LevelEntry` and `Blueprint` alias.
- **`editor/ops/` and `editor/dev/`**: the pure-transform and dev/save-infrastructure homes created by the F8 split.
- **R-015 tile module registry**: the shipped `tiles/` `TILE_MODULES` read model (`char`/`fogExempt`/`drawBand` and the runtime `draw` hook) the palette consumes for terrain-kind membership/flags but does not build; it carries no palette icon metadata.

## Success Criteria *(mandatory)*

- **SC-001**: A search of the theme finds no editor-local copy of the finder/mapper pipeline: `gridRenderState`'s `findAllPositions` and `synthesize*` functions are gone, and a unit test shows the editor preview's placements equal what the runtime finder + mapper chain produces for the same layout.
- **SC-002**: A search finds exactly one `placeAtMarkers`/`placeWithFactPool`, one `level/ids.ts`, and one shared CV flattening helper; no mapper-local place loop and no cross-mapper `slugify` import remain.
- **SC-003**: A search finds exactly one `PALETTE_TOOLS` descriptor and none of the four parallel palette tables; adding a tool is one descriptor entry; and for a terrain tile kind, kind membership plus the `fogExempt`/`drawBand` flags come from R-015's shipped `TILE_MODULES` registry (its label/description/glyph/icon sprite spec still come from the descriptor, and no palette icon is derived from R-015).
- **SC-004**: A search finds exactly one paint primitive, one shared layout-character walk primitive (used by both `importLayout` and `parseLevel`), one generic grid-crop primitive (with `cropLevelForExport` a wrapper over it) and one save module; the per-layer paint bodies, the duplicated character walk, the duplicated crop loop and the second save module are gone.
- **SC-005**: Exactly one `LayoutFile` type exists; `LevelEntry` and `Blueprint` alias it and do not declare separate raw shapes.
- **SC-006**: `editor/` is split into UI plus `editor/ops/` and `editor/dev/`, with no React under `ops/` or `dev/`.
- **SC-007**: The full test suite passes, the production build succeeds, and the editor preview, palette entries, paint/erase results, imported/exported/cropped layout strings and saved level/blueprint JSON are byte-identical to before; a manual browser check of the game and the editor confirms no visible change.
- **SC-008**: R-001's forbidden edges are not widened (`contracts/` still a leaf, no new `level/ → engine/` or `engine/ → state/`).
- **SC-009**: FR-017's guard test fails the suite if any of SC-001–SC-006 regresses, so those criteria are enforced automatically rather than by manual search alone.

## Assumptions

- **R-015 is shipped and unblocks the palette.** M6's palette unification consumes R-015's `TILE_MODULES` registry; no part of R-010 remains gated on it. M1/M2/M3/M7/M8 and F8 are independent of the tile contract. R-010 never builds a tile registry.
- **Module paths, folder layout and helper signatures are planning decisions; the single-implementation rules are not.** The issue names `placeAtMarkers`/`placeWithFactPool`/`PALETTE_TOOLS`/`LayoutFile`/`editor/ops`/`editor/dev`; the exact file names, the generic paint primitive's and save module's shape, and which modules land in `ops/` vs `dev/` (e.g. whether `editorState`/`editorActions` count as pure ops or state) are settled in planning.
- **Reusing the mappers changes internal preview ids and may bind real CVData facts.** The editor's `PLACEHOLDER_FACT` and index-based ids are an implementation accident; the shared mappers derive ids from marker positions and bind CVData-derived facts. Since no draw function reads `fact` and ids are not user-visible, the visible preview is unchanged (FR-015), and tests asserting the old editor-only ids are updated.
- **The editor preview must not gain a state-layer dependency it does not already have.** The one editor-only player placeholder is allowed to remain if reusing the runtime's `spawnPlayerState` would add a forbidden edge; it must not duplicate a shared finder/mapper.
- **Behaviour is preserved exactly; only structure moves.** The sanctioned changes are the single pipeline, the shared helpers, the descriptor, the generic paint/save paths, the `LayoutFile` type and the folder split — never a change to preview output, palette metadata, painted cells, exported layout, saved JSON or gameplay.
- **No data migration.** Shipped levels, blueprints, sprites, tuning and translations are unchanged; only TypeScript module homes, imports, types and helper APIs move.
- **Tests are the safety net.** The existing mapper/editor/registry tests are the behavioural contract; they migrate to the shared helpers and are extended by the FR-017 guard test.

## Out of Scope

- R-015's `tiles/` tile-module registry itself (shipped); this feature only consumes its contract from the palette.
- The renderer split (R-009) and the transient-effect registry (R-004) — already shipped.
- Per-domain state stores, `PlayerDamageSystem`, `BombSystem`, `AssetLoader` and the `HudRenderer`/HUD-model extraction — **R-011/R-012**.
- Sprite/atlas organisation — **R-013**.
- The layer-boundary lint guard — **R-014**.
- Findings M4/M5/F5/F6 (raw-file validation home, kind unions, `level.ts` split, placeholder folders) — already landed.
- `entity/` regrouping (F9), the `features/`/`engine/render/` regroup (F7) and other group F findings not named by the issue.
- Any new tile, palette tool, gameplay, art, tuning, level data or translation change.
