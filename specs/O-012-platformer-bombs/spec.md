# Feature Specification: Platformer Bombs

**Feature Branch**: `O-012-platformer-bombs`
**Created**: 2026-09-20
**Status**: Draft
**Input**: User description: "O-012 Platformer Bombs — add a new blue pot, a bomb icon, and bomb fuse/explosion frame animation"

## Overview

The platformer's third pot kind: a **blue bomb pot**. Landing on it shatters it and yields a
**bomb**, which the character carries. The character can **place** a carried bomb at its feet; the
placed bomb lights its fuse, pulses as it nears detonation, and then **explodes** in a rounded 5×5 burst
that destroys destructible blocks, damages enemies and hurts the character if it is still in the
blast.

This builds directly on [O-017](../O-017-merge-mixed-pots/spec.md)'s shared pot abstraction: the
bomb pot is one more `createPotType` kind that declares only its key, sprite, drop, drop policy,
respawn flag and single-pot draw, and merges into a bunch with coin and potion pots with no new
merge code. What is genuinely new is everything **downstream of the pot**: a bomb pickup, a carried
count, a place-bomb input, a ticking placed bomb, and a rounded 5×5 explosion.

The feature is deliberately the **largest** interpretation of the idea (a carried and placed bomb
rather than a pot that explodes in place), confirmed in clarification below.

## Clarifications

### Session 2026-09-20

- Q: How does the bomb come into being and get triggered? → A: **The player carries and places the
  bomb.** Landing on the blue pot yields a bomb to the character's inventory; the character places
  it later with a dedicated input. The bomb is not the pot exploding in place, and is not thrown.
- Q: What does the explosion affect? → A: **Destructible blocks, enemies and the character.**
  Blocks in the blast are destroyed; enemies in the blast take **2 hitpoints** through the shared hit
  pipeline (a fatal hit then defeats them as usual); and the character takes **2 hitpoints (a full
  heart)**, is knocked back away from the bomb and enters the `hit` flash, subject to the existing
  invincibility window.
- Q: What is the blast's shape/size, and do explosions chain? → A: **A rounded 5×5 area centred on
  the bomb (the 5×5 square with its four corner tiles cut, 21 tiles), with no chain reactions.** A
  blast never detonates another placed bomb.
- Q: How does the character deploy a carried bomb? → A: **Place at the feet only.** A dedicated
  input places one bomb in the tile the character currently occupies; there is no throwing or
  aiming.
- Q: How many bombs can the character carry, and how is that shown? → A: **Counted, with a small
  cap (default 5)**, shown in the HUD as a bomb icon with the current count.
- Q: What happens to blue pots, placed bombs and carried bombs across a death/respawn? → A: **Blue
  pots are restored, and the character loses all bombs.** Broken blue pots come back intact on
  respawn (like the potion pot); placed-but-unexploded bombs are removed; the carried count resets
  to zero.
- Q: What are the bomb's fuse animation and HUD icon? → A: **HUD icon = bomb-sheet frame 0
  (unlit).** The placed bomb plays frames 1 → 2 → 3, then alternates frames 4 (pulse partner) and 5
  (orange, drawn slightly larger) a tunable number of times (default 3), ending on frame 5, then
  detonates. The chosen explosion sheet's frames play once, in order.
- Q: Which sprite is the blue bomb pot? → A: **`world_tileset.png`, row 8, column 0 (frame 128)** —
  the blue bottle directly to the left of the potion pot's red bottle (row 8, column 1). It is a
  fixed sprite, so the bomb pot renders it unchanged inside a bunch (FR-006), needing no new art.
- Q: Which key places a bomb, and how is it taught? → A: A dedicated **`B` key** (`KeyB`), **not**
  advertised in the start-of-game controls overlay (showing it would reveal bombs too early and
  overload the overlay). It is taught contextually by a **sign** beside the first blue pot (the
  existing sign/hint system, with a new `HintId`, sign digit and `en`/`de` strings) and by the
  empty-inventory "no bombs" bubble.
- Q: Does the blast affect loose pickups? → A: **No.** Coins, hearts, keys, fruits and bomb pickups
  lying in the blast are left untouched; the blast only destroys blocks, defeats enemies and damages
  the character.
- Q: What sprite is the world bomb pickup? → A: **`bomb.png` frame 0** (the unlit bomb) — the same
  art as the HUD icon.
