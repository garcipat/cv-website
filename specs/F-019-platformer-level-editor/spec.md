# Feature Specification: Platformer Level Editor

**Feature Branch**: `F-019-platformer-level-editor`
**Created**: 2026-08-31
**Status**: Implemented
**Parent Feature**: [F-015 — 2D Platformer Theme](../F-015-platformer-theme/spec.md)
**Input**: A hidden, dev-only in-app tool for authoring platformer level layouts by painting on a grid, instead of hand-typing layout arrays into source files.

The level format this editor reads and writes — the character table, the layer model, and
the shape of a saved level file — is documented in
[LevelFormat.md](../../docs/themes/platformer/LevelFormat.md).

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Author a Layout by Painting Tiles (Priority: P1)

A developer opens the editor — from the IDE theme's View menu, or by navigating straight to
`/platformer/editor`. The grid loads with a real, playable level already on it (see User Story 2).
They select a terrain tool (e.g. "Ground Grass") from the palette and click-drag across a run
of cells to paint them. They select an entity tool (e.g. "Coin") and click individual cells to
place markers. Every click or drag overwrites whatever was in that cell before, with no
confirmation — painting is cheap and reversible by painting over again.

**Why this priority**: This is the core authoring loop. Without paint-to-place, there is no
editor.

**Independent Test**: Load `/platformer/editor`. Select a terrain tool, drag across 5 cells,
verify all 5 show that terrain's real sprite. Select an entity tool, click a cell, verify the
marker's real sprite appears. Click a painted cell with a different tool selected, verify it is
overwritten.

**Acceptance Scenarios**:

1. **Given** the editor is loaded, **When** the developer selects a terrain tool and left-clicks a cell, **Then** that cell's tile becomes the selected terrain and redraws with the real game sprite.
2. **Given** a terrain tool is selected, **When** the developer left-click-drags across multiple cells, **Then** every cell the cursor passes over is painted with that terrain — a run, not just the start and end cells.
3. **Given** a cell already holds a tile or entity marker, **When** the developer paints over it with a different tool, **Then** the previous value is silently overwritten — no warning, no confirmation.
4. **Given** the Eraser tool is selected, **When** the developer paints a cell, **Then** the cell becomes empty.

---

### User Story 2 - The Editor Opens on a Real Level (Priority: P1)

The editor never starts on a blank page. On its first open it holds the shipped `main` level
exactly as the game plays it — same width and height, same terrain, same entity markers. On
every later open it restores whatever was last on screen, together with the selected tool, the
open level's name, and whether it had unsaved edits. The grid is a copy taken at load: the
editor never reads back from, or writes to, the level source afterwards.

**Why this priority**: The editor's primary use is refining an existing, playable level. P1
because User Story 1's "the editor is loaded" precondition depends on it.

**Independent Test**: Open `/platformer/editor` with no prior interaction and export
immediately, without editing. Verify the exported layout is the shipped level's own layout,
cropped to its tightest non-empty bounding box. Then paint a cell, reload the page, and verify
the painted cell is still there.

**Acceptance Scenarios**:

1. **Given** the editor is opened for the first time, **When** the grid renders, **Then** its dimensions and every cell match the shipped `main` level.
2. **Given** the editor has just loaded, **When** the developer exports without making any edits, **Then** the export is cropped to the tightest non-empty bounding box exactly as it would be for any other grid state — the unedited grid is not a special case.
3. **Given** the editor has just loaded, **When** the grid renders, **Then** every terrain tile and entity marker in the level is visible with its real sprite, drawn through the same path as a freshly painted cell (User Story 4).
4. **Given** the developer has painted, chosen a tool, or loaded a level, **When** they close the tab and reopen the editor, **Then** the grid, the selected tool, the open level's name, and the edited flag are all restored.

---

### User Story 3 - Erase with a Right-Click, Regardless of the Selected Tool (Priority: P1)

Right-clicking a cell — or right-click-dragging across several — erases it, no matter which
palette tool is currently selected. The developer does not need to switch to the Eraser first;
erasing is always one right-click away, matching the left-click-paints / right-click-erases
convention common to tile-map editors.

**Why this priority**: Constantly switching the selected tool back and forth between "the
thing I am placing" and Eraser just to fix a mistake is friction in the tool's core loop — the
same loop User Story 1 depends on.

