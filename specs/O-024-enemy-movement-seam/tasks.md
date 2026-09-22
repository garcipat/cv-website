---
description: 'Task list for Enemy Movement & Animation Seam + Bee'
---

# Tasks: Enemy Movement & Animation Seam + Bee

**Input**: Design documents from `/specs/O-024-enemy-movement-seam/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The plan and the project constitution (Principle II) mandate
TDD — tests are written first, must fail, then the implementation makes them pass.
Every test task below names the exact file.

**Organization**: Tasks are grouped by user story so each story can be
implemented and tested independently. This feature is a **refactor behind a
seam**, so the shared, behavior-preserving seam (movement contract, patrol
extraction, per-kind animation resolution, geometry) is **Foundational** —
everything else depends on it. The stories then deliver the visible outcomes:

- **US1 (P1)** — the bee flies (MVP)
- **US2 (P1)** — the seam's extensibility proof (chase + registry/fixture contract)
- **US3 (P2)** — per-kind animation verified (per-kind frames + fallback)
- **US4 (P3)** — the bee is authorable in the editor

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Every task includes an exact file path

## Path Conventions

- Single static web app. All work is under `src/themes/platformer/`.
- Per-kind declarations: `src/themes/platformer/entities/enemies/`
- Level mapping: `src/themes/platformer/level/`
- Authoring: `src/themes/platformer/editor/`
- Per-instance session state: `src/themes/platformer/PlatformerState.ts`
- Orchestration/canvas: `src/themes/platformer/PlatformerPage.tsx`
- Docs: `docs/themes/platformer/`

---

## Phase 1: Setup

**Purpose**: Confirm the baseline and register the (already-authored) bee asset.

- [ ] T001 Run `npm test` and confirm the suite is green on `O-024-enemy-movement-seam` before refactoring; confirm `public/sprites/bee.png` is the expected 192×168 / 8 columns × 7 rows of 24×24 cells and record the fly row (row 5) art bounds (≈ x 3–21, y 7–18) for the bee's `hitboxPaddingNative`.
- [ ] T002 [P] Register `BEE_SHEET` (`/sprites/bee.png`, `frameWidth`/`frameHeight` 24, `columns` 8) in `src/themes/platformer/entities/sprites/sheets.ts` so the registry-driven loader discovers it.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The behavior-preserving seam refactor. Movement and animation become
per-kind; the slimes keep the **exact** old behavior through their own
declarations. Nothing here changes what a slime does — that is SC-001.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. The
slimes' patrol and resting animation move behind the seam here (they are the
only concrete strategy/animation at this point), which is what lets every story
after it be a local change.

### Tests for the foundational seam

- [ ] T003 [P] Create `src/themes/platformer/entities/enemies/movement/patrol.test.ts` — port every `engine/EnemyAI.test.ts` patrol case to `patrolMovement` with identical reference values (open floor both directions, wall snap `194`/`126`, `patrol` tile, pit/ledge, live blocked cell, narrow lane stand-still, purple `0.7×` delta, mushroom non-solid). This is the parity proof for SC-001 and must fail until T006.

### Core contract, types and geometry

- [ ] T004 [P] Create `src/themes/platformer/entities/enemies/movement/MovementStrategy.ts` — `MovementContext` (`level`, `blockedTiles`, `player | null`, `elapsed`) and `MovementStrategy<S extends BaseEnemyState>` (`kind`, `step`), types-only imports (per [contracts/movement-strategy.md](./contracts/movement-strategy.md)).
- [ ] T005 Update `src/themes/platformer/entities/enemies/EnemyType.ts` — add `movement: MovementStrategy<S>` and `defaultAnimState: string`; remove `patrolSpeedMultiplier`; widen `hitboxPaddingNative` to `{ side: number; top: number; bottom: number }` (data-model "Enemy kind").
- [ ] T006 Create `src/themes/platformer/entities/enemies/movement/patrol.ts` — `patrolMovement(config)` extracted **verbatim** from `stepEnemyPatrol`, plus an exported shared `stepHorizontal({ speed, checkLedges, sprite, hitboxPaddingNative, anchorY })` used by fly later. `anchorY` is the world Y the horizontal blocking test anchors on (patrol passes `enemy.y`, fly passes `enemy.homeY`), so the helper can serve both a bobbed and a non-bobbed kind. Computes size/offsets/padding from the passed `SpriteDescriptor` + padding; never imports `Enemy.ts` or `ENEMY_TYPES` (research D1/D9).
- [ ] T007 [P] Update `src/themes/platformer/entities/enemies/EnemyAnimation.ts` — widen `EnemyAnimState` to `string`; add `resolveAnimation(sprite, state, fallbackState)` returning `sprite.animations[state] ?? sprite.animations[fallbackState]`; change `enemyFrameIndex(sprite, state, frame, fallbackState)`; remove `walkAnimFrameCount`; keep `ENEMY_ANIMATIONS` and `WALK_FRAME_DURATION` (research D3).
- [ ] T008 [P] Update `src/themes/platformer/entities/enemies/spriteSheetHitbox.ts` — `height = size - topPad - bottomPad` so the box bottom edge matches the visible art's bottom (FR-019).
- [ ] T009 [P] Update `src/themes/platformer/entities/enemies/drawSpriteSheetEntity.ts` — add the `fallbackState` parameter, resolve the frame via `enemyFrameIndex(sprite, enemy.animState, enemy.animFrame, fallbackState)`, add `bottomPad` to `dy` so the visible art rests on the placement row, and add an optional `bodyAlpha` parameter (default `SLIME_BODY_ALPHA` 0.78) so a kind can draw opaque.
- [ ] T010 Update `src/themes/platformer/entities/Enemy.ts` — add `enemyHitboxBottomPadding(type)` (mirroring the side/top helpers); make `enemyTileOffsetY(type)` add the bottom inset; make `advanceEnemyAnimation(enemy, dt)` resolve through `resolveAnimation(typeOf(enemy).sprite, enemy.animState, typeOf(enemy).defaultAnimState)`; drop the `walkAnimFrameCount` re-export (keep `EnemyAnimState` and `WALK_FRAME_DURATION` re-exports).
- [ ] T011 Update `src/themes/platformer/entities/enemies/shared.ts` — introduce `EnemyBaseConfig { maxHitPoints; hitReactionSeconds; defaultAnimState; animations }`; `baseEnemyState(placement, index, config)` and `baseRevive(enemy, config)` seed `animState` from `config.defaultAnimState` and stagger `animFrame`/`animTimer` from that state's own frame count/duration (research D4). Also migrate `src/themes/platformer/entities/enemies/shared.test.ts` to the config-object signature (it currently calls the old positional form) and assert `animState` seeds from `defaultAnimState`.

### Slimes and the shared dispatch

- [ ] T012 [P] Update `src/themes/platformer/entities/enemies/SlimeGreen.ts` — `movement: patrolMovement({ speedMultiplier: 1, sprite, hitboxPaddingNative, animState: 'walk' })`, `defaultAnimState: 'walk'`, `hitboxPaddingNative: { side: 5, top: 9, bottom: 0 }`, and config-driven `create`/`revive`. Behavior must be bit-for-bit unchanged.
- [ ] T013 [P] Update `src/themes/platformer/entities/enemies/SlimePurple.ts` — same as T012 with `speedMultiplier: 0.7` and `renderScale: 2`; keep `onTick` and the spike drawing intact.
- [ ] T014 Update `src/themes/platformer/engine/EnemyAI.ts` — reimplement `stepEnemyPatrol(enemy, level, dt, blockedTiles)` with its exact old signature as a thin adapter that builds a `MovementContext` (`player: null`, `elapsed: 0`) and delegates to `typeOf(enemy).movement.step(...)`; make `stepEnemyHitReaction` revert to `typeOf(enemy).defaultAnimState` at frame 0 instead of the literal `'walk'` (research D2/D3).
- [ ] T015 Update `src/themes/platformer/PlatformerPage.tsx` — build one `movementCtx` per tick (`level: currentLevel.value`, the existing `blockedTiles`, `player: playerState.value`, `elapsed: worldAnimElapsed`) and replace the `stepEnemyPatrol(...)` call in `stepEnemy` with `typeOf(enemy).movement.step(enemy, movementCtx, dt)`; keep the `onTick` → `advanceEnemyAnimation` pipeline unchanged (research D8).
- [ ] T016 [P] Update `src/themes/platformer/types.ts` — type `EnemyDef['type']` as `EnemyTypeKey` via `import type { EnemyTypeKey } from './entities/enemies'` (research D7).

### Foundational parity tests

- [ ] T017 [P] Update `src/themes/platformer/entities/Enemy.test.ts` — replace per-type `patrolSpeedMultiplier` assertions with `movement`/`defaultAnimState`, and add box/anchor parity: the slimes (`bottom: 0`) are bit-identical to before, and a synthetic non-zero-bottom kind has a box whose bottom edge equals its visible art's bottom and is drawn anchored on its row (SC-009).
- [ ] T018 Update `src/themes/platformer/entities/enemies/index.test.ts` — assert each slime's `movement.kind` and `defaultAnimState` instead of `patrolSpeedMultiplier`.
- [ ] T019 Run `npm test` — `engine/EnemyAI.test.ts` (unedited), `engine/EnemyContact.contract.test.ts`, `entities/Enemy.test.ts`, `entities/WorldType.test.ts`, `PlatformerState.test.ts` and `PlatformerPage.test.tsx` must all pass. This is the SC-001 gate: the seam changed no slime behavior.

**Checkpoint**: The seam exists and the slimes are provably unchanged. User stories can now begin.

---

## Phase 3: User Story 1 - The Bee Flies (Priority: P1) 🎯 MVP

**Goal**: A visitor meets a bee hovering over a gap — horizontal flight with no
ledge check, a bounded periodic bob, stompable like a green slime, harmless to
progression.

**Independent Test**: Place a bee over a gap on a platform with a wall on one
side. Verify it crosses the gap without turning (where a slime would reverse),
that its height rises and falls in a repeating cycle, that a stomp bounces and
defeats it, and that a side touch costs half a heart.

### Tests for User Story 1 (write first)

- [ ] T020 [P] [US1] Create `src/themes/platformer/entities/enemies/movement/fly.test.ts` — over open ground advance `±speed*dt`; **no reversal over a gap** (SC-002); reverse + snap at a wall / `patrol` tile / live blocked cell; a lane narrower than the body on both sides stands still rather than flipping every frame (fly's own case of the spec edge case); `elapsed = 0` and `elapsed = bobPeriod` both give `y === homeY`; sampled over a full period `|y - homeY| <= bobAmplitude` and max equals `bobAmplitude` at quarter-period (SC-003); `vy` matches the analytic derivative; `dt <= 0` is a no-op and `ctx.player` is ignored.
- [ ] T021 [P] [US1] Create `src/themes/platformer/entities/enemies/Bee.test.ts` — `create`/`revive` seed `animState: 'fly'`, `hitPoints: 1`, `homeX/homeY` and the fly-loop stagger; `box` is the visible silhouette (bottom inset applied); a falling top contact stomps with a green-slime bounce, side/underside damages + knocks back; while reacting it takes no second hit and damages nobody; stepped through the real pipeline over a gap it crosses and bobs (FR-010/FR-011/FR-012, SC-004/SC-009). Also confirm `src/themes/platformer/entities/WorldType.test.ts` picks the bee up automatically (add a bee anchor case if it enumerates kinds).

### Implementation for User Story 1

- [ ] T022 [US1] Create `src/themes/platformer/entities/enemies/movement/fly.ts` — `flyMovement(config)` using the shared `stepHorizontal` with `checkLedges: false` and `anchorY: enemy.homeY`, so the blocking test anchors on the placement row (`Math.round(enemy.homeY / RENDERED_TILE_SIZE)`) rather than the bobbed `y`; vertical `y = homeY + bobAmplitude * sin(2π * elapsed / bobPeriod)` and its analytic `vy` from `ctx.elapsed`; `animState` set to `config.animState ?? 'fly'` (per [contracts/fly.md](./contracts/fly.md), research D9).
- [ ] T023 [US1] Create `src/themes/platformer/entities/enemies/Bee.ts` — `BeeState`, `BEE_ANIMATIONS` (`fly: frames [32..39], frameDuration 0.12`, no `hit` row), `BEE_SPRITE` (`BEE_SHEET`, `renderScale: 1`), and `bee: EnemyType<BeeState>`: `maxHitPoints: 1`, `hitReactionSeconds: ENEMY_HIT_REACTION_SECONDS`, `movement: flyMovement({ speed: 70, bobAmplitude: 6, bobPeriod: 1.4, ... })`, `defaultAnimState: 'fly'`, `hitboxPaddingNative: { side: 3, top: 7, bottom: 5 }`, `heldItem: null`, green-slime `onPlayerCollide`, `box`/`draw` with the `'fly'` fallback and `draw` passing `bodyAlpha: 1` so the bee is opaque rather than at the slimes' 0.78 (per [contracts/bee.md](./contracts/bee.md)).
- [ ] T024 [US1] Register the bee in `src/themes/platformer/entities/enemies/index.ts` — `ENEMY_TYPES = { slimeGreen, slimePurple, bee }` and widen `EnemyState` with `BeeState`. Confirm the registry-driven sprite loader picks up `BEE_SHEET` with no further PlatformerPage change.
- [ ] T025 [P] [US1] Update `src/themes/platformer/level/LevelParser.ts` — `EntityKind += 'enemyBee'`, `ENTITY_CHARS['q'] = 'enemyBee'`, `TileChar += 'q'`, and `findBeeTiles(layout)` (reading order, like the other finders).
- [ ] T026 [P] [US1] Update `src/themes/platformer/level/LevelParser.test.ts` — `ENTITY_CHARS.q` maps to `enemyBee`, `findBeeTiles` finds `q` and ignores the other markers, and `q` is added to the `TileChar` sync list.
- [ ] T027 [P] [US1] Update `src/themes/platformer/level/EnemyMapper.ts` — add `EnemyMarkerPositions.bee`, implement `placeBees(markers)` producing `{ id: 'enemy-bee-<col>-<row>', type: 'bee', x, y }` with no `fact`, and wire it into `placeEnemies`.
- [ ] T028 [P] [US1] Update `src/themes/platformer/level/EnemyMapper.test.ts` — a bee marker becomes a plain, position-derived placement with no `fact` and the expected id; add `bee: []` to every existing `placeEnemies(defs, { slimeGreen, slimePurple })` call site, since `EnemyMarkerPositions.bee` is a new required key.
- [ ] T029 [US1] Update `src/themes/platformer/level/level.ts` — add `BEE_TILES = computed(() => findBeeTiles(currentLayout.value))`, and add one `q` marker to `LEVEL_1_LAYOUT` over Zone D's open pit (two rows above the base ground row), updating the layout legend and the file doc comment (research D11).
- [ ] T030 [US1] Update `src/themes/platformer/PlatformerState.ts` — pass `bee: BEE_TILES.value` into `placeEnemies`; leave `levelTotals.enemies` and `enemiesDefeated` filtering on `type === 'slimeGreen'` so bees count toward neither (FR-013).
- [ ] T031 [US1] Update `src/themes/platformer/PlatformerState.test.ts` — a `q` marker seeds exactly one bee placement, and `levelTotals.enemies` / `enemiesDefeated` are identical with the bee present and removed (SC-008); relax the existing assertion that every enemy state is `animState === 'walk'` so the slimes are still asserted `walk` while the bee is asserted `fly`.
- [ ] T032 [US1] Update `src/themes/platformer/PlatformerPage.test.tsx` — a bee over a gap flies across without reversing, a stomp bounces and defeats it with the shared puff, a side touch costs half a heart and knocks back, and the enemies counter/journal/completion are unchanged (SC-004/SC-008).

**Checkpoint**: The shipped level contains a working bee. This is the MVP — validate with `quickstart.md` §1.

---

## Phase 4: User Story 2 - Movement Is a Per-Kind Choice (Priority: P1)

**Goal**: Prove the seam is genuinely per-kind — a kind with its own movement and
animation works end-to-end by adding only that kind's files and its
registration, and a proximity-reactive behavior is supported without shipping
one on a real kind.

**Independent Test**: Add a test-only enemy kind with a movement behavior
distinct from patrol and from flying, exercise it through the real game step,
and confirm it moves by its own rule while the slimes are unaffected. Confirm
the change needed is a new module plus a registry entry.

### Tests for User Story 2 (write first)

- [ ] T033 [P] [US2] Create `src/themes/platformer/entities/enemies/movement/chase.test.ts` — idle with `player: null`; idle with the player out of `detectRange`; in range the distance to the player decreases by at most `speed * dt` per step and `direction` faces the player; deterministic and non-mutating (FR-016).
- [ ] T034 [P] [US2] Create `src/themes/platformer/entities/enemies/movement/contract.test.ts` — (a) registry contract: every `ENEMY_TYPES` entry has a callable `movement.step` and a `defaultAnimState` present in its own `sprite.animations` (SC-006/FR-017); (b) fixture end-to-end: build a fixture `EnemyType` with the `chase` strategy and its own animation table, drive it through `movement.step` → `onTick` → `advanceEnemyAnimation` → `drawSpriteSheetEntity`, and assert it moves by its own rule and renders its own frames with **no** shared file changed (SC-005/FR-018); (c) fallback: a fixture whose table omits the requested state resolves to its `defaultAnimState` without throwing or blanking (FR-009).

### Implementation for User Story 2

- [ ] T035 [US2] Create `src/themes/platformer/entities/enemies/movement/chase.ts` — `chaseMovement(config)`: idle (`vx = vy = 0`, `idleAnimState`, direction unchanged) when `ctx.player === null` or the centre distance exceeds `detectRange`; otherwise move `speed * dt` along the normalized 2D offset, set `direction` from the horizontal sign, and `activeAnimState` (per [contracts/chase.md](./contracts/chase.md)).

**Checkpoint**: The seam's extensibility is proven by automated tests; no shipped kind uses chase.

---

## Phase 5: User Story 3 - Animation Is a Per-Kind Choice (Priority: P2)

**Goal**: Each kind animates from its own table, returns to its own resting
state after a hit, and falls back to that resting state when a requested state
is missing — never failing, throwing or rendering blank.

**Independent Test**: Give a kind a distinct animation table, run it, and confirm
the frames drawn come from that table; hit it and confirm it returns to its own
resting state; request a state the table does not define and confirm it renders
the resting state instead of failing or going blank.

> The resolution plumbing landed in Foundational (T007–T011) because US1's bee
> needs it. This phase is the story's verification: per-kind frames, the
> resting-state fallback, the hit revert, and slime animation parity.

### Tests for User Story 3 (write first)

- [ ] T036 [P] [US3] Update `src/themes/platformer/entities/Enemy.test.ts` — a kind with its own table plays that state's frames; a requested state missing from the table resolves to the kind's `defaultAnimState` (no throw, no blank) (FR-007/FR-009); `advanceEnemyAnimation` advances using the resolved animation's `frameDuration` and wraps at its frame count; the slimes keep `walk` `[3,4,5,6,7]` @ 0.15s and `hit` `[8,9,10,11]` @ 0.1s unchanged (SC-001).
- [ ] T037 [P] [US3] Update `src/themes/platformer/entities/enemies/Bee.test.ts` — a bee that survives a hit reverts to its own `defaultAnimState` (`fly`) at frame 0, not a shared `walk` (FR-008).
- [ ] T038 [US3] Add to `src/themes/platformer/entities/enemies/Bee.test.ts` — a freshly hit bee (whose table declares no `hit` row) is drawn with `fly` frames through the draw-path fallback *before* any `advanceEnemyAnimation` runs, and `resolveAnimation` returns the fallback for an unknown state (FR-009).

**Checkpoint**: Per-kind animation and the fallback are proven by tests; slimes are unchanged.

---

## Phase 6: User Story 4 - Bees Are Authorable (Priority: P3)

**Goal**: A level author finds the bee in the entity palette with a readable name
and an art preview, paints it over a gap, saves, and meets the same bee when the
level is played.

**Independent Test**: Open the editor, select the bee, paint it, save, reload,
and verify the placement persists and the bee behaves identically when played.

### Tests for User Story 4 (write first)

- [ ] T039 [P] [US4] Update `src/themes/platformer/editor/gridRenderState.test.ts` — a `q` cell synthesizes exactly one bee `EnemyState`.
- [ ] T040 [P] [US4] Update `src/themes/platformer/editor/paletteTiles.test.ts` — the `q` entry exists with a sprite crop, the label `Bee` and a description.
- [ ] T041 [P] [US4] Update `src/themes/platformer/editor/EditorCanvas.test.tsx` — a `q` cell previews the bee sprite and the bee image is present in the draw context's sprite map.

### Implementation for User Story 4

- [ ] T042 [US4] Update `src/themes/platformer/editor/paletteTiles.ts` — add the `q` tile (a bee fly-frame crop from `BEE_SHEET`), `PALETTE_TILE_LABELS['q'] = 'Bee'` and its description (FR-015).
- [ ] T043 [US4] Update `src/themes/platformer/editor/gridRenderState.ts` — synthesize bee states from `q` in `synthesizeEnemyStates` (same per-kind pattern as green/purple).
- [ ] T044 [US4] Update `src/themes/platformer/editor/EditorCanvas.tsx` — add `bee` to `EditorImages` and `[BEE_SHEET.src]: images.bee` to the draw context's `sprites` map.
- [ ] T045 [US4] Update `src/themes/platformer/editor/EditorCanvasPane.tsx` — add `bee` to `EMPTY_IMAGES` and a `{ key: 'bee', src: '/sprites/bee.png' }` entry to `IMAGE_SOURCES`.
- [ ] T046 [US4] Verify `src/themes/platformer/editor/Palette.tsx` derives the bee button from `ENTITY_CHARS` with no code change; add a palette presence assertion only if the existing derivation does not cover it.

**Checkpoint**: The bee round-trips through the editor; validate with `quickstart.md` §4.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, the completion marker, and the manual browser check.

- [ ] T047 [P] Update `docs/themes/platformer/Enemies.md` — document the movement seam, per-kind animation (with the resting-state fallback), the bee, and the "adding an enemy" recipe (the per-kind cost list).
- [ ] T048 [P] Update `docs/themes/platformer/LevelFormat.md` — add the `q` entity-marker row.
- [ ] T049 Update `docs/Features.md` — prefix the `O024` node label with `✅ ` and add `class O024 done` alongside its category class (only after implementation **and** tests are complete, per the completion-tracking convention).
- [ ] T050 Run `npm test`, the type check/build, and walk `quickstart.md` §1–§7 in the browser (`npm run dev`) — the constitution's manual browser check for visible behavior (the bee flies, bobs, stomps and reads right; the slimes are unchanged).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**. The
  seam's shared plumbing must exist before any kind can declare movement/animation.
- **User Story 1 (Phase 3, P1)**: Depends on Foundational. MVP.
- **User Story 2 (Phase 4, P1)**: Depends on Foundational. The `contract.test.ts`
  fixture also uses US1's bee being registered to exercise the registry contract,
  so complete US1 first (or accept the registry assertion covering the slimes
  until the bee lands).
- **User Story 3 (Phase 5, P2)**: Depends on Foundational; its hit-revert and
  draw-path-fallback cases reference the bee, so US1 first.
- **User Story 4 (Phase 6, P3)**: Depends on Foundational; references the bee's
  module/sheet, so US1 first.
- **Polish (Phase 7)**: Depends on all desired stories being complete.

### Within Each User Story

- Tests are written first and MUST fail before the implementation task runs.
- Movement strategy → bee module → registry → marker/mapping → state wiring → integration.
- Core implementation before integration; story complete before the next priority.

### Parallel Opportunities

- Setup: T002 is independent.
- Foundational: T003/T004 (tests + contract types), T007/T008/T009 (three
  independent helper files) and T012/T013 (the two slime modules) can be authored
  in parallel.
- US1: T020/T021 (the two new test files) are independent; T025–T028 (parser +
  mapper and their tests) are independent of the bee module; T022 (fly) and T023
  (Bee) are distinct files.
- US2: T033/T034 are independent test files; T035 is a distinct module.
- US3: T036 (Enemy.test.ts) and T037 (Bee.test.ts) are independent files.
- US4: T039/T040/T041 are independent test files; T042–T045 are four distinct files.
- Polish: T047/T048 are independent docs.

---

## Parallel Example: Foundational helpers

```text
# Launch the independent helper-file edits together:
Task: "Update EnemyAnimation.ts — widen EnemyAnimState + resolveAnimation (T007)"
Task: "Update spriteSheetHitbox.ts — subtract the bottom inset (T008)"
Task: "Update drawSpriteSheetEntity.ts — fallback state + bottom anchor (T009)"
```

## Parallel Example: User Story 1

```text
# Launch the bee's movement tests and the level-format edits together:
Task: "Create movement/fly.test.ts (T020)"
Task: "Create Bee.test.ts (T021)"
Task: "Update LevelParser.ts for the q marker (T025)"
Task: "Update EnemyMapper.ts for placeBees (T027)"
```

## Parallel Example: User Story 4

```text
# Launch the editor implementation files together (distinct files):
Task: "Update editor/paletteTiles.ts — q entry (T042)"
Task: "Update editor/gridRenderState.ts — bee synthesis (T043)"
Task: "Update editor/EditorCanvas.tsx — bee image (T044)"
Task: "Update editor/EditorCanvasPane.tsx — bee image source (T045)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — the seam; blocks everything).
3. Complete Phase 3: User Story 1 (the bee).
4. **STOP and VALIDATE**: run `quickstart.md` §1 — the bee flies over the gap,
   bobs, stomps, damages, and pays nothing.
5. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational → the seam exists and the slimes are provably unchanged.
2. US1 → the bee (MVP) → validate → demo.
3. US2 → the extensibility proof (chase + contract test) → validate.
4. US3 → per-kind animation + fallback verified → validate.
5. US4 → the bee is authorable → validate.
6. Polish → docs + completion marker + browser check.

### Parallel Team Strategy

With more than one developer, after Foundational:

- Developer A: US1 (bee) — the critical path.
- Developer B: US2 (chase + contract) once the bee is registered.
- Developer C: US3 (animation tests) and US4 (editor) once the bee module exists.

---

## Notes

- [P] tasks = different files, no dependency on an incomplete task.
- The [Story] label maps a task to its user story for traceability.
- Foundational is large on purpose: this feature is a refactor, so the shared
  seam is infrastructure that every story sits on top of. US2's own phase is
  small because its mechanical work is the seam; its deliverable is the
  extensibility **proof**.
- `engine/EnemyAI.test.ts` and `engine/EnemyContact.contract.test.ts` are
  deliberately **not** edited — SC-001 depends on the patrol characterization
  passing as-is.
- Verify each test fails before implementing the task it covers.
- Do not commit unless the user asks (project convention).
