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
    alive: true,
    rewardGiven: false,
  };
}

/**
 * Applies one hit: decrements `hitPoints`, freezes horizontal movement, and
 * enters the `hit` reaction (red-flash/dissolve) animation from its first
 * frame. This function itself doesn't gate re-entry — calling it twice in a
 * row always applies a second hit — the decision of whether a given contact
 * counts as a legal stomp lives in the type module's `onPlayerCollide`, which
 * runs before this is ever called, and any consequence of the enemy
 * surviving the hit (SlimePurple.ts's temporary un-stompable defense, for
 * one) is also that module's own business to layer on afterward. Does NOT
 * decide defeat here — EnemyAI.ts's `stepEnemyHitReaction` checks
 * `hitPoints` once the reaction animation finishes playing, so the player
 * always sees the same brief "stunned" reaction whether or not this hit was
 * the finishing blow.
 */
export function takeHit<S extends BaseEnemyState>(enemy: S): S {
  const hitPoints = enemy.hitPoints - 1;
  return {
    ...enemy,
    hitPoints,
    vx: 0,
    animState: 'hit',
    animFrame: 0,
    animTimer: 0,
    hitTimer: 0,
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
    alive: true,
  };
}
