# Feature Specification: Platformer Crumbling Floor Blocks

**Feature Branch**: `O-023-platformer-crumbling-floor`
**Created**: 2026-09-22
**Status**: Implemented
**Input**: [Issue #69](https://github.com/garcipat/cv-website/issues/69) — ground that gives way underfoot: it
cracks and shakes while the character stands on it, breaks apart and drops them through, then reforms after
a while.

## Clarifications

### Session 2026-09-22

- Q: What happens while the character stands on the tile, before it gives way? → A: **It cracks and
  shakes.** The tile shows a visible crack progression (light → heavy) plus a shake, and stays fully solid
  the entire time — the crack stages are a pure visual tell, exactly like Floor Spikes' warning phase,
  with no functional change until the tile actually breaks.
- Q: What does breaking look like? → A: **It splits into 4 pieces that fall away**, leaving a non-solid
  gap. This is a distinct visual from the crate's fade-out puff — the floor gives way rather than being
  destroyed by an attack.
- Q: Is falling through the gap itself a source of damage? → A: **No.** The gap is just an opening; any
  danger comes from whatever is below it (a pit, a hazard), not from the crumbling floor itself.
- Q: What brings a broken tile back? → A: **A fixed delay, regardless of the character's position** —
  the tile reforms on its own timeline, the same "auto re-arm" shape Floor Spikes already uses. It
  reappears by growing from a small centered square up to its full size, then re-arms.
- Q: Is this a new terrain tile, or a behavior layered onto existing ground? → A: **A new, dedicated
  terrain tile kind**, hand-painted by a level author wherever they want unstable ground — ordinary
  ground tiles are untouched, matching how Bouncy Mushroom Blocks and Floor Spikes were each added as
  their own tile kind rather than a flag on `groundGrass`/`groundRock`.
- Q: What does the tile look like? → A: **Its silhouette itself is the tell.** Rather than reusing a
  full-height ground block, it renders as a half-height ledge — shape alone marks it as different from
  solid ground before a visitor ever sees a crack. The crack progression is a separate overlay drawn on
  top, kept apart from the base ledge art so it isn't tied to one ground color.
- Q: The art is drawn shorter than a normal tile — where does the character actually stand, and what
  happens approaching from below? → A: **The ledge art sits at the top of its cell, and its solid
  region matches that art's height exactly.** Standing on it from above is identical to standing on any
  ordinary ground tile — same top line, same footing. But because only the top half of the cell is
  solid, the bottom half is open space: something rising into a crumbling floor tile from directly below
  meets solid ground sooner (after less clearance) than it would under a full-height tile.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Ground Gives Way Underfoot (Priority: P1)

A visitor's character steps onto a patch of ground that reads as a short, half-height ledge rather than
full solid ground — already a visual hint that it isn't ordinary terrain. The moment the character's
weight is on it, the ledge starts to crack: a light crack appears, then spreads heavier, and the tile
shakes. A visitor who steps off in time keeps standing on solid, if cracked, ground the whole time — the
cracking is a warning, not a hazard. A visitor who lingers feels the ledge give way: it splits apart into
pieces that fall away, and the character drops through the gap left behind. The fall itself does nothing
to the character — whatever happens next depends on what is beneath the gap.

**Why this priority**: The crumble-underfoot loop — stand, crack, shake, give way — is the entire feature.
Without it there is no unstable ground, just a differently-shaped platform.

**Independent Test**: Place a crumbling floor tile, walk the character onto it and immediately off before
it breaks — verify it never becomes non-solid and shows only the crack progression. Place another, stand
on it until it gives way — verify the tile becomes non-solid, the character falls through, and no damage
is taken from the fall itself.

**Acceptance Scenarios**:

1. **Given** a crumbling floor tile at rest, **When** no contact has occurred, **Then** it renders as an
   intact half-height ledge with no cracks, and is solid ground.
2. **Given** a crumbling floor tile, **When** the character's hitbox first overlaps it, **Then** the
   tile's break cycle begins: light cracking, then heavier cracking, with a shake, while remaining fully
   solid throughout.
3. **Given** a crumbling floor tile mid-crack, **When** the character steps off it before the cycle
   reaches its break point, **Then** the tile stays exactly where its cycle left it (still solid, still
   cracked) rather than resetting — the cycle, once started, runs to its conclusion regardless of further
   contact, matching Floor Spikes' rule.
4. **Given** a crumbling floor tile's cycle reaching its end, **When** it breaks, **Then** it splits into
   pieces that fall away, the tile becomes non-solid, and a character still overlapping it falls through.
5. **Given** a character falling through a just-broken tile's gap, **When** the fall happens, **Then** it
   deals no damage of its own — any damage comes only from whatever the character encounters below.

---

### User Story 2 - The Floor Reforms (Priority: P2)

Sometime after a section of floor gives way, a visitor sees the gap start to fill back in: a small patch
appears at the center of the gap and grows outward until it once again fills the space as the same
half-height ledge it was before. Once fully reformed it behaves exactly as it did the first time — solid,
crackable, breakable again.

**Why this priority**: Without reforming, a crumbling floor tile is a one-time trap rather than a
repeatable piece of level design, and any level built around it would eventually run out of usable
ground.

**Independent Test**: Break a crumbling floor tile, wait, and verify it reforms after a fixed delay
regardless of where the character currently is, growing visibly from small to full size. Step onto the
reformed tile and verify it cracks, shakes and breaks exactly as before.

**Acceptance Scenarios**:

1. **Given** a broken crumbling floor tile, **When** its fixed reform delay elapses, **Then** it begins
   reappearing, growing from a small centered square up to its full half-height ledge size.
2. **Given** a crumbling floor tile reforming, **When** it has not yet finished growing, **Then** it is
   not solid — a character cannot stand on or be stopped by a partially-reformed tile.
3. **Given** a crumbling floor tile that has finished reforming, **When** the character stands on it,
   **Then** it is solid again and its break cycle can be triggered exactly as it could the first time.
4. **Given** the character's position when a tile reforms, **When** the reform timer elapses, **Then**
   the tile reforms regardless of where the character is — reforming does not wait for the character to
   be elsewhere.

---

### User Story 3 - Crumbling Floor Is Authorable from the Editor (Priority: P3)

A level author opens the level editor and finds the crumbling floor tile in the terrain palette, with a
readable name and a preview of its at-rest art. They paint it onto the grid like any other terrain tile,
save, and see the same crack-and-reform behavior when the level is played.

**Why this priority**: The tile is unusable in level design without a palette entry, but this is the
authoring surface for the behavior above, not new player-facing behavior of its own.

**Independent Test**: Open the editor, select the crumbling floor tile from the palette, paint it, save,
reload, and verify it persists and behaves correctly when played.

**Acceptance Scenarios**:

1. **Given** the editor's terrain palette, **When** the author looks for the crumbling floor tile,
   **Then** it is present with a name, a description, and a preview showing its at-rest art.
2. **Given** a crumbling floor tile placed from the palette, **When** the level is saved and reloaded,
   **Then** the placement and its behavior are unchanged.

---

### Edge Cases

- **Standing on the tile through its whole crack cycle**: the character is never harmed by the cracking
  or shaking itself — only the moment of breaking causes a fall, and only once.
- **Leaving and returning after the cycle has started**: per User Story 1's Acceptance Scenario 3, a
  cycle already running cannot be restarted, extended or interrupted by more contact.
- **Two crumbling floor tiles triggered close together**: each tile's cycle is independent; one tile's
  phase never affects another's.
- **A broken tile's reform timer with the character standing where it will reappear**: since reforming
  starts from the gap's floor and only becomes solid once fully grown (User Story 2's Acceptance
  Scenario 2), a character standing in the gap is not pushed out or trapped — it simply becomes solid
  ground under them once the growth finishes, same as walking onto any newly-solid tile.
