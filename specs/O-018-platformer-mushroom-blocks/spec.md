# Feature Specification: Platformer Bouncy Mushroom Blocks

**Feature Branch**: `O-018-platformer-mushroom-blocks`
**Created**: 2026-09-20
**Status**: Draft
**Input**: O-018 Bouncy Mushroom Blocks — a red bouncy mushroom terrain kind the player passes through while walking and rising but lands on to be launched upward every time, plus a small purely decorative non-bouncy mushroom, both drawn from one mushroom tileset.

## Clarifications

### Session 2026-09-20

- Q: When solid terrain sits directly above a bouncy mushroom's top cap, is the cap still standable and bouncy, or does it become plain pass-through? → A: **Option B** — a cap is standable and bouncy only when the cell directly above it is **not solid**. With solid terrain directly above, the character can never get above the cap, so it cannot be landed on; the cap is treated as non-standable / pass-through for landing at that cell, mirroring `isStandableLadderTop`'s "no room to stand" rule. Out-of-bounds above (e.g. a cap in the level's top row) counts as open space, exactly as `tileAt` already returns `'empty'`.

  **Options offered**: **A** — always standable and bouncy (keep FR-006 as written); **B** — standable only under open sky (mirror `isStandableLadderTop`); **C** — standable but no bounce when trapped. **Rationale for B**: a covered cap can never be reached from above, so standability there is meaningless, and the ladder precedent already applies the same "no room to stand" rule.

- Q: How much force should the mushroom launch the character upward with? → A: **A dedicated super-jump, roughly five and a half tiles.** The launch is its own fixed impulse — not the pot bounce — set distinctly above the character's normal jump (~3.5 tiles), so bouncing is always a real traversal gain rather than something the player could beat by jumping off the cap, while still being a controlled arc rather than an extreme launch.

  **Options offered**: ~5.5 tiles (chosen); ~4.7 tiles (gentle super-jump); ~6.4 tiles (big launch); ~0.6 tile (pot-strength bump). **Rationale**: because the cap is standable, a launch weaker than a normal jump would be pointless — the player could simply jump off the cap for more height — so the bounce must exceed a jump, but a much higher launch would overshoot platforms and feel floaty.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Bounce Off the Red Mushroom (Priority: P1)

A visitor walking the Platformer level sees a red-capped mushroom standing in the open. It is not a wall: walking into it passes straight through, and jumping up into its underside does not stop them. But when the character falls onto its cap from above, the cap dips a couple of pixels and the character is launched back up with a fixed, high hop — higher than they could jump on their own — every time, no matter how fast or from how high they fell. The mushroom is never consumed, never breaks and never awards anything; it is simply a trampoline in the terrain.

**Why this priority**: The bounce is the whole feature. Without it the mushroom is just another decoration, and the level loses a traversal beat.

**Independent Test**: Place one mushroom, walk through it, jump through it from below, then fall onto its cap. Verify the character passes through on the first two contacts, is launched upward on the third, that the cap visibly dips and returns, and that the mushroom is still there and still bounces on a second and third landing.

**Acceptance Scenarios**:

1. **Given** a standing mushroom, **When** the character walks horizontally into its cap or stem, **Then** the character passes through without being stopped or bounced.
2. **Given** a standing mushroom, **When** the character jumps upward into its cap or stem from below, **Then** the character passes through without being stopped or bounced.
3. **Given** a standing mushroom, **When** the character falls onto its cap from above, **Then** the character is launched upward with a fixed impulse, regardless of fall speed or fall height, and the cap dips briefly and returns.
4. **Given** a mushroom the character has already bounced on, **When** the character lands on its cap again, **Then** it bounces again, identically, with no sign of wear, breakage or reward.
5. **Given** the character is standing on the ground next to a mushroom and walks horizontally onto its cap at the same height (the space above the cap being open, per FR-006), **When** gravity takes over, **Then** the resulting downward contact bounces the character rather than letting them come to rest on the cap.

---

### User Story 2 - Build a Taller Mushroom from Cap and Stem Segments (Priority: P2)

A level author wants a mushroom tall enough to reach a high ledge. They paint the mushroom tile in a vertical column: one cell alone is a complete little mushroom, and every extra cell added below it grows the stalk downward, with the cap staying on top and a foot at the bottom. A single mushroom and a six-tile mushroom read as the same object at different heights, and only the cap at the top is something the character can land on.

**Why this priority**: Height is what makes the mushroom useful for level design; a fixed one-tile mushroom is a nice trick but a short one.

**Independent Test**: Paint a run of three or more mushroom cells, load the level, and verify the column renders as one mushroom (cap on top, straight stem in the middle, foot at the bottom), that the character can pass through every stem cell, and that only the top cap is landable and bouncy.

**Acceptance Scenarios**:

1. **Given** a single mushroom cell with nothing solid directly above it, **When** it renders, **Then** it shows a complete mushroom — cap, stem and foot — and its cap is standable and bouncy.
2. **Given** two or more vertically adjacent mushroom cells, **When** they render, **Then** the top cell shows the cap with a straight stem connector, the bottom cell shows the stem with a foot, and every cell between shows a plain straight stem, forming one continuous mushroom.
3. **Given** a tall mushroom, **When** the character falls onto a stem cell below the cap, **Then** the character passes through it without landing or bouncing.
4. **Given** a tall mushroom, **When** the character falls onto the top cap, **Then** the character is launched upward exactly as on a single mushroom.
5. **Given** a mushroom run, **When** the level is saved and reloaded, **Then** the run is preserved and renders identically.

---

### User Story 3 - Place the Small Decorative Mushroom (Priority: P3)

A visitor sees a small mushroom cluster growing on the ground beside the path. It is scenery: walking through it does nothing, landing on it does nothing, it never bounces and never blocks. It exists so a level author can dress a scene with mushrooms that are not trampolines.

**Why this priority**: Pure decoration. The game is fully playable without it, but the mushroom tileset's small variant should be usable rather than stranded in the sheet.

**Independent Test**: Place a small mushroom, walk into it, jump onto it from above, and verify the character passes through or falls past it every time with no bounce, no stop and no reward.

**Acceptance Scenarios**:

1. **Given** a small decorative mushroom, **When** the character walks into it, **Then** the character passes through unchanged.
2. **Given** a small decorative mushroom, **When** the character falls onto it from above, **Then** the character falls straight through it — no landing, no bounce.
3. **Given** a small decorative mushroom, **When** the level is played, **Then** it never advances a counter, never reveals a fact and never changes state.

---

### User Story 4 - Author Both Mushrooms from the Editor Palette (Priority: P4)

A level author opens the level editor and finds both mushrooms in the palette: the bouncy mushroom and the small decorative mushroom, each with a readable name and a preview of its actual art. They paint either one onto the grid exactly like any other terrain, save the level, and see the same mushrooms when the level is played.

**Why this priority**: The tiles are unusable in practice without a palette entry, but this is the authoring surface for the two kinds above rather than a new player-facing behavior.

**Independent Test**: Open the editor, select each mushroom from the palette, paint a vertical run, save, reload, and verify both tiles and the taller run persist and render correctly.

**Acceptance Scenarios**:

1. **Given** the editor palette, **When** the author looks for the mushrooms, **Then** both kinds are present with a name, a description and a preview showing their real art.
2. **Given** either mushroom selected, **When** the author paints cells, **Then** the cells hold the mushroom terrain exactly as any other terrain character does, including vertical runs.
3. **Given** a saved level containing mushrooms, **When** it is reloaded, **Then** the mushroom cells and their runs are unchanged.

---

### Edge Cases

- **Walking through the stem**: Every cell of a mushroom run except the top cap is pure pass-through — the character can stand inside it, walk out of it and jump through it with no collision and no bounce.
- **Rising through the cap**: A jump from directly below the cap passes through the cap and keeps going; only downward contact with the cap's top bounces.
- **Landing on a stem cell**: A fall that meets a stem cell passes straight through it. The stem is never landable, even when the character is already inside the run.
- **Landing on a cap mid-squash**: A cap that is still visually dipped from a previous bounce still bounces normally; the dip is cosmetic and never changes collision.
- **One-tile mushroom versus a tall one**: Both bounce identically on their cap. Only the tall one has pass-through stem cells below the cap.
- **Bounce stacking with other bounce sources**: When a mushroom landing and a destroyed pot resolve in the same instant, the character receives a single upward impulse — the stronger of the two, never the sum. A stomped enemy cannot co-occur with a mushroom landing: the stomp impulse is applied before the physics step, so the character is already rising when the ground scan runs and the cap is never landed on in that tick (FR-009).
- **Landing on the seam beside a cap**: A fall whose **centre column** lands on the tile beside a cap — even though the 24px hitbox still clips the cap — rests on the cap's corner without bouncing. Only a landing whose centre column is over the cap launches the character (FR-007).
- **Bouncing while already moving upward**: A mushroom contact that is not a downward landing — a side or underside touch — never bounces, so a bounce can never be triggered while the character is already rising.
- **A solid tile directly above the cap**: The cap is **not** landable. Standability and bounce require the cell directly above the cap to be non-solid, because the character can never get above a covered cap; the cap there is plain pass-through terrain, exactly like a stem cell. A cap in the level's top row counts as open above.
- **A cap buried under solid terrain**: A mushroom cell that is not the top of its run behaves as ordinary pass-through terrain at that cell. When a top cap has solid terrain directly above it, it is likewise not landable (FR-006) — nothing special happens where no landing can occur.
- **Death and respawn**: Mushrooms are unchanged by a death and respawn and by Reset Game — they were never destructible — and any in-progress cap dip is cleared.
- **The mushroom is never destroyed**: No interaction — landing, hitting from below, walking through, a bomb blast, or an enemy — ever removes, consumes or alters a mushroom.
- **Art narrower than its tile**: The cap's standable surface matches the cap art the player sees, and a stem, whose art is narrower than its cell, presents no collision at all, so the character is never caught by an invisible edge or floor.
- **Enemies passing through**: Enemies treat both mushroom kinds as non-solid and walk or fall through them; enemies are never bounced and never land on a cap.
- **Mushroom against a wall or ceiling**: Neighbouring solid terrain does not change a mushroom cell's role in its vertical run — a wall beside it never turns a stem into a cap or makes a stem standable, and side neighbours never make the mushroom solid. A solid tile directly above a cap is the one neighbour that matters: it removes that cap's standability and bounce per FR-006, leaving the cap's cell as pass-through.

## Requirements _(mandatory)_

The code-level contract behind these behaviors — how a terrain kind's vertical run is classified and how its art roles are chosen — is documented in [docs/themes/platformer/Terrain.md](../../docs/themes/platformer/Terrain.md) and [docs/themes/platformer/LevelFormat.md](../../docs/themes/platformer/LevelFormat.md). This specification states behavior only and does not restate that contract.

### Functional Requirements

- **FR-001**: The game MUST add two new terrain kinds: a bouncy mushroom and a small decorative mushroom. Each MUST be placeable by its own level character, distinct from every existing terrain, entity, sign and hazard character, and each MUST appear in the level editor's palette. Neither carries a CV fact, a HUD counter or any collection state.

- **FR-002**: A bouncy mushroom MUST be authored as a vertical run of one tile kind: a single cell is a complete mushroom, and additional cells stacked below it make the mushroom taller. A cell's art role MUST be derived automatically from its position in the run — alone, top, middle or bottom — exactly as the existing bush/tree derives its size role. An author MUST NOT have to choose a role per cell.

- **FR-003**: The four art roles MUST map to the mushroom tileset as follows: a cell alone in its run shows a complete mushroom (cap, stem and foot); the top cell of a longer run shows the cap with a straight stem connector; a middle cell shows a plain straight stem; the bottom cell shows a stem with a foot. Only the red variant of the art is used by this feature.

- **FR-004**: A bouncy mushroom MUST NOT be solid in the ordinary sense. The character MUST pass through it while walking horizontally and while rising from below, and it MUST never block movement from the side or from underneath.

- **FR-005**: Only the top cell of a bouncy mushroom run — the cap, whether the run is one cell or many — MUST be standable from above. Stem cells MUST NOT be standable under any circumstance. Whether a given cap is standable at all is conditional and is defined in FR-006; what counts as "landing on" a standable cap is defined in FR-007.

- **FR-006**: A cap MUST be standable from above only when the cell directly above it is not solid. When solid terrain lies directly above the cap, the character can never get above the cap, so the cap MUST NOT be standable there and MUST behave as ordinary pass-through terrain for landing. A cell above the level's top edge counts as open space, exactly as `tileAt` already treats an out-of-bounds read as `empty`.

- **FR-007**: A downward landing on a cap MUST launch the character upward with a fixed impulse, every single time, regardless of fall speed, fall height or how the character arrived. The launch MUST be its own dedicated impulse, distinctly stronger than the character's normal jump — high enough that bouncing is a genuine traversal gain over standing on the cap and jumping off it, yet still a controlled arc rather than an extreme launch. At the game's current gravity it MUST clear roughly five and a half tiles. It MUST NOT scale with fall speed, and it MUST NOT be reduced by whether the character is holding the jump control: its full height is delivered every time.

  **"Landing on a cap" means the character's centre column is over that cap's cell.** A contact in which only a non-centre part of the hitbox overlaps the cap — including a landing on the exact seam whose centre column lies over the neighbouring tile — rests on the cap's corner without bouncing. This is the single-column rule `playerOnMushroomCap` implements (contracts/mushroom-bounce.md), and it is what stops a sliver of the hitbox on an adjacent cap from firing a bounce while the character is really standing on neighbouring solid ground.

- **FR-008**: Only a downward landing on a cap MUST bounce. Contact from the side, contact from below, and contact with any stem cell MUST NOT bounce, and MUST NOT interrupt the character's movement.

- **FR-009**: Bounces MUST NOT stack additively. A mushroom landing and a block bounce — a destroyed pot — that resolve in the same instant MUST produce a single upward impulse: the stronger of the two, never their sum. This reuses the existing `strongerBounce` "most negative wins" rule already shared by the block-bounce aggregation. An enemy stomp cannot share that instant: the stomp impulse is applied before the physics step, so the character is already rising when the ground scan runs and can never also register a cap landing (see research.md D6).

- **FR-010**: Every mushroom bounce MUST play a short visual squash: the cap dips a small number of pixels and returns over roughly a tenth of a second. The cap MUST be drawn separately from the stem so the cap can move while the stem stays put. This MUST reuse the existing art — no new sprite frames are introduced.

- **FR-011**: The squash MUST be purely cosmetic. It MUST NOT change collision, standability or bounce strength, and a landing on a cap that is already mid-squash MUST bounce normally wherever the cap is standable under FR-006.

- **FR-012**: A bouncy mushroom MUST never be destroyed, consumed, exhausted or otherwise changed by any interaction, and MUST never award a fact, a pickup or a counter. It MUST be present in the same state after a death and respawn and after Reset Game.

- **FR-013**: The small decorative mushroom MUST be a single non-solid tile. It MUST never block movement, never be standable, never bounce, and have no effect on gameplay whatsoever. It is dressing only.

- **FR-014**: Enemies MUST treat both mushroom kinds as non-solid and pass through them. Enemies are never bounced by a mushroom and never land on a cap.

- **FR-015**: A bouncy mushroom's art role MUST be a pure function of its own position within its vertical run — no stored per-cell role, no randomness — mirroring the bush/tree. The only mutable state this feature introduces MUST be the transient cap-squash timer; its cosmetic-only nature and its clearing on respawn are specified in FR-011 and are not restated here.

- **FR-016**: The standable surface of a cap MUST match the art the player sees, and a stem, whose art does not fill its cell, MUST present no collision at all, so the character is never caught by an invisible wall or an invisible floor.

- **FR-017**: Both mushroom kinds MUST be paintable from the level editor's palette with a readable name, a description and a preview showing their real art, and MUST round-trip through level save and load exactly like any other terrain character.

- **FR-018**: The two new characters MUST be added to the terrain-character map, the legal-character union and the editor palette, and MUST NOT collide with any existing terrain, entity, sign or hazard character, so the existing import-time character-overlap guard still passes.

### Open Requirements

**Terrain kinds do not yet own their own rules.** As recorded in [F-018](../F-018-platformer-blocks/spec.md), terrain has no registry of kinds, and no tile kind owns anything about itself: solidity, climbability, the one-way rules for a bridge and for a ladder shaft's standable top rung, and the tile's drawing are spread across shared predicates and scattered comparisons in physics and rendering. The mushroom adds another one-way, part-standable kind, which makes that gap a little more expensive. This feature MAY either special-case the mushroom in the existing predicates the way the bridge and ladder already are, or be the first kind placed in a new terrain-kind registry; the choice is left to the plan. The behavior in this specification MUST hold either way.

### Key Entities

- **Bouncy mushroom run**: A vertical stack of one terrain kind. Its cells are classified automatically into the roles alone / top / middle / bottom from their neighbours, and those roles choose the cap, connector, stem and foot art. Only the top cell — the cap — is standable and bouncy, and only when the cell directly above it is not solid (FR-006); every other cell is pass-through.

- **Mushroom cap squash**: The transient visual state of a single cap that has just bounced: which cap, and how long ago. It drives the brief dip of the cap art and nothing else — it never affects collision, standability or bounce strength, and it is cleared on respawn.

- **Decorative mushroom**: A single, non-solid dressing tile with no behavior of any kind.

## Success Criteria _(mandatory)_

- **SC-001 — Landing always bounces**: From any fall speed and any fall height, a landing on a red mushroom cap launches the character upward by the same fixed amount — higher than the character can jump on its own — every time, and the mushroom is unchanged afterward. Verified by unit tests over the bounce physics plus a browser check.

- **SC-002 — The mushroom is never an obstacle**: Walking into it horizontally and jumping into it from below both pass through, and the character is never stopped or bounced by anything except a downward landing on the cap. Verified by unit test and browser check.

- **SC-003 — A run reads as one mushroom at any height**: A one-cell mushroom and a run of several cells each render as a single coherent mushroom — cap on top, straight stem, foot at the bottom — and only the top cap is landable. Verified by a renderer test plus a browser check.

- **SC-004 — Every bounce reads**: Each bounce visibly dips the cap and returns it within roughly a tenth of a second, using the existing art. Verified by browser check.

- **SC-005 — The decorative mushroom never affects play**: A small mushroom never stops, catches or bounces the character and never changes any game state. Verified by unit test and browser check.

- **SC-006 — Both mushrooms are authorable**: Both kinds appear in the editor palette with correct previews, can be painted including as vertical runs, and survive a save and reload. Verified by a component test of the palette plus a browser check.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) is complete**: the Platformer theme's game loop, physics, one-way terrain handling, level marker format and editor all exist. This feature adds terrain kinds to that world; it does not create it.

