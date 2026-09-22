# Feature Specification: Ambient Background Clouds

**Feature Branch**: `O-022-ambient-clouds`
**Created**: 2026-09-22
**Status**: Draft
**Input**: [O-022: Ambient Background Clouds (#64)](https://github.com/garcipat/cv-website/issues/64)
— the platformer backdrop's cloud band (O-009) is a static parallax layer that only
shifts with camera scroll. Add ambient cloud sprites that drift slowly across the sky
mostly on their own, with a slight camera parallax, at varied speeds and starting
offsets, so the scene feels alive even while the player stands still.

## Clarifications

### Session 2026-09-22

- Q: How should the number of ambient clouds be determined? → A: Density scaled to the
  play area's width — one cloud per fixed span of width, subject to a minimum, recomputed
  when the play area resizes.
- Q: Which way should ambient clouds drift? → A: Right to left, for every cloud.
- Q: Should the clouds move with the camera? → A: Yes — a small camera-linked parallax
  shift equal to the painted clouds/hills band's factor, so they read at that band's
  depth rather than pasted on the screen.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Clouds That Drift While The Player Stands Still (Priority: P1)

A visitor playing the platformer stops moving and watches the sky. A handful of soft
white clouds drift slowly across the open sky above the treeline, each at its own pace
and its own height, so the scene keeps moving even when the character does not. The
drifting clouds are clearly separate from the backdrop's own painted cloud band: they
cross the flat sky at their own pace while picking up a slight camera parallax, and when
one leaves the edge of the view another enters from the other side.

**Why this priority**: This is the whole feature. Without motion that is independent of
the camera, the backdrop is inert exactly when the visitor pauses — the moment the
illusion of a living scene is easiest to notice breaking.

**Independent Test**: Open the platformer, stand still on the ground for several
seconds, and watch the sky. Confirm clouds change horizontal position over time, that at
least two of them move at visibly different speeds and heights, and that none of that
motion requires the player to move.

**Acceptance Scenarios**:

1. **Given** the game is running and the player does not move, **When** time advances,
   **Then** ambient clouds change their horizontal position across the sky.
2. **Given** two ambient clouds are visible at once, **When** they are watched over the
   same interval, **Then** they travel at different speeds and sit at different heights.
3. **Given** an ambient cloud drifts off one edge of the sky, **When** it leaves,
   **Then** another cloud enters from the opposite edge, so the sky is never left empty.
4. **Given** the player walks left or right, **When** the camera scrolls, **Then** the
   ambient clouds keep their own drift and additionally slide with the camera by the
   painted clouds/hills band's parallax factor, so they read at that band's depth.

---

### User Story 2 - A Procession That Reads As Random, Not As A Loop (Priority: P2)

A visitor watching for a while never sees a cloud appear out of thin air in the middle
of the sky, never sees two clouds overlap into an unreadable blob, and never sees the
same cloud retrace the same path. The sky reads as a slow, irregular procession rather
than a looping animation.

**Why this priority**: The feature is purely decorative, so its characteristic failure
is looking mechanical. Varied speeds and starting offsets are what the issue asks for;
spreading them so they stay readable is what makes the variation read as natural rather
than as a bug.

**Independent Test**: Watch the sky until every cloud has completed at least one pass.
Confirm each cloud enters and leaves by crossing an edge, no pair overlaps illegibly,
and no pass exactly repeats the previous one.

**Acceptance Scenarios**:

1. **Given** an ambient cloud is about to appear, **When** it appears, **Then** it
   enters from the left or right edge of the play area rather than appearing in place
   mid-sky.
2. **Given** several ambient clouds are on screen together, **When** they are drawn,
   **Then** their positions and heights are spread so they do not overlap into an
   unreadable cluster.
3. **Given** a cloud has completed one pass across the sky, **When** it reappears,
   **Then** its speed and starting offset have changed rather than repeating the previous
   pass exactly.
4. **Given** several clouds share the sky, **When** they are drawn, **Then** they show
   more than one silhouette rather than all sharing a single repeated shape.

---

### User Story 3 - Confined To The Sky, Never In The Way (Priority: P2)

A visitor playing a level sees the drifting clouds only in the open sky. They never
drift down over the treeline, the village, the grass or the terrain; they never pass in
front of the character, the enemies, the level's own tiles or the heads-up display; and
they never hide a hazard or a collectable. They are decoration in the emptiest part of
the frame.

**Why this priority**: A decorative layer that crosses gameplay elements competes for
attention and can hide something the player needs to see. Keeping the clouds inside the
sky band preserves both the depth illusion and readability.

**Independent Test**: Play a level with a tall sky and watch clouds cross the full
width. Confirm no cloud is ever drawn below the sky region, and that nothing the player
interacts with is ever obscured.

**Acceptance Scenarios**:

1. **Given** the sky region is the open space above the backdrop's cloud/hills band,
   **When** an ambient cloud drifts, **Then** it stays inside that region and is never
   drawn over the treeline, grass or terrain.
2. **Given** the level, its entities, its background tile layer and the heads-up display
   render, **When** an ambient cloud is drawn, **Then** the cloud is behind every one of
   them.

---

### User Story 4 - A Sky That Pauses When Motion Is Unwanted (Priority: P3)

A visitor whose system asks for reduced motion sees a calm sky: the ambient clouds are
still there, but they do not drift. Everything else about the level behaves as normal.

**Why this priority**: The site already respects reduced-motion for its other animated
themes, so the platformer's new animated layer should not be the one place that ignores
it. It is a small, independent slice of the feature.

**Independent Test**: Enable the system's reduced-motion setting, open the platformer,
and stand still. Confirm the sky shows clouds but they do not move; then confirm the rest
of the level still plays normally.

**Acceptance Scenarios**:

1. **Given** the visitor has requested reduced motion, **When** the platformer renders,
   **Then** ambient clouds are drawn without drifting.
2. **Given** the visitor has requested reduced motion, **When** the level is played,
   **Then** the character, terrain, entities and heads-up display behave exactly as they
   do otherwise.

---

### Edge Cases

- **An open sky too short to fit a cloud**: when the sky region between the bottom of the
  heads-up display's dark top margin and the backdrop's cloud/hills band cannot fit the
  shortest cloud, no ambient clouds are drawn and the rest of the frame renders unchanged.
- **A cloud wider than the viewport**: a cloud whose drawn width exceeds the play area
  still enters and exits normally; it is clipped at the play area's edges rather than
  resized.
- **Cloud sprite art that fails to load**: the ambient layer is simply not drawn; the
  backdrop, the level, its entities and the heads-up display still render, and no error
  breaks the frame.
- **A pause or a stall in the game loop**: after the game resumes, clouds continue from
  where they were rather than jumping forward by the paused duration.
- **A very wide viewport**: more clouds are shown — one per fixed span of width — so the
  layer scales the procession rather than stretching a single cloud across the sky. A
  narrow viewport still shows at least the minimum population.
- **A fractional position**: a cloud's horizontal position is rarely a whole number; it
  is drawn at a whole pixel so its edges never shimmer against the sky.

## Requirements _(mandatory)_

Behavior only. How the sky region is derived from the play area and the backdrop bands,
and the scale the clouds share with the rest of the backdrop, are code knowledge and live
with the backdrop's own design notes
([O-009 design](../O-009-platformer-background-layers/design.md)).

### Functional Requirements

#### The drifting layer

- **FR-001**: The game MUST draw a set of ambient clouds in the open sky above the
  backdrop's cloud/hills band and below the heads-up display's dark top margin, behind
  every other element of the frame.
- **FR-002**: Every ambient cloud MUST drift horizontally across the sky continuously and
  from right to left at its own speed, so its motion continues while the player stands
  still. On top of that drift, it MUST shift horizontally with the camera by a small
  parallax factor equal to the painted clouds/hills band's, so it reads as living at that
  band's depth.
- **FR-003**: Each ambient cloud MUST have its own drift speed and its own vertical
  position, so no two clouds move in lockstep or sit on the same line.
- **FR-004**: Ambient clouds MUST be drawn at the same uniform scale as the backdrop's
  other bands, so one pixel grid covers the whole frame.

#### Appearance and lifecycle

- **FR-005**: Ambient clouds MUST be drawn from a small set of cloud shapes, with clouds
  of different widths and silhouettes appearing over time rather than one repeated shape.
- **FR-006**: A cloud that drifts off the left edge of the play area MUST be replaced by
  a cloud entering from the right edge, so the field always holds
  `cloudPopulationFor(playAreaWidth)` clouds and the sky is never left without clouds.
- **FR-007**: A reappearing cloud MUST take a new drift speed and starting offset rather
  than repeating its previous pass exactly.
- **FR-008**: A cloud MUST enter and leave by crossing an edge of the play area, never by
  appearing or disappearing in the middle of the sky.
- **FR-009**: A cloud's horizontal position MUST be rounded to a whole pixel before it is
  drawn, so its edges never shimmer against the sky.

#### Containment and layering

- **FR-010**: Ambient clouds MUST stay within the open sky region and MUST NOT be drawn
  over the backdrop's treeline, grass, terrain or the level's own content.
- **FR-011**: The ambient layer MUST be drawn behind the level's terrain, its entities,
  its background tile layer and the heads-up display.

#### Degradation and motion preference

- **FR-012**: If the cloud sprite art has not loaded, the ambient layer MUST be omitted
  without breaking the frame or blocking the rest of the level from rendering.
- **FR-013**: If the open sky region is too short to fit the shortest cloud, the ambient
  layer MUST be omitted rather than drawn over another band.
- **FR-014**: When the visitor has requested reduced motion, the ambient clouds MUST be
  drawn without drifting.

#### Population and coverage

- **FR-015**: The number of ambient clouds MUST scale with the play area's width at a
  fixed density, subject to a minimum, so a wider viewport shows proportionally more
  clouds rather than the same few spread thin; the population MUST be recomputed when the
  play area resizes.

### Key Entities

- **Ambient cloud** — one drifting cloud instance: a shape, a drift speed, a vertical
  position within the sky, and a current horizontal position.
- **Sky region** — the open band of sky between the top of the play area and the top of
  the backdrop's cloud/hills band, in which ambient clouds live.
- **Drift speed** — a cloud's own horizontal movement per unit of elapsed time,
  independent of the camera; distinct from the layer's camera-linked parallax shift and
  from the backdrop bands' parallax factors.
- **Cloud parallax factor** — the fraction of the camera's horizontal movement the ambient
  layer follows, on top of each cloud's own drift; equal to the painted clouds/hills
  band's factor so the two share a depth.
- **Cloud set** — the fixed collection of cloud shapes, plus the population of ambient
  cloud instances drawn from them; the instance count scales with the play area's width.

## Success Criteria _(mandatory)_

- **SC-001 — Alive while standing still**: With the player stationary and motion allowed,
  a viewer can see clouds move across the sky. Verified by a test asserting each cloud's
  horizontal position changes as elapsed time advances, with no camera input, and by
  manual inspection in the running game.
- **SC-002 — Varied, not mechanical**: Across a viewing session the clouds show at least
  three distinct drift speeds and vertical positions and more than one silhouette, and
  the procession does not visibly loop. Verified by a test over the cloud set's
  parameters and by manual inspection.
- **SC-003 — Never in the way**: Over a full pass no cloud is ever drawn below the sky
  region or in front of the level, its entities, its background tile layer or the
  heads-up display. Verified by drawing-order and containment assertions and by manual
  inspection.
- **SC-004 — Still smooth**: Adding the layer introduces no perceptible stutter during
  normal play. Verified by manual inspection in the running game at a typical window
  size.
- **SC-005 — Purely decorative**: Adding ambient clouds changes nothing about where the
  character can stand, walk, climb or fall, and nothing about collision, damage or
  scoring. Verified by the unchanged gameplay test suite.
- **SC-006 — Respects reduced motion**: With reduced motion requested, the clouds are
  present but stationary, and the rest of the level plays identically. Verified by a test
  asserting no position change over elapsed time under that preference and by manual
  inspection.
- **SC-007 — Coverage scales with the viewport**: Widening the play area increases the
  number of ambient clouds proportionally and never leaves the sky empty, while narrowing
  it never drops below the minimum population. Verified by asserting the instance count
  against the play area's width at several sizes.

## Assumptions

- **[O-009](../O-009-platformer-background-layers/spec.md) is complete**: the backdrop,
  its bands, its uniform scale and the camera all exist. This feature adds a decorative
  layer and changes no existing band's behaviour.
- **The sky region's geometry belongs to the backdrop and camera, not to this feature.**
  The play area's height, the bottom-anchored camera and the cloud/hills band's position
  are O-009 / [F-015](../F-015-platformer-theme/spec.md) behaviour. This feature derives
  the sky region from them and does not change them.
- **The sky region's top is the HUD's dark margin, not the canvas top.** The flat
  dark-blue band at the top of the play area exists for heads-up-display contrast and is
  not sky, so clouds never drift across it.
- **Art is authored, not generated at runtime**: the clouds draw from a small, fixed
  sprite sheet prepared in the backdrop's own palette. Changing the clouds means
  preparing new art.
- **One cloud set for every level**: as with the backdrop, there is a single ambient
  cloud set used by every level.
- **Variation is seeded**: speeds, offsets and shapes vary so the sky looks random in
  play, but a session's cloud behaviour is reproducible, so it can be asserted in tests
  rather than being flaky.
- **Density is a constant, not per-level data**: the clouds-per-width ratio and its
  minimum live with the feature, not in level files. Every level shows the same density.
- **Drift is one-way**: every cloud crosses the sky right to left; there is no prevailing
  wind that changes with the level or over time.
- **The platformer is already animated**: the level's game loop, the river flipbook and
  the character's own animation exist. This feature adds one more timed layer to that
  loop rather than introducing a new scheduling mechanism.

## Out of Scope

- Changing the backdrop's own static cloud/hills band, its parallax or its art.
- Weather, day/night cycles or biome-based skies.
- Birds, aircraft or any other ambient moving object.
- Any gameplay effect from the clouds: nothing in them blocks, carries, damages or slows
  the character, and nothing in them can be stood on or collected.
- Vertical camera parallax for the ambient clouds: their vertical placement is a property
  of each cloud, not of the camera's vertical position.
- Sound or music associated with the clouds.
- Showing the ambient clouds in the level editor's preview.
