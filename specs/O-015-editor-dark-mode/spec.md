# Feature Specification: Editor Dark Mode

**Feature Branch**: `O-015-editor-dark-mode`  
**Created**: 2026-09-20  
**Status**: Draft  
**Input**: User description: "i want to specify the feature O-015 with the dark mode in the editor"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - One control switches the editor to a dark appearance, and it remembers (Priority: P1)

A level author working late on a cave level presses a single control in the editor toolbar and the whole editor turns dark. They reload the page — or close the tab and come back tomorrow — and the editor is still dark. Pressing the control again returns the editor to its light appearance, and that choice sticks too.

**Why this priority**: This is the feature. Everything else is what "dark" means; without a control that switches the editor and remembers the choice, there is no dark mode. It is also the piece O-016 deliberately built a home for: its toolbar exists so this toggle has a sensible place to live.

**Independent Test**: Open the editor, activate the dark-mode control, confirm the editor's appearance changes, reload, and confirm the appearance is unchanged; activate it again and confirm the light appearance returns and also survives a reload.

**Acceptance Scenarios**:

1. **Given** the editor is open in its light appearance, **When** the author activates the dark-mode control, **Then** the editor's appearance switches to dark.
2. **Given** the editor is dark, **When** the author reloads the page, **Then** the editor renders dark again without the author having to ask for it.
3. **Given** the editor is dark, **When** the author activates the control again, **Then** the editor returns to its light appearance, and that choice also survives a reload.
4. **Given** no appearance has ever been chosen, **When** the editor is opened for the first time, **Then** it renders in its light appearance.

---

### User Story 2 - The dark editor is dark everywhere and still readable (Priority: P2)

An author in dark mode finds that the whole editor has gone dark — not just a strip of it. The page, the title, the toolbar, the tile palette, the save and export dialogs, the level/blueprint selector, and the status text are all dark surfaces with legible text and controls, and the canvas backdrop is dark rather than the game's daylight sky. Nothing is left as a bright island, and nothing becomes unreadable.

**Why this priority**: A "dark mode" that leaves half the screen bright, or that makes a label vanish, is worse than no dark mode at all. Coverage and legibility are what make US1's toggle actually useful, but they build on the toggle, so they come after it.

**Independent Test**: Turn dark mode on and walk every editor surface — header, toolbar, palette groups and tiles, both dialogs, both selectors, save status, and the canvas backdrop — confirming each is dark and every label/control is legible against its background.

**Acceptance Scenarios**:

1. **Given** dark mode is on, **When** the author inspects the editor page and its header, **Then** both render in dark surfaces with legible text.
2. **Given** dark mode is on, **When** the author inspects the toolbar and the tile palette, **Then** their panels, tile swatches, labels, active/selected states, and hover states are all legible in the dark palette.
3. **Given** dark mode is on, **When** the author opens the save dialog, the export dialog, and the level/blueprint selector, **Then** each renders dark with legible text and controls.
4. **Given** dark mode is on, **When** the canvas renders, **Then** its backdrop is dark rather than the game's daylight sky colour, and the grid lines and tile art remain readable against it.
5. **Given** dark mode is on, **When** the author changes the site-wide theme selection on another page and returns to the editor, **Then** the editor's dark appearance is unchanged.

---

### User Story 3 - Dark mode previews how the cave will look in play (Priority: P3)

An author building a cave turns on dark mode and the canvas shows the level the way the game will show it underground: the scene goes dark, wall torches push warm pools of light back through the gloom, the player carries their small glow, and enemies in the dark give themselves away as glowing yellow eyes. The author can place or remove torches and move the spawn and watch the preview follow, all without launching the game.

**Why this priority**: This is the reason the feature depends on cave lighting, and it is what makes dark mode more than a colour swap — but it is a preview aid layered on top of a working dark appearance, so it comes last.

**Independent Test**: Turn dark mode on and confirm the whole level canvas is darkened, with a warm light pool around each torch, the spawn's carried glow, and enemy eye markers; then remove the torches and confirm only the darkness and the player's glow remain.

**Acceptance Scenarios**:

1. **Given** dark mode is on, **When** the level canvas renders, **Then** the whole canvas is darkened and every torch in view shows a warm, soft light pool punching through it.
2. **Given** dark mode is on and the level has no spawn, **When** the level canvas renders, **Then** the canvas is still darkened and every torch still lights a pool, but no player glow is shown.
3. **Given** a living enemy stands in a locally dark area, **When** dark mode is on, **Then** the enemy is marked by glowing yellow eyes, exactly as it would be in play.
4. **Given** the player has a carried light, **When** dark mode is on, **Then** a small warm glow keeps the player discernible in the darkness.
5. **Given** dark mode is on, **When** the author edits the level — moving the spawn, painting cave pieces, placing or removing torches — **Then** the preview updates to match without a reload.
6. **Given** the blueprint canvas is active, **When** dark mode is on, **Then** the canvas and chrome are dark but no cave-lighting preview is shown.
7. **Given** dark mode is on, **When** the author exports or saves the level, **Then** the exported layout and the saved file are identical to what they would have been with dark mode off.

