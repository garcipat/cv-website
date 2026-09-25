# Feature Specification: Platformer Transient Effect Registry

**Feature Branch**: `R-004-platformer-transient-effect-registry`

**Created**: 2026-09-25

**Status**: Draft

**Input**: GitHub issue #92 — "R-004: Platformer Transient Effect Registry". Unify the parallel transient effect state machines behind one `TransientEffect<S>` registry, one collection, one tick and one draw pass; extract a shared timed-tile core and a shared particle-list producer; and land the floor-spike and falling-stalactite state machines in their proper home under `entities/hazards/`.

**Depends on**: [R-001 Platformer Core Contracts & Dependency Layers](../R-001-platformer-core-contracts/spec.md) (the `contracts/` + layer invariants the registry and the hazard move must respect), [R-002 Platformer Shared Primitives & Dedup](../R-002-platformer-shared-primitives/spec.md) (the `shared/math.ts` primitives — `clamp01`, `lerp`, `pulse`, `shakeOffsetX` — the effect and timed-tile bodies already consume), [O-023 Platformer Crumbling Floor Blocks](../O-023-platformer-crumbling-floor/spec.md) (shipped: supplies the crumbling-floor timed tile), and [O-027 Platformer Falling Stalactite](../O-027-platformer-falling-stalactite/spec.md) (shipped: supplies the falling-stalactite hazard machine).