**Independent Test**: With any terrain or entity tool selected, right-click a painted cell.
Verify it becomes empty and the selected tool is unchanged. Right-click-drag across several
cells, verify all of them are erased.

**Acceptance Scenarios**:

1. **Given** any tool other than Eraser is selected, **When** the developer right-clicks a cell, **Then** that cell becomes empty and the selected tool does not change.
2. **Given** the developer right-click-drags across multiple cells, **Then** every cell the cursor passes over is erased, matching left-click-drag's paint-a-run behavior.
3. **Given** a right-click targets a cell outside the current grid bounds, **Then** the grid grows to include it exactly as a paint would (User Story 6), and the newly included cell is erased.
4. **Given** the developer right-clicks anywhere on the canvas, **Then** the browser's context menu does not appear — right-click is reserved for erasing.

---

### User Story 4 - See Real Game Sprites While Authoring (Priority: P1)

While painting, the developer sees the actual sprites the game uses — the same tileset, coin
and fruit sheets, enemy sheets, block tileset, chest sheets and player sheet — not placeholder
coloured boxes. This lets them judge visual composition (does this coin sit at a jumpable
height? does this enemy have room to patrol?) without switching to the running game to check.

**Why this priority**: Accurate visual feedback is the entire value over hand-typing a layout
array blind. A placeholder-box editor would not meaningfully improve on the status quo.

**Independent Test**: Place one of each terrain tile and one of each entity marker. Verify each
renders with its real sprite rather than a generic shape, and that the frame shown is the
game's static at-rest frame with no animation.

**Acceptance Scenarios**:

1. **Given** a terrain cell is painted, **When** the grid redraws, **Then** it is drawn from the real tileset with the same tile-selection rules the game uses, autotiling included.
2. **Given** a coin or fruit marker is placed, **When** the grid redraws, **Then** it is drawn from the real collectible sprites at a fixed frame — no bob, no frame cycling.
3. **Given** an enemy marker is placed ([F-017](../F-017-platformer-enemies/spec.md)), **When** the grid redraws, **Then** it is drawn from the real slime sprites at a fixed idle frame — no walk cycle, no patrol-driven facing.
4. **Given** a destroyable block marker is placed ([F-018](../F-018-platformer-blocks/spec.md)), **When** the grid redraws, **Then** it is drawn from the real block sprites in its intact, never-hit frame.
5. **Given** a chest marker is placed ([S-007](../S-007-platformer-chests/spec.md)), **When** the grid redraws, **Then** it is drawn closed, matching a freshly placed, never-opened chest.
6. **Given** the spawn marker is placed, **When** the grid redraws, **Then** it is drawn from the real player sprite at a fixed idle frame facing right.
7. **Given** a sprite sheet has not finished loading or failed to load, **When** the grid renders, **Then** that layer is skipped for the frame rather than the whole canvas failing to render.

---

### User Story 5 - Exactly One Spawn Point Always Exists (Priority: P1)

The developer places a spawn marker. Later they decide to move it and click a different cell
with the Spawn tool selected. The old spawn cell is cleared as part of that same click — there
is never a moment with two spawn markers on the grid, and the developer never sees a warning or
a blocking dialog about it.

**Why this priority**: The game's parser silently uses only the first spawn marker in reading
order and never errors on extras, so an editor that let two coexist would let a developer export
a layout whose second spawn is dead weight — an easy authoring mistake to miss. This is a
correctness guarantee about the exported output, not a nice-to-have.

**Independent Test**: Place a spawn at cell A, then at cell B. Verify cell A is now empty and
cell B holds the spawn — exactly one exists at all times.

**Acceptance Scenarios**:

1. **Given** no spawn marker exists yet, **When** the developer places one, **Then** it is placed normally.
2. **Given** a spawn marker exists at cell A, **When** the developer places one at cell B, **Then** cell A becomes empty and cell B holds the spawn, in the same paint action.
3. **Given** a spawn marker exists at cell A, **When** the developer re-paints cell A with the Spawn tool, **Then** nothing changes.

---

### User Story 6 - Grid Grows Seamlessly in Any Direction as You Paint (Priority: P1)

