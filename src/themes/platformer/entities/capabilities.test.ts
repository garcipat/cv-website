import { toEnemyState } from './Enemy';
import { ENEMY_HIT_REACTION_SECONDS } from './enemies/shared';
import { isInvulnerable } from './capabilities';
import type { Moving, SelfAnimated, Damageable } from './capabilities';
import type { EnemyPlacement } from '../level/EnemyMapper';

function makePlacement(): EnemyPlacement {
  return { id: 'enemy-test', type: 'slimeGreen', x: 320, y: 96 };
}

describe('capability conformance', () => {
  it('enemyState-assignedToAllThreeCapabilities-satisfiesEachShape', () => {
    // A compile-time assertion with a runtime witness: if enemy state stops
    // structurally satisfying any capability, this file fails to compile.
    const enemy: Moving & SelfAnimated & Damageable = toEnemyState(makePlacement());
    expect(enemy.vx).toBe(0);
    expect(enemy.vy).toBe(0);
    expect(enemy.direction).toBe('right');
    expect(enemy.animState).toBe('walk');
    expect(enemy.alive).toBe(true);
    expect(enemy.hitTimer).toBe(ENEMY_HIT_REACTION_SECONDS);
    expect(isInvulnerable(enemy, ENEMY_HIT_REACTION_SECONDS)).toBe(false);
  });
});

describe('isInvulnerable', () => {
  it('justHit-isInvulnerable', () => {
    expect(isInvulnerable({ hitPoints: 3, alive: true, hitTimer: 0 }, 1.2)).toBe(true);
  });

  it('partwayThroughTheWindow-isStillInvulnerable', () => {
    expect(isInvulnerable({ hitPoints: 3, alive: true, hitTimer: 1.1 }, 1.2)).toBe(true);
  });

  it('exactlyAtTheDuration-isVulnerableAgain', () => {
    // The window is `hitTimer < reactionSeconds`, so the boundary value is
    // already outside it.
    expect(isInvulnerable({ hitPoints: 3, alive: true, hitTimer: 1.2 }, 1.2)).toBe(false);
  });

  it('pastTheDuration-isVulnerable', () => {
    expect(isInvulnerable({ hitPoints: 3, alive: true, hitTimer: 99 }, 1.2)).toBe(false);
  });
});
