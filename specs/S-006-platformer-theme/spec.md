# Feature Specification: 2D Platformer Theme

**Feature Branch**: `S-006-platformer-theme`  
**Feature ID**: S-006  
**Created**: 2026-08-05  
**Status**: Draft  
**Input**: User description: "2D platformer theme — user plays a simple 2D platformer where collecting coins, destroying blocks, or defeating enemies reveals CV information"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Run and Jump Through the Platformer Level (Priority: P1)

A visitor opens the CV website and switches to the Platformer theme. A 2D side-scrolling game view appears with a pixel-art character standing on a grassy platform. The visitor uses arrow keys to move the character left/right and the spacebar to jump across platforms, avoiding pits and obstacles. The character animates — idle, walk, and jump states. The camera follows the character as they explore a single, continuous level.

**Why this priority**: The core platformer mechanics are the foundation. Without basic movement, jumping, and a scrolling level, nothing else matters. This is the "hello world" of the theme — a character that can move in a world.

**Independent Test**: Load the Platformer theme. Verify the character renders on a platform. Press arrow keys — verify character moves left/right with walk animation. Press space — verify character jumps with jump animation. Move right — verify camera scrolls to follow. Move left — verify camera scrolls back.

**Acceptance Scenarios**:

1. **Given** the Platformer theme is active, **When** the page loads, **Then** a 2D side-scrolling game view renders with a pixel-art character standing on a platform against a themed background.
2. **Given** the character is idle on a platform, **When** the visitor presses the right arrow key, **Then** the character moves right with a walking animation and the camera scrolls to follow.
3. **Given** the character is standing on a platform, **When** the visitor presses the spacebar, **Then** the character jumps upward, reaches a peak, and falls back down — landing on platforms or falling into pits.
4. **Given** the character is moving left, **When** the visitor presses the right arrow key, **Then** the character reverses direction and the sprite faces right.
5. **Given** the character falls into a pit, **When** the fall occurs, **Then** the character loses half a heart and reappears at the last solid ground position before the fall. **Given** the character loses all hearts, **When** the death occurs, **Then** the character respawns at the nearest spawn point with full health and all collected facts preserved.

---

### User Story 2 - Collect Coins to Discover Skills (Priority: P1)

As the visitor explores the level, they encounter floating gold coins scattered across platforms and in the air — some easy to reach, others requiring tricky jumps. Each coin is associated with a Skills category from the CV. When the character touches a coin, it disappears with a sparkle effect, and the actual skill list for that category floats up from the collection point, hovers briefly near the character, then animates toward the journal icon (top-left, next to the hearts). The category and its skills are added to the visitor's journal under the Skills section.

**Why this priority**: Coins are the primary mechanic that connects gameplay to CV content. Without them, the platformer is just a game with no CV purpose. This is the bridge between play and portfolio.

**Independent Test**: Walk into a coin — verify it disappears and the skill category's text floats up. Open the journal — verify the fact appears in the Skills section. Collect all coins in the level — verify every represented Skills category is in the journal.

**Acceptance Scenarios**:

1. **Given** the character approaches a coin, **When** the character sprite overlaps the coin, **Then** the coin disappears with a sparkle effect, the associated skill category's text floats up from the collection point, hovers briefly near the character, and animates toward the journal icon.
2. **Given** a coin is collected, **When** the visitor opens the journal, **Then** that Skills category (and its skills) appears in the Skills section, styled as a simple list entry with star ratings.
3. **Given** the visitor collects all coins in the level, **When** they check the journal, **Then** every Skills category represented in the level is populated in the journal.
4. **Given** the character respawns after falling, **When** they revisit a previously collected coin location, **Then** the coin is gone (already collected) — collected state persists for the session.

---

### User Story 3 - Open the Journal to Read Collected Facts (Priority: P1)

At any point during gameplay, the visitor can press `J` (or click the journal icon) to pause the game and open the journal overlay. The journal appears as an open notebook with lined paper, a handwriting-style font, and colored bookmark tabs along its top-right edge — one per CV section. The active section's facts are displayed in the notebook pages. The visitor clicks a bookmark tab to switch between sections. Pressing `J` again (or clicking a close button) returns to the paused game exactly where they left off.

**Why this priority**: The journal is how visitors actually read the CV. Without it, collecting coins is meaningless. The journal is the "output" of the game.

**Independent Test**: Collect at least one coin. Press `J` — verify journal overlay appears with the game paused. Verify the collected fact is readable. Click different bookmark tabs — verify content switches. Press `J` again — verify game resumes from same position.

**Acceptance Scenarios**:

1. **Given** the visitor is playing the game, **When** they press `J` (or the journal key), **Then** the game pauses and the journal overlay appears as a centered notebook card — the rest of the game (canvas, HUD) stays visible around it.
2. **Given** the journal is open, **When** the visitor observes it, **Then** it renders as an open notebook with lined paper, handwriting-style font, and colored bookmark tabs along the top-right edge — one per non-empty CV section, each showing an icon rather than a text label.
3. **Given** one section's bookmark is active, **When** the visitor clicks a different bookmark tab, **Then** that tab extends with its icon visible, the previously active tab collapses to a thin sliver, and the notebook content switches to that section's facts.
4. **Given** the journal is open, **When** the visitor views any section, **Then** a counter near the section header or bookmark shows how many facts have been collected out of the total for that section (e.g., "Skills 3/5"), so the player knows whether there are still undiscovered facts.
5. **Given** CV sections have no collected facts yet, **When** the journal is opened, **Then** those sections show a placeholder message like "No facts discovered yet — keep exploring!" and the counter shows "0/N".
6. **Given** the journal is open, **When** the visitor presses `J` again (or clicks the close button), **Then** the journal overlay closes and the game resumes from the exact paused state.
7. **Given** the journal is open at any point, **When** the visitor clicks the "Reset Game" button, **Then** all collected facts are cleared, the journal closes immediately and the iris-in "starting again" transition plays, the game resets to the spawn point, and all coins/enemies/blocks/chests respawn in the level.

---

### User Story 4 - Defeat Enemies to Reveal Courses (Priority: P2)

Scattered through the level are two colors of simple slime enemies that patrol back and forth on platforms, both guarding the same Courses pool from the CV, split alternately between them. The visitor can defeat an enemy by jumping on top of it (stomp mechanic) — a green slime falls in a single stomp, a purple slime takes two stomps. When defeated, the enemy disappears in a poof animation and the actual Course fact text floats up from the defeat point, hovers briefly, then animates toward the journal icon. The fact is added to the visitor's journal under the Courses section. Defeated enemies stay defeated for the session.

**Why this priority**: Enemies add gameplay depth and reward exploration. They're P2 because coins already deliver Skills — enemies unlock Courses, which require skilled play to discover.

**Independent Test**: Approach an enemy — verify it patrols. Jump on top of a green slime — verify it's defeated in one stomp with a poof effect and a Course fact appears. Jump on a purple slime twice — verify it takes two stomps before defeat and a Course fact appears. Open journal — verify facts appear in the Courses section. Revisit the area — verify enemies are gone.

**Acceptance Scenarios**:

1. **Given** a green slime is patrolling on a platform, **When** the character jumps and lands on top of it, **Then** it is defeated in a single stomp with a poof/squish animation and the associated Course fact text floats up, hovers, and flies to the journal icon.
2. **Given** a purple slime is patrolling on a platform, **When** the character stomps it twice (a bounce off the first stomp, then a second landing), **Then** it is defeated on the second stomp with a poof/squish animation and the associated Course fact text floats up, hovers, and flies to the journal icon.
3. **Given** an enemy is defeated, **When** the visitor opens the journal, **Then** the fact appears in the Courses section, styled as a simple list entry.
4. **Given** the character collides with an enemy from the side or below, **When** contact occurs, **Then** the character takes damage (flashes briefly with invincibility frames), loses one full heart, and is pushed back slightly, using the same damage mechanism as pit falls (FR-020b) but with a full heart instead of a half heart. The character has 3 hearts total. At 0 hearts, the character respawns at the last checkpoint with full health and all collected facts preserved.
5. **Given** the character respawns after falling, **When** they revisit an enemy location, **Then** previously defeated enemies remain defeated for the session.

---

### User Story 5 - Break Blocks to Uncover Education, Activities, Languages, Certificates, and Projects (Priority: P2)

