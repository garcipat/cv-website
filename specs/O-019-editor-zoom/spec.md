# Feature Specification: Level Editor Zoom

**Feature Branch**: `O-019-editor-zoom`
**Created**: 2026-09-21
**Status**: Draft
**Input**: [Issue #48](https://github.com/garcipat/cv-website/issues/48) — the Level Editor's canvas
draws tiles at a fixed 1:1 size with middle-click-drag panning as the only way to reach off-screen
content; zoom would give more overview, most useful when lining a piece of level up against existing
content.

## Clarifications

### Session 2026-09-21

- Q: How should the author trigger zoom? → A: **A slider in each canvas's top controls**, not a
  scroll-wheel or keyboard shortcut. Rationale: the wheel and keyboard are left free, and a slider is
  discoverable and shows the current level at a glance.

- Q: Discrete steps or continuous zoom? → A: **Discrete steps.** Rationale: a fixed set of levels
  keeps every zoom level predictable and avoids the blurrier, seam-prone rendering a continuous
  factor risks.

- Q: Which levels? → A: **100% / 75% / 50% / 25%**, with 100% remaining the default and matching
  today's fixed size exactly. Rationale: zoom exists only to zoom *out* for overview; magnifying above
  today's size is not a need this feature addresses.

- Q: Does zoom apply to the main level canvas only, or also to the blueprint-room canvas
  ([O-006](../O-006-platformer-blueprints/spec.md))? → A: **Both**, each with its own independent
  slider and its own remembered level, matching how each canvas already keeps its own independent pan
  position.

- Q: Should the mouse wheel also zoom, given it's a natural gesture for this? → A: **Yes, as a second
  trigger, with no modifier key required.** Rationale: the canvas has no scrollable content of its own
  today — panning is middle-click-drag only, not wheel-scroll — so plain scrolling over it currently
  does nothing, and there is nothing for zoom to hijack. Requiring Ctrl/Cmd would only make the
  gesture less discoverable for no benefit. Scrolling over the canvas steps through the same four
  levels the slider offers, one step per notch, and moves the slider to match.

- Q: Does zoom anchor to anything — the cursor, the canvas center — or leave the pan position exactly
  as-is? → A: **Wheel-zoom anchors to the cursor; slider-zoom anchors to the canvas center.** Whichever
  point is used, that point's content stays under it before and after the zoom change. Rationale: a
  wheel gesture happens at a specific point on the canvas, and keeping that point fixed (as maps and
  design tools do) is what makes wheel-zoom feel natural; the slider has no cursor-over-canvas position
  to anchor to, so it anchors to the canvas's own center, which is a reasonable, predictable default
  and avoids the view jumping toward whatever corner happened to render the pointer.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Zoom Out for Overview on the Level Canvas (Priority: P1)

A level author is placing a piece of level near existing content and wants to see how it sits against
its surroundings. Today the canvas shows only a small window of a level that can be hundreds of tiles
wide, and the only way to see more is to pan repeatedly. The author drags the zoom slider in the
canvas's top controls down from 100%, and the canvas immediately redraws showing more of the level at
once, at 75%, 50%, or 25% of the original size.

**Why this priority**: This is the feature the issue asks for — the whole reason zoom is being added.

**Independent Test**: Open the level editor on a level wider than the canvas, move the zoom slider
through each of its steps, and verify the canvas shows progressively more of the level at each step.
Separately, scroll the wheel over the canvas and verify it steps through the same levels.

**Acceptance Scenarios**:

1. **Given** the level canvas at its default 100% zoom, **When** the author moves the slider to 75%,
   50%, or 25%, **Then** the canvas redraws immediately showing correspondingly more of the level in
   the same canvas area.
2. **Given** the level canvas at any zoom level other than 100%, **When** the author moves the slider
   back to 100%, **Then** the canvas returns to exactly today's fixed 1:1 size.
3. **Given** the level canvas freshly opened, **When** the author has not touched the slider,
   **Then** the canvas behaves exactly as it does today, at 100% zoom.
4. **Given** the pointer is over the canvas, **When** the author scrolls the wheel, **Then** the zoom
   steps to the next or previous level in the scroll direction and the slider updates to match.
5. **Given** the zoom is already at 100% (the ceiling) or 25% (the floor), **When** the author scrolls
   further in that same direction, **Then** the zoom simply stays at that level — it does not wrap or
   error.

---

### User Story 2 - Paint and Erase Accurately at Any Zoom Level (Priority: P1)

An author zoomed out to line up new content clicks on a cell to paint or erase it, exactly as they
would at 100%. The cell that changes is the one the author clicked on, not a neighboring cell, at
every zoom level.

**Why this priority**: Zoom that shows more of the level is worthless — and actively dangerous to a
level's content — if it silently paints or erases the wrong cell.

**Independent Test**: At each of the four zoom levels, click a cell near the top-left, the center, and
the bottom-right of the visible canvas, and verify each click affects exactly the cell under the
cursor.

**Acceptance Scenarios**:

1. **Given** any zoom level, **When** the author clicks a cell to paint, erase, or drag-paint,
   **Then** exactly the cell under the cursor is affected, matching the same accuracy the canvas has
   at 100% today.
2. **Given** any zoom level, **When** the author hovers a placement (such as a blueprint room during
   placement), **Then** the hover preview aligns with the cell under the cursor.

---

### User Story 3 - Zoom Keeps Its Anchor Point in Place (Priority: P2)

An author points at a specific spot in the level and scrolls the wheel to zoom in on it — the terrain
under the cursor stays under the cursor as the view scales, rather than the whole level sliding away
underneath. When the author instead uses the slider, the middle of the canvas is what stays fixed,
since there is no cursor position on the canvas to anchor to. Panning itself, when the author
middle-click-drags, is unaffected by any of this and works exactly as it always has.

**Why this priority**: Zoom that recenters unpredictably, or that requires re-panning after every
step just to get back to what the author was looking at, undermines the whole point of adding it.

**Independent Test**: Pan to a distinctive part of the level, point at a specific tile, and scroll to
zoom in twice; verify that tile stays under the cursor at every step. Separately, move the slider and
verify the canvas's own center point stays fixed instead.

**Acceptance Scenarios**:

1. **Given** any pan position, **When** the author scrolls the wheel while pointing at a tile, **Then**
   that tile remains under the cursor before and after the zoom level changes.
2. **Given** any pan position, **When** the author moves the zoom slider, **Then** whatever content was
   at the canvas's center point before the change is still at its center point afterward.
3. **Given** any zoom level, **When** the author middle-click-drags, **Then** the canvas pans exactly
   as it does at 100% today, unaffected by the current zoom level or by either zoom trigger.

---

### User Story 4 - Zoom the Blueprint Canvas Independently (Priority: P2)

An author authoring a blueprint room ([O-006](../O-006-platformer-blueprints/spec.md)) wants the same
overview control on that canvas. The blueprint canvas has its own zoom slider, separate from the level
canvas's, and changing one does not affect the other.

**Why this priority**: The blueprint canvas shares the same paint and pan mechanics as the level
canvas and benefits from the same overview, but is a separate view an author may leave at a different
zoom level than the level canvas.

**Independent Test**: Set the level canvas to one zoom level and the blueprint canvas to a different
one, switch between them, and verify each canvas keeps its own zoom level.

**Acceptance Scenarios**:

1. **Given** the blueprint canvas, **When** the author moves its zoom slider, **Then** only the
   blueprint canvas's zoom changes; the level canvas is unaffected, and vice versa.
2. **Given** both canvases at different zoom levels, **When** the author switches between them,
   **Then** each canvas shows its own remembered zoom level.

---

### Edge Cases

- **Zoom is a view setting, not level content**: Changing the zoom level never changes a level's or a
  blueprint's saved data, and is not itself saved with the level — reopening the editor starts back at
  100%.
- **Grid lines and overlays at every zoom level**: Grid lines, tile markers, sign badges, and the
  placement preview all scale together with the tiles, so nothing appears misaligned or a mismatched
  size relative to the tiles around it.
- **Zooming mid-drag**: The zoom slider is a separate control from the canvas; a paint-drag or a
  pan-drag in progress is unaffected by the fact that the slider exists, since the two cannot be
  operated at the same time by the same pointer.
- **Very small zoom on a small level**: A level smaller than the canvas at 25% simply shows empty
  space around it, exactly as panning past a level's edge does today.
- **Wheel-anchoring near the edge of a small level**: If the anchored cursor position would put the
  view somewhere a level's content can never fill, the view simply shows empty space there, exactly
  like the case above — anchoring never clamps or refuses to zoom.
- **The dark-appearance cave-lighting preview ([O-015](../O-015-editor-dark-mode/spec.md)) at every
  zoom level**: the darkness overlay covers the whole canvas and its torch and player light pools stay
  on the tiles they belong to, scaling with them, at 100%, 75%, 50% and 25% alike.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The level editor's main canvas MUST offer a zoom control in its top controls, showing
  the current zoom level and allowing the author to change it. Scrolling the mouse wheel while the
  pointer is over the canvas MUST also change the zoom level, stepping one level per notch in the
  scroll direction, with no modifier key required; the slider MUST update to reflect the new level.
  Scrolling past the ceiling (100%) or the floor (25%) MUST simply hold at that level.

- **FR-002**: The zoom control MUST offer exactly four levels: 100%, 75%, 50%, and 25%. 100% MUST be
  the default and MUST render identically to the canvas's current fixed size.

- **FR-003**: Changing the zoom level MUST redraw the canvas immediately at the new level, showing
  more of the level as the level decreases and less as it increases, within the same canvas area.

- **FR-004**: Every interaction that depends on knowing which cell the pointer is over — painting,
  erasing, drag-painting, and placement preview/hover — MUST remain accurate at every zoom level: the
  cell affected or highlighted MUST always be the cell the pointer is actually over.

- **FR-005**: Changing the zoom level MUST keep one anchor point's content fixed in place: a wheel-
  triggered change MUST anchor to the cell under the pointer at the moment of the scroll; a slider-
  triggered change MUST anchor to the canvas's own center point. Panning (middle-click-drag) MUST work
  identically at every zoom level regardless of trigger, and MUST NOT itself be reset by a zoom
  change beyond the pan adjustment the anchoring itself requires.

- **FR-006**: All canvas overlays that align with tiles — grid lines, tile markers, sign badges, and
  placement previews — MUST scale together with the tiles so they remain aligned at every zoom level.

- **FR-007**: The blueprint-room canvas ([O-006](../O-006-platformer-blueprints/spec.md)) MUST offer
  the same zoom control, independently of the level canvas: each canvas MUST keep and display its own
  zoom level, and changing one MUST NOT affect the other.

- **FR-008**: The zoom level MUST be a view-only setting. It MUST NOT be written into a saved level or
  blueprint file, and MUST NOT affect what a level or blueprint contains or how it plays.

- **FR-009**: Reopening or reloading the editor MUST start each canvas at 100% zoom, regardless of
  what zoom level was last selected.

### Key Entities

- **Zoom level**: A per-canvas view setting, one of 100% / 75% / 50% / 25%, defaulting to 100%.
  Affects only how much of the level or blueprint a canvas shows and at what size; carries no data and
  is never persisted.

## Success Criteria _(mandatory)_

- **SC-001 — Overview at a glance**: An author can see a wider area of a level than the canvas shows
  at 100%, by moving a slider, without needing to pan. Verified by browser check.

- **SC-002 — No loss of paint accuracy**: Painting, erasing, and placement hover remain exactly as
  accurate at 25%, 50%, and 75% as they are at 100%. Verified by unit tests on the pointer-to-cell
  math plus a browser check at each level.

- **SC-003 — Zoom anchors predictably**: Wheel-zoom keeps the pointed-at tile fixed under the cursor;
  slider-zoom keeps the canvas's center point fixed. Panning itself behaves identically at every zoom
  level. Verified by unit tests on the anchoring math plus a browser check.

- **SC-004 — Default behavior is unchanged**: An author who never touches the zoom control sees and
  experiences exactly today's editor. Verified by the existing editor test suite continuing to pass
  unmodified at 100% zoom.

- **SC-005 — Independent per canvas**: The level canvas and the blueprint canvas each offer and keep
  their own zoom level. Verified by browser check.

## Assumptions

- **The editor's existing pan, paint, and grid-rendering behavior (F-019) and the blueprint canvas
  (O-006) are complete.** This feature adds a view control to canvases that already exist; it does not
  change what can be painted or how a level or blueprint is structured.

- **Zoom is out-only.** 100% is the ceiling; there is no request in the raised issue for magnifying
  beyond today's fixed size, and none is added here.

- **The slider and the wheel are the only two triggers.** No keyboard shortcut or pinch gesture is
  requested.

## Out of Scope

- **Zoom levels above 100%.**
- **Pinch or keyboard zoom triggers.** (Mouse-wheel is in scope — see FR-001.)
- **Persisting a chosen zoom level** across a page reload, between sessions, or inside a saved level
  or blueprint file.
- **Any change to the live game's rendering.** This feature is editor-only; the in-game view is
  untouched.
