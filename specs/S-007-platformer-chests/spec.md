# Feature Specification: Platformer Chests, Keys & Level Completion

**Feature Branch**: `S-007-platformer-chests`  
**Feature ID**: S-007  
**Status**: Implemented  
**Input**: Treasure chests as the platformer level's main objective — locked behind keys, holding Experience facts, and completing the level with a Thank-You screen that reveals Contact.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open a Chest to Reveal an Experience Entry (Priority: P1)

Scattered through the level — hand-placed via markers, exactly like coins, enemies and blocks, with no special end-of-level positioning — are treasure chests. Each chest holds one Experience entry from the CV, the section considered the most valuable and therefore worth its own dedicated collectible. A chest starts closed and sits flush with the ground: it is not a solid obstacle, so the character walks over and beside it rather than onto it.

Unlike every other collectible, a chest does not open on touch. The visitor must stand the character on the chest, hold at least one key, and press the interact key. Opening spends one key, permanently swaps the chest to its open state, and reveals the associated Experience fact, which floats up and flies to the journal icon exactly like any other revealed fact. A dedicated chest counter in the HUD tracks opened versus total chests, separately from hearts, coins and keys.

**Why this priority**: Chests are the level's main objective thread and the only route to the Experience section. Without them the game has no goal beyond ambient collecting.

**Independent Test**: Walk over a closed chest without pressing interact — it stays closed. Stand on it holding at least one key and press interact — the chest swaps to its open sprite, the key counter drops by one, the chest counter rises by one, and the Experience fact flies to the journal.

**Acceptance Scenarios**:

1. **Given** a closed chest and at least one held key, **When** the character stands on the chest and the visitor presses the interact key, **Then** the chest permanently opens, one key is spent, the HUD chest counter increments, and the associated Experience fact floats up and flies to the journal icon.
2. **Given** a closed chest, **When** the character merely walks over or past it without pressing interact, **Then** the chest stays closed and no fact is revealed.
3. **Given** an already-open chest, **When** the character stands on it and presses interact, **Then** nothing happens — a chest is opened once and never re-closes for the rest of the session.
4. **Given** some but not all chests are open, **When** the visitor looks at the HUD, **Then** the chest counter shows opened versus total chests for the level, alongside the count of keys currently held.
5. **Given** the visitor uses the journal's Reset Game action, **When** the level restarts, **Then** every chest is closed again and the chest counter is back to zero.

---

### User Story 2 - Earn Keys from Purple Slimes to Unlock Chests (Priority: P1)

Chests are locked. The only source of keys is defeating a purple slime, which drops a key as a bobbing ground pickup that the character collects by walking into it. Held keys show as a running count in the HUD. Attempting to open a chest with no keys does nothing: the chest stays closed, and the character shows a short "I need a key" bubble above its head so the visitor understands why the interaction failed rather than assuming the chest is broken.

**Why this priority**: The key requirement is what makes a chest a deliberate objective rather than another walk-through pickup, and it ties the enemy loop to the completion loop.

**Independent Test**: With zero keys, stand on a closed chest and press interact — nothing opens and the "need a key" bubble appears. Defeat a purple slime, collect the dropped key, return, and press interact — the chest opens.

**Acceptance Scenarios**:

1. **Given** the visitor holds zero keys, **When** the character stands on a closed chest and the visitor presses the interact key, **Then** the chest stays closed, no key is spent, no fact is revealed, and a short bubble above the character explains that a key is needed.
2. **Given** the visitor holds zero keys, **When** the character stands on a closed chest without pressing interact, **Then** no bubble appears — the explanation is a response to an attempted interaction, not to mere proximity.
3. **Given** a key pickup is lying on the ground, **When** the character walks into it, **Then** the key is collected and the HUD key counter increments.
4. **Given** the character walks away from a locked chest, **When** it no longer stands on the chest, **Then** the bubble disappears.

---

### User Story 3 - Reach the Thank-You Screen on Level Completion (Priority: P2)