- **A crumbling floor tile mid-cycle at level reset or respawn**: Reset Game and a death/respawn return
  every crumbling floor tile to its at-rest, solid phase, exactly as Floor Spikes and the mushroom cap
  squash already reset on those events.
- **A crumbling floor tile with nothing beneath it but a pit**: unchanged from any other gap in the
  floor — a pit fall behaves exactly as it already does per [F-016](../F-016-platformer-health/spec.md).
- **Approaching a crumbling floor tile from directly below**: since its solid region only fills the top
  half of its cell, something rising into it from an open cell underneath meets solid ground after less
  vertical clearance than it would under a full-height tile — it does not get to rise into the tile's
  own lower (open) half first.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The game MUST add a crumbling floor tile as a new terrain kind, distinct from ordinary
  ground, placeable by its own level character and available in the level editor's terrain palette.
- **FR-002**: A crumbling floor tile MUST start at rest, rendered as an intact half-height ledge aligned
  to the top of its cell, and MUST be solid ground while at rest. Standing on it from above MUST behave
  identically to standing on a full-height solid tile — same top line, same footing. Its solid region
  MUST match the rendered ledge's height (the top half of the cell only), so the bottom half of the cell
  is open space, not solid.
- **FR-003**: The character's hitbox overlapping an at-rest crumbling floor tile MUST start that tile's
  break cycle exactly once.
- **FR-004**: During its break cycle, a crumbling floor tile MUST show a progressive crack visual (from
  light cracking to heavy cracking) together with a shake, and MUST remain solid for the entire cycle
  until the moment it breaks.
- **FR-005**: At the end of its break cycle, a crumbling floor tile MUST break apart into visible pieces
  that fall away and MUST become non-solid at that same moment.
