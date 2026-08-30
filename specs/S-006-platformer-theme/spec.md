# Feature Specification: 2D Platformer Theme

**Feature Branch**: `S-006-platformer-theme`  
**Feature ID**: S-006  
**Created**: 2026-08-05  
**Status**: Draft  
**Input**: User description: "2D platformer theme — user plays a simple 2D platformer where collecting coins, destroying blocks, or defeating enemies reveals CV information"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Run and Jump Through the Platformer Level (Priority: P1)

A visitor opens the CV website and switches to the Platformer theme. A 2D side-scrolling game view appears with a pixel-art character standing on a grassy platform. The visitor uses arrow keys to move the character left/right and the spacebar (or up arrow) to jump across platforms, avoiding pits and obstacles. The character animates — idle, walk, and jump states. The camera follows the character as they explore a single, continuous level from left to right.

**Why this priority**: The core platformer mechanics are the foundation. Without basic movement, jumping, and a scrolling level, nothing else matters. This is the "hello world" of the theme — a character that can move in a world.

**Independent Test**: Load the Platformer theme. Verify the character renders on a platform. Press arrow keys — verify character moves left/right with walk animation. Press space — verify character jumps with jump animation. Move right — verify camera scrolls to follow. Move left — verify camera scrolls back.

**Acceptance Scenarios**:

1. **Given** the Platformer theme is active, **When** the page loads, **Then** a 2D side-scrolling game view renders with a pixel-art character standing on a platform against a themed background.
2. **Given** the character is idle on a platform, **When** the visitor presses the right arrow key, **Then** the character moves right with a walking animation and the camera scrolls to follow.
3. **Given** the character is standing on a platform, **When** the visitor presses the spacebar (**redesigned 2026-08-30**: Arrow Up is no longer a jump key — see FR-007), **Then** the character jumps upward, reaches a peak, and falls back down — landing on platforms or falling into pits.
4. **Given** the character is moving left, **When** the visitor presses the right arrow key, **Then** the character reverses direction and the sprite faces right.
5. **Given** the character falls into a pit, **When** the fall occurs, **Then** the character loses half a heart and reappears at the last solid ground position before the fall. **Given** the character loses all hearts, **When** the death occurs, **Then** the character respawns at the nearest spawn point with full health and all collected facts preserved.

---

### User Story 2 - Collect Coins to Discover Skills and Languages (Priority: P1)

