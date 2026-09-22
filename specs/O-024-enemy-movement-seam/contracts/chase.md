# Contract: `movement/chase.ts` (`kind: 'chase'`)

A proximity-reactive pursuit behavior. It **ships tested but is used by no
registered enemy kind** (FR-016, spec Out of Scope) — its value is proving the
seam supports a behavior that reads the character's position, without shipping
one.

## Factory

```ts
export interface ChaseMovementConfig {
  /** Pursuit speed, px/s. */
  speed: number;
  /** Distance (px) within which the enemy pursues. */
  detectRange: number;
  /** State shown while pursuing. */
  activeAnimState: string;
  /** State shown while idle. */
  idleAnimState: string;
}

export function chaseMovement<S extends BaseEnemyState>(
  config: ChaseMovementConfig,
): MovementStrategy<S>;
```

## Behavior

Let `player = ctx.player`. Distance is measured between the enemy's centre and
the player's centre.

- **Idle** when `player === null` or distance > `detectRange`:
  `vx = 0`, `vy = 0`, `animState = idleAnimState`; direction unchanged. This is
  the headless-tests / editor-preview case and MUST NOT fail (spec edge case).
- **Pursue** when `player !== null` and distance <= `detectRange`:
  move toward the player by `speed * dt` along the normalized 2D offset, set
  `direction` from the horizontal sign of that offset, and set
  `animState = activeAnimState`.
- `dt <= 0` is a no-op.

## Invariants (asserted by `movement/chase.test.ts`)

1. `ctx.player === null` → idle (`vx === 0 && vy === 0`, `idleAnimState`).
2. Player out of range → idle.
3. Player in range → the enemy's distance to the player **decreases** by at
   most `speed * dt` per step and its `direction` faces the player.
4. Deterministic and non-mutating, like every strategy
   ([movement-strategy.md](./movement-strategy.md)).

## Use

`entities/enemies/movement/contract.test.ts` wires this strategy into a
**fixture `EnemyType`** (its own movement + animation, not registered) and drives
it through the shared step pipeline, satisfying the seam's end-to-end proof
(SC-005) without shipping a chaser.
