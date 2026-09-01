import type { EnemyType, BaseEnemyState } from './EnemyType';
import { baseEnemyState, baseRevive } from './shared';
import { ENEMY_ANIMATIONS } from './EnemyAnimation';
import { SLIME_GREEN_SHEET } from '../sprites/sheets';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import { drawSpriteSheetEntity } from './drawSpriteSheetEntity';

export interface SlimeGreenState extends BaseEnemyState {
  type: 'slimeGreen';
}

const SLIME_GREEN_SPRITE: SpriteDescriptor = {
  sheet: SLIME_GREEN_SHEET,
  renderScale: 1,
  animations: ENEMY_ANIMATIONS,
};

export const slimeGreen: EnemyType<SlimeGreenState> = {
  key: 'slimeGreen',
  maxHitPoints: 1,
  patrolSpeedMultiplier: 1,
  hitboxPaddingNative: { side: 5, top: 9 },
  sprite: SLIME_GREEN_SPRITE,
  heldItem: null,

  create: (placement, index) => ({
    ...baseEnemyState(placement, index, 1),
    type: 'slimeGreen',
  }),
  revive: (enemy) => ({ ...baseRevive(enemy, 1), type: 'slimeGreen' }),
  draw: (enemy, dc) => drawSpriteSheetEntity(enemy, dc, SLIME_GREEN_SPRITE),
};