As the visitor explores the level, they encounter floating gold coins scattered across platforms and in the air — some easy to reach, others requiring tricky jumps. Each coin is associated with a Skill or Language entry from the CV. When the character touches a coin, it disappears with a sparkle effect, and the actual CV fact text (e.g., "TypeScript ★★★★☆") floats up from the collection point, hovers briefly near the character, then animates toward the journal icon (top-left, next to the hearts, per FR-025's amendment). The fact is added to the visitor's journal under the Skills section.

**Why this priority**: Coins are the primary mechanic that connects gameplay to CV content. Without them, the platformer is just a game with no CV purpose. This is the bridge between play and portfolio.

**Independent Test**: Walk into a coin — verify it disappears and the actual skill/language fact text floats up. Open the journal — verify the fact appears in the Skills section. Collect all coins in the level — verify all Skills and Languages entries are in the journal.

**Acceptance Scenarios**:

1. **Given** the character approaches a coin, **When** the character sprite overlaps the coin, **Then** the coin disappears with a sparkle effect, the associated skill or language fact text floats up from the collection point, hovers briefly near the character, and animates toward the journal icon.
2. **Given** a coin is collected, **When** the visitor opens the journal, **Then** the Skills or Languages fact associated with that coin appears in the Skills section, styled as a simple list entry.
3. **Given** the visitor collects all coins in the level, **When** they check the journal, **Then** all Skills and Languages CV entries are populated in the journal.
4. **Given** the character respawns after falling, **When** they revisit a previously collected coin location, **Then** the coin is gone (already collected) — collected state persists for the session.

---

### User Story 3 - Open the Journal to Read Collected Facts (Priority: P1)

At any point during gameplay, the visitor can press a key (e.g., `J` or `Escape`) to pause the game and open the journal overlay. The journal appears as an open notebook with lined paper, a handwriting-style font, and colored bookmark tabs along the edge — one per CV section. The active section's facts are displayed in the notebook pages. The visitor clicks a bookmark tab to switch between sections (Experience, Skills, Projects, Education, Courses, Certificates, About, Contact). Pressing the key again (or clicking a close button) returns to the paused game exactly where they left off.

**Why this priority**: The journal is how visitors actually read the CV. Without it, collecting coins is meaningless. The journal is the "output" of the game.

**Independent Test**: Collect at least one coin. Press `J` — verify journal overlay appears with the game paused. Verify the collected fact is readable. Click different bookmark tabs — verify content switches. Press `J` again — verify game resumes from same position.

**Acceptance Scenarios**:

1. **Given** the visitor is playing the game, **When** they press `J` (or the journal key), **Then** the game pauses, the screen dims, and the journal overlay appears showing collected facts.
2. **Given** the journal is open, **When** the visitor observes it, **Then** it renders as an open notebook with lined paper, handwriting-style font, and colored bookmark tabs along the top-right edge (amended 2026-08-28, was along the right edge — see FR-015) — one per non-empty CV section.
3. **Given** one section's bookmark is active (extended, showing its label), **When** the visitor clicks a different bookmark tab, **Then** that tab extends with its label visible, the previously active tab collapses to a thin sliver, and the notebook content switches to that section's facts.
4. **Given** the journal is open, **When** the visitor views any section, **Then** a counter near the section header or bookmark shows how many facts have been collected out of the total for that section (e.g., "Skills 3/5"), so the player knows whether there are still undiscovered facts.
5. **Given** CV sections have no collected facts yet, **When** the journal is opened, **Then** those sections show a placeholder message like "No facts discovered yet — keep exploring!" and the counter shows "0/N".
6. **Given** the journal is open, **When** the visitor presses `J` again (or clicks the close button), **Then** the journal overlay closes and the game resumes from the exact paused state.
7. **Given** the journal is open at any point, **When** the visitor clicks the "Reset Game" button, **Then** all collected facts are cleared, the journal closes immediately and the iris-in "starting again" transition plays, the game resets to the spawn point, and all coins/enemies/blocks respawn in the level (amended 2026-08-28 — see FR-018b — originally the journal stayed open showing placeholders).

---

### User Story 4 - Defeat Enemies to Reveal Certificates, Projects, and Courses (Priority: P2)

Scattered through the level are two colors of simple slime enemies that patrol back and forth on platforms. Green slimes are associated with a Course entry from the CV; purple slimes are associated with a Certificate or Project entry. The visitor can defeat an enemy by jumping on top of it (stomp mechanic) — a green slime falls in a single stomp, a purple slime takes two stomps. When defeated, the enemy disappears in a poof animation and the actual CV fact text floats up from the defeat point, hovers briefly, then animates toward the journal icon. The fact is added to the visitor's journal under the Courses, Certificates, or Projects section accordingly. Defeated enemies stay defeated for the session.

**Why this priority**: Enemies add gameplay depth and reward exploration. They're P2 because coins already deliver Skills and Languages — enemies unlock Certificates, Projects, and Courses, which require skilled play to discover. **Amended 2026-08-29**: Courses (12 CV entries) moved here from the destroyable-block mechanic (see User Story 5) — too large a pool for the block mechanic alongside Experience/Education, and green slimes already existed as a lightweight, single-hit enemy well suited to a large pool. Purple slimes absorbed Projects alongside their original Certificates, since Projects no longer has its own dedicated enemy color.

**Independent Test**: Approach an enemy — verify it patrols. Jump on top of a green slime — verify it's defeated in one stomp with a poof effect and a Course fact appears. Jump on a purple slime twice — verify it takes two stomps before defeat and a certificate/project fact appears. Open journal — verify facts appear in the correct sections. Revisit the area — verify enemies are gone.

**Acceptance Scenarios**:

1. **Given** a green slime is patrolling on a platform, **When** the character jumps and lands on top of it, **Then** it is defeated in a single stomp with a poof/squish animation and the associated Course fact text floats up, hovers, and flies to the journal icon.
2. **Given** a purple slime is patrolling on a platform, **When** the character stomps it twice (a bounce off the first stomp, then a second landing), **Then** it is defeated on the second stomp with a poof/squish animation and the associated Certificate or Project fact text floats up, hovers, and flies to the journal icon.
3. **Given** an enemy is defeated, **When** the visitor opens the journal, **Then** the fact appears in the Courses, Certificates, or Projects section respectively, styled as a simple list entry.
4. **Given** the character collides with an enemy from the side or below, **When** contact occurs, **Then** the character takes damage (flashes briefly with invincibility frames), loses one full heart, and is pushed back slightly, using the same damage mechanism as pit falls (step 9) but with a full heart instead of a half heart. The character has 3 hearts total. At 0 hearts, the character respawns at the last checkpoint with full health and all collected facts preserved.
5. **Given** the character respawns after falling, **When** they revisit an enemy location, **Then** previously defeated enemies remain defeated for the session.

---

### User Story 5 - Break Blocks to Uncover Experience and Education (Priority: P2)

Some platforms contain destroyable blocks — three visually distinct kinds. **Crates** are associated with an Education, Activity, or Language entry from the CV (**redesigned 2026-08-30**, see User Story 6 — Experience moved off crates onto the new chest collectible, freeing crates to pick up Activities and Languages instead, closing the gap left when Languages' own fruit collectibles were removed): hitting one from below (Mario-style bump) shows a crack overlay; hitting it again from below breaks it apart with a shatter animation and reveals the associated fact. **Question-mark blocks** are styled to match their surrounding terrain (five color palettes) — a single hit from below pops a bonus fruit upward into the space directly above the block (a reward with no CV meaning, visually distinct from a coin so it's never mistaken for CV content) and permanently swaps the block to that same palette's plain `!` tile. **Rock blocks** break to empty space on a single hit from below and carry no reward at all — a pure level-design tool for shaping traversal. Every below-hit, on any of the three types, gives the block a short bump/nudge (it moves up a few pixels and settles back), even on the hit that breaks, shatters, or converts it. A crate's revealed fact text floats up from the break point, hovers briefly, then animates toward the journal icon, same as any other CV-mapped collectible.

**Why this priority**: Destroyable blocks add vertical exploration and a hit-based mechanic. They're P2 because they're a secondary mechanic — coins and enemies already deliver the main content flow. Crates reward persistent exploration with Experience and Education facts; question-mark and rock blocks add bonus rewards and level-design texture without extra CV content. **Amended 2026-08-29**: the original single 3-hit block type (dropping a fruit per hit, revealing an Experience/Education/Courses fact on the third) was split into three distinct block types once the tileset assets changed — there is no dedicated crack-progression sprite sheet, but there is a wooden crate tile, five terrain-matched `?`/`!` tile pairs, and plain terrain tiles to build from instead. Courses moved off blocks entirely onto enemies (see User Story 4) since 12 entries didn't fit well alongside Experience/Education on a 2-hit mechanic. **Redesigned 2026-08-30**: Experience moved off crates onto the new chest collectible (see User Story 6) since it's now considered the "most valuable" section and warrants its own dedicated main-objective collectible; crates pick up Activities (previously unmapped anywhere) and Languages (previously removed as standalone fruit collectibles in step 21) to keep a full complement of crate content.

**Independent Test**: Find a crate. Hit it from below once — verify a crack overlay appears with a bump animation. Hit it again — verify it breaks with a shatter animation and the education/activity/language fact text appears; check the journal for the fact in the correct section. Find a question-mark block — hit it from below — verify a fruit pops up above it and the block turns into its matching `!` tile. Find a rock block — hit it from below — verify it breaks to empty space with no reward.

**Acceptance Scenarios**:

1. **Given** an intact crate exists on a platform, **When** the character hits it from below for the first time, **Then** it shows a cracked visual overlay (with a bump animation) and remains in place — no fact, no reward yet.
2. **Given** a cracked crate, **When** the character hits it again from below, **Then** it breaks apart with a shatter animation (and a bump animation) and the associated Education, Activity, or Language fact text floats up from the break point, hovers, and flies to the journal icon.
3. **Given** a question-mark block, **When** the character hits it from below, **Then** a bonus fruit pops upward into the space directly above the block (landing as a touchable pickup) and the block permanently changes to its matching `!` terrain tile — no CV fact is revealed.
4. **Given** a rock block, **When** the character hits it from below, **Then** the block breaks into empty space immediately — no fruit, no fact, no reward.
5. **Given** any of the three block types, **When** the character hits it from above or the side, **Then** the block is not affected — only upward hits from below trigger any of the three mechanics.

---

### User Story 6 - Collect Every Chest to Reveal the Most Valuable Facts, Then Reach the Thank-You Screen (Priority: P2)

> **Redesigned 2026-08-30**: the flagpole is no longer planned as a mechanic —
> replaced by treasure chests as the level's "main objective" collectible, per the
> roadmap step 22 `brainstorming` session. The text below is the real, current
> design; the flagpole text that previously occupied this story (and FR-023/FR-024
> below it) is gone rather than kept for history, since it never shipped.

Scattered through the level (via hand-placed markers, same pattern as coins/enemies/blocks — no special end-of-level positioning) are treasure chests: the level's "main objective" collectible, visually and mechanically distinct from coins/fruit/crates. Each chest is associated with an Experience entry from the CV — the section considered most valuable, and therefore worth the extra weight of a dedicated collectible type. A chest starts closed (`chest_closed.png`), sits flush with the ground (not a solid obstacle — the character walks over/beside it, not on top of it). Unlike every other collectible, a chest does NOT open on touch: the character must be standing on/overlapping it and press Arrow Up (**redesigned 2026-08-30**, see FR-007's amendment — freed up from jumping specifically so it could become this game's "interact" key) to open it — a deliberate small pause-and-choose moment for the level's main objective, distinct from the passive walk-through-it collection every other pickup uses. Opening permanently swaps the chest to its open state (`chest_open.png` — it never re-closes) and reveals the associated Experience fact, which floats up and flies to the journal icon exactly like any other collectible. A dedicated chest counter in the HUD (e.g. "Chests 2/5") tracks progress separately from the heart/coin HUD elements, visually signaling that chests — not coins — are the primary goal.

Once every chest in the level has been opened, a "Thank You" screen appears: a full pause-the-game overlay showing a thank-you message and the CV's Contact information, with "press any button to continue" beneath it. Dismissing it (any key or click) resumes play exactly where the visitor left off — a visitor who still wants to mop up any remaining coins or crates isn't locked out. The screen can appear wherever in the level the visitor happens to be when they open the last chest; there is no separate location-based trigger. Contact is revealed only on this screen — it is not added to the journal, and has no bookmark (the visitor can trigger the screen again only by opening all chests again after a Reset Game, which restores every chest to closed).

**Why this priority**: Chests provide a clear "main objective" thread through the level (distinct from the ambient coin/crate collecting) and give Experience — the most valuable CV section — a collectible of its own, while the thank-you screen provides closure without needing a flagpole/pole-slide animation that no longer has matching art. It's P2 because the core loop (play → collect → read) is already complete without it — but it adds a satisfying sense of completion and surfaces Contact info a visitor would otherwise have to dig for.

**Independent Test**: Stand on a closed chest and press Arrow Up — verify it swaps to its open sprite, the chest counter increments, and the Experience fact flies to the journal. Walk over (don't press Up on) a closed chest — verify it stays closed. Open every chest in the level — verify the Thank You screen appears, pausing the game, showing the thank-you message and Contact info with "press any button to continue". Press any key — verify the screen closes and gameplay resumes from the same position. Open the journal — verify Contact never appears as a bookmark.

**Acceptance Scenarios**:

1. **Given** a closed chest exists in the level, **When** the character is standing on/overlapping it and the visitor presses Arrow Up, **Then** it permanently swaps to its open sprite (never re-closes for the rest of the session), the HUD chest counter increments, and the associated Experience fact text floats up and flies to the journal icon.
1b. **Given** a closed chest exists in the level, **When** the character merely walks over or past it without pressing Arrow Up, **Then** the chest stays closed and no fact is revealed — opening is a deliberate action, not automatic on touch.
2. **Given** some but not all chests are open, **When** the visitor checks the HUD, **Then** the chest counter shows the count of opened vs. total chests in the level (e.g. "Chests 2/5").
3. **Given** the last unopened chest in the level is touched, **When** it opens, **Then** the Thank You screen appears immediately, pausing the game, wherever the character happens to be in the level.
4. **Given** the Thank You screen is displayed, **When** the visitor reads it, **Then** it shows a thank-you message, the CV's Contact information, and "press any button to continue" text beneath.
5. **Given** the Thank You screen is visible, **When** the visitor presses any key or clicks, **Then** the screen closes and gameplay resumes from the exact paused state.
6. **Given** the Thank You screen has been dismissed, **When** the visitor opens the journal, **Then** no Contact bookmark exists anywhere in the journal — Contact is only ever shown on the Thank You screen.
7. **Given** the visitor clicks "Reset Game" (FR-018b), **When** the level restarts, **Then** all chests reset to closed and the chest counter resets to 0.

---

### User Story 7 - Game Audio (Priority: P2)

A looping background music track and sound effects enhance the platformer experience. Sound effects play for key actions: jumping, collecting a coin, stomping an enemy, breaking a block, taking damage, opening a chest, and opening/closing the journal. A distinct fanfare/chime plays when the Thank You screen appears (**redesigned 2026-08-30**, see User Story 6 — replaces the flagpole celebration fanfare this requirement originally implied). A small speaker icon in the top-right HUD area allows the visitor to toggle all audio on/off. Audio is muted by default and must be enabled by the visitor.

**Why this priority**: Audio feedback makes gameplay more engaging and provides clear confirmation of game actions, but the game is fully playable without it.

**Independent Test**: Load the Platformer theme — verify audio is muted by default and speaker icon shows muted state. Click the speaker icon to enable — verify background music starts playing. Jump — verify jump sound effect. Collect a coin — verify coin sound. Stomp an enemy — verify splat sound. Toggle mute — verify all audio stops and icon updates.

**Acceptance Scenarios**:

1. **Given** the Platformer theme is active, **When** the game starts in the `playing` phase, **Then** audio is muted by default and a speaker icon indicating muted state is visible in the HUD.
2. **Given** audio is enabled, **When** the character jumps, **Then** a short jump sound effect plays.
3. **Given** audio is enabled, **When** the character collects a coin, **Then** a coin collection sound effect plays.
4. **Given** audio is enabled, **When** the character stomps an enemy, **Then** a defeat sound effect plays.
5. **Given** audio is enabled, **When** the character breaks a destroyable block, **Then** a shatter sound effect plays.
6. **Given** audio is enabled, **When** the character opens a chest, **Then** a chest-opening sound effect plays; **When** the Thank You screen then appears (the last chest was just opened), a distinct fanfare/chime sound effect plays (**redesigned 2026-08-30** — replaces the superseded flagpole celebration fanfare this scenario originally described).
7. **Given** audio is enabled, **When** the character takes damage from an enemy, **Then** a damage sound effect plays.
8. **Given** audio is enabled, **When** the journal is opened or closed, **Then** a page-flip sound effect plays.
9. **Given** the game is playing, **When** the visitor clicks the speaker icon, **Then** all audio (music and effects) toggles on/off and the icon updates to reflect the current state.

---

### P3 Priority

### User Story 8 - Floating Controls and Theme/Locale Switching

As with all CV themes, floating translucent controls in the top-left corner provide theme switching and language toggling. These controls are accessible both during gameplay (pausing briefly when opened) and in the journal view. Switching locale updates the journal content to the selected language. Switching away from the Platformer theme and back resets the game state.

**Why this priority**: Standard theme infrastructure inherited from F-012 and F-013. It's P3 because the game and journal are the primary deliverables — controls are a polish item.

**Independent Test**: Verify floating controls visible. Switch theme — verify game is replaced. Switch locale — verify journal content updates. Switch back to Platformer — verify game resets.

**Acceptance Scenarios**:

1. **Given** the Platformer theme is active, **When** the page loads, **Then** floating translucent controls are visible in the top-left corner.
2. **Given** the visitor clicks the language toggle, **When** they switch locales, **Then** journal facts update to the selected language and in-game notifications use the selected language.
3. **Given** the visitor switches to another theme, **When** they switch back to the Platformer theme, **Then** the game resets to the start (fresh session, no collected facts).

---

### User Story 9 - Contextual Hint Signs and a Trimmed Controls Overlay (Priority: P3)

As a new visitor starts the game, a small translucent overlay listing the universal controls (movement, jump, journal toggle) appears briefly and disappears once they start playing. As they explore the level and reach a mechanic that needs explanation beyond the basics — like the one-way bridge — a signpost near it displays a short hint in a speech bubble when the character stands near it, without pausing the game. The hint disappears when the character walks away, and reappears if they return. Hint text is plain gameplay guidance, not CV content — signs are reusable and never added to the journal.

**Why this priority**: Onboarding polish. The game is fully playable without it, but a first-time visitor may not discover the movement keys or the drop-through bridge control. It's P3 because it doesn't gate core gameplay or CV content — a deliberate split between an upfront overlay for controls relevant from frame one and contextual, in-place signs for mechanics that only make sense once the player is standing at them.

**Independent Test**: Load the Platformer theme — verify the controls overlay appears and disappears after the first movement/jump input. Walk up to the bridge hint sign — verify a speech-bubble tooltip with hint text appears. Walk away — verify it disappears. Switch locale — verify hint text updates to match.

**Acceptance Scenarios**:

1. **Given** the game enters the `playing` phase for the first time this session, **When** the theme loads, **Then** a translucent overlay listing only universal controls (movement, jump, journal toggle) appears.
2. **Given** the controls overlay is visible, **When** the visitor presses a movement or jump key (or a short timeout elapses), **Then** the overlay disappears and does not reappear for the rest of the session.
3. **Given** a hint sign exists in the level, **When** the character's hitbox overlaps its trigger zone, **Then** a speech-bubble tooltip appears near the character showing the sign's hint text, without pausing the game or blocking movement.
4. **Given** a hint tooltip is visible, **When** the character no longer overlaps the sign, **Then** the tooltip disappears.
5. **Given** the visitor switches locale, **When** a hint tooltip is shown afterward, **Then** it displays in the newly selected language.
6. **Given** any hint sign is touched any number of times, **When** the visitor checks the journal or collected-fact state, **Then** nothing was added — signs carry no CV mapping and are not one-off collectibles.

---

### Edge Cases

- **Empty CV sections**: If a CV section has no data (e.g., empty `certificates` array), the journal bookmark for that section is hidden and no coins/blocks/enemies map to it.
- **Personality and Contact sections**: These sections appear as bookmarks in the journal but have **no counter** — there is only one piece of information per section, revealed via the level-end mechanism (superseded 2026-08-30 — see User Story 6; the reveal trigger is undecided, but the no-counter behavior itself still holds). Before the level end is reached, the bookmarks show the placeholder message.
- **Very few CV items**: If the CV has only 3-4 items total, the level is shorter with fewer collectibles, but the platforming experience remains — the level adapts proportionally.
- **Very many CV items**: If the CV has 20+ items, the level is longer and more populated with collectibles. The level design ensures the experience doesn't feel cluttered or overwhelming.
- **No CV data at all**: If `CVData` is empty or fails to load, the game still renders — a minimal platformer level with a message: "CV data not available. Try another theme!"
- **Rapid keyboard input**: Fast or simultaneous key presses must not cause the character to glitch through platforms or skip collision detection. Input is debounced/queued appropriately.
- **Browser tab loses focus**: When the visitor switches browser tabs, the game pauses automatically. Resuming the tab restores the game from the paused state.
- **Window resize**: The game canvas/viewport resizes to fit the browser window. Aspect ratio is maintained; empty space is filled with the background color.
- **Journal open during game events**: If the journal is open and the character would have been hit by an enemy (had the game not been paused), nothing happens — the game is fully paused.
- **Collectible counts at boundaries**: In Iteration 1 (coins only), only Skills and Languages appear as collectibles and in the journal. Experience, Education, Courses, Certificates, and Projects sections show the placeholder message until Iteration 2 when blocks and enemies are added. This is expected — each iteration incrementally unlocks CV sections.
- **Game state across page reload**: Game state (collected coins, defeated enemies, destroyed blocks) is NOT persisted across page reloads. Each visit is a fresh session.
- **Game state across death/respawn** (added 2026-08-27, see FR-020c): `collectedFacts` is preserved across a death/respawn — previously discovered CV content is never lost to a death. Enemies and destroyable blocks reset to their initial state on respawn (so the level plays the same each attempt) but grant no duplicate fact/fruit if re-collected; already-collected coins stay gone permanently rather than reappearing. Only the deliberate "Reset Game" button (FR-018b) clears `collectedFacts` and respawns coins too.
- **Game state across theme switches**: Switching to another theme and back resets the game to its initial state (fresh session, no collected facts). State is NOT persisted across theme switches.
- **Touch/mobile input**: The game is designed for keyboard input only. Mobile/touch controls are permanently out of scope (decided 2026-08-30) — no on-screen D-pad or action buttons are planned; see the "Out of Scope" section below.

## Requirements _(mandatory)_

### Functional Requirements

#### Game Engine & Rendering

- **FR-001**: System MUST render the Platformer theme as a full-viewport 2D side-scrolling game using an HTML `<canvas>` element, with a fixed aspect ratio that adapts to the browser window.

- **FR-002**: System MUST implement a game loop running at a consistent tick rate (30 FPS target) that processes input, updates game state, and renders each frame independently of frame timing.

- **FR-003**: System MUST manage game state through distinct phases: `loading` (assets loading), `playing` (active gameplay), `paused` (journal open or tab lost focus), and `ending-screen` (the Thank You screen shown once every chest is opened — **redesigned 2026-08-30**, see User Story 6; `ending-screen` pauses the game loop the same way `paused` does, and dismissing it — any key or click — returns to `playing`).

- **FR-004**: System MUST use the existing theme system infrastructure — `currentTheme` signal from `src/state/theme.ts`, `currentLocale`/`currentCV` signals from `src/state/locale.ts`. The theme is registered in the `themePages` map in `App.tsx` under the key `platformer`.

#### Player Character

- **FR-005**: System MUST render a pixel-art player character with at least three animation states: **idle** (standing still), **walk** (moving left/right), and **jump** (ascending/falling). The sprite faces the direction of movement.

- **FR-006**: System MUST implement character physics:
  - **Gravity**: Constant downward acceleration when not on a platform
  - **Jump**: Upward velocity impulse on jump key press; variable jump height based on key hold duration (short tap = small hop, long hold = full jump)
  - **Collision**: Character lands on platforms from above. All platforms are solid from every direction — the character cannot jump up through platforms from below. **Exception**: `bridge` tiles are one-way platforms — passable from below (the character can jump up through one) but solid when landing on top, per roadmap step 7. Holding Down (or `S`) while resting on a bridge deliberately drops the character through it.
  - **Horizontal movement**: Constant speed left/right with instant direction change

- **FR-007**: System MUST handle keyboard input: Arrow Left/Right for movement, Space for jump, Arrow Down or `S` to drop through a `bridge` tile the character is resting on. `A`/`D` are additionally accepted as alternates for Left/Right (a convenience discovered useful during development, e.g. for setups where arrow keys are intercepted before reaching the browser — the arrow-key requirement above is unaffected). **Redesigned 2026-08-30**: Arrow Up is no longer a jump key (was: Space or Arrow Up) — it's freed up for Arrow Up's new role opening a chest the character is standing on (FR-023) and, in the future, climbing (unscheduled — see roadmap.md's "Unscheduled additions"). Arrow Up is NOT used for journal navigation or any other UI interaction. Input is read per-frame so held keys produce continuous movement. **Amended 2026-08-30**: `KeyW` is additionally accepted as an alternate for Arrow Up's interact action (opening a chest), the same convention as `A`/`D` being alternates for Left/Right above — and, like `S` is already both the drop-through key and the future climb-down key, `W` is intended to double as the future climb-up key once that mechanic ships.

#### Level Design

- **FR-008**: System MUST construct a single continuous level (for v1) from left to right. The level consists of:
   - **Terrain tiles**: Ground, platforms, walls, slopes (angled surfaces) — solid blocks the character can stand on
  - **Collectibles (coins)**: Placed on platforms and in the air at varying heights
  - **Enemies** (P2): Patrol enemies on platforms
  - **Destroyable blocks** (P2): Blocks that can be destroyed by hitting from below
  - **Chests** (P2, **redesigned 2026-08-30**): the "main objective" collectible, hand-placed via markers scattered through the level like any other collectible — no special end-of-level position. Opening every chest in the level triggers the Thank You screen (see User Story 6); there is no separate flagpole-style location trigger.

- **FR-009**: System MUST map CV sections to specific game object types — each collectible type reveals content from assigned sections only:
  - **Coins** → Skills (**redesigned 2026-08-30**: Languages moved off coins — see the crate bullet below)
  - **Chests** (P2, **redesigned 2026-08-30**) → Experience — the level's "main objective" collectible; see User Story 6
  - **Destroyable blocks** → Education, Activities, Languages (crates only, **redesigned 2026-08-30** — Experience moved off crates onto the new chest collectible; Activities and Languages moved on, closing two previously-unmapped gaps — question-mark and rock blocks still carry no CV fact)
  - **Enemies** (P2) → Certificates, Projects (purple slimes), Courses (green slimes)
  - **Personality** → shown directly on the always-visible "About Me" journal bookmark (per FR-013's step-14 amendment), not via any in-level collectible
  - **Contact** → revealed only on the Thank You screen once every chest is opened (**redesigned 2026-08-30**, see User Story 6) — never added to the journal, no bookmark
  - **Amended 2026-08-28**: within the "Coins" collectible type, Skills and Languages were visually split — Skills render as `coin.png`, Languages as `fruit.png` — so a player could tell the two apart at a glance even though both were the same `sourceType: 'coin'` collectible mechanically. **Superseded 2026-08-30**: Languages moved off coins entirely onto crates (see the crate bullet above); this split no longer applies — `fruit.png` is now used only for the question-mark block's bonus pickup (FR-022b), which still carries no CV fact.
  - **Amended 2026-08-28**: a Skill coin represents a whole skill *category* (e.g. "Backend"), not one individual skill — the real CV data has too many individual skills to reasonably place one collectible each. Touching one category's coin adds every skill in that category to the journal's Skills section at once, shown as the category name with its skill list.
  - **Amended 2026-08-29**: Courses (12 CV entries) moved from destroyable blocks to green-slime enemies (see User Story 4 and FR-021's amendment) — the original "Experience, Education, Courses → blocks" mapping didn't fit once the block mechanic split into three narrower types. Purple slimes absorbed Projects alongside their original Certificates, replacing the original green=Projects/purple=Certificates split.

- **FR-010**: System MUST define level data in a structured format (TypeScript types or JSON) using a grid/raster system with width and height for easy element positioning. The level data specifies:
  - Terrain grid (tile positions)
  - Collectible positions with associated CV fact references
  - Enemy positions and patrol ranges (P2)
  - Destroyable block positions (P2)
  - Chest positions (P2, **redesigned 2026-08-30** — replaces the single flagpole position; chests are scattered via markers like any other collectible, see User Story 6)
  - Spawn point (level start)
  - Spawn points (invisible checkpoints throughout the level where the character respawns on death)
  - Level dimensions (width × height in tiles)

The level is hand-crafted — starting with a simple layout to validate functionality, then expanded iteratively.

#### Collectibles & CV Facts

- **FR-011**: System MUST associate each collectible (coin, enemy, block) with a specific CV fact entry — mapped by section and index into the `CVData` arrays. A collectible map is generated from `CVData` at theme load time.

- **FR-012**: System MUST display the actual CV fact text when a collectible is acquired. The fact text floats up from the collection point, hovers briefly near the character, then animates toward the journal icon (top-left, next to the hearts, per FR-025's amendment). The fact is added to the journal. Collected state per collectible is tracked for the session:
  - Its visual representation is removed from the game world
  - Its state is marked as collected in session state
  - The associated CV fact is added to the journal

- **FR-013**: System MUST ensure that every non-empty CV item in Skills, Languages, Experience, Education, Courses, Certificates, Activities, and Projects has at least one associated collectible in the level, mapped according to FR-009. Personality has no collectible — it is shown directly on the always-visible "About Me" journal bookmark. Contact has no collectible either — it is revealed only via the Thank You screen once every chest is opened (**redesigned 2026-08-30**, see User Story 6), and is never added to the journal. Empty CV sections produce no collectibles and hide their journal bookmark. **Amended 2026-08-28**: step 14 added the Personality/"About Me" bookmark ahead of schedule, per user request — it shows the CV's personality data (name, tagline, summary) directly rather than via a collected fact, since no collectible source exists for it. **Confirmed permanent 2026-08-30**: this is no longer provisional — the step 22 redesign settled on Personality staying exactly this way (About Me bookmark, no collectible, no level-end involvement). **Amended 2026-08-28 (step 16)**: collectible/enemy placement changed from auto-placement to intentional, hand-authored markers in the level layout (`S`/`E`/`M`/`C`/`F`/`T` — see `LevelParser.ts`, `T` added 2026-08-30 for chest markers), with no auto-placement fallback. A level's marker count now decides on-map coverage, not CVData's length — a mechanics-test level (like `level1` as of step 16) MAY cover only a slice of CVData without violating this requirement; full coverage is deferred to the final level design.

**Amended 2026-08-30**: the `F` marker was reassigned from the removed dead "fruit" collectible marker to the `fragileRock` block (previously `K`); the fruit-marker placement concept itself was removed entirely — no marker character maps to a "fruit" placement kind anymore (`entities/Fruit.ts`'s bonus-fruit sprite rendering, spawned by the question-mark block's hit mechanic, is unrelated and unaffected).

#### Journal

- **FR-014**: System MUST render the journal as a centered, bounded card/panel when activated (default key: `J`) — **not** a full-screen dark backdrop; the rest of the game (canvas, HUD) stays fully visible around it, since the journal card itself (per FR-015's notebook styling) is the visual takeover, not an added scrim. The journal pauses the game. Pressing `J` again or clicking a close button dismisses the journal and resumes the game. (Amended 2026-08-27: originally specified as a full-screen dark overlay; changed after seeing the initial unstyled implementation — a full-bleed dark backdrop wasn't the intended look.)

- **FR-015**: System MUST render the journal with:
  - **Notebook paper**: White/off-white page with blue horizontal ruled lines and a red margin line, on top of a slightly larger page underneath for depth
  - **Handwriting font**: `Caveat` (from Google Fonts), using the existing import pattern from `src/index.css`
  - **Bookmark tabs**: Colored tabs along the book's top-right edge, one per CV section shown in the journal, laid out left-to-right. The active tab extends further down; inactive tabs show a short peek. **Amended 2026-08-28**: originally specified as vertical tabs along the right edge; moved to the top-right after the real `bookmark_*.png` sprites turned out to be drawn as ribbons hanging from a top attachment point — a side layout looked wrong against that art.
  - **Section header** at the top of the active page
  - **Page counter**: removed (amended 2026-08-28, see FR-018) — no visible "N / M" text; bookmarks alone indicate more content exists

- **FR-016**: System MUST implement bookmark tab behavior:
  - Clicking an inactive tab makes it active (extends further) and switches the displayed section content
  - The previously active tab collapses to its inactive state
  - Tabs are colored distinctly per section, though with only 6 sprite colors for 8 sections two pairs intentionally share a color (courses/certificates, languages/personality) — accepted by the user as provisional until more distinct art exists
  - Each tab shows the section's icon rather than a text label — a rotated text label read as illegible at the tab's width (amended 2026-08-28, same round as the layout change above)
  - **Amended 2026-08-28**: the last selected bookmark section is remembered across closing and reopening the journal (not reset to the default every time)

- **FR-017**: System MUST render collected facts within the journal in the **Simple List** entry style (Option A from design mockups): clean bullet-point notes on lined paper with handwriting font, displaying key data fields concisely. Each fact entry includes the section-appropriate icon (🏢 for experience, 🎓 for education, etc.) and key data fields. Skills entries use star ratings (e.g., "TypeScript ★★★★☆").

- **FR-017b**: System MUST display a per-section collection counter near each section's header or bookmark (e.g., "Skills 3/5") showing how many facts have been collected out of the total for that section. **Exception**: Personality has no counter — there is only one fact, shown directly on the always-visible "About Me" bookmark rather than collected. Contact never appears in the journal at all (**redesigned 2026-08-30** — see User Story 6), so it has neither a bookmark nor a counter to consider.

- **FR-018**: System MUST paginate journal content as one continuous flat sequence of pages
  spanning the whole book, not scoped per section (amended 2026-08-28, superseding the same
  day's earlier per-section-pagination amendment below). Each non-empty section inserts its own
  pages into that sequence, per the user's own framing ("sections insert pages into it with
  content"): Personality and Languages each contribute exactly one page (Languages lists every
  collected language together, each with its own star rating); Skills, Experience, Projects,
  Education, Courses, and Certificates each contribute one page per collected fact (minimum one,
  showing an empty-state placeholder, so a section with nothing collected yet still has a page to
  land on) — Skills' page shows one category's skills as star-rated rows. Prev/Next arrow controls
  walk this flat sequence in section order and wrap around at both ends (Next from the book's last
  page returns to its first, and symmetrically for Prev) — there is no disabled state at either
  end. Clicking a bookmark tab jumps to that section's first page in the sequence; paging past a
  section boundary updates the active bookmark to match. Arrow controls are pixel-art chevron
  icons, hover-reveal only (invisible until the pointer is over that physical half of the book —
  left half reveals the left arrow, right half the right arrow — then fade in), not always
  visible. (Original text, superseded above: "System MUST paginate journal content within each
  section. If a section has more facts than fit on one page (approximately 5-7 entries per page),
  arrow buttons or page dots allow navigating forward/backward through that section's pages."
  Amended once already on 2026-08-28 to paginate one entry per page for long-entry sections while
  Skills/Languages stayed grouped — then revised again the same day, per further live user
  feedback, into the flat whole-book model described above.)

- **FR-018b**: System MUST include a "Reset Game" button in the journal overlay, rendered as a
  pixel-art icon (not a text label). Clicking it clears all collected facts and closes the journal
  immediately (no reverse-close animation), then starts the same iris-in transition used for a
  death/debug respawn, centered on the freshly-spawned player — reading as "starting again" rather
  than remaining open to show cleared placeholders. The game world resets to its initial state
  (character respawns at spawn point, all coins/enemies/blocks respawn). (Amended 2026-08-28 — was
  originally specified as the journal staying open afterward showing placeholder messages for all
  sections; changed per live user feedback after seeing the initial implementation.)

#### Enemies (P2)

- **FR-019**: System MUST render simple enemy characters that patrol horizontally on platforms. Enemies reverse direction at platform edges or designated patrol boundaries.

- **FR-020**: System MUST implement enemy interaction:
  - **Stomp defeat**: Character landing on top of an enemy defeats it with a poof/squish animation and reveals a CV fact — green slimes (Courses) are defeated in a single stomp; purple slimes (Certificates, Projects) take two stomps, with the fact revealed on the second, finishing stomp. Each stomp (finishing or not) gives the character a short upward bounce.
  - **Side/below collision**: Character takes damage (flashes, brief knockback) with invincibility frames; the enemy remains
  - Defeated enemies are removed from the game world for the session

- **FR-020b**: System MUST implement a 3-heart health system backed by 6 half-heart units, rendered via `hearts.png` (full/half/empty per heart icon). The character starts with 3 hearts (6/6 half-heart units) displayed in the HUD. Both damage sources share the same underlying `takeDamage(amount)` mechanism:
  - **Falling into a pit** costs half a heart, one half-heart unit (`takeDamage(1)`), and repositions the character to the last solid ground position before the fall — not a checkpoint reset.
  - **Side/below enemy collision** costs a full heart, two half-heart units (`takeDamage(2)`), with brief invincibility frames after taking damage.
  - At 0 hearts (from either source), the character respawns at the last checkpoint with full health (6/6 half-heart units restored), and all collected facts are preserved.

- **FR-020c**: System MUST reset enemies and destroyable blocks back to their initial patrol/intact state whenever the character respawns (the FR-020b death→respawn flow), so the level's layout and platforming challenge stay consistent across attempts — added 2026-08-27 alongside step 13's plan, ahead of steps 16/19 actually implementing enemies/blocks. **Coins are the exception**: an already-collected coin's visual representation stays removed for the rest of the session — it does not reappear on respawn. Because `collectedFacts` is preserved (FR-020b) while enemies/blocks respawn, re-triggering an already-collected source after a respawn (stomping a respawned enemy that was already defeated, or hitting a respawned block that was already broken) MUST NOT grant a duplicate CV fact or drop bonus fruit again — `CollectedFact` state is deduplicated by the source collectible's `id` (see `CollectibleDef.id`, FR-032), so a respawned enemy/block simply yields nothing on a repeat encounter. This is distinct from FR-018b's "Reset Game" button, which is a deliberate full reset that also clears `collectedFacts` and respawns coins too.

#### Destroyable Blocks (P2)

- **FR-021**: System MUST render three visually distinct destroyable block types, each a `BlockDef` entity placed via hand-authored level markers (not baked into terrain, consistent with FR-013's enemy/coin marker approach):
  - **Crate**: a wooden crate tile. Intact by default; shows a cracked overlay after one hit; breaks apart after a second hit. Carries Education, Activity, or Language facts (**redesigned 2026-08-30** — see FR-009).
  - **Question-mark**: one of five palette-matched `?` tiles (matching the surrounding terrain's color — brick, sandy, pink/red, teal, blue-gray); after a single hit, permanently swaps to that same palette's `!` tile.
  - **Rock**: a plain terrain-styled tile, visually distinct from both ordinary solid terrain and the palette's `?`/`!` tiles; breaks to empty space after a single hit.

  **Amended 2026-08-29**: replaces the original single block type (one `?`-marked tile, 3-hit crack progression, fruit dropped per hit, fact revealed on the third) — the tileset in use no longer includes a dedicated crack-progression sprite sheet, so the mechanic was redesigned around the assets actually available (a crate tile, five terrain-matched `?`/`!` pairs, and plain terrain tiles).

  **Amended 2026-08-30**: since blocks became fully solid physical obstacles (step 20's Task 11), the "hitting from above or the side has no effect" language in FR-022/FR-022b/FR-022c below refers only to the block's CV/hit *reaction* (crack, break, fruit-pop, convert-to-`!`) — not to collision. A block is solid from every direction regardless of hit count or hit direction; that's a separate, already-existing property (see FR-021's collision behavior), not something these FRs override.

- **FR-022**: System MUST implement the crate's hit mechanic: an upward hit from below on an intact crate shows a crack overlay with no fact or reward yet. A second upward hit breaks the crate apart with a shatter animation and reveals the associated CV fact (Education, Activity, or Language — **redesigned 2026-08-30**, see FR-009) — the fact text floats up from the break point, hovers briefly, then animates toward the journal icon, same as any other collectible. Hitting a crate from above or the side has no effect at either hit count (no crack/break reaction — the crate remains a solid obstacle from those directions either way, see the 2026-08-30 amendment above). **The crack overlay is a checked-in asset, `public/sprites/crack_overlay.png`** (generated 2026-08-29): a 16×16 transparent-background PNG derived from the existing `groundRock` terrain tile by thresholding its pixels by luminance (`lum<35` — tight enough to keep only the near-black outline, not the tile's dark-brown fill color), loaded like any other sprite and composited over the crate tile when `hitsTaken === 1`.

- **FR-022b**: System MUST implement the question-mark block's hit mechanic: a single upward hit from below spawns a bonus fruit (rendered from `fruit.png`, no CV fact — a pure reward for engaging with the mechanic, distinct from a coin so it's never mistaken for CV content) that rises into the space directly above the block and lands as a touchable pickup. The block itself permanently swaps to its matching `!` terrain tile and no longer responds to hits. Hitting from above or the side has no effect (no fruit-pop reaction; still solid, see the 2026-08-30 amendment above).

- **FR-022c**: System MUST implement the rock block's hit mechanic: a single upward hit from below breaks it immediately into empty space — no fruit, no fact, no reward. Rocks are not mapped to `CVData`; they exist purely as a level-design tool for shaping traversal (e.g. opening a shortcut or blocking one until broken). Hitting from above or the side has no effect (no break reaction; still solid, see the 2026-08-30 amendment above).

- **FR-022d**: System MUST play a short bump/nudge animation (the block moves up a few pixels then settles back, roughly 100ms) on every upward hit, for all three block types — including a block's terminal hit (crate's second hit, question-mark's and rock's only hit) — so every hit gets consistent tactile feedback regardless of which visual change (crack, shatter, convert-to-`!`, or disappear) also happens on it.

#### Chests & Level Completion (P2)

> **Redesigned 2026-08-30**: FR-023 and FR-024 below replace the flagpole mechanic
> (never implemented) with the chest/Thank-You-screen design from the roadmap step 22
> `brainstorming` session — see User Story 6.

- **FR-023**: System MUST render treasure chests as a new `ChestDef` entity, placed via hand-authored level markers (the `T` marker, consistent with FR-013's marker-based placement approach for coins/enemies/blocks) — one chest per non-empty Experience entry (per FR-009's zip-in-CVData-order convention, same as coins/enemies/crates). A chest sits flush with the ground (not solid — FR-006's platform-collision rules don't apply to it) and renders in its closed state (`chest_closed.png`) by default. **Redesigned 2026-08-30**: unlike every other collectible, opening a chest is NOT automatic on touch — when the character's hitbox overlaps a closed chest AND the visitor presses Arrow Up (freed up from jumping by FR-007's amendment), it permanently swaps to its open state (`chest_open.png` — never reverts to closed except via Reset Game) and the associated Experience fact text floats up from the chest, hovers briefly, then animates toward the journal icon, same as any other collectible. Merely overlapping a closed chest without pressing Arrow Up has no effect. A HUD chest counter (e.g. "Chests 2/5", positioned near the heart/coin HUD elements) tracks how many chests have been opened out of the level's total.

- **FR-024**: System MUST display the Thank You screen once the last chest in the level is opened: a centered overlay (following the same "game stays visible around it" pattern as the journal, per FR-014) showing a thank-you message, the CV's Contact information, and "press any button to continue" text beneath. Displaying the screen transitions `gamePhase` to `ending-screen`, pausing the game loop exactly like `paused` does. Any key press or click dismisses the screen, returning `gamePhase` to `playing` and resuming gameplay from the exact paused state — no separate "Replay Level" option is offered (Reset Game, FR-018b, already covers restarting). Contact is never added to `collectedFacts` or the journal; it exists only on this screen.

#### Controls & Theme Infrastructure (P3)

- **FR-025**: System MUST render the HUD during gameplay with the following layout:
  - **Top-left**: journal icon button (opens/closes the journal, same as `J` key), immediately left of the 3 hearts (health indicator). **Amended 2026-08-28**: originally specified as bottom-right; moved after step 14 shipped it there and it proved hard to spot against the level's terrain.
  - **Top-right**: Floating translucent controls — theme selector and language toggle (following the same pattern as the Space theme)

- **FR-026**: System MUST support locale switching: when `currentLocale` changes, journal content and in-game notifications re-render in the selected language while preserving game state and position.

#### Guidance & Onboarding (P3)

- **FR-036**: System MUST show a translucent controls overlay listing only universal controls (movement keys, jump key, journal toggle key) when gameplay first enters the `playing` phase. The overlay MUST auto-dismiss on the player's first movement or jump input, or after a short timeout, whichever comes first, and MUST NOT reappear for the remainder of the session.

- **FR-037**: System MUST render hint signs as a new non-solid, non-collectible level entity (`SignDef`), placed via hand-authored level markers. Each distinct hint gets its own single-digit marker character (`1`–`9`, consistent with FR-013's/FR-021's marker-based placement approach), mapped directly to a `hintId` in `LevelParser.ts`'s `SIGN_CHARS` table (e.g. `'1': 'bridgeDropThrough'`) — the character itself carries the hint's identity, independent of its position in the level layout, so the layout can be freely edited/reordered without breaking which sign shows which text. This is deliberately simpler than the CVData-order "zip" convention FR-013 uses for coins/enemies, since hint content is hand-authored, not pulled from an ordered CVData array — capped at 9 distinct hints total is an accepted constraint. Signs use the wooden signpost tile at `world_tileset.png` tile coordinates (col 8, row 3 → pixel 128,48), the tan/brown palette variant sitting directly beside the crate tile (col 7, row 3) already used by step 21 — confirmed by decoding the sprite sheet's pixels directly (a rose/pink palette variant also exists at pixel 128,64, unused for now).

- **FR-038**: System MUST display a sign's hint text in a speech-bubble tooltip near the character when the character's hitbox overlaps the sign's trigger zone, and hide it when the character no longer overlaps. This interaction MUST NOT pause the game, MUST NOT block movement (signs are not solid), and MUST NOT add anything to `collectedFacts` or the journal — hint text is not CV data, and signs are reusable rather than consumed on first touch.

- **FR-039**: System MUST source hint text from the existing i18n system (`src/i18n/locales/en.json`/`de.json`), NOT a bespoke dictionary — each hint's text lives under a new `platformer.hints.<hintId>` key (e.g. `platformer.hints.bridgeDropThrough`), read the same way existing platformer UI strings are (`currentUI.value.platformer.hints[hintId]`, per the pattern already used in `Journal.tsx`). Hint text is NOT derived from `CVData` and re-renders in the selected locale when `currentLocale` changes, consistent with FR-026 — this is "for free" from the existing translation signal, no bespoke locale-switching logic needed.

- **FR-040**: Initial hint signs cover contextual mechanics not included in the trimmed controls overlay (FR-036) — at minimum, a sign near the level's first one-way bridge explaining the Down/`S` drop-through control (FR-006/FR-007). Additional contextual signs (e.g. for a future ladder-climbing mechanic) are added only once that mechanic ships — out of scope until then.

#### Performance

- **FR-027**: System MUST use `requestAnimationFrame` for the game loop to synchronize with the browser's paint cycle.

- **FR-028**: System MUST pre-load all sprite assets (character, terrain tiles, coins, enemies, blocks, background) before entering the `playing` state. A loading indicator is shown during asset loading.

- **FR-029**: System MUST use sprite sheet atlases for character, enemies, and terrain tiles to minimize HTTP requests and texture swaps.

#### Component Structure (P1-P2)

- **FR-030**: System MUST organize Platformer theme components under `src/themes/platformer/`:
   ```
   src/themes/platformer/
    ├── PlatformerPage.tsx         # Root layout — canvas element, asset loading, theme registration
    ├── components/
    │   ├── GameCanvas.tsx          # Canvas element + game loop management
    │   ├── Journal.tsx             # Journal overlay — notebook, bookmarks, content
    │   ├── JournalPage.tsx         # Single journal page — renders facts for one section
    │   ├── BookmarkTabs.tsx        # Vertical bookmark tab strip
    │   ├── FloatingControls.tsx    # Theme and locale toggle (P3)
    │   ├── ControlsOverlay.tsx     # Universal controls overlay shown once at start (P3)
     │   └── ThankYouScreen.tsx       # Thank You screen — Contact reveal once all chests are opened (P2). Redesigned 2026-08-30: replaces the never-implemented flagpole EndingScreen, see User Story 6.
    ├── engine/
    │   ├── GameLoop.ts             # rAF-based game loop, state machine
    │   ├── Input.ts               # Keyboard input tracking per frame
    │   ├── Physics.ts             # Gravity, collision detection, movement
    │   ├── Camera.ts              # Viewport scrolling to follow character
    │   ├── Renderer.ts            # Canvas 2D rendering — sprites, tiles, effects
    │   └── SpriteLoader.ts        # Asset preloading and sprite sheet management
    ├── entities/
    │   ├── Player.ts              # Character state: position, velocity, animation frame
    │   ├── Collectible.ts         # Coin/collectible state and collision
    │   ├── Enemy.ts               # Enemy patrolling and collision (P2)
    │   ├── DestroyableBlock.ts    # Block state and hit tracking (P2)
    │   ├── Chest.ts                # Chest state — closed/open, per-chest fact (P2, added 2026-08-30)
     │   └── HintSign.ts             # Sign trigger-zone state and overlap detection (P3)
    ├── level/
    │   ├── LevelData.ts           # Type definitions for level structure
    │   ├── Terrain.ts             # Tile helpers — isSolid, tileAtPosition, tile-to-pixel conversion
    │   ├── level1.ts              # Level 1 data — terrain, collectibles, mappings
    │   ├── CollectibleMapper.ts   # Maps CVData to collectible placements
    │   └── ChestMapper.ts         # Maps CVData Experience entries to chest placements (added 2026-08-30)
    └── types.ts                   # Shared types for the platformer theme
   ```

#### State Management

- **FR-031**: System MUST manage game session state containing:
  - `gamePhase`: Current game state (`loading` | `playing` | `paused` | `ending-screen`)
  - `playerState`: Position, velocity, animation frame, facing direction, grounded status
  - `collectedFacts`: Set of collected fact IDs — used to determine which collectibles are still in the world and which CV facts appear in the journal
  - `cameraPosition`: Current viewport scroll offset
  - `enemyStates`: Per-enemy position, direction, defeated status (P2)
  - `blockStates`: Per-block hit count and broken status (P2)
  - `chestStates`: Per-chest open/closed status (P2, added 2026-08-30)

- **FR-032**: System MUST define TypeScript types for the platformer theme:
  - `GamePhase`: `'loading' | 'playing' | 'paused' | 'ending-screen'`
    (**Amended 2026-08-27**: step 10's death/respawn transition added two more
    phases, `'intro'` and `'dying'`/`'awaitingRestart'` — see
    `engine/GameLifecycle.ts`. Only `'dying'`/`'awaitingRestart'`/`'paused'`
    pause the game loop; `'intro'` (the iris growing open at mount/restart) is
    a purely visual overlay on top of already-running gameplay, so a pit near
    spawn is still live during it — a deliberate choice, not an oversight.)
  - `PlayerState`: `{ x: number; y: number; vx: number; vy: number; facing: 'left' | 'right'; grounded: boolean; animState: 'idle' | 'walk' | 'jump'; animFrame: number }`
  - `CollectibleDef`: `{ id: string; x: number; y: number; type: 'coin' | 'enemy' | 'block'; cvSection: SectionId; cvIndex: number }`
  - `CollectedFact`: `{ id: string; sectionId: SectionId; sectionLabel: string; data: CVItemData; sourceType: 'coin' | 'enemy' | 'block' }`
  - `BlockDef`: **amended 2026-08-30** — replaces the earlier aspirational shape below with what step 20 actually shipped: `{ id: string; blockKind: 'crate' | 'questionMark' | 'fragileRock'; fact?: CollectedFact }`. `fact` is present only on `crate` blocks (a `CollectedFact` drawn from Education, Activities, or Languages — **redesigned 2026-08-30**, was Experience/Education, see FR-009 — same shape as enemy/collectible facts); `questionMark` and `fragileRock` carry no CV mapping (amended 2026-08-29, see FR-021).
  - `ChestDef` (**added 2026-08-30**, see User Story 6 and FR-023): `{ id: string; fact: CollectedFact }`, mirroring `EnemyDef`'s static-def shape — `fact` is always present (drawn from Experience, one chest per non-empty entry). Placement adds `x`/`y` to produce `ChestPlacement extends ChestDef`, same `Def`→`Placement` convention as `EnemyPlacement`/`CollectiblePlacement`/`BlockPlacement`. Live per-instance open/closed state (`ChestState extends ChestPlacement { state: 'closed' | 'open' }`) mirrors `BlockState`'s `Def`→`Placement`→`State` layering, not baked into `ChestDef` itself. Placement adds `x`/`y` to produce `BlockPlacement extends BlockDef` (same `Def`→`Placement` convention already used for enemies/collectibles, e.g. `EnemyPlacement`/`CollectiblePlacement`) — `BlockPlacement` was not previously documented in this spec; this amendment is its first mention here. `hitsTaken`/`broken` — needed for the crate's 2-hit crack progression and any block's live "already broken" state — were deferred to the not-yet-implemented step 21 live-state design rather than being part of this static def; the original bullet below described them prematurely, before that design existed.
    <!-- superseded by the 2026-08-30 amendment above; kept for history only -->
    ~~`BlockDef`: `{ id: string; x: number; y: number; kind: 'crate' | 'questionMark' | 'rock'; hitsTaken: number; broken: boolean; cvSection?: SectionId; cvIndex?: number }` — `cvSection`/`cvIndex` are only present on `crate` blocks; `questionMark` and `rock` carry no CV mapping (amended 2026-08-29, see FR-021).~~
  - `LevelDef`: `{ terrain: TileMap; collectibles: CollectibleDef[]; enemies: EnemyDef[]; blocks: BlockDef[]; chests: ChestDef[]; signs: SignDef[]; spawn: Point; width: number; height: number }` — **redesigned 2026-08-30**: the earlier `flagpole: Point` field is removed entirely (no replacement `levelEnd: Point` either) — chests have no single level-end position; the Thank You screen (FR-024) triggers once every entry in `chests` is `'open'`, computed from `chestStates`, not from a spawn/position check.
  - `SignDef`: `{ id: string; x: number; y: number; hintId: string }` — `hintId` looks up localized text at `platformer.hints.<hintId>` in the existing i18n translation files (`src/i18n/locales/en.json`/`de.json`); no `cvSection`/`cvIndex`, since signs carry no CV mapping (P3, see FR-037).

#### Testing

- **FR-033**: System MUST include unit tests covering:
  - `CollectibleMapper` — correct mapping of CVData to collectible definitions per FR-009 (Skills → coins, Education/Activities/Languages → crate blocks, Certificates/Projects → purple slimes, Courses → green slimes)
  - `ChestMapper` (**added 2026-08-30**) — correct mapping of CVData Experience entries to chest definitions per FR-009/FR-023; Personality has no collectible (shown on the About Me bookmark) and Contact has no collectible (shown on the Thank You screen only) — neither should ever be produced by any mapper
  - `Physics` — gravity, jump arc, collision with platforms, collision with pits
  - `Input` — keyboard event parsing, key held vs pressed
  - Journal content rendering with sample CV data
  - Collected fact tracking (add fact, check if collected, persist across respawn)
  - Game state transitions (`playing` → `paused` → `playing`)

- **FR-034**: System MUST include component tests covering:
  - `PlatformerPage` renders canvas element
  - `Journal` renders with correct sections based on CV data
  - `BookmarkTabs` active/inactive states
   - `ThankYouScreen` displays the thank-you message and Contact info once all chests are open (P2, **added 2026-08-30**, see User Story 6)

#### Audio (P2)

- **FR-035**: System MUST support audio playback including a looping background music track and sound effects for game actions (jump, coin collection, enemy stomp, block break, damage, journal open/close). A level-end celebration sound effect is TBD, pending the roadmap step 22 redesign (superseded 2026-08-30 — was a flagpole celebration, see User Story 6). Audio is muted by default — playback requires visitor opt-in via a speaker icon in the HUD. Audio assets are pre-loaded alongside sprite assets (per FR-028) before entering the `playing` state. The audio state (muted/unmuted) is tracked in game session state.

### Key Entities

- **Player (character)**: The visitor's avatar in the game world. State includes position (x, y), velocity (vx, vy), animation state (idle/walk/jump), facing direction, and grounded flag.

- **Level**: The game world — a side-scrolling environment defined by terrain tiles, collectible placements, enemy placements, spawn point, and a level-end point (superseded 2026-08-30 — no longer a flagpole; replacement TBD, see User Story 6). In v1, one continuous level covers all CV sections in order.

- **Collectible**: An item in the game world that, when acquired by the player, reveals a CV fact. Types: coin (Skills — P1, **redesigned 2026-08-30**: Languages moved to crates), enemy defeat (Certificates, Projects on purple slimes, Courses on green slimes — P2), crate block break (Education, Activities, Languages — P2, **redesigned 2026-08-30**, was Experience/Education). Each collectible is mapped to a specific CV data item by section.

- **Chest** (P2, **added 2026-08-30**): A `ChestDef` entity — the level's "main objective" collectible, distinct from ordinary `Collectible`s. Starts `closed` (`chest_closed.png`); touching it permanently swaps to `open` (`chest_open.png`) and reveals its associated Experience fact. Tracked by its own HUD counter, separate from coins/hearts. See User Story 6, FR-023.

- **Destroyable Block**: A `BlockDef` entity that responds to upward hits from below. Three kinds (amended 2026-08-29, see FR-021): **Crate** (2 hits — crack overlay, then breaks and reveals an Education/Activity/Language fact, **redesigned 2026-08-30**), **Question-mark** (1 hit — spawns a bonus fruit, then permanently converts to a matching `!` terrain tile, no fact), **Rock** (1 hit — breaks to empty space, no fact, no reward, pure level-design filler).

- **Bonus pickup**: An item spawned by a question-mark block on its single hit (rendered as a fruit) — unlike a `Collectible`, it carries no CV fact and isn't mapped to `CVData`. Purely a reward for engaging with the block-hit mechanic.

- **Hint Sign** (P3): A non-solid, non-collectible level entity that shows a localized gameplay hint (not a CV fact) in a speech-bubble tooltip while the character overlaps it. Reusable — never consumed, never added to `collectedFacts` or the journal. Teaches contextual mechanics (e.g. the one-way bridge drop-through) that the trimmed controls overlay deliberately excludes.

- **CollectedFact**: A record of a discovered CV fact — links the CV data item to its source collectible type. The collection of all `CollectedFact` objects is the session's discovered CV content.

- **Journal**: The notebook overlay where collected CV facts are readable. Consists of bookmark tabs (one per CV section), paginated pages, and Simple List entry styling.

- **CV Data** (from F-002): Read via `currentCV.value`. All collectible mappings and journal content derive from `CVData`. Locale switching updates content.

**Entity Relationships**:
```
CVData (from currentCV signal)
 ├── Mapped by CollectibleMapper → CollectibleDef[] (placed in level)
 └── Referenced by CollectedFact[] (when collectibles are acquired)

Level
 ├── Contains CollectibleDef[] (coin/enemy/block positions)
 ├── Contains ChestDef[] (added 2026-08-30 — replaces the removed flagpole field)
 ├── Contains Terrain (platform tiles, collision data)
 └── Defines spawn and checkpoint positions

Player
 ├── Collides with Terrain (stands, jumps, falls)
 ├── Collides with Collectible → triggers fact collection
 ├── Collides with Chest → opens it, triggers fact collection (added 2026-08-30)
 └── Tracked by Camera (viewport follows player)

Session State
 ├── CollectedFact[] — which facts have been discovered
 ├── PlayerState — current position, animation
 ├── chestStates — per-chest open/closed (added 2026-08-30; all chests open → ending-screen)
  └── GamePhase — playing, paused, ending-screen

Journal
 ├── Reads CollectedFact[] to render discovered content
 ├── Groups facts by section (for bookmark tabs)
 └── Paginates content within sections

FloatingControls (P3)
 ├── Reads currentTheme / currentLocale signals
 └── Writes to currentTheme / calls changeLocale()
```

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Core platformer mechanics work**: A visitor can control a character that moves left/right, jumps, lands on platforms, and is followed by a scrolling camera. Character animations (idle, walk, jump) are visibly distinct. Verified by: manual play test.

- **SC-002 — Every CV item has a collectible**: Each non-empty item in Skills, Languages, Experience, Education, Courses, Certificates, Activities, and Projects maps to at least one collectible in the level according to the FR-009 mapping (**redesigned 2026-08-30**: Experience → chests; Languages/Activities/Education → crates). Personality is excluded (shown directly on the About Me journal bookmark) and Contact is excluded (revealed only via the Thank You screen once all chests are opened). Verified by: unit test.

- **SC-003 — Collecting reveals journal content**: When a visitor collects all coins and defeats all enemies and destroys all blocks, the journal contains all CV facts from Skills, Languages, Certificates, Projects, Experience, Education, and Courses, organized by section with functional bookmark tabs. Verified by: component test that simulates collecting everything and checks journal content.

- **SC-004 — Journal is readable**: The journal renders with lined-paper background, `Caveat` handwriting font, colored bookmark tabs, and Simple List entry style. A non-technical person can read and understand all CV facts. Verified by: visual review and component test for correct rendering.

- **SC-005 — Game runs at 30 FPS**: The game loop maintains consistent 30 FPS on a modern desktop browser (Chrome/Firefox) with the character, terrain, and 20+ collectibles rendered. Verified by: frame timing instrumentation in test.

- **SC-006 — Theme and locale switching work**: Switching to another theme replaces the game. Switching locale updates journal content. Switching back to Platformer resets the game. Verified by: component tests that exercise theme/locale signals.

- **SC-007 — Zero TypeScript errors**: The entire Platformer theme implementation compiles under `strict: true` with no `any` types and no `@ts-ignore` directives. Verified by: `npm run build` passes cleanly.

- **SC-008 — Asset loading completes before gameplay**: All sprite sheets and game assets are pre-loaded before the `playing` state begins. A loading indicator is visible during asset loading. Verified by: test that checks game phase transitions.

## Assumptions

- **F-002 (Data Model) is complete**: `CVData` types and both `cv.en.json` / `cv.de.json` files exist and are importable. S-006 consumes these, does not create or modify them.
- **F-012 (Theme System) is available**: `createLocalStorageSignal`, `currentTheme` signal, `ThemeId` type, and theme registration in `App.tsx` all exist.
- **F-013 (Multilanguage) is complete**: `currentLocale`, `currentCV` computed signals, and `changeLocale` function exist in `src/state/locale.ts`.
- **Desktop-only**: The Platformer theme is designed for desktop with keyboard input only. Mobile/touch controls are permanently out of scope (decided 2026-08-30), not a deferred enhancement.
- **Single level in v1**: Iteration 1 ships with one continuous level covering all CV sections. Additional levels per section can be added in future iterations.
- **HTML5 Canvas for rendering**: The game uses Canvas 2D API (not WebGL/three.js), keeping the implementation simple and aligned with the "simple 2D platformer" scope.
- **Sprite assets from existing mockup images**: The 10 existing sprite images in `specs/S-006-platformer-theme/images/` are the basis for game assets — character, enemies, coins, terrain, blocks. **Redesigned 2026-08-30**: the flagpole asset was never used and the mechanic is dropped; `chest_closed.png`/`chest_open.png` (16×16 native canvas, cropped to their tight non-square bounding box and downscaled with nearest-neighbor sampling — 28×20 and 24×20 respectively — transparent background) were generated to replace it, checked in under `public/sprites/`.
- **Game state is session-only**: No localStorage or backend persistence. Collected facts reset on page reload or theme switch.
- **`Caveat` font from Google Fonts**: Journal handwriting font uses the existing font import pattern. Falls back to system cursive fonts if unavailable.
- **Journal uses Simple List style (Option A)**: Based on the existing `entry-styles-mockup.html`, the chosen entry style for journal content is the Simple List approach — clean bullet-point notes with key data fields.
- **Audio is muted by default**: Audio playback (background music + sound effects) requires visitor opt-in via the speaker icon in the HUD. Audio assets are pre-loaded alongside sprite assets.
- **Spawn points throughout the level**: Invisible spawn points defined in the level data serve as checkpoints. The character respawns at the nearest spawn point on death.
- **Collision uses simple AABB (Axis-Aligned Bounding Box)**: Physics and collision detection use rectangular hitboxes, not pixel-perfect collision. This is standard for retro-style platformers.
- **Fixed sprite sizes**: Character, enemy, coin, and block sprites have fixed pixel dimensions (e.g., 32×32 or 16×16 tiles). The canvas is scaled to fit the viewport while maintaining the pixel-art aesthetic. **Exception (added 2026-08-30)**: chests are a non-square 28×20 / 24×20 native size (see the Sprite assets note above) — they need their own render-size constant rather than reusing the 16×16 `BLOCK_FRAME_SIZE` convention.
- **Personality has no collectible; Contact is Thank-You-screen-only (redesigned 2026-08-30)**: Personality is shown directly on the always-visible "About Me" journal bookmark, never via a collectible. Contact is NOT placed as a collectible either — it's revealed exclusively via the Thank You screen once every chest in the level is opened (see User Story 6), and is never added to the journal.

## Clarifications

### Session 2026-08-05

- **Q: Damage & Health System** — **A**: 3-heart health backed by 6 half-heart units, checkpoint respawn at 0 health. Character has 3 hearts (`hearts.png`, full/half/empty), brief invincibility frames on hit. Pit falls cost half a heart and reposition the character to the last solid ground (no checkpoint reset); enemy side/below collision costs a full heart — both use the same `takeDamage(amount)` mechanism. At 0 health: respawn at nearest spawn point with full health, collected facts preserved. No game-over screen.
- **Q: Platform Behavior** — **A**: All platforms are solid from every direction. Character cannot jump up through platforms from below. **Exception (added at roadmap step 7)**: `bridge` tiles are one-way — passable from below, solid from above — since a rope/plank bridge is the one terrain type where that behavior reads as natural rather than surprising. **Update (roadmap step 7, level redesign)**: a Down-arrow/`S` "drop through" key was added once `level1` gained a platform-bridge-platform arrangement with reachable ground underneath — the condition the original clarification held it back for.
- **Q: Level Design Approach** — **A**: Hand-crafted level using a grid/raster system with width and height for easy element positioning. Start with a simple level to validate functionality, then expand iteratively.
- **Q: Checkpoint System** — **A**: Invisible spawn points defined in the level data. Character respawns at the nearest spawn point on death.
- **Q: HUD Layout** — **A**: Top-left: 3 hearts. Top-right: theme and language selector (like Space theme). Bottom-right: journal icon button.
- **Q: Checkpoint Persistence Across Theme Switches** — **A**: Not in v1. Checkpoints only matter within a single session (for respawn after death). Switching themes always resets. May revisit this as a future enhancement.

### Session 2026-08-29

- **Q: Destroyable block redesign (roadmap step 20)** — **A**: the tileset in active use no longer includes a dedicated crack-progression block sprite sheet; the original single 3-hit block type is replaced by three distinct types built from what the tileset actually has — a wooden crate tile, five terrain-matched `?`/`!` tile pairs, and plain terrain tiles. **Crate**: 2 hits (crack overlay, then break + reveal an Experience/Education fact). **Question-mark**: 1 hit (spawns a bonus fruit, converts permanently to the matching `!` tile, no fact). **Rock**: 1 hit (breaks to empty space, no fact, no reward — pure level-design filler, not mapped to `CVData`). Crack visuals are drawn programmatically as a canvas overlay rather than a new sprite. A short bump/nudge animation plays on every below-hit across all three types, including each type's terminal (breaking/converting) hit.
- **Q: Enemy section remapping** — **A**: Courses (12 CV entries) is too large a pool to share the crate mechanic with Experience/Education, so it moves to enemies instead: green slimes (1-hit) now carry Courses exclusively, replacing their original Projects mapping; purple slimes (2-hit) carry the combined Certificates + Projects pool, replacing their original Certificates-only mapping. See FR-009's and User Story 4's amendments.

### Session 2026-08-30

- **Q: Is the flagpole still planned?** — **A**: No — removed as a mechanic. The level still needs a defined end that reveals Personality + Contact (User Story 6's underlying goal stands), but the concrete replacement (visual marker, trigger, whether a dedicated ending-screen overlay still exists) is undecided. Every flagpole-specific requirement, success criterion, and data-model field (FR-023, FR-024, FR-003's `ending-screen` phase, SC-002, `LevelDef.flagpole`, etc.) is marked superseded/TBD throughout this spec rather than rewritten, since the replacement design doesn't exist yet — see roadmap step 22, which needs its own `brainstorming`/`writing-plans` pass before these can be rewritten for real.
- **Q: Is mobile/touch support still planned for a later iteration?** — **A**: No — permanently out of scope, not a deferred P3 enhancement. Roadmap step 28 ("Touch/mobile controls") was removed entirely rather than kept as a placeholder.
- **Q: Does switching themes and back already reset the game?** — **A**: No, not yet — confirmed by tracing `PlatformerPage.tsx`/`PlatformerState.ts`: gameplay state lives in module-level `signal()`s that survive the component unmount/remount a theme switch causes, so the game currently resumes exactly where it was left. FR/SC text describing theme-switch reset as already working is aspirational, describing the intended behavior of roadmap step 28 (Theme-switch reset, renumbered 2026-08-30 when step 23/Ladders was promoted ahead of it), which remains unimplemented.

### Session 2026-08-30 (roadmap step 22 brainstorming)

- **Q: What replaces the flagpole as the level-end mechanism?** — **A**: Treasure chests — a new "main objective" collectible (visually and mechanically distinct from coins/fruit/crates), each carrying an Experience fact (the CV section considered most valuable). A chest starts closed and, unlike every other collectible, does NOT open on touch — the character must be standing on/overlapping it and press Arrow Up to open it, permanently swapping it to its open state and revealing its fact like any other collectible (see FR-023). A dedicated chest counter in the HUD (e.g. "Chests 2/5") makes the objective visible at a glance. Once every chest is opened, a Thank You screen appears wherever the visitor happens to be — no location-based trigger, no flagpole, no pole-slide animation.
- **Q: What does the Thank You screen show, and does it block play?** — **A**: A thank-you message, the CV's Contact information, and "press any button to continue" text. It pauses the game (`gamePhase: 'ending-screen'`) and is dismissed by any key/click, resuming exactly where play left off — deliberately non-blocking so a visitor can still mop up remaining coins/crates. No "Replay Level" option (Reset Game already covers restarting). Contact is shown only here — never added to the journal, no bookmark.
- **Q: Experience moves off crates onto chests — what fills the gap on crates?** — **A**: Crates pick up Activities (previously unmapped anywhere) and Languages (previously removed as standalone fruit collectibles in step 21, left unmapped since). Crates now carry Education + Activities + Languages. Coins narrow to Skills only.
- **Q: Does Personality/Contact still share a "level-end mechanism" the way the original flagpole design implied?** — **A**: No — they're deliberately decoupled now. Personality was already moved to the always-visible "About Me" journal bookmark back in step 14 and stays there permanently (no longer provisional). Contact is the only thing left revealed by the new chest-driven mechanism, via the Thank You screen only.
- **Q: Where are chests placed in the level?** — **A**: Scattered via hand-placed markers, the same pattern as coins/enemies/blocks (a new `T` marker in `LevelParser.ts`) — not clustered at the level's end, since there's no single trigger location anymore.
- **Q: What sprites were needed, and how were they made?** — **A**: `chest_closed.png`/`chest_open.png` — no chest art existed anywhere in `public/sprites/` or `world_tileset.png` before this. Generated via nano-banana (flat, front-facing 2D style matching the existing crate tile — an initial 3/4-angled "isometric" attempt was rejected as inconsistent with the game's flat 2D tile art), both states in a single generation call for visual consistency, on a solid magenta background for chroma-keying. Cropped tightly to each chest's bounding box (removing magenta padding) before downscaling with nearest-neighbor sampling (not a smoothing filter — smoothing blurred a 500+px source down to a small sprite into an unrecognizable blob) to a small non-square size (28×20 closed, 24×20 open) — kept non-square and a bit larger than the 16×16 block grid since a chest is a standalone placed object, not wall-adjacent, and doesn't need to tile.

## Iteration Plan

This feature is intentionally scoped for incremental delivery:

| Iteration | Priority | Scope | Key Deliverables |
|-----------|----------|-------|-----------------|
| **1** | P1 | Core platformer + coins + journal | Player movement, level terrain, coin collectibles (Skills + Languages), journal with bookmarks, CV fact mapping |
| **2** | P2 | Enemies + blocks + chests + level end + audio | Enemy patrol and stomp (Certificates + Projects on purple slimes, Courses on green slimes), destroyable blocks (Education + Activities + Languages via crates, **redesigned 2026-08-30**; question-mark and rock blocks add bonus/level-design mechanics with no CV mapping), chests (Experience, **added 2026-08-30**) with a HUD counter, Thank You screen revealing Contact once all chests are opened, game audio (background music + sound effects, muted by default — step 24, renumbered 2026-08-30, not yet implemented) |
| **3** | P3 | Controls + polish | Floating theme/locale controls, universal controls overlay, contextual hint signs, visual polish |

Each iteration is independently shippable and adds gameplay depth without breaking previous functionality.

## Out of Scope

- **Mobile/touch controls** — permanently out of scope, not planned (decided 2026-08-30)
- **Multiple levels** (v1 ships with one level; additional levels are future enhancements)
- **Score tracking or leaderboards**
- **Boss enemies or complex enemy AI** (simple patrol-only in P2)
- **Power-ups or character abilities beyond walk/jump**
- **Level editor or user-created content**
- **WebGL/3D rendering** (Canvas 2D only)
- **Online multiplayer or sharing**
- **Game state persistence across sessions** (localStorage save/load is a future enhancement)
- **Responsive layout below 1024px** (desktop-only, consistent with other themes)
- **Keyboard remapping** (fixed controls: arrows + space/J)
- **Print-friendly styling for the journal**
- **Ladder-climbing mechanic** (and its corresponding hint sign) — not yet implemented; a hint sign for it is out of scope until the mechanic itself ships (see FR-040)
