# S-006 Platformer Theme — Implementation Roadmap

**Purpose**: `spec.md` defines *what* the Platformer theme is (requirements, iteration
plan at P1/P2/P3 granularity). This roadmap breaks each iteration down further into
small, independently implementable and browser-verifiable steps. Each step gets its
own implementation plan (via the `writing-plans` skill) when we're ready to build it —
tests first (per the constitution), then a manual browser check.

Status legend: `[ ]` not started, `[~]` in progress, `[x]` done.

## Iteration 1 — Core movement + coins + journal (P1)

- [ ] **1. Theme skeleton** — register the `platformer` theme in `App.tsx`'s
  `themePages` map, full-viewport `<canvas>` renders (blank/loading state).
  *Verify: switching to the Platformer theme shows a canvas.*
- [ ] **2. Static level render** — terrain tiles drawn from hand-crafted level data,
  no player yet.
  *Verify: the level layout (ground, platforms) is visible.*
- [ ] **3. Player idle render** — sprite drawn standing on the ground, no physics.
  *Verify: character visible on a platform.*
- [ ] **4. Gravity + solid collision** — character rests on platforms, falls into
  pits; no input yet.
  *Verify: spawn the character mid-air, watch it land or fall.*
- [ ] **5. Horizontal movement + walk animation** — arrow keys move the character,
  sprite faces movement direction.
  *Verify: walk left/right on screen with visible walk animation.*
- [ ] **6. Jump** — jump physics (variable height by hold duration) + jump animation.
  *Verify: jump across a gap.*
- [ ] **7. Camera scroll** — viewport follows the character horizontally.
  *Verify: walk right, camera scrolls to follow.*
- [ ] **8. Respawn** — falling into a pit or death respawns at the nearest spawn
  point with full health.
  *Verify: fall into a pit, see the character respawn.*
- [ ] **9. Coins render + CollectibleMapper** — coins placed from real `CVData`
  (Skills/Languages), visible but not yet collectible.
  *Verify: coin count in the level matches the number of Skills + Languages items.*
- [ ] **10. Coin collection** — touching a coin removes it, fact text floats up and
  flies toward the journal icon, `collectedFacts` state updates.
  *Verify: collect a coin, see the fact text animate off.*
- [ ] **11. Journal skeleton** — `J` toggles a fullscreen overlay, pauses the game,
  shows collected facts unstyled.
  *Verify: open/close the journal, see the collected fact listed.*
- [ ] **12. Journal styling** — notebook paper, `Caveat` handwriting font, Simple
  List entry style per the mockup.
  *Verify: visually matches `entry-styles-mockup.html`.*
- [ ] **13. Bookmark tabs + counters + pagination + Reset button** — per-section
  tabs, "N/M" counters, pagination within a section, Reset Game button.
  *Verify: switch sections, counters update correctly, Reset clears all state.*

## Iteration 2 — Enemies + blocks + flagpole + audio (P2)

- [ ] **14. Enemy render + patrol** — CollectibleMapper extended for
  Certificates/Projects; enemies patrol platforms, no interaction yet.
  *Verify: enemies visibly patrol back and forth.*
- [ ] **15. Stomp defeat** — jumping on an enemy defeats it with a poof animation,
  fact flies to the journal.
  *Verify: stomp an enemy, see the fact appear.*
- [ ] **16. Side/below damage** — heart HUD (3 hearts), invincibility frames,
  knockback on non-stomp contact.
  *Verify: touch an enemy from the side, lose a heart.*
- [ ] **17. Destroyable block render** — intact/question-mark tiles;
  CollectibleMapper extended for Experience/Education/Courses.
  *Verify: blocks are visible on platforms.*
- [ ] **18. Block hit mechanic** — 3-hit crack progression, coin drop per hit, fact
  reveal + shatter animation on the 3rd hit.
  *Verify: break a block, see cracking states, coin drops, and the final fact.*
- [ ] **19. Flagpole render + touch detection** — visible flagpole at the level end,
  no celebration/ending screen yet.
  *Verify: reach and touch the flagpole.*
- [ ] **20. Flagpole celebration + ending screen** — slide-down animation, flag
  waves, ending screen with Personality + Contact, Replay Level button.
  *Verify: reach the flagpole, see the ending screen, Replay resets the level.*
- [ ] **21. Audio** — preload audio assets, looping background music, SFX wired to
  existing actions (jump, coin, stomp, block break, flagpole, damage, journal
  open/close), speaker icon toggle, muted by default.
  *Verify: toggle sound on, hear music and effects.*

## Iteration 3 — Controls + polish (P3)

- [ ] **22. Floating theme/locale controls in-game** — same pattern as the Space
  theme, briefly pauses when opened.
  *Verify: switch theme or locale mid-game via the floating controls.*
- [ ] **23. Theme-switch reset** — leaving and returning to Platformer resets the
  session (fresh game, no collected facts).
  *Verify: switch to another theme and back, confirm the game is fresh.*
- [ ] **24. Touch/mobile controls** — on-screen D-pad + action buttons on small
  viewports.
  *Verify: at a mobile viewport width, the D-pad appears and functions.*
- [ ] **25. Polish pass** — animation/effects refinement, 60 FPS check with 20+
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
