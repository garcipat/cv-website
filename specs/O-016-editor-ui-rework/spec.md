# Feature Specification: Editor UI Rework

**Feature Branch**: `O-016-editor-ui-rework`  
**Created**: 2026-09-20  
**Status**: Draft  
**Input**: User description: "O-016 Editor UI Rework (GitHub issue #54) — Give the Level Editor a real toolbar so commands and toggles stop being mushed into the tile catalog, and clean up the structure underneath."

## Clarifications

### Session 2026-09-20

- Q: Toolbar form — a right-aligned row in the editor page header, or a floating control bar pinned over the top-right of the canvas? → A: A right-aligned row in the editor page header, beside the editor's title. Not a floating overlay over the canvas.
- Q: State scope — do the level/blueprint grids and their background placements also move to signals, or keep their local-state-plus-debounced-persistence path while only the discrete selections move? → A: All editor state moves to signals, consolidated into a single `editorState` module. The storage write may stay debounced so a drag-paint stroke persists once at the end, but the signal is the source of truth and no second local copy of the grid is kept.
- Q: One feature or a split? → A: One feature (O-016), delivered in two ordered phases — the behaviour-preserving technical refactor first, then the toolbar and tiles-only Palette. No new feature ID.
- Q: Narrow-viewport toolbar behaviour — wrap onto additional rows, scroll horizontally, or collapse into an overflow menu? → A: Wrap onto additional rows within the header. The header grows taller as needed and every control stays visible; no hidden affordances and no horizontal scroll.
- Q: How do sighted users discover what an icon-only control does? → A: Add a tooltip (shadcn `tooltip` component) that shows the control's name on hover and focus.
- Q: Should the rework add accessibility/ARIA requirements (accessible names, a toolbar role, roving tabindex)? → A: No — the project has not maintained ARIA requirements so far and this rework adds none; controls remain in the browser's normal Tab order.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Commands live in a toolbar, not in the tile catalog (Priority: P1)

A level author opens the editor and immediately sees a compact toolbar at the right of the editor's header row holding every command and toggle. The left sidebar is now purely a tile catalog: it shows tiles and nothing else, so choosing a tile is never confused with issuing a command.

**Why this priority**: This is the visible point of the rework. Today the sidebar is one undifferentiated scrolling column where a layer toggle, a canvas toggle, tile groups, level controls, blueprint controls, and a Try button all compete for the same space. Separating "what I paint with" from "what I do" is the change that makes the editor legible, and it is the prerequisite for O-015's dark-mode toggle to have a sensible home.

**Independent Test**: Render the editor and inspect the two regions — the toolbar contains the layer toggle, canvas toggle, Undo, Save, Export, Try, and the level/blueprint selector; the Palette contains only tile choices. Delivers the value of a legible editor even if the structural cleanup (US3/US4) is not done yet.

**Acceptance Scenarios**:

1. **Given** the editor is open on the level canvas, **When** it renders, **Then** a toolbar is visible at the right of the editor's header row containing the layer toggle, the canvas toggle, Undo, Save, Export, Try, and the level/blueprint selector.
2. **Given** the editor is open, **When** the author inspects the Palette, **Then** it contains only tile choices in collapsible groups and no commands or toggles.
3. **Given** a control in the toolbar, **When** the author activates it, **Then** it performs the same action the text button it replaced performed.
4. **Given** the toolbar controls are icon-only, **When** the author hovers or keyboard-focuses one, **Then** a tooltip shows the name of the command it performs.

---

### User Story 2 - Every existing command keeps working from its new home (Priority: P2)

A level author who relied on the old sidebar finds every command still behaves exactly as before: Undo restores the last placement, Export shows the layout text, Try launches the level in the game, Save writes the file, the layer and canvas toggles switch what is painted, and the level/blueprint selector loads entries with the same discard confirmation.

**Why this priority**: This is a rework of a working editor, not a redesign of its behavior. Relocating controls is only safe if nothing regresses. It ranks below US1 because the toolbar is what makes the editor usable, but above the internal cleanup because a regression here would be worse than a messy file.

