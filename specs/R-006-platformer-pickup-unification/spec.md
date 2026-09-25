# Feature Specification: Platformer Pickup Unification

**Feature Branch**: `R-006-platformer-pickup-unification`

**Created**: 2026-09-25

**Status**: Draft

**Input**: GitHub issue #94 — "R-006: Platformer Pickup Unification". Give pickups a shared discriminator so the engine dispatches generically instead of naming pickup kinds: add `kind: PickupKind` plus a shared `Pickup` model (`id`, position, `kind`, `collected`) to every pickup state, unify collect-once behind that one `collected` flag, land one generic `checkPickupCollisions` + `drawPickups` with a `PickupType.spawn`/`onPickup` hook (removing the page's pickup-name `if/else`), colocate each pickup's state module with its `PickupType` view under `entities/pickups/`, and retire the dormant placed-fruit path.

**Depends on**: [R-001 Platformer Core Contracts & Dependency Layers](../R-001-platformer-core-contracts/spec.md) (shipped: the `contracts/` layer, including the explicit `PickupKind` vocabulary and the `contracts/ → level/` ban), [R-002 Platformer Shared Primitives & Dedup](../R-002-platformer-shared-primitives-dedup/spec.md) (shipped: FR-022 already merged the former `BonusFruit.ts` into `entities/Fruit.ts` and removed the placed-fruit branch of `placeCollectibles`), [O-012 Platformer Bombs](../O-012-platformer-bombs/spec.md) (shipped: the bomb pickup, its capacity rule, and the bomb-pot drop).

