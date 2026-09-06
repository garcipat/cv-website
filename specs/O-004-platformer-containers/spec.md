# Feature Specification: Platformer Container Blocks & Pickups

**Feature Branch**: `O-004-platformer-containers`
**Status**: Implemented
**Input**: Container blocks that are broken by landing on them rather than by a hit from below, and the pickups they drop.

Container blocks are a variant of the destroyable-block contract from
[F-018](../F-018-platformer-blocks/spec.md): they occupy a tile as a solid obstacle and
break on a single hit, but the hit that breaks them comes from **above** — the character
lands on the container and crushes it — and what they leave behind is a real, walk-over
pickup rather than an instant reveal. Two container kinds exist: the **coin pot**, which
drops a coin, and the **potion pot**, which drops a heart.

The mechanism behind the trigger side and the drop — how a block kind declares what a hit
produces — is documented in
[docs/themes/platformer/Blocks.md](../../docs/themes/platformer/Blocks.md).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Smashing a Bunch of Pots for Coins (Priority: P1)

A visitor sees a cluster of clay pots sitting on a ledge — they are not three identical
jars in a row but a bunch of different shapes and sizes, packed together with no gaps, the
way a pile of pottery would actually look. The visitor jumps onto the leftmost pot. It
shatters, the character bounces off it, and a spinning coin is left behind where the pot
stood. The visitor walks over the coin and picks it up; the journal's coin counter goes up,
and the remaining pots visibly re-arrange themselves into a smaller bunch now that their
neighbour is gone.

**Why this priority**: The coin pot is the container kind that ships in the level and the
one every visitor meets. Without it the feature has no visible presence.

**Independent Test**: Place two or more adjacent coin pots. Verify they render as one
merged bunch of differing sizes. Land on one — verify it breaks, the character bounces,
and a collectible coin appears at its position. Walk over the coin — verify it is collected
like any hand-placed coin.

**Acceptance Scenarios**:

1. **Given** a coin pot sits on the ground, **When** the character lands on top of it,
   **Then** the pot breaks, the character is bounced upward, and a coin appears at the
   pot's position.
2. **Given** a coin pot sits on the ground, **When** the character hits it from below or
   walks into its side, **Then** nothing happens — the pot is an ordinary solid obstacle
   from every direction but above.
3. **Given** a coin has been dropped by a pot, **When** the character walks over it,
   **Then** it is collected exactly as a hand-placed coin is, and contributes to the same
   coin counter.
4. **Given** three coin pots stand side by side in one row, **When** they render, **Then**
   they form a single continuous bunch of varied pot sizes in which no two neighbouring
   pots share the same size.
5. **Given** three adjacent coin pots, **When** the middle one is destroyed, **Then** the
   two survivors immediately stop reading as one bunch and render as two isolated pots.

---

### User Story 2 - Healing from a Potion Pot (Priority: P2)

A visitor who has taken damage finds a potion bottle standing on a platform. They jump onto
it; it breaks and leaves a small floating heart bobbing in place. Walking over the heart
restores half a heart of health and the heart disappears. A visitor already at full health
walks over the same heart and nothing happens — the heart stays in the world, waiting for
a moment when it is actually useful.

**Why this priority**: Healing is the only way to recover health short of a respawn, but the
potion pot is a supporting mechanic rather than the feature's headline.

**Independent Test**: Place a potion pot, take damage, land on the pot, verify a heart is
dropped. Walk over it at reduced health — verify half a heart is restored. Repeat at full
health — verify the heart is not consumed.

**Acceptance Scenarios**:

1. **Given** a potion pot sits on the ground, **When** the character lands on top of it,
   **Then** it breaks, the character bounces, and a heart pickup appears at its position.
2. **Given** a heart pickup lies in the world and the character is below full health,
   **When** the character touches it, **Then** half a heart of health is restored and the
   heart is removed from the world.
3. **Given** a heart pickup lies in the world and the character is at full health, **When**
   the character touches it, **Then** nothing changes and the heart remains available.
4. **Given** a heart restores health that would exceed the maximum, **When** it is
   collected, **Then** health is clamped to the three-heart maximum from
   [F-016](../F-016-platformer-health/spec.md).

---

### User Story 3 - Container State After a Respawn (Priority: P2)

A visitor breaks a potion pot, ignores the heart it dropped, then dies to an enemy and
respawns. Back at the spawn point, the potion pot is standing intact again and the
uncollected heart is gone. Every crate, question-mark block, rock and coin pot they broke
before dying is still broken — only the potion pot came back.

**Why this priority**: Without this rule, healing could be farmed by dying, or a stale heart
would sit beside a pot that is about to offer the same heal again.

**Independent Test**: Break a potion pot and a crate, leave the heart uncollected, die,
respawn. Verify the potion pot is intact, the heart is gone, and the crate is still broken.

**Acceptance Scenarios**:

1. **Given** a potion pot has been broken, **When** the character dies and respawns,
   **Then** the pot is restored to its intact state.
2. **Given** a dropped heart has not been collected, **When** the character dies and
   respawns, **Then** the heart is removed from the world.
