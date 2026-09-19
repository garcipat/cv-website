---
description: 'Task list for Platformer Cave Lighting (O-010)'
---

# Tasks: Platformer Cave Lighting

**Input**: Design documents from `/specs/O-010-platformer-cave-lighting/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: TDD is **mandatory** for this feature (constitution Principle II; plan.md Testing gate; quickstart.md "Automated coverage expected"). Every story therefore lists its tests before its implementation, and each test task must be written and observed to **fail** before the implementation task that satisfies it.

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P4) so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story the task belongs to (`[US1]`–`[US4]`)
- Every task names its exact file path

## Path Conventions

Single static web app. All source paths are relative to the repository root and live under `src/themes/platformer/`. Spec artifacts live under `specs/O-010-platformer-cave-lighting/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean baseline and that the feature needs no new tooling or dependency.

- [ ] T001 Run `npm test` and confirm the existing suite is green before any O-010 change (baseline for the TDD red/green cycle).
- [ ] T002 [P] Confirm no new runtime dependency is needed: inspect `package.json` / `vite.config.ts` and verify Vitest + React Testing Library + jsdom are already configured (plan.md "No new runtime dependency"). No code change.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The typed piece-family surface and the complete pure lighting module. Every user story consumes these, so this phase MUST finish first.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 [P] Extend `src/themes/platformer/engine/BackgroundCatalog.test.ts` with family assertions: every `dirt*` entry is `'surface'`, every `charcoal*` entry is `'cave'`, and `backgroundPieceFamily('notARealPieceId')` returns `undefined` instead of throwing. Update the `EXPECTED_ENTRIES` fixtures to include `family` so the pixel-rect test stays exact.
- [ ] T004 Add the `BackgroundPieceFamily` union (`'surface' | 'cave'`) to `src/themes/platformer/level/LevelData.ts`, add `family: BackgroundPieceFamily` to `BackgroundCatalogEntry` and to all ten `BACKGROUND_CATALOG` entries (`dirt → 'surface'`, `charcoal → 'cave'`), and export `backgroundPieceFamily(pieceId)` in `src/themes/platformer/engine/BackgroundCatalog.ts` (returns `undefined` for an unknown id, mirroring `backgroundCatalogEntry`). Satisfies FR-001/FR-021 and contracts/editor-palette.md.
- [ ] T005 [P] Create `src/themes/platformer/engine/Lighting.test.ts` covering every invariant in contracts/lighting.md: fade easing/clamping/`dt<=0`/`fadeSeconds<=0`, full-brightness no-op, cave-footprint `isCellDarkening` true/false, surface-only false, overlap-never-compounds, unknown piece id ignored, `playerOccupiedCell` bottom-centre maths, `torchPulseScale` bounds, `torchGlowStrengthAt` centre-to-zero smooth falloff, `localDarknessAt` max-combine (not sum) and empty-torch identity, `enemyEyeOpacity` threshold/fade/clamp, and positive-integer `ENEMY_EYE_SIZE_PX`/`ENEMY_EYE_GAP_PX`. Use `{method}-{condition}-{expectedResult}` kebab-case names.
- [ ] T006 Create `src/themes/platformer/engine/Lighting.ts` as a pure, canvas-free, DOM-free module: re-export/import `BackgroundPieceFamily`, declare `Cell`/`Point`/`TorchLight`, export `MAX_DARKNESS`, `DARKNESS_FADE_SECONDS`, `TORCH_LIGHT_RADIUS_PX`, `TORCH_PULSE_AMPLITUDE`, `TORCH_GLOW_COLOR`, `ENEMY_EYE_DARKNESS_THRESHOLD`, `ENEMY_EYE_FADE_RANGE`, `ENEMY_EYE_COLOR`, `ENEMY_EYE_SIZE_PX`, `ENEMY_EYE_GAP_PX`, and implement `nextDarknessLevel`, `isCellDarkening`, `playerOccupiedCell`, `torchPulseScale`, `torchGlowStrengthAt`, `localDarknessAt`, `enemyEyeOpacity` exactly per contracts/lighting.md (reuse `torchPhase`/`TORCH_FRAME_DURATION_SECONDS`/`TORCH_FRAME_COUNT` from `engine/Torch.ts`, `PLAYER_RENDERED_SIZE`/`PLAYER_FOOT_PADDING` from `entities/Player.ts`, and `RENDERED_TILE_SIZE` from `level/Terrain.ts`). Depends on T004, T005.