**Independent Test**: Walk the full authoring loop — pick a tool, paint, place a blueprint, undo the placement, export, save, try — entirely through the new toolbar and confirm each outcome matches the pre-rework behavior.

**Acceptance Scenarios**:

1. **Given** a blueprint placement was just committed, **When** the author activates Undo, **Then** the grid and background return to their state immediately before that placement, and Undo is not offered once anything else has been edited.
2. **Given** the author presses Ctrl+Z (Cmd+Z on Mac) on the level canvas with a placement to undo, **When** the shortcut fires, **Then** it performs the same undo as the toolbar control; it is ignored while typing in a dialog field and while the blueprint canvas is active.
3. **Given** the page is served by the dev server, **When** the author activates Save, **Then** the save dialog opens prefilled with the loaded level's name, a successful write closes the dialog and reports the written path, and a fallback download keeps the dialog open and explains that the file must be moved manually.
4. **Given** the page is a built site with no dev server, **When** the editor renders, **Then** Save is not offered, while Export and Try remain available.
5. **Given** the author activates Export, **When** the dialog opens, **Then** it shows the exported layout text and offers to copy it.
6. **Given** the author activates Try, **When** it completes, **Then** the current level becomes the in-memory layout the game reads, prior game progress is cleared, the platformer theme is active, and the game is shown with its debug panel available.
7. **Given** the author activates the canvas toggle, **When** the canvas becomes the blueprint canvas, **Then** the Palette switches to blueprint-appropriate tiles (no Spawn, plus Connection Point) and the toolbar drops the level-only actions.
8. **Given** unsaved edits exist, **When** the author picks another level or blueprint from the selector, **Then** the editor asks for confirmation before discarding, and picking the already-open entry still reloads it.

---

### User Story 3 - The editor's shared state has one source of truth (Priority: P3)

A developer working on the editor reads and writes all of the editor's state — the level and blueprint grids, their background placements, and the author's selections (selected tool, active layer, canvas mode, selected background piece, loaded names, dirty flags, armed blueprint) — through signals in a single `editorState` module, instead of through local copies seeded from a signal and written back by hand.

**Why this priority**: Today the page seeds six persisted values into local state and mirrors them back, and keeps the two grids in local state too, writing them into the signal on a debounce. That duplication is where the staleness bugs and the "which copy is authoritative?" confusion live. Consolidating the state into one module makes the remaining work — O-015's persisted toggle, and any future editor feature — a matter of declaring one value rather than threading another copy through the page.

**Independent Test**: Change a persisted selection in the editor, reload, and confirm the same value comes back; confirm the value is read identically by every component that displays it, with no second copy that can drift.

**Acceptance Scenarios**:

1. **Given** the author selects a tool, layer, canvas, or background piece, **When** the editor is reloaded, **Then** each selection is restored exactly as the author left it.
2. **Given** a component displays a persisted selection, **When** that selection changes elsewhere in the editor, **Then** the component reflects the change without a separate local copy being synchronised by hand.
3. **Given** the author has unsaved edits, **When** the editor is reloaded, **Then** the unsaved grid and background work are still present and the dirty flag still reports unsaved changes.

---

### User Story 4 - Duplicated dialogs and selectors are unified, and the page is presentational (Priority: P4)

A developer changes the level-save dialog's wording, or the selector's discard prompt, in exactly one place and both the level and blueprint canvases pick it up. The screen component that lays out the editor no longer contains persistence, file I/O, or placement logic — it renders what those pieces give it.

**Why this priority**: This is the maintainability payoff that makes the next editor feature cheap to add. It is last because it delivers no new author-facing capability on its own, but it is what stops the file from growing back.

**Independent Test**: Inspect the editor's screen component and confirm it holds no persistence, file-I/O, or placement logic; change a shared dialog's copy once and confirm both canvases show the change.

**Acceptance Scenarios**:

1. **Given** the author saves a level and then a blueprint, **When** each save dialog is shown, **Then** both present the same behaviour (name field, dev-server result message, cancel/done controls) and differ only in the labels, target folder, and default name.
2. **Given** the author loads a level and then a blueprint while dirty, **When** each confirmation is shown, **Then** both present the same discard-and-load behaviour and differ only in the entry source and wording.
3. **Given** the editor's screen component, **When** a developer inspects it, **Then** it contains no persistence, file-I/O, or placement/undo logic, and that logic is covered by its own tests.

