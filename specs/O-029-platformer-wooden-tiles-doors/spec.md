# Feature Specification: Platformer Wooden Tiles & Doors

**Feature Branch**: `O-029-platformer-wooden-tiles-doors`
**Created**: 2026-09-23
**Status**: Draft
**Input**: [Issue #70](https://github.com/garcipat/cv-website/issues/70) — "Idea: Wooden tiles and
doors." Add wooden-themed tiles and doors as new visual/level-building elements. Flagged as not yet
scoped — in particular, whether "doors" means a decorative tile, an interactable/openable element,
or a transition between rooms — and needing brainstorming before implementation.

## Clarifications

### Session 2026-09-23

- Q: What should the wooden tiles be? → A: Both a solid material a character can stand on, and a
  separate, non-solid material for the wall behind the level.
- Q: What should a door do? → A: It is interactable and openable — not purely decorative, and not a
  transition to another room or level.
- Q: Should the wood ground tile connect to its neighbours (grow edges/corners like the grass
  ground does)? → A: No — a single, self-contained tile that does not visually connect to
  neighbouring wood tiles.
- Q: Does opening a door cost a key, the way opening a chest does? → A: No — opening is free.
- Q: Does opening a door reveal a CV fact, the way breaking a block or opening a chest does? → A:
  No — a door reveals nothing; it exists purely to shape traversal, the way a breakable rock does.
- Q: How wide is a door, and how is it opened? → A: A door is a pair of two door panels standing
  side by side (one tile wide each), opened and closed together as a single unit.
- Q: The door's art is taller than one tile — how should it be shown? → A: Its top is allowed to
  extend into the tile directly above its placement, the way an existing hazard tile is already
  allowed to extend into the tile below its own placement.
- Q: Once opened, can a door be closed again? → A: Yes — interacting with a door toggles it: open
  closes it, closed opens it. It is not a one-time permanent flip.
- Q: Does a door's open/closed state matter only to the player, or to enemies too? → A: To both — a
  closed door blocks enemy movement exactly like it blocks the player, and an open door lets an
  enemy pass through it exactly like it lets the player through.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Build With Solid Wood (Priority: P1)

A visitor sees a stretch of platform built from a warm, planked wood material — visually distinct
from the level's earth and stone terrain. It behaves exactly like any other solid ground: the
character stands on it, is blocked by its sides, and cannot rise through it from below. Each wood
tile is a self-contained plank tile — it does not grow borders, corners or a top edge that connects
into its neighbours the way the earth ground does; placing many of them side by side simply repeats
the same tile.

**Why this priority**: This is the foreground half of the feature and the one a level author reaches
for first — a new solid building material to shape a level with.

**Independent Test**: Paint a run of wood ground tiles in the editor and play the level. Verify the
character can stand on, walk into, and rise against every side of the run exactly as it would
against any other solid terrain, and that the tile's own art never changes to acknowledge a
neighbouring wood tile.

**Acceptance Scenarios**:

1. **Given** a wood ground tile, **When** the character stands on top of it, **Then** it supports the
   character exactly as any other solid ground tile would.
2. **Given** a wood ground tile, **When** the character approaches it from the side or from below,
   **Then** it blocks movement exactly as any other solid ground tile would.
3. **Given** two or more wood ground tiles placed next to each other, **When** the level renders,
   **Then** each tile shows its own fixed appearance, with no border, seam or shape change based on
   which neighbouring tiles are also wood.

---

### User Story 2 - Dress the Backdrop With Wood (Priority: P2)

A visitor sees a level (or a section of one) backed by a wooden wall behind the playable terrain,
rather than the earth or stone backdrop used elsewhere — reading as a distinctly wood-themed room or
area. This backdrop material behaves exactly like every other background material already in the
game: it is never solid, it reads as one continuous mass with clean closed edges wherever it borders
open space, and it never blends with a different background material beside it. It is visibly a
darker, more muted wood than the foreground wood tile, so a wood platform standing in front of a wood
backdrop still reads as two distinct layers rather than blending into one flat surface.

**Why this priority**: This is the backdrop half of the feature. It is lower priority than User Story
1 because a level is playable and readable with only the foreground wood tile; the backdrop is
finishing dressing.

**Independent Test**: Paint a filled region of the wood background material in the editor and view it
in the rendered level. Verify it reads as one continuous, gapless mass with correctly closed edges,
behaves non-solid throughout, and is visibly darker/more muted than a wood ground tile placed in
front of it.

**Acceptance Scenarios**:

1. **Given** a region painted with the wood background material, **When** the level renders,
   **Then** it reads as a single continuous mass with closed edges wherever it meets open space,
   exactly like every other background material.
2. **Given** the wood background material, **When** the character moves through the space in front
   of it, **Then** it never blocks or otherwise affects movement — it is purely visual.
3. **Given** a wood ground tile placed in front of the wood background material, **When** the level
   renders, **Then** the two are visibly distinguishable as separate layers by tone alone.

---

### User Story 3 - Open and Close a Wooden Door to Control a Route (Priority: P1)

A visitor's path is blocked by a closed wooden double door — a solid obstacle the character cannot
walk, jump, or rise through, and that an enemy cannot walk through either. Standing next to the door
and pressing the interact key opens it: both door panels swing open together, and the space they
occupied becomes freely passable — to the character and to any enemy — until someone closes it again.
Pressing interact next to an open door closes it the same way, restoring it as a solid obstacle to
both. Opening or closing costs nothing and reveals nothing — the door exists purely to gate a route,
the way a breakable rock shapes a path without carrying any CV content of its own, except that unlike
a rock it can be reopened and reclosed freely.

**Why this priority**: This is the interactive half of the feature and the one the source idea
specifically called out as needing to be more than decoration — a door that cannot be opened is
indistinguishable from a painted wall. Making it toggle both ways, and gating enemies as well as the
player, is what turns it into a level-design tool rather than a one-time unlock.

**Independent Test**: Place a closed door blocking a route, with an enemy patrolling toward it. Verify
neither the character nor the enemy can pass through it. Stand next to it and press interact — verify
both panels open, and that both the character and the enemy can now pass through the space. Press
interact again — verify the door closes and blocks both once more.

**Acceptance Scenarios**:

1. **Given** a closed door, **When** the character attempts to walk, jump, or rise into it from any
   side, **Then** it blocks movement exactly like solid terrain.
2. **Given** a closed door, **When** an enemy's patrol or movement would carry it into the door,
   **Then** the door blocks it exactly as it blocks the character.
3. **Given** a closed door, **When** the character stands next to either of its two panels and the
   visitor presses the interact key, **Then** both panels open together, and the door stops blocking
   both the character and any enemy, and no key is spent and no fact is revealed.
4. **Given** an open door, **When** the character stands next to either of its two panels and the
   visitor presses the interact key, **Then** both panels close together, and the door resumes
   blocking both the character and any enemy.
5. **Given** a door in either state, **When** the character is not standing next to it, **Then**
   pressing the interact key does nothing to the door.
6. **Given** an open door, **When** the character or an enemy moves through the space it occupied,
   **Then** nothing blocks them — the space behaves like any other passable gap in the terrain.

---

### Edge Cases

- **Interacting near only one of the two panels**: toggling either panel toggles the whole door — the
  two panels are one unit and are never in different states from one another.
- **A door toggled, then Reset Game**: like every other permanent per-session state change (chests,
  broken blocks), a door returns to closed when the visitor resets the game, regardless of how many
  times it was opened and closed beforehand.
- **A door toggled, then the character dies and respawns**: a door's current state (open or closed)
  persists across a death/respawn, exactly as an opened chest or a destroyed block does — only Reset
  Game reverts it to closed.
- **The character or an enemy standing inside the door's footprint at the moment it toggles**: toggling
  never moves, damages, or otherwise affects a character or enemy already there — it only changes
  whether that space blocks movement going forward.
- **An enemy whose patrol range spans a door**: a closed door turns the enemy back exactly like any
  other solid wall it patrols up to; if the door is later opened, the enemy is free to walk through it
  and beyond into whatever space it opens onto — a level author who does not want that has to design
  the enemy's placement and the door's state accordingly, the same way any other patrol boundary
  already has to be authored deliberately.
- **A wood ground tile directly beside a wood background tile**: the two are independent systems (one
  solid foreground terrain, one non-solid backdrop) and never interact with or reference each other's
  placement.
- **The interact key pressed near both a door and another interactable (e.g. a chest) at once**: out
  of scope for this feature to arbitrate — existing interact-key precedent already resolves this for
  chests, and a door follows the same rule.

## Requirements _(mandatory)_

The code-level contract behind these behaviors — the new terrain kinds, the door's paired-panel
state, and how each is added — is documented in
[docs/themes/platformer/Terrain.md](../../docs/themes/platformer/Terrain.md) once implemented. This
specification states behavior only and does not restate that contract.

### Functional Requirements

- **FR-001**: The game MUST provide a solid wood ground tile, placeable by a level author, visually
  distinct from every existing terrain material.
- **FR-002**: A wood ground tile MUST be solid from every direction, identical in collision behavior
  to the game's other solid terrain tiles.
- **FR-003**: A wood ground tile's appearance MUST be fixed and self-contained — it MUST NOT change
  based on which neighbouring tiles are also wood, and MUST NOT grow connecting borders, corners, or
  edge art the way the earth ground tile does.
- **FR-004**: The game MUST provide a wood background material, placeable by a level author as part
  of the game's existing non-solid backdrop system, and MUST behave exactly as every other background
  material does (continuous masses, closed edges against open space, no blending with a differently-
  materialed neighbour).
- **FR-005**: The wood background material MUST render as a visibly darker, more muted wood tone than
  the wood ground tile, so the two remain visually distinguishable when placed near each other.
- **FR-006**: The game MUST provide a wooden door, placeable by a level author, made of two panels
  occupying two adjacent tiles side by side.
- **FR-007**: A closed door MUST be solid from every direction across both of its panels, blocking
  movement exactly like solid terrain, for both the character and any enemy, until it is opened.
- **FR-008**: Standing next to either panel of a door and pressing the interact key MUST toggle it:
  a closed door opens, an open door closes, and both panels MUST transition together in either
  direction.
- **FR-009**: While open, a door MUST stop being solid — the space its two panels occupy MUST become
  freely passable to both the character and any enemy — until it is closed again.
- **FR-010**: While closed, a door MUST resume blocking movement for both the character and any
  enemy, exactly as it did before it was first opened.
- **FR-011**: Toggling a door, in either direction, MUST NOT require or consume any item, and MUST
  NOT reveal any CV fact or advance any collectible counter — it is a traversal gate only.
- **FR-012**: A door MAY be toggled open and closed an unlimited number of times in a session; there
  is no limit on how many times it can be reopened or reclosed.
- **FR-013**: A door's current state (open or closed) MUST reset to closed on Reset Game, and MUST
  persist, whichever it currently is, across a death/respawn.
- **FR-014**: The interact key MUST have no effect on a door when the character is not standing next
  to either of its panels.
- **FR-015**: A level author MUST be able to place the wood ground tile, the wood background
  material, and the door from the level editor's palette, and each MUST round-trip through level save
  and load unchanged, including a door's placement as a matched pair of panels.

### Key Entities

- **Wood ground tile**: a solid terrain material with one fixed appearance per cell, no neighbour
  awareness, and no state.
- **Wood background material**: a non-solid backdrop material participating in the existing
  background-mass system, distinguished from other materials by tone alone.
- **Wooden door**: a two-panel obstacle with a single open/closed state shared by both panels,
  toggled by the interact key and freely reversible. Closed is solid and blocks both the character and
  enemies; open is non-solid and lets both pass. It carries no key requirement and no CV mapping.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Wood ground is solid terrain**: a character's movement against a wood ground tile is
  indistinguishable, in every collision test that already covers the game's other solid terrain, from
  its behavior against any other solid tile. Verified by automated tests.
- **SC-002 — Wood ground does not connect**: painting any arrangement of wood ground tiles never
  produces a border, corner, or edge variation based on neighbouring wood tiles. Verified by automated
  tests.
- **SC-003 — Wood backdrop behaves like every other background material**: a painted region of the
  wood background material passes the same continuity/closed-edge/no-blending checks the game's other
  background materials already pass. Verified by automated tests.
- **SC-004 — Foreground and backdrop stay visually distinct**: the wood ground tile and the wood
  background material never share the same rendered tone. Verified by a visual/manual check.
- **SC-005 — A closed door blocks, an open door does not, for both the character and enemies**:
  collision against a door — for the character and for an enemy — is solid in every direction while
  closed and absent in every direction once open, with no partial state. Verified by automated tests.
- **SC-006 — Toggling is free and silent**: opening or closing a door never changes a key count or
  any collectible counter, and never reveals a fact. Verified by automated tests.
- **SC-007 — A door toggles without limit**: repeated interaction with a door alternates its state
  open/closed/open/... indefinitely with no cap, and Reset Game always returns it to closed regardless
  of its state at the time. Verified by automated tests.
- **SC-008 — Authorable**: all three additions appear in the editor's palette with a name, a
  description, and a preview, and each survives a save and reload, including a door's two-panel
  pairing. Verified by a component test of the palette plus a browser check.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) (2D Platformer Theme) is complete**: the game loop,
  terrain rendering, physics, and level format this feature adds to already exist.
- **[O-014](../O-014-platformer-background-tiles/spec.md) (Background Tile Rework) is complete**: the
  wood background material is a new material within that already-shipped system, not a new mechanism.
- **One visual variant for now**: the wood ground tile and the wood background material each ship
  with a single, fixed appearance. Additional plank patterns, color variants, or a connecting/
  autotiled look are not part of this feature (see Out of Scope) and may follow later.
- **A door is always authored as a matched pair**: a level author places both of a door's panels
  together: the feature does not define behavior for a single, unpaired panel.
- **Exact interaction range and opening feel are game feel**: how close "standing next to" a panel
  needs to be, and any animation while opening, are tunable during implementation; the requirement is
  only that it is interact-key-triggered, free, silent, and permanent for the session.

## Out of Scope

- A door that requires a key, or that reveals a CV fact — see the Clarifications above.
- A door as a decorative-only tile, or as a transition to another room or level — explicitly ruled
  out by the Clarifications above.
- Multiple wood ground or wood background visual variants, or a connecting/autotiled wood ground
  look — a future feature, not this one.
- A door wider or taller than two panels, or a single-panel door.
- Any sound or screen effect beyond whatever the game's existing interact/open feedback already
  provides — see [O-008](../O-008-platformer-audio/spec.md).
- Any change to the chest, key, or block systems — the door is additive and does not touch their
  behavior.
