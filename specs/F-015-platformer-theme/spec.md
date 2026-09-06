# Feature Specification: Platformer Theme

**Feature ID**: F-015
**Feature Branch**: `F-015-platformer-theme`
**Status**: Implemented
**Input**: "2D platformer theme — the visitor plays a side-scrolling game where collecting things reveals CV information."

The browser viewport becomes a playable 2D level. The visitor runs and jumps a pixel-art
character through hand-authored terrain, collects coins that reveal CV facts, and reads
everything found so far in a handwritten journal that pauses the game while open.

This feature is the minimum playable theme — movement, physics, terrain, bridges, camera,
coins, the reveal animation, and the journal. Every other platformer feature builds on it
and is listed under [Out of Scope](#out-of-scope).

The character table for the level format, the tile API, and the entity model are code
knowledge and live under `docs/themes/platformer/` — see
[LevelFormat.md](../../docs/themes/platformer/LevelFormat.md) and
[Entities.md](../../docs/themes/platformer/Entities.md).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Run and Jump Through the Level (Priority: P1)

A visitor switches to the Platformer theme. A side-scrolling game view fills the viewport:
a pixel-art character stands on grassy terrain against a sky background. Arrow keys move
the character left and right; Space jumps. The character animates — idle when still, walk
when moving, jump while airborne — and its sprite faces the direction of travel. Terrain is
solid from every direction, except rope bridges, which can be jumped up through from below
and dropped through deliberately by holding Down. The camera scrolls horizontally to keep
the character in view as the level extends past the right edge of the screen.

**Why this priority**: Without a character that can move in a world, nothing else in the
theme has anywhere to happen.

**Independent Test**: Load the theme. Verify the character renders standing on terrain.
Hold Left/Right — verify movement with the walk animation and a camera that follows. Tap
Space — verify a short hop; hold Space — verify a full-height jump. Jump up through a
bridge from below — verify it is passable. Stand on the bridge and hold Down — verify the
character drops through.

**Acceptance Scenarios**:

1. **Given** the Platformer theme is active, **When** the page loads, **Then** a
   full-viewport side-scrolling game view renders with the character standing on terrain.
2. **Given** the character is idle, **When** the visitor holds Right, **Then** the character
   moves right at a constant speed with the walk animation, facing right.
3. **Given** the character is moving left, **When** the visitor presses Right instead,
   **Then** direction reverses immediately with no skid or deceleration.
4. **Given** the character is on the ground, **When** the visitor taps Space briefly,
   **Then** the character performs a short hop; holding Space produces a noticeably higher
   jump.
5. **Given** the character is airborne beneath a bridge tile, **When** it rises into the
   bridge, **Then** it passes through and lands on top of the bridge on the way down.
6. **Given** the character is resting on a bridge, **When** the visitor holds Down or `S`,
   **Then** the character falls through the bridge to whatever is below.
7. **Given** the character moves toward the level's right edge, **When** it leaves the
   centered dead zone, **Then** the camera scrolls to follow, clamped so it never scrolls
   past the level's start or end.

---

### User Story 2 - Collect Coins to Discover Skills (Priority: P1)

Gold coins are scattered across platforms and in the air — some easy to reach, others
requiring a tricky jump. Walking into one collects it: the coin disappears, and a whole
skill category from the CV floats up from the collection point, hovers briefly near the
character, then flies toward the journal icon and disappears into it. One coin carries an
entire category (for example "Backend" and every skill rated inside it), not a single
skill — the real CV holds far too many individual skills to place one collectible each.

**Why this priority**: Coins are the bridge between playing and reading the CV. Without
them the theme is a game with no purpose.

**Independent Test**: Walk into a coin — verify it vanishes and the category text floats up
and flies to the journal icon. Open the journal — verify the category and its star-rated
skills appear in the Skills section. Walk back over the spot — verify the coin is gone.

**Acceptance Scenarios**:

1. **Given** a coin sits in the level, **When** the character's hitbox overlaps it, **Then**
   the coin is removed from the world and its skill category's text floats up, hovers, and
   animates toward the journal icon.
2. **Given** a coin has been collected, **When** the visitor opens the journal, **Then** the
   category appears in the Skills section with each of its skills and their star ratings.
3. **Given** a coin has been collected, **When** the visitor returns to where it was,
   **Then** nothing is there — collected state holds for the rest of the session.
4. **Given** the same fact would be revealed twice, **When** the second reveal is triggered,
   **Then** no duplicate entry is added to the journal.

---

### User Story 3 - Open the Journal to Read Collected Facts (Priority: P1)

At any point the visitor presses `J`, or clicks the journal icon in the HUD, to pause the
game and open the journal. It renders as a centered, bounded card — an open notebook of
lined paper in a handwriting font — with the rest of the game still visible around it.
Colored bookmark tabs along the book's top edge, one per CV section shown in the journal,
switch which section is displayed; each shows the section's icon rather than a text label.
Hover-revealed chevrons page back and forth through the book. A counter beside the section
header shows how many of that section's facts have been found. Pressing `J` again closes
the journal and resumes play exactly where it stopped.

**Why this priority**: The journal is how a visitor actually reads the CV — it is the
output of everything the game does.

**Independent Test**: Collect a coin, press `J` — verify the game pauses and the journal
opens over the still-visible game. Click a different bookmark — verify content and the
active tab switch. Page past a section boundary — verify the active bookmark follows.
Press `J` again — verify play resumes from the same position.

**Acceptance Scenarios**:

1. **Given** the game is running, **When** the visitor presses `J` or clicks the journal
   icon, **Then** the game pauses and the journal opens as a centered card with the canvas
   and HUD still visible around it.
2. **Given** the journal is open, **When** the visitor looks at it, **Then** it renders as
   an open notebook — lined paper, handwriting font, colored per-section bookmark tabs
   showing icons.
3. **Given** one section's bookmark is active, **When** the visitor clicks another tab,
   **Then** the book jumps to that section's first page and the previously active tab
   returns to its inactive state.
4. **Given** the journal is open, **When** the visitor uses the page-flip controls, **Then**
   the book walks one continuous sequence of pages across every section, wrapping around at
   both ends, and the active bookmark updates when paging crosses a section boundary.
5. **Given** a section has facts still undiscovered, **When** the visitor views it, **Then**
   a counter near the section header shows collected out of total (for example "Skills 3/5").
6. **Given** a section has nothing collected yet, **When** the visitor lands on its page,
   **Then** a placeholder invites further exploring and the counter shows zero out of the
   section's total.
7. **Given** the journal is open, **When** the visitor presses `J` again or clicks close,
   **Then** the journal closes and the game resumes from the exact paused state.
8. **Given** the journal is open, **When** the visitor clicks Reset Game, **Then** every
   collected fact is cleared, the journal closes immediately, the world resets to its
   initial state, and the character restarts at the spawn point.

---

### User Story 4 - Reach the Theme and Switch Language (Priority: P3)

The Platformer theme is a prototype and is hidden by default: no theme switcher offers it
until the visitor unlocks it. Once unlocked and active, the same floating translucent
theme and locale controls every other theme carries sit over the game. Switching language
re-renders the journal and in-game text in the selected locale without disturbing play.

**Why this priority**: Standard theme infrastructure inherited from F-012 and F-013 — the
game and journal are the deliverables; the controls are the frame around them.

**Independent Test**: With the theme locked, open a theme switcher — verify Platformer is
absent. Unlock it — verify it appears and can be selected. While playing, switch language
— verify journal content changes language. Lock the theme again while it is active — verify
the site falls back to the IDE theme.

**Acceptance Scenarios**:

1. **Given** the prototype flag is unset, **When** the visitor opens any theme switcher,
   **Then** the Platformer theme is not offered.
2. **Given** the flag has been set, **When** the visitor opens a theme switcher, **Then**
   Platformer is listed and selecting it renders the game.
3. **Given** the Platformer theme is active, **When** the flag is cleared, **Then** the site
   falls back to the IDE theme rather than stranding the visitor on a hidden theme.
4. **Given** the game is running, **When** the visitor switches locale, **Then** the journal
   and in-game text re-render in the new language and game state is preserved.

---

### Edge Cases

- **Empty CV sections**: a section with no data produces no collectibles and shows no
  journal bookmark.
- **Fewer coins than skill categories**: a level's marker count decides coverage — a
  mechanics-test level may cover only part of the CV without being wrong.
- **No CV data**: the game still renders and remains playable; the journal shows only
  placeholders.
- **Rapid or simultaneous key presses**: input is polled per frame, so held and conflicting
  keys resolve deterministically and cannot tunnel the character through terrain.
- **Long frame gaps**: a backgrounded or stalled tab produces one very large frame delta;
  the step is clamped so the character cannot pass through solid terrain on resume.
- **Window resize**: the canvas resizes to the viewport and the camera re-clamps to the new
  width.
- **Journal open during game events**: the game is fully paused, so nothing in the world
  moves or collides while the journal is open, and input buffered during the pause does not
  fire on resume.
- **Page reload or theme switch**: game progress is session-only and is not persisted.

## Requirements _(mandatory)_

### Functional Requirements

#### Theme Registration and Access

- **FR-001**: The theme MUST be registered in the application's theme map under the
  `platformer` key and render as a full-viewport page like any other theme.
- **FR-002**: A `platformerPrototypeUnlocked` flag, persisted in `localStorage` and
  defaulting to `false`, MUST gate whether any theme switcher offers the Platformer theme.
  Every switcher reads this one source rather than filtering independently. Clearing the
  flag while the Platformer theme is active MUST fall back to the IDE theme.
- **FR-003**: The theme MUST render the shared floating translucent theme and locale
  controls over the game, and MUST re-render journal and in-game text when the locale
  changes, preserving game state and position.

- **FR-004**: Switching away from the Platformer theme and returning to it MUST start a
  completely fresh session: collected facts are discarded, the character returns to the
  spawn point, and the theme's introduction plays again as it does on a first visit. A
  visitor never returns to a half-played level. This is deliberate — the game is a way to
  read a CV, and a returning visitor should be able to discover its content from the
  beginning rather than inherit a partial state they no longer remember.

#### Rendering and the Game Loop

- **FR-005**: The game MUST render into a full-viewport `<canvas>` using pixel-art sprites
  drawn with nearest-neighbor scaling, so art stays crisp rather than blurring at scale.
- **FR-006**: The game loop MUST run off the browser's paint cycle, advancing the world by
  the elapsed time of each frame with that step clamped to a maximum, so a stalled or
  backgrounded tab resumes without tunneling through collision.
- **FR-007**: The game MUST distinguish an active `playing` phase from a `paused` phase.
  Pausing freezes physics, animation and world timers; the journal is the pause source this
  feature owns. Sprite art loads asynchronously and each drawing surface falls back to a
  flat fill until its image has arrived, so the theme is interactive from the moment it
  mounts.

#### Player Character and Physics

- **FR-008**: The character MUST render with distinct **idle**, **walk** and **jump**
  animation states, and its sprite MUST face the direction of horizontal movement.
- **FR-009**: The character MUST be subject to constant downward gravity while airborne and
  MUST collide with solid terrain from every direction — landing on it from above, stopping
  against it horizontally, and being blocked by it from below.
- **FR-010**: Pressing the jump key while grounded MUST apply an upward impulse whose
  resulting height varies with how long the key is held: a tap produces a short hop, a held
  press the full jump.
- **FR-011**: Horizontal movement MUST be constant speed with instant direction change —
  holding a direction applies full speed immediately, releasing it (or holding both
  directions) drops to zero immediately, and reversing snaps to the opposite direction with
  no skid or deceleration phase.
- **FR-012**: Bridge tiles MUST behave as one-way platforms: passable from below and from
  the sides, solid when landing on them from above. Holding Down or `S` while resting on a
  bridge MUST drop the character through it.
- **FR-013**: The game MUST read keyboard input every frame so held keys produce continuous
  movement: Arrow Left/Right (or `A`/`D`) move, Space jumps, Arrow Down (or `S`) drops
  through a bridge, and `J` toggles the journal. Arrow Up is reserved for interaction, never
  for jumping or journal navigation. The game MUST suppress the browser's own default
  behavior for the keys it consumes, so play never fights page scrolling.

#### Camera

- **FR-014**: The camera MUST follow the character horizontally using a dead zone: it stays
  still while the character moves within a band centered on the viewport, then moves only
  enough to pin the character back to that band's edge. It MUST be clamped so it never
  scrolls past the level's start or end.

#### Level

- **FR-015**: A level MUST be authored as a grid of ASCII rows, one character per cell, read
  bottom-anchored so the last row is the level's floor. Rows shorter than the widest are
  padded with empty space. The character table itself — which glyph places which tile or
  entity — is code knowledge and lives in
  [LevelFormat.md](../../docs/themes/platformer/LevelFormat.md).
- **FR-016**: Every collectible and entity MUST be placed by an explicit hand-authored
  marker in the level grid. There is no auto-placement fallback: a level's marker count, not
  the CV's length, decides how much of the CV that level covers.

#### Collectibles and CV Facts

- **FR-017**: Coins MUST map to the CV's Skills section, one coin per whole skill category —
  collecting a coin adds the category and every skill inside it, with their ratings, in one
  step.
- **FR-018**: Every fact reveal MUST play one shared animation: the fact's text floats up
  from the point it was revealed, hovers briefly near the character, then animates toward
  the journal icon and disappears into it. Every source of facts runs through this same
  behavior so counters and journal state stay consistent regardless of where a fact came
  from.
- **FR-019**: Collected state MUST be tracked for the session: a collected coin is removed
  from the world and does not return, its fact is added to the journal, and re-revealing an
  already-collected fact MUST NOT create a duplicate entry. No game progress is persisted
  across a page reload.

#### Journal

- **FR-020**: The journal MUST open on `J` or a click of the HUD journal icon, pause the
  game, and render as a centered bounded card — never a full-screen backdrop — with the
  canvas and HUD still visible around it. Pressing `J` again or clicking close resumes play
  from the exact paused state, discarding input buffered while paused.
- **FR-021**: The journal MUST render as an open notebook: lined paper with a margin rule,
  a handwriting font, and a page beneath for depth.
- **FR-022**: The journal MUST show one bookmark tab per CV section it displays, colored per
  section and labeled with the section's icon rather than text. The active tab extends and
  the others show a peek; clicking a tab jumps to that section's first page. The last
  selected section MUST be remembered across closing and reopening.
- **FR-023**: Journal content MUST be paginated as one continuous sequence of pages across
  the whole book rather than per section. Sections insert their own pages into that
  sequence, a section with nothing collected still contributing one placeholder page. Page
  controls walk the sequence and wrap around at both ends, and paging across a section
  boundary updates the active bookmark to match.
- **FR-024**: Each section MUST show a counter of facts collected out of that section's
  total, so the visitor can tell whether anything is still undiscovered. Personality is the
  exception — it is a single always-visible fact and carries no counter.
- **FR-025**: The journal MUST offer a Reset Game control rendered as a pixel-art icon.
  Activating it clears every collected fact, closes the journal immediately, resets the
  world to its initial state, and restarts the character at the spawn point.

### Key Entities

- **Player character**: the visitor's avatar — position, velocity, facing direction,
  grounded state, and the animation state driving which sprite frame is drawn.
- **Level**: the game world — a grid of terrain cells plus the marker-placed positions of
  everything in it, and the character's spawn point.
- **Terrain tile**: one cell of the level. Ground and walls are solid from every direction;
  bridges are solid only from above; empty cells are open air. A ground tile renders as
  grass on a top-exposed face and as buried rock otherwise.
- **Coin**: a walk-over collectible carrying one whole skill category.
- **Collected fact**: a record of a discovered CV item — which section it belongs to, the
  data itself, and what revealed it. The set of these is the session's discovered CV.
- **Journal**: the notebook overlay that reads the collected facts — bookmark tabs, a
  paginated page sequence, per-section counters, and the Reset Game control.
- **Camera**: the viewport's offset into the level, following the character horizontally
  within a dead zone and clamped to the level's bounds.

## Success Criteria _(mandatory)_

- **SC-001 — The character is controllable**: a visitor can move left and right, jump to a
  variable height, land on terrain, and be followed by a scrolling camera. Idle, walk and
  jump animations are visibly distinct. Verified by manual play and physics unit tests.
- **SC-002 — Bridges read as one-way**: the character can jump up through a bridge from
  below, land on it from above, and drop through it on demand. Verified by collision unit
  tests and a manual browser check.
- **SC-003 — Collecting fills the journal**: collecting every coin in the level puts every
  skill category that level covers into the journal's Skills section, each with its skills
  and ratings. Verified by component test.
- **SC-004 — The journal is readable**: the journal renders as lined notebook paper in the
  handwriting font with working bookmark tabs, pagination and counters, and a non-technical
  reader can understand the facts shown. Verified by component test and visual review.
- **SC-005 — The theme stays hidden until unlocked**: with the prototype flag unset, no
  theme switcher lists the Platformer theme; clearing the flag while it is active falls back
  to the IDE theme. Verified by unit and component tests.
- **SC-006 — Locale switching works mid-game**: switching language re-renders journal
  content without resetting the game. Verified by component test.
- **SC-007 — Frame stalls are safe**: a very large frame gap does not move the character
  through solid terrain. Verified by a physics test using an oversized step.
- **SC-008 — Zero TypeScript errors**: the theme compiles under `strict: true` with no `any`
  types and no suppression directives. Verified by `npm run build`.

## Assumptions

- **F-002 (Data Model) is complete**: `CVData` and both locale files exist and are
  importable. This feature reads them and neither creates nor modifies them.
- **F-012 (Theme System) is available**: the theme signal, the `localStorage`-backed signal
  helper, and theme registration all exist.
- **F-013 (Multilanguage) is complete**: the locale and CV signals and the locale-change
  function all exist.
- **Desktop and keyboard only**: the theme targets desktop with keyboard input. Touch
  controls are permanently out of scope, not deferred.
- **Canvas 2D rendering**: the game uses the Canvas 2D API, not WebGL or a 3D engine.
- **Axis-aligned box collision**: physics uses rectangular hitboxes, not pixel-perfect
  collision, as is standard for retro-style platformers.
- **Session-only state**: nothing about a play session is persisted. Only the prototype
  unlock flag lives in `localStorage`.
- **One hand-crafted level**: the theme ships a single continuous level authored by hand,
  not generated from CV data.
- **Handwriting font from Google Fonts**: the journal's font uses the site's existing font
  import pattern and falls back to a system cursive face if unavailable.

## Out of Scope

Each item below is owned by its own feature and specified there.

- **Health, pit-fall damage and respawn** — hearts, the damage unit, the invincibility
  window, and the death/respawn flow: [F-016](../F-016-platformer-health/spec.md).
- **Enemies** — patrol, stomp defeat, contact damage, key drops:
  [F-017](../F-017-platformer-enemies/spec.md).
- **Destroyable blocks** — crates, question-mark blocks and rocks, and the facts they
  reveal: [F-018](../F-018-platformer-blocks/spec.md).
- **The level editor** — authoring and saving levels in the browser:
  [F-019](../F-019-platformer-level-editor/spec.md).
- **Chests and level completion** — keys, chest opening, and the Thank-You screen that
  reveals Contact: [S-007](../S-007-platformer-chests/spec.md).
- **Ladders and vertical camera follow** — climbable tiles and camera movement on the
  vertical axis: [S-008](../S-008-platformer-ladders/spec.md).
- **Onboarding** — the controls overlay, contextual hint signs, and pausing while the
  floating controls are open: [S-009](../S-009-platformer-onboarding/spec.md).
- **Container blocks and pickups** — including spreading a shared skill-fact pool across a
  level's coins rather than binding one category per placed coin:
  [O-004](../O-004-platformer-containers/spec.md).

Permanently out of scope for the theme as a whole: mobile and touch controls, score
tracking or leaderboards, online or multiplayer features, WebGL or 3D rendering, keyboard
remapping, saving a session across page reloads, and a responsive layout below desktop
widths.
