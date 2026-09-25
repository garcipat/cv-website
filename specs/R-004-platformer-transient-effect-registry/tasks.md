---

description: "Task list for R-004 Platformer Transient Effect Registry"
---

# Tasks: Platformer Transient Effect Registry (R-004)

**Input**: Design documents from `/specs/R-004-platformer-transient-effect-registry/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED. Constitution Principle II and FR-014 require tests to be written/updated alongside every move/signature change; the plan calls for new coverage (registry contract, advance boundaries, timed-tile core, particle byte-identity, hazard relocation). Existing tests may be updated only for changed import paths, signatures, or file locations — never weakened, skipped, or deleted.

**Organization**: Tasks are grouped by user story. Priority order across the spec's P1 stories is US1 → US2 → US5; then P2 (US3, US4); then P3 (US6).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Every task names an exact file path under `src/themes/platformer/` unless noted

## Path Conventions

Single project: source under `src/themes/platformer/`, tests co-located beside the module under test. Docs under `docs/`; spec artifacts under `specs/R-004-platformer-transient-effect-registry/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a green baseline and confirm the refactor's no-new-dependency constraint.

- [x] T001 Verify the pre-refactor baseline is green: run `npm test` and `npm run build` from the repo root and record the passing result (FR-014).
- [x] T002 [P] Confirm `package.json` / `package-lock.json` need no change and no new runtime dependency is added (FR-019, Constitution Principle V); treat any package.json change as a defect.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The base type, registry types, shared render context, and text helper that the unified effect subsystem (US1/US3/US5) is built on. US2/US4 are gated by `shared/timedTile.ts`, which US2 creates.

**⚠️ CRITICAL**: No effect-subsystem user-story work (US1/US3/US5) can begin until this phase is complete.

- [x] T003 Create the `TransientEffect<S>` base, `EffectRenderContext`, default advance/expiry, and collection operations in `src/themes/platformer/engine/effects/transientEffect.ts` per `contracts/effects-registry.md`: fields `id`, `duration`, `elapsed`, `state`, `tick`, `draw`, `expired`; default `tick` returns `{ ...effect, elapsed: effect.elapsed + dt }`; default `expired` is `effect.elapsed > effect.duration`; export `advanceEffects(effects, dt, options?)`, `clearEffectsByResetScope(effects, scope?)`, and `effectCount(effects, kind)`. Imports only `contracts/`, `shared/`, `entities/sprites`, and `engine/textDraw` — never `level/` or state.
- [x] T004 [P] Create the registry types in `src/themes/platformer/engine/effects/effectRegistry.ts`: `EffectKind` = `flyingText | counterPopup | puff | healAura | hitSplatter | fadeOutText | explosion | debris`; `EffectLayer` = `midWorld | worldEffects | aboveWorld | hudLast`; `EffectResetScope` = `death | progress`; `EffectRegistryEntry<S>` with `kind`, `create`, optional `tick`, `draw`, optional `expired`, `layer`, `resetScope`, optional `keyOf`. Document that declaration order is significant and fixes intra-layer draw order.
- [x] T005 [P] Extract `fillTextWithOutline` and the shared pixel font-family constant from `src/themes/platformer/engine/Renderer.ts` into a new `src/themes/platformer/engine/textDraw.ts`, and update `Renderer.ts` to import them (D7). No behaviour change to the outline (4 offset strokes + fill).
- [x] T006 [P] Write unit tests for the collection operations in `src/themes/platformer/engine/effects/transientEffect.test.ts`: default advance adds `dt`; default expiry uses strict `>` (expires at `elapsed > duration`, not `>=`); `advanceEffects` with `{ kinds: [...] }` ticks/prunes only the named kinds and leaves others byte-unchanged; `clearEffectsByResetScope('death')` removes only `death`-scoped effects; omitting scope clears all; `effectCount` counts one kind (edge case: empty collection, unknown kind).
- [x] T007 [P] Write unit tests for `src/themes/platformer/engine/textDraw.test.ts` covering the outlined-text helper (4 stroke passes + 1 fill, correct font family), mirroring the assertions previously exercised indirectly through `Renderer.test.ts`.

**Checkpoint**: Base types, collection helpers, and text helper exist and are unit-tested; effect subsystems can now be built.

---

## Phase 3: User Story 1 - One registry, one collection, one tick, one draw pass (Priority: P1)

**Goal**: Replace the eight parallel effect state machines with one `TransientEffect<S>` concept, one `activeEffects` collection, one `advanceEffects(activeEffects.value, dt)`, and one registry-driven draw pass, so a new effect is one module plus one registry line.

