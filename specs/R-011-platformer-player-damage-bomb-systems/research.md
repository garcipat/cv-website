# Phase 0 Research — R-011 Platformer Player Damage & Bomb Systems

**Feature**: `R-011-platformer-player-damage-bombs` | **Date**: 2026-09-29

This refactor has no external technology unknowns. The 2026-09-27 session fixed the direction (ordered
effect list; all families share it; strict behaviour preservation); the **2026-09-29 session**
corrected the shape: the first members were use-case names, so the vocabulary is reduced to **generic
primitives** and visuals return to R-004. This document fixes the exact module boundaries, the
primitive semantics and the guard checks. Each entry is **Decision / Rationale / Alternatives
considered**.

---

## D1 — The vocabulary is `contracts/HitEffect.ts`: three generic primitives, no container

- **Decision**: `contracts/HitEffect.ts` (leaf) declares `HitEffect` = `damage{amount}` |
  `velocity{x?,y?,duration?,preserveJump?}` | `reaction{blinkOnly?}`. There is **no `Impact`
  container**, **no `ImpactSource`**, and **no `SplatterVariant`/`HitAnchor`**. A hit is a bare
  `readonly HitEffect[]`.
- **Rationale**: The first implementation's members were per-use-case (`knockback{basis:'away'|
'awayAndUp'}`, `splatter{variant}`, `reaction{kind}`, `hit`/`destroy`, a closed source union), so a
  new source or visual required a union edit — the opposite of the user's "add easy" goal. Primitives
  make a new source a composition, not a type change. The container carried only a source string that
  no code branched on (the resolver dispatches on member type), so it is dead weight.
- **Alternatives considered**: (a) keep the container with a generic open `source` — rejected, the
  string is unused; (b) keep named members but "open" them — rejected, still a shared edit per source.

## D2 — `contracts/Outcome.ts` re-expressed; `Contact` gains `awayDirection`

- **Decision**: `PlayerEffects { effects?: readonly HitEffect[] }`;
  `CollisionOutcome { selfEffects?: readonly HitEffect[] }` (the `self` state is deleted);
  `BlockHitOutcome = PlayerEffects & RewardEffects`. `CollisionOutcome` loses its `<S>` parameter (no
  entity-typed field remains; an unused parameter is rejected by strict TS). `Contact` gains
  `awayDirection: -1 | 1` (the engine's player-centre-vs-self-centre sign) so a kind can build a
  concrete signed `velocity.x` without naming an `away`/`awayAndUp` case.
- **Rationale**: FR-010 requires ONE player-facing vocabulary; a second field list beside it would
  break that. `self`'s only consumer was the enemy stomp, which migrates (D9). The away direction is
  geometry the engine already computes; handing it to the kind keeps the kind from re-deriving it.
- **Alternatives considered**: (a) keep a `knockback: 'away'|'awayAndUp'` field so the engine signs
  it — rejected, that is the use-case naming the user rejected; (b) have the kind compute the sign from
  `playerBox`/`selfBox` itself — rejected, duplicated geometry.

## D3 — One resolver, `resolveHitEffects`, returns state only

- **Decision**: `engine/HitResolver.ts` exports `resolveHitEffects(target, effects)` with three typed
  overloads (player/enemy/block) and three non-exported adapters. No `ctx`; it returns the next target
  state (`PlayerHitResult`/`EnemyHitResult`/`BlockHitResult`), never a visual.
- **Rationale**: FR-003's single entry point, but now the resolver is a pure state fold — visuals are
  the caller's job (D4). Dropping `ctx` simplifies the signature and removes the resolver's only
  reason to know about the camera.
- **Alternatives considered**: keep `resolveImpact(target, impact, ctx)` — rejected: the container and
  the visual collection both went away.

## D4 — Visuals stay in R-004; one `playerEffectAnchor` helper

- **Decision**: Sources spawn splatters/explosions themselves via the shipped
  `spawnEffect(factory(...))`. One new helper `playerEffectAnchor(player, originX, originY,
'center'|'feet')` (beside the `PLAYER_*` constants) is the single site of the player's screen-anchor
  maths; `enemyEffectAnchor` + `box.y` serves the enemy splatter.
- **Rationale**: R-004 is already the generic visual system; a `splatter` vocabulary member duplicated
  it and made new visuals require a union edit. FR-008's real requirement — no per-site anchor
  re-derivation — is met by one helper. A new visual is a new R-004 effect with no vocabulary change.
- **Alternatives considered**: (a) a parameterized `particles` member — rejected by the user: it drags
  R-004's particle generation into R-011; (b) leave the anchor maths duplicated — rejected, FR-008.

## D5 — Every impulse is one `velocity`; `away`/`awayAndUp` become signed x/y

- **Decision**: `velocity { x?, y?, duration?, preserveJump? }`. `x` is signed px/s and also sets
  facing; `y` is px/s; `duration` sets `knockbackTimer`; `preserveJump` sets `bounceAscending`. An
  enemy's `away` is `x = awayDirection * DEFAULT_HIT_KNOCKBACK.vx, duration:
