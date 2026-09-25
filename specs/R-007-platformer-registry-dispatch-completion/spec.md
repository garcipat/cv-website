# Feature Specification: Platformer Registry Dispatch Completion

**Feature Branch**: `R-007-platformer-registry-dispatch-completion`

**Created**: 2026-09-25

**Status**: Draft

**Input**: GitHub issue #95 — "R-007: Platformer Registry Dispatch Completion". Complete the registry dispatch pattern: enemy defeat rewards and hazard knockback/tick hooks.

**Depends on**: [R-001 Platformer Core Contracts & Dependency Layers](../R-001-platformer-core-contracts/spec.md) (shipped: the `contracts/` layer, the `RewardEffects`/`PlayerEffects` vocabulary, and the layer invariants — `contracts/` a leaf, no `level/ → engine/`, no `engine/ → state/`), [R-004 Platformer Transient Effect Registry](../R-004-platformer-transient-effect-registry/spec.md) (shipped: the effect draw/tick dispatch and the floor-spike/falling-stalactite state machines moved under `entities/hazards/`), [R-006 Platformer Pickup Unification](../R-006-platformer-pickup-unification/spec.md) (shipped: `PickupKind`/`Pickup` in `contracts/`, the `PICKUP_TYPES` registry with `spawn`/`onPickup`, and `RewardEffects.spawnPickup` consumed generically by the block path), [O-023 Platformer Crumbling Floor Blocks](../O-023-platformer-crumbling-floor/spec.md), [O-027 Platformer Falling Stalactite](../O-027-platformer-falling-stalactite/spec.md), and [O-024 Enemy Movement & Animation Seam + Bee](../O-024-enemy-movement-seam/spec.md) (shipped: the third enemy kind `bee` and its "puff but reward nothing" behaviour).