**Checkpoint**: `npm test` green for the catalog + lighting modules — all four user stories can now proceed.

---

## Phase 3: User Story 1 - Entering a cave darkens the view, leaving it brightens again (Priority: P1) 🎯 MVP

**Goal**: The single cell under the player's feet drives a smoothly eased darkness overlay over the world, with zero darkening at full brightness.

**Independent Test**: In a level with a cave-family background area beside open ground, walk the player in and out and observe the view dim/brighten gradually over ~0.4 s; walk in a level with no cave pieces and the view never darkens.

### Tests for User Story 1 (write first, observe them fail) ⚠️

- [ ] T007 [P] [US1] Add `src/themes/platformer/PlatformerState.test.ts` tests for the darkness state: `darknessLevel` starts at `0`; `tickDarkness(dt)` rises toward `MAX_DARKNESS` while the player's foot cell is covered by a cave background placement and returns toward `0` off it (use `currentBackground.value` / `playerState.value` to arrange); `resetGame()` sets `darknessLevel` back to `0`. Covers FR-002/FR-003/FR-004/FR-007 and the respawn-reset invariant in data-model.md.
- [ ] T008 [P] [US1] Add `src/themes/platformer/engine/Renderer.test.ts` tests for `drawDarkness`: at `darknessLevel <= 0` it draws nothing at all (no `fillRect`, no `drawImage` of the layer); above `0` it fills the offscreen layer with `rgba(0, 0, 0, darknessLevel)` and composites the layer onto the main context with `source-over`. Covers FR-005/FR-006 and research D10 (SC-005 full-brightness fast path).

### Implementation for User Story 1

- [ ] T009 [US1] Add a module-level `darknessLevel` signal plus an exported `tickDarkness(dt)` to `src/themes/platformer/PlatformerState.ts`: compute `target = isCellDarkening(currentLevel.value.background ?? [], playerOccupiedCell(playerState.value).col, .row) ? MAX_DARKNESS : 0` and set `darknessLevel.value = nextDarknessLevel(darknessLevel.value, target, dt, DARKNESS_FADE_SECONDS)`; reset it to `0` inside `resetGame()`. Import `currentLevel` from `./level/level` and the helpers from `./engine/Lighting`. Depends on T006, T007.
- [ ] T010 [US1] Add `drawDarkness(ctx, layer, canvasWidth, canvasHeight, darknessLevel, torches, originX, originY, worldElapsed)` to `src/themes/platformer/engine/Renderer.ts` implementing only the darkness half of contracts/rendering.md: return immediately when `darknessLevel <= 0`; otherwise clear `layer`, fill it with `rgba(0, 0, 0, darknessLevel)`, and composite it onto `ctx` with `source-over` (the `torches` branch is added in US2). Keep it the only module that maps world to canvas coordinates and restore any context state it changes. Depends on T008.
- [ ] T011 [US1] Wire the overlay into `src/themes/platformer/PlatformerPage.tsx`: create a reusable offscreen canvas (`document.createElement('canvas')`) held in a ref, size it in `resize()` alongside the main canvas, call `tickDarkness(dt)` in the `playing` branch of the game-loop callback (right after `worldAnimElapsed += dt`), and call `drawDarkness(...)` immediately **after** `drawWaterForeground(...)` and **before** the hint tooltip, passing `[]` for torches. This keeps darkness off the HUD/UI (FR-006) and freezing with the world during pause/death (research D8). Depends on T009, T010.

**Checkpoint**: US1 is fully functional and independently testable — the MVP.

---

## Phase 4: User Story 2 - Torches light the cave (Priority: P2)

**Goal**: Every `torch` tile punches a warm, soft, mildly pulsing radial pool back through the darkness, anchored to its world position.

**Independent Test**: Stand the player in a dark cave with a torch on screen and confirm a warm circular pool that is clear near the flame and fades into the surrounding darkness; two torches combine cleanly; the pool scrolls with the camera; a torch-free dark area stays dark but faintly readable.

### Tests for User Story 2 (write first, observe them fail) ⚠️