DEFAULT_HIT_KNOCKBACK.duration`; `awayAndUp` adds `y = SLIME_PURPLE_SPIKE_REBOUND_VY,
preserveJump: true`. A stomp/pot/mushroom bounce is `y = its own constant, preserveJump: true`
  (D13).
- **Rationale**: `knockback{basis}`, `push` and `lift` were three names for one mechanic. A signed
  `velocity` expresses all of them and matches the user's "simple direction". `preserveJump` keeps the
  jump-cut protection distinguishable (a generic flag, not a case).
- **Alternatives considered**: `x: number | 'away'` — rejected, still a keyword; a separate `lift`
  member — rejected, same mechanic.

## D6 — Call sites, ordering and storage targets preserved exactly

- **Decision**: spear/enemy/hazard resolve pre-physics against `playerState.value`; the stomp bounce
  applies unguarded to `playerState.value`; block bounce and bomb/pit resolve against `next`
  post-physics. No global latch. `stepPlayerPhysics` stays between them.
- **Rationale**: FR-007 and the user's "the game should just play the same". A pure fold is
  transparent wherever it is called.
- **Alternatives considered**: one post-physics pass — rejected (behaviour change; many tests).

## D7 — One-hit-per-tick, invulnerability and lethality preserved as-is

- **Decision**: callers keep `!isInvulnerable(...)`/`!spearKilled`; `BombSystem` keeps the one-blast
  latch; the spear emits `damage{amount: player.hitPoints}` at an unguarded site (no `lethal` flag).
  The resolver never gates `damage`.
- **Rationale**: "at most one hit per tick" is emergent from the window + ordering; encoding it in the
  resolver would change multi-source ticks. Lethality is just enough damage at a site that skips the
  guard.
- **Alternatives considered**: move the guard into the resolver — rejected (spear bypass + pit
  exception would need arguments).

## D8 — `BombSystem` returns `playerEffects` + `playerSplatter`; no origin params

- **Decision**: `resolveBlasts(blasts, world)` where `world = { level, player, blocks, enemies }`
  returns `{ blocks, terminalBlockIds, enemies, damagedEnemyIds, playerEffects?, playerSplatter?,
explosions }`. The player effect list is built with `damage BOMB_DAMAGE + reaction + velocity`
  (velocity omitted while crouching); `playerSplatter = { side, id: blast.hitEffectId }` only when the
  hit survives. The page anchors the splatter.
- **Rationale**: FR-011/FR-012: consume R-008's blasts, return deltas; visuals are the page's/task's
  job (D4). Removing `originX/originY` from the world keeps the system camera-agnostic.
- **Alternatives considered**: keep the splatter in the effect list — rejected, visuals are not members.

## D9 — Enemy stomp migrates; contact aggregation rules

- **Decision**: `EnemyType.onPlayerCollide` returns `selfEffects` (enemy hit: `damage 1 + reaction`)
  and `effects` (player: the signed `velocity`, plus `damage` for a damaging contact). Enemy kinds use
  `contact.awayDirection`. `resolveEnemyContacts` applies `selfEffects` via `resolveHitEffects`,
  derives `damagedEnemyIds` from `damaged`, and aggregates the player `effects`: **damage = max**;
  **`velocity.x`/`duration` from the first contact achieving the max**; **`velocity.y` = strongest**
  (most negative) across all; `preserveJump` if any contributor sets it; `reaction` when damage > 0.
  It returns `playerEffects`, `knockbackDirection` (for the splatter side) and `damagedEnemyIds`.
  `takeHit`/`applyEnemyDamage` stay as implementations; **no kind imports them**.
- **Rationale**: the 2026-09-27 clarification requires the stomp to migrate. The aggregation
  reproduces today's max-damage / strongest-bounce / first-damaging-direction rules exactly, so the
  `resolveEnemyContacts aggregation` tests still pass.
- **Alternatives considered**: (a) keep `self` — rejected by the clarification; (b) let the engine add
  the velocity without the kind — rejected, the impulse strength is per-kind.

## D10 — Blocks: `damage` = hits; bump `1`, blast `maxHits`; terminal outcome page-side

- **Decision**: the block adapter maps `damage{amount}` to `amount` × `applyBlockHit`, saturating at
  `isBlockUsedUp`. A bump passes `1`; a blast passes `BLOCK_TYPES[kind].maxHits` to reach terminal.
  `BlockType.onHit` keeps its `RewardEffects` and returns its outgoing player impulse as
  `effects: [velocity]`. `resolveBlockTerminalOutcome` stays the page's applier.
- **Rationale**: blocks are not `Damageable` (hits count up, not down), so `damage` is "hits" for
  them; a generic primitive avoids a block-only `hit`/`destroy` member. Reward spawning is a state
  write and stays page-side (FR-009).
- **Alternatives considered**: a block-only member — rejected as a use-case name; folding the terminal
  outcome into the resolver — rejected (FR-009).

## D11 — Structural guard: `engine/hitStructure.test.ts`

- **Decision**: a test-only guard (node `fs`/`path`, like R-015/R-010) fails the suite if: the longhand
  damage shape reappears outside the resolver + `Player.ts`; a kind imports `takeHit`/`applyEnemyDamage`
  or returns `self`; `contracts/Outcome.ts` declares a field vocabulary; the page names bomb internals;
  a forbidden edge exists; or a compatibility re-export appears. It also asserts `HitEffect.ts` holds
  exactly the three primitives and no use-case member.
- **Rationale**: FR-016/SC-001/002/006 must be machine-checked, non-vacuously, `{method}-{condition}-{expected-result}`.
- **Alternatives considered**: rely on R-014 — rejected (unimplemented).

## D12 — Module names, placement and no shims

- **Decision**: `contracts/HitEffect.ts`, `engine/HitResolver.ts`, `engine/BombSystem.ts`,
  `engine/hitStructure.test.ts`; `playerEffectAnchor` beside the `PLAYER_*` constants. The old
  `Impact`/`ImpactEffect` names, the container, and every removed per-site helper are removed, not
  re-exported (FR-018). `engine/Blast.ts`, `entities/deployableItems/Bomb.ts` and
  `DeployableItemType.ts` are unchanged.
- **Rationale**: the analysis's target tree groups generic services under `engine/`; the vocabulary is
  a `contracts/` leaf. No file moves between layers.
- **Alternatives considered**: keep `Impact*` names — rejected, the model no longer has an "Impact".

## D13 — Impulse constants are colocated; `PHYSICS_CONFIG` keeps only movement

- **Decision**: a new `shared/knockback.ts` exports the reusable defaults `DEFAULT_HIT_KNOCKBACK
= { vx: 250, duration: 0.25 }` and `DEFAULT_STOMP_BOUNCE_VY = -330`. Entities that differ colocate
  their own constant: `SLIME_PURPLE_SPIKE_REBOUND_VY = -150` (SlimePurple.ts), `POT_BOUNCE_VY = -220`
  (pot.ts), `MUSHROOM_BOUNCE_VY = -650` (bouncyMushroom.ts). The six impulse fields
  (`stompBounceVelocity`, `sideHitKnockbackVx`, `sideHitKnockbackDuration`, `awayAndUpKnockbackVy`,
  `potBounceVelocity`, `mushroomBounceVelocity`) leave `PHYSICS_CONFIG`, which keeps only general
  movement (gravity, terminalVelocity, walkSpeed, enemyPatrolSpeed, climbSpeed, crouchSpeed,
  jumpVelocity, jumpCutMultiplier).
- **Rationale**: the generic vocabulary made each source build its own `velocity` effect, so the
  source reading a shared config for its own impulse was the leak the user flagged. A kind's tuning
  now travels with the kind (aligning with the analysis's X6/F9 "constants colocated" direction); a
  default remains reusable. Values are unchanged, so behaviour is byte-identical.
- **Alternatives considered**: (a) per-entity constants only, no default — rejected, duplicates the
  shared side-hit values across every enemy/hazard and lets them drift; (b) keep the generic defaults
  in `PHYSICS_CONFIG` — rejected, it stays the catch-all the user objected to.
