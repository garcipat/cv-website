import type { EnemyType, BaseEnemyState } from './EnemyType';
import {
  baseEnemyState,
  baseRevive,
  takeHit,
  ENEMY_HIT_REACTION_SECONDS,
  type EnemyBaseConfig,
} from './shared';
import { isInvulnerable } from '../../contracts/capabilities';
import { ENEMY_ANIMATIONS } from './EnemyAnimation';
import { SLIME_GREEN_SHEET } from '../sprites/sheets';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import { drawSpriteSheetEntity } from './drawSpriteSheetEntity';
import { spriteSheetHitbox } from './spriteSheetHitbox';
import { patrolMovement } from './movement/patrol';
import { PHYSICS_CONFIG } from '../../contracts/PhysicsConfig';
import type { CollectedFact } from '../../types';

export interface SlimeGreenState extends BaseEnemyState {
  type: 'slimeGreen';
}

/** Transparent margin inside the native frame, in pre-scale pixels — the
 *  inset `box` below takes the collision hitbox in from the render slot by.
 *  `bottom: 0`: the slime's feet already touch the native frame's bottom edge,
 *  so its box and anchor are unchanged by FR-019's bottom inset. */
const HITBOX_PADDING_NATIVE = { side: 5, top: 9, bottom: 0 };

const SLIME_GREEN_SPRITE: SpriteDescriptor = {
  sheet: SLIME_GREEN_SHEET,
  renderScale: 1,
  animations: ENEMY_ANIMATIONS,
};

const SLIME_GREEN_BASE_CONFIG: EnemyBaseConfig = {
  maxHitPoints: 1,
  hitReactionSeconds: ENEMY_HIT_REACTION_SECONDS,
  defaultAnimState: 'walk',
  animations: SLIME_GREEN_SPRITE.animations,
};

export const slimeGreen: EnemyType<SlimeGreenState> = {
  key: 'slimeGreen',
  maxHitPoints: 1,
  hitReactionSeconds: ENEMY_HIT_REACTION_SECONDS,
  movement: patrolMovement({
    speedMultiplier: 1,
    sprite: SLIME_GREEN_SPRITE,
    hitboxPaddingNative: HITBOX_PADDING_NATIVE,
    animState: 'walk',
  }),
  defaultAnimState: 'walk',
  hitboxPaddingNative: HITBOX_PADDING_NATIVE,
  sprite: SLIME_GREEN_SPRITE,
  heldItem: null,
  onDefeat: (enemy, defeat) => {
    // `enemy.fact` plus any `extraFacts` (when the level has fewer green
    // slimes than course facts, one slime can own several), revealed
    // per-fact (effectId unique per fact, not per enemy) — then the enemies
    // popup bumps once per DEFEATED SLIME, not per revealed fact, so a
    // fact-less slime still counts toward the numerator.
    const facts = [enemy.fact, ...(enemy.extraFacts ?? [])].filter(
      (fact): fact is CollectedFact => fact !== undefined,
    );
    facts.forEach((fact, index) => defeat.revealFact(fact, `${enemy.id}-${index}`));
    defeat.bumpCounter('enemies');
  },

  create: (placement, index) => ({
    ...baseEnemyState(placement, index, SLIME_GREEN_BASE_CONFIG),
    type: 'slimeGreen',
  }),
  revive: (enemy) => ({
    ...baseRevive(enemy, SLIME_GREEN_BASE_CONFIG),
    type: 'slimeGreen',
  }),
  box: (enemy) => spriteSheetHitbox(enemy, SLIME_GREEN_SPRITE, HITBOX_PADDING_NATIVE),
  draw: (enemy, dc) => drawSpriteSheetEntity(enemy, dc, SLIME_GREEN_SPRITE, 'walk'),

  onPlayerCollide: (enemy, _player, contact) => {
    // Mid-reaction, this slime is harmless in every way — not merely immune
    // to a second stomp. Without that, bouncing off a stomp while still
    // overlapping the now-frozen enemy registers as a spurious side-hit
    // against the very enemy just stomped.
    if (isInvulnerable(enemy, slimeGreen.hitReactionSeconds) || enemy.hitPoints <= 0) return {};
    if (contact.side === 'top') {
      return { self: takeHit(enemy), bounceVelocity: PHYSICS_CONFIG.stompBounceVelocity };
    }
    return { damagePlayer: 1, knockback: 'away' };
  },
};
