# Contract: the movement seam (`entities/enemies/movement/MovementStrategy.ts`)

A **pure, canvas-free, DOM-free** module — mirroring `engine/DeployableLadder.ts`
and `level/Terrain.ts` — so it is fully unit-testable with Vitest (constitution
Principle II; [docs/TestingGuide.md](../../../docs/TestingGuide.md)). It imports
only types; never React, canvas or signals.

## Types

```ts
import type { LevelDef } from '../../../level/LevelData';
import type { BaseEnemyState } from '../EnemyType';

export interface MovementContext {
  level: LevelDef;
  /** Live crate/questionMark/fragileRock cells — same set the patrol step
   *  already receives (see PlatformerPage.tsx). */
  blockedTiles: readonly { col: number; row: number }[];
  /** Player box for proximity strategies; null in headless tests / editor. */
  player: { x: number; y: number; width: number; height: number } | null;
  /** Seconds since level start; freezes with the world on pause/death. */
  elapsed: number;
}

export interface MovementStrategy<S extends BaseEnemyState> {
  readonly kind: 'patrol' | 'fly' | 'chase';
  step(enemy: S, ctx: MovementContext, dt: number): S;
}
```

## Contract every strategy MUST satisfy

1. **Purity.** `step` never mutates `enemy` or `ctx`. It returns a new object,
   or the same reference when nothing changes.
2. **Own state only.** It returns the same state shape `S`; it never adds fields
   it does not own.
3. **Explicit animation.** It sets `animState` to a state the kind declares, so
   rendering follows the kind's own table.
4. **Determinism.** Identical `(enemy, ctx, dt)` always produce an identical
   result — the property that lets a behavior be exercised without a rendered
   game or a frame loop (spec Assumption).
5. **`dt <= 0` is a no-op.** Returns the input state unchanged.
6. **Bounded work.** O(1) per enemy: patrol/fly scan a bounded number of tile
   rows; chase is arithmetic.
7. **No imports from `Enemy.ts` or `ENEMY_TYPES`.** Geometry arrives through the
   strategy's own config (see [patrol.md](./patrol.md)); importing back would
   close the `index.ts -> kind -> movement -> Enemy.ts -> index.ts` load-order
   cycle (research D1).

## Dispatcher

`EnemyType<S>.movement` is required. The shared game loop applies it via
`typeOf(enemy).movement.step(enemy, movementCtx, dt)` and never branches on kind.
Adding a kind that uses an existing strategy is a config choice; adding a new
strategy is a new module plus that kind's config (see
[enemy-kind-extension.md](./enemy-kind-extension.md)).

## Shared horizontal helper

`patrol` and `fly` share one internal helper,
`stepHorizontal({ speed, checkLedges, sprite, hitboxPaddingNative, anchorY })`.
`anchorY` is the world Y whose row the horizontal blocking test anchors on, so
patrol (`anchorY: enemy.y`) and fly (`anchorY: enemy.homeY`) can share the same
reversal/snapping logic despite fly's bob. See [patrol.md](./patrol.md) and
[fly.md](./fly.md).