3. **Given** crates, question-mark blocks, rocks and coin pots have been broken, **When**
   the character dies and respawns, **Then** all of them remain broken and any coin already
   dropped by a coin pot remains in the world.

---

### User Story 4 - Coins Spread Across the Level (Priority: P1)

A level author places twenty coins and twelve coin pots in a level, while the CV has six
skill categories. Every one of the thirty-two coins is worth collecting: the visitor sees a
new skill fact revealed roughly every fifth coin rather than seeing all six facts in the
first six pickups and then collecting two dozen coins that do nothing.

**Why this priority**: This rule is what lets a level be designed for play rather than
being forced to hold exactly as many coins as the CV has skill categories.

**Independent Test**: Load a level with more coins than the CV has skill categories. Collect
every coin. Verify facts appear spread over the whole run and that all skill categories are
revealed by the time the last coin is taken.

**Acceptance Scenarios**:

1. **Given** a level with more coins than the CV has skill categories, **When** the visitor
   collects coins, **Then** skill facts are revealed at a steady proportional rate across
   the whole set rather than all at the start.
2. **Given** a level with more coins than skill categories, **When** every coin has been
   collected, **Then** every skill category has been revealed exactly once.
3. **Given** a level with fewer coins than skill categories, **When** every coin has been
   collected, **Then** every skill category has still been revealed — some pickups reveal
   more than one.
4. **Given** the journal's coin summary row is shown, **When** it renders, **Then** its
   numerator counts coins collected and its denominator counts coins the level holds — not
   facts revealed.

---

### Edge Cases

- **A pot that is part of a bunch is destroyed mid-animation**: the pot stops counting
  toward its bunch the instant it is hit, before its break animation finishes, so its
  former neighbours re-form immediately rather than a frame later.
- **An isolated pot**: a pot with no live neighbour in its row is simply a single pot; the
  merging rule has no visible effect.
- **A very long row of pots**: the size variation continues to alternate along the whole
  run — no two adjacent pots ever repeat a size, however long the run is.
- **A pot destroyed above a gap**: the dropped coin appears at the pot's own position, which
  is where the pot stood; it does not fall.
- **The same pot dropping twice**: a container breaks on its single hit and is removed, so
  it can drop at most one pickup per life.
- **A level with no coins at all**: no skill facts are revealed by coins; nothing divides by
  zero.
- **Full-health touch of a heart, repeated**: the heart can be walked over any number of
  times at full health without being consumed.

## Requirements _(mandatory)_

### Functional Requirements

#### Container Blocks

- **FR-001**: A container block MUST occupy its tile as a solid obstacle that the character
  can stand on and cannot walk through.
- **FR-002**: A container block MUST break only when the character lands on top of it. A hit
  from below or a side contact MUST have no effect.
- **FR-003**: Breaking a container block MUST bounce the character upward, so that landing
  on a stack of containers reads as a chain of hops.
- **FR-004**: A container block MUST break on a single hit and be removed from the level; it
  has no intermediate damage stages.
- **FR-005**: The shared destruction effect MUST play when a container breaks, matching
  every other destroyed block ([F-018](../F-018-platformer-blocks/spec.md)).

#### Coin Pot

- **FR-006**: A coin pot MUST always drop one coin when broken, regardless of how many skill
  facts remain unrevealed.
- **FR-007**: A dropped coin MUST behave in every respect like a hand-placed coin — it spins,
  bobs, is picked up by walking over it, and feeds the same counter and the same skill-fact
  pacing.
- **FR-008**: A dropped coin MUST appear at the destroyed pot's own position and MUST become
  reachable only at the moment its pot is destroyed.
- **FR-009**: The level's coin total MUST count every coin pot as one coin from the moment
  the level loads, so the coin denominator shown to the visitor never grows mid-play as pots
  are broken.
- **FR-010**: Coin pots standing next to each other in the same row MUST render as one
  merged bunch: the pots vary in size, extra filler pots fill the seams between tiles so no
  gap is visible, and no two neighbouring pots — filler or not — share a size.
- **FR-011**: A bunch's arrangement MUST be determined by its position, so the same level
  always renders the same bunch, and MUST be re-derived from the pots that are still live,
  so destroying any pot immediately re-forms the bunches around it.

#### Potion Pot

- **FR-012**: A potion pot MUST always drop one heart pickup when broken.
- **FR-013**: A heart pickup MUST sit in the world bobbing in place until collected, and MUST
  be collected by walking over it.
- **FR-014**: Collecting a heart MUST restore half a heart of health, clamped to the maximum
  from [F-016](../F-016-platformer-health/spec.md).
- **FR-015**: A heart MUST be a no-op at full health — it is not consumed, and it remains in
  the world for later.

#### Respawn

- **FR-016**: The potion pot MUST be the only block kind restored to intact on a respawn,
  because a heart it dropped is tied to the pot that is now standing again.
