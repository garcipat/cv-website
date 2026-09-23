---
description: 'Task list for Platformer Crouch/Duck (S-012)'
---

# Tasks: Platformer Crouch/Duck

**Input**: Design documents from `/specs/S-012-platformer-crouch-duck/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: TDD is mandatory for this project (constitution Principle II; [docs/TestingGuide.md](../../docs/TestingGuide.md)). Test tasks are included and MUST be written first and FAIL before the matching implementation task. Naming convention: `{method}-{condition}-{expectedResult}`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. All four user stories are layered on one shared change (the reduced box), so the shared primitives land in the Foundational phase and each story then adds its own slice of behavior. The crouched-hit requirement set (FR-011 / FR-016 / SC-009) has no user story of its own — the spec places it under Edge Cases ("Taking a hit while crouched") — so it is a final requirement phase (Phase 7) that depends on US4's crouch pose and US1/US2's crouch flag and hit-reaction freeze.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Every task includes the exact file path it touches

## Path Conventions

- Single static web app. All paths are relative to the repository root.
- Platformer theme code: `src/themes/platformer/`
- i18n locales: `src/i18n/locales/`
- Theme docs: `docs/themes/platformer/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean baseline before touching anything. No project scaffolding or new dependency is needed.

- [X] T001 Run `npm test` from the repo root and confirm the existing suite is green before any edit, per the TDD workflow in `docs/TestingGuide.md`; record the baseline so later failures are attributable to this feature. (Baseline: 154 files / 3400 tests green.)

**Checkpoint**: Baseline green — implementation can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one stored field, the shared box geometry, the crawl-speed constant, and the pure crouch decision module. Every user story reads these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Add `crouching: boolean` to the `PlayerState` interface and add `PLAYER_CROUCH_BOX_HEIGHT` (`= RENDERED_TILE_SIZE`), `playerHeadPaddingFor(crouching: boolean)`, and `playerBoxHeightFor(crouching: boolean)` to `src/themes/platformer/entities/Player.ts` (standing: 18 / 38; crouched: 24 / 32), following `contracts/collision-box.md`. Import `RENDERED_TILE_SIZE` from `../level/Terrain`. Do NOT touch `ANIM_CONFIG` or the animation functions here.
- [X] T003 [P] Add `crouchSpeed: 120` to `PHYSICS_CONFIG` in `src/themes/platformer/engine/PhysicsConfig.ts`, with a doc comment stating the tunneling invariant (`120 * MAX_DT = 4 < 32`) and that knockback still overrides it (`contracts/crouch-physics.md`).
- [X] T004 [P] Seed `crouching: false` in the object returned by `playerStateAtTile` in `src/themes/platformer/PlatformerState.ts` (this is the single factory behind spawn, checkpoint respawn and `resetGame`, so FR-012 falls out for free).
- [X] T005 [P] Seed `crouching: false` in the object returned by `synthesizePlayerState` in `src/themes/platformer/editor/gridRenderState.ts`.
- [X] T006 Write the failing unit tests for the new pure module in `src/themes/platformer/engine/Crouch.test.ts` (Vitest, no DOM), covering the invariants in `contracts/crouch-physics.md`: `canStandUp` returns false for a one-tile ceiling and for a live block, true in open air; `resolveCrouching` fresh airborne entry is false, hit-reaction freeze returns `currentlyCrouching` unchanged for both inputs, `downClaimed` ignores held Down unless `!canStand`, and `!canStand && currentlyCrouching` keeps the crouch while `!currentlyCrouching` never starts one. Use `{method}-{condition}-{expectedResult}` names. Run `npm test` and confirm these fail (module does not exist yet).
- [X] T007 Implement `src/themes/platformer/engine/Crouch.ts` (pure, canvas-free, DOM-free — imports only types plus `playerHeadPaddingFor`/`playerBoxHeightFor`/`PLAYER_*` from `entities/Player.ts`, `isSolid`/`tileAt`/`RENDERED_TILE_SIZE` from `level/Terrain.ts`, and `isBlockOccupied` from `level/BlockMapper.ts`): export `CrouchContext`, `canStandUp(level, blocks, player)` and `resolveCrouching(ctx)` exactly as specified in `contracts/crouch-physics.md`. Run `npm test` and confirm T006 passes.
- [X] T008 [P] Add `crouching: false` to every existing test fixture that constructs a full `PlayerState` literal, so the new required field type-checks across the suite. Known construction sites: `src/themes/platformer/PlatformerState.test.ts`, `PlatformerPage.test.tsx`, `entities/Player.test.ts`, `entities/WorldType.test.ts`, `entities/capabilities.test.ts`, `entities/Enemy.test.ts`, `entities/hazards/Spear.test.ts`, `entities/enemies/Bee.test.ts`, `entities/enemies/SlimePurple.test.ts`, `entities/enemies/shared.test.ts`, `engine/Physics.test.ts`, `engine/Collision.test.ts`, `engine/CheckpointLogic.test.ts`, `engine/DeployableLadder.test.ts`, `engine/DebugOverlay.test.ts`, `engine/Renderer.test.ts`, `engine/EnemyAI.test.ts`, `engine/EnemyContact.contract.test.ts`, `engine/Lighting.test.ts`. Run `npm test` and confirm the suite is green again.

