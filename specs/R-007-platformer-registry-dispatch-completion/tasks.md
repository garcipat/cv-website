# Tasks: Platformer Registry Dispatch Completion (R-007)

**Input**: Design documents from `/specs/R-007-platformer-registry-dispatch-completion/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: This is a behaviour-preserving refactor with a **mandatory TDD bar** (constitution
Principle II "NON-NEGOTIABLE" + FR-011 "All existing tests MUST migrate and MUST pass"). The existing
suite is restructured/re-expressed (never deleted, skipped, or weakened) and the new hooks/applier/
metadata are TDD'd with co-located unit tests. All tests use Vitest + React Testing Library + jsdom and
the `{method}-{condition}-{expected-result}` naming convention.

**Organization**: Tasks are grouped by user story (US1–US3) to enable independent implementation and
testing. The acceptance bar for the whole feature is **byte-for-byte behaviour preservation**
(FR-010/SC-005/SC-006) — the only sanctioned changes are the dispatch moves, the `ItemKind`→`PickupKind`
unification, the shared reward applier, the hazard hooks + trigger relocation,
and the corresponding import/name updates.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project, no backend. The platformer theme is a self-contained tree under
  `src/themes/platformer/`. All paths below are repo-root-relative.
- `contracts/` is a strict leaf; no new `level/ → engine/`, `engine/ → state/`, or
  `entities/ → state/` edge is allowed (FR-013/SC-008).
- Every `engine/`/`entities/`/`level/` module carries a co-located `.test.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the pre-refactor green baseline this refactor must preserve.

- [x] T001 Run `npm test` and `npm run build` from the repo root and confirm both are green; record the
  result in `specs/R-007-platformer-registry-dispatch-completion/` as the SC-005/FR-011 byte-for-byte
  baseline (no dependency, data, or level/marker/sprite change is expected — `npm install` should add
  nothing).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the one shared leaf contract type that US1 implements, before any behaviour moves.
(This refactor has minimal cross-story infrastructure — the two implementation stories are largely
independent.)

- [x] T002 Add the `DefeatApi` interface to `src/themes/platformer/contracts/Outcome.ts` — a leaf type
  importing only `../types` (`CollectedFact`), `./PickupKind` (`PickupKind`), and `./counters`
  (`CounterPopupLabelKey`); declare `spawnPickup(kind: PickupKind): void`,
  `revealFact(fact: CollectedFact, effectId: string): void`, and
  `bumpCounter(key: CounterPopupLabelKey): void` exactly as specified in
  `contracts/enemy-defeat.md`. No runtime code — `contracts/` stays a strict leaf (SC-008).

**Checkpoint**: The reward vocabulary contract is in place; US1 and US2 can begin in parallel.

---

## Phase 3: User Story 1 - Enemy defeat rewards are declared by the enemy type (Priority: P1) ★ MVP

**Goal**: Each enemy kind owns its defeat consequences through an optional `onDefeat(enemy, defeat)`
hook that fires them via the supplied `DefeatApi`; one shared reward applier (`state/enemyRewards.ts`)
owns the unconditional puff and the `rewardGiven`/`deathEffectGiven` gating — so `PlatformerPage.tsx`
no longer names any enemy or drop kind and no longer imports `spawnKeyPickup` (D2/SC-002).

**Independent Test**: Inspect `src/themes/platformer/PlatformerPage.tsx`'s enemy-defeat block — no
`heldItem === 'key'`, no `enemy.type === 'slimeGreen'`, no `spawnKeyPickup` call; a defeated enemy's
consequences fire from its `onDefeat` through the `DefeatApi`, invoked by one shared applier. A throwaway
enemy that drops a heart ships as one module plus one registry line with no page edit.

### Tests for User Story 1 (write first — they MUST fail before implementation)

- [x] T003 [P] [US1] Restructure `src/themes/platformer/entities/enemies/index.test.ts` — replace the
  "heldItem drop wiring" describe with an "onDefeat wiring" describe asserting `slimePurple.onDefeat`
  spawns its held key via `defeat.spawnPickup`, `slimeGreen.onDefeat` reveals `fact` + `extraFacts` and
  bumps `'enemies'`, and `bee` has no `onDefeat`; keep the `heldItem === 'key'`/`null` assertions
  re-typed to `PickupKind`.
