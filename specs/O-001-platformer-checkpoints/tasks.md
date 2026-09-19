---
description: 'Task list for O-001 Platformer Checkpoints'
---

# Tasks: Platformer Checkpoints

**Input**: Design documents from `/specs/O-001-platformer-checkpoints/`
**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. The project constitution (Principle II) and `docs/TestingGuide.md` mandate TDD — tests are written first and must fail before implementation. Every test task below is part of the deliverable, not optional.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently. US1 and US2 are both P1; US3 and US4 are both P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Every task names the exact file it touches

## Path Conventions

- Single project. All source paths are relative to the repository root.
- Platformer source: `src/themes/platformer/`
- Locales: `src/i18n/locales/`
- Level/authoring docs: `docs/themes/platformer/`
- Feature tracking: `docs/Features.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Get onto a feature branch and confirm the one new asset before touching code.

- [x] T001 Confirm the `O-001-platformer-checkpoints` feature branch is checked out (created 2026-09-19) and `.specify/feature.json` points at `specs/O-001-platformer-checkpoints`.
- [x] T002 [P] Verify the art asset `public/sprites/checkpoint-flag-strip.png` exists and is 64×24 (four 16×24 frames), flat 2D pixel art with no 2.5D/3D shading.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The marker, its placement, its base state, and the signal seeding every user story builds on. No story work can begin until this phase is complete.

**⚠️ CRITICAL**: Complete this phase before any user story. `TileChar` gaining `'C'` forces exhaustive `Record<TileChar, …>` entries in `paletteTiles.ts`, so T007/T008 must land with T003/T004 to keep the test suite green.

### Level marker (`C`)

- [x] T003 [P] Write failing tests in `src/themes/platformer/level/LevelParser.test.ts`: `ENTITY_CHARS.C === 'checkpoint'`; `parseLevel(['C','G']).terrain[0][0] === 'empty'`; `findCheckpointTiles` returns every `C` in reading order (top→bottom, left→right); the `entityChars-mapsEveryEntityMarker` case expects `'checkpoint'`; the terrain/entity overlap guard still holds.
- [x] T004 Implement `'checkpoint'` in the `EntityKind` union, `C: 'checkpoint'` in `ENTITY_CHARS`, `'C'` in the `TileChar` union, and `findCheckpointTiles` in `src/themes/platformer/level/LevelParser.ts`.
- [x] T005 [P] Write failing tests in `src/themes/platformer/level/level.test.ts` for `CHECKPOINT_TILES`: it recomputes from `currentLayout` and is empty for `LEVEL_1_LAYOUT`.
- [x] T006 Implement the `CHECKPOINT_TILES` computed and add the `C` line to the marker-inventory comment in `src/themes/platformer/level/level.ts`.

### Palette data (forced by the `TileChar` change)

- [x] T007 [P] Add failing assertions to `src/themes/platformer/editor/paletteTiles.test.ts`: `PALETTE_TILE_SPRITES.C` crops the **raised** frame (frame 3 → `sx: 48`) of `checkpoint-flag-strip.png` (64×24, 16×24); `PALETTE_TILE_LABELS.C` is human-readable; `PALETTE_TILE_DESCRIPTIONS.C` describes the finished-level behaviour.
- [x] T008 Add the `C` entries to `PALETTE_TILE_SPRITES`, `PALETTE_TILE_LABELS`, and `PALETTE_TILE_DESCRIPTIONS` in `src/themes/platformer/editor/paletteTiles.ts` so the exhaustive `Record<TileChar, …>` maps and `paletteTiles.test.ts` stay green.

### Mapper

- [x] T009 [P] Write failing tests in `src/themes/platformer/level/CheckpointMapper.test.ts` for `placeCheckpoints`: it preserves reading order, produces id `checkpoint-${col}-${row}`, and derives `x`/`y` from `tileToPixel`.
- [x] T010 Implement `CheckpointPlacement` and `placeCheckpoints` in `src/themes/platformer/level/CheckpointMapper.ts`.

### Entity base

- [x] T011 [P] Write failing tests in `src/themes/platformer/entities/Checkpoint.test.ts` for the base entity: `CHECKPOINT_FRAME_COUNT/WIDTH/HEIGHT/RAISED_FRAME/RAISE_DURATION_SECONDS`, `CHECKPOINT_FLAG_SHEET` metadata (src, 16×24, 4 columns), `toCheckpointState` always dormant, and `checkpointBox` spanning exactly one rendered tile.
- [x] T012 Implement `CheckpointState`, the constants, `CHECKPOINT_FLAG_SHEET`, `toCheckpointState`, and `checkpointBox` in `src/themes/platformer/entities/Checkpoint.ts`.

### State seeding

- [x] T013 [P] Write failing tests in `src/themes/platformer/PlatformerState.test.ts` for `checkpointPlacements` (derived from `CHECKPOINT_TILES`) and `checkpointStates` (seeded dormant from the placements).
- [x] T014 Add the `checkpointPlacements` computed, the `checkpointStates` signal, and the `activeCheckpointId` signal to `src/themes/platformer/PlatformerState.ts`.

**Checkpoint**: The `C` marker parses, maps, seeds dormant state, and appears in the palette — foundation ready, all four stories can begin.

---

## Phase 3: User Story 1 - Stepping on a Checkpoint (Priority: P1) 🎯 MVP

**Goal**: Stepping onto a dormant checkpoint with solid ground below raises the flag, plays a one-shot burst and a localized fading label, glows, and stays raised — exactly once.

**Independent Test**: Walk the character onto a dormant checkpoint tile. Verify the dormant art raises to the activated art, the activation burst plays exactly once, the label fades in place, and the flag stays raised and glowing for the rest of the run; re-entering replays nothing.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [x] T015 [P] [US1] Tests in `src/themes/platformer/entities/Checkpoint.test.ts`: `checkpointFrameIndex` returns 0 dormant, advances through the frames against `worldElapsed - activatedAt`, and holds on `CHECKPOINT_RAISED_FRAME`; `activateCheckpoint` writes `activated`/`activatedAt` once; `checkpointEffectAnchor` returns the tile anchor.
- [x] T016 [P] [US1] Tests in `src/themes/platformer/engine/CheckpointLogic.test.ts`: `hasSolidGroundBelow` equals `isSolid(tileAt(level, col, row + 1))`; `resolveCheckpointContacts` raises every dormant overlap, reports them in `activatedIds` in reading order, leaves already-raised checkpoints out of `activatedIds`, and never mutates its inputs; a dormant checkpoint with no solid ground below is skipped — it appears in neither `activatedIds` nor `activeId` (mid-air inert, FR-004).
- [x] T017 [P] [US1] Tests in `src/themes/platformer/engine/CollectionEffects.test.ts`: `startFadeOutTextEffect` starts at `elapsed: 0`; `tickFadeOutTextEffect` advances by `dt`; `fadeOutTextOpacity` is 1 then fades linearly to 0 by `FADE_OUT_TEXT_DURATION_SECONDS` and 0 outside that window.
- [x] T018 [P] [US1] Tests in `src/themes/platformer/engine/Renderer.test.ts`: `drawCheckpoints(ctx, states, image, activeCheckpointId, dc)` draws the frame from each state and draws the glow only for the active id; `drawFadeOutTexts(ctx, effects, dc)` draws each effect's own `text` at its own x/y with the fade opacity.
- [x] T019 [US1] Integration tests in `src/themes/platformer/PlatformerPage.test.tsx`: stepping onto a dormant checkpoint with solid ground below activates it once; the puff and label start once and are removed when finished; re-entering an already-raised checkpoint replays nothing.

### Implementation for User Story 1

- [x] T020 [US1] Implement `checkpointFrameIndex`, `activateCheckpoint`, and `checkpointEffectAnchor` in `src/themes/platformer/entities/Checkpoint.ts` (depends on T012).
- [x] T021 [US1] Implement `hasSolidGroundBelow` and the basic `resolveCheckpointContacts` in `src/themes/platformer/engine/CheckpointLogic.ts` — overlap via `overlappingTriggers` + `checkpointBox` + `playerHitbox`, ground-gated, raising every dormant overlap and setting `activeId` to the first activated in reading order, else `previousActiveId` (depends on T010, T012; refined in T037).
- [x] T022 [US1] Implement `FADE_OUT_TEXT_DURATION_SECONDS`, `FadeOutTextEffect`, `startFadeOutTextEffect`, `tickFadeOutTextEffect`, and `fadeOutTextOpacity` in `src/themes/platformer/engine/CollectionEffects.ts` (depends on T017).
- [x] T023 [US1] Add the `activeFadeOutTexts` signal to `src/themes/platformer/PlatformerState.ts`.
- [x] T024 [US1] Implement `drawCheckpointGlow`, `drawCheckpoints(ctx, states, image, activeCheckpointId, dc)` (glow before flag, bottom-anchored/centred, frame from state), and `drawFadeOutTexts(ctx, effects, dc)` in `src/themes/platformer/engine/Renderer.ts` (depends on T020, T022).
- [x] T025 [US1] Add `platformer.checkpoint.label` to `src/i18n/locales/en.json` ("Checkpoint") and `src/i18n/locales/de.json` ("Kontrollpunkt").
- [x] T026 [US1] Wire the activation loop in `src/themes/platformer/PlatformerPage.tsx`: load `CHECKPOINT_FLAG_SHEET` via `loadImage`; each live tick call `resolveCheckpointContacts` with the shared world clock, write `checkpointStates`/`activeCheckpointId`, start one puff (`startPuffEffect`) and one label (`startFadeOutTextEffect`) per `activatedIds` entry; draw `drawCheckpoints`/`drawFadeOutTexts`; advance the `activeFadeOutTexts` timers each tick (the raise itself derives from the clock, so it needs no per-frame tick).

**Checkpoint**: US1 is fully functional and independently testable — a single checkpoint activates visibly and exactly once.

---

## Phase 4: User Story 2 - Dying Returns You to the Last Checkpoint (Priority: P1)

**Goal**: A death restarts the character standing on the active checkpoint with full health, the camera already there, and every collected fact/key/chest preserved; with no active checkpoint the level spawn is used exactly as before.

**Independent Test**: Activate a checkpoint, move away, reduce health to zero, restart, and verify the character spawns on the checkpoint with full health and the camera there; with no checkpoint, verify the spawn is unchanged.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [x] T027 [P] [US2] Tests in `src/themes/platformer/PlatformerState.test.ts`: `playerStateAtTile` matches `spawnPlayerState` geometry (centred, feet on the cell's bottom edge, motion cleared, `lastGroundedX/Y` seeded), full health, `hitTimer` at the refractory end (immediately vulnerable); `activeRespawnPlacement` is `null` with no active id; `respawnPlayerState` equals `spawnPlayerState()` with no active checkpoint and the checkpoint tile otherwise; `respawnCenter` is its visual centre.
- [x] T028 [P] [US2] Tests in `src/themes/platformer/engine/Camera.test.ts`: `initialCameraX` centres the player horizontally and clamps to `[0, max(0, levelPixelWidth - viewportWidth)]`.
- [x] T029 [US2] Integration tests in `src/themes/platformer/PlatformerPage.test.tsx`: with an active checkpoint, death + restart places the character on the checkpoint with full health and the camera there; with none, restart places it at spawn exactly as before; collected facts/keys/chests/block progress are preserved; the respawned character is immediately vulnerable; **SC-008 regression** — a pit fall with an active checkpoint still costs half a heart and returns the character to the last safe ground (the respawn anchor, not the checkpoint unless it last stood there).

### Implementation for User Story 2

- [x] T030 [US2] Refactor `spawnPlayerState` into a pure `playerStateAtTile(col, row)` (with `spawnPlayerState()` delegating to it) and add the `activeRespawnPlacement`, `respawnPlayerState`, and `respawnCenter` computed signals in `src/themes/platformer/PlatformerState.ts`.
- [x] T031 [US2] Update `resetGame()` in `src/themes/platformer/PlatformerState.ts` to place the character at `respawnPlayerState.value` and clear `activeFadeOutTexts` (a frozen label must not survive a respawn), leaving `checkpointStates`/`activeCheckpointId` untouched (FR-015).
- [x] T032 [US2] Implement `initialCameraX` in `src/themes/platformer/engine/Camera.ts` (horizontal mirror of `initialCameraY`).
- [x] T033 [US2] Rename `snapCameraYToSpawn` to `snapCameraToRespawn` in `src/themes/platformer/PlatformerPage.tsx`, snap both X (`initialCameraX`) and Y, and centre the restart/debug/Reset Game iris on `respawnCenter.value` instead of `spawnCenter()`.

**Checkpoint**: US1 and US2 both work independently — death now returns the visitor to the last checkpoint.

---

## Phase 5: User Story 3 - Visited Flags Stay Raised, the Latest Glows (Priority: P2)

**Goal**: Every touched checkpoint stays raised; exactly one — the most recently touched — glows and is the respawn target; same-tick entries resolve deterministically (dormant wins); Reset Game returns every flag to dormant.

**Independent Test**: Activate checkpoint A, then B; verify both flags stay raised, B glows, and a death respawns at B; step back onto A and verify the glow moves with no replay; Reset Game clears all.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [x] T034 [P] [US3] Tests in `src/themes/platformer/engine/CheckpointLogic.test.ts`: two dormant checkpoints entered in one tick resolve to the first in reading order, deterministically; a dormant checkpoint and an already-raised non-active one entered in one tick resolve to the dormant one (both raised); re-entering an already-raised non-active checkpoint moves `activeId` to it with an empty `activatedIds`.
- [x] T035 [P] [US3] Tests in `src/themes/platformer/PlatformerState.test.ts`: `resetGame` preserves `checkpointStates` and `activeCheckpointId`; `resetGameProgress` rebuilds `checkpointStates` dormant, clears `activeCheckpointId`, and clears `activeFadeOutTexts`.
- [x] T036 [US3] Integration tests in `src/themes/platformer/PlatformerPage.test.tsx`: activating B after A keeps A raised and moves the glow to B; a death respawns at B; stepping back onto A moves the glow to A with no raise/burst/label; Reset Game returns every flag to dormant with no glow.

### Implementation for User Story 3

- [x] T037 [US3] Extend `resolveCheckpointContacts` in `src/themes/platformer/engine/CheckpointLogic.ts` with the dormant-wins tie-break: `activeId = dormant[0] ?? overlaps[0]` (first dormant in reading order, else the first entered raised), keeping the resolver pure and deterministic (FR-008/FR-009).
- [x] T038 [US3] Update `resetGameProgress()` in `src/themes/platformer/PlatformerState.ts` to clear `activeCheckpointId`, rebuild `checkpointStates` dormant from `checkpointPlacements`, and clear `activeFadeOutTexts` **before** calling `resetGame()`; confirm the glow is drawn live from `activeCheckpointId` (no cached glow state) in `src/themes/platformer/PlatformerPage.tsx`/`engine/Renderer.ts`.

**Checkpoint**: All P1/P2 gameplay stories are independently functional; checkpoints are safe to scatter through a level.

---

## Phase 6: User Story 4 - Placing Checkpoints in the Level Editor (Priority: P2)

**Goal**: The checkpoint appears in the editor palette with a name, tooltip and raised-flag preview; it paints/erases/saves/loads like any other tile and renders a dormant preview on the editor canvas; the shipped level gains no `C`.

**Independent Test**: Open the editor, find the checkpoint in the palette, paint one into a level, save and reload, then play and verify a checkpoint exists and activates at that cell.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [x] T039 [P] [US4] Tests in `src/themes/platformer/editor/gridRenderState.test.ts`: `synthesizeCheckpointStates` returns one dormant state per `C` cell with correct coordinates and an empty array when there are none.
- [x] T040 [P] [US4] Tests in `src/themes/platformer/editor/EditorCanvas.test.tsx`: a `C` cell makes the canvas draw the dormant checkpoint preview (assert via the `drawCheckpoints`/synthesized-state path).
- [x] T041 [P] [US4] Tests in `src/themes/platformer/editor/exportLayout.test.ts` and `src/themes/platformer/editor/importLayout.test.ts` that `C` round-trips verbatim, plus a test in `src/themes/platformer/level/level.test.ts` that `LEVEL_1_LAYOUT` contains no `C` (the shipped level must stay checkpoint-free).

### Implementation for User Story 4

- [x] T042 [US4] Implement `synthesizeCheckpointStates` in `src/themes/platformer/editor/gridRenderState.ts` (scan for `C`, map to `toCheckpointState`, editor-prefixed ids).
- [x] T043 [US4] Add `checkpoint: HTMLImageElement | null` to `EditorImages`, load the strip, include `CHECKPOINT_FLAG_SHEET.src` in the draw context's `sprites`, and draw the dormant preview via `drawCheckpoints` in `src/themes/platformer/editor/EditorCanvas.tsx`.
- [x] T044 [US4] Register the checkpoint strip in the editor image loader list and `EMPTY_IMAGES` in `src/themes/platformer/editor/LevelEditorPage.tsx` (and update the matching `EMPTY_IMAGES` fixture in `src/themes/platformer/editor/EditorCanvas.test.tsx`).
- [x] T045 [P] [US4] Update `docs/themes/platformer/LevelFormat.md` (entity characters table + `TileChar` count) and `docs/themes/platformer/LevelDesign.md` (element table `C` row).

**Checkpoint**: All four user stories are independently functional; the tile is authorable end to end.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full-suite verification, and the mandatory manual browser check.

- [x] T046 [P] Update `docs/Features.md` per the project completion rule (feature list checkbox, Implementation Status row → `✅ Done`/`✅`/`✅`, dependency node prefixed `✅ ` + `class O001 done`). O-001 is re-scoped to this feature — its description and node label already read "Platformer Checkpoints" (in-run respawn + editor tile), replacing the former "Checkpoint Persistence" wording, so only the completion marks change here.
- [x] T047 Run `npm test` (Vitest) and `npm run build` (TypeScript strict + Vite) and fix any fallout; all pre-existing suites must stay green.
- [x] T048 Run the manual browser verification script in `specs/O-001-platformer-checkpoints/quickstart.md` (author a checkpoint, activation-once, mid-air inert, death respawn, no-checkpoint unchanged, Reset Game clears, pit falls unchanged, DE label, shipped level untouched).
- [x] T049 [P] Final audit: no `any` and no `localStorage` introduced; no audio call was added (FR-019); `LEVEL_1_LAYOUT` still contains no `C`; the sprite stays flat 2D pixel art on the 16px grid.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–6)**: All depend on Foundational. US1 and US2 are P1 and should run first (in priority order); US3 and US4 are P2.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational. No dependency on other stories.
- **US2 (P1)**: Starts after Foundational. Uses the `activeCheckpointId` produced by US1's resolver to choose the respawn point; otherwise independent.
- **US3 (P2)**: Builds on US1's `resolveCheckpointContacts` (T037 refines it) and US1/US2's state signals. Its independent test needs US1's activation to exist.
- **US4 (P2)**: Starts after Foundational. Fully independent of US1–US3 (editor-only), except that the palette `Record` entries (T008) are already in place.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Entity/mapper/logic modules before renderer/loop wiring.
- Story complete and independently validated before moving to the next priority.

### Critical Build Note

`TileChar` gaining `'C'` (T004) makes `PALETTE_TILE_SPRITES`/`PALETTE_TILE_LABELS`/`PALETTE_TILE_DESCRIPTIONS` non-exhaustive until T008 lands, and `paletteTiles.test.ts` fails until then. T007/T008 are therefore part of Foundational. Vitest does not type-check, but `npm run build` (T047) fails until the palette entries exist.

---

## Parallel Opportunities

- **Setup**: T002 can run alongside T001's branch setup.
- **Foundational**: T003, T005, T007, T009, T011, T013 (all different test files) can run in parallel; then T004, T006, T008, T010, T012, T014 follow their tests.
- **US1 tests**: T015–T018 are four different files and can run in parallel; T019 (the integration harness) can start once the loop wiring exists.
- **US2 tests**: T027 and T028 are different files and can run in parallel.
- **US3 tests**: T034 and T035 are different files and can run in parallel.
- **US4 tests**: T039, T040, T041 are different files and can run in parallel.

### Parallel Example: Foundational tests

```bash
Task: "T003 LevelParser C-marker tests in src/themes/platformer/level/LevelParser.test.ts"
Task: "T005 CHECKPOINT_TILES tests in src/themes/platformer/level/level.test.ts"
Task: "T007 palette C-entry tests in src/themes/platformer/editor/paletteTiles.test.ts"
Task: "T009 placeCheckpoints tests in src/themes/platformer/level/CheckpointMapper.test.ts"
Task: "T011 Checkpoint base tests in src/themes/platformer/entities/Checkpoint.test.ts"
Task: "T013 checkpoint signal seeding tests in src/themes/platformer/PlatformerState.test.ts"
```

### Parallel Example: US4 tests

```bash
Task: "T039 synthesizeCheckpointStates tests in src/themes/platformer/editor/gridRenderState.test.ts"
Task: "T040 editor preview tests in src/themes/platformer/editor/EditorCanvas.test.tsx"
Task: "T041 round-trip + shipped-level tests in exportLayout/importLayout/level tests"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: US1 — activation happens visibly and exactly once.
4. **STOP and VALIDATE**: run the US1 tests and the quickstart activation/mid-air checks.
5. Deploy/demo if ready — a visible checkpoint that remembers nothing yet is still a coherent increment.

### Incremental Delivery

1. Setup + Foundational → marker, mapper, base state, palette entry ready.
2. US1 → activation moment (MVP).
3. US2 → death returns to the last checkpoint.
4. US3 → many checkpoints, glow follows the latest, Reset Game clears.
5. US4 → authorable in the editor.
6. Polish → docs, full suite, manual verification.

### Notes

- `[P]` tasks touch different files and have no dependency on incomplete tasks.
- The story label maps every story-phase task to its spec user story for traceability.
- The activation raise derives from the shared world clock (`activatedAt` + `dc.worldElapsed`) — do not add a per-frame state write.
- No auto-commits; commit only when the user asks.
- A manual browser check (quickstart.md) is required before review.