- Q: Is the shipped level modified? → A: **Yes.** The shipped level gains one blue pot and an
  adjacent bomb hint sign, so the mechanic is reachable and visible. This supersedes the earlier
  "shipped level not modified" assumption.
- Q: How do bomb pickups and placed bombs sit in the world? → A: **The bomb pickup bobs like the
  heart/coin** (shared `coinBobOffset`) and, while the count is at the cap, stays on the ground still
  bobbing until it can be collected. The **placed bomb does not bob** — it rests flat in its tile.
- Q: What happens if the player presses the bomb key with no bombs? → A: **A "no bombs" bubble** is
  shown, using the same bubble mechanism as the chest-without-key hint (a new `HintId` with `en`/`de`
  strings). Nothing is placed and nothing is consumed.
- Q: Does a placed bomb fall if placed in mid-air? → A: **Yes.** It falls under gravity to the first
  solid surface below and rests there. Its fuse keeps ticking while it falls, and a bomb that falls
  out of the level is removed without exploding.
- Q: Is blast damage tied to the explosion animation frames (e.g. only the full fireball hurts)? →
  A: **No.** Damage, block destruction and enemy damage all resolve **once, at the instant of
  detonation**, independent of the drawn frame. The whole animation — including the small first frame
  and the trailing smoke — is purely visual, and the area is inert afterward (walking in during the
  fireball or smoke deals no damage). This avoids a per-frame damage window that would make "which
  frame is lethal?" unpredictable.
- Q: Does a blast destroy a question-mark block? → A: **No.** A blast targets only blocks that leave
  the world when used up (crate, fragile rock, pots). A question-mark block never leaves the world, so
  it is left untouched and spawns no bonus fruit.
- Q: How does a bomb treat one-way tiles (bridges and ladders)? → A: **A bridge stops a bomb** (it
  rests on the bridge and never falls through it), while **a ladder tile is open air**, so a bomb
  placed there falls to the first solid surface below.
- Q: What does the bomb HUD show at zero? → A: **Nothing** — the bomb HUD group is hidden while the
  carried count is 0 and appears once the count is at least 1.
- Q: How large is the blast? → A: **A rounded 5×5 (radius 2)**: the 5×5 square with its four corner
  tiles cut (21 tiles), centred on the bomb and clipped to the level bounds. This was widened from
  the original 3×3 so the damage reaches the edges of the enlarged explosion burst, and the corners
  are cut so the area reads round; the blast still affects only whole blocks (FR-018).
- Q: Does the blast kill enemies outright? → A: **No.** It deals **2 hitpoints** through the normal
  hit pipeline: the enemy enters its `hit` reaction and loses 2 hitpoints, and only a fatal hit
  (hit points at or below zero once the reaction finishes) defeats it. A green slime (1 hit point)
  dies; a purple slime (3 hit points) survives with 1. The character hit by the blast is likewise
  knocked back away from the bomb and enters the `hit` flash.
- Q: Where does a bomb that fell after placement explode? → A: **Where it is at detonation, not where
  it was placed.** A bomb placed in mid-air falls to the first solid surface below, and both the blast
  area and the explosion visual are centred on its current (landed) tile when the fuse expires.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The Blue Pot Yields a Bomb (Priority: P1)

A visitor lands on a blue bomb pot. It shatters with the shared pot puff and bounce, and a bomb
appears where the pot stood. The character collects it, and the HUD's bomb icon count ticks up by
one. The visitor now has something to spend.

**Why this priority**: Without the bomb source there is no feature. This is the entry point every
other story depends on.

**Independent Test**: Place a blue pot, land on it, and verify it breaks with the standard bounce
and puff, a bomb appears at its tile, the character collects it, and the HUD count increases by
exactly one.

**Acceptance Scenarios**:

1. **Given** a blue bomb pot and the character carrying no bombs, **When** the character lands on
   the pot, **Then** the pot breaks, a bomb appears, and on collection the carried count becomes 1.
2. **Given** the character breaks a blue pot, **When** the pot breaks, **Then** it uses the same
   single-hit, land-on-top trigger and bounce as every other pot.
3. **Given** a blue pot placed next to a coin pot or potion pot, **When** the row renders, **Then**
   the blue pot merges into the bunch with a clay filler on the seam (O-017 parity).