**Checkpoint**: Foundation ready — the `crouching` field, shared geometry, crawl speed and pure decision module exist and the suite compiles.

---

## Phase 3: User Story 1 - Duck and Crawl Under a Low Ceiling (Priority: P1) 🎯 MVP

**Goal**: Holding Down on plain ground drops the character into a crouch whose collision box and interaction hitbox are one tile tall; it crawls slower, cannot jump, passes through a one-tile corridor, and stands on release.

**Independent Test**: Stand on plain ground, hold Down — the collision box is one tile tall (verify with `?debug=hitboxes`); crawl through the authored corridor; release Down and stand at full height.

### Tests for User Story 1 ⚠️ (write first, confirm they FAIL)

- [X] T009 [US1] Add failing cases to `src/themes/platformer/engine/Physics.test.ts`: grounded + `dropThroughHeld` sets `crouching: true`; held Down while airborne with no prior crouch does not; horizontal `vx` is `±PHYSICS_CONFIG.crouchSpeed` in both directions while crouched and `±walkSpeed` standing; `jumpPressed` while crouched produces no jump; the horizontal wall scan and ceiling scan use the crouched head row; every non-climb return path sets `crouching` explicitly. Use `{method}-{condition}-{expectedResult}` names.
- [X] T010 [P] [US1] Add failing cases to `src/themes/platformer/engine/Collision.test.ts`: `playerHitbox` is `{ height: 38, y: player.y + 18 }` standing and `{ height: 32, y: player.y + 24 }` crouched with identical `x`/`width` and identical feet line; a coin/pickup in the head band is collected standing but missed crouched; `resolveEnemyContacts` stomp geometry, `resolveHazardContacts`, `checkFloorSpikeTriggers` and a `playerInBlast(playerHitbox(...), ...)` check all read the crouched box (`contracts/collision-box.md`).
- [X] T011 [P] [US1] Add failing cases to `src/themes/platformer/level/level.test.ts`: the authored corridor's ceiling row (0-based array row 8) is solid across columns 89–94, its corridor row (0-based array row 9) is `empty` across those columns, and its floor row (0-based array row 10) is solid `groundGrass` — exactly one tile of clearance; no `ENTITY_CHARS`/`SIGN_CHARS`/`HAZARD_CHARS` marker sits in the corridor cells; no new `TileType`/`TileChar` was added (`contracts/onboarding-level.md`).
- [X] T012 [P] [US1] Add failing cases to `src/themes/platformer/engine/DebugOverlay.test.ts` (and update its player fixtures) asserting the cyan head line is drawn at `player.y + playerHeadPaddingFor(player.crouching)` for both crouched and standing players.

### Implementation for User Story 1

- [X] T013 [US1] Implement the crouch integration in `src/themes/platformer/engine/Physics.ts` (`contracts/crouch-physics.md`): before the horizontal collision pass, call `resolveCrouching` with `{ downHeld: Boolean(input.dropThroughHeld), grounded: player.grounded, currentlyCrouching: player.crouching, downClaimed: false, canStand: true, inHitReaction: false }` (the `canStand`/`inHitReaction`/`downClaimed` placeholders are replaced with real sources in T018/T021); use the resolved `crouching` for the horizontal `topRow`, the ceiling `headY`, the ceiling resolution line, the input-driven `vx` (`crouching ? PHYSICS_CONFIG.crouchSpeed : PHYSICS_CONFIG.walkSpeed`), and gate `jumpStarts` with `&& !crouching`; write `crouching` on the normal return. Leave the feet row, `bottomRow`, `HITBOX_WIDTH`, world bounds, ground collision, `prevFeetY`, `lastGroundedX/Y`, `isDroppingThroughBridge` and `bounceAscending` untouched.
- [X] T014 [US1] Change `playerHitbox` in `src/themes/platformer/engine/Collision.ts` to read `playerHeadPaddingFor(player.crouching)` and `playerBoxHeightFor(player.crouching)` (drop the direct `PLAYER_HEAD_PADDING`/`PLAYER_RENDERED_SIZE` height arithmetic), per `contracts/collision-box.md`. Every consumer already funnels through this function.
- [X] T015 [US1] Change the cyan head line in `src/themes/platformer/engine/DebugOverlay.ts` to use `playerHeadPaddingFor(player.crouching)`; leave the red render slot, yellow side-padded rect and magenta foot line unchanged.
- [X] T016 [US1] Author the low corridor in `src/themes/platformer/level/level.ts`: write `groundGrass` ceiling tiles (`G`) at 0-based layout array row 8 over columns 89–94, leave 0-based row 9 empty there, and reuse the existing solid `groundGrass` at 0-based row 10; do NOT add a `TileType`, a `TERRAIN_CHARS` entry, or any level-format field. Update the layout's top doc comment to describe the corridor (`contracts/onboarding-level.md` §C). Re-validate the exact columns in the Level Editor; the shape of the change is fixed.