- **The mushroom is a terrain kind, not an entity or a block.** It reuses the game's existing one-way ground pattern — the same family as the bridge, a ladder shaft's standable top rung, and the rope-ladder bundle — rather than the fully solid model blocks and ordinary terrain use. It is not hit from below and it does not carry a block or entity outcome.

- **The "terrain kinds do not own their own rules" gap is unresolved.** This feature may special-case the mushroom in the existing predicates or introduce a terrain-kind registry; the plan decides. The specification is written so either choice satisfies it.

- **Enemies pass through mushrooms.** As decided, a mushroom is non-solid to enemies as well as the player, so a mushroom cannot pen, support or bounce a patrol. If enemies standing on caps is wanted later, that is a separate change.

- **Only the red art variant is in scope.** The sheet's orange, purple and green mushroom variants, and the small-mushroom color variants, remain unused by this feature.

- **Bounce strength is a dedicated super-jump.** The launch is its own named impulse, deliberately distinct from the pot bounce, set so a mushroom clears roughly five and a half tiles — about 1.6x a normal jump's peak height — so bouncing is always worth more than jumping off the cap. In code terms the chosen impulse is `-650` px/s at the game's gravity of `1200`, applied like the stomp and pot bounces (protected from the variable-jump-height cut). Retuning it is a game-feel change, not a requirement change.

