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
3. **Given** the character is standing on a platform, **When** the visitor presses the spacebar or up arrow, **Then** the character jumps upward, reaches a peak, and falls back down — landing on platforms or falling into pits.
4. **Given** the character is moving left, **When** the visitor presses the right arrow key, **Then** the character reverses direction and the sprite faces right.
5. **Given** the character falls into a pit, **When** the fall occurs, **Then** the character loses half a heart and reappears at the last solid ground position before the fall. **Given** the character loses all hearts, **When** the death occurs, **Then** the character respawns at the nearest spawn point with full health and all collected facts preserved.

---

### User Story 2 - Collect Coins to Discover Skills and Languages (Priority: P1)

As the visitor explores the level, they encounter floating gold coins scattered across platforms and in the air — some easy to reach, others requiring tricky jumps. Each coin is associated with a Skill or Language entry from the CV. When the character touches a coin, it disappears with a sparkle effect, and the actual CV fact text (e.g., "TypeScript ★★★★☆") floats up from the collection point, hovers briefly near the character, then animates toward the journal icon in the bottom-right corner. The fact is added to the visitor's journal under the Skills section.

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
2. **Given** the journal is open, **When** the visitor observes it, **Then** it renders as an open notebook with lined paper, handwriting-style font, and colored bookmark tabs along the right edge — one per non-empty CV section.
3. **Given** one section's bookmark is active (extended, showing its label), **When** the visitor clicks a different bookmark tab, **Then** that tab extends with its label visible, the previously active tab collapses to a thin sliver, and the notebook content switches to that section's facts.
4. **Given** the journal is open, **When** the visitor views any section, **Then** a counter near the section header or bookmark shows how many facts have been collected out of the total for that section (e.g., "Skills 3/5"), so the player knows whether there are still undiscovered facts.
5. **Given** CV sections have no collected facts yet, **When** the journal is opened, **Then** those sections show a placeholder message like "No facts discovered yet — keep exploring!" and the counter shows "0/N".
6. **Given** the journal is open, **When** the visitor presses `J` again (or clicks the close button), **Then** the journal overlay closes and the game resumes from the exact paused state.
7. **Given** the journal is open at any point, **When** the visitor clicks the "Reset Game" button, **Then** all collected facts are cleared, the journal shows placeholder messages for all sections, the game resets to the spawn point, and all coins/enemies/blocks respawn in the level.

---

### User Story 4 - Defeat Enemies to Reveal Certificates and Projects (Priority: P2)

Scattered through the level are simple enemy characters (e.g., slime-like creatures) that patrol back and forth on platforms. Each enemy is associated with a Certificate or Project entry from the CV. The visitor can defeat an enemy by jumping on top of it (stomp mechanic). When defeated, the enemy disappears in a poof animation and the actual CV fact text floats up from the defeat point, hovers briefly, then animates toward the journal icon. The fact is added to the visitor's journal under the Certificates or Projects section. Defeated enemies stay defeated for the session.

**Why this priority**: Enemies add gameplay depth and reward exploration. They're P2 because coins already deliver Skills and Languages — enemies unlock Certificates and Projects, which are distinct CV sections that require skilled play to discover.

**Independent Test**: Approach an enemy — verify it patrols. Jump on top of it — verify it's defeated with a poof effect and the certificate/project fact text appears. Open journal — verify the fact appears in Certificates or Projects section. Revisit the area — verify enemy is gone.

**Acceptance Scenarios**:

1. **Given** an enemy is patrolling on a platform, **When** the character jumps and lands on top of the enemy, **Then** the enemy is defeated with a poof/squish animation and the associated certificate or project fact text floats up, hovers, and flies to the journal icon.
2. **Given** an enemy is defeated, **When** the visitor opens the journal, **Then** the certificate or project fact appears in the Certificates or Projects section respectively, styled as a simple list entry.
3. **Given** the character collides with an enemy from the side or below, **When** contact occurs, **Then** the character takes damage (flashes briefly with invincibility frames), loses one full heart, and is pushed back slightly, using the same damage mechanism as pit falls (step 9) but with a full heart instead of a half heart. The character has 3 hearts total. At 0 hearts, the character respawns at the last checkpoint with full health and all collected facts preserved.
4. **Given** the character respawns after falling, **When** they revisit an enemy location, **Then** previously defeated enemies remain defeated for the session.

---

