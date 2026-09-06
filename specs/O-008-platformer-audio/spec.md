# Feature Specification: Platformer Game Audio

**Feature Branch**: `O-008-platformer-audio`
**Status**: Not started — **NOT COMMITTED**
**Input**: Looping background music and sound effects for the platformer, muted by default, with a visitor-facing mute toggle.

> **This feature is not committed.** It is recorded here so the idea is not lost, and so that
> if it is ever taken up the requirements do not have to be rediscovered. Nothing in this
> document is scheduled, and nothing else in the platformer depends on it. The game is fully
> playable, and considered complete, without any audio at all.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Audio Is Silent Until the Visitor Asks for It (Priority: P1)

A visitor loads the platformer. Nothing plays. A speaker control in the game's HUD shows the
muted state. The visitor clicks it; background music begins and sound effects start
accompanying gameplay. Clicking it again silences everything at once and the control returns
to its muted state.

**Why this priority**: Sound that starts on its own is the single most disruptive thing a CV
website can do to a visitor — one who is browsing at work, or with several tabs open, must
never be surprised by it. Opt-in is not a preference here, it is the condition under which
audio may exist at all.

**Independent Test**: Load the platformer and verify complete silence and a muted speaker
control. Click the control and verify music starts and effects accompany actions. Click again
and verify everything stops and the control shows muted.

**Acceptance Scenarios**:

1. **Given** the platformer is loaded, **When** the game starts playing, **Then** no music and
   no sound effect is audible and the speaker control shows the muted state.
2. **Given** audio is muted, **When** the visitor activates the speaker control, **Then**
   background music begins looping and sound effects become audible, and the control shows the
   unmuted state.
3. **Given** audio is enabled, **When** the visitor activates the speaker control again,
   **Then** both music and sound effects stop immediately and the control shows the muted
   state.
4. **Given** audio is enabled, **When** the visitor leaves the platformer theme or the level
   ends, **Then** no audio continues playing outside the game.

---

### User Story 2 - Sound Effects Confirm Game Actions (Priority: P2)

With audio enabled, each meaningful game action is confirmed by a short sound: jumping,
collecting a coin, stomping an enemy, breaking a destroyable block, taking damage, opening a
chest, and opening or closing the journal. When the last chest of the level is opened and the
Thank-You screen appears, a distinct fanfare marks the completion.

**Why this priority**: Effects make the feedback the game already gives visually also audible,
but every one of those actions is already legible on screen. Nothing is unplayable without
them.

**Independent Test**: With audio enabled, perform each action once and verify a distinct sound
accompanies it, and that no action produces silence where a sound is specified.

**Acceptance Scenarios**:

1. **Given** audio is enabled, **When** the character jumps, **Then** a short jump sound plays.
2. **Given** audio is enabled, **When** the character collects a coin, **Then** a collection
   sound plays.
3. **Given** audio is enabled, **When** the character stomps an enemy, **Then** a defeat sound
   plays.
4. **Given** audio is enabled, **When** the character breaks a destroyable block, **Then** a
   shatter sound plays.
5. **Given** audio is enabled, **When** the character takes damage, **Then** a damage sound
   plays.
6. **Given** audio is enabled, **When** the character opens a chest, **Then** a chest-opening
   sound plays.
7. **Given** audio is enabled, **When** the Thank-You screen appears because the last chest was
   just opened, **Then** a distinct fanfare plays, separate from the chest-opening sound.
8. **Given** audio is enabled, **When** the journal is opened or closed, **Then** a page-flip
   sound plays.

---

### Edge Cases

- **Browser autoplay restriction**: Because audio only ever begins after the visitor activates
  the control, the game never attempts playback without a prior interaction.
- **Rapid repeated actions**: Many identical effects triggered in quick succession — a run of
  coins, repeated jumps — must not stack into distortion or a rising volume.
- **Toggling mid-effect**: Muting while a sound is playing silences it along with everything
  else; nothing finishes playing after the mute.
- **Missing or unloadable audio asset**: A sound that cannot be loaded is simply not played.
  The game continues at full speed and the remaining sounds still work.
