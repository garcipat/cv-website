# Feature Specification: Platformer Hurt Feedback

**Feature Branch**: `S-010-platformer-hurt-feedback`
**Status**: Draft
**Input**: The platformer's damage feedback is a blink and a knockback — hard to notice at a glance, and enemies show nothing at all except on their final, defeating hit. The theme needs a visible impact at the moment any hit lands, and an ambient warning while health is critically low.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The Character Getting Hit (Priority: P1)

The visitor's character touches an enemy or a hazard and takes damage. At the exact point of contact, a small burst of red debris scatters outward on the side the hit came from, alongside the existing invulnerability blink. When there is no clear side — a pit fall, where the character reappears on safe ground rather than being touched by anything — the burst plays at the character's center instead.

**Why this priority**: This is the most common damage event in the game and currently the least visible one — a blink is easy to miss entirely.

**Independent Test**: Walk the character into an enemy from the right. Verify a red debris burst appears on the character's right side at the moment of contact, fades within well under a second, and the existing blink still plays alongside it.

**Acceptance Scenarios**:

1. **Given** the character takes damage from an enemy or hazard touching it from a particular side, **When** the hit lands, **Then** a red debris burst plays anchored to that side of the character.
2. **Given** the character takes damage with no directional contact (a pit fall), **When** the hit lands, **Then** the burst plays anchored to the character's center.
3. **Given** damage is dropped because the character is inside its refractory window, **When** that would-be hit is ignored, **Then** no burst plays — the burst is tied to damage actually landing, not to contact alone.
4. **Given** the burst is playing, **When** the same frame's blink and knockback also apply, **Then** all three play together without one suppressing another.

---

### User Story 2 - An Enemy Getting Hit (Priority: P1)

The visitor stomps a slime. At the top of the slime, where the character's foot landed, a burst of debris scatters outward — colored to match that slime's own body color, not a single fixed color for every enemy. This plays on every hit an enemy takes, including a hit that only staggers it (a purple slime survives its first two) and the hit that finally defeats it, where it plays alongside the existing defeat puff rather than replacing it.

**Why this priority**: A hit that doesn't defeat the enemy currently shows nothing but a brief freeze — the visitor can't tell a hit registered at all.

**Independent Test**: Stomp a purple slime once (of the three hits it takes to defeat). Verify a purple-colored debris burst plays at the top of the slime, the slime is not yet defeated, and no defeat puff plays. Stomp it a third time and verify the same burst plays alongside the existing defeat puff.

**Acceptance Scenarios**:

1. **Given** a green slime takes its one and only hit, **When** the hit lands, **Then** a green-colored debris burst plays at the top of the slime, together with its existing defeat puff.
2. **Given** a purple slime takes a hit that does not defeat it, **When** the hit lands, **Then** a purple-colored debris burst plays at the top of the slime and no defeat puff plays.
3. **Given** a purple slime takes its third, defeating hit, **When** the hit lands, **Then** the same purple-colored burst plays together with its existing defeat puff.
4. **Given** two different enemy types are hit in the same session, **When** each is hit, **Then** each burst is colored to match the enemy that was hit, not a shared color.

---

### User Story 3 - Running Low on Health (Priority: P2)

The visitor's character is down to its last half heart. Without needing to glance at the heart HUD, a soft red glow pulses around the edge of the play area for as long as this remains true — a constant ambient warning rather than a one-time cue. The moment health rises above that (a heart pickup) or the run ends, the glow stops.

**Why this priority**: The heart HUD sits in a corner and is easy to lose track of during active play; critical health deserves a warning that doesn't require looking away from the action.

**Independent Test**: Reduce health to its last half heart. Verify a pulsing red glow appears around the canvas edge. Collect a heart pickup and verify the glow stops immediately. Reduce health to critical again and let the character die; verify the glow does not persist into the death transition.

**Acceptance Scenarios**:

1. **Given** health drops to its last half heart, **When** the next frame renders, **Then** a soft red glow begins pulsing around the canvas border.
2. **Given** the glow is active, **When** health rises above the last half heart, **Then** the glow stops immediately.
3. **Given** the glow is active, **When** the game is paused, the journal is open, or the death or ending-screen transition begins, **Then** the glow is not drawn.
4. **Given** the character respawns at full health after death, **When** play resumes, **Then** the glow is inactive until health becomes critical again.

---

### Edge Cases

