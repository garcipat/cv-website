# Contract — Hit Resolver

**Feature**: `R-011-platformer-player-damage-bombs` | **Spec**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

Normative form of spec FR-003…FR-009 and data-model §3. Module: `src/themes/platformer/engine/HitResolver.ts`
(NEW) — an `engine/` module (no `state/` import).

---

## 1. Entry point

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

One exported name; three typed overloads; three non-exported adapters. No `ctx` parameter — the
resolver returns state only and never builds a visual.

## 2. Folding rule

Initialise an accumulator to the input target; for each member in array order apply the family
mapping (data-model §3) to the accumulator; skip members the family cannot use. Return the
accumulator (plus `damaged`/`outcome` where the family needs it). Pure; no exceptions for a
well-formed list.

## 3. Player adapter

- `damage`: `hitPoints = takeDamage(hitPoints, amount)`; `alive = hitPoints > 0`. (The spear passes
  `amount: current hitPoints` at an unguarded site, which kills; there is no `lethal` flag.)
- `reaction`: `blinkOnly ? beginPitFallReaction(player) : applyHitReaction(player)`.
- `velocity`: apply each present field — `x` ⇒ `vx = x` and `direction = x < 0 ? 'left' : 'right'`;
  `y` ⇒ `vy = y`; `duration` ⇒ `knockbackTimer = duration`; `preserveJump` ⇒ `bounceAscending = true`.
- The adapter does **not** consult invulnerability — callers keep their guards (spec FR-006/D7).

## 4. Enemy adapter

- `damage`: one `takeHit` per point then the type's `onDamaged(next, amount)` when `amount > 0`;
  `damaged = next.hitPoints < enemy.hitPoints`.
- `reaction`: no-op — `takeHit` already enters the reaction.
- `velocity`: ignored.

## 5. Block adapter

- `damage`: `amount` × `applyBlockHit`, stopping early at `isBlockUsedUp` (a blast passes the kind's
  `maxHits` to drive to terminal; a bump passes `1`).
- Returns `outcome = BLOCK_TYPES[next.blockKind].onHit?.(next) ?? {}` for the page's terminal applier.
- The adapter does not run `resolveBlockTerminalOutcome` (FR-009); the page does.

## 6. Invariants

1. No signal read/write, no canvas, no `state/` import (FR-014).
2. `damage` + `reaction` on an enemy compose to exactly `takeHit`'s output.
3. The player `velocity` writes equal today's `applyHitReaction` / `bounceAscending` writes.
4. The resolver returns state, never a `TransientEffect`.
5. The resolver never gates on invulnerability or a per-tick latch; callers preserve those.
6. No compatibility alias re-exports a removed per-site helper (FR-018).

## 7. Guard checks

`engine/hitStructure.test.ts` asserts: `resolveHitEffects` is the only exported resolver entry; no
`takeDamage`/`applyHitReaction`/`beginPitFallReaction`/`hitPoints, alive` construction exists outside
the resolver + `entities/Player.ts`; `engine/HitResolver.ts` imports no `state/` module.
