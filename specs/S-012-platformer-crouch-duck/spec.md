# Feature Specification: Platformer Crouch/Duck

**Feature Branch**: `S-012-platformer-crouch-duck`
**Created**: 2026-09-23
**Status**: Draft
**Input**: The platformer has no crouch: the character is always at full height, so a corridor only one tile high cannot be entered, and there is no way to duck. Add a hold-Down crouch — the collision box shrinks to one tile, the character crawls slowly, jumping is disabled, and standing back up needs the full standing height clear. Down keeps its existing ladder-descent and bridge-drop meanings first.

## Clarifications

### Session 2026-09-23

- Q: FR-005/SC-002 say stand only with "a full tile of headroom", but the standing hitbox is taller than one tile. What exactly gates standing up? → A: The character's full standing collision box must fit in clear space with no solid overlap; a one-tile gap is not enough on its own.
- Q: FR-008 says crawling alternates two ROLL frames, but what does the stationary crouch show? → A: Superseded by the art decision below — the crouch uses a dedicated four-frame duck row; all four frames loop while crawling and the pose is held still while stationary.
- Q: FR-008 originally reused the unused ROLL row, but in-browser that pose read as standing/ball-like and bobbed. What art should the crouch use? → A: A dedicated four-frame duck row drawn low and horizontal (head/torso at a constant height), appended to the knight sheet; all four loop while crawling, held still while stationary.
- Q: FR-003/SC-006 require crawling to be slower than walking (200 px/s) but set no target. What speed should crawling aim for? → A: About 120 px/s (~60% of walk speed), the same deliberate pace as climbing.
- Q: FR-015 teaches crouch via the legend "when it fits", else a sign. How should that fallback be decided? → A: Add the Down/crouch caption to the upfront legend; a corridor signpost is used only if the caption genuinely cannot be placed without crowding the legend.
- Q: While crouched, should a hit knock the character back and flash red? → A: A crouched hit still deals damage, opens the invulnerability window and shows the red reaction, but applies no knockback — the character stays put.
- Q: Should the crouched red reaction need dedicated red-tinted crouch art? → A: No — tint the crouch pose at render time with a reusable mechanism, so no new sprite frames are authored; the standing hit's existing red frame is left unchanged.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Duck and Crawl Under a Low Ceiling (Priority: P1)

The visitor walks the character up to a corridor only one tile high — too short to enter. Holding Down while standing on solid ground drops the character into a crouch: its collision box shrinks to a single tile, so it fits into the gap, and it can crawl through at a slower pace. Releasing Down stands the character back up.

**Why this priority**: Passing under low ceilings is the entire reason the feature exists; without it the mechanic has no purpose.

**Independent Test**: Stand on plain ground, hold Down, and verify the character is visibly lower and its collision box is one tile tall; crawl through a one-tile-high corridor to the far side; release Down and verify it stands back up at full height.

**Acceptance Scenarios**:

1. **Given** the character is standing on solid ground that is neither a ladder nor a one-way bridge, **When** the visitor holds Down, **Then** the character crouches — it renders in a visibly lower pose and its collision box is one tile tall.
2. **Given** the character is crouched under a one-tile-high corridor, **When** the visitor holds a horizontal direction, **Then** it crawls through and emerges on the other side.
3. **Given** the character is crouched, **When** the visitor presses Jump, **Then** no jump occurs.
4. **Given** the character is crouched with clear headroom above, **When** the visitor releases Down, **Then** it stands up and returns to its normal height, speed and jump ability.

---

### User Story 2 - Refuse to Stand Up Into a Ceiling (Priority: P1)

The visitor crawls into a low corridor and releases Down while still underneath solid terrain. The character must not pop up through the ceiling. It stays crouched until it has crawled far enough that its full standing height fits in clear space above it, at which point it stands automatically.

**Why this priority**: Without this rule the character would grow into solid terrain, breaking collision and letting it clip through the level.

**Independent Test**: Crawl into a one-tile-high corridor, release Down mid-corridor — the character stays low. Keep holding a direction until the ceiling ends — the character stands by itself the moment the corridor opens out.

**Acceptance Scenarios**:

1. **Given** the character is crouched directly beneath a solid tile, **When** Down is released, **Then** it stays crouched and does not rise.
2. **Given** the character is crouched under a ceiling and Down is not held, **When** it crawls clear of the ceiling, **Then** it stands up automatically on the frame its full standing box fits in clear space above it.
3. **Given** the character is crouched beneath a ceiling, **When** Down is released and pressed again, **Then** it remains crouched throughout, with no visible pop or height flicker.
4. **Given** the character stands up, **When** the transition happens, **Then** its box never overlaps a solid tile at any point.

---

### User Story 3 - Down Still Climbs and Drops (Priority: P1)

Down already means "climb down" on a ladder and "drop through" on a one-way bridge. Crouching must never steal those meanings. On a ladder, Down descends; standing on a bridge, Down drops through; only where neither applies does Down crouch.

**Why this priority**: Getting this priority wrong regresses two shipped traversal mechanics (ladders and bridge drop-through) and could trap a visitor on a ladder.

**Independent Test**: On a ladder, hold Down — the character climbs down rather than crouching. On a bridge tile, hold Down — the character drops through rather than crouching. On plain ground, hold Down — the character crouches.

**Acceptance Scenarios**:

1. **Given** the character is airborne overlapping a climbable tile, or grounded with a climbable tile directly below its feet, **When** Down is held, **Then** it climbs down exactly as it does today, and never crouches.
2. **Given** the character is grounded with its body overlapping a ladder tile but solid ground (not a ladder) directly below its feet, **When** Down is held, **Then** it crouches rather than climbing — a ladder base or a ladder merely crawled past does not grab Down.
3. **Given** the character is standing on a one-way bridge tile, **When** Down is held, **Then** it drops through exactly as it does today, and never crouches.
4. **Given** the character is on solid ground that is neither climbable nor a bridge, **When** Down is held, **Then** it crouches.
5. **Given** the character is crouched and crawls onto a bridge tile while Down is still held, **Then** it keeps crouching and crawls across the bridge; it drops through only after Down is released (standing) and pressed again.

---

### User Story 4 - The Crouch Reads at a Glance (Priority: P2)

The visitor can tell from the sprite alone that the character is crouched rather than standing or walking, and while it crawls the pose animates so the movement reads as a crawl rather than a slide.

**Why this priority**: A crouch that is not visually distinct is indistinguishable from a bug — the character would appear to walk through terrain. It is P2 because the mechanic is still playable if the pose is only roughly right.

**Independent Test**: Compare the crouched sprite with the idle and walking sprites; crawl and verify the pose changes as it moves.

**Acceptance Scenarios**:

1. **Given** the character is crouched and stationary, **When** it is drawn, **Then** it uses a pose clearly lower and distinct from its idle and walking poses.
2. **Given** the character is crouched and crawling, **When** it is drawn, **Then** the pose animates rather than showing a single static frame.
3. **Given** the character crouches and then stands, **When** it transitions, **Then** the crouched pose is replaced cleanly by the standing pose with no overlap between the two.

---

### Edge Cases

