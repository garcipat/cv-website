# Feature Specification: Platformer Health, Pit Falls & Respawn

**Feature Branch**: `F-016-platformer-health`  
**Status**: Implemented  
**Input**: The platformer theme needs a survivable failure model — a visible health budget, a cost for falling into a pit, a recovery that does not throw away progress, and one damage-timing rule every hazard in the game shares.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Reading Health at a Glance (Priority: P1)

A visitor playing the platformer sees three hearts in the top-left corner of the screen, beside the journal icon. All three are full at the start of a run. After the character takes a hit, the rightmost filled heart becomes a half heart; after another, it becomes empty. The hearts are always visible while playing — the visitor never has to open a menu to know how much health is left.

**Why this priority**: Health that cannot be read is not a mechanic. The HUD is the whole feedback surface for every damage source in the game.

**Independent Test**: Start the game, verify three full hearts render in the HUD. Apply one unit of damage, verify exactly one half-heart step is lost and the display updates on the same frame.

**Acceptance Scenarios**:

1. **Given** a fresh run, **When** the game renders, **Then** three full hearts are shown in the top-left HUD, positioned so they do not overlap the journal icon.
2. **Given** the character has taken one unit of damage, **When** the HUD renders, **Then** the hearts read two full and one half.
3. **Given** the character has taken three units of damage, **When** the HUD renders, **Then** the hearts read one full, one half, one empty.
4. **Given** the character is at full health, **When** a healing effect is applied, **Then** the display is unchanged — health never exceeds three hearts.

---

### User Story 2 - Falling Into a Pit (Priority: P1)

The visitor misjudges a jump and the character drops through a gap in the terrain, falling past the bottom of the level. Instead of falling forever or dying outright, the character loses half a heart and reappears standing on the last patch of solid ground it was fully supported on before the fall. Play continues immediately from there.

**Why this priority**: The level has open gaps. Without a defined recovery, a missed jump ends the session; with a punishing one, exploration stops being fun.

**Independent Test**: Walk the character off a ledge over a bottomless gap. Verify health drops by exactly half a heart, and that the character is repositioned onto the ground it last stood fully on rather than at the level's spawn point.

**Acceptance Scenarios**:

1. **Given** the character is falling and passes below the bottom of the level, **When** the fall is detected, **Then** health decreases by half a heart and the character is placed at the last position where its whole footprint rested on solid ground.
2. **Given** the character is repositioned after a pit fall, **When** the next frame renders, **Then** it is standing still on the ground with no residual falling motion and no falling animation.
3. **Given** the character falls into a pit while still inside the damage refractory window from an earlier hit, **When** the fall is detected, **Then** no health is lost, but the character is still returned to safe ground rather than left falling.
4. **Given** the character deliberately dropped through a one-way bridge and then fell into a pit, **When** it is returned to safe ground, **Then** it is no longer treated as mid-drop-through and can stand on bridges again.

---

### User Story 3 - Running Out of Health (Priority: P1)

The visitor loses the last half heart. The screen closes in around the character, the game shows that the run has ended, and any input restarts it. The character reappears at the level's spawn point with all three hearts full — and every CV fact collected so far is still in the journal. Nothing the visitor discovered is taken away as a punishment for dying.

**Why this priority**: The platformer exists to reveal CV content. A death that erased discovered content would make the game actively hostile to its own purpose.

**Independent Test**: Reduce health to zero. Verify the death sequence plays, verify a restart returns full health at the spawn point, and verify the journal still lists every fact collected before the death.

**Acceptance Scenarios**:

1. **Given** health reaches zero, **When** the damage lands, **Then** the character is no longer alive and the death transition begins, centered on the character.
2. **Given** the death transition has finished, **When** the visitor presses any key or clicks the game area, **Then** the run restarts at the spawn point with full health.
3. **Given** the visitor collected facts before dying, **When** the run restarts, **Then** every one of those facts is still recorded in the journal and its section counters are unchanged.
4. **Given** the run restarts, **When** the character spawns, **Then** it is immediately vulnerable — respawning does not hand out a free protected window.

---

### User Story 4 - One Damage Window for Everything (Priority: P2)

The character brushes against a hazard and is hurt. It flashes for a moment. During that flash, staying in contact with the same hazard — or touching a different one, or falling into a pit — costs nothing further. Once the flash ends, the character can be hurt again.

**Why this priority**: Without a shared refractory window, an overlap that persists across frames drains the whole health bar in a fraction of a second, and every new damage source would need to reinvent the same protection.

**Independent Test**: Hold the character in continuous contact with a damage source. Verify exactly one unit of health is lost per window, not one per frame.

**Acceptance Scenarios**:

1. **Given** the character has just taken damage, **When** any damage source applies within the refractory window, **Then** that damage is dropped entirely.
2. **Given** the character is inside the refractory window, **When** it renders, **Then** the sprite blinks on and off at a steady interval for the duration of the window.
3. **Given** two different damage sources apply on the same tick, **When** the tick resolves, **Then** at most one of them costs health.
4. **Given** the refractory window has elapsed, **When** the character touches a damage source again, **Then** damage applies normally and a fresh window opens.

---

### Edge Cases

