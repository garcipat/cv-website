# Phase 1 Data Model — R-011 Platformer Player Damage & Bomb Systems

**Feature**: `R-011-platformer-player-damage-bombs` | **Date**: 2026-09-29

R-011 is a refactor: **no persisted data changes.** Levels, blueprints, `localStorage` keys, sprites
and translations are untouched. The only tuning change is ownership, not values: the per-entity hit
impulses move out of `PHYSICS_CONFIG` into `shared/knockback.ts` defaults plus per-entity overrides
(§6). This document describes the new in-code types/shapes the refactor introduces and the per-family
mappings they must satisfy. Exact signatures live in the [contracts](./contracts/); this is the model
view.

---

## 1. The generic hit-effect vocabulary — `contracts/HitEffect.ts` (NEW, leaf)

```ts
/** One generic mechanic a hit applies to a target. Primitives, never use-cases. */
export type HitEffect =
  // Reduce health. For a block, `amount` is a hit count (saturating at used-up).
  | { readonly type: 'damage'; readonly amount: number }
  // A velocity impulse. `x` is signed (px/s) and also sets facing; `y` is px/s
  // (negative = up); `duration` overrides input (knockbackTimer);
  // `preserveJump` applies bounceAscending so the jump-cut can't shear it.
  | {
      readonly type: 'velocity';
      readonly x?: number;
      readonly y?: number;
      readonly duration?: number;
      readonly preserveJump?: boolean;
    }
  // Enter the family's post-hit state. `blinkOnly` is the window-only pit
  // reaction (no red flash, velocity/facing untouched); otherwise the red `hit`.
  | { readonly type: 'reaction'; readonly blinkOnly?: boolean };
```

There is **no `Impact` container** and **no `ImpactSource`** — a hit is simply
`readonly HitEffect[]`. Visuals are **not** members (they live in R-004, §6).

| Principle           | Rule                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Primitive, not case | Members name mechanics (`damage`/`velocity`/`reaction`), never a use-case (`awayAndUp`, `splatterVariant`, `hit`/`destroy`, `lethal`). |
| Independence        | A list may be damage-only, velocity-only, reaction-only, or any subset; the array order is the application order.                      |
| Immutability        | Every member is `readonly`; the resolver never mutates input.                                                                          |
| Leaf safety         | The module imports only sibling `contracts/` types (currently nothing) — never `engine/`/`entities/`.                                  |

### Impulse constant ownership (research D13)

The concrete velocities a source puts in a `velocity` member come from constants colocated with that
source, not `PHYSICS_CONFIG`: `shared/knockback.ts` holds the reusable `DEFAULT_HIT_KNOCKBACK` and
`DEFAULT_STOMP_BOUNCE_VY`; `SlimePurple.ts` / `pot.ts` / `bouncyMushroom.ts` each own their overriding
constant. `PHYSICS_CONFIG` keeps only general movement physics. Values are unchanged.

## 2. Kind-facing vocabulary — `contracts/Outcome.ts` (MODIFIED)

```ts
export interface PlayerEffects {
  readonly effects?: readonly HitEffect[];
}
export interface CollisionOutcome extends PlayerEffects {
  readonly selfEffects?: readonly HitEffect[]; // enemy-side hit (a stomp)
}
export type BlockHitOutcome = PlayerEffects & RewardEffects;
```