- **Crouch while airborne**: entering a crouch requires the character to be grounded. If it walks off a ledge while holding Down, it keeps the crouched pose for the fall and lands still crouched; releasing Down in mid-air stands it up before it lands.
- **Crouch on a ladder's top rung**: Down there re-enters the climb (existing S-008 rule) rather than crouching, because a ladder tile sits directly below the feet. A ladder merely overlapped at the feet with solid ground below does not claim Down — see FR-009.
- **Crouch while the game is paused or an overlay is open**: the existing pause rules apply unchanged; the character holds its crouch and resumes crouched when play resumes.
- **Taking a hit while crouched**: the damage and invulnerability window are unchanged and the red hit reaction still plays, but no knockback is applied — the character stays where it is. The one-tile collision box is kept for the whole reaction, so a hit under a ceiling can never force the character to stand into it.
- **Respawn, checkpoint restore or reset while crouched**: the character returns standing at full height — crouch is never persisted.
- **The space above becomes occupied while crouched**: the headroom test is re-evaluated every frame, so the character stands only once the full standing box genuinely fits in clear space.
- **Crouching with a ceiling that is exactly one tile above the ground**: the crouched box fits with no margin; the character can still crawl. Because its standing box is taller than one tile, it stands only once the ceiling has fully cleared, not merely when a one-tile gap opens.
- **Holding Down and Left/Right together**: the character crawls in that direction; holding Down alone crouches in place.
- **The upfront legend has no room for a Down/crouch caption**: the hint falls back to a signpost placed beside the low corridor, read through the existing sign mechanism; the two placements are alternatives, never both.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The character MUST crouch while it is grounded and Down is held, except where Down has a context-specific meaning — a climbable tile with a ladder below to descend into (descend), or a one-way bridge (drop through) — which MUST take priority over crouching. While the character is already crouched, Down keeps meaning crouch: it does not descend a ladder or drop through a bridge until Down is released (FR-009).
- **FR-002**: While crouched, the character's collision box and its interaction hitbox MUST both shrink to one tile tall — shorter than the standing box, with the feet staying on the same ground line. The reduced height MUST apply everywhere the player's box is used: terrain collision, trigger and pickup overlap, enemy and hazard contact, stomp detection, and blast checks. Every consumer of the player's box MUST see the crouched height; none may keep using the standing height.
- **FR-003**: While crouched, horizontal movement MUST be slower than the normal walk speed and MUST work in both directions. The target crawling speed is roughly 120 px/s — about 60% of the walk speed, matching the deliberate pace of climbing.
- **FR-004**: While crouched, the character MUST NOT be able to jump.
- **FR-005**: Releasing Down MUST stand the character up only when its full standing collision box fits in clear space with no solid overlap; a gap of only one tile is not sufficient. Otherwise it MUST remain crouched.
- **FR-006**: While crouched under a ceiling and Down is not held, the character MUST stand up automatically on the frame its full standing box fits in clear space above it. If Down is still held, FR-001 keeps it crouched even once headroom opens.
- **FR-007**: Standing up MUST never leave the character's box overlapping a solid tile.
- **FR-008**: The character MUST render in a crouched pose visually distinct from its idle and walking poses, and that pose MUST animate while the character crawls. The crouch MUST use a dedicated four-frame duck row in the knight sprite sheet — drawn low and horizontal so it reads as a duck/crawl, with the head and torso kept at a constant height so crawling never bobs. All four frames loop while the character crawls in either direction; the pose is held still while stationary. The dedicated row is added to the sheet without altering any frame an existing animation uses.
- **FR-009**: Down MUST continue to descend a climbable tile and drop through a one-way bridge exactly as it does today — those behaviors MUST NOT regress. Which behavior applies when is decided by FR-001's priority. A grounded character whose body merely overlaps a ladder tile with solid ground below it — standing at the ladder's base, or crawling past it — MUST crouch rather than climb: Down descends only when there is a ladder tile below the feet to descend into, or when the character is airborne. Likewise, a character already crouched that crawls onto a bridge MUST keep crouching rather than dropping through; it drops only once Down is released (standing) and pressed again.
- **FR-010**: Entering a crouch MUST require the character to be grounded. Releasing Down while airborne MUST stand the character up before it lands.
- **FR-011**: While crouched, taking damage MUST still deal the damage, open the invulnerability window, and show the red hit reaction, but MUST NOT apply any knockback — horizontal or vertical. The one-tile collision box MUST be kept for the whole reaction, so a hit under a ceiling can never force the character to stand.
- **FR-012**: Crouch MUST be session-scoped: a respawn, checkpoint restore, or game reset MUST return the character to a standing state at full height.
- **FR-013**: Crouch MUST NOT introduce a new terrain tile kind or any level-format change — the low corridor is authored from existing solid terrain. If the FR-015 sign fallback is ever used, it reuses the existing S-009 sign-marker mechanism, which adds one marker character, not a terrain tile.
- **FR-014**: Crouch MUST NOT change any existing mechanic except through the smaller collision box and the suppressed knockback of FR-011 — stomp detection, enemy and hazard contact, and the floor spear's swept contact-from-above test otherwise keep their current rules.
- **FR-015**: Crouch MUST be discoverable where it is first needed. The Down key's crouch meaning MUST be taught by the upfront key legend (the arrow cluster it already pictures); a signpost beside the low corridor is a fallback, used only if the caption genuinely cannot be placed in the legend without crowding it.
- **FR-016**: The red hit reaction while crouched MUST be shown on the crouch pose and MUST NOT require new red-tinted crouch sprite art — it is tinted at render time by a reusable mechanism, so the same tint can be applied to any pose. The standing hit reaction's existing red frame is unchanged.

### Key Entities