---

### User Story 2 - Place a Bomb and Get Clear (Priority: P1)

The visitor presses the place-bomb input. A bomb drops at the character's feet, its fuse lights, and
it begins to pulse — small, then bigger, then small again — faster as detonation approaches. The
visitor runs clear. A moment later it explodes in a rounded 5×5 burst. A visitor who does not move in time
takes 2 hitpoints (a full heart) of damage.

**Why this priority**: The placed bomb and its fuse are the feature's core interaction and its main
source of tension.

**Independent Test**: Carry a bomb, place it, and verify a bomb appears at the character's tile, its
fuse animation plays with an accelerating size pulse, it detonates after the fuse duration, and a
character still in the blast loses 2 hitpoints (a full heart).

**Acceptance Scenarios**:

1. **Given** the character carries at least one bomb, **When** the place-bomb input is pressed,
   **Then** a bomb appears in the character's current tile and the carried count decreases by one.
2. **Given** a placed bomb, **When** the fuse runs, **Then** the bomb renders a lit fuse and its
   drawn size pulses with increasing urgency until detonation.
3. **Given** a placed bomb and the character standing in its tile, **When** the fuse expires,
   **Then** the bomb explodes and the character takes 2 hitpoints (a full heart) of damage.
4. **Given** a placed bomb and the character clear of the blast, **When** the fuse expires, **Then**
   the character takes no damage.
5. **Given** the character has just taken damage from any source, **When** it is caught in a blast
   during the invincibility window, **Then** no further damage is taken.

---

### User Story 3 - The Blast Clears the Way (Priority: P1)

The visitor places a bomb beside a cluster of crates, a fragile rock and a patrolling slime. The
blast destroys the blocks — revealing the facts the crates carried — and defeats the enemy, which
leaves behind whatever it would have left from a stomp.

**Why this priority**: This is what makes the bomb useful: a tool that opens paths and clears
threats, not just a hazard.

**Independent Test**: Detonate a bomb whose rounded 5×5 area contains a crate, a fragile rock and an enemy;
verify the blocks are destroyed (and their facts revealed) and the enemy takes 2 hitpoints — defeated
with its normal reward once its hit reaction finishes if that hit was fatal.

**Acceptance Scenarios**:

1. **Given** a destructible block in the blast area, **When** the bomb explodes, **Then** the block
   is destroyed as if it had taken its final hit.
2. **Given** a crate in the blast area, **When** it is destroyed, **Then** the facts it carried are
   revealed and counted exactly as a stomp/bump destruction would.
3. **Given** a green slime (1 hit point) in the blast area, **When** the bomb explodes, **Then** it
   takes 2 hitpoints, plays its `hit` reaction, and is then defeated, dropping the same reward it
   drops when stomped. A tougher enemy (a purple slime, 3 hit points) survives the same blast with
   1 hit point left.
4. **Given** terrain (ground, wall, bridge, ladder) or a static object in the blast area, **When**
   the bomb explodes, **Then** it is untouched.
5. **Given** a pot in the blast area, **When** the bomb explodes, **Then** the pot is destroyed and
   its pickup (coin, heart or bomb) is spawned.

---

### User Story 4 - The Inventory Has Limits (Priority: P2)

The visitor breaks several blue pots and watches the HUD count rise to its cap. Further bombs are
left lying on the ground rather than wasted. The visitor places a bomb and the count falls; a bomb
left on the ground can now be collected.

**Why this priority**: The cap and the HUD make bombs a resource to manage; without it the inventory
is unbounded and the HUD becomes meaningless.

**Independent Test**: Fill the inventory to the cap, collect another bomb, and verify the count does
not exceed the cap and the pickup remains in the world; place a bomb and verify the pickup can then
be collected.

**Acceptance Scenarios**:

1. **Given** the carried count is below the cap, **When** a bomb pickup is collected, **Then** the
   count increases by one.
2. **Given** the carried count is at the cap, **When** the character touches a bomb pickup, **Then**
   the count is unchanged and the pickup remains in the world.
3. **Given** the carried count is zero, **When** the place-bomb input is pressed, **Then** nothing is
   placed and no count is consumed.
4. **Given** the character's tile already holds a placed bomb, **When** the place-bomb input is
   pressed, **Then** nothing is placed and no count is consumed.
