# Feature Specification: Platformer Enemies

**Feature Branch**: `F-017-platformer-enemies`  
**Status**: Implemented  
**Input**: The platformer level needs living obstacles — something that makes movement a decision rather than a walk, that rewards a well-timed jump with CV content, and that guards the key a locked chest needs.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Slimes Patrolling the Level (Priority: P1)

A visitor walks the character along a platform and sees a green slime bouncing back and forth across it. The slime never walks off the end of the platform and never squeezes into a wall — it reaches the edge, turns, and comes back. On a wide stretch of open ground, another slime turns around at an invisible boundary the level author placed, so it stays where it belongs instead of wandering the whole level.

**Why this priority**: A predictable patrol is what makes an enemy an obstacle the visitor can read and plan around, rather than a random hazard.

**Independent Test**: Place a slime on a platform bounded by a wall on one side and a drop on the other. Verify it reverses at both, and that its visible body — not its transparent sprite margin — is what touches the boundary.

**Acceptance Scenarios**:

1. **Given** a patrolling slime approaches a solid wall, **When** its leading edge would enter the wall, **Then** it stops exactly against the wall and reverses direction.
2. **Given** a patrolling slime approaches the end of a platform, **When** there is no solid ground ahead of it, **Then** it reverses rather than walking off.
3. **Given** a level author has placed an invisible patrol boundary on open ground, **When** a slime reaches it, **Then** the slime turns around, while the character walks straight through the same spot unaffected.
4. **Given** a slime is taller than one tile, **When** an obstacle sits at head height rather than foot height, **Then** it still turns around; and an invisible boundary placed on a row its body does not span does not affect it.
5. **Given** a slime is penned into a lane narrower than its own body needs, **When** it would have to reverse in both directions at once, **Then** it stands still instead of flipping direction every frame.
6. **Given** a live destroyable block sits in a slime's path, **When** the slime reaches it, **Then** the block counts as a wall and the slime turns around.

---

### User Story 2 - Defeating a Green Slime for a Fact (Priority: P1)

The visitor lines up a jump and lands on top of a green slime. The slime flinches, freezes for a moment and vanishes in a puff. A Courses entry from the CV floats up from where it stood, hovers, and flies into the journal. The character bounces off the top of the slime as it goes, carrying the visitor onward.

**Why this priority**: This is the platformer's whole reason for having enemies — a skill-based interaction that pays out CV content.

**Independent Test**: Jump onto a green slime. Verify the character bounces, the slime plays its reaction and dies, and exactly one Courses fact is revealed and recorded.

**Acceptance Scenarios**:

1. **Given** the character falls onto a green slime's top, **When** contact resolves, **Then** the slime takes a hit and the character bounces upward.
2. **Given** a green slime has taken its one hit, **When** its reaction finishes playing, **Then** it is defeated, a defeat puff plays where it stood, and its Courses fact flies to the journal.
3. **Given** the character bounces off a stomp and is still overlapping the slime it just hit, **When** the next frames resolve, **Then** no side hit is registered against that slime — it is harmless for the whole of its reaction.
4. **Given** the same stomp bounce, **When** the character rises, **Then** the bounce plays out at full height regardless of whether the jump key is held.
5. **Given** a slime that already paid out its fact is revived by a respawn and defeated again, **When** it dies, **Then** it plays its defeat puff but reveals nothing further.

---

### User Story 3 - Being Hurt by an Enemy (Priority: P1)

The visitor runs into a slime from the side instead of landing on it. The character loses half a heart, is shoved away from the slime, faces away from it, and blinks for a moment. During the blink, staying pressed against the same slime costs nothing more.

**Why this priority**: An enemy that can only be defeated and never punishes a mistake is scenery, not an obstacle.

**Independent Test**: Walk the character into a slime horizontally. Verify half a heart is lost, verify the knockback pushes away from the slime, and verify a sustained overlap does not drain further health.

**Acceptance Scenarios**:

1. **Given** the character touches a slime from the side or from below, **When** contact resolves, **Then** it loses half a heart and is knocked back away from the slime.
2. **Given** the character has just been hurt by a slime, **When** it remains in contact, **Then** no further health is lost until the shared refractory window from [F-016](../F-016-platformer-health/spec.md) has elapsed.
3. **Given** a slime is mid-reaction from a hit, **When** the character touches it from any direction, **Then** nothing happens — it can neither hurt nor be hurt during its reaction.
4. **Given** the knockback has ended, **When** the visitor presses a movement key, **Then** control responds normally even though the character is still blinking.

---

### User Story 4 - The Purple Slime and Its Key (Priority: P2)

Deeper in the level the visitor meets a purple slime: twice the size of a green one, noticeably slower, and carrying a visible key inside its body. One stomp is not enough. The first stomp makes it flinch and immediately grow spikes out of its top and sides — jumping straight back onto it now hurts the character and throws it up and away. The visitor waits for the spikes to retract, stomps again, waits again, and on the third stomp the slime bursts and drops the key on the ground.

