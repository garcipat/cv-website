import { PHYSICS_CONFIG } from './PhysicsConfig';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import type { EnemyState } from '../entities/Enemy';

/** How long the `hit` reaction (red-flash/dissolve) plays before the enemy
 *  either reverts to patrolling (hit points remain) or is flagged defeated —
 *  matches Enemy.ts's `hit` animation: 4 frames at 0.1s each. */
export const HIT_REACTION_DURATION_SECONDS = 0.4;

/**
 * Advances one enemy's horizontal patrol by `dt` seconds: moves at a
 * constant `PHYSICS_CONFIG.enemyPatrolSpeed` in its current `direction`,
 * reversing direction (and snapping exactly to the tile boundary, not
 * overshooting into/over the obstacle) whenever the tile one step ahead, at
 * the enemy's own grid row, is either a wall (`isSolid`) or has no solid
 * ground beneath it (a ledge/pit edge) — FR-019's "reverse at platform edges
 * or designated patrol boundaries". Enemies never move vertically; `row` is
 * derived once from `enemy.y` and never changes (a flat patrol row, no
 * gravity — this is a deliberately simple patrol-only AI per spec.md's
 * "Boss enemies or complex enemy AI" non-goal).
 */
export function stepEnemyPatrol(enemy: EnemyState, level: LevelDef, dt: number): EnemyState {
  const speed = PHYSICS_CONFIG.enemyPatrolSpeed;
  const row = Math.round(enemy.y / RENDERED_TILE_SIZE);
  const movingRight = enemy.direction === 'right';
  const nextX = enemy.x + (movingRight ? speed : -speed) * dt;

  const leadingCol = movingRight
    ? Math.floor((nextX + RENDERED_TILE_SIZE - 1) / RENDERED_TILE_SIZE)
    : Math.floor(nextX / RENDERED_TILE_SIZE);

  const wallAhead = isSolid(tileAt(level, leadingCol, row));
  const noGroundAhead = !isSolid(tileAt(level, leadingCol, row + 1));

  if (wallAhead || noGroundAhead) {
    if (movingRight) {
      return {
        ...enemy,
        x: (leadingCol - 1) * RENDERED_TILE_SIZE,
        direction: 'left',
        vx: -speed,
      };
    }
    return {
      ...enemy,
      x: (leadingCol + 1) * RENDERED_TILE_SIZE,
      direction: 'right',
      vx: speed,
    };
  }

  return {
    ...enemy,
    x: nextX,
    vx: movingRight ? speed : -speed,
  };
}

/**
 * Advances an enemy currently playing its stomp `hit` reaction. No-op
 * (returns the same reference) for an enemy still `'walk'`ing — patrol
 * movement is `stepEnemyPatrol`'s job, not this function's; the game loop
 * (PlatformerPage.tsx) picks whichever of the two applies per enemy per
 * tick. Once `HIT_REACTION_DURATION_SECONDS` has elapsed since the stomp
 * (applyStomp reset `hitTimer` to 0), either reverts to `'walk'` (hit points
 * remain — the enemy keeps patrolling) or flags `defeated: true` (no hit
 * points remain — the game loop removes it and fires its reward that same
 * tick). Deliberately does not clamp/zero `vx` on revert: the next
 * `stepEnemyPatrol` call recomputes it from `direction`.
 */
export function stepEnemyHitReaction(enemy: EnemyState, dt: number): EnemyState {
  if (enemy.animState !== 'hit') return enemy;

  const hitTimer = enemy.hitTimer + dt;
  if (hitTimer < HIT_REACTION_DURATION_SECONDS) {
    return { ...enemy, hitTimer };
  }
  if (enemy.hitPoints <= 0) {
    return { ...enemy, hitTimer, defeated: true };
  }
  return { ...enemy, hitTimer: 0, animState: 'walk', animFrame: 0, animTimer: 0 };
}