5. **Given** the character is standing in a placed bomb's tile, **When** the character moves,
   **Then** it is not blocked by the bomb (the bomb is not solid).

---

### User Story 5 - Death, Respawn and Refill (Priority: P2)

The visitor places a bomb, is caught in the blast, and dies. On respawn the ticking bomb is gone,
the carried bombs are gone, and every blue pot the visitor broke is standing again — so the visitor
can break one for a fresh bomb.

**Why this priority**: The respawn rules keep the mechanic coherent with the rest of the game and
prevent a death from leaving orphaned live bombs in the world.

**Independent Test**: Place and break, then die; verify placed bombs are removed, the carried count
is zero, and broken blue pots are restored intact and yield a bomb again when re-broken.

**Acceptance Scenarios**:

1. **Given** a placed, unexploded bomb, **When** the character dies and respawns, **Then** the bomb
   is gone.
2. **Given** the character is carrying bombs, **When** it dies and respawns, **Then** the carried
   count is zero.
3. **Given** a blue pot was broken, **When** the character respawns, **Then** the blue pot is
   restored intact.
4. **Given** a restored blue pot, **When** the character lands on it again, **Then** it yields a
   fresh bomb.

---

### User Story 6 - The Editor Knows the Blue Pot (Priority: P3)

A level author picks the blue bomb pot from the editor palette, paints it, and sees it previewed in
the canvas — including merging with neighbouring pots — exactly as the game renders it. The author
cannot paint placed bombs or explosions; those only exist at play time.

**Why this priority**: The editor is how levels are built, but the game experience comes first.

**Independent Test**: Paint a blue pot in the editor, verify its palette entry and canvas preview
match the game's rendering, and verify no runtime bomb or explosion can be painted.

**Acceptance Scenarios**:

1. **Given** the editor palette, **When** the author selects the blue bomb pot, **Then** it is
   available with its own icon and places a `bombPot` marker.
2. **Given** a blue pot painted next to another pot, **When** the canvas renders, **Then** it merges
   into a bunch exactly as the game does.
3. **Given** the editor, **When** the author looks for a placed bomb or an explosion, **Then** no
   such palette entry exists.

---

### Edge Cases

- ✅ **Placing with an empty inventory**: no bomb appears and nothing is consumed.
- ✅ **Placing on a tile that already holds a bomb**: no bomb appears and nothing is consumed.
- ✅ **A bomb pickup while the inventory is full**: it stays on the ground, bobbing, and is collected
  as soon as the count drops below the cap.
- ✅ **Placing in mid-air**: the bomb falls under gravity to the first solid surface below and rests
  there; it is not left hanging in the air.
- ✅ **A bomb at the level edge**: the rounded 5×5 area is clipped to the level bounds; the missing cells
  simply have no effect.
- ✅ **A second bomb inside a blast**: it is unaffected — it neither detonates nor is removed; only its
  own fuse detonates it (no chain reactions).
- ✅ **The character enters the blast during the invincibility window**: no damage is taken.
- ✅ **The character walks into the blast area after detonation** (while the fireball or smoke frames
  are still playing): no damage is taken — the effects resolved at the instant of detonation, and the
  small first frame and the trailing smoke are purely visual.
- ✅ **The character is caught in two overlapping blasts in one tick**: at most one blast's damage
  (2 hitpoints) is taken, via the shared invincibility window.
- ✅ **A crate destroyed by a blast**: it reveals its facts exactly as a bump/stomp destruction does.
- ✅ **A blast reaches a question-mark block**: it is untouched — a question-mark never leaves the
  world, so it is not a blast target (and no bonus fruit is spawned).
- ✅ **An enemy defeated by a blast**: a fatal 2-hitpoint blast drops the same reward a stomp does,
  after the enemy's `hit` reaction finishes.
- ✅ **A purple slime in a blast**: takes 2 of its 3 hit points and survives with 1, returning to its
  patrol after the reaction.
- ✅ **A bomb pot destroyed by a blast** (not by landing on it): it is destroyed and drops its bomb
  pickup, which can be collected.
- ✅ **The character dies with a bomb mid-fuse**: the bomb is removed and never explodes.
- ✅ **A bomb placed on a bridge**: it rests on the bridge and never falls through; the blast
  destroys neither the bridge.
