# Implementation Plan: Platformer Background Tile Rework

**Branch**: `O-014-platformer-background-tiles` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/O-014-platformer-background-tiles/spec.md`

## Summary

The background layer stops being a sparse list of stamped multi-tile art pieces
(`BackgroundPlacement[]`) and becomes a dense per-cell grid, one cell per
terrain cell, exactly mirroring how `terrain: TileType[][]` already works. Each
cell holds one of six background materials (`dirt`, `rust`, `surfaceStone` —
family `surface`; `charcoal`, `maroon`, `caveStone` — family `cave`) or is
empty. A new `BackgroundAtlas` module — a direct structural copy of
`GroundAtlas`'s approach — maps a 4-bit same-material neighbour mask to a
sprite + rotation per material, using only 6 physical tiles per material
(isolated, corner, edge, middle, strip-cap, strip-body) reused across all 16
mask values via 90°/180°/270° rotation. The renderer iterates the grid like
`drawTerrain` does; the editor paints/erases single cells like `paintCell`
does; `Lighting.isCellDarkening` becomes a direct grid lookup instead of an
AABB footprint scan. A new small `BackgroundDecorCatalog` scatters rock accents
on fully-interior cells using the same deterministic `pickVariant(col, row)`
technique `StaticObjectsCatalog` already uses for foreground decor.

This follows [docs/Architecture.md](../../docs/Architecture.md) (typed data,
canvas rendering, no backend) and
[docs/TestingGuide.md](../../docs/TestingGuide.md) (Vitest unit tests for pure
engine modules first, TDD). See [design.md](./design.md) for the rationale
behind each of these choices and the alternatives considered.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`) + React 19
**Primary Dependencies**: Vite 6+, Canvas 2D API, Tailwind CSS 4 + shadcn/ui. **No new runtime dependency.**
**Storage**: N/A — static site. The level's `background` field lives in the same in-memory `LevelDef` / localStorage / level-JSON path as `terrain` today. No new persistence mechanism.
**Testing**: Vitest + React Testing Library + jsdom, per [docs/TestingGuide.md](../../docs/TestingGuide.md). TDD is mandatory (constitution Principle II).
**Target Platform**: Static web (browser), desktop + mobile, reached via the `/platformer` route.
**Project Type**: Single static web app — a canvas game theme (`src/themes/platformer/`) inside the CV site.
**Performance Goals**: 60 fps; rendering the background grid is O(visible cells), same order as the existing terrain draw it sits alongside — no new per-frame cost class.
**Constraints**: No backend/API/DB; no new dependencies; strict TypeScript; every one of the 16 neighbour-mask values must resolve to a sprite for every material (no silent fallback — mirrors `groundAtlasCell`'s throw-on-missing contract); old saved levels with `BackgroundPlacement[]` must still load (with an empty background grid, no crash).
**Scale/Scope**: One feature. One new art asset (`public/sprites/background_tiles.png`, already authored — see design.md), one new engine module (`BackgroundAtlas.ts`) plus one new decor catalog (`BackgroundDecorCatalog.ts`), edits to `LevelData.ts`, `Terrain.ts`, `Renderer.ts`, `Lighting.ts`, a full rewrite of the editor's background paint/palette files, and — found by grepping every `BackgroundPlacement` usage during this plan's research, **re-checked against `main` after O-016's editor UI rework landed mid-design** — a wider ripple than the issue's own "Touch points" list named: `editor/editorState.ts`, `editor/editorActions.ts`, `editor/EditorCanvasPane.tsx`, `editor/EditorWorkspace.tsx`, `editor/EditorSidebar.tsx`, `editor/Palette.tsx`, `editor/saveBlueprintFile.ts`, `editor/saveLevelFile.ts`, `editor/cropLevelForExport.ts`, `editor/placeBlueprint.ts`, `level/levelRegistry.ts`, `level/BlueprintData.ts`, plus `level/level.ts`'s shipped `LEVEL_1_BACKGROUND` data, which is real level content (not just a type) that needs re-authoring against the new materials, not just a rename. O-016 replaced the old `editorLevelState.ts` single-file signal store with `editorState.ts` (signals) + `editorActions.ts` (mutations) and split `LevelEditorPage.tsx`'s ~950 lines into `EditorCanvasPane.tsx`/`EditorWorkspace.tsx`/`EditorSidebar.tsx`/`EditorToolbar.tsx`/`EditorSaveDialog.tsx` — this plan's file list already reflects that split, not the pre-O-016 shape.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Gate | Status | Notes |
| --- | --- | --- | --- |
| I. Typed Data Architecture | Types declared before use; no `any`; typed JSON/data imported directly | ✅ PASS | `BackgroundMaterialId`, `BackgroundMaterialFamily`, and `BackgroundGrid` are declared in `level/LevelData.ts` before any consuming code is written (Task 1 below). No runtime parsing, no API. |
| II. Testing (NON-NEGOTIABLE) | Tests written and reviewed before implementation; all tests pass; `{method}-{condition}-{expectedResult}` naming; Vitest + RTL + jsdom | ✅ PASS | `BackgroundAtlas.test.ts`, `BackgroundDecorCatalog.test.ts`, and the rewritten `Renderer.test.ts` / `paintBackgroundCell.test.ts` / `backgroundPaletteTiles.test.ts` / `Lighting.test.ts` suites are all written before their implementation, mirroring `GroundAtlas.test.ts`'s existing completeness-over-all-16-masks pattern. |
| III. Code Quality & Component Standards | Named arrow exports, typed props inline, `cn()` for conditional classes, CLI-managed shadcn/ui only, named exports | ✅ PASS | New modules export named functions/consts, matching `GroundAtlas.ts`'s style exactly. No shadcn/ui component is added or edited. |
| IV. No Feature Bloat | Feature originates from a spec in `specs/`; tracked in `docs/Features.md`; no roadmap step lists | ✅ PASS | O-014 already exists as a tracked feature (GitHub Issue #52) with this spec. This plan implements exactly the spec's FRs — no extra materials, no lit-top-edge variant, no scope beyond what's specified. |
| V. Performance & Static Delivery | No unjustified dependency; performance considered; assets optimized | ✅ PASS | Zero new dependencies. One new PNG asset, hand-authored at native tile resolution (no oversized art). Background draw stays O(visible cells), same cost class as the existing terrain draw. |

**Post-Phase-1 re-check**: All five gates still pass — the data model
(below) introduces no new dependency, no backend, no `any`, and no shadcn
edits. See [design.md](./design.md) for rejected alternatives (a lit
top-edge variant, extending `StaticObjectsCatalog`, migrating old placement
data).

**Complexity Tracking**: No violations — the table is intentionally omitted.

## Project Structure

### Documentation (this feature)

```text
specs/O-014-platformer-background-tiles/
├── spec.md               # Behavior: user stories, FRs, success criteria
├── design.md              # Rationale: why per-cell grid, why fully flat, why these materials
├── plan.md                # This file
├── data-model.md          # Phase 1 output: types, the 16-mask rotation table, atlas coordinates
├── contracts/
│   └── background-engine.md  # Public API surface: BackgroundAtlas, BackgroundDecorCatalog, Renderer, Lighting, editor
└── tasks.md               # Phase 2 output (NOT created by this plan — see "Next Step" below)
```

### Source Code (repository root)

```text
public/sprites/
└── background_tiles.png             # NEW (already authored): 6 materials x 6 shapes, see data-model.md for layout

src/themes/platformer/
├── level/
│   └── LevelData.ts                 # EDIT: BackgroundMaterialId, BackgroundMaterialFamily, BackgroundGrid;
│                                     #       LevelDef.background: BackgroundGrid (was BackgroundPlacement[])
├── engine/
│   ├── Terrain.ts                   # EDIT: export NEIGHBOUR_UP/RIGHT/DOWN/LEFT bit constants (reused, not duplicated)
│   ├── BackgroundAtlas.ts           # NEW: 16-entry neighbour-mask table per material, mirrors GroundAtlas.ts
│   ├── BackgroundAtlas.test.ts      # NEW: mask-table completeness + rotation-reuse tests, mirrors GroundAtlas.test.ts
│   ├── BackgroundDecorCatalog.ts    # NEW: rock variant picking, mirrors StaticObjectsCatalog.ts's pickVariant
│   ├── BackgroundDecorCatalog.test.ts # NEW
│   ├── BackgroundCatalog.ts         # DELETE: superseded by BackgroundAtlas.ts + LevelData.ts's family map
│   ├── BackgroundCatalog.test.ts    # DELETE
│   ├── Lighting.ts                  # EDIT: isCellDarkening becomes a direct grid lookup
│   ├── Lighting.test.ts             # EDIT: grid-lookup based test cases replace AABB-footprint cases
│   ├── Renderer.ts                  # EDIT: drawBackgroundTiles rewritten to iterate the grid like drawTerrain
│   └── Renderer.test.ts             # EDIT: drawBackgroundTiles suite rewritten for the grid model
├── editor/
│   ├── paintBackgroundCell.ts       # REWRITE: footprint/overlap logic replaced by single-cell paint/erase (mirrors paintCell.ts)
│   ├── paintBackgroundCell.test.ts  # REWRITE
│   ├── backgroundPaletteTiles.ts    # REWRITE: 10 piece ids -> 6 material ids; section-derivation logic unchanged in spirit
│   ├── backgroundPaletteTiles.test.ts # REWRITE
│   ├── EditorCanvas.tsx             # EDIT: 'paintBackground' drag mode carries `material` instead of `pieceId`
│   ├── editorState.ts               # EDIT (post O-016 rework): `editorBackgroundSignal`/`editorBlueprintBackgroundSignal`/`editorBackgroundPlacementsSignal` retyped to BackgroundGrid; `editorSelectedBackgroundPieceSignal` -> `editorSelectedBackgroundMaterialSignal`; `PlacementSnapshot.background` retyped
│   ├── editorActions.ts             # EDIT: `selectBackgroundPiece` -> `selectBackgroundMaterial`; `applyBackgroundPaint`, `shiftBackgroundPlacements` (rename `shiftBackgroundGrid` — a grid grows, it doesn't shift discrete placements), the level/blueprint load validity filter, save/crop calls
│   ├── EditorCanvasPane.tsx         # EDIT: `backgroundPlacements`/`selectedBackgroundPiece` props -> `backgroundGrid`/`selectedBackgroundMaterial`
│   ├── EditorWorkspace.tsx          # EDIT: reads `editorBackgroundPlacementsSignal`/`editorSelectedBackgroundPieceSignal` -> renamed grid/material signals
│   ├── EditorSidebar.tsx            # EDIT: `selectedBackgroundPiece` prop, `selectBackgroundPiece` action -> renamed
│   ├── Palette.tsx                  # EDIT: `selectedBackgroundPiece`/`onSelectBackgroundPiece` props -> material-keyed; renders `BACKGROUND_PALETTE_SECTIONS` (already section-based, from `backgroundPaletteTiles.ts` above) — layout logic mostly unchanged
│   ├── saveBlueprintFile.ts         # EDIT: serializes BackgroundGrid instead of BackgroundPlacement[]
│   ├── saveLevelFile.ts             # EDIT: serializes BackgroundGrid instead of BackgroundPlacement[]
│   ├── cropLevelForExport.ts        # EDIT: crops a BackgroundGrid sub-region instead of filtering/rebasing placements by footprint
│   └── placeBlueprint.ts            # EDIT: `rebaseBlueprintBackground` stamps a blueprint's BackgroundGrid sub-region into the level grid instead of rebasing placement coordinates
├── level/
│   ├── levelRegistry.ts             # EDIT: `isBackground` validator checks a BackgroundGrid shape instead of a BackgroundPlacement[] shape
│   ├── BlueprintData.ts             # EDIT: same validator shape change, blueprint's own `background?` field
│   └── level.ts                     # EDIT: `LEVEL_1_BACKGROUND` re-authored as a BackgroundGrid using the 6 new materials (content, not just a type change); `currentBackground` signal retyped
└── docs/themes/platformer/
    └── LevelFormat.md               # EDIT: document the new per-cell background grid format (FR-014)
```

**Structure Decision**: Single static web app. All work lands inside the
existing `src/themes/platformer/` tree, following the established split:
pure math and catalogs in `engine/`, level-shape types in `level/`, authoring
in `editor/`. `Renderer.ts` remains the only module mapping world coordinates
to canvas coordinates; `BackgroundAtlas.ts` is pure and canvas-free (like
`GroundAtlas.ts`) so it is unit-testable without a DOM. `BackgroundCatalog.ts`
is deleted outright rather than deprecated in place — nothing outside this
feature's own files imports it (confirmed via the file list above), and the
constitution's "no feature bloat" principle argues against carrying dead code
forward.

## Next Step

This plan (Phase 0 Summary/Context + Phase 1 data model/contracts) is ready
for review. The bite-sized, TDD task-by-task breakdown (Phase 2 — exact test
code, exact implementation steps, one commit per step) belongs in a separate
`tasks.md`, matching how [O-010's plan.md](../O-010-platformer-cave-lighting/plan.md)
and its own `tasks.md` are split in this repo. Once this plan is approved,
the next step is writing that `tasks.md`.