**Why this priority**: The key is the only way to open a chest, and the spike cooldown is what turns a tough enemy into a timing puzzle rather than a mash of the jump key.

**Independent Test**: Stomp a purple slime three times with pauses between. Verify a second stomp attempted during the spike window hurts the character instead, and that the third successful stomp drops a collectable key.

**Acceptance Scenarios**:

1. **Given** a purple slime at full strength, **When** the character stomps it, **Then** it survives, flinches, and grows spikes.
2. **Given** a purple slime with spikes out, **When** the character lands on its top, **Then** the character takes damage and is thrown away and upward rather than bouncing.
3. **Given** a purple slime with spikes out, **When** the character touches its side, **Then** the character takes damage and is knocked away as with any side hit.
4. **Given** a purple slime's spikes have fully retracted, **When** the character stomps it again, **Then** the stomp lands normally and the cooldown restarts.
5. **Given** a purple slime takes its third hit, **When** its reaction finishes, **Then** it is defeated with a puff and drops a key pickup at its position — no CV fact is revealed.
6. **Given** a purple slime that already dropped its key is revived and defeated again, **When** it dies, **Then** it puffs but drops no second key.
7. **Given** a purple slime carrying an undropped key, **When** it is drawn, **Then** the key is visible inside its body; once the key has been given, it is no longer drawn there.

---

### Edge Cases

- **A finishing hit grows no spikes**: a purple slime killed by a stomp does not spike on the way out — a defeated body with spikes would be both wrong to look at and, for the frame before it is cleared, wrong to touch.
- **A fresh hit restarts the spike window**: hitting a spiked-then-retracted slime again opens a new full cooldown rather than resuming the old one.
- **Spikes and vulnerability end together**: the slime becomes stompable again at exactly the moment its spikes finish retracting — never while they are still visible, never after an idle beat with none showing.
- **Enemies never fall**: patrol is horizontal only. An enemy stays on the row it was placed on and is not subject to gravity.
- **Overlapping reaction and refractory windows**: the enemy's post-hit reaction and the character's post-damage window are separate clocks belonging to different entities; neither gates the other.
- **More markers than facts, or fewer**: green slime placements and CV Courses entries need not match one-to-one. Each placement receives a share of the Courses entries, so a single slime may reveal several and extra placements may reveal none.
- **Blocks as patrol boundaries**: destroyable blocks are a separate layer from static terrain, so a patrol must treat a live block as solid ground or a wall even though the terrain grid there reads as empty.

## Requirements _(mandatory)_

This section states what enemies do. How an enemy kind is declared, what a kind's behavior contract looks like, and what it takes to add a new one are code concerns documented in [Enemies.md](../../docs/themes/platformer/Enemies.md).

### Functional Requirements

- **FR-001**: The game MUST provide two enemy kinds: a green slime and a purple slime. Both are placed by the level author through the level's placement markers.

- **FR-002**: Every enemy MUST patrol horizontally at a constant speed, reversing direction when the tile its leading edge is about to enter is a wall, is a live destroyable block, is an invisible patrol boundary, or has no solid support beneath it.

- **FR-003**: Patrol boundaries and walls MUST be judged against the enemy's visible body rather than its full sprite frame, and against every tile row that body spans, so an enemy stops flush against an obstacle without a visible gap or overlap.

- **FR-004**: An invisible patrol boundary MUST affect enemies only. It is never solid to the character, who walks straight through it, and it bounds only the row it is placed on.

- **FR-005**: When reversing would immediately meet an obstacle in the other direction too, the enemy MUST stand still rather than flip direction every frame.

- **FR-006**: Enemies MUST NOT move vertically. There is no gravity, jumping or pursuit — patrol is the entire movement behavior.

- **FR-007**: Contact from above MUST count as a stomp: the enemy takes one hit and the character bounces upward. The bounce MUST play out at its full configured height whether or not the jump key is held.

- **FR-008**: Contact from the side or from below MUST cost the character half a heart and knock it back away from the enemy, facing away, opening the shared refractory window defined by [F-016](../F-016-platformer-health/spec.md). Damage is dropped entirely while that window is open.

- **FR-009**: A hit enemy MUST play a brief reaction during which it is frozen in place and entirely inert — it can neither be hit again nor hurt the character. This one window prevents a stomp bounce that still overlaps the enemy from registering as a spurious side hit against the enemy just stomped.

- **FR-010**: Defeat MUST be decided only after the reaction finishes, so the visitor sees the same reaction whether or not the hit was the finishing one. An enemy with hits remaining returns to patrolling.

- **FR-011**: A green slime MUST be defeated by a single stomp and MUST reveal a Courses fact, which flies to the journal through the same reveal behavior every other fact source uses.

- **FR-012**: A purple slime MUST be visibly larger than a green one, patrol more slowly, and require three stomps to defeat.

- **FR-013**: A purple slime MUST carry a key rather than a CV fact. Its finishing stomp MUST drop a collectable key pickup at its position; it reveals no fact at any point.