- ✅ **A bomb placed on a ladder tile**: a ladder is open air, so the bomb falls to the first solid
  surface below.
- ✅ **A blast reaches a blue pot**: the pot breaks and yields a bomb pickup, which is not itself an
  explosion.
- ✅ **A blast reaches an already-used-up block**: nothing happens; only live blocks are destroyed.

## Requirements _(mandatory)_

### Functional Requirements

#### The bomb pot (blue pot)

- **FR-001**: A third pot kind, the **bomb pot**, MUST exist and MUST be produced through the shared
  pot abstraction from O-017, contributing only its registry key, sprite, drop, drop policy,
  respawn flag and single-pot draw.
- **FR-002**: The bomb pot MUST be destroyed by landing on it, with the same single hit, land-on-top
  trigger, shared bounce and puff as every other pot.
- **FR-003**: The bomb pot MUST be restored intact on respawn and MUST yield its drop on **every**
  break, so it can be re-farmed after a death.
- **FR-004**: Breaking the bomb pot MUST yield a **bomb pickup** at the pot's tile, which the
  character can collect. The pickup uses `bomb.png` frame 0 (the unlit bomb), the same art as the HUD
  icon.
- **FR-005**: The bomb pot MUST merge into a bunch with any other pot kind, with a clay filler on
  the seam, exactly as O-017 specifies, with no new merge code.
- **FR-006**: The bomb pot MUST render as its own fixed sprite inside a bunch and MUST NOT be
  replaced by a clay size variant.

#### Carrying bombs

- **FR-007**: Collecting a bomb pickup MUST increase the character's carried bomb count by one,
  while the count is below the cap.
- **FR-008**: The carried bomb count MUST be capped at a fixed small maximum (default **5**).
- **FR-009**: While the count is at the cap, a bomb pickup MUST NOT be consumed and MUST remain in
  the world, still bobbing like any other pickup, until the count drops below the cap.
- **FR-010**: The HUD MUST show a bomb icon (the unlit bomb, bomb-sheet frame 0) together with the
  current carried count. The bomb HUD group MUST be hidden while the count is 0 and shown once the
  count is at least 1.
- **FR-011**: A bomb MUST carry no CV fact and MUST NOT contribute to any journal counter.

#### Placing bombs

- **FR-012**: A dedicated place-bomb input MUST exist: the **`B` key** (`KeyB`). It MUST NOT be
  advertised in the start-of-game controls overlay (adding a bomb keycap/caption would reveal the
  mechanic too early and overload the overlay); it is taught contextually by a hint sign beside the
  first blue pot (FR-034) and by the empty-inventory bubble (FR-014).
- **FR-013**: Pressing the place-bomb input with at least one carried bomb, on a tile with no placed
  bomb, MUST place one bomb in the character's current tile and MUST consume exactly one bomb.
- **FR-014**: Pressing the place-bomb input with no carried bombs MUST place nothing and MUST NOT
  consume a bomb; instead it MUST show a brief "no bombs" bubble, using the same bubble mechanism as
  the chest-without-key hint (a new `HintId` with `en`/`de` strings). Pressing it on a tile that
  already holds a placed bomb MUST place nothing and consume nothing.
- **FR-015**: A placed bomb MUST be non-solid (the character is never blocked or stood up by it) and
  MUST NOT bob. Placed on a solid surface it rests there; placed in open air it MUST fall under
  gravity to the first solid surface below and rest there. For a bomb, a bridge counts as a solid
  landing surface (it never falls through a bridge), while a ladder tile is open air. A bomb that
  falls out of the level MUST be removed without exploding. Its fuse keeps ticking while it falls.

#### Fuse and explosion

- **FR-016**: A placed bomb MUST detonate after a fixed fuse duration (default approximately
  **2 seconds**).
- **FR-017**: A placed bomb MUST animate through the bomb sheet in a fixed pre-detonation order, and
  its orange frame MUST be drawn slightly larger than the others. Specifically:
  - The frames play in the order **1 → 2 → 3 → (4 → 5)**, where frames 1–3 are the lit fuse burning
    down, frame 4 is the pulse partner, and frame 5 is the orange pre-detonation glow.
  - The **4 → 5** alternation repeats a tunable number of times, default **3** (frame 5 shown three
    times), and the animation ends on frame 5, immediately before detonation.
  - While frame 5 is shown, the bomb MUST be drawn at a tunable scale larger than the other frames,
    default approximately **1.25×**.
  - Frame 0 (the unlit bomb) MUST NOT appear in the placed bomb's animation; it is used only as the
    HUD counter icon.
