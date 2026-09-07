# Feature Specification: Platformer Blueprint Rooms

**Feature Branch**: `O-006-platformer-blueprints`  
**Status**: Partial — one open requirement (connection points)  
**Input**: Author a room once on its own canvas, save it as a named blueprint, and stamp it into levels instead of painting every level from scratch.  
**Design rationale**: [design.md](./design.md)  
**File shape**: [LevelFormat.md](../../docs/themes/platformer/LevelFormat.md)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Author a room on the blueprint canvas (Priority: P1)

A developer opens the level editor and switches the canvas from Level to Blueprint.
The canvas goes blank — a single empty cell — and painting behaves exactly as it does on a
level: the same tools, the same drag-paint, the same right-click-erases convention, the same
grid growth when painting past an edge. The developer paints a small cave room, drops a
background piece or two behind it, and has a reusable room without having touched the level
they were editing a moment ago.

**Why this priority**: Nothing else in the feature exists without a place to author a
blueprint. The library, the palette section and placement all consume what this produces.

**Independent Test**: Switch to Blueprint, confirm the canvas is blank and independent of the
level canvas, paint on both layers, switch back to Level and confirm the level is untouched.

**Acceptance Scenarios**:

1. **Given** the editor is in Level mode, **When** the developer selects Blueprint, **Then** a
   second, independent, initially-blank canvas becomes active and the level canvas is left
   exactly as it was.
2. **Given** Blueprint is active, **When** the developer paints, erases or grows the canvas,
   **Then** every painting behavior is identical to painting a level.
3. **Given** Blueprint is active, **When** the developer switches the Foreground/Background
   toggle, **Then** it switches which of the *blueprint's own* two layers is painted — the two
   toggles are independent axes, not three options on one switch.
4. **Given** Blueprint is active, **When** the developer looks at the palette, **Then** the
   spawn-point tool is absent — a blueprint has no spawn point.
5. **Given** the developer switches back to Level, **When** the level canvas returns, **Then**
   each canvas keeps its own pan position, so neither view is reset by the other.
6. **Given** the editor is reopened later, **When** it restores its state, **Then** the
   blueprint canvas holds whatever was last painted on it, like the level canvas does.

---

### User Story 2 - Save a blueprint and reopen it (Priority: P1)

The developer names the room and saves it. It is written as a file next to the saved levels,
cropped to the tightest painted bounding box with its background pieces rebased onto the same
origin. A Blueprint dropdown lists a blank `new` entry plus every saved blueprint; picking one
loads it back onto the blueprint canvas for further editing. On a built or statically-served
copy of the site there is no dev server to write files, so the Save controls do not render at
all.

**Why this priority**: A blueprint that cannot be saved and reopened is not reusable, which is
the whole point of the feature.

**Independent Test**: Save a painted room, confirm the file appears in the blueprint folder,
reopen it from the dropdown and confirm it is editable and identical.

**Acceptance Scenarios**:

1. **Given** a painted blueprint canvas, **When** the developer saves it under a name, **Then**
   a blueprint file is written and the canvas is no longer considered dirty.
2. **Given** a saved blueprint, **When** it is picked from the Blueprint dropdown, **Then** its
   layout and background load onto the blueprint canvas.
3. **Given** the blueprint canvas has unsaved edits, **When** the developer picks a different
   blueprint, **Then** a confirmation asks before the canvas is replaced.
4. **Given** the blueprint currently open is re-picked from the dropdown, **When** it is
   selected, **Then** it reloads rather than being swallowed as an already-selected no-op —
   which is how a messed-up room is thrown away.
5. **Given** the page is served without a dev server, **When** the editor renders, **Then**
   neither the Save Level nor the Save Blueprint control appears; placing an already-saved
   blueprint still works, because the library is read at build time.
6. **Given** a blueprint file on disk is malformed, **When** the library is read, **Then** that
   file is skipped and the rest of the dropdown still works.

---

### User Story 3 - Place a saved blueprint into a level (Priority: P1)

