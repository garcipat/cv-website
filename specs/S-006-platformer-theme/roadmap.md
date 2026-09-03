# S-006 Platformer Theme — Implementation Roadmap

**Purpose**: `spec.md` defines *what* the Platformer theme is (requirements, iteration
plan at P1/P2/P3 granularity). This roadmap breaks each iteration down further into
small, independently implementable and browser-verifiable steps. Each step gets its
own implementation plan (via the `writing-plans` skill) when we're ready to build it —
tests first (per the constitution), then a manual browser check.

Status legend: `[ ]` not started, `[~]` in progress, `[x]` done.

## Iteration 1 — Core movement + coins + journal (P1)

- [x] **1. Theme skeleton + floating controls** — register the Platformer theme with a
  blank canvas and the floating theme/locale controls on top, so the theme is
  reachable and escapable during manual testing.
- [x] **2. Static level render** — draw the level's terrain (ground, platforms) with
  no player yet.
- [x] **3. Player idle render** — the character sprite stands on the ground, no
  physics yet.
- [x] **4. Gravity + solid collision** — the character falls, lands on platforms, and
  falls into pits.
- [x] **5. Horizontal movement + walk animation** — arrow keys move the character,
  with a walk animation facing the movement direction.
- [x] **6. Jump** — jump physics (variable height by hold duration) and a jump
  animation, enough to clear gaps.
- [x] **7. One-way bridge platforms** — bridge tiles can be jumped up through from
  below but stay solid on top; holding Down drops the character through one.
- [x] **8. Camera scroll** — the camera follows the character horizontally.
- [x] **9. Health system + pit-fall damage** — a 3-heart HUD; falling into a pit costs
  half a heart and returns the character to the last safe ground it stood on.
- [x] **10. Respawn** — running out of health respawns the character at full health
  with all collected facts kept.
- [x] **11. Coins render** — a small set of animated test coins and a coin counter,
  visible but not yet collectible.
- [x] **12. CollectibleMapper + coin collection** — every Skill and Language from the
  CV becomes a collectible placed in the level; collecting one shows the fact and
  updates the counter.
- [x] **13. Journal skeleton** — a toggleable journal overlay lists collected facts,
  pausing the game while open.
- [x] **14. Journal styling** — the journal gets its final notebook look: paper
  texture, handwriting font, book open/close animation, and per-section bookmark
  tabs.
- [x] **15. Counters + pagination + Reset button** — the journal paginates through all
  CV sections with per-section counters, and a Reset Game button restarts play.

## Iteration 2 — Enemies + blocks + level end (P2)

- [x] **16. Enemy render + level format** — the level format moves to hand-placed
  markers for spawn point, enemies, and collectibles; two enemy types (green/purple
  slime) appear in the level, idling.
- [x] **17. Enemy patrol** — enemies walk back and forth, turning around at walls and
  ledges.
- [x] **18. Stomp defeat** — jumping on an enemy defeats it and reveals its CV fact;
  purple slimes take more hits than green.
- [x] **19. Side/below damage** — touching an enemy from the side costs health and
  knocks the character back, with brief invincibility afterward.
- [x] **20. Destroyable block render** — three block types (crate, question-mark,
  rock) appear in the level as solid obstacles, not yet breakable.
- [x] **21. Block hit mechanics** — each block type reacts differently when hit from
  below: crates crack then shatter revealing a fact, question-marks pop out a bonus
  collectible, rocks just break with no reward.
- [x] **22. Chests + Thank You screen (level-end)** — treasure chests holding
  Experience facts replace the old flagpole as the level-end goal; opening every
  chest shows a Thank You screen with the CV's contact info.
- [x] **23. Ladders (climbing) + vertical camera follow** — ladder tiles let the
  character climb up/down, and the camera now follows vertically too.

## Iteration 3 — Controls (P3)

- [x] **25. Controls overlay** — an on-screen key/legend overlay teaches the basic
  controls when the game starts, and fades away once the player has moved.
- [x] **26. Hint signs** — signposts placed in the level show a short contextual tip
  (e.g. explaining the bridge drop-through) when the character interacts with them.
- [x] **27. Pause-on-open for floating controls** — opening the floating theme/locale
  controls (from step 1) pauses the running game, resuming on close.

## Iteration 4 — Level variety (post-P3)

- [x] **30. Purple slime rework** — purple slimes become bigger, slower, tougher, and
  drop a key instead of a CV fact; keys are needed to open chests.
- [x] **31. Level selection** — implemented as an editor-only feature: the Level Editor
  has a level dropdown (`main`, `empty`, plus saved JSON files) and a Save button,
  specified in `specs/O-002-platformer-level-editor/spec.md`'s User Stories 7 and 8. A
  visitor-facing equivalent (choosing among multiple levels while playing, instead of
  always loading `main`) is a separate, not-yet-designed idea — add it to "Unscheduled
  additions" below if picked up later.
- [x] **32. Terrain rework** — `groundGrass` is autotiled from `tile_atlas.png` via a
  4-neighbour mask, with grass drawn as a decoupled overlay pass. Design in
  `plans/2026-09-02-terrain-rework-design.md`.
- [x] **33. Purple slime spike cooldown** — a purple slime that survives a stomp grows
  spikes for a short cooldown, punishing a landing attempt instead of allowing another
  stomp.
- [x] **34. World-event puff, decoupled from fact rewards** — a destruction sparkle
  effect now plays on every enemy defeat and block break, independent of whether a CV
  fact is also revealed.

## Unscheduled additions (not yet numbered)

Ideas raised but not yet slotted into the roadmap. Each needs its own
`writing-plans` pass (and likely a `brainstorming` session first) before it becomes a
numbered step.

- [x] **Persistent foreground/background water bands** — a viewport-fixed sky
  background and a level-anchored foreground water band (`drawWaterForeground` in
  `Renderer.ts`), using the wave-crest/solid-blue water tiles from `world_tileset.png`.
- [x] **Level editor** — a dev-only visual level editor, instead of hand-editing raw
  level text.
- [x] **Entity architecture follow-ups** — cleanup/consistency work across how enemies,
  pickups, blocks, and chests are structured.
- **Audio** — background music and sound effects, muted by default.
- [x] **Theme-switch reset** — switching away from the Platformer theme and back
  calls `resetGameProgress()` (a mount-only effect in `PlatformerPage.tsx`), clears
  `controlsOverlayDismissed`, and restarts the intro transition — a full fresh
  session, per spec.md User Story 8.
- **Polish pass** — animation/effects refinement and a frame-rate check with many
  collectibles on screen.

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

Each roadmap step gets its own branch off `main` (e.g. `S-006-step34-world-event-puff`),
goes through the normal process (`writing-plans` → `subagent-driven-development`, TDD,
per-task review, final whole-branch review), and lands via its own PR directly into
`main` — not into an intermediate integration branch. `main` is safe to merge into at
any point mid-epic since the Platformer theme is gated behind
`platformerPrototypeUnlocked` (a `localStorage`-backed feature flag, default `false` —
see `src/state/theme.ts`); no theme switcher lists Platformer until it's explicitly
unlocked, so a partially-built step never reaches a visitor. Delete the step branch
after merging.

The Platformer theme is more of an epic than a single feature — there is no single
`S-006-platformer-theme` integration branch; step branches fork from and land directly
into `main`.
