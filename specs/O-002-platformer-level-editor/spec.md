# Feature Specification: Platformer Level Editor

**Feature Branch**: `O-002-platformer-level-editor`
**Created**: 2026-08-31
**Status**: Draft
**Parent Feature**: S-006 (2D Platformer Theme)
**Input**: A hidden, dev-only in-app tool for authoring platformer level layouts by hand via a grid UI, instead of hand-typing `readonly string[]` layout arrays directly in files like `level1.ts`. Originates from an earlier design-exploration idea doc (out of scope for S-006 v1), since superseded by this spec.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Author a Layout by Painting Tiles (Priority: P1)

A developer navigates directly to `/platformer/editor` (not linked from the public CV nav). The grid loads pre-populated with `level1.ts`'s real layout (see User Story 1a). They select a terrain tool (e.g. "Ground Grass") from the palette and click-drag across a run of cells to paint them. They select an entity tool (e.g. "Coin") and click individual cells to place markers. Every click (or drag) overwrites whatever was in that cell before, with no confirmation — painting is cheap and reversible by painting over again.

**Why this priority**: This is the core authoring loop. Without paint-to-place, there is no editor.

**Independent Test**: Load `/platformer/editor`. Select a terrain tool, drag across 5 cells, verify all 5 show that terrain's real sprite. Select an entity tool, click a cell, verify the marker's real sprite appears. Click a painted cell with a different tool selected, verify it's overwritten.

**Acceptance Scenarios**:

1. **Given** the editor is freshly loaded (grid pre-populated from `level1.ts`), **When** the developer selects a terrain tool and left-clicks a cell, **Then** that cell's tile updates to the selected terrain and re-renders with the real game sprite.
2. **Given** a terrain tool is selected, **When** the developer left-click-drags across multiple cells, **Then** every cell the cursor passes over is painted with that terrain (a run, not just the start/end cells).
3. **Given** a cell already holds a tile or entity marker, **When** the developer paints over it with a different tool, **Then** the previous value is silently overwritten — no warning, no confirmation.
4. **Given** the Eraser tool is selected, **When** the developer paints a cell, **Then** the cell becomes `.` (empty).

---

### User Story 1a - Editor Loads Pre-Populated with `level1`'s Real Layout (Priority: P1)

The editor's initial `grid` state is a one-time, in-memory copy of `LEVEL_1_LAYOUT` (`src/themes/platformer/level/level1.ts`), taken at load — not a live link back to that file. There is no read-back or file-watching after load, and (per the Output Flow decision) no write-back ever: the only way `level1.ts` itself changes is the developer manually pasting the exported text into it later. At the moment of load, though, the copy is exact: the grid's width/height, every terrain tile, and every entity marker match `level1.ts` as it stood when the page loaded.

**Why this priority**: The editor's primary use case is refining an existing, playable level. P1 because User Story 1's "editor is loaded" precondition depends on this.

**Independent Test**: Load `/platformer/editor` with no prior interaction. Export immediately (no edits made). Verify the exported `readonly string[]` matches `LEVEL_1_LAYOUT` — right-padded to a rectangle exactly the way `parseLevel` does, then cropped to its own tightest non-`.` bounding box (see the Export cropping decision). `LEVEL_1_LAYOUT`'s only all-`.` row currently sits between two content rows, so nothing is actually cropped away today; every actual tile is present and unchanged regardless.

**Acceptance Scenarios**:

1. **Given** the editor has just loaded, **When** the grid renders for the first time, **Then** its dimensions equal `LEVEL_1_LAYOUT`'s width/height and every cell's value equals the corresponding character in `LEVEL_1_LAYOUT` — the grid itself is an exact copy; only export crops it (see below).
2. **Given** the editor has just loaded, **When** the developer exports without making any edits, **Then** the exported layout equals `LEVEL_1_LAYOUT` cropped to its tightest non-`.` bounding box — export's content-cropping applies the same way here as to any other grid state; a leading/trailing all-`.` row or column already present in the loaded data is cropped away just as it would be after painting and erasing produced the same shape. This is not a special case for the unedited state.
3. **Given** the editor has just loaded, **When** the grid re-renders, **Then** every terrain tile and entity marker from `level1.ts` (ground, walls, bridges, spawn, both enemy colors, coins, crates, question-marks, fragile rocks, chests) is visible with its real sprite — this is the same rendering path as any other painted cell (see User Story 2), just pre-populated instead of freshly painted.

---

### User Story 2 - See Real Game Sprites While Authoring (Priority: P1)

While painting, the developer sees the actual sprites the real game uses — the same tileset, coin/fruit sheet, enemy sheets, block tileset, chest sheets, and player sheet — not placeholder colored boxes. This lets them judge visual composition (does this coin sit at a jumpable height? does this enemy patrol area look right?) without switching to the real game to check.

**Why this priority**: Accurate visual feedback is the entire value proposition over hand-typing a layout array blind. P1 because a low-fidelity placeholder-box editor would not meaningfully improve on the status quo.

**Independent Test**: Place one of each entity type (spawn, both enemy colors, coin, fruit-producing question-mark block is not directly placeable — see Assumptions —, crate, question-mark, fragile rock, chest) and each terrain type. Verify each renders with its real sprite rather than a generic shape, and that the frame shown matches the game's static/idle frame (no animation).

**Acceptance Scenarios**:

1. **Given** a terrain cell is painted, **When** the grid re-renders, **Then** it draws via the engine's `drawTerrain` using the real tileset image, identical tile selection logic to the game.
2. **Given** a coin or fruit marker is placed, **When** the grid re-renders, **Then** it draws via `drawCollectibles` using the real coin/fruit sprite sheets, at a fixed frame (no bob, no frame cycling).
3. **Given** a green or purple enemy marker is placed, **When** the grid re-renders, **Then** it draws via `drawEnemies` using the real slime sprite sheets, at a fixed idle frame (no walk-cycle, no facing changes from patrol).
4. **Given** a crate, question-mark, or fragile-rock marker is placed, **When** the grid re-renders, **Then** it draws via `drawBlocks` using the real block tileset, in its intact (never-hit) frame.
5. **Given** a chest marker is placed, **When** the grid re-renders, **Then** it draws via `drawChests` using the real chest-closed sprite (chests always start closed — matches `toChestState`'s default).
6. **Given** the spawn marker is placed, **When** the grid re-renders, **Then** it draws via `drawPlayer` using the real player sprite sheet, in a fixed idle frame facing right.
7. **Given** any sprite sheet has not finished loading, **When** the grid renders, **Then** that layer is skipped for the frame (matches the engine's existing null-sprite tolerance) rather than the whole canvas failing to render.

---

### User Story 3 - Exactly One Spawn Point Always Exists (Priority: P1)

The developer places a spawn marker (`S`). Later, they decide to move it and click a different cell with the Spawn tool selected. The old spawn cell is automatically cleared back to empty as part of that same click — there is never a moment with two spawn markers on the grid, and the developer never sees a warning or blocking dialog about it.

**Why this priority**: `findSpawnTile` (the real parser) silently uses only the first `S` in reading order and never errors on extras — an editor that let two coexist would let a developer export a layout whose second spawn is silently dead weight, an easy-to-miss authoring mistake. P1 because this is a correctness guarantee about the exported output, not a nice-to-have.

**Independent Test**: Place `S` at cell A. Place `S` at cell B (different cell) via the same tool. Verify cell A is now `.` and cell B is `S` — exactly one `S` exists on the grid at all times.

**Acceptance Scenarios**:

1. **Given** no spawn marker exists yet, **When** the developer places one, **Then** it's placed normally (nothing to clear).
2. **Given** a spawn marker exists at cell A, **When** the developer places a new spawn marker at cell B, **Then** cell A reverts to `.` and cell B becomes `S`, in the same paint action.
3. **Given** a spawn marker exists at cell A, **When** the developer re-paints cell A itself with the Spawn tool, **Then** nothing changes (no-op, still exactly one spawn).

---

### User Story 4 - Grid Grows Seamlessly in Any Direction as You Paint (Priority: P1)

The grid has no fixed size and no manual resize control. If the developer paints a cell above, below, left of, or right of the current grid bounds, the grid silently grows just enough to include that cell — padded with `.` everywhere else new. Panning never reveals a hard edge or blank/undefined area beyond stored content: the visible viewport always looks like grid, whether or not that region has been painted yet. Growing left or up never visually shifts already-painted content — the view compensates so everything stays exactly where it was on screen.

**Why this priority**: Real levels are authored incrementally in every direction (a jump puzzle built upward from the ground, a level extended rightward) — a fixed-size grid with a manual resize step would interrupt that flow on every boundary crossing. P1 because User Story 1's painting loop depends on never hitting an edge.

**Independent Test**: Paint a cell, then paint another cell one row above the current top-most row. Verify the grid now includes that row, the original cell's on-screen position hasn't moved, and the new cell is at the top. Repeat for left, right, and below.

**Acceptance Scenarios**:

1. **Given** a cell is painted at the grid's current right edge, **When** the developer paints one column further right, **Then** the grid grows by one column (padded with `.`) and all existing content stays at its original row/column indices.
2. **Given** a cell is painted at the grid's current bottom edge, **When** the developer paints one row further down, **Then** the grid grows by one row (padded with `.`) and all existing content stays at its original row/column indices.
3. **Given** a cell is painted at the grid's current left edge, **When** the developer paints one column further left, **Then** the grid grows by one column on the left, every existing cell's column index shifts up by one to make room, and the view compensates so those cells' on-screen positions are unchanged.
4. **Given** a cell is painted at the grid's current top edge, **When** the developer paints one row further up, **Then** the grid grows by one row on top, every existing cell's row index shifts up by one to make room, and the view compensates so those cells' on-screen positions are unchanged.
5. **Given** the developer pans to a region beyond any painted content, **When** the canvas renders, **Then** that region is drawn as empty grid (not blank/undefined canvas space) — panning never shows an edge.

---

### User Story 5 - Pan a Grid Larger Than the Viewport (Priority: P2)

For a grid too large to fit the visible canvas, the developer holds the middle mouse button and drags to pan the view. This is a free-form 2D pan local to the editor — unrelated to the game's in-game auto-follow camera.

**Why this priority**: Real levels (e.g. `level1.ts` is 80+ columns wide) exceed any reasonable viewport. P2 because P1-P3 are testable on a small grid that fits without panning.

**Independent Test**: Using the `level1`-loaded grid (already wider than a typical viewport), middle-click-drag left/right, verify the visible window of cells shifts accordingly. Verify the browser's context menu does not appear on right-click (right-click is reserved for erasing, see User Story 1b).

**Acceptance Scenarios**:

1. **Given** the grid's content extends beyond the canvas viewport, **When** the developer middle-click-drags, **Then** the rendered offset (`panOffset`) updates to follow the drag, and the canvas redraws at the new offset.
2. **Given** the developer right-clicks the canvas at any point, **When** the browser would normally show a context menu, **Then** it is suppressed (`contextmenu` prevented) — right-click is reserved for erasing.
3. **Given** panning is active, **When** the developer releases the middle mouse button, **Then** panning stops and the view stays at its last offset.

---

### User Story 1b - Erase with a Right-Click, Regardless of the Selected Tool (Priority: P1)

Right-clicking a cell (or right-click-dragging across several) erases it — sets it to `.` — no matter which palette tool is currently selected. The developer doesn't need to switch to the Eraser tile first; erasing is always one right-click away, matching the left-click-paints/right-click-erases convention common to tile-map editors (Tiled, Terraria-likes).

**Why this priority**: Constantly switching the selected tool back and forth between "the thing I'm placing" and Eraser just to fix a mistake is friction in the tool's core loop — the same loop User Story 1 depends on. P1 for the same reason as User Story 1.

**Independent Test**: With any terrain or entity tool selected (not Eraser), right-click a painted cell. Verify it becomes `.` and the selected tool is unchanged. Right-click-drag across several cells, verify all of them are erased.

**Acceptance Scenarios**:

1. **Given** any tool other than Eraser is selected, **When** the developer right-clicks a cell, **Then** that cell becomes `.`, and `selectedTool` itself does not change.
2. **Given** the developer right-click-drags across multiple cells, **Then** every cell the cursor passes over is erased (a run, matching left-click-drag's paint-a-run behavior).
3. **Given** a right-click targets a cell outside the current grid bounds, **Then** the grid grows to include it exactly as a left-click paint would (via `growGrid`), and the newly-included cell is erased (a no-op in practice, since a freshly-grown cell is already `.`).

---

### User Story 6 - Export the Layout for Pasting into a Level File (Priority: P1)

The developer clicks "Copy Layout". The grid's current state is serialized into the exact `readonly string[]` shape `parseLevel` expects (one string per row, one character per column) and shown in a read-only text area, with a copy-to-clipboard button. The developer manually pastes this into `level1.ts` (or a new level file) — the editor never writes to any file.

**Why this priority**: This is the actual deliverable of every editing session — without export, nothing produced in the editor leaves it. P1.

**Independent Test**: Paint a small known grid, click Copy Layout, verify the displayed string array exactly matches the grid (row order top-to-bottom, char-for-char), and that it round-trips through `parseLevel` without throwing.

**Acceptance Scenarios**:

1. **Given** a painted grid, **When** the developer clicks "Copy Layout" (or it's always visible), **Then** a `readonly string[]` is displayed, one string per grid row, top row first, each string's characters matching the grid's columns left-to-right.
2. **Given** the exported layout, **When** it is passed to the real `parseLevel` function, **Then** it parses successfully with no thrown errors (equal row lengths, all characters recognized).
3. **Given** the developer clicks the copy-to-clipboard button, **Then** the exact displayed text is placed on the system clipboard.

---

### User Story 7 - Choose Which Level to Edit (Priority: P2)

The developer opens a level dropdown in the editor sidebar and picks the level they want to
work on. The list always holds two built-in entries - `main` (the shipped `LEVEL_1_LAYOUT`)
and `empty` (`SCRATCH_LAYOUT`: three ground tiles with the spawn on the middle one) - plus one
entry per JSON level file present in `src/themes/platformer/level/levels/`. Picking an entry
replaces the grid with that level's layout and recenters the view on its spawn tile. There is
no separate Reset or Scratch control: "put back what ships" is picking `main` again, and "give
me an empty page" is picking `empty`.

Because loading discards whatever is currently on the grid, the dropdown guards the edits it
would throw away. The editor tracks a single "edited since loaded or saved" flag, set by any
paint or erase and cleared on load and save. While it is clear, picking a level loads it
immediately with no interruption. While it is set, a confirmation dialog names both levels -
the one whose edits are at stake and the one about to load - and loads only on explicit
confirmation.

**Why this priority**: Painting (User Story 1) and export (User Story 6) are what the editor
is for; choosing among several layouts makes it usable for more than one level at a time but
is not required for either. P2.

**Independent Test**: Open the editor, pick `empty` from the dropdown, verify the grid becomes
three ground tiles with a centered spawn. Paint one cell, pick `main`, verify the confirmation
dialog appears naming both levels; cancel it and verify the painted cell is still there;
reopen, confirm, and verify the grid matches `LEVEL_1_LAYOUT`.

**Acceptance Scenarios**:

1. **Given** the editor is loaded, **When** the developer opens the level dropdown, **Then** it
   lists `main`, `empty`, and one entry per valid JSON file in `levels/`.
2. **Given** nothing has been painted since the grid was loaded or saved, **When** the developer
   picks a different level, **Then** the grid is replaced with that level's layout, the view
   recenters on its spawn tile, and no confirmation dialog appears.
3. **Given** the grid has been painted since it was loaded or saved, **When** the developer picks
   a different level, **Then** a confirmation dialog naming the current and target level appears
   and the grid is left untouched until it is confirmed.
3a. **Given** the grid has been painted, **When** the developer picks the level that is already
   loaded, **Then** it reloads (after confirmation) rather than being ignored as a no-op - this
   is how the editor spells "reset".
4. **Given** that confirmation dialog is open, **When** the developer cancels it, **Then** the
   grid, the selected tool, and the persisted copy of the grid are all unchanged, and the edited
   flag stays set so the next selection confirms again.
5. **Given** a JSON file in `levels/` is malformed (not an object, missing `layout`, or a
   `layout` that is not an array of strings), **When** the editor loads, **Then** that file is
   skipped and every other entry - built-in and custom - still appears in the dropdown.

---

### User Story 8 - Save the Current Level as a JSON Level File (Priority: P2)

The developer clicks Save, types a name for the level, and the file lands in
`src/themes/platformer/level/levels/` - the folder the level dropdown reads (User Story 7) - so
it needs no moving afterwards. Reloading the editor shows it in the list.

The write is done by the dev server, not the page: the editor POSTs the file to a route a
dev-only Vite plugin serves, and that plugin writes it. Nothing about this reaches a built site,
where the route does not exist; there, and anywhere else the endpoint is unreachable, Save falls
back to downloading the file for the developer to move in by hand.

A successful write closes the dialog and leaves the path it wrote in the sidebar - there is
nothing further to do with it. A fallback download keeps the dialog open instead, because the
file then still has to be moved, and that is worth saying before the dialog is dismissed. Either
way the developer is told which of the two happened, so a download is never mistaken for a file
that landed in the repository.

**Why this priority**: Without saving, every level but the two built-ins has to be round-tripped
by hand through the export text area and a hand-written file. Saving makes the dropdown's custom
entries reachable from inside the editor, but export (User Story 6) remains the path that gets a
layout into `level.ts` itself. P2.

**Independent Test**: With the dev server running, paint a known small grid, click Save, enter a
name with spaces and mixed case, and verify a file appears at
`src/themes/platformer/level/levels/<slug>.json` whose contents parse to `{ name, layout }` with
`layout` equal to `exportLayout(grid)`. Reload the editor and verify the level is in the
dropdown. Then repeat with the endpoint unreachable and verify the same file is downloaded
instead, and that the dialog says so.

**Acceptance Scenarios**:

1. **Given** a painted grid, **When** the developer saves it under a name, **Then** the file is
   valid JSON of the shape `{ "name": string, "layout": string[] }` whose `layout` equals
   `exportLayout(grid)`.
2. **Given** a name with spaces, uppercase letters, or punctuation, **When** the file is
   produced, **Then** its filename is that name slugified (lowercased, non-alphanumerics
   collapsed to single hyphens, leading/trailing hyphens trimmed) plus `.json`.
3. **Given** the dev server is running, **When** the developer saves, **Then** the file is
   written into `src/themes/platformer/level/levels/`, the dialog closes, and the path it wrote
   is shown in the sidebar.
3a. **Given** the endpoint is unreachable or refuses the write, **When** the developer saves,
   **Then** the file is downloaded instead and the dialog stays open saying so, naming both the
   folder to move it into and (when the server gave one) the reason it declined.
3c. **Given** a level was saved, **When** the developer paints again or loads another level,
   **Then** the sidebar's saved-path line disappears, because the file on disk no longer matches
   what is on screen.
3b. **Given** a request naming anything but a bare slugified `.json` file, or carrying contents
   the level registry would not accept, **When** the dev server handles it, **Then** it writes
   nothing and answers with an error.
4. **Given** the developer saves the current grid, **Then** the edited flag is cleared and the
   saved name becomes the open level's name, so picking another level immediately afterward
   does not warn about discarding edits.

---

## Edge Cases

- **Grid with no spawn marker at all**: Since the grid initializes from `LEVEL_1_LAYOUT` (which has exactly one `S`), this only occurs if the developer erases the spawn cell without placing a new one. The editor does not require a spawn to exist before allowing export — enforcing that would need extra validation UI out of scope for v1 (see Out of Scope). The developer is responsible for placing one before using the exported layout in the real game (`findSpawnTile` throws if it's missing).
- **`level1.ts` itself changes shape or is renamed**: `LEVEL_1_LAYOUT` is imported directly, so if its export name or file path changes, the editor's initialization fails at compile time (a `TileChar[][]` mismatch or import error), not silently at runtime.
- **Painting the same cell repeatedly with the same tool**: No-op after the first paint — idempotent, no state churn.
- **Painting far outside current bounds in one action (e.g. dragging a run that starts in-bounds and ends 20 columns further right)**: `growGrid` runs once per cell painted along the drag, so the array grows incrementally, cell by cell, exactly as it would from separate individual clicks — no special-casing for "a drag that crosses a boundary."
- **Painting simultaneously beyond two edges (e.g. one row above the current top-most row AND one column left of the current left-most column, in a single click on a corner cell)**: `growGrid` grows both dimensions in the same call; `colShift` and `rowShift` are both non-zero and both get applied to `panOffset` together.
- **Panning to a region with no painted content, in any direction**: The canvas still renders a full grid of empty (`.`) cells there (FR-021) — panning never shows blank/undefined space, and never itself triggers array growth (only painting does).
- **Erasing the only non-`.` cell at the grid's current outer edge**: The stored array keeps its size (no auto-shrink), but the next export crops to whatever the new tightest bounding box is — the exported layout shrinks even though the in-memory array didn't.
- **Erasing every cell back to entirely empty**: `exportLayout` has no bounding box to crop to and returns `['.']` (FR-022) rather than throwing or returning an empty array.
- **A sprite sheet fails to load (404, network error)**: That layer's `HTMLImageElement` ref stays unset; draw calls for that layer are skipped for every frame (same tolerance as the real game's null-sprite handling) — the rest of the grid still renders.
- **Very large stored arrays (e.g. after painting far in every direction)**: No enforced maximum in v1; performance beyond typical level sizes (`level1.ts` is ~80 columns) is not a v1 concern (see Out of Scope: no virtualization) — this is a dev tool operated at human click speed, not a hot loop.

---

## Requirements _(mandatory)_

### Design Decisions

#### Output Flow: Copy/Export, Plus a Dev-Server Write

Getting a layout into `level.ts` is still copy/paste: the editor displays the generated `readonly string[]` with a copy-to-clipboard button, and pasting it in is a manual step.

Saving a level as its own JSON file is not. The page itself writes nothing — it POSTs to a route served by a dev-only Vite plugin (`apply: 'serve'`), and the dev server does the write, into the one folder the level registry reads. This keeps the deployed site exactly as static as before (the route is absent from every build, and Save there falls back to a download), while removing the "now go move the file" step from the only environment the editor is ever used in. See FR-032/FR-033.

#### Access: Hidden Dev-Only Route (Plain Pathname Check, No Router)

This app has no URL router — theme switching is entirely a `currentTheme` signal lookup (`App.tsx`, `src/state/theme.ts`), with the existing Platformer theme itself gated by the `platformerPrototypeUnlocked` signal rather than any URL. Adding a routing library (react-router or similar) solely to gate one hidden dev-only page would be a new dependency with no other use in the app, against the constitution's "no dependency added without justification" and bundle-size budget (Principle V).

Instead, `App.tsx` gets a single additional check ahead of its existing `themePages[currentTheme.value]` lookup: if `window.location.pathname === '/platformer/editor'`, render `LevelEditorPage` directly, bypassing the theme signal entirely. This is checked once (not reactive to in-app navigation, since nothing in this app changes `pathname` after load) and gives the same "reachable only by direct URL, invisible in any nav" property the idea doc called for, with no new dependency and no interaction with `currentTheme`/`platformerPrototypeUnlocked`.

#### Architecture: Fully Separate from the Game Engine

New folder: `src/themes/platformer/editor/`. No shared state or imports with `src/themes/platformer/engine/` beyond the existing typed tile-char catalog and the pure `draw*` functions themselves (which take no CV data and have no side effects beyond drawing to the passed canvas context).

#### Sprite Reuse via Real Draw Functions

The editor imports and calls the engine's existing draw functions directly — `drawTerrain`, `drawPlayer`, `drawCollectibles`, `drawEnemies`, `drawBlocks`, `drawChests` — rather than reimplementing rendering. Each call is fed a minimal synthesized placeholder object (position + kind + fixed animation/frame fields), not the CV-content-enriched objects the real game builds via `CollectibleMapper`/`EnemyMapper`/`BlockMapper`/`ChestMapper`. Placeholder objects requiring a `fact: CollectedFact` field (collectibles, enemies, chests) use a fixed dummy stub — the draw functions never read `fact`, only position/kind/animation fields.

#### No Game Loop

The editor is a static authoring view: it redraws once per state change (a cell painted, pan moved, grid grown) via a plain effect — not a running `requestAnimationFrame` loop. All sprites are drawn at a single fixed frame: no coin bob, no enemy walk-cycle, no block bump/shatter, no chest-opening animation.

#### Camera/Pan is New, Separate Code

The editor's 2D free-form pan (`editor/EditorPan.ts`) is unrelated to the game's `engine/Camera.ts` (a 1D auto-follow-the-player behavior) — no shared code, no risk of accidental coupling.

#### Shared `TileChar` Type (Hardcoded Literal Union)

`TERRAIN_CHARS`/`ENTITY_CHARS` are declared as `Record<string, TileType | undefined>` / `Record<string, EntityKind | undefined>` — a wide annotation `parseLevel`'s and `findAllOfKind`'s existing `TERRAIN_CHARS[char]`/`ENTITY_CHARS[char]` lookups depend on (`char` is a plain `string` there). Because of that annotation, `keyof typeof TERRAIN_CHARS` evaluates to plain `string`, not the literal `'.' | 'G' | 'R' | ...` union — so a `TileChar` type naively derived via `keyof typeof` would silently collapse to `string`, defeating the entire point of a typed grid.

Instead, `LevelParser.ts` gains an explicit, hardcoded literal union:
```typescript
export type TileChar = '.' | 'G' | 'R' | 'W' | 'B' | 'S' | 'E' | 'M' | 'C' | 'X' | 'Q' | 'F' | 'T';
```
placed immediately after the `sharedChars` overlap guard, plus a small runtime test (not shipped code — a test-only assertion) that every key of `TERRAIN_CHARS` and `ENTITY_CHARS` appears in `TileChar`'s member list, so the two can't silently drift apart. This keeps `parseLevel`/`findAllOfKind`'s existing, tested string-indexed lookups completely untouched — no changes to working engine code beyond this one type addition.

#### Spawn Uniqueness via Auto-Relocate

Placing a new `S` marker clears whichever cell previously held `S` (sets it to `.`) as part of the same paint action — never a blocking guard, never a warning dialog. Exactly one spawn exists at all times once one has been placed. This is implemented as special-case logic in the paint handler (not a generic "unique markers" system — spawn is the only entity kind with a uniqueness constraint in v1).

#### Chest Support Included in v1

Chests (`T` marker) are a palette option like any other entity marker. The editor reuses `drawChests`/`ChestState`/`toChestState`-style placeholder construction alongside the terrain/collectible/enemy/block draw calls — chests always render in their closed sprite (`toChestState`'s default), matching a freshly-placed, never-opened chest.

#### Seamless Unbounded Growth, Cropped on Export

The grid has no fixed size and no manual resize UI. `grid: TileChar[][]` stays a plain dense 2D array (per the chosen data-structure tradeoff below), and a pure function `growGrid(grid: TileChar[][], col: number, row: number): { grid: TileChar[][]; colShift: number; rowShift: number }` runs before every paint: if `(col, row)` already falls within the current array's bounds, it returns the grid unchanged with `colShift`/`rowShift` both `0`. Otherwise it grows the array just enough to include `(col, row)`:

- Growing **right** (`col >= width`) or **down** (`row >= height`): append `.`-filled columns/rows at the end. No existing index changes; `colShift`/`rowShift` stay `0`.
- Growing **left** (`col < 0`) or **up** (`row < 0`): prepend `.`-filled columns/rows at the start. Every existing cell's column/row index increases by the number of columns/rows prepended — `colShift`/`rowShift` report exactly that amount. Since a cell at index `i` draws at screen position `i * RENDERED_TILE_SIZE + panOffset.x`, an index increase of `colShift` would push existing content `colShift * RENDERED_TILE_SIZE` pixels to the right unless compensated — so the paint handler **subtracts** `colShift * RENDERED_TILE_SIZE` / `rowShift * RENDERED_TILE_SIZE` from the current `panOffset` in the same state update, exactly canceling the index shift so already-painted content's on-screen position doesn't jump. The caller also remaps the target cell's own coordinates by the same shift before writing into the now-larger array.

**Why a dense array that gets copied on every boundary-crossing paint, instead of a sparse structure**: this is a dev-only tool operated by a single human clicking at human speed, never a hot loop — an occasional O(width×height) array copy on the rare paint that crosses a boundary is imperceptible, and a plain `TileChar[][]` is simpler to read, test, and feed directly into `drawTerrain`'s `LevelDef` than a sparse map would be.

**Export crops to content, independent of stored array size**: the stored array only ever grows, never auto-shrinks (erasing an edge cell doesn't shrink it). `exportLayout` (see Export, below) computes the tightest bounding box containing every non-`.` cell at export time and crops to that — so the exported layout's size always reflects "the most outer tiles actually placed," never leftover empty padding from earlier growth or from cells since erased.

**Panning always shows grid, not blank space**: `EditorCanvas` renders every visible on-screen cell — including coordinates outside the current array's stored bounds — as an empty (`.`) cell. Panning to unpainted territory never reveals undefined/blank canvas; the array itself only grows when a paint actually targets a cell outside its bounds, not merely from panning past it.

#### Initial State: Loads `level1`'s Real Layout

On mount, `LevelEditorPage` calls a new pure function `importLayout(layout: readonly string[]): TileChar[][]` (the inverse of `exportLayout`) with `LEVEL_1_LAYOUT` imported directly from `level1.ts`, and uses its result as the initial `grid` state. `importLayout` does no validation beyond what `TileChar` already guarantees at the type level for its own hardcoded input — it is a plain per-character mapping, not a re-implementation of `parseLevel`'s row-length/unknown-character runtime checks (those checks are unnecessary for data that is already a known-valid, statically-imported constant). There is no generic "import any layout" UI in v1 — see Out of Scope.

### Functional Requirements

#### Routing & Access

- **FR-001**: System MUST render `LevelEditorPage` when `window.location.pathname === '/platformer/editor'`, checked in `App.tsx` ahead of the existing `themePages[currentTheme.value]` lookup — no routing library, no interaction with `currentTheme`/`platformerPrototypeUnlocked`. The path MUST NOT appear in any public navigation menu or link.

#### Grid State & Painting

- **FR-002**: System MUST maintain grid state as `grid: TileChar[][]`, initialized on mount from `LEVEL_1_LAYOUT` (`src/themes/platformer/level/level1.ts`) via a pure `importLayout(layout: readonly string[]): TileChar[][]` function — one grid cell per character, at `LEVEL_1_LAYOUT`'s own width/height.
- **FR-003**: System MUST support a `selectedTool: TileChar` state, set by clicking a palette button, with the active tool visually highlighted.
- **FR-004**: System MUST paint `selectedTool` into the grid cell under the cursor on left-click, overwriting any existing value, with no confirmation.
- **FR-005**: System MUST support left-click-drag to paint a continuous run of cells along the cursor's path with `selectedTool`, not merely the start and end cells.
- **FR-004a**: System MUST erase (write `.`) into the grid cell under the cursor on right-click, regardless of `selectedTool` — `selectedTool` itself MUST NOT change as a result. System MUST support right-click-drag to erase a continuous run of cells the same way FR-005 does for left-click-drag painting.
- **FR-006**: System MUST special-case placement of the `S` (spawn) tool: before writing `S` into the target cell, if any other cell in the grid currently holds `S`, that cell MUST be reset to `.` in the same paint action.
- **FR-007**: System MUST provide an explicit Eraser tool (mapped to `.`) as a palette button distinct from the terrain/entity tools.

#### Palette

- **FR-008**: System MUST generate the palette's terrain buttons from `TERRAIN_CHARS` and entity buttons from `ENTITY_CHARS` (imported from `LevelParser.ts`) — the catalog of placeable things is derived, not redefined or hand-duplicated in the editor.
- **FR-009**: System MUST include a palette entry for every key in `TERRAIN_CHARS` and `ENTITY_CHARS`, including the chest (`T`) marker.

#### Rendering

- **FR-010**: System MUST render the grid on a `<canvas>` using `RENDERED_TILE_SIZE` (32px) per cell, matching the real game's tile scale.
- **FR-011**: System MUST render terrain cells by calling the engine's `drawTerrain(ctx, levelDef, tilesetImage, originX, originY)` — constructing a minimal `LevelDef` from the current grid's terrain (via the same character-to-`TileType` mapping `parseLevel` uses) — not a reimplementation of tile-selection logic.
- **FR-012**: System MUST render entity markers by synthesizing minimal placeholder state objects (position + kind + fixed frame/timer fields at their "at rest" values — see Design Decisions) from grid marker positions, then calling the corresponding engine draw function: `drawPlayer` (spawn), `drawCollectibles` (coin/fruit), `drawEnemies` (green/purple), `drawBlocks` (crate/questionMark/fragileRock), `drawChests` (chest).
- **FR-013**: System MUST load the same sprite sheet image assets the real game loads (`/sprites/world_tileset.png`, `/sprites/knight.png`, `/sprites/coin.png`, `/sprites/fruit.png`, `/sprites/slime_green.png`, `/sprites/slime_purple.png`, `/sprites/crack_overlay.png`, `/sprites/chest_closed.png`) via the engine's existing `loadImage` loader.
- **FR-014**: System MUST redraw the canvas only in response to a state change (paint, pan, grid growth) via a plain effect — MUST NOT run a `requestAnimationFrame` loop.
- **FR-015**: System MUST tolerate any sprite image not yet loaded (or failed to load) by skipping that layer's draw call for the frame, matching the engine draw functions' existing null-sprite tolerance, rather than throwing or blocking the rest of the render.

#### Panning

- **FR-016**: System MUST implement a 2D pan state (`panOffset: {x, y}`) in a new, editor-only module (`editor/EditorPan.ts`), updated by middle-mouse-button drag, with `contextmenu` prevented on the canvas at all times (not just during a drag — right-click is reserved for erasing, see FR-004a).
- **FR-017**: System MUST offset every draw call's `originX`/`originY` by the current `panOffset` so panning shifts the visible window without mutating grid data.

#### Seamless Growth

- **FR-018**: System MUST provide a pure function `growGrid(grid: TileChar[][], col: number, row: number): { grid: TileChar[][]; colShift: number; rowShift: number }` that returns a grid guaranteed to have `(col, row)` as a valid index — appending `.`-filled rows/columns at whichever edge(s) `(col, row)` falls beyond, or returning the input grid unchanged (with `colShift`/`rowShift` both `0`) if `(col, row)` is already in bounds.
- **FR-019**: System MUST call `growGrid` before every paint action (single click, or each cell along a drag), using its `colShift`/`rowShift` to remap the target cell's coordinates into the (possibly grown) grid before writing `selectedTool` into it.
- **FR-020**: System MUST subtract `colShift * RENDERED_TILE_SIZE` from `panOffset.x` and `rowShift * RENDERED_TILE_SIZE` from `panOffset.y` in the same state update whenever `growGrid` returns a non-zero shift (a cell at index `i` draws at `i * RENDERED_TILE_SIZE + panOffset.x`, so subtracting exactly cancels the index increase), so that content prepended to the left/top of the array never visually moves already-painted cells on screen.
- **FR-021**: System MUST render every visible on-screen grid cell, including coordinates outside the current array's stored bounds, so panning to unpainted territory always displays empty (`.`) grid rather than blank/undefined canvas space.

#### Export

- **FR-022**: System MUST provide a pure function `exportLayout(grid: TileChar[][]): readonly string[]` that first crops `grid` to the tightest bounding box containing every non-`.` cell, then joins each row of that cropped region's characters into one string per row, in the exact shape `parseLevel` expects (equal-length rows, top row first). If no non-`.` cell exists, it returns `['.']`.
- **FR-023**: System MUST display the current export output in a read-only text area, updated live as the grid changes (or on demand — implementation's choice of live vs. on-click is not constrained further), plus a button that copies the exact displayed text to the clipboard.
- **FR-023a**: System MUST reload the grid from a chosen level's layout (discarding all in-progress edits) and recenter the view on that layout's spawn tile, gated behind a confirmation prompt whenever the grid differs from the level it was loaded from — unlike every other action in the editor (which never confirms), loading a level discards the entire session's work in one click, not just one cell. Reloading the shipped layout is picking the `main` entry; clearing to a bare starting grid is picking the `empty` entry (see FR-026).

#### Level Selection & Saving

- **FR-026**: System MUST expose a level registry listing, in order, a built-in `main` entry (`LEVEL_1_LAYOUT`), a built-in `empty` entry (`SCRATCH_LAYOUT`), and one entry per JSON file in `src/themes/platformer/level/levels/`, discovered at build time via `import.meta.glob`. Each entry MUST carry an `id` (the filename stem for custom levels), a human-readable `name`, and a `layout: readonly string[]`.
- **FR-027**: System MUST skip any `levels/*.json` file that is not an object, lacks a `layout`, or whose `layout` is not an array of strings, without preventing the remaining entries from loading.
- **FR-028**: System MUST provide a level dropdown that loads the selected entry: `importLayout` of its layout into `grid`, a recenter request on the spawn tile, and a write-through to the persisted grid so a reload does not restore the discarded edits. System MUST NOT provide separate Reset or Scratch controls — `main` and `empty` are dropdown entries.
- **FR-029**: System MUST remember the name of the level the grid was loaded from (or last saved as) and whether it has been edited since, both persisted across reloads the same way `grid` and `selectedTool` are, so the open level's name and the discard guard survive closing the tab. The remembered name MUST NOT have to resolve to a registry entry — a level that has been saved but whose file has not been moved into `levels/` yet has no entry of its own.
- **FR-030**: System MUST set an edited flag on every paint and erase, and clear it on every level load and save. A dropdown selection MUST open a confirmation dialog naming both levels while the flag is set, and load without a dialog while it is clear. Cancelling MUST leave `grid`, `selectedTool`, the persisted grid, and the flag itself untouched. The flag is deliberately not a comparison of `grid` against the loaded layout: painting a cell and painting it back still counts as an edit, which costs one unnecessary confirmation and avoids diffing a 220-column grid on every stroke.
- **FR-031**: System MUST provide a Save control that asks for a level name (prefilled with the open level's name) and saves `{ "name": <name>, "layout": exportLayout(grid) }` as pretty-printed JSON under the slugified name plus `.json`. A save MUST clear the edited flag and adopt the entered name as the open level's name (FR-029, FR-030). A successful write MUST close the dialog and report the written path outside it; that report MUST be dropped as soon as the grid is painted again or another level is loaded.
- **FR-032**: System MUST save by POSTing `{ fileName, contents }` to a dev-server route that writes the file into `src/themes/platformer/level/levels/`, so a saved level needs no moving to appear in the dropdown. When that route answers with anything but a written path — including not existing at all, which is the case in every built site — the System MUST fall back to downloading the file via a Blob object URL that is revoked after the download is triggered, and MUST keep the save dialog open telling the developer that is what happened, rather than implying a file reached the repository.
- **FR-033**: The route MUST be served by a Vite plugin declared `apply: 'serve'`, so it is served only under `npm run dev` and no build ships the middleware (the built client still references the path, and falls back when nothing answers). Before writing, it MUST reject any `fileName` that is not a bare slugified name ending in `.json` (no path separators, no `..`, no other extension), MUST reject any resolved path outside the levels folder, and MUST reject contents that are not JSON carrying a non-empty `layout` array of strings — writing nothing in each case. It MUST create the levels folder if it is absent, and MUST overwrite an existing file of the same name.

#### TypeScript

- **FR-024**: System MUST compile under TypeScript `strict: true` with no `any` types and no `@ts-ignore` directives.
- **FR-025**: System MUST add `export type TileChar = '.' | 'G' | 'R' | 'W' | 'B' | 'S' | 'E' | 'M' | 'C' | 'X' | 'Q' | 'F' | 'T';` to `LevelParser.ts`, positioned after the `sharedChars` overlap guard, plus a test asserting every `TERRAIN_CHARS`/`ENTITY_CHARS` key is one of `TileChar`'s members.

---

## Key Entities

- **`LevelEditorPage` (component)**: Route-level component at `/platformer/editor`. Owns `grid: TileChar[][]`, `selectedTool: TileChar`, `panOffset: {x, y}`. Grid has no fixed dimensions — it grows via `growGrid` as painting demands. Loads sprite sheet images once on mount via `loadImage`.
- **`Palette` (component)**: Renders one button per `TERRAIN_CHARS` key, per `ENTITY_CHARS` key, plus an Eraser button (`.`). Presentational + click handler that sets `selectedTool` on the parent.
- **`EditorCanvas` (component)**: A `<canvas>` sized to the viewport. Handles left-click/left-drag (paint with `selectedTool`, calling `growGrid` per cell as needed), right-click/right-drag (erase — always `.`, regardless of `selectedTool`, same `growGrid` path), and middle-click-drag (pan, via `EditorPan.ts`). Renders every visible cell — in-bounds or not — so panning always shows grid. Delegates all sprite drawing to the reused engine `draw*` functions, fed synthesized placeholder objects for the current `grid` + `panOffset`.
- **`EditorPan.ts`**: New, editor-only pure module holding pan-state update logic (drag delta → new `panOffset`). No relation to `engine/Camera.ts`. Growth-compensation shifts (from `growGrid`) are applied to the same `panOffset` state directly by the paint handler, not through this module.
- **`growGrid.ts`**: Pure function module. `growGrid(grid, col, row): { grid, colShift, rowShift }` — grows the array just enough to include `(col, row)`, reporting how much the origin shifted so the caller can compensate `panOffset`.
- **`exportLayout.ts`**: Pure function module. `exportLayout(grid): readonly string[]` — crops to the tightest non-`.` bounding box before serializing.
- **`importLayout.ts`**: Pure function module, the inverse of `exportLayout.ts`'s serialization (not its cropping). `importLayout(layout: readonly string[]): TileChar[][]`. Used once, on `LevelEditorPage` mount, against `LEVEL_1_LAYOUT`.
- **`levelRegistry.ts`**: Module listing every level the editor can load — the two built-ins (`main`, `empty`) followed by the `levels/*.json` files, discovered eagerly via `import.meta.glob` and filtered to the well-formed ones. Exports `LevelEntry { id, name, layout }` and the assembled list; holds no React state.
- **`saveLevelFile.ts`**: Two pure functions (`levelFileJson(name, grid)` → the JSON text, `levelFileName(name)` → the slugified filename), `saveLevel` (POSTs to the dev-server route, falling back to the download and reporting which happened), and `downloadLevelFile` (the Blob-download wrapper that fallback uses).
- **`saveLevelEndpoint.ts`**: The two constants both runtimes need — `LEVELS_FOLDER` and `SAVE_LEVEL_ENDPOINT`. Import-free on purpose: the Vite plugin reads it from Node inside `vite.config.ts`, the editor from the browser.
- **`vite/writeLevelFile.ts`**: Node-side write with all of FR-033's validation. Takes the repository root and the request, returns a status and body; touches the filesystem only once everything has passed.
- **`vite/levelWritePlugin.ts`**: The `apply: 'serve'` Vite plugin. Mounts one POST middleware on `SAVE_LEVEL_ENDPOINT`, reads the body, and hands it to `writeLevelFile`; non-POST requests fall through to the next middleware.
- **`LevelSelect` (component)**: The level dropdown plus its confirmation dialog. Reads `levelRegistry`, takes the open level's name and the edited flag as props, and reports the chosen `LevelEntry` up to `LevelEditorPage`. Driven as an action menu (its `value` pinned to `null`, the open level's name shown as the trigger's text) rather than bound to the open level, because a value-bound Select swallows the selection of the already-selected item — which is exactly the reset case.
- **`editorLoadedLevelNameSignal` / `editorDirtySignal`** (added to `editorLevelState.ts`): the open level's name and the edited flag, both `localStorage`-backed like `editorLevelSignal` and `editorSelectedToolSignal`.
- **`TileChar` (type, added to `LevelParser.ts`)**: hardcoded literal union of every valid layout character (`'.'`, `'G'`, `'R'`, `'W'`, `'B'`, `'S'`, `'E'`, `'M'`, `'C'`, `'X'`, `'Q'`, `'F'`, `'T'`), kept in sync with `TERRAIN_CHARS`/`ENTITY_CHARS` via a drift-guard test rather than direct `keyof` derivation (which would collapse to plain `string` given those maps' existing wide annotations). Consumed by the editor's grid state.
- **Placeholder state objects** (constructed in the editor, not exported as reusable types beyond local helpers): minimal `PlayerState`/`CollectiblePlacement`/`EnemyState`/`BlockState`/`ChestState`-shaped objects built per marker found in the grid, with position + kind set from the grid and every other required field set to its "at rest" default (see Design Decisions' Sprite Reuse section).

**Entity Relationships**:
```
TERRAIN_CHARS / ENTITY_CHARS (LevelParser.ts, existing)
 ├── TileChar = '.' | 'G' | ... | 'T'   (new, hardcoded literal union + drift-guard test)
 ├── Palette buttons generated from these two maps
 └── grid: TileChar[][] (LevelEditorPage state) — every cell is one of these keys

LevelEditorPage
 ├── grid, selectedTool, panOffset (state)
 ├── on mount: grid = importLayout(LEVEL_1_LAYOUT)   (level1.ts)
 ├── renders Palette (sets selectedTool)
 ├── renders EditorCanvas (paints grid, updates panOffset via EditorPan.ts and via growGrid's shift)
 └── renders export UI (exportLayout(grid) → readonly string[] → textarea + copy button)

EditorCanvas (per paint)
 ├── growGrid(grid, targetCol, targetRow) → { grid, colShift, rowShift }
 ├── panOffset -= {x: colShift * RENDERED_TILE_SIZE, y: rowShift * RENDERED_TILE_SIZE}
 └── grid[targetRow + rowShift][targetCol + colShift] = selectedTool  (with spawn auto-relocate, FR-006)

EditorCanvas (per redraw)
 ├── grid.terrain-cells (in-bounds) → LevelDef → engine.drawTerrain
 ├── out-of-bounds visible cells → drawn as empty grid (FR-021)
 ├── grid entity markers → synthesized placeholder objects → engine.drawPlayer/drawCollectibles/drawEnemies/drawBlocks/drawChests
 └── all draws offset by panOffset
```

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Real sprites, not placeholders**: Every terrain and entity type in `TERRAIN_CHARS`/`ENTITY_CHARS` renders in the editor using the exact same sprite sheet image and frame-selection logic as the real game (verified by component test asserting each `draw*` engine function is invoked with the real image refs, and by visual inspection).
- **SC-002 — Exactly one spawn, always**: After any sequence of spawn placements, exactly zero or one `S` character exists in `grid` (zero before the first placement, one thereafter). Verified by unit test: place `S` at multiple cells in sequence, assert only the most recent cell holds `S`.
- **SC-003 — Export round-trips through the real parser**: `exportLayout(grid)` passed to the real `parseLevel` never throws for any grid produced entirely through the editor's paint operations, including paints that trigger growth in any direction. Verified by unit test combining `exportLayout` output with `parseLevel` across several painted grids.
- **SC-004 — No animation loop**: The editor never calls `requestAnimationFrame`; redraws occur only in direct response to a paint/pan state change. Verified by test asserting a fixed render count across N synchronous paints with no timers advanced, and by grep confirming no `requestAnimationFrame` call in `editor/`.
- **SC-005 — Growth never loses or shifts existing content's logical value**: After any sequence of out-of-bounds paints in any direction, every previously-painted cell's character value is unchanged, regardless of how its array index shifted. Verified by unit test on `growGrid`: grow left/up, assert every pre-existing cell's value is preserved at its new (shifted) index.
- **SC-006 — Growth left/up never visually moves existing content**: Whenever `growGrid` returns a non-zero `colShift`/`rowShift`, subtracting `colShift * RENDERED_TILE_SIZE` / `rowShift * RENDERED_TILE_SIZE` from `panOffset` exactly cancels the index shift, so the on-screen pixel position of every pre-existing cell is unchanged. Verified by unit test computing screen position before and after a left/up growth.
- **SC-007 — Zero TypeScript errors**: The entire editor implementation compiles under `strict: true` with no `any` and no `@ts-ignore`. Verified by `npm run build`.
- **SC-008 — Not linked from public nav**: `/platformer/editor` does not appear in any rendered navigation link reachable from the public CV pages. Verified by grep/test asserting no `<Link>`/`href` to this route outside the editor's own code and route config.
- **SC-009 — Unedited load round-trips to content, cropped**: Loading the editor and immediately exporting (no edits) produces a `readonly string[]` equal to `LEVEL_1_LAYOUT` cropped to its own tightest non-`.` bounding box — content-cropping is unconditional (SC-010), so a leading/trailing all-`.` row or column already present in the source data is cropped away exactly as it would be for any other grid, even one that has never been painted on. `LEVEL_1_LAYOUT` is also jagged (its ladder-shaft rows are shorter than the rest); `importLayout` right-pads every row to the widest row's length with `.`, exactly matching `parseLevel`'s own convention, before this cropping ever runs. Verified by unit test: `exportLayout(importLayout(LEVEL_1_LAYOUT))` deep-equals `importLayout(LEVEL_1_LAYOUT)`'s rows re-joined, with every leading/trailing all-`.` row and column stripped (as of this writing, `LEVEL_1_LAYOUT`'s only all-`.` row sits between two content rows — interior, not leading/trailing — so nothing is actually cropped; this can change again as the level's content changes, which is why the test computes the expected value from `importLayout`'s own padding rather than a value hardcoded against today's exact layout).
- **SC-010 — Export always crops to the tightest content bounding box**: Regardless of how much the stored array has grown or been erased, `exportLayout`'s output dimensions equal the smallest rectangle containing every non-`.` cell — never larger (leftover empty padding from earlier growth) and never smaller (clipping real content). Verified by unit test: grow the grid far beyond content in every direction, then assert the exported layout's row/column count matches only the painted extent.

- **SC-011 — Level loading never silently discards edits**: Once anything has been painted, picking a level (including the one already loaded) leaves the grid, the selected tool, and the persisted grid untouched until the confirmation dialog is confirmed; with nothing painted since the last load or save, no dialog appears at all. Verified by component test covering both cases, the reselect-the-loaded-level case, and the cancel path.
- **SC-012 — A saved level round-trips back into the dropdown**: The JSON a save produces satisfies the registry's own validity check and, placed in `levels/`, yields a dropdown entry whose layout re-imports to a grid equal to the one that was saved. Verified by unit test feeding `levelFileJson`'s output through the registry's parse/validate path and back through `importLayout`, and end-to-end by saving from the editor against a running dev server and reloading.
- **SC-013 — Saving needs no manual file move, and never lies about it**: With the dev server running, a save leaves the file in `src/themes/platformer/level/levels/`, closes the dialog, and names that path in the sidebar until the grid changes again; with the endpoint unreachable, the file is downloaded instead and the dialog stays open saying so. Verified by component tests over both outcomes, the refusal case, and the two ways the saved-path report goes stale.
- **SC-014 — The write route cannot reach outside the levels folder, and is not served by a build**: No `fileName` containing a path separator, a `..`, a drive letter, or a non-`.json` extension results in a write. Verified by unit tests over the rejected filenames, and by the plugin's `apply: 'serve'` keeping the middleware out of every build — the built client still contains the endpoint's path string, because it is the client that requests it and falls back when nothing answers.

---

## Assumptions

- **S-006 (2D Platformer Theme) is implemented far enough to have `LevelParser.ts`, `Renderer.ts`'s draw functions, and the entity mapper/state modules in their current shape.** This editor is a v2+ authoring tool layered on top of that existing engine, not a co-requirement.
- **The original idea doc's YAGNI list mostly stands**: zoom, undo/redo, and direct file writes are all out of scope for this spec (see Out of Scope). Its `localStorage`-persistence and single-layout items no longer hold: the grid, selected tool, open level, and edited flag are persisted, and the level dropdown offers more than one layout.
- **A fruit-producing question-mark block's spawned fruit is not itself placeable** — only the question-mark block marker (`Q`) is placed; fruit only appears in the real game after the block is hit. The editor has no notion of "spawn a fruit here" as a distinct palette entry.
- **Placeholder `fact: CollectedFact` stubs are safe** because none of the reused draw functions (`drawCollectibles`, `drawEnemies`, `drawBlocks`, `drawChests`) read the `fact` field — confirmed by inspecting `Renderer.ts`'s draw function bodies, which only touch position/kind/animation fields.
- **No validation of exported layouts beyond `parseLevel`'s own row-length/char checks** — e.g. the editor does not warn about an unreachable coin or an enemy placed inside solid terrain. That kind of playtesting-equivalent validation is out of scope (see Out of Scope).
- **Desktop-only** — like the rest of the platformer theme (S-006) and the space theme (S-005), this dev tool assumes a desktop pointer (mouse) and is not designed for touch input.

---

## Clarifications

Record of design decisions made during specification.

| # | Question | Choice | Impact |
|---|---|---|---|
| 1 | Is O-002 still the correct feature ID/tier? | Confirmed — `docs/Features.md`'s Optional tier only has O-001 (Checkpoint Persistence) so far | O-002 assigned to this feature |
| 2 | How should the editor prevent more than one spawn marker? | Auto-relocate: placing a new `S` clears the previous `S` cell in the same paint action — no guard, no warning dialog | FR-006; simpler UX than blocking placement, still guarantees the invariant |
| 3 | Where should the `TileChar` type live, given it doesn't exist yet? | Added to `LevelParser.ts` as a hardcoded literal union (not `keyof typeof TERRAIN_CHARS \| keyof typeof ENTITY_CHARS`, which collapses to plain `string` given those maps' existing wide `Record<string, ...>` annotations) plus a drift-guard test | FR-025; avoids touching `parseLevel`'s/`findAllOfKind`'s existing tested string-indexed lookups |
| 4 | Should chests (`T` marker, `drawChests`/`ChestState`) be in the v1 palette? | Yes, included in v1 | FR-009, FR-012; palette is complete for every real `ENTITY_CHARS` marker, not missing the newest one |
| 5 | The app has no URL router — how does a "hidden dev-only route" actually work? | Plain `window.location.pathname` check in `App.tsx`, no routing library added | FR-001; avoids a new dependency solely to gate one hidden page, consistent with Principle V's bundle-size discipline |
| 6 | Should the grid load pre-populated with `level1`'s layout? | Yes — the grid starts as a one-time, in-memory copy of `LEVEL_1_LAYOUT`, taken on mount (not a live link — see User Story 1a) | FR-002; new `importLayout.ts` module (inverse of `exportLayout.ts`); the initial grid matches the shipped level exactly at load time |
| 7 | How should the grid handle content placed beyond its current bounds — fixed size with manual resize, or unbounded? | Unbounded and seamless: the grid isn't a fixed size at all. Painting outside current bounds grows the array automatically in that direction; growing left/up shifts `panOffset` to compensate so nothing visually moves. Export always crops to the tightest non-`.` bounding box | FR-018–FR-021, FR-022; replaces the earlier manual-resize design entirely (no width/height inputs, no shrink-confirmation dialog) |
| 8 | Sparse map (O(1) per placement) or dense array (O(width×height) copy on boundary-crossing growth) for grid storage? | Dense `TileChar[][]`, grown on demand | This is a single-human, click-paced dev tool, not a hot loop — an occasional full-array copy on a boundary-crossing paint is imperceptible, and a plain array is simpler to feed into `drawTerrain`'s `LevelDef` and to test than a sparse map |
| 9 | How should mouse buttons map to paint/erase/pan? | Left-click paints with `selectedTool`; right-click always erases (`.`), regardless of `selectedTool`; middle-click-drag pans | FR-004a, FR-016; matches common tile-editor convention (Tiled, Terraria-likes) — erasing no longer requires switching to the Eraser tool first. Supersedes the original right-click-drag-pans design |
| 10 | Should Platform (`P`) exist as a tile kind at all? | No — removed entirely, from both the palette and the engine (`TileType`, `TERRAIN_CHARS`, `TileChar`, `isSolid`, `tileSource`) | `platform`'s sprite was identical to an exposed `groundGrass` tile (`Renderer.ts`'s `tileSource`, both `{sx:0,sy:0}`) — a floating strip of ground is just `groundGrass`, which already renders its top-exposed sprite automatically; keeping a visually-indistinguishable second tile kind around (even just in engine code) served no purpose |

---

## Out of Scope

- Zoom (canvas is drawn at a fixed `RENDERED_TILE_SIZE` scale)
- Manual size controls (width/height inputs, shrink confirmation dialogs) — sizing is fully automatic via seamless growth, cropped on export (see Clarifications #7)
- Canvas virtualization / maximum grid size enforcement — acceptable for a human-click-paced dev tool at realistic level sizes (see Clarifications #8)
- Undo/redo
- Direct file writes from the page itself, and any write outside `levels/` — pasting an exported layout into `level.ts` stays manual
- Animated sprites (coin bob, enemy walk-cycle, block bump/shatter, chest opening) — every sprite renders at a single fixed "at rest" frame
- Playtesting-equivalent validation (unreachable collectibles, enemies embedded in solid terrain, missing spawn marker before export)
- A distinct "spawn placement guard" dialog/warning — resolved as silent auto-relocate instead (see Clarifications #2)
- A generic "import any layout" UI (e.g. a paste-in text area for arbitrary `readonly string[]` layouts) — layouts enter the editor only through the level registry (see FR-026)
- Writes into the repository from a built site — the write route is dev-server only, and Save falls back to a download everywhere else (see FR-032, FR-033)
- A visitor-facing level picker in the game itself — the dropdown is editor-only (roadmap step 31 covers the game side)
- Renaming, deleting, or overwriting existing level files from the editor
- Mobile/touch input support
- Public navigation entry point — the route is reachable by direct URL only

---

## Files

### New

| File | Role |
|------|------|
| `src/themes/platformer/editor/LevelEditorPage.tsx` | Route component — owns grid/selectedTool/panOffset state, loads sprite images, composes Palette + EditorCanvas + export UI |
| `src/themes/platformer/editor/Palette.tsx` | Renders terrain/entity/eraser buttons generated from `TERRAIN_CHARS`/`ENTITY_CHARS`; sets `selectedTool` |
| `src/themes/platformer/editor/EditorCanvas.tsx` | `<canvas>` — paint (click/drag, growing the grid via `growGrid` as needed) and pan (right-drag) event handling; renders out-of-bounds visible cells as empty grid; delegates drawing to engine `draw*` functions via synthesized placeholder objects |
| `src/themes/platformer/editor/EditorPan.ts` | Pure pan-state module — editor-only 2D pan, unrelated to `engine/Camera.ts` |
| `src/themes/platformer/editor/growGrid.ts` | Pure function: grows `grid` just enough to include a target `(col, row)`, reporting `colShift`/`rowShift` for `panOffset` compensation |
| `src/themes/platformer/editor/exportLayout.ts` | Pure function: `grid` → `readonly string[]`, cropped to the tightest non-`.` bounding box, matching `parseLevel`'s expected shape |
| `src/themes/platformer/editor/importLayout.ts` | Pure function: `readonly string[]` → `grid` (inverse of `exportLayout.ts`'s serialization); used on mount against `LEVEL_1_LAYOUT` |
| `src/themes/platformer/level/levelRegistry.ts` | The list of loadable levels: built-in `main`/`empty` plus validated `levels/*.json`, discovered via `import.meta.glob`; exports `LevelEntry` |
| `src/themes/platformer/level/levels/` | Folder holding saved JSON level files (`{ name, layout }`), picked up by `levelRegistry.ts`; its `README.md` documents the file shape |
| `src/themes/platformer/editor/saveLevelFile.ts` | Pure JSON-text and filename-slug builders, the dev-server save with its download fallback, and the Blob download wrapper |
| `src/themes/platformer/editor/saveLevelEndpoint.ts` | `LEVELS_FOLDER` and `SAVE_LEVEL_ENDPOINT`, shared by the editor and the Vite plugin; deliberately import-free |
| `vite/writeLevelFile.ts` | Node-side validated write into the levels folder |
| `vite/levelWritePlugin.ts` | Dev-only (`apply: 'serve'`) Vite plugin serving the write route |
| `vite/writeLevelFile.test.ts` | Unit tests: writes into the levels folder, creates it, overwrites, rejects every escaping filename and every non-level body |
| `vite/levelWritePlugin.test.ts` | Unit tests: mounts on the endpoint, writes on POST, rejects a bad envelope, passes non-POST requests on, applies only on serve |
| `src/themes/platformer/editor/LevelSelect.tsx` | Level dropdown + discard-changes confirmation dialog; reports the chosen `LevelEntry` upward |
| `src/themes/platformer/level/levelRegistry.test.ts` | Unit tests: built-ins present and ordered, valid JSON adopted, malformed files skipped |
| `src/themes/platformer/editor/saveLevelFile.test.ts` | Unit tests: JSON shape, name slugging, registry round-trip, the POST it sends, and the download fallback on every failure path |
| `src/themes/platformer/editor/LevelSelect.test.tsx` | Component tests: lists entries, loads on a clean selection, confirms on a changed one, cancel is a no-op |
| `src/themes/platformer/editor/exportLayout.test.ts` | Unit tests for cropping, row joining, round-trip through `parseLevel` |
| `src/themes/platformer/editor/importLayout.test.ts` | Unit tests for import shape, and `exportLayout(importLayout(LEVEL_1_LAYOUT))` deep-equals `LEVEL_1_LAYOUT` |
| `src/themes/platformer/editor/growGrid.test.ts` | Unit tests: growth in each of the 4 directions and a corner case, value preservation, `colShift`/`rowShift` correctness, no-op when already in bounds |
| `src/themes/platformer/editor/EditorPan.test.ts` | Unit tests for pan offset updates |
| `src/themes/platformer/editor/Palette.test.tsx` | Component tests: tool selection, active-tool highlight |
| `src/themes/platformer/editor/EditorCanvas.test.tsx` | Component tests: click-paints, drag-paints a run, right-drag pans, overwrite behavior, spawn auto-relocate, out-of-bounds paint triggers growth with `panOffset` compensation, panning past content still renders grid |
| `src/themes/platformer/editor/LevelEditorPage.test.tsx` | Component tests: initial load from `LEVEL_1_LAYOUT` |

### Modified

| File | Change |
|------|--------|
| `src/themes/platformer/level/LevelParser.ts` | Add hardcoded literal union `export type TileChar = '.' \| 'G' \| ... \| 'T';` after the `sharedChars` guard |
| `src/themes/platformer/level/level1.ts` | Export `LEVEL_1_LAYOUT` (currently a private module-level `const`) so `importLayout`/the editor can import it directly |
| `src/App.tsx` | Add a `window.location.pathname === '/platformer/editor'` check ahead of the `themePages[currentTheme.value]` lookup, rendering `LevelEditorPage` directly when it matches |
| `vite.config.ts` | Register `levelWritePlugin()` alongside the React and Tailwind plugins |
| `tsconfig.node.json` | Include `vite/` and add `vitest/globals` to its types, so the plugin and its tests typecheck as Node-side code |

---

## Testing

- **Unit**: `exportLayout.test.ts` (bounding-box cropping, row joining, round-trip through real `parseLevel`, all-`.` grid returns `['.']`), `importLayout.test.ts` (char-to-grid mapping, `exportLayout(importLayout(LEVEL_1_LAYOUT))` deep-equals `LEVEL_1_LAYOUT`), `growGrid.test.ts` (growth in each of the 4 directions plus a corner case, value preservation at shifted indices, `colShift`/`rowShift` correctness, no-op when already in bounds), `EditorPan.test.ts` (drag delta → offset math), `levelRegistry.test.ts` (built-in entries and ordering, valid JSON adopted, malformed files skipped), `saveLevelFile.test.ts` (JSON shape, filename slugging, registry round-trip, the POST body it sends, download fallback when the endpoint is missing/throws/refuses), `vite/writeLevelFile.test.ts` (validated writes into a temp root: folder creation, overwrite, every rejected filename and body), `vite/levelWritePlugin.test.ts` (endpoint mounting, POST write, bad envelope, non-POST passthrough, `apply: 'serve'`).
- **Component**: `Palette.test.tsx` (tool selection/highlight), `EditorCanvas.test.tsx` (click-paint, drag-paint run, right-drag pan with `contextmenu` prevented, overwrite-on-place, spawn auto-relocate invariant, real-sprite draw calls via mocked `draw*` engine functions, out-of-bounds paint grows the grid and compensates `panOffset`, panning past content renders empty grid not blank space), `LevelEditorPage.test.tsx` (initial grid matches `LEVEL_1_LAYOUT`, level selection replaces the grid and recenters on its spawn, painting marks the editor edited, loading clears it, save writes via the dev server, falls back to a download without it, reports which happened, and adopts the entered name), `LevelSelect.test.tsx` (entry list, clean selection loads immediately, changed selection confirms first, cancel leaves the grid alone).
- Coverage targets per constitution: 100% for the pure modules (`exportLayout.ts`, `importLayout.ts`, `growGrid.ts`, `EditorPan.ts`, `saveLevelFile.ts`'s pure builders), 80%+ for components (`LevelEditorPage`, `Palette`, `EditorCanvas`, `LevelSelect`).