- **FR-014**: A purple slime carrying an undropped key MUST show that key inside its body, sized and positioned against its visible silhouette. Once the key has been given, it is no longer drawn.

- **FR-015**: A purple slime that survives a stomp MUST immediately grow spikes and stay spiked for a short cooldown. While spiked, any contact — including from above — MUST cost the character health: a failed stomp throws the character away and upward, a side touch knocks it away as usual.

- **FR-016**: The spike cooldown MUST run as a visible grow-hold-retract sequence, and the slime MUST become stompable again exactly when the spikes finish retracting. A fresh hit restarts the cooldown from the beginning.

- **FR-017**: A stomp that defeats a purple slime MUST NOT grow spikes.

- **FR-018**: The spike cooldown MUST advance independently of the hit reaction — a spiked slime keeps counting toward the cooldown's end while patrolling normally, and each spiked enemy runs its own cooldown rather than a shared one.

- **FR-019**: Every defeat MUST play a defeat puff at the enemy's position, once per life, independent of whether a reward is also handed out.

- **FR-020**: An enemy's reward — a fact or a key — MUST be handed out at most once for the whole session. A respawn revives defeated enemies at their placements as ordinary killable obstacles with nothing further to give; only the journal's Reset Game action restores their rewards.

- **FR-021**: Green slime placements MUST distribute the CV's Courses entries among themselves, so a level need not carry exactly as many green slime markers as the CV has courses.

### Key Entities

- **Green slime**: the baseline enemy. One hit to defeat, standard patrol speed, one tile-sized body, rewards a Courses fact.
- **Purple slime**: the tough variant. Larger body, slower patrol, three hits to defeat, carries a key, and grows spikes whenever it survives a hit.
- **Patrol range**: the stretch of ground an enemy walks, bounded by walls, ledges, live blocks and invisible patrol boundaries.
- **Patrol boundary marker**: an invisible, non-solid level element that turns enemies around on the row it occupies and does nothing to the character.
- **Stomp**: contact resolved against an enemy's top. Costs the enemy a hit and bounces the character.
- **Side hit**: contact resolved against an enemy's sides or underside. Costs the character half a heart and knocks it back.
- **Hit reaction**: the brief frozen, inert window an enemy enters after taking a hit, and after which its defeat is decided.
- **Spike cooldown**: the temporary spiked state a purple slime enters on surviving a hit, during which every contact hurts the character.
- **Key**: the item a defeated purple slime drops, needed to open a chest.
- **Defeat puff**: the visual effect played once per enemy per life at the moment of defeat, independent of any reward.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Patrols stay put**: over an extended run, no enemy walks off a platform, enters a wall, crosses a patrol boundary, or vibrates in place. Verified by an automated patrol test across wall, ledge, boundary and narrow-lane layouts.
- **SC-002 — A stomp always pays out once**: defeating a green slime reveals exactly one set of Courses content and adds it to the journal exactly once, no matter how many times the slime is later revived and re-defeated.
- **SC-003 — Side contact costs exactly half a heart**: a sustained side overlap costs one half heart per refractory window, never one per frame.
- **SC-004 — A stomp bounce is never a side hit**: bouncing off a stomped enemy while still overlapping it never registers damage against that enemy. Verified by an automated contact test.
- **SC-005 — The spike window is honest**: a purple slime is un-stompable for exactly as long as its spikes are visible — verified by checking stompability at the start, middle and end of the cooldown against the spikes' rendered state.
- **SC-006 — One key per purple slime**: a level yields exactly as many keys as it has purple slime placements, regardless of respawns.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) is complete**: the game loop, physics, terrain collision, level placement markers, camera, journal and the shared fact-reveal behavior all exist. F-017 places enemies into that world and does not recreate any of it.
- **[F-016](../F-016-platformer-health/spec.md) is complete**: the three-heart health model, the half-heart damage unit and the single refractory window exist. Enemy contact damage uses them exactly as they are defined there and introduces no damage rules of its own.
- **Keys are consumed elsewhere**: the purple slime drops a key; what a key unlocks, how it is carried and how it is spent belong to the chests feature (S-007). This feature is responsible only for producing it.
- **Facts come from the CV data**: green slime rewards are drawn from the CV's Courses section. A CV with no courses simply yields enemies with nothing to reveal.
- **Level authors place enemies**: enemy positions and patrol boundaries are part of the level layout, authored through the level editor or the level file, not generated at runtime.

## Out of Scope

- Enemy kinds beyond the green and purple slime
- Flying, jumping, swimming or gravity-affected enemies
- Chasing, fleeing or any behavior that reacts to the character's position
- Projectiles, ranged attacks or enemy-to-enemy interaction
- Boss encounters and multi-phase fights
- A character attack other than the stomp — no weapon, no charge, no crouch slide
- What a key unlocks and how chests consume it (S-007)
- Spike tiles as static level hazards (O-005) — the purple slime's spikes are an enemy state, not a hazard tile
- Difficulty scaling, enemy respawn timers, or spawners that produce enemies during play