- **Game paused**: While the game is paused — the journal open, the Thank-You screen showing —
  gameplay effects do not fire, since the actions that trigger them are not happening.
- **Theme switch with audio enabled**: Leaving the platformer stops all audio. Returning to it
  starts from the muted state again, like any other fresh visit.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST start with all audio muted on every visit, and MUST NOT play any
  sound before the visitor has explicitly enabled audio.
- **FR-002**: System MUST provide a visitor-facing mute control in the game's HUD that toggles
  all audio — music and effects together — and that visibly reflects the current muted or
  unmuted state.
- **FR-003**: System MUST play a looping background music track while audio is enabled and the
  game is running.
- **FR-004**: System MUST play a distinct short sound effect for each of: jumping, collecting a
  coin, stomping an enemy, breaking a destroyable block, taking damage, opening a chest, and
  opening or closing the journal.
- **FR-005**: System MUST play a distinct completion fanfare when the Thank-You screen appears,
  separate from the chest-opening effect that immediately precedes it.
- **FR-006**: System MUST silence all audio immediately when the visitor mutes, with no sound
  allowed to finish playing afterwards.
- **FR-007**: System MUST stop all audio when the platformer is left, so no sound continues
  under another theme or an unmounted game.
- **FR-008**: System MUST treat a missing or unloadable audio asset as silence for that sound
  alone, leaving gameplay and every other sound unaffected.
- **FR-009**: System MUST keep audio free of any effect on gameplay: no game rule, timing,
  frame rate or outcome may depend on whether audio is enabled.

### Key Entities

- **Mute state**: Whether the visitor has enabled audio. Muted on every visit; changed only by
  the mute control.
- **Background music**: A single looping track that plays while audio is enabled and the game is
  running.
- **Sound effect**: A short sound tied to one game action. Each of the actions listed in FR-004
  and FR-005 has its own.
- **Mute control**: The speaker control in the HUD that shows the mute state and toggles it.

## Success Criteria _(mandatory)_

- **SC-001 — Silence by default**: A fresh visit to the platformer produces no audible output
  of any kind until the visitor activates the mute control.
- **SC-002 — One control governs everything**: A single activation of the mute control silences
  or restores both music and every effect; there is no second place to configure audio.
- **SC-003 — Every listed action is audible**: With audio enabled, each action named in FR-004
  and FR-005 produces its own distinguishable sound.
- **SC-004 — Audio never affects play**: The game behaves identically — same physics, same
  outcomes, same frame rate — muted and unmuted.
- **SC-005 — No audio escapes the game**: Leaving the platformer theme or closing the game
  leaves nothing playing.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) is complete**: The platformer theme, its game
  loop, its HUD and its journal exist. This feature adds sound to actions that already happen;
  it introduces no gameplay of its own.
- **The actions to be scored already exist**: Jumping, coins and the journal come from F-015;
  chests and the Thank-You screen from [S-007](../S-007-platformer-chests/spec.md); enemies,
  blocks and damage from their own features. This feature adds no new action and changes none
  of them.
- **Audio is purely additive**: No requirement of any other platformer feature is met by sound.
  Removing audio entirely leaves every other feature complete.
- **Suitable audio assets are not yet chosen**: No music track or effect set has been selected,
  and licensing for any candidate is unresolved. Sourcing assets is part of taking this feature
  up, not a prerequisite already met.
- **The mute state is not persisted**: Every visit begins muted, regardless of what the visitor
  chose last time. This is deliberate rather than a limitation — an unexpected sound on a later
  visit is exactly what the default prevents.

## Out of Scope

- Separate volume controls or independent music and effects channels — the toggle is all-or-
  nothing
- Persisting the mute choice across visits
- Positional, panned or distance-attenuated audio
- Music that changes with the level, the situation or the player's progress
- Voice-over, narration or spoken CV content
- Audio in any other theme — this feature is the platformer's alone
- Subtitles, captions or any visual substitute for a sound; every sound merely accompanies
  feedback that is already visible
