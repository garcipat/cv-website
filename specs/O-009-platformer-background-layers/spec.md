# Feature Specification: Platformer Background Image Layers

**Feature Branch**: `O-009-platformer-background-layers`
**Status**: Implemented
**Input**: An illustrated parallax backdrop behind the platformer level, composited from
several depth layers that scroll at different speeds so the scene reads as distance.

The platformer's backdrop is an illustrated scene rather than a flat colour. It is built
from four static depth bands — sky, clouds and hills, a village treeline, and grass —
plus an animated river that runs through the village band. Each band scrolls
horizontally at its own fraction of the camera's movement, so the scene reads as having
depth: the sky never moves, the clouds barely drift, the treeline lags, and the grass
keeps pace with the ground the character walks on.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A Scene With Depth Behind the Level (Priority: P1)

A visitor playing the platformer sees an illustrated landscape behind the level: a blue
sky at the top, white clouds over rolling hills below it, a pine treeline over a village
band further down, and a grassy field filling everything beneath that. Walking left or
right, the layers move at visibly different speeds — the sky stays put, the clouds inch
along, the treeline lags behind the terrain, and the grass tracks the ground exactly.
The scene reads as distance rather than as a picture pasted behind the level.

**Why this priority**: The backdrop is what the visitor sees behind every other element
of every frame. Without depth it reads as a flat card behind a game.

**Independent Test**: Play a level wide enough to scroll and walk from one end to the
other. Confirm each band moves at its own speed, the sky does not move at all, and the
grass moves exactly with the terrain.

**Acceptance Scenarios**:

1. **Given** the camera scrolls horizontally, **When** the sky renders, **Then** its
   position is unchanged — the sky is pinned to the viewport at every camera position.
2. **Given** the camera scrolls horizontally, **When** the clouds and the treeline
   render, **Then** each shifts by a different, smaller amount than the terrain, with the
   clouds shifting least.
3. **Given** the camera scrolls horizontally, **When** the grass renders, **Then** it
   shifts by exactly the amount the foreground terrain shifts, so the grass reads as a
   continuation of the same ground.
4. **Given** any camera position, **When** a band tiles horizontally to fill the
   viewport's width, **Then** no seam is visible between repeats and the band reaches
   both edges of the viewport.
5. **Given** the character walks the full width of a level, **When** each frame renders,
   **Then** the backdrop is drawn behind the terrain, the entities and the level's own
   background tile layer, never in front of them.

---

### User Story 2 - A Backdrop That Fits Any Window (Priority: P1)

A visitor resizing the browser window, or opening the site on a short or a tall screen,
sees the same complete scene. The sky sits at the top, the village band sits a fixed
distance above the bottom of the play area, and whatever vertical space is left between
the bands is filled so no gap, no letterboxing and no repeated stack of identical cloud
rows ever shows.

**Why this priority**: The play area's height varies with the window, so a backdrop that
only composes at one height is broken most of the time.

**Independent Test**: Play the same level at several window heights, including a very
short one. Confirm the scene is complete and gapless at each, and that the clouds appear
exactly once rather than as a repeating vertical stack.

**Acceptance Scenarios**:

1. **Given** any play-area height, **When** the village band renders, **Then** its bottom
   edge sits the same fixed distance above the bottom of the play area.
2. **Given** any play-area height, **When** the gap between the sky's bottom edge and the
   clouds' top edge is larger than zero, **Then** it is filled with a flat colour matching
   the sky art, so the sky reads as continuous.
3. **Given** any play-area height, **When** the clouds render, **Then** they are drawn
   exactly once, positioned a small distance above the treeline so they read as floating
   over it rather than resting on it, with that small gap filled in the same sky colour.
4. **Given** any play-area height, **When** the grass renders, **Then** it is drawn
   exactly once at the village band's bottom edge and the space below it down to the
   bottom of the play area is filled with a flat colour matching the grass art.