Some platforms contain destroyable blocks — three visually distinct kinds. **Crates** are associated with an Education, Activity, or Language entry from the CV: hitting one from below (Mario-style bump) shows a crack overlay; hitting it again from below breaks it apart with a shatter animation and reveals the associated fact. **Question-mark blocks** are styled to match their surrounding terrain (five color palettes) — a single hit from below pops a bonus fruit upward into the space directly above the block, carrying the associated Certificate or Project fact, and permanently swaps the block to a plain, top-exposed ground-rock tile. **Rock blocks** break to empty space on a single hit from below and carry no reward at all — a pure level-design tool for shaping traversal. Every below-hit, on any of the three types, gives the block a short bump/nudge (it moves up a few pixels and settles back), even on the hit that breaks, shatters, or converts it. A revealed fact's text floats up from the break point, hovers briefly, then animates toward the journal icon, same as any other CV-mapped collectible.

**Why this priority**: Destroyable blocks add vertical exploration and a hit-based mechanic. They're P2 because they're a secondary mechanic — coins and enemies already deliver the main content flow. Crates reward persistent exploration with Education/Activity/Language facts; question-mark blocks add a bonus-pickup feel to Certificates/Projects; rock blocks add level-design texture without extra CV content.

**Independent Test**: Find a crate. Hit it from below once — verify a crack overlay appears with a bump animation. Hit it again — verify it breaks with a shatter animation and the education/activity/language fact text appears; check the journal for the fact in the correct section. Find a question-mark block — hit it from below — verify a fruit pops up above it carrying a Certificate/Project fact and the block turns into a plain ground-rock tile. Find a rock block — hit it from below — verify it breaks to empty space with a puff effect and no reward.

**Acceptance Scenarios**:

1. **Given** an intact crate exists on a platform, **When** the character hits it from below for the first time, **Then** it shows a cracked visual overlay (with a bump animation) and remains in place — no fact, no reward yet.
2. **Given** a cracked crate, **When** the character hits it again from below, **Then** it breaks apart with a shatter animation (and a bump animation) and the associated Education, Activity, or Language fact text floats up from the break point, hovers, and flies to the journal icon.
3. **Given** a question-mark block, **When** the character hits it from below, **Then** a bonus fruit carrying the associated Certificate or Project fact pops upward into the space directly above the block (landing as a touchable pickup that flies to the journal on collection like any other collectible), and the block permanently changes to a plain, top-exposed ground-rock terrain tile.
4. **Given** a rock block, **When** the character hits it from below, **Then** the block breaks into empty space immediately with a puff effect — no fruit, no fact, no reward.
5. **Given** any of the three block types, **When** the character hits it from above or the side, **Then** the block's hit reaction (crack, break, fruit-pop, convert) does not trigger — only upward hits from below do; the block remains solid from every direction regardless.

---

### User Story 6 - Collect Every Chest to Reveal Experience, Then Reach the Thank-You Screen (Priority: P2)

Scattered through the level (via hand-placed markers, same pattern as coins/enemies/blocks — no special end-of-level positioning) are treasure chests: the level's "main objective" collectible, visually and mechanically distinct from coins/fruit/crates. Each chest is associated with an Experience entry from the CV — the section considered most valuable, and therefore worth the extra weight of a dedicated collectible type. A chest starts closed, sits flush with the ground (not a solid obstacle — the character walks over/beside it, not on top of it). Unlike every other collectible, a chest does NOT open on touch: the character must be standing on/overlapping it and press Arrow Up to open it — a deliberate small pause-and-choose moment for the level's main objective, distinct from the passive walk-through-it collection every other pickup uses. Opening permanently swaps the chest to its open state and reveals the associated Experience fact, which floats up and flies to the journal icon exactly like any other collectible. A dedicated chest counter in the HUD (e.g. "Chests 2/5") tracks progress separately from the heart/coin HUD elements.

Once every chest in the level has been opened, a "Thank You" screen appears: a solid black full-screen background with white text — completely covering the game, not a card floating over it — showing a thank-you message and the CV's Contact information, with "press any button to continue" beneath it, and a "curtain falling" entrance animation. Dismissing it (any key or click) resumes play exactly where the visitor left off. The screen can appear wherever in the level the visitor happens to be when they open the last chest; there is no separate location-based trigger. Contact is revealed only on this screen — it is not added to the journal, and has no bookmark (the visitor can trigger the screen again only by opening all chests again after a Reset Game, which restores every chest to closed).

**Why this priority**: Chests provide a clear "main objective" thread through the level (distinct from the ambient coin/crate collecting) and give Experience — the most valuable CV section — a collectible of its own, while the Thank You screen provides closure. It's P2 because the core loop (play → collect → read) is already complete without it — but it adds a satisfying sense of completion and surfaces Contact info a visitor would otherwise have to dig for.

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

### User Story 6b - Climb Ladders to Reach New Areas (Priority: P2)

Some parts of the level are only reachable by climbing a ladder — a `'ladder'` terrain tile, visually distinct from ordinary solid terrain, that the character can pass through horizontally (not solid) but ascend/descend while overlapping it. Standing on a ladder tile and pressing Arrow Up (or `W`) starts climbing upward; pressing Arrow Down (or `S`) starts climbing downward. While climbing, gravity is suspended and vertical movement is driven directly by Up/Down at a fixed climb speed; horizontal movement (Left/Right) still works exactly as normal (free-form climbing — the character can shimmy sideways off a ladder mid-climb, which ends the climb and returns to normal gravity the instant no part of the character's hitbox still overlaps a ladder tile). Pressing Space (jump) while climbing immediately ends the climb and applies a normal jump impulse. The ladder's top rung behaves like a `bridge` tile's solid-from-above case (FR-006): the tile directly above the ladder's last rung is ordinary solid terrain, so reaching it lands the character on solid ground exactly like any other platform; pressing Down while standing there re-enters the climb downward (mirroring the bridge drop-through convention, but for `'ladder'` tiles instead of `'bridge'`).

Because some ladders are taller than fits in one screen, the camera follows the character vertically as well as horizontally, using the same dead-zone-follow-and-clamp approach on both axes: on a level whose height already fits the viewport, this is a no-op — bottom-anchored. Only once a level's pixel height exceeds the viewport does the camera actually scroll vertically, clamped so it never scrolls above the level's top or below its bottom.

**Why this priority**: Ladders are the last piece of core traversal the game needs, and they're what makes vertical camera follow meaningful to build at all. P2 because they extend core movement/level design (like bridges), not a polish item.

**Independent Test**: Walk into a ladder's column and press Up — verify the character climbs vertically at a fixed speed instead of falling, and the camera scrolls to keep them in view once the ladder goes off-screen. Press Left/Right while climbing — verify the character can shimmy off the ladder, immediately resuming normal gravity. Press Space while climbing — verify it cancels the climb into a normal jump. Reach the top, verify the character can stand on the platform above; press Down there — verify it re-enters the climb going downward.

**Acceptance Scenarios**:

1. **Given** the character's hitbox overlaps a `'ladder'` tile, **When** the visitor presses Arrow Up (or `W`), **Then** the character begins climbing: vertical movement is driven directly by Up/Down at a fixed climb speed, gravity is suspended, and the `'climb'` animation plays.
2. **Given** the character is climbing, **When** the visitor presses Left or Right, **Then** the character moves horizontally at the normal walk speed same as when not climbing; if this moves the character's hitbox off every `'ladder'` tile, climbing ends and normal gravity/collision resumes immediately.
3. **Given** the character is climbing, **When** the visitor presses Space, **Then** climbing ends immediately and a normal jump impulse is applied, same as a jump from solid ground.
4. **Given** the character climbs to the ladder's top rung, **When** they reach the solid terrain tile directly above it, **Then** they stand on it exactly like any other platform (FR-006's existing ground-collision rules, no special case needed).
5. **Given** the character is standing on solid ground directly above a ladder's top rung, **When** the visitor presses Arrow Down (or `S`), **Then** the character re-enters the climb, moving downward into the ladder.
6. **Given** a ladder's full extent (plus the terrain around it) is taller than the current browser viewport, **When** the character climbs high/low enough to approach the edge of the visible area, **Then** the camera scrolls vertically to keep them in view, clamped so it never scrolls past the level's top or bottom edge.
7. **Given** a level's total pixel height is less than or equal to the viewport height, **When** the character moves anywhere in it, **Then** the camera's vertical position never changes (bottom-anchored).

---

### User Story 7 - Game Audio (Priority: P2, not committed)

