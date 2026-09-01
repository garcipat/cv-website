import type { EnemyType, BaseEnemyState } from './EnemyType';
import { baseEnemyState, baseRevive, takeHit } from './shared';
import { isStunned } from './stunnedGuard';
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

  onPlayerCollide: (enemy, _player, contact) => {
    if (isStunned(enemy) || enemy.hitPoints <= 0) return {};
    if (contact.side === 'top') return { self: takeHit(enemy), bouncePlayer: true };
    return { damagePlayer: 1, knockback: 'away' };
  },
};