- [ ] T012 [P] [US2] Add `src/themes/platformer/level/LevelParser.test.ts` tests for `findTorchTiles`: it finds every `¥` cell in reading order, returns `[]` for a layout with none, and does not match other characters (mirror the shape of the existing finder tests). Covers research D4.
- [ ] T013 [P] [US2] Add `src/themes/platformer/level/level.test.ts` tests for the new `TORCH_TILES` computed: it is derived from `currentLayout`'s `¥` markers and recomputes when `currentLayout` changes (restore the original layout in a `finally`/`afterEach`).
- [ ] T014 [P] [US2] Add `src/themes/platformer/PlatformerState.test.ts` tests for `torchPositions`: each `torch` tile maps to its world-space centre via `tileToPixel`, and an empty level yields `[]`. Covers FR-012 and data-model.md's `TorchLightSource`.
- [ ] T015 [P] [US2] Add `src/themes/platformer/engine/Renderer.test.ts` tests for the torch branch of `drawDarkness`: one `destination-out` radial hole is erased per visible torch at its screen position, a `lighter` warm gradient is painted per torch, torches outside the viewport contribute nothing, and the changed `globalCompositeOperation` is restored. Covers FR-008/FR-009/FR-010/FR-011/FR-012/FR-013/FR-014 and research D1.

### Implementation for User Story 2

- [ ] T016 [US2] Add `findTorchTiles(layout)` to `src/themes/platformer/level/LevelParser.ts`, scanning `TERRAIN_CHARS` for `'torch'` in reading order — a direct terrain scan like the sign finder, NOT the `ENTITY_CHARS`/`findAllOfKind` path `findCoinTiles` uses — placed next to the other terrain finders. Depends on T012.
- [ ] T017 [US2] Add the `TORCH_TILES` computed to `src/themes/platformer/level/level.ts` (`computed(() => findTorchTiles(currentLayout.value))`), documented in the same style as `SIGN_TILES`/`HAZARD_TILES`. Depends on T016.
- [ ] T018 [US2] Add the `torchPositions` computed to `src/themes/platformer/PlatformerState.ts`, mapping each `TORCH_TILES` cell through `tileToPixel` into a `TorchLight` (`{ col, row, x, y }`). Depends on T017.
- [ ] T019 [US2] Implement the torch half of `drawDarkness` in `src/themes/platformer/engine/Renderer.ts` per contracts/rendering.md and research D1/D6: for each on/near-screen torch, erase a soft `destination-out` radial hole at its screen position (radius `TORCH_LIGHT_RADIUS_PX × torchPulseScale`), then paint a smaller additive (`lighter`) `TORCH_GLOW_COLOR` gradient whose radius stays inside the hole and whose alpha scales with `darknessLevel`; use `createRadialGradient` (no hard-edged `arc` fill) so the falloff is smooth. Depends on T015, T018.
- [ ] T020 [US2] Pass `torchPositions.value` (and `worldAnimElapsed`) into the `drawDarkness(...)` call in `src/themes/platformer/PlatformerPage.tsx`. Depends on T019.

**Checkpoint**: US1 + US2 both work independently — caves are dark and lit by torch pools.

---

## Phase 5: User Story 3 - Enemies are revealed as glowing yellow eyes in the dark (Priority: P3)

**Goal**: Every living enemy whose own position is dark shows a small pair of glowing yellow eyes drawn through the darkness; the marker fades out as that spot is lit.

**Independent Test**: Place a living enemy in a dark cave with no torch and confirm a pair of yellow eyes; move light over it and confirm the eyes disappear and the normal sprite returns; defeat it and confirm no eyes.

### Tests for User Story 3 (write first, observe them fail) ⚠️

- [ ] T021 [P] [US3] Add `src/themes/platformer/engine/Renderer.test.ts` tests for `drawEnemyEyes`: it draws nothing at `darknessLevel <= 0`; it draws two yellow squares for a living enemy in darkness; it draws nothing for an enemy with `alive === false`; and it draws nothing for an enemy inside a torch's light pool (`localDarknessAt <= ENEMY_EYE_DARKNESS_THRESHOLD`). Covers FR-015/FR-016/FR-017/FR-018/FR-019.

### Implementation for User Story 3

