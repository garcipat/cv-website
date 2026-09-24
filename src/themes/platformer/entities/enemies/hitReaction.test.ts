import { describe, it, expect } from 'vitest';
import { stepEnemyHitReaction } from './hitReaction';
import { ENEMY_HIT_REACTION_SECONDS } from './shared';
import { ENEMY_TYPES } from './index';
import type { EnemyState } from './index';
import type { EnemyPlacement } from '../../level/EnemyMapper';

function makeGreenPlacement(): EnemyPlacement {
  return { id: 'enemy-cert-x', type: 'slimeGreen', x: 320, y: 96 };
}

function makeHitEnemy(hitPoints: number): EnemyState {
  return {
    ...ENEMY_TYPES.slimeGreen.create(makeGreenPlacement(), 0),
    animState: 'hit',
    hitPoints,
    hitTimer: 0,
  };
}

// Relocated from the removed engine/EnemyAI.test.ts — the enemy family owns
// its own hit reaction, so its coverage lives beside it.
describe('stepEnemyHitReaction', () => {
  it('walkState-isUnaffected-returnsSameReference', () => {
    const enemy = ENEMY_TYPES.slimeGreen.create(makeGreenPlacement(), 0);
    const next = stepEnemyHitReaction(enemy, 1 / 30);
    expect(next).toBe(enemy);
  });

  it('midReaction-accumulatesHitTimerAndStaysInHitState', () => {
    const enemy = makeHitEnemy(0);
    const next = stepEnemyHitReaction(enemy, 0.1);
    expect(next.animState).toBe('hit');
    expect(next.hitTimer).toBeCloseTo(0.1);
    expect(next.alive).toBe(true);
  });

  it('reactionDurationElapsed-hitPointsRemaining-revertsToWalk', () => {
    const enemy = makeHitEnemy(1);
    const next = stepEnemyHitReaction(enemy, ENEMY_HIT_REACTION_SECONDS);
    expect(next.animState).toBe('walk');
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
    // Left at its accumulated value, not reset: the same timer is what
    // `isInvulnerable` reads, and a reset would leave the reverted enemy
    // permanently untouchable.
    expect(next.hitTimer).toBeGreaterThanOrEqual(ENEMY_HIT_REACTION_SECONDS);
    expect(next.alive).toBe(true);
  });

  it('reactionDurationElapsed-noHitPointsRemaining-flagsDefeated', () => {
    const enemy = makeHitEnemy(0);
    const next = stepEnemyHitReaction(enemy, ENEMY_HIT_REACTION_SECONDS);
    expect(next.alive).toBe(false);
    expect(next.animState).toBe('hit'); // stays on its last frame until removed
  });

  it('reactionDuration-splitAcrossTwoTicks-stillCompletesCorrectly', () => {
    let enemy = makeHitEnemy(0);
    enemy = stepEnemyHitReaction(enemy, ENEMY_HIT_REACTION_SECONDS / 2);
    expect(enemy.alive).toBe(true);
    enemy = stepEnemyHitReaction(enemy, ENEMY_HIT_REACTION_SECONDS / 2);
    expect(enemy.alive).toBe(false);
  });

  it('reactionFinishedWithNoHitPoints-flagsNotAlive', () => {
    const enemy = makeHitEnemy(0);
    const stepped = stepEnemyHitReaction(enemy, ENEMY_HIT_REACTION_SECONDS);
    expect(stepped.alive).toBe(false);
  });

  it('reactionFinishedWithHitPointsRemaining-staysAlive', () => {
    const enemy = makeHitEnemy(2);
    const stepped = stepEnemyHitReaction(enemy, ENEMY_HIT_REACTION_SECONDS);
    expect(stepped.alive).toBe(true);
    expect(stepped.animState).toBe('walk');
  });
});
