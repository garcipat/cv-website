# Feature Specification: Platformer Level Selection & URL Loading

**Feature Branch**: `O-007-platformer-level-selection`
**Status**: Not started
**Input**: The platformer always loads the shipped `main` level. Authored levels exist and are loadable inside the Level Editor, but a visitor has no way to reach them, and a developer who wants to look at one has to open the editor and press its Try button. This feature gives the game itself a level choice and a shareable address for any level.

The EDITOR-side level dropdown — picking a level to *author* — already exists and belongs to
[F-019](../F-019-platformer-level-editor/spec.md). This feature is its visitor-facing
counterpart: choosing a level to *play*.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Choose a Level While Playing (Priority: P1)

A visitor is playing the platformer. Alongside the game's other on-screen controls, a level
chooser lists every level the game can offer — the shipped level first, then every additional
saved level. The visitor picks one; the game loads that level, starts the character at its
spawn point, and play continues normally. Everything the level offers — coins, chests, enemies,
blocks — is present exactly as the level defines it.

**Why this priority**: Without a visitor-facing chooser, the additional levels the editor can
produce are unreachable in the game. This is the feature.

**Independent Test**: Open the platformer, open the level chooser, verify it lists the shipped
level plus every saved level. Pick a different level and verify the game restarts on that
level's layout at that level's spawn point.

**Acceptance Scenarios**:

1. **Given** the platformer is playing, **When** the visitor opens the level chooser, **Then**
   it lists the shipped level and every additional saved level, each under a readable name.
2. **Given** the level chooser is open, **When** the visitor selects a level other than the one
   currently loaded, **Then** the game loads that level and the character starts at its spawn
   point at full health.
3. **Given** the visitor selects the level that is already loaded, **When** the selection is
   made, **Then** the game restarts that level rather than doing nothing.
4. **Given** a level has been selected, **When** the chooser is opened again, **Then** the
   currently loaded level is shown as the selected one.
5. **Given** a level is loaded, **When** the visitor opens the journal, **Then** it shows the
   facts collected in the current session on the current level, with per-section counters
   measured against that level's totals rather than the shipped level's.

---

### User Story 2 - Open a Specific Level by URL (Priority: P1)

Someone opens the platformer with a level named in the address — a query parameter such as
`?level=minimal`. The named level loads directly on arrival, with no interaction and without
passing through the editor. A visitor can be handed a link to one particular level; a developer
can check a saved layout by typing its name into the address bar rather than opening the editor
and pressing Try.

**Why this priority**: A level with no address cannot be linked, bookmarked, or reported in a
bug ticket. This is what makes an authored level shareable and inspectable.

**Independent Test**: Open the platformer with `?level=<id>` for a saved level and verify that
level is loaded and playable from the first frame, with no flash of the shipped level. Repeat
with a name that matches nothing and verify the shipped level loads instead.

**Acceptance Scenarios**:

1. **Given** a level parameter naming an existing level, **When** the platformer loads, **Then**
   that level is the one played, from the first frame — the shipped level is never rendered
   first.
2. **Given** no level parameter is present, **When** the platformer loads, **Then** the shipped
   level is played.
3. **Given** a level parameter naming no existing level — a typo, a renamed level, a deleted
   one — **When** the platformer loads, **Then** the shipped level is played and the game is
   fully functional; the visitor is never shown an error page or an empty grid.
4. **Given** a level was opened by URL, **When** the visitor then picks a different level from
   the chooser, **Then** the newly picked level loads and the address reflects the level now
   being played, so the link can be copied and shared.
5. **Given** a level was opened by URL, **When** the page is reloaded, **Then** the same level
   loads again.

---

### Edge Cases

- **Malformed level file**: A saved level whose file cannot be read is offered by neither the
  chooser nor the URL parameter; it behaves exactly as a level that does not exist.
- **Switching levels mid-run**: Choosing a level while facts have already been collected
  restarts progress for the new level — collected facts, health, defeated enemies and opened
  chests all reset. Nothing carries across a level change.
- **Switching levels while the journal or an overlay is open**: The overlay closes and the game
  resumes on the new level; the game is never left paused against a level that is no longer
  loaded.
- **A level with no chests**: Level completion is unreachable on such a level. The game remains
  playable and the Thank-You screen simply never appears.
- **A single-level deployment**: When no saved levels exist beyond the shipped one, the chooser
  offers only that one entry rather than disappearing, so the control does not appear and
  vanish depending on what is deployed.
