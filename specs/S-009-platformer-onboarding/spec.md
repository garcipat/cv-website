# Feature Specification: Platformer Onboarding & Controls UX

**Feature Branch**: `S-009-platformer-onboarding`  
**Feature ID**: S-009  
**Status**: Implemented  
**Input**: Teach a first-time visitor how to play — an upfront key legend for the universal controls, in-place signs for mechanics that only make sense where they are met, and a game that pauses itself while the visitor is busy with the floating controls.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See the Controls at Game Start (Priority: P1)

A visitor arriving at the platformer has no idea which keys do anything. As soon as gameplay actually begins, a translucent key legend eases into view over the running game: pictures of the real keycaps — the arrow cluster, the space bar, and the journal key — each with a short caption naming what it does, in the visitor's language. It sits in the upper-middle of the screen where collected-fact text already appears, not in a panel or a dialog, and it never pauses the game or blocks input.

It stays up until the visitor has actually walked a couple of tiles away from where the character stood when it appeared — a deliberately higher bar than a single keypress, so a visitor who taps a key while still reading is not cut off. Then it fades and slides away and does not come back for the rest of the session. A visitor who never moves keeps seeing it indefinitely, by design; there is no timeout.

**Why this priority**: Without it a first-time visitor may never discover that the game responds to anything at all.

**Independent Test**: Load the theme. Once play begins, the legend eases in. Walk a couple of tiles — it fades out. Keep playing, die, respawn, reset the game — it never returns.

**Acceptance Scenarios**:

1. **Given** the platformer theme loads, **When** gameplay reaches the playing state for the first time in the session, **Then** the key legend eases into view showing the movement, jump, interact and journal keys with translated captions.
2. **Given** the game is still in its opening transition, **When** that transition is playing, **Then** the legend is not shown — it waits until play actually starts.
3. **Given** the legend is visible, **When** the visitor moves the character about two tiles from where it stood when the legend appeared, in either direction, **Then** the legend fades out and slides away.
4. **Given** the legend has faded out, **When** the visitor keeps playing, dies and respawns, or resets the game, **Then** it never reappears for the rest of the session.
5. **Given** the legend is visible, **When** the visitor presses keys without moving that far, **Then** the legend stays — there is no keypress dismissal and no timeout.
6. **Given** the legend is visible, **When** the visitor plays, **Then** the game is not paused and the legend accepts no clicks — it never intercepts input.
7. **Given** the legend is visible, **When** the journal or another overlay takes over the screen, **Then** the legend hides while that overlay is up and eases back in afterwards, measuring its dismissal distance afresh from the character's position at that moment.
8. **Given** the visitor switches locale, **When** the legend is shown afterwards, **Then** its captions appear in the selected language.

---

### User Story 2 - Read a Signpost's Tip Where the Mechanic Is (Priority: P2)

Some mechanics only make sense standing in front of them — dropping down through a one-way bridge, climbing a ladder, needing a key for a chest. For those, signposts are placed in the level next to the mechanic they explain. Walking up to a sign does nothing on its own; standing on it and pressing the interact key makes a speech bubble grow out of the sign, as if it started talking, showing one short line of gameplay guidance in the visitor's language. The game keeps running underneath — the bubble neither pauses play nor blocks movement.

The bubble collapses back into the sign as soon as the character walks off it, whether or not the visitor ever pressed interact. Signs are reusable: the same sign can be read any number of times. Their text is gameplay guidance, never CV content — reading one adds nothing to the journal and counts toward nothing.

**Why this priority**: Contextual mechanics are exactly the ones an upfront legend cannot usefully teach, but the game is playable without the explanation.

**Independent Test**: Walk onto a bridge sign and press interact — a bubble grows out of the sign with a hint. Walk away — it collapses. Come back and press interact again — it shows again. Open the journal — nothing was added.

**Acceptance Scenarios**:

