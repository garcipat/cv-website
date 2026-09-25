---

description: "Task list for feature R-006 Platformer Pickup Unification"
---

# Tasks: Platformer Pickup Unification (R-006)

**Input**: Design documents from `/specs/R-006-platformer-pickup-unification/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (source of truth — just amended), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **REQUIRED** — constitution Principle II is NON-NEGOTIABLE: TDD (Vitest) with tests written/reviewed before implementation. This is a behaviour-preserving refactor, so every existing scenario, eligibility gate and reset scope MUST stay asserted; tests may be relocated/re-expressed around the new generic API and the flag-based collection storage, but MUST NOT be deleted, skipped or weakened (FR-010/SC-004/SC-008).

**Organization**: Tasks are grouped by user story so each story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Every task includes an exact file path under `src/themes/platformer/` unless stated otherwise

## Path Conventions

Single self-contained theme tree at `src/themes/platformer/` (per plan.md). No new top-level project; `contracts/` is a strict leaf.

## Ground rules carried into every task (from spec.md + plan.md)

- **Collect-once is ONE mechanism (SC-008):** `collected: boolean` on the shared `contracts/Pickup.ts` model. Every pickup is **stored and flagged**; nothing is removed on collect. There is no `PickupDisposition`, no `PickupOutcome.self`, no per-kind `isVisible`, no external `collectedCollectibleIds` set, and no per-kind removal special case.
- **Permanence is reset scope alone (FR-009):** `resetGame()` keeps the coin/fruit/key arrays (flags intact) and clears the heart/bomb arrays + placed bombs; `resetGameProgress()` clears every pickup array and re-derives the placed coins `collected: false`.
- **Base coins are mutable level-derived state (FR-006):** `collectiblePlacements` is the pure, level-derived computed (read by `levelTotals`, never invalidated by a collect/pot drop); `baseCoinPlacements` is the mutable flag-carrying signal, re-derived on level change / full reset; `allCollectiblePlacements = baseCoinPlacements + spawnedCoinPlacements`.
- **One home per concept (FR-011):** deleted functions/modules MUST NOT survive as thin re-exports, aliases, shims or second code paths.
- **Documented deviation from issue #94:** the live `'fruit'` kind STAYS (question-mark reward fruit). Only the already-dead placed-fruit artifacts are retired. Do NOT drop `'fruit'` from `PickupKind` or `entities/pickups/Fruit.ts`.
- **No auto-commit; no auto-advance.** Do not run `/speckit.analyze` or `/speckit.implement` from this step.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the green baseline and confirm a pure refactor needs no environment change.

- [X] T001 Confirm branch `R-006-platformer-pickup-unification` and capture the pre-refactor baseline: run `npm test` and `npm run build`; record any pre-existing failure so it is not later attributed to this refactor.
- [X] T002 [P] Confirm the feature needs no dependency/config/data change (constitution V, spec Assumptions): leave `package.json`, `vite.config.ts`/`vitest.config.ts`, and `src/data/` untouched.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared `contracts/` vocabulary every pickup kind and the generic engine import downward. No user-story work can start until these exist.

**⚠️ CRITICAL**: `contracts/` MUST stay a strict leaf — `contracts/Pickup.ts` imports only `./PickupKind`, `../types` and `./counters`. No `contracts/ → level/` or `contracts/ → entities/` edge (FR-008/SC-007).

- [X] T003 [P] Write the type-level contract test `src/themes/platformer/contracts/Pickup.test.ts` (tests-first) asserting `Pickup` exposes `id: string`, `x: number`, `y: number`, `kind: PickupKind`, `collected: boolean`, and that `PickupGroups = Partial<Record<PickupKind, readonly Pickup[]>>` accepts a partial map.
- [X] T004 [P] Write the type-level contract test in `src/themes/platformer/contracts/Pickup.test.ts` (tests-first; the outcome-contract describes are merged into the `Pickup` contract test after the module merge) asserting `PickupCollisionContext` carries `playerHitPoints` + optional `capacity` and **no** `collectedIds`; `PickupContext` carries `pool`/`total`/`collectedBefore`; `PickupOutcome` carries only consequences (`facts`/`counterKey`/`heal`/`bombs`/`bankKey`/`flyingText`) with **no** `self` and no `disposition`.
- [X] T005 [P] Create `src/themes/platformer/contracts/Pickup.ts` with the `Pickup` base (`id`, `x`, `y`, `kind: PickupKind`, `collected: boolean`) and `PickupGroups`; leaf (imports only `./PickupKind`).
- [X] T006 [P] Create `src/themes/platformer/contracts/Pickup.ts` with the `Pickup` model + `PickupGroups` and the collect-outcome vocabulary (`PickupReveal`, `PickupCollisionContext`, `PickupContext`, `PickupOutcome`); no `PickupDisposition`, no `self`, no `collectedIds`; leaf (imports only `./PickupKind`, `../types` and `./counters`). (Post-implementation: the outcome vocabulary was merged into `Pickup.ts`, so no separate `PickupOutcome.ts` exists.)

**Checkpoint**: `contracts/` leaf vocabulary exists; user-story work can begin.

---

## Phase 3: User Story 1 - One discriminator, one collision path, one draw path (Priority: P1) 🎯 MVP

**Goal**: Every pickup state carries a `kind` and the shared `collected` flag; one generic `checkPickupCollisions` and one generic `drawPickups` (invoked at three depth bands) replace the five family-specific collision functions and five draw wrappers, and the page names no pickup kind.

**Independent Test**: Search the theme for `checkCollectibleCollisions`, `checkFruitCollisions`, `checkKeyPickupCollisions`, `checkHeartPickupCollisions`, `checkBombPickupCollisions`, `drawCollectibles`, `drawKeyPickups`, `drawHeartPickups`, `drawBombPickups`, `drawFruits` — gone, replaced by one `checkPickupCollisions` and one `drawPickups` dispatching on `kind`; the page contains no comparison against a pickup kind name.

> **Note on the collect applier.** Deleting the five family collision functions requires the page's collect path to move in the same increment, so US1 also lands the shared applier and each kind's `onPickup` (collect consequences). The `spawn` seam is US2.

### Tests for User Story 1 (REQUIRED — write first, ensure they FAIL) ⚠️

- [X] T007 [P] [US1] Restructure `src/themes/platformer/engine/Collision.test.ts` around `checkPickupCollisions` (five family describes → one generic API). Preserve every scenario/eligibility gate and re-express the coin collect-once fixture as a `collected: true` entry (replacing the old `collectedIds` set fixture — not a weakened assertion): coin excludes a `collected:true` entry and returns two uncollected placements in order; fruit rise gate (`elapsed >= FRUIT_RISE_DURATION_SECONDS`, mid-rise excluded); key collect-once; heart full-health exclusion (`ctx.playerHitPoints >= MAX_HALF_HEARTS`); bomb clamp `max(0, cap - count)` in array order with none at the cap; the crouched/standing head-band coin scenario.
- [X] T008 [P] [US1] Restructure `src/themes/platformer/engine/Renderer.test.ts` around `drawPickups` (five draw-wrapper describes → one; no collected-id-set argument). Preserve every visual assertion: coin frame/bob/size/per-type index stability + `collected:true` skip; fruit drawn at its stored `y` and in the `belowBlocks` band; key non-square size/bottom anchoring + skip; heart/bomb size/offset + empty-array no-op; the combined visual-order test via the three band calls.
- [X] T009 [P] [US1] Update `src/themes/platformer/entities/pickups/index.test.ts` and `src/themes/platformer/entities/pickups/PickupType.test.ts` (tests-first): every `PICKUP_TYPES` entry declares a `key`/`drawLayer`; each state's `kind` equals its registry slot and exposes a boolean `collected` (SC-002); fixtures switch `spriteType` → `kind`/`collected`; the bomb non-collectible assertion uses `kind`. Also keep `src/themes/platformer/entities/WorldType.test.ts` iterating `PICKUP_TYPES` with the `kind === slot` assertion.

### Implementation for User Story 1

- [X] T010 [P] [US1] `src/themes/platformer/level/CollectibleMapper.ts`: make `CollectiblePlacement extends Pickup { kind: 'coin' }` and remove `spriteType`; `placeCollectibles` emits `{ id, kind: 'coin', x, y, collected: false }`; update the stale `collectedCollectibleIds` doc comment. Update `src/themes/platformer/level/CollectibleMapper.test.ts` (`spriteType` → `kind`/`collected`).
- [X] T011 [P] [US1] `src/themes/platformer/entities/Fruit.ts`: make `FruitState` compose `Pickup` (`kind: 'fruit'`, stored `x`/`y`/`collected`) plus `startY`/`restY`/`elapsed`/`fact?`/`iconIndex`; `spawnFruit` seeds `y = startY`, `collected: false`; `tickFruit` updates the stored `y` from the existing easing (`clamp01(elapsed / FRUIT_RISE_DURATION_SECONDS)` between `startY` and `restY`) so positions are byte-identical; `fruit.box`/the page reveal read `fruit.y`. Update `src/themes/platformer/entities/Fruit.test.ts` to assert the stored `y` agrees with the easing at rest/mid-rise.
- [X] T012 [P] [US1] `src/themes/platformer/entities/KeyPickup.ts`: compose `Pickup` (`kind: 'key'`, `collected` from the base) and remove the key's inline `collected` field; `spawnKeyPickup` seeds `collected: false`. Update `src/themes/platformer/entities/KeyPickup.test.ts`.
- [X] T013 [P] [US1] `src/themes/platformer/entities/HeartPickup.ts`: compose `Pickup` (`kind: 'heart'`, `collected: false`); every constant/offset/size numerically unchanged. Update `src/themes/platformer/entities/HeartPickup.test.ts`.
- [X] T014 [P] [US1] `src/themes/platformer/entities/BombPickup.ts`: compose `Pickup` (`kind: 'bomb'`, `collected: false`); every constant/offset/size numerically unchanged. Update `src/themes/platformer/entities/BombPickup.test.ts`.
- [X] T015 [US1] `src/themes/platformer/entities/pickups/PickupType.ts`: constrain `S extends Pickup = Pickup`, change `key: string` → `key: PickupKind`, add `drawLayer: PickupDrawLayer` ('belowBlocks' | 'beforeEnemies' | 'afterEnemies'), optional `isCollectible?(state, ctx)`, optional `maxPerTick?(ctx)`, and non-optional `onPickup(state, ctx): PickupOutcome` (consequences only). Remove the "no lifecycle / per-family collected" doc comment. Do NOT add `isVisible` (it does not exist; keep it absent).
- [X] T016 [US1] Give every kind its own band, extra gate and collect consequences in `src/themes/platformer/entities/pickups/{Coin,Fruit,Key,Heart,Bomb}.ts`: `key` + `drawLayer` (`coin` = `beforeEnemies`; `fruit` = `belowBlocks`; `key`/`heart`/`bomb` = `afterEnemies`); `isCollectible` (fruit: `elapsed >= FRUIT_RISE_DURATION_SECONDS`; heart: `ctx.playerHitPoints < MAX_HALF_HEARTS`); `maxPerTick` (bomb: `ctx.capacity ?? 0`); `onPickup` (coin: paced `facts` via `level/SkillFactPacing` + `counterKey: 'coins'`; fruit: `state.fact` + `counterKey: 'fruits'`; key: `bankKey: true` + `flyingText` target `keyCounter`; heart: `heal: HEART_PICKUP_HEAL_AMOUNT`; bomb: `bombs: 1`).
- [X] T017 [US1] `src/themes/platformer/entities/pickups/index.ts`: change the registry to `export const PICKUP_TYPES: Record<PickupKind, PickupType<Pickup>> = { coin, fruit, key, heart, bomb };` (the `Record` annotation preserves the compile-time pin). Also update the now-stale `satisfies Record<PickupKind, unknown>` doc comment in `src/themes/platformer/contracts/PickupKind.ts`, and refresh `src/themes/platformer/entities/pickups/index.ts`'s own doc comment (it still claims "pickups live in separate homogeneous arrays … no dispatcher is needed" and a `satisfies` pin), to describe the `Record<PickupKind, …>` pin.
- [X] T018 [US1] `src/themes/platformer/engine/Collision.ts`: add `PickupHit { kind; state }` and `checkPickupCollisions(player, groups, ctx)` — per kind use `overlappingTriggers` with base gate `!s.collected && (PICKUP_TYPES[kind].isCollectible?.(s, ctx) ?? true)`, then `maxPerTick?.(ctx)` slice, concatenated in `groups` insertion order. **Delete** (not re-export — FR-011) `checkCollectibleCollisions`, `checkFruitCollisions`, `checkKeyPickupCollisions`, `checkHeartPickupCollisions`, `checkBombPickupCollisions`; keep `overlappingTriggers`/`aabbOverlap`.
- [X] T019 [US1] `src/themes/platformer/engine/Renderer.ts`: add `drawPickups(ctx, groups, dc, layer?)` — filter kinds by `PICKUP_TYPES[kind].drawLayer`, track a per-kind index over **all** items (incremented before the visibility test), skip `item.collected`, then `PICKUP_TYPES[kind].draw(item, dc, index)`. **Delete** (not re-export — FR-011) `drawCollectibles`, `drawFruits`, `drawKeyPickups`, `drawHeartPickups`, `drawBombPickups`.
- [X] T020 [US1] `src/themes/platformer/PlatformerState.ts`: add the mutable `baseCoinPlacements: Signal<CollectiblePlacement[]>` (initialised from the pure `collectiblePlacements` with each entry normalised to `collected: false`) and `allCollectiblePlacements = computed(() => [...baseCoinPlacements.value, ...spawnedCoinPlacements.value])`; keep `collectiblePlacements` pure (still the source for `levelTotals`'s coin count); add `PickupStore` + `pickupStores` (kind→array adapter with `items`/`append`/`markCollected(ids)` where the coin store updates **both** base and spawned arrays) and `pickupGroups`; **delete** `collectedCollectibleIds`; rewrite `coinsCollectedSoFar` as the count of `allCollectiblePlacements` entries with `collected === true`; switch all `spriteType === 'coin'` filters to `kind === 'coin'`; update the stale `collectedCollectibleIds` doc comments in `src/themes/platformer/types.ts` and `src/themes/platformer/PlatformerState.ts` (the `resetGame` doc ~line 950 still names the deleted set).
- [X] T021 [US1] `src/themes/platformer/PlatformerPage.tsx` (the ~1385–1567 collect region): replace the five family collision calls with one `checkPickupCollisions(playerState.value, pickupGroups.value, { playerHitPoints: playerState.value.hitPoints, capacity: Math.max(0, MAX_BOMBS - carriedBombs.value) })` feeding one shared applier: per hit compute `PickupContext` from the **pre-tick** state (`collectedBefore` = this kind's already-flagged count; coin `pool`/`total` from `levelTotals`), call `PICKUP_TYPES[kind].onPickup`, set the flag via `pickupStores[kind].markCollected(new Set(hits.map(h => h.state.id)))`, then apply `facts`/`counterKey`/`heal`/`bombs`/`bankKey`/`flyingText` uniformly. Seed `collectedBefore` from the pre-tick flagged count and advance it per processed hit (the current `coinsCollectedSoFar` staging) so multiple coins touched in one tick reveal successive fact windows (FR-009). No kind-name branch and no removal/`.filter` of collected entries remains.
- [X] T022 [US1] `src/themes/platformer/PlatformerPage.tsx` (the ~804/867–875 draw region): replace the five draw calls with `drawPickups(ctx, pickupGroups.value, drawContext, …)` at the three bands — `belowBlocks` before `drawBlocks`, `beforeEnemies` after `drawEffects(…, 'midWorld')` and before `drawEnemies`, `afterEnemies` after `drawEnemies`; read `pickupGroups.value` once per frame.
- [X] T023 [US1] `src/themes/platformer/editor/EditorCanvas.tsx`: route the preview through `drawPickups(ctx, { coin: synthesizeCollectiblePlacements(grid) }, drawContext)` with every placement `collected: false` and no id-set argument. Update `src/themes/platformer/editor/EditorCanvas.test.tsx` (`drawCollectibles` mock/assertion → `drawPickups`, assert `objectContaining({ kind: 'coin', collected: false })`), and rename the Renderer mock in `src/themes/platformer/editor/EditorToolbar.test.tsx` and `src/themes/platformer/editor/LevelEditorPage.test.tsx`. In `LevelEditorPage.test.tsx`, also replace the `collectedCollectibleIds` fixtures (lines ~784/792) with `baseCoinPlacements` flag re-derivation so the deleted export is not still imported.
- [X] T023a [US1] `src/themes/platformer/components/Journal.tsx`: replace the `collectedCollectibleIds` coin count (line ~464, `p.spriteType === 'coin' && collectedCollectibleIds.value.has(p.id)`) with `allCollectiblePlacements.value.filter((p) => p.kind === 'coin' && p.collected).length`. Update `src/themes/platformer/components/Journal.test.tsx` (imports + fixtures at lines ~8/54/591/622): drop the `collectedCollectibleIds` import and set base-coin `collected` flags instead (FR-010/SC-008; the deleted set must not survive as a consumer).

**Checkpoint**: One generic collision path and one generic draw path on `kind`; no page kind-name branch; US1 independently testable and green via T007–T009.

---

## Phase 4: User Story 2 - Spawning and collecting are declared by the pickup kind (Priority: P1)

**Goal**: Each kind's own module owns how it is created from a source via `PickupType.spawn`; the page's block terminal-outcome `if/else` is deleted and replaced by one generic spawn path. (The collect half — `onPickup` + shared applier — landed in US1 because the family collision functions could not be removed without it; US2 completes the seam and re-verifies the collect declaration.)

**Independent Test**: The page's block terminal-outcome dispatch contains no `=== '<pickupKind>'` branch and no direct per-kind spawn helper call; a block's declared drop drives `PICKUP_TYPES[kind].spawn(...)`; each kind's collect consequences are produced by its own module (US1) and applied by the shared applier.

### Tests for User Story 2 (REQUIRED — write first, ensure they FAIL) ⚠️

- [X] T024 [P] [US2] Extend `src/themes/platformer/entities/pickups/index.test.ts` and the per-kind tests (tests-first) to assert each kind's `spawn(source)` seeds `collected: false` and the correct `kind`, preserves the source id/position convention, and that the lazy `iconIndex` supplier is only invoked for the fruit kind (counter progression unchanged). Extend `src/themes/platformer/PlatformerPage.test.tsx` with a spawn-from-block scenario driven by an outcome's `spawnPickup` and assert no page kind-name branch (`spawnPickup` other than the declared kind is not special-cased).

### Implementation for User Story 2

- [X] T025 [US2] `src/themes/platformer/entities/pickups/PickupType.ts`: add `PickupSpawnSource { id; x; y; fact?; iconIndex?: () => number }` and the non-optional `spawn(source: PickupSpawnSource): S`.
- [X] T026 [US2] Implement `spawn` for every kind in `src/themes/platformer/entities/pickups/{Coin,Fruit,Key,Heart,Bomb}.ts`, reusing each existing factory (`spawnFruit`, `spawnKeyPickup`, `spawnHeartPickup`, `spawnBombPickup`) and emitting `{ id, kind: 'coin', x, y, collected: false }` for coin; keep each factory's id/position/icon convention and lazy `iconIndex`. (US3 relocates the factories into these same modules; T036 retargets the imports.)
- [X] T027 [US2] `src/themes/platformer/PlatformerPage.tsx` (~2047–2084 block terminal-outcome region): replace the `spawnPickup === 'fruit' / 'coin' / 'heart' / 'bomb'` chain with one generic path — `pickupStores[kind].append(PICKUP_TYPES[kind].spawn({ id: block.id, x: block.x, y: block.y, fact: block.fact, iconIndex: () => nextFruitIcon++ }))`. No `=== '<pickupKind>'` branch remains.
- [X] T028 [US2] Update `src/themes/platformer/PlatformerPage.test.tsx` pickup scenarios to the new shapes: key bank + flag, heart heal/full-health wait, bomb cap (below/at), coin pacing from flagged entries, block spawn, reset scopes — every assertion preserved (only `kind`/`collected` shape updates allowed).

**Checkpoint**: Adding a block-drop pickup kind needs only its module + one `PICKUP_TYPES` line; the page spawns/collects generically.

---

## Phase 5: User Story 3 - Each pickup family is one module under `entities/pickups/` (Priority: P2)

**Goal**: Each pickup's state/constants and its `PickupType` view merge into exactly one self-contained module under `entities/pickups/`; the top-level state modules are deleted (no re-export); the `sprites/sheets.ts` cycle hazard is resolved.

**Independent Test**: No pickup state module remains directly under `src/themes/platformer/entities/`; each of bomb/heart/key/coin/fruit resolves from one module under `entities/pickups/` owning both state and view; `entities/Health.ts` and `entities/Torch.ts` are unchanged in place; every constant/offset/size numerically unchanged.

### Tests for User Story 3 (REQUIRED — write first) ⚠️

- [X] T029 [P] [US3] Move/merge the co-located test files `src/themes/platformer/entities/{Fruit,Coin,KeyPickup,HeartPickup,BombPickup}.test.ts` into `src/themes/platformer/entities/pickups/{Fruit,Coin,Key,Heart,Bomb}.test.ts` (tests-first), merging them with each view's existing coverage; no case dropped; per-kind collect tests assert the entry is retained with `collected: true`.

### Implementation for User Story 3

- [X] T030 [P] [US3] Merge `src/themes/platformer/entities/Fruit.ts` into `src/themes/platformer/entities/pickups/Fruit.ts` (frame constants, `FRUIT_ICON_ORDER`, `fruitFrameSource`, rise duration, `FruitState`, `spawnFruit`, `tickFruit`, `fruitY` + the view) and **delete** `src/themes/platformer/entities/Fruit.ts` (no re-export). `fruitY` stays exported as the shared easing the tick uses.
- [X] T031 [P] [US3] Merge `src/themes/platformer/entities/Coin.ts` into `src/themes/platformer/entities/pickups/Coin.ts` (frame constants, `coinFrameIndex`, `coinBobOffset`, bob constants + view) and **delete** `src/themes/platformer/entities/Coin.ts`; other pickup modules import `coinBobOffset` from `./Coin` (no duplication).
- [X] T032 [P] [US3] Merge `src/themes/platformer/entities/KeyPickup.ts` into `src/themes/platformer/entities/pickups/Key.ts` (+ view) and **delete** `src/themes/platformer/entities/KeyPickup.ts`.
- [X] T033 [P] [US3] Merge `src/themes/platformer/entities/HeartPickup.ts` into `src/themes/platformer/entities/pickups/Heart.ts` (+ view) and **delete** `src/themes/platformer/entities/HeartPickup.ts`.
- [X] T034 [P] [US3] Merge `src/themes/platformer/entities/BombPickup.ts` into `src/themes/platformer/entities/pickups/Bomb.ts` (+ view) and **delete** `src/themes/platformer/entities/BombPickup.ts`.
- [X] T035 [US3] Break the new `entities/sprites/sheets.ts ⇄ entities/pickups/<Kind>.ts` import cycle: `src/themes/platformer/entities/sprites/sheets.ts` stops importing KEY/COIN/FRUIT pickup modules and declares that sheet geometry with local literals (same convention as `BOMB_SHEET`/`SLIME_*`/`HEARTS_SHEET`); add the agreement assertions to `src/themes/platformer/entities/pickups/PickupType.test.ts` (`COIN_SHEET.frameWidth === COIN_FRAME_SIZE`, `COIN_SHEET.columns === COIN_FRAME_COUNT`, `KEY_SHEET.frameWidth === KEY_FRAME_WIDTH`, `KEY_SHEET.frameHeight === KEY_FRAME_HEIGHT`, keep `FRUIT_SHEET.columns === FRUIT_ICON_COLUMNS`).
- [X] T036 [US3] Retarget every moved-module importer: `src/themes/platformer/entities/enemies/SlimePurple.ts` (KEY frame dims), `src/themes/platformer/components/Journal.tsx` (+ `src/themes/platformer/components/Journal.test.tsx` COIN/FRUIT imports and `spriteType` → `kind`), `src/themes/platformer/engine/Collision.ts`, `src/themes/platformer/engine/Renderer.ts`, `src/themes/platformer/PlatformerPage.tsx`, the moved tests, and the pickup modules themselves (self-local imports). Confirm `src/themes/platformer/entities/Health.ts`, `src/themes/platformer/entities/Torch.ts` and `src/themes/platformer/entities/CollectiblesSummary.ts` stay in place.

**Checkpoint**: One module per pickup family; no top-level pickup state module remains.

---

## Phase 6: User Story 4 - The dormant placed-fruit path is retired (Priority: P2)

**Goal**: No placed-fruit vocabulary remains in the collectible/placement path, while the live question-mark reward `'fruit'` kind keeps working unchanged (documented deviation from issue #94). The mutable base-coin signal's reset behaviour is completed.

**Independent Test**: The placed-collectible type and `placeCollectibles` carry only `coin` (no fruit variant/branch/marker field); a question-mark block still spawns/rises/reveals its fact-bearing fruit; `contracts/PickupKind.ts` still exports `'fruit'` and `entities/pickups/Fruit.ts` is the single reward-fruit module.

### Tests for User Story 4 (REQUIRED — write first) ⚠️

- [X] T037 [P] [US4] Tests-first in `src/themes/platformer/level/CollectibleMapper.test.ts`: only `kind: 'coin'`/`collected: false` placements are emitted; no dormant fruit variant, branch, or marker field is present (`spriteType` gone).
- [X] T038 [P] [US4] Tests-first in `src/themes/platformer/entities/pickups/Fruit.test.ts` (and the `PickupKind`/`RewardEffects` reachability assertion): the question-mark reward fruit still spawns, rises with identical positions, reveals its fact on touch, and is flagged `collected` (retained) rather than removed; `'fruit'` remains a first-class `PickupKind` reachable from `RewardEffects.spawnPickup`.

### Implementation for User Story 4

- [X] T039 [US4] Confirm/complete the coin-only placed-collectible path in `src/themes/platformer/level/CollectibleMapper.ts` — no dormant `'fruit'` variant, branch or marker field remains (finish whatever R-002 FR-022 left; do not re-introduce any of it).
- [X] T040 [US4] `src/themes/platformer/PlatformerState.ts` mutable base-coin reset behaviour (FR-006): `resetGameProgress()` re-derives `baseCoinPlacements` from the pure `collectiblePlacements` (each entry `collected: false`) and clears `spawnedCoinPlacements`; `resetGame()` leaves `baseCoinPlacements`/`spawnedCoinPlacements` untouched (flags intact). This is the same seam the editor's Try already routes through (`src/themes/platformer/editor/editorActions.ts`) so a level change re-derives it — no signals effect is introduced.
- [X] T041 [US4] `src/themes/platformer/editor/gridRenderState.ts` `synthesizeCollectiblePlacements` emits `kind: 'coin', collected: false`; update `src/themes/platformer/editor/gridRenderState.test.ts` (`spriteType` → `kind`/`collected`).
- [X] T042 [US4] Confirm the documented deviation is intact (do NOT "fix" it): `src/themes/platformer/contracts/PickupKind.ts` still exports `'fruit'`; `src/themes/platformer/entities/pickups/Fruit.ts` is the single reward-fruit module (no second `entities/Fruit.ts`); `RewardEffects.spawnPickup` and `src/themes/platformer/entities/blocks/*`'s question-mark outcome still resolve `'fruit'`.

**Checkpoint**: Placed-fruit vocabulary fully retired; live reward fruit unchanged.

---

## Phase 7: User Story 5 - The migration is invisible in-game (Priority: P1)

**Goal**: Behaviour preservation is proven — every eligibility gate, draw outcome and reset scope is unchanged; the collection-storage shift (retained + flagged, no id set) is asserted in its new form; full suite and production build are green; manual browser pass confirms no visible difference.

**Independent Test**: Collect each pickup kind (coin, dropped key, dropped heart at full/reduced health, dropped bomb below/at cap, question-mark fruit mid-rise/settled), die/respawn, Reset Game, and open the journal — identical to the pre-refactor build; each kind's eligibility gate and collection reset scope is unit-tested.

### Tests for User Story 5 (REQUIRED — write first) ⚠️

- [X] T043 [P] [US5] `src/themes/platformer/PlatformerState.test.ts` (collection-storage shift, tests-first): collecting a placed coin flags it in `baseCoinPlacements` and it persists across `resetGame()`; `resetGameProgress()` re-derives base coins uncollected and clears spawned/dropped arrays; coin pacing's `collectedBefore` comes from flagged entries; the `collectedCollectibleIds` assertions are **re-expressed** as base-coin flag behaviour (not deleted); fixtures that still use `spriteType` (lines ~898/941/992) switch to `kind`. No `it.skip`/`xit`/deleted `describe`.
- [X] T044 [P] [US5] `src/themes/platformer/PlatformerState.test.ts` reset-scope assertions: coin/fruit/key arrays (and their `collected` flags) persist across `resetGame()`; heart/bomb arrays + placed bombs clear (and `carriedBombs = 0`); `resetGameProgress()` clears every pickup array + `collectedKeys = 0`. Every existing reset-scope assertion stays asserted.
- [X] T045 [P] [US5] `src/themes/platformer/PlatformerPage.test.tsx` storage/behaviour: collected entries of every kind are retained + flagged (no removal, no id set); every pickup scenario (coin pacing, key bank + flag, heart heal/full-health wait, bomb cap below/at, spawn-from-block, reset scopes) keeps its assertions on the new state shapes.
- [X] T046 [P] [US5] New SC-008 guard tests (co-located): a collected entry of any kind is retained with `collected: true` and skipped by **both** generic paths; a collected base coin survives `resetGame()` but is re-derived uncollected by `resetGameProgress()`; a search-level assertion proves there is exactly one collect-once mechanism (no id set, no per-kind removal).
- [X] T047 [P] [US5] Per-kind eligibility-gate unit tests: heart at full health and bomb at the cap both stay in the world; a mid-rise fruit is not collectible; any already-`collected` coin/fruit/key is not re-collected; bomb clamp honours `max(0, cap - count)` in array order.

### Verification for User Story 5

- [X] T048 [US5] Run the full suite `npm test` — green with no assertion deleted, skipped or weakened (FR-010/SC-004).
- [X] T049 [US5] Run `npm run build` — production build succeeds (FR-010/SC-004).
- [x] T050 [US5] Manual browser pass per [quickstart.md](./quickstart.md) §4 (SC-005): coin spin/bob + HUD popup + journal reveal; key bob + "Key" flying text + counter; heart heal (reduced) and wait-at-full; bomb below cap (banked) and wait-at-cap; question-mark fruit rising/occluded/revealed/flagged; death/respawn (heart/bomb cleared, coin/fruit/key persisted); Reset Game (all cleared, placed coins re-derived uncollected); editor preview unchanged.

**Checkpoint**: Behaviour-preservation acceptance bar met; all five stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Boundary/cleanup guards that span all stories.

- [X] T051 [P] Run the [quickstart.md](./quickstart.md) §3 static inspections: no `checkCollectibleCollisions`/`checkFruitCollisions`/`checkKeyPickupCollisions`/`checkHeartPickupCollisions`/`checkBombPickupCollisions` and no `drawCollectibles`/`drawFruits`/`drawKeyPickups`/`drawHeartPickups`/`drawBombPickups`; exactly one `checkPickupCollisions` (`engine/Collision.ts`) and one `drawPickups` (`engine/Renderer.ts`); no `collectedCollectibleIds`, no `spriteType`, no `=== '(coin|fruit|key|heart|bomb)'` in `PlatformerPage.tsx`. Also scrub surviving doc comments that name removed symbols/paths so the searches are literally clean: `engine/Renderer.ts` (`drawCollectibles`), `engine/Collision.ts` (`checkFruitCollisions`/`checkCollectibleCollisions`), `editor/gridRenderState.ts` (`spriteType`), `level/CollectibleMapper.ts` (`entities/Fruit.ts`).
- [X] T052 FR-011 no-alias guard: confirm no compatibility re-export, alias, shim or second code path preserves the removed family collision functions, the draw wrappers, the external collected-id set, the old `entities/{Fruit,Coin,KeyPickup,HeartPickup,BombPickup}` module paths, `PickupDisposition`, `PickupOutcome.self`, or a per-kind `isVisible`.
- [X] T053 [P] Layer-boundary check (SC-007/FR-008): `src/themes/platformer/contracts/` imports nothing from `engine/`/`entities/`/`level/`/state; the shared `Pickup` model resolves from `contracts/Pickup.ts`; no new `level/ → engine/` and no new `engine/ → state/` edge.
- [X] T054 [P] Confirm FR-007/SC-006: adding a pickup kind is still one module + one `PICKUP_TYPES` line; the sprite loader still discovers assets from each type's `sprite.sheet` (`collectSheetSources` over `PICKUP_TYPES`) — no registry edit.
- [X] T055 Update `docs/Features.md` on completion per AGENTS.md/constitution IV: prefix the `R006` node label with `✅ ` (line ~74) and add `class R006 done` alongside the existing `class R001,R002,R003,R004,R005,R006,… themes` line (~316). (Only after implementation **and** tests are fully done.)
- [X] T056 [P] Confirm no new dependency and no change to `src/data/`, level data, translations, HUD counter layout, or pickup tuning (constitution V, spec Out of Scope).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup — **BLOCKS all user stories**.
- **US1 (Phase 3, P1)**: depends on Foundational. Delivers the discriminator + generic collision/draw + the shared collect applier.
- **US2 (Phase 4, P1)**: depends on US1 (the registry/generic dispatch and the `onPickup` collect seam). Adds `spawn` + generic block-outcome spawn.
- **US3 (Phase 5, P2)**: depends on US1/US2 (the merged modules absorb the seam implementations); can otherwise run in parallel with them per plan ("independent … can land first"). It retargets imports last so the merges are mechanical.
- **US4 (Phase 6, P2)**: depends on US1 (the `CollectiblePlacement` composition) and US3 (the merged `Fruit.ts`); completes the placed-fruit retirement + base-coin reset behaviour.
- **US5 (Phase 7, P1)**: depends on US1–US4 (proves the whole migration invisible).
- **Polish (Phase 8)**: depends on all desired stories.

### User Story Dependencies

- **US1**: no dependency on other stories (after Foundational) — the MVP.
- **US2**: integrates with US1's generic dispatch; independently testable via the spawn path.
- **US3**: mechanical module merge; independently testable by tree inspection.
- **US4**: integrates with US1/US3; independently testable by the placed-fruit greps + reward-fruit behaviour.
- **US5**: cross-cutting acceptance; testable only once US1–US4 land.

### Within Each User Story

- Tests are written first and MUST fail before implementation (Principle II).
- State/type changes before the generic function that consumes them; the registry pin before the engine dispatch; the page/editor rewiring last within the story.

### Parallel Opportunities

- Setup: T002 can run alongside T001.
- Foundational: T003/T004 (tests) and T005/T006 (implementation) are different files → parallel.
- US1: T007/T008/T009 (three test suites) parallel; T010–T014 (five state modules) parallel; T021/T022 touch the same `PlatformerPage.tsx` → sequential.
- US2: T024 test-first; T026's five modules parallel, but T025 must precede them.
- US3: T030–T034 merges are different module pairs → parallel; T035 must precede T036's import retarget.
- US4: T037/T038 parallel; T039–T042 different files.
- US5: T043–T047 parallel (tests); T048–T050 sequential after them.
- Polish: T051/T053/T054/T056 parallel; T052 and T055 after the corresponding work.

---

## Parallel Example: User Story 1

```bash
# Launch the three restructured/targeted test suites together (tests-first):
Task: "Restructure engine/Collision.test.ts around checkPickupCollisions"
Task: "Restructure engine/Renderer.test.ts around drawPickups"
Task: "Update entities/pickups/index.test.ts + PickupType.test.ts for kind/collected/drawLayer"

# Launch the five state-composition changes together (different files):
Task: "CollectiblePlacement composes Pickup (kind:'coin', collected) in level/CollectibleMapper.ts"
Task: "FruitState composes Pickup with stored y/collected in entities/Fruit.ts"
Task: "KeyPickupState composes Pickup, inline collected removed in entities/KeyPickup.ts"
Task: "HeartPickupState composes Pickup in entities/HeartPickup.ts"
Task: "BombPickupState composes Pickup in entities/BombPickup.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1) — the discriminator + one collision path + one draw path.
3. **STOP and VALIDATE**: run `npm test -- engine/Collision.test.ts engine/Renderer.test.ts` and the quickstart §3 greps; confirm no family-specific function or page kind-name branch remains.
4. Deploy/demo the dispatch core if ready — but note US1 does not yet remove the block spawn `if/else` (that is US2).

### Incremental Delivery

1. Setup + Foundational → contracts `Pickup`/`PickupOutcome` ready.
2. US1 → generic collision/draw + shared applier; test independently.
3. US2 → generic spawn; test independently.
4. US3 → one module per family; verify by tree inspection.
5. US4 → placed-fruit retirement + base-coin reset; verify greps + reward fruit.
6. US5 → full suite, production build, manual browser pass.
7. Polish → boundaries, no-alias guard, `docs/Features.md` update.

### Notes

- `[P]` tasks = different files, no dependencies.
- Every task is specific enough for an LLM to execute without extra context.
- Do NOT merge the per-kind signal arrays (Clarification Q6) — the shared thing is the `Pickup` base plus one module per kind; reset scope is the only per-kind difference.
- Do NOT drop the live `'fruit'` kind, and do NOT leave a second fruit module (documented deviation from issue #94).
- Commit only when the user explicitly asks; no auto-commits and no auto-advance to `/speckit.analyze` or `/speckit.implement`.