**Independent Test**: `PlatformerState.ts` holds exactly one `activeEffects` collection and no per-kind effect signals; `PlatformerPage.tsx` makes one `advanceEffects(activeEffects.value, dt)` call and one `drawEffects` dispatch (invoked per pipeline layer) instead of six tick bodies and eight draw calls; a throwaway registered kind starts, advances, draws, and expires with no edit to state, tick, draw, or reset code.

### Per-kind effect modules (each owns start/tick/derive/draw)

- [x] T008 [P] [US1] Create `src/themes/platformer/engine/effects/flyingText.ts`: move `FlyingTextEffect`, `RISE_DURATION_SECONDS`, `HOLD_DURATION_SECONDS`, `FLY_DURATION_SECONDS`, `startFlyingText`, `tickFlyingText` (4-phase rising→holding→flying→done, `phase === 'done'` terminal), `flyingTextPosition`, plus `COLLECTION_TEXT_SLOT_COUNT`, `COLLECTION_TEXT_STACK_ROW_HEIGHT`, `SlotAllocator`, `createSlotAllocator`. Add the family's `draw` (the body of `Renderer.ts`'s `drawCollectionEffects`).
- [x] T009 [P] [US1] Create `src/themes/platformer/engine/effects/counterPopup.ts`: move `CounterPopupEffect`, `COUNTER_POPUP_HOLD_SECONDS`, `COUNTER_POPUP_FADE_SECONDS`, `COUNTER_POPUP_DURATION_SECONDS`, `startCounterPopup`, `tickCounterPopup` (returns `null` sentinel at `elapsed >= COUNTER_POPUP_DURATION_SECONDS`), `counterPopupOpacity`, and the registered `draw` (the body of `Renderer.ts`'s `drawCounterPopups`, including `popupIcons` row assembly).
- [x] T010 [P] [US1] Create `src/themes/platformer/engine/effects/puff.ts`: move `PuffEffect`, `SPARKLE_DURATION_SECONDS`, `SPARKLE_COUNT`, `SPARKLE_MAX_RADIUS`, `SparkleParticle`, `sparkleParticles`, `startPuffEffect`, `tickPuffEffect`, and the registered `draw` (body of `Renderer.ts`'s `drawPuffEffects`). Keep the `elapsed < 0 || elapsed > SPARKLE_DURATION_SECONDS → []` early return.
- [x] T011 [P] [US1] Create `src/themes/platformer/engine/effects/healAura.ts`: move `HealAuraEffect`, `HEAL_AURA_DURATION_SECONDS`, `startHealAuraEffect`, `tickHealAuraEffect`, `healAuraOpacity`, `HealAuraRay`, `healAuraRays`, `HealAuraSparkle`, `healAuraSparkles`, `HEAL_AURA_SPARKLE_OFFSETS`, and the registered `draw` (body of `Renderer.ts`'s `drawHealAuraEffects`). The draw MUST re-derive its anchor from `EffectRenderContext.playerAnchor` and MUST NOT store a position (US5-2/FR-016).
- [x] T012 [P] [US1] Create `src/themes/platformer/engine/effects/hitSplatter.ts`: move `HitSplatterEffect`, all `PLAYER_/SPEAR_/ENEMY_HIT_SPLATTER_*` constants, `HIT_SPLATTER_DURATION_SECONDS`, `HIT_SPLATTER_FADE_START_FRACTION`, `HIT_SPLATTER_GRAVITY`, `HIT_SPLATTER_SHUFFLE_STRIDE`, `startPlayerHitSplatter`, `startSpearBloodSplatter`, `startEnemyHitSplatter`, `tickHitSplatterEffect`, `HitSplatterDroplet`, `hitSplatterDroplets`, and the registered `draw` (body of `Renderer.ts`'s `drawHitSplatterEffects`). Preserve the `+ 0` IEEE-754 `−0` normalization exactly.
- [x] T013 [P] [US1] Create `src/themes/platformer/engine/effects/fadeOutText.ts`: move `FadeOutTextEffect`, `FADE_OUT_TEXT_DURATION_SECONDS`, `startFadeOutTextEffect`, `tickFadeOutTextEffect`, `fadeOutTextOpacity`, and the registered `draw` (body of `Renderer.ts`'s `drawFadeOutTexts`).
- [x] T014 [P] [US1] Create `src/themes/platformer/engine/effects/explosion.ts`: move `ExplosionEffect`, `EXPLOSION_FRAME_SECONDS`, `EXPLOSION_FRAME_COUNT`, `EXPLOSION_DURATION_SECONDS`, `startExplosionEffect`, `tickExplosionEffect`, `explosionFrameIndex`, and the registered `draw` (body of `Renderer.ts`'s `drawExplosions`).
- [x] T015 [P] [US1] Create `src/themes/platformer/engine/effects/debris.ts`: move `DebrisLayer`, `DebrisEffect`, `DEBRIS_DURATION_SECONDS`, `DebrisPiece`, `DEBRIS_GRAVITY_PX_PER_SEC2`, `DEBRIS_PIECE_KICKS`, `startDebrisEffect`, `tickDebrisEffect`, `debrisPieces`, `crumbleDebrisLayers`, and the registered `draw` (body of `Renderer.ts`'s `drawDebrisEffects`). Preserve the `+ 0` normalization and fixed quarter order.

### Registry, dispatch, barrel

- [x] T016 [US1] Register all eight kinds in declaration order in `src/themes/platformer/engine/effects/effectRegistry.ts`, wiring each module's `create`/`tick`/`draw`/`expired` with its `layer` and `resetScope` from the `data-model.md §5` table, in an order whose intra-layer sequence matches `flyingText` → `puff` → `debris` → `hitSplatter` → `fadeOutText`: `flyingText` (worldEffects/progress, override expired `phase === 'done'`), `counterPopup` (hudLast/progress, keyed by `labelKey`, override tick returns `null`), `puff` (worldEffects/progress), `healAura` (midWorld/progress), `debris` (worldEffects/progress), `hitSplatter` (worldEffects/progress), `fadeOutText` (worldEffects/**death**), `explosion` (aboveWorld/progress).
- [x] T017 [US1] Create the single layer-filtered dispatch `drawEffects(rc, layer, effects)` in `src/themes/platformer/engine/effects/drawEffects.ts`: iterate registry entries in declaration order, drawing only matching-`layer` kinds, and for each kind draw the collection's effects of that kind (FR-005). This is the ONLY effect draw dispatch; do not collapse layers (FR-018/FR-005).
- [x] T018 [US1] Create the public barrel `src/themes/platformer/engine/effects/index.ts` re-exporting the base, registry, collection ops, dispatch, and each per-kind module's public API (the single import site for consumers).

### State, spawn sites, tick, draw, deletion

- [x] T019 [US1] Replace the eight per-kind effect signals in `src/themes/platformer/PlatformerState.ts` (`activeFadeOutTexts`, `activeExplosions`, the flying-text-only `activeEffects`, `activePuffs`, `activeHealAuraEffects`, `activeHitSplatters`, `activeCounterPopups`, `activeDebrisEffects`) with one `export const activeEffects = signal<TransientEffect<unknown>[]>([])`; add the registry-driven `spawnEffect` helper (append; keyed kinds replace-in-place — see US5) and retarget all imports to `engine/effects` (FR-003). The four timed-tile timer signals remain separate.
- [x] T020 [US1] Update `src/themes/platformer/state/rewards.ts` to spawn flying-text effects and counter popups through the new modules/`spawnEffect` and read `effectCount(activeEffects.value, 'flyingText')` for the slot allocator seed (replacing the old flying-text-only signal length) (FR-003).
- [x] T021 [US1] Update `src/themes/platformer/PlatformerPage.tsx` tick: delete the six byte-identical per-kind tick bodies and the flyingText/counter transition plumbing; call exactly one `advanceEffects(activeEffects.value, dt)` per `playing` tick (FR-004/FR-007), and retarget every effect spawn site (flying text, puffs, heal aura, hit splatters, fade-out labels, explosions, debris, counter popups) to push into the unified collection.
- [x] T022 [US1] Update `src/themes/platformer/PlatformerPage.tsx` render loop: delete the eight per-kind draw calls (`drawCollectionEffects`, `drawPuffEffects`, `drawDebrisEffects`, `drawHitSplatterEffects`, `drawFadeOutTexts`, `drawExplosions`, `drawHealAuraEffects`, `drawCounterPopups`) and replace them with the one `drawEffects` dispatch invoked at the four pipeline points (midWorld, worldEffects, aboveWorld, hudLast), building the `EffectRenderContext` (including resolved `popupIcons` and live `playerAnchor`) (FR-005).
- [x] T023 [US1] Remove the eight now-relocated effect draw functions and their effect-type imports from `src/themes/platformer/engine/Renderer.ts`; `Renderer.ts` must no longer import effect types (D3/D7).
- [x] T024 [US1] Delete `src/themes/platformer/engine/CollectionEffects.ts` and redistribute `src/themes/platformer/engine/CollectionEffects.test.ts` cases into the per-kind module tests under `engine/effects/*.test.ts` (never weaken/skip/delete an assertion). No compatibility re-export survives (FR-018).
- [x] T024a [US1] Retarget the `DebrisLayer` type import in `src/themes/platformer/entities/hazards/FallingStalactite.ts` from the deleted `engine/CollectionEffects` to `engine/effects/debris` (or the `engine/effects` barrel), so the hazard view resolves after `CollectionEffects.ts` is removed (FR-012/FR-018).

### US1 test updates

- [x] T025 [US1] Update `src/themes/platformer/PlatformerState.test.ts` for the unified collection: remove per-kind signal assertions, assert exactly one `activeEffects`, and cover spawn/advance/clear entry points.
- [x] T026 [US1] Update `src/themes/platformer/PlatformerPage.test.tsx` for the unified collection, single tick, and four-invocation draw dispatch.
- [x] T027 [US1] Update `src/themes/platformer/state/rewards.test.ts` import paths and collection assertions to the unified `activeEffects`/`spawnEffect` API.
- [x] T028 [US1] Update `src/themes/platformer/engine/Renderer.test.ts`: remove tests for the eight draws that moved to effect modules, keep the remaining renderer tests, retarget **every** former `./CollectionEffects` import (the per-kind start/tick/derive symbols, `crumbleDebrisLayers`, and `explosionFrameIndex` where retained) to the owning `engine/effects/*` modules or the `engine/effects` barrel, and retarget the pixel-font-family import to `engine/textDraw`.
- [x] T029 [P] [US1] Write `src/themes/platformer/engine/effects/effectRegistry.test.ts`: the registry contract — a throwaway kind registered with one module + one registry line starts, advances, draws at its declared layer, and expires without any edit to state, tick, draw, or reset code (US1-5/SC-003).
- [x] T030 [P] [US1] Write boundary tests in `src/themes/platformer/engine/effects/flyingText.test.ts` and `src/themes/platformer/engine/effects/counterPopup.test.ts`: the 4-phase machine transitions at exactly RISE/HOLD/FLIGHT, is a no-op once `done`, and the counter popup returns the `null` sentinel at `elapsed >= duration`.
- [x] T031 [P] [US1] Write default-advance expiry tests for the six default families in their module tests (`puff.test.ts`, `healAura.test.ts`, `hitSplatter.test.ts`, `fadeOutText.test.ts`, `explosion.test.ts`, `debris.test.ts`): expiry fires at `elapsed > duration`, not `>=`.

**Checkpoint**: US1 complete — one collection, one advance, one dispatch; the per-kind signals, ticks, and draw calls are gone.

---

## Phase 4: User Story 2 - Four timed-tile machines share one core (Priority: P1)

**Goal**: Extract one shared arm/advance/elapsed/shake core for `MushroomSquash`, `FloorSpike`, `CrumblingFloor`, and `FallingStalactite`, leaving each module only its durations, key shape, arm/prune semantics, and phase/offset mapping.

**Independent Test**: None of the four modules contains its own arm/advance/prune loop; each delegates to `shared/timedTile.ts`; a mushroom re-arm replaces, spike/crumbling/stalactite re-arm no-ops, mushroom/spike/crumbling prune at cycle end while the stalactite never prunes, and both shake sites use the shared helper with unchanged gating.

### Tests FIRST

- [x] T032 [P] [US2] Write `src/themes/platformer/shared/timedTile.test.ts`: arm per `rearm` policy (`replace` restarts; `noop` leaves running); advance adds `dt`; `dt <= 0` leaves `elapsed` unchanged yet still prunes already-expired entries; `prune: false` never prunes; `timedTileElapsedFor` returns 0 when absent; `timedTileShakeOffsetX` matches `shakeOffsetX` and returns 0 outside an optional `window.until` gate; composite structural keys compare correctly; `GridTimerState` is structurally satisfied by a `{ col, row, elapsed }` entry.

### Implementation

- [x] T033 [US2] Create the pure leaf `src/themes/platformer/shared/timedTile.ts` per `contracts/timed-tile-core.md`: `TimedTileConfig<TState, K>` (`keyOf`, `keyOfArm`, `duration`, `prune`, `rearm`), the neutral `GridTimerState` shape (`{ col, row, elapsed }`), and `armTimedTile`, `advanceTimedTiles`, `timedTileElapsedFor`, `timedTileShakeOffsetX`. It imports only `shared/math.ts` — no `engine/`, `entities/`, `level/`, `editor/`, or state dependency.
- [x] T034 [US2] Route `src/themes/platformer/engine/MushroomSquash.ts` through the core: key `{col,row}`, `MUSHROOM_SQUASH_DURATION_SECONDS`, `prune: true`, `rearm: 'replace'`; keep `mushroomSquashDip`/`mushroomSquashDipAt` and the public `startMushroomSquash`/`advanceMushroomSquashes` signatures delegating to the core.
- [x] T035 [US2] Route `src/themes/platformer/engine/CrumblingFloor.ts` through the core: key `{col,row}`, `CRUMBLING_FLOOR_CYCLE_SECONDS`, `prune: true`, `rearm: 'noop'`; keep phase/crack/reform ratio functions; route `crumblingFloorShakeOffsetXAt` through `timedTileShakeOffsetX` with amplitude 1 native px and no window gate (always shakes).
- [x] T036 [US2] Route `src/themes/platformer/engine/FloorSpike.ts` through the core: key `{id}`, `FLOOR_SPIKE_CYCLE_SECONDS`, `prune: true`, `rearm: 'noop'`; keep `floorSpikePhaseAt/For`, `isFloorSpikeArmed`, `floorSpikeExtensionAt/For`.
- [x] T037 [US2] Route `src/themes/platformer/engine/FallingStalactite.ts` through the core: key `{id}`, `prune: false` (a `gone` entry persists for the attempt), `rearm: 'noop'`; keep the fall/phase/landing/detection functions; route `fallingStalactiteShakeOffsetXAt` through `timedTileShakeOffsetX` with amplitude 1.5 rendered px gated to the shake phase (returns 0 outside it).
- [x] T038 [P] [US2] Update `src/themes/platformer/engine/MushroomSquash.test.ts` and `src/themes/platformer/engine/CrumblingFloor.test.ts` for the core delegation while keeping every existing behaviour assertion (re-arm replace, prune at cycle, `dt <= 0`, shake output).
- [x] T039 [P] [US2] Update `src/themes/platformer/engine/FloorSpike.test.ts` and `src/themes/platformer/engine/FallingStalactite.test.ts` for the core delegation while keeping every existing behaviour assertion (no-op re-arm, never-prune stalactite, window-gated shake).

**Checkpoint**: US2 complete — the four timed tiles share `shared/timedTile.ts` and contain no arm/advance/prune/shake boilerplate.

---

## Phase 5: User Story 5 - Unification preserves every effect's lived lifecycle and layering (Priority: P1)

**Goal**: Make the single collection and dispatch reproduce every family's counts, keyed slots, player anchoring, death-lead-in behaviour, layer depth, and reset scope exactly.

**Independent Test**: Unit tests prove counter-popup refresh-in-place, player-anchored aura, the dying filtered advance, per-kind reset scope, and layer/order preservation; the manual browser pass (T070) shows no visible difference.

### Tests FIRST

- [x] T040 [P] [US5] Write keyed-slot tests in `src/themes/platformer/engine/effects/counterPopup.test.ts`: two collects of the same `labelKey` leave exactly one popup with the refreshed count and restarted timer; different `labelKey`s coexist (US5-1/FR-016).
- [x] T041 [P] [US5] Write lifecycle tests in `src/themes/platformer/PlatformerState.test.ts`: `resetGame()` clears only `fadeOutText` effects plus the four timed-tile timer arrays, leaving puffs/auras/splatters/debris/explosions/flyingText/counter popups intact; `resetGameProgress()` clears the whole collection (US5-5/FR-006); `advanceEffects(activeEffects.value, dt, { kinds: ['hitSplatter'] })` advances only splatters and holds every other effect's `elapsed` exactly (US5-3).

### Implementation

- [x] T042 [US5] Implement keyed replace-in-place: the registry declares `keyOf` only on the counter-popup entry, and the state-owned `spawnEffect` in `src/themes/platformer/PlatformerState.ts` upserts the counter-popup kind by `(kind, labelKey)` (refresh-in-place) and appends every non-keyed kind (FR-016). Do not export `spawnEffect` from `engine/effects` (no `engine/ → state/`, FR-013).
- [x] T043 [US5] Wire the per-kind reset scope in `src/themes/platformer/PlatformerState.ts`: `resetGame()` calls `clearEffectsByResetScope(activeEffects.value, 'death')` (fade-out labels only) alongside the existing four timed-tile clears; `resetGameProgress()` empties the whole collection (FR-006).
- [x] T044 [US5] Implement the `dying` filtered advance in `src/themes/platformer/PlatformerPage.tsx`: the `dying` branch calls `advanceEffects(activeEffects.value, dt, { kinds: ['hitSplatter'] })` so splatters keep spraying while every other effect's `elapsed` is frozen (FR-004/US5-3).
- [x] T045 [US5] Confirm the four layer invocations in `src/themes/platformer/PlatformerPage.tsx` sit at their exact pipeline points (heal aura mid-world, world effects after the hint bubble, explosions above world effects and below counters, counter popups last) and that registry declaration order preserves intra-layer order `flyingText → puff → debris → hitSplatter → fadeOutText` (FR-005/US5-4). Adjust call placement only if the pre-refactor order differs.
- [x] T046 [US5] Confirm the heal-aura draw in `src/themes/platformer/engine/effects/healAura.ts` consumes the live `playerAnchor` from `EffectRenderContext` every frame (no stored position) and that `PlatformerPage.tsx` populates it from the current player state (US5-2/FR-017).
- [x] T047 [P] [US5] Add `src/themes/platformer/engine/effects/drawEffects.test.ts` proving the dispatch draws only the requested layer, in registry declaration order, and that per-kind draws receive the full render context (FR-017).

**Checkpoint**: US5 complete — behaviour is byte-for-byte preserved across lifecycle, layering, and reset.

---

## Phase 6: User Story 3 - One particle-list producer for sparkle, splatter and debris (Priority: P2)

**Goal**: Back `sparkleParticles`, `hitSplatterDroplets`, and `debrisPieces` with one shared emission loop while each family keeps its own constants and layout.

**Independent Test**: All three derive functions route through `engine/effects/particles.ts`; at the same elapsed time every emitted offset and opacity is byte-identical to before.

### Tests FIRST

- [x] T048 [P] [US3] Write `src/themes/platformer/engine/effects/particles.test.ts`: the producer emits exactly `count` items, applies `offsetAt(index)`/`opacityAt()` per item, and introduces no randomness.
- [x] T049 [P] [US3] Write byte-identity tests at sampled elapsed times for the three producers in `puff.test.ts`, `hitSplatter.test.ts`, and `debris.test.ts`, migrating the existing `CollectionEffects.test.ts` assertions unchanged (SC-005).

### Implementation

- [x] T050 [US3] Create `src/themes/platformer/engine/effects/particles.ts` per `contracts/particle-producer.md`: `Particle` (`dx`, `dy`, `opacity`) and `particleList(count, offsetAt, opacityAt)`, owning only the count/emission loop and result shape.
- [x] T051 [US3] Rewire `sparkleParticles` in `src/themes/platformer/engine/effects/puff.ts` through `particleList`; keep `SPARKLE_COUNT`/`SPARKLE_MAX_RADIUS`/`scale`/window early-return in the module, and keep the exact `Math.cos`/`Math.sin` arithmetic in the module's closure so float-op order is unchanged.
- [x] T052 [US3] Rewire `hitSplatterDroplets` in `src/themes/platformer/engine/effects/hitSplatter.ts` through `particleList`; keep `dropletCount`, spread/gravity/shuffle constants and the fade curve in the module.
- [x] T053 [US3] Rewire `debrisPieces` in `src/themes/platformer/engine/effects/debris.ts` through `particleList`; keep `DEBRIS_PIECE_KICKS`/gravity/duration in the module.

**Checkpoint**: US3 complete — one particle-list producer; byte-identical output.

---

## Phase 7: User Story 4 - The hazard state machines live with their hazard kinds (Priority: P2)

**Goal**: Move the floor-spike and falling-stalactite state machines into `entities/hazards/` beside their views, fold the phase vocabulary in, and delete the orphan `phases.ts`, without widening R-001's forbidden edges.

**Independent Test**: Searching the theme finds no `engine/FloorSpike`, `engine/FallingStalactite`, or `hazards/phases` reference; `entities/hazards/FloorSpike.ts` and `FallingStalactite.ts` each export their view, timer state, constants, and phase/offset functions; every former importer retargets and behaviour is unchanged.

### Implementation

- [x] T054 [US4] Merge `src/themes/platformer/engine/FloorSpike.ts` into `src/themes/platformer/entities/hazards/FloorSpike.ts` so the module owns the view plus `FloorSpikePhase`, `FloorSpikeTimerState`, the `FLOOR_SPIKE_*` constants, `armFloorSpike`, `advanceFloorSpikes`, `floorSpikePhaseAt/For`, `isFloorSpikeArmed`, `floorSpikeExtensionAt/For` (delegating to `shared/timedTile.ts`).
- [x] T055 [US4] Merge `src/themes/platformer/engine/FallingStalactite.ts` into `src/themes/platformer/entities/hazards/FallingStalactite.ts` so the module owns the view plus `FallingStalactitePhase`, `FallingStalactiteTimerState`, the `FALLING_STALACTITE_*` constants, and `armFallingStalactite`, `advanceFallingStalactites`, `isFallingStalactiteArmed`, `fallingStalactiteElapsedFor`, `fallingStalactiteOffsetYAt`, `fallingStalactiteShakeOffsetXAt`, `fallingStalactiteLandingRow`, `fallingStalactiteSpriteHeight`, `fallingStalactiteRestOffsetY`, `fallingStalactitePhaseFor`, `detectionZoneCells`, `fallingStalactiteShatter`. Preserve its existing `entities/ → engine/` imports (`findLandingRow`, `StaticObjectsCatalog` geometry, and the `DebrisLayer` type retargeted to `engine/effects/debris`) and add no new forbidden edge. Type its `crumblingFloorStates` parameter as `readonly GridTimerState[]` from `shared/timedTile.ts` (structurally satisfied by `CrumblingFloorTimerState`) — do **not** import `engine/CrumblingFloor`.
- [x] T055a [US4] Remove the self-referential `fallingStalactiteRestOffsetY` import from `engine/FallingStalactite` in the merged `src/themes/platformer/entities/hazards/FallingStalactite.ts` (the function is now defined in the same module) and confirm no `hazards/phases` import remains (FR-011).
- [x] T056 [US4] Fold `src/themes/platformer/entities/hazards/phases.ts` fully into T054/T055 and delete it; no orphan re-export remains (FR-011).
- [x] T057 [US4] Retarget `src/themes/platformer/PlatformerState.ts` imports of the spike/stalactite machine functions and timer-state types to `entities/hazards/FloorSpike` / `entities/hazards/FallingStalactite` (removing the `engine/FloorSpike`, `engine/FallingStalactite`, and `hazards/phases` imports).
- [x] T058 [US4] Retarget `src/themes/platformer/PlatformerPage.tsx` falling-stalactite imports to `entities/hazards/FallingStalactite`.
- [x] T059 [US4] Retarget `src/themes/platformer/engine/Collision.ts` and `src/themes/platformer/engine/Collision.test.ts` spike/stalactite type imports to the new hazard modules.
- [x] T060 [US4] Retarget `src/themes/platformer/level/HazardMapper.ts` to import `FloorSpikePhase`/`FallingStalactitePhase` from the owning hazard modules through the allowed `level/ → entities/` edge — no `level/ → engine/` edge (FR-013).
- [x] T061 [US4] Update `src/themes/platformer/entities/hazards/index.ts` and its test to re-export the merged machine APIs from the two modules (no `phases` export).
- [x] T062 [US4] Delete `src/themes/platformer/engine/FloorSpike.ts`, `src/themes/platformer/engine/FloorSpike.test.ts`, `src/themes/platformer/engine/FallingStalactite.ts`, and `src/themes/platformer/engine/FallingStalactite.test.ts`; merge all their tests (updated, never weakened) into `src/themes/platformer/entities/hazards/FloorSpike.test.ts` and `FallingStalactite.test.ts`.
- [x] T063 [P] [US4] Update `src/themes/platformer/PlatformerState.test.ts` and `src/themes/platformer/PlatformerPage.test.tsx` hazard-constant imports to the new hazard modules.
- [x] T064 [US4] Verify FR-013/SC-008 structurally: `rg "from '.*engine/" src/themes/platformer/level/` returns no `level/ → engine/` import; `rg "from '.*(PlatformerState|state/)" src/themes/platformer/engine/` returns no `engine/ → state/`; `contracts/` is untouched; no orphan `phases.ts` remains (quickstart §2). Also confirm `rg "from '.*(engine/(FloorSpike|FallingStalactite)|CollectionEffects|engine/CrumblingFloor)" src/themes/platformer/entities/hazards/` shows no import of a deleted or unsanctioned engine module beyond the preserved imports (`findLandingRow`, `StaticObjectsCatalog` geometry, and the `DebrisLayer` type), and `rg "from '.*engine/(FloorSpike|FallingStalactite)" src/themes/platformer/editor/` returns no direct engine-machine import.

**Checkpoint**: US4 complete — each hazard kind is one self-contained `entities/hazards/` module.

---

## Phase 8: User Story 6 - Documented recipe for adding a new transient effect (Priority: P3)

**Goal**: Ship a short contributor recipe that makes the next effect (e.g. the planned O-026 Poison Gas) one module plus one registry line.

**Independent Test**: Following the recipe edits only a new effect module and one registry line — not state's collection list, the tick, the draw pass, or reset code — and the new kind starts, advances, draws, and expires.

- [x] T065 [US6] Write the contributor recipe at `docs/TransientEffectRecipe.md` (linked from the effect barrel's doc comment): name the `TransientEffect<S>` base and registry homes; show the `create`/`tick`/`draw`/`expired` shape; how to declare `layer`, `resetScope`, and `keyOf`; how the single `advanceEffects`/`drawEffects` picks it up; and the "one module + one registry line" rule (FR-020).
- [x] T066 [P] [US6] Add `src/themes/platformer/engine/effects/recipe.test.ts` that follows the recipe literally — defines a throwaway kind in one module and registers it with one registry line — and asserts it starts, advances, draws at its layer, and expires with no state/tick/draw/reset edits (SC-003/SC-011).

**Checkpoint**: US6 complete — the recipe is documented and regression-tested.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Full-suite, build, structural, manual, and docs validation across all stories.

- [x] T067 [P] Run the full `npm test` suite and confirm every test passes (existing tests updated only for import paths/signatures/locations) (FR-014/SC-007).
- [x] T068 Run `npm run build` and confirm the production build succeeds; confirm the bundle is neutral or smaller and no new runtime dependency was added (FR-019/SC-007).
- [x] T069 [P] Execute the quickstart §2 structural checks: no `CollectionEffects`; no per-kind effect signal names; exactly one `export const activeEffects` in `PlatformerState.ts`; `advanceEffects` has one definition; `drawEffects(` appears four times in `PlatformerPage.tsx`; no `engine/FloorSpike`/`engine/FallingStalactite`/`hazards/phases`; no `level/ → engine/` or `engine/ → state/` imports (SC-001/SC-006/SC-008).
- [ ] T070 Perform the quickstart §3 manual browser pass (`npm run dev`) over a level exercising every effect, the layered spot-checks, and the quickstart §4 timed-tile/hazard spot-checks (including the editor preview), confirming no visible or behavioural difference (SC-007).
- [x] T071 [P] Run `npm run lint` and resolve any lint errors introduced by the refactor (Constitution Principle III).
- [x] T072 Update `docs/Features.md`: prefix the R004 node label with `✅ ` and add `class R004 done` alongside its existing category class (per AGENTS.md).
- [x] T073 Verify no data migration: authored levels, markers, hazard placements, tuning, and constants are unchanged, and `package.json`/lockfile are untouched (FR-015/FR-019).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup; BLOCKS US1, US3, US5.
- **US1 (Phase 3)**: Depends on Foundational. Blocks US3 and US5.
- **US2 (Phase 4)**: Depends on Setup only (independent of the effect subsystem); creates `shared/timedTile.ts`, which US4 needs.
- **US5 (Phase 5)**: Depends on US1 (uses the unified collection/registry).
- **US3 (Phase 6)**: Depends on US1's per-kind modules.
- **US4 (Phase 7)**: Depends on US2 (`shared/timedTile.ts`) and its T036/T037 core routing; independent of US1/US5.
- **US6 (Phase 8)**: Depends on US1's registry (can run once US1 lands).
- **Polish (Phase 9)**: Depends on all desired stories.

### User Story Dependencies

- **US1 (P1)**: after Foundational — the substrate.
- **US2 (P1)**: after Setup — independent of US1; feeds US4.
- **US5 (P1)**: after US1 — preservation semantics.
- **US3 (P2)**: after US1 — rewires the per-kind modules.
- **US4 (P2)**: after US2 — relocates the already-core-routed machines.
- **US6 (P3)**: after US1 — documents the registry.

### Within Each User Story

- Tests are written before the implementation they cover and must fail first.
- Models/types before services; services before endpoints/tick/draw.
- Core implementation before integration/retargeting.
- Story complete before moving to the next priority.

---

## Parallel Opportunities

- T002, T004–T007 (Foundational) run in parallel once T003's shape is agreed.
- T008–T015 (eight per-kind modules) run in parallel — each in its own file.
- T029–T031, T032, T038–T039, T040–T041, T048–T049, T063, T067, T069, T071 are all `[P]`.
- T025–T028 test updates touch disjoint test files and can run in parallel.
- T057–T063 (US4 retargeting) touch different files and can run in parallel after T054–T056.

### Parallel Example: User Story 1 per-kind modules

```bash
Task: "Create engine/effects/flyingText.ts per T008"
Task: "Create engine/effects/counterPopup.ts per T009"
Task: "Create engine/effects/puff.ts per T010"
Task: "Create engine/effects/healAura.ts per T011"
Task: "Create engine/effects/hitSplatter.ts per T012"
Task: "Create engine/effects/fadeOutText.ts per T013"
Task: "Create engine/effects/explosion.ts per T014"
Task: "Create engine/effects/debris.ts per T015"
```

### Parallel Example: User Story 4 retargeting

```bash
Task: "Retarget PlatformerState.ts hazard imports per T057"
Task: "Retarget PlatformerPage.tsx hazard imports per T058"
Task: "Retarget engine/Collision.ts + test per T059"
Task: "Retarget level/HazardMapper.ts phase types per T060"
Task: "Update entities/hazards/index.ts per T061"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1) — the registry, unified collection, tick, and dispatch.
3. **STOP and VALIDATE**: run the US1 independent test (one collection/advance/dispatch; throwaway kind works) with `npm test`.
4. This is the core abstraction the feature exists to deliver; US3/US5/US6 build on it.

### Incremental Delivery

1. Setup + Foundational → base, registry types, text helper ready.
2. US1 → unified effect subsystem (MVP of the abstraction).
3. US2 → timed-tile core (independent track; can proceed alongside US1).
4. US5 → preservation semantics hardened and unit-tested.
5. US3 → particle producer extraction.
6. US4 → hazard machine relocation.
7. US6 → contributor recipe.
8. Polish → full suite, build, structural/manual verification, docs.

### Notes

- `[P]` tasks edit different files with no incomplete-task dependency.
- Preserve byte-identity everywhere: no gameplay, visual, tuning, or level-data change (FR-019).
- Do not add compatibility re-exports or a second per-kind path (FR-018).
- Commit after each task or logical group; do not auto-commit.
- Update `docs/Features.md` only at completion (Phase 9).