1. **Given** the character is standing on a sign, **When** the visitor presses the interact key, **Then** a speech bubble grows out of the sign showing that sign's hint text, without pausing the game or blocking movement.
2. **Given** the character is standing on a sign, **When** the visitor does not press interact, **Then** no bubble appears — proximity alone is not the trigger.
3. **Given** a bubble is showing, **When** the character stops overlapping the sign, **Then** the bubble collapses back into the sign.
4. **Given** a sign has been read, **When** the character returns to it and the visitor presses interact again, **Then** the bubble shows again — signs are never used up.
5. **Given** a sign is read any number of times, **When** the visitor checks the journal or the collected-fact counters, **Then** nothing was added — signs carry no CV content.
6. **Given** the visitor switches locale, **When** a bubble is shown afterwards, **Then** its text appears in the selected language.
7. **Given** the character stands on a sign while also standing on a chest, **When** the visitor presses interact, **Then** the sign's hint takes priority, so a sign is never silently swallowed.

---

### User Story 3 - Pause While Using the Floating Controls (Priority: P2)

The theme and locale controls float over the game like they do in every other theme. Opening them pauses the running game, so the character is not walking off a ledge or taking damage while the visitor reads a dropdown; closing them resumes play exactly where it stopped. If the game was already paused for another reason — the journal is open, or the completion screen is up — opening and closing the controls changes nothing, so play never resumes behind an overlay that is still on screen.

**Why this priority**: Without it the visitor is punished for changing a setting mid-game.

**Independent Test**: While playing, open the floating controls — the character stops moving and the game freezes. Close them — play resumes from the same position. Open the journal, then open and close the controls on top of it — the game stays paused until the journal is closed.

**Acceptance Scenarios**:

1. **Given** the game is playing, **When** the visitor opens the floating theme or locale controls, **Then** the game pauses.
2. **Given** the game is paused because the floating controls are open, **When** the visitor closes them, **Then** the game resumes from exactly the state it was paused in.
3. **Given** the game is already paused because the journal or the completion screen is open, **When** the visitor opens the floating controls, **Then** nothing changes — the game stays paused.
4. **Given** the journal is open and the visitor opened and closed the floating controls over it, **When** the controls close, **Then** the game stays paused until the journal itself is closed.
5. **Given** the game is not in a playing state — the opening transition, or a death sequence — **When** the visitor opens the floating controls, **Then** that state proceeds unaffected.

---

### Edge Cases

- **A visitor who never moves**: the key legend stays on screen indefinitely — this is intended, not a stuck state.
- **The legend interrupted mid-fade**: if an overlay opens while the legend is fading out, the legend still counts as dismissed and does not demand the walking distance again later.
- **Two signs showing the same hint**: each is its own placement and behaves independently.
- **A sign placed where the character cannot stand**: it is never readable — sign placement is a level-design responsibility, not something the game validates.
- **Locale switched while a bubble is showing**: the next bubble shown uses the new language.
- **The interact key held down**: a bubble is shown once per interaction, not re-triggered every frame while the key is down.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The key legend MUST appear when gameplay first reaches the playing state in a session, and MUST NOT appear during the opening transition.
- **FR-002**: The key legend MUST show the game's universal controls — movement, jump, interact and journal — as pictures of the real keycaps with short translated captions.
- **FR-003**: The key legend MUST ease in and out rather than appearing and disappearing abruptly, and MUST be rendered over the running game rather than inside a panel or dialog.
- **FR-004**: The key legend MUST NOT pause the game, block movement, or accept pointer input.
- **FR-005**: The key legend MUST dismiss once the character has traveled roughly two tiles, in either direction, from where it stood when the legend appeared. There MUST be no keypress dismissal and no timeout.
- **FR-006**: Once dismissed, the key legend MUST NOT reappear for the rest of the session, including after a death and respawn or a game reset.
- **FR-007**: While an overlay owns the screen, the key legend MUST hide and, on returning, MUST re-measure its dismissal distance from the character's position at that moment.
- **FR-008**: Signposts MUST be placed in the level through hand-authored markers, each marker fully determining which hint that sign shows.
- **FR-009**: A sign's hint MUST be revealed only by an explicit interact key press while the character overlaps the sign — overlap alone MUST NOT reveal it.
- **FR-010**: A revealed hint MUST render as a speech bubble that grows out of the sign and collapses back into it, and MUST NOT pause the game or block movement.
- **FR-011**: A hint MUST be hidden as soon as the character stops overlapping its sign, whether or not it was ever revealed.
- **FR-012**: Signs MUST be reusable without limit and MUST NOT be tracked as collected, counted in any counter, or added to the journal.
- **FR-013**: Hint text MUST be gameplay guidance only, never CV content, and MUST be localized to the active locale.
- **FR-014**: Where the character overlaps both a sign and another interactable, the sign's hint MUST take priority.
- **FR-015**: Opening the floating theme and locale controls MUST pause the game, and only when the game is actually playing.
- **FR-016**: Closing the floating controls MUST resume the game, and only when nothing else is still holding the pause — the journal or the completion screen keep it paused.

