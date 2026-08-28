import { PHYSICS_CONFIG } from './PhysicsConfig';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import type { EnemyState } from '../entities/Enemy';

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