### User Story 5 - Destroy Blocks to Uncover Experience, Education, and Courses (Priority: P2)

Some platforms contain destroyable blocks marked with a subtle question mark. Each block is associated with an Experience, Education, or Course entry from the CV. When the character jumps and hits a destroyable block from below (Mario-style bump), the block cracks. It takes **3 hits** to fully destroy — each hit drops a fruit (as a bonus pickup, no CV fact — visually distinct from the Skills/Languages coins so a fruit is never mistaken for a coin's CV meaning), and the final hit breaks the block apart with a shatter animation and reveals the associated CV fact. The fact text floats up from the break point, hovers briefly, then animates toward the journal icon. The fact is added to the journal under the Experience, Education, or Courses section.

**Why this priority**: Destroyable blocks add vertical exploration and a multi-hit mechanic. They're P2 because they're a secondary mechanic — coins and enemies already deliver the main content flow. Blocks reward persistent exploration with Career and Education facts.

**Independent Test**: Find a marked destroyable block. Jump and hit it from below — verify it cracks and drops a fruit each hit. After 3 hits — verify it breaks and the experience/education/course fact text appears. Check journal — verify the fact is added in the correct section.

**Acceptance Scenarios**:

1. **Given** a destroyable block exists on a platform, **When** the character jumps and collides with it from below, **Then** the block cracks (visually progressing through crack states) and drops a fruit.
2. **Given** a destroyable block has been hit fewer than 3 times, **When** the character hits it again from below, **Then** it shows increasingly cracked visual states and drops another fruit with each hit.
3. **Given** a destroyable block has been hit 3 times, **When** the final hit occurs, **Then** the block breaks apart with a shatter animation and the associated experience, education, or course fact text floats up from the break point, hovers, and flies to the journal icon.
4. **Given** a destroyable block is destroyed, **When** the visitor opens the journal, **Then** the fact appears in the Experience, Education, or Courses section, styled as a simple list entry.
5. **Given** the character hits a destroyable block from above or the side, **When** contact occurs, **Then** the block is not affected — only upward hits from below trigger the break mechanic.

---

### User Story 6 - Reach the Flagpole to Reveal Personality and Contact (Priority: P2)

At the far right end of the level stands a flagpole with a sliding flag. When the character jumps onto it, a celebration animation plays (character slides down the pole, flag waves). An ending screen appears showing the Personality section (personal summary / about me) and Contact information. After the ending screen is dismissed, the Personality and Contact facts are also added to the journal — with their own bookmarks but **no counter** (since there is only one piece of information per section). The visitor can choose to replay the level or close the ending screen.

**Why this priority**: The flagpole provides closure and a satisfying end state, while revealing the Personality and Contact sections that don't fit the collectible mechanic. It's P2 because the core loop (play → collect → read) is already complete without it — but it adds important psychological satisfaction and a sense of completion.

**Independent Test**: Play through the level to the rightmost edge. Jump onto the flagpole — verify celebration animation plays. Verify ending screen appears with Personality and Contact info. Dismiss the ending screen and open the journal — verify Personality and Contact bookmarks appear with the facts but no counter. Verify options to replay or close.

**Acceptance Scenarios**:

1. **Given** the character reaches the flagpole at the level's right end, **When** they jump onto the pole, **Then** a celebration animation plays (character slides down, flag waves) and the ending screen overlay appears.
2. **Given** the ending screen is displayed, **When** the visitor reads it, **Then** it shows the Personality section content and Contact information.
3. **Given** the ending screen is dismissed, **When** the visitor opens the journal, **Then** Personality and Contact bookmarks appear with the facts displayed, but without a per-section counter.
4. **Given** the ending screen is visible, **When** the visitor clicks "Replay Level", **Then** the level resets — all coins, enemies, and blocks are restored, journal is cleared, and the ending screen is dismissed.
5. **Given** the ending screen is visible, **When** the visitor presses `J`, **Then** the ending screen closes and the journal opens (with all previously collected facts still available).

---

### User Story 7 - Game Audio (Priority: P2)

A looping background music track and sound effects enhance the platformer experience. Sound effects play for key actions: jumping, collecting a coin, stomping an enemy, breaking a block, reaching the flagpole, taking damage, and opening/closing the journal. A small speaker icon in the top-right HUD area allows the visitor to toggle all audio on/off. Audio is muted by default and must be enabled by the visitor.

**Why this priority**: Audio feedback makes gameplay more engaging and provides clear confirmation of game actions, but the game is fully playable without it.

**Independent Test**: Load the Platformer theme — verify audio is muted by default and speaker icon shows muted state. Click the speaker icon to enable — verify background music starts playing. Jump — verify jump sound effect. Collect a coin — verify coin sound. Stomp an enemy — verify splat sound. Toggle mute — verify all audio stops and icon updates.

**Acceptance Scenarios**:

1. **Given** the Platformer theme is active, **When** the game starts in the `playing` phase, **Then** audio is muted by default and a speaker icon indicating muted state is visible in the HUD.
2. **Given** audio is enabled, **When** the character jumps, **Then** a short jump sound effect plays.
3. **Given** audio is enabled, **When** the character collects a coin, **Then** a coin collection sound effect plays.
4. **Given** audio is enabled, **When** the character stomps an enemy, **Then** a defeat sound effect plays.
5. **Given** audio is enabled, **When** the character breaks a destroyable block, **Then** a shatter sound effect plays.
6. **Given** audio is enabled, **When** the character reaches the flagpole, **Then** a celebration fanfare sound effect plays.
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

### Edge Cases

- **Empty CV sections**: If a CV section has no data (e.g., empty `certificates` array), the journal bookmark for that section is hidden and no coins/blocks/enemies map to it.
- **Personality and Contact sections**: These sections appear as bookmarks in the journal but have **no counter** — there is only one piece of information per section (revealed via the flagpole ending screen). Once the flagpole is reached, the facts appear in the journal. Before reaching the flagpole, the bookmarks show the placeholder message.
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
- **Touch/mobile input**: The game is designed for keyboard input. On mobile devices, an on-screen D-pad and action buttons are displayed. This is a P3 enhancement.

## Requirements _(mandatory)_

### Functional Requirements

#### Game Engine & Rendering

- **FR-001**: System MUST render the Platformer theme as a full-viewport 2D side-scrolling game using an HTML `<canvas>` element, with a fixed aspect ratio that adapts to the browser window.

- **FR-002**: System MUST implement a game loop running at a consistent tick rate (30 FPS target) that processes input, updates game state, and renders each frame independently of frame timing.

- **FR-003**: System MUST manage game state through distinct phases: `loading` (assets loading), `playing` (active gameplay), `paused` (journal open or tab lost focus), and `ending-screen` (reached flagpole).

- **FR-004**: System MUST use the existing theme system infrastructure — `currentTheme` signal from `src/state/theme.ts`, `currentLocale`/`currentCV` signals from `src/state/locale.ts`. The theme is registered in the `themePages` map in `App.tsx` under the key `platformer`.

#### Player Character

- **FR-005**: System MUST render a pixel-art player character with at least three animation states: **idle** (standing still), **walk** (moving left/right), and **jump** (ascending/falling). The sprite faces the direction of movement.

- **FR-006**: System MUST implement character physics:
  - **Gravity**: Constant downward acceleration when not on a platform
  - **Jump**: Upward velocity impulse on jump key press; variable jump height based on key hold duration (short tap = small hop, long hold = full jump)
  - **Collision**: Character lands on platforms from above. All platforms are solid from every direction — the character cannot jump up through platforms from below. **Exception**: `bridge` tiles are one-way platforms — passable from below (the character can jump up through one) but solid when landing on top, per roadmap step 7. Holding Down (or `S`) while resting on a bridge deliberately drops the character through it.
  - **Horizontal movement**: Constant speed left/right with instant direction change

- **FR-007**: System MUST handle keyboard input: Arrow Left/Right for movement, Space or Arrow Up for jump, Arrow Down or `S` to drop through a `bridge` tile the character is resting on. `A`/`D` are additionally accepted as alternates for Left/Right (a convenience discovered useful during development, e.g. for setups where arrow keys are intercepted before reaching the browser — the arrow-key requirement above is unaffected). The up-arrow key is used exclusively for jumping — it is NOT used for journal navigation or any other UI interaction. Input is read per-frame so held keys produce continuous movement.

#### Level Design

- **FR-008**: System MUST construct a single continuous level (for v1) from left to right. The level consists of:
   - **Terrain tiles**: Ground, platforms, walls, slopes (angled surfaces) — solid blocks the character can stand on
  - **Collectibles (coins)**: Placed on platforms and in the air at varying heights
  - **Enemies** (P2): Patrol enemies on platforms
  - **Destroyable blocks** (P2): Blocks that can be destroyed by hitting from below
  - **Flagpole** (P2): End-of-level marker at the far right

- **FR-009**: System MUST map CV sections to specific game object types — each collectible type reveals content from assigned sections only:
  - **Coins** → Skills, Languages
  - **Destroyable blocks** → Experience, Education, Courses
  - **Enemies** (P2) → Certificates, Projects
  - **Flagpole** (P2) → Personality (About) + Contact — shown as ending screen, then added to journal (with bookmarks but no per-section counter)

- **FR-010**: System MUST define level data in a structured format (TypeScript types or JSON) using a grid/raster system with width and height for easy element positioning. The level data specifies:
  - Terrain grid (tile positions)
  - Collectible positions with associated CV fact references
  - Enemy positions and patrol ranges (P2)
  - Destroyable block positions (P2)
  - Flagpole position (P2)
  - Spawn point (level start)
  - Spawn points (invisible checkpoints throughout the level where the character respawns on death)
  - Level dimensions (width × height in tiles)

The level is hand-crafted — starting with a simple layout to validate functionality, then expanded iteratively.

#### Collectibles & CV Facts

- **FR-011**: System MUST associate each collectible (coin, enemy, block) with a specific CV fact entry — mapped by section and index into the `CVData` arrays. A collectible map is generated from `CVData` at theme load time.

- **FR-012**: System MUST display the actual CV fact text when a collectible is acquired. The fact text floats up from the collection point, hovers briefly near the character, then animates toward the journal icon in the bottom-right corner. The fact is added to the journal. Collected state per collectible is tracked for the session:
  - Its visual representation is removed from the game world
  - Its state is marked as collected in session state
  - The associated CV fact is added to the journal

- **FR-013**: System MUST ensure that every non-empty CV item in Skills, Languages, Experience, Education, Courses, Certificates, and Projects has at least one associated collectible in the level, mapped according to FR-009. Personality and Contact items have no collectibles — they are revealed via the flagpole ending screen and then added to the journal (with bookmarks but no counter). Empty CV sections produce no collectibles and hide their journal bookmark.

#### Journal

- **FR-014**: System MUST render the journal as a fullscreen overlay when activated (default key: `J`). The journal pauses the game. Pressing `J` again or clicking a close button dismisses the journal and resumes the game.

- **FR-015**: System MUST render the journal with:
  - **Notebook paper**: White/off-white page with blue horizontal ruled lines and a red margin line, on top of a slightly larger page underneath for depth
  - **Handwriting font**: `Caveat` (from Google Fonts), using the existing import pattern from `src/index.css`
  - **Bookmark tabs**: Colored vertical tabs along the right edge, one per non-empty CV section, distributed top-to-bottom. The active tab extends to show its label; inactive tabs appear as thin 12px slivers
  - **Section header** at the top of the active page
  - **Page counter** at the bottom (e.g., "2 / 5" for pagination)

- **FR-016**: System MUST implement bookmark tab behavior:
  - Clicking an inactive tab makes it active (extends to 48px with label) and switches the displayed section content
  - The previously active tab collapses to its inactive state (12px sliver)
  - Tabs are colored distinctly per section (e.g., amber for Experience, green for Education, blue for Projects)

- **FR-017**: System MUST render collected facts within the journal in the **Simple List** entry style (Option A from design mockups): clean bullet-point notes on lined paper with handwriting font, displaying key data fields concisely. Each fact entry includes the section-appropriate icon (🏢 for experience, 🎓 for education, etc.) and key data fields. Skills entries use star ratings (e.g., "TypeScript ★★★★☆").

- **FR-017b**: System MUST display a per-section collection counter near each section's header or bookmark (e.g., "Skills 3/5") showing how many facts have been collected out of the total for that section. **Exception**: Personality and Contact sections have no counter — there is only one fact per section, revealed via the flagpole.

- **FR-018**: System MUST paginate journal content within each section. If a section has more facts than fit on one page (approximately 5-7 entries per page), arrow buttons or page dots allow navigating forward/backward through that section's pages.

- **FR-018b**: System MUST include a "Reset Game" button in the journal overlay. Clicking it clears all collected facts (journal returns to placeholder messages for all sections) and resets the game world to its initial state (character respawns at spawn point, all coins/enemies/blocks respawn).

#### Enemies (P2)

- **FR-019**: System MUST render simple enemy characters that patrol horizontally on platforms. Enemies reverse direction at platform edges or designated patrol boundaries.

- **FR-020**: System MUST implement enemy interaction:
  - **Stomp defeat**: Character landing on top of an enemy defeats it with a poof/squish animation and reveals a CV fact (Certificates or Projects)
  - **Side/below collision**: Character takes damage (flashes, brief knockback) with invincibility frames; the enemy remains
  - Defeated enemies are removed from the game world for the session

- **FR-020b**: System MUST implement a 3-heart health system backed by 6 half-heart units, rendered via `hearts.png` (full/half/empty per heart icon). The character starts with 3 hearts (6/6 half-heart units) displayed in the HUD. Both damage sources share the same underlying `takeDamage(amount)` mechanism:
  - **Falling into a pit** costs half a heart, one half-heart unit (`takeDamage(1)`), and repositions the character to the last solid ground position before the fall — not a checkpoint reset.
  - **Side/below enemy collision** costs a full heart, two half-heart units (`takeDamage(2)`), with brief invincibility frames after taking damage.
  - At 0 hearts (from either source), the character respawns at the last checkpoint with full health (6/6 half-heart units restored), and all collected facts are preserved.

- **FR-020c**: System MUST reset enemies and destroyable blocks back to their initial patrol/intact state whenever the character respawns (the FR-020b death→respawn flow), so the level's layout and platforming challenge stay consistent across attempts — added 2026-08-27 alongside step 13's plan, ahead of steps 16/19 actually implementing enemies/blocks. **Coins are the exception**: an already-collected coin's visual representation stays removed for the rest of the session — it does not reappear on respawn. Because `collectedFacts` is preserved (FR-020b) while enemies/blocks respawn, re-triggering an already-collected source after a respawn (stomping a respawned enemy that was already defeated, or hitting a respawned block that was already broken) MUST NOT grant a duplicate CV fact or drop bonus fruit again — `CollectedFact` state is deduplicated by the source collectible's `id` (see `CollectibleDef.id`, FR-032), so a respawned enemy/block simply yields nothing on a repeat encounter. This is distinct from FR-018b's "Reset Game" button, which is a deliberate full reset that also clears `collectedFacts` and respawns coins too.

#### Destroyable Blocks (P2)

- **FR-021**: System MUST render destroyable blocks as distinct tiles (marked with a subtle question mark) that require 3 upward hits to break, progressing through intact → cracked → heavily cracked → broken visual states.

- **FR-022**: System MUST implement destroyable block interaction: when the character collides with a destroyable block from below (upward hit), the block cracks (visual state change) and drops one fruit (a bonus pickup, no CV fact — rendered from `fruit.png`, distinct from the `coin.png` sprite used for Skills/Languages coins so a bonus pickup is never visually confused with a CV-mapped collectible). After **3 hits**, the block breaks apart with a shatter animation and reveals the associated CV fact (Experience, Education, or Courses). Hitting from other directions has no effect.

#### Level Completion (P2)

- **FR-023**: System MUST render a flagpole (with a separate sliding flag) at the rightmost end of the level. When the character jumps onto the flagpole, a celebration animation plays (character slides down the pole, flag waves) and the ending screen overlay appears.

- **FR-024**: System MUST display the ending screen showing the Personality section content (personal summary / about me) and Contact information. After the ending screen is dismissed, the Personality and Contact facts are added to the journal with their own bookmarks but no per-section counter. The ending screen offers a "Replay Level" option to reset the game.

#### Controls & Theme Infrastructure (P3)

- **FR-025**: System MUST render the HUD during gameplay with the following layout:
  - **Top-left**: 3 hearts (health indicator)
  - **Top-right**: Floating translucent controls — theme selector and language toggle (following the same pattern as the Space theme)
  - **Bottom-right**: Journal icon button (opens/closes the journal, same as `J` key)

- **FR-026**: System MUST support locale switching: when `currentLocale` changes, journal content and in-game notifications re-render in the selected language while preserving game state and position.

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
     │   └── EndingScreen.tsx         # Flagpole ending screen — Personality + Contact (P2)
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
     │   └── DestroyableBlock.ts    # Block state and hit tracking (P2)
    ├── level/
    │   ├── LevelData.ts           # Type definitions for level structure
    │   ├── Terrain.ts             # Tile helpers — isSolid, tileAtPosition, tile-to-pixel conversion
    │   ├── level1.ts              # Level 1 data — terrain, collectibles, mappings
    │   └── CollectibleMapper.ts   # Maps CVData to collectible placements
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

- **FR-032**: System MUST define TypeScript types for the platformer theme:
  - `GamePhase`: `'loading' | 'playing' | 'paused' | 'ending-screen'`
  - `PlayerState`: `{ x: number; y: number; vx: number; vy: number; facing: 'left' | 'right'; grounded: boolean; animState: 'idle' | 'walk' | 'jump'; animFrame: number }`
  - `CollectibleDef`: `{ id: string; x: number; y: number; type: 'coin' | 'enemy' | 'block'; cvSection: SectionId; cvIndex: number }`
  - `CollectedFact`: `{ id: string; sectionId: SectionId; sectionLabel: string; data: CVItemData; sourceType: 'coin' | 'enemy' | 'block' }`
  - `LevelDef`: `{ terrain: TileMap; collectibles: CollectibleDef[]; enemies: EnemyDef[]; blocks: BlockDef[]; spawn: Point; flagpole: Point; width: number; height: number }`

#### Testing

- **FR-033**: System MUST include unit tests covering:
  - `CollectibleMapper` — correct mapping of CVData to collectible definitions per FR-009 (Skills/Languages → coins, Experience/Education/Courses → blocks, Certificates/Projects → enemies, Personality/Contact → flagpole only)
  - `Physics` — gravity, jump arc, collision with platforms, collision with pits
  - `Input` — keyboard event parsing, key held vs pressed
  - Journal content rendering with sample CV data
  - Collected fact tracking (add fact, check if collected, persist across respawn)
  - Game state transitions (`playing` → `paused` → `playing`)

- **FR-034**: System MUST include component tests covering:
  - `PlatformerPage` renders canvas element
  - `Journal` renders with correct sections based on CV data
  - `BookmarkTabs` active/inactive states
   - `EndingScreen` displays Personality and Contact info (P2)

#### Audio (P2)

- **FR-035**: System MUST support audio playback including a looping background music track and sound effects for game actions (jump, coin collection, enemy stomp, block break, flagpole celebration, damage, journal open/close). Audio is muted by default — playback requires visitor opt-in via a speaker icon in the HUD. Audio assets are pre-loaded alongside sprite assets (per FR-028) before entering the `playing` state. The audio state (muted/unmuted) is tracked in game session state.

### Key Entities

- **Player (character)**: The visitor's avatar in the game world. State includes position (x, y), velocity (vx, vy), animation state (idle/walk/jump), facing direction, and grounded flag.

- **Level**: The game world — a side-scrolling environment defined by terrain tiles, collectible placements, enemy placements, spawn point, and flagpole. In v1, one continuous level covers all CV sections in order.

- **Collectible**: An item in the game world that, when acquired by the player, reveals a CV fact. Types: coin (Skills, Languages — P1), enemy defeat (Certificates, Projects — P2), block break (Experience, Education, Courses — P2). Each collectible is mapped to a specific CV data item by section.

- **Bonus pickup**: An item dropped by a destroyable block on each of its first 2 hits (rendered as a fruit) — unlike a `Collectible`, it carries no CV fact and isn't mapped to `CVData`. Purely a reward for engaging with the block-hit mechanic.

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
 ├── Contains Terrain (platform tiles, collision data)
 └── Defines spawn, checkpoint, flagpole positions

Player
 ├── Collides with Terrain (stands, jumps, falls)
 ├── Collides with Collectible → triggers fact collection
 └── Tracked by Camera (viewport follows player)

Session State
 ├── CollectedFact[] — which facts have been discovered
 ├── PlayerState — current position, animation
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

- **SC-002 — Every CV item has a collectible**: Each non-empty item in Skills, Languages, Experience, Education, Courses, Certificates, and Projects maps to at least one collectible in the level according to the FR-009 mapping. Personality and Contact are excluded (revealed via flagpole ending screen). Verified by: unit test.

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
- **Desktop-only** (initially): The Platformer theme is designed for desktop with keyboard input. Mobile/touch controls are a P3 enhancement.
- **Single level in v1**: Iteration 1 ships with one continuous level covering all CV sections. Additional levels per section can be added in future iterations.
- **HTML5 Canvas for rendering**: The game uses Canvas 2D API (not WebGL/three.js), keeping the implementation simple and aligned with the "simple 2D platformer" scope.
- **Sprite assets from existing mockup images**: The 10 existing sprite images in `specs/S-006-platformer-theme/images/` are the basis for game assets — character, enemies, coins, terrain, blocks, flagpole.
- **Game state is session-only**: No localStorage or backend persistence. Collected facts reset on page reload or theme switch.
- **`Caveat` font from Google Fonts**: Journal handwriting font uses the existing font import pattern. Falls back to system cursive fonts if unavailable.
- **Journal uses Simple List style (Option A)**: Based on the existing `entry-styles-mockup.html`, the chosen entry style for journal content is the Simple List approach — clean bullet-point notes with key data fields.
- **Audio is muted by default**: Audio playback (background music + sound effects) requires visitor opt-in via the speaker icon in the HUD. Audio assets are pre-loaded alongside sprite assets.
- **Spawn points throughout the level**: Invisible spawn points defined in the level data serve as checkpoints. The character respawns at the nearest spawn point on death.
- **Collision uses simple AABB (Axis-Aligned Bounding Box)**: Physics and collision detection use rectangular hitboxes, not pixel-perfect collision. This is standard for retro-style platformers.
- **Fixed sprite sizes**: Character, enemy, coin, and block sprites have fixed pixel dimensions (e.g., 32×32 or 16×16 tiles). The canvas is scaled to fit the viewport while maintaining the pixel-art aesthetic.
- **Personality and Contact are flagpole-only**: The About/Personality section and Contact information are NOT placed as collectibles in the level. They are revealed exclusively via the flagpole ending screen at the end of the level.

## Clarifications

### Session 2026-08-05

- **Q: Damage & Health System** — **A**: 3-heart health backed by 6 half-heart units, checkpoint respawn at 0 health. Character has 3 hearts (`hearts.png`, full/half/empty), brief invincibility frames on hit. Pit falls cost half a heart and reposition the character to the last solid ground (no checkpoint reset); enemy side/below collision costs a full heart — both use the same `takeDamage(amount)` mechanism. At 0 health: respawn at nearest spawn point with full health, collected facts preserved. No game-over screen.
- **Q: Platform Behavior** — **A**: All platforms are solid from every direction. Character cannot jump up through platforms from below. **Exception (added at roadmap step 7)**: `bridge` tiles are one-way — passable from below, solid from above — since a rope/plank bridge is the one terrain type where that behavior reads as natural rather than surprising. **Update (roadmap step 7, level redesign)**: a Down-arrow/`S` "drop through" key was added once `level1` gained a platform-bridge-platform arrangement with reachable ground underneath — the condition the original clarification held it back for.
- **Q: Level Design Approach** — **A**: Hand-crafted level using a grid/raster system with width and height for easy element positioning. Start with a simple level to validate functionality, then expand iteratively.
- **Q: Checkpoint System** — **A**: Invisible spawn points defined in the level data. Character respawns at the nearest spawn point on death.
- **Q: HUD Layout** — **A**: Top-left: 3 hearts. Top-right: theme and language selector (like Space theme). Bottom-right: journal icon button.
- **Q: Checkpoint Persistence Across Theme Switches** — **A**: Not in v1. Checkpoints only matter within a single session (for respawn after death). Switching themes always resets. May revisit this as a future enhancement.

## Iteration Plan

This feature is intentionally scoped for incremental delivery:

| Iteration | Priority | Scope | Key Deliverables |
|-----------|----------|-------|-----------------|
| **1** | P1 | Core platformer + coins + journal | Player movement, level terrain, coin collectibles (Skills + Languages), journal with bookmarks, CV fact mapping |
| **2** | P2 | Enemies + blocks + flagpole + audio | Enemy patrol and stomp (Certificates + Projects), destroyable blocks (Experience + Education + Courses), flagpole ending screen (Personality + Contact), game audio (background music + sound effects, muted by default) |
| **3** | P3 | Controls + polish | Floating theme/locale controls, touch controls, visual polish |

Each iteration is independently shippable and adds gameplay depth without breaking previous functionality.

## Out of Scope

- **Mobile/touch controls** (P3 — out of scope for v1)
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