5. **Given** a play area short enough that two bands would otherwise overlap, **When** the
   frame renders, **Then** the fills are simply omitted and no band is drawn outside the
   play area.

---

### User Story 3 - Water That Moves (Priority: P2)

A visitor watching the backdrop sees the river running through the village band ripple:
its wave lines alternate between two drawings at a steady beat. The river sits exactly
over the river already drawn into the village art, and scrolls with the treeline, so it
reads as water inside the scene rather than as a separate strip laid over it.

**Why this priority**: A wholly static backdrop reads as a still image; one small moving
element makes the scene feel alive. It is decorative and independent of everything else.

**Independent Test**: Stand still in a level and watch the village band. Confirm the
river's wave lines alternate at a steady beat and stay aligned with the village art's own
river while walking.

**Acceptance Scenarios**:

1. **Given** the game is running, **When** time advances by the river's frame duration,
   **Then** the river swaps to its other wave drawing.
2. **Given** the camera scrolls, **When** the river renders, **Then** it moves at exactly
   the treeline's speed and stays at the same offset within the village band.

---

### Edge Cases

- **A backdrop image that fails to load** leaves the backdrop undrawn for that frame
  rather than breaking the frame; the rest of the level still renders.
- **A very short play area** can push bands close enough together that a gap becomes zero
  or negative; each fill is drawn only when its gap is genuinely positive.
- **A fractional scroll offset** — the product of camera position and a band's speed
  factor is rarely a whole number — is rounded to a whole pixel, so adjacent repeats of a
  band never separate by a visible hairline seam.
- **A level shorter or taller than the play area** does not change the backdrop: the
  backdrop is composed against the play area, not against the level's own bounds, so it
  fills whatever space the level does not occupy above or below.

## Requirements _(mandatory)_

Behavior only. How the backdrop's bands are addressed within their source art, and the
foreground terrain's own rendering scale that they match, are code knowledge and live in
[`docs/themes/platformer/Terrain.md`](../../docs/themes/platformer/Terrain.md); the level
and layer model lives in
[`docs/themes/platformer/LevelFormat.md`](../../docs/themes/platformer/LevelFormat.md).

### Functional Requirements

#### Composition

- **FR-001**: The game MUST draw an illustrated backdrop behind every other element of the
  frame, composed of four static depth bands — sky, clouds and hills, village treeline,
  and grass — drawn back to front in that order.
- **FR-002**: The backdrop MUST be composed against the play area's own width and height
  rather than against the level's dimensions, so it fills the viewport at any window size
  and for any level.
- **FR-003**: Every band MUST render at the same uniform scale as the foreground terrain's
  own rendered tile size, so the backdrop's pixel density does not jar against the level
  drawn over it.
- **FR-004**: Each band MUST tile horizontally across the full width of the play area, with
  its scroll offset rounded to a whole pixel so repeats never show a seam.
- **FR-005**: A flat colour band matching the sky art's darkest top rows MUST be drawn
  above the sky image, giving the heads-up display a consistent backdrop at the very top
  of the play area.

#### Parallax

- **FR-006**: The sky MUST be pinned to the viewport and MUST NOT shift horizontally at
  any camera position.
- **FR-007**: The clouds-and-hills band MUST scroll at the slowest non-zero fraction of the
  camera's movement, and the village treeline MUST scroll faster than the clouds but
  slower than the foreground terrain.
- **FR-008**: The grass MUST scroll at exactly the foreground terrain's speed, so it reads
  as the same ground continuing behind the level.

#### Vertical placement

- **FR-009**: The village treeline MUST be pinned a fixed distance above the bottom of the
  play area, chosen so typical foreground terrain does not hide it.
- **FR-010**: The clouds-and-hills band MUST be drawn exactly once, positioned a small
  fixed gap above the village treeline rather than tiled vertically.
- **FR-011**: The gap between the sky's bottom edge and the clouds' top edge, and the gap
  between the clouds' bottom edge and the treeline's top edge, MUST each be filled with a
  flat colour sampled from the sky art, and MUST be filled only when the gap is positive.