---

### Edge Cases

- ✅ **Icon-only discoverability**: Icon-only toolbar controls must not lose their identity to a sighted author — each shows a tooltip with the command's name on hover and focus (FR-004).
- ✅ **Narrow viewport**: The toolbar wraps onto additional rows within the header when the viewport is too narrow for a single row — the header grows taller and every control stays visible, with no hidden affordances and no horizontal scroll. The toolbar must not overlap the canvas or be clipped, and the Palette remains independently scrollable (FR-001).
- ✅ **Blueprint mode**: Level-only actions (Export, Try, Undo) are absent on the blueprint canvas, and Save presents itself as saving a blueprint. Blueprint nesting stays out of scope (FR-005).
- ✅ **No dev server**: On a built site, Save and Save Blueprint are absent in both canvases; Export and Try still work (FR-006).
- ✅ **No blueprints saved yet**: The selector still offers the blank/new entry, and the Palette's Blueprints group is absent rather than empty-headed (FR-009, FR-013).
- ✅ **Deleted blueprint still armed in storage**: A persisted armed-blueprint id whose file no longer exists resolves to "nothing armed" — no preview, no pressed tile, clicks paint normally (FR-013).
- ✅ **Already-open entry**: Choosing the entry currently open still reloads it (the selector is an action menu, not a bound value), which is how "give me the shipped level back" is expressed (FR-013).
- ✅ **Undo availability**: Undo is offered only while the one-shot placement snapshot is valid; any paint, erase, background change, level load, or further placement clears it (FR-010).
- ✅ **Drag-paint responsiveness**: A drag-paint stroke must keep paint feedback under 200 ms per cell (Constitution Principle V) even though the grid is signal-backed — no painted cell is dropped, and storage is not written once per cell (FR-018).
- ✅ **Scope boundary — dark mode**: A dark-mode toggle is explicitly **not** part of this feature; it is O-015 and is expected to be added to this toolbar afterwards (FR-023).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The editor MUST present a single toolbar as a right-aligned row in the editor page header, sitting beside the editor's title, hosting all editor commands and toggles and remaining separate from the tile Palette. It MUST NOT be a floating bar drawn over the canvas. On a viewport too narrow for one row, the toolbar MUST wrap onto additional rows within the header rather than scroll horizontally or collapse controls into an overflow menu.
- **FR-002**: The toolbar MUST contain the layer toggle (Foreground/Background), the canvas toggle (Level/Blueprint), Undo, Save, Export, Try, and the level/blueprint selector.
- **FR-003**: Toolbar controls MUST be compact, icon-size buttons built from the existing `Button` component (`size="icon"`/`icon-sm`) rather than the previous text buttons (see `contracts/toolbar-ui.md`).
- **FR-004**: Every icon-only toolbar control MUST show a tooltip naming the command it performs (Foreground, Background, Level, Blueprint, Undo placement, Save, Export, Try, and the selector's own name) on hover and on keyboard focus.
- **FR-005**: The toolbar MUST adapt to the active canvas: level-only actions (Export, Try, Undo) MUST be absent in blueprint mode, and Save MUST present as saving a blueprint in blueprint mode.
- **FR-006**: Save MUST remain available only when the page is served by the dev server; Export and Try MUST remain available regardless.
- **FR-007**: The Palette MUST contain only tile choices and MUST NOT contain any command or toggle.
- **FR-008**: The Palette MUST keep its collapsible tile groups and MUST continue to derive its tiles from the tile catalog rather than a hand-maintained list.
- **FR-009**: Palette contents MUST continue to follow the active layer and canvas mode: foreground tile groups vs background groups, Spawn only on the level canvas, Connection Point only on the blueprint canvas, and the Blueprints group only on the level canvas when blueprints exist.
- **FR-010**: Undo MUST restore the grid and background to their state immediately before the most recent blueprint placement, MUST be offered only while that snapshot is valid, and MUST be cleared by any other edit; Ctrl/Cmd+Z on the level canvas MUST perform the same action and MUST be ignored while typing in a dialog field or while the blueprint canvas is active.
- **FR-011**: Export MUST open a dialog containing the exported layout text and a copy-to-clipboard action.
- **FR-012**: Try MUST export the current level, install it as the in-memory layout the game reads, clear prior game progress, select the platformer theme, and navigate to the game with the debug panel enabled.
- **FR-013**: The level/blueprint selector MUST present the entries for the active canvas (levels on the level canvas, blueprints on the blueprint canvas), MUST load the chosen entry, MUST confirm before discarding unsaved edits, and MUST reload the entry that is already open when it is chosen again.
- **FR-014**: Saving MUST crop the level/blueprint before writing, MUST write through the dev server when available and fall back to a download otherwise, MUST report which of the two happened, and MUST clear the dirty flag and close the dialog on a successful write.
- **FR-015**: The editor's screen component MUST be presentational — persistence, file I/O, and placement/undo logic MUST live outside it.
- **FR-016**: All editor state — including the level and blueprint grids and their background placements, not only the discrete selections — MUST be held as signals owned by a single `editorState` module, which is the editor's one home for that state.
- **FR-017**: No component may keep a second local copy of editor state or treat a local copy as authoritative; the signals in `editorState` are the sole source of truth for every editor value (the invariant of FR-016).
- **FR-018**: Persisting editor state to browser storage MAY remain debounced, so that a drag-paint stroke does not write storage once per cell. The debounce MUST apply only to the storage write — the signal remains the source of truth at all times.
- **FR-019**: Truly transient interaction state — the hovered cell, open/closed dialogs, an in-progress drag, and loaded sprite resources — MAY remain component-local. These are not copies of editor state and MUST NOT be used to hold editor state authoritatively.
- **FR-020**: The level-save and blueprint-save dialogs MUST be served by one shared dialog implementation that differs only in labels, target folder, and default name.
- **FR-021**: The level and blueprint selectors MUST be served by one shared selector implementation that differs only in its entry source and labels.
- **FR-022**: All currently persisted editor state MUST keep its existing storage identity, so an author's in-progress work and selections survive this rework unchanged.
- **FR-023**: This feature MUST NOT introduce a dark-mode toggle, editor theming, or any cave-lighting preview — those remain O-015.
- **FR-024**: Existing editor tests MUST be preserved and updated to the new structure; assertions MUST NOT be weakened or deleted to accommodate the rework.
- **FR-025**: The rework MUST NOT change gameplay behaviour: the layout a level exports, the file a save writes, and the level the Try action launches MUST be identical to the pre-rework results for the same input.

### Key Entities _(include if feature involves data)_

- **Editor toolbar**: The right-aligned row in the editor's page header that hosts the layer toggle, canvas toggle, Undo, Save, Export, Try, and the entry selector. Its contents vary by active canvas.
- **Tile palette**: The tile-only catalog browser in the sidebar, organised in collapsible groups and derived from the tile catalog.
- **Editor state module (`editorState`)**: The single home for all of the editor's state, held as signals, and the sole source of truth for the values below. The existing `editorLevelState` module is its seed, consolidated into it.
- **Editor session state**: The author's working state held in that module — selected tool, active layer, active canvas, selected background piece, level and blueprint grids, their background placements, loaded names, dirty flags, and the armed blueprint.
- **Shared save dialog**: The one dialog both saves use (FR-020).
- **Shared entry selector**: The one dropdown both canvases use (FR-021).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of the commands and toggles that were reachable from the old sidebar are reachable from the toolbar, and none remain inside the Palette.
- **SC-002**: A level author can complete the full authoring loop — select a tool, paint, place a blueprint, undo the placement, export, save, and try the level — using only the toolbar and the Palette, with each outcome matching pre-rework behaviour.
- **SC-003**: The editor's existing test suites (editor page, Palette, level selector, blueprint selector, canvas) all pass after being updated to the new structure, with no reduced coverage.
- **SC-004**: The editor's screen component contains no persistence, file-I/O, or placement/undo logic; each of those concerns is exercised by its own tests.
- **SC-005**: The number of near-identical save-dialog implementations drops from two to one, and the number of near-identical selector implementations drops from two to one.
- **SC-006**: Persisted state round-trips: after a reload, the tool, layer, canvas, background piece, loaded names, and any unsaved edits are exactly as the author left them.
- **SC-007**: Changing any editor value in one place is reflected everywhere that value is displayed with no manual synchronisation, and no component-local duplicate of an `editorState` value exists to drift (exercised by the `editorState`/`editorActions` suites and the migrated page suite).
- **SC-008**: Drag-painting a stroke keeps paint feedback under 200 ms per cell (Constitution Principle V) with no dropped cell, and the stroke persists correctly across a reload without a storage write per painted cell.
- **SC-009**: Every icon-only toolbar control reveals its name visually on hover and on keyboard focus.

## Assumptions

- **Behaviour-preserving rework**: Unless the ticket explicitly changes something, this feature relocates and restructures; it does not alter what the editor does. The exported layout, saved files, and Try result are unchanged.
- **Toolbar placement (decided)**: The toolbar is a right-aligned row in the editor page header beside the editor's heading — not a floating overlay drawn over the canvas (FR-001).
- **State ownership (decided)**: All editor state, including the level and blueprint grids and their background placements, lives in signals in a single `editorState` module. The existing `editorLevelState` module is consolidated into it, and the existing storage keys are preserved so no in-progress author work is lost (FR-016, FR-017, FR-022).
- **Paint responsiveness**: Covered by FR-018 — the debounce applies to the storage write only, never to the signal, so a drag stroke persists once at the end and the signal is never a second copy.
- **Ephemeral interaction state**: The hovered cell, open/closed dialogs, an in-progress drag, and loaded sprite resources stay component-local, following the ticket's own carve-out. These are interaction state, not copies of editor state (FR-019).
- **Palette stays in the sidebar**: Only the commands and toggles move out; the Palette keeps its left-sidebar position, its collapsible groups, and the palette-from-catalog rule (F-019).
- **Page heading retained**: The editor's title heading remains.
- **Icons and tooltips**: "Small icon buttons" means icons drawn from the project's existing icon library; no new icon dependency is introduced. A tooltip component is added (`npx shadcn@latest add tooltip`) so every icon-only control shows its name on hover and focus (FR-004).
- **No accessibility/ARIA requirements**: The project has not maintained ARIA requirements so far and this rework adds none — no accessible-name, toolbar-role, or roving-tabindex requirement. Toolbar controls stay in the browser's normal Tab order, and existing tests are updated to locate the icon-only controls without relying on an accessible name (FR-024).
- **Two-phase delivery (single feature)**: O-016 remains one feature and one spec, implemented in two ordered phases — (1) the behaviour-preserving technical work first (extract persistence/file I/O/placement out of the page, consolidate state into `editorState`, de-duplicate the save dialogs and the selectors), then (2) the visible UI change (header toolbar and tiles-only Palette). No separate feature ID is created.
- **Undo scope unchanged**: Undo remains a one-shot undo of the most recent blueprint placement; no general edit history is introduced.
- **No new editor capabilities**: Zoom, multi-select, tile search, and similar authoring features are out of scope.
- **Blueprint nesting stays out of scope**: A blueprint still cannot contain a blueprint.
- **Dark mode deferred**: The toolbar is designed so O-015 can add a persisted dark-mode toggle later; no theming work happens here.
- **Dev-server gating unchanged**: Save remains a development-only affordance, exactly as today.
- **Storage identity unchanged**: Existing persisted keys keep their meaning, so no migration is needed and no author work is lost.

## Dependencies

- **F-019 Level Editor** (implemented) — the editor this feature reworks.
- **O-010 Cave Lighting**, **O-011 Deployable Ladders**, **O-013 Wall Torches** (implemented) — editor-visible behaviour that must survive the rework unchanged.
- **O-015 Editor Dark Mode** (not implemented) — depends on the toolbar introduced here; deliberately excluded from this spec.
