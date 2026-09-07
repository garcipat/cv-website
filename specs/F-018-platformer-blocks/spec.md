# Feature Specification: Platformer Destroyable Blocks

**Feature Branch**: `F-018-platformer-blocks`
**Status**: Implemented
**Input**: Destroyable blocks in the Platformer theme — crates, question-mark blocks and rocks — hit from below to shape traversal and to uncover Education, Activities, Languages, Certificates and Projects facts.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Break a Crate to Uncover Education, Activities and Languages (Priority: P1)

A visitor playing the Platformer theme finds a wooden crate sitting in a platform. Jumping so the character's head strikes it from below nudges the crate upward a few pixels and leaves a visible crack across its face — nothing is awarded yet. A second hit from below shatters the crate: it fades out of the world with a burst of particles, and the Education, Activity or Language fact it holds floats up from the break point, hovers long enough to read, then flies to the journal icon. The crate counter in the HUD ticks up whether or not that particular crate happened to hold a fact.

**Why this priority**: Crates carry three CV sections that appear nowhere else in the level. Without them those sections are unreachable in play.

**Independent Test**: Find a crate, hit it once from below and verify the crack overlay and the bump. Hit it again and verify the shatter, the particle burst, the fact flight and the journal entry in the right section.

**Acceptance Scenarios**:

1. **Given** an intact crate, **When** the character hits it from below, **Then** it nudges upward and settles back, a crack appears over its tile, and no fact and no reward are produced.
2. **Given** a cracked crate, **When** the character hits it from below again, **Then** it bumps, fades away, is removed from the world, and every Education/Activity/Language fact assigned to it floats up, hovers and flies to the journal icon.
3. **Given** a crate whose assigned slice of the Education/Activities/Languages pool is empty, **When** it is destroyed, **Then** it shatters and bursts exactly like any other crate, reveals nothing, and still advances the crates counter.
4. **Given** a crate that owns more than one fact, **When** it is destroyed, **Then** each of its facts is revealed as its own flight, stacked so two texts in the same moment stay readable.
5. **Given** any crate, **When** the character touches it from above or from either side, **Then** it stays a solid obstacle and takes no hit — no crack, no shatter, no reward.

---

### User Story 2 - Hit a Question-Mark Block to Pop Out a Bonus Pickup (Priority: P1)

A visitor sees a question-mark block styled to match the terrain around it. One hit from below bumps it and pops a fruit upward into the empty space directly above, where it settles as a touchable pickup. Walking into that fruit reveals the Certificate or Project fact it carries, which flies to the journal like any other collectible. The block itself stays in place forever, now drawn as plain ground rock, and never reacts again.

**Why this priority**: Question-mark blocks are the only route to Certificates and Projects and give the level its bonus-pickup beat.

**Independent Test**: Hit a question-mark block from below. Verify a fruit rises into the tile above and rests there, that the block becomes a plain ground tile, that a second hit does nothing, and that touching the fruit adds the fact to the journal.

**Acceptance Scenarios**:

1. **Given** an unhit question-mark block, **When** the character hits it from below, **Then** it bumps, a bonus fruit rises from it into the tile directly above and settles as a touchable pickup, and the block permanently becomes a plain, top-exposed ground-rock tile.
2. **Given** a settled bonus fruit, **When** the character walks into it, **Then** its Certificate or Project fact floats up, flies to the journal icon and is removed from the world.
3. **Given** a spent question-mark block, **When** the character hits it from below again, **Then** nothing happens — it remains solid, produces no second fruit and plays no bump.
4. **Given** a question-mark block placed beyond the available Certificate and Project entries, **When** it is hit, **Then** it still pops a fruit, and collecting that fruit removes it silently without revealing anything.
5. **Given** a spent question-mark block, **When** the character walks on or beside it, **Then** it is solid from every direction, indistinguishable in behavior from the terrain it now resembles.

---