A looping background music track and sound effects enhance the platformer experience. Sound effects play for key actions: jumping, collecting a coin, stomping an enemy, breaking a block, taking damage, opening a chest, and opening/closing the journal. A distinct fanfare/chime plays when the Thank You screen appears. A small speaker icon in the top-right HUD area allows the visitor to toggle all audio on/off. Audio is muted by default and must be enabled by the visitor.

**Why this priority**: Audio feedback makes gameplay more engaging and provides clear confirmation of game actions, but the game is fully playable without it. Not currently committed to the roadmap — see `roadmap.md`'s "Maybe / reconsider later" section.

**Independent Test**: Load the Platformer theme — verify audio is muted by default and speaker icon shows muted state. Click the speaker icon to enable — verify background music starts playing. Jump — verify jump sound effect. Collect a coin — verify coin sound. Stomp an enemy — verify splat sound. Toggle mute — verify all audio stops and icon updates.

**Acceptance Scenarios**:

1. **Given** the Platformer theme is active, **When** the game starts in the `playing` phase, **Then** audio is muted by default and a speaker icon indicating muted state is visible in the HUD.
2. **Given** audio is enabled, **When** the character jumps, **Then** a short jump sound effect plays.
3. **Given** audio is enabled, **When** the character collects a coin, **Then** a coin collection sound effect plays.
4. **Given** audio is enabled, **When** the character stomps an enemy, **Then** a defeat sound effect plays.
5. **Given** audio is enabled, **When** the character breaks a destroyable block, **Then** a shatter sound effect plays.
6. **Given** audio is enabled, **When** the character opens a chest, **Then** a chest-opening sound effect plays; **When** the Thank You screen then appears (the last chest was just opened), a distinct fanfare/chime sound effect plays.
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
3. **Given** the visitor switches to another theme, **When** they switch back to the Platformer theme, **Then** the game resets to the start (fresh session, no collected facts). *Not yet implemented — see roadmap.md's "Maybe / reconsider later" section (Theme-switch reset).*

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
- **Personality and Contact sections**: These sections have **no counter** in the journal — Personality is always visible on the "About Me" bookmark (a single piece of information, not gated on any collection), and Contact never appears in the journal at all — it's shown only on the Thank You screen (User Story 6).
- **Very few CV items**: If the CV has only 3-4 items total, the level is shorter with fewer collectibles, but the platforming experience remains — the level adapts proportionally.
- **Very many CV items**: If the CV has 20+ items, the level is longer and more populated with collectibles. The level design ensures the experience doesn't feel cluttered or overwhelming.
- **No CV data at all**: If `CVData` is empty or fails to load, the game still renders — a minimal platformer level with a message: "CV data not available. Try another theme!"
- **Rapid keyboard input**: Fast or simultaneous key presses must not cause the character to glitch through platforms or skip collision detection. Input is debounced/queued appropriately.
- **Browser tab loses focus**: When the visitor switches browser tabs, the game pauses automatically. Resuming the tab restores the game from the paused state.
- **Window resize**: The game canvas/viewport resizes to fit the browser window. Aspect ratio is maintained; empty space is filled with the background color.
- **Journal open during game events**: If the journal is open and the character would have been hit by an enemy (had the game not been paused), nothing happens — the game is fully paused.
- **Collectible counts at boundaries**: In Iteration 1 (coins only), only Skills appear as collectibles and in the journal. Other sections show the placeholder message until Iteration 2 when blocks, enemies, and chests are added. This is expected — each iteration incrementally unlocks CV sections.
- **Game state across page reload**: Game state (collected coins, defeated enemies, destroyed blocks, opened chests) is NOT persisted across page reloads. Each visit is a fresh session.
- **Game state across death/respawn** (see FR-020c): `collectedFacts` is preserved across a death/respawn — previously discovered CV content is never lost to a death. Enemies and destroyable blocks reset to their initial state on respawn (so the level plays the same each attempt) but grant no duplicate fact/fruit if re-collected; already-collected coins stay gone permanently rather than reappearing. Only the deliberate "Reset Game" button (FR-018b) clears `collectedFacts` and respawns coins too.
- **Game state across theme switches**: Switching to another theme and back is intended to reset the game to its initial state (fresh session, no collected facts) — see User Story 8, currently unimplemented.
- **Touch/mobile input**: The game is designed for keyboard input only. Mobile/touch controls are permanently out of scope — no on-screen D-pad or action buttons are planned; see the "Out of Scope" section below.

## Requirements _(mandatory)_

### Functional Requirements

#### Game Engine & Rendering

- **FR-001**: System MUST render the Platformer theme as a full-viewport 2D side-scrolling game using an HTML `<canvas>` element, with a fixed aspect ratio that adapts to the browser window.

- **FR-002**: System MUST implement a game loop running at a consistent tick rate (30 FPS target) that processes input, updates game state, and renders each frame independently of frame timing.

- **FR-003**: System MUST manage game state through distinct phases: `loading` (assets loading), `playing` (active gameplay), `paused` (journal open or tab lost focus), and `ending-screen` (the Thank You screen shown once every chest is opened — pauses the game loop the same way `paused` does; dismissing it — any key or click — returns to `playing`).

- **FR-004**: System MUST use the existing theme system infrastructure — `currentTheme` signal from `src/state/theme.ts`, `currentLocale`/`currentCV` signals from `src/state/locale.ts`. The theme is registered in the `themePages` map in `App.tsx` under the key `platformer`.

#### Player Character

- **FR-005**: System MUST render a pixel-art player character with animation states: **idle** (standing still), **walk** (moving left/right), **jump** (ascending/falling), and **climb** (ascending/descending a ladder, back view). The sprite faces the direction of movement.