- [x] T004 [P] [US1] Add `src/themes/platformer/state/enemyRewards.test.ts` — co-located TDD suite for
  `applyEnemyDefeats` asserting: a fresh defeat invokes `onDefeat` exactly once (only when `rewardGiven`
  is false), the puff is unconditional per death, `rewardGiven` and `deathEffectGiven` are both set on
  every defeated id, and `bumpCounter` dedupes per key and flushes after the flag update (per
  `contracts/enemy-defeat.md` semantics).

### Implementation for User Story 1

- [x] T005 [US1] In `src/themes/platformer/entities/enemies/EnemyType.ts`, delete the `ItemKind` type
  (no compatibility alias — FR-012/SC-001), re-type `heldItem` from `ItemKind | null` to
  `PickupKind | null` (value unchanged: `slimePurple` keeps `'key'`, others `null`), and add the optional
  `onDefeat?(enemy: S, defeat: DefeatApi): void` hook; import `PickupKind` and `DefeatApi`.
- [x] T006 [P] [US1] In `src/themes/platformer/entities/enemies/SlimePurple.ts`, add `onDefeat` that
  reads its own `heldItem` (`'key'`) and calls `defeat.spawnPickup(item)` when present — the drop fires
  from inside the kind via the generic pickup-spawn path, never a page-side `spawnKeyPickup` (FR-002).
- [x] T007 [P] [US1] In `src/themes/platformer/entities/enemies/SlimeGreen.ts`, add `onDefeat` that
  reveals `[enemy.fact, ...(enemy.extraFacts ?? [])]` per-fact via
  `defeat.revealFact(fact, `${enemy.id}-${index}`)` and then calls `defeat.bumpCounter('enemies')` once
  per defeated slime (per-fact reveal, per-defeat bump — FR-004).
- [x] T008 [US1] Create `src/themes/platformer/state/enemyRewards.ts` exporting `EnemyDefeatContext`
  (`{ revealFact, originX, originY }`) and `applyEnemyDefeats(defeated, ctx)` — implement the shared
  applier: stage an unconditional `startPuffEffect` per death; only when `!enemy.rewardGiven`, build a
  `DefeatApi` and invoke `typeOf(enemy).onDefeat?.(enemy, api)`; set `rewardGiven` and `deathEffectGiven`
  on all defeated ids; flush staged `bumpCounter` keys via `startCounterPopup` **after** the flag update
  (reading `enemiesDefeated.value` so this tick's defeats are in the numerator); then `spawnEffect` the
  staged puffs (exact ordering per `contracts/enemy-defeat.md`).
- [x] T009 [US1] Restructure `src/themes/platformer/PlatformerPage.test.tsx`'s enemy-defeat describe to
  assert the applier form — purple slime's `onDefeat` spawns the key through the defeat API (not
  `spawnKeyPickup`), green slime reveals facts and bumps the counter once, bee puffs and rewards nothing,
  revived slime puffs but drops nothing; remove the `spawnKeyPickup` import/fixture.
- [x] T010 [US1] In `src/themes/platformer/PlatformerPage.tsx`, replace the enemy-defeat block with
  `const justDefeated = enemyStates.value.filter((e) => !e.alive && !e.deathEffectGiven); if
  (justDefeated.length > 0) applyEnemyDefeats(justDefeated, { revealFact, originX, originY });` — remove
  all `heldItem === 'key'`/`enemy.type === 'slimeGreen'` branching and the `spawnKeyPickup` import/call
  (SC-002).

**Checkpoint**: A defeated purple/green slime and bee behave exactly as before, but the page names no
enemy or drop kind — User Story 1 is independently testable.

---

## Phase 4: User Story 2 - Hazard knockback and per-tick state live behind the hazard type (Priority: P1)

**Goal**: `HazardType` carries `knocksBack`, a `withTickState(placement, timers)` hook, and an
`armTriggerRects?(hazard, timers)` hook (plus a caller-supplied `HazardTickContext`), so
`hazardPlacementsForTick`, `Collision.ts`'s trigger detection, and the page's damage block all stop
branching on `hazardType` (D3/SC-003).

**Independent Test**: Inspect `src/themes/platformer/PlatformerState.ts` `hazardPlacementsForTick`,
`src/themes/platformer/engine/Collision.ts`'s hazard-trigger function, and the page's damage block —
none contains a `hazardType ===`/`!==` comparison; knockback and state merge come from `typeOf(hazard)`.
Every hazard's damage/knockback/phase behaviour is unchanged.