- **FR-018**: On detonation, a bomb MUST explode in a **rounded 5×5 tile area** centred on the tile it
  currently occupies — the 5×5 square with its four corner tiles cut (21 tiles), so the area reads
  round — clipped to the level bounds. A bomb that fell after placement detonates at its current
  (landed) tile, not where it was placed.
- **FR-019**: The explosion MUST destroy every **destructible block** whose tile lies in its area,
  applying the block's terminal-hit outcome (facts revealed, pickups spawned, counter popups
  updated) exactly as a normal destruction would. A **destructible block** here means one that leaves
  the world when used up — a crate, a fragile rock, or any pot. A **question-mark block** never
  leaves the world, so it is **not** a blast target and is left untouched.
- **FR-020**: The explosion MUST deal **2 hitpoints** of damage to every enemy overlapping its area,
  through the same hit pipeline a stomp uses: the enemy enters its `hit` reaction and its hit points
  drop by 2. A hit that leaves the enemy at zero or fewer hit points then runs the existing defeat
  path (rewards and drops) once the reaction finishes, exactly as a stomp defeat does. A tougher
  enemy (more than 2 hit points) survives the blast with reduced hit points rather than being killed
  outright.
- **FR-021**: The explosion MUST damage the character if the character's hitbox overlaps its area,
  dealing **2 hitpoints (2 half-heart units, one full heart)** through the shared damage mechanism
  and the shared post-damage invincibility window. A blast has no single contact side, so it MUST
  knock the character back **away from the bomb's centre** and enter the same `hit` sprite-flash
  reaction a side hit uses (not the blink-only pit-fall reaction).
- **FR-022**: The explosion MUST NOT destroy terrain or static objects (ground, wall, bridge,
  ladder, decorations, and so on).
- **FR-023**: The explosion's destructive, defeating and damaging effects MUST resolve exactly once,
  at the instant of detonation, regardless of which animation frame is drawn. The chosen explosion
  sheet's frames MUST then play once, in order, as a purely visual effect that MUST NOT persist as a
  hazard. The blast area is fully inert for the rest of the animation: entering the rounded 5×5 area after
  detonation (during the fireball or the smoke frames) MUST deal no damage.
- **FR-024**: A blast MUST reach through intervening blocks — the rounded 5×5 area is not blocked by
  line-of-sight.

#### No chain reactions

- **FR-025** (targeting): A blast MUST NOT include any other placed bomb among its targets — bombs
  are never destroyed, removed or detonated by a blast.
- **FR-026** (trigger): A placed bomb MUST detonate only when its own fuse expires; nothing else can
  trigger a detonation.

#### Respawn

- **FR-027**: On death/respawn, every placed, unexploded bomb MUST be removed.
- **FR-028**: On death/respawn, the carried bomb count MUST reset to zero.
- **FR-029**: On death/respawn, every broken bomb pot MUST be restored intact (like the potion pot).

#### Editor

- **FR-030**: The blue bomb pot MUST be authorable in the level editor with its own palette entry
  and MUST preview in the canvas exactly as the game renders it, including bunch merging.
- **FR-031**: Placed bombs and explosions MUST NOT be authorable in the editor.

#### Regression

- **FR-032**: Every existing coin-pot and potion-pot behavior (drop, drop policy, bounce, trigger
  side, removal, respawn, bunch merging) MUST be unchanged.

#### Blast and loose pickups

- **FR-033**: The explosion MUST NOT destroy, damage or move loose pickups (coins, hearts, keys,
  fruits or bomb pickups) lying in its area; only blocks, enemies and the character are affected.

#### Onboarding and level content

- **FR-034**: A **hint sign** explaining bombs MUST be placed in the shipped level beside the first
  blue pot, using the existing sign/hint system: a new `HintId`, a new sign digit, and `en`/`de`
  strings. Standing on the sign and pressing Up shows the bomb hint. A separate `noBombs` hint string
  MUST exist for the empty-inventory bubble (FR-014).
- **FR-035**: The shipped level MUST place at least one blue pot, so the bomb mechanic is reachable
  and visible.