**Design reference**: [`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) — Phase 4, findings **D1** (pickups have no discriminator, so the page dispatches on pickup names), **X6** (pickup constant modules should live beside their type views), **F9** (`entities/` top level is a grab bag above per-kind folders), and **L1** (collapse the pickup draw wrappers into one `drawPickups`).

## Clarifications

### Session 2026-09-25

- Q: Pickups share no discriminator today, so the page names kinds. What shape should the discriminator take? → A: Every pickup state carries `kind: PickupKind` plus a shared `Pickup` base, mirroring `EnemyState.type` / `BlockState.blockKind` (issue #94 / analysis D1). The registry key and the state's `kind` are pinned together so they cannot drift.
- Q: What is the fate of the "fruit" pickup kind, given the live question-mark reward fruit? → A: **Keep `'fruit'` as a first-class live pickup kind.** Issue #94 lists dropping the `'fruit'` member of `PickupKind` and the placed-fruit `PickupType` (`entities/pickups/Fruit.ts`), but the only live fruit today is the question-mark block's spawned reward (renamed from `bonusFruit` by R-002 FR-022): `PICKUP_TYPES.fruit` is used by the fruit collision check and by fruit drawing, and `entities/pickups/Fruit.ts` is the view that draws it, while `entities/Fruit.ts`'s art helpers move into that same module. Removing `'fruit'` would break the registry and `RewardEffects.spawnPickup` and force a reward vocabulary that belongs to R-007 (D2). R-006 therefore retires only the already-dead placed-fruit artifacts and keeps the live reward fruit working, now merged into one `entities/pickups/Fruit.ts` module.
- Q: What does the shared `Pickup` model contain? → A: **Identity, stored position, discriminator and the collect-once flag — `id`, `x`, `y`, `kind`, `collected`.** Every pickup state stores a raw `x`/`y` (the placed coin and the dropped heart/key/bomb already do; `FruitState` gains a stored `y`), and its `kind` equals its `PICKUP_TYPES` slot. A fruit's rise tween keeps producing identical positions by updating the stored `y` from the existing easing (`fruitY`'s `clamp01(elapsed / FRUIT_RISE_DURATION_SECONDS)` between `startY` and `restY`) on each tick, rather than computing `y` on read; the collision/draw gates and the fruit-before-blocks draw depth are unchanged (FR-001, FR-009). `collected` is the single collect-once flag every kind shares (see the collect-once clarification below).
- Q: Must the placed-coin state (`CollectiblePlacement`) join the `kind` family? → A: **Yes — it composes the shared `Pickup` base with `kind: 'coin'`, replacing its current `spriteType: 'coin'` field.** The placed coin is the one pickup whose state was keyed by `spriteType` rather than a kind; giving it `kind: 'coin'` makes the generic collision and draw paths uniform (no placed-collectible special case) and makes FR-001's "every pickup state carries a `kind`" literally true. The `spriteType` field is removed rather than kept as a redundant alias (FR-001, FR-006, FR-011).
- Q: Should `drawPickups` be one function invoked at more than one draw depth, and do all ground pickups share one base type or one merged collection? → A: **One `drawPickups` function, invoked at the three depths the current wrappers occupy — the rising fruit before blocks; coins after mid-world effects but before enemies; key/heart/bomb after enemies — with every ground pickup composing the shared `Pickup` base and each kind living in its own typed array.** No merged ground-pickup collection: the shared thing is the base type plus one module per kind, so a future pickup is added without touching the engine while the per-kind arrays, reset scopes and counters stay exactly as they are today (FR-001, FR-003, FR-009).
- Q: `EditorCanvas` is a second caller that calls `drawCollectibles` — how should the editor preview migrate once that function is removed? → A: **The editor routes through the generic `drawPickups`**, passing its synthesized coin placements (each `collected: false`). The editor then previews the same dispatch the game uses, and SC-001's theme-wide search finds no `drawCollectibles` anywhere (FR-003, SC-001).
- Q: Do we really need both an `entities/<Kind>` state module and an `entities/pickups/<Kind>` view module (the fruit especially)? → A: **No — each pickup family MUST collapse to exactly one module under `entities/pickups/`.** This is not fruit-specific: today all five families are split (state/constants in `entities/Fruit.ts`, `entities/Coin.ts`, `entities/KeyPickup.ts`, `entities/HeartPickup.ts`, `entities/BombPickup.ts`; view in `entities/pickups/Fruit.ts`, `Coin.ts`, `Key.ts`, `Heart.ts`, `Bomb.ts`). R-006 merges each pair into one self-contained `entities/pickups/<Kind>.ts` and deletes the top-level state module — no second fruit (or coin, or key, …) module survives. "Art helpers MUST be unchanged" (FR-006) means their behaviour is preserved *inside* the single module, not that `entities/Fruit.ts` stays (FR-005, FR-006, FR-011).
- Q: Which layer owns the shared `Pickup` base (`id` + stored `x`/`y` + `kind` + `collected`) that every pickup state and `CollectiblePlacement` compose? → A: **`contracts/`**, alongside `PickupKind`. The base is shared vocabulary, not an entity: `level/CollectibleMapper` and every pickup module import it downward, so `PickupKind` stays a leaf and no new `level/ → entities/` edge (nor a file-level cycle with `entities/pickups/Coin.ts`'s existing `level/CollectibleMapper` import) is created (FR-001, FR-008).
- Q: Coin, fruit and key each enforce collect-once differently today (external id set / removal / inline flag), and the visitor expects more permanent pickups later. Should they share one mechanism? → A: **Yes — every pickup state carries `collected: boolean` on the shared `Pickup` model, and nothing removes an entry on collect.** The shared applier marks `collected: true` and applies the kind's returned consequences; the collision base gate is `!state.collected` (drawing likewise skips `collected` entries), with each kind adding only its own extra gate (fruit's rise, heart's full health, bomb's cap). Permanence is expressed **only** by reset scope: the coin/fruit/key arrays are kept across death/respawn (the "permanent" pickups), the heart/bomb arrays are cleared by `resetGame()`. This replaces the external `collectedCollectibleIds` set, the key's inline flag, and fruit removal, and is the contract a future permanent pickup follows for free — compose `Pickup`, don't clear the array on death (FR-001, FR-002, FR-004, FR-006, SC-008).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - One discriminator, one collision path, one draw path (Priority: P1)

Pickups are the one entity family with no `kind` discriminator, so the orchestrator has to name them everywhere: five family-specific collision functions, five draw wrappers, and a spawn-time if/else naming `fruit` / `coin` / `heart` / `bomb`. After this feature every pickup state carries a `kind`, and collision and drawing each run through one generic entry point that dispatches on that kind — so the engine no longer knows which pickup kinds exist. Adding a pickup means writing one module and adding one registry line, exactly as blocks, enemies, hazards and chests already work.

**Why this priority**: This is the central finding the issue names (D1) and the prerequisite for every other pickup change. Until the discriminator exists, every future pickup feature keeps editing the page.

**Independent Test**: Search the theme for `checkCollectibleCollisions`, `checkFruitCollisions`, `checkKeyPickupCollisions`, `checkHeartPickupCollisions`, `checkBombPickupCollisions`, `drawCollectibles`, `drawKeyPickups`, `drawHeartPickups`, `drawBombPickups` and `drawFruits` — the family-specific collision functions and the per-family draw wrappers are gone, replaced by one `checkPickupCollisions` and one `drawPickups` that dispatch on `kind`. Confirm the page contains no comparison against a pickup kind name.

**Acceptance Scenarios**:

1. **Given** the pickup registry, **When** its entries and every pickup state are inspected, **Then** each `PickupType` conforms to one shared contract, each state exposes a `kind` and a `collected` flag, and each state's `kind` equals its slot in the registry (mirroring how `ENEMY_TYPES`/`BLOCK_TYPES` pin their own keys).
2. **Given** the player's hitbox overlaps one or more pickups of different kinds in a single tick, **When** the tick runs, **Then** one generic `checkPickupCollisions` returns the overlaps and applies each kind's own eligibility rule, not a per-family function.
3. **Given** the render loop, **When** pickups are drawn, **Then** a single `drawPickups` function dispatches each entry to its kind's own `draw`, invoked at the three depths needed to preserve the current draw order relative to blocks, effects and enemies (the rising fruit still draws before blocks; coins draw after mid-world effects but before enemies; key/heart/bomb draw after enemies).

---

### User Story 2 - Spawning and collecting are declared by the pickup kind (Priority: P1)

The page's pickup-name `if/else` sits in the block terminal-outcome resolver: it names `fruit`, then `coin`, then `heart`, then `bomb`, and hand-applies each one's id/position. Collection similarly hand-codes each family. After this feature each pickup kind's own module owns how it is spawned from a source (a block, or later an enemy) and what collecting it asks the engine to do, surfaced through `PickupType.spawn` / `onPickup` hooks, so the page applies results uniformly and names no kinds.

**Why this priority**: It is the other half of D1 — without the spawn/collect seam the page if/else merely moves rather than disappears, and the issue's checkpoint ("page's pickup-name if/else deleted") is not met.

**Independent Test**: Confirm the page's block terminal-outcome dispatch contains no `=== '<pickupKind>'` branch and no direct call to a per-kind spawn helper; a block's declared drop drives a generic spawn, and each kind's collect consequences are produced by its own module and applied uniformly.

**Acceptance Scenarios**:

1. **Given** a block hit whose outcome names a pickup to spawn, **When** the terminal outcome is applied, **Then** the pickup is created through one generic spawn path that dispatches on the outcome's kind, and the source's id/position convention is supplied by the kind module.
2. **Given** the player touches a pickup, **When** the tick runs, **Then** each kind's collect consequences (which counter/reward to emit, whether to heal, bank a key or add a bomb) are declared by that kind and applied by a shared applier that also sets the shared `collected` flag — with no per-kind branch in the page.
3. **Given** a new pickup kind is added that drops from a block and heals the player on touch, **When** it ships, **Then** no edit to the page's spawn or collect dispatch is required.

---

### User Story 3 - Each pickup family is one module under `entities/pickups/` (Priority: P2)

Today each pickup's state type and constants live in the `entities/` top level (`BombPickup.ts`, `HeartPickup.ts`, `KeyPickup.ts`, `Coin.ts`, `Fruit.ts`) while its `PickupType` view lives under `entities/pickups/` — two files per concept, split across the folder boundary, while blocks, enemies, hazards and chests already colocate. After this feature each pickup's state module and its view live together under `entities/pickups/`, so a pickup is one self-contained file and it is obvious where a new one goes.

**Why this priority**: It is the X6/F9 half of the issue and the mechanical prerequisite for the kind modules owning their own spawn/collect rules. It is independent of US1/US2 and can land first.

**Independent Test**: Inspect `src/themes/platformer/entities/` — no pickup state module remains at the top level; each pickup resolves from one module under `entities/pickups/` that owns both its state/constants and its `PickupType` view; `entities/Health.ts` and `entities/Torch.ts` are unchanged in place.

**Acceptance Scenarios**:

1. **Given** the pickup modules, **When** the tree is inspected, **Then** bomb, heart, key, coin and fruit each resolve from exactly one module under `entities/pickups/`, which owns both the state type/constants and the `PickupType` view, and no pickup state module remains directly under `entities/`.
2. **Given** `entities/Health.ts` (the player health model) and `entities/Torch.ts`, **When** the tree is inspected, **Then** both stay where they are — neither is a pickup.
3. **Given** every importer of a moved module, **When** it imports the pickup, **Then** it resolves from the new colocated path and every constant, offset and size is numerically unchanged.
4. **Given** the shared bobbing helper currently named for coins (`coinBobOffset`), **When** heart, key and bomb views use it, **Then** it resolves from its (moved) home without duplication and still produces identical offsets.

---

### User Story 4 - The dormant placed-fruit path is retired (Priority: P2)

The issue asks to retire the placed-fruit path: `findCoinTiles` only reads `o` markers and `placeCollectibles` only ever receives coin markers, because a question-mark block spawns its own rising fruit instead. After this feature no placed-fruit vocabulary remains in the collectible/placement path, while the live question-mark reward fruit keeps working unchanged.

**Why this priority**: It removes dead vocabulary the issue explicitly names and keeps the pickup union honest. It is independent of the dispatch work but must not regress the live reward fruit.

**Independent Test**: Inspect the collectible placement path — no `'fruit'` variant remains on the placed-collectible type or its mapper, and `placeCollectibles` handles only coins; separately confirm a question-mark block still spawns its rising, fact-bearing fruit and that it is still drawn and collected.

**Acceptance Scenarios**:

1. **Given** the placed-collectible type and its mapper, **When** they are inspected, **Then** the only placed collectible sprite variant is `coin` and no dormant fruit branch or marker field remains.
2. **Given** a question-mark block, **When** the player hits it, **Then** its rising reward fruit still spawns, rises, reveals its fact on touch and becomes non-collectible — unchanged (it is now flagged `collected` rather than removed from its array).
3. **Given** the `'fruit'` pickup kind, **When** the pickup vocabulary is inspected, **Then** `'fruit'` remains a first-class `PickupKind` and its state/view are colocated in one `entities/pickups/Fruit.ts` module — the literal "drop `'fruit'` from `PickupKind`" wording in issue #94 is superseded by the clarification above, which keeps the live reward fruit working.

---

### User Story 5 - The migration is invisible in-game (Priority: P1)

Every pickup has player-visible tuning that must survive untouched: coins spin and bob on the shared clock; keys, hearts and bombs bob and are drawn at their own offsets/sizes; a fruit tweens upward and only becomes touchable once risen; a heart waits in the world at full health; a bomb is left in the world at capacity; every collected pickup stays in its array flagged `collected`; and permanence across a death/respawn is the array's reset scope (coin/fruit/key kept, heart/bomb cleared). After this feature all player-visible behaviour is unchanged, and the tests keep asserting the same outcomes in their new flag-based form.

**Why this priority**: It is the acceptance bar for a refactor: a naive unification drops one of the differing eligibility rules or reset scopes and silently changes play.

**Independent Test**: Play a level and compare against the pre-refactor build: collect a coin, a dropped key, a dropped heart (at full and reduced health), a dropped bomb (below and at the cap) and a question-mark fruit (mid-rise and settled); die and respawn; use Reset Game; open the journal and check the counter totals. Separately unit-test each kind's eligibility gate and each collection's reset scope.

**Acceptance Scenarios**:

1. **Given** any pickup on screen, **When** it is drawn, **Then** its frame selection, bob offset, size, offset and draw depth are pixel-identical to today, including the fruit being drawn before blocks so a still-rising fruit is occluded by its source block.
2. **Given** the differing eligibility gates, **When** the player touches each pickup, **Then** a heart at full health and a bomb at the cap both stay in the world, a mid-rise fruit is not collectible, and any already-`collected` pickup (coin, fruit or key) is not re-collected.
3. **Given** a death/respawn, **When** it runs, **Then** the dropped heart/bomb arrays and placed bombs are cleared, while the coin/fruit/key arrays (and their `collected` flags) persist — exactly as today; **Given** a full Reset Game, **Then** every pickup array is cleared and the placed coins are re-derived uncollected — exactly as today (no collected-id set remains).
4. **Given** the existing pickup, collision, renderer, state and page tests, **When** they run after the change, **Then** their assertions are unchanged except for renames/import paths and the collection-storage change (collected entries are now retained and flagged rather than removed or tracked in an id set), and the production build succeeds.

---

### Edge Cases

- ✅ **Multiple pickups overlapped in one tick.** The generic collision path must return every overlapped entry, with the bomb kind still limited to the remaining capacity in array order and every other kind returning all overlaps, exactly as today.
- ✅ **A heart at full health and a bomb at the cap must not be consumed.** Those gates are per-kind eligibility, not page logic, and must be supplied by the kind module so the generic path preserves them.
- ✅ **A mid-rise fruit is not collectible.** The rise-time gate (`elapsed >= FRUIT_RISE_DURATION_SECONDS`) belongs to the fruit kind and must survive unification.
- ✅ **Every collected pickup is stored and flagged, never removed.** Each kind keeps its entry with `collected: true` and is skipped on draw/collision; no kind removes its entry on collect, and the generic applier's only collect-once action is setting that flag.
- ✅ **Collect-once is one mechanism.** `collected` on the shared `Pickup` model is the only collect-once state; the external `collectedCollectibleIds` set and the key's inline flag are both gone. A placed coin's flag persists across death/respawn because its state is held mutably, and is cleared on full reset.
- ✅ **The fruit must still draw before blocks.** Draw order relative to terrain/blocks is part of the current look (a rising fruit is occluded until it clears its block) and must be preserved even though pickups unify into one `drawPickups` function (invoked at the fruit's pre-block depth).
- ✅ **Per-type index stability while drawing.** The draw wrapper tracks each item's index within its own type so a fruit/coin frame stays stable regardless of which entries have been collected; now that collected entries are retained, that per-type indexing must still survive the unified draw unchanged.
- ✅ **Two reset scopes — the only thing that differs per kind.** Death/respawn clears the heart/bomb arrays but keeps the coin/fruit/key arrays (flags included); full reset clears every array and re-derives the placed coins. Permanence MUST be expressed by array lifetime alone; no kind gets a different collect-once mechanism to achieve it.
- ✅ **`contracts/` stays a leaf.** `PickupKind` and the `Pickup` model stay `contracts/` vocabulary with `PICKUP_TYPES` conforming; the move into `entities/pickups/` must not create a `contracts/ → level/` or `contracts/ → entities/` edge.
- ✅ **No compatibility aliases.** The removed family-specific functions and old module paths must not survive as thin re-exports or second code paths.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Every pickup state MUST carry a `kind: PickupKind` discriminator and compose a shared `Pickup` model of `id`, stored `x`/`y`, `kind` and `collected: boolean`, mirroring `EnemyState.type` / `BlockState.blockKind`. `collected` is the single collect-once flag shared by every kind. The shared `Pickup` model MUST live in `contracts/` beside `PickupKind` (shared vocabulary, not an entity): `level/CollectibleMapper` and every pickup module import it downward, and no new `level/ → entities/` file edge or cycle with `entities/pickups/Coin.ts`'s existing `level/CollectibleMapper` import MAY be created. A state's `kind` MUST equal its slot in `PICKUP_TYPES`, and the registry MUST stay pinned to the `contracts/PickupKind` vocabulary (a `Record<PickupKind, …>` annotation or `satisfies`) so a kind added to one side without the other fails to compile. Each state stores its own raw position; a rising fruit updates its stored `y` from the existing rise easing on each tick rather than computing `y` on read, so every position value stays identical to today.
- **FR-002**: There MUST be one generic `checkPickupCollisions` replacing the five family-specific collision functions (`checkCollectibleCollisions`, `checkFruitCollisions`, `checkKeyPickupCollisions`, `checkHeartPickupCollisions`, `checkBombPickupCollisions`) that dispatches on `kind` and preserves every current eligibility rule: every kind is ineligible once its state is `collected` (the one shared flag — no external id set and no per-kind removal); on top of that base gate, fruit is not collectible until its rise finishes, heart is excluded at full health, and bomb is limited to `max(0, cap - count)` entries in array order, returning none at the cap.
- **FR-003**: There MUST be one generic `drawPickups` replacing the per-family draw wrappers (`drawCollectibles`, `drawKeyPickups`, `drawHeartPickups`, `drawBombPickups`, `drawFruits`), dispatching each entry to its kind's own `draw` while preserving every current visual: frame selection, bob offset, rendered size/offset, the per-type draw index, the skip-collected filter, and the draw depth/order relative to blocks, terrain, enemies, effects and the water foreground. Preserving order MAY require `drawPickups` to be invoked at more than one depth — today three: the rising fruit before blocks, coins after mid-world effects but before enemies, and key/heart/bomb after enemies — but the family-specific wrapper functions themselves MUST be gone. The editor preview (`EditorCanvas`) is a second caller and MUST also route through `drawPickups` (with every synthesized placement `collected: false`), so no `drawCollectibles` symbol remains anywhere in the theme.
- **FR-004**: `PickupType` MUST gain a spawn seam and a collect seam (`spawn` / `onPickup`) so that each pickup kind's own module owns how it is created from a source and what collecting it asks the engine to do. `onPickup` MUST return only the collect consequences (counter/reward, heal, bomb/key banking, flying text) as data; a shared applier MUST set `collected: true` on every hit state and then apply those consequences. There MUST be no per-kind `remove`/`flag`/`dedup` disposition — every kind is stored and flagged alike. The page's block terminal-outcome dispatch MUST NOT branch on pickup kind names, and a new pickup kind MUST NOT require a page edit to spawn or collect.
- **FR-005**: Each pickup's state module MUST merge into its `PickupType` view under `entities/pickups/`, so each pickup family is exactly one self-contained module (`Bomb`, `Heart`, `Key`, `Coin`, `Fruit`) and no second module for that family remains. The old top-level state/constants modules (`entities/Fruit.ts`, `entities/Coin.ts`, `entities/KeyPickup.ts`, `entities/HeartPickup.ts`, `entities/BombPickup.ts`) MUST be deleted once their contents move, not left as re-exports or thin wrappers. `entities/Health.ts` and `entities/Torch.ts` are not pickups and MUST stay where they are. All importers MUST be updated, and every constant value MUST be preserved.
- **FR-006**: The dormant placed-fruit path MUST be retired: the placed-collectible type and `placeCollectibles` MUST carry only the `coin` variant, and no dormant fruit marker/branch vocabulary MAY remain. `CollectiblePlacement` MUST compose the shared `Pickup` model with `kind: 'coin'` and its `collected` flag (its `spriteType` field is removed, not kept as an alias), so the generic collision and draw paths treat a placed coin like any other kind. Because the base coin placements are level-derived, `PlatformerState` MUST hold the coin state as mutable, flag-carrying state (re-derived when the level changes and on full reset) so a placed coin's `collected` flag persists across death/respawn without an external id set. The live question-mark reward `'fruit'` kind MUST be kept as a first-class `PickupKind` (per the clarification above) and its state/view merged into one `entities/pickups/Fruit.ts` module; its spawn, rise gate, fact reveal and art helpers MUST be preserved with unchanged behaviour inside that one module, and the former `entities/Fruit.ts` MUST be deleted (no second fruit module survives).
- **FR-007**: Adding a pickup kind MUST still be one module plus one registry line: no page, collision, renderer or sprite-registry edit MAY be required beyond the kind's module and its `PICKUP_TYPES` entry. The sprite loader MUST keep discovering assets from each type's `sprite.sheet`.
- **FR-008**: The change MUST NOT widen any R-001 forbidden dependency edge: no new `level/ → engine/`, no new `engine/ → state/`, no new `contracts/ → level/` or `contracts/ → entities/`. `PickupKind` and the shared `Pickup` model MUST both remain `contracts/` leaves.
- **FR-009**: Player-visible behaviour MUST be preserved exactly — no gameplay, tuning, visual, level-data or translation change. In particular the collection gates (heart/bomb/fruit/key/coin), the reset scopes (death/respawn vs full reset), the per-kind HUD counters, the key flying-text target and the bomb capacity rule MUST be unchanged.
- **FR-010**: All existing tests MUST migrate and MUST pass; assertions MUST be unchanged wherever only a name, signature, module location or import path changed, and where the collection storage changed (collected entries retained + flagged, the external id set removed) the tests MUST assert the equivalent new form — never weakened, skipped or deleted. The production build MUST succeed.
- **FR-011**: No compatibility re-export, alias or second code path MAY preserve the removed family-specific collision functions, draw wrappers, the external collected-id set or old module paths.

### Key Entities

- **`Pickup` / `PickupKind`**: the shared `Pickup` model (`id`, stored `x`/`y`, `kind`, `collected`) and the contract vocabulary of pickup kinds. `collected` is the single collect-once flag every kind shares. Both live in `contracts/`, so `level/CollectibleMapper` (whose `CollectiblePlacement` composes `Pickup`) and every pickup module reach them downward without a new `level/ → entities/` edge. A rising fruit keeps its stored `y` in sync with the existing rise easing on each tick, so its position is stored like every other kind's. `PickupKind` stays a `contracts/` leaf; `PICKUP_TYPES` conforms to it so a kind added to one side without the other fails to compile.
- **`PickupType<S>`**: the per-kind contract, now owning (in addition to the existing key/sprite/box/frame/bob/draw) how the kind is spawned from a source and what collecting it asks for (`onPickup`). The collect-once flag lives on the `Pickup` model, not here; each kind supplies only its own extra eligibility gate (fruit rise, heart full-health, bomb cap) to the generic collision path.
- **Pickup kind modules** (`entities/pickups/Bomb.ts`, `Heart.ts`, `Key.ts`, `Coin.ts`, `Fruit.ts`): one self-contained module per family, owning its state type/constants *and* its `PickupType` view.
- **Generic dispatch** (`checkPickupCollisions`, `drawPickups`): the two engine entry points that replace the family-specific functions and wrappers.
- **Collectible placement path** (`CollectiblePlacement`, `placeCollectibles`): the coin-only placed-collectible vocabulary — `CollectiblePlacement` composes `Pickup` with `kind: 'coin'` and a `collected` flag (held mutably so it persists across death) — with the dormant fruit path removed.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A search of the theme finds none of `checkCollectibleCollisions`, `checkFruitCollisions`, `checkKeyPickupCollisions`, `checkHeartPickupCollisions`, `checkBombPickupCollisions`, `drawCollectibles`, `drawKeyPickups`, `drawHeartPickups`, `drawBombPickups` or `drawFruits`; exactly one `checkPickupCollisions` and one `drawPickups` exist, and the page contains no comparison against a pickup kind name.
- **SC-002**: Every pickup state exposes a `kind` equal to its `PICKUP_TYPES` slot and a `collected` flag, and the page's spawn dispatch contains no per-kind branch.
- **SC-003**: No pickup state module remains directly under `entities/`; each pickup resolves from one module under `entities/pickups/`; `entities/Health.ts` and `entities/Torch.ts` are unchanged in place.
- **SC-004**: The full test suite passes (assertions unchanged except for renames/import paths and the collection-storage form) and the production build succeeds.
- **SC-005**: A manual browser pass shows no visible or behavioural difference: coin spin/bob, key bob + HUD counter + flying text, heart heal (at full and reduced health), bomb pickup (below and at the cap), a question-mark fruit rising/revealing/being occluded, a death/respawn, and a full Reset Game.
- **SC-006**: Adding a pickup kind requires only one module plus one `PICKUP_TYPES` line — no page, collision, renderer or sprite-registry edit.
- **SC-007**: No R-001 forbidden edge is widened: `contracts/` still imports nothing from `engine/`, `entities/`, `level/` or state, and the shared `Pickup` model resolves from `contracts/` (beside `PickupKind`) rather than from `entities/`.
- **SC-008**: Collect-once has exactly one mechanism: a search finds no `collectedCollectibleIds` and no per-kind removal/flag special case; adding a future permanent pickup kind needs no new collection machinery — composing `Pickup` (with `collected`) and leaving its array uncleared by death/respawn is sufficient.

## Assumptions

- **The discriminator mirrors the shipped idioms.** `kind: PickupKind` on each state plus a shared `Pickup` model, with the registry pinned to the `contracts/PickupKind` vocabulary (a `Record<PickupKind, …>` annotation or `satisfies`) — exactly how `EnemyState.type` and `BlockState.blockKind` work today.
- **The one generic path keeps per-kind arrays, but one collect-once mechanism.** Each pickup family keeps its own signal array; collision and drawing dispatch generically on `kind`. Per the Clarifications, every kind stores its entries and flags `collected` (nothing is removed and there is no external id set), and the only per-kind difference is reset scope — the array is kept across death/respawn (coin/fruit/key) or cleared (heart/bomb). Arrays do NOT merge into one collection; a future permanent pickup simply composes `Pickup` and is not cleared on death.
- **The collect seam produces consequences, not state writes.** As with `BlockType.onHit` returning `RewardEffects`, a pickup kind's `onPickup` describes consequences (which counter/reward, heal, bomb/key banking, flying text) that a shared applier executes; the applier itself performs the one universal collect-once action of setting `collected: true`. The exact hook shape is a planning decision bounded by FR-004 and FR-009.
- **The placed-fruit path is already half-retired, and the live fruit kind stays.** R-002 FR-022 removed `CollectibleMarkerPositions.fruit`, the `placeCollectibles` fruit branch and the standalone `BonusFruit.ts` (merged into `entities/Fruit.ts`), and the placed collectible is already coin-only (its `CollectiblePlacement.spriteType` field, which R-006 renames to `kind`). R-006 finishes whatever remains and does not re-introduce any of it. Issue #94's bullet asking to drop the `'fruit'` member of `PickupKind` and `entities/pickups/Fruit.ts` predates R-002's FR-022 merge — the only live fruit is the question-mark reward, so that part of the bullet is **superseded** (see Clarifications) rather than executed; dropping it would break the registry and `spawnPickup`. The plan MUST NOT remove the live fruit kind, and must record this as a deliberate, documented deviation from the issue's literal wording.
- **`ItemKind` unification is out of scope.** `EnemyType.heldItem: ItemKind` ('key' only) versus `PickupKind`, and the shared enemy-defeat reward applier, belong to R-007 (D2); R-006 only unifies the pickup side and uses the existing `RewardEffects.spawnPickup` vocabulary.
- **`coinFrameSource` is already deleted.** The analysis's X6 dead-code note (`Coin.ts`'s `coinFrameSource`, a duplicate of `frameSource`) no longer exists in the tree; R-006 does not need to remove it.
- **Player-visible behaviour is preserved exactly; the collection *storage* changes.** The sanctioned changes are the discriminator addition, the unified `collected` flag (retained entries instead of removal / external id set), the generic dispatch, the colocation moves, the spawn/collect seam, the retirement of dead placed-fruit vocabulary, and the corresponding import/name updates — never a change to tuning, gates, draw depth, wording or reset scope.
- **No data migration.** The shipped level and markers are unchanged; only TypeScript types and module homes move.
- **Layer invariants continue to hold.** `contracts/` stays a leaf; `engine/` and `entities/` depend down on it; `level/` never imports `engine/`; `engine/` never imports state (R-001).

## Out of Scope

- Unifying `ItemKind`/`heldItem` and adding `EnemyType.onDefeat` with a shared enemy reward applier — **R-007** (D2).
- Hazard knockback/`withTickState` and counter metadata — **R-007** (D3/D4).
- Placeable world items (`WorldItemType`, `PlacedBomb`/`DeployableLadder` consolidation, the chest decision) — **R-008**.
- The `Renderer.ts` split into `SceneRenderer`/`HudRenderer` and atlas sharing — **R-009**; the tile-module registry — **R-015**.
- Mapper/editor unification — **R-010**; per-domain state stores and state/page decomposition — **R-011/R-012**; sprite asset/atlas organisation — **R-013**; the layer-boundary lint guard — **R-014**.
- Any change to pickup sprites, tuning, level data, translations, HUD counter layout, or the player's heal/bomb/key/coin mechanics.