---

### Edge Cases

- ✅ **No spawn in the level**: Dark mode still darkens the whole scene; only the player's carried glow is absent, so the preview reads as a torch-lit cave with no player (FR-008, FR-009).
- ✅ **No torches in the scene**: With no torches the canvas is dark to the preview level, and the player's own glow (when a spawn exists) is the only light in the scene (FR-008).
- ✅ **Blueprint canvas**: Blueprints have no lighting preview, so the blueprint canvas gets the dark chrome and backdrop but never a cave-lighting preview (FR-011).
- ✅ **Background layer active**: The existing foreground-dimming behaviour and the cave-lighting preview must compose without making the canvas unreadable — neither effect may hide the layer the author is painting (FR-012).
- ✅ **Editor markers over darkness**: Grid lines, sign badges, patrol and connection-point markers, and the pending placement preview must stay legible while the cave-lighting preview is drawn (FR-012).
- ✅ **Painting with dark mode on**: A drag-paint stroke must keep its per-cell feedback under 200 ms (Constitution Principle V) and drop no cell, even though every painted cell also changes the preview (FR-018).
- ✅ **Global theme changed elsewhere**: Switching the site-wide theme while dark mode is on must not alter the editor's own appearance (FR-004).
- ✅ **Stored value missing or invalid**: An absent or unreadable stored appearance resolves to the light appearance rather than failing (FR-003).
- ✅ **Rapid toggling**: Repeatedly toggling the control must not leave the editor and its stored choice out of step, and must not flicker (FR-003, FR-018).
- ✅ **Built site, no dev server**: Dark mode is purely client-side and works on the built site exactly as in development; only Save remains a dev-only affordance (FR-014).

## Requirements _(mandatory)_

### Functional Requirements

**The control and its persistence**

- **FR-001**: The editor MUST offer a single control that switches its appearance between the light appearance and the dark appearance.
- **FR-002**: The control MUST live in the editor toolbar introduced by O-016, MUST follow that toolbar's icon-control visual language, and MUST reveal its name and current state on hover and on keyboard focus.
- **FR-003**: The chosen appearance MUST persist across reloads under the editor's own storage identity; an absent or unreadable stored value MUST resolve to the light appearance.
- **FR-004**: The editor's appearance MUST be owned by the editor and MUST NOT depend on the site-wide theme selection, so its light/dark look is the same whichever theme the visitor has chosen elsewhere.

**The dark appearance**

- **FR-005**: In the dark appearance the editor's entire chrome MUST render in a dark palette — page, header, toolbar, tile palette, save and export dialogs, level/blueprint selector, and status text — with every label, control, and interactive state legible against its background, meeting WCAG AA contrast (≥ 4.5:1 for text, ≥ 3:1 for non-text UI boundaries).
- **FR-006**: The canvas backdrop MUST follow the editor's appearance: the game's daylight backdrop in the light appearance, a dark backdrop in the dark appearance.
- **FR-007**: Switching back to the light appearance MUST restore the editor to its exact pre-feature look — light chrome, daylight canvas backdrop, and no cave-lighting preview.

**The cave-lighting preview**

- **FR-008**: While the dark appearance is active, the level canvas MUST preview the game's cave lighting: the darkness overlay, torch light pools, the player's carried glow, and enemy eye markers, drawn with the game's own rules and passes.
- **FR-009**: While dark mode is on, the whole level canvas MUST be darkened to the editor's preview darkness — deliberately lighter than the game's full cave darkness so the author can still see the level — regardless of the spawn's position or any cave-family background piece. The spawn only supplies the player's carried glow (absent when there is no spawn); placing or removing torches MUST update the light pools.
- **FR-010**: The preview MUST be view-only: it MUST NOT change what a level exports, what a save writes, or how the game behaves.
- **FR-011**: The cave-lighting preview MUST apply to the level canvas only; the blueprint canvas receives the dark chrome and backdrop but no cave-lighting preview.
- **FR-012**: Editor affordances drawn over the canvas — grid lines, sign badges, patrol and connection-point markers, and the pending placement preview — MUST remain legible while the cave-lighting preview is drawn, and the existing background-layer dimming MUST still let the author see what they are painting.
- **FR-013**: The preview MUST be static, with no game loop or continuously running animation, consistent with the editor's existing frozen rendering; the torch flame may be shown at rest.

**Scope, quality and safety**

- **FR-014**: Dark mode MUST be purely client-side and MUST work on the built site as well as the development server.
- **FR-015**: Existing editor tests MUST be preserved and extended to cover dark mode; assertions MUST NOT be weakened or deleted to accommodate it.
- **FR-016**: The feature MUST NOT change gameplay, the exported layout, saved files, or the in-game cave-lighting behaviour.
- **FR-017**: The feature MUST NOT introduce a site-wide dark mode or alter any other theme's appearance — it is scoped to the editor.
- **FR-018**: Toggling the appearance or editing while dark mode is on MUST keep interaction feedback under 200 ms (Constitution Principle V) with no dropped paint cells.

### Key Entities _(include if feature involves data)_