### User Story 3 - Break Rocks to Shape the Route (Priority: P2)

A visitor meets a fragile-looking rock blocking a passage. One hit from below breaks it into empty space with a burst of particles and nothing else — no fruit, no fact, no counter. The passage it was blocking is now open.

**Why this priority**: Rocks carry no CV content; they exist so a level author can gate or open a route. The game is complete without them, but level design is poorer.

**Independent Test**: Hit a rock from below once. Verify it disappears immediately with a particle burst, that no fact text appears, that no HUD counter changes, and that the space it occupied is now passable.

**Acceptance Scenarios**:

1. **Given** a rock, **When** the character hits it from below, **Then** it bumps, is removed from the world in a burst of particles, and awards nothing.
2. **Given** a rock, **When** the character stands on it or walks into its side, **Then** it is a solid obstacle and takes no hit.
3. **Given** a rock has been broken, **When** the character moves through the tile it occupied, **Then** the tile is empty and passable.

---

### Edge Cases

- **Hit from the wrong side**: All three kinds react only to a hit from below. Every other contact side leaves them solid and unchanged.
- **Head still under the block**: A block that is already used up takes no further hits, even while the character's head remains pressed against it across several frames.
- **Several blocks in one moment**: When more than one block registers a hit in the same instant, each resolves its own outcome, and the character receives a single downward bounce — the strongest one any of them asks for.
- **Mid-animation blocks**: A crate that has taken its final hit stays visible while it fades, but takes no further hits during that time.
- **Death and respawn**: Broken and spent blocks stay broken and spent across a death and respawn; only Reset Game restores every block to its intact state.
- **Fruit still in flight**: A bonus fruit that has not finished rising is not yet touchable; it becomes collectible once it settles.
- **Already-known fact**: A fact already in the journal is not revealed a second time — no duplicate entry, no second flight, no counter change.
- **Art narrower than its tile**: A block whose sprite does not fill its tile edge to edge is solid only across the width its art actually covers, so the character never stops at an invisible wall.

## Requirements _(mandatory)_

The code-level contract behind these behaviors — the block type's fields, the hit-outcome vocabulary, sprites and crack stages, and how to add a new block kind — is documented in [docs/themes/platformer/Blocks.md](../../docs/themes/platformer/Blocks.md). This specification states behavior only and does not restate that contract.

### Functional Requirements

- **FR-001**: The game MUST provide three destroyable block kinds — crate, question-mark and rock — each placed into a level by hand-authored markers rather than baked into terrain, and each visually distinct from ordinary terrain and from one another.

- **FR-002**: A block MUST be a solid obstacle from every direction, at every point in its life, regardless of how many hits it has taken. Being "hit" is a reaction, not a collision rule: a block that no longer reacts is still solid until it is removed from the world.

- **FR-003**: A hit MUST register only when the character strikes the block from below. Contact from above or from either side MUST leave the block unchanged.

- **FR-004**: A block that has already taken every hit its kind responds to MUST NOT register further hits.

- **FR-005**: Every registering hit MUST play a short bump — the block rises a few pixels and settles back over roughly a tenth of a second — including the hit that cracks, shatters, converts or destroys it, so each hit reads as tactile feedback regardless of what else it causes.

- **FR-006**: A crate MUST take two hits. The first MUST show a visible crack over the crate and award nothing. The second MUST shatter it: the crate fades out over a short window and is then removed from the world.

- **FR-007**: A crate MUST carry a fixed share of the level's Education, Activities and Languages facts, decided when the level loads by the crate's position among all crate markers and spread proportionally across however many crates the level has. That share MUST NOT depend on the order the visitor breaks crates in. A share MAY be empty, and MAY hold more than one fact when the level has fewer crates than facts.

- **FR-008**: Destroying a crate MUST reveal every fact in its share, each as its own reveal, and MUST advance the crates counter for every destroyed crate — including one whose share is empty — so the counter tracks crates broken rather than facts found.

