# Feature Specification: Platformer Terrain Autotiling & Tile Layers

**Feature Branch**: `O-003-platformer-tile-layers`
**Status**: Partial — two open requirements remain (see ## Requirements)
**Input**: The platformer level reads as flat shapes floating over a plain sky. Terrain
edges, depth behind the terrain, and decorative scenery give the level a sense of place
without changing how it plays.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Ground That Reads as a Landscape (Priority: P1)

A visitor playing the platformer sees grass-topped ground whose edges follow the shape of
the terrain. The top of a platform is a bright, grassy surface; everything buried beneath
it is darker earth. Where the ground ends — at a ledge, a column, a lone floating block —
a dark border runs along the exposed side, so the shape reads as a solid mass with a
defined outline rather than as a grid of identical squares. Grass runs continuously along
a flat stretch of surface and caps off cleanly where the terrain steps up, changes
material, or ends.

**Why this priority**: Ground is the single most-drawn element in the level. Without
edge-aware rendering, every other visual layer sits on top of an obviously tiled grid.

**Independent Test**: Draw columns, thin one-tile platforms, overhangs, staircases and an
isolated single tile in the level editor. Confirm each renders with borders only on the
sides that face open space, a single bright surface row capped by grass, and darker earth
below.

**Acceptance Scenarios**:

1. **Given** a wide flat platform several tiles deep, **When** it renders, **Then** only
   its topmost row is bright and grassed; every row below it is dark.
2. **Given** a one-tile-tall platform, **When** it renders, **Then** it is bright and
   grassed and carries a border along its underside as well as its sides.
3. **Given** a stepped hillside, **When** it renders, **Then** each step has its own
   bright, grassed cap, and grass does not continue across the step-up.
4. **Given** ground sitting directly beside or beneath a bridge, **When** it renders,
   **Then** that side is bordered exactly as if it faced open air — a bridge is a thin
   walkway the player sees past, not terrain.
5. **Given** the same level loaded twice, **When** it renders, **Then** the terrain looks
   identical both times — nothing about the appearance is randomized.

---

### User Story 2 - Depth Behind the Terrain (Priority: P1)

A level author paints a second, purely decorative tile layer behind the terrain: stone and
dirt chunks in varying sizes and two colour families. In the running game, this fill shows
through the gaps around and beneath platforms, so a platform reads as the exposed face of a
solid mass rather than a slab hanging in front of flat sky. Nothing about the layer affects
play — the character walks, falls and collides exactly as it did before the layer was
painted.

**Why this priority**: Depth behind the terrain is what turns a set of platforms into a
place. It is decorative, but it is the difference between a prototype and a level.

**Independent Test**: Paint background fill behind a platform that has a gap in it, then
play the level. Confirm the fill is visible only through the gap and behind the terrain,
never in front of the character or any entity, and that collision is unchanged.

**Acceptance Scenarios**:

1. **Given** a level with background pieces painted, **When** it renders, **Then** every
   piece is drawn behind the terrain and behind every entity, and scrolls with the level
   as the camera moves.
2. **Given** a background piece under a solid platform, **When** the platform covers it,
   **Then** the piece is hidden; where the platform has a gap, the piece shows through.
3. **Given** the character walks over a cell that carries a background piece, **When**
   collision resolves, **Then** the piece has no effect — solidity comes from the terrain
   alone.
4. **Given** a level with no background painted at all, **When** it renders, **Then** it
   looks exactly as it did before this layer existed.
5. **Given** a background piece is stamped over an existing piece, **When** their
   footprints overlap, **Then** the overlapped pieces are replaced by the new one, and a
   right-click removes whichever piece covers the clicked cell.

---

### User Story 3 - Scenery the Player Walks Through (Priority: P2)

A level author places decoration into the level the same way as any other terrain: bushes
and trees, fences, and cave dressing such as crystals, stalactites, stalagmites and
cobwebs. A single bush tile renders as a bush; stacking bush tiles vertically grows a tree
— a root at the bottom, a repeating trunk in the middle, a canopy on top — to any height,
with no upper limit. None of it blocks movement: the character walks and jumps straight
through a bush, a fence, and a tall tree's trunk and canopy alike.

**Why this priority**: Decoration dresses the level without touching physics, so it is
lower risk and lower priority than the layers the whole level is built from.

**Independent Test**: Place a lone bush, a two-tile stack and a five-tile stack in one
level, plus a fence and each cave-dressing piece. Confirm each renders as a complete,
distinct shape and that the character passes through all of them.

**Acceptance Scenarios**:

1. **Given** a single decoration tile with nothing of its kind above or below it, **When**
   it renders, **Then** it draws as a bush.
2. **Given** two or more stacked, **When** they render, **Then** the bottom draws a root,
   the top draws a canopy, and every tile between them draws a trunk segment.
3. **Given** a stack of any height, **When** the author erases one tile from the middle,
   **Then** the two remaining stacks each re-classify into complete shapes on their own.
4. **Given** several bushes in a row or a tall trunk, **When** they render, **Then** their
   individual sprite variants differ so the run does not read as one sprite copy-pasted —
   and the same level always picks the same variants.
5. **Given** the character runs into a bush, a fence, a tree, or any cave-dressing tile,
   **When** collision resolves, **Then** nothing blocks it and it is not climbable.
6. **Given** an entity or sign occupies a cell a tall tree draws over, **When** both
   render, **Then** the entity draws in front of the tree — an authoring consideration,
   not something the game prevents.

---

### User Story 4 - Sky and Water Framing (Priority: P2)

A visitor sees a sky behind everything — solid white at the very top, a band of clouds,
then open colour filling the rest of the view. The sky is fixed to the viewport, so it
stays put no matter how far the camera has scrolled. At the bottom of the level, a band of
water laps in front of the lowest terrain row, cresting with a foam edge and filling
everything below it. The water is anchored to the level, not the screen, so it scrolls with
the terrain and disappears once the camera has moved above it.

**Why this priority**: These two bands frame the playfield top and bottom. They are cheap
and purely visual, but without them the level has no top or bottom edge.

**Independent Test**: Scroll the camera the full width of the level and confirm the sky
does not shift. Confirm the water band sits over the bottom half of the level's last
terrain row, and that it stops drawing entirely once it is off screen.

**Acceptance Scenarios**:

1. **Given** the camera scrolls horizontally, **When** the sky renders, **Then** it is
   unchanged — it does not scroll with the level.
2. **Given** the water band, **When** it renders, **Then** it covers the lower half of the
   level's bottom terrain row, leaving that row's grassed top edge readable.
3. **Given** the camera has moved so the water band is entirely below the visible area,
   **When** the frame draws, **Then** the water draws nothing at all.

---

### Edge Cases

- **A tile at the top row of the level** never sees a neighbour above it — it is treated as
  facing open space, and classification does not fail.
- **A column broken by a gap** is two separate vertical runs and is banded twice, once per
  run: each run gets its own bright, grassed cap.
- **A background placement referencing a piece the catalog no longer holds** is skipped
  rather than crashing the frame.
- **A palette thumbnail for the bush** can only show one static shape. The tree is
  discovered by stacking tiles on the canvas, not by looking at the palette icon.
- **A cell holds exactly one terrain kind.** Painting a decoration tile over terrain
  replaces that terrain rather than layering over it.

## Requirements _(mandatory)_

Behavior only. The tile vocabulary, the neighbour-mask mechanism, multi-cell runs and the
walkthrough for adding a new tile live in
[`docs/themes/platformer/Terrain.md`](../../docs/themes/platformer/Terrain.md); the level
character table and the shape of a background placement record live in
[`docs/themes/platformer/LevelFormat.md`](../../docs/themes/platformer/LevelFormat.md).

### Functional Requirements

#### Grass ground autotiling

- **FR-001**: The game MUST choose each grass-ground tile's artwork from which of its four
  orthogonal neighbours are also ground, drawing a dark border on every edge that faces
  open space and no border where the ground continues.
- **FR-002**: The game MUST treat a bridge neighbour as open space for this purpose, so
  ground beside or beneath a bridge reads exactly as if it faced air.
- **FR-003**: The game MUST decide a grass-ground tile's brightness from its top edge
  alone: a tile with open space above it is a bright exposed surface; a tile with terrain
  above it is dark, however deep it sits. The bright band is therefore always exactly one
  tile tall, at the top of each vertical run.
- **FR-004**: The game MUST draw grass as a separate pass over the ground tile rather than
  as part of it, so any grass-ground tile can be grassed independently of which shape it
  drew.
- **FR-005**: The game MUST continue a grass run into a horizontal neighbour only when that
  neighbour is itself a grass-topped surface, so grass caps off where the terrain steps up,
  changes material, or ends. A run of one, a run of two, and a longer run each read as a
  complete shape.
- **FR-006**: The game MUST render a given level identically on every load — tile choice
  and grass position are decided by the level grid alone, with no randomness.

#### Background tile layer

- **FR-007**: A level MUST be able to carry a list of background piece placements, each
  naming a piece and the cell it is anchored at. A level that carries none MUST render
  exactly as it would without the layer.
- **FR-008**: The game MUST draw the background layer behind the terrain and behind every
  entity, scrolling it with the level.
- **FR-009**: The background layer MUST be purely visual: collision, standing, climbing and
  every other gameplay rule MUST read solidity from the terrain grid alone.
- **FR-010**: Background pieces MUST come in several footprints and in more than one colour
  family, so a painted area reads as varied mass rather than a repeated texture.
- **FR-011**: The level editor MUST offer a Foreground/Background layer choice, with the
  background mode listing every catalog piece to paint with. Stamping a piece MUST replace
  any placement its footprint overlaps, and a right-click MUST erase whichever placement
  covers the clicked cell.

#### Foreground decoration tiles

- **FR-012**: Decoration tiles MUST be painted into the level exactly like any other
  terrain character, and MUST never be solid or climbable — the character passes straight
  through them.
- **FR-013**: The game MUST render a decoration stack by its vertical neighbours: an
  isolated tile as a bush, the bottom of a stack as a root, the top as a canopy, and any
  tile between them as a trunk segment. Stack height MUST have no upper limit.
- **FR-014**: Every stack height MUST be a complete, valid shape, so painting a single tile
  finishes a bush and erasing any tile of a stack leaves valid shapes behind. The editor
  MUST need no paint-time auto-completion for them.
- **FR-015**: Where a decoration has more than one sprite variant, the game MUST pick the
  variant from the cell's own position, so neighbouring tiles differ from each other and
  the same level always renders the same way.
- **FR-016**: The game MUST provide a fence tile and a set of cave-dressing decorations —
  crystals, stalactites, stalagmites and cobwebs — under the same non-solid,
  ordinary-terrain-character rules.
- **FR-017**: The editor palette MUST group foreground tiles under headings that separate
  terrain from decoration from entities, so a decorative tile is not mistaken for a
  walkable one in the palette.

#### Sky and water

- **FR-018**: The game MUST draw a sky behind everything else, fixed to the viewport so it
  does not move as the camera scrolls: solid white rows at the top, a band of cloud, then
  open sky colour filling the remaining height.
- **FR-019**: The game MUST draw a water band anchored to the level's bottom row and
  scrolling with the level, overlapping the lower half of that row so the row's grassed top
  edge stays readable, with a foam crest at its top and solid water beneath it down to the
  bottom of the view. It MUST draw nothing once it has scrolled out of view.

#### Open requirements

Two requirements of this feature are not met by the current implementation.

**Pattern repeat.** Once a background arrangement has been drawn by hand and looks right,
the author has no way to reuse it. A liked arrangement, bounded by a rectangle, should be
capturable as a reusable pattern and expandable across a larger target area, with each
repeated row offset horizontally from the one above it so the repeat's seam breaks into a
diagonal rather than a straight line. Today every piece of a large background area is
placed one at a time.

**Visual clarity.** The background layer as currently painted reads as busy. Foreground
terrain — the solid, walkable mass — is hard to distinguish at a glance from background
fill, which is purely decorative and cannot be stood on. A player scanning the screen
should be able to tell instantly which surfaces they can land on. This is an unsolved
problem: it is not settled whether the fix lies in the artwork, in how the layer is
composited, in how densely it is painted, or somewhere else, and no approach has been
chosen.

### Key Entities

- **Ground tile** — a cell of solid, walkable terrain. Its appearance is a function of
  which of its four neighbours are also ground.
- **Grass overlay** — a strip drawn over the top of an exposed ground tile, positioned by
  where the tile sits in its horizontal run of surface tiles.
- **Background placement** — one decorative piece anchored at one cell. It has a footprint
  in cells, a colour family, and no gameplay meaning at all.
- **Decoration tile** — a non-solid terrain cell that draws scenery: a bush or part of a
  tree, a fence, or a cave-dressing piece.
- **Sky band** — the viewport-fixed backdrop drawn behind everything.
- **Water band** — the level-anchored foreground strip at the bottom of the level.

## Success Criteria _(mandatory)_

- **SC-001 — Terrain edges read correctly**: Every terrain shape a level author can draw —
  a wide mass, a thin platform, a one-tile-wide column, an isolated tile, a staircase, an
  overhang — renders with borders only on the sides facing open space and exactly one
  bright, grassed surface row per vertical run. Verified by drawing each shape in the
  editor and inspecting the running game.
- **SC-002 — Deterministic rendering**: Loading the same level twice produces pixel-identical
  terrain, grass, and decoration-variant choices. Verified by unit tests over the
  neighbour and run classification.
- **SC-003 — Depth reads as depth**: With background fill painted behind a platform that
  has a gap, the platform reads as the face of a solid mass rather than a slab over sky.
  Verified by manual inspection in the running game.
- **SC-004 — Layers are visually inert**: Painting background fill or decoration anywhere
  in a level changes nothing about where the character can stand, walk, climb or fall.
  Verified by collision tests and by playing a level before and after painting.
- **SC-005 — Unbounded tree height**: A stack of two, three, and five or more decoration
  tiles each renders as a complete tree with a root, the right number of trunk segments,
  and a canopy. Verified by tests over each stack height.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) is complete**: the platformer theme, its
  canvas rendering and game loop, the ASCII grid level format, terrain collision and the
  camera all exist. This feature changes only what is drawn — it adds no gameplay rule and
  consumes F-015's terrain grid as its source of truth for solidity.
- **The level editor exists** ([F-019](../F-019-platformer-level-editor/spec.md)). The
  layer toggle, the background piece catalog and the grouped palette are additions to it,
  not a new tool.
- **Art is authored, not generated**: each layer draws from a fixed sprite sheet. Adding a
  new shape, colour family or decoration means adding art first.
- **A cell holds one terrain kind.** Decoration shares the terrain grid with walkable
  tiles, so a decoration tile placed on a cell replaces whatever was there.

## Out of Scope

- Full-scene parallax backdrops, and letting a level choose among several of them.
- Autotiling for any terrain kind other than grass ground — rock, wall, bridge, ladder and
  chain keep their own rendering.
- Neighbour-aware fences that connect posts into a continuous rail.
- Preventing an entity or sign from drawing in front of a tall tree.
- Any gameplay effect from water, sky, background fill or decoration — none of them damage,
  carry, slow or block the character.
- A separate marker or overlay layer that would let a decoration sit on top of terrain
  rather than replace it.