- **Theme switch and return**: Returning to the platformer theme reloads the level named in the
  address, or the shipped level when none is named — never a level chosen earlier in the
  session and no longer addressed.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST offer the visitor a choice among every level the game can load — the
  shipped level and every additional saved level — from within the running game, without
  entering the Level Editor.
- **FR-002**: System MUST present each selectable level under a readable name and MUST indicate
  which level is currently loaded.
- **FR-003**: System MUST load the selected level on choice: its layout, its terrain, and every
  entity it places, with the character positioned at that level's spawn point at full health.
- **FR-004**: System MUST reset all game progress on a level change — collected facts, health,
  defeated enemies, destroyed blocks, opened chests and any level-completion state — so a level
  always begins from a clean run.
- **FR-005**: System MUST derive every per-level total the game reports (journal counters,
  completion condition) from the level actually loaded, not from the shipped level.
- **FR-006**: System MUST accept a level identifier as a URL query parameter and load the named
  level on mount, before the first rendered frame, so the shipped level is never briefly shown.
- **FR-007**: System MUST fall back to the shipped level, silently and without an error state,
  when the level parameter names a level that does not exist or cannot be read.
- **FR-008**: System MUST keep the address in step with the level being played, so that the
  current URL always reproduces the current level when opened or shared.
- **FR-009**: System MUST make level selection and URL loading available to ordinary visitors on
  the deployed site, not only under a dev-only route or a debug flag.
- **FR-010**: System MUST leave every gameplay rule unchanged across levels — physics,
  collision, damage, collection and reveal behave identically no matter which level is loaded.

### Key Entities

- **Playable level**: A named, selectable level. Carries an identifier used in the URL, a
  readable name shown in the chooser, and the layout that defines its terrain and entities. The
  shipped level is one of these and is the default.
- **Level chooser**: The visitor-facing control that lists the playable levels and reports the
  chosen one to the game.
- **Level parameter**: The identifier carried in the page address that names which playable
  level to load on arrival.

## Success Criteria _(mandatory)_

- **SC-001 — Every level is reachable in the game**: Every level offered by the editor's own
  dropdown can be started and played from the game itself, without opening the editor.
- **SC-002 — A level has a shareable address**: Opening the platformer with a level named in the
  URL starts that level directly; the same URL, opened again or by someone else, starts the same
  level.
- **SC-003 — A bad level name is harmless**: Opening the platformer with a level name that
  matches nothing yields the shipped level, fully playable, with no error surface.
- **SC-004 — A level change is a clean restart**: After switching levels, no collected fact,
  health value, opened chest or defeated enemy from the previous level remains.
- **SC-005 — Counters follow the loaded level**: The journal's per-section counters and the
  level-completion condition match the loaded level's contents on every selectable level.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) is complete**: The platformer theme, its game
  loop, its level format and its journal all exist. This feature changes which level is loaded,
  not how a level is played.
- **[F-019](../F-019-platformer-level-editor/spec.md) owns the editor side**: The editor's level
  dropdown, its discard-changes confirmation, and saving a level as a file all belong to F-019
  and are unchanged here. This feature consumes the same set of levels F-019 produces, from the
  visitor's side.
- **A dev-only level parameter exists today in a narrower form**: A level can currently be named
  in the address only when the game is reached through the dedicated platformer route, and it is
  documented as a developer convenience rather than a visitor-facing entry point. This feature
  makes it a supported entry point available wherever the theme is played.
- **Levels are static content**: The set of selectable levels is fixed by what is deployed. A
  visitor cannot add, edit, rename or delete a level from the game.
- **A level is self-contained**: Everything a level needs is in the level itself. There is no
  ordering, no progression and no unlocking between levels — every level is directly selectable
  at any time.
- **Progress is per-session and per-level**: Nothing about a level run is persisted. Reloading
  or switching starts a fresh run.
- **The shipped level remains the default**: Any visitor arriving with no level named plays the
  same level they play today.

## Out of Scope

- Authoring, saving, renaming or deleting levels from the game — that is the Level Editor's
  domain (F-019)
- A level campaign: ordering, progression, unlocking, or a "next level" transition on completion
- Carrying collected facts, health or completion state from one level to another
- Persisting the chosen level across sessions or across a browser reload beyond what the URL
  itself carries
- Per-level scores, times, leaderboards or completion records
- Uploading or pasting a level layout into the game
- A level preview, thumbnail or description in the chooser beyond the level's name
