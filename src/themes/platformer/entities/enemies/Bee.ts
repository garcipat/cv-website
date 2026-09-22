import type { EnemyType, BaseEnemyState } from './EnemyType';
import {
  baseEnemyState,
  baseRevive,
  takeHit,
  ENEMY_HIT_REACTION_SECONDS,
  type EnemyBaseConfig,
} from './shared';
import { isInvulnerable } from '../capabilities';
import { BEE_SHEET } from '../sprites/sheets';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import { drawSpriteSheetEntity } from './drawSpriteSheetEntity';
import { spriteSheetHitbox } from './spriteSheetHitbox';
import { flyMovement } from './movement/fly';
import { RENDER_SCALE } from '../../level/Terrain';
import { PHYSICS_CONFIG } from '../../engine/PhysicsConfig';

export interface BeeState extends BaseEnemyState {
  type: 'bee';
}

/** Row 5 of the 8x7 bee sheet — the neutral flight loop. No `hit` row is
 *  authored: FR-009's resting-state fallback reuses `fly` during the
 *  reaction. */
export const BEE_ANIMATIONS: SpriteDescriptor['animations'] = {
  fly: { frames: [32, 33, 34, 35, 36, 37, 38, 39], frameDuration: 0.12 },
};

export const BEE_SPRITE: SpriteDescriptor = {
  sheet: BEE_SHEET,
  renderScale: 1,
  animations: BEE_ANIMATIONS,
};

/** Measured from the fly frames (row 5). The full art spans x=3..21 (wings
 *  extended, ~18 px wide) but the **body** is taller than wide — x=7..17
 *  (~10 px) by y=7..18 (~12 px) once the bluish wings are excluded. The insets
 *  hug that body and let the wing tips overhang: `side: 7` trims the wing span
 *  in to the 10 px body, `top: 7`/`bottom: 5` match the art's top/bottom. `side`
 *  is a single symmetric value, so the larger measured side is used (the
 *  left/right asymmetry is not representable, by design). The `bottom` inset
 *  pulls the collision box up to the visible bee and anchors the draw on the
 *  placement row (FR-019/SC-009). */
const HITBOX_PADDING_NATIVE = { side: 7, top: 7, bottom: 5 };

const BEE_HITBOX_BOTTOM_PADDING =
  HITBOX_PADDING_NATIVE.bottom * RENDER_SCALE * BEE_SPRITE.renderScale;

const BEE_BASE_CONFIG: EnemyBaseConfig = {
  maxHitPoints: 1,
  hitReactionSeconds: ENEMY_HIT_REACTION_SECONDS,
  defaultAnimState: 'fly',
  animations: BEE_SPRITE.animations,
};

/**
 * The seam's first real consumer and end-to-end validation: a flying enemy
 * that uses `fly`, is stompable like a green slime, drops nothing and counts
 * toward nothing (FR-010/FR-011/FR-012/FR-013).
 */
export const bee: EnemyType<BeeState> = {
  key: 'bee',
  maxHitPoints: 1,
  hitReactionSeconds: ENEMY_HIT_REACTION_SECONDS,
  movement: flyMovement({
    speed: 40,
    bobAmplitude: 6,
    bobPeriod: 1.4,
    sprite: BEE_SPRITE,
    hitboxPaddingNative: HITBOX_PADDING_NATIVE,
    animState: 'fly',
  }),
  defaultAnimState: 'fly',
  hitboxPaddingNative: HITBOX_PADDING_NATIVE,
  sprite: BEE_SPRITE,
  heldItem: null,

  create: (placement, index) => ({
    ...baseEnemyState(placement, index, BEE_BASE_CONFIG),
    type: 'bee',
  }),
  revive: (enemy) => ({
    ...baseRevive(enemy, BEE_BASE_CONFIG),
    type: 'bee',
  }),

  box: (enemy) => spriteSheetHitbox(enemy, BEE_SPRITE, HITBOX_PADDING_NATIVE),

  // `bodyAlpha: 1` — the bee is opaque, not at the slimes' 0.78 (it has no
  // held item to show through).
  draw: (enemy, dc) =>
    drawSpriteSheetEntity(enemy, dc, BEE_SPRITE, 'fly', BEE_HITBOX_BOTTOM_PADDING, 1),

  // Identical to SlimeGreen: a top contact while falling stomps, anything
  // else damages + knocks back, and a reacting bee is harmless in every way.
  onPlayerCollide: (enemy, _player, contact) => {
    if (isInvulnerable(enemy, bee.hitReactionSeconds) || enemy.hitPoints <= 0) return {};
    if (contact.side === 'top') {
      return { self: takeHit(enemy), bounceVelocity: PHYSICS_CONFIG.stompBounceVelocity };
    }
    return { damagePlayer: 1, knockback: 'away' };
  },
};