Back on the level canvas, the palette shows a Blueprints section listing every saved room. The
developer clicks one to arm it, then moves the mouse over the level: a live preview of the whole
room follows the cursor with no click needed, outlined by a border that is **blue** where the
room fits and **red** where it would land on terrain the level already has. A single left-click
stamps it down. Right-click cancels the armed placement outright. If the room landed in the
wrong spot, one Undo placement — button or Ctrl+Z — puts the level back.

**Why this priority**: This is the payoff: hand-assembling a level from a library of rooms.

**Independent Test**: Arm a blueprint, sweep the cursor across empty ground and across existing
terrain and confirm the border changes colour, click to commit, then undo.

**Acceptance Scenarios**:

1. **Given** a saved blueprint exists, **When** the developer looks at the level palette, **Then**
   a Blueprints section lists it; clicking it arms it and clicking it again disarms it.
2. **Given** a blueprint is armed, **When** the cursor moves over the level canvas, **Then** the
   preview follows continuously with no click, and leaving the canvas clears it.
3. **Given** the preview overlaps no filled cell, **When** it is drawn, **Then** its border is
   blue; **when** any of its cells would land on a filled cell, its border is red.
4. **Given** the preview is blue, **When** the developer left-clicks, **Then** the room is written
   into the level at that spot, its background pieces are appended to the level's own, and the
   blueprint stays armed so another copy can be stamped without returning to the palette.
5. **Given** the preview is red, **When** the developer left-clicks, **Then** nothing is written.
6. **Given** the room extends past the level's current edge, **When** it is committed, **Then** the
   level grows exactly as painting there would have grown it.
7. **Given** a blueprint is armed, **When** the developer right-clicks, **Then** the placement is
   cancelled and the blueprint disarmed — right-click has no erase meaning during a preview.
8. **Given** a placement was just committed, **When** the developer presses Ctrl+Z (Cmd+Z) or the
   Undo placement button, **Then** the level returns to its state immediately before that
   placement and the undo disappears.
9. **Given** any other edit has happened since the placement — painting, erasing, a background
   change, loading a different level or another placement — **When** the developer tries to undo,
   **Then** there is nothing to undo: the offer only ever covers the one placement just made.

---

### Edge Cases

- **Empty gaps inside a room**: a deliberately empty patch in the middle of a room (a floor gap)
  survives the crop and is *not* written on placement — a blueprint's empty cells are bounding-box
  padding, never an instruction to clear a cell, so placing a room can never blank out terrain the
  level already had there.
- **Interlocking shapes**: a room may be dropped over existing terrain that sits only under the
  gaps in its bounding box; only the cells it actually writes are checked.
- **A deleted blueprint that was still armed**: the armed selection resolves to nothing and
  placement is simply inactive.
- **No saved blueprints yet**: the palette shows no Blueprints section at all.
- **Placement and the background layer**: placement targets the level's foreground; while the
  background layer is active, clicks paint background as they always have.
- **Placing while on the blueprint canvas**: arming is unavailable there — nesting a blueprint
  inside a blueprint is out of scope — and switching to the blueprint canvas disarms whatever was
  armed.
- **Freshly saved blueprint not in the list**: the library is read at build time, so a blueprint
  saved moments ago appears once the dev server has picked the new file up, not instantly.
- **Overlapping background pieces**: a placed room's background pieces are appended
  unconditionally, with no overlap check — background placements already silently replace on
  overlap, matching how painting the background layer works.

## Requirements _(mandatory)_

### Functional Requirements

#### The blueprint canvas

- **FR-001**: The editor MUST offer a Level/Blueprint toggle that chooses which canvas is active.
  It MUST be independent of the Foreground/Background toggle: Level/Blueprint says *which canvas*,
  Foreground/Background says *which layer of that canvas*. Both toggles MUST stay visible and
  working in either mode.
- **FR-002**: The blueprint canvas MUST be a second, fully independent canvas with its own
  foreground grid, its own background placements, its own pan position and its own loaded name.
  It MUST start blank — a single empty cell — unless a saved blueprint has been loaded onto it.