- **Multiple hits in the same tick**: only one hit can ever land per refractory window (an existing rule — see F-016), so at most one hit-splatter burst per entity begins per window; nothing new to arbitrate here.
- **An enemy revived by a respawn**: takes its hits and shows its bursts again from a fresh state, the same way its existing defeat puff already replays per life.
- **A hit that lands the same frame health becomes critical**: the hit's debris burst and the low-health glow beginning are independent effects and both play; neither is gated on the other.
- **Health falling straight from full to critical in one hit** (not expected given the game's damage amounts, but not excluded): the glow begins the same as any other transition into the critical state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The game MUST play a red debris burst at the moment any damage-dealing hit lands on the character, anchored to the side of the character the hit came from when one is known, or to the character's center when it is not (a pit fall).
- **FR-002**: The character's hit burst MUST play in addition to the existing invulnerability blink and any knockback — it MUST NOT replace, delay, or be suppressed by either.
- **FR-003**: The game MUST play a debris burst at the top of an enemy every time that enemy takes a hit, including a hit that does not defeat it.
- **FR-004**: An enemy's hit burst MUST be colored to match that enemy's own type (a green slime bursts green, a purple slime bursts purple), not a single color shared by every enemy.
- **FR-005**: When a hit also defeats the enemy, the hit burst MUST play together with the existing defeat puff, not in place of it.
- **FR-006**: Neither hit burst (character or enemy) MUST play when a hit is dropped by the refractory window rather than actually landing.
- **FR-007**: The game MUST render a soft red glow pulsing around the edge of the canvas for as long as health is at its last half-heart unit.
- **FR-008**: The low-health glow MUST stop the instant health rises above its last half-heart unit, and MUST NOT be drawn while the game is paused, the journal is open, or a death or ending-screen transition is in progress.

### Key Entities

- **Hit burst**: a brief, short-lived scatter of debris played at the moment a hit lands on the character or an enemy. Colored red for the character; colored to match the enemy type for an enemy. Anchored to the contact point (a side of the character, or the top of an enemy), purely additive to whatever other reaction (blink, knockback, defeat puff) that hit already triggers.
- **Low-health glow**: an ambient pulsing red glow around the canvas edge, active exactly while health is at its last half-heart unit and gameplay is live.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Every landed hit on the character is visible**: any damage that actually lands on the character produces a red hit burst on the side it came from (or centered, for a pit fall), alongside the unchanged blink. Verified by triggering a side hit and a pit fall and observing both.
- **SC-002 — Every enemy hit is visible, not just the defeating one**: stomping a purple slime on its first or second hit shows a colored burst with no defeat puff; its third hit shows the same burst together with the defeat puff. Verified by stepping a purple slime through all three hits.
- **SC-003 — Enemy bursts are colored per type**: a green slime's burst and a purple slime's burst are visibly different colors matching their own bodies. Verified by hitting one of each.
- **SC-004 — Critical health is visible without looking at the HUD**: the canvas border glows red exactly while health is at its last half-heart unit, and never otherwise. Verified by stepping health down to critical, healing back up, and forcing death.
- **SC-005 — Nothing existing regresses**: the existing blink, knockback, and defeat-puff behavior from F-016/F-017 are unchanged by this feature. Verified by the existing test suites for those features continuing to pass unmodified.

## Assumptions

- **[F-016](../F-016-platformer-health/spec.md) and [F-017](../F-017-platformer-enemies/spec.md) are complete**: this feature layers visual feedback onto their existing damage, refractory-window, knockback, hit-reaction and defeat-puff rules. It changes none of their timing or amounts.
- **[O-005](../O-005-platformer-hazards/spec.md) hazard hits are a damage source like any other**: a spike hit lands through the same refractory window F-016 already defines, so it gets the character's hit burst the same as an enemy touch does.
- **Two enemy types exist today**: green and purple slime, each with its own body color the burst is matched to. A future enemy type would need its own burst color as part of adding that enemy, which is out of scope here.
- **The character has no dedicated hit animation today**: F-016's refractory window is communicated by a blink, not a pose change. This feature does not add one — the hit burst layers on top of whatever pose the character is already in.

## Out of Scope

- Any change to damage amounts, refractory-window timing, knockback distance/direction, or defeat rules — those remain exactly as F-016/F-017/O-005 define them.
- Sound effects for hits (see O-008, Platformer Audio).
- The broader animation-timing and frame-rate review raised in the platformer polish-pass idea — this feature covers hit feedback and the low-health glow only, not a general pass over the theme's other effects.
- Giving the character a dedicated hit-reaction sprite pose.
