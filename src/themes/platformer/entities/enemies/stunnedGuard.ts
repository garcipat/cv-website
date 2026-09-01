import type { BaseEnemyState } from './EnemyType';

/**
 * True while an enemy is playing its hit reaction, during which it is harmless
 * in every way — not merely immune to a second stomp. Without this, bouncing
 * off a stomp while still overlapping the now-frozen enemy registers as a
 * spurious side-hit against the very enemy just stomped.
 *
 * A shared helper that type modules compose rather than an engine-level rule,
 * so a future enemy that IS dangerous while stunned simply doesn't call it —
 * no opt-out flag has to leak into the shared interface.
 */
export function isStunned(enemy: BaseEnemyState): boolean {
  return enemy.animState === 'hit';
}
