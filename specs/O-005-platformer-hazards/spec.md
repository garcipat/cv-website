# Feature Specification: Platformer Spike Hazards

**Feature Branch**: `O-005-platformer-hazards`
**Status**: Implemented
**Input**: Static level hazards that hurt the character on contact.

A hazard is a static piece of the level that damages the character on touch. Unlike an
enemy, it never moves, is never defeated, and cannot be stomped — there is no way to
"beat" a hazard, only to avoid it. The only hazard kind is the **spike**.

Damage amount, the health scale, the invincibility window after taking damage and the
respawn that follows reaching zero health are all owned by
[F-016](../F-016-platformer-health/spec.md); this feature reuses them rather than defining
its own.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Taking Damage from a Spike (Priority: P1)

A visitor runs along a corridor and steps onto a bed of spikes jutting up from the floor.
The character flashes and loses half a heart. The visitor jumps clear, and their character
stays briefly invulnerable while the flash lasts, so a single stumble across the spikes
costs one hit rather than draining the whole health bar in an instant.

**Why this priority**: This is the entire feature — a hazard exists to make a piece of
terrain cost health.

**Independent Test**: Place a floor spike, walk the character into it, verify health drops
by half a heart and the post-hit invincibility window starts.

**Acceptance Scenarios**:

1. **Given** a spike is placed in the level, **When** the character's hitbox overlaps the
   spike's spiky part, **Then** the character loses the same amount of health as an enemy
   side contact costs, per [F-016](../F-016-platformer-health/spec.md).
2. **Given** the character has just taken damage from any source, **When** it touches a
   spike while still in the invincibility window, **Then** no further damage is taken.
3. **Given** the character overlaps several spikes at once, **When** the tick resolves,
   **Then** exactly one hit is applied, not one per spike.
4. **Given** the character touches a spike, **When** damage is applied, **Then** the
   character is not shoved away — a spike hurts but does not knock back.
5. **Given** a spike hit brings health to zero, **When** the tick resolves, **Then** the
   death and respawn behavior from [F-016](../F-016-platformer-health/spec.md) takes over
   unchanged.

---

### User Story 2 - Spikes on Any Surface (Priority: P2)

A level author wants spikes on the floor of a pit, hanging from the ceiling of a low
tunnel, and mounted on the walls of a narrow shaft. Each is placed with the orientation it
needs, and each is drawn pointing away from the surface it is attached to. A visitor can
jump over a floor spike's tips, or run under a ceiling spike, without being hurt by the
empty part of the tile the spike sits in.

**Why this priority**: Orientation is what makes spikes usable as level design rather than
a single floor decoration, but the feature is functional with floor spikes alone.

**Independent Test**: Place a spike in each of the four orientations. Verify each renders
pointing away from its mounting surface, and that passing through the tile clear of the
spiky part causes no damage.

**Acceptance Scenarios**:

1. **Given** spikes placed facing up, down, left and right, **When** they render, **Then**
   each is drawn in the orientation it was placed with, tips pointing away from its
   mounting surface.
2. **Given** a floor spike, **When** the character jumps over it clear of its tips, **Then**
   no damage is taken even though the character passed through the spike's tile.
3. **Given** a wall-mounted spike, **When** the character passes along the far side of the
   tile without touching the spiky part, **Then** no damage is taken.

---

### User Story 3 - A Hazard Is Not an Enemy (Priority: P2)

A visitor who has learned to defeat slimes by jumping on them tries the same on a bed of
spikes. Landing on the spikes hurts exactly like walking into them — nothing is defeated,
nothing is dropped, and the spikes are still there afterwards.

**Why this priority**: The visitor's instinct from enemies must fail clearly and
consistently, or spikes read as broken enemies.

**Independent Test**: Land on a spike from above. Verify damage is taken, the spike remains,
and no reward, counter or reveal occurs.

**Acceptance Scenarios**:

1. **Given** a spike, **When** the character lands on it from above, **Then** damage is
   taken exactly as for any other contact — there is no stomp outcome.
2. **Given** a spike has damaged the character, **When** the world continues, **Then** the
   spike is unchanged and remains hazardous indefinitely.
3. **Given** a spike is touched any number of times, **When** each touch resolves, **Then**
   no CV fact, key, coin or counter is affected.

---

### Edge Cases

- **Overlapping damage sources in one tick**: an enemy contact and a spike contact in the
  same tick cost one hit total, because the enemy hit starts the invincibility window that
  the spike check then observes.
- **Standing still on a spike**: damage repeats only once the invincibility window from
  [F-016](../F-016-platformer-health/spec.md) has expired; it is not applied every tick.
- **Spike inside otherwise passable terrain**: a spike does not make its tile solid; whether
  the character can stand there is decided entirely by the terrain under it.
- **A spike encountered immediately after respawn**: the post-respawn invulnerability from
  [F-016](../F-016-platformer-health/spec.md) applies, so a spike beside the spawn point
  cannot chain-kill the character.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The game MUST support hazards as a distinct kind of level content — static,
  never damaged, never moving, and never removed.
- **FR-002**: A spike MUST damage the character when the character's hitbox overlaps the
  spike's hazardous area.
- **FR-003**: A spike's damage amount MUST be the same half-heart unit an enemy side contact
  costs, as defined by [F-016](../F-016-platformer-health/spec.md). This feature does not
  define its own health scale or damage value.
- **FR-004**: A spike hit MUST start the shared post-damage invincibility window from
  [F-016](../F-016-platformer-health/spec.md), and MUST be skipped entirely while that
  window is already active — including when another source opened it in the same tick.
- **FR-005**: Contact with more than one hazard at once MUST cost at most one hit.
- **FR-006**: A spike MUST NOT knock the character back. It starts the hit reaction and
  nothing more — matching a pit fall rather than an enemy side contact.
- **FR-007**: A spike MUST have no stomp outcome. Landing on it from above damages the
  character exactly as any other contact does; it is never defeated by being jumped on.
- **FR-008**: A spike MUST never be destroyed, disabled or consumed, and MUST NOT drop or
  reveal anything.
- **FR-009**: A spike MUST NOT be solid — it does not block movement, and the terrain it sits
  on decides what the character can stand on.
- **FR-010**: A spike MUST be placeable in four orientations — pointing up from a floor, down
  from a ceiling, and out from either a left or a right wall — and MUST render in the
  orientation it was placed with.
- **FR-011**: Only the spike's visible spiky part MUST be hazardous, not the whole tile it
  occupies, so that passing through the empty part of the tile is safe.
- **FR-012**: A spike hit that reduces health to zero MUST hand off to the death and respawn
  behavior of [F-016](../F-016-platformer-health/spec.md) with no hazard-specific handling.

### Key Entities

- **Hazard** — a static, indestructible piece of level content that costs the character
  health on contact. It has a position, an orientation, a hazardous area and a damage amount.
  It carries no health, no movement, no lifecycle and no reward.
- **Spike** — the only hazard kind. Available in four orientations; hazardous only across the
  band its drawn spikes occupy.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Contact costs health**: touching a spike's hazardous area reduces health by the
  same amount an enemy side contact does. Verified by automated tests.
- **SC-002 — One hit per window**: repeated or simultaneous hazard contacts within the
  invincibility window cost no additional health, and a hazard contact in the same tick as an
  enemy contact costs nothing extra. Verified by automated tests.
- **SC-003 — No knockback**: the character's horizontal velocity and control are unaffected
  by a spike hit; only health and the hit reaction change.
- **SC-004 — No stomp**: landing on a spike from above produces the same damage outcome as
  any other contact, and the spike survives.
- **SC-005 — Orientation-accurate hazard area**: for each of the four orientations, contact
  within the drawn spiky band damages and contact elsewhere in the tile does not. Verified by
  automated tests over all four orientations.
- **SC-006 — Non-solid**: a spike never blocks or alters movement; a character's collision
  against the level is identical with and without a spike present on a passable tile.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) (Platformer theme) is complete**: the game
  loop, the character's hitbox, physics, the level format and its markers, and the rendering
  pipeline all exist. Hazards are placed from level markers like any other level content.
- **[F-016](../F-016-platformer-health/spec.md) (Health, damage & respawn) is complete**: the
  three-heart HUD, the half-heart damage unit, the shared post-damage invincibility window,
  the hit reaction and the respawn on reaching zero health are all defined there. This feature
  reuses every one of them and defines none of them.
- **Spikes are hand-placed**: a spike exists only where a level author placed it, with the
  orientation the author chose. Nothing derives spikes from CV data or generates them
  automatically.
- **Hazards are visitor-facing level design, not progression**: no hazard contributes to any
  counter, journal section or completion condition.

## Out of Scope

- Hazard kinds other than the spike — lava, saw blades, crushers, moving or timed hazards.
- Hazards that can be defeated, disabled, destroyed or triggered.
- Hazards that damage enemies.
- Any hazard-specific damage amount, health scale, invincibility rule or death behavior —
  all of these belong to [F-016](../F-016-platformer-health/spec.md).
- Knockback from hazard contact.
- Solid or one-way-collision hazards; a spike never affects movement.
- Hazard-specific sound or screen effects beyond the shared hit reaction.