The grid has no fixed size and no manual resize control. If the developer paints above, below,
left of, or right of the current bounds, the grid grows just enough to include that cell,
padded empty everywhere else new. Panning never reveals a hard edge or blank area: the visible
viewport always looks like grid, painted or not. Growing left or up never visually shifts
already-painted content — the view compensates so everything stays exactly where it was on
screen.

**Why this priority**: Real levels are authored incrementally in every direction — a jump puzzle
built upward from the ground, a level extended rightward. A fixed-size grid with a manual resize
step would interrupt that flow at every boundary crossing.

**Independent Test**: Paint a cell, then paint another one row above the current top-most row.
Verify the grid includes that row, the original cell's on-screen position has not moved, and the
new cell is at the top. Repeat for left, right and below.

**Acceptance Scenarios**:

1. **Given** a paint targets a cell one column beyond the right edge or one row below the bottom edge, **Then** the grid grows by that column or row, padded empty, and every existing cell keeps its position.
2. **Given** a paint targets a cell beyond the left or top edge, **Then** the grid grows on that side, and the view compensates so every already-painted cell's on-screen position is unchanged.
3. **Given** a single paint targets a cell beyond two edges at once (a corner), **Then** both dimensions grow in the same action and both compensations are applied together.
4. **Given** a drag runs from inside the grid to far outside it, **Then** growth happens cell by cell along the drag, exactly as separate clicks would produce.
5. **Given** the developer pans to a region beyond any painted content, **When** the canvas renders, **Then** that region is drawn as empty grid rather than blank space — panning never shows an edge and never itself grows the grid.

---

### User Story 7 - Export the Layout for Pasting into a Level File (Priority: P1)

The developer copies the layout. The grid's current state is serialized into exactly the shape
the game's level parser expects — one string per row, one character per column — and shown in a
read-only text area with a copy-to-clipboard button. The developer pastes it into the level
source by hand; the editor never writes to a source file.

**Why this priority**: This is the deliverable of every editing session — without export,
nothing produced in the editor leaves it.

**Independent Test**: Paint a small known grid, copy the layout, verify the displayed rows match
the grid character for character, top row first, and that the result loads through the game's
parser without error.

**Acceptance Scenarios**:

1. **Given** a painted grid, **When** the layout is exported, **Then** it is one string per row, top row first, each string's characters matching that row's columns left to right.
2. **Given** an exported layout, **When** it is fed to the game's level parser, **Then** it parses without error — equal row lengths, every character recognized.
3. **Given** the export is displayed, **When** the developer clicks the copy button, **Then** the exact displayed text is placed on the system clipboard.
4. **Given** any grid state, **When** it is exported, **Then** the output is cropped to the tightest rectangle containing every non-empty cell — never carrying leftover empty padding from earlier growth, never clipping real content. An entirely empty grid exports as a single empty row.

---

### User Story 8 - Choose Which Level to Edit (Priority: P2)

The developer opens a level dropdown in the editor sidebar and picks the level to work on. The
list always holds two built-in entries — `main` (the shipped level) and `empty` (three ground
tiles with the spawn on the middle one) — plus one entry per saved level file. Picking an entry
replaces the grid with that level's layout and recenters the view on its spawn tile. There is no
separate Reset or Scratch control: "put back what ships" is picking `main` again, and "give me an
empty page" is picking `empty`.

Because loading discards whatever is currently on the grid, the dropdown guards the edits it
would throw away. The editor tracks a single "edited since loaded or saved" flag, set by any
paint or erase and cleared on load and save. While it is clear, picking a level loads it
immediately with no interruption. While it is set, a confirmation dialog names both levels — the
one whose edits are at stake and the one about to load — and loads only on explicit confirmation.

**Why this priority**: Painting (User Story 1) and export (User Story 7) are what the editor is
for; choosing among several layouts makes it usable for more than one level at a time but is not
required for either.

**Independent Test**: Open the editor, pick `empty`, verify the grid becomes three ground tiles
with a centered spawn. Paint one cell, pick `main`, verify the confirmation dialog appears naming
both levels; cancel it and verify the painted cell is still there; reopen, confirm, and verify
the grid matches the shipped level.

**Acceptance Scenarios**:

1. **Given** the editor is loaded, **When** the developer opens the level dropdown, **Then** it lists `main`, `empty`, and one entry per valid saved level file.
2. **Given** nothing has been painted since the grid was loaded or saved, **When** the developer picks a different level, **Then** the grid is replaced, the view recenters on that level's spawn tile, and no confirmation dialog appears.
3. **Given** the grid has been painted since it was loaded or saved, **When** the developer picks a different level, **Then** a confirmation dialog naming the current and target level appears, and the grid is left untouched until it is confirmed.
4. **Given** the grid has been painted, **When** the developer picks the level that is already loaded, **Then** it reloads after confirmation rather than being ignored as a no-op — this is how the editor spells "reset".
5. **Given** the confirmation dialog is open, **When** the developer cancels it, **Then** the grid, the selected tool, and the restored-on-reload copy of the grid are all unchanged, and the edited flag stays set so the next selection confirms again.
6. **Given** a saved level file is malformed, **When** the editor loads, **Then** that file is skipped and every other entry — built-in and saved — still appears in the dropdown.

---

### User Story 9 - Save the Current Level as a Level File (Priority: P2)

The developer clicks Save, types a name, and the file lands in the levels folder the dropdown
reads (User Story 8), so it needs no moving afterwards. Reloading the editor shows it in the
list.

The write is done by the dev server, not the page: the editor asks the dev server to write the
file, and the dev server does it. Nothing about this reaches a built site, where that route does
not exist; there, and anywhere else the write is unreachable, Save falls back to downloading the
file for the developer to move in by hand.

A successful write closes the dialog and leaves the path it wrote in the sidebar — there is
nothing further to do with it. A fallback download keeps the dialog open instead, because the
file then still has to be moved, and that is worth saying before the dialog is dismissed. Either
way the developer is told which of the two happened, so a download is never mistaken for a file
that landed in the repository.

**Why this priority**: Without saving, every level but the two built-ins has to be round-tripped
by hand through the export text area and a hand-written file. Saving makes the dropdown's saved
entries reachable from inside the editor, but export (User Story 7) remains the path that gets a
layout into the shipped level itself.

**Independent Test**: With the dev server running, paint a known small grid, click Save, enter a
name with spaces and mixed case, and verify a level file appears under the slugified name whose
contents are that name and the exported layout. Reload the editor and verify the level is in the
dropdown. Then repeat with the write unreachable and verify the same file is downloaded instead
and that the dialog says so.

**Acceptance Scenarios**:

1. **Given** a painted grid, **When** the developer saves it under a name, **Then** the saved file holds that name and a layout equal to the current export.
2. **Given** a name with spaces, uppercase letters, or punctuation, **When** the file is produced, **Then** its filename is that name slugified — lowercased, non-alphanumerics collapsed to single hyphens, leading and trailing hyphens trimmed.
3. **Given** the dev server is running, **When** the developer saves, **Then** the file is written into the levels folder, the dialog closes, and the written path is shown in the sidebar.
4. **Given** the write is unreachable or refused, **When** the developer saves, **Then** the file is downloaded instead and the dialog stays open saying so, naming both the folder to move it into and, when one was given, the reason the write was declined.
5. **Given** a level was saved, **When** the developer paints again or loads another level, **Then** the sidebar's saved-path line disappears, because the file on disk no longer matches what is on screen.
6. **Given** a write request naming anything but a bare slugified level file, or carrying contents the level list would not accept, **When** the dev server handles it, **Then** it writes nothing and answers with an error.
7. **Given** the developer saves, **Then** the edited flag is cleared and the entered name becomes the open level's name, so picking another level immediately afterwards does not warn about discarding edits.

---

### User Story 10 - Pan a Grid Larger Than the Viewport (Priority: P2)

For a grid too large to fit the visible canvas, the developer holds the middle mouse button and
drags to pan. This is a free-form 2D pan local to the editor, unrelated to the game's
auto-follow camera.

**Why this priority**: Real levels are far wider than any reasonable viewport, but every P1
behavior is testable on a small grid that fits without panning.

**Independent Test**: On the shipped level (already wider than a typical viewport),
middle-click-drag left and right and verify the visible window of cells shifts accordingly.

**Acceptance Scenarios**:

1. **Given** content extends beyond the canvas viewport, **When** the developer middle-click-drags, **Then** the view follows the drag and the canvas redraws at the new offset.
2. **Given** panning is active, **When** the developer releases the middle mouse button, **Then** panning stops and the view stays at its last offset.
3. **Given** any pan, **Then** grid content is unchanged — panning shifts only what is visible.

