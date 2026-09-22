---
description: 'Task list for the Ambient Background Clouds feature'
---

# Tasks: Ambient Background Clouds

**Input**: Design documents from `/specs/O-022-ambient-clouds/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (`ambient-clouds.md`, `rendering.md`), quickstart.md

**Tests**: Included and written FIRST. TDD is mandatory for this project
(constitution Principle II; plan.md "TDD is mandatory"). Every `[US*]` phase opens
with test tasks that must fail before that phase's implementation tasks run.
Test names use the repo's `{method}-{condition}-{expectedResult}` convention
(docs/TestingGuide.md).

**Organization**: Tasks are grouped by user story so each story can be implemented,
tested and demonstrated independently. All work lands inside the existing
`src/themes/platformer/` tree.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in every description

## Path Conventions

Single static web app. All paths are repository-relative; all feature code lives
under `src/themes/platformer/`. The only asset touched is the existing
`public/sprites/ambient_clouds.png`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the authored cloud sheet so it can be loaded through the
existing sprite-loading convention.

- [x] T001 [P] Register `AMBIENT_CLOUDS_SHEET` for `/sprites/ambient_clouds.png` (`frameWidth: 185`, `frameHeight: 32`, `columns: 1`) in `src/themes/platformer/entities/sprites/sheets.ts`, as a loading-only registration mirroring the `BACKGROUND_LAYERS_SHEET` doc comment (the sheet is addressed by `AMBIENT_CLOUD_SOURCE_RECTS`, not by frame index).
- [x] T002 [P] Confirm the authored sheet at `public/sprites/ambient_clouds.png` is 185x32 and that its four opaque shapes match research D3: `(0,16,33,16)`, `(41,12,43,20)`, `(92,12,43,20)`, `(143,0,42,32)`, all bottom-aligned at sheet row 31. If a shape's bounds differ, correct the `AMBIENT_CLOUD_SOURCE_RECTS` values in T007 rather than regenerating the art.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract the backdrop band geometry so the sky region has one source of
truth. Every user story derives its `skyTop`/`openSkyBottom` from it.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Add `backgroundBandGeometry` tests to `src/themes/platformer/engine/BackgroundLayers.test.ts` (write first; expect failure). Assert the helper returns `skyTop = SKY_TOP_MARGIN * BACKGROUND_RENDER_SCALE`, `skyBottom = skyTop + SKY_SOURCE_RECT.height * BACKGROUND_RENDER_SCALE`, `cloudsTop = villageTop - CLOUDS_SOURCE_RECT.height * BACKGROUND_RENDER_SCALE - CLOUDS_VILLAGE_GAP * BACKGROUND_RENDER_SCALE`, plus `cloudsBottom`/`villageTop`/`villageBottom`, and that those values equal the `dy`/fill values `drawBackgroundLayers` already draws for the same `canvasHeight`. Name cases `{method}-{condition}-{expectedResult}`.
- [x] T004 Add the exported `BackgroundBandGeometry` interface and a pure `backgroundBandGeometry(canvasHeight)` function to `src/themes/platformer/engine/BackgroundLayers.ts`, then refactor `drawBackgroundLayers` to consume it without changing any drawn y value (depends on T003). Re-run the existing `BackgroundLayers.test.ts` cases and confirm they stay green.

**Checkpoint**: `backgroundBandGeometry` is the single source of truth for the band edges; all existing backdrop assertions remain green.

---

## Phase 3: User Story 1 - Clouds That Drift While The Player Stands Still (Priority: P1) — MVP

**Goal**: A handful of soft clouds drift right-to-left across the open sky at their
own speeds and heights, mostly independent of the camera (with a small parallax), drawn behind everything at the
backdrop's uniform scale; the population scales with the play area's width.

**Independent Test**: Open the platformer, stand still for several seconds, and watch
the sky. Clouds change horizontal position over time, at least two move at visibly
different speeds and heights, and none of that motion requires player movement.
Widening the window shows proportionally more clouds.

### Tests for User Story 1 (write first, expect failure)

- [x] T005 [P] [US1] Create `src/themes/platformer/engine/AmbientClouds.test.ts` covering: `cloudPopulationFor` is monotonically non-decreasing in width and never below `MIN_CLOUD_COUNT`; `createCloudField` builds exactly `cloudPopulationFor(width)` clouds, each with a distinct `lane` and a speed in `[CLOUD_MIN_SPEED_PX_PER_SEC, CLOUD_MAX_SPEED_PX_PER_SEC]`; at least three distinct speeds and three distinct `y` values appear at the default population; `stepCloudField(field, dt)` (no camera argument) decreases every `x`; `drawAmbientClouds` records `Math.round(cloud.x)` as dest x and `shape.width * BACKGROUND_RENDER_SCALE` as dest width; a cloud wider than the play area is still drawn at its full scaled size (clipped by the canvas, never resized). Name cases `{method}-{condition}-{expectedResult}`.
- [x] T006 [P] [US1] Add an integration test in `src/themes/platformer/PlatformerPage.test.tsx` asserting that while the game is `playing` the ambient layer is drawn (a `drawImage` call whose source image is the loaded `ambient_clouds.png`) and that its draws continue across successive ticks while the player stands still. Also assert that a resize (`window.innerWidth` change + `fireEvent(window, new Event('resize'))`) rebuilds the field at the new play-area width so the draw count follows `cloudPopulationFor`.

### Implementation for User Story 1

- [x] T007 [US1] Create `src/themes/platformer/engine/AmbientClouds.ts`: declare the `CloudSourceRect`, `AmbientCloud` and `CloudField` interfaces (per `contracts/ambient-clouds.md`), export `AMBIENT_CLOUD_SOURCE_RECTS` (the four D3 rects, verified in T002), `MIN_SHAPE_HEIGHT` (derived as the minimum source-rect height), and the constants `CLOUD_SPACING_PX`, `MIN_CLOUD_COUNT`, `CLOUD_MIN_SPEED_PX_PER_SEC`, `CLOUD_MAX_SPEED_PX_PER_SEC`, `CLOUD_RESPAWN_JITTER_PX`, `AMBIENT_CLOUD_SEED`, `AMBIENT_CLOUD_PARALLAX_FACTOR`. Implement `cloudPopulationFor(playAreaWidth)`, `createCloudField(playAreaWidth, skyTop, openSkyBottom, seed?)`, `stepCloudField(field, dtSeconds)` and `drawAmbientClouds(ctx, image, field, cameraX)`. Each cloud gets its own lane and a distinct speed; `stepCloudField` moves every `x -= speed * dtSeconds` (right to left) and recycles a cloud fully past the left edge back to the right edge; `drawAmbientClouds` sets `ctx.imageSmoothingEnabled = false`, shifts dest x left by `cameraX * AMBIENT_CLOUD_PARALLAX_FACTOR` (the painted clouds/hills band's factor), rounds it, and reuses `BACKGROUND_RENDER_SCALE` from `./BackgroundLayers`.
- [x] T008 [P] [US1] Add an `ambientCloudsRef` and `loadImage(AMBIENT_CLOUDS_SHEET.src).then((img) => { ambientCloudsRef.current = img; render(); }).catch(() => {})` to `src/themes/platformer/PlatformerPage.tsx`, following the existing background-layer load pattern (see the `BACKGROUND_LAYERS_SHEET` load in the mount effect).
- [x] T009 [US1] In `src/themes/platformer/PlatformerPage.tsx`, add a loop-local `cloudField` (same pattern as `worldAnimElapsed`), built in `resize()` from the `playCanvasSize(window.innerWidth, window.innerHeight)` width and `backgroundBandGeometry(canvas.height)` (`skyTop` / `cloudsTop`), and step it inside the `playing` branch next to `worldAnimElapsed += dt` (depends on T007, T008).
- [x] T010 [US1] In `src/themes/platformer/PlatformerPage.tsx`'s `render()`, call `drawAmbientClouds(ctx, ambientCloudsRef.current, cloudField, cameraPositionX.value)` immediately after the `drawBackgroundLayers(...)` block and before `drawBackgroundTiles(...)`, per the render order in `contracts/rendering.md` (depends on T009).

**Checkpoint**: User Story 1 is fully functional and independently testable — clouds drift while standing still, at varied speeds/heights, mostly independent of the camera (with a small camera-linked parallax), and the population follows the play-area width.

---

## Phase 4: User Story 2 - A Procession That Reads As Random, Not As A Loop (Priority: P2)

**Goal**: Seeded, varied drift so the sky reads as an irregular procession: no mid-sky
appearances, no overlapping blobs, more than one silhouette, and no pass that exactly
repeats the previous one.

**Independent Test**: Watch the sky until every cloud has crossed at least once. Each
cloud enters and leaves by crossing an edge, no pair overlaps illegibly, and no pass
exactly repeats the previous one.

### Tests for User Story 2 (write first, expect failure)

- [x] T011 [US2] Extend `src/themes/platformer/engine/AmbientClouds.test.ts`: `createCloudField` with the same seed and inputs yields an equal field (reproducible); initial `x` values lie in `[-maxShapeWidth, playAreaWidth)` so none appears mid-sky; every cloud has a unique `lane`; over the population more than one `shapeIndex` is present; and after a cloud is stepped fully past the left edge its `shapeIndex` changed, its `speed` changed, and its new `x >= playAreaWidth` (it enters from the right edge).

### Implementation for User Story 2

- [x] T012 [US2] Add a mulberry32 PRNG (carried as `rngState: number` on `CloudField`) to `src/themes/platformer/engine/AmbientClouds.ts`. In `createCloudField`, seed initial speeds, offsets and shapes from it and spread initial `x` across `[-maxShapeWidth, playAreaWidth)`; in `stepCloudField`'s respawn branch, draw a new speed, a **different** `shapeIndex`, and `x = playAreaWidth + rand * CLOUD_RESPAWN_JITTER_PX`, advancing `rngState`. Keep the step pure (return a new field; never mutate the input) (depends on T007, T011).

**Checkpoint**: User Stories 1 and 2 both work independently — the procession reads as random, not a loop.

---

## Phase 5: User Story 3 - Confined To The Sky, Never In The Way (Priority: P2)

**Goal**: Ambient clouds stay inside the open sky region and behind every level
element; the layer degrades to nothing when it cannot fit or its art is missing.

**Independent Test**: Play a level with a tall sky and watch clouds cross the full
width. No cloud is ever drawn below the sky region, nothing the player interacts with
is obscured, and a short sky or failed load simply omits the layer.

### Tests for User Story 3 (write first, expect failure)

- [x] T013 [P] [US3] Extend `src/themes/platformer/engine/AmbientClouds.test.ts`: across a long stepped run that includes respawns, every cloud satisfies `y >= skyTop` and `y + renderedHeight <= openSkyBottom`; `createCloudField` returns no clouds when `openSkyBottom - skyTop < MIN_SHAPE_HEIGHT * BACKGROUND_RENDER_SCALE`; `drawAmbientClouds` records zero `drawImage` calls when `image` is `null` or `field.clouds` is empty.
- [x] T014 [P] [US3] Add a draw-order integration test in `src/themes/platformer/PlatformerPage.test.tsx` asserting (via `ctx.drawImage.mock.invocationCallOrder`) that ambient cloud draws — identified by their `ambient_clouds.png` source image — occur after the `drawBackgroundLayers` draws and before the `drawBackgroundTiles`/`drawTerrain` draws, and that their dest x shifts left by the camera-linked parallax factor when the camera x is non-zero (compare a run at camera x 0 against one at a non-zero camera x).

### Implementation for User Story 3

- [x] T015 [US3] In `src/themes/platformer/engine/AmbientClouds.ts`, clamp/re-fit every cloud's `y` inside `[skyTop, openSkyBottom]` (including after a respawn re-fits a new shape height), return an empty `clouds` array from `createCloudField` when the region cannot fit the shortest shape, and early-return from `drawAmbientClouds` when `image` is `null` or `field.clouds` is empty (depends on T007, T013).

**Checkpoint**: All three stories work independently — the layer is decorative, contained and non-breaking.

---

## Phase 6: User Story 4 - A Sky That Pauses When Motion Is Unwanted (Priority: P3)

**Goal**: Under `prefers-reduced-motion: reduce`, the clouds are still drawn but do not
drift, and the rest of the level plays unchanged.

**Independent Test**: Enable the system reduced-motion setting, open the platformer, and
stand still. The sky shows clouds that do not move; the rest of the level plays normally.

### Tests for User Story 4 (write first, expect failure)

- [x] T016 [US4] Extend `src/themes/platformer/engine/AmbientClouds.test.ts`: `stepCloudField(field, dt, true)` leaves every cloud's `x` unchanged, while `stepCloudField(field, dt, false)` advances it.

### Implementation for User Story 4

- [x] T017 [US4] Add a required `reducedMotion` parameter to `stepCloudField` in `src/themes/platformer/engine/AmbientClouds.ts` (returns the field unchanged when `true`), and in `src/themes/platformer/PlatformerPage.tsx` read `window.matchMedia('(prefers-reduced-motion: reduce)').matches` once in the mount effect and pass it into the step alongside `dt` (depends on T009, T016). Mirror the existing read-once precedent in `src/themes/space/SpacePage.tsx`.

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Regression, manual validation and repo bookkeeping.

- [x] T018 [P] Run `npm test` and `npm run build` (strict TypeScript) and confirm all existing and new tests pass with no type errors and no `any` (SC-005, constitution Principles I/II/III).
- [ ] T019 [P] Walk `specs/O-022-ambient-clouds/quickstart.md` sections 1-5 in the running game (`npm run dev`, `/platformer`) and confirm every expectation (SC-001 ... SC-007), including resize, short-sky, failed-load, pause/death/restart and reduced-motion checks.
- [x] T020 Update the `docs/Features.md` dependency diagram: prefix the `O022` node label with `✅ ` and add `class O022 done` alongside its existing `class O022 themes` line (repo completion convention; see AGENTS.md "Feature Completion Tracking").

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; BLOCKS all user stories (every story needs `backgroundBandGeometry`).
- **User Stories (Phases 3-6)**: All depend on Foundational completion. They edit the same engine module and page, so they proceed in priority order rather than fully in parallel: US1 -> US2 -> US3 -> US4.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories. Delivers the MVP.
- **US2 (P2)**: After US1 — refines the variation/lifecycle in the module US1 created.
- **US3 (P2)**: After US1 — adds containment/degradation guards to the same module.
- **US4 (P3)**: After US1 — adds the reduced-motion parameter and its page wiring.

### Within Each User Story

- Tests are written and FAIL before implementation.
- Module logic (`AmbientClouds.ts`) before its `PlatformerPage.tsx` integration.
- `resize()` field creation before the loop step before the render call.
- Story complete and validated before moving to the next priority.

### Parallel Opportunities

- T001 and T002 are independent (different files: `sheets.ts` vs. the PNG asset).
- T005 and T006 are different files -> parallel.
- T007 (`AmbientClouds.ts`) and T008 (`PlatformerPage.tsx`) are different files -> parallel.
- T013 (`AmbientClouds.test.ts`) and T014 (`PlatformerPage.test.tsx`) are different files -> parallel.
- T018 and T019 are independent (automated run vs. manual validation).
- T011, T016 extend the same test file as T005/T013, so they run in their own story phases rather than together.

---

## Parallel Example: User Story 1

```bash
# Write both US1 test suites together (different files):
Task: "Create engine/AmbientClouds.test.ts covering population, drift and rounding"
Task: "Add the playing-phase ambient-draw integration test in PlatformerPage.test.tsx"

# Then start the module and the page wiring together (different files):
Task: "Create engine/AmbientClouds.ts (types, constants, population, field, step, draw)"
Task: "Add ambientCloudsRef + loadImage(...) to PlatformerPage.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: stand still in the running platformer and confirm clouds drift at varied speeds/heights, independent of the camera, and the population follows the width.
5. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational -> geometry has one source of truth.
2. US1 -> drifting layer (MVP) -> validate independently.
3. US2 -> seeded variation and lifecycle -> validate independently.
4. US3 -> containment and degradation -> validate independently.
5. US4 -> reduced-motion support -> validate independently.
6. Polish -> full regression, quickstart walkthrough, `docs/Features.md` done marker.

---

## Notes

- [P] tasks touch different files and have no incomplete dependencies.
- Every `[US*]` test task must be written and failing before its implementation task runs.
- This feature adds no runtime dependency, no backend call, no data file and no `any`; keep the new module pure and canvas-light (only `drawAmbientClouds` touches a 2D context).
- The cloud field is a loop-local `let` in `PlatformerPage.tsx`, never a signal, and is stepped only in the `playing` branch so it freezes with the world during pause/death/restart.
- Commit only when the user asks; do not auto-commit.
