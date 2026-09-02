import type { BaseEnemyState } from './EnemyType';
import type { EnemyPlacement } from '../../level/EnemyMapper';
// Imported from EnemyAnimation, NOT from ../Enemy — see this directory's
// import direction: Enemy.ts depends on these modules, never the reverse.
import { walkAnimFrameCount, WALK_FRAME_DURATION } from './EnemyAnimation';

/**
 * Seconds an enemy's post-hit refractory window lasts — the red-flash/
 * dissolve `hit` reaction plays for exactly this long, and the enemy is
 * harmless and untouchable for the whole of it. Matches EnemyAnimation.ts's
 * `hit` animation: 4 frames at 0.1s each. Every current type uses this value
 * through its own `hitReactionSeconds`; a type wanting a longer stun sets a
 * different one there.
 */
export const ENEMY_HIT_REACTION_SECONDS = 0.4;

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
  hitReactionSeconds: number,
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
    // At or past the reaction duration means "no hit is being reacted to",
    // i.e. vulnerable — `isInvulnerable` asks `hitTimer < hitReactionSeconds`.
    // Seeding 0 would make every enemy harmless and unstompable at spawn, so
    // this seeds from the type's own `hitReactionSeconds`, passed in here —
    // never from a shared constant, so a type with a different duration
    // still spawns exactly at its own threshold.
    hitTimer: hitReactionSeconds,
    alive: true,
    rewardGiven: false,
    deathEffectGiven: false,
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
 * the finishing blow. Zeroing `hitTimer` both starts the reaction animation's
 * clock and opens the refractory window `isInvulnerable` reads — they are one
 * window, not two.
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
 *  animation stagger survives a respawn, and resetting `deathEffectGiven`
 *  back to `false` — a revived enemy's next death is a new life's death,
 *  entitled to its own visual effect even if `rewardGiven` (permanent) has
 *  nothing left to add. */
export function baseRevive(
  enemy: BaseEnemyState,
  maxHitPoints: number,
  hitReactionSeconds: number,
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
    // Vulnerable again on revival — see baseEnemyState's note on this seed.
    hitTimer: hitReactionSeconds,
    alive: true,
    deathEffectGiven: false,
  };
}
