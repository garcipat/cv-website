import { toEnemyState } from './Enemy';
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
    expect(enemy.hitTimer).toBe(0);
  });
});
