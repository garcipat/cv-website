# Implementation Plan: Platformer Tile Meta Layer

**Branch**: `S-030-platformer-tile-meta-layer` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/S-030-platformer-tile-meta-layer/spec.md`
(Issue [#47](https://github.com/garcipat/cv-website/issues/47))

## Summary

Give a level and a blueprint a **tile meta layer**: a typed, per-cell metadata store
aligned to the terrain grid and independent of it. A marker's value is a **discriminated
union** — `{kind:'patrolBoundary'} | {kind:'connectionPoint'} | {kind:'fallingStalactite'}
| {kind:'sign'; hintId}` — so a marker carries exactly the data its kind needs and nothing
is untyped (FR-023). The layer replaces every piece of per-cell content the terrain grid
used to encode: the patrol boundary (`P`), the blueprint connection point (`+`), a sign's
hint (formerly the layout digits `1`–`6`), and the falling-stalactite variant (formerly
the hazard character `T`).

Signs collapse to one uniform `T` layout character plus `{kind:'sign', hintId}` on the
layer; `findSignTiles` pairs each `T` cell with its marker's `hintId` and falls back to the
default hint when the marker is missing (FR-025/FR-027). The freed `T` is the sign
character; `⊤` stays the only stalactite tile and a presence-only `fallingStalactite`
marker makes it fall (FR-026). The running game reads patrol boundaries, sign hints and
falling-stalactite presence through `markerAt`, so gameplay is bit-for-bit what it was and
a level's effective behavior is identical whether its markers were authored on the layer
or migrated from an old layout (FR-021/FR-022/FR-032).

The layer is stored **sparsely** (`markers?: MarkerPlacement[]`, omitted when empty) so an
unmarked level's file is unchanged (FR-014); a file whose layout still encodes this data is
migrated at load time and the next save writes the new shape (FR-015). The editor keeps a
parallel marker grid persisted like the background grid, paints it through the foreground
canvas with the marker's own tool (no layer mode), shows each marker's content — a sign's
hint code badge and hover tooltip, the falling stalactite's existing red tint — and never
lets a marker grow the canvas (FR-009–FR-013, FR-028–FR-031). Blueprints carry their
markers through save, reload and placement (FR-018/FR-020); placement validity stays
terrain-only (FR-019). The editor's Export control displays the complete level JSON — the
same shape a save writes, `markers` included — by reusing the save serializer, so the
displayed text and the written file can never drift (FR-033/FR-034).

The implementation follows [docs/Architecture.md](../../docs/Architecture.md) (typed data,
Preact signals, static build) and [docs/TestingGuide.md](../../docs/TestingGuide.md)
(Vitest + RTL + jsdom, TDD, `{method}-{condition}-{expected}` naming).

## Technical Context

**Language/Version**: TypeScript (strict mode), React 19, Vite 6+
**Primary Dependencies**: Preact Signals (`@preact/signals-react`) for editor and game
state, HTML5 Canvas 2D for rendering, Tailwind CSS 4 + shadcn/ui for editor chrome only.
**No new dependencies and no new assets** — the marker glyphs and the sign/falling tool
sprites are text/crops already defined in `paletteTiles.ts`.
**Storage**: N/A — static site. Level/blueprint files are JSON whose `layout`/`background`
are `readonly string[]` character layouts; this feature adds a sparse `markers` entry list
of typed `{ col, row, marker: MarkerEntry }` objects. No backend, no API, no database.
**Testing**: Vitest + React Testing Library + jsdom (`npm test`). New pure modules
(`parseMarkers`, `markerAt`, `paintMarkerCell`, `HintCatalog`, `placeBlueprintMarkers`,
marker-aware `findSignTiles`/`findHazardTiles`) get full unit coverage; editor
wiring (marker grid, palette tools, badges, tooltip) and game integration get
component/integration tests. Naming follows `{method}-{condition}-{expected}`.
**Target Platform**: Browser (static build served from `dist/`).
**Project Type**: Single static frontend web app (React game + level editor under
`src/themes/platformer/`).
**Performance Goals**: Keep the 60 fps loop. `markerAt` is an O(1) array read on a grid the
size of `terrain` (≤ a few hundred by a few dozen cells), and the marker grid is only
allocated for levels that have markers. No new per-tick allocation. The editor's hover
tooltip is a single DOM node updated on mouse move, not a per-frame canvas allocation.
**Constraints**: No `any` (constitution I); the marker union is the only value shape
(FR-023). TDD, all tests green before merge (constitution II). Visible behaviour
additionally verified by a manual browser check (constitution workflow). The layer is
editor/runtime only; it adds no dependency and no server.
**Scale/Scope**: 1 new `MarkerEntry` union (4 members) / `MarkerGrid` / `MarkerPlacement`
vocabulary, 2 members removed from `TileType`, 1 hazard character (`T`) removed and 1 sign
character (`SIGN_CHAR = 'T'`) added, 1 ordered `HINT_IDS` catalog, 1 optional
`LevelDef.markers` field, 1 optional `markers` field on the level/blueprint storage shapes,
1 new pure editor module (`paintMarkerCell.ts`) plus a placement helper, and edits across
the parser, level signals, enemy movement, hazard discovery, renderer, editor
state/actions/palette/canvas/toolbar/save, registries, docs and tests.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Assessment | Notes |
| --------- | ---------- | ----- |
| **I. Typed Data Architecture** | **PASS** | Every new value is typed: `MarkerEntry` is a closed discriminated union (FR-023), `MarkerGrid`/`MarkerPlacement`/`EditorTool`/`MarkerTool`/`CroppedLevel.markers` are declared in `src/themes/platformer/level/` before the files that use them; no `any`. localStorage is the one untyped boundary, so `editorMarkerSignal`/`editorBlueprintMarkerSignal` validate through a `isMarkerGrid`/`isMarkerPlacement` guard (the same forgiving shape-check `background` already uses). |
| **II. Testing (NON-NEGOTIABLE)** | **PASS** | TDD: `LevelParser.test.ts`, `HintCatalog.test.ts`, `Terrain.test.ts`, `level.test.ts`, `patrol.test.ts`/`EnemyAI.test.ts`, `Renderer.test.ts`, `paintMarkerCell.test.ts`, `editorActions.test.ts`, `cropLevelForExport.test.ts`, `exportLayout.test.ts`, `saveLevelFile.test.ts`/`saveBlueprintFile.test.ts`, `placeBlueprint.test.ts`/`blueprintFit.test.ts`, `Palette.test.tsx`/`EditorCanvas.test.tsx`/`EditorToolbar.test.tsx`, and `PlatformerPage.test.tsx` are written first. `src/lib/` coverage targets are untouched; editor/component coverage follows the 80%+ target. |
| **III. Code Quality and Component Standards** | **PASS** | Named arrow-function exports with typed props; props interfaces stay in their component files; `cn()` unchanged. No shadcn/ui component is added, edited or copied — the marker tooltip is a plain absolutely-positioned `<div>` inside the canvas pane, like the existing placement preview. |
| **IV. No Feature Bloat** | **PASS** | Backed by spec S-030 (issue #47); no roadmap/step list. `docs/Features.md`'s dependency diagram is updated only when implementation **and** tests are fully done. The four marker kinds are the closed set this feature ships; a fifth is a separate feature. |
| **V. Performance and Static Delivery** | **PASS** | No new dependency or asset; O(1) marker lookup; the marker grid is omitted entirely for a level with no markers, so a genuinely marker-free level's save shape is unchanged and the game allocates no extra grid until a marker exists. The shipped `main` level *does* gain a `markers` field on its next save — its signs are the legacy `1`–`6` characters — which is the expected migration, not a regression. |

**Post-Phase 1 re-check**: **PASS** — the design removes two `TileType` members and one
hazard character rather than adding tile behaviour, reuses the existing background-layer
storage/shift conventions instead of introducing a new layer framework, keeps the hazard
behavior registry intact (only char discovery moves to the tile meta layer), and adds no
dependency, server or untyped state.

### Requirement tensions carried into the plan (resolved, not violations)

The expanded spec raises two points that need an explicit, deterministic answer; both are
recorded in [research.md](./research.md) and [data-model.md](./data-model.md).

1. **`T` is overloaded by generation.** A legacy `T` is the falling-stalactite hazard
   (FR-015); a new `T` is the sign character (FR-025). A new-format file always supplies a
   `markers` field (a `T` sign always carries a `sign` marker), while a pre-feature file
   never does. The plan disambiguates by **file generation**: `parseLevel(layout,
   storedMarkers)` treats `storedMarkers === undefined` (no `markers` field) as a
   pre-feature layout, where `T` → `⊤` + `fallingStalactite`; when `storedMarkers` is
   present (even `[]`) `T` is a sign, with the marker's hint or `DEFAULT_HINT_ID` when the
   marker is absent (FR-027). An explicit `sign` marker at a `T` cell always wins.
2. **FR-013 vs FR-030** was resolved in the spec: FR-013 now reads "no editor tool may write
   a marker of a kind other than its own", explicitly carving out the two variant tools. The
   sign tool writes **only** its own `sign` marker (plus `T`), the falling-stalactite tool
   writes **only** its own `fallingStalactite` marker (plus `⊤`), and no other tool writes
   any marker. No plan-level reconciliation is needed.

## Project Structure

### Documentation (this feature)

```text
specs/S-030-platformer-tile-meta-layer/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── tile-meta-layer.md
│   ├── editor-tile-meta-layer.md
│   ├── storage-and-placement.md
│   └── runtime.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/themes/platformer/
├── level/
│   ├── LevelData.ts                 # EDIT: drop patrol/blueprintConnectionPoint from TileType + TILE_FOG_EXEMPT;
│   │                                #       add MarkerEntry union, MarkerGrid, MarkerPlacement, LevelDef.markers
│   ├── LevelParser.ts               # EDIT: drop P/+ from TERRAIN_CHARS and 1-6 from TileChar (T stays, as the
│   │                                #       sign char), T from HAZARD_CHARS; replace SIGN_CHARS with SIGN_CHAR='T';
│   │                                #       add LEGACY_MARKER_CHARS, parseMarkers, parseLevel(layout, storedMarkers?),
│   │                                #       marker-aware findSignTiles/findHazardTiles; extend the shared-key guard
│   ├── HintCatalog.ts               # NEW: ordered HINT_IDS, DEFAULT_HINT_ID, hintCode, nextHintId, isHintId
│   ├── HintCatalog.test.ts          # NEW
│   ├── Terrain.ts                   # EDIT: add markerAt(level, col, row)
│   ├── level.ts                     # EDIT: currentMarkers signal; currentLevel merges markers; SIGN_TILES /
│   │                                #       HAZARD_TILES read the layer; LEVEL_1_LAYOUT + LEVEL_1_MARKERS new shape
│   ├── levelRegistry.ts             # EDIT: LevelEntry.markers + forgiving validation; LEVEL_1_MARKERS wiring
│   ├── BlueprintData.ts             # EDIT: Blueprint.markers + isBlueprint validation
│   └── blueprintRegistry.ts         # EDIT: parse markers field
├── engine/
│   ├── Renderer.ts                  # EDIT: drop the patrol/blueprintConnectionPoint tileSource cases
│   └── (Physics.ts)                 # no change
├── entities/enemies/movement/
│   └── patrol.ts                    # EDIT: wallAhead reads markerAt(...)?.kind === 'patrolBoundary'
├── entities/hazards/
│   ├── index.ts                     # NO CHANGE: HAZARD_TYPES keeps fallingStalactite (behaviour registry)
│   └── FallingStalactite.ts         # NO CHANGE: consumed from marker-derived placements
├── editor/
│   ├── editorState.ts               # EDIT: marker signals + editorMarkerGridSignal; MarkerTool/EditorTool;
│   │                                #       PlacementSnapshot.markers
│   ├── editorActions.ts             # EDIT: applyMarkerPaint; shiftMarkerGrid; stamp markers;
│   │                                #       snapshot/undo/load/save/try carry markers
│   ├── paintMarkerCell.ts           # NEW: paintMarkerCell/eraseMarkerCell (never grow) + sign hint paint/cycle
│   ├── paintMarkerCell.test.ts      # NEW
│   ├── importLayout.ts              # EDIT: migrate legacy marker chars; importMarkerGrid(...)
│   ├── exportLayout.ts              # EDIT: crop to a supplied box (cropLayoutToBox) + unionBoxes
│   ├── cropLevelForExport.ts        # EDIT: box includes markers; serialize markers sparsely
│   ├── blueprintCells.ts            # EDIT: terrain cells only (markers lifted out)
│   ├── blueprintFit.ts              # (no logic change; doc note that markers are not checked)
│   ├── placeBlueprint.ts            # EDIT: blueprintMarkers + placeBlueprintMarkers
│   ├── paletteTiles.ts              # EDIT: widen sprite/label/description/glyph maps to EditorTool;
│   │                                #       marker tools + the sign/falling/decorative stalactite presentation
│   ├── Palette.tsx                  # EDIT: marker + sign + stalactite tools in Tools; connection point blueprint-only
│   ├── EditorCanvas.tsx             # EDIT: markerGrid prop + onPaintMarker; marker paint branch; draw markers,
│   │                                #       badges and the falling tint from the layer; hover tooltip; preview markers
│   ├── EditorCanvasPane.tsx         # EDIT: marker grid + onPaintMarker; placement preview includes markers
│   ├── EditorWorkspace.tsx          # EDIT: pass the active marker grid + onPaintMarker
│   ├── EditorToolbar.tsx            # EDIT: export dialog shows the complete level JSON
│   │                                #       (reuses levelFileJson), markers included (FR-033/FR-034)
│   ├── gridRenderState.ts           # EDIT: synthesizeSignPlacements/synthesizeHazardPlacements read the layer
│   ├── paintCell.ts                 # EDIT: drop the SIGN_CHARS cycle (uniform T); hazard cycle unchanged
│   ├── saveLevelFile.ts             # EDIT: markers param + conditional JSON field
│   └── saveBlueprintFile.ts         # EDIT: markers param + conditional JSON field
├── PlatformerState.ts               # no change: activeLevel spreads currentLevel, so markers flow through
└── PlatformerPage.tsx               # no change (hint text already read from currentUI.platformer.hints)

docs/themes/platformer/
├── LevelFormat.md                   # EDIT: tile meta layer + markers field, T sign char, T removed from hazards,
│                                    #       migration, P/+ removed from terrain, and an "Adding a new marker
│                                    #       kind" recipe naming every touch-point (FR-035)
└── Terrain.md                       # EDIT: drop patrol/blueprintConnectionPoint; document markerAt; T note

docs/Features.md                     # EDIT on completion: mark the S-030 node done
```

**Structure Decision**: Single-project static frontend. The feature follows the background
layer's established pattern exactly — a dense editor/runtime grid, a sparse storage shape, a
pure parser, a `*At` accessor, a `shift*Grid` growth helper and a `cropLevelForExport` that
keeps the layers aligned — rather than introducing a new layer framework. It follows the
entity/hazard `Kind` + character-map convention for the legacy migration vocabulary, and
the existing palette/`drawTileMarkers` mechanism for editor presentation. The only
structural change is removing two members from `TileType` and one hazard character, which
the renderer's exhaustive switch and the shared-key guard enforce at compile time.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |
