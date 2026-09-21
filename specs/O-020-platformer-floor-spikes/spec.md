# Feature Specification: Platformer Floor Spikes

**Feature Branch**: `O-020-platformer-floor-spikes`
**Created**: 2026-09-21
**Status**: Draft
**Input**: [Issue #68](https://github.com/garcipat/cv-website/issues/68) — a hazard variant that looks
safe but pops spikes out after the player walks over it, as opposed to the existing permanent,
always-visible spike from [O-005](../O-005-platformer-hazards/spec.md).

## Clarifications

### Session 2026-09-21

- Q: What is the pre-trigger visual tell? → A: **A pair of small dark holes** in the ground —
  simple, graphic, and legible at a glance, not a crack texture and not a distinct "mechanism" tile
  like a metal plate. Chosen over a metal plate (a full plate tile reads as clearer machinery but is
  a bigger visual departure from ordinary floor than two holes need to be) and over shipping both
  variants (larger scope than this feature needs).
- Q: Should the tell's color match the specific ground it sits on (brown dirt vs. gray stone)? → A:
  **No — one neutral, dark tone**, since floor spikes need to sit convincingly on more than one
  ground material. A tone that reads as "hole" rather than as a specific ground color avoids needing
  a terrain-matched variant per ground type.
- Q: When does the trigger's delay start counting? → A: **On contact**, with a short, fixed delay —
  a quick pass-through stays safe, but stopping or backtracking onto the tile gets punished.
- Q: Once triggered, how long do spikes stay up, and does the tile reset? → A: **Stays up briefly,
  then retracts and re-arms**, so the same tile is a repeatable obstacle rather than a one-time reveal.
- Q: Is the tile hazardous during the brief 2px "warning" pose, or only once fully extended? → A:
  **Only while fully extended.** The warning pose is a pure visual cue — spikes rising partway — with
  no damage of its own; it exists so a player who is paying attention gets a beat of notice before the
  strike.
- Q: Once a cycle starts (contact happened), does new contact during warning/strike/retract do
  anything? → A: **No — the cycle runs to completion on its own timeline once armed**, regardless of
  further contact, matching how the existing bomb fuse always burns to completion once lit.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Triggering a Floor Spike (Priority: P1)

A visitor walks across a stretch of floor that looks almost normal, marked only by a pair of small
dark holes. As their
character crosses it, the ground gives a small early warning — a sliver of spike edges into view —
then a beat later the spikes shoot fully up. A visitor who kept moving is already clear and takes no
damage; one who lingered, stopped, or doubled back onto the tile gets hurt exactly as they would from
any other spike. After a moment the spikes withdraw back into the ground, the tell reappears, and the
tile is ready to catch the next visitor who steps on it.

**Why this priority**: This is the entire feature — a delayed, resettable hazard that rewards reading
the tell and moving, distinct from the permanent spikes in O-005.

**Independent Test**: Place a floor spike tile, walk the character across it without stopping, verify
no damage is taken. Place another, walk onto it and stay, verify the warning pose appears, then the
full strike appears and damages the character, then it retracts. Step onto the same tile again
afterward and verify the whole cycle repeats identically.

**Acceptance Scenarios**:

1. **Given** a floor spike at rest, **When** no contact has occurred, **Then** only the ground-level
   tell (a pair of small dark holes) is visible, and the tile is not hazardous.
2. **Given** a floor spike at rest, **When** the character's hitbox first overlaps the tile, **Then**
   the tile's cycle begins: after a short fixed delay it shows a partial "warning" rise, and after a
   further short delay it shows a full extend.
3. **Given** a floor spike mid-cycle, **When** it is in its at-rest, contact-not-yet-elapsed, or
   warning phase, **Then** overlapping the tile causes no damage.
4. **Given** a floor spike in its full-extend phase, **When** the character's hitbox overlaps the
   spiky area, **Then** the character takes the same damage a static spike deals, per
   [O-005](../O-005-platformer-hazards/spec.md) and [F-016](../F-016-platformer-health/spec.md).
5. **Given** a floor spike that has fully extended and held, **When** its cycle continues, **Then** it
   retracts back to its at-rest tell and becomes hazard-free and re-triggerable again.
6. **Given** a floor spike already mid-cycle (warning, full-extend, or retracting), **When** the
   character touches it again before the cycle finishes, **Then** the ongoing cycle is unaffected — no
   new cycle starts, and no phase is skipped, held or restarted.

---

### User Story 2 - The Warning Pose Reads as a Cue, Not a Danger (Priority: P2)

A visitor is close enough to a triggered floor spike to see it react, but far enough that they are not
standing on it. The brief partial rise is clearly visible as an in-between step, distinct from both the
flat "at rest" tell and the fully extended spikes, giving them a legible instant to see the tile is
armed and about to become dangerous.

**Why this priority**: The warning pose is what turns "instant surprise trap" into "readable if you're
paying attention," which is the whole point of a tell-driven hazard. It is secondary to the core
trigger/damage loop because the hazard functions (if harshly) even if a player never learns to read it.

**Independent Test**: Trigger a floor spike and freeze-frame or step through its cycle. Verify the
warning phase's spike height is visibly between the at-rest tell and the full extend, and that it does
not damage the character.

**Acceptance Scenarios**:

1. **Given** a floor spike's cycle in progress, **When** it reaches its warning phase, **Then** the
   rendered spike height sits between the at-rest tell and the full-extend height.
2. **Given** the warning phase, **When** the character overlaps the tile, **Then** no damage occurs,
   matching User Story 1's Acceptance Scenario 3.

---

### User Story 3 - Floor Spikes Are Authorable from the Editor (Priority: P3)

A level author opens the level editor and finds the floor spike in the hazard palette, alongside the
static spike, with a readable name and a preview of its art. They paint it onto the grid like any other
hazard, save, and see the same trigger behavior when the level is played.

**Why this priority**: The tile is unusable in level design without a palette entry, but this is the
authoring surface for the behavior above, not new player-facing behavior of its own.

**Independent Test**: Open the editor, select the floor spike from the palette, paint it, save, reload,
and verify it persists and triggers correctly when played.

**Acceptance Scenarios**:

1. **Given** the editor's hazard palette, **When** the author looks for the floor spike, **Then** it
   is present with a name, a description, and a preview showing its at-rest art.
2. **Given** a floor spike placed from the palette, **When** the level is saved and reloaded, **Then**
   the placement and its behavior are unchanged.

---

### Edge Cases

- **Standing on the tile through the whole cycle**: a character that never leaves the tile is
  hazardous exactly once, during the full-extend phase, per the shared post-damage invincibility
  window from [F-016](../F-016-platformer-health/spec.md) — the strike does not deal repeated damage
  for the duration it holds.
- **Leaving and returning after triggering**: per User Story 1's Acceptance Scenario 6, a cycle that
  is already running cannot be re-started or interrupted by more contact; the tile only becomes
  triggerable again once it has fully retracted.
- **Two floor spikes triggered close together**: each tile's cycle is independent; one tile's phase
  never affects another's.
- **Floor spike touched immediately after respawn**: the post-respawn invulnerability from
  [F-016](../F-016-platformer-health/spec.md) applies exactly as it does for a static spike.
- **Overlapping damage sources in the same tick**: a floor spike's full-extend contact combines with
  any other damage source (an enemy, a static spike) using the same one-hit-per-tick rule as
  [O-005](../O-005-platformer-hazards/spec.md).
- **A floor spike mid-cycle at level reset or respawn**: Reset Game and a death/respawn return every
  floor spike to its at-rest phase, exactly as the mushroom squash and placed-bomb transient state are
  cleared on those events.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The game MUST add a floor spike as a new hazard kind, distinct from the static spike,
  placeable by its own level character and available in the level editor's hazard palette.
- **FR-002**: A floor spike MUST start at rest, showing only its ground-level tell, and MUST NOT be
  hazardous while at rest.
- **FR-003**: The character's hitbox overlapping an at-rest floor spike MUST start that tile's cycle
  exactly once, beginning a fixed delay before the cycle's next phase.
- **FR-004**: After its contact delay, a floor spike's cycle MUST show a warning phase — a partial
  rise, visibly between the at-rest tell and the full extend — that is NOT hazardous.
- **FR-005**: After the warning phase, a floor spike's cycle MUST reach a full-extend phase. Only
  while in this phase MUST the tile be hazardous, dealing damage to an overlapping character.
- **FR-006**: Damage dealt by a full-extend floor spike MUST equal the amount a static spike deals
  (per [O-005](../O-005-platformer-hazards/spec.md) and [F-016](../F-016-platformer-health/spec.md)),
  MUST start the same shared invincibility window, MUST be skipped while that window is already
  active, and MUST NOT knock the character back.
- **FR-007**: After holding its full-extend phase briefly, a floor spike's cycle MUST retract back to
  its at-rest phase, becoming hazard-free.
- **FR-008**: Once a floor spike's cycle has started, it MUST run to completion — through warning,
  full-extend, hold and retract — on its own fixed timeline. Further contact with the tile while its
  cycle is already running MUST NOT restart, extend, skip or otherwise alter that timeline.
- **FR-009**: A floor spike MUST become triggerable again only once its cycle has returned to the
  at-rest phase.
- **FR-010**: A floor spike MUST NOT be solid at any point in its cycle — it never blocks movement,
  and the terrain it sits on decides what the character can stand on.
- **FR-011**: A floor spike MUST have no stomp outcome — landing on it from above, at any cycle phase,
  follows the same rules as overlapping it at that phase (hazardous only during full-extend); it is
  never defeated or altered by being jumped on.
- **FR-012**: A floor spike MUST never be destroyed, disabled or consumed by any interaction, and MUST
  NOT drop or reveal anything.
- **FR-013**: A floor spike MUST be placeable in the floor orientation only. Ceiling and wall
  placements are out of scope for this feature.
- **FR-014**: Every floor spike's cycle state MUST reset to at-rest on death/respawn and on Reset
  Game, matching the transient-state reset already used for the mushroom cap squash and placed bombs.
- **FR-015**: A level author MUST be able to place a floor spike from the editor's hazard palette,
  with a name, a description and a preview of its at-rest art, and it MUST round-trip through level
  save and load unchanged.

### Key Entities

- **Floor spike**: a hazard kind whose hazardous state changes over time instead of being permanent.
  It has a position and a cycle phase (at rest, warning, full-extend, holding, retracting), each phase
  with its own fixed duration except at-rest, which lasts until triggered. Only the full-extend and
  holding phases are hazardous. It carries no health, no movement, no lifecycle beyond its own repeating
  cycle, and no reward.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Crossing safely is possible**: a character that keeps moving across a floor spike from
  the moment of first contact clears the tile before the full-extend phase begins, and takes no
  damage. Verified by automated tests over the fixed delay and movement speed.
- **SC-002 — Lingering or backtracking is punished**: a character that remains on or returns to a
  triggered floor spike through its full-extend phase takes damage identical to a static spike's
  contact damage. Verified by automated tests.
- **SC-003 — The warning phase never damages**: at no point during the warning phase does overlapping
  the tile deal damage. Verified by automated tests.
- **SC-004 — The tile is repeatable**: after a full cycle completes and the tile returns to at-rest,
  triggering it again reproduces the same cycle, with the same timing and the same outcomes, an
  unlimited number of times. Verified by automated tests.
- **SC-005 — Mid-cycle contact does not alter the timeline**: repeated contact during an in-progress
  cycle produces the exact same phase durations and outcomes as a single contact would. Verified by
  automated tests.
- **SC-006 — Non-solid at every phase**: a character's collision against the level is identical with
  and without a floor spike present, regardless of the floor spike's current phase. Verified by
  automated tests.
- **SC-007 — Authorable**: the floor spike appears in the editor's hazard palette with a correct
  preview, can be painted, and survives a save and reload. Verified by a component test of the
  palette plus a browser check.

## Assumptions

- **[O-005](../O-005-platformer-hazards/spec.md) (Platformer Spike Hazards) is complete**: the
  hazard concept, the static spike, its damage amount, its collision/invincibility-window rules and
  its non-solid/non-stomp/non-destructible behavior are all defined there. This feature adds a second,
  timed hazard kind and reuses every one of those shared rules rather than redefining them.
- **[F-016](../F-016-platformer-health/spec.md) (Health, damage & respawn) is complete**: the damage
  unit, the shared invincibility window and the death/respawn behavior are reused unchanged.
- **The exact phase durations (contact delay, warning length, full-extend hold, retract length) are
  game feel**, tunable during implementation; the requirement is only that each phase is distinct,
  fixed, and that a normal walking crossing clears the tile before the full-extend phase begins
  (SC-001).
- **Floor spikes are hand-placed**, exactly like static spikes: a floor spike exists only where a
  level author placed it. Nothing derives them from CV data or generates them automatically.
- **Floor spikes are visitor-facing level design, not progression**: no floor spike contributes to any
  counter, journal section or completion condition.

## Out of Scope

- Ceiling- or wall-mounted floor spikes — this feature is floor-only; other orientations, if wanted,
  are a future feature.
- Any trigger condition other than direct character contact (e.g. proximity, a switch, an enemy).
- A reset mechanism other than the tile's own automatic retract-and-rearm (e.g. a level-author-
  controlled reset).
- Any hazard-specific damage amount, health scale, invincibility rule or death behavior — all of
  these belong to [F-016](../F-016-platformer-health/spec.md), reused unchanged.
- Knockback from floor spike contact.
- Solid or one-way-collision behavior; a floor spike never affects movement at any phase.
- Hazard-specific sound or screen effects beyond the shared hit reaction.
- Color or art variants beyond the single floor spike tile.