---

### Edge Cases

- **No spawn marker at all**: only reachable by erasing the spawn without placing a new one. The editor does not require a spawn before allowing export; the developer is responsible for placing one before using the layout in the game, whose parser fails without it.
- **Painting the same cell repeatedly with the same tool**: a no-op after the first paint.
- **Erasing the only non-empty cell at the grid's outer edge**: the stored grid keeps its size — it never auto-shrinks — but the next export crops to the new tightest bounding box, so the exported layout shrinks even though the grid did not.
- **Erasing every cell back to entirely empty**: export returns a single empty row rather than failing or returning nothing.
- **A sprite sheet fails to load**: that layer is skipped on every frame; the rest of the grid still renders.
- **Very large grids**: no maximum is enforced. This is a dev tool operated at human click speed, not a hot loop, so performance beyond realistic level sizes is not a concern (see Out of Scope).
- **Editor state persisted before a level-format character change**: persisted state holds the characters that were current when it was written, and there is no migration. Loading a level from the dropdown replaces it.

---

## Requirements _(mandatory)_

### Functional Requirements

#### Access

- **FR-001**: The editor MUST be reachable both from an entry point in the IDE theme's View menu and by navigating directly to `/platformer/editor`, and MUST render independently of which theme is currently selected. Opening it from the menu MUST NOT reload the page, so state held only in memory survives the transition.

#### Grid State and Painting

- **FR-002**: The editor MUST open with a level already loaded — the shipped `main` level on a first open, and otherwise the grid, selected tool, open level name and edited flag as they were when the editor was last used.
- **FR-003**: The editor MUST let the developer select one palette tool at a time, with the active tool visually highlighted.
- **FR-004**: Left-clicking a cell MUST paint the selected tool into it, overwriting any existing value with no confirmation; left-click-dragging MUST paint every cell along the cursor's path.
- **FR-005**: Right-clicking MUST erase the cell under the cursor regardless of the selected tool, and MUST NOT change the selected tool; right-click-dragging MUST erase every cell along the path. The browser context menu MUST be suppressed on the canvas at all times.
- **FR-006**: The palette MUST offer an explicit Eraser tool distinct from the terrain and entity tools.
- **FR-007**: Placing the spawn marker MUST clear whichever cell previously held it, in the same paint action — never a blocking guard, never a warning — so at most one spawn exists at any moment.
- **FR-008**: The palette MUST offer one entry for every terrain tile and every entity marker the level format defines (see [LevelFormat.md](../../docs/themes/platformer/LevelFormat.md)), derived from that catalog rather than restated in the editor, so a newly defined placeable appears without an editor change.

#### Rendering

- **FR-009**: The editor MUST draw the grid at the game's rendered tile size, using the game's own sprite sheets and tile-selection rules — including terrain autotiling — rather than reimplemented or placeholder rendering.
- **FR-010**: Every sprite MUST be drawn at a single fixed at-rest frame: no coin bob, no enemy walk cycle, no block bump or shatter, no chest opening.
- **FR-011**: The editor MUST redraw only in response to a state change — a paint, a pan, or a grid growth — and MUST NOT run a continuous animation loop.
- **FR-012**: A sprite sheet that has not loaded or failed to load MUST cause only its own layer to be skipped for that frame, never a failure of the whole render.

#### Panning and Growth

- **FR-013**: Middle-mouse drag MUST pan the view freely in two dimensions, shifting only what is visible and never altering grid content. This pan is the editor's own and is unrelated to the game's camera.
- **FR-014**: Every visible cell MUST be rendered as grid, including coordinates outside the stored content, so panning into unpainted territory shows empty grid rather than blank space. Panning alone MUST NOT grow the grid.
- **FR-015**: Painting or erasing a cell outside the current bounds MUST grow the grid just enough to include it, padding the new area empty, in one or both dimensions as needed.
- **FR-016**: Growth at the left or top edge MUST NOT move any already-painted content on screen — the view MUST compensate for the shift within the same update.
- **FR-017**: Growth MUST preserve every existing cell's value, and the grid MUST NOT auto-shrink when content is erased.

#### Export

