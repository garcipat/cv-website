# S-006 Platformer Theme — Implementation Roadmap

**Purpose**: `spec.md` defines *what* the Platformer theme is (requirements, iteration
plan at P1/P2/P3 granularity). This roadmap breaks each iteration down further into
small, independently implementable and browser-verifiable steps. Each step gets its
own implementation plan (via the `writing-plans` skill) when we're ready to build it —
tests first (per the constitution), then a manual browser check.

Status legend: `[ ]` not started, `[~]` in progress, `[x]` done.

## Iteration 1 — Core movement + coins + journal (P1)

- [x] **1. Theme skeleton + floating controls** — register the `platformer` theme in
  `App.tsx`'s `themePages` map, full-viewport `<canvas>` renders (blank/loading
  state), floating theme/locale controls (top-right, reusing `ThemeSelect` /
  `LanguageSelect` per the Space theme pattern) render on top of the canvas so the
  theme is escapable during manual testing. No pause-on-open behavior yet — that
  needs the game loop from step 22.
  *Verify: switching to the Platformer theme shows a canvas with working theme/locale
  controls on top; switching away and back works.*
- [x] **2. Static level render** — terrain tiles drawn from hand-crafted level data,
  no player yet.
  *Verify: the level layout (ground, platforms) is visible.*
- [x] **3. Player idle render** — sprite drawn standing on the ground, no physics.
  *Verify: character visible on a platform.*
- [x] **4. Gravity + solid collision** — character rests on platforms, falls into
  pits; no input yet.
  *Verify: spawn the character mid-air, watch it land or fall.*
- [x] **5. Horizontal movement + walk animation** — arrow keys move the character,
  sprite faces movement direction.
  *Verify: walk left/right on screen with visible walk animation.*
- [x] **6. Jump** — jump physics (variable height by hold duration) + jump animation.
  *Verify: jump across a gap.*
