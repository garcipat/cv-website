# Feature Specification: Platformer Ladders & Climbing

**Feature Branch**: `S-008-platformer-ladders`  
**Feature ID**: S-008  
**Status**: Implemented  
**Input**: Climbable terrain so parts of the level can be reached vertically, with the camera following the character up and down.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Climb a Ladder to Reach a Higher Area (Priority: P1)

Some parts of the level are only reachable by climbing. A ladder is a terrain tile, visually distinct from ordinary ground, that the character passes through freely in every direction — it is not solid — but can ascend and descend while overlapping it. Standing on or against a ladder and pressing Up starts climbing upward; pressing Down starts climbing downward. While climbing, gravity is suspended and vertical movement is driven directly by the Up and Down keys at a fixed climb speed; holding neither leaves the character hanging in place. On grabbing the ladder the character snaps horizontally onto the ladder's column so it rides the rungs centered rather than clinging to one edge, and a climbing animation plays that advances only while the character is actually moving up or down.

**Why this priority**: Ladders are the last piece of core traversal the level design needs, and without them vertical level layouts are unreachable.

**Independent Test**: Walk into a ladder column and press Up — the character rises at a steady speed instead of falling, centered on the ladder, with the climb animation running. Release the keys — the character holds its height and the animation stops.

**Acceptance Scenarios**:

1. **Given** the character's hitbox overlaps a ladder tile and it is not moving upward, **When** the visitor presses Up or Down, **Then** the character enters the climb, snapping horizontally to the center of the ladder's column.
2. **Given** the character is climbing, **When** the visitor holds Up, **Then** it moves upward at a fixed climb speed with gravity suspended; **When** the visitor holds Down, **Then** it moves downward at the same speed.
3. **Given** the character is climbing, **When** neither Up nor Down is held, **Then** it stays at its current height, and the climbing animation holds on its current frame rather than cycling.
4. **Given** the character is falling past a ladder, **When** the visitor presses Up or Down while its hitbox overlaps the ladder, **Then** it grabs on and the fall stops.
5. **Given** the character is climbing, **When** it is drawn, **Then** it uses the dedicated climbing pose rather than the idle, walking or jumping pose, whatever its grounded or airborne state would otherwise suggest.

---

### User Story 2 - Leave a Climb Sideways or by Jumping (Priority: P1)

Climbing never traps the visitor. Left and Right work exactly as they do on the ground while climbing, so the character can shimmy sideways off the ladder mid-climb; the instant no part of its hitbox overlaps any climbable tile, the climb ends and normal gravity and collision resume — from rest, so the character starts falling rather than continuing at climb speed. Pressing Jump while climbing ends the climb immediately and applies a normal jump impulse, identical to jumping from solid ground.

**Why this priority**: Free-form entry and exit is what makes climbing feel like part of the same movement system rather than a separate mode, and it prevents a visitor from getting stuck on a ladder.

**Independent Test**: Climb halfway up a ladder, then hold Left — the character walks off the side and immediately begins to fall. Climb again and press Jump — the climb cancels into an ordinary jump.

**Acceptance Scenarios**:

1. **Given** the character is climbing, **When** the visitor presses Left or Right, **Then** it moves horizontally at the normal walking speed, unchanged from non-climbing movement.
2. **Given** horizontal movement carries the character's hitbox off every climbable tile, **When** that happens, **Then** the climb ends on that same frame and normal gravity and collision resume.
3. **Given** a climb has just ended by moving off the ladder, **When** the character falls, **Then** it falls from rest — the climb's vertical speed is not carried into the fall.
4. **Given** the character is climbing, **When** the visitor presses Jump, **Then** the climb ends immediately and a normal jump impulse is applied, the same as a jump from solid ground.
5. **Given** the character has just jumped off a ladder, **When** it is still overlapping the ladder while rising, **Then** it does not immediately re-grab the ladder — a fresh grab requires the character not to be moving upward.

---

### User Story 3 - Stand on Top of a Shaft and Climb Back In (Priority: P2)

A ladder shaft's topmost tile can be stood on from above, but only when nothing solid and nothing climbable sits directly over it. Climbing to the top of such a shaft ends the climb with the character standing on that top rung, rather than climbing on into empty air. Falling onto that same top rung from above catches the character in the same way. While standing there, pressing Down re-enters the climb going downward, mirroring the way Down drops the character through a one-way bridge.

Where the shaft's top does have something solid or climbable above it, the plain rule applies instead: the character climbs until its feet leave the ladder and then falls.

**Why this priority**: Without a standable top, every ladder needs a separate platform placed beside it and the character can climb off into nothing. It is P2 because a level can be authored around the limitation.

**Independent Test**: Climb a shaft whose top rung is open above — the character ends up standing on the top rung. Press Down there — it re-enters the climb heading downward. Walk off the platform and fall back onto the same rung — it lands on it.

**Acceptance Scenarios**:

1. **Given** a shaft whose topmost climbable tile has neither solid nor climbable terrain directly above it, **When** the character climbs to the top of that shaft, **Then** the climb ends with the character standing on that top tile.
2. **Given** the character is standing on such a top rung, **When** the visitor presses Down, **Then** it re-enters the climb, moving downward into the shaft.
3. **Given** the character is falling from above onto such a top rung, **When** it reaches the tile, **Then** it lands and stands on it.
4. **Given** a shaft whose topmost climbable tile has solid or climbable terrain directly above it, **When** the character climbs past the shaft's top, **Then** it is not stopped there — it climbs until its feet leave the climbable tiles and then falls.
5. **Given** any climbable tile other than a standable shaft top, **When** the character passes through it horizontally or vertically, **Then** it is never blocked — climbable terrain is not solid.

---

### User Story 4 - Follow the Character Vertically with the Camera (Priority: P2)

Because a ladder shaft can be taller than the play area, the camera follows the character vertically as well as horizontally. Where the horizontal axis centres the character, the vertical axis deliberately does not: the character is framed low, a few rows up from the bottom of the play area, so most of the view shows what lies ahead and above rather than the ground already crossed.

The vertical dead zone is asymmetric around that target. Above it there is a generous margin — the character can rise well up the view before the camera reacts, so a jump or a short climb does not jerk the view. Below it there is none at all: the moment the character falls past the target row the camera follows immediately, because ground rushing up is what a player needs to see. Within the band the camera holds still.

The camera is not constrained by the level's own edges. If framing the character at the target row means showing empty space above the level's top or below its bottom, it does exactly that and the backdrop fills the gap — a short level is framed by the same rule as a tall one, not pinned to its floor. On spawn and on respawn the camera snaps straight to the framing rather than easing into it, so the character is correctly placed on the very first frame.

**Why this priority**: Vertical follow is what makes tall level layouts playable at all, but it is only meaningful once such a layout exists.

**Independent Test**: Climb a tall ladder — the view follows and the character settles low in frame. Walk off a ledge — the view follows downward at once, with no lag. Jump on the spot — the view does not move. Respawn — the character is framed at the target row on the first frame drawn.

**Acceptance Scenarios**:

1. **Given** the character is at rest, **When** the view settles, **Then** the character is framed a fixed few rows above the bottom of the play area, not centred.
2. **Given** the character moves within the vertical dead zone, **When** it rises no higher than the band's generous top margin, **Then** the camera does not move.
3. **Given** the character descends past the target row, **When** it falls or climbs down, **Then** the camera follows immediately, with no slack below the target.
4. **Given** the character climbs above the dead zone's top margin, **When** it keeps ascending, **Then** the camera scrolls up only far enough to return it to that margin.
5. **Given** framing the character requires it, **When** the camera reaches the level's top or bottom edge, **Then** it keeps going past that edge and the backdrop fills the empty space rather than the camera stopping.
6. **Given** the character spawns or respawns, **When** the first frame is drawn, **Then** the camera is already at the correct framing rather than easing toward it.

---

### User Story 5 - Climb a Chain (Priority: P3)

A chain is a second climbable skin. It behaves identically to a ladder in every respect — entering, climb speed, gravity suspension, horizontal movement, jump cancel, standable shaft top, camera follow — and differs only in how it looks. A level author picks one or the other purely for the look the level needs, with no gameplay consequence to the choice.

**Why this priority**: Pure variety. Levels are fully playable with ladders alone.

**Independent Test**: Repeat every ladder scenario against a chain shaft — each behaves identically.

**Acceptance Scenarios**:

1. **Given** a chain tile, **When** the character interacts with it in any of the ways described above, **Then** it behaves exactly as the same interaction with a ladder tile.
2. **Given** a shaft mixing ladder and chain tiles, **When** the character climbs it, **Then** the climb runs continuously across the boundary — the mix has no effect on movement.

---

### Edge Cases

- **A one-tile-tall shaft**: a single climbable tile with open space above is a standable top rung; pressing Down on it enters and immediately exits the climb.
- **A shaft resting directly on the ground**: climbing down ends where solid ground catches the character.
- **A climbable tile against a wall**: side movement into the wall is blocked by the wall, not by the ladder — leaving the ladder sideways simply is not possible there, and the character keeps climbing.
- **Holding Up and Down together**: Up wins; the character climbs upward.
- **Climbing while a hint bubble is showing**: the interact key that reveals a hint is the same Up key that climbs; overlapping a ladder means the press climbs.
- **The game paused mid-climb**: the character holds its position on the ladder and resumes the climb on unpause.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Climbable terrain MUST be non-solid — the character passes through it freely in every direction and it never blocks horizontal movement or a fall.
- **FR-002**: The character MUST enter a climb when its hitbox overlaps a climbable tile, it is not moving upward, and the visitor presses Up or Down.
- **FR-003**: Entering a climb MUST snap the character horizontally to the center of the climbable column it grabbed.
- **FR-004**: While climbing, gravity MUST be suspended and vertical movement MUST be driven directly by Up and Down at a fixed climb speed. Holding neither MUST hold the character's height.
- **FR-005**: Horizontal movement while climbing MUST behave exactly as it does when not climbing.
- **FR-006**: The climb MUST end on the frame the character's hitbox no longer overlaps any climbable tile, and normal gravity and collision MUST resume from rest — the climb's vertical speed is not carried forward.
- **FR-007**: Pressing Jump while climbing MUST end the climb immediately and apply a normal jump impulse, identical to a jump from solid ground.
- **FR-008**: A climbable shaft's topmost tile MUST be standable from above when nothing solid and nothing climbable sits directly above it. Climbing to the top of such a shaft MUST end the climb with the character standing on that tile, and falling onto it MUST land the character on it.
- **FR-009**: Where a shaft's topmost tile has solid or climbable terrain above it, climbing MUST continue until the character's feet leave the climbable tiles, after which it falls.
- **FR-010**: Pressing Down while standing on a standable shaft top MUST re-enter the climb moving downward.
- **FR-011**: The character MUST render in a dedicated climbing pose whenever it is climbing, taking precedence over the idle, walking and jumping poses. That animation MUST advance only while the character is actually moving vertically.
- **FR-012**: The camera MUST follow the character vertically using a dead zone, holding still while the character stays inside the band and otherwise moving only far enough to return it to the band's edge.
- **FR-013**: Vertical camera movement MUST keep the character framed at a fixed target height near the bottom of the viewport, with generous slack above it and none below, so that climbing reveals what is overhead while descending tracks the character immediately.
- **FR-014**: Vertical camera movement MUST NOT be constrained by the level's own bounds. Where framing the character at the target height requires it, the camera scrolls the level's top edge below the top of the view, or its bottom edge above the bottom of the view, and the backdrop fills the space that opens up. A level shorter than the viewport is framed by the same rule as any other, not pinned to its bottom. See [O-009](../O-009-platformer-background-layers/spec.md) for the backdrop that fills it.
- **FR-015**: The chain MUST be a second climbable skin whose behavior is identical to the ladder's in every respect listed above, differing only in appearance. Any rule stated for a ladder applies unchanged to a chain, including within a shaft that mixes both.

### Key Entities

- **Climbable tile**: a terrain tile the character can ascend and descend but cannot collide with. Ladder and chain are its two skins; every rule in this feature is expressed against "climbable", never against one skin.
- **Shaft**: a vertical run of consecutive climbable tiles in one column. Its topmost tile is the only one that can be standable, and only when nothing solid or climbable sits above it.
- **Climb state**: the character's mode while attached to a shaft — gravity suspended, vertical velocity driven by input, exited by leaving every climbable tile, by jumping, or by reaching a standable shaft top.

How climbable tiles are declared and drawn — including the chain's rendering model — is code knowledge and lives in [`docs/themes/platformer/Terrain.md`](../../docs/themes/platformer/Terrain.md). The level characters that place them are listed in [`docs/themes/platformer/LevelFormat.md`](../../docs/themes/platformer/LevelFormat.md).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Vertical areas are reachable**: an area placed above a ladder shaft, unreachable by jumping alone, is reachable by climbing.
- **SC-002 — Climbing never traps**: from any point in a climb, moving sideways off the shaft or pressing Jump returns the character to normal movement on the same frame.
- **SC-003 — Shaft tops are usable**: climbing a shaft with open space above ends with the character standing on its top rung, and pressing Down there returns it to the climb.
- **SC-004 — Tall levels stay visible**: on a level taller than the viewport, the character remains on screen throughout a full climb from bottom to top, and the view never shows beyond the level's bottom edge.
- **SC-005 — Short levels never scroll**: on a level that fits the viewport, the vertical view is identical at every character position.
- **SC-006 — The skins are interchangeable**: every scenario in this specification produces the same result on a chain shaft as on a ladder shaft.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) is complete**: the platformer theme's movement, gravity, solid collision, one-way bridge tiles, horizontal camera follow and terrain rendering all exist. S-008 adds a climbable terrain behavior and a vertical camera axis on top of them.
- **Shared input keys**: Up and Down are the same keys used for the bridge drop-through and for interacting with chests and signs. Which behavior a press produces is decided by what the character is standing on or overlapping, and a single tile is never two of those things at once.
- **Level authors place shafts deliberately**: nothing generates or validates ladder placement — a shaft that leads nowhere, or one whose top is blocked, is a level-design choice rather than an error the game reports.
- **Session-scoped**: no climb state is persisted; a reset or a theme switch returns the character to its spawn point.

## Out of Scope

- Climbable terrain that is also solid, or a ladder the character can be blocked by
- Horizontal climbable runs such as monkey bars or ropes traversed sideways
- Sliding down a shaft faster than the fixed climb speed, or any variable climb speed
- Attaching to a shaft automatically on contact, without a key press
- Camera zoom or any camera behavior other than dead-zone follow with clamping
- The chain's art and rendering model — see [`docs/themes/platformer/Terrain.md`](../../docs/themes/platformer/Terrain.md)
- Climbing sound effects — see [O-008](../O-008-platformer-audio/spec.md)
