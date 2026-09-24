import { typeOf, type EnemyState } from './index';

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
 *
 * Lives with the enemy family (moved here from the removed `engine/EnemyAI.ts`
 * shim) because the kind's own hit reaction is the family's business. Kept in
 * its own module rather than folded into `shared.ts` so `index.ts` (which
 * every kind module imports transitively) never gains a back-edge to a module
 * that imports it — avoiding an initialisation cycle.
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
