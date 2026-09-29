/**
 * Folds an ordered `HitEffect[]` into a target's next state, mapping the generic
 * primitives onto each family's existing operations and skipping any it has no
 * semantics for (a `velocity` on an enemy, a `reaction` on a block).
 *
 * Pure: no signals, no canvas, returns state only — it never builds or spawns a
 * visual. It also does not gate `damage` on invulnerability; each call site
 * keeps its own guard.
 */
import type { HitEffect } from '../contracts/HitEffect';
import type { PlayerState } from '../entities/Player';
import { applyHitReaction, beginPitFallReaction } from '../entities/Player';
import { takeDamage } from '../entities/Health';
import type { EnemyState } from '../entities/Enemy';
import { applyEnemyDamage } from '../entities/Enemy';
import type { BlockState } from '../entities/Block';
import { applyBlockHit, isBlockUsedUp } from '../entities/Block';
import { BLOCK_TYPES } from '../entities/blocks';
import type { BlockHitOutcome } from '../entities/blocks/BlockType';

export interface PlayerHitResult {
  readonly player: PlayerState;
}

export interface EnemyHitResult {
  readonly enemy: EnemyState;
  readonly damaged: boolean;
}

export interface BlockHitResult {
  readonly block: BlockState;
  /** The block's own `onHit` result, for the caller's terminal-outcome applier. */
  readonly outcome: BlockHitOutcome;
}

export function resolveHitEffects(
  target: PlayerState,
  effects: readonly HitEffect[],
): PlayerHitResult;
export function resolveHitEffects(
  target: EnemyState,
  effects: readonly HitEffect[],
): EnemyHitResult;
export function resolveHitEffects(
  target: BlockState,
  effects: readonly HitEffect[],
): BlockHitResult;
export function resolveHitEffects(
  target: PlayerState | EnemyState | BlockState,
  effects: readonly HitEffect[],
): PlayerHitResult | EnemyHitResult | BlockHitResult {
  if ('blockKind' in target) return resolveBlockEffects(target, effects);
  if ('type' in target) return resolveEnemyEffects(target, effects);
  return resolvePlayerEffects(target, effects);
}

function resolvePlayerEffects(player: PlayerState, effects: readonly HitEffect[]): PlayerHitResult {
  let next = player;

  for (const effect of effects) {
    switch (effect.type) {
      case 'damage': {
        const hitPoints = takeDamage(next.hitPoints, effect.amount);
        next = { ...next, hitPoints, alive: hitPoints > 0 };
        break;
      }
      case 'reaction': {
        next = effect.blinkOnly ? beginPitFallReaction(next) : applyHitReaction(next);
        break;
      }
      case 'velocity': {
        let moved = next;
        if (effect.x !== undefined) {
          moved = { ...moved, vx: effect.x, direction: effect.x < 0 ? 'left' : 'right' };
        }
        if (effect.y !== undefined) moved = { ...moved, vy: effect.y };
        if (effect.duration !== undefined) moved = { ...moved, knockbackTimer: effect.duration };
        if (effect.preserveJump) moved = { ...moved, bounceAscending: true };
        next = moved;
        break;
      }
      default:
        break;
    }
  }

  return { player: next };
}

/** `damage` runs the shared enemy hit pipeline, which already enters the `hit`
 * reaction, so a following `reaction` is a no-op. */
function resolveEnemyEffects(enemy: EnemyState, effects: readonly HitEffect[]): EnemyHitResult {
  let next = enemy;
  for (const effect of effects) {
    if (effect.type === 'damage') next = applyEnemyDamage(next, effect.amount);
  }
  return { enemy: next, damaged: next.hitPoints < enemy.hitPoints };
}

/** `damage` is `amount` hits, saturating at used-up: a bump passes 1, a blast
 * passes the kind's `maxHits`. The terminal outcome is not run here. */
function resolveBlockEffects(block: BlockState, effects: readonly HitEffect[]): BlockHitResult {
  let next = block;
  for (const effect of effects) {
    if (effect.type === 'damage') {
      let hits = 0;
      while (hits < effect.amount && !isBlockUsedUp(next)) {
        next = applyBlockHit(next);
        hits += 1;
      }
    }
  }
  return { block: next, outcome: BLOCK_TYPES[next.blockKind].onHit?.(next) ?? {} };
}
