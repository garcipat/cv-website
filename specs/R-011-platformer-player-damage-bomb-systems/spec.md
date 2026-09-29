# Feature Specification: Platformer Player Damage & Bomb Systems

**Feature Branch**: `R-011-platformer-player-damage-bomb-systems`

**Created**: 2026-09-27

**Status**: Draft

**Input**: GitHub issue #99 — "R-011: Platformer Player Damage & Bomb Systems". Extract the four-times-duplicated player damage/knockback logic and the inline bomb subsystem into engine systems: a generalized hit-effect system where a hit is an ordered list of **generic primitive effects** (`damage`, `velocity`, `reaction`), applied by one resolver and composable by any source, plus a `BombSystem` that resolves a blast through that same model. Visual effects stay in the existing R-004 transient-effect registry, not in the hit vocabulary. This is an architecture refactor: the game must play exactly as it does today.

**Depends on**: [R-001 Platformer Core Contracts & Dependency Layers](../R-001-platformer-core-contracts/spec.md) (shipped: the `contracts/` leaf layer, the `PlayerEffects`/`CollisionOutcome` vocabulary and the layer-boundary contract), [R-002 Platformer Shared Primitives & Dedup](../R-002-platformer-shared-primitives/spec.md) (shipped: `contracts/Outcome.ts` folded the former `contracts/Contact.ts` in; `PlayerEffects` is the shared "what a contact does to the player" vocabulary this feature generalizes), [R-004 Platformer Transient Effect Registry](../R-004-platformer-transient-effect-registry/spec.md) (shipped: the transient-effect registry and `spawnEffect`, which the visual effects this feature emits ride on), [R-006 Platformer Pickup Unification](../R-006-platformer-pickup-unification/spec.md) (shipped: the `PickupOutcome` declarative-outcome pattern this feature follows), [R-007 Platformer Registry Dispatch Completion](../R-007-registry-dispatch-completion/spec.md) (shipped: the enemy/deployable registry dispatch and the `applyEnemyDefeats` shared applier the blast feeds), [R-008 Platformer Placeable World Items](../R-008-platformer-placeable-world-items/spec.md) (shipped: the `DeployableItemType` registry, the `Bomb` fuse/detonation module and the `BlastRequest[]`/`applyDeployableItemConsequences` late pass this feature consumes), and [O-012 Platformer Bombs](../O-012-platformer-bombs/spec.md) (shipped: bomb placement, fuses, blast geometry and the shipped blast behaviour this feature relocates).