### Key Entities

- **Key legend**: a one-time, session-scoped overlay listing the universal controls. Owns no game state beyond a single latch recording that it has been dismissed.
- **Signpost**: a placed level object carrying one hint identifier and nothing else — no state, no progression, no reward. Its overlap area is the tile it stands on.
- **Hint bubble**: the transient presentation of one sign's text, alive only while the character overlaps the sign that raised it.
- **Pause ownership**: the rule that several things can ask the game to pause — the journal, the completion screen, the floating controls — and play resumes only when none of them still wants it paused.

The hint texts themselves and the markers that place signs live with the level data; see [`docs/themes/platformer/LevelFormat.md`](../../docs/themes/platformer/LevelFormat.md).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Controls are discoverable**: a first-time visitor who has never seen the game can identify the movement, jump, interact and journal keys without any instruction outside the game.
- **SC-002 — The legend gets out of the way**: after walking roughly two tiles, the legend is gone and does not return for the remainder of the session under any circumstance.
- **SC-003 — Onboarding never interrupts play**: neither the key legend nor a hint bubble pauses the game or swallows an input.
- **SC-004 — Contextual mechanics are explained in place**: every mechanic the legend does not cover and that a visitor could otherwise miss has a sign beside it, at minimum the one-way bridge drop-through.
- **SC-005 — Signs stay out of the CV**: after reading every sign in the level, the journal and every collection counter are unchanged.
- **SC-006 — Settings are safe to change**: opening the floating controls mid-game leaves the character in exactly the state it was in, and closing them resumes play there — with no resume while another overlay is still on screen.
- **SC-007 — Onboarding is localized**: switching locale changes every legend caption and hint bubble to the selected language.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) is complete**: the platformer theme's game phases, pause and resume behavior, journal, input handling and the floating theme and locale controls all exist. S-009 layers onboarding presentation and one pause trigger on top of them.
- **Shared interact key**: the same key reveals a sign's hint, opens a chest and climbs a ladder. Which one responds is decided by what the character is standing on or overlapping.
- **Hint content is authored, not derived**: hint texts are written as UI copy alongside the rest of the theme's translated strings; nothing generates them from level contents.
- **Session-scoped**: the legend's dismissal and everything else here lives for the browser session only, and nothing is persisted between visits.
- **The floating controls themselves are inherited**: their appearance and behavior belong to the shared theme and locale infrastructure. This feature specifies only what the platformer does while they are open.

## Out of Scope

- A tutorial level, a guided first-run sequence, or a re-openable help screen
- Re-showing the key legend on demand after it has been dismissed
- Persisting "this visitor has already seen the controls" between visits
- Signs that carry CV content, count toward a section, or are consumed on reading
- Multi-page or paginated hint bubbles, or hints requiring dismissal by a key press
- Onboarding for any theme other than the platformer
- Sound effects for the onboarding overlays — see [O-008](../O-008-platformer-audio/spec.md)