**Checkpoint**: User Story 1 is fully functional and testable independently — crouch on open ground, crawl through the corridor, no jump, stand on release.

---

## Phase 4: User Story 2 - Refuse to Stand Up Into a Ceiling (Priority: P1)

**Goal**: The character only stands when its full standing box (38 px) fits in clear space; under a one-tile ceiling it stays crouched until it has crawled clear, then stands automatically.

**Independent Test**: Crawl into the corridor, release Down mid-corridor — stays low. Keep holding a direction until the ceiling ends — stands by itself, never overlapping a solid tile.

### Tests for User Story 2 ⚠️ (write first, confirm they FAIL)

- [X] T017 [US2] Add failing cases to `src/themes/platformer/engine/Physics.test.ts`: a crouched player under a one-tile ceiling with Down released keeps `crouching: true`; the frame `canStandUp` becomes true it returns `crouching: false` (auto-stand) with no Down release; releasing and re-pressing Down under the ceiling produces no height flicker; the returned box never overlaps a solid tile at any point. Use `{method}-{condition}-{expectedResult}` names.
- [X] T018 [US2] Wire the real headroom gate in `src/themes/platformer/engine/Physics.ts`: replace the `canStand: true` placeholder with `canStandUp(activeLevel, blockPlacements, player)` and the `inHitReaction: false` placeholder with `isInvulnerable(player, PLAYER_HIT_REACTION_SECONDS)` (import `canStandUp` from `./Crouch` and `isInvulnerable` from `../entities/capabilities`), evaluated once per tick against the pre-step position. Run `npm test` and confirm T017 passes.
- [X] T019 [US2] Add cases to `src/themes/platformer/PlatformerState.test.ts`: `playerStateAtTile`/`spawnPlayerState` seed `crouching: false`; a crouched `playerState` is returned standing by `resetGame()` and by `resetGameProgress()` (FR-012). Confirm the tests pass once T004 is in place.

**Checkpoint**: User Stories 1 AND 2 both work independently — no standing into a ceiling, no clipping during the transition.

---

## Phase 5: User Story 3 - Down Still Climbs and Drops (Priority: P1)

**Goal**: Down keeps its existing meanings — climb descent on a ladder, drop-through on a bridge — and crouches only when neither applies.

**Independent Test**: On a ladder, Down climbs down (never crouches). On a bridge tile, Down drops through (never crouches). On plain ground, Down crouches. Existing ladder/bridge assertions pass unchanged.

### Tests for User Story 3 ⚠️ (write first, confirm they FAIL)

- [X] T020 [US3] Add failing cases to `src/themes/platformer/engine/Physics.test.ts`: holding Down while overlapping a climbable tile leaves `crouching: false` and climbs exactly as before; holding Down while grounded on a `bridge` leaves `crouching: false` and drops through exactly as before; a crouched player that crawls onto a bridge while Down is held drops through rather than remaining crouched; the climbing and climb-exit returns set `crouching: false`. Use `{method}-{condition}-{expectedResult}` names.
- [X] T021 [US3] Implement the Down priority in `src/themes/platformer/engine/Physics.ts` (`contracts/crouch-physics.md` §`stepPlayerPhysics`): compute `downClaimed` against the pre-step position — true when `player.climbing`, or the feet row is climbable in any hitbox column, or `player.grounded` and the row below the feet is climbable in any hitbox column, or `player.grounded` and the standing foot row holds a `bridge` under any hitbox column — and pass it into `resolveCrouching`; force `crouching: false` on the climbing and climb-exit early returns. Leave the existing ladder and bridge branches themselves unchanged. Run `npm test` and confirm T020 passes.
- [X] T022 [US3] Run the existing ladder and bridge assertions unchanged (`src/themes/platformer/engine/Physics.test.ts`, `src/themes/platformer/engine/Collision.test.ts`, `src/themes/platformer/PlatformerState.test.ts`) and confirm they pass, proving SC-003 (no regression to Down). Their fixtures may gain the new required `crouching` field, but no ladder/bridge assertion may change.