- **Editor appearance**: The editor's own light/dark look, held as a single persisted value and owned by the editor rather than by the site-wide theme selection.
- **Cave-lighting preview**: The canvas rendering of the game's darkness, torch light pools, player glow, and enemy eyes. Derived entirely from the level's torch tiles and spawn — it stores no state of its own.
- **Carried light**: The spawn's held-light position, which supplies the player's glow in the preview. Absent when the level has no spawn; it does not decide whether the scene darkens.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An author can switch the editor between light and dark with one control, and after a reload the editor shows the appearance they last chose, every time.
- **SC-002**: In dark mode every editor surface named by FR-005 — page, header, toolbar, palette, dialogs, selectors, and status text — renders dark, and every label and control meets the FR-005 contrast floor (≥ 4.5:1 for text, ≥ 3:1 for UI boundaries).
- **SC-003**: With dark mode on, the level canvas is darkened with the game's torch pools, the spawn's player glow, and enemy eyes; removing the torches leaves only the darkness and the player's glow.
- **SC-004**: With dark mode off, the editor is visually indistinguishable from the pre-feature platformer-daylight look (its own light baseline) — same light chrome, same daylight canvas, no darkness.
- **SC-005**: For the same level and the same edits, the exported layout and the saved file are identical whether dark mode is on or off.
- **SC-006**: Toggling dark mode, and painting while it is on, keep interaction feedback under 200 ms with no dropped paint cells.
- **SC-007**: The editor's light and dark appearances are the same whichever site-wide theme is selected.

## Assumptions

- **Scope (decided)**: O-015 is the editor's own dark mode — a persisted toggle that darkens the editor chrome and canvas, and, while active, previews the game's cave lighting. It is not a site-wide dark mode and does not add a dark variant to any other theme. This matches the boundaries O-016 left to O-015 (a persisted dark-mode toggle, editor theming, and a cave-lighting preview) and O-010's own note that the editor "does not need to render the full darkness effect while authoring".
- **Editor-owned appearance**: The editor presents its own light/dark appearance rather than inheriting the site-wide theme, with the game's daylight palette as the light baseline. Rationale: the editor currently inherits the global theme, so a dark toggle would be meaningless whenever the global theme is already dark; owning the appearance also makes SC-007 hold.
- **Toggle placement and style**: A single icon control in O-016's toolbar, following the existing layer/canvas toggles' visual language, with a tooltip that names it and reflects its pressed state (FR-002).
- **Default**: Light. The author's choice is remembered once made; automatic following of the operating system's colour-scheme preference is out of scope (FR-003).
- **Always-dark preview (decided)**: While dark mode is on, the level canvas is always darkened and renders the game's torch light pools, the spawn's carried glow, and enemy eyes. The author chose this over the earlier spawn-probe model so the cave look is visible immediately, without first having to place the spawn inside a painted cave. The trade-off is that this is a preview aid rather than a reproduction of the game's spawn-driven darkness: the in-game lighting is unchanged (FR-008, FR-009, FR-016).
- **Preview darkness is lighter than play (decided)**: The editor previews at a fixed `EDITOR_PREVIEW_DARKNESS` (0.8) rather than the game's `MAX_DARKNESS` (≈ 0.97). In play the camera follows the player, so their carried light is always on screen; in the editor the viewport can sit away from any light, and at the game's full darkness the level would read as a black rectangle. This is a view-only value and does not change the in-game darkness (FR-016).
- **Preview scope**: Level canvas only. Blueprints get the dark chrome and backdrop but no cave-lighting preview (FR-011).
- **Static preview**: No game loop is introduced; the preview is drawn at rest, consistent with the editor's existing frozen rendering of entities and animations (FR-013).
- **No new in-game lighting behaviour**: The preview reuses O-010's draw passes as-is and adds only a preview-only darkness value (`EDITOR_PREVIEW_DARKNESS`); it adds no gameplay lighting and changes nothing the player experiences (FR-016).
- **No accessibility/ARIA additions**: Following O-016, this feature adds no ARIA requirements beyond the toolbar's existing control pattern; the toggle stays in the browser's normal Tab order.
- **Storage identity**: The appearance gets its own storage key; the editor's existing persisted keys keep their meaning, so no migration is needed and no in-progress author work is affected.
- **Dark palette is editor-only**: The dark palette is defined for the editor and does not leak into the game or the other themes.

## Dependencies

- **O-016 Editor UI Rework** (implemented) — provides the toolbar that hosts the toggle and the tiles-only palette the dark palette must cover.
- **O-010 Cave Lighting** (implemented) — provides the darkness, torch-light, player-light, and enemy-eye rules the preview reuses.
- **F-019 Level Editor** (implemented) — the editor this feature extends.
- **F-012 Theme System** (implemented) — the existing theme infrastructure the editor's own appearance layers on.

## Out of Scope

- A site-wide dark mode, or a dark variant of any theme other than the editor.
- Automatic switching based on the operating system's colour-scheme preference.
- New lighting features or any change to O-010's in-game cave-lighting behaviour.
- Animating the cave-lighting preview (no game loop in the editor).
- A dark variant of the platformer game itself.