Opening the level's final chest immediately completes the level, wherever in the level the character happens to be standing — there is no separate location-based trigger. A Thank-You screen takes over the whole viewport: a solid black background with white text, completely covering the game rather than floating over it, entering with a curtain-falling animation from the top of the screen. It shows a thank-you message, the CV's Contact information, and a "press any button to continue" line beneath.

Contact appears here and nowhere else in the game. It is never placed as a collectible, never added to the journal, and has no journal bookmark. While the screen is up the game is paused; any key press or click dismisses it instantly and gameplay resumes exactly where it was left, with the dismissing key press not leaking through as a game action. The only way to see the screen again is to reset the game and open every chest again.

**Why this priority**: The core loop of play → collect → read is complete without it, but it gives the level a sense of closure and surfaces contact details the visitor would otherwise have to hunt for.

**Independent Test**: Open every chest in the level. The Thank-You screen appears immediately, the game pauses, and Contact is shown with a continue prompt. Press any key — the screen closes and play resumes from the same position without the character jumping or moving. Open the journal — there is no Contact bookmark anywhere.

**Acceptance Scenarios**:

1. **Given** one unopened chest remains, **When** it is opened, **Then** the Thank-You screen appears immediately and the game pauses, regardless of where in the level the character stands.
2. **Given** the Thank-You screen is displayed, **When** the visitor reads it, **Then** it shows a thank-you message, the CV's Contact details, and a "press any button to continue" line, over a full-screen solid black background.
3. **Given** the Thank-You screen is appearing, **When** it enters, **Then** it slides down into place like a falling curtain; dismissal is instant with no reverse animation.
4. **Given** the Thank-You screen is visible, **When** the visitor presses any key or clicks anywhere, **Then** the screen closes and gameplay resumes from the exact paused state, with the dismissing key press not also acting as a game input.
5. **Given** the Thank-You screen has been dismissed, **When** the visitor opens the journal, **Then** no Contact section or bookmark exists — Contact is only ever shown on this screen.
6. **Given** the level is complete, **When** the visitor resets the game, **Then** every chest closes again and the Thank-You screen can be reached a second time by reopening them all.
7. **Given** the active locale changes, **When** the Thank-You screen is shown afterwards, **Then** its message and continue prompt appear in the selected language.

---

### Edge Cases

- **A level with no chests**: completion never fires — the Thank-You screen requires at least one chest, so a chest-free level simply has no ending.
- **Fewer chests than Experience entries**: chests are paired with Experience entries in order; entries beyond the number of placed chests are unreachable and their journal counter reflects that.
- **A chest and a hint sign overlapping**: the sign's hint wins, so a sign is never silently swallowed by a locked chest's bubble.
- **Contact missing from the CV**: the Thank-You screen still appears with its message and continue prompt, simply without contact lines.
- **Dying or falling while chests are open**: opened chests stay open — chest state survives respawn and is only cleared by Reset Game.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Chests MUST be placed in the level through hand-authored markers, in the same way as every other collectible — no automatic or end-of-level positioning.
- **FR-002**: Each chest MUST hold exactly one Experience entry from the CV, and Experience facts MUST be obtainable only from chests.
- **FR-003**: A chest MUST start closed and MUST NOT be a solid obstacle — the character passes through and over it freely.
- **FR-004**: Opening a chest MUST require all three of: the character standing on the chest, at least one held key, and an explicit interact key press. Touch alone MUST NOT open a chest.
- **FR-005**: Opening a chest MUST spend exactly one key, MUST permanently mark that chest open for the session, and MUST reveal its Experience fact through the game's shared fact-reveal behavior so the journal and its counters stay consistent with every other source.
- **FR-006**: Attempting to open a chest with zero keys MUST be a no-op — the chest stays closed, no key is spent and no fact is revealed — and MUST show a short explanatory bubble above the character. The bubble MUST disappear when the character leaves the chest.
- **FR-007**: Keys MUST be obtainable only by defeating a purple slime, which drops a key as a ground pickup collected by touch. See [F-017](../F-017-platformer-enemies/spec.md).
- **FR-008**: The HUD MUST show a chest counter (opened versus total for the level) and a key counter (keys currently held), both distinct from the heart and coin indicators.
- **FR-009**: Opening the last closed chest in the level MUST immediately trigger the Thank-You screen at the character's current position, and MUST trigger it only once per run.
- **FR-010**: The Thank-You screen MUST pause the game and cover the entire viewport with an opaque background, rather than rendering as a card over visible gameplay.
- **FR-011**: The Thank-You screen MUST show a thank-you message, the CV's Contact information, and a prompt to press any button to continue, all localized to the active locale.
- **FR-012**: The Thank-You screen MUST enter with a curtain-falling animation and MUST dismiss instantly, with no exit animation.
- **FR-013**: Any key press or any click MUST dismiss the Thank-You screen and resume gameplay from the exact state it was paused in. The dismissing key press MUST NOT also register as a gameplay input on the resumed frame.
- **FR-014**: Contact MUST be revealed exclusively on the Thank-You screen. It MUST NOT be placed as a collectible, MUST NOT be added to the journal, and MUST NOT have a journal bookmark or counter.
- **FR-015**: Resetting the game MUST return every chest to closed, reset the chest counter, and re-arm the Thank-You screen.