- **FR-012**: The grass MUST be drawn exactly once at the village band's bottom edge,
  overlapping that band slightly, with the remaining space down to the bottom of the play
  area filled with a flat colour sampled from the grass art.

#### River

- **FR-013**: An animated river MUST be drawn over the village treeline, alternating
  between two wave drawings at a fixed interval driven by the game's own elapsed world
  time.
- **FR-014**: The river MUST use the treeline's scroll speed and scale, and MUST be offset
  vertically within the village band so its water line aligns with the river drawn into
  the village art.

#### Degradation

- **FR-015**: The backdrop MUST be drawn only once every image it needs has loaded; a
  failed or pending load MUST leave the backdrop undrawn rather than break the frame or
  block the rest of the level from rendering.

### Key Entities

- **Depth band** — one horizontal strip of the illustrated scene, with its own vertical
  placement rule and its own scroll speed factor.
- **Scroll speed factor** — a band's fraction of the camera's horizontal movement: zero
  means pinned to the viewport, one means matching the foreground terrain exactly.
- **Gap fill** — a flat colour drawn between two bands, sampled from the neighbouring art
  so the join is invisible.
- **River overlay** — a two-drawing flipbook composited onto the village band at the
  treeline's own position and speed.

## Success Criteria _(mandatory)_

- **SC-001 — Depth reads as depth**: Walking the full width of a level, a viewer can tell
  the bands apart by how fast they move: the sky is still, the clouds barely drift, the
  treeline lags, the grass matches the ground. Verified by manual inspection in the
  running game and by tests asserting each band's shift against the camera.
- **SC-002 — Complete at any height**: At every play-area height, including a very short
  one, the backdrop shows no gap, no letterbox, and no repeated stack of identical bands.
  Verified by tests over several canvas heights and by resizing the running game.
- **SC-003 — Seamless tiling**: At arbitrary camera positions, including ones producing a
  fractional scroll offset, no seam is visible between horizontal repeats of any band.
  Verified by a test asserting whole-pixel offsets and by manual inspection.
- **SC-004 — The river animates in place**: The river alternates between its two drawings
  at a steady beat while staying aligned with the village art's own river at every camera
  position. Verified by tests over elapsed time and by manual inspection.
- **SC-005 — Purely visual**: Adding the backdrop changes nothing about where the
  character can stand, walk, climb or fall. Verified by the unchanged gameplay test suite.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) is complete**: the platformer theme, its
  canvas rendering and game loop, the ASCII grid level format, terrain rendering and the
  camera all exist. This feature changes only what is drawn behind the level; it adds no
  gameplay rule.
- **The play area's framing belongs to F-015's camera requirements, not to this feature.**
  The fixed play-canvas height, the bottom-anchored camera baseline and the vertical
  dead zone that keeps the character near the bottom of the play area are camera and
  viewport behavior. This feature assumes them: they are what creates the tall band of
  empty space above the level that the backdrop exists to fill, and they are what makes
  the play area's height something the backdrop must compose against.
- **Art is authored, not generated**: the backdrop draws from fixed, hand-prepared
  images. Changing the scene means preparing new art.
- **One backdrop for every level**: there is a single scene, used by every level.

## Out of Scope

- Letting a level choose among several backdrops, and the alternative scenes (night,
  beach, desert) that the source art holds.
- Vertical parallax — every band's placement is a function of the play area's height, not
  of the camera's vertical position.
- Any gameplay effect from the backdrop: nothing in it blocks, carries, damages or slows
  the character, and nothing in it can be stood on.
- The level's own background tile layer, which is anchored to the level and painted by an
  author — see [O-003](../O-003-platformer-tile-layers/spec.md).
- Showing the backdrop in the level editor's preview. The editor draws the level over its
  own plain canvas; matching the game's backdrop there is not part of this feature.