### Tests for User Story 2 (write first)

- [x] T011 [P] [US2] Restructure `src/themes/platformer/engine/Collision.test.ts` — merge the
  `checkFloorSpikeTriggers` and `checkFallingStalactiteTriggers` describes into `checkHazardArmTriggers`
  scenarios (same fixtures, same expected ids), preserving the eligibility gates (only an at-rest floor
  spike arms; only a hanging stalactite arms; already-armed excluded) and the detection-zone overlap
  geometry assertions.
- [x] T012 [P] [US2] Add `knocksBack`/`withTickState`/`armTriggerRects` coverage to
  `src/themes/platformer/entities/hazards/FloorSpike.test.ts` (asserting `knocksBack: false`,
  byte-identical phase/extension merge, and trigger-box rect returned only when not armed).
- [x] T013 [P] [US2] Add `knocksBack`/`withTickState`/`armTriggerRects` coverage to
  `src/themes/platformer/entities/hazards/FallingStalactite.test.ts` (asserting `knocksBack: false`,
  byte-identical phase/offset/shake merge, and detection-zone cells → rects returned only when not armed).
- [x] T014 [P] [US2] Add `knocksBack: true` coverage to `src/themes/platformer/entities/hazards/Spike.test.ts`.
- [x] T015 [P] [US2] Add `knocksBack: true` coverage to `src/themes/platformer/entities/hazards/Spear.test.ts`.

### Implementation for User Story 2

- [x] T016 [US2] In `src/themes/platformer/entities/hazards/HazardType.ts`, add the required
  `knocksBack: boolean` field and the optional `withTickState?(placement, timers): HazardPlacement` and
  `armTriggerRects?(hazard, timers): readonly Rect[]` hooks, and define the `HazardTickContext` interface
  (`floorSpikeTimers`, `fallingStalactiteTimers`, `activeLevel: LevelDef`,
  `blockStates: readonly BlockPlacement[]`, `crumblingFloorTimers: readonly GridTimerState[]` — typed
  against `shared/timedTile`'s `GridTimerState`, not `engine/CrumblingFloor`, per FR-013).
- [x] T017 [P] [US2] In `src/themes/platformer/entities/hazards/Spike.ts`, set `knocksBack: true`.
- [x] T018 [P] [US2] In `src/themes/platformer/entities/hazards/Spear.ts`, set `knocksBack: true`.
- [x] T019 [P] [US2] In `src/themes/platformer/entities/hazards/FloorSpike.ts`, set `knocksBack: false`;
  implement `withTickState` merging `floorSpikePhase`/`floorSpikeExtension`; implement `armTriggerRects`
  returning `[]` when `isFloorSpikeArmed(...)` else `[floorSpikeTriggerBox(hazard)]` (move the
  `floorSpikeTriggerBox` helper here from `engine/Collision.ts`).
- [x] T020 [P] [US2] In `src/themes/platformer/entities/hazards/FallingStalactite.ts`, set
  `knocksBack: false`; implement `withTickState` merging `fallingStalactitePhase`/`OffsetY`/
  `ShakeOffsetX`; implement `armTriggerRects` returning `[]` when `isFallingStalactiteArmed(...)` else
  the detection-zone cells mapped to tile rects.
- [x] T021 [US2] In `src/themes/platformer/engine/Collision.ts`, delete `checkFloorSpikeTriggers`,
  `checkFallingStalactiteTriggers`, and the private `floorSpikeTriggerBox` (no shim — FR-012), and add
  the generic `checkHazardArmTriggers(player, hazards, ctx): string[]` that calls
  `hazardTypeOf(hazard).armTriggerRects?.(hazard, ctx)` and pushes `hazard.id` when any rect overlaps
  `playerHitbox(player)`.
- [x] T022 [US2] In `src/themes/platformer/PlatformerState.ts`, rewrite `hazardPlacementsForTick()` to
  build one `HazardTickContext` and map `hazardTypeOf(hazard).withTickState?.(hazard, ctx) ?? hazard`
  (dropping the six phase/extension helper imports); add `hazardTimerStores`
  (`Partial<Record<HazardKind, { arm(id): void }>>` with `floorSpike`/`fallingStalactite` entries) and
  the generic `armHazardTrigger(id)` dispatching `hazardTimerStores[hazard.hazardType]?.arm(id)`;
  delete `armFloorSpikeTrigger` and `armFallingStalactiteTrigger` (no shim — FR-012).
- [x] T023 [US2] Restructure `src/themes/platformer/PlatformerState.test.ts` `hazardPlacementsForTick`
  tests to assert the merged placement via the kind's `withTickState` (same phase/extension/offset/shake
  values).