- **FR-006**: A character overlapping a crumbling floor tile at the moment it breaks MUST fall through
  the resulting gap. This fall MUST NOT itself deal damage; any damage comes only from separate causes
  below the gap.
- **FR-007**: Once a crumbling floor tile's break cycle has started, it MUST run to completion — through
  every crack stage to the break — on its own fixed timeline. Further contact with the tile while its
  cycle is already running MUST NOT restart, extend, skip or otherwise alter that timeline.
- **FR-008**: A broken crumbling floor tile MUST begin reforming after a fixed delay, independent of the
  character's current position.
- **FR-009**: Reforming MUST be shown as the tile growing from a small centered square up to its full
  half-height-ledge size, and the tile MUST remain non-solid for the entire reform animation.
- **FR-010**: A crumbling floor tile MUST become solid again, and its break cycle re-triggerable, only
  once reforming has fully completed.
- **FR-011**: A crumbling floor tile MUST have no stomp outcome and no reward — it is never defeated,
  consumed or altered by any interaction other than its own break/reform cycle, and drops or reveals
  nothing.
- **FR-012**: A crumbling floor tile MUST be placeable in the floor orientation only.
- **FR-013**: Every crumbling floor tile's cycle state MUST reset to at-rest (solid, uncracked) on
  death/respawn and on Reset Game, matching the transient-state reset already used for Floor Spikes and
  the mushroom cap squash.
- **FR-014**: A level author MUST be able to place a crumbling floor tile from the editor's terrain
  palette, with a name, a description and a preview of its at-rest art, and it MUST round-trip through
  level save and load unchanged.

### Key Entities

- **Crumbling floor tile**: a terrain kind whose solidity changes over time instead of being permanent.
  It has a position and a cycle phase (at rest, cracking, broken, reforming), where at-rest and fully
  reformed are solid, cracking is solid, and broken/reforming are not. It carries no health, no reward,
  and no lifecycle beyond its own repeating break/reform cycle.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Leaving in time is safe**: a character that steps off a crumbling floor tile before its
  break cycle completes is never made to fall, regardless of how far the crack progression had reached.
  Verified by automated tests.
- **SC-002 — Lingering breaks the floor**: a character that remains on a crumbling floor tile through its
  full break cycle falls through the resulting gap, with no damage from the fall itself. Verified by
  automated tests.
- **SC-003 — The tile is repeatable**: after a tile breaks and fully reforms, triggering it again
  reproduces the same cycle, with the same timing and outcomes, an unlimited number of times. Verified by
  automated tests.
- **SC-004 — Mid-cycle contact does not alter the timeline**: repeated contact during an in-progress
  break cycle produces the exact same phase durations and outcome as a single contact would. Verified by
  automated tests.
- **SC-005 — Solidity matches phase exactly**: a character's collision against a crumbling floor tile is
  solid during at-rest and cracking, and non-solid during broken and reforming, with no partial or
  in-between collision state at any point. Verified by automated tests.
- **SC-006 — Authorable**: the crumbling floor tile appears in the editor's terrain palette with a
  correct preview, can be painted, and survives a save and reload. Verified by a component test of the
  palette plus a browser check.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) (2D Platformer Theme) is complete**: the game loop,
  terrain rendering, physics and level format this feature adds a tile kind to already exist.
- **One color variant for now**: the crumbling floor tile uses a single ledge color matching the level's
  existing ground palette. Additional color variants are not part of this feature (see Out of Scope).
- **Exact timings are game feel**: the crack cycle's phase durations and the reform delay are tunable
  during implementation; the requirement is only that cracking is visibly progressive, solid throughout,
  and that the cycle and reform are each fixed and repeatable.
- **Crumbling floor tiles are hand-placed**, exactly like Floor Spikes and Bouncy Mushroom Blocks: a
  crumbling floor tile exists only where a level author placed it.
- **The falling debris pieces are decorative**: they are a visual accompaniment to the break, not
  objects with their own collision, damage or persistence.

## Out of Scope

- Additional ledge color variants beyond the one matching the current level's ground palette.
- Any damage dealt by the act of falling through a broken tile — falling remains only as dangerous as
  whatever is beneath it.
- Ceiling- or wall-mounted crumbling terrain — this feature is floor-only.
- Collision, damage, or any gameplay effect from the falling debris pieces.
- A trigger condition other than direct character contact (e.g. a delay-only auto-crumble, a switch, an
  enemy).
- A reset mechanism other than the tile's own automatic break-and-reform timeline (e.g. a level-author-
  controlled reset).
- Stacking crumbling floor tiles into a taller vertical run (unlike Bouncy Mushroom Blocks' column
  authoring) — each tile is a single, independent cell.
- Sound or screen effects beyond the shared hit/fall reaction — see [O-008](../O-008-platformer-audio/spec.md).
