# Feature Specification: Enemy Movement & Animation Seam + Bee

**Feature Branch**: `O-024-enemy-movement-seam`
**Created**: 2026-09-22
**Status**: Draft
**Input**: [Issue #76](https://github.com/garcipat/cv-website/issues/76) — make *how an enemy moves*
and *how it animates* a per-kind choice instead of one shared routine, and ship the first flying
enemy — a bee — as the seam's end-to-end validation. Full design: [design.md](./design.md).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The Bee Flies (Priority: P1)

A visitor walks a corridor and meets something that hovers: a bee drifting back and forth across a
gap in the floor, at chest height, rising and dipping in a steady rhythm. Because it flies, it
guards a stretch of open air where the slimes below could never stand — the visitor has to time a
jump through it rather than wait for a patrol to pass. Landing on its back squashes it and carries
the character onward; running into it from the side costs half a heart and shoves the character
away, exactly like every other enemy.

**Why this priority**: This is the visible value of the feature — a new kind of obstacle that the
existing ground-only enemies cannot provide — and it is the end-to-end proof that a kind can move
differently.

**Independent Test**: Place a bee over a gap on a platform with a wall on one side. Verify it
crosses the gap without turning (where a slime would reverse), that its height rises and falls in a
repeating cycle, that a stomp bounces and defeats it, and that a side touch costs half a heart.

**Acceptance Scenarios**:

1. **Given** a bee placed in the air, **When** the level runs, **Then** it moves horizontally at a
   constant speed and reverses at a wall, a live destroyable block, or an invisible patrol boundary.
2. **Given** a bee flying over a gap in the ground below it, **When** it reaches the gap, **Then**
   it flies straight across without turning around — unlike a patrolling slime.
3. **Given** a bee flying, **When** time advances, **Then** its height rises and falls in a repeating
   cycle around the row it was placed on, returning to that row each cycle instead of drifting.
4. **Given** the character lands on the bee's top while falling, **When** contact resolves, **Then**
   the bee takes its one hit and the character bounces upward exactly as off a green slime.
5. **Given** the character touches the bee from the side or from below, **When** contact resolves,
   **Then** the character loses half a heart and is knocked back away, exactly as a green slime's
   side hit.
6. **Given** the bee has taken its hit, **When** its reaction plays out, **Then** it is frozen and
   entirely inert, and when the reaction ends it is defeated with the shared defeat puff, revealing
   nothing.
7. **Given** a level containing bees, **When** the level is completed, **Then** the bees have
   contributed nothing to the enemies counter, the journal, or any completion condition.

---

### User Story 2 - Movement Is a Per-Kind Choice (Priority: P1)

The next person adding an enemy — a bat, a mushroom, anything — picks a movement behavior for their
kind, or writes a new one, and the game runs it. Nothing in the shared engine decides "enemies
walk" any more: the slimes keep their patrol because their kind says so, the bee flies because its
kind says so, and a kind that reacts to the character's position is possible without redesigning
anything.

**Why this priority**: The seam is the reason this feature exists. The bee alone would be one enemy;
the seam is what lets every enemy after it differ without touching shared code. It is P1 alongside
the bee because neither delivers its value without the other — the bee is the seam's proof.

**Independent Test**: Add a test-only enemy kind with a movement behavior distinct from patrol and
from flying, exercise it through the real game step, and confirm it moves by its own rule while the
slimes are unaffected. Confirm the movement/animation change needed is a new module plus a registry
entry — the marker/parser/editor edits are separate authoring cost, not seam cost.

**Acceptance Scenarios**:

1. **Given** any enemy kind, **When** the level runs, **Then** the game applies that kind's own
   movement behavior and no other.
2. **Given** the green and purple slimes, **When** any level containing them runs, **Then** their
   movement is identical to before this feature — same speed, same turn points, same stand-still
   behavior, same ledge and patrol-boundary handling.
3. **Given** the bee, **When** it moves, **Then** it uses a flying behavior: horizontal patrol with
   no ledge check, plus a vertical bob around its placement row.
4. **Given** a movement behavior that reacts to the character's position, **When** it is exercised by
   a test fixture, **Then** it idles while the character is out of range and moves toward the
   character once in range — proving the seam supports a reactive enemy without shipping one.
5. **Given** a new enemy kind with its own movement, **When** it is added, **Then** it needs no edit
   to the shared game loop, contact resolution, or rendering to get that movement (level placement
   and editor wiring are separate authoring cost).

---

### User Story 3 - Animation Is a Per-Kind Choice (Priority: P2)

Each enemy looks like itself. The bee flutters on its own frames, the slimes keep their walk, and
after a hit each kind returns to its own resting look instead of a shared one — and a kind that has
no dedicated reaction frames simply falls back to its resting loop rather than breaking.

**Why this priority**: The bee cannot read as a bee without its own flight loop, so this is required
for User Story 1's quality — but it is a narrower slice than movement, and the fallback behavior is
what makes the seam forgiving for the kinds that follow.

**Independent Test**: Give a kind a distinct animation table, run it, and confirm the frames drawn
come from that table; hit it and confirm it returns to its own resting state; request a state the
table does not define and confirm it renders the resting state instead of failing or going blank.

**Acceptance Scenarios**:

1. **Given** an enemy kind, **When** it is drawn, **Then** the frames it shows come from that kind's
   own animation table.
2. **Given** a hit enemy that survives its reaction, **When** the reaction ends, **Then** it returns
   to its own kind's resting state — the bee resumes flying, the slimes resume walking.
3. **Given** a kind whose table does not define the state currently requested, **When** it is drawn,
   **Then** it falls back to the kind's resting state, with no failure, no throw and no blank frame.
4. **Given** the green and purple slimes, **When** they animate, **Then** their walk and reaction
   frames are unchanged from before this feature.

---

### User Story 4 - Bees Are Authorable (Priority: P3)

A level author opens the editor, finds the bee in the entity palette with a readable name and a
preview of its art, paints it into the air over a gap, saves, and meets the same bee when the level
is played.

**Why this priority**: The bee is unusable in level design without a palette entry, but this is the
authoring surface for the behavior above rather than new player-facing behavior of its own.

**Independent Test**: Open the editor, select the bee, paint it, save, reload, and verify the
placement persists and the bee behaves identically when played.

**Acceptance Scenarios**:

1. **Given** the editor's entity palette, **When** the author looks for the bee, **Then** it is
   present with a name, a description and a preview of its art.
2. **Given** a bee placed from the palette, **When** the level is saved and reloaded, **Then** the
   placement round-trips unchanged and the bee behaves identically when played.
3. **Given** a level layout, **When** a bee marker is written into it, **Then** its character
   collides with no existing terrain, sign, hazard or entity character.

---

### Edge Cases

- ✅ **A bee over a gap**: no ledge check, so the bee crosses. A patrolling slime in the same spot
  still turns around — the difference between the two kinds is the point.
- ✅ **A bee in a lane narrower than its body**: like a slime, it stands still rather than flipping
  direction every frame.
- ✅ **A patrol boundary on a row the bee does not span**: bounds nothing, exactly as for the slimes —
  a patrol boundary only affects the row it is painted on.
- ✅ **A bee hit mid-bob**: it freezes where it is for the reaction and resumes flying afterwards; the
  bob's rhythm continues from elapsed time rather than restarting.
- ✅ **A bee and a slime touched in the same tick**: damage aggregates to one half heart for the tick,
  and the strongest bounce wins, per the existing enemy contact rules.
- ✅ **A bee defeated and then revived by a respawn**: it returns at its placement, flies again, and
  puffs again on defeat, with nothing further to give.
- ✅ **A kind missing the requested animation state**: it renders its resting state — a kind is never
  required to author a dedicated reaction row.
- ✅ **A reactive movement behavior with no character present** (headless tests, editor preview):
  it stays idle rather than failing.
- ✅ **A movement behavior that no shipped kind uses**: no level's behavior changes because it exists.
- ✅ **A bee marker character already owned by another map**: the level parser rejects it at load
  rather than silently misplacing a tile.
- ✅ **Art that does not touch the bottom of its frame**: the kind's collision box and render anchor
  use its bottom inset, so the box matches the visible body and the sprite rests on its placement
  row rather than floating; a zero inset leaves the slimes' box and anchor untouched.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The game MUST add a bee as a new enemy kind, placed by the level author through a
  level placement marker.
- **FR-002**: Each enemy kind MUST declare its own movement behavior, and the shared game loop MUST
  apply the contacted kind's behavior rather than one movement routine for every kind.
- **FR-003**: The green and purple slimes MUST keep their current movement behavior exactly — the
  same speed, turn points, ledge and patrol-boundary handling, and stand-still rule.
- **FR-004**: The bee MUST patrol horizontally at a constant speed, reversing at a wall, a live
  destroyable block, or an invisible patrol boundary.
- **FR-005**: The bee MUST NOT turn around at a gap in the ground below it; it flies over ledges
  that stop a patrolling slime.
- **FR-006**: The bee MUST oscillate vertically around the row it was placed on in a repeating
  cycle, returning to that row each cycle rather than drifting.
- **FR-007**: Every enemy kind MUST declare its own animation states and frames, and the frames an
  enemy shows MUST come from its own kind's table rather than a table shared by all kinds.
- **FR-008**: A hit enemy that survives its reaction MUST return to its own kind's resting animation
  state rather than a shared one.
- **FR-009**: When a kind's table does not define the animation state currently requested, drawing
  MUST fall back to the kind's resting state; it MUST NOT fail, throw, or render blank.
- **FR-010**: The bee MUST be defeatable by a single stomp from above, and the character MUST bounce
  exactly as it does off a green slime.
- **FR-011**: Side or underside contact with the bee MUST cost the character half a heart and knock
  it back away, opening the shared refractory window from [F-016](../F-016-platformer-health/spec.md),
  identical to a green slime's side hit.
- **FR-012**: A hit bee MUST be frozen in place and entirely inert for its reaction — it can neither
  be hit again nor hurt the character — and MUST be defeated with the shared defeat puff when the
  reaction ends.
- **FR-013**: The bee MUST reveal no CV fact, drop no item, and MUST NOT count toward the enemies
  counter, the journal, or any completion condition.
- **FR-014**: The bee MUST be placeable only through its level marker, whose character collides with
  no existing terrain, sign, hazard or entity character.
- **FR-015**: The bee MUST appear in the level editor's entity palette with a name, a description
  and a preview of its art, and MUST round-trip through level save and load unchanged.
- **FR-016**: The game MUST provide a movement behavior that idles while the character is out of
  range and moves toward the character once in range — exercised by tests, and used by no shipped
  enemy kind. It moves unobstructed (no terrain collision — it is a test-only behavior) and switches
  between its own declared idle and active animation states.
- **FR-017**: Every registered enemy kind MUST declare a movement behavior and a resting animation
  state that exists in its own animation table.
- **FR-018**: Adding a new enemy kind with its own movement and animation MUST NOT require changing
  the shared game loop, contact resolution, or rendering dispatch.
- **FR-019**: An enemy kind's collision box and render anchor MUST use a declared per-kind frame
  inset measured from the visible (opaque) extent of its own frames, including a bottom inset, so a
  kind whose art does not touch the bottom of its frame — like the bee — has a collision box matching
  its visible silhouette and is drawn resting on its placement row. For kinds whose art touches the
  frame bottom (the slimes) the bottom inset is zero and their box and anchor are unchanged.

### Key Entities

- **Enemy kind**: a registered enemy type. Beyond what it already declares (hit points, hitbox,
  drawing, contact meaning), it declares its movement behavior, its resting animation state and its
  own animation frames.
- **Movement behavior**: the per-kind rule that computes an enemy's next position each tick. It
  reads the level's obstacles, the time elapsed in the level and, for reactive behaviors, the
  character's position.
- **Movement context**: the inputs a movement behavior receives each tick — the level, the
  currently-live blocked cells, the character's position (or nothing when absent) and the elapsed
  time.
- **Patrol movement**: the existing ground behavior — horizontal, reversing at walls, live blocks,
  patrol boundaries and ledges.
- **Fly movement**: the bee's behavior — horizontal patrol with no ledge check, plus a vertical bob
  around its placement row.
- **Chase movement**: a proximity-triggered pursuit behavior that ships tested but used by no kind.
- **Bee**: a flying enemy. One hit to defeat, no reward, does not count toward completion.
- **Resting animation state**: the state an enemy shows by default and returns to after a reaction
  (the slimes' walk, the bee's flight loop).
- **Frame inset**: the transparent margins around a kind's opaque art within its frame — side, top
  and bottom. The kind's collision box and render anchor derive from it, so a kind whose art floats
  inside its frame (the bee) is boxed and anchored by its visible body, while a kind whose art
  touches the frame bottom (the slimes) has a zero bottom inset and is unchanged.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Slimes are unchanged**: a long automated run of slime position, direction and animation
  produces identical results before and after the seam, and the existing patrol tests pass without
  edits.
- **SC-002 — The bee clears gaps**: in a level with a floor gap a slime turns around at, the bee
  crosses without reversing. Verified by an automated movement test.
- **SC-003 — The bob is bounded and periodic**: over one full cycle the bee returns exactly to its
  placement row, and its maximum vertical deviation equals its configured amplitude. Verified by an
  automated movement test.
- **SC-004 — Bee contact matches the enemy contract**: the bee's stomp bounce, side damage and
  knockback are identical to a green slime's, and sustained overlap costs one half heart per
  refractory window, never one per frame. Verified by bee-specific contact tests that mirror the
  shared enemy contact contract (`Bee.test.ts` / `PlatformerPage.test.tsx`).
- **SC-005 — The seam is genuinely per-kind**: a test fixture enemy kind with its own movement and
  animation is exercised end-to-end by adding only that kind's own files and its registration, with
  no change to the shared game loop, contact resolution, or rendering dispatch.
- **SC-006 — The contract holds for every kind**: an automated contract test over the registry
  confirms every registered kind declares a movement behavior and a resting state present in its own
  table.
- **SC-007 — The bee is authorable**: it appears in the palette with a correct preview, can be
  painted, and survives a save and reload. Verified by an editor test plus a browser check.
- **SC-008 — The bee is not progression**: a level containing bees reports the same enemies total,
  enemies defeated and completion state as the same level with the bees removed.
- **SC-009 — Boxes track the visible art**: for a kind whose art does not touch the bottom of its
  frame (the bee), the collision box's bottom edge matches the visible art's bottom edge and the
  sprite is anchored by that edge; for the slimes (zero bottom inset) the box and anchor are
  identical to before. Verified by an automated box/anchor test.

## Assumptions

- **[design.md](./design.md) is the authoritative design** for this feature. This spec restates its
  behavior in player- and author-facing terms; the code-level plan (files, interfaces, strategy
  modules) lives there and in [Enemies.md](../../docs/themes/platformer/Enemies.md).
- **[F-015](../F-015-platformer-theme/spec.md), [F-016](../F-016-platformer-health/spec.md),
  [F-017](../F-017-platformer-enemies/spec.md) and [F-019](../F-019-platformer-level-editor/spec.md)
  are complete**: the game loop, health model, enemy contract, contact classification, reward
  handling and editor exist. This feature changes how a kind declares movement and animation and
  adds one kind; it recreates none of that.
- **`public/sprites/bee.png` is a 192×168 sheet** of 8 columns × 7 rows of 24×24 cells, whose row 5
  (frames 32–39) is the neutral flight loop, edited so the stinger is permanently slightly out. The
  bee's opaque art is smaller than its cell — about 18–19 px wide with wings extended and 10–13 px
  tall — and, unlike the slimes, it does **not** touch the bottom of its cell: it sits with
  transparent margins of roughly 3 px left, 2–3 px right, 7 px top and 3–5 px bottom. The side margin
  is declared as a single **symmetric** `side` value, so the larger of the two measured sides is used
  (the slight left/right asymmetry is not representable, by design). The exact
  reaction frames are game feel; if the sheet has no dedicated reaction row, FR-009's fallback makes
  the bee reuse its flight loop during the reaction.
- **Bee tuning is game feel**, decided during implementation: speed, bob amplitude and period, and
  render scale. Because the bee's opaque art fills only part of its cell, its visible size at a
  given render scale is smaller than a slime's; the render scale is chosen so the visible bee reads
  clearly against the air. `renderScale: 1` puts a roughly 38 px-wide bee on screen.
- **The bee's marker character**: the design suggested `b`, which is already the bomb-pot block, so
  the implementation picks a free character whose glyph reads as a bee (assumed `q`, whose shape
  suggests the insect). FR-014 requires only that
  it collides with nothing.
- **Enemies stay non-solid**: the bee never blocks the character's movement, and its bob never
  affects terrain collision — the bee is an obstacle by contact, not by geometry.
- **Movement behaviors are deterministic functions of their inputs**, so they can be exercised
  without a rendered game or a running frame loop.
- **No CV data is involved**: the bee carries no fact and no item, so a level with bees behaves
  identically whatever the CV contains.
- **The seam is a refactor of shared behavior, not a new behavior**: the slimes' patrol is moved
  behind the seam rather than rewritten, which is why SC-001 demands identical results.

## Out of Scope

- Any enemy kind other than the bee — the bird, bat and mushroom variants remain under #66.
- Enemy gravity, falling enemies, or enemies that walk off ledges.
- Chase behavior on any shipped enemy kind; the chase behavior ships tested but unused.
- An attack state machine, projectiles, telegraphs, or enemy attacks of any kind.
- Bee variants (an angry bee, a swarm, a hive), bee-specific rewards, or bee-specific audio.
- Any change to how the slimes move, animate, look or pay out.
- Enemy contact damage, bounce height, knockback, health, invincibility or respawn rules — those
  belong to [F-016](../F-016-platformer-health/spec.md) and [F-017](../F-017-platformer-enemies/spec.md).
- The editor's overall UI or dark-mode behavior (O-015, O-016); this feature only adds the bee entry.
- Difficulty scaling, spawners, or timers that produce enemies during play.