**Design reference**: [`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) — Phase 2, findings **E1** (no shared effect abstraction; 10 parallel effect state machines), **E4** (four near-identical timed-tile state machines), and the placement note in §4.1 / the F2 "rides with" row (hazard state machines belong under `entities/hazards/`).

## Clarifications

### Session 2026-09-25

- Q: Does R-004 unify all the parallel effect machines, or only the eight `engine/CollectionEffects.ts` families, leaving `HintTooltip` and mushroom-as-effect to R-005? → A: R-004 builds the **one unified effect concept** and streams every effect that already exists in `engine/CollectionEffects.ts` through it, plus the four timed tiles through the shared timed-tile core. The tooltip is an effect (a speech bubble) too, but it stays **sign-specific for now**; R-005 generalizes it to `SpeechBubble` (the sign then uses the generic effect). The registry must be shaped so `SpeechBubble` and future effects (e.g. **O-026 Platformer Poison Gas**) are one module plus one registry line. R-004 also ships a **documented recipe for adding a new transient effect** (US6/FR-020).
- Q: The hazard move pulls `engine/Standable.findLandingRow` and `engine/StaticObjectsCatalog` stalactite geometry into `entities/hazards/`, an `entities/ → engine/` edge R-001 forbids. Relocate those helpers too, or move the machines and keep the current dependency surface? → A: Move the machines and fold their phase vocabulary; **preserve the pre-existing helper imports** and add **no new forbidden edges** (`level/ → engine/`, `engine/ → state/`). Relocating the helpers is left to a later feature.
- Q: "One draw pass replaces eight" cannot mean one z-layer — the eight passes sit at different pipeline depths. How should the single pass handle depth? → A: **One registry dispatch, invoked at the pipeline points (or ordered by a depth field) needed to preserve each effect's exact current depth**, so output stays byte-identical. The heal aura stays mid-world, explosions stay above the world effects, counter popups stay last.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - One registry, one collection, one tick, one draw pass (Priority: P1)

A developer adding a transient visual today must touch six places: declare a new effect interface, write a `start`/`tick`/derive trio, add a new signal in `PlatformerState.ts`, add a tick call in `PlatformerPage.tsx`, add a draw function in `Renderer.ts`, and add a draw call plus a reset entry. `engine/CollectionEffects.ts` hand-rolls eight families (`FlyingTextEffect`, `CounterPopupEffect`, `PuffEffect`, `HealAuraEffect`, `HitSplatterEffect`, `FadeOutTextEffect`, `ExplosionEffect`, `DebrisEffect`), six of their tick bodies are byte-identical (`{...effect, elapsed: effect.elapsed + dt}`), and each has its own signal and draw pass. After this feature there is one `TransientEffect<S>` base, one registry mapping each effect kind to its start/tick/draw, one `activeEffects` collection, one `advanceEffects` tick, and one draw pass — so a new effect is one module plus one registry line.

**Why this priority**: This is the core abstraction the feature exists to deliver (E1). It removes the six-way duplication and the parallel signal/pass sprawl that make every cosmetic addition a six-file edit, and it is the substrate R-005 builds the generic speech bubble on.

**Independent Test**: Inspect `PlatformerState.ts` — one `activeEffects` collection exists and the eight per-kind effect signals are gone. Inspect `PlatformerPage.tsx`'s tick — one `advanceEffects(activeEffects, dt)` call replaces the six byte-identical tick bodies (flying text and counter popups keep their own transition logic through their registered `tick`); one effect draw dispatch replaces the eight `draw*Effects`/`drawCounterPopups` calls. Then add a throwaway effect kind and confirm it starts, advances, draws, and expires with **no** edit to state, the tick, the draw pass, or a reset list.

**Acceptance Scenarios**:

1. **Given** the platformer theme, **When** it is searched for the effect base, **Then** exactly one `TransientEffect<S>` type is exported with the fields the issue names — `id`, `elapsed`, `duration`, `tick`, `draw`, `expired` — and it is the shape every registered effect family is expressed in.
2. **Given** `PlatformerState.ts`, **When** its effect state is inspected, **Then** exactly one `activeEffects` collection holds every transient effect; `activeEffects` (flying text), `activePuffs`, `activeHealAuraEffects`, `activeHitSplatters`, `activeCounterPopups`, `activeExplosions`, `activeFadeOutTexts`, and `activeDebrisEffects` no longer exist as separate effect stores.
3. **Given** the game tick, **When** it is inspected, **Then** a single `advanceEffects(activeEffects, dt)` advances the whole collection, replacing the six byte-identical per-kind tick bodies; the flying-text phase machine and the counter-popup sentinel remain per-kind `tick` hooks reached through the registry.
4. **Given** the render loop, **When** the effect draws are inspected, **Then** a single draw pass dispatches each effect to its registered draw; the eight per-kind effect draw functions are no longer each called for their own array.
5. **Given** a throwaway new effect kind, **When** it is registered, **Then** it starts, advances, draws, and expires with no edit to the state module's effect list, the tick, the draw pass, or the reset code.
6. **Given** a `resetGame()` (death/respawn), **When** the collection is inspected, **Then** the per-kind reset policy is preserved: the same effect kinds that survive a death today still survive, and the ones cleared today are still cleared (the unified collection must not clear everything unconditionally).

---

### User Story 2 - Four timed-tile machines share one core (Priority: P1)

The bouncy-mushroom squash, the floor spike, the crumbling floor, and the falling stalactite each re-implement the same "arm a timer, advance it by `dt`, read elapsed, prune when a cycle ends" scaffolding, and two of them re-implement the same sine shake. `MushroomSquash.ts`, `FloorSpike.ts`, `CrumblingFloor.ts`, and `FallingStalactite.ts` differ only in their key shape (`{col,row}` vs. `{id}`), their durations, their arm semantics (replace vs. no-op), their prune policy, and their phase table. After this feature one shared timed-tile core provides arm/advance/elapsed/shake, and each kind keeps only its durations and its phase mapping.

**Why this priority**: This is the second half of the duplication the issue targets (E4). It removes near-identical arm/advance/shake bodies that have already drifted in their arm and prune semantics, and it is a prerequisite for R-005 re-homing the mushroom squash as a registered effect.

**Independent Test**: Inspect the four modules — none contains its own arm/advance/shake boilerplate; each delegates to the shared core with its own key accessor, duration, and phase table; each kind's arm, prune, and re-arm behaviour is unchanged (a mushroom squash re-arm replaces, a spike/crumbling re-arm is a no-op, a stalactite never prunes).

**Acceptance Scenarios**:

1. **Given** the shared timed-tile core, **When** it is inspected, **Then** it exports the arm, advance, elapsed-lookup, and shake helpers, parameterized by the caller's key (grid position or id), duration, and prune policy — not hardcoded to one key shape.
2. **Given** `MushroomSquash`, `FloorSpike`, `CrumblingFloor`, and `FallingStalactite`, **When** each is inspected, **Then** none contains its own arm/advance/prune loop; each keeps only its durations, its key shape, and its phase/offset mapping.
3. **Given** a re-arm while a cycle is running, **When** it is applied, **Then** the mushroom still restarts its entry and the spike/crumbling/stalactite still no-op, exactly as today.
4. **Given** a completed cycle, **When** it advances, **Then** the mushroom/spike/crumbling entries are pruned and the stalactite's `gone` entry persists for the attempt, exactly as today.
5. **Given** the two shake sites (crumbling floor, falling stalactite), **When** they are inspected, **Then** both call the shared shake helper with their own amplitude and window gating, and their outputs are unchanged.

---

### User Story 3 - One particle-list producer for sparkle, splatter and debris (Priority: P2)

`sparkleParticles`, `hitSplatterDroplets`, and `debrisPieces` are three copies of the same "emit a fixed, deterministic list of offsets and per-item opacity from elapsed time" producer, differing only in count, layout formula and fade curve. After this feature one shared producer/curve helper backs all three, and each effect keeps only its own parameters and layout.

**Why this priority**: It is the last named E1 duplication and pairs naturally with the registry — each effect's derive step becomes a thin wrapper over one producer. It carries no behaviour change, so it follows the core work.

**Independent Test**: Inspect the three producers — each delegates to one shared particle-list helper for its opacity/fade and list shape, while its own layout constants remain in its module; the produced droplets/pieces are identical to today.

**Acceptance Scenarios**:

1. **Given** the sparkle burst, the hit splatter, and the debris burst, **When** their derive functions are inspected, **Then** all three route through one shared particle-list producer rather than each hand-rolling the count/opacity loop.
2. **Given** each effect's constants (sparkle count/radius, splatter counts/spreads, debris kicks/gravity), **When** they are inspected, **Then** they stay in the owning effect module; only the shared shape is extracted.
3. **Given** the same elapsed times as before, **When** each derive function runs, **Then** every emitted offset and opacity is byte-identical to the pre-refactor output.

---

### User Story 4 - The hazard state machines live with their hazard kinds (Priority: P2)

The floor-spike and falling-stalactite state machines are `engine/` services (`engine/FloorSpike.ts`, `engine/FallingStalactite.ts`) even though the hazard kinds and their views already live in `entities/hazards/`, and the pure phase vocabulary they share sits beside the views in `entities/hazards/phases.ts`. After this feature each machine lives in its own hazard module under `entities/hazards/` — merged with its view and folding in its phase vocabulary — so a hazard kind is one self-contained module plus one registry line, matching the enemy/block pattern.

**Why this priority**: It completes the "one concept, one home" intent and lands the move the analysis pairs with the effect work (§4.1, the F2 "rides with" row). It is placed after the core unification because it churns imports across the page, state, collision, level mappers and editor.

**Independent Test**: Search the theme for `engine/FloorSpike` and `engine/FallingStalactite` — no module imports them and neither file exists; `entities/hazards/FloorSpike.ts` and `entities/hazards/FallingStalactite.ts` each export their kind's view, timer state, constants, and phase vocabulary; every former importer retargets and behaviour is unchanged.

**Acceptance Scenarios**:

1. **Given** the theme, **When** `engine/FloorSpike.ts` and `engine/FallingStalactite.ts` are searched, **Then** both are gone and their state machines, constants and cycle/phase functions are owned by `entities/hazards/FloorSpike.ts` and `entities/hazards/FallingStalactite.ts` respectively.
2. **Given** `entities/hazards/phases.ts`, **When** its vocabulary is searched, **Then** each phase/timer type is owned by its hazard module (or a dependency-free sibling within `entities/hazards/`) and no orphan `phases.ts` remains that only re-exports.
3. **Given** the former importers (`PlatformerState.ts`, `PlatformerPage.tsx`, `engine/Collision.ts`, `engine/Collision.test.ts`, the editor preview, and the hazard tests), **When** they are inspected, **Then** each imports from the new home and behaviour is unchanged.
4. **Given** `level/HazardMapper.ts`, **When** it needs `FloorSpikePhase`/`FallingStalactitePhase`, **Then** it still reaches them through an allowed `level/ → entities/` edge and no `level/ → engine/` edge is introduced.
5. **Given** the moved modules, **When** the import graph is inspected, **Then** R-001's forbidden edges are not widened: no new `engine/ → state/`, no new `level/ → engine/`, and `contracts/` stays a leaf.

---

### User Story 5 - Unification preserves every effect's lived lifecycle and layering (Priority: P1)

The eight effect families are not interchangeable: the counter popups are a per-type slot that refreshes in place (at most one per label), the heal aura carries no position of its own and re-anchors to the moving player every frame, the hit splatters keep advancing during the death lead-in while the rest of the world freezes, and the eight passes sit at different depths of the render pipeline. After this feature the single collection and pass reproduce all of this exactly — the same counts, positions, order, opacity curves, and reset behaviour — so the refactor is invisible in-game.

**Why this priority**: It is the constraint that makes the unification non-trivial and the one that a naive "just merge the arrays" refactor breaks. It is the acceptance bar for "behaviour is byte-for-byte preserved".

**Independent Test**: Walk a level that triggers each effect (collect a coin and a fruit, stomp an enemy, get hit, take a heart, open a chest, detonate a bomb, break a crumbling tile, land a stalactite, die to a spear) and compare against the pre-refactor build; separately unit-test the per-kind semantics (counter-popup refresh-in-place, player-anchored aura, death-lead-in splatter tick, per-kind reset scope).

**Acceptance Scenarios**:

1. **Given** two collects of the same collectible type in quick succession, **When** the counter popup is inspected, **Then** exactly one popup exists for that type with the refreshed count and restarted timer (replace-in-place), while collectibles of different types show simultaneously.
2. **Given** a heal aura in flight, **When** the player moves, **Then** the aura stays anchored to the player's live position (the effect stores no position of its own).
3. **Given** the `dying` lifecycle phase, **When** the tick runs, **Then** hit splatters still advance through the death lead-in and no other effect advances (the world is frozen).
4. **Given** the render pipeline, **When** the effect draw dispatch runs at its pipeline layer, **Then** each effect is drawn at the same depth relative to the world, the darkness/overlay passes, and the HUD as before (heal aura mid-world, explosions above world effects and below the counters, counter popups last), so output is unchanged.
5. **Given** a death/respawn, **When** the collection is inspected, **Then** the kinds cleared today (fade-out labels) are cleared and the kinds that survive today (puffs, heal auras, splatters, debris, explosions, flying text, counter popups) still survive; a full "Reset Game" still clears the whole collection.

---

### User Story 6 - Documented recipe for adding a new transient effect (Priority: P3)

The abstract concept is only worth its cost if the next effect is cheap to add. Today the "how" lives in scattered doc comments across `CollectionEffects.ts`, `PlatformerState.ts`, and `PlatformerPage.tsx`, so an author adding a new effect (the planned **O-026 Platformer Poison Gas** is the motivating example) has no single place to learn the shape. After this feature a short contributor recipe documents the one path: define the effect's data, register its start/tick/draw/expiry, push it into `activeEffects`, and let the single advance and draw pass do the rest — with no edits to state, tick, draw, or reset plumbing.

**Why this priority**: It is the payoff of the abstraction and directly requested; it is documentation, carries no runtime risk, and can land last.

**Independent Test**: Follow the recipe to add a throwaway effect with only a new module and one registry line, and confirm it starts, advances, draws, and expires without touching the state list, tick, draw pass, or reset code.

**Acceptance Scenarios**:

1. **Given** the recipe, **When** a developer follows it, **Then** the only files they edit are the new effect module and the registry line — not `PlatformerState.ts`'s effect list, the game tick, the draw pass, or a reset list.
2. **Given** the recipe, **When** it is read, **Then** it names where the base type and registry live, how `tick`/`draw`/`expired` are used, how reset scope is declared per kind, and how draw depth is chosen.
3. **Given** the planned poison-gas effect, **When** the recipe is applied, **Then** the abstraction accommodates it without a new signal, tick, or draw call.

---

### Edge Cases

- ✅ **Counter popups are a keyed slot, not an append list.** At most one popup per collectible type exists; a fresh collect of the same type refreshes that slot and restarts its timer. A single flat collection must preserve this replace-by-key behaviour (or store the kind key on the effect and reconcile on insert). Resolved by US5/FR-016 and US5 scenario 1.
- ✅ **The heal aura has no world position.** Unlike every other effect it re-derives its anchor from the live player each frame, so its registered `draw`/derive must receive the current player anchor rather than a stored `x`/`y`. Resolved by FR-016.
- ✅ **The single draw pass must not flatten z-order.** The eight passes are not adjacent: the heal aura is drawn mid-world (after the player/held torch, before collectibles), the world effects after the hint bubble, explosions above the world effects, and counter popups after the enemy-eye/hint/UI work. Unifying must preserve that depth, whether by a layer/order field, ordered dispatch, or more than one invocation of the one dispatch. Resolved by FR-005 and US5 scenario 4.
- ✅ **Effects do not all expire the same way.** Some filter on `elapsed <= duration`, some on `elapsed < duration`, one returns a `null` sentinel (`tickCounterPopup`), and the flying text has a four-phase machine terminated by `phase !== 'done'`. The registry's expiry hook must reproduce each family's exact boundary. Resolved by FR-004/FR-007.
- ✅ **`dt <= 0` must not rewind and must still prune.** The mushroom/spike/crumbling advances leave `elapsed` unchanged for `dt <= 0` but still drop already-expired entries. The shared timed-tile core must keep that. Resolved by FR-009.
- ✅ **Arm semantics differ per kind.** Mushroom re-arm replaces an in-progress entry; spike/crumbling/stalactite re-arm is a no-op; the stalactite never prunes (`gone` persists for the attempt). The shared core must parameterize all three. Resolved by FR-009.
- ✅ **Reset scope differs per kind and per reset.** `resetGame()` (death/respawn) clears only the fade-out labels and the four timed-tile timers; `resetGameProgress()` (Reset Game button) clears the whole effect collection. Merging the signals must not make death/respawn wipe puffs/splatters/auras. Resolved by FR-006 and US5 scenario 5.
- ✅ **The dying lead-in is a filtered tick.** The loop's `dying` branch advances only hit splatters; the registry's advance must be reachable in filtered form so this survives. Resolved by FR-004 and US5 scenario 3.
- ✅ **Hazard placement must not create a `level/ → engine/` edge.** `level/HazardMapper.ts` consumes the spike/stalactite phase types; after the move those types come from `entities/hazards/`, which `level/` may import, and the mapper must not reach back into `engine/`. Resolved by FR-011/FR-013 and US4 scenario 4.
- ✅ **Hazard placement must not widen `entities/ → engine/`.** The moved machines need `findLandingRow` (`engine/Standable.ts`), the stalactite twin geometry (`engine/StaticObjectsCatalog.ts`), and the `DebrisLayer` type (retargeted to `engine/effects/debris`), which the current hazard view already imports. The move must preserve the existing dependency surface and introduce no new forbidden edges (see Assumptions). Their crumbling-floor parameter is typed against the dependency-free `GridTimerState` from `shared/timedTile.ts`, so no new `engine/CrumblingFloor` import is added. Resolved by FR-013.
- ✅ **The stalactite shake is window-gated; the crumbling-floor shake is not.** The two shake sites are not identical: the stalactite returns `0` outside its shake phase, the crumbling floor always shakes. The shared helper must be used without changing either gating. Resolved by FR-009/US2 scenario 5.
- ✅ **`activeEffects` is already a used name for the flying-text signal.** The unified collection takes that name, so every consumer of the old flying-text-only signal retargets; no consumer may keep a second list. Resolved by FR-003/FR-018.
- ✅ **No compatibility re-exports.** Formerly separated tick/draw entry points must not survive as thin aliases that keep the old parallel path alive. Resolved by FR-018.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A single `TransientEffect<S>` base type MUST exist with the fields the issue names — `id`, `elapsed`, `duration`, `tick`, `draw`, `expired` — and MUST be the shape every registered transient effect is expressed in. `tick` MUST advance elapsed and MAY return an "expired"/transitioned result (so a phase machine like the flying text and a sentinel like the counter popup both fit); `draw` MUST receive the render context the effect family needs. R-004 MUST stream every effect family that already exists in `engine/CollectionEffects.ts` through this concept, and the concept MUST admit future kinds (`SpeechBubble` in R-005, and e.g. **O-026 Platformer Poison Gas**) as one module plus one registry line — without R-004 itself migrating the sign-specific `HintTooltip`.
- **FR-002**: An effect registry MUST map each effect kind to its start/create, tick, draw, and expiry behaviour, so adding a kind is one registry entry plus its module and no change to the state list, the tick, the draw pass, or reset code.
- **FR-003**: Exactly one `activeEffects` collection MUST replace the eight per-kind effect signals (`activeEffects` flying text, `activePuffs`, `activeHealAuraEffects`, `activeHitSplatters`, `activeCounterPopups`, `activeExplosions`, `activeFadeOutTexts`, `activeDebrisEffects`); no effect MAY retain a parallel store.
- **FR-004**: Exactly one `advanceEffects(activeEffects, dt)` MUST advance the collection, replacing the six byte-identical per-kind tick bodies; it MUST preserve every family's non-identical transition (the flying-text rise/hold/fly phase machine, the counter-popup `null` sentinel) through the registry, MUST preserve each family's exact expiry boundary, and MUST be exposable in a kind-filtered form so the `dying` phase can advance only hit splatters. The effect advance is only invoked from the positive-`dt` `playing` branch; the `dt <= 0` no-rewind semantics belong to the timed-tile core (FR-009).
- **FR-005**: Exactly one effect draw dispatch MUST exist and dispatch each effect to its registered draw, replacing the eight per-kind draw calls; the single dispatch implementation MUST be invoked once per pipeline layer needed to preserve each effect's depth (heal aura mid-world; world effects after the hint bubble; explosions above the world effects and below the counters; counter popups last), so output is visually unchanged. It MAY alternatively order effects by a depth field, but it MUST NOT collapse everything to one z-layer.
- **FR-006**: Reset behaviour MUST be preserved: a death/respawn (`resetGame()`) MUST clear exactly the effect kinds it clears today (the fade-out labels and the four timed-tile timers), and a full "Reset Game" (`resetGameProgress()`) MUST clear the whole effect collection.
- **FR-007**: The registry MUST express per-kind interval logic through the `tick` hook so the phase machines and sentinels survive; the six identical bodies MUST collapse to one default advance rather than six copies.
- **FR-008**: A shared timed-tile core MUST exist, exporting arm, advance, elapsed-lookup, and shake helpers parameterized by the caller's key accessor (grid position or id), duration, prune policy, and re-arm policy.
- **FR-009**: `MushroomSquash`, `FloorSpike`, `CrumblingFloor`, and `FallingStalactite` MUST route their arm/advance/elapsed/shake through the shared core, keeping only their durations, key shapes, and phase/offset mappings. Their arm semantics (mushroom replace, others no-op), prune semantics (stalactite never prunes), `dt <= 0` behaviour, and shake outputs MUST be unchanged.
- **FR-010**: A shared particle-list producer MUST back the sparkle burst, the hit splatter, and the debris burst, so the count/opacity emission loop exists once; each effect's layout constants stay in its module and all outputs MUST be byte-identical.
- **FR-011**: `entities/hazards/FloorSpike.ts` and `entities/hazards/FallingStalactite.ts` MUST own their kind's full state machine — timer state, constants, arm/advance/phase/offset functions, and view — and `entities/hazards/phases.ts` MUST be folded into the owning hazard modules (or a dependency-free sibling inside `entities/hazards/`), leaving no orphan re-export. `engine/FloorSpike.ts` and `engine/FallingStalactite.ts` MUST be removed.
- **FR-012**: Every former importer of the moved hazard modules MUST retarget to the new home — `PlatformerState.ts`, `PlatformerPage.tsx`, `engine/Collision.ts`, the editor preview, and the relocated hazard tests — with behaviour unchanged.
- **FR-013**: The change MUST NOT widen R-001's forbidden edges: no new `level/ → engine/`, no new `engine/ → state/`, and `contracts/` MUST stay a leaf. The `level/ → entities/` edge the hazard phase types now use MUST remain allowed. The moved hazard machines MAY keep the `entities/ → engine/` imports the hazard views already carry (`engine/Standable.findLandingRow`, `engine/StaticObjectsCatalog` stalactite geometry, and the `DebrisLayer` type from `engine/effects/debris`); relocating those helpers is out of scope. The moved falling-stalactite machine MUST NOT import `engine/CrumblingFloor`: its `crumblingFloorStates` parameter MUST be typed against the dependency-free grid-timer shape exported by `shared/timedTile.ts` (which `CrumblingFloorTimerState` satisfies structurally), so the merge adds no new `entities/ → engine/` edge beyond those preserved imports.
- **FR-014**: The change MUST preserve behaviour: all existing tests (updated only where a signature, import path, or file location changed — never weakened, skipped, or deleted) MUST pass, and the production build MUST succeed.
- **FR-015**: There MUST be no data migration: authored levels, markers, hazard placements, tuning, and constant values are unchanged.
- **FR-016**: The unified collection and registry MUST support the per-kind shapes the eight families rely on: a keyed replace-in-place slot (counter popups, at most one per collectible type), a player-anchored effect with no stored position (heal aura), world-anchored effects with stored positions, screen-anchored text effects, and effects carrying sprite-layer lists (debris).
- **FR-017**: The registry's draw dispatch MUST receive the render context each family needs (canvas context, `DrawContext`/sprites, camera origin, canvas dimensions, live player anchor) so no family loses information in the move.
- **FR-018**: No compatibility re-export, alias, or second code path MAY preserve a now-unified per-kind signal, tick, or draw entry point.
- **FR-019**: There MUST be no new effect kinds, gameplay, visuals, tuning, or level data introduced — this feature only unifies and relocates what already ships.
- **FR-020**: A contributor-facing recipe MUST document how to add a new transient effect — the `TransientEffect` shape, the registry entry, how `tick`/`draw`/`expired` are used, how per-kind reset scope is declared, and how draw depth is chosen — such that following it requires only a new module plus one registry entry (US6).

### Key Entities

- **`TransientEffect<S>`**: the one transient-effect base (`id`, `elapsed`, `duration`, `tick`, `draw`, `expired`) every effect family is expressed in.
- **Effect registry**: the kind → start/tick/draw/expiry map that makes a new effect one module plus one line.
- **`activeEffects` collection + `advanceEffects`**: the single effect store and its single tick, replacing eight signals and six identical tick bodies.
- **Effect draw pass**: the single dispatch replacing the eight per-kind draw calls while preserving each family's depth.
- **Timed-tile core**: the shared arm/advance/elapsed/shake helpers for the mushroom squash, floor spike, crumbling floor, and falling stalactite.
- **Particle-list producer**: the shared deterministic offsets/opacity emitter behind sparkle, splatter, and debris.
- **Floor-spike hazard module** (`entities/hazards/FloorSpike.ts`): view + timer state + constants + cycle/phase/extension functions.
- **Falling-stalactite hazard module** (`entities/hazards/FallingStalactite.ts`): view + timer state + constants + arm/advance/phase/offset/landing functions.
- **Hazard phase vocabulary** (folded into the hazard modules): `FloorSpikePhase`/`FloorSpikeTimerState`, `FallingStalactitePhase`/`FallingStalactiteTimerState`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Exactly one `activeEffects` collection, one `advanceEffects`, and one effect draw dispatch exist (the dispatch invoked once per pipeline layer); a search finds zero per-kind effect signals and zero per-kind effect draw calls in the render loop.
- **SC-002**: The six byte-identical tick bodies are reduced to one default advance (zero remaining copies).
- **SC-003**: Adding a throwaway effect kind requires one module plus one registry entry and changes no file in state, the tick, the draw pass, or reset.
- **SC-004**: The four timed-tile machines share one core; a search finds no remaining duplicated arm/advance/prune/shake body in the four modules.
- **SC-005**: The three particle producers share one producer; each family's emitted offsets and opacities are byte-identical.
- **SC-006**: `engine/FloorSpike.ts` and `engine/FallingStalactite.ts` are gone, `entities/hazards/` owns both machines, and no orphan `phases.ts` remains; every former importer resolves to the new home.
- **SC-007**: The full test suite passes and the production build succeeds; a manual browser pass over a level exercising each effect (collect coin/fruit, stomp an enemy, get hit, take a heart, open a chest, detonate a bomb, break a crumbling tile, trigger a floor spike, drop a stalactite, die to a spear) and its editor preview show no visible or behavioural difference.
- **SC-008**: R-001's forbidden edges are not widened (`level/ → engine/`, `engine/ → state/` absent; `contracts/` a leaf), and the `level/ → entities/` hazard-phase edge still resolves.
- **SC-009**: Reset scope is preserved: death/respawn clears the same effect kinds as before, and full reset clears the whole collection.
- **SC-010**: Counter popups still show at most one per type with refresh-in-place; the heal aura still follows the moving player; hit splatters still advance during the death lead-in and nothing else does.
- **SC-011**: A contributor recipe exists and is sufficient: adding a throwaway (or the planned poison-gas) effect touches only a new module and one registry line.

## Assumptions

- **The duplicated bodies are the ones the analysis names.** The eight families are the ones in `engine/CollectionEffects.ts`; the six byte-identical tick bodies are `tickPuffEffect`, `tickHealAuraEffect`, `tickHitSplatterEffect`, `tickFadeOutTextEffect`, `tickExplosionEffect`, `tickDebrisEffect`; the three particle producers are `sparkleParticles`, `hitSplatterDroplets`, `debrisPieces`.
- **R-004 unifies the existing effect families; the tooltip stays specific for now.** R-004 streams the eight `engine/CollectionEffects.ts` families through one concept and routes the four timed tiles through the shared core. The sign-named `HintTooltip` is left sign-specific; R-005 (#93, which depends on this feature) generalizes it to `SpeechBubble`, and the sign will then use the generic effect. The registry is built to admit `SpeechBubble` and future effects (e.g. O-026 Poison Gas) as one module plus one registry line, and R-004 ships the contributor recipe (US6/FR-020). Re-homing the mushroom squash as a registered effect remains R-005; R-004 only includes it in the timed-tile core.
- **`TransientEffect<S>`'s home is a plan decision.** The base and registry are engine/runtime constructs (they carry `draw`/`tick` behaviour), so they live outside the pure `contracts/` leaf; the exact module (`engine/effects.ts`, `engine/effects/`, or the F7 `features/effects/` target) is settled in planning, not here.
- **"One draw pass" means one dispatch, invoked per layer, preserving depth.** The eight passes currently sit at different pipeline depths; the unification preserves that depth (by a layer/order field, ordered dispatch, or one dispatch invoked at the pipeline points) rather than collapsing everything to one z-layer.
- **Behaviour is byte-for-byte preserved.** The only sanctioned changes are the registry/collection/tick/draw unification, the timed-tile and particle-producer extractions, the hazard relocation, and import retargeting — never a change to gameplay, visuals, tuning, or level data.
- **The hazard machines move as part of R-004.** The analysis pairs the move with the effect work (F2 "rides with" the phase-2 work), and the issue explicitly directs it. Their existing `entities/ → engine/` imports (`findLandingRow`, the stalactite twin geometry, and the `DebrisLayer` type — the hazard view already imports these) are preserved, not widened; relocating those helpers to allowed homes is left to a later feature, and R-004 adds no forbidden `level/ → engine/` or `engine/ → state/` edges. The moved falling-stalactite machine consumes crumbling-floor timer state through the dependency-free `GridTimerState` shape exported by `shared/timedTile.ts`, so the merge adds no `entities/ → engine/CrumblingFloor` edge either.
- **No folder reorganisation beyond the hazard move.** The broader `engine/render/` + `features/` split (F7) is later work; R-004 keeps every other module where R-001/R-002/R-003 landed it.
- **`DeployableLadder` and `PlacedBomb` are out of the timed-tile core.** They also carry elapsed timers, but the issue names only the mushroom/spike/crumbling/stalactite boilerplate; the placeable-world-item unification is R-008 (P1/P2).
- **No data migration.** Authored levels, markers, hazard placements, and tuning are unchanged.
- **Layer invariants continue to hold.** `contracts/` stays a leaf; `engine/` and `entities/` both depend down on it; `level/` never reaches into `engine/`; `engine/` never imports state (R-001).
- **Grid-object vocabulary (analysis §3.5).** The hazard machines this feature relocates and the timed tiles it roots in the shared core are **grid objects** — cell-anchored things with optional keyed state — as distinguished from free-moving actors and stateless tiles in [`docs/PlatformerArchitectureAnalysis.md` §3.5](../../docs/PlatformerArchitectureAnalysis.md). R-004 owns the transient-state lifecycle for these grid objects; it does not settle the broader grid-object/actor contract, which is deferred (R-007/R-008/R-015).

## Out of Scope

- The generic speech bubble — renaming/generalising `HintTooltip` to `SpeechBubble`, splitting sign-hint from bubble-message ids, and folding the hint pieces into one home (E2, F10, M9) — **R-005**. R-004 leaves the tooltip sign-specific but builds the registry so the bubble is later one module plus one line.
- Re-homing `MushroomSquash` as a registered transient effect rather than its own module (E3) — **R-005**. R-004 only routes it through the shared timed-tile core.
- Relocating `engine/Standable.findLandingRow`, the `engine/StaticObjectsCatalog` stalactite geometry, and the `engine/effects/debris` `DebrisLayer` type out of `engine/` so `entities/hazards/` carries no `entities/ → engine/` edge — deferred to a later feature (the move preserves the existing edges, it does not widen them).
- Pickup unification and the `kind` discriminator (X6/F9) — **R-006**.
- Registry-dispatch completion (enemy `onDefeat`, pickup `onCollect`, world items) — **R-007**.
- The `PlacedBomb`/`DeployableLadder` placeable-world-item unification and the bomb subsystem extraction (P1/P2/D6) — **R-008**.
- The `Renderer.ts` god-module decomposition and the `SceneRenderer`/`HudRenderer` split (L1/F7) — **R-009**; the `STATIC_TILE_TYPES` tile registry and the broader tile-module contract — **R-015**.
- Mapper/editor unification and the `level.ts` split (M1/M2/M7/F5/F8) — **R-010**.
- Per-domain state stores and the `PlatformerState.ts`/`PlatformerPage.tsx` decomposition (D5/D7/D8) — **R-011/R-012**.
- Sprite asset/atlas organisation — **R-013**.
- The lint guard for layer boundaries — **R-014**.
- New gameplay effects or emitters (a glowing pickup, a lava tile, a new hazard); R-004 ships only the abstraction and relocates what already exists.
- Any change to gameplay, balance, visuals, level data, or public behaviour.
