---
description: 'Task list for Platformer Bouncy Mushroom Blocks (O-018)'
---

# Tasks: Platformer Bouncy Mushroom Blocks

**Input**: Design documents from `/specs/O-018-platformer-mushroom-blocks/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: MANDATORY. Constitution Principle II requires tests to be written and
reviewed **before** implementation, with the `{method}-{condition}-{expectedResult}`
naming convention (Vitest + React Testing Library + jsdom). Every test task below
must be written and confirmed failing (or failing to compile) before its paired
implementation task runs, **except** the tasks explicitly marked
**verification-only** (T021–T023, T038 and T039), which lock behavior already
implemented by an earlier task and therefore cannot fail-first; those MUST still
be written and passing before their phase's checkpoint. Do not skip a test task.

**Organization**: Tasks are grouped by user story so each story can be implemented
and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Every task names the exact file path it touches
- IDs are stable identifiers, not strictly phase-ordered: T031 sits in
  Foundational (the palette records are exhaustive `Record<TileChar, …>`, so the
  build needs those entries as soon as T004 lands), and T038/T039 were added by
  the analysis pass.

## Path Conventions

Single static web app. All work lands inside `src/themes/platformer/` plus
`docs/themes/platformer/`. Feature docs live in
`specs/O-018-platformer-mushroom-blocks/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the existing tileset so both the game and the editor can load it.