- **FR-009**: A question-mark block MUST take one hit, which MUST pop a bonus pickup upward into the tile directly above the block, where it rises briefly and then rests as a touchable pickup.

- **FR-010**: A bonus pickup MUST carry the Certificate or Project fact assigned to its block, and MUST reveal that fact when the character walks into it, exactly as any other walk-over collectible does. A question-mark block placed beyond the available Certificate and Project entries MUST still pop a pickup, which is then collected silently with nothing revealed.

- **FR-011**: A hit question-mark block MUST remain permanently in the world as a solid block drawn as plain, top-exposed ground rock, so that a spent block reads as ordinary ground rather than as a block still worth hitting.

- **FR-012**: A rock MUST take one hit, which MUST remove it from the world immediately and award nothing — no pickup, no fact, no counter change. Rocks MUST carry no CV mapping and exist solely as a level-design tool for shaping traversal.

- **FR-013**: A block that leaves the world when used up MUST play a destruction burst of particles at its position on its final hit. That burst MUST fire on every such destruction, independent of whether a fact was revealed, a pickup was spawned, or nothing at all was awarded.

- **FR-014**: Every fact reveal in the game — from a block, a bonus pickup, a coin, a defeated enemy or an opened chest — MUST run through one shared reveal behavior, so that adding a fact to the journal, floating its text up from the reveal point, holding it briefly where it can be read, flying it to the journal icon and bumping the matching HUD counter always happen the same way and the counters stay consistent across every source.

- **FR-015**: The shared reveal behavior MUST ignore a fact that is already collected: no duplicate journal entry, no second flight and no counter change. Where two reveals happen at the same moment, their texts MUST be offset so both stay readable.

- **FR-016**: A block MUST declare which HUD counter, if any, its destruction feeds, so no counter is assumed from the fact that a block broke.

- **FR-017**: Broken and spent block state MUST persist across a death and respawn. Only a deliberate Reset Game MUST restore every block in the level to its intact state.

- **FR-018**: A block whose art does not fill its tile edge to edge MUST be solid only across the width its art covers, so the character is never stopped by an invisible wall beside a visible block.

### Open Requirements

Two requirements of this feature are not met by the current implementation. They are the remaining half of the same idea FR-014 and FR-016 realize for blocks — that a world entity owns what happens when the player interacts with it, rather than the page component deciding on the entity's behalf.

**Pickups and chests do not yet own their outcomes.** A pickup being collected and a chest being opened still have their consequences decided outside the entity, so those two families describe only their appearance and geometry and explicitly disclaim any say in what interacting with them means. Both should express their consequences in the same declarative outcome vocabulary blocks now use, so that adding a pickup or a chest kind is a matter of describing what it does rather than of editing shared interaction handling. This work builds on the block outcome vocabulary and cannot precede it.

**Terrain kinds do not yet own their own rules.** Unlike blocks and enemies, terrain has no registry of kinds, and no tile kind owns anything about itself: solidity, climbability, the one-way rules for a bridge and for a ladder shaft's standable top rung, and the tile's drawing are all spread across shared predicates and scattered comparisons in physics and rendering. Each tile kind should own those rules itself, so that introducing a tile — a hazard tile being the obvious case — is one new kind rather than a round of edits to every predicate that must learn about it. This is independent of the pickup and chest work and of anything else in this feature.

### Key Entities

- **Block**: A one-tile solid obstacle placed by a level marker, of one of three kinds. Tracks how many hits it has taken and which of its animations — idle, bump or shatter — is running. Some kinds leave the world once used up; a question-mark stays forever as a spent, solid tile.

- **Block hit outcome**: What one registering hit means for the kind that took it — any bounce it gives the character, a pickup it spawns, a fact it reveals and the counter it feeds. A block whose destruction has no consequence beyond the burst and its own removal declares no outcome at all.