**Design reference**: [`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) — Phase 9 "God-file decomposition (systems + stores)"; finding **D5** (`PlayerDamageSystem`: the same `takeDamage → alive → applyHitReaction → splatter` shape spelled out 4–5× inline, each site re-deriving the player centre and re-implementing crouch-suppresses-knockback), finding **D6** (`BombSystem`: the ~120-line inline fuse/detonation/blast/filtering block), and the target-tree sketches `features/bombs/` (`PlacedBomb` + blast + `BombSystem`) and `engine/` (generic runtime services).

## Clarifications

### Session 2026-09-27

- Q: The issue sketches a `PlayerDamageSystem` that mutates player state and owns "at most one hit per tick", but this codebase's house rule is pure engine functions returning declarative results with the page as the only writer (no `engine/ → state/` edges). How should the damage system be shaped? → A: A pure `engine/` module returning a declarative result (next target state + effect requests); the page keeps call timing and applies. No `engine/ → state/` edge; behaviour is byte-identical.
- Q: R-008 already moved bomb fuse/detonation into the `Bomb` deployable-item registry; only the blast resolution is still inline. What should `BombSystem` own? → A: Rebuild the bomb blast on a **generalized impact model** rather than a bomb-specific pass: any source emits an impact described as an **ordered list of independent effects**, and `BombSystem` is one such emitter (a radial impact). The user wants damage so generalized that "taking damage is an effect that can be triggered anywhere", on all target families (player, enemies, blocks), and easy to extend with new sources/effects.
- Q: Are damage and knockback a single bundled concept? → A: No. **Damage, knockback/push, the hit reaction and the visual are separate effects.** Not every hit damages (a push-only impact is valid) and not every hit knocks back; effects apply in a source-defined order. The model MUST express any subset in any order.
- Q: Which targets participate? → A: **All target families share one effect model** — player, enemies and blocks all consume the same ordered effect vocabulary, even where an individual effect is only meaningful to one family.
- Q: How strictly must behaviour be preserved? → A: **Strictly.** The game must play exactly as today; this is an architectural refactoring, not a gameplay change. Existing tests keep their assertions (import/search-path updates only).
- Q: `contracts/` is a strict leaf (FR-014) yet FR-010 requires `PlayerEffects` to be expressed in terms of the shared impact vocabulary — which layer owns that vocabulary? → A: The vocabulary (`Impact` + `ImpactEffect`) lives in the **leaf `contracts/` layer**, imported by both `engine/` and `entities/`; only the resolver and `BombSystem` are engine-layer modules. `PlayerEffects`/`CollisionOutcome` are re-expressed in terms of the vocabulary (not duplicated), and the edge-case wording is corrected from "the impact vocabulary and resolver stay engine-layer" to "the resolver stays engine-layer".
- Q: Is an `Impact` itself an effect, and does the enemy-stomp path (`EnemyType.onPlayerCollide` returning `self: takeHit(enemy)`) migrate onto the shared resolver? → A: An `Impact` is only the **container** (source identity + ordered effects); damage, knockback/push, reaction and splatter are **separate** member effects. The stomp **migrates**: enemy kinds emit a declarative enemy hit (`damage` + the enemy's `reaction`) that the resolver applies, so no kind module calls `takeHit` directly and `CollisionOutcome.self` is no longer the vehicle for an applied hit.

### Session 2026-09-29

- Q: The first implementation's effect members were named after use-cases (`knockback{basis:'away'|'awayAndUp'}`, `splatter{variant}`, `reaction{kind:'hit'|'pit'}`, block `hit`/`destroy`, a closed `ImpactSource` union, and an `Impact` container), so a new source or visual required a union edit — the opposite of "add easy". How should the vocabulary be reshaped? → A: Reduce it to **generic primitives** — `damage{amount}`, `velocity{x?,y?,duration?,preserveJump?}` and `reaction{blinkOnly?}` — with **no container object and no source identity**. A signed `velocity.x` replaces the `away`/`awayAndUp` intent (the engine supplies the away direction on the `Contact`); `reaction{blinkOnly}` replaces the `'hit'`/`'pit'` kinds; blocks take `damage` (amount = hits). Adding a new source composes primitives; no shared union to edit.
- Q: Where do the player's visual effects (the splatters) live? → A: **In the existing R-004 transient-effect registry**, spawned by the source via `spawnEffect(factory(...))` exactly as the rest of the game already does — not in the hit vocabulary. To remove the pre-refactor anchor duplication, ONE generic `playerEffectAnchor(player, originX, originY, 'center'|'feet')` helper is shared; a new visual is a new R-004 effect, never a vocabulary change.
- Q: Where do the hit-impulse constants live? → A: **Per-entity, with shared defaults.** A new `shared/knockback.ts` holds the reusable defaults (`DEFAULT_HIT_KNOCKBACK = { vx: 250, duration: 0.25 }`, `DEFAULT_STOMP_BOUNCE_VY = -330`); an entity that differs colocate its own constant (`SlimePurple`'s spike rebound, `pot.ts`'s bounce, `bouncyMushroom.ts`'s super-jump). `PHYSICS_CONFIG` drops the six impulse fields and keeps only general movement physics, so a kind's tuning travels with the kind instead of leaking into shared config.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - One ordered impact-effect model replaces the duplicated player damage sites (Priority: P1)

Today the shape "compute new hit points, flip `alive`, start the hit reaction, optionally add knockback, optionally spawn splatter" is written out longhand at four player sites — enemy contact (`PlatformerPage.tsx:1627-1678`), ordinary hazard (`:1680-1739`), bomb blast (`:2033-2075`) and pit fall (`:2108-2125`) — with a fifth hard-coded lethal variant at the spear site (`:1567-1593`). Each site re-derives the player's screen centre (`x + PLAYER_RENDERED_SIZE/2 + originX`, `y + PLAYER_VISUAL_CENTER_Y_OFFSET + originY`), each re-implements "crouch suppresses knockback" (`:1637`, `:1716`, `:2051`), and each open-codes which of damage / reaction / velocity / splatter it wants. After this feature a source states its hit as an **ordered list of generic primitive effects** — e.g. the spear is `damage{amount: current hitPoints}` (its feet blood spawned separately through R-004), a floor spike is `damage + reaction` (no velocity), a side hit is `damage + reaction + velocity` — and one resolver folds that list into the next player state. No source spells out the shape; the splatter anchor comes from one shared helper rather than per-site maths.

**Why this priority**: This is the issue's headline instruction (D5) and the reason the generalized model exists: damage becomes a triggerable effect rather than a copy-pasted block. It is P1 because every other user story builds on this vocabulary.

**Independent Test**: Search the page for the damage shape — there is no remaining longhand `takeDamage` + `{ ...player, hitPoints, alive }` + `applyHitReaction` + `startPlayerHitSplatter` sequence outside the resolver. Confirm each of the four inline player sources this story rewrites (lethal spear, enemy contact, ordinary hazard, pit fall) plus the block-bounce write now hands the resolver an ordered effect list, and that all existing damage/knockback/splatter/death tests still pass with their assertions unchanged. (The fifth source — the bomb blast — is delivered by US3 through `BombSystem`, not here.)

**Acceptance Scenarios**:

1. **Given** a side hit from an enemy, **When** the source builds its hit, **Then** it emits `damage + reaction + velocity(away)` (or, for a spiked-top enemy, the same with a `y` component) and the resolver produces the same hit points, reaction, velocity and facing as today; the splatter is spawned from the source through R-004.
2. **Given** a lethal spear tip, **When** it lands, **Then** it emits `damage{amount: current hitPoints}` with no reaction and no velocity, bypasses the invulnerability window, and suppresses the same-tick enemy/hazard damage exactly as today; its feet blood is spawned from the source.
3. **Given** a damage source that does not knock back (a floor spike, a falling stalactite, or any hit taken while crouched), **When** it lands, **Then** its effect list contains `damage` and `reaction` but no `velocity`, and the character flashes without moving.
4. **Given** a pit fall, **When** it lands, **Then** it emits `damage + reaction{blinkOnly}` (no velocity, no splatter) and the position recovery still runs even while the damage is suppressed by invulnerability.
5. **Given** a velocity-only effect list (no damage), **When** the resolver runs it, **Then** the target is moved and takes no damage — the model does not assume every hit damages.

---

### User Story 2 - Every target family consumes the same ordered effect vocabulary (Priority: P1)

Damage today has three unrelated pipelines: the player's five inline sites; enemies via `applyEnemyDamage` / `takeHit` (`entities/Enemy.ts:158`, `entities/enemies/shared.ts:81`); and blocks via `applyBlockHit` driven to terminal (`entities/Block.ts`). After this feature all three families consume the **same** ordered `HitEffect[]` vocabulary through a shared resolver, with each family mapping a primitive to its own semantics: the player maps `damage` to `takeDamage`, a `velocity` to its horizontal/vertical impulse and `reaction` to `applyHitReaction`/`beginPitFallReaction`; an enemy maps `damage` to its hit-points pipeline and `reaction` to its own `hitReactionSeconds` state; and a block maps `damage` to `applyBlockHit` hits (saturating at used-up). A primitive meaningless to a family (e.g. `velocity` on an enemy) is simply not applied by that family; a family ignores a primitive it has no semantics for rather than crashing.

**Why this priority**: This is the user's explicit "all targets share one effect model" decision. It is what makes the bomb blast, the bump loop and the player sources one mechanism instead of three, and it is what makes a new target family or a new effect a local addition.

**Independent Test**: Confirm a single effect vocabulary and a single resolution entry point are the only paths by which the player, an enemy and a block take a hit; confirm the enemy and block call sites pass effect lists rather than calling their hit functions directly; confirm the enemy/block damage and destruction tests keep their assertions.

**Acceptance Scenarios**:

1. **Given** the shared effect vocabulary, **When** an enemy is hit by a blast, **Then** the blast emits an enemy impact through the same vocabulary the player uses and the enemy loses `BOMB_DAMAGE` hit points through its existing reaction/defeat pipeline.
2. **Given** the shared effect vocabulary, **When** a destructible block is caught in a blast, **Then** the blast emits a destructive block effect through the same model and the block is driven to its terminal state and outcome exactly as a bump would drive it.
3. **Given** an effect a target family has no semantics for, **When** the resolver applies it, **Then** the family ignores it and the rest of the ordered list still applies.
4. **Given** the three families, **When** their hit paths are searched, **Then** no family calls its damage/hit function directly from a source site — every path goes through the shared resolver.

---

### User Story 3 - Bombs are resolved by a `BombSystem` built on the impact model (Priority: P1)

Today the R-008 late pass returns `BlastRequest[]`, and then the page owns ~106 inline lines that compute the blast tiles, enumerate blocks/enemies/the player, damage each, drive blocks to terminal, spawn the explosion and manage a per-tick one-hit latch (`PlatformerPage.tsx:1982-2088`, with `engine/Blast.ts` supplying only the geometry). After this feature a `BombSystem` consumes the `BlastRequest[]`, treats each blast as an **area damage source**, and produces a declarative blast delta: which blocks are destroyed, which enemies are hit, the player's effect list in the shared vocabulary plus its splatter request, and the explosion request. The page applies the delta (through the existing shared appliers) and spawns the effects; it no longer names bomb tiles, bomb damage or blast geometry.

**Why this priority**: This is D6 and the user's request to improve the bomb architecture. It is P1 because the blast is both the largest inline block and the proving ground for the generalized model on all three target families at once.

**Independent Test**: Confirm the inline blast loop is gone, that `BombSystem` (a pure `engine/` module) is the only place blast geometry is turned into target deltas, and that every existing bomb test (fuse, detonation, blast damage, block destruction, enemy damage, invincibility, no chain reaction) passes with unchanged assertions.

**Acceptance Scenarios**:

1. **Given** a detonated bomb, **When** its `BlastRequest` reaches `BombSystem`, **Then** the system returns the blocks to destroy, the enemies to hit, the player's effect list and splatter request, and the explosion requests, and the page applies them in the same order and with the same results as today.
2. **Given** a character inside the blast who is not invulnerable, **When** the blast resolves, **Then** they take one full heart, enter the red reaction, are pushed away from the blast centre (unless crouched) and spawn a splatter, exactly as today.
3. **Given** a question-mark block, a used-up block, a dead enemy outside the blast or a second placed bomb inside the blast, **When** the blast resolves, **Then** each behaves exactly as today (untouched / inert / unaffected / no chain reaction).
4. **Given** two blasts in one tick, **When** both could hit the player, **Then** the player takes at most one blast's damage, preserving today's one-blast-per-tick latch.

---

### User Story 4 - The refactor changes nothing the player sees (Priority: P1)

This is a refactor of already-shipped gameplay, so the acceptance bar is that the game plays identically: the same damage per source, the same invulnerability windows and ordering, the same knockback velocities/facing, the same crouch suppression, the same lethal-spear bypass, the same splatter variants/anchors/colours, the same enemy reactions and defeats, the same block destructions and rewards, and the same explosion timing. The fragile parts are the **ordering** (spear before enemy before hazard; bomb/pit writing the post-physics value; the block bump loop vs the blast) and the **target** each source writes (`playerState.value` vs the tick-local `next`).

**Why this priority**: It is the binding condition of every R-NNN refactor (the user's "the game should just play the same") and the verification story that runs last over the combined change.

**Independent Test**: Play a level against the pre-refactor build and compare: side hits, a spiked-top enemy, a floor spike, a falling stalactite, a lethal spear, a pit fall, a crouched hit of each kind, a bomb blast (standing and crouched), a blast that destroys a crate, a blast that kills a green slime, a blast that only wounds a purple slime, and death/respawn. Separately, run the existing suites untouched.

**Acceptance Scenarios**:

1. **Given** the game tick, **When** damage is applied, **Then** each source is resolved at its existing point (pre-physics for spear/enemy/hazard on `playerState.value`; post-physics for bomb/pit on the tick-local value) with the same resulting state.
2. **Given** the full existing test suite, **When** it runs after the change, **Then** every assertion is unchanged except for module/import/search-path updates, and the production build succeeds.
3. **Given** the render, **When** a hit, a death or a blast occurs, **Then** every splatter/explosion effect appears with the same variant, anchor, side, colour, lifetime and draw layer as today.
4. **Given** the structural guard, **When** it runs, **Then** it fails if the longhand damage shape, a direct family hit call from a source, or a bomb-specific tile/damage branch reappears in the page.

---

### User Story 5 - A new damage source or effect is a local addition (Priority: P2)

The point of the generalization is that the next thing — a spike wall, a push-only fan, a burning tile, a new blast shape — does not require editing the tick. After this feature a new source is a module that emits an effect list (and/or spawns an R-004 visual), and a new mechanic is one primitive plus its handler; neither touches the page's control flow, its anchor maths or a bomb-specific branch. The existing declarative hooks (`BlockType.onHit`, `EnemyType.onPlayerCollide`/`onDefeat`, `DeployableItemType.onTick`) remain the way a kind decides what a touch means; they simply hand their result to the shared resolver.

**Why this priority**: It is the user's stated motivation ("a more generalized system I can add additional things easy") and the measure of whether the abstraction paid off. It is P2 because the P1 stories deliver the mechanism; this story captures the extension contract so it does not silently regress.

**Independent Test**: Add a throwaway velocity-only source in a test (an effect list with no damage) and confirm it moves the player and spawns no splatter without any page change; confirm adding a primitive requires no edit to the resolver's per-family dispatch beyond its handler.

**Acceptance Scenarios**:

1. **Given** a new source that emits a velocity-only effect list, **When** it is wired to the resolver, **Then** the player moves, takes no damage and shows no red reaction, and the page's control flow is unmodified.
2. **Given** a new primitive, **When** it is added to the vocabulary, **Then** only its handler(s) and its emitter(s) change — not the page's hit sites.
3. **Given** the source sites, **When** they are inspected, **Then** each expresses its hit as data (an ordered effect list), not as imperative calls into the state layer.

---

### Edge Cases

- ✅ **Lethality is ordinary damage, not a special member.** The spear emits `damage{amount: player.hitPoints}` at a site that does not consult the invulnerability window, so it kills through the same primitive; there is no `lethal` flag to extend. It still suppresses the same-tick enemy/hazard damage (`spearKilled`) and spawns its feet-anchored blood through R-004.
- ✅ **Not every hit damages, not every hit moves, and each source decides.** The vocabulary must permit damage-only (floor spike), damage+velocity (side hit), velocity-only (a future fan), reaction-only (a future stun) and damage+visual (spear) combinations, applied in the source's order. Crouch suppression is per-source policy, not a resolver rule (enemy: never while crouched; hazard: only when the hazard `knocksBack` and not crouched; bomb: never while crouched); the resolver applies what it is given.
- ✅ **Damage target differs by site.** Spear/enemy/hazard write the pre-physics `playerState.value` (so `stepPlayerPhysics` inherits the hit `vx`/animation); bomb/pit write the tick-local post-physics value. The resolver must be callable against either and must not force them together (US4, Clarification 5).
- ✅ **One hit per tick is emergent, not a flag.** Today it is the invulnerability window plus site ordering plus the bomb-local latch — there is no `hitThisTick` field. The refactor must reproduce this without introducing a global latch that would change multi-source ticks.
- ✅ **Pit recovery is not gated by invulnerability.** Only the damage/reaction is suppressed; `resolvePitFall` always runs. The pit impact's effect list must not accidentally gate the recovery.
- ✅ **Every impulse is one `velocity`.** An enemy's `awayAndUp` (`y = awayAndUpKnockbackVy`) and a stomp/pot/mushroom bounce both set `bounceAscending: true`, so both are a `velocity` with `preserveJump: true`; they differ only in the signed `x`/`y` the source computes. The engine supplies the away direction on the `Contact`, so a kind builds a concrete signed `velocity.x` rather than naming an `away`/`awayAndUp` case.
- ✅ **Splatter is a visual, not part of the hit vocabulary.** It rides the existing R-004 transient-effect registry and is spawned by the source (`spawnEffect(startPlayerHitSplatter(...))` etc.), keeping its anchor, side bias, colour and lifetime; a killing blow spawns no splatter except the spear, which always does. The vocabulary never names a visual; a new visual is a new R-004 effect.
- ✅ **Block destruction is a cascade.** Driving a block to terminal runs `resolveBlockTerminalOutcome`, which reveals facts, spawns pickups and can itself emit player effects (a pot's bounce); the impact model must let a target's reaction produce further effects without the source knowing.
- ✅ **Enemy defeats are not damage.** Killing an enemy only marks it; the `justDefeated → applyEnemyDefeats` pipeline pays the reward/puff/drop. The blast must continue to feed that pipeline rather than resolving defeats itself.
- ✅ **Blast geometry is unchanged.** Rounded 5×5 minus corners, bounds-clipped, no line-of-sight; the explosion is cosmetic and spawned once per blast at the bomb's detonation position.
- ✅ **The model must not become a giant options bag.** A hit is declarative data (an ordered effect list), not a `switch` on source kind inside the resolver; new sources compose primitives and never add a branch to a central conditional. The members stay **generic primitives** (`damage`/`velocity`/`reaction`) rather than per-use-case names (`awayAndUp`, `splatterVariant`, `hit`/`destroy`), so a new source or visual needs no shared-union edit.
- ✅ **The model must not widen R-001's forbidden edges.** The impact **vocabulary lives in the leaf `contracts/` layer** and the **resolver stays engine-layer**: no `level/ → engine/`, no `engine/ → state/`, and `contracts/` stays a leaf; the page/state remains the only writer of signals.
- ✅ **`PlayerEffects` is the vocabulary being generalized, not a parallel copy.** Existing declarative hooks (`BlockType.onHit`, `EnemyType.onPlayerCollide`, `DeployableItemType` outcomes) must be routed through the new model rather than keeping a second "player effects" path beside it.

## Requirements _(mandatory)_

### Functional Requirements

#### The impact model

- **FR-001**: Exactly ONE ordered hit-effect vocabulary MUST describe a hit, shared by every target family. A hit MUST be declarative data: an **ordered list of generic `HitEffect` primitives** — `damage`, `velocity` and `reaction` — with **no wrapper/container object and no source identity**. Every source (spear, enemy contact, ordinary hazard, pit fall, block hit, bomb blast, and any future source) MUST express its mechanical consequences as such a list; no source may call a target family's damage/hit function directly or open-code the damage shape. The vocabulary MUST name **primitives, not use-cases**.
- **FR-002**: The vocabulary MUST express, as independent generic members, exactly: **`damage { amount }`** (reduce health; a block maps `amount` to a hit count), **`velocity { x?, y?, duration?, preserveJump? }`** (a signed horizontal `x` that also sets facing, a vertical `y`, an input-override `duration`, and `preserveJump` for the jump-cut protection), and **`reaction { blinkOnly? }`** (enter the family's hurt state; `blinkOnly` is the pit fall's window-only variant). Visuals MUST NOT be vocabulary members — they stay in R-004 (FR-008). The list MUST allow any subset in any source-defined order, including a velocity-only list that deals no damage and a damage-only list that does not move the target. Future primitives MUST be addable without editing the page's hit sites.
- **FR-003**: Exactly ONE shared resolution entry point MUST fold an ordered effect list into a target's next state. It MUST be callable for each target family (player, enemy, block) and MUST NOT read or write signals; the page/state remains the only writer. A primitive a family has no semantics for MUST be ignored by that family without aborting the remaining effects. The resolver MUST return state only — it MUST NOT collect or spawn visuals.
- **FR-004**: The resolver MUST preserve each family's existing hit semantics exactly: the player's `takeDamage`/`alive`/`applyHitReaction`/`beginPitFallReaction`/`isInvulnerable` behaviour, the enemy's `applyEnemyDamage`/`takeHit`/`hitReactionSeconds` behaviour, and a block's `applyBlockHit` behaviour (one hit per `damage` point, saturating at used-up). Visual effects (splatters, explosions) MUST be spawned by the sources through the existing R-004 registry, with unchanged factories, anchors, sides, colours, lifetimes and layers.
- **FR-005**: The resolver MUST support the cascade where a target's reaction emits further effects for another target (a hit block's `onHit` player effects such as a pot's bounce, a defeated enemy's rewards), routing them through the same model rather than a parallel path.

#### The player sources

- **FR-006**: All five player damage sources MUST be rewritten to emit ordered effect lists instead of longhand blocks: the lethal spear, enemy contact, ordinary hazard (spike / floor spike / falling stalactite), the bomb blast, and the pit fall. The distinctive per-source behaviour MUST be preserved: the lethal spear bypasses invulnerability and suppresses same-tick enemy/hazard damage (by dealing lethal `damage`, not a special member); the enemy spiked-top vs side impulse; per-hazard `knocksBack`; crouch suppression; the pit fall's ungated position recovery; the bomb's one-blast-per-tick latch.
- **FR-007**: Each source MUST keep its existing resolution point and target: spear/enemy/hazard resolve pre-physics against `playerState.value`; bomb/pit resolve post-physics against the tick-local value. The refactor MUST NOT introduce a global once-per-tick latch or force the sources onto one shared value.
- **FR-008**: Splatter placement MUST be de-duplicated by ONE generic helper: the player's screen centre/feet anchor (`x + PLAYER_RENDERED_SIZE/2 + originX`, `y + PLAYER_VISUAL_CENTER_Y_OFFSET + originY`, or the feet anchor) MUST be produced by a single shared `playerEffectAnchor(player, originX, originY, anchor)` function rather than re-derived at each site, while producing the same world coordinates as today. Visuals MUST stay in the R-004 registry; the vocabulary MUST NOT name a visual.

#### The block and enemy paths

- **FR-009**: The block bump/destruction path and the enemy damage path MUST consume the shared model: a source emits a block or enemy impact, and the shared resolver applies it, so neither the page's bump loop nor the blast names a family-specific hit function. The enemy-stomp path MUST migrate too: `EnemyType.onPlayerCollide` MUST emit a declarative enemy hit (a `damage` primitive plus the enemy's `reaction`) for the resolver to apply, and MUST NOT return a pre-applied `self: takeHit(enemy)`; `CollisionOutcome.self` MUST NOT remain the vehicle for a hit's applied state. Block terminal outcomes (`resolveBlockTerminalOutcome`) and enemy defeats (`applyEnemyDefeats`) MUST remain the appliers and MUST NOT be absorbed into the resolver.
- **FR-010**: The shared `HitEffect` vocabulary MUST live in the leaf `contracts/` layer (importable by `engine/` and `entities/` alike; `engine/` holds only the resolver and `BombSystem`). `PlayerEffects` (`contracts/Outcome.ts`) MUST be reconciled with the new vocabulary so there is exactly ONE "what a hit does to the player" vocabulary: `PlayerEffects`/`CollisionOutcome` MUST be expressed in terms of the generic primitives rather than duplicated, and existing kinds that return `PlayerEffects` (`BlockType.onHit`, `EnemyType.onPlayerCollide`) MUST feed the model rather than keeping a second path beside it. `contracts/` MUST NOT import `engine/` to achieve this.

#### The bomb system

- **FR-011**: A `BombSystem` MUST own bomb blast resolution as a pure `engine/` module: consuming the R-008 `BlastRequest[]` and returning a declarative blast delta — the blocks to destroy, the enemies to hit, the player's effect list (in the shared vocabulary) plus the player's splatter request, and the explosion requests. The page MUST apply the delta through the existing shared appliers and spawn the effects; it MUST no longer compute blast tiles, enumerate blast targets or branch on bombs inline.
- **FR-012**: `BombSystem` MUST consume, not duplicate, R-008's fuse/detonation (`Bomb` deployable item + `applyDeployableItemConsequences`). It MUST NOT re-own fuse timing, detonation detection or the drop-out rule.
- **FR-013**: The blast resolution MUST preserve today's behaviour exactly: rounded 5×5-minus-corners bounds-clipped geometry; destructible blocks driven to terminal identically to a bump; question-marks and used-up blocks untouched; enemies take `BOMB_DAMAGE` through the shared hit pipeline and feed `justDefeated → applyEnemyDefeats`; the player takes one full heart, the red reaction and an away-from-centre push unless crouched, subject to invulnerability and the one-blast-per-tick latch; the explosion spawned once per blast at the detonation centre; no chain reaction on a second placed bomb.

#### Structural guarantees

- **FR-014**: The change MUST NOT widen R-001's forbidden edges: `contracts/` MUST stay a leaf, there MUST be no new `level/ → engine/`, and no new `engine/ → state/`. The impact vocabulary and resolver take plain values and return data; the page/state applies.
- **FR-015**: The longhand damage shape MUST NOT survive: after the change there MUST be no remaining duplicate `takeDamage` + `alive` write + `applyHitReaction` + splatter sequence at a source site, no per-source crouch-knockback conditional outside the source's effect list, and no bomb tile/damage branch in the page. A `playerState`-shaped second path MUST NOT survive as a compatibility shim.
- **FR-016**: An automated structural guard test MUST fail the suite if FR-014/FR-015 regress (a direct family hit call from a source, a reintroduced inline damage shape or bomb branch, or a forbidden import edge). The guard MUST be non-vacuous (frozen expectations) and MUST follow the project's `{method}-{condition}-{expected-result}` test-naming convention.
- **FR-017**: All existing tests MUST migrate and MUST pass; assertions MUST be unchanged wherever only a module home, import path or internal call shape changed, and a test that covered a consolidated symbol MUST be rewritten against the shared form — never weakened, skipped or deleted. The production build and TypeScript strict build MUST succeed with no `any`.
- **FR-018**: No compatibility barrel, alias or re-export MAY preserve a removed per-site helper, a removed inline shape or a bomb-specific path; the old ad-hoc entry points MUST be gone rather than re-exported.

### Key Entities _(include if feature involves data)_

- **Hit effect list**: A source's declarative hit — an ordered list of generic `HitEffect` primitives. There is no wrapper/container object and no source identity. Data only; produced by sources, consumed by the resolver. Lives in the leaf `contracts/` layer.
- **HitEffect**: One **generic primitive** member — `damage { amount }` (health, or hit count for a block), `velocity { x?, y?, duration?, preserveJump? }` (an impulse), or `reaction { blinkOnly? }` (the family's hurt state). Independent and composable in any order and subset. Visually neutral: no visual is a member. Lives in the leaf `contracts/` layer.
- **Hit resolver**: The one pure engine entry point (`resolveHitEffects`) that folds an effect list into a target family's next state. Exactly one entry point shared by every target family, over the one `contracts/`-owned vocabulary; only the resolver (and `BombSystem`) are engine-layer. It returns state, never visuals.
- **`playerEffectAnchor`**: The one helper turning a `PlayerState` + camera origin + `'center'|'feet'` into a splatter anchor, so no site re-derives the screen maths.
- **BlastRequest** (existing, R-008): The bomb's detonation payload (`col`, `row`, world `x`/`y`, cosmetic `effectId`, player `hitEffectId`). Consumed by `BombSystem`; unchanged.
- **Blast delta**: `BombSystem`'s declarative result — blocks to destroy, enemies to hit, the player's `HitEffect[]`, the player splatter request, the explosion requests. Applied by the page.
- **Target families**: player (`takeDamage`/`applyHitReaction`/`beginPitFallReaction`), enemy (`applyEnemyDamage`/`takeHit` + `hitReactionSeconds`), block (`applyBlockHit`, one hit per `damage` point, saturating at used-up). Each maps the shared vocabulary to its own semantics.
- **Existing appliers (unchanged)**: `resolveBlockTerminalOutcome` (block rewards/pickups), `applyEnemyDefeats` / `state/enemyRewards.ts` (enemy rewards/puffs), `spawnEffect` / `advanceEffects` (R-004 transient effects).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The four duplicated player damage sites plus the lethal-spear variant are replaced by a single ordered-effect resolution path — zero remaining copies of the longhand shape (verifiable by search and by the guard test).
- **SC-002**: The ~106-line inline bomb blast loop is gone from the page; blast resolution lives in `BombSystem`, and the page contains no `blastTiles`/`blocksInBlast`/`enemiesInBlast`/`BOMB_DAMAGE` branch (verifiable by search).
- **SC-003**: A new damage source can be added by emitting an ordered effect list with no edit to the page's hit sites or control flow, and a velocity-only or damage-only list is expressible without a new code path.
- **SC-004**: Every existing platformer test passes with unchanged assertions except module/import/search-path updates; the full suite and the production build are green.
- **SC-005**: A play-through comparison across all damage sources, deaths, enemy reactions, block destructions and bomb blasts is behaviour-identical to before (same damage, windows, ordering, knockback, visuals).
- **SC-006**: R-001's layer edges are unchanged (no `contracts/` non-leaf, no new `level/ → engine/`, no new `engine/ → state/`), asserted by the guard test.
- **SC-007**: No test is deleted, skipped or weakened; the count of damage/knockback/splatter/death/bomb tests is preserved or grown.

## Assumptions

- **The refactor is invisible.** Per the project's R-NNN definition and the user's direction, no gameplay, tuning, art, level-data or HUD change is allowed; any actual bomb redesign (fuse, radius, damage, chaining) is a separate future feature, not this one.
- **Existing declarative hooks stay.** `BlockType.onHit`, `EnemyType.onPlayerCollide`/`onDefeat`, `DeployableItemType.onTick` remain how a kind decides what a touch means; the model changes how their results are applied, not that they are the decision points. The one shape change is the enemy-side hit: `onPlayerCollide` declares the enemy `damage`/`reaction` for the resolver instead of returning a pre-applied `self` state.
- **Rewards/defeats/outcomes stay separate appliers.** The impact model covers taking a hit; `resolveBlockTerminalOutcome`, `applyEnemyDefeats` and the R-004 effect collection keep their jobs.
- **Heal is out of scope.** The heart-pickup heal (`healDamage`, `PickupOutcome.heal`) is not a hit and stays with the pickup outcome; the model need not absorb it.
- **The vocabulary is generic primitives, not per-use-case members.** "One model" means one vocabulary of `damage`/`velocity`/`reaction`, one resolution framework and one ordering mechanism shared by all families. A primitive a family cannot use (e.g. `velocity` on an enemy) is ignored by that family rather than excluded from the union, so a new source composes primitives and spawns its own R-004 visual without editing a shared union.
- **Vocabulary/layer placement.** The shared `HitEffect` vocabulary is a `contracts/` leaf type, not an engine type, so both `entities/` (kind hooks) and `engine/` (resolver) meet it without a forbidden `contracts/ → engine/` edge. The resolver and `BombSystem` are engine-layer pure modules; the page/state wires and applies them (as `tickDeployableItems`/`applyDeployableItemConsequences` already are). Exact file paths/names are settled in planning.
- **Existing tests are the behavioural contract.** The damage/knockback/splatter/death/bomb suites (`PlatformerPage.test.tsx`, `Collision.test.ts`, `Player.test.ts`, `Health.test.ts`, `Blast.test.ts`, `Bomb.test.ts`, `explosion.test.ts`, `hitSplatter.test.ts`) already encode the required behaviour and must keep their assertions.

## Out of Scope

- Any gameplay/balance change to bombs, damage, knockback, invulnerability or effects (fuse length, radius, chaining, new bomb kinds) — that is a follow-up feature.
- `R-012 Platformer State Stores & Asset/HUD Extraction` (D7/D8/D9) — per-domain stores, asset loading and the HUD model are its concern.
- `R-013 Platformer Sprite Asset & Atlas Organization` and `R-014 Platformer Layer-Boundary Lint Guard` — asset organisation and the standalone lint guard are separate; this feature adds only a feature-local structural guard.
- Entity-folder reorganisation (`features/bombs/`, `entities/` grid-vs-actor split) beyond what a clean `BombSystem`/resolver home requires.
- Reward/defeat/pickup appliers and the R-004 transient-effect registry internals (consumed, not redesigned).