- **FR-006**: System MUST implement character physics:
  - **Gravity**: Constant downward acceleration when not on a platform or climbing.
  - **Jump**: Upward velocity impulse on jump key press; variable jump height based on key hold duration (short tap = small hop, long hold = full jump).
  - **Collision**: Character lands on platforms from above. All platforms are solid from every direction — the character cannot jump up through platforms from below. **Exception**: `bridge` tiles are one-way platforms — passable from below (the character can jump up through one) but solid when landing on top. Holding Down (or `S`) while resting on a bridge deliberately drops the character through it.
  - **Horizontal movement**: Constant speed left/right with instant direction change.
  - **Climbing**: `'ladder'` terrain tiles are not solid (they don't block horizontal movement or count as ground) but are climbable — while the character's hitbox overlaps one, pressing Up or Down suspends gravity and drives vertical movement directly at a fixed climb speed instead. Horizontal movement stays exactly as normal while climbing (free-form — moving off every overlapping `'ladder'` tile ends the climb immediately, resuming normal gravity/collision). Pressing Space while climbing ends it and applies a normal jump impulse. The tile directly above a ladder's top rung is ordinary solid terrain (not itself a ladder tile), so the existing ground-collision rule already lets the character stand on it with no special case; pressing Down while standing there re-enters the climb downward, mirroring the bridge drop-through convention above but keyed off `'ladder'` instead of `'bridge'`.

- **FR-007**: System MUST handle keyboard input: Arrow Left/Right for movement, Space for jump, Arrow Down or `S` to drop through a `bridge` tile the character is resting on or to climb down a ladder, Arrow Up (or `W`) to open a chest the character is standing on (FR-023) or to climb up a ladder the character overlaps (FR-006, User Story 6b). `A`/`D` are accepted as alternates for Left/Right, and `W` as an alternate for Arrow Up's interact/climb-up action, for setups where arrow keys are intercepted before reaching the browser. Arrow Up is never used for journal navigation or any other UI interaction; `S`/Arrow Down double as the bridge drop-through key and the climb-down key, disambiguated purely by which tile (`bridge` vs `ladder`) the character is standing on/overlapping, since a single tile is never both. Input is read per-frame so held keys produce continuous movement.

#### Level Design

- **FR-008**: System MUST construct a single continuous level (for v1) from left to right. The level consists of:
  - **Terrain tiles**: Ground, platforms, walls, bridges, ladders — solid or climbable blocks the character interacts with (see FR-006).
  - **Collectibles (coins)**: Placed on platforms and in the air at varying heights.
  - **Enemies** (P2): Patrol enemies on platforms.
  - **Destroyable blocks** (P2): Blocks that can be destroyed by hitting from below.
  - **Chests** (P2): the "main objective" collectible, hand-placed via markers scattered through the level like any other collectible — no special end-of-level position. Opening every chest in the level triggers the Thank You screen (see User Story 6).

- **FR-009**: System MUST map CV sections to specific game object types — each collectible type reveals content from assigned sections only:
  - **Coins** → Skills. A coin represents a whole skill *category* (e.g. "Backend"), not one individual skill — touching one adds every skill in that category to the journal's Skills section at once, shown as the category name with its skill list.
  - **Chests** → Experience — the level's "main objective" collectible; see User Story 6.
  - **Crates** (destroyable blocks) → Education, Activities, Languages.
  - **Question-mark blocks** (destroyable blocks) → Certificates, Projects — revealed via a bonus fruit on hit (User Story 5).
  - **Rock blocks** (destroyable blocks) → no CV mapping; pure level-design filler.
  - **Enemies** → Courses, split alternately between green and purple slimes (User Story 4).
  - **Personality** → shown directly on the always-visible "About Me" journal bookmark, not via any in-level collectible.
  - **Contact** → revealed only on the Thank You screen once every chest is opened (see User Story 6) — never added to the journal, no bookmark.

- **FR-010**: System MUST define level data in a structured format (TypeScript types) using a grid/raster system with width and height for easy element positioning. The level data specifies:
  - Terrain grid (tile positions)
  - Collectible positions with associated CV fact references
  - Enemy positions and patrol ranges (P2)
  - Destroyable block positions (P2)
  - Chest positions (P2) — scattered via markers like any other collectible, see User Story 6
  - Spawn point (level start)
  - Spawn points (invisible checkpoints throughout the level where the character respawns on death)
  - Level dimensions (width × height in tiles)

  The level is hand-crafted — starting with a simple layout to validate functionality, then expanded iteratively.

#### Collectibles & CV Facts

- **FR-011**: System MUST associate each collectible (coin, enemy, block, chest) with a specific CV fact entry — mapped by section and index into the `CVData` arrays. A collectible map is generated from `CVData` at theme load time.

- **FR-012**: System MUST display the actual CV fact text when a collectible is acquired. The fact text floats up from the collection point, hovers briefly near the character, then animates toward the journal icon (top-left, next to the hearts). The fact is added to the journal. Collected state per collectible is tracked for the session:
  - Its visual representation is removed from the game world
  - Its state is marked as collected in session state
  - The associated CV fact is added to the journal

- **FR-013**: System MUST ensure that every non-empty CV item in Skills, Experience, Education, Courses, Certificates, Activities, Languages, and Projects has at least one associated collectible in the level, mapped according to FR-009. Personality has no collectible — it is shown directly on the always-visible "About Me" journal bookmark. Contact has no collectible either — it is revealed only via the Thank You screen once every chest is opened, and is never added to the journal. Empty CV sections produce no collectibles and hide their journal bookmark. Collectible/enemy/block/chest placement is via intentional, hand-authored markers in the level layout (`S`/`E`/`M`/`C`/`X`/`Q`/`F`/`T` — see `LevelParser.ts`), with no auto-placement fallback: a level's marker count decides on-map coverage, not `CVData`'s length — a mechanics-test level MAY cover only a slice of `CVData` without violating this requirement; full coverage is deferred to the final level design.

#### Journal

- **FR-014**: System MUST render the journal as a centered, bounded card/panel when activated (default key: `J`) — **not** a full-screen dark backdrop; the rest of the game (canvas, HUD) stays fully visible around it. The journal pauses the game. Pressing `J` again or clicking a close button dismisses the journal and resumes the game.

- **FR-015**: System MUST render the journal with:
  - **Notebook paper**: White/off-white page with blue horizontal ruled lines and a red margin line, on top of a slightly larger page underneath for depth
  - **Handwriting font**: `Caveat` (from Google Fonts), using the existing import pattern from `src/index.css`
  - **Bookmark tabs**: Colored tabs along the book's top-right edge, one per CV section shown in the journal, laid out left-to-right. The active tab extends further down; inactive tabs show a short peek. Each tab shows the section's icon rather than a text label.
  - **Section header** at the top of the active page
  - No visible page-counter text — bookmarks alone indicate more content exists

- **FR-016**: System MUST implement bookmark tab behavior:
  - Clicking an inactive tab makes it active (extends further) and switches the displayed section content
  - The previously active tab collapses to its inactive state
  - Tabs are colored distinctly per section, though with only 6 sprite colors for 8 sections two pairs intentionally share a color (courses/certificates, languages/personality) — accepted as provisional until more distinct art exists
  - The last selected bookmark section is remembered across closing and reopening the journal (not reset to the default every time)

- **FR-017**: System MUST render collected facts within the journal in the **Simple List** entry style: clean bullet-point notes on lined paper with handwriting font, displaying key data fields concisely. Each fact entry includes the section-appropriate icon (🏢 for experience, 🎓 for education, etc.) and key data fields. Skills entries use star ratings (e.g., "TypeScript ★★★★☆").

- **FR-017b**: System MUST display a per-section collection counter near each section's header or bookmark (e.g., "Skills 3/5") showing how many facts have been collected out of the total for that section. **Exception**: Personality has no counter — there is only one fact, shown directly on the always-visible "About Me" bookmark rather than collected. Contact never appears in the journal at all, so it has neither a bookmark nor a counter to consider.

- **FR-018**: System MUST paginate journal content as one continuous flat sequence of pages spanning the whole book, not scoped per section. Each non-empty section inserts its own pages into that sequence: Personality and Languages each contribute exactly one page (Languages lists every collected language together, each with its own star rating); Skills, Experience, Projects, Education, Courses, and Certificates each contribute one page per collected fact (minimum one, showing an empty-state placeholder, so a section with nothing collected yet still has a page to land on) — Skills' page shows one category's skills as star-rated rows. Prev/Next arrow controls walk this flat sequence in section order and wrap around at both ends (Next from the book's last page returns to its first, and symmetrically for Prev) — there is no disabled state at either end. Clicking a bookmark tab jumps to that section's first page in the sequence; paging past a section boundary updates the active bookmark to match. Arrow controls are pixel-art chevron icons, hover-reveal only (invisible until the pointer is over that physical half of the book — left half reveals the left arrow, right half the right arrow — then fade in), not always visible.

- **FR-018b**: System MUST include a "Reset Game" button in the journal overlay, rendered as a pixel-art icon (not a text label). Clicking it clears all collected facts and closes the journal immediately (no reverse-close animation), then starts the same iris-in transition used for a death/debug respawn, centered on the freshly-spawned player — reading as "starting again". The game world resets to its initial state (character respawns at spawn point, all coins/enemies/blocks/chests respawn).

#### Enemies (P2)

- **FR-019**: System MUST render simple enemy characters that patrol horizontally on platforms. Enemies reverse direction at platform edges or designated patrol boundaries.

- **FR-020**: System MUST implement enemy interaction:
  - **Stomp defeat**: Character landing on top of an enemy defeats it with a poof/squish animation and reveals a CV fact — green slimes (Courses) are defeated in a single stomp; purple slimes (Courses too) take two stomps, with the fact revealed on the second, finishing stomp. Each stomp (finishing or not) gives the character a short upward bounce.
  - **Side/below collision**: Character takes damage (flashes, brief knockback) with invincibility frames; the enemy remains
  - Defeated enemies are removed from the game world for the session

- **FR-020b**: System MUST implement a 3-heart health system backed by 6 half-heart units, rendered via `hearts.png` (full/half/empty per heart icon). The character starts with 3 hearts (6/6 half-heart units) displayed in the HUD. Both damage sources share the same underlying `takeDamage(amount)` mechanism:
  - **Falling into a pit** costs half a heart, one half-heart unit (`takeDamage(1)`), and repositions the character to the last solid ground position before the fall — not a checkpoint reset.
  - **Side/below enemy collision** costs a full heart, two half-heart units (`takeDamage(2)`), with brief invincibility frames after taking damage.
  - At 0 hearts (from either source), the character respawns at the last checkpoint with full health (6/6 half-heart units restored), and all collected facts are preserved.

- **FR-020c**: System MUST reset enemies and destroyable blocks back to their initial patrol/intact state whenever the character respawns (the FR-020b death→respawn flow), so the level's layout and platforming challenge stay consistent across attempts. **Coins are the exception**: an already-collected coin's visual representation stays removed for the rest of the session — it does not reappear on respawn. Because `collectedFacts` is preserved (FR-020b) while enemies/blocks respawn, re-triggering an already-collected source after a respawn (stomping a respawned enemy that was already defeated, or hitting a respawned block that was already broken) MUST NOT grant a duplicate CV fact or drop bonus fruit again — `CollectedFact` state is deduplicated by the source collectible's `id` (see `CollectibleDef.id`, FR-032), so a respawned enemy/block simply yields nothing on a repeat encounter. This is distinct from FR-018b's "Reset Game" button, which is a deliberate full reset that also clears `collectedFacts` and respawns coins too.

#### Destroyable Blocks (P2)

- **FR-021**: System MUST render three visually distinct destroyable block types, each a `BlockDef` entity placed via hand-authored level markers (not baked into terrain, consistent with FR-013's marker approach). There is no dedicated crack-progression sprite sheet — the three types are built from a crate tile, five terrain-matched `?` tiles, and plain terrain tiles:
  - **Crate**: a wooden crate tile. Intact by default; shows a cracked overlay after one hit; breaks apart after a second hit. Carries an Education, Activity, or Language fact.
  - **Question-mark**: one of five palette-matched `?` tiles (matching the surrounding terrain's color — brick, sandy, pink/red, teal, blue-gray); after a single hit, permanently swaps to a plain, top-exposed ground-rock tile.
  - **Rock**: a plain terrain-styled tile, visually distinct from both ordinary solid terrain and the palette's `?` tiles; breaks to empty space after a single hit.

  A block is solid from every direction regardless of hit count or hit direction — "hitting from above or the side has no effect" (FR-022/FR-022b/FR-022c) refers only to the block's CV/hit *reaction* (crack, break, fruit-pop, convert), not to collision.

- **FR-022**: System MUST implement the crate's hit mechanic: an upward hit from below on an intact crate shows a crack overlay with no fact or reward yet. A second upward hit breaks the crate apart with a shatter animation and reveals the associated CV fact (Education, Activity, or Language) — the fact text floats up from the break point, hovers briefly, then animates toward the journal icon, same as any other collectible. Hitting a crate from above or the side has no reaction effect at either hit count — the crate remains a solid obstacle from those directions either way. **The crack overlay is a checked-in asset, `public/sprites/crack_overlay.png`**: a 16×16 transparent-background PNG derived from the existing `groundRock` terrain tile by thresholding its pixels by luminance (`lum<35` — tight enough to keep only the near-black outline, not the tile's dark-brown fill color), loaded like any other sprite and composited over the crate tile when `hitsTaken === 1`.

- **FR-022b**: System MUST implement the question-mark block's hit mechanic: a single upward hit from below spawns a bonus fruit carrying the associated Certificate or Project fact (rendered from `fruit.png`) that rises into the space directly above the block and lands as a touchable pickup — collecting it flies the fact to the journal exactly like any other collectible. The block itself permanently swaps to a plain, top-exposed ground-rock terrain tile and no longer responds to hits. Hitting from above or the side has no reaction effect (still solid).

- **FR-022c**: System MUST implement the rock block's hit mechanic: a single upward hit from below breaks it immediately into empty space with a sparkle-puff effect — no fruit, no fact, no reward. Rocks are not mapped to `CVData`; they exist purely as a level-design tool for shaping traversal (e.g. opening a shortcut or blocking one until broken). Hitting from above or the side has no reaction effect (still solid).

- **FR-022d**: System MUST play a short bump/nudge animation (the block moves up a few pixels then settles back, roughly 100ms) on every upward hit, for all three block types — including a block's terminal hit (crate's second hit, question-mark's and rock's only hit) — so every hit gets consistent tactile feedback regardless of which visual change (crack, shatter, convert, or disappear) also happens on it.

#### Chests & Level Completion (P2)

- **FR-023**: System MUST render treasure chests as a `ChestDef` entity, placed via hand-authored level markers (the `T` marker, consistent with FR-013's marker-based placement approach) — one chest per non-empty Experience entry. A chest sits flush with the ground (not solid — FR-006's platform-collision rules don't apply to it) and renders in its closed state by default. Unlike every other collectible, opening a chest is NOT automatic on touch — when the character's hitbox overlaps a closed chest AND the visitor presses Arrow Up, it permanently swaps to its open state (never reverts to closed except via Reset Game) and the associated Experience fact text floats up from the chest, hovers briefly, then animates toward the journal icon, same as any other collectible. Merely overlapping a closed chest without pressing Arrow Up has no effect. A HUD chest counter (e.g. "Chests 2/5", positioned near the heart/coin HUD elements) tracks how many chests have been opened out of the level's total. Per FR-013's marker-count convention, the level's actual chest count is capped by how many `T` markers exist, not by how many Experience entries `CVData` has. Chest defs zip against markers in level-reading order against Experience entries in **reversed** `CVData` order (oldest entry first) — since `CVData.experience` is stored newest-first but markers are placed near-spawn-to-farther-away, this makes the chests read as a chronological career progression as the visitor plays further into the level: the closest chest reveals the oldest job, the farthest chest the newest one.

- **FR-024**: System MUST display the Thank You screen once the last chest in the level is opened, showing a thank-you message, the CV's Contact information, and "press any button to continue" text beneath. Displaying the screen transitions `gamePhase` to `ending-screen`, pausing the game loop exactly like `paused` does. Any key press or click dismisses the screen, returning `gamePhase` to `playing` and resuming gameplay from the exact paused state — no separate "Replay Level" option is offered (Reset Game, FR-018b, already covers restarting). Contact is never added to `collectedFacts` or the journal; it exists only on this screen. The screen is a solid full-screen black background with white text, completely covering the game while shown (not a card floating over a dimmed backdrop), with a "curtain falling" entrance animation: the background starts translated fully off-screen upward and slides down into view on mount, like a stage curtain dropping. Dismissal itself is instant, with no reverse "curtain rising" animation.

#### Controls & Theme Infrastructure (P3)

- **FR-025**: System MUST render the HUD during gameplay with the following layout:
  - **Top-left**: journal icon button (opens/closes the journal, same as `J` key), immediately left of the 3 hearts (health indicator).
  - **Top-right**: Floating translucent controls — theme selector and language toggle (following the same pattern as the Space theme)

- **FR-026**: System MUST support locale switching: when `currentLocale` changes, journal content and in-game notifications re-render in the selected language while preserving game state and position.

#### Guidance & Onboarding (P3)

- **FR-036**: System MUST show a translucent controls overlay listing only universal controls (movement keys, jump key, journal toggle key) when gameplay first enters the `playing` phase. The overlay MUST auto-dismiss on the player's first movement or jump input, or after a short timeout, whichever comes first, and MUST NOT reappear for the remainder of the session.

- **FR-037**: System MUST render hint signs as a non-solid, non-collectible level entity (`SignDef`), placed via hand-authored level markers. Each distinct hint gets its own single-digit marker character (`1`–`9`, consistent with FR-013's marker-based placement approach), mapped directly to a `hintId` in `LevelParser.ts`'s `SIGN_CHARS` table (e.g. `'1': 'bridgeDropThrough'`) — the character itself carries the hint's identity, independent of its position in the level layout, so the layout can be freely edited/reordered without breaking which sign shows which text. This is deliberately simpler than the CVData-order "zip" convention FR-013 uses for coins/enemies, since hint content is hand-authored, not pulled from an ordered CVData array — capped at 9 distinct hints total is an accepted constraint. Signs use the wooden signpost tile at `world_tileset.png` tile coordinates (col 8, row 3 → pixel 128,48), the tan/brown palette variant sitting directly beside the crate tile (col 7, row 3).

- **FR-038**: System MUST display a sign's hint text in a speech-bubble tooltip near the character when the character's hitbox overlaps the sign's trigger zone, and hide it when the character no longer overlaps. This interaction MUST NOT pause the game, MUST NOT block movement (signs are not solid), and MUST NOT add anything to `collectedFacts` or the journal — hint text is not CV data, and signs are reusable rather than consumed on first touch.

- **FR-039**: System MUST source hint text from the existing i18n system (`src/i18n/locales/en.json`/`de.json`), NOT a bespoke dictionary — each hint's text lives under a new `platformer.hints.<hintId>` key (e.g. `platformer.hints.bridgeDropThrough`), read the same way existing platformer UI strings are (`currentUI.value.platformer.hints[hintId]`, per the pattern already used in `Journal.tsx`). Hint text is NOT derived from `CVData` and re-renders in the selected locale when `currentLocale` changes, consistent with FR-026.

- **FR-040**: Initial hint signs cover contextual mechanics not included in the trimmed controls overlay (FR-036) — at minimum, a sign near the level's first one-way bridge explaining the Down/`S` drop-through control (FR-006/FR-007). Additional contextual signs (e.g. for the ladder-climbing mechanic, User Story 6b) may be added as needed.

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
    │   └── ThankYouScreen.tsx      # Thank You screen — Contact reveal once all chests are opened (P2)
    ├── engine/
    │   ├── GameLoop.ts             # rAF-based game loop, state machine
    │   ├── Input.ts               # Keyboard input tracking per frame
    │   ├── Physics.ts             # Gravity, collision detection, movement, climbing
    │   ├── Camera.ts              # Viewport scrolling to follow character (horizontal + vertical)
    │   ├── Renderer.ts            # Canvas 2D rendering — sprites, tiles, effects
    │   └── SpriteLoader.ts        # Asset preloading and sprite sheet management
    ├── entities/
    │   ├── Player.ts              # Character state: position, velocity, animation frame
    │   ├── Collectible.ts         # Coin/collectible state and collision
    │   ├── Enemy.ts               # Enemy patrolling and collision (P2)
    │   ├── DestroyableBlock.ts    # Block state and hit tracking (P2)
    │   ├── Chest.ts               # Chest state — closed/open, per-chest fact (P2)
    │   └── HintSign.ts             # Sign trigger-zone state and overlap detection (P3)
    ├── level/
    │   ├── LevelData.ts           # Type definitions for level structure
    │   ├── Terrain.ts             # Tile helpers — isSolid, isClimbable, tile-to-pixel conversion
    │   ├── level1.ts              # Level 1 data — terrain, collectibles, mappings
    │   ├── CollectibleMapper.ts   # Maps CVData to collectible placements
    │   └── ChestMapper.ts         # Maps CVData Experience entries to chest placements
    └── types.ts                   # Shared types for the platformer theme
   ```

#### State Management

- **FR-031**: System MUST manage game session state containing:
  - `gamePhase`: Current game state (`loading` | `playing` | `paused` | `ending-screen`)
  - `playerState`: Position, velocity, animation frame, facing direction, grounded/climbing status
  - `collectedFacts`: Set of collected fact IDs — used to determine which collectibles are still in the world and which CV facts appear in the journal
  - `cameraPosition`: Current viewport scroll offset, both horizontal and vertical (`cameraPositionY` follows the same dead-zone/clamp approach as the horizontal axis; a no-op on any level whose height fits the viewport)
  - `enemyStates`: Per-enemy position, direction, defeated status (P2)
  - `blockStates`: Per-block hit count and broken status (P2)
  - `chestStates`: Per-chest open/closed status (P2)

- **FR-032**: System MUST define TypeScript types for the platformer theme:
  - `GamePhase`: `'loading' | 'playing' | 'paused' | 'ending-screen'` — the death/respawn flow additionally uses `'intro'` and `'dying'`/`'awaitingRestart'` (see `engine/GameLifecycle.ts`). Only `'dying'`/`'awaitingRestart'`/`'paused'` pause the game loop; `'intro'` (the iris growing open at mount/restart) is a purely visual overlay on top of already-running gameplay, so a pit near spawn is still live during it.
  - `PlayerState`: `{ x: number; y: number; vx: number; vy: number; facing: 'left' | 'right'; grounded: boolean; climbing: boolean; animState: 'idle' | 'walk' | 'jump' | 'climb'; animFrame: number }` — `climbing` gates the physics branches the same way `grounded` already does.
  - `TileType`: `'groundGrass' | 'groundRock' | 'platform' | 'wall' | 'bridge' | 'ladder' | 'empty'` — `ladder` is not solid (`isSolid('ladder') === false`) but climbable (`isClimbable(tile)`).
  - `CollectibleDef`: `{ id: string; spriteType: 'coin' | 'fruit'; fact: CollectedFact }`
  - `CollectedFact`: `{ id: string; sectionId: SectionId; sectionLabel: string; data: CVItemData | SkillCategoryFact; sourceType: 'coin' | 'enemy' | 'block' | 'chest' }`
  - `EnemyDef`: `{ id: string; spriteType: 'slimeGreen' | 'slimePurple'; fact: CollectedFact }`
  - `BlockDef`: `{ id: string; blockKind: 'crate' | 'questionMark' | 'fragileRock'; fact?: CollectedFact }` — `fact` is present on `crate` blocks (Education/Activities/Languages) and `questionMark` blocks (Certificates/Projects); `fragileRock` carries no CV mapping.
  - `ChestDef`: `{ id: string; fact: CollectedFact }`, mirroring `EnemyDef`'s static-def shape — `fact` is always present (drawn from Experience, one chest per non-empty entry). Placement adds `x`/`y` to produce `ChestPlacement extends ChestDef`, same `Def`→`Placement` convention as `EnemyPlacement`/`CollectiblePlacement`/`BlockPlacement`. Live per-instance open/closed state (`ChestState extends ChestPlacement { state: 'closed' | 'open' }`) mirrors `BlockState`'s `Def`→`Placement`→`State` layering.
  - `LevelDef`: `{ terrain: TileMap; collectibles: CollectibleDef[]; enemies: EnemyDef[]; blocks: BlockDef[]; chests: ChestDef[]; signs: SignDef[]; spawn: Point; width: number; height: number }`
  - `SignDef`: `{ id: string; x: number; y: number; hintId: string }` — `hintId` looks up localized text at `platformer.hints.<hintId>` in the existing i18n translation files; no `cvSection`/`cvIndex`, since signs carry no CV mapping (P3, see FR-037).

#### Testing

- **FR-033**: System MUST include unit tests covering:
  - `CollectibleMapper` — correct mapping of CVData to collectible definitions per FR-009 (Skills → coins)
  - `EnemyMapper` — correct mapping of Courses to green/purple slimes, alternating by index
  - `BlockMapper` — correct mapping of Education/Activities/Languages to crates and Certificates/Projects to question-mark blocks
  - `ChestMapper` — correct mapping of CVData Experience entries to chest definitions per FR-009/FR-023; Personality has no collectible (shown on the About Me bookmark) and Contact has no collectible (shown on the Thank You screen only) — neither should ever be produced by any mapper
  - `Physics` — gravity, jump arc, collision with platforms, collision with pits, climbing
  - `Input` — keyboard event parsing, key held vs pressed
  - Journal content rendering with sample CV data
  - Collected fact tracking (add fact, check if collected, persist across respawn)
  - Game state transitions (`playing` → `paused` → `playing`)

- **FR-034**: System MUST include component tests covering:
  - `PlatformerPage` renders canvas element
  - `Journal` renders with correct sections based on CV data
  - `BookmarkTabs` active/inactive states
  - `ThankYouScreen` displays the thank-you message and Contact info once all chests are open (P2)

#### Audio (P2, not committed — see roadmap.md's "Maybe / reconsider later")

- **FR-035**: System MUST support audio playback including a looping background music track and sound effects for game actions (jump, coin collection, enemy stomp, block break, damage, journal open/close, chest open, Thank-You-screen fanfare). Audio is muted by default — playback requires visitor opt-in via a speaker icon in the HUD. Audio assets are pre-loaded alongside sprite assets (per FR-028) before entering the `playing` state. The audio state (muted/unmuted) is tracked in game session state.

### Key Entities

- **Player (character)**: The visitor's avatar in the game world. State includes position (x, y), velocity (vx, vy), animation state (idle/walk/jump/climb), facing direction, and grounded/climbing flags.

- **Level**: The game world — a side-scrolling environment defined by terrain tiles, collectible/enemy/block/chest placements, and spawn points. In v1, one continuous level covers all CV sections.

- **Collectible**: An item in the game world that, when acquired by the player, reveals a CV fact. Types: coin (Skills), enemy defeat (Courses), crate block break (Education/Activities/Languages), question-mark block bonus fruit (Certificates/Projects). Each collectible is mapped to a specific CV data item by section.

- **Chest**: A `ChestDef` entity — the level's "main objective" collectible, distinct from ordinary `Collectible`s. Starts `closed`; touching it while pressing Arrow Up permanently swaps it to `open` and reveals its associated Experience fact. Tracked by its own HUD counter, separate from coins/hearts. See User Story 6, FR-023.

- **Destroyable Block**: A `BlockDef` entity that responds to upward hits from below. Three kinds (FR-021): **Crate** (2 hits — crack overlay, then breaks and reveals an Education/Activity/Language fact), **Question-mark** (1 hit — spawns a bonus fruit carrying a Certificate/Project fact, then permanently converts to a plain ground-rock terrain tile), **Rock** (1 hit — breaks to empty space, no fact, no reward, pure level-design filler).

- **Bonus fruit**: The pickup a question-mark block spawns on its single hit — carries a Certificate or Project fact and flies to the journal on collection like any other collectible, distinct in art (a fruit sprite) from a coin so it's never confused with a Skills coin.

- **Hint Sign** (P3): A non-solid, non-collectible level entity that shows a localized gameplay hint (not a CV fact) in a speech-bubble tooltip while the character overlaps it. Reusable — never consumed, never added to `collectedFacts` or the journal. Teaches contextual mechanics (e.g. the one-way bridge drop-through) that the trimmed controls overlay deliberately excludes.

- **CollectedFact**: A record of a discovered CV fact — links the CV data item to its source collectible type. The collection of all `CollectedFact` objects is the session's discovered CV content.

- **Journal**: The notebook overlay where collected CV facts are readable. Consists of bookmark tabs (one per CV section), paginated pages, and Simple List entry styling.

- **CV Data** (from F-002): Read via `currentCV.value`. All collectible mappings and journal content derive from `CVData`. Locale switching updates content.

**Entity Relationships**:
```
CVData (from currentCV signal)
 ├── Mapped by CollectibleMapper → CollectibleDef[] (coins, placed in level)
 ├── Mapped by EnemyMapper → EnemyDef[] (courses, placed in level)
 ├── Mapped by BlockMapper → BlockDef[] (crates/question-marks, placed in level)
 ├── Mapped by ChestMapper → ChestDef[] (experience, placed in level)
 └── Referenced by CollectedFact[] (when collectibles are acquired)

Level
 ├── Contains CollectibleDef[]/EnemyDef[]/BlockDef[]/ChestDef[] placements
 ├── Contains Terrain (platform/ladder tiles, collision data)
 └── Defines spawn and checkpoint positions

Player
 ├── Collides with Terrain (stands, jumps, falls, climbs)
 ├── Collides with Collectible/Block → triggers fact collection
 ├── Collides with Chest → opens it (on Arrow Up), triggers fact collection
 └── Tracked by Camera (viewport follows player horizontally + vertically)

Session State
 ├── CollectedFact[] — which facts have been discovered
 ├── PlayerState — current position, animation
 ├── chestStates — per-chest open/closed (all chests open → ending-screen)
 └── GamePhase — playing, paused, ending-screen

Journal
 ├── Reads CollectedFact[] to render discovered content
 ├── Groups facts by section (for bookmark tabs)
 └── Paginates content across the whole book

FloatingControls (P3)
 ├── Reads currentTheme / currentLocale signals
 └── Writes to currentTheme / calls changeLocale()
```

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Core platformer mechanics work**: A visitor can control a character that moves left/right, jumps, lands on platforms, climbs ladders, and is followed by a scrolling camera (horizontal and vertical). Character animations (idle, walk, jump, climb) are visibly distinct. Verified by: manual play test.

- **SC-002 — Every CV item has a collectible**: Each non-empty item in Skills, Experience, Education, Courses, Certificates, Activities, Languages, and Projects maps to at least one collectible in the level according to the FR-009 mapping. Personality is excluded (shown directly on the About Me journal bookmark) and Contact is excluded (revealed only via the Thank You screen once all chests are opened). Verified by: unit test.

- **SC-003 — Collecting reveals journal content**: When a visitor collects all coins, defeats all enemies, destroys all blocks, and opens all chests, the journal contains all mapped CV facts, organized by section with functional bookmark tabs. Verified by: component test that simulates collecting everything and checks journal content.

- **SC-004 — Journal is readable**: The journal renders with lined-paper background, `Caveat` handwriting font, colored bookmark tabs, and Simple List entry style. A non-technical person can read and understand all CV facts. Verified by: visual review and component test for correct rendering.

- **SC-005 — Game runs at 30 FPS**: The game loop maintains consistent 30 FPS on a modern desktop browser (Chrome/Firefox) with the character, terrain, and 20+ collectibles rendered. Verified by: frame timing instrumentation in test.

- **SC-006 — Theme and locale switching work**: Switching to another theme replaces the game. Switching locale updates journal content. Switching back to Platformer is intended to reset the game (see User Story 8, currently unimplemented). Verified by: component tests that exercise theme/locale signals.

- **SC-007 — Zero TypeScript errors**: The entire Platformer theme implementation compiles under `strict: true` with no `any` types and no `@ts-ignore` directives. Verified by: `npm run build` passes cleanly.

- **SC-008 — Asset loading completes before gameplay**: All sprite sheets and game assets are pre-loaded before the `playing` state begins. A loading indicator is visible during asset loading. Verified by: test that checks game phase transitions.

## Assumptions

- **F-002 (Data Model) is complete**: `CVData` types and both `cv.en.json` / `cv.de.json` files exist and are importable. S-006 consumes these, does not create or modify them.
- **F-012 (Theme System) is available**: `createLocalStorageSignal`, `currentTheme` signal, `ThemeId` type, and theme registration in `App.tsx` all exist.
- **F-013 (Multilanguage) is complete**: `currentLocale`, `currentCV` computed signals, and `changeLocale` function exist in `src/state/locale.ts`.
- **Desktop-only**: The Platformer theme is designed for desktop with keyboard input only. Mobile/touch controls are permanently out of scope, not a deferred enhancement.
- **Single level in v1**: Iteration 1 ships with one continuous level covering all CV sections. Additional levels per section can be added in future iterations.
- **HTML5 Canvas for rendering**: The game uses Canvas 2D API (not WebGL/three.js), keeping the implementation simple and aligned with the "simple 2D platformer" scope.
- **Sprite assets from existing mockup images**: Character, enemy, coin, terrain, and block sprites derive from the images in `specs/S-006-platformer-theme/images/`. Chest sprites (`chest_closed.png`/`chest_open.png`) were generated separately and checked in under `public/sprites/` (16×16 native canvas, cropped to their tight non-square bounding box and downscaled with nearest-neighbor sampling — 28×20 and 24×20 respectively — transparent background).
- **Game state is session-only**: No localStorage or backend persistence. Collected facts reset on page reload or theme switch.
- **`Caveat` font from Google Fonts**: Journal handwriting font uses the existing font import pattern. Falls back to system cursive fonts if unavailable.
- **Journal uses Simple List style**: Based on the existing `entry-styles-mockup.html`, the chosen entry style for journal content is the Simple List approach — clean bullet-point notes with key data fields.
- **Audio is muted by default**: Audio playback (background music + sound effects) requires visitor opt-in via the speaker icon in the HUD. Audio assets are pre-loaded alongside sprite assets. (Not currently committed — see User Story 7.)
- **Spawn points throughout the level**: Invisible spawn points defined in the level data serve as checkpoints. The character respawns at the nearest spawn point on death.
- **Collision uses simple AABB (Axis-Aligned Bounding Box)**: Physics and collision detection use rectangular hitboxes, not pixel-perfect collision. This is standard for retro-style platformers.
- **Fixed sprite sizes**: Character, enemy, coin, and block sprites have fixed pixel dimensions (e.g., 32×32 or 16×16 tiles). The canvas is scaled to fit the viewport while maintaining the pixel-art aesthetic. **Exception**: chests are a non-square 28×20 / 24×20 native size — they use their own render-size constant rather than reusing the 16×16 `BLOCK_FRAME_SIZE` convention.
- **Personality has no collectible; Contact is Thank-You-screen-only**: Personality is shown directly on the always-visible "About Me" journal bookmark, never via a collectible. Contact is NOT placed as a collectible either — it's revealed exclusively via the Thank You screen once every chest in the level is opened, and is never added to the journal.

## Clarifications

### Session 2026-08-05

- **Q: Damage & Health System** — **A**: 3-heart health backed by 6 half-heart units, checkpoint respawn at 0 health. Character has 3 hearts (`hearts.png`, full/half/empty), brief invincibility frames on hit. Pit falls cost half a heart and reposition the character to the last solid ground (no checkpoint reset); enemy side/below collision costs a full heart — both use the same `takeDamage(amount)` mechanism. At 0 health: respawn at nearest spawn point with full health, collected facts preserved. No game-over screen.
- **Q: Platform Behavior** — **A**: All platforms are solid from every direction. Character cannot jump up through platforms from below. **Exception**: `bridge` tiles are one-way — passable from below, solid from above — since a rope/plank bridge is the one terrain type where that behavior reads as natural rather than surprising. A Down-arrow/`S` "drop through" key exists once a level has a platform-bridge-platform arrangement with reachable ground underneath.
- **Q: Level Design Approach** — **A**: Hand-crafted level using a grid/raster system with width and height for easy element positioning. Start with a simple level to validate functionality, then expand iteratively.
- **Q: Checkpoint System** — **A**: Invisible spawn points defined in the level data. Character respawns at the nearest spawn point on death.
- **Q: HUD Layout** — **A**: Top-left: 3 hearts. Top-right: theme and language selector (like Space theme). Bottom-right: journal icon button.
- **Q: Checkpoint Persistence Across Theme Switches** — **A**: Not in v1. Checkpoints only matter within a single session (for respawn after death). Switching themes always resets. May revisit this as a future enhancement.

### Session 2026-08-29

- **Q: Destroyable block design** — **A**: There is no dedicated crack-progression block sprite sheet; the design uses three distinct types built from what the tileset actually has — a wooden crate tile, five terrain-matched `?` tile palettes, and plain terrain tiles. **Crate**: 2 hits (crack overlay, then break + reveal a fact). **Question-mark**: 1 hit (spawns a bonus fruit, converts permanently to a ground-rock tile). **Rock**: 1 hit (breaks to empty space, no fact, no reward — pure level-design filler, not mapped to `CVData`). Crack visuals are drawn programmatically as a canvas overlay rather than a new sprite. A short bump/nudge animation plays on every below-hit across all three types, including each type's terminal (breaking/converting) hit.
- **Q: Enemy section mapping** — **A**: Courses (12 CV entries) sit on enemies rather than sharing the crate mechanic with Education/Activities — too large a pool for a 2-hit mechanic, and slimes are well suited to a large pool. Both slime colors guard the same Courses pool, split alternately by index between the lightweight 1-hit green slime and the tougher 2-hit purple slime. See FR-009 and User Story 4.

### Session 2026-08-30

- **Q: Is mobile/touch support planned for a later iteration?** — **A**: No — permanently out of scope, not a deferred P3 enhancement.
- **Q: Does switching themes and back already reset the game?** — **A**: No, not yet — gameplay state lives in module-level `signal()`s that survive the component unmount/remount a theme switch causes, so the game currently resumes exactly where it was left. FR/SC text describing theme-switch reset describes the intended behavior of User Story 8, which remains unimplemented — see roadmap.md's "Maybe / reconsider later" section.

### Session 2026-08-30 (chests + Thank You screen)

- **Q: What is the level's "main objective" collectible?** — **A**: Treasure chests — a "main objective" collectible (visually and mechanically distinct from coins/fruit/crates), each carrying an Experience fact (the CV section considered most valuable). A chest starts closed and, unlike every other collectible, does NOT open on touch — the character must be standing on/overlapping it and press Arrow Up to open it, permanently swapping it to its open state and revealing its fact like any other collectible (see FR-023). A dedicated chest counter in the HUD (e.g. "Chests 2/5") makes the objective visible at a glance. Once every chest is opened, a Thank You screen appears wherever the visitor happens to be.
- **Q: What does the Thank You screen show, and does it block play?** — **A**: A thank-you message, the CV's Contact information, and "press any button to continue" text. It pauses the game (`gamePhase: 'ending-screen'`) and is dismissed by any key/click, resuming exactly where play left off — deliberately non-blocking so a visitor can still mop up remaining coins/crates. No "Replay Level" option (Reset Game already covers restarting). Contact is shown only here — never added to the journal, no bookmark.
- **Q: What do crates carry now that Experience has its own collectible?** — **A**: Crates carry Education, Activities, and Languages. Coins narrow to Skills only.
- **Q: Do Personality/Contact share a single reveal mechanism?** — **A**: No — they're decoupled. Personality lives on the always-visible "About Me" journal bookmark. Contact is revealed only via the Thank You screen.
- **Q: Where are chests placed in the level?** — **A**: Scattered via hand-placed markers, the same pattern as coins/enemies/blocks (the `T` marker in `LevelParser.ts`) — not clustered at the level's end, since there's no single trigger location.
- **Q: What sprites were needed, and how were they made?** — **A**: `chest_closed.png`/`chest_open.png` — no chest art existed anywhere before this. Generated via nano-banana (flat, front-facing 2D style matching the existing crate tile), both states in a single generation call for visual consistency, on a solid magenta background for chroma-keying. Cropped tightly to each chest's bounding box before downscaling with nearest-neighbor sampling to a small non-square size (28×20 closed, 24×20 open).

### Session 2026-08-30 (ladders + vertical camera)

- **Q: What art exists for climbing?** — **A**: `knight2.png` (the sheet already used for jump/fall) has a dedicated 4-frame "climb (back view)" row that was never wired up — no new asset needed.
- **Q: Should climbing lock the character to the ladder's column, or allow free horizontal movement?** — **A**: Free-form — Left/Right work exactly as normal while climbing. Moving off every ladder tile the hitbox overlaps ends the climb immediately (normal gravity/collision resumes that same frame), rather than a strict column-lock a player has to deliberately dismount from.
- **Q: How does the character start/stop climbing?** — **A**: Walk-and-press, no separate action: overlapping a `'ladder'` tile and pressing Up starts climbing upward; standing on the solid ground directly above a ladder's top rung and pressing Down starts climbing downward (re-entering the ladder) — the same convention already used for signs/chests (stand on it, a key does the thing), and the same solid-from-above/climbable-from-below shape `'bridge'` tiles already use for their own one-way behavior.
- **Q: How tall is the ladder in `level1`, and why?** — **A**: It extends up from the existing floating platform to a new tier above it — tall enough that a real desktop browser window has to scroll vertically to follow the climb, since `level1` on its own (6 tiles / ~192px) is nowhere near tall enough to ever need scrolling (`canvas.width/height` are `window.innerWidth/innerHeight`). The new tier is called out as throwaway/replaceable in a code comment — it exists to give this feature a real manual browser Verify, not as final level design.
- **Q: Does `LevelParser.parseLevel` require every row to be the same hand-typed length?** — **A**: No — rows are padded with `'empty'` up to the width of the widest row instead of throwing on a mismatch, so authoring a mostly-empty-sky ladder shaft doesn't require 80 literal dots per row.
- **Q: How does vertical camera follow work?** — **A**: A new `updateCameraY`/`cameraPositionY`, parallel to the existing horizontal `updateCamera`/`cameraPositionX` — same dead-zone-follow-and-clamp shape, own constant, kept as a separate function so the already-shipped horizontal logic is untouched. On any level whose height fits the viewport, the clamp always resolves to 0 — bottom-anchored.

## Iteration Plan

This feature is intentionally scoped for incremental delivery:

| Iteration | Priority | Scope | Key Deliverables |
|-----------|----------|-------|-----------------|
| **1** | P1 | Core platformer + coins + journal | Player movement, level terrain, coin collectibles (Skills), journal with bookmarks, CV fact mapping |
| **2** | P2 | Enemies + blocks + chests + level end + ladders | Enemy patrol and stomp (Courses, split across green/purple slimes), destroyable blocks (Education/Activities/Languages via crates; Certificates/Projects via question-mark bonus fruit; rock blocks for level-design texture, no CV mapping), chests (Experience) with a HUD counter, Thank You screen revealing Contact once all chests are opened, ladders + vertical camera follow. Audio is not committed — see roadmap.md's "Maybe / reconsider later" section. |
| **3** | P3 | Controls + polish | Floating theme/locale controls, universal controls overlay, contextual hint signs, visual polish |

Each iteration is independently shippable and adds gameplay depth without breaking previous functionality.

## Out of Scope

- **Mobile/touch controls** — permanently out of scope, not planned
- **Multiple levels** (v1 ships with one level; additional levels are future enhancements)
- **Score tracking or leaderboards**
- **Boss enemies or complex enemy AI** (simple patrol-only in P2)
- **Power-ups or character abilities beyond walk/jump/climb**
- **Level editor or user-created content**
- **WebGL/3D rendering** (Canvas 2D only)
- **Online multiplayer or sharing**
- **Game state persistence across sessions** (localStorage save/load is a future enhancement)
- **Responsive layout below 1024px** (desktop-only, consistent with other themes)
- **Keyboard remapping** (fixed controls: arrows + space/J)
- **Print-friendly styling for the journal**