- **Crouch state**: the character's grounded, reduced-height mode — active while Down is held and no higher-priority Down context applies, or while its full standing box does not yet fit in clear space. Owns no persistence and no separate resources.
- **Crouched box**: the single reduced one-tile-tall box — both the collision box and the interaction hitbox — that every consumer of the player's box reads while crouched; the standing box is restored only when the character stands.
- **Headroom test**: the per-frame check for whether the character's full standing box fits in clear space above its feet; the single gate on standing up.
- **Down context priority**: the ordering that resolves one Down key into exactly one behavior — climb descent first, bridge drop-through second, crouch otherwise; and, once the character is already crouched, crouch is retained until Down is released (so crawling past a ladder or onto a bridge never pops the crouch).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Low corridors are passable**: a corridor one tile high, impassable to the standing character, is traversable end to end by crouching and crawling.
- **SC-002 — Standing never clips**: from any crouched position, the character stands only when its full standing box fits in clear space and never overlaps solid terrain during the transition — verified by crawling through a long low corridor while releasing and re-pressing Down throughout.
- **SC-003 — No regression to Down**: on every ladder and every bridge tile in the shipped level, Down behaves exactly as it did before this feature — verified by the existing ladder and bridge assertions passing unchanged (their fixtures may gain the new required crouch field, but no behavior changes).
- **SC-004 — Crouch is legible**: side by side, the crouched pose is unmistakably lower than the idle and walk poses, and the crawling pose animates. Verified by a manual browser check.
- **SC-005 — No new level format**: the shipped level gains a low corridor with no new terrain tile kind; if the sign fallback ships, it adds only an S-009 sign marker through the existing mechanism.
- **SC-006 — Crawling is slower than walking**: the crawling speed is measurably lower than the walking speed (about 120 px/s against 200 px/s), so crouch movement reads as effortful.
- **SC-007 — Crouch is taught, not guessed**: a first-time visitor can learn that Down crouches either from the upfront key legend or, where the legend cannot show it, from a signpost at the low corridor — never from neither.
- **SC-008 — One reduced box everywhere**: while crouched, every check that reads the player's box — terrain collision, trigger and pickup overlap, enemy and hazard contact, stomp detection and blast checks — sees the one-tile height; the standing height is never used while crouched.
- **SC-009 — A crouched hit never moves the character**: a hit taken while crouched costs health and shows the red reaction, but the character's position is unchanged and it never stands up; the standing hit reaction is unchanged.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) and [S-008](../S-008-platformer-ladders/spec.md) are complete**: this feature layers a reduced-height grounded mode onto the existing movement, gravity, solid collision, one-way bridge drop-through and ladder-climb rules. It changes none of their timings, speeds or priorities, and only adds crouch as the lowest-priority Down behavior.
- **"One tile" is the design unit**: the character's standing collision box is taller than one tile and its crouched box fits inside one tile; the exact pixel heights are an implementation detail. Because the standing box is taller than one tile, standing requires more than a one-tile gap (FR-005).
- **Crouch is a collision-and-pose change only**: it grants no damage immunity, no protection from enemies, and no new attack or ability — a crouched hit still costs health. Its one behavioral exception is that a hit taken while crouched applies no knockback (FR-011). Any incidental effect of the smaller box on contact detection is acceptable and not separately specified.
- **The character's feet do not move when crouching**: the box shrinks upward from the ground line, so crouching never changes where the character stands.
- **No new input key**: Down/`S` already exists and is bound to bridge drop-through; crouch adds a third meaning to it rather than introducing a new key.
- **Session-scoped**: no crouch state is persisted; a reset or theme switch returns the character to its spawn standing.
- **Crouch art source is settled (FR-008)**: the crouch uses a dedicated four-frame duck row appended to `knight.png` — drawn low and horizontal, head/torso at a constant height, held still while stationary and looping all four frames while crawling. This keeps the project's flat 2D pixel-art rule and leaves every animation that already uses a frame unchanged.

## Out of Scope

- Crouch-specific attacks, slides, dodge rolls or a dash, and any new move built from the sprite sheet's existing "roll" frames.
- Any change to enemy, hazard or stomp behavior to account for a crouched character.
- Crouching in mid-air or while climbing as a distinct sustained state.
- Crouch sound effects — see [O-008](../O-008-platformer-audio/spec.md).
- Crouch-specific HUD, camera, or editor changes.
- New level tiles or level-format changes to express low corridors.
- Momentum or sliding while crouched.