- [ ] T022 [US3] Add `drawEnemyEyes(ctx, enemies, darknessLevel, torches, worldElapsed, originX, originY)` to `src/themes/platformer/engine/Renderer.ts` per contracts/rendering.md and research D7: return immediately when `darknessLevel <= 0`; for each `alive` enemy compute the local darkness at its own anchor (`enemyEffectAnchor`/`typeOf(enemy).box`) and `enemyEyeOpacity(localDarkness)`; skip when the opacity is `<= 0`; otherwise draw two small integer-aligned `ENEMY_EYE_COLOR` squares of `ENEMY_EYE_SIZE_PX` near the top of the collision box, separated by `ENEMY_EYE_GAP_PX` and symmetric about its centre, at that opacity, with `globalAlpha` restored afterwards. Depends on T021.
- [ ] T023 [US3] Call `drawEnemyEyes(...)` in `src/themes/platformer/PlatformerPage.tsx` immediately after `drawDarkness(...)` (so the eyes stay visible through the overlay) and before the hint tooltip, passing `enemyStates.value`, `darknessLevel.value`, `torchPositions.value`, `worldAnimElapsed`, and the origin. Depends on T022.

**Checkpoint**: All three player-facing stories work independently.

---

## Phase 6: User Story 4 - Level authors can tell cave pieces from surface pieces (Priority: P4)

**Goal**: The background palette is split into labelled Surface and Cave sections driven by the catalog family, with torches still available as a decorative tile.

**Independent Test**: Open the editor's background palette and confirm Surface and Cave sections; place a cave piece and confirm the area darkens in play; place a surface piece and confirm it does not; confirm the Torch tile is still in the foreground Decoration group.

### Tests for User Story 4 (write first, observe them fail) ⚠️

- [ ] T024 [P] [US4] Add `src/themes/platformer/editor/backgroundPaletteTiles.test.ts` tests for `BACKGROUND_PALETTE_SECTIONS`: membership is total and disjoint over `BACKGROUND_CATALOG`; the `Surface` section holds every `dirt*` piece and no `charcoal*` piece; the `Cave` section holds every `charcoal*` piece and no `dirt*` piece; section order is stable. Covers FR-020/FR-021 and contracts/editor-palette.md.
- [ ] T025 [P] [US4] Add `src/themes/platformer/editor/Palette.test.tsx` tests for the background layer: it renders both a `Surface` and a `Cave` heading; every `dirt*` piece button sits inside the Surface section and every `charcoal*` piece inside Cave; clicking a piece in either section still calls `onSelectBackgroundPiece(pieceId)`; and the foreground Decoration group still contains the `¥` Torch tile (FR-022). Covers FR-020/FR-022 and contracts/editor-palette.md.

### Implementation for User Story 4

- [ ] T026 [US4] Add `BackgroundPaletteSection` (`{ title: string; pieceIds: BackgroundPieceId[] }`) and the exported `BACKGROUND_PALETTE_SECTIONS` list (`Surface` = dirt ids, `Cave` = charcoal ids, derived from `backgroundPieceFamily` with a stable literal order) to `src/themes/platformer/editor/backgroundPaletteTiles.ts`. Depends on T004, T024.
- [ ] T027 [US4] Replace the background layer's flat grid in `src/themes/platformer/editor/Palette.tsx` with one `PaletteGroup` per `BACKGROUND_PALETTE_SECTIONS` entry, keeping the existing `PaletteTile` labels, sprites, selection state and `onSelectBackgroundPiece` click behaviour (remove the now-unused `BACKGROUND_PIECE_IDS` if nothing else reads it). The foreground Decoration group keeps the `¥` Torch tile unchanged (FR-022). Depends on T026.

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification and tracking that span every story.