- **FR-017**: A respawn MUST remove every uncollected heart from the world.
- **FR-018**: Every other block kind — crate, question-mark, rock and coin pot — MUST remain
  in whatever state it was in, and coins already dropped by coin pots MUST remain
  collectible.
- **FR-019**: A full game reset MUST restore every container along with every other block,
  and MUST remove every coin a pot had dropped.

#### Coins and the Skill-Fact Pool

- **FR-020**: A coin MUST NOT be bound to a specific CV fact when it is placed. Coins are
  purely positional.
- **FR-021**: The skill categories of the CV MUST form one shared pool that is spread
  proportionally across every coin the level holds, so that the number of facts revealed
  grows in step with the fraction of coins collected.
- **FR-022**: When every coin has been collected, every entry in the skill-fact pool MUST
  have been revealed — whether the level holds more coins than categories or fewer.
- **FR-023**: A level's coin count MUST NOT be required to match the CV's skill-category
  count, and no coin may be permanently worthless because the pool ran out.
- **FR-024**: The journal's coin summary row MUST show coins collected against coins placed,
  rather than facts revealed against facts available, so numerator and denominator stay in
  the same unit.

### Key Entities

- **Coin pot** — a container block. Solid, one hit, broken by being landed on. Always drops
  a coin. Renders as part of a merged bunch when it has live neighbours.
- **Potion pot** — a container block. Solid, one hit, broken by being landed on. Always drops
  a heart. The one block kind restored on respawn.
- **Coin** — a walk-over collectible. Carries no fact of its own; the Nth coin collected
  advances the shared skill-fact pool proportionally. Identical whether hand-placed or
  dropped by a pot.
- **Heart pickup** — a walk-over collectible dropped by a potion pot. Restores half a heart;
  ignored at full health. Drawn smaller than the HUD heart so it reads as a collectible
  rather than a duplicate of the HUD icon.
- **Skill-fact pool** — the CV's skill categories as one ordered set, drawn from as coins are
  collected rather than bound to individual coins.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Land-on-top trigger**: Landing on a container breaks it and bounces the
  character; hitting it from below or the side never does. Verified by automated tests over
  both container kinds and every contact direction.
- **SC-002 — Guaranteed drop**: Every destroyed coin pot yields exactly one collectible coin
  and every destroyed potion pot yields exactly one heart, in every run.
- **SC-003 — Bunch rendering**: For any run of adjacent coin pots, no two consecutively
  rendered pots share a size, the seams between tiles are filled, and destroying a pot
  re-forms the run on the next frame.
- **SC-004 — Healing rules**: A heart restores exactly half a heart below full health, is
  clamped at the maximum, and is not consumed at full health. Verified by unit tests.
- **SC-005 — Respawn restoration**: After a respawn, every potion pot is intact, no
  uncollected heart remains, and no other block kind has changed state.
- **SC-006 — Proportional pacing**: For any combination of level coin count and skill-category
  count, collecting all coins reveals every category exactly once and never reveals more than
  the pool holds. Verified by unit tests across coin counts above, equal to, and below the
  category count.
- **SC-007 — Stable coin denominator**: The coin total shown to the visitor at level load
  already includes every coin pot, and does not change as pots are destroyed.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) (Platformer theme) is complete**: the game
  loop, physics, solid collision, level format, coins, the shared fact-reveal animation and
  the journal all exist. This feature adds container blocks and the pickups they drop; it
  does not create the collectible or journal machinery.
- **[F-018](../F-018-platformer-blocks/spec.md) (Destroyable blocks) is complete**: the
  destroyable-block contract — a block occupying a tile, breaking on a hit, playing the
  shared destruction effect, and declaring what a hit produces — already exists. Container
  blocks are a variant of that contract with a different trigger side and a dropped pickup
  instead of an immediate reveal.
- **[F-016](../F-016-platformer-health/spec.md) (Health) is complete**: the three-heart
  maximum and the half-heart granularity are defined there. This feature is the source of the
  healing rule that F-016 refers to.
- **The potion pot is implemented but not yet placed**: the shipped level contains no potion
  pot. Every potion-pot behavior is available to level authors and to the level editor, but a
  visitor playing the default level will not meet one until a level places it.
- **Containers are hand-placed**: like every other block, a container exists only where a
  level author placed a marker; nothing auto-generates them from CV data.
- **A pot bunch is a rendering concern only**: merging affects appearance alone. Each pot
  remains its own solid tile with its own hit and its own drop.

## Out of Scope

- Container kinds beyond the coin pot and the potion pot.
- Containers that survive more than one hit, or that show damage stages.
- Any container broken from below or from the side.
- Pickups that fall, roll or are thrown from a broken container — a drop appears where its
  container stood.
- Any healing source other than the heart pickup.
- Restoring a heart's own state across a respawn; hearts are cleared, not preserved.
- Placing potion pots in the shipped level.
- The health, damage and respawn rules themselves ([F-016](../F-016-platformer-health/spec.md)).
- Block type definitions, sprite sheet coordinates and the "adding a block" walkthrough —
  see [docs/themes/platformer/Blocks.md](../../docs/themes/platformer/Blocks.md).