### Key Entities

- **Bomb pot (blue pot)** — the third pot kind. A solid tile-aligned pot broken by being landed on,
  restored on respawn, yielding a bomb pickup on every break.
- **Bomb pickup** — a collectible with no CV fact that, when collected below the cap, increments the
  carried bomb count. A `PickupKind` in the existing pickup system, bobbing like the heart/coin. At
  the cap it stays on the ground, still bobbing, until the count drops.
- **Carried bomb count** — the character's inventory of bombs, capped (default 5), shown in the HUD.
- **Placed bomb** — a runtime, non-solid entity with a fuse timer. Does not bob; placed on the ground
  it rests in its tile, and placed mid-air it falls under gravity to the first solid surface below.
  Pulses as its fuse burns and detonates in a rounded 5×5 area when the fuse expires. Never authorable.
- **Explosion** — the transient rounded 5×5 effect of a detonation that resolves destruction, enemy damage
  and player damage once, then disappears. It never affects another placed bomb.
- **Bomb hint sign** — a sign prop placed beside the first blue pot in the shipped level; standing
  on it and pressing Up shows the bomb hint (naming the `B` key), using the existing sign/hint
  system.

## Visual Assets

All assets are flat 2D pixel art delivered as single strips, so every frame shares one style and
palette.

| File (`public/sprites/`) | Size | Frames | Use |
|---|---|---|---|
| `bomb.png` | 96×16 | 6 × 16×16 | Frame 0 = unlit bomb, the HUD counter icon. Frames 1–3 = lit fuse burning down. Frame 4 = pulse-partner frame. Frame 5 = orange pre-detonation glow, drawn slightly larger. |
| `world_tileset.png` | 256×256 | 16×16 grid | The bomb pot reuses the **blue bottle at row 8, column 0 (frame 128)** — the blue bottle directly left of the potion pot's red bottle (row 8, column 1). No new art needed. |
| `explosion.png` | 384×48 | 8 × 48×48 | The spiky, comic-style explosion burst. |

The explosion's frames play once, in order, on detonation. (An earlier round-fireball candidate was
dropped in favour of this comic burst.)

Onboarding: a **bomb hint sign** is placed in the shipped level (reusing the existing sign-prop
art); its text is a new `platformer.hints` string in `en`/`de`, plus a second `platformer.hints`
string for the empty-inventory `noBombs` bubble (FR-014). **No new overlay keycap is added** — the
start-of-game controls overlay stays unchanged. The blue pot's clay fillers reuse the existing three
clay variants (O-017).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Bomb source**: Landing on a blue pot breaks it with the standard pot outcome and
  results in exactly one collectible bomb. Verified by automated tests.
- **SC-002 — Inventory cap**: The carried count never exceeds the cap; a pickup at the cap is left
  in the world; placing consumes exactly one. Verified by automated tests.
- **SC-003 — Placement rules**: Placing with zero bombs shows a "no bombs" bubble and consumes
  nothing; placing onto an occupied tile is a silent no-op that consumes nothing. Verified by
  automated tests.
- **SC-004 — Fuse**: A placed bomb detonates after the fuse duration and never before it. Verified
  by automated tests over the fuse timeline.
- **SC-005 — Blast area**: Detonation affects exactly the rounded 5×5 area (21 tiles, corners cut)
  centred on the bomb, clipped to level bounds. Verified by automated tests.
- **SC-006 — Destruction**: Every live destructible block in the blast is destroyed with its
  terminal-hit outcome, and every enemy in the blast takes 2 hitpoints through the shared hit
  pipeline (a fatal hit then pays the normal reward after the hit reaction). A question-mark block is
  not a destructible block here and is left untouched. Verified by automated tests.
- **SC-007 — Player damage**: A character in the blast takes exactly 2 hitpoints (one full heart),
  is knocked back away from the bomb and enters the `hit` flash, and takes none while invincible.
  Verified by automated tests.
- **SC-008 — Terrain safe**: No terrain or static object in the blast changes. Verified by automated
  tests.
- **SC-009 — No chains**: A blast never detonates or removes another placed bomb; each bomb
  detonates only from its own fuse. Verified by automated tests.
- **SC-010 — Respawn reset**: After a death/respawn, no placed bomb remains, the carried count is
  zero, and every broken blue pot is restored. Verified by automated tests.