- [X] T001 [P] Register the mushroom tileset in `src/themes/platformer/entities/sprites/sheets.ts` — add `MUSHROOM_SHEET` (`src: '/sprites/mushroom.png'`, `frameWidth`/`frameHeight` = `TILE_SIZE`, `columns: 4`), documented as a loading-only registration following the `DECORATIONS_SHEET` convention (addresses by sx/sy, never by frame index). No new asset is added — the PNG already exists.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The two `TileType` members, their level characters, the exhaustiveness fix, the pure squash module, and the palette entries the exhaustive `TileChar` records require. These block every user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Add `'bouncyMushroom'` and `'decorativeMushroom'` to the `TileType` union in `src/themes/platformer/level/LevelData.ts`, each with the doc comment from contracts/mushroom-terrain.md (non-solid, non-climbable, one-way cap for the bouncy kind; no behaviour at all for the decorative kind).
- [X] T003 [P] Write failing character-mapping tests in `src/themes/platformer/level/LevelParser.test.ts` — `§` → `bouncyMushroom`, `s` → `decorativeMushroom` — and extend the hardcoded `tileChars` literal in the existing "every map key is in `TileChar`" sync test (`LevelParser.test.ts:583-586`) with `'§'` and `'s'`, because that test iterates the maps' keys and fails otherwise once T004 lands. Run them and confirm they fail before T004.
- [X] T004 Add `'§': 'bouncyMushroom'` (quoted key — `§` is not a valid JS identifier) and `s: 'decorativeMushroom'` to `TERRAIN_CHARS`, and `| '§' | 's'` to `TileChar`, in `src/themes/platformer/level/LevelParser.ts`. The module-load shared-character guard must still pass (neither key may appear in `ENTITY_CHARS`/`SIGN_CHARS`/`HAZARD_CHARS`). (depends on T003)
- [X] T005 Add `case 'bouncyMushroom':` and `case 'decorativeMushroom':` returning `null` (with a comment pointing at `drawTerrain`'s mushroom branch) to `tileSource` in `src/themes/platformer/engine/Renderer.ts`, so the `never` exhaustiveness check compiles after T002. (depends on T002)
- [X] T006 [P] Write failing unit tests in the new `src/themes/platformer/engine/MushroomSquash.test.ts` covering: start/replace (never two entries for one cell, input never mutated), advance/prune (drops exactly at `elapsed >= DURATION`, returns `[]` for empty input), the dip curve (`DIP` at `elapsed = 0`, `0` at/after `DURATION`, never negative), and `dt <= 0` leaving entries unchanged but still pruning expired ones.
- [X] T007 Create the pure `src/themes/platformer/engine/MushroomSquash.ts` module — `MushroomSquashState { col; row; elapsed }`, `MUSHROOM_SQUASH_DURATION_SECONDS = 0.1`, `MUSHROOM_SQUASH_DIP_PX = 2`, and `startMushroomSquash`, `advanceMushroomSquashes`, `mushroomSquashDip`, `mushroomSquashDipAt`, exactly as specified in contracts/mushroom-bounce.md. No DOM, no canvas. (depends on T006)
- [X] T031 [P] Add the `'§'` (complete-mushroom crop, `(0, 0)`) and `s` (small-mushroom crop, `(32, 0)`) entries — sprite specs, labels ("Bouncy Mushroom" / "Small Mushroom") and descriptions — to `PALETTE_TILE_SPRITES`, `PALETTE_TILE_LABELS` and `PALETTE_TILE_DESCRIPTIONS` in `src/themes/platformer/editor/paletteTiles.ts`, keyed by `TileChar` with `'§'` quoted. This is **Foundational, not US4**: all three are exhaustive `Record<TileChar, …>`, so the repo does not typecheck from T004 until these entries exist. (depends on T004)

**Checkpoint**: Foundation ready — the types, characters, squash math, palette entries and compiling switch exist; user stories can begin.

---

## Phase 3: User Story 1 - Bounce Off the Red Mushroom (Priority: P1) 🎯 MVP

**Goal**: A visible red mushroom the character passes through sideways and from below, but whose cap launches the character with a fixed ~5.5-tile super-jump on every downward landing, with a brief cosmetic cap dip.

**Independent Test**: Place one `§` mushroom, walk through it, jump up through it, then fall onto its cap — the first two pass through, the third launches the character, the cap dips and returns, and a second and third landing bounce identically with the mushroom unchanged. (quickstart.md §1)

### Tests for User Story 1 ⚠️

> Write these FIRST and confirm they fail before the matching implementation tasks.

- [X] T008 [P] [US1] Write failing `isStandableMushroomCap` tests in `src/themes/platformer/level/Terrain.test.ts` — `only`/`top` true with open sky above; a cap with a solid tile above false; `middle`/`bottom` false; a top-row cap true (out-of-bounds above is open); `decorativeMushroom`, `empty` and `groundGrass` false.
- [X] T009 [P] [US1] Write failing tests in `src/themes/platformer/engine/Physics.test.ts` — a falling player lands on an open-sky cap (`grounded`, feet snapped to the cap's top edge); a covered cap does not catch the player (falls through); side/underside contact is unaffected; `playerOnMushroomCap` returns `{col,row}` for a grounded player centred on an open-sky cap and `null` when airborne, off the cap's column, on a covered cap, or on a stem cell.
- [X] T010 [P] [US1] Write failing tests in `src/themes/platformer/engine/StaticObjectsCatalog.test.ts` — the four role entries (`only`/`top`/`middle`/`bottom`) map to the expected `sx`/`sy` crops, `mushroomHasCap` is true only for `only`/`top`, and `MUSHROOM_CAP_SOURCE_HEIGHT` stays within the 16px cell.
- [X] T011 [P] [US1] Write failing tests in `src/themes/platformer/engine/Renderer.test.ts` — the `bouncyMushroom` branch draws the cap-bearing roles as a stem sub-rect plus a cap sub-rect, an active squash shifts only the cap by `mushroomSquashDipAt`, a `middle`/`bottom` cell draws one whole role cell, and no mushroom sheet draws nothing while the rest of the terrain still renders.
- [X] T012 [P] [US1] Write failing tests in `src/themes/platformer/PlatformerState.test.ts` — `mushroomSquashStates` starts `[]`, `tickMushroomSquashes(dt)` advances and prunes it, and `resetGame()` (and therefore `resetGameProgress()`) clears it.
- [X] T013 [P] [US1] Write failing tests in `src/themes/platformer/PlatformerPage.test.tsx` — falling onto a cap sets `vy` to `PHYSICS_CONFIG.mushroomBounceVelocity` with `bounceAscending: true` and starts a squash; walking through the side/stem and rising through the cap do neither; a second landing bounces identically; a same-tick pot landing yields the single stronger (mushroom) impulse, never a sum; a death and Reset Game clear the squash.

### Implementation for User Story 1

- [X] T014 [P] [US1] Add `isStandableMushroomCap(level, col, row)` to `src/themes/platformer/level/Terrain.ts` exactly as in contracts/mushroom-terrain.md (top of run + cell above not `isSolid`, mirroring `isStandableLadderTop`); leave `isSolid`/`isSolidExcludingBridge`/`isClimbable` untouched. (depends on T002)
- [X] T015 [P] [US1] Add `mushroomBounceVelocity: -650` to `PHYSICS_CONFIG` in `src/themes/platformer/engine/PhysicsConfig.ts` with the super-jump rationale, peak-height and tunneling doc comment from contracts/mushroom-bounce.md.
- [X] T016 [US1] Add `MUSHROOM_CAP_SOURCE_HEIGHT = 11`, `MUSHROOM_ROLE_ENTRIES` (`only` (0,0), `top` (16,0), `middle` (48,0), `bottom` (48,16)), `mushroomEntry(role)` and `mushroomHasCap(role)` to `src/themes/platformer/engine/StaticObjectsCatalog.ts`. (depends on T010)
- [X] T017 [US1] Extend `drawTerrain` in `src/themes/platformer/engine/Renderer.ts` — add the trailing optional params `mushroom: HTMLImageElement | null = null` and `mushroomSquashes: readonly MushroomSquashState[] = []`, and add the `bouncyMushroom` branch **immediately after the torch branch and before the `chain` branch** (the `chain` branch is what sits directly before the generic `tileSource` lookup). The branch computes `verticalRunRole(level, col, row, 'bouncyMushroom')`, draws the stem/connector sub-rect unshifted and the cap sub-rect shifted down by `mushroomSquashDipAt(...)`, or the whole cell for `middle`/`bottom`. T028 later inserts the `decorativeMushroom` branch immediately before this one. (depends on T007, T011, T016)
- [X] T018 [US1] Add the cap ground term `isStandableMushroomCap(level, col, footRow)` to `columnIsGround` and the exported `playerOnMushroomCap(level, player)` query (grounded + centre-column + foot-row) to `src/themes/platformer/engine/Physics.ts`, exactly as in contracts/mushroom-bounce.md. No `PlayerState` field is added. (depends on T014)
- [X] T019 [US1] Add `mushroomSquashStates = signal<MushroomSquashState[]>([])`, `tickMushroomSquashes(dt)`, and `mushroomSquashStates.value = []` inside `resetGame()` in `src/themes/platformer/PlatformerState.ts`. (depends on T007)
- [X] T020 [US1] Wire `src/themes/platformer/PlatformerPage.tsx` — load `MUSHROOM_SHEET.src` into a `mushroomRef` (following `ropeLadderRef`), call `tickMushroomSquashes(dt)` in the `playing` branch beside `tickDeployableLadders(dt)`, hoist the block-bounce variable and fold in `playerOnMushroomCap` via `strongerBounce`, apply the single impulse to `next` with `bounceAscending: true`, start the squash, and pass `mushroomRef.current` + `mushroomSquashStates.value` as the new trailing `drawTerrain` arguments. (depends on T015, T017, T018, T019)

**Checkpoint**: User Story 1 is fully functional and independently testable — the MVP.

---

## Phase 4: User Story 2 - Build a Taller Mushroom from Cap and Stem Segments (Priority: P2)

**Goal**: A vertical run of `§` reads as one mushroom at any height — cap on top, straight stem in the middle, foot at the bottom — with only the top cap landable; the run survives save/reload.

**Independent Test**: Paint a run of three or more `§` cells, load the level, and verify the column renders as one mushroom, that the character passes through every stem cell, and that only the top cap is landable and bouncy. (quickstart.md §2)

> Note: the run-role art path is the shared `verticalRunRole` + `mushroomEntry` branch completed in T016/T017, and the one-way cap ground term is T018. This story's work is therefore **verification and documentation**: the tests below lock behavior US1 already implements, and T024 documents it.

### Verification Tests for User Story 2 (not fail-first) ⚠️

> **Constitution II exception (explicit, tracked):** T021–T023 verify behavior already implemented by US1's shared run path (T016/T017/T018). They cannot be written failing-first, so they are exempt from the fail-first rule and MUST instead be written and pass before T024. They stay [US2] so the taller-mushroom story keeps its own acceptance coverage.

- [X] T021 [P] [US2] (**verification-only**) Write tests in `src/themes/platformer/level/Terrain.test.ts` proving `verticalRunRole` classifies `bouncyMushroom` runs as `only` (1 cell), `top` (first of 2+), `middle` (interior), `bottom` (last), and that a lone cell is `only`.
- [X] T022 [P] [US2] (**verification-only**) Write tests in `src/themes/platformer/engine/Physics.test.ts` proving a fall onto any stem cell (top-adjacent, interior, or bottom) never grounds or bounces — only the run's top cap is one-way ground — and that the character is never stopped walking horizontally inside a run.
- [X] T023 [P] [US2] (**verification-only**) Write tests in `src/themes/platformer/engine/Renderer.test.ts` proving a multi-cell run draws the top cell as cap + connector, interior cells as a plain stem, the bottom cell as stem + foot, and a one-cell mushroom as the complete `only` crop.

### Implementation for User Story 2

- [X] T024 [US2] Update `docs/themes/platformer/Terrain.md` — add `bouncyMushroom`/`decorativeMushroom` to the `TileType` table, add `isStandableMushroomCap` beside `isStandableLadderTop` in the one-way/standable section (noting the centre-column bounce rule from FR-007), note the mushroom in the vertical-run-helpers section, record the cap squash as the only transient per-cell state, and record that the "terrain kinds do not own their own rules" gap stays open. Update `docs/themes/platformer/LevelFormat.md`'s terrain-character table with `§` → `bouncyMushroom` and `s` → `decorativeMushroom` plus behaviour notes. **While editing these two files, fix the pre-existing inaccuracies they already contain:** `Terrain.md`'s "Adding a tile" step 3 names `editor/LevelEditorPage.tsx` as the editor sheet loader (the actual loader is `editor/EditorCanvasPane.tsx`), and `LevelFormat.md` says `parseLevel` "throws" on an unknown character (it warns once and reads the cell as `empty`).

**Checkpoint**: A run of any height is verified to read as one mushroom and to behave as pass-through stems with a single landable cap.

---

## Phase 5: User Story 3 - Place the Small Decorative Mushroom (Priority: P3)

**Goal**: A small non-solid dressing mushroom that never blocks, never lands, never bounces and never changes state.

**Independent Test**: Place an `s` mushroom, walk into it, jump onto it from above, and jump into it from below — the character passes through or falls past it every time with no bounce, no stop and no reward. (quickstart.md §3)

### Tests for User Story 3 ⚠️

- [X] T025 [P] [US3] Write failing tests in `src/themes/platformer/engine/Renderer.test.ts` — `decorativeMushroom` draws the fixed `(32, 0)` cell at the tile's own destination, and no mushroom sheet draws nothing.
- [X] T026 [P] [US3] Write failing tests in `src/themes/platformer/engine/Physics.test.ts` — a player falling onto or walking into a `decorativeMushroom` is never grounded or blocked (it is not `isSolid`, not `isClimbable`, and never a ground term).
- [X] T027 [P] [US3] Write failing tests in `src/themes/platformer/PlatformerPage.test.tsx` — landing on or touching a `decorativeMushroom` changes no bounce, no squash and no game state.
- [X] T038 [P] [US3] (**verification-only** — mushrooms are non-solid by omission, so there is no implementation to precede) Write tests in `src/themes/platformer/engine/EnemyAI.test.ts` proving both mushroom kinds are non-solid to enemies (FR-014): an enemy patrolling toward a `bouncyMushroom` or `decorativeMushroom` cell never reverses as if it were a wall, and an enemy whose only "ground" below is a mushroom sees no ground and reverses at the ledge exactly as over a pit — so it never stands on a cap and is never bounced. Note the enemy AI is patrol-only (no vertical motion), so "fall through" is not reachable in the current engine; the test covers the walk-through and ledge/ground behaviour only. (covers US1's bouncy kind and US3's decorative kind)

### Implementation for User Story 3

- [X] T028 [US3] Add `MUSHROOM_DECORATIVE_ENTRY` (`{ sx: 32, sy: 0 }`) to `src/themes/platformer/engine/StaticObjectsCatalog.ts` and the `decorativeMushroom` draw branch to `drawTerrain` in `src/themes/platformer/engine/Renderer.ts` (draw the whole 16px cell at `destY`, before the `bouncyMushroom` branch). (depends on T025)

**Checkpoint**: Both mushroom kinds are visible and behave per their kind.

---

## Phase 6: User Story 4 - Author Both Mushrooms from the Editor Palette (Priority: P4)

**Goal**: Both mushrooms appear in the editor palette with a name, a description and a real-art preview; both paint, save and reload exactly like any other terrain character.

**Independent Test**: Open the editor, select each mushroom from the palette, paint a vertical `§` run, save, reload, and verify both tiles and the run persist and render correctly. (quickstart.md §4)

### Tests for User Story 4 ⚠️

- [X] T029 [P] [US4] (**verification-only** — its entries now land in Foundational's T031, so it cannot fail-first) Write tests in `src/themes/platformer/editor/paletteTiles.test.ts` — `§` and `s` have sprite specs (`/sprites/mushroom.png`, 64×64, crops `(0,0)` and `(32,0)`), labels ("Bouncy Mushroom" / "Small Mushroom") and non-empty descriptions.
- [X] T030 [P] [US4] Write failing tests in `src/themes/platformer/editor/Palette.test.tsx` — `§` renders in the **Terrain** group and `s` in the **Decoration** group.
- [X] T039 [P] [US4] (**verification-only**) Write tests proving `§`/`s` round-trip through the editor's save/load path: `importLayout(exportLayout(grid))` preserves mushroom cells including a vertical `§` run, and `parseLevel(exportLayout(grid))` resolves them to `bouncyMushroom`/`decorativeMushroom` with no unknown-character warning. Put them in `src/themes/platformer/editor/importLayout.test.ts` / `exportLayout.test.ts` (or `level/LevelParser.test.ts` if the existing round-trip helpers live there). (FR-017, SC-006)

### Implementation for User Story 4

- [X] T032 [US4] Add `'s'` to `DECORATION_CHARS` in `src/themes/platformer/editor/Palette.tsx` so the decorative mushroom lands in the Decoration group (`§` falls into Terrain automatically). No `toolKeys` change. (depends on T030)
- [X] T033 [US4] Add `mushroom: HTMLImageElement | null` to `EditorImages` in `src/themes/platformer/editor/EditorCanvas.tsx`, pass `images.mushroom` as the new trailing `drawTerrain` argument, add `mushroom: null` to the `EMPTY_IMAGES` fixture in `src/themes/platformer/editor/EditorCanvas.test.tsx`, and extend the three exact-argument `toHaveBeenCalledWith(drawTerrain, …)` assertions in that test (the "both the tileset and the ground atlas" case plus the `staticObjectsLoaded`/`torchLoaded` pass-through cases) with the new trailing argument — `toHaveBeenCalledWith` requires an exact argument-count match, so they fail otherwise. (depends on T017)
- [X] T034 [US4] Add `mushroom: null` to `EMPTY_IMAGES` and `{ key: 'mushroom', src: MUSHROOM_SHEET.src }` to `IMAGE_SOURCES` in `src/themes/platformer/editor/EditorCanvasPane.tsx`. (depends on T001)

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Feature-completion bookkeeping and end-to-end validation.

- [X] T035 [P] Update `docs/Features.md` — prefix the `O018` node label with `✅ ` and add `class O018 done` alongside `class O018 themes` (per AGENTS.md). Only do this once implementation **and** tests are fully done.
- [X] T036 Run `npm test`, `npm run lint` and `npm run build` from the repo root and fix any failures.
- [x] T037 Run the manual browser verification in `specs/O-018-platformer-mushroom-blocks/quickstart.md` (`npm run dev`, `/platformer` + `/platformer/editor`), including the edge cases in §5 (covered cap, mid-dip re-landing, cross-source bounce aggregation, death/respawn, enemy pass-through, shipped level regression).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup for T001; **BLOCKS all user stories**.
- **User Stories (Phases 3–6)**: All depend on Foundational completion. US1 is the MVP; US2, US3 and US4 build on the shared rendering path but remain independently testable.
- **Polish (Phase 7)**: Depends on every desired story being complete (T035 additionally requires T036/T037 to have passed).

### User Story Dependencies

- **US1 (P1)**: After Foundational. No dependency on other stories.
- **US2 (P2)**: After Foundational. Its verification tests reuse the T016/T017/T018 run path and are independent of US3/US4; it adds only the T024 documentation.
- **US3 (P3)**: After Foundational. Adds the `decorativeMushroom` branch and the enemy pass-through verification (T038); independent of US2/US4.
- **US4 (P4)**: After Foundational (which now owns the palette entries, T031) and after US1's T017 (`drawTerrain` signature, needed by T033). Its tests are T029/T030/T039; its implementation is T032/T033/T034.

### Within Each User Story

- Test tasks MUST be written and confirmed failing before the paired implementation task, **except** the verification-only tasks (T021–T023, T038, T039), which are written after the behavior they lock and must pass by their phase's checkpoint.
- Predicate/constants before physics wiring; pure module before state before page wiring; catalog before renderer branch.
- `PlatformerPage.tsx` wiring (T020) is last in US1 because it consumes the predicate, the constant, the query, the signal and the draw branch.

### Parallel Opportunities

- T001 is independent of everything else in Setup.
- Within Foundational, T003 (LevelParser test) and T006 (MushroomSquash test) touch different files and can run together; T002 must precede T005; T031 is `[P]` once T004 lands (it edits a different file).
- Within US1, all test tasks T008–T013 touch different files and can run in parallel; implementation tasks T014, T015, T016 and T019 are `[P]` (distinct files).
- Within US2, T021–T023 touch three different test files and can run in parallel (verification-only).
- Within US3, T025–T027 and T038 touch four different test files and can run in parallel.
- Within US4, T029/T030/T039 are `[P]`; T032/T033/T034 touch different editor files.

---

## Parallel Example: User Story 1 Tests

```bash
# Launch every US1 test task together (different files):
Task: "T008 isStandableMushroomCap tests in src/themes/platformer/level/Terrain.test.ts"
Task: "T009 cap ground + playerOnMushroomCap tests in src/themes/platformer/engine/Physics.test.ts"
Task: "T010 mushroom role-rect tests in src/themes/platformer/engine/StaticObjectsCatalog.test.ts"
Task: "T011 mushroom draw-branch tests in src/themes/platformer/engine/Renderer.test.ts"
Task: "T012 squash signal lifetime tests in src/themes/platformer/PlatformerState.test.ts"
Task: "T013 bounce integration tests in src/themes/platformer/PlatformerPage.test.tsx"
```

## Parallel Example: User Story 1 Implementation

```bash
# Independent files, no shared edits:
Task: "T014 isStandableMushroomCap in src/themes/platformer/level/Terrain.ts"
Task: "T015 mushroomBounceVelocity in src/themes/platformer/engine/PhysicsConfig.ts"
Task: "T016 mushroom role rects in src/themes/platformer/engine/StaticObjectsCatalog.ts"
Task: "T019 squash signal/tick/reset in src/themes/platformer/PlatformerState.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1) — tests first, then implementation.
3. **STOP and VALIDATE**: run the T008–T013 tests, then quickstart.md §1 in the browser.
4. Deploy/demo the bounce as the MVP.

### Incremental Delivery

1. Setup + Foundational → types, characters, palette entries, squash module, compiling switch.
2. US1 → bounce + visible mushroom + dip → test → demo (MVP).
3. US2 → taller runs verified + documented → test → demo.
4. US3 → decorative mushroom → test → demo.
5. US4 → palette authoring + previews → test → demo.
6. Polish → feature-completion tracking and full regression.

### Parallel Team Strategy

With multiple developers after Foundational:

- Developer A: US1 (MVP) — highest priority, largest.
- Developer B: US2 tests/docs once T016/T017 exist.
- Developer C: US3 decorative branch.
- Developer D: US4 palette/editor plumbing.

---

## Notes

- `[P]` tasks touch different files with no dependency on an incomplete task.
- The story label maps each task to its user story for traceability.
- Each user story is independently completable and testable; stop at any checkpoint to validate.
- The mushroom is never solid, never climbable, never destructible and never awards anything — no task should introduce per-tile state beyond the transient squash list.
- Reuse `verticalRunRole`, `strongerBounce` and the existing one-way-terrain pattern; do not introduce a terrain-kind registry (research D1).
- No new runtime dependency and no new image asset — `public/sprites/mushroom.png` already exists.
- **Verification-only tasks** (T021–T023, T038, T039) are the documented Constitution II exception: they lock behavior an earlier task implements and therefore cannot be written failing-first. They must still be written and passing before their phase's checkpoint.
- Enemy AI is patrol-only (no vertical motion), so FR-014's "fall through" is not reachable in the current engine; T038 verifies the non-solid walk-through and the no-ground/ledge behaviour instead.