### Key Entities

- **Chest**: A placed object holding one Experience fact, in one of two states — closed or open. Closed is its trigger state; opening is a single permanent flip with no intermediate stages. A chest's footprint is wider than one tile and is centered on the tile it was placed on.
- **Key**: A countable resource with no world position once collected. Dropped by a defeated purple slime as a bobbing ground pickup, gathered by touch, and spent one at a time to open a chest.
- **Thank-You screen**: The level-completion state. Owns the game's pause while visible, is the sole presentation of the CV's Contact data, and is dismissed by any input.

The concrete data shapes behind these concepts live in [`docs/themes/platformer/`](../../docs/themes/platformer/Entities.md).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Experience is fully reachable**: every Experience entry paired with a placed chest is readable in the journal after opening all chests, and none of them can be obtained any other way.
- **SC-002 — Chests are key-gated**: a visitor holding zero keys cannot open any chest, and every successful open reduces the key count by exactly one.
- **SC-003 — Completion is reliable**: opening the last chest triggers the Thank-You screen exactly once, immediately, from any position in the level.
- **SC-004 — Contact is exclusive to completion**: Contact data appears on the Thank-You screen and appears nowhere in the journal, at any point in a session.
- **SC-005 — Dismissal is lossless**: after dismissing the Thank-You screen, the character's position, health and collected facts are unchanged, and no stray jump or movement results from the dismissing key.
- **SC-006 — Reset restores the objective**: after Reset Game, all chests are closed, the chest counter reads zero, and the Thank-You screen can be reached again.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) is complete**: the platformer theme's game loop, phases, HUD, marker-driven level format, shared fact-reveal behavior and journal all exist. S-007 adds a collectible kind and a completion state on top of them; it does not redefine them.
- **[F-017](../F-017-platformer-enemies/spec.md) provides keys**: the purple slime and its key drop are specified there. S-007 consumes the resulting key count and defines only what spending a key does.
- **Interaction shares one key with other interactions**: the same interact key that opens a chest also reveals a hint sign's tip ([S-009](../S-009-platformer-onboarding/spec.md)); which one responds is decided by what the character is standing on.
- **One chest kind**: all chests look and behave alike; nothing distinguishes one chest from another except the Experience entry it holds.
- **Session-scoped progress**: chest state, keys and collected facts live for the browser session only. Nothing is persisted between visits.

## Out of Scope

- Multiple chest kinds, rarities or locked-chest variants requiring more than one key
- Any other source of keys besides the purple slime
- A separate end-of-level area, exit door or boss encounter
- Contact ever appearing in the journal, or a Contact bookmark
- Sound effects for opening a chest or reaching the Thank-You screen — see [O-008](../O-008-platformer-audio/spec.md)
- Persisting completion between visits, or any share/export of the completion state
