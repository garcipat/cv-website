# Idea: Platformer Level Editor

## Status: Design Exploration

## Summary

A hidden, dev-only in-app tool for authoring platformer level layouts by hand
via a grid UI, instead of hand-typing `readonly string[]` layout arrays
directly in files like `level1.ts`.

Explicitly out of scope for S-006 v1 (see `specs/S-006-platformer-theme/spec.md`'s
Out of Scope section: "Level editor or user-created content") — a deliberate
v2+ candidate, same as multi-level support (`docs/ideas/platformer-multi-level-support.md`).

Next feature ID if pursued: **O-002** (Optional tier — it's an authoring tool,
not a CV-facing feature).

---

## Design

### Scope decisions (confirmed)

- **Output flow**: copy/export only. The editor displays the generated
  `readonly string[]` layout (and a copy-to-clipboard button); pasting it into
  `level1.ts` (or a new level file) is a manual step. No direct file writes —
  not feasible from a deployed static site anyway.
- **Grid sizing**: resizable. Width/height are set via number inputs; growing
  pads new rows/cols with `.` (empty), shrinking truncates (confirm if it
  would discard non-empty cells).
- **Access**: hidden dev-only route, e.g. `/platformer/editor`, reachable by
  direct URL only — not linked from the public CV nav.

### Architecture

New folder: `src/themes/platformer/editor/`. Fully separate from the game
engine's `src/themes/platformer/engine/` — no shared state or imports beyond
the existing typed tile-char unions.

- Reuses `TileChar`/`TERRAIN_CHARS`/`ENTITY_CHARS` already defined in
  `LevelData.ts`/`LevelParser.ts` — the catalog of placeable things is
  generated from these, not redefined.
- Renders **real game sprites** by reusing the engine's draw functions
  directly: `drawTerrain` for terrain (takes only `LevelDef` + tileset image —
  no CV data involved at all), and `drawCollectibles`/`drawEnemies`/
  `drawBlocks` for entities. Those three only need structural placement/state
  (`x`, `y`, `spriteType`/`blockKind`, a static animation frame) — not the
  CV-content-enriched objects the real game builds via `CollectibleMapper`/
  `EnemyMapper`/`BlockMapper`. The editor synthesizes a minimal placeholder
  object (position + kind, fixed frame/`elapsedSeconds = 0`) per marker found
  via the existing `findCoinTiles`/`findFruitTiles`/`findEnemyTiles`/etc.
  helpers — no CV data needed, so no coupling to CV content. `drawPlayer` is
  reused the same way for the spawn marker. This means the editor loads the
  same sprite sheet assets the game already uses (tileset, coin/fruit,
  enemy sheets, block tileset, player sheet).
- **No `GameLoop`/`requestAnimationFrame` cycle.** The real game re-draws
  every frame to animate; the editor is a static authoring view — it redraws
  once per state change (a cell painted, pan moved, grid resized) via a plain
  effect, not a running loop. All sprites are drawn at a single fixed frame
  (no coin bob, no enemy walk-cycle, no bump/shatter animation).
- **Camera/pan is a new, separate behavior**, not a reuse of
  `engine/Camera.ts`. The game's `Camera.ts` is a 1D auto-follow
  (dead-zone-follow-the-player) function — not a free-form pan. The editor
  needs its own 2D pan state driven by right-mouse-drag, kept in its own
  module (e.g. `editor/EditorPan.ts`) so it's never confused with or
  accidentally coupled to the in-game camera.

### Components / data flow

- `LevelEditorPage.tsx` — owns state: `grid: TileChar[][]`, `selectedTool:
  TileChar`, `panOffset: {x, y}`.
- `Palette.tsx` — one button per terrain char, per entity char, plus an
  explicit **Eraser** button mapped to `.` (empty). Clicking sets
  `selectedTool`; the active tool is highlighted.
- `EditorCanvas.tsx` — a `<canvas>` sized to viewport, drawn offset by
  `panOffset`. Left-click (and left-drag, to paint a run of cells) writes
  `selectedTool` into the cell under the cursor, overwriting whatever was
  there. Right-mouse-drag updates `panOffset` (with `contextmenu` prevented).
- `exportLayout.ts` — pure function `exportLayout(grid): readonly string[]`
  joining each row's chars into a string, matching the exact shape
  `parseLevel` already expects.

### Testing (per constitution: 100% `lib`, 80%+ components)

- Pure-function unit tests: grid resize, paint-cell, `exportLayout`.
- Component tests: `Palette` tool selection; `EditorCanvas` click-paints,
  drag-paints a run, right-drag pans, overwrite behavior (RTL + simulated
  mouse events).

### Explicitly out of scope (YAGNI)

Zoom, undo/redo, `localStorage` persistence, direct file writes, multi-level
project management. Any of these could become their own future idea/spec if
ever needed.

---

## Open Questions

- Confirm O-002 is the right feature ID/tier once this is picked up for real
  (check `docs/Features.md` hasn't gained a nearer-numbered Optional item by
  then).
- Should the palette also expose a distinct "spawn" placement guard (only one
  `S` allowed on the grid at a time), or is silent overwrite-on-place enough
  given `findSpawnTile` presumably expects exactly one?

---

## Next Step

Brainstorm properly (architectural — new subsystem, no existing flow to
extend) when picked up for implementation: confirm the feature ID/tier, write
the formal spec under `specs/O-002-platformer-level-editor/spec.md`, then hand
off to the writing-plans skill.