- **The dip distance and duration are game feel.** The roughly-two-pixel dip and roughly-a-tenth-of-a-second return are tunable; the requirement is only that a bounce produces a brief, visible squash using existing art.

- **Level save/load and the editor palette already support adding a terrain character.** The two new characters slot into the existing terrain-character map, legal-character union, palette previews and save format; no new storage format is needed.

- **Proposed level characters**: the bouncy mushroom and the decorative mushroom each take one currently unused terrain character (for example `§` and `s`); the plan confirms the exact glyphs against the existing character maps.

## Out of Scope

- **Mushroom color variants other than red** — the orange, purple and green caps and the small-mushroom color variants are not placed by this feature.

- **Climbable mushrooms** — the stem is pass-through, not a ladder or chain; the character never climbs a mushroom.

- **Destructible mushrooms** — a mushroom never breaks, is never consumed, and is never hit from below or by a blast.

- **Bouncing off a mushroom's sides, underside or stem** — only a downward landing on the cap bounces.

- **CV rewards, journal entries and HUD counters** — a mushroom reveals no fact and tracks nothing.

- **Enemies interacting with mushrooms** — enemies pass through and are never bounced; enemies standing on caps are out of scope.

- **Moving mushrooms** — no mushroom moves, falls, rises, pushes or is pushed.

- **Mushroom placement in the shipped level** — which specific mushrooms appear in the game's own level is level design, not this feature; this feature only makes the kinds available.