- **SC-011 — Editor parity**: A blue pot painted in the editor previews identically to the game,
  including bunch merging, and no runtime bomb or explosion is authorable. Verified by automated
  tests.
- **SC-012 — No regression**: All existing coin-pot and potion-pot behavior (including O-017 bunch
  merging) is unchanged. Verified by the existing test suites passing.
- **SC-013 — Pickups safe**: Loose pickups in a blast are unchanged; only blocks, enemies and the
  character are affected. Verified by automated tests.
- **SC-014 — Onboarding**: The shipped level contains a blue pot and an adjacent bomb hint sign
  whose tooltip names the `B` key, and the start-of-game controls overlay is unchanged (it does not
  advertise a bomb key). Verified by tests.

## Assumptions

- **[O-017](../O-017-merge-mixed-pots/spec.md) (Merge Pots of Different Colors) is complete**: the
  shared pot abstraction, the kind-agnostic bunch render plan and the `createPotType` extension
  point exist and are used here unchanged.
- **[F-018](../F-018-platformer-blocks/spec.md) (Destroyable Blocks) and
  [F-017](../F-017-platformer-enemies/spec.md) (Enemies) are complete**: the game already has a set
  of destructible block kinds with terminal-hit outcomes, and enemies with stomp-defeat outcomes;
  the blast reuses both rather than defining new ones.
- **[F-016](../F-016-platformer-health/spec.md) (Health) is complete**: the half-heart damage unit
  and the shared post-damage invincibility window exist and are reused for blast damage.
- **The blast is a rounded 5×5 area**: the 5×5 square with its four corner tiles cut (21 tiles), so
  it reads round rather than square. It is not blocked by intervening blocks and has no
  line-of-sight rule; this is the simplest rule that is still satisfying and testable.
- **The fuse duration and the carry cap are fixed constants**: defaults of approximately 2 seconds
  and 5 bombs; exact values are tuning details, not spec-level requirements.
- **A placed bomb falls under gravity**: placed on solid ground it rests in its tile; placed
  mid-air it falls to the first solid surface below (and is removed if it falls out of the level).
- **A placed bomb is non-solid**: the character can stand in and walk through its tile.
- **Only one bomb occupies a tile**: placing onto an occupied tile is a no-op.
- **Bomb pickups carry no CV fact and no journal counter**: like the heart, a bomb is a pure
  gameplay resource; the HUD icon is its only counter.
- **The bomb pot uses a new level marker letter** (planned: `b`), added to the level parser and
  block mapper as a separate edit, consistent with O-017's treatment of a pot kind's marker.
- **The shipped level is modified**: it gains one blue pot and an adjacent bomb hint sign (FR-034,
  FR-035), so the mechanic is reachable. This supersedes O-017's "leave potion pots unplaced"
  precedent for this feature.
- **The blast leaves loose pickups untouched**: a blast never consumes an uncollected coin, heart,
  key, fruit or bomb pickup (FR-033).
- **There are no chain reactions**: a blast never detonates or removes another placed bomb
  (FR-025/FR-026).
- **The place-bomb key is `B`** (`KeyB`) — a dedicated key that never overlaps movement, jump or
  drop-through, so navigating down can never place a bomb by accident.
- **The character can carry bombs across a checkpoint**: a checkpoint respawn is the same
  death/respawn path as a full death, so the carried count resets and blue pots restore there too.
- **The bomb pot is not a clay size variant**: it renders a fixed blue sprite so it is
  distinguishable from coin pots inside a bunch.

## Out of Scope

- Throwing, aiming or kicking bombs; any bomb trajectory.
- Multiple bomb types, bomb upgrades, or explosives other than the one bomb.
- Bombs that destroy terrain, static objects or background layers.
- Line-of-sight or material-based blast blocking.
- Enemies that place or carry bombs.
- Bomb-specific CV facts, journal entries or journal counters.
- Placing bombs or explosions in the level editor.
- Remote detonation or any second input beyond the single place-bomb action.
- Changing the coin pot's or potion pot's drop, drop policy, bounce, trigger or respawn behavior.
- Chain reactions between bombs: a blast never detonates another placed bomb.
- Adding a bomb keycap/caption to the start-of-game controls overlay.
- Additional bomb hints beyond the single onboarding sign, or a paginated/tutorial sequence.
