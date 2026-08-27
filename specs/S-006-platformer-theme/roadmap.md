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
- [ ] **11. Coins render + CollectibleMapper** — coins placed from real `CVData`
  (Skills/Languages), visible but not yet collectible.
  *Verify: coin count in the level matches the number of Skills + Languages items.*
- [ ] **12. Coin collection** — touching a coin removes it, fact text floats up and
  flies toward the journal icon, `collectedFacts` state updates.
  *Verify: collect a coin, see the fact text animate off.*
- [ ] **13. Journal skeleton** — `J` toggles a fullscreen overlay, pauses the game,
  shows collected facts unstyled.
  *Verify: open/close the journal, see the collected fact listed.*
- [ ] **14. Journal styling** — notebook paper, `Caveat` handwriting font, Simple
  List entry style per the mockup.
  *Verify: visually matches `entry-styles-mockup.html`.*
- [ ] **15. Bookmark tabs + counters + pagination + Reset button** — per-section
  tabs, "N/M" counters, pagination within a section, Reset Game button.
  *Verify: switch sections, counters update correctly, Reset clears all state.*

## Iteration 2 — Enemies + blocks + flagpole + audio (P2)

- [ ] **16. Enemy render + patrol** — CollectibleMapper extended for
  Certificates/Projects; enemies patrol platforms, no interaction yet.
  *Verify: enemies visibly patrol back and forth.*
- [ ] **17. Stomp defeat** — jumping on an enemy defeats it with a poof animation,
  fact flies to the journal.
  *Verify: stomp an enemy, see the fact appear.*
- [ ] **18. Side/below damage** — invincibility frames, knockback on non-stomp
  contact, reusing the `takeDamage` mechanism from step 9 with a full heart
  (`takeDamage(2)`, two half-heart units) instead of the half-heart pit-fall
  amount.
  *Verify: touch an enemy from the side, lose a full heart.*
- [ ] **19. Destroyable block render** — intact/question-mark tiles;
  CollectibleMapper extended for Experience/Education/Courses.
  *Verify: blocks are visible on platforms.*
- [ ] **20. Block hit mechanic** — 3-hit crack progression, coin drop per hit, fact
  reveal + shatter animation on the 3rd hit.
  *Verify: break a block, see cracking states, coin drops, and the final fact.*
- [ ] **21. Flagpole render + touch detection** — visible flagpole at the level end,
  no celebration/ending screen yet.
  *Verify: reach and touch the flagpole.*
- [ ] **22. Flagpole celebration + ending screen** — slide-down animation, flag
  waves, ending screen with Personality + Contact, Replay Level button.
  *Verify: reach the flagpole, see the ending screen, Replay resets the level.*
- [ ] **23. Audio** — preload audio assets, looping background music, SFX wired to
  existing actions (jump, coin, stomp, block break, flagpole, damage, journal
  open/close), speaker icon toggle, muted by default.
  *Verify: toggle sound on, hear music and effects.*

## Iteration 3 — Controls + polish (P3)

- [ ] **24. Pause-on-open for floating controls** — the floating controls (built in
  step 1) now pause the running game loop while open and resume it on close, instead
  of being purely decorative.
  *Verify: open the controls mid-game, confirm the game pauses; close, confirm it
  resumes exactly where it left off.*
- [ ] **25. Theme-switch reset** — leaving and returning to Platformer resets the
  session (fresh game, no collected facts).
  *Verify: switch to another theme and back, confirm the game is fresh.*
- [ ] **26. Touch/mobile controls** — on-screen D-pad + action buttons on small
  viewports.
  *Verify: at a mobile viewport width, the D-pad appears and functions.*
- [ ] **27. Polish pass** — animation/effects refinement, 30 FPS check with 20+
  collectibles rendered.
  *Verify: frame-timing check and smooth manual play.*

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
