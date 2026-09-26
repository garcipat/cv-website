# Implementation Plan: R-010 Platformer Mapper & Editor Unification

**Branch**: `R-010-platformer-mapper-editor-unification` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/R-010-platformer-mapper-editor-unification/spec.md`

## Summary

R-010 is a behaviour-preserving refactor of the shipped platformer editor and level-mapping
pipeline. It removes the parallel `editor/gridRenderState.ts` preview pipeline and makes the
editor draw from the **same** `LevelParser` finders + `*Mapper` place functions the running game
uses, fed through one `grid→layout` adapter (M1). It collapses the seven mappers onto one
`placeAtMarkers` helper, one `placeWithFactPool` helper, one CV-flattening helper and one
`level/ids.ts` (M2/M3). It consolidates the palette into one `PALETTE_TOOLS` descriptor whose
terrain entries read kind membership and `char`/`fogExempt`/`drawBand` from R-015's shipped
`TILE_MODULES` registry (M6). It unifies paint, import/export/crop and save onto generic
primitives (M7). It introduces one `LayoutFile` raw-file type and splits `editor/` into UI +
`editor/ops/` (pure transforms) + `editor/dev/` (save/dev infrastructure) (M8/F8). An FR-017 guard
test enforces the single-implementation invariants. No user-visible or gameplay behaviour changes:
the editor preview, palette, painted cells, exported layout and saved JSON stay byte-identical
(the one open parity question is recorded in [Open Issues](#open-issues--risks) and
[research.md](./research.md) OQ-1).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, no `any`) + React 19; Vite 8 bundler

**Primary Dependencies**: `@preact/signals-react` (editor state), R-015's `tiles/` tile-module
registry (`TILE_MODULES`, `TERRAIN_CHARS`, `TILE_FOG_EXEMPT` — shipped, consumed only), the seven
existing `level/*Mapper.ts` modules, `editor/` modules. No new dependency.

**Storage**: N/A — static site. Editor state persists to `localStorage` (unchanged keys); level
JSON files under `level/levels/` and `level/blueprints/` (unchanged).

**Testing**: Vitest + React Testing Library + jsdom; the FR-017 structural guard uses test-only
`node:fs`/`node:path` scanning (as R-015's `tiles/registry.test.ts` does). Commands: `npm test`,
`npm run build`, `npm run lint`. Conventions from [docs/TestingGuide.md](../../docs/TestingGuide.md)
(`{method}-{condition}-{expected-result}`, Arrange/Act/Assert) are authoritative.

**Target Platform**: Browser (static build).

**Project Type**: Single static web application — one self-contained theme at
`src/themes/platformer/`.

**Performance Goals**: No regression; initial bundle MUST NOT grow (the refactor deletes more
code than it adds). The editor preview is per-frame canvas work and must stay equivalent in cost.

**Constraints**:
- Byte-for-byte behaviour preservation (FR-015): preview placements, palette metadata, painted
  cells, imported/exported/cropped layout strings, saved JSON and runtime level output unchanged.
- R-001 layer invariants (FR-018): `contracts/` stays a leaf; no new `level/ → engine/`; no new
  `engine/ → state/`. `level/ids.ts` and the shared flattening helper keep `level/` React-free.
- `editor/ops/` MUST be importable and unit-testable without a React render; no React UI under
  `ops/` or `dev/`.
- R-015 remains shipped and is **not** rebuilt or extended; no palette-local tile registry.

**Scale/Scope**: ~36 modules under `editor/`, 7 `*Mapper.ts` files, `LevelParser.ts`,
`LevelDef`/`BlueprintData`, the palette tables, and the save/endpoint modules. Authoritative
conventions: [docs/Architecture.md](../../docs/Architecture.md),
[docs/TestingGuide.md](../../docs/TestingGuide.md), and
[R-001 layer-boundaries](../../specs/R-001-platformer-core-contracts/contracts/layer-boundaries.md)
plus [R-015 layer-invariants](../../specs/R-015-platformer-tile-module-registry/contracts/layer-invariants.md).

### Open Issues / Risks

- **OQ-1 (resolved 2026-09-27): chest placement parity.** The editor preview must keep one chest
  per `$` marker, while the runtime `placeChests(mapCVDataToChests(cv), findChestTiles(layout))`
  zips defs against markers and places `min(#experience, #chestMarkers)` (the shipped `main.json`
  has 7 markers and 5 experience entries, so 5 chests in play). `previewPlacements` therefore pads
  the CV-derived def list with placeholder defs up to the marker count and calls the same shared
  `findChestTiles`/`placeChests`; the runtime list stays unpadded. This keeps every marker visible
  and deletable in the editor (the user's requirement) without duplicating the finder or place
  function, so FR-001 and FR-015/SC-007 both hold. See [research.md OQ-1](./research.md). All other
  placement kinds are marker-driven and unaffected.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence / Mitigation |
| --- | --- | --- |
| I. Typed Data Architecture | PASS | No data-file or persisted-shape change. New `LayoutFile`, palette-tool and placement-contract types are declared in `level/`/`editor/` with no `any` (strict). |
| II. Testing (NON-NEGOTIABLE) | PASS | Existing mapper/editor/registry tests migrate to the shared helpers with assertions preserved; new FR-017 guard test enforces the invariants. No test is deleted, skipped or weakened (FR-016). |
| III. Code Quality & Component Standards | PASS | Named arrow exports, typed props, `cn()` retained; no shadcn change; no new component. |
| IV. No Feature Bloat | PASS | Specified refactor with its own ID/spec folder; no new feature, tile, tool or data. `docs/Features.md` dependency diagram updated when implementation + tests are done. |
| V. Performance & Static Delivery | PASS | No dependency added; net module count reduced; `ops/` code is tree-shaken as before. |
| Dev Workflow: manual browser check | PASS (required) | FR-015/SC-007 demand a manual before/after comparison of the game and editor, in addition to the suite. |
| Dev Workflow: no auto-commit | PASS | Changes are left uncommitted for review. |
| R-001 layer invariants (FR-018) | PASS | New modules are peer/downward imports only; `level/ids.ts`/`cvFacts.ts` import `level/` + `@/types` only (no React, no `engine/`). Re-verified post-design and enforced by the FR-017 guard. |

No violations — Complexity Tracking is empty.

*Post-design re-check (after Phase 1):* PASS. The design adds no forbidden edge (new `level/*`
modules import `level/`, `tiles/` reads, `shared/`, `contracts/`, `@/types` only; `editor/ops/**`
and `editor/dev/**` import downward and no React/UI modules), does not touch `contracts/`, and its
only new data model is in-code types. The OQ-1 chest-parity question is a spec-acceptance detail, not
a constitutional one, and is now resolved (the editor pads the chest-def list so every `$` marker
stays visible); it does not change this gate's outcome.

## Project Structure

### Documentation (this feature)

```text
specs/R-010-platformer-mapper-editor-unification/
├── plan.md                      # This file (/speckit.plan command output)
├── research.md                  # Phase 0 output — decisions D1–D13, OQ-1
├── data-model.md                # Phase 1 output — types/shapes introduced
├── quickstart.md                # Phase 1 output — runnable validation guide
├── contracts/                   # Phase 1 output
│   ├── layer-invariants.md      # R-001/R-015 edges + FR-017 guard checks
│   ├── grid-pipeline.md         # grid→layout adapter, layout-char walk, grid-crop
│   ├── mapper-placement.md      # placeAtMarkers / placeWithFactPool / cvFacts / ids
│   ├── palette-descriptor.md    # PALETTE_TOOLS + R-015 consumption
│   └── save-module.md           # generic save module + LayoutFile
└── tasks.md                     # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/themes/platformer/
├── level/
│   ├── layoutChars.ts           # NEW — one shared layout-character walk (parseLevel + importLayout)
│   ├── ids.ts                   # NEW — slugify + slugId/derived id helpers (moved out of CollectibleMapper)
│   ├── cvFacts.ts               # NEW — one CVData→CollectedFact flattening helper
│   ├── placement.ts             # NEW — placeAtMarkers + placeWithFactPool + MarkerPosition contract
│   ├── LevelParser.ts           # finders unchanged; parseLevel builds on layoutChars.walkLayout; + findOptionalSpawnTile
│   ├── LayoutFile.ts            # NEW — one raw { name?, layout, background?, markers? } type
│   ├── levelRegistry.ts         # LevelEntry aliases LayoutFile + id/name
│   ├── BlueprintData.ts         # Blueprint aliases LayoutFile + id/name (isBlueprint unchanged)
│   ├── layoutFile.ts            # unchanged validation home (M4); re-exports/uses LayoutFile
│   ├── BlockMapper.ts           # placeBlocks/placeCrates → placeAtMarkers/placeWithFactPool + cvFacts/ids
│   ├── EnemyMapper.ts           # placeX → placeAtMarkers/placeWithFactPool + cvFacts/ids
│   ├── ChestMapper.ts           # placeChests → placeAtMarkers + cvFacts/ids
│   ├── CollectibleMapper.ts     # slugify removed; placeCollectibles → placeAtMarkers; mapCVDataToSkillFactPool → cvFacts
│   ├── CheckpointMapper.ts      # placeCheckpoints → placeAtMarkers
│   ├── SignMapper.ts            # placeSigns → placeAtMarkers
│   └── HazardMapper.ts          # placeHazards → placeAtMarkers
├── tiles/registry.ts            # SHIPPED (R-015) — consumed by the palette, never extended
├── editor/
│   ├── (React UI, unchanged names)  # BlueprintSelect, EditorCanvas(+Pane), EditorEntrySelect,
│   │                                # EditorSaveDialog, EditorSidebar, EditorToolbar, EditorWorkspace,
│   │                                # LevelEditorPage(+.page), LevelSelect, Palette, PaletteTile
│   ├── editorState.ts           # state/signals + EditorTool/MarkerTool unions (not a pure transform)
│   ├── editorActions.ts         # controller wiring (not a pure transform)
│   ├── ops/                     # NEW — pure editing transforms (no React, unit-tested directly)
│   │   ├── paletteTiles.ts          # PALETTE_TOOLS descriptor (+ TileSpriteSpec, terrainPaletteTools)
│   │   ├── backgroundPaletteTiles.ts
│   │   ├── gridLayout.ts            # grid→layout adapter + marker-grid→placements
│   │   ├── exportLayout.ts          # boundingBoxOfContent/unionBoxes/cropLayoutToBox (generic) + exportLayout
│   │   ├── cropLevelForExport.ts    # wrapper over the generic crop primitive
│   │   ├── paintGrid.ts             # generic paint/stamp primitive
│   │   ├── paintCell.ts / paintBackgroundCell.ts / paintMarkerCell.ts
│   │   ├── placeBlueprint.ts
│   │   ├── previewPlacements.ts     # runtime finder+mapper-fed preview builders + player placeholder
│   │   ├── applyTool.ts             # shared per-tool paint/marker op (extracted from EditorCanvas.applyToolAt)
│   │   ├── importLayout.ts
│   │   ├── blueprintCells.ts / blueprintFit.ts / caveLightingPreview.ts
│   │   ├── EditorPan.ts / EditorZoom.ts
│   ├── dev/                     # NEW — save + dev-environment infrastructure (no React UI)
│   │   ├── saveFile.ts              # generic POST-with-download saver
│   │   ├── saveLevelFile.ts         # thin: level endpoint/file-name/JSON
│   │   ├── saveBlueprintFile.ts     # thin: blueprint endpoint/file-name/JSON
│   │   ├── layoutFileJson.ts        # one shared { name, layout, background?, markers? } serializer
│   │   ├── saveLevelEndpoint.ts / saveBlueprintEndpoint.ts / devEnvironmentEndpoint.ts
│   │   └── devEnvironment.ts
```

**Structure Decision**: Single-project layout inside the existing platformer theme. New cross-cutting
primitives live in `level/` (they must be React-free and reusable by the runtime) except the
editor-only row adapter/paint/preview/apply op, which live under `editor/ops/`. Save/dev modules
move to `editor/dev/`. React UI and the editor state/controller stay at `editor/`. `gridRenderState.ts`
is deleted and replaced by `ops/gridLayout.ts` + `ops/previewPlacements.ts`; the four
`PALETTE_TILE_*` tables are deleted and replaced by `ops/paletteTiles.ts`'s `PALETTE_TOOLS`.
`vite/writeLevelFile.ts` / `writeBlueprintFile.ts` / `devEnvironmentPlugin.ts` (repo-root `vite/`)
are unchanged; only the browser-side modules move.

## Complexity Tracking

> No Constitution Check violations. This section is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