- **Bonus pickup**: The fruit a question-mark block pops out. It rises from the block into the tile above, rests there, and carries the Certificate or Project fact of the block that produced it — or no fact, when its block was placed beyond the available CV entries.

- **Block fact share**: The slice of the level's Education, Activities and Languages pool that one crate owns, fixed at load time by that crate's position among all crate markers. Possibly empty, possibly several facts.

- **Fact reveal**: The single act of turning "this entity revealed a fact" into a journal entry, a flight of the fact's text to the journal icon and a counter bump. Shared by every reveal site in the game.

## Success Criteria _(mandatory)_

- **SC-001 — All three kinds behave as specified**: A visitor can break a crate in two hits, pop a bonus pickup from a question-mark in one, and break a rock in one, each from below only. Verified by unit tests over the block kinds and by a browser check.

- **SC-002 — Blocks are never invisible walls or phantom obstacles**: A block is solid across exactly the width its art occupies, from every direction, until the moment it is removed from the world. Verified by browser check.

- **SC-003 — Every crate destruction is counted**: After breaking every crate in the level, the crates counter reads the level's full crate total, whether or not each crate held a fact. Verified by unit test.

- **SC-004 — Every mapped fact is reachable**: Breaking every crate and collecting every bonus pickup in the level adds every Education, Activity, Language, Certificate and Project fact the level covers to the journal, each in its correct section. Verified by unit test over the block mapping plus a component test of the journal.

- **SC-005 — Reveals are consistent across sources**: A fact revealed by a block, a bonus pickup, a coin, an enemy or a chest produces the same journal entry, the same flight and the same counter behavior, and no fact is ever counted twice. Verified by unit tests over the shared reveal behavior.

- **SC-006 — Destruction always reads**: Every block that leaves the world does so with a visible burst, including one that awards nothing. Verified by browser check.

- **SC-007 — Progress survives a respawn**: Broken and spent blocks stay broken after a death and respawn, and all return intact after Reset Game. Verified by unit test.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) is complete**: the Platformer theme's game loop, physics and solid collision, level marker format, HUD, journal, fact-collection state and reveal animation all exist. F-018 places blocks into that world and hooks its outcomes into those systems; it does not create them.
- **Hit detection comes from the shared collision pass**: a block hit is a side-tagged contact reported by the same collision resolution that handles terrain, not a separate detection path.
- **Levels are hand-authored**: how many crates, question-mark blocks and rocks a level holds is decided by its markers, not by the size of the CV. A level may cover only part of the CV's Education, Activities, Languages, Certificates and Projects without violating any requirement here.
- **Crates and question-mark blocks are the only source of their sections**: Education, Activities and Languages appear nowhere else in the game; Certificates and Projects reach the journal only through a bonus pickup.
- **Art comes from the existing shared tileset**: no block kind introduces a new sprite sheet beyond the crack overlay used for a cracked crate.

## Out of Scope

- **Container blocks** — the coin pot and the potion pot, which are triggered by landing on top rather than by a hit from below and always drop a pickup, are [O-004](../O-004-platformer-containers/spec.md), not this feature. They share the same block contract but are specified there.
- **Hazard tiles** — spikes and other damaging terrain are [O-005](../O-005-platformer-hazards/spec.md).
- **Enemies** and their drops, including the key, are [F-017](../F-017-platformer-enemies/spec.md).
- **Chests, keys and level completion** are [S-007](../S-007-platformer-chests/spec.md).
- **Coins and the skill-fact pool** they draw from belong to [F-015](../F-015-platformer-theme/spec.md) and [O-004](../O-004-platformer-containers/spec.md).
- **Placing blocks in a level** through the editor is [F-019](../F-019-platformer-level-editor/spec.md).
- **Blocks that move, respawn on a timer, or can be pushed** — every block here is static until it is destroyed.
- **Destroying a block by any means other than a hit from below** — no attack, no projectile, no dash.
