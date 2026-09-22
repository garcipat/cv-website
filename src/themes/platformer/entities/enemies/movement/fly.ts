import type { BaseEnemyState } from '../EnemyType';
import type { SpriteDescriptor } from '../../sprites/SpriteSheet';
import type { MovementStrategy } from './MovementStrategy';
import { stepHorizontal, type HitboxPaddingNative } from './patrol';

export interface FlyMovementConfig {
  /** Absolute horizontal speed, px/s. */
  speed: number;
  /** Maximum vertical deviation from homeY, px. */
  bobAmplitude: number;
  /** Seconds for one full bob cycle. */
  bobPeriod: number;
  sprite: SpriteDescriptor;
  hitboxPaddingNative: HitboxPaddingNative;
  /** State set while flying; defaults to 'fly'. */
  animState?: string;
}

/**
 * The bee's behavior: horizontal patrol with **no ledge check** plus a
 * vertical bob around the placement row (FR-004/FR-005/FR-006).
 *
 * Horizontal — identical to patrol's horizontal half except the ledge test is
 * skipped, so a bee crosses a gap a slime would reverse at. It shares
 * `stepHorizontal` with patrol, anchoring the blocking test on
 * `enemy.homeY` (the placement row) rather than the bobbed `y`, so the bob
 * never changes which tiles block it (research D9).
 *
 * Vertical — a pure function of the shared clock:
 *   `y  = homeY + bobAmplitude * sin(2π * elapsed / bobPeriod)`
 *   `vy = bobAmplitude * (2π / bobPeriod) * cos(2π * elapsed / bobPeriod)`
 * so at `elapsed = 0` and every whole period `y = homeY` exactly, and
 * `|y - homeY| <= bobAmplitude` always (FR-006/SC-003).
 */
export function flyMovement<S extends BaseEnemyState>(
  config: FlyMovementConfig,
): MovementStrategy<S> {
  const animState = config.animState ?? 'fly';
  const angularFrequency = (2 * Math.PI) / config.bobPeriod;
  return {
    kind: 'fly',
    step: (enemy, ctx, dt) => {
      if (dt <= 0) return enemy;
      const { x, direction, vx } = stepHorizontal({
        x: enemy.x,
        direction: enemy.direction,
        speed: config.speed,
        checkLedges: false,
        sprite: config.sprite,
        hitboxPaddingNative: config.hitboxPaddingNative,
        anchorY: enemy.homeY,
        level: ctx.level,
        blockedTiles: ctx.blockedTiles,
        dt,
        crumblingFloorStates: ctx.crumblingFloorStates,
      });
      const phase = angularFrequency * ctx.elapsed;
      const y = enemy.homeY + config.bobAmplitude * Math.sin(phase);
      const vy = config.bobAmplitude * angularFrequency * Math.cos(phase);
      return { ...enemy, x, y, vy, direction, vx, animState };
    },
  };
}