- **FR-018**: The editor MUST produce a layout in exactly the shape the game's level parser accepts — one string per row, top row first, equal row lengths — cropped to the tightest rectangle containing every non-empty cell. An entirely empty grid MUST export as a single empty row.
- **FR-019**: The editor MUST display the current export in a read-only text area together with a control that copies the exact displayed text to the clipboard.

#### Level Selection and Saving

- **FR-020**: The editor MUST list, in order, a built-in `main` entry (the shipped level), a built-in `empty` entry (three ground tiles with a centered spawn), and one entry per saved level file, each carrying an identifier, a human-readable name, and a layout.
- **FR-021**: A saved level file that is malformed — not an object, missing a layout, or a layout that is not rows of text — MUST be skipped without preventing the remaining entries from loading.
- **FR-022**: Picking an entry MUST replace the grid with that level's layout, recenter the view on its spawn tile, and update the restored-on-reload copy of the grid so a reload does not bring the discarded edits back. The editor MUST NOT provide separate Reset or Scratch controls — `main` and `empty` are dropdown entries.
- **FR-023**: The editor MUST remember the name of the level the grid was loaded from or last saved as, and whether it has been edited since, both surviving a reload. That remembered name need not correspond to a listed entry — a level saved but not yet moved into the levels folder has no entry of its own.
- **FR-024**: The edited flag MUST be set by every paint and erase and cleared by every level load and save. While it is set, a dropdown selection MUST open a confirmation dialog naming both levels; while it is clear, the selection MUST load with no dialog. Cancelling MUST leave the grid, the selected tool, the restored-on-reload copy, and the flag itself untouched. The flag is deliberately not a comparison against the loaded layout: painting a cell and painting it back still counts as an edit, which costs one unnecessary confirmation and avoids diffing a level-sized grid on every stroke.
- **FR-025**: Save MUST ask for a level name, prefilled with the open level's name, and produce a level file holding that name and the current export, under the slugified name.
- **FR-026**: Save MUST clear the edited flag and adopt the entered name as the open level's name. A successful write MUST close the dialog and report the written path outside it; that report MUST be dropped as soon as the grid is painted again or another level is loaded.
- **FR-027**: The file MUST be written by the dev server into the levels folder the level list reads, so a saved level needs no moving to appear in the dropdown. Where that write is unavailable — including every built site, which never serves it — the editor MUST fall back to downloading the file and MUST keep the save dialog open saying so, rather than implying a file reached the repository.
- **FR-028**: Before writing, the dev server MUST reject any filename that is not a bare slugified level file, any path that would resolve outside the levels folder, and any contents the level list would not accept — writing nothing in each case. It MUST create the levels folder if it is absent and MUST overwrite an existing file of the same name.

### Key Entities

