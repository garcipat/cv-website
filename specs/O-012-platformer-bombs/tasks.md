---
description: 'Task list for Platformer Bombs (O-012)'
---

# Tasks: Platformer Bombs

**Input**: Design documents from `/specs/O-012-platformer-bombs/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: **MANDATORY** — constitution Principle II requires TDD. Every story below
writes its failing Vitest/RTL tests first, then implements until green. Test tasks are
therefore included in every phase and MUST be written and failing before the matching
implementation task.

**Organization**: Tasks are grouped by user story (spec.md priorities US1→US6) so each
story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1…US6)
- Every task names its exact file path.

## Path Conventions

- Single static web app; all source under `src/themes/platformer/`, strings under `src/i18n/`.
- Tests are co-located next to their module (e.g. `engine/Blast.ts` → `engine/Blast.test.ts`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the authored assets and a green baseline before touching code.

- [X] T001 Verify the authored sprite strips exist and match the spec's dimensions in `public/sprites/`: `bomb.png` (96×16, 6×16px frames) and `explosion.png` (384×48, 8×48px frames); note the frame counts for the sheet registrations.
- [X] T002 [P] Run the existing suite (`npm test`) and confirm a fully green baseline before any change.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, registries, markers and session signals every user story reads.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Register the new sprite sheets in `src/themes/platformer/entities/sprites/sheets.ts`: `BOMB_SHEET` (`/sprites/bomb.png`, 16×16, 6 columns) and `EXPLOSION_SHEET` (`/sprites/explosion.png`, 48×48, 8 columns); add a registration assertion to `src/themes/platformer/entities/sprites/SpriteSheet.test.ts`.
- [X] T004 [P] Widen the block kind unions with `'bombPot'`: `BlockKind` in `src/themes/platformer/entities/Block.ts` and `BlockDef['blockKind']` in `src/themes/platformer/types.ts`.
- [X] T005 Extend `src/themes/platformer/level/LevelParser.ts`: add `'bombPot'` to `EntityKind`, `ENTITY_CHARS.b = 'bombPot'`, `SIGN_CHARS['6'] = 'bomb'`, `'b' | '6'` to `TileChar`, and `findBombPotTiles`; extend `src/themes/platformer/level/LevelParser.test.ts` (char mapping, `findBombPotTiles`, and the `TileChar`-sync assertion covering `b`/`6`).
- [X] T006 Extend `src/themes/platformer/level/BlockMapper.ts`: add `bombPot?: readonly { col: number; row: number }[]` to `BlockMarkerPositions` and emit `bombpot-${col}-${row}` placements in `placeBlocks`; extend `src/themes/platformer/level/BlockMapper.test.ts`.
- [X] T007 Add `BOMB_POT_TILES = computed(() => findBombPotTiles(currentLayout.value))` to `src/themes/platformer/level/level.ts` (importing the new finder) and document `b`/`6` in the layout legend comment at the top of that file.
- [X] T008 Add the `b` (Bomb Pot, `world_tileset.png` row 8 col 0 → sx 0 / sy 128) and `6` (Sign 6, `world_tileset.png` row 3 col 8 → sx 128 / sy 48) entries to `PALETTE_TILE_SPRITES`, `PALETTE_TILE_LABELS` and `PALETTE_TILE_DESCRIPTIONS` in `src/themes/platformer/editor/paletteTiles.ts`; extend `src/themes/platformer/editor/paletteTiles.test.ts`; and update `src/themes/platformer/editor/paintCell.test.ts` for the sixth sign digit — `cyclingRepeatedly-walksThroughEveryRegisteredHintInOrderThenWrapsAround` loops 6× expecting `['2','3','4','5','6','1']`, and the "all hints used" grid gains `'6'`.
- [X] T009 Add `platformer.hints.bomb` ("Press B to place a bomb.") and `platformer.hints.noBombs` ("I have no bombs.") to both `src/i18n/locales/en.json` and `src/i18n/locales/de.json` (so `HintId` includes both keys).
- [X] T010 Extend `src/themes/platformer/PlatformerState.ts`: declare `MAX_BOMBS = 5`, `carriedBombs = signal(0)`, `bombPickupStates = signal<BombPickupState[]>([])`, `placedBombs = signal<PlacedBombState[]>([])`, `activeExplosions = signal<ExplosionEffect[]>([])`, and pass `bombPot: BOMB_POT_TILES.value` into `placeBlocks` in `blockPlacements`; extend `src/themes/platformer/PlatformerState.test.ts` with the seeding + `MAX_BOMBS` assertions. (Their clearing on reset is US5.)

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 - The Blue Pot Yields a Bomb (Priority: P1) 🎯 MVP

**Goal**: A blue bomb pot breaks with the shared pot outcome, drops a bobbing bomb pickup, and collecting it raises the HUD bomb count by one.

**Independent Test**: Place a blue pot, land on it, verify it breaks with the standard bounce/puff, a bomb appears at its tile, the character collects it, and the HUD count becomes exactly 1.

### Tests for User Story 1 (write first, confirm they FAIL) ⚠️

- [X] T011 [P] [US1] Write failing tests for the bomb pot kind in `src/themes/platformer/entities/blocks/BombPot.test.ts`: shared factory contract (`maxHits` 1, `removeWhenUsedUp`, `triggerSides ['top']`), `pot` declaration (`drop: 'bomb'`, `dropPolicy: 'everyBreak'`, `restoredOnRespawn: true`), `frameIndex(0) === 128`, an `onHit` that drops a bomb on every break, and a `computePotRenderPlan` merge with a `coinPot`/`potionPot` neighbour that emits a seam filler and keeps the bomb pot's member frame at 128 (never swapped for a clay variant, FR-006).
- [X] T012 [P] [US1] Write failing tests for the bomb pickup state/box in `src/themes/platformer/entities/BombPickup.test.ts`: `spawnBombPickup` id/x/y, `BOMB_PICKUP_RENDERED_SIZE`/offset centering, and `box()` matching the centered smaller rect.
- [X] T013 [P] [US1] Extend `src/themes/platformer/entities/pickups/index.test.ts` with the `bomb` entry: own key, `BOMB_SHEET`, frame 0, and a box equal to `PICKUP_TYPES.bomb.box(spawnBombPickup(...))`; assert a bomb pickup carries no CV fact — it is never a `CollectiblePlacement` and never affects the coin/journal counters (FR-011).
- [X] T014 [US1] Write failing integration tests in `src/themes/platformer/PlatformerPage.test.tsx`: breaking a `bombPot` spawns one `bombPickupStates` entry at the pot's tile; walking over it increments `carriedBombs` by exactly 1 and removes it from the world; the bomb HUD group is absent at 0 and present at ≥1; collecting a bomb adds no `CollectiblePlacement` and leaves the coin/journal counters unchanged (FR-011).

### Implementation for User Story 1

- [X] T015 [P] [US1] Create `src/themes/platformer/entities/blocks/BombPot.ts` — a `createPotType` kind with `key: 'bombPot'`, `WORLD_TILESET_SHEET`, `drop: 'bomb'`, `dropPolicy: 'everyBreak'`, `restoredOnRespawn: true`, `frameIndex: () => 128`, `drawPot: (block, dc) => drawBlockTile(block, dc, 128)`.
- [X] T016 [US1] Register `bombPot` in `src/themes/platformer/entities/blocks/index.ts` (`BLOCK_TYPES`) and cover it in `src/themes/platformer/entities/blocks/index.test.ts` (key/slot, shared pot contract, tileset sheet).
- [X] T017 [P] [US1] Create `src/themes/platformer/entities/BombPickup.ts` — `BOMB_PICKUP_RENDERED_SIZE`, tile offsets, `BombPickupState` and `spawnBombPickup`.
- [X] T018 [P] [US1] Create `src/themes/platformer/entities/pickups/Bomb.ts` — the `PickupType<BombPickupState>` view (key `'bomb'`, `BOMB_SHEET`, `frameIndex: () => 0`, `bobOffset: coinBobOffset`, `box`/`draw` mirroring `pickups/Heart.ts`).
- [X] T019 [US1] Register `bomb` in `src/themes/platformer/entities/pickups/index.ts` (`PICKUP_TYPES`), widening `PickupKind` to include `'bomb'`.
- [X] T020 [US1] Add cap-aware `checkBombPickupCollisions(player, bombs, count, cap): string[]` to `src/themes/platformer/engine/Collision.ts` (returns at most `max(0, cap - count)` ids in array order; `[]` at the cap) and cover it in `src/themes/platformer/engine/Collision.test.ts` (below cap, at cap, several pickups clamped in one tick).
- [X] T021 [US1] Add `drawBombPickups`, `drawBombCounter` (bomb frame-0 icon + `${count}`, no denominator) and `bombCounterX` to `src/themes/platformer/engine/Renderer.ts`, mirroring `drawHeartPickups`/`drawKeyCounter`/`keyCounterX` (offset past the key counter by `HUD_GROUP_GAP`, accounting for the key counter being hidden at 0); cover them in `src/themes/platformer/engine/Renderer.test.ts`.
- [X] T022 [US1] Wire `src/themes/platformer/PlatformerPage.tsx`: add the `spawnPickup === 'bomb'` arm to the block-hit dispatch (append `spawnBombPickup(block.id, block.x, block.y)` to `bombPickupStates`), collect via `checkBombPickupCollisions` (increment `carriedBombs`, filter the collected ids out), call `drawBombPickups` after `drawHeartPickups`, and draw `drawBombCounter` only while `carriedBombs.value > 0` at `bombCounterX(...)`/`KEY_COUNTER_Y`.
- [X] T023 [US1] Add one `b` (bomb pot) to `LEVEL_1_LAYOUT` in `src/themes/platformer/level/level.ts` on base ground reachable early (e.g. col 6 of the base marker row), and update the layout legend comment.

**Checkpoint**: User Story 1 is fully functional and testable on its own — the MVP.

---

## Phase 4: User Story 2 - Place a Bomb and Get Clear (Priority: P1)

**Goal**: `B` places a carried bomb at the character's feet; its fuse lights and pulses, it falls if placed in mid-air, and after ~2 s it detonates in a rounded 5×5 burst that damages a character still in the blast.

**Independent Test**: Carry a bomb, place it, verify a bomb appears at the character's tile, the fuse animation plays with an accelerating pulse, it detonates after the fuse duration, and a character still in the blast loses 2 hitpoints (a full heart).

### Tests for User Story 2 (write first, confirm they FAIL) ⚠️

- [X] T024 [P] [US2] Write failing tests for `src/themes/platformer/engine/PlacedBomb.test.ts`: `bombLandingRow` (bridge stops a bomb, ladder is open air, `landingRow === row` when the cell below is solid, `null` when no floor), gravity/fuse stepping (monotonic `y`, snap on landing, `fuseElapsed += dt` even while falling, `dt <= 0` no-op, no input mutation), `checkBombFellOut`, `bombFuseFrame` over the whole fuse (never frame 0, sequence `[1,2,3,4,5,4,5,4,5]`, only frame 5 scaled by `BOMB_PULSE_SCALE`, ends on 5), and `hasDetonated` before/at `BOMB_FUSE_SECONDS`.
- [X] T025 [P] [US2] Write failing tests for `src/themes/platformer/engine/Blast.test.ts`: `blastTiles` (full 21 rounded interior, corners cut, clipped to bounds at edges/corners, always 1–21 distinct in-bounds), `blocksInBlast` (only live `removeWhenUsedUp` blocks; excludes question-mark, terrain and used-up), `enemiesInBlast` (alive box overlap; excludes dead/outside), and `playerInBlast` (hitbox overlap true/false).
- [X] T026 [P] [US2] Extend `src/themes/platformer/engine/CollectionEffects.test.ts` with the explosion effect: `startExplosionEffect`, `tickExplosionEffect` advancing `elapsed`, `explosionFrameIndex` playing each frame once in order and clamping, and expiry at `EXPLOSION_DURATION_SECONDS`.
- [X] T027 [US2] Extend `src/themes/platformer/engine/Renderer.test.ts` for `drawPlacedBombs` (frame from `bombFuseFrame`, scaled about the tile centre, drawn at the current falling `y`, never frame 0) and `drawExplosions` (`EXPLOSION_SHEET` frame at `renderScale 2`, centred on the blast).
- [X] T028 [P] [US2] Extend `src/themes/platformer/engine/Input.test.ts` to assert `'KeyB'` is in the suppressed game keys and edge-triggers once per press via `consumePress`.
- [X] T029 [US2] Write failing integration tests in `src/themes/platformer/PlatformerPage.test.tsx`: `B` with `carriedBombs > 0` places one bomb in the player's feet tile and decrements the count by one; the bomb's fuse plays the fixed frame order; it detonates after `BOMB_FUSE_SECONDS`; a character in the blast takes 2 hitpoints, and none while invincible; entering the rounded 5×5 area one tick after detonation, while the explosion frames still play, deals no damage (FR-023); a bomb placed in mid-air falls and rests on the first solid surface; a bomb on a bridge rests on it; a bomb on a ladder tile falls; a bomb over a bottomless column is removed without exploding.
- [X] T030 [US2] Write failing onboarding tests in `src/themes/platformer/PlatformerPage.test.tsx`: the shipped level contains a `6` sign beside the `b` pot whose tooltip names the `B` key (and a `b` pot), and `ControlsOverlay` renders no bomb keycap/caption (SC-014).

### Implementation for User Story 2

- [X] T031 [US2] Add `'KeyB'` to `GAME_KEYS` in `src/themes/platformer/engine/Input.ts` (no other change).
- [X] T032 [P] [US2] Create `src/themes/platformer/engine/PlacedBomb.ts` — `PlacedBombState`/`BombFrame`, `BOMB_FUSE_SECONDS`, `BOMB_GRAVITY`/`BOMB_TERMINAL_VELOCITY` (reuse `PHYSICS_CONFIG` values where suitable), `BOMB_PULSE_SCALE`, `BOMB_FUSE_SEQUENCE`, and `bombLandingRow`/`createPlacedBomb`/`stepPlacedBomb`/`checkBombFellOut`/`bombFuseFrame`/`hasDetonated`, reusing `isSolid`/`tileAt`/`isBlockOccupied` (bridge solid, ladder open, ladder-top predicate deliberately not consulted).
- [X] T033 [P] [US2] Create `src/themes/platformer/engine/Blast.ts` — `BlastTile`, `blastTiles`, `blocksInBlast` (destructible = `BLOCK_TYPES[kind].removeWhenUsedUp`), `enemiesInBlast` (via `typeOf(enemy).box`), `playerInBlast`; pure, no mutation, no line-of-sight rule.
- [X] T034 [P] [US2] Add `ExplosionEffect` + `EXPLOSION_DURATION_SECONDS`/`EXPLOSION_FRAME_COUNT` + `startExplosionEffect`/`tickExplosionEffect`/`explosionFrameIndex` to `src/themes/platformer/engine/CollectionEffects.ts` (purely cosmetic, never a hazard).
- [X] T035 [US2] Add `drawPlacedBombs` and `drawExplosions` to `src/themes/platformer/engine/Renderer.ts`.
- [X] T036 [US2] Wire `src/themes/platformer/PlatformerPage.tsx`: read `input.consumePress('KeyB')` once per tick and place at the player's horizontal-centre column + feet row; tick `placedBombs` (fall via `stepPlacedBomb`, fuse always advancing); on `hasDetonated` resolve the blast once (`blastTiles` + `playerInBlast` → `takeDamage(2)` + `beginHitReaction` + a player hit splatter), append an `ExplosionEffect` and remove the bomb; remove bombs that `checkBombFellOut` without exploding; advance/expire `activeExplosions`; load `EXPLOSION_SHEET.src` via the hand-listed `loadImage` exception; call `drawPlacedBombs` after `drawBlocks` and `drawExplosions` above the world effects and below the HUD.
- [X] T037 [US2] Add one `6` (bomb hint sign) to `LEVEL_1_LAYOUT` in `src/themes/platformer/level/level.ts` beside the `b` pot from T023, and note it in the legend comment.

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - The Blast Clears the Way (Priority: P1)

**Goal**: The detonation destroys destructible blocks in the rounded 5×5 area (revealing their facts/drops) and defeats enemies in it (with their normal reward), leaving terrain, static objects, loose pickups and other bombs untouched.

**Independent Test**: Detonate a bomb whose rounded 5×5 area contains a crate, a fragile rock and an enemy; verify the blocks are destroyed (and their facts revealed) and the enemy is defeated with its normal reward.

### Tests for User Story 3 (write first, confirm they FAIL) ⚠️

- [X] T038 [US3] Write failing integration tests in `src/themes/platformer/PlatformerPage.test.tsx`: a crate in the blast is destroyed and reveals its fact(s) exactly as a bump destruction; a fragile rock and a coin/potion/bomb pot in the blast are destroyed (pots spawn their pickups); an enemy in the blast is defeated and drops its normal reward; a question-mark block, terrain (ground/wall/bridge/ladder) and static objects are untouched; a loose coin/heart and a second placed bomb in the blast are untouched (no chain); the second bomb detonates only from its own fuse.

### Implementation for User Story 3

- [X] T039 [US3] Refactor the per-block terminal-outcome code in `src/themes/platformer/PlatformerPage.tsx` into one local `resolveBlockTerminalOutcome(block)` helper (facts/pickups/puffs/popups/rewardGiven exactly as the `hitBlocks` loop), reuse it for each `blocksInBlast(...)` block after driving it to its terminal hit, and mark every `enemiesInBlast(...)` enemy defeated (`hitPoints: 0`, `alive: false`) so the existing `justDefeated` pipeline pays its reward/drop/puff — never enumerating loose pickups or placed bombs.

**Checkpoint**: All P1 user stories are independently functional.

---

## Phase 6: User Story 4 - The Inventory Has Limits (Priority: P2)

**Goal**: The carried count never exceeds the cap; a pickup at the cap stays in the world bobbing; placing with zero bombs shows a transient "no bombs" bubble and consumes nothing; an occupied tile is a silent no-op; a placed bomb is non-solid.

**Independent Test**: Fill the inventory to the cap, collect another bomb, verify the count does not exceed the cap and the pickup remains; place a bomb and verify the pickup can then be collected.

### Tests for User Story 4 (write first, confirm they FAIL) ⚠️

- [X] T040 [P] [US4] Extend `src/themes/platformer/engine/HintTooltip.test.ts` with the transient bubble: `startHintTooltip(id, { transient: true })` marks the state transient and auto-begins its exit after the fixed dwell (so a keypress-triggered bubble reads as a brief speech bubble), while a non-transient tooltip still waits for `beginHintTooltipExit`.
- [X] T041 [US4] Write failing integration tests in `src/themes/platformer/PlatformerPage.test.tsx`: at the cap, touching a bomb pickup leaves the count unchanged and the pickup in the world; pressing `B` with zero bombs places nothing, consumes nothing, and starts the transient `noBombs` bubble; pressing `B` on a tile that already holds a placed bomb is a silent no-op (no bubble); the character is never blocked or stood up by a placed bomb's tile.

### Implementation for User Story 4

- [X] T042 [US4] Add an optional `transient?: boolean` to `HintTooltipState` and the transient auto-exit to `src/themes/platformer/engine/HintTooltip.ts` (`startHintTooltip(hintId, { transient })`, dwell constant, `tickHintTooltip` begins the exit automatically).
- [X] T043 [US4] Update `src/themes/platformer/PlatformerPage.tsx`: keep `checkBombPickupCollisions` capped (already cap-aware from T020), and in the `KeyB` handler show `startHintTooltip('noBombs', { transient: true })` when `carriedBombs === 0` and skip placement when the target tile already holds a placed bomb (no bubble, nothing consumed).

**Checkpoint**: User Stories 1–4 all work independently.

---

## Phase 7: User Story 5 - Death, Respawn and Refill (Priority: P2)

**Goal**: On death/respawn every placed bomb and dropped bomb pickup is removed, the carried count resets to zero (HUD hidden), and every broken blue pot is restored intact and yields a fresh bomb when re-broken.

**Independent Test**: Place and break, then die; verify placed bombs are removed, the carried count is zero, and broken blue pots are restored intact and yield a bomb again when re-broken.

### Tests for User Story 5 (write first, confirm they FAIL) ⚠️

- [X] T044 [P] [US5] Extend `src/themes/platformer/PlatformerState.test.ts` with the reset lifetime: `resetGame()` empties `placedBombs` and `bombPickupStates` and sets `carriedBombs` to 0 while rebuilding broken `bombPot` placements intact (via the existing `restoredOnRespawnForBlock` path), and `resetGameProgress()` additionally clears `activeExplosions`.
- [X] T045 [US5] Write failing integration tests in `src/themes/platformer/PlatformerPage.test.tsx`: dying with a placed bomb removes it without exploding; the carried count is 0 and the bomb HUD group is hidden after respawn; a broken blue pot is standing again and re-breaks into a fresh bomb pickup.

### Implementation for User Story 5

- [X] T046 [US5] Update `src/themes/platformer/PlatformerState.ts`: in `resetGame()` set `placedBombs.value = []`, `carriedBombs.value = 0`, `bombPickupStates.value = []` (the `bombPot` restoration already flows through the existing `restoredOnRespawn` path), and in `resetGameProgress()` clear `activeExplosions.value = []`.

**Checkpoint**: User Stories 1–5 all work independently.

---

## Phase 8: User Story 6 - The Editor Knows the Blue Pot (Priority: P3)

**Goal**: A level author can pick the blue bomb pot from the editor palette, paint it, and see it previewed (including bunch merging) exactly as the game renders it; no runtime bomb or explosion is authorable.

**Independent Test**: Paint a blue pot in the editor, verify its palette entry and canvas preview match the game's rendering, and verify no runtime bomb or explosion can be painted.

### Tests for User Story 6 (write first, confirm they FAIL) ⚠️

- [X] T047 [P] [US6] Extend `src/themes/platformer/editor/gridRenderState.test.ts`: `synthesizeBlockStates` maps a `b` cell to a `bombPot` `BlockState`, a `b` beside another pot merges through `computePotRenderPlan` (with a seam filler), and the editor palette contains no placed-bomb or explosion entry.

### Implementation for User Story 6

- [X] T048 [US6] Update `src/themes/platformer/editor/gridRenderState.ts`: synthesize `bombPot` blocks from `b` in `synthesizeBlockStates` (mirroring the existing `u`/`p` lines) so `EditorCanvas`'s already-wired `computePotRenderPlan` merges it with neighbours.

**Checkpoint**: All six user stories are independently functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Completion tracking, full validation and the explosion-sheet choice.

- [X] T049 [P] Update `docs/Features.md` per the completion-tracking convention: prefix the `O012` node label with `✅ ` (`O012["✅ O-012: Bombs"]`) and add `class O012 done` alongside its existing category class.
- [X] T050 [P] Run the full automated suite (`npm test`) plus lint and production build; confirm all new and existing tests pass and the build is clean.
- [ ] T051 Run the `quickstart.md` manual browser validation end to end (`npm run dev`, `/platformer` and `/platformer/editor`) — every scenario in sections 1–9, including the pause freeze and Reset Game clearing.
- [X] T052 Explosion choice made: the comic-style `explosion.png` (8 × 48×48) is the single explosion sheet; the round-fireball candidate was dropped. `EXPLOSION_DRAW_SCALE` (1.5) draws it larger than the native frame.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup — **BLOCKS all user stories**.
- **User Stories (Phases 3–8)**: all depend on Foundational.
  - P1 stories (US1 → US2 → US3) are best done in priority order; US2 reuses US1's inventory signals/HUD and US3 reuses US2's blast.
  - P2 stories (US4, US5) extend US1/US2 and may proceed once US1–US2 land.
  - US6 (P3) depends only on the Foundational markers/palette and can be done any time after Phase 2.
- **Polish (Phase 9)**: depends on all desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: after Foundational — no dependency on other stories.
- **US2 (P1)**: after Foundational — integrates with US1's `carriedBombs`/`bombPickupStates` but is independently testable.
- **US3 (P1)**: after Foundational — integrates with US2's detonation but is independently testable.
- **US4 (P2)**: extends US1's collision cap and US2's `KeyB` handler.
- **US5 (P2)**: extends the US1/US2 session signals' reset lifetime.
- **US6 (P3)**: after Foundational — independent of gameplay stories.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- State/types → registries → pure modules → renderer → page wiring.
- `src/themes/platformer/PlatformerPage.tsx` is edited by US1, US2, US3, US4 and US5 — those edits are sequential, never parallel.
- `src/themes/platformer/level/level.ts` is edited by T007, T023 and T037 — sequential.

### Parallel Opportunities

- T003/T004 (different files) and T002 in Setup/Foundational.
- T011/T012/T013 (separate test files).
- T015/T017/T018 (separate new modules).
- T024/T025/T026/T028 (separate test files).
- T032/T033/T034 (separate new/edited modules).
- T040 and T044 (separate test files).
- T047 (editor test file).
- T049/T050 in Polish.

---

## Parallel Example: User Story 2

```bash
# Tests (write first, expect failures):
Task: "Write engine/PlacedBomb.test.ts"
Task: "Write engine/Blast.test.ts"
Task: "Extend engine/CollectionEffects.test.ts with the explosion effect"
Task: "Extend engine/Input.test.ts for KeyB"

# Then the independent modules:
Task: "Create engine/PlacedBomb.ts"
Task: "Create engine/Blast.ts"
Task: "Add ExplosionEffect to engine/CollectionEffects.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: place a blue pot, break it, collect the bomb, confirm the HUD count — independently.
5. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → validate (MVP: a bomb source and an inventory).
3. US2 → validate (placing, fuse, blast damage).
4. US3 → validate (blast clears blocks and enemies).
5. US4 → validate (cap + onboarding bubble).
6. US5 → validate (respawn rules).
7. US6 → validate (editor parity).
8. Polish → completion tracking, full suite, manual quickstart, explosion choice.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- [Story] labels map tasks to spec.md stories for traceability.
- TDD is mandatory (constitution Principle II): verify each new test fails before implementing it.
- A placed bomb is non-solid and never joins `blockPlacements`; a blast never enumerates loose pickups or other placed bombs (FR-025/FR-033 hold by construction).
- Both explosion sheets stay registered and loaded; `EXPLOSION_SHEET` is the one-line swap point.
- The controls overlay (`components/ControlsOverlay.tsx`) is deliberately unchanged — do not add a bomb keycap.
