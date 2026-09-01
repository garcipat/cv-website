import type { BaseEnemyState } from './EnemyType';
import type { EnemyPlacement } from '../../level/EnemyMapper';
// Imported from EnemyAnimation, NOT from ../Enemy — see this directory's
// import direction: Enemy.ts depends on these modules, never the reverse.
import { walkAnimFrameCount, WALK_FRAME_DURATION } from './EnemyAnimation';

/**
 * The fields every enemy starts with. `index` offsets the starting walk frame
 * and timer so multiple enemies don't animate in perfect lockstep — each
 * enemy's frame advance is driven by its own dt-accumulated timer, not a
 * shared clock, so identical starts stay identical forever.
 */
export function baseEnemyState(
  placement: EnemyPlacement,
  index: number,
  maxHitPoints: number,
): Omit<BaseEnemyState, 'type'> {
  return {
    ...placement,
    homeX: placement.x,
    homeY: placement.y,
    vx: 0,
    vy: 0,
    direction: 'right',
    animState: 'walk',
    animFrame: index % walkAnimFrameCount(),
    animTimer: (index * 0.05) % WALK_FRAME_DURATION,
    hitPoints: maxHitPoints,
    hitTimer: 0,
    spiked: false,
    spikeTimer: 0,
    alive: true,
    rewardGiven: false,
  };
}

/** Resets an enemy to its spawn state, preserving `rewardGiven` — an enemy
 *  that already paid out revives as a normal killable obstacle with nothing
 *  left to give — and preserving `animFrame`/`animTimer` so the per-enemy
 *  animation stagger survives a respawn. */
export function baseRevive(
  enemy: BaseEnemyState,
  maxHitPoints: number,
): Omit<BaseEnemyState, 'type'> {
  return {
    ...enemy,
    x: enemy.homeX,
    y: enemy.homeY,
    vx: 0,
    vy: 0,
    direction: 'right',
    animState: 'walk',
    hitPoints: maxHitPoints,
    hitTimer: 0,
    spiked: false,
    spikeTimer: 0,
    alive: true,
  };
}
