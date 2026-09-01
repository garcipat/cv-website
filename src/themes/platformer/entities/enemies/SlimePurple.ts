import type { EnemyType, BaseEnemyState } from './EnemyType';
import { baseEnemyState, baseRevive } from './shared';
import { ENEMY_ANIMATIONS } from './EnemyAnimation';
import { SLIME_PURPLE_SHEET } from '../sprites/sheets';

export interface SlimePurpleState extends BaseEnemyState {
  type: 'slimePurple';
}

// A purple slime reads as a distinctly bigger, slower, tougher variant of the
// green one — twice the size, 70% of the patrol speed, three stomps.
export const slimePurple: EnemyType<SlimePurpleState> = {
  key: 'slimePurple',
  maxHitPoints: 3,
  patrolSpeedMultiplier: 0.7,
  hitboxPaddingNative: { side: 5, top: 9 },
  sprite: { sheet: SLIME_PURPLE_SHEET, renderScale: 2, animations: ENEMY_ANIMATIONS },
  heldItem: 'key',

  create: (placement, index) => ({
    ...baseEnemyState(placement, index, 3),
    type: 'slimePurple',
  }),
  revive: (enemy) => ({ ...baseRevive(enemy, 3), type: 'slimePurple' }),
};