- [x] **7. One-way bridge platforms** — `bridge` tiles become passable from below
  (jumping up through them) while remaining solid when landing on top, instead of
  being solid from every direction like other terrain. Depends on step 6's jump
  existing (the "jump up through from below" case can't be exercised without it).
  Extended beyond the original scope: `level1`'s floating platform (row 7) was
  redesigned into a platform-bridge-platform arrangement with reachable ground
  below, and a Down-arrow/`S` drop-through was added now that a level layout
  actually needs it (see `docs/themes/Platformer.md` for the updated reasoning).
  *Verify: jump up through a bridge from below and land on top of it; walking onto it
  from the side and standing on top both still work solidly; holding Down while on a
  bridge drops the character through it.*
- [x] **8. Camera scroll** — viewport follows the character horizontally.
  *Verify: walk right, camera scrolls to follow.*
- [x] **9. Health system + pit-fall damage** — heart HUD (3 heart icons rendered
  from `hearts.png` at native 32px size, matching the FloatingControls dropdown
  height; each showing full/half/empty — 6 half-heart units total back them) and
  a shared `takeDamage(amount)` mechanism. Falling into a pit calls
  `takeDamage(1)` (one half-heart unit) and repositions the character to the
  last *fully* solid ground position before the fall (not a checkpoint, and not
  a precarious ledge overhang — see below) — pit falls are a minor setback, not
  a full reset. Step 18 (side/below enemy damage) will reuse this same mechanism
  with a different amount.

  While verifying this step, a real bug was found and fixed: the recovery
  anchor (`lastGroundedX/Y`) was updated on any frame the character was
  merely "grounded" — a deliberately lenient check that keeps the character
  grounded as long as even one column of its hitbox still touches solid
  ground, so it can walk right up to a ledge's edge without the leniency
  regressing. That let the anchor be captured mid-overhang, so a pit-fall
  reposition could visibly float the character over the pit and immediately
  re-trigger another fall. Fixed by only updating the anchor when the
  *entire* hitbox footprint is solid, without touching the existing lenient
  landing/collision logic itself.
  *Verify: fall into a pit, see a half-heart lost and the character reappear at the
  ledge it fell from.*
- [x] **10. Respawn** — at 0 health, the character respawns at the nearest spawn
  point with full health (3/3 hearts) restored, all collected facts preserved.
  *Verify: deplete all hearts via repeated pit falls, see the character respawn at a
  checkpoint with hearts refilled.*
- [x] **11. Coins render** — a small hardcoded set of animated coins (spin +
  a few pixels of up/down bob) render on `level1` (two above the floating
  platform, two on the ground floor) for visual/animation testing, plus a
  static `0/max` coin counter next to the heart HUD. Not yet collectible, and
  not yet driven by real `CVData` — placing one coin per real Skill/Language
  item (the CollectibleMapper originally scoped here) moves into step 12
  below, since that step needs the same data to know what to display on
  collection anyway.
  *Verify: the hardcoded test coins are visible and animate on the platform
  and the floor; the `0/max` counter shows next to the hearts.*
- [x] **12. CollectibleMapper + coin collection** — extends step 11's hardcoded
  test coins into real placements: a CollectibleMapper flattens `CVData`
  Skills and Languages into facts and places one collectible per fact across
  the level. Touching a collectible removes it, fact text floats up and flies
  toward the journal icon, `collectedFacts` state updates, and the coin
  counter added in step 11 starts reflecting the real collected/max count.
  Worth deciding here: Skills as `coin.png`, Languages as the already-present
  `fruit.png` (raised during step 11 planning, not decided yet) — two visually
  distinct collectible types instead of one.
  *Verify: coin count in the level matches the number of Skills + Languages
  items; collect one, see the fact text animate off and the counter update.*
- [x] **13. Journal skeleton** — `J` (or a bottom-right journal icon button, per
  FR-025 — a placeholder icon/emoji if no pixel-art asset exists yet) toggles a
  centered card overlay (not a full-screen dark backdrop — see FR-014's
  amendment; the rest of the game stays visible around it), pauses the game,
  shows collected facts unstyled. Collected facts are preserved across a
  death/respawn (unaffected by this step — see FR-020c for the forward-looking
  note on enemies/blocks respawning while coins/facts don't, once those
  exist).
  *Verify: open/close the journal via both the `J` key and the icon button, see
  the collected fact listed.*
- [x] **14. Journal styling** — notebook paper, `Caveat` handwriting font, Simple
  List entry style per the mockup, the book-opening/closing animation
  (`journal_open_1-9.png`, plays forward on open and in reverse on close from
  any of the three triggers: the in-book × button, the top-left icon, or
  `J`) and real icon (`journal.png`, top-left next to the hearts per user
  feedback — bottom-right blended into the terrain). Bookmark tabs
  (`bookmark_*.png`) were pulled forward from step 15, per discussion, then
  revised live against the actual sprite art: positioned at the book's
  top-right edge (not the side — the sprites are ribbons hanging from a top
  attachment point) showing an icon per section rather than rotated text
  (unreadable at that size). An 8th "About Me"/personality bookmark shows
  CV bio content directly (not via `collectedFacts`, which has no
  personality-sourced entries) — a provisional forward-pull per user
  request; 6 sprite colors cover the 8 sections with two accepted
  duplicate pairs. Only per-section counters, pagination, and
  the Reset Game button remain in step 15.
  *Verify: visually matches `entry-styles-mockup.html`.*
- [x] **15. Counters + pagination + Reset button** — "N/M" counters per
  section, pagination within a section, Reset Game button. (Bookmark tabs
  themselves moved into step 14.) Revised significantly live per user
  feedback beyond the plan's original scope: pagination is one continuous
  flat sequence of pages across the whole book (`buildJournalPages` in
  `JournalSections.ts`, resolving each page's content as a discriminated
  union) rather than per-section — Skills paginates one category per page
  with star-rated skill rows, Languages stays a single grouped page,
  Experience/Projects/Education/Courses/Certificates paginate one entry
  per page, and Personality is a single page whose right column now shows
  a coin/fruit collectibles summary using the real sprites. Prev/Next wrap
  around at both ends (no disabled state, no visible page-count text);
  page-flip arrows are hover-reveal pixel-art chevrons, each covering the
  full physical half of the book. Close/Reset buttons are now pixel-art
  icons (not text/glyphs); Reset Game closes the journal immediately and
  triggers the iris-in "starting again" transition instead of staying
  open. See `specs/S-006-platformer-theme/plans/2026-08-28-counters-pagination-reset.md`
  for the full record.
  *Verify: counters update correctly, pagination flips through the whole
  book with wraparound, Reset clears all state and restarts play.*

## Iteration 2 — Enemies + blocks + level end (P2)

- [x] **16. Enemy render** — extended well beyond its original "render only" scope,
  live with the user, into a full rework of how levels are authored:
  - **Level format split**: `level/LevelParser.ts` (new) owns `parseLevel`,
    `TERRAIN_CHARS` (terrain characters), and `ENTITY_CHARS` (entity-marker
    characters — kept as two separate maps, with a load-time guard against a
    character being defined in both). `level1.ts` is now pure layout data: no
    parsing logic, and every row is a full literal 80-character string (no
    `padEnd`/`pad` helper) so the level's shape is readable directly in the file.
    Height is read from the array's length, not a fixed constant — a level is only
    as tall as its tallest feature needs, bottom-anchored (last row = lowest
    ground row).
  - **Intentional placement, no auto-placement** — `S` (spawn), `E` (green
    enemy), `M` (purple enemy), `C` (Skill-category coin), `F`
    (Language fruit) are hand-placed markers in the level layout. Which CV
    section each enemy color and marker maps to was iterated across this step
    and steps 18/20/21 — see step 21's follow-up below for the final mapping.
    `EnemyMapper.ts`'s
    `placeEnemies` and `CollectibleMapper.ts`'s `placeCollectibles` both dropped
    their old auto-column-placement algorithm entirely (and the `groundColumns`/
    `groundRowForColumn` helpers it depended on, now deleted from `Terrain.ts` as
    dead code): a marker is a slot on the map, and each slot draws the *next*
    fact from CVData (in section order) as its reward. A level with fewer markers
    of a type than CVData has facts of that type simply doesn't put the excess on
    the map yet — not an error, since a level is authored incrementally.
  - **`level1` redesigned as a small mechanics-test layout** (not a final design):
    1 green slime, 1 purple slime, 4 coins, 2 fruits, plus a new two-`W`-wall
    pocket (cols 44/49) bounding the green slime — a prepared spot for step 17's
    walled-patrol case. Enemies render idling only (both sheets are a 4x3 grid of
    24x24 frames; the shipped idle loop uses frames 4-8, tuned live after watching
    the full sheet animate — frames 1-3 read as a featureless blob, frames 9-12 as
    a hit/dissolve reaction). **Known gap for step 17**: the `walk` animation
    entry still points at the untuned row 1, which now visually duplicates the
    tuned idle frames — needs a real distinct frame range (or redesign) before
    patrol relies on it looking different from idle.
  *Verify: the green and purple slimes are visible at
  their `E`/`M` marker positions, idling; the 4 coins and 2 fruits are visible at
  their `C`/`F` marker positions; the wall pocket (cols 44-49) is visible on the
  ground row.*
- [x] **17. Enemy patrol** — enemies move back and forth at a constant speed
  (`PHYSICS_CONFIG.enemyPatrolSpeed`, 60px/s — 30% of the player's walk speed, a
  deliberate "plodding threat" pace, confirmed live rather than tuned further),
  reversing direction whenever `EnemyAI.ts`'s `stepEnemyPatrol` detects a wall or a
  ledge/pit edge one tile ahead (checked at the enemy's own row, same convention
  `level1`'s wall markers already used).
  - **No `idle` state**: since a patrolling enemy is always moving, `EnemyAnimState`
    dropped `'idle'` entirely (now `'walk' | 'hit'`) rather than keep it as dead
    code — step 16's tuned "breathing/bounce" frame loop was repointed at `walk`
    directly (it reads fine as movement too) instead of building a separate,
    distinct walk animation.
  - **Enemy factory**: `Enemy.ts`'s `toEnemyState(placement, index)` converts a
    static placement into its live patrol state and desyncs each enemy's starting
    animation frame/timer via `index`, so multiple enemies don't all animate in
    perfect lockstep.
  - **`level1` reworked** (again) to bring both patrol test cases close to spawn
    instead of the far-away cols 44/49 wall pocket: the green enemy is now bounded
    by two walls (cols 26/31, enemy at col 28 — the "boundaries" case), and the
    purple enemy sits in a wall-on-one-side, pit-on-the-other sandwich (wall at
    col 36, enemy at col 38, a genuine bottomless pit at cols 40-42) — one enemy
    exercising both the wall-reversal and the ledge/pit-edge-reversal branches,
    replacing the originally-scoped separate "enemy on an open ledge" case.
  - A first attempt placed the wall pocket at cols 16-32, close enough to spawn
    that the wall (solid to the player too, not just enemies) blocked an existing,
    unrelated test's rightward-walk assertion — shifted to cols 26-42 to clear
    that critical runway while staying far closer to spawn than the original.
  *Verify: the walled enemy bounces between its two walls, animating continuously
  as it moves; the wall-pit enemy reverses at both its wall and the pit edge
  instead of walking through either; enemies desync visibly (not all on the same
  animation frame); respawn resets both enemies to their initial position.*
- [x] **18. Stomp defeat** — jumping on an enemy defeats it with a poof animation
  (row-2 hit-reaction frames, including the red flash frame), fact flies to the
  journal.

  Extended in implementation: purple slimes take 2 stomps to defeat (green still
  takes 1) — confirmed live with the user, not in the original roadmap text. A
  stomp also bounces the player upward a short distance
  (`PHYSICS_CONFIG.stompBounceVelocity`), on every stomp, not just the finishing
  one; the bounce is deliberately exempted from the jump-cut multiplier (Physics.ts)
  that normally shrinks a released-early jump, since a stomp bounce is airborne
  with the jump key released by definition — without the exemption the bounce
  collapsed to ~5px instead of its intended ~67px. An enemy's fact is deduplicated
  by id against `collectedFacts` before being (re-)banked, since `resetGame()`
  revives defeated enemies on respawn but deliberately never clears collected
  facts — without the guard, re-stomping a revived enemy would duplicate its
  journal page.
  *Verify: stomp an enemy, see the fact appear.*
- [x] **19. Side/below damage** — invincibility frames, knockback on non-stomp
  contact, reusing the `takeDamage` mechanism from step 9.
  *Verify: touch an enemy from the side, lose health and get knocked back.*

  Revised/extended in implementation, all confirmed live with the user: a
  side-hit costs the same half heart as a pit fall (`SIDE_HIT_DAMAGE = 1`),
  not the full heart originally specified above — and invincibility was
  generalized to be a property of taking damage at all, not just enemy
  contact: a pit fall (step 9) now also grants the same ~1.2s
  invincibility/blink, and neither damage source can fire again while the
  other's window is active (the pit-fall position recovery itself is never
  skipped, only the extra heart loss). Knockback is horizontal-only
  (~330px/s for ~0.25s), well inside the invincibility window so the player
  regains full control long before the blink ends. The blink is a simple
  visibility toggle (no draw call every ~0.1s), not a white-tint effect. Any
  non-defeated enemy can side-hit the player — except one currently
  mid-`hit`-reaction from a stomp, which is harmless in every way (no side
  damage, no re-stomp) until its reaction ends, found necessary via live
  testing (bouncing off a stomp while still overlapping the frozen enemy
  otherwise registered as a spurious side-hit against the very enemy just
  stomped).

  Also revised on step 18's already-shipped stomp mechanic, found via
  further live testing after this step's own work surfaced it: a
  still-alive (purple, 2-hit) enemy can now be stomped again immediately,
  even entirely airborne from the first stomp's own bounce — this engine
  has no double-jump, so "land on the same still-alive enemy again while
  still airborne" can only mean the same bounce's descent, and chaining
  that into a second, deliberate hit is the intended feel, not a bug to
  guard against (two earlier attempts at gating re-stomp on "has the player
  bounced/landed since" both blocked this in practice; the actual fix needed
  no such tracking — `checkEnemyStompCollisions` just excludes an enemy once
  its `hitPoints` reach 0). The stomp bounce's own upward force
  (`PHYSICS_CONFIG.stompBounceVelocity`) was also found to be silently
  capped to ~45% of its configured magnitude every tick after the first by
  the jump-cut multiplier (a stomp bounce is never actually "held" like a
  real jump) — fixed via `PlayerState.bounceAscending`, which suppresses the
  cut for the bounce's whole ascent instead of just one frame. Retuned
  against the corrected physics down to `-330` (~1.4 tiles peak, well under
  half of a normal jump's own peak height).
- [x] **20. Destroyable block render + enemy section remap** — redefined
  2026-08-29 (see `spec.md`'s Session 2026-08-29 clarifications) after
  discovering the tileset in use no longer has a dedicated crack-progression
  block sprite sheet: the original single 3-hit block type is replaced by
  three visually distinct `BlockDef` types, render-only for this step (no hit
  mechanics yet — those move to step 21's sub-steps below):
  - **Crate** — wooden crate tile (`world_tileset.png`), intact state only for
    now.
  - **Question-mark** — one of five palette-matched `?` tiles (brick, sandy,
    pink/red, teal, blue-gray), matching the surrounding terrain's color.
  - **Rock** — a plain terrain-styled tile, visually distinct from ordinary
    solid terrain and from the palette's `?`/`!` tiles.

  All three are hand-placed via new level markers (`LevelParser.ts`'s
  `TERRAIN_CHARS`/`ENTITY_CHARS`, avoiding the already-used `B`/`R` letters),
  consistent with step 16's marker-based placement approach — no
  auto-placement.

  **CollectibleMapper/EnemyMapper remap**: crates and enemies both picked up
  CV-section mappings at this point, bundled here since it's one
  section-remapping decision (see `spec.md`'s FR-009 amendment) — the
  specific assignments were revised again in step 21's follow-up below,
  which has the final mapping.

  *Verify: crate, question-mark (in its level-appropriate palette color), and
  rock tiles are all visible on platforms in `level1`.*

  **Follow-up (same day, after live user feedback on the rendered result):**
  blocks were relocated from `level1`'s ground-adjacent marker row to an
  elevated row with 2 full rows of jump clearance beneath them (matching the
  existing floating-platform's clearance shape, and giving a future
  question-mark hit — FR-022b — somewhere to pop its fruit into), and moved
  from 51 tiles out (past the wall/pit gauntlet) to 18-23 tiles from spawn.
  Basic solidity was also pulled forward from step 21 at the user's request:
  all three block types are now solid obstacles from every direction
  (`Physics.ts`'s `stepPlayerPhysics` gained an optional `blockPlacements`
  parameter, defaulting to empty so every pre-existing call site is
  unaffected) — no crack/shatter/fruit-pop reaction exists yet, only
  standing-on-top/side-blocking/ceiling-bonk collision. See
  `BlockMapper.ts`'s `isBlockOccupied`.
- [x] **21. Block hit mechanics** — split into three sub-steps (2026-08-29),
  one per block type, since each now has a genuinely distinct mechanic rather
  than one shared 3-hit progression. A shared short bump/nudge animation
  (block moves up a few pixels, settles back, ~100ms) plays on every
  below-hit across all three sub-steps below, including each type's terminal
  hit.
  - **21a. Crate hit mechanic** — 2 hits: first hit shows a crack overlay,
    second hit breaks the crate apart with a shatter animation and reveals
    the associated Experience/Education fact (fly-to-journal animation, same
    as other collectibles). **Crack overlay asset (derived + saved
    2026-08-29)**: generated from the existing `groundRock` terrain tile
    (`world_tileset.png` at tile coords 16,0) by thresholding its pixels by
    luminance (a first pass at `lum<90` pulled in the tile's dark-brown fill
    color and looked like a blotch, not a crack; tightened to `lum<35` kept
    only the near-black outline pixels and reads as a clean, thin crack
    line) — this was a one-time generation step, not a runtime computation.
    The result is checked in as a standalone 16×16 transparent-background
    PNG at `public/sprites/crack_overlay.png`, loaded and composited like
    any other sprite (alongside the rest of `SpriteLoader.ts`'s asset prep)
    over the crate tile (`world_tileset.png` at tile coords 112,48) whenever
    `hitsTaken === 1`.
    *Verify: hit a crate once, see the crack overlay and bump; hit it again,
    see the shatter animation and the fact appear in the journal.*
  - **21b. Question-mark hit mechanic** — single hit spawns a bonus fruit
    (`fruit.png`, no CV fact) that rises into the space directly above the
    block and lands as a touchable pickup; the block permanently swaps to
    its matching `!` tile and stops responding to hits.
    *Verify: hit a question-mark block, see the fruit pop up and become
    collectible, and the block itself turn into its palette's `!` tile.*
  - **21c. Rock hit mechanic** — single hit breaks the rock straight to empty
    space — no fruit, no fact, no reward.
    *Verify: hit a rock block, see it disappear immediately with no drop.*

  **Follow-up (2026-08-30, live user feedback after the above shipped and was
  manually verified):**
  - **Question-mark's used-up tile redesigned**: swaps to a plain top-exposed
    `groundRock` terrain tile (`world_tileset.png` at 16,0) instead of the
    palette's `!` indicator — reads as "used up ground" rather than still a
    distinct block type.
  - **Bonus fruit now carries a real fact**: Certificates + Projects moved
    off enemies onto question-mark blocks (`BlockMapper.ts`'s
    `certificateToBlock`/`projectToBlock`) — picking up a bonus fruit reveals
    it exactly like any other collectible, flying to the journal. Its icon
    also cycles through `fruit.png`'s frames per spawn (visual variety,
    `BonusFruitState.iconIndex`) instead of always frame 0. Bonus fruits
    render *before* blocks each frame so a still-rising fruit reads as
    emerging from behind/under its source block, not floating on top of it.
  - **Courses split across both slime colors** (`EnemyMapper.ts`'s
    `courseToEnemy`, alternating green/purple by index) instead of
    green-only, freeing the purple pool for the Certificates+Projects move
    above.
  - **Rock gets a "puff" on break**: reuses the same sparkle-burst effect
    every other reward pickup already plays (`startFlightEffect` with an
    empty label, centered on the rock's tile) — previously it just vanished
    with no tactile feedback at all.
  - **Hand-placed `F`-marker (Language) fruit collectibles removed**
    entirely from `level1` and `CollectibleMapper.ts` — Languages is
    intentionally unmapped from any collectible for now (deferred, along
    with `activities`, until a future decision on where they surface).
  - **Fact-flight label bug fixed**: the fly-to-journal text's label/icon
    derivation was a duplicated, incomplete ad-hoc check (`'name' in
    data`) that silently fell back to the generic section name for
    Courses/Experience/Education (whose display field is `title`/`role`/
    `degree`, not `name`) — replaced all four duplicated copies with the
    journal's own `formatJournalEntry`, which already handles every
    section correctly.
  - **HUD/journal collectible counters added for crates and bonus fruit**,
    and every counter (HUD *and* the "About Me" page's collectibles
    summary) now totals against what's actually placed in the level
    (`blockPlacements`/`enemyPlacements`/`collectiblePlacements`) rather
    than raw CVData section length — the two counters staying in sync was
    the point.
  - **Journal now always opens on "About Me"** by default instead of
    falling back to the first collected fact's section, until the visitor
    picks a bookmark themselves (still remembered across close/reopen).
- [x] **22. Chests + Thank You screen (level-end redesign)** — *Flagpole removed as a
  mechanic (2026-08-30); redesigned the same day via a `brainstorming` session.*
  Replaces the level-end mechanism with a new "main objective" collectible: treasure
  chests (`ChestDef`, new `T` level marker), one per non-empty Experience entry —
  the CV section considered most valuable, worth its own dedicated collectible type.
  A chest starts closed (`chest_closed.png`), sits flush with the ground (not
  solid). Unlike every other collectible, opening is NOT automatic on touch:
  the character must be standing on/overlapping it and press Arrow Up to open
  it, revealing its Experience fact like any other collectible; a HUD chest
  counter (e.g. "Chests 2/5") tracks progress separately from hearts/coins.
  Chests are scattered via markers like any other collectible — no special
  end-of-level position.

  **Bundled control change**: Arrow Up is no longer a jump key — Space becomes
  the sole jump input (FR-007 amended), freeing Arrow Up to become this game's
  "interact" key (opens a chest you're standing on now; reserved for climbing
  once step 23 ships).

  Once every chest is opened, a Thank You screen appears (`gamePhase:
  'ending-screen'`, pausing the game like `paused` does) wherever the visitor
  happens to be: a thank-you message, the CV's Contact information, and "press any
  button to continue" — dismissed by any key/click, resuming play exactly where it
  left off (no blocking, no "Replay Level" option — Reset Game already covers
  restarting). Contact is shown only on this screen, never added to the journal.

  **Side effects of moving Experience to chests**: crates (step 20/21's mechanic)
  lose Experience and pick up Activities (previously unmapped anywhere) and
  Languages (previously removed as standalone fruit collectibles in step 21, left
  unmapped since) — crates now carry Education + Activities + Languages. Coins
  narrow to Skills only. Personality is unaffected — it stays on the always-visible
  "About Me" bookmark from step 14, no longer provisional.

  **New assets (generated 2026-08-30 via nano-banana, checked in)**:
  `public/sprites/chest_closed.png` (28×20) and `chest_open.png` (24×20) —
  transparent background, flat/front-facing 2D style matching the existing crate
  tile (a 3/4-angled "isometric" first attempt was rejected as inconsistent with
  the game's flat art), both states generated together in one call for visual
  consistency, then cropped to their tight bounding box and downscaled with
  nearest-neighbor sampling (a smoothing filter blurred the ~500px source into an
  unrecognizable blob at small size). Non-square and a bit larger than the 16×16
  block tile grid, since a chest is a standalone placed object, not wall-adjacent.

  `spec.md` amended in the same pass: User Story 6, FR-003/008/009/010/013/017b/
  021/022/023/024/030/031/032/033/034/035, Key Entities, Entity Relationships,
  SC-002, Assumptions, and a new Clarifications session replace every stale
  flagpole reference.

  **Out of scope for this step**: audio (chest-open SFX, Thank You fanfare) —
  see the "Maybe / reconsider later" section's Audio item; this step only
  defines where those hooks would attach if it ships.
  *Verify: confirm Arrow Up no longer triggers a jump (only Space does). Stand
  on a closed chest and press Arrow Up, see it swap to its open sprite, the
  chest counter increment, and the Experience fact fly to the journal; walking
  over a chest without pressing Up leaves it closed. Open every chest in the
  level, see the Thank You screen appear (pausing the game) showing the
  thank-you message and Contact info; press any key, see it dismiss and gameplay
  resume from the same position. Confirm Contact never appears as a journal
  bookmark. Confirm crates now carry Education/Activities/Languages facts and
  coins carry only Skills facts.
- [x] **23. Ladders (climbing) + vertical camera follow** — *Promoted
  2026-08-30* from the "Unscheduled additions" list to the next numbered
  step, now that step 22 freed Arrow Up from jumping into a general-purpose
  "interact with what you're on" key (chest-opening today) — climbing is the
  other obvious use for it. *Designed 2026-08-30* via a `brainstorming`
  session — see `spec.md`'s "Session 2026-08-30 (roadmap step 23
  brainstorming)" and User Story 6b for the full record.

  A new `'ladder'` terrain tile (not solid, but climbable): overlapping one
  and pressing Up/Down suspends gravity and drives vertical movement directly
  at a fixed climb speed. Climbing is free-form, not column-locked —
  Left/Right still move normally, and moving off every overlapping ladder
  tile ends the climb immediately. Space cancels a climb into a normal jump.
  A ladder shaft's own top rung is solid from above (`isStandableLadderTop`
  in `Terrain.ts`) whenever nothing climbable or solid sits directly above
  it — one-way, exactly like `bridge`'s existing solid-from-above/
  passable-from-below convention, but requiring no separate tile placed
  above the ladder. Climbing carries the character all the way through
  that top tile and stops it standing on it; pressing Down there re-enters
  the climb downward. A dead-end shaft (a solid tile directly above the
  top rung, so there's no room to stand) keeps the plain climb-until-the-
  feet-leave-the-ladder behavior instead. Uses `knight2.png`'s existing
  (previously unwired) 4-frame "climb (back view)" row — no new art
  needed. *Live user feedback, several rounds*: the design went through the
  pre-existing floating platform sitting stacked above the ladder's top
  rung (required a jump to enter/exit), then a separate solid platform
  tile above it, then substituting the ladder's own tile for `bridge`,
  before landing on this final shape — the ladder itself gains the
  standable/one-way behavior, with a landing platform placed *beside* it
  (same row), never above it.

  `level1` gets a real ladder — a short shaft beside the existing floating
  platform (its bottom rung shares the platform's own row, one column
  over, so stepping off the platform onto the ladder needs no jump) and
  beside a small new landing platform at its top. Originally extended much
  taller purely to force real vertical scrolling on a real desktop window
  (the level was only 6 tiles / ~192px otherwise); shortened back down to
  4 rungs once `Camera.test.ts`'s `updateCameraY` unit tests took over as
  the authority on vertical-scroll correctness (see the Verify note below),
  so climbing-mechanics play-testing stays quick. The shaft is
  throwaway/replaceable (called out in a code comment), not final level
  design. `LevelParser.parseLevel`'s row-length check is relaxed to pad
  shorter rows to the widest row's width (instead of throwing on a
  mismatch), so authoring a mostly-empty-sky shaft doesn't require 80
  literal dots per row.

  Vertical camera follow is a new `updateCameraY`/`cameraPositionY`, parallel
  to (not merged with) the existing horizontal `updateCamera`/
  `cameraPositionX` — same dead-zone-follow-and-clamp shape, own constant.
  On every level shipped before this step (all shorter than a real
  viewport), the clamp always resolves to 0 — a verified no-op, matching
  today's fixed bottom-anchor exactly.
  *Verify: walk into the ladder and press Up — the character climbs
  vertically instead of falling. Press Left/Right while climbing — the
  character shimmies off the ladder and immediately falls/walks normally.
  Press Space while climbing — it cancels into a normal jump. Reach the
  ladder's own top rung, confirm standing on it works like any other
  platform; press Down there — confirm it re-enters the climb going
  downward. Confirm `level1`'s pre-existing content (spawn, coins, enemies,
  blocks, chests) is unaffected by the new rows above it. Vertical camera
  scroll is NOT manually verified via `level1` — its ladder shaft was
  deliberately shortened to 4 rungs (same commit that added
  `isStandableLadderTop`) for faster manual testing of the climbing
  mechanics themselves, and is now far too short to ever trigger scrolling
  in a real browser window; `Camera.test.ts`'s `updateCameraY` unit tests
  are the authority on vertical-scroll correctness instead, with the
  mechanism wired but left unexercised in-game pending a future level tall
  enough to need it.*

## Iteration 3 — Controls (P3)

- [x] **25. Controls overlay** — a translucent overlay listing only universal
  controls (movement, jump, journal toggle — see spec.md FR-036, deliberately
  trimmed of contextual mechanics like the bridge drop-through, which move to
  step 26's hint signs instead) shows once `gamePhase` reaches `playing`.

  **Redesigned live in the browser after initial implementation** (several
  rounds of direct UX feedback, 2026-08-31), diverging from FR-036's original
  wording in a few ways: no background panel (bigger real keycap sprite,
  `public/sprites/controls_overlay_keys.png` — the arrow cluster in the real
  inverted-T keyboard layout, a Space bar showing a dash glyph instead of
  text, and a J key — generated via nano-banana on a magenta background and
  processed by the new `scripts/chroma_key_sprite.py`), captions in the
  game's arcade pixel font (`ByteBounce`/`RESTART_PROMPT_FONT_FAMILY`)
  positioned directly under their matching key group rather than an evenly
  spaced row, centered where collected-fact text already lands (~30vh,
  matching `Renderer.ts`'s `midY` convention) instead of near the player.
  Dismissal is purely distance-based — the player must actually travel
  ~2 tiles from where they stood when it appeared (either direction), no
  keypress or timeout trigger, so a visitor who never moves keeps seeing it
  indefinitely, by design. Fades/slides in from the left on appearance and
  out to the right on dismiss, at the player's own `walkSpeed`
  (`PhysicsConfig.ts`) so the motion reads as the overlay "walking away"
  with the character. Tried also showing it during the `intro` iris-in, but
  reverted — the overlay rendered over the iris's still-mostly-black canvas
  early in that animation, so it waits for `playing` instead. Still never
  reappears for the rest of the session (via `controlsOverlayDismissed`, a
  permanent module-level latch — see `PlatformerState.ts`), including across
  a Reset Game or death/respawn.
  *Verify: load the theme, see the overlay fade/slide in once `playing`
  starts, with captions aligned under each matching key; walk left or right
  about two tiles, confirm it fades/slides out and never reappears across a
  respawn or Reset Game (a fresh page load starts a new session, so it's
  expected to show again then); confirm holding still with no movement
  leaves it visible indefinitely (no timeout); confirm captions translate
  correctly with the locale switcher.*
- [x] **26. Hint signs** — a new non-solid, non-collectible `SignDef` entity
  (FR-037–FR-040), placed via a hand-authored level marker. Each distinct
  hint gets its own single-digit marker character (`1`–`9`, mapped directly
  to a `hintId` in `LevelParser.ts`'s new `SIGN_CHARS` table) rather than
  the CVData-order "zip" used for coins/enemies — hint content is
  hand-authored, not pulled from `CVData`, and the digit-to-hintId mapping
  stays correct no matter how the level layout is edited, capped at 9
  distinct hints total (an accepted constraint). Touching a sign's trigger
  zone shows a speech-bubble tooltip near the character with localized hint
  text read from the existing i18n system (a new `platformer.hints.<hintId>`
  key in `src/i18n/locales/en.json`/`de.json`, via `currentUI.value`, same
  pattern `Journal.tsx` already uses — no bespoke dictionary); the tooltip
  disappears when the character walks away. Does not pause the game, does
  not block movement, never touches `collectedFacts` or the journal. At
  minimum, place one sign (marker `1` → `bridgeDropThrough`) near `level1`'s
  first one-way bridge explaining the Down/`S` drop-through control. A
  ladder-climbing sign becomes possible once step 23 ships (still out of
  scope here otherwise).
  *Verify: walk up to the bridge sign, see the hint bubble in the current
  locale; walk away, see it disappear; switch locale, see the text update.*

  **Shipped largely as specified** (2026-08-31): `SignDef`/`SIGN_CHARS`
  digit-marker parsing in `LevelParser.ts`, an interact-triggered (not
  overlap-triggered) speech bubble that grows up from the signpost and
  settles above the character, `platformer.hints.bridgeDropThrough` keys in
  `en.json`/`de.json`, and a single sign placed at `level1`'s first bridge.
  Signs are reusable (re-triggerable on every Up press), never touch
  `collectedFacts`/the journal, and don't pause the game. The Level Editor
  also gained a "Sign" palette tool that paints a signpost with a digit
  badge, per FR-040. Two real bugs were caught and fixed during
  implementation, both by this plan's own tests/reviews before shipping: a
  bubble-positioning formula in `Renderer.ts` that didn't actually keep the
  box's bottom edge fixed while the bubble grew/shrank, and the speech-bubble
  tail width incorrectly scaling with the growth animation instead of
  staying fixed. Task execution also needed a mid-plan reorder: Task 10 (an
  earlier task) had to run before Task 6 due to a dependency the plan's
  written task order didn't account for. Two pre-existing, out-of-scope
  Level Editor issues were noticed but intentionally left alone: enemy
  markers sometimes appearing not to render (by-design behavior — a marker
  only gets an enemy while `CVData` still has an unassigned course entry for
  that color) and the Reset button's native `confirm()` dialog not always
  firing reliably in all browser/testing contexts.
- [ ] **27. Pause-on-open for floating controls** — the floating controls (built in
  step 1) now pause the running game loop while open and resume it on close, instead
  of being purely decorative.
  *Verify: open the controls mid-game, confirm the game pauses; close, confirm it
  resumes exactly where it left off.*

## Maybe / reconsider later

Not committed to the roadmap sequence — before writing a `writing-plans` pass for
any of these, first decide whether it's worth doing at all. Numbers kept from their
original slot for traceability with git history (branch names, commit messages).

- **24. Audio** — preload audio assets, looping background music, SFX wired to
  existing actions (jump, coin, stomp, block break, damage, journal open/close),
  speaker icon toggle, muted by default. Not clear yet whether this ships.
- **28. Theme-switch reset** — leaving and returning to Platformer resets the
  session (fresh game, no collected facts, hearts/chests/enemies back to start).
  Whether "silently reset on return" is the behavior actually wanted (versus,
  say, resuming where you left off) needs deciding before this becomes a step.
- **29. Polish pass** — animation/effects refinement, 30 FPS check with 20+
  collectibles rendered. May not need a dedicated step if each feature step
  already verifies its own visuals as it lands.

## Iteration 4 — Level variety (post-P3, added 2026-08-29)

- [x] **30. Purple slime rework: bigger/slower/tougher, drops a key instead of a
  Course fact** — purple slimes render at 1.5× a green slime's size, patrol ~30%
  slower, and take 3 stomps to defeat (up from 2). Green slimes now deliver every
  Course fact (purple no longer carries any CV content). A purple slime's
  finishing stomp pops a key onto the ground as its own bobbing pickup entity
  (`KeyPickupState`, reusing `Coin.ts`'s `coinBobOffset`); walking into it adds
  one to `collectedKeys` and flies its icon to a HUD key counter that's hidden at
  0 and appears once the count rises above 0. Opening a chest (Arrow Up while
  overlapping it) now additionally requires `collectedKeys > 0` and spends one
  key. `level1.ts` gained a second `M` marker so its 2 chests both have a
  matching purple slime. New `key.png` sprite (pixel-art, transparent, generated
  and chroma-keyed from a magenta-background render). See `spec.md`'s User Story
  4/6, FR-009, FR-019, FR-020, FR-020e, FR-023.
  *Verify: purple slime is visibly bigger/slower than green, takes 3 stomps,
  drops a bobbing key on defeat; walking into the key increments the HUD key
  counter; a chest refuses to open at 0 keys and opens (spending one key) at
  ≥1; Reset Game clears `collectedKeys` and any dropped keys.*
- [ ] **31. Level selection** — not yet designed; only discussed in ideation so far.
  Needs its own brainstorming session before an implementation plan exists. Scoped
  here as a placeholder step so step 32 (terrain rework) has something concrete to
  depend on: some mechanism to choose among multiple levels instead of always
  loading `level1`.
  *Verify: TBD, pending design.*
- [ ] **32. Terrain rework: autotiled ground + cave background** — re-themes
  `groundGrass` from a single fixed sprite per tile to a proper autotiled look
  (fill vs. single, grass-top vs. plain-dirt-below) using the `spring_.png` tileset,
  and adds a new non-solid `caveBackground` tile type (same autotiling, no
  top-exposure distinction) using `terrain_.png` for cave-style background dressing.
  `groundRock`/`wall`/`bridge` are unaffected — they stay on
  `world_tileset.png`. Research/findings captured 2026-08-29
  (`plans/2026-08-29-terrain-rework-notes.md` — confirmed tileset coordinates,
  autotile algorithm, decisions made); **no implementation plan yet** — write one via
  `writing-plans` once step 31 lands, re-reading the codebase at that point rather
  than reusing anything from the notes doc verbatim. **Implementation is blocked on
  step 31** landing first, so the dedicated terrain test level (exercising every
  tile combination) can be added as one of the selectable levels from the start,
  instead of behind a temporary dev-only flag.

## Unscheduled additions (not yet numbered)

Ideas raised 2026-08-30, not yet slotted into the sequential roadmap above. Each
needs its own `writing-plans` pass (and, given the design choices involved, likely a
`brainstorming` session first) before it becomes a numbered step. Listed here so
they aren't lost, not in priority order.

- **Persistent foreground/background water bands** — a foreground water strip at
  the bottom of the canvas and a background band at the top, both fixed to the
  viewport (not the level or the camera) so they stay in place regardless of
  player movement or camera scroll, horizontal or vertical.
- **Level editor** — a hidden dev-only route for authoring levels visually
  instead of hand-editing character-grid strings, reusing the existing
  tile-char catalog and real engine sprites for WYSIWYG rendering. Brainstormed
  design captured in `docs/ideas/platformer-level-editor.md`; not yet a
  numbered step.
- **Purple slime spike cooldown** — after a stomp, a purple slime grows spikes
  on top for a short cooldown; re-stomping it from above during that window
  damages the player instead of registering a hit, until the spikes retract.
  Raised 2026-09-01, reverses a currently-intentional chain-stomp behavior —
  see `docs/ideas/platformer-purple-slime-spikes.md`; not yet a numbered step.

## Working agreement

- One step = one small implementation plan (via `writing-plans`), TDD (tests first,
  per the constitution), then a manual browser check before moving to the next step.
- Steps are sequential within an iteration — later steps assume earlier ones are
  done and verified. Iterations themselves are sequential (2 depends on 1, 3 depends
  on 2 for a playable game).
- Check off a step here (`[ ]` → `[x]`) once implemented, tested, and verified in the
  browser.
- If a step turns out to hide more complexity than expected, split it further here
  before writing its implementation plan — don't let a "small step" grow silently.

### Branch strategy

- `S-006-platformer-theme` is the integration branch for this entire feature — it is
  NOT PR'd into `main` after every step. It only goes to `main` at a deliberate
  iteration boundary (e.g. after step 15 closes out Iteration 1), as its own PR.
- Each roadmap step gets its own branch off `S-006-platformer-theme` (e.g.
  `S-006-step4-gravity-collision`), goes through the normal process (`writing-plans`
  → `subagent-driven-development`, TDD, per-task review, final whole-branch review),
  and lands via a PR into `S-006-platformer-theme` — not a direct commit to it.
  Delete the step branch after merging.
- Reason: keeps each PR small and reviewable (one step's diff), while
  `S-006-platformer-theme` itself would be unreviewable as one 27-step blob.
- Exception: step 1 was committed directly to `S-006-platformer-theme` (no step
  branch) — that precedent stands as-is; the branch-per-step pattern applies from
  step 2 onward.
- **Amended 2026-08-30**: the "only merges to `main` at an iteration boundary"
  rule above is relaxed now that the Platformer theme is gated behind
  `platformerPrototypeUnlocked` (a `localStorage`-backed feature flag, default
  `false` — see `src/state/theme.ts`) — merging mid-iteration can no longer expose
  unfinished work to a visitor, since no theme switcher lists Platformer until
  it's explicitly unlocked. `S-006-platformer-theme` can now be merged into
  `main` after any step (not just iteration boundaries) to keep `main`'s diff
  from that branch smaller and easier to review overall; still merged as its own
  step (local merge + push, or its own PR), never folded silently into another
  branch's commit.