- **FR-003**: Painting on the blueprint canvas MUST behave identically to painting a level —
  same tools, same drag-paint, same right-click-erases convention, same growth when painting past
  an edge. Every painted cell simply is part of the blueprint; there is no border to draw and no
  enclosed-shape check.
- **FR-004**: The palette MUST drop the spawn-point tool while the blueprint canvas is active, and
  MUST drop the connection-point tool while the level canvas is active.
- **FR-005**: The blueprint canvas's contents MUST survive reopening the editor, the same way the
  level canvas's do.

#### Saving and the library

- **FR-006**: The editor MUST offer a Blueprint dropdown listing a blank `new` entry plus every
  saved blueprint. Picking an entry MUST load its layout and background onto the blueprint canvas,
  MUST warn first when the canvas has unsaved edits, and MUST reload the entry already open when it
  is re-picked.
- **FR-007**: The editor MUST offer a Save Blueprint action that prompts for a name and writes the
  blueprint as a file, cropped to the tightest painted bounding box with its background placements
  rebased onto that same origin. The file's shape is documented in
  [LevelFormat.md](../../docs/themes/platformer/LevelFormat.md).
- **FR-008**: The Level Select control and the Save Level control MUST swap with the Blueprint
  Select control and the Save Blueprint control as the Level/Blueprint toggle changes — one pair
  showing at a time, never both stacked.
- **FR-009**: Save controls — both Save Level and Save Blueprint — MUST render only when the page
  is served by a dev server that can actually write a file. On a built or statically-served copy
  they MUST NOT appear. Placing an already-saved blueprint MUST remain available regardless.
- **FR-010**: A saved blueprint file that is malformed MUST be skipped rather than breaking the
  dropdown or the editor.

#### Placement

- **FR-011**: The level palette MUST show a Blueprints section listing every saved blueprint.
  Clicking one arms it for placement; clicking the armed one again disarms it. The section MUST NOT
  render on the blueprint canvas, nor when no blueprints exist.
- **FR-012**: While a blueprint is armed, hovering the level canvas MUST render a live preview of
  every filled cell of the room, anchored at the hovered cell and following the mouse continuously
  with no click. Moving the cursor off the canvas MUST clear it.
- **FR-013**: The preview MUST be outlined with a border that is **blue** when the placement is
  valid and **red** when it is not. Validity is overlap-only: a placement is valid when none of the
  cells it would write lands on a cell the level already fills. Out of bounds counts as free.
- **FR-014**: A single left-click MUST commit a valid placement, writing every filled cell of the
  room into the level at the hovered anchor and growing the level exactly as painting there would.
  A blueprint's empty cells MUST never be written. An invalid placement MUST be refused outright.
- **FR-015**: A committed placement MUST append the room's background pieces, rebased onto the same
  origin, to the level's own background list.
- **FR-016**: The blueprint MUST stay armed after committing, so stamping another copy needs no trip
  back to the palette.
- **FR-017**: Right-click while a blueprint is armed MUST cancel the placement and disarm the
  blueprint, rather than committing or erasing anything.
- **FR-018**: The editor MUST offer a one-shot Undo placement that restores the level exactly as it
  was immediately before the most recently committed placement, also bound to Ctrl+Z (Cmd+Z). It MUST
  disappear on use, and MUST be cleared by any other edit since that placement — painting, erasing, a
  background change, loading a different level or another placement — so it only ever offers to undo
  the one placement just made, never a stale one. Nothing else in the editor has an undo.
- **FR-019**: Placement MUST be confined to the level's foreground layer. It MUST be unavailable on
  the blueprint canvas, and switching to the blueprint canvas MUST disarm whatever was armed.
- **FR-020**: Blueprints and everything on them MUST be purely editor-time. A placed room's cells
  become ordinary level cells the moment they are stamped down; nothing about a blueprint changes
  runtime gameplay.

#### Open requirement — connection points

A **connection point** is an invisible, non-solid, editor-only marker painted onto a blueprint's
border cells to mark where other blueprints may attach. It behaves like any other tool: the author
paints it directly onto the blueprint canvas, with no separate marking mode and no limit on how many
per side. In the editor it is drawn with its own distinct glyph and tint — on the blueprint canvas,
on the level canvas once placed, and inside a placement preview — so it is never mistaken for a
patrol boundary; in the game it renders nothing and collides with nothing.