**Checkpoint**: All three P1 stories work independently — crouch, headroom, and untouched ladder/bridge behavior.

---

## Phase 6: User Story 4 - The Crouch Reads at a Glance (Priority: P2)

**Goal**: The crouch pose is visually distinct from idle/walk, is held still while stationary, and animates while crawling, using a dedicated four-frame duck row appended to the knight sheet (no existing animation's frames change).

**Independent Test**: Compare the crouched sprite with idle and walk; crawl and verify the pose changes as it moves; crouch then stand and verify a clean replacement with no overlap.

### Tests for User Story 4 ⚠️ (write first, confirm they FAIL)

- [X] T023 [US4] Add failing cases to `src/themes/platformer/entities/Player.test.ts`: `playerFrameSource('crouch', 0)`, `('crouch', 1)` and `('crouch', 2)` return `sy = PLAYER_FRAME_SIZE * 8` with distinct `sx` and `('crouch', 4)` wraps to frame 0; `updatePlayerAnimState` returns `'crouch'` for a grounded `crouching: true` player with `vx: 0` and for a `crouching: true`, `grounded: false` player; it still returns `'hit'` while invulnerable even with `crouching: true`; `advancePlayerAnimation` returns the same reference for a stationary crouch and advances the frame for a crawling crouch. Use `{method}-{condition}-{expectedResult}` names.
- [X] T024 [P] [US4] Add a case to `src/themes/platformer/engine/Renderer.test.ts` confirming a **non-hit** `crouch` takes the existing primary-sheet `playerFrameSource` path (not the `knight2.png` jump/climb path), so a plain crouch needs no `drawPlayer` change. Note: `Renderer.drawPlayer` **does** need one edit for the crouched-hit tint branch (T033) — the earlier "needs no edit" assumption is superseded; this test covers only the normal crouch path (`contracts/rendering-animation.md`).

### Implementation for User Story 4

- [X] T025 [US4] In `src/themes/platformer/entities/Player.ts`: add `'crouch'` to `PlayerAnimState`, add `crouch: { frameCount: 4, frameDuration: 0.12, sy: PLAYER_FRAME_SIZE * 8 }` to `ANIM_CONFIG`, and derive `'crouch'` in `updatePlayerAnimState` whenever `player.crouching` — after the `hit` stickiness and the `climb` check, before the airborne check (so a crouched fall keeps the pose) (`contracts/rendering-animation.md`). The dedicated duck row is appended to `public/sprites/knight.png` (256×288, 9 uniform 32px rows; frames' feet 4px above the cell bottom).
- [X] T026 [US4] In `src/themes/platformer/entities/Player.ts`, freeze `'crouch'` in `advancePlayerAnimation` while `player.vx === 0` (mirroring the existing `climb` freeze on `vy === 0`), so the duck pose is held still while stationary and loops its four frames only while crawling. Run `npm test` and confirm T023/T024 pass.
- [ ] T027 [US4] Browser-check the pose legibility with `npm run dev`: place idle, walk and crouch side by side, crawl and confirm the animation, crouch then stand and confirm no overlap (SC-004, `quickstart.md` §4). Record the result in the feature notes.

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Crouched Hit Reaction (FR-011 / FR-016 / SC-009)

**Goal**: A directional hit taken while crouched still deals damage, opens the invulnerability window and shows the red reaction, but applies no knockback (horizontal or vertical) and keeps the one-tile box for the whole reaction. The red reaction is a reusable render-time tint on the crouch pose; the standing hit's baked red frame is left unchanged.

**Independent Test**: Crouch and take an enemy / non-floor-spike hazard / bomb-blast hit — health drops, a red reaction plays on the crouch pose, and the character is not displaced in any direction or turned; repeat under the corridor ceiling and the debug box stays one tile for the whole window. Take the same hit standing — unchanged baked red frame with the usual knockback. A crouched floor-spike hit is unchanged (`beginPitFallReaction`).

> This phase has no user story of its own — the spec places it under Edge Cases ("Taking a hit while crouched"). It depends on US4 (the `'crouch'` pose used by the tint) and on US1/US2 (the `crouching` flag and its hit-reaction freeze).

### Tests for the crouched hit reaction ⚠️ (write first, confirm they FAIL)

- [X] T028 [P] Add failing unit tests to `src/themes/platformer/entities/Player.test.ts` for `applyHitReaction` (`contracts/crouched-hit-reaction.md` §2, `contracts/crouch-physics.md` invariants 11–12): it sets `hitTimer: 0`, `animState: 'hit'`, `animFrame: 0`, `animTimer: 0`, and leaves `vx`, `direction`, `knockbackTimer`, `vy` and `bounceAscending` identical to the input; after the helper `isInvulnerable(result, PLAYER_HIT_REACTION_SECONDS)` is true and `resolveCrouching({ ..., inHitReaction: true, currentlyCrouching: true })` returns `true` (the one-tile box is kept for the window). Use `{method}-{condition}-{expectedResult}` names. Run `npm test` and confirm these fail.
- [X] T029 [P] Add failing cases to `src/themes/platformer/engine/Renderer.test.ts` using a fake offscreen layer (reuse the `makeLightingLayer`/`makeLightingContext` pattern): `drawTintedSprite` sets the layer's `globalCompositeOperation` to `source-atop` while filling the tint and restores `source-over`, draws the frame scaled to `destSize` on the layer, and composites `ctx.drawImage(layer, 0, 0, destSize, destSize, destX, destY, destSize, destSize)`; a layer whose `getContext` returns `null` falls back to a plain `ctx.drawImage` of the frame and never throws. Then, for `drawPlayer`: `crouching: true, animState: 'hit'` with a tint layer resolves the frame from `playerFrameSource('crouch', animFrame)` (`sy = PLAYER_FRAME_SIZE * 8`) and composites the layer; with no layer it still draws that same crouch pose plainly (never the baked `hit` row); `crouching: false, animState: 'hit'` still draws the baked frame (`sy = PLAYER_FRAME_SIZE * 6`) directly and never touches the layer (`contracts/rendering-animation.md` invariants 6–7). Use `{method}-{condition}-{expectedResult}` names. Run `npm test` and confirm these fail.
- [X] T030 [P] Add failing cases to `src/themes/platformer/PlatformerPage.test.tsx`: a crouched enemy hit (including the `awayAndUp` contact) deals damage and sets `animState: 'hit'` but leaves `x`, `y`, `vx`, `direction`, `vy` and `bounceAscending` unchanged; a crouched non-floor-spike hazard and a crouched bomb blast likewise add no `vx`; a standing enemy hit still applies `vx` and (for `awayAndUp`) `vy`; a crouched floor-spike hit is unchanged (`beginPitFallReaction`, no `animState` change) (`contracts/crouched-hit-reaction.md` invariants 3–4, 6). Use `{method}-{condition}-{expectedResult}` names. Run `npm test` and confirm these fail.

### Implementation for the crouched hit reaction

- [X] T031 Implement `applyHitReaction(player: PlayerState): PlayerState` in `src/themes/platformer/entities/Player.ts`, returning `{ ...player, hitTimer: 0, animState: 'hit', animFrame: 0, animTimer: 0 }` and touching nothing else, with the doc comment from `research.md` D13 (`contracts/crouched-hit-reaction.md` §2). Run `npm test` and confirm T028 passes.
- [X] T032 Implement `drawTintedSprite(ctx, layer, sheet, sx, sy, frameSize, destX, destY, destSize, tint)` and the `CROUCH_HIT_TINT` constant (`rgba(230, 40, 40, 0.6)`) in `src/themes/platformer/engine/Renderer.ts` per `contracts/rendering-animation.md` §`drawTintedSprite`: get the layer context (plain `ctx.drawImage` fallback when `null`), clear to `destSize`, draw the frame scaled with `source-over`, set `source-atop` + `fillRect(0, 0, destSize, destSize)` in `tint`, composite the layer onto `ctx`, then restore `source-over`. Reuse the caller-owned-layer pattern `drawDarkness` already establishes.
- [X] T033 Add the eighth optional parameter `tintLayer: HTMLCanvasElement | null = null` to `drawPlayer` in `src/themes/platformer/engine/Renderer.ts` and the `player.crouching && player.animState === 'hit'` branch: resolve the frame from `playerFrameSource('crouch', player.animFrame)`, draw it through `drawTintedSprite` with `CROUCH_HIT_TINT` when a layer is given (mirrored through the existing `save`/`translate`/`scale` path when facing left), otherwise draw that same crouch pose plainly; leave the `crouching: false` hit path byte-for-byte unchanged. Run `npm test` and confirm T029 passes.
- [X] T034 Add `hitTintLayerRef` — a caller-owned 64×64 `HTMLCanvasElement`, created once in `resize()` beside `darknessLayerRef` — in `src/themes/platformer/PlatformerPage.tsx`, and pass it as `drawPlayer`'s eighth argument in `render()` (no per-frame allocation).
- [X] T035 Branch on `player.crouching` at the three directional damage sites in `src/themes/platformer/PlatformerPage.tsx`: the enemy contact (~L1741) uses `applyHitReaction` and skips the `awayAndUp` `vy`/`bounceAscending` when crouched; the non-floor-spike hazard (~L1819) and the bomb blast (~L2163) likewise; the floor-spike path (~L1813) keeps `beginPitFallReaction`; the standing path is unchanged. Run `npm test` and confirm T030 passes.
- [ ] T036 Browser-check the crouched hit per `quickstart.md` §7 (`npm run dev`, `?debug=hitboxes`): on plain ground and inside the corridor, confirm the red reaction plays on the crouch pose, there is no horizontal slide, no upward pop and no facing change, the box stays one tile for the whole window, and the standing hit still shows the baked red frame with the usual knockback (SC-009). Record the result in the feature notes.

**Checkpoint**: A crouched hit is damage + red reaction with no displacement and no forced stand; the standing hit is unchanged.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Onboarding, state-lifecycle verification, end-to-end integration coverage, docs and completion tracking.

- [X] T037 [P] Add the `crouch` caption key to `src/i18n/locales/en.json` (`"Crouch"`) and `src/i18n/locales/de.json` (`"Ducken"`) under `platformer.controlsOverlay` (both locales must gain the same key — `de.json` is typed as `Translation`) (`contracts/onboarding-level.md` §A).
- [X] T038 Render a second caption in `src/themes/platformer/components/ControlsOverlay.tsx` for `ui.platformer.controlsOverlay.crouch`, inside the arrow cluster's own width with the existing absolutely-positioned `left: <percent>%` / `-translate-x-1/2` pattern, shifting the `move` caption left so the two do not overlap. Add the new percent as a named constant beside `MOVE_LABEL_CENTER_PERCENT`.
- [X] T039 Add a case to `src/themes/platformer/components/ControlsOverlay.test.tsx` asserting the crouch caption renders from i18n alongside the existing `move`/`jump`/`journal`/`interact` captions.
- [X] T040 Add end-to-end integration cases to `src/themes/platformer/PlatformerPage.test.tsx`: hold Down on plain ground → `crouching: true`; release → standing; crawl under a one-tile ceiling; Jump produces no jump while crouched; Down on a ladder/bridge behaves exactly as before. Include a reset case proving crouch never persists across `resetGame`/`resetGameProgress`.
- [X] T041 [P] Update `docs/themes/platformer/Entities.md` to document the player's new `crouching` state, the shared `playerHeadPaddingFor`/`playerBoxHeightFor` box, the headroom test, the Down priority order and the no-knockback crouched hit (`applyHitReaction`).
- [ ] T042 Conditional sign fallback — implement ONLY if the T038 browser check shows the legend caption crowds the overlay in either locale (FR-015: the legend and the sign are alternatives, never both). If needed: add `crouch` to `platformer.hints` in both locale files, map `'7'` to `'crouch'` in `SIGN_CHARS` and add `'7'` to `TileChar` in `src/themes/platformer/level/LevelParser.ts`, place a `7` marker beside the corridor in `src/themes/platformer/level/level.ts`, cover it in `src/themes/platformer/level/LevelParser.test.ts`, and update `docs/themes/platformer/LevelFormat.md`. This is a sign-marker addition through the existing S-009 mechanism, not a terrain tile or terrain-format change, so FR-013/SC-005 still hold. Otherwise skip and note the decision.
- [ ] T043 [P] Run the `quickstart.md` manual browser verification end to end (`npm run dev`, `?debug=hitboxes`), including the SC-008 consumer checks, the §7 crouched-hit checks and the edge cases (airborne crouch, hit reaction, respawn/reset, theme switch).
- [X] T044 Update `docs/Features.md` completion tracking per `AGENTS.md`: prefix the `S012` node label with `✅ ` and add `class S012 done` alongside its existing category class.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. T002 must land before T004/T005/T006/T008 (they need the field/helpers); T007 depends on T006; T003 is independent. **BLOCKS all user stories.**
- **User Stories (Phases 3–6)**: All depend on Foundational. Within the P1 group they are naturally sequential because US1, US2 and US3 all edit `engine/Physics.ts`; US4 edits a different file (`entities/Player.ts`) and can run in parallel with the P1 work.
- **Crouched Hit Reaction (Phase 7)**: Depends on Foundational (T002's `crouching` field and T007's `inHitReaction` freeze) and on US4 (T025 supplies `playerFrameSource('crouch', ...)` for the renderer tint tests). Its `PlatformerPage.tsx` edits build on US1's `crouching` flag. Independent of US2/US3 at the file level.
- **Polish (Phase 8)**: Depends on all desired user stories and on Phase 7.

### User Story Dependencies

- **US1 (P1)**: After Foundational. No dependency on other stories.
- **US2 (P1)**: After Foundational; builds on US1's `Physics.ts` integration (T013).
- **US3 (P1)**: After Foundational; builds on US1's `Physics.ts` integration (T013). Independently testable via the ladder/bridge priority cases.
- **US4 (P2)**: After Foundational; independent of US1–US3 at the file level (different file) but its pose is only reachable once US1 sets `crouching`.
- **Crouched Hit Reaction (Phase 7, FR-011/FR-016/SC-009)**: After US4; the `applyHitReaction` slice is independent of the render-tint slice at the file level (`entities/Player.ts` vs `engine/Renderer.ts`), and both are independently testable.

### Within Each User Story

- Tests (T009–T012, T017, T020, T023–T024, T028–T030) MUST be written and FAIL before the matching implementation.
- Shared box geometry (T002) before `Physics.ts`/`Collision.ts` edits.
- Core integration before end-to-end coverage.
- Phase 7: helper test (T028) before helper (T031); renderer tests (T029) before `drawTintedSprite`/`drawPlayer` (T032/T033); call-site test (T030) before the branch (T035).

### Parallel Opportunities

- Foundational: T003, T004, T005 and T008 can run in parallel once T002 lands (different files); T006 must precede T007.
- US1: T010, T011, T012 are `[P]` (different test files) and can be written together; T013/T014/T015/T016 are separate files and can be worked in parallel after the tests exist.
- US4: T024 is `[P]` against the US1/US2/US3 work.
- Phase 7: T028, T029 and T030 are `[P]` (different test files); T031 (`entities/Player.ts`) and T032/T033 (`engine/Renderer.ts`) can be done in parallel; T034/T035 (`PlatformerPage.tsx`) follow their dependencies.
- Polish: T037, T041, T043 are `[P]` (different files).

---

## Parallel Example: User Story 1

```bash
# Write the US1 test tasks together (different files):
Task: "T010 [P] [US1] Add crouched-box cases to engine/Collision.test.ts"
Task: "T011 [P] [US1] Add corridor cases to level/level.test.ts"
Task: "T012 [P] [US1] Update engine/DebugOverlay.test.ts head-line fixtures"

# Then implement the four independent US1 source edits together:
Task: "T013 [US1] Implement crouch integration in engine/Physics.ts"
Task: "T014 [US1] Update Collision.playerHitbox in engine/Collision.ts"
Task: "T015 [US1] Update the DebugOverlay head line in engine/DebugOverlay.ts"
Task: "T016 [US1] Author the low corridor in level/level.ts"
```

## Parallel Example: Foundational

```bash
Task: "T003 [P] Add crouchSpeed to engine/PhysicsConfig.ts"
Task: "T004 [P] Seed crouching:false in PlatformerState.ts"
Task: "T005 [P] Seed crouching:false in editor/gridRenderState.ts"
Task: "T008 [P] Add crouching:false to every PlayerState test fixture"
```

## Parallel Example: Crouched Hit Reaction

```bash
# Write the three test tasks together (different files):
Task: "T028 [P] Add applyHitReaction cases to entities/Player.test.ts"
Task: "T029 [P] Add drawTintedSprite/drawPlayer tint cases to engine/Renderer.test.ts"
Task: "T030 [P] Add crouched-hit call-site cases to PlatformerPage.test.tsx"

# Then the two independent source edits together:
Task: "T031 Implement applyHitReaction in entities/Player.ts"
Task: "T032 Implement drawTintedSprite + CROUCH_HIT_TINT in engine/Renderer.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 2: Foundational (T002–T008) — **CRITICAL**, blocks everything.
3. Complete Phase 3: User Story 1 (T009–T016).
4. **STOP and VALIDATE**: `npm test` plus the `quickstart.md` §1 browser check.
5. Deploy/demo the MVP if ready.

### Incremental Delivery

1. Setup + Foundational → shared box and pure decision module ready.
2. US1 → crouch, crawl, no jump, corridor (MVP).
3. US2 → headroom gate, auto-stand, no clipping.
4. US3 → Down priority verified, ladder/bridge unregressed.
5. US4 → distinct, animated crouch pose.
6. Crouched Hit Reaction → no-knockback hit + reusable render-time red tint (FR-011/FR-016/SC-009).
7. Polish → onboarding, end-to-end coverage, docs, completion tracking.

### Notes

- [P] tasks touch different files and have no incomplete dependencies.
- The `canStand`/`inHitReaction`/`downClaimed` placeholders in T013 are deliberate: T018 (US2) and T021 (US3) replace them, so each P1 story owns its own slice of the crouch decision.
- **Superseded assumption**: the earlier task list (and an earlier draft of `research.md` D10) stated that `Renderer.ts` needs no edit. That is no longer true — `drawPlayer` needs exactly one edit for the crouched-hit tint branch (T033). A *non-hit* crouch still takes the unchanged `playerFrameSource` path (T024); the standing hit's baked red frame is untouched.
- Verify each test task FAILS before its implementation task, then confirm it passes.
- Commit after each task or logical group, but only when the user asks (`AGENTS.md`: no auto-commits).

## Implementation Notes (this run)

- **Corridor row numbering (T011/T016).** The corridor is authored at 0-based
  `LEVEL_1_LAYOUT` array rows **8 (ceiling `G`, added) / 9 (corridor, empty) /
  10 (floor `G`, existing)**, columns 89–94 — exactly one tile of clearance. The
  `?` block is at row 7 / col 88 and the bee at row 8 / col 95, both avoided.
  An earlier revision of the design contract numbered these rows 7/8/9 (off by
  one); the contract, `research.md` D12, `data-model.md` and these tasks were
  corrected to 8/9/10 to match the array. `level.test.ts` asserts the actual
  rows; `level.ts`'s top doc comment describes the corridor.
- **Browser checks not performed (T027, T036, T043).** The implementation environment has
  no browser/display, so the `quickstart.md` manual checks (pose legibility, crouched-hit
  feel, SC-008 consumer behaviour, edge cases) remain **pending manual verification**.
  The automated suite covers the same behaviours as unit/integration assertions.
- **Bug fix after browser review (FR-009).** Two follow-ups from in-browser play:
  1. *Ladder base / crawling past a ladder:* holding Down popped the character out of the
     crouch and grabbed the ladder, because the climb fresh-entry and `downClaimed`
     treated any feet-row ladder overlap as a climb. Fixed: a grounded character only
     claims Down for a ladder when a ladder tile is directly below the feet (or it is
     airborne); otherwise Down crouches.
  2. *Crawling onto a bridge:* holding Down dropped the character through the bridge.
     Fixed: crouch wins while already crouched — the bridge drop and `downClaimed`'s
     bridge term require `!player.crouching`. A standing press of Down on a bridge still
     drops; from a crouch, release Down (stand) then press again.
  3. *Stuck crouched beside a pot:* releasing Down next to a pot left the character
     crouched. Cause: `canStandUp` treated a block's whole tile as solid, so a pot whose
     art is narrower than its tile (per-kind `hitboxInsetX`) blocked standing whenever the
     player's hitbox merely overlapped the pot's *tile column*, even with no real overlap.
     Fixed: `canStandUp` now tests each block against its real collision box (with the
     inset), matching `Physics.ts`'s horizontal collision.
  4. *Crouched red tint stayed solid for the whole hit window:* the render-time tint was
     applied continuously for all 0.8s, unlike the standing hit which only flashes red on
     the `hit` row's red frame. Fixed: the tint is applied only when
     `hitFrameFromTimer(hitTimer) === HIT_RED_FRAME_INDEX` (0.1s out of every 0.3s), so it
     pulses at the standing flash's cadence.
  Covered by `Physics.ts` (climb entry, `downClaimed`, bridge drop) and `engine/Crouch.ts`
  (`canStandUp`) plus tests in `Physics.test.ts` and `engine/Crouch.test.ts`. Existing
  S-008 descend/ascend and standing bridge-drop assertions still pass unchanged.
- **T042 sign fallback: NOT implemented (legend caption shipped).** The contract makes
  the sign a fallback that ships only if the browser check shows the legend caption
  crowding the overlay (FR-015: the two are alternatives, never both). With no browser
  check available, the primary legend caption (T037/T038/T039) ships alone; the `7`
  sign-marker fallback was deliberately left out. If a manual check later shows crowding,
  T042 is the follow-up.
- All other tasks (T001–T026, T028–T035, T037–T041, T044) are complete; `npm test`
  (155 files / 3481 tests), `npx tsc -b`, and `npm run lint` are all green.
