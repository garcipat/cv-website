import type { LevelDef } from '../level/LevelData';
import type { EnemyState } from '../entities/Enemy';
import { typeOf } from '../entities/enemies';
import type { CrumblingFloorTimerState } from './CrumblingFloor';

/**
 * Advances one enemy's movement by `dt` seconds — a thin compatibility
 * wrapper around the kind's own movement strategy (`typeOf(enemy).movement`),
 * kept with its exact old signature so the pre-seam patrol characterization
 * in `engine/EnemyAI.test.ts` keeps passing unedited (SC-001).
 *
 * The shared game loop (PlatformerPage.tsx) no longer calls this; it applies
 * `typeOf(enemy).movement.step(...)` directly with a full `MovementContext`.
 * This wrapper exists only so that characterization — which predates the
 * movement seam and passes no player/elapsed clock — has an entry point. It
 * builds a context with `player: null` and `elapsed: 0`, which is all the
 * patrol strategy needs. The wrapper can be deleted once that test is
 * migrated.
 */
export function stepEnemyPatrol(
  enemy: EnemyState,
  level: LevelDef,
  dt: number,
  blockedTiles: readonly { col: number; row: number }[],
  crumblingFloorStates?: readonly CrumblingFloorTimerState[],
): EnemyState {
  return typeOf(enemy).movement.step(
    enemy,
    { level, blockedTiles, player: null, elapsed: 0, crumblingFloorStates },
    dt,
  );
}

/**
 * Advances an enemy currently playing its stomp `hit` reaction. No-op
 * (returns the same reference) for an enemy not in its `'hit'` state —
 * movement is the kind's own strategy's job, not this function's; the game
 * loop (PlatformerPage.tsx) picks whichever applies per enemy per tick. Once
 * this type's own `hitReactionSeconds` has elapsed since the stomp (`takeHit`
 * reset `hitTimer` to 0), either reverts to the kind's own
 * `defaultAnimState` (hit points remain — the enemy keeps moving by its own
 * rule) or flags the enemy dead in place (no hit points remain — the game
 * loop fires its reward that same tick and leaves it in the array).
 * Deliberately does not clamp/zero `vx` on revert: the next movement step
 * recomputes it from `direction`.
 *
 * `hitTimer` is left at its accumulated value on revert rather than reset to
 * 0: the same timer answers "is this enemy still untouchable?" through
 * `isInvulnerable`, and a reset would read as a fresh hit that never
 * happened, leaving a patrolling enemy permanently harmless.
 */
export function stepEnemyHitReaction(enemy: EnemyState, dt: number): EnemyState {
  if (enemy.animState !== 'hit') return enemy;

  const type = typeOf(enemy);
  const hitTimer = enemy.hitTimer + dt;
  if (hitTimer < type.hitReactionSeconds) {
    return { ...enemy, hitTimer };
  }
  if (enemy.hitPoints <= 0) {
    return { ...enemy, hitTimer, alive: false };
  }
  return { ...enemy, hitTimer, animState: type.defaultAnimState, animFrame: 0, animTimer: 0 };
}
