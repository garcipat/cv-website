# Feature Specification: Platformer Floor Spear Hazard

**Feature Branch**: `O-020-floor-spear-hazard`
**Created**: 2026-09-21
**Status**: Draft
**Input**: O-020 Floor Spear Hazard — a new floor-mounted hazard drawn as three unevenly long bloody spear points in a single 32x32 pixel-art tile; falling onto the tips kills the character instantly, while walking through or past the tile at ground level is safe.

A floor spear is a static hazard: a single tile of upward-pointing spear points mounted on the floor. Unlike the spike of [O-005](../O-005-platformer-hazards/spec.md), which costs half a heart on any contact, the spear is **lethal and directional**: only a character descending onto its tips from above dies; a character walking through the tile, standing in it, rising through it, or grazing its side while falling is unharmed. A qualifying tip contact bypasses the heart economy entirely — it sets health straight to zero and hands off to the death and respawn behavior owned by [F-016](../F-016-platformer-health/spec.md).

The hazard family itself — static, indestructible, never moving, never rewarding, non-solid — is defined by [O-005](../O-005-platformer-hazards/spec.md) and reused here. This feature adds a second hazard kind to that family and changes only what makes the spear distinct: its art and its kill-or-nothing, fall-only lethality.

## Clarifications

### Session 2026-09-21

- Q: What exactly counts as a lethal spear contact — contact with the top tips only, or any overlap with the drawn art? → A: Only contact with the spear's top tips from above, while the character is descending, is fatal. Walking, standing, rising, and falling past while grazing only the side or shaft are all harmless — a side clip while descending does not kill.
- Q: How should the floor-only spear appear and behave in the editor? → A: Its own palette entry in the Hazards group (readable name + real-art preview) that places the floor orientation only, separate from the Spike entry, which keeps cycling its four facings; the spear entry never cycles orientation.
- Q: Which level character should the spear use? → A: `¦` (U+00A6, BROKEN BAR), verified unused across the terrain, entity, sign and hazard character maps so the import-time overlap guard passes.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Falling onto the Spears Is Fatal (Priority: P1)

A visitor misjudges a jump and comes down onto a bed of spear points. The character dies at once — no half-heart is shaved off, no knockback, no hit flash — with a burst of blood at the character's feet marking the impalement, and the death animation, transition and respawn from [F-016](../F-016-platformer-health/spec.md) take over exactly as they do for any other death. Coming down onto the spears at full health kills just as surely as coming down onto them at the last half-heart.

**Why this priority**: The instant kill on a fall is the entire feature. Without it the spear is only decoration.

**Independent Test**: Place a spear, drop the character onto its tips from above at full health, and verify immediate death and respawn at the last checkpoint. Repeat at one half-heart and verify an identical outcome.

**Acceptance Scenarios**:

1. **Given** a placed spear, **When** the character falls onto its tips from above, **Then** health drops straight to zero and the death and respawn sequence begins.
2. **Given** a character at full health, **When** it lands on the spear's tips, **Then** it dies — the number of hearts held never changes the outcome.
3. **Given** a character falling onto the spear while still inside a post-damage invulnerability window, **When** contact resolves, **Then** it still dies; the spear ignores every invulnerability window.
4. **Given** a spear landing that kills the character, **When** death resolves, **Then** the existing death animation, transition and respawn from [F-016](../F-016-platformer-health/spec.md) play unchanged and the spear itself is unchanged.
5. **Given** a grounded character standing on solid terrain in the spear's tile, **When** ticks pass, **Then** it takes no damage — a spear only kills a descending character.
6. **Given** a character descending past a spear, **When** its hitbox drifts sideways into the tile and overlaps only the spear's side or shaft, **Then** it takes no damage — only the top tips are lethal.

---

### User Story 2 - Walking Through the Spear Tile Is Safe (Priority: P2)

A visitor runs along the floor and passes straight through a spear tile without harm — the spears do not block the way and do not hurt on contact. The same is true of jumping up through the tile from below. Only a fall onto the tips from above is deadly, which is what makes the spear a falling hazard rather than a wall of spikes.

**Why this priority**: Safe pass-through is what distinguishes the spear from the spike and makes it usable as level design. It is also the part of the idea most in need of being pinned down.

**Independent Test**: Walk the character horizontally through a spear tile at ground level and verify no damage and no blocking; jump up through the tile from below and verify no damage; then drop the character onto the same tile and verify death.

**Acceptance Scenarios**:

1. **Given** a spear, **When** a grounded character walks horizontally through its tile, **Then** no damage is taken and the character is not stopped or deflected.
2. **Given** a spear, **When** a character rising through its tile from below overlaps the spear art, **Then** no damage is taken.
3. **Given** a spear, **When** a character stands still on solid terrain inside its tile, **Then** it never takes damage from the spear, no matter how long it stays.
4. **Given** a character descending into the spear's tile, **When** its hitbox first overlaps the top tips from above, **Then** it dies immediately.
5. **Given** a character whose hitbox only touches the transparent part of the spear's tile while descending, **When** the tick resolves, **Then** no damage is taken.

---

### User Story 3 - The Spears Read as Deadly (Priority: P3)

A level author places a spear and a visitor immediately reads it as a trap: three spear points of unequal length filling the tile, sharp and bloodied at the tips. There is no animation and no warning — the art alone tells the visitor that landing here is fatal.

**Why this priority**: The art is what makes the mechanic legible. The feature works without the blood, but a spear that does not read as lethal fails its purpose.

**Independent Test**: Place the spear in a level and view it in play at normal zoom. Confirm three uneven, blood-tipped spear points are clearly readable inside one tile and that the spear is visually distinct from a spike.

**Acceptance Scenarios**:

1. **Given** a placed spear, **When** it renders, **Then** it shows three spear points of unequal length, tips pointing up, with blood on at least some tips, inside a single 32x32 tile.
2. **Given** a spear placed beside a spike, **When** a visitor looks at both, **Then** the two read as different hazards.
3. **Given** the spear art, **When** it is inspected, **Then** it is flat 2D pixel art — no gradients, cylindrical highlights or perspective shading — and its palette is consistent with the surrounding tileset art.
4. **Given** a spear in a level, **When** it renders, **Then** it is drawn in the tile it was placed in, with the transparent part of the tile showing the level behind it.

---

### User Story 4 - Author Spears from the Editor (Priority: P4)

A level author opens the level editor, finds the floor spear as its own entry in the Hazards group of the palette with a preview of its actual art, paints it onto the grid exactly like any other hazard, saves the level, and sees the same spears when the level is played.

**Why this priority**: The hazard is unusable in practice without a palette entry, but this is the authoring surface for the behaviors above rather than a new player-facing behavior.

**Independent Test**: Open the editor, select the spear in the Hazards group, paint cells, save, reload, and verify the spears persist and render correctly.

**Acceptance Scenarios**:

1. **Given** the editor palette, **When** the author looks in the Hazards group, **Then** the floor spear has its own entry, separate from the Spike entry, with a readable name and a preview of its real art.
2. **Given** the spear entry selected, **When** the author paints cells, **Then** each cell holds the floor spear, and clicking an already-placed spear never changes its orientation.
3. **Given** a saved level containing spears, **When** it is reloaded, **Then** the spear placements are unchanged.
4. **Given** the spear's level character `¦`, **When** the level parser loads, **Then** the import-time character-overlap guard passes — `¦` is not shared with any terrain, entity, sign or other hazard.

---

### Edge Cases