- **Grid** — the level under edit: one cell per placeable position, each holding a terrain tile, an entity marker, or nothing. It has no fixed size; it grows as painting demands and never shrinks on its own.
- **Tool** — the single palette selection that a left-click paints. One tool per terrain tile and entity marker the level format defines, plus an Eraser.
- **Spawn marker** — the one entity marker with a uniqueness constraint: at most one exists on the grid at any moment.
- **View offset** — where the grid sits within the visible canvas. Changed by panning, and adjusted automatically when the grid grows at the left or top edge so nothing appears to move.
- **Level entry** — one selectable level: the built-in `main`, the built-in `empty`, or a saved level file. Carries an identifier, a display name, and a layout.
- **Open level** — the name the grid was loaded from or last saved as, paired with the edited flag that guards discarding its changes.
- **Exported layout** — the grid serialized into the game's level format, cropped to its content.
- **Saved level file** — a named layout stored in the levels folder; its file shape is documented in [LevelFormat.md](../../docs/themes/platformer/LevelFormat.md).

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Real sprites, not placeholders**: every terrain tile and entity marker the level format defines renders in the editor with the same sprite sheet and frame-selection the game uses.
- **SC-002 — Exactly one spawn, always**: after any sequence of spawn placements, the grid holds at most one spawn marker — none before the first placement, exactly one thereafter.
- **SC-003 — Export round-trips through the real parser**: any grid produced entirely through the editor's paint and erase operations, including paints that grew it in any direction, exports to a layout the game's parser accepts without error.
- **SC-004 — No animation loop**: redraws occur only in direct response to a paint, pan or growth; a run of synchronous paints with no timers advanced produces a fixed, matching number of redraws.
- **SC-005 — Growth never loses content**: after any sequence of out-of-bounds paints in any direction, every previously painted cell holds the value it held before.
- **SC-006 — Growth left or up never visually moves content**: whenever the grid grows at the left or top edge, every pre-existing cell's on-screen position is unchanged.
- **SC-007 — Export always crops to the tightest content bounding box**: regardless of how far the grid has grown or how much has been erased, the export's dimensions equal the smallest rectangle containing every non-empty cell — never larger, never smaller.
- **SC-008 — An unedited load round-trips**: opening the editor and exporting without editing yields the loaded level's own layout, cropped by the same unconditional rule as any other grid state.
- **SC-009 — Level loading never silently discards edits**: once anything has been painted, picking a level — including the one already loaded — leaves the grid, the selected tool and the restored-on-reload copy untouched until the confirmation is confirmed; with nothing painted since the last load or save, no dialog appears at all.
- **SC-010 — A saved level round-trips back into the dropdown**: a file the editor saves satisfies the level list's own validity check and, in the levels folder, yields an entry whose layout reloads to the grid that was saved.
- **SC-011 — Saving needs no manual file move, and never lies about it**: with the dev server running, a save leaves the file in the levels folder, closes the dialog and names that path until the grid changes again; with the write unreachable, the file is downloaded instead and the dialog stays open saying so.
- **SC-012 — The write can never reach outside the levels folder, and no build serves it**: no filename containing a path separator, a parent-directory step, a drive letter, or a non-level extension results in a write, and no built site serves the write route at all.
- **SC-013 — Zero TypeScript errors**: the editor compiles under strict mode with no `any` and no suppressed errors.
- **SC-014 — Reachable without the game's debug panel**: the editor can be opened from the IDE theme's View menu in every locale, without first entering the game or enabling its debug controls.

---

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) is implemented far enough to provide the level format, the game's drawing routines, and its entity state.** This editor is an authoring tool layered on top of the existing game, not a co-requirement of it.
- **The palette follows the level format, not this spec.** Enemy markers come from [F-017](../F-017-platformer-enemies/spec.md), destroyable blocks from [F-018](../F-018-platformer-blocks/spec.md), chests from [S-007](../S-007-platformer-chests/spec.md), ladders and chains from [S-008](../S-008-platformer-ladders/spec.md). The editor places whatever the format defines and adds nothing of its own.
- **Only things the format places directly are placeable.** A collectible that exists only after a block is hit has no palette entry of its own — the block does.
- **The editor draws entities without their CV content.** Placed markers carry no CV fact, because nothing in the game's drawing routines reads one.
- **No validation of exported layouts beyond what the game's parser itself checks** — the editor does not warn about an unreachable coin or an enemy placed inside solid terrain.
- **Desktop-only** — like the rest of the platformer theme ([F-015](../F-015-platformer-theme/spec.md)) and the space theme (S-005), this dev tool assumes a mouse and is not designed for touch input.

---

## Out of Scope

- **The visitor-facing half of level selection** — choosing a level while playing, and loading one from a URL — is [O-007](../O-007-platformer-level-selection/spec.md). The dropdown described here is editor-only.
- **Blueprint authoring** — the second canvas for building reusable rooms, and placing them into a level — is [O-006](../O-006-platformer-blueprints/spec.md).
- Zoom — the canvas is drawn at a fixed tile scale, with panning as the only way to reach content off screen.
- Manual size controls (width and height inputs, shrink confirmations) — sizing is fully automatic through seamless growth, cropped on export.
- Canvas virtualization or an enforced maximum grid size — acceptable for a human-paced dev tool at realistic level sizes.
- Undo and redo of paint actions.
- Direct file writes from the page itself, and any write outside the levels folder — pasting an exported layout into the shipped level stays manual.
- Writes into the repository from a built site — the write is dev-server only, and Save falls back to a download everywhere else.
- Animated sprites — every sprite renders at a single fixed at-rest frame.
- Playtesting-equivalent validation: unreachable collectibles, enemies embedded in solid terrain, a missing spawn marker before export.
- A blocking spawn-placement guard or warning — resolved as silent auto-relocate instead.
- A generic "paste in any layout" import area — layouts enter the editor only through the level list.
- Renaming, deleting, or overwriting existing level files from the editor.
- Mobile and touch input.
