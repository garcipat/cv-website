import { RENDERED_TILE_SIZE } from '../../../level/Terrain';
import type { BaseEnemyState } from '../EnemyType';
import type { MovementStrategy } from './MovementStrategy';

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

/**
 * A proximity-reactive pursuit behavior. It ships tested but is used by **no
 * registered enemy kind** (FR-016) — its value is proving the seam supports a
 * behavior that reads the character's position, without shipping one.
 *
 * Distance is measured between the enemy's tile centre and the player box's
 * centre. `ctx.player === null` (headless tests / the editor preview) or a
 * distance beyond `detectRange` idles the enemy (`vx = vy = 0`, direction
 * unchanged, `idleAnimState`); otherwise it moves `speed * dt` along the
 * normalized 2D offset, faces the player horizontally and shows
 * `activeAnimState`.
 */
export function chaseMovement<S extends BaseEnemyState>(
  config: ChaseMovementConfig,
): MovementStrategy<S> {
  return {
    kind: 'chase',
    step: (enemy, ctx, dt) => {
      if (dt <= 0) return enemy;

      const player = ctx.player;
      if (player === null) {
        return { ...enemy, vx: 0, vy: 0, animState: config.idleAnimState };
      }

      const enemyCentreX = enemy.x + RENDERED_TILE_SIZE / 2;
      const enemyCentreY = enemy.y + RENDERED_TILE_SIZE / 2;
      const dx = player.x + player.width / 2 - enemyCentreX;
      const dy = player.y + player.height / 2 - enemyCentreY;
      const distance = Math.hypot(dx, dy);

      if (distance > config.detectRange) {
        return { ...enemy, vx: 0, vy: 0, animState: config.idleAnimState };
      }

      if (distance === 0) {
        return { ...enemy, vx: 0, vy: 0, animState: config.activeAnimState };
      }

      const stepDistance = config.speed * dt;
      const moveX = (dx / distance) * stepDistance;
      const moveY = (dy / distance) * stepDistance;
      const direction = dx > 0 ? 'right' : dx < 0 ? 'left' : enemy.direction;
      return {
        ...enemy,
        x: enemy.x + moveX,
        y: enemy.y + moveY,
        vx: moveX / dt,
        vy: moveY / dt,
        direction,
        animState: config.activeAnimState,
      };
    },
  };
}