**Design reference**: [`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) — Phase 5, findings **D2** (enemy defeat/reward is hand-coded; `EnemyType` has no `onDefeat`) and **D3** (hazard kind is switched on in three layers).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enemy defeat rewards are declared by the enemy type (Priority: P1)

Today a block's reward is generic — `BlockType.onHit` returns `RewardEffects` and the page applies them uniformly — but an enemy's reward is hand-coded: `PlatformerPage.tsx` names `heldItem === 'key'` and `enemy.type === 'slimeGreen'`, hand-spawns the key (`spawnKeyPickup`), hand-reveals the slime's facts, and gates the enemies counter popup on a per-tick boolean. A second drop kind (heart, bomb, coin) would mean editing the page. After this feature each enemy type declares its own defeat consequences through an **optional** `onDefeat` hook that fires them via a supplied defeat API (not every enemy grants anything — the bee and plain enemies have none), and one shared reward applier owns the unconditional defeat puff and the `rewardGiven`/`deathEffectGiven` gating and invokes the hook — so the page no longer names any enemy kind or drop kind, and a new dropping enemy is one module plus one registry line.

**Why this priority**: This is the finding the issue names first (D2) and the largest dispatch leak: it is the only remaining place the page hard-codes a reward for a whole entity family. It also carries the `ItemKind`/`PickupKind` vocabulary split the issue asks to close.

**Independent Test**: Inspect `PlatformerPage.tsx`'s enemy-defeat block — no `heldItem === 'key'`, no `enemy.type === 'slimeGreen'`, and no `spawnKeyPickup` call; a defeated enemy's consequences are fired from its `onDefeat` hook through the supplied defeat API, invoked by one shared applier. Then add a throwaway enemy kind that drops a heart on defeat and confirm it ships with one module plus one registry line and no page edit.

**Acceptance Scenarios**:

1. **Given** the enemy registry, **When** its entries are inspected, **Then** each kind either carries an `onDefeat(enemy, defeat)` hook that fires its defeat consequences (pickup spawn, fact reveals, counter bump) through the supplied defeat API, or none at all (bee and plain enemies) — and the page's defeat block contains no branch on `enemy.type`, `heldItem`, or any enemy/drop kind name.
2. **Given** a defeated purple slime on its first defeat, **When** the tick runs, **Then** its `onDefeat` fires a key-pickup spawn through the defeat API (routed to `PICKUP_TYPES.key.spawn`), not a page-side `spawnKeyPickup` call.
3. **Given** a defeated green slime, **When** the tick runs, **Then** its `onDefeat` reveals its fact(s) (`enemy.fact` plus any `enemy.extraFacts`) through the defeat API's reveal method and the enemies counter popup still bumps, exactly as today.
4. **Given** a defeated bee, **When** the tick runs, **Then** it still earns its defeat puff but rewards and counts nothing.

---

### User Story 2 - Hazard knockback and per-tick state live behind the hazard type (Priority: P1)

A hazard kind's knowledge is split across three layers today: `PlatformerState.hazardPlacementsForTick` branches on `hazardType === 'floorSpike'` / `'fallingStalactite'` to merge live phase/extension/offset state, `Collision.ts` gates arming triggers by kind, and `PlatformerPage.tsx` decides knockback by `hazardType === 'floorSpike' || 'fallingStalactite'`. After this feature `HazardType` carries `knocksBack` and a `withTickState(placement, timers)` hook, and no engine layer branches on a hazard kind name — so a new hazard kind is one module plus one registry line, exactly as `HazardType`'s own doc promises.

**Why this priority**: It is the finding the issue names second (D3) and the place where `HazardType`'s stated "adding a kind touches one line" promise is currently false across three layers. It is independent of US1 and can land on its own.

**Independent Test**: Inspect `PlatformerState.hazardPlacementsForTick`, `Collision.ts`'s hazard-trigger functions, and the page's hazard-damage block — none contains a `hazardType ===` / `hazardType !==` comparison; the knockback decision and the per-tick state merge each come from `typeOf(hazard)`. Then confirm every hazard's damage/knockback/phase behaviour is unchanged.

**Acceptance Scenarios**:

1. **Given** `HazardType`, **When** it is inspected, **Then** it declares `knocksBack` and a `withTickState(placement, timers)` hook, and no engine layer reads a hazard's `hazardType` to decide knockback or merge state.
2. **Given** a floor spike and a falling stalactite, **When** their merged per-tick state is produced, **Then** it comes from their own `withTickState` (phase/extension for the spike; phase/offset/shake for the stalactite) and every other kind passes through unchanged — byte-identical to today.
3. **Given** a qualifying non-lethal hazard contact, **When** the page applies damage, **Then** whether the player is knocked back is decided by `typeOf(hazard).knocksBack` (false for floor spike and falling stalactite, true for spike and spear), while a crouched hit still never knocks back (player-side, unchanged).
4. **Given** the arming-trigger detection, **When** a grounded player overlaps a spike trigger band or a stalactite detection zone, **Then** the eligible ids are produced without branching on hazard kind names, and an already-armed hazard is not re-eligible — exactly as today.

---

### User Story 3 - The migration is invisible in-game (Priority: P1)

This is a refactor of already-shipped behaviour, so the acceptance bar is that nothing the visitor sees changes: a green slime's fact(s) still reveal and bump the enemies counter; a purple slime still drops its one key on first defeat and puffs on every death; a bee still puffs and rewards nothing; floor spikes and falling stalactites still deal their no-knockback half-heart damage while every other hazard still pushes the player away; the journal totals and HUD counters are identical; and the reset scopes are unchanged.

**Why this priority**: It is the acceptance bar for every refactor: a naive move of the reward/knockback logic drops one of the differing rules (the per-tick vs per-fact counter bump, the crouch suppression) and silently changes play.

**Independent Test**: Play a level and compare against the pre-refactor build: stomp a green slime, a purple slime (and a revived purple slime), and a bee; stand on a floor spike and a spear; walk under a falling stalactite; collect a coin and a crate and a question-mark fruit; die and respawn; use Reset Game; open the journal and check the totals. Separately unit-test each reward gate, each knockback decision, and each counter's numerator/denominator.

**Acceptance Scenarios**:

1. **Given** any enemy defeat, **When** it runs, **Then** the reward, the puff, and the counter popup are pixel- and value-identical to today, including the revived-and-redefeated purple slime puffing but dropping nothing and the bee counting toward nothing.
2. **Given** any hazard contact, **When** it runs, **Then** damage, lethality, knockback direction/magnitude and the crouch suppression are identical to today.
3. **Given** a death/respawn and a full Reset Game, **When** they run, **Then** the enemy `rewardGiven`/`deathEffectGiven` flags and the counter/level totals behave exactly as today.
4. **Given** the existing enemy, hazard, state, collision, renderer and page tests, **When** they run after the change, **Then** their assertions are unchanged except for renames/import paths/hook signatures, and the production build succeeds.

---

### Edge Cases

- ✅ **A green slime's reward is a variable-length fact list.** `enemy.fact` plus `enemy.extraFacts` (when the level has fewer green slimes than course facts) must all reveal, and the enemies counter must bump per defeated slime — not per revealed fact — so a slime that reveals zero facts still counts toward the "defeated / total" feedback. The hook's consequences must therefore keep the fact reveal per-fact and the counter attribution per-defeat; the exact API shape is a planning decision (see Assumptions).
- ✅ **A revived-and-redefeated purple slime must puff but drop nothing.** `rewardGiven` is permanent (one payout ever); `deathEffectGiven` resets on revive (one puff per life). The shared applier must keep both gates and must not pay out a held item twice.
- ✅ **A bee is a non-key, fact-less kind.** Its defeat must still produce the world-event puff and must not feed any counter or reward. The applier must not assume every non-held-item enemy reveals a fact.
- ✅ **The enemies popup bumps once per tick, not per fact.** It is a keyed replace-in-place slot (R-004), but the bump is gated on "any green slime defeated this tick" and shows `enemiesDefeated` over `levelTotals.enemies`; the refactor must not turn it into a per-fact reveal bump or lose the "every defeated slime, not just fact-revealing ones" denominator.
- ✅ **The crouch suppression is player-side, not hazard-side.** A crouched hit never knocks back regardless of `knocksBack`; `knocksBack: false` for floor spike/stalactite is a separate, hazard-side rule. Both must be preserved; they must not be conflated into one flag.
- ✅ **Hazard `withTickState` must not widen forbidden edges.** The falling-stalactite merge reads `activeLevel`, `blockStates` and `crumblingFloorTimerStates`; the hook must receive those as a caller-supplied context bundle rather than reading state directly, so `entities/` gains no `entities/ → state/` edge and `contracts/` stays a leaf.
- ✅ **`spawnKeyPickup`'s page import must disappear, not be re-routed.** The page must stop importing `spawnKeyPickup`; the function stays as `Key.ts`'s internal spawn (already used by `PICKUP_TYPES.key.spawn`) but the defeat path must route through the shared `spawnPickup` vocabulary. No compatibility alias may keep a second page-side spawn path alive.
- ✅ **No compatibility re-exports.** `ItemKind`, the page's per-kind enemy branch, and the per-kind hazard merge/knockback branches must all be gone, not preserved as thin aliases or second code paths.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `EnemyType` MUST gain an **optional** `onDefeat?(enemy, defeat): void` hook. It is present only on kinds whose defeat produces consequences beyond the generic puff (absent on the bee and any plain enemy). The hook MUST fire its consequences — spawning a pickup, revealing one or more facts, bumping a counter — by calling methods on the supplied `defeat` API (a narrow world interface: spawn pickup, reveal fact, bump counter), never by writing engine state directly and never by returning a reward value. A single defeat MAY fire several such consequences in one call (e.g. reveal several facts, or reveal facts and bump a counter). The shared reward applier MUST invoke the hook exactly once per fresh defeat (when `rewardGiven` is false) and MUST NOT branch on `enemy.type`, on `heldItem` values, or on any enemy/drop kind name in the defeat flow.
- **FR-002**: `ItemKind` MUST be deleted and `EnemyType.heldItem` MUST become `PickupKind | null`. The purple slime's `heldItem` remains `'key'` (now a `PickupKind`); the green slime and bee remain `null`. `heldItem` stays the visual/placement declaration (the purple slime draws its held key until `rewardGiven`); the drop itself MUST be fired from inside that kind's own `onDefeat` as `defeat.spawnPickup(<heldItem>)` — the kind reads its own `heldItem` and asks the defeat API to spawn it — applied through the generic pickup-spawn path (`PICKUP_TYPES[<kind>].spawn`), not through a page-side `spawnKeyPickup` call.
- **FR-003**: The defeat gating MUST be preserved exactly: `rewardGiven` (permanent — one payout ever, surviving death/respawn) and `deathEffectGiven` (per-life — one puff per death, reset on revive) keep their current semantics. The shared reward applier MUST own both flags and the unconditional per-death puff, and MUST invoke the kind's `onDefeat` only when `rewardGiven` is false, without the page inspecting kind names. Every freshly defeated enemy MUST still produce its world-event puff; a revived-and-redefeated enemy MUST puff again but pay out nothing further.
- **FR-004**: The green slime's `onDefeat` MUST reveal its fact(s) — `enemy.fact` plus any `enemy.extraFacts` — by firing the defeat API's reveal method for each, and the enemies counter popup MUST still bump when a green slime is defeated (reflecting `enemiesDefeated` / `levelTotals.enemies`), covering every defeated slime, not only slimes that happen to reveal a fact. The bee (no fact, no held item, no `onDefeat`) MUST earn its defeat puff and reward/count nothing.
- **FR-005**: `HazardType` MUST gain `knocksBack: boolean` declaring whether a qualifying non-lethal contact knocks the player back, replacing the page's `hazardType === 'floorSpike' || 'fallingStalactite'` branch. It MUST be `false` for the floor spike and falling stalactite and `true` for the spike and spear, so the page chooses knockback (`applyHitReaction` with `direction`/`vx`/`duration`) versus no-knockback (`applyHitReaction` with no knockback) from the type alone. The crouch suppression (a crouched hit never knocks back) MUST remain player-side and unchanged.
- **FR-006**: `HazardType` MUST gain a `withTickState(placement, timers)` hook that merges the kind's live per-tick state into the placement, replacing `hazardPlacementsForTick`'s per-kind branches (`hazardType === 'floorSpike'` / `'fallingStalactite'`). The floor spike MUST merge its phase/extension, the falling stalactite its phase/offset/shake, and every other kind MUST pass through unchanged. The `timers` context MUST be a caller-supplied bundle of what the two stateful kinds read (floor-spike timers, falling-stalactite timers, active level, block states, crumbling-floor timers) so the hook reads no state directly, and the merged output MUST be byte-identical to today.
- **FR-007**: The arming-trigger detection in `Collision.ts` MUST stop branching on hazard kind names — `checkFloorSpikeTriggers`'s `hazardType === 'floorSpike'` filter and `checkFallingStalactiteTriggers`'s `hazardType !== 'fallingStalactite'` filter. The floor spike's trigger band and the falling stalactite's detection zone MUST become hazard-type-owned knowledge, with the detection behaviour preserved exactly (a grounded player's overlap arms each hazard exactly once; an already-armed hazard is not re-eligible). The exact hook shape is a planning decision bounded by this requirement and FR-010.
- **FR-010**: Player-visible behaviour MUST be preserved exactly — enemy defeat rewards, hazard damage/lethality/knockback, counter totals and popups, and reset scopes MUST be unchanged. No gameplay, tuning, visual, level-data or translation change is allowed.
- **FR-011**: All existing tests MUST migrate and MUST pass; assertions MUST be unchanged wherever only a name, signature, module location or import path changed, and where the dispatch moved behind a hook the tests MUST assert the equivalent new form — never weakened, skipped or deleted. The production build MUST succeed.
- **FR-012**: No compatibility re-export, alias or second code path MAY preserve `ItemKind`, the page's per-kind enemy branch or `spawnKeyPickup` import, or the per-kind hazard merge/knockback/trigger branches.
- **FR-013**: The change MUST NOT widen R-001's forbidden edges: `contracts/` MUST stay a leaf, no new `level/ → engine/`, and no new `engine/ → state/`. The hazard `withTickState` hook MUST receive its timer/context inputs as parameters rather than importing state, so no new `entities/ → state/` edge is introduced.

### Key Entities

- **`EnemyType.onDefeat?(enemy, defeat)`**: the optional per-kind enemy defeat hook. Present only on kinds whose defeat fires consequences; it receives a narrow `defeat` API (spawn pickup / reveal fact / bump counter) and fires its consequences through it — several in one defeat where needed — rather than returning a reward value. It replaces the page's hand-coded `heldItem === 'key'` / `enemy.type === 'slimeGreen'` branches. Reached through `typeOf(enemy)` (the `ENEMY_TYPES` cast already in `entities/enemies/index.ts`).
- **Shared reward applier**: the single consumer of a defeated enemy that owns the unconditional defeat puff and the `rewardGiven`/`deathEffectGiven` gating, and invokes the kind's `onDefeat` exactly once per fresh defeat (when `rewardGiven` is false). It does not interpret a reward value — the kind fires its own consequences through the defeat API, building on the shipped `RewardReveal.revealFact` and generic `spawnPickup` paths.
- **`PickupKind` / `heldItem`**: the unified drop vocabulary. `heldItem: PickupKind | null` replaces `ItemKind`; a held item's drop is fired from inside that kind's `onDefeat` as `defeat.spawnPickup(<kind>)` rather than a page-side spawn call.
- **`HazardType.knocksBack` / `HazardType.withTickState(placement, timers)`**: the per-kind hazard hooks that carry the knockback decision and the per-tick state merge, replacing the kind switches in `PlatformerState.hazardPlacementsForTick`, `Collision.ts`'s trigger functions, and `PlatformerPage.tsx`'s damage block.
- **The affected registries** (`ENEMY_TYPES`, `HAZARD_TYPES`, `BLOCK_TYPES`, `PICKUP_TYPES`): each stays the single "one module plus one registry line" home for its family; the new hooks and metadata are added here so the engine layers stop naming kinds.

## Success Criteria *(mandatory)*

- **SC-001**: A search of the theme finds no `ItemKind` symbol; `EnemyType.heldItem` is typed `PickupKind | null`.
- **SC-002**: `PlatformerPage.tsx`'s enemy-defeat block contains no `heldItem === 'key'`, no `enemy.type === 'slimeGreen'`, and no `spawnKeyPickup` import or call; a defeated enemy's consequences are fired from its `onDefeat` hook through the supplied defeat API, invoked by one shared applier.
- **SC-003**: `hazardPlacementsForTick`, `Collision.ts`'s hazard-trigger functions, and the page's hazard-damage block contain no `hazardType ===` / `hazardType !==` comparison; knockback and state merge come from `typeOf(hazard)`.
- **SC-005**: The full test suite passes (assertions unchanged except for renames/import paths/hook signatures) and the production build succeeds.
- **SC-006**: A manual browser pass shows no visible or behavioural difference: stomp a green slime, a purple slime (and a revived one), and a bee; stand on a floor spike and a spear; walk under a falling stalactite; collect a coin, a crate, and a question-mark fruit; die/respawn and Reset Game; and check the journal totals and HUD counters.
- **SC-007**: Adding an enemy or hazard kind requires one module plus one registry line — no edit to the page's defeat/knockback dispatch, `hazardPlacementsForTick`, `Collision.ts`, or `Renderer.ts`.
- **SC-008**: R-001's forbidden edges are not widened (`contracts/` still a leaf, no new `level/ → engine/` or `engine/ → state/`, and no new `entities/ → state/` edge from the hazard `withTickState` hook).

## Assumptions

- **`onDefeat` fires consequences through a supplied defeat API, not a return value.** A defeat can produce several heterogeneous consequences (spawn a pickup, reveal one or more facts, bump a counter) and not every kind produces any, so `onDefeat` is optional and imperative: it receives a narrow `defeat` API (building on the shipped `RewardReveal.revealFact` and the generic `spawnPickup`) and calls it. This is the `Outcome.ts`-documented `onDefeat(entity, world)` hook shape, chosen over a returned `RewardEffects` value because a single return shape cannot cleanly express a variable-length fact reveal plus a per-defeat counter bump, and because some kinds grant nothing. The exact API surface (method names; whether the per-defeat counter bump is a method on the API or a generic applier step) is a planning decision bounded by FR-001–FR-004 and SC-002. The spec fixes the invariants (facts reveal per-fact; the enemies popup bumps per defeated slime; the puff is unconditional per death) and leaves the method-level shape to the plan.
- **The shared reward applier lives beside `RewardReveal`.** R-001 landed `RewardReveal` in the state layer (`state/rewards.ts`); the enemy reward applier is its natural sibling and builds on `revealFact` and the generic `spawnPickup` already used by the block path. The exact module is a planning decision.
- **The hazard arming trigger is part of D3.** The issue's "remove the kind switches in State/Collision/Page" includes `Collision.ts`'s `checkFloorSpikeTriggers`/`checkFallingStalactiteTriggers`, even though the two named hooks are `knocksBack` and `withTickState`. The trigger detection becomes hazard-type-owned (an additional hook or a fold into the existing timed-tile lifecycle); its exact shape is a planning decision bounded by FR-007, and the detection behaviour must be byte-identical.
- **`hazardPlacementsForTick` stays in the state layer; the merge logic moves, not the orchestration.** The state layer still assembles and passes the timer/context bundle, and `HazardType.withTickState` is pure — it reads only its parameters — so no `entities/ → state/` edge is introduced.
- **Player-visible behaviour is preserved exactly; only the dispatch moves.** The sanctioned changes are the enemy `onDefeat` hook + shared applier, the `ItemKind`→`PickupKind` unification, the hazard `knocksBack`/`withTickState` hooks and trigger relocation, and the corresponding import/name updates — never a change to tuning, gates, knockback magnitudes, draw depth, wording, counter values or reset scope.
- **No data migration.** Shipped levels, markers, placements and tuning are unchanged; only TypeScript types, hooks and module homes move.
- **Layer invariants continue to hold.** `contracts/` stays a leaf; `entities/` and `engine/` depend down on it; `level/` never reaches into `engine/`; `engine/` never imports state (R-001). The `level/ → entities/` edge (hazard phase types) stays allowed.

## Out of Scope

- The generic speech bubble and the mushroom-squash-as-effect — **R-005**.
- Pickup unification and the `kind` discriminator (already shipped) — **R-006**.
- Placeable world items (`WorldItemType`, `PlacedBomb`/`DeployableLadder` consolidation, the `CHEST_TYPE` decision) and the bomb subsystem extraction — **R-008**.
- The `Renderer.ts` split into `SceneRenderer`/`HudRenderer` — **R-009**; the tile-module registry — **R-015**.
- Mapper/editor unification — **R-010**; the player damage/bomb systems and per-domain state stores — **R-011/R-012**; sprite asset/atlas organisation — **R-013**; the layer-boundary lint guard — **R-014**.
- The broader grid-object/actor split (§3.5): R-007 folds each family's kind-specific knowledge into its registry as it is touched, but does not introduce a shared `GridObject` interface or reorganise `entities/`.
- Counter-metadata refactor (`countsAs`/`countsAsWhen`, analysis D4) — **dropped from R-007**; the static counter totals (`levelTotals`/`cratesDestroyed`/`enemiesDefeated`) stay hardcoded as today. Revisit only if a new countable kind materialises. (Its requirements — FR-008/FR-009 and SC-004 — were removed with it, so those numbers are intentionally absent.)
- Any change to gameplay, balance, visuals, level data, translations, HUD layout, or public behaviour.