`RewardEffects` and `DefeatApi` are unchanged. `CollisionOutcome` is no longer generic: with the
replacement-state field gone there is nothing entity-typed (the unused type parameter is rejected by
strict TS); `EnemyType<S>` still carries the concrete state. `Contact` gains one generic geometric
fact, `awayDirection: -1 | 1` (the engine's player-centre-vs-self-centre sign), so a kind can build a
concrete signed `velocity.x` without naming an `away`/`awayAndUp` case.

### Field → primitive migration

| Old field                | New primitive(s)                                                                                                      | Where                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `damagePlayer: n`        | `{ type: 'damage', amount: n }`                                                                                       | `CollisionOutcome.effects`                             |
| `knockback: 'away'`      | `{ type: 'velocity', x: contact.awayDirection * DEFAULT_HIT_KNOCKBACK.vx, duration: DEFAULT_HIT_KNOCKBACK.duration }` | `CollisionOutcome.effects`                             |
| `knockback: 'awayAndUp'` | the same plus `y: SLIME_PURPLE_SPIKE_REBOUND_VY, preserveJump: true`                                                  | `CollisionOutcome.effects`                             |
| `bounceVelocity: v`      | `{ type: 'velocity', y: v, preserveJump: true }`                                                                      | `CollisionOutcome.effects` / `BlockHitOutcome.effects` |
| `self: takeHit(enemy)`   | `selfEffects: [{ damage 1 }, { reaction }]`                                                                           | `CollisionOutcome.selfEffects`                         |

**Invariant**: exactly one declaration of each primitive; no kind returns a raw
`damagePlayer`/`knockback`/`bounceVelocity`/`self` (guard-checked, §8).

## 3. The resolver — `engine/HitResolver.ts` (NEW)

```ts
export interface PlayerHitResult {
  readonly player: PlayerState;
}
export interface EnemyHitResult {
  readonly enemy: EnemyState;
  readonly damaged: boolean;
}
export interface BlockHitResult {
  readonly block: BlockState;
  readonly outcome: BlockHitOutcome;
}

export function resolveHitEffects(
  target: PlayerState,
  effects: readonly HitEffect[],
): PlayerHitResult;
export function resolveHitEffects(
  target: EnemyState,
  effects: readonly HitEffect[],
): EnemyHitResult;
export function resolveHitEffects(
  target: BlockState,
  effects: readonly HitEffect[],
): BlockHitResult;
```

One exported name; three typed overloads; three non-exported adapters; no `ctx` (it returns state,
never visuals).

### Per-family member semantics

| Member     | Player adapter                                                                                                                                                                                           | Enemy adapter                                                           | Block adapter                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| `damage`   | `hitPoints = takeDamage(hitPoints, amount)`; `alive = hitPoints > 0` (the spear passes `amount: hitPoints`, which kills)                                                                                 | one `takeHit` per point, then `onDamaged`; `damaged` = points decreased | `amount` × `applyBlockHit`, saturating at `isBlockUsedUp` |
| `velocity` | `x !== undefined` ⇒ `vx = x` and `direction = x < 0 ? 'left' : 'right'`; `y !== undefined` ⇒ `vy = y`; `duration !== undefined` ⇒ `knockbackTimer = duration`; `preserveJump` ⇒ `bounceAscending = true` | ignored                                                                 | ignored                                                   |
| `reaction` | `blinkOnly ? beginPitFallReaction : applyHitReaction`                                                                                                                                                    | no-op (already entered by `takeHit`)                                    | ignored                                                   |

**Invariants**: pure (no signals, no canvas); the caller applies the result. The resolver does **not**
gate `damage` on invulnerability; callers keep their existing guards (D7). Members a family cannot use
are ignored without aborting the rest.

## 4. `BombSystem` — `engine/BombSystem.ts` (MODIFIED)

```ts
export interface BlastWorld {
  readonly level: LevelDef;
  readonly player: PlayerState;
  readonly blocks: readonly BlockState[];
  readonly enemies: readonly EnemyState[];
}

export interface BlastDelta {
  readonly blocks: readonly BlockState[]; // post-destruction
  readonly terminalBlockIds: readonly string[]; // blocks that reached terminal
  readonly enemies: readonly EnemyState[]; // post-hit
  readonly damagedEnemyIds: readonly string[];
  readonly playerEffects?: readonly HitEffect[]; // damage + reaction + (velocity unless crouched)
  readonly playerSplatter?: { readonly side: -1 | 0 | 1; readonly id: string }; // only if the hit survives
  readonly explosions: readonly { id: string; x: number; y: number }[];
}

export function resolveBlasts(blasts: readonly BlastRequest[], world: BlastWorld): BlastDelta;
```

Blocks are driven to terminal by `resolveHitEffects(block, [{ damage, amount: BLOCK_TYPES[kind].maxHits }])`.
The enemy hit is `[{ damage: BOMB_DAMAGE }, { reaction }]`. The player's effect list is the same plus
a `velocity` (omitted while crouching). The player splatter `side` is `knockbackDirection === 1 ? -1 : 1`
and its id is `blast.hitEffectId`; it is returned only when the hit survives (`hitPoints > BOMB_DAMAGE`).
`originX`/`originY` are no longer needed by `BombSystem` (the page anchors the splatter, §6).

**Invariants**: consumes `BlastRequest[]`, never re-owns fuse/detonation (FR-012); writes no signal
(FR-014); one player effect list per tick; explosion once per blast.

## 5. Per-source effect lists (behaviour parity)

Full table in [contracts/migration-matrix.md](./contracts/migration-matrix.md). Summary:

| Source                                    | Ordered effects                                                                          | Target / timing                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Lethal spear                              | `damage{amount: hitPoints}`                                                              | `playerState.value`, pre-physics; feet blood via R-004; suppresses enemy/hazard |
| Enemy contact (side)                      | `damage{n}`, `reaction`, `velocity{x: ±250, duration}`                                   | `playerState.value`, pre-physics                                                |
| Enemy contact (spiked top)                | the above plus `velocity.y = -150, preserveJump: true`                                   | same                                                                            |
| Enemy contact (crouched)                  | `damage{n}`, `reaction` (no velocity)                                                    | same                                                                            |
| Enemy stomp (player side)                 | `velocity{y: -330, preserveJump: true}`                                                  | `playerState.value`, pre-physics, unguarded                                     |
| Ordinary hazard (knocks back)             | `damage{n}`, `reaction`, `velocity{x: away-from-hazard, duration}`                       | same                                                                            |
| Ordinary hazard (no knockback / crouched) | `damage{n}`, `reaction`                                                                  | same                                                                            |
| Bomb blast                                | `damage{2}`, `reaction`, `velocity{x: away-from-centre, duration}` (omitted if crouched) | `next`, post-physics; one per tick                                              |
| Pit fall                                  | `damage{1}`, `reaction{blinkOnly}`                                                       | `next`, post-physics; recovery always runs                                      |
| Block bump / blast                        | `damage{1}` / `damage{maxHits}`                                                          | block, via the block adapter                                                    |
| Enemy stomp (enemy side)                  | `selfEffects: [damage{1}, reaction]`                                                     | enemy, via the enemy adapter                                                    |

**Invariant**: each row's produced player/enemy/block state equals the pre-refactor result (SC-005).

## 6. Visual effects (R-004, consumed unchanged)

Visuals are **not** in the effect list; each source spawns them via the existing registry.

| Visual      | Factory                   | Anchor                                                   | id                                               |
| ----------- | ------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| player hit  | `startPlayerHitSplatter`  | `playerEffectAnchor(player, originX, originY, 'center')` | `player-${effectCount(…)}` / `blast.hitEffectId` |
| spear blood | `startSpearBloodSplatter` | `playerEffectAnchor(player, originX, originY, 'feet')`   | `spear-${effectCount(…)}`                        |
| enemy hit   | `startEnemyHitSplatter`   | `enemyEffectAnchor(enemy)` + `box.y` (existing)          | `${enemyId}-${effectCount(…)}`                   |
| explosion   | `startExplosionEffect`    | blast centre                                             | `blast.effectId`                                 |

`playerEffectAnchor(player, originX, originY, anchor: 'center' | 'feet')` is the ONE helper for the
player's centre/feet anchor (living beside the `PLAYER_*` constants); no site re-derives it. Splatter
factories, colours, lifetimes and the `'hitSplatter'`/`'explosion'` registry entries are unchanged.

## 7. Layer placement (FR-014)

| Module                   | Layer             | Notes                                                                |
| ------------------------ | ----------------- | -------------------------------------------------------------------- |
| `contracts/HitEffect.ts` | `contracts/` leaf | imports sibling `contracts/` only                                    |
| `engine/HitResolver.ts`  | `engine/`         | imports `contracts/`, `entities/`, `engine/` — no `state/`           |
| `engine/BombSystem.ts`   | `engine/`         | imports `contracts/`, `level/`, `entities/`, `engine/` — no `state/` |

## 8. Guard-test model (FR-016)

`engine/hitStructure.test.ts` machine-checks [contracts/layer-invariants.md](./contracts/layer-invariants.md)
SI-1…SI-7: one vocabulary of exactly the three primitives; one `resolveHitEffects` entry; no longhand
damage shape; no kind-level `takeHit`/`applyEnemyDamage`/`self`; no bomb internals in the page; no
forbidden edge; no compatibility re-export. It fails the suite on any regression (SC-001/002/006).