Placement today neither reads nor validates connection points. They take part in the overlap check
exactly like any other filled cell and are never treated specially beyond that, so a room's markers
have no effect on whether a placement is considered valid. They exist to show a human — and a future
generator reading blueprint files directly — where a room's intended attachment spots are.

This raises a known, unsolved problem. A cell holds one tile kind, so painting a connection point
onto a wall **replaces** that wall rather than overlaying it. A room whose border is marked this way
therefore has an invisible, non-solid gap where the marker sits, which the game will happily let the
player walk through. The requirement — that a room can be marked for attachment without a hole being
punched in it — is unmet. No fix is chosen here.

### Key Entities

- **Blueprint** — a named, reusable room: a small rectangular arrangement of level cells, cropped to
  its painted extent, optionally carrying decorative background pieces. Deliberately the same shape a
  saved level has (see [LevelFormat.md](../../docs/themes/platformer/LevelFormat.md)).
- **Blueprint canvas** — the second editing surface the blueprint is authored on, independent of the
  level canvas in grid, background, pan position and loaded name.
- **Blueprint library** — the collection of saved blueprint files, surfaced as the Blueprint dropdown
  and the palette's Blueprints section.
- **Connection point** — an invisible, non-solid, editor-only border marker (see the open requirement
  above).
- **Placement** — an armed blueprint plus an anchor cell, previewed live and committed as one action,
  with a single-slot snapshot of the level from immediately before it.

## Success Criteria _(mandatory)_

- **SC-001 — Authoring is not a new skill**: a developer who can paint a level can paint a blueprint
  with no additional instruction; every painting gesture behaves identically on either canvas.
- **SC-002 — Round trip**: a room painted on the blueprint canvas, saved, and reopened from the
  dropdown is identical to what was painted, background pieces included.
- **SC-003 — Assembly beats painting**: a level can be assembled by stamping saved rooms and
  hand-painting only the terrain between them, with no room repainted from scratch.
- **SC-004 — Fit is legible before committing**: the border colour tells the developer whether a
  placement will be accepted before any click, at every cursor position.
- **SC-005 — Placement is never destructive**: no committed placement can remove or blank out terrain
  the level already had; a misplaced room is fully recoverable with one undo.
- **SC-006 — Nothing dev-only reaches a visitor**: a built or statically-served copy of the site shows
  no Save controls.
- **SC-007 — Zero runtime footprint**: a level assembled from blueprints plays identically to the same
  level painted by hand.

## Assumptions

- **[F-019](../F-019-platformer-level-editor/spec.md) (Level Editor) exists**: this feature extends
  the editor's canvas, palette, layer toggle, level dropdown, save flow and pan behavior. It adds a
  second canvas and a placement mode to that editor; it does not recreate any of it.
- **Dev-only feature**: like the editor itself, blueprint authoring is for developers building levels,
  not for visitors. It is reachable only where the editor is.
- **A blueprint is authored, not captured**: rooms are painted on their own canvas rather than carved
  out of an existing level, so there is no capture or region-selection step.
- **The library is read at build time**: saved blueprints are discovered the same way saved levels are,
  so a newly written file appears once the dev server has picked it up.
- **The editor has no zoom**: the canvas is fixed at one screen tile per grid cell, with panning as
  the only way to move around (see [design.md](./design.md)).

## Out of Scope

- Rotating or mirroring a blueprint before placement.
- Nesting — placing an already-saved blueprint onto the blueprint canvas. Placement targets the level
  canvas only.
- Auto-generating a whole level from a library of blueprints. This feature is a building block for
  that, not that.
- Any gameplay-visible behavior for connection points — no runtime transition, teleport or trigger.
  They are editor-time markers only.
- A general editor undo. Undo covers placement and nothing else.
- Visitor-facing level selection, which is
  [O-007](../O-007-platformer-level-selection/spec.md).
