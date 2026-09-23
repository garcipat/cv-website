# Feature Specification: Platformer Falling Stalactite

**Feature Branch**: `O-027-platformer-falling-stalactite`
**Created**: 2026-09-23
**Status**: Draft
**Input**: [Issue #83](https://github.com/garcipat/cv-website/issues/83) — a ceiling stalactite that
looks exactly like the existing decorative one, vibrates when the player passes under or beside it,
then drops straight down, costing half a heart on contact and shattering on landing.

## Clarifications

### Session 2026-09-23

- Q: After the stalactite shatters, when does it return? → A: **Resets on death/respawn and Reset
  Game**; otherwise it stays gone for the rest of the current attempt. Chosen over a truly one-shot
  session state (inconsistent with Floor Spikes / Crumbling Floor and unfair after respawn) and over
  a self-reforming repeatable trap (a different hazard than the issue describes).
- Q: What stops the fall? → A: **The first landing solid in its column** — anything the player can
  stand on (see the last clarification below) — and it shatters there. If nothing solid lies below, it
  falls off the bottom of the level and despawns.
- Q: What triggers the shake? → A: **The player entering a bounded detection zone below the
  stalactite.** It spans the three columns directly beneath it (its own cell plus the two flanking
  cells) and reaches down to whichever comes first — the first landing solid it would land on, or 10
  tiles. Within each column, a landing solid blocks the zone from continuing below it, so a block
  between the stalactite and the player prevents detection. Chosen over the three full columns at any
  height (a tall room would arm from the floor) and over radius proximity.
- Q: Once armed, does it still fall if the player leaves the detection zone before the shake finishes? → A:
  **Yes — arming is irreversible**; the shake always runs to the drop (the issue's stated assumption).
- Q: Does it affect enemies? → A: **Player-only**, like every other hazard; it never damages, blocks
  or bounces an enemy.
- Q: How much damage, and when? → A: **An ordinary half-heart contact**, gated by the shared
  post-damage invincibility window, no knockback — identical to a spike — and **only while falling**
  (never while hanging or shaking, never after shattering).
- Q: How is the falling one told apart from the decorative one? → A: **The level marker character**
  decides behavior: `⊤` remains the decorative stalactite, `T` is the falling hazard. The art is
  identical, and the hazard is **tinted reddish in the editor only** — both its palette thumbnail and
  its painted cell on the editor grid — so an author can tell the two apart while placing. The tint
  never appears in-game — the first drop stays a surprise.
- Q: What does the landing shatter look like? → A: **The crumbling floor's falling-debris effect**
  (O-023's `CrumbleDebrisEffect`), reusing its four-piece gravity fall but with the stalactite's own
  stone debris art. That effect is currently coupled to the crumbling-floor sprites, so it must be
  **extracted/generalized** (art source parameterized) so both hazards share one implementation.
- Q: The decoration has a "twin" variant (two stalactites in one tile) — do both drop? → A: **No.** A
  hazard tile renders whichever variant the decoration would at that cell (large or twin); when it is
  the twin, exactly one of the two falls — **the left (larger) one on an even column, the right
  (smaller) one on an odd column** — and the other stays hanging. The falling one keeps its own
  half-tile footprint so the drawn sprite and the hitbox match, and the detection zone is
  unchanged.
- Q: What exactly counts as a "solid" the stalactite lands on? → A: **Anything the player can stand
  on** — terrain (solid ground, wall, bridge), blocks/crates/pots, the bouncy-mushroom cap, an intact
  crumbling floor and a standable ladder or rolled ladder-bundle top — while a broken/reforming
  crumbling floor does not stop it. The same standable-cell test clips the detection zone (FR-003), so
  a cell that would stop the fall also stops detection.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Triggering a Falling Stalactite (Priority: P1)

A visitor walks along a low corridor whose ceiling is studded with stalactites. One of them — visually
indistinguishable from the harmless decoration beside it — begins to vibrate as they pass beneath or
beside it. A beat later it breaks free and drops straight down. A visitor who keeps moving clears the
fall line and takes nothing; one caught under it loses half a heart. Wherever it lands it shatters in
a burst of debris and is gone for the rest of the attempt.

**Why this priority**: This is the entire feature — a camouflaged, telegraphed overhead hazard that
rewards reading the shake and moving, distinct from the static, always-visible spike.

**Independent Test**: Place a falling stalactite over open floor, walk the character through its
detection zone without stopping, verify the shake plays, the stalactite falls, shatters on the floor
and disappears. Repeat, but stop directly under it after the shake starts and verify the character
takes exactly one half-heart of damage and is not knocked back.

**Acceptance Scenarios**:

1. **Given** a hanging falling stalactite, **When** the character's hitbox overlaps none of the cells
   in its detection zone, **Then** it hangs motionless and is not hazardous.
2. **Given** a hanging falling stalactite, **When** the character's hitbox first overlaps any cell in
   its detection zone, **Then** it begins to shake in place for a short, fixed telegraph before it
   drops.
3. **Given** a shaking falling stalactite, **When** the character overlaps it, **Then** no damage is
   dealt — it is not hazardous until it is falling.
4. **Given** a falling falling stalactite, **When** the character's hitbox overlaps it, **Then** the
   character takes the same half-heart damage a spike deals, per
   [O-005](../O-005-platformer-hazards/spec.md) and [F-016](../F-016-platformer-health/spec.md), is
   not knocked back, and is protected by the shared invincibility window.
5. **Given** a falling falling stalactite, **When** it reaches the first landing solid in its column,
   **Then** it shatters with a burst of falling debris and despawns, dealing no further damage.
6. **Given** a falling stalactite that has shattered, **When** the character passes through its cell
   or the space below, **Then** nothing is there and no damage occurs.
7. **Given** a falling stalactite whose cell renders the twin art, **When** it is armed and drops,
   **Then** exactly one of the two stalactites falls — the left on an even column, the right on an odd
   column — and the other stays hanging in place, unchanged, for the rest of the attempt.
8. **Given** a hanging falling stalactite whose landing solid is more than 10 tiles below it, **When**
   the character stands more than 10 tiles beneath it, **Then** it is not armed; stepping within 10
   tiles of it arms it.
9. **Given** a hanging falling stalactite with a solid block between it and the character in the
   character's own column, **When** the character stands below that block, **Then** the stalactite is
   not armed.

---

### User Story 2 - The Shake Is the Only Tell (Priority: P2)

A visitor is close enough to see a stalactite react but not standing in its path. The short horizontal
vibration is clearly visible as the sole warning, and the art before and during the shake is otherwise
the same flat pixel stalactite as the decoration around it — so the first encounter is a genuine
surprise, and later encounters are readable.

**Why this priority**: The camouflage is the point of the hazard; the shake is what makes it fair
rather than random. It is secondary to the core trigger/damage loop because the hazard still functions
if a player never learns to read it.

**Independent Test**: Stand just outside the detection zone and watch a triggered stalactite: verify the
only visible change is a small horizontal oscillation, that the art matches a neighbouring decorative
stalactite, and that no tint or other hazard marking is shown in-game.

**Acceptance Scenarios**:

1. **Given** a hanging falling stalactite in-game, **When** it is compared with a decorative
   stalactite at the same cell, **Then** the two render the same variant (both large, or both twin)
   and are visually identical while hanging.
2. **Given** a triggered falling stalactite, **When** it shakes, **Then** the shake is a small
   horizontal offset oscillation of the same art — no new frames, no color change.
3. **Given** a falling stalactite anywhere in its life cycle, **When** it is rendered in-game,
   **Then** it is never tinted; the reddish tint is editor-only (User Story 3).

---

### User Story 3 - Falling Stalactites Are Authorable from the Editor (Priority: P3)

A level author opens the editor's hazard palette and finds a falling-stalactite tile, previewing the
stalactite art with a reddish tint so it is unmistakable against the decorative `⊤` tile. They paint
it onto an empty cell under a ceiling, save, and see the shake-and-drop behavior when the level is
played.

**Why this priority**: The tile is unusable in level design without a distinct palette entry, but this
is the authoring surface for the behavior above, not new player-facing behavior of its own.

**Independent Test**: Open the editor, select the falling stalactite from the hazard palette, verify
its preview is the stalactite art with a reddish tint, paint it under a ceiling, save, reload, and
verify it persists and triggers correctly when played.

**Acceptance Scenarios**:

1. **Given** the editor's hazard palette, **When** the author looks for the falling stalactite,
   **Then** it is present with a name, a description, and a preview of the stalactite art tinted
   reddish — distinct from the untinted decorative tile.
2. **Given** a falling stalactite placed from the palette, **When** the level is saved and reloaded,
   **Then** the placement and its behavior are unchanged.

---

### Edge Cases

- **Player leaves the detection zone after arming**: the shake is not cancelled — the stalactite
  always drops once armed, per the Clarifications.
- **Tall room, no solid within 10 tiles**: the detection zone stops 10 tiles below the stalactite, so
  a player further down does not arm it; the stalactite stays hanging until someone comes within
  reach.
- **Solid block between stalactite and player**: a solid in the player's own column blocks the zone
  below it, so standing under such a block never arms the stalactite — matching the fact that the
  stalactite would shatter on that block and never reach them.
- **Nothing solid below**: a falling stalactite with no landing solid in its column falls off the
  bottom of the level and despawns, damaging nothing after it leaves the play area.
- **The player is directly beneath when it lands**: the falling stalactite is non-solid, so it never
  blocks the player; if their hitbox overlaps it while falling they take a half-heart, and the
  stalactite passes through them and continues to the landing solid below.
- **Contact while shaking**: no damage is dealt in the shake phase, per User Story 1's Acceptance
  Scenario 3.
- **Twin-art tile armed**: only the parity-selected stalactite falls; the other remains a harmless
  decorative stalactite until the attempt resets and never falls on its own.
- **Twin-art fall path**: the falling stalactite occupies only its own half of the tile, so the hazard
  is half a tile wide and aligned to the half that fell; the detection zone is still the full three
  columns, and the empty half never deals damage.
- **Landing on a block, crate, pot or the bouncy-mushroom cap**: any of these counts as a landing solid
  and shatters the stalactite at that cell.
- **Crumbling floor or ladder top beneath it**: an intact crumbling floor or a standable ladder/bundle
  top counts as a landing solid and shatters the stalactite; a broken or reforming crumbling floor does
  not stop it, and it continues to the next standable cell below.
- **Stomp / landing on it from above**: not a special case — the falling stalactite is non-solid, so
  the player cannot stand on it; touching it while falling is an ordinary half-heart contact.
- **Two falling stalactites triggered together**: each has its own independent phase; one never
  affects another's timing.
- **Stacked stalactites in one column** (not a normal design — stalactites hang from a room's ceiling):
  each has its own independent detection zone and phase, both can arm, and they fall through one another
  (both are non-solid), each shattering on the first landing solid below it.
- **Non-solid things in the fall path**: pickups, enemies, other hazards and the hanging half of a twin
  tile are all non-solid, so the stalactite passes straight through them; only a landing solid stops it.
- **Touched immediately after respawn**: the post-respawn invulnerability from
  [F-016](../F-016-platformer-health/spec.md) applies exactly as it does for a spike.
- **Respawn inside a detection zone**: because FR-014 resets the stalactite to hanging and arming is
  immediate on hitbox overlap, a respawn inside the zone arms and drops it at once; the post-respawn
  invulnerability means that drop deals no damage.
- **Landing tick**: on the tick the stalactite reaches its landing solid it is still in the falling
  phase, so an overlapping player takes the contact hit that tick and then it shatters — the shatter
  itself deals no damage.
- **Overlapping damage sources in the same tick**: a falling stalactite's contact combines with any
  other damage source (an enemy, a spike) using the same one-hit-per-tick rule as
  [O-005](../O-005-platformer-hazards/spec.md).
- **Death/respawn or Reset Game mid-cycle**: every falling stalactite returns to its hanging phase,
  exactly as the floor-spike cycle and other transient state are cleared on those events.
- **Marker typo / placement**: placement is unvalidated, like every other hand-placed marker; the
  author is responsible for putting the `T` in an empty cell beneath a ceiling tile.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The game MUST add a falling stalactite as a new hazard kind, distinct from the static
  spike, the floor spear and the floor spike, placeable by its own level character (`T`) and available
  in the level editor's hazard palette.
- **FR-002**: A falling stalactite MUST start in a hanging phase, rendering the same large-or-twin
  variant the decorative stalactite would at that cell and thus visually identical to it, and MUST NOT
  be hazardous while hanging.
- **FR-003**: The character's hitbox overlapping any cell of a hanging falling stalactite's detection
  zone MUST arm it exactly once, beginning a short, fixed shake telegraph. The detection zone spans
  the three columns directly beneath the stalactite (its own cell plus the two flanking cells) and
  reaches down to whichever comes first — the first landing solid in its own column (FR-008), or 10
  tiles. Within each column a landing solid blocks the zone from continuing below it, so the zone
  contains only clear cells.
- **FR-004**: Once armed, a falling stalactite MUST complete its shake and drop regardless of whether
  the character remains in the detection zone.
- **FR-005**: A falling stalactite MUST NOT be hazardous during its shake phase.
- **FR-006**: After the shake telegraph, a falling stalactite MUST fall straight down its own column,
  in place, with no horizontal drift.
- **FR-007**: While falling, a falling stalactite MUST be hazardous: overlapping it deals the same
  half-heart damage a static spike deals (per [O-005](../O-005-platformer-hazards/spec.md) and
  [F-016](../F-016-platformer-health/spec.md)), MUST start the same shared invincibility window, MUST
  be skipped while that window is already active, and MUST NOT knock the character back.
- **FR-008**: A falling stalactite MUST stop at the first cell in its column that the player can stand
  on and shatter there with a burst of falling debris, then despawn. That includes terrain (solid
  ground, wall, bridge), blocks/crates/pots, the bouncy-mushroom cap, an intact crumbling floor, and a
  standable ladder or rolled ladder-bundle top; a broken or reforming crumbling floor does not stop it.
- **FR-009**: If no landing solid (FR-008) lies below a falling stalactite, it MUST fall off the
  bottom of the level and despawn without further damage.
- **FR-010**: A falling stalactite MUST be non-solid at every phase: it never blocks or pushes the
  character, it never shatters against the character, and the terrain beneath decides what the
  character can stand on.
- **FR-011**: A falling stalactite MUST have no stomp outcome and MUST NOT be defeated, altered,
  disabled or consumed by any interaction; it MUST NOT drop or reveal anything.
- **FR-012**: A falling stalactite MUST affect only the player. It MUST never damage, block, bounce or
  otherwise affect any enemy.
- **FR-013**: After shattering, a falling stalactite MUST stay gone for the rest of the current
  attempt, and MUST NOT regenerate on its own.
- **FR-014**: Every falling stalactite MUST reset to its hanging phase on death/respawn and on Reset
  Game, matching the transient-state reset already used for the floor-spike cycle, the mushroom cap
  squash and placed bombs.
- **FR-015**: A falling stalactite MUST be placeable in the ceiling orientation only. Other
  orientations are out of scope for this feature.
- **FR-016**: In-game, a falling stalactite MUST render the same large-or-twin variant the decoration
  would at that cell and be visually identical to it while hanging, and its only tell MUST be the
  shake. It MUST NOT be tinted in-game.
- **FR-017**: A level author MUST be able to place a falling stalactite from the editor's hazard
  palette, with a name, a description and a preview of the stalactite art tinted reddish, and the
  painted cell MUST also render tinted reddish on the editor grid — both distinct from the untinted
  decorative `⊤`. Placement MUST round-trip through level save and load unchanged.
- **FR-018**: The falling stalactite's level marker character MUST be `T`, distinct from the
  decorative stalactite's `⊤`, so the level source unambiguously decides which stalactites fall.
- **FR-019**: When a falling stalactite's cell renders the twin variant, exactly one of the two
  stalactites MUST fall — the left (larger) one on an even column, the right (smaller) one on an odd
  column — and the other MUST remain hanging and harmless for the rest of the attempt. The falling one
  MUST occupy only its own half of the tile for both its sprite and its collision footprint, and the
  detection zone (FR-003) MUST be the same as for the large variant.
- **FR-020**: On landing, a falling stalactite MUST shatter with the crumbling floor's falling-debris
  effect (O-023), reused with the stalactite's own debris art. That effect MUST be extracted from its
  crumbling-floor coupling (art source parameterized) so both hazards share one implementation, and the
  shatter MUST spawn exactly once per fall.
- **FR-021**: In the editor, a falling stalactite MUST be a single-marker, ceiling-only hazard: it MUST
  NOT be swept into the static spike's four-facing cycle, and its palette preview MUST show the large
  stalactite variant.

### Key Entities

- **Falling stalactite**: a hazard kind anchored under a ceiling that looks like decoration until it
  is armed. It has a position and a phase (hanging, shaking, falling, shattered/gone), where only the
  falling phase is hazardous and only the hanging phase is armed-by-contact. It renders the same
  large-or-twin variant the decoration would at that cell; on a twin tile only the parity-selected
  stalactite is the hazard, the other staying purely decorative. It carries no health, no horizontal
  movement, no reward, and no lifecycle beyond its one-shot fall; it returns only when the attempt is
  reset.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Camouflage holds**: while hanging, a falling stalactite is pixel-identical to a
  decorative stalactite, with no tint or marker in-game. Verified by a rendering test comparing the
  two.
- **SC-002 — The tell is fair**: the shake lasts a short, fixed telegraph (default on the order of
  0.4–0.6s) before the drop, giving a moving player time to clear the fall line. Verified by
  automated tests over the fixed duration and player movement speed.
- **SC-003 — Contact hurts exactly as a spike does**: a character overlapping a falling stalactite
  takes one half-heart, is not knocked back, and cannot be damaged again until the shared invincibility
  window ends. Verified by automated tests.
- **SC-004 — Non-hazardous until falling**: overlapping a hanging or shaking stalactite never deals
  damage. Verified by automated tests.
- **SC-005 — Landing is correct**: a falling stalactite shatters at the first cell the player can stand
  on (terrain, block/crate/pot, bouncy-mushroom cap, intact crumbling floor, standable ladder/bundle
  top) and despawns; with none below it despawns off the bottom. Verified by automated tests.
- **SC-006 — Player-only**: no enemy is ever damaged, blocked or bounced by a falling stalactite.
  Verified by automated tests.
- **SC-007 — Reset restores it**: death/respawn and Reset Game return every shattered falling
  stalactite to its hanging phase. Verified by automated tests.
- **SC-008 — Authorable and distinct**: the falling stalactite appears in the editor's hazard palette
  with a reddish-tinted preview and grid cell distinct from the decorative tile, can be painted, and
  survives a save and reload. Verified by a component test of the palette plus a browser check.
- **SC-009 — Twin tiles drop exactly one**: on a cell whose decoration would render the twin variant,
  arming and dropping the hazard detaches exactly one stalactite (left on even columns, right on odd),
  leaves the other hanging, and gives the falling one a half-tile footprint. Verified by automated
  tests.
- **SC-010 — Detection is bounded and sighted**: a player more than 10 tiles below a stalactite, or
  below a solid block in their own column, never arms it, while entering any clear cell of the zone
  does. Verified by automated tests.
- **SC-011 — One shatter implementation**: the landing shatter and the crumbling floor's break share
  the same extracted debris-effect implementation, differing only in art source. Verified by unit tests
  over the shared effect plus a rendering check.

## Assumptions

- **[O-005](../O-005-platformer-hazards/spec.md) (Platformer Spike Hazards) is complete**: the hazard
  concept, the static spike, its damage amount, its collision/invincibility-window rules and its
  non-solid/non-stomp/non-destructible behavior are all defined there. This feature adds a timed,
  camouflage overhead hazard and reuses every one of those shared rules rather than redefining them.
- **[F-016](../F-016-platformer-health/spec.md) (Health, damage & respawn) is complete**: the damage
  unit, the shared invincibility window and the death/respawn behavior are reused unchanged.
- **The exact shake duration and fall speed are game feel**, tunable during implementation; the
  requirement is only that the shake is short, fixed, and that a normally walking character can clear
  the fall line after arming (SC-002).
- **The detection zone spans the three columns directly below the stalactite**, reaching down to
  whichever comes first — the first landing solid it would land on, or 10 tiles — and is clipped per
  column by landing solids; arming is any hitbox overlap of a clear cell in that zone, and is
  irreversible once armed.
- **"Landing solid" means anything the player can stand on** — terrain, blocks, crates, pots, the
  bouncy-mushroom cap, an intact crumbling floor and a standable ladder/bundle top — evaluated against
  its current state (a broken or reforming crumbling floor does not count).
- **Falling stalactites are hand-placed**, exactly like static spikes: one exists only where a level
  author placed its `T` marker. Nothing derives them from CV data or generates them automatically, and
  placement is not validated (the author places it in an empty cell under a ceiling tile).
- **Falling stalactites are visitor-facing level design, not progression**: none contributes to any
  counter, journal section or completion condition.
- **The decorative stalactite art is reused**; the reddish tint exists only in the editor (palette and
  grid) to disambiguate the hazard tile from the decorative tile while authoring.
- **The decoration's existing large/twin variant picker is reused** (position-based, deterministic), so
  a hazard tile is camouflaged exactly like the decoration at its cell. On a twin tile the side that
  falls is chosen by the tile's column parity (even → left/larger, odd → right/smaller).

## Out of Scope

- Ceiling-stalagmite or floor-stalactite analogues, or any orientation other than a ceiling-anchored
  stalactite.
- Any trigger condition other than the character entering the detection zone (e.g. proximity, a
  switch, an enemy, a timer).
- A reset or regeneration mechanism other than the death/respawn and Reset Game reset (e.g.
  self-reforming after a delay, or a level-author-controlled reset).
- Enemy interaction of any kind — damage, blocking or bouncing.
- Any hazard-specific damage amount, health scale, invincibility rule or death behavior — all of these
  belong to [F-016](../F-016-platformer-health/spec.md), reused unchanged.
- Knockback from contact.
- Solid or one-way-collision behavior; a falling stalactite never affects movement at any phase.
- Hazard-specific sound or screen effects beyond the shared hit reaction and the shared landing-debris
  effect (FR-020).
- Color or art variants beyond the single reused stalactite art and the editor-only reddish tint.
