import { toEnemyState } from './Enemy';
import type { Entity, Damageable } from './Entity';
import type { EnemyPlacement } from '../level/EnemyMapper';

function makePlacement(): EnemyPlacement {
  return { id: 'enemy-test', type: 'slimeGreen', x: 320, y: 96 };
}

describe('Entity conformance', () => {
  it('enemyState-assignedToEntity-satisfiesTheSharedShape', () => {
    // A compile-time assertion with a runtime witness: if EnemyState stops
    // structurally satisfying Entity & Damageable, this file fails to compile.
    const enemy: Entity & Damageable = toEnemyState(makePlacement());
    expect(enemy.type).toBe('slimeGreen');
    expect(enemy.vx).toBe(0);
    expect(enemy.vy).toBe(0);
    expect(enemy.direction).toBe('right');
    expect(enemy.alive).toBe(true);
  });
});