- [x] T024 [US2] In `src/themes/platformer/PlatformerPage.tsx`, replace the hazard-damage knockback
  branch with `if (!hazardTypeOf(hazard).knocksBack || playerState.value.crouching) { … } else { … }`
  (knockback `direction`/`vx`/`duration` from the type alone; crouch suppression stays player-side), and
  replace the two arming loops with one loop over
  `checkHazardArmTriggers(playerState.value, hazardPlacements.value, hazardTickContext)` calling
  `armHazardTrigger(id)`.
- [x] T025 [US2] Restructure `src/themes/platformer/PlatformerPage.test.tsx`'s hazard-damage describe to
  assert the `knocksBack`-driven knockback with the crouch suppression unchanged.

**Checkpoint**: No engine layer branches on a hazard kind name; hazard damage/knockback/phase behaviour
is byte-identical — User Story 2 is independently testable.

---

## Phase 5: User Story 3 - The migration is invisible in-game (Priority: P1)

**Goal**: The acceptance bar for the whole refactor — nothing the visitor sees changes. Priority P1
reflects criticality; execution is post-implementation (it verifies US1–US3 together).

**Independent Test**: Play a level and compare against the pre-refactor build (stomp green/purple/revived
slimes and a bee; stand on a floor spike and a spear; walk under a falling stalactite; collect a coin,
crate and question-mark fruit; die/respawn; Reset Game; check the journal totals and HUD counters),
plus unit-test each reward gate, knockback decision and counter numerator/denominator.

### Verification for User Story 3

- [x] T026 [US3] Run `npm test` (full migrated suite) and `npm run build` from the repo root and confirm
  both are green — all assertions unchanged except renames/import paths/hook signatures (FR-011/SC-005).
- [x] T027 [P] [US3] Run the static-inspection greps from `quickstart.md` §3 and confirm zero matches:
  `ItemKind`; `spawnKeyPickup` in `PlatformerPage.tsx`; `heldItem === 'key'`/`enemy.type === 'slimeGreen'`
  in `PlatformerPage.tsx`; `hazardType === `/`hazardType !== ` in `PlatformerState.ts`,
  `engine/Collision.ts`, `PlatformerPage.tsx`; `checkFloorSpikeTriggers`/`checkFallingStalactiteTriggers`/
  `armFloorSpikeTrigger`/`armFallingStalactiteTrigger` (SC-001/SC-002/SC-003/SC-008).
- [x] T028 [US3] Verify reset-scope behaviour is unchanged: enemy `rewardGiven` (permanent) and
  `deathEffectGiven` (per-life, reset on revive) flags behave exactly as before
  across death/respawn and Reset Game (US3 AC3) — confirm via the migrated `PlatformerState.test.ts` and
  `state/enemyRewards.test.ts` gate assertions.
- [x] T029 [US3] Perform the manual browser pass from `quickstart.md` §4 in the running theme and confirm
  no visible or behavioural difference (SC-006 — required by the constitution: a passing suite is not
  evidence the change looks right).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Feature completion tracking and the final no-regression review.

- [x] T030 [P] Update `docs/Features.md` — prefix the `R007` node label with `✅ ` and add
  `class R007 done` alongside its existing category class in the dependency diagram (per AGENTS.md
  Feature Completion Tracking).
- [x] T031 [P] Final review sweep: confirm no compatibility re-export/alias or second code path remains
  for `ItemKind`, the page's per-kind enemy branch, `spawnKeyPickup`, the per-kind hazard
  merge/knockback/trigger branches (FR-012), confirm no gameplay,
  tuning, visual, level-data or translation change slipped in (FR-010), and verify SC-007 by adding a
  throwaway dropping enemy / armed hazard that ships with one module + one registry line and no page,
  `Collision.ts`, `PlatformerState.ts`, or `Renderer.ts` edit.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run first to capture the baseline.