- **Falling in a column with no ground at all**: a pit fall is decided by the character crossing below the level's bottom edge, so a column containing no solid tile anywhere still resolves as a pit fall rather than an endless drop.
- **Never having stood on ground**: the last-safe-ground position is seeded with the spawn position, so a pit fall before the character has ever landed returns it to spawn.
- **Standing on a ledge edge**: the position remembered for pit-fall recovery is the last frame the character's *entire* footprint was supported, not merely one corner — otherwise a recovery would place the character hovering over the gap it just fell into.
- **Pit fall during the invincibility window**: recovery always runs; only the health cost is skipped. Skipping the recovery too would leave the character falling forever.
- **Knockback and the window are separate clocks**: control returns to the visitor well before the blink ends. Being protected is not the same as being unable to move.
- **Health cannot go negative or overflow**: every damage and healing amount is clamped to the range between empty and three full hearts.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The game MUST track the character's health as three hearts, each divisible into two halves, giving six half-heart units of health in total. All damage and healing are expressed in whole half-heart units.

- **FR-002**: The game MUST render the current health as a row of three heart icons in the top-left HUD while playing. Each heart is shown full, half or empty according to how much of that heart's share of the remaining health is left, filling left to right. The row is positioned so it does not collide with the journal icon.

- **FR-003**: The game MUST treat the character passing below the bottom edge of the level as a pit fall, independent of the level's tile layout.

- **FR-004**: On a pit fall the game MUST cost the character half a heart and MUST return it to the last position at which its entire footprint rested on solid ground, with its motion cleared and its grounded state restored. It MUST NOT return it to the spawn point — that is the zero-health case only.

- **FR-005**: The pit-fall recovery MUST run whether or not the health cost was applied. A pit fall occurring inside the refractory window costs nothing but still recovers the character's position.

- **FR-006**: The game MUST open one refractory window whenever damage lands, from any source. While it is open, all further damage from every source MUST be ignored. This window is the sole rule for damage timing — no damage source defines its own.

- **FR-007**: The game MUST make the character's sprite blink on and off at a steady interval for the duration of the refractory window, so the protected state is visible.

- **FR-008**: The refractory window MUST be independent of any knockback motion a damage source also applies. Knockback ends well before the window does, so the visitor regains control while still protected.

- **FR-009**: The game MUST treat health reaching zero as death: the character stops being alive, the death transition begins centered on the character, and the game waits for input to restart.

- **FR-010**: A restart after death MUST place the character at the spawn point with all three hearts full, revive defeated enemies at their placements, and return the camera to the level start.

- **FR-011**: A restart after death MUST preserve every CV fact the visitor has collected and every journal counter derived from them. Only the journal's deliberate Reset Game action clears collected progress.

- **FR-012**: A respawned character MUST be immediately vulnerable. Spawning MUST NOT grant a refractory window.

- **FR-013**: Every damage and healing amount MUST be clamped so health never falls below empty or rises above three full hearts.

- **FR-014**: The game MUST clamp the refractory timer at the window's duration rather than letting it grow without bound over a long session — every reader only asks whether the window is still open.

### Key Entities

- **Health**: the character's remaining life, counted in half-heart units up to a maximum of three hearts. Shared by the HUD, every damage source, and the death check.
- **Heart**: one of the three HUD icons. Shows full, half or empty depending on how much of the remaining health falls in its share.
- **Damage amount**: the half-heart cost a source applies. A pit fall and a non-stomp enemy touch each cost half a heart; they are distinct sources that happen to cost the same.
- **Refractory window**: the single stretch of time following any damage during which the character cannot be hurt again and blinks. Owned here; consumed by every hazard in the game.
- **Last safe ground**: the most recent position at which the character's whole footprint rested on solid ground. The destination of a pit-fall recovery.
- **Spawn point**: the level's starting position. The destination of a post-death respawn, not of a pit-fall recovery.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Health is always readable**: at any moment of play, the HUD shows exactly the character's current health at half-heart resolution. Verified by stepping health through all seven values and comparing the rendered hearts.
- **SC-002 — A pit fall never ends a run outright**: falling into a pit at full health costs half a heart and leaves the character standing on ground it can play from. Verified by walking off a ledge over a bottomless gap.
- **SC-003 — Continuous contact costs one hit**: holding the character in unbroken contact with a damage source costs exactly one unit of health per refractory window, never one per frame. Verified by an automated test holding an overlap across many ticks.
- **SC-004 — Death costs nothing discovered**: dying with facts collected and restarting leaves the journal contents and counters identical. Verified by collecting facts, forcing death, restarting, and comparing the journal.
- **SC-005 — Respawn is not a shield**: a freshly spawned character can take damage on its first frame of contact. Verified by a unit test on the spawn state's refractory timer.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) is complete**: the platformer theme's game loop, physics, terrain collision, camera, HUD surface, journal and collected-fact store all exist. F-016 layers a health model onto them and does not recreate any of them.
- **Damage sources live in their own features**: this feature defines what damage costs and when it is allowed to land. Which entities inflict it is defined by the features that own them — enemy contact by F-017, spike hazards by O-005.
- **Healing belongs to O-004**: a heart pickup restoring half a heart, and being a no-op at full health, is a requirement of the container-blocks feature. It is referenced here only because it shares this feature's clamped health value; the pickup, the pot that drops it, and its collection rules are specified in O-004.
- **One life budget, no lives counter**: the game has no stock of lives and no score. Death costs the visitor the current position and nothing else.
- **No checkpoints**: the level has a single spawn point. "Last safe ground" is a pit-fall recovery position tracked continuously by the physics step, not a checkpoint the visitor activates.

## Out of Scope

- Healing pickups and the blocks that drop them (O-004)
- Enemy contact damage, knockback direction and stomp rules (F-017)
- Spike hazard damage (O-005)
- Difficulty settings or configurable maximum health
- A lives counter, score, or run timer
- Checkpoints or mid-level save states
- Damage-over-time effects, poison, drowning or fall-height-scaled damage
- Armor, shields or any damage-reduction mechanic
