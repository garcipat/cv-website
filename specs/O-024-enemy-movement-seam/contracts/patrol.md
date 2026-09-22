# Contract: `movement/patrol.ts` (`kind: 'patrol'`)

The existing ground behavior, extracted **verbatim** from today's
`stepEnemyPatrol` (`engine/EnemyAI.ts`). This is a move, not a rewrite — the
reason the slimes' results can be asserted bit-for-bit (SC-001).

## Factory

```ts
export interface PatrolMovementConfig {
  /** Multiplier on PHYSICS_CONFIG.enemyPatrolSpeed (60 px/s). Green 1, purple 0.7. */
  speedMultiplier: number;
  /** The kind's own descriptor — size/offsets derive from it (no Enemy.ts import). */
  sprite: SpriteDescriptor;
  hitboxPaddingNative: { side: number; top: number; bottom: number };
  /** State set while patrolling; defaults to 'walk'. */
  animState?: string;
}

export function patrolMovement<S extends BaseEnemyState>(
  config: PatrolMovementConfig,
): MovementStrategy<S>;
```

## Behavior (unchanged)

Speed is `PHYSICS_CONFIG.enemyPatrolSpeed * config.speedMultiplier`. Movement is
horizontal only; the patrol row is derived once from `enemy.y` and never
changes. Patrol and fly share one `stepHorizontal({ speed, checkLedges, sprite,
hitboxPaddingNative, anchorY })` helper: patrol passes `anchorY: enemy.y` and
`checkLedges: true`, fly passes `anchorY: enemy.homeY` and `checkLedges: false`
(see [fly.md](./fly.md), research D9).

- **Leading edge**: the turn test uses the sprite's *visible* edge — the render
  frame inset by `hitboxPaddingNative.side * RENDER_SCALE * sprite.renderScale`
  — not the tile-anchor `x` and not the full transparent frame.
- **Wall ahead**: for the tile column the leading edge is about to enter, checked
  at every row the silhouette spans (`ceil((size - topPadding) / RENDERED_TILE_SIZE)`
  rows upward from the anchor row), a tile blocks when it is static solid, is
  `'patrol'`, or is in `ctx.blockedTiles`.
- **Ledge ahead**: testing the anchor row alone, `!isSolid(tileAt(level, col, row + 1))`
  and that cell is not in `ctx.blockedTiles` — a patrolling enemy never walks off
  a platform edge.
- **Turning**: not blocked → move to `nextX`, `vx` from direction. Blocked →
  snap so the visible leading edge exactly touches the obstacle, then re-run in
  the reversed direction. If the reversal is also blocked, stand still
  (`vx: 0`, direction unchanged) rather than flipping every frame.
- `animState` is set to `config.animState ?? 'walk'`.

## Invariants (asserted by `movement/patrol.test.ts`)

1. Open floor, moving right/left: `x` advances by `±speed * dt`, direction and
   `vx` preserved.
2. Wall ahead: reverses and clamps so the visible edge touches the wall — same
   concrete values as the pre-seam tests (`x = 194` right / `126` left in the
   shared fixture geometry).
3. `patrol` tile ahead: reverses and clamps exactly like a wall.
4. Pit ahead: reverses at the edge instead of falling.
5. A live blocked cell fills the gap / sits at the enemy row: treated as solid.
6. Narrow lane on both sides: stands still, stable across repeated calls.
7. A purple slime (renderScale 2, `speedMultiplier: 0.7`) moves at `0.7x` a
   green slime's delta.
8. Mushroom tiles are neither walls nor ground.

## Compatibility entry point

`engine/EnemyAI.ts` retains `stepEnemyPatrol(enemy, level, dt, blockedTiles)`
with its exact old signature, implemented as a thin adapter that builds a
`MovementContext` (`player: null`, `elapsed: 0`) and delegates to
`typeOf(enemy).movement.step(...)`. Its only purpose is to let the pre-seam
characterization in `engine/EnemyAI.test.ts` pass **unedited** (SC-001); the game
loop no longer calls it (research D2).