- [ ] T028 [P] Update `docs/Features.md` for O-010 in all three places per the repository convention: the feature-list bullet (`- [ ]` → `- [x]`), the Implementation Status table row (`📋 Planned`/`❌`/`❌` → `✅ Done`/`✅`/`✅`), and the dependency-diagram node (prefix `✅ ` and add `class O010 done`). Only do this once implementation **and** tests are fully done.
- [ ] T029 Run `npm test` and `npm run build` (which runs `tsc -b`) and resolve any failures, type errors, or lint errors across the touched files (`src/themes/platformer/**`). Confirms the full-brightness regression suite (SC-005) and strict-TypeScript compliance.
- [ ] T030 Walk `specs/O-010-platformer-cave-lighting/quickstart.md` end to end against `npm run dev` — darkness enter/exit, torch pools/pulse/anchoring, enemy eyes, palette sections, and the freeze/UI/regression checks (FR-006, SC-003, SC-005, SC-007).
- [ ] T031 Performance spot-check (SC-006): author a cave with several torches and several enemies on screen and confirm a smooth frame rate with no perceptible stutter; if needed, confirm torch culling keeps the overlay at O(visible torches).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup; **blocks all user stories**.
- **User Stories (Phases 3–6)**: All depend on Foundational completion.
  - US1 (P1) → US2 (P2) → US3 (P3) → US4 (P4) is the recommended sequential order because US1–US3 all edit `engine/Renderer.ts` and `PlatformerPage.tsx` (shared files, no parallel edits).
  - US4 is independent of US1–US3 (it only needs the Foundational family work) and can be done in parallel with the render stories by a second developer.
- **Polish (Phase 7)**: Depends on all desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: Needs Foundational only. No dependency on other stories. **MVP.**
- **US2 (P2)**: Needs Foundational; builds on US1's `drawDarkness` pass and `PlatformerPage.tsx` wiring.
- **US3 (P3)**: Needs Foundational; builds on US2's `torchPositions` (for local darkness) and `PlatformerPage.tsx` wiring.
- **US4 (P4)**: Needs Foundational only (`BackgroundPieceFamily`); independent of US1–US3.

### Within Each User Story

- Tests MUST be written and observed to **fail** before the matching implementation task.
- Pure module → state → render pass → page wiring, in that order.
- Each story is complete and testable before the next priority begins.

### Parallel Opportunities

- T002 can run alongside T001.
- T003 and T005 are different test files — can run in parallel; T004 follows T003, T006 follows T004+T005.
- Within US1, T007 and T008 (different test files) can run in parallel.
- Within US2, T012–T015 (four different test files) can run in parallel.
- Within US4, T024 and T025 (different test files) can run in parallel.
- US4 can be developed in parallel with US1–US3 (no shared files).
- T028 (docs) can run alongside T029–T031 once the code is frozen.

---

## Parallel Example: User Story 2

```bash
# Author all four US2 test files together (they must fail first):
Task: "findTorchTiles tests in src/themes/platformer/level/LevelParser.test.ts"
Task: "TORCH_TILES tests in src/themes/platformer/level/level.test.ts"
Task: "torchPositions tests in src/themes/platformer/PlatformerState.test.ts"
Task: "drawDarkness torch-branch tests in src/themes/platformer/engine/Renderer.test.ts"
```

## Parallel Example: User Story 4

```bash
# Author both US4 test files together (they must fail first):
Task: "BACKGROUND_PALETTE_SECTIONS tests in src/themes/platformer/editor/backgroundPaletteTiles.test.ts"
Task: "Surface/Cave section tests in src/themes/platformer/editor/Palette.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (catalog family + full pure `Lighting.ts`).
3. Complete Phase 3: US1 (darkness state, overlay pass, page wiring).
4. **STOP and VALIDATE**: run `npm test` and the quickstart's section 1 — the view dims/brightens with no snap and never darkens without cave pieces.
5. This alone is a shippable increment.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → validate → MVP (cave mood).
3. US2 → validate → torch light pools make caves playable.
4. US3 → validate → enemies stay fair in the dark.
5. US4 → validate → authors can tell surface from cave.
6. Polish → tracking, full suite/build, quickstart, performance.

### Notes

- No new runtime dependency and no new image asset are introduced (plan.md); the eyes are drawn primitives.
- The full-brightness fast path (draw nothing at `darknessLevel <= 0`) is what guarantees SC-005 by construction — keep it in every new pass.
- `Renderer.ts` remains the only module mapping world coordinates to canvas coordinates; `Lighting.ts` stays pure and canvas-free so it is unit-testable without a DOM.
- Follow `{method}-{condition}-{expectedResult}` test naming and the `// Arrange / // Act / // Assert` structure from `docs/TestingGuide.md`.
- Never commit unless the user explicitly asks.

## Next Steps

- `/speckit.analyze` — run a consistency check across spec, plan, and tasks.
- `/speckit.implement` — execute the tasks phase by phase.