- ✅ **Full health versus one half-heart**: see User Story 1 scenario 2 — the hearts held are irrelevant to a spear death.
- ✅ **Spear and enemy in the same tick**: if an enemy contact and a spear landing resolve in the same tick, the spear's death wins. The invulnerability the enemy hit would have started does not save the character.
- ✅ **Already dead or dying**: a character in the death sequence never triggers a second spear death.
- ✅ **Post-respawn**: a character respawns at its checkpoint on solid ground, and standing is safe by definition, so a spear in the level cannot chain-kill a freshly respawned character.
- ✅ **Spear beside or under a spike**: a non-lethal pass through overlapping hazards still does nothing; a lethal landing still kills exactly once.
- ✅ **Enemies**: enemies are unaffected by spears. They are never killed, blocked, bounced or slowed, and they pass through the tile like any other non-solid hazard.
- ✅ **Bombs and blasts**: a spear is never destroyed, disarmed, consumed or moved by any interaction, including a bomb blast.
- ✅ **Reset Game**: spears are restored unchanged; no spear state survives a reset.
- ✅ **Terrain decides solidity**: a spear never makes its tile solid. Whether a character can stand in the tile is decided entirely by the terrain under and around it.
- ✅ **The transparent part of the tile**: only the spear's top tips are lethal; the tile's empty margin and the spear's side and shaft are never lethal.
- ✅ **Falling past the spear (side clip)**: a descending character that drifts sideways into the tile and touches only the spear's side or shaft takes no damage — only a landing on the top tips from above is lethal.
- ✅ **Falling into the tile with no ground below**: the character dies at the moment it descends onto the top tips, before it would fall through the tile.
- ✅ **Jumping up through the spear**: a character rising or jumping up through the tile is always safe, no matter how far above the spear its hitbox reaches. The spear only becomes dangerous on the way back down, if the descent brings the character onto the top tips from above.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The game MUST add a new hazard kind — the floor spear — distinct from the spike, placeable by its own level character, and registered in the hazard registry so adding it changes no other hazard.
- **FR-002**: A floor spear MUST be non-solid: it never blocks, stops, deflects or otherwise alters the character's movement.
- **FR-003**: The spear's top tips are the **only** lethal region, and only a **descent onto them from above** — while the character is descending — is lethal: health drops straight to zero and the death and respawn behavior of [F-016](../F-016-platformer-health/spec.md) takes over unchanged. Contact with the spear's side, shaft or the tile's transparent margin MUST never be lethal, including a descending side or shaft graze. Walking through the tile horizontally, standing on solid terrain inside it, and rising or jumping up through it from below (regardless of how far above the spear the hitbox reaches) MUST all be harmless.
- **FR-004**: A spear's instant kill MUST ignore both the hearts held and every invulnerability window. A qualifying tip contact is always fatal, including at full health and including during the post-damage invulnerability window from [F-016](../F-016-platformer-health/spec.md).
- **FR-005**: A spear MUST never apply ordinary half-heart damage, knockback or the hit animation. Its only outcomes are instant death or nothing at all.
- **FR-006**: A spear MUST be floor-mounted with its tips pointing up. Ceiling-mounted and wall-mounted spears are out of scope for this feature.
- **FR-007**: A spear's art MUST be a single 32x32 pixel tile showing three spear points of unequal length pointing up, with blood on at least some of the tips, drawn as flat 2D pixel art — no gradients, cylindrical highlights or perspective shading — using only colours already present in the existing platformer tileset palette (no new colours introduced).
- **FR-008**: A spear MUST have its own palette entry in the level editor's Hazards group, with a readable name and a preview showing its real art, separate from the Spike entry. Selecting the spear entry and painting MUST place the floor orientation only — the entry never cycles orientation — and placements MUST round-trip through level save and load exactly like any other hazard marker.
- **FR-009**: The spear MUST use the level character `¦` (U+00A6, broken bar), which MUST NOT collide with any existing terrain, entity, sign or hazard character, so the existing import-time character-overlap guard still passes.
- **FR-010**: A spear MUST never be destroyed, disabled, disarmed, consumed or moved by any interaction — enemy, bomb, block, respawn or Reset Game — and MUST never award a CV fact, a pickup, a journal entry or a counter.
- **FR-011**: Enemies MUST be unaffected by spears. A spear never damages, blocks, bounces or slows an enemy, and enemies pass through it.
- **FR-012**: When a spear's lethal tip contact and any other damage source resolve in the same tick, the spear's death MUST take precedence and exactly one death MUST occur.
- **FR-013**: A spear MUST render in the tile it was placed in, in the orientation it was placed with — the floor orientation, tips up — and MUST NOT render any differently after a death, respawn or Reset Game.
- **FR-014**: On a spear kill, a blood splatter MUST play at the character's feet, spraying up and outward, and MUST keep animating through the death lead-in. It is the only visual effect a spear adds — no half-heart hit splatter, no hit flash.

### Open Requirements

**The hazard model does not yet express lethal or directional hazards.** `HazardType` currently carries a half-heart `damage` amount and a hazardous box, and the shared collision path applies `takeDamage` plus knockback. The floor spear needs "always zero health" plus "only while descending", which that model cannot express today. This feature MAY special-case the spear inside the existing hazard collision path, or extend the hazard-kind contract with a lethal flag and a contact predicate; the plan decides. The behavior in this specification MUST hold either way.

**The spear's art is a standalone asset.** The art now exists at `public/sprites/spears.png` — a 32x32 flat 2D pixel-art tile meeting FR-007, palette-reduced to the tileset's limited palette (no new colours). Whether the render path loads it as a standalone image or draws it as a cell added to the shared static-objects sheet is the plan's choice; either way it MUST remain flat 2D pixel art consistent with the existing tileset palette.