- **Foundational (Phase 2)**: Depends on Setup; lands the `DefeatApi` leaf contract.
- **User Stories (Phase 3–5)**: All depend on Foundational.
  - **US1 (P1)** and **US2 (P1)** are independent of each other and can proceed in parallel.
  - **US3 (P1)** is the behaviour-preservation verification and runs after US1–US2.
- **Polish (Phase 6)**: Depends on all stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories.
- **US2 (P1)**: After Foundational — no dependency on other stories (independent of US1).
- **US3 (P1)**: After US1+US2 — verifies the combined refactor.

### Within Each User Story

- Tests (where new behaviour) MUST be written and FAIL before implementation.
- Contract/type fields before kind values (constitution Principle I: types before data).
- Kind modules before the engine/state/page consumers.
- Story complete before moving to the next priority.

### File-touch overlaps (noted for sequencing)

- `entities/enemies/EnemyType.ts` — US1 (`onDefeat`/`heldItem`/delete `ItemKind`).
- `entities/enemies/SlimeGreen.ts` — US1 (`onDefeat`).
- `PlatformerState.ts` — US2 (`hazardPlacementsForTick`/`armHazardTrigger`).
- `PlatformerState.test.ts` — US2 (hazardPlacementsForTick).
- `PlatformerPage.tsx` — US1 (defeat block) then US2 (damage/arming blocks).
- `PlatformerPage.test.tsx` — US1 (defeat describe) then US2 (damage describe).

### Parallel Opportunities

- T003/T004 (US1 tests) run in parallel; T006/T007 (US1 kind hooks) run in parallel.
- T011–T015 (US2 tests) run in parallel; T017–T020 (US2 kind hooks) run in parallel.
- T027/T030/T031 run in parallel.
- US1 and US2 can be worked in parallel by different developers after Phase 2.

---

## Parallel Example: User Story 1

```bash
# Launch the US1 tests together (must FAIL first):
Task: "Restructure entities/enemies/index.test.ts to onDefeat wiring"
Task: "Add state/enemyRewards.test.ts for applyEnemyDefeats"

# After EnemyType.ts (T005) lands, launch the kind hooks together:
Task: "Add onDefeat to entities/enemies/SlimePurple.ts"
Task: "Add onDefeat to entities/enemies/SlimeGreen.ts"
```

## Parallel Example: User Story 2

```bash
# Launch the US2 tests together (must FAIL first):
Task: "Restructure engine/Collision.test.ts to checkHazardArmTriggers"
Task: "Add knocksBack/withTickState/armTriggerRects coverage to FloorSpike/FallingStalactite/Spike/Spear tests"

# After HazardType.ts (T016) lands, launch the kind hooks together:
Task: "Set knocksBack:true on Spike.ts / Spear.ts"
Task: "Implement withTickState + armTriggerRects on FloorSpike.ts / FallingStalactite.ts"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline captured).
2. Complete Phase 2: Foundational (`DefeatApi` contract).
3. Complete Phase 3: User Story 1 (enemy defeat dispatch).
4. **STOP and VALIDATE**: run the US1 tests + `npm run build` and grep the page (SC-002) independently.
5. The enemy-defeat dispatch (D2) is the largest leak and a valid MVP increment on its own.

### Incremental Delivery

1. Setup + Foundational → reward vocabulary contract ready.
2. Add US1 → test independently → the page stops naming enemy/drop kinds.
3. Add US2 (parallel-capable) → test independently → no layer branches on hazard kind.
4. Add US3 → full suite + build + greps + manual browser pass → deploy/demo.
5. Each story preserves byte-for-byte behaviour and never breaks a previous story.

### Parallel Team Strategy

1. Team completes Setup + Foundational together.
2. Once Foundational is done:
   - Developer A: User Story 1 (enemy defeat).
   - Developer B: User Story 2 (hazard dispatch).
3. Both merge, then User Story 3 verification runs once.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps each task to its user story for traceability.
- Tests are MANDATORY here (constitution Principle II + FR-011): every restructured/new suite is listed
  with its exact file path.
- Behaviour preservation is the acceptance bar — no gameplay/tuning/visual/data change (FR-010).
- No auto-commits (constitution Development Workflow; AGENTS.md) — commit only when the user requests.
- Stop at any checkpoint to validate a story independently before moving on.
- Avoid: vague tasks, same-file conflicts within a phase, and cross-story dependencies that break
  independence.