### Key Entities

- **Floor spear**: A static, non-solid hazard occupying one 32x32 tile with its tips pointing up, placed by the level character `¦`. It is lethal to a character descending onto its top tips from above, and inert in every other contact — walking, standing, rising or jumping through it, and grazing its side or shaft included. It has no health, no movement, no lifecycle, no state and no reward.
- **Spear art**: The single 32x32 pixel-art frame — three uneven spear points with blood on at least some tips. It defines both what the visitor sees and which pixels — the top tips — are lethal.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Landing on the tips is always fatal**: from any fall height, at any fall speed, and at any health total, a descending overlap with a spear's top tips from above kills the character instantly and hands off to the existing death and respawn. Verified by unit tests over the hazard collision plus a browser check.
- **SC-002 — Everything else is safe**: walking through the tile, standing in it, rising or jumping through it, touching only its transparent margin, and grazing only its side or shaft never change health or movement. Verified by unit tests and a browser check.
- **SC-003 — No partial damage**: a spear contact never subtracts a half-heart, never knocks back and never starts the hit reaction; the only outcomes are death or nothing, and the death shows only the feet blood splatter of FR-014 (see FR-005). Verified by unit tests.
- **SC-004 — The trap reads at a glance**: a placed spear shows three uneven, blood-tipped spear points in one tile, clearly distinguishable from a spike, in flat 2D pixel art. Verified by a browser check.
- **SC-005 — Authorable**: the spear has its own entry in the editor's Hazards group with a correct preview, paints the floor orientation only (never cycling orientation), and survives a save and reload. Verified by a component test plus a browser check.
- **SC-006 — Inert world object**: no interaction destroys, moves, disables or rewards a spear, and enemies pass through unharmed. Verified by unit tests and a browser check.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md), [F-016](../F-016-platformer-health/spec.md) and [O-005](../O-005-platformer-hazards/spec.md) are complete**: the game loop, the character hitbox and physics, the level format and editor, the death and respawn sequence, and the static hazard family all exist. This feature adds one hazard kind to that world; it creates none of it.
- **"Falling onto" is defined by a downward approach to the top tips.** The spear is lethal only when the character is descending (its vertical motion is downward) and its hitbox overlaps the spear's top tips from above — the way a landing on the tips does. Everything else is harmless: walking through the tile, standing in it, rising or jumping through it, and descending past it while grazing only the side or shaft. Because the tile is non-solid, the plan must distinguish a tip landing from a side graze (a contact-from-above test combined with the downward-motion predicate); the exact predicate is the plan's choice, but the behavior above MUST hold.
- **Instant kill bypasses the heart economy.** A qualifying tip contact sets health straight to zero and ignores every invulnerability window. This is deliberate: "instant kill" means the hearts held and any recent hit are irrelevant.
- **Only the floor orientation is in scope.** The issue is titled "Floor spear hazard" and the requested art points up. Ceiling- and wall-mounted spears can reuse the same art later as their own change.
- **The 32x32 art is the whole tile.** Three uneven spear points in a 32px cell is a deliberately dense composition; the blood is a readability cue that the hazard is lethal, not a gameplay signal.
- **The spear is a hazard kind, not a terrain kind, entity or block.** It reuses the hazard family's static, non-solid, indestructible, reward-free model and adds no new category of level content.
- **Level character**: the spear uses `¦` (U+00A6, broken bar), confirmed unused across `TERRAIN_CHARS`, `ENTITY_CHARS`, `SIGN_CHARS` and `HAZARD_CHARS`; it passes the import-time character-overlap guard (FR-009).
- **Spear placement in the shipped level** is level design, not this feature; this feature only makes the kind available.

## Out of Scope

- **Ceiling-, wall- and any other non-floor spear orientations** — only the floor orientation is in scope.
- **Spears that damage enemies or other hazards** — enemies pass through unharmed.
- **Animated, moving, timed or triggered spears** — a spear is a static tile.
- **Spears that can be destroyed, disarmed, pushed or consumed** — no interaction changes a spear.
- **Any half-heart damage, knockback or hit reaction from a spear** — it is kill-or-nothing. (The feet blood splatter of FR-014 is in scope.)
- **CV rewards, journal entries and HUD counters** — a spear reveals no fact and tracks nothing.
- **Hazard kinds beyond the floor spear** — this feature adds exactly one kind.
- **Spear-specific sound or screen effects** beyond the shared death sequence.
