import { describe, it, expect } from 'vitest';
import { resolveHitEffects } from './HitResolver';
import type { PlayerState } from '../entities/Player';
import { PLAYER_HIT_REACTION_SECONDS } from '../entities/Player';
import { toEnemyState } from '../entities/Enemy';
import type { EnemyState } from '../entities/Enemy';
import { toBlockState, applyBlockHit, isBlockUsedUp } from '../entities/Block';
import type { BlockState } from '../entities/Block';

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: true,
    climbing: false,
    crouching: false,
    isDroppingThroughBridge: false,
    lastGroundedX: 0,
    lastGroundedY: 0,
    prevFeetY: 0,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    blockContacts: [],
    hitPoints: 6,
    alive: true,
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
    ...overrides,
  };
}

function makeEnemy(): EnemyState {
  return toEnemyState({ id: 'e', type: 'slimeGreen', x: 0, y: 0 });
}

function makeBlock(kind: BlockState['blockKind'] = 'crate'): BlockState {
  return toBlockState({ id: 'b', blockKind: kind, x: 0, y: 0 });
}

describe('resolveHitEffects — the player adapter', () => {
  it('aVelocityOnlyList-movesThePlayerWithoutDamagingIt', () => {
    const result = resolveHitEffects(makePlayer(), [{ type: 'velocity', x: -250, duration: 0.25 }]);
    expect(result.player.hitPoints).toBe(6);
    expect(result.player.vx).toBe(-250);
    expect(result.player.direction).toBe('left');
    expect(result.player.knockbackTimer).toBe(0.25);
  });

  it('aDamageOnlyList-damagesWithoutMovingThePlayer', () => {
    const result = resolveHitEffects(makePlayer(), [{ type: 'damage', amount: 2 }]);
    expect(result.player.hitPoints).toBe(4);
    expect(result.player.vx).toBe(0);
    expect(result.player.knockbackTimer).toBe(0);
  });

  it('damageEnoughToClearHealth-flipsAliveFalse', () => {
    const result = resolveHitEffects(makePlayer({ hitPoints: 2 }), [{ type: 'damage', amount: 2 }]);
    expect(result.player.hitPoints).toBe(0);
    expect(result.player.alive).toBe(false);
  });

  it('reactionBlinkOnly-opensTheWindowWithoutTheRedAnimation', () => {
    const result = resolveHitEffects(makePlayer({ hitTimer: PLAYER_HIT_REACTION_SECONDS }), [
      { type: 'reaction', blinkOnly: true },
    ]);
    expect(result.player.hitTimer).toBe(0);
    expect(result.player.animState).toBe('idle');
  });

  it('reaction-entersTheHitAnimationAndOpensTheWindow', () => {
    const result = resolveHitEffects(makePlayer(), [{ type: 'reaction' }]);
    expect(result.player.hitTimer).toBe(0);
    expect(result.player.animState).toBe('hit');
    expect(result.player.animFrame).toBe(0);
  });

  it('velocityWithYAndPreserveJump-setsTheLiftAndBounceAscending', () => {
    const result = resolveHitEffects(makePlayer(), [
      { type: 'velocity', y: -150, preserveJump: true },
    ]);
    expect(result.player.vy).toBe(-150);
    expect(result.player.bounceAscending).toBe(true);
  });

  it('aForeignPrimitive-isIgnoredAndTheRestStillApplies', () => {
    const result = resolveHitEffects(makePlayer(), [
      { type: 'damage', amount: 1 },
      { type: 'velocity', y: -100 },
    ]);
    expect(result.player.hitPoints).toBe(5);
    expect(result.player.vy).toBe(-100);
  });
});

describe('resolveHitEffects — the enemy adapter', () => {
  it('damage-reducesHitPointsAndEntersTheReaction', () => {
    const result = resolveHitEffects(makeEnemy(), [{ type: 'damage', amount: 1 }]);
    expect(result.enemy.hitPoints).toBe(0);
    expect(result.enemy.animState).toBe('hit');
    expect(result.damaged).toBe(true);
  });

  it('velocity-isIgnoredByAnEnemy', () => {
    const enemy = makeEnemy();
    const result = resolveHitEffects(enemy, [{ type: 'velocity', x: 999 }]);
    expect(result.enemy).toBe(enemy);
    expect(result.damaged).toBe(false);
  });
});

describe('resolveHitEffects — the block adapter', () => {
  it('damageOne-appliesExactlyOneHit', () => {
    const result = resolveHitEffects(makeBlock('crate'), [{ type: 'damage', amount: 1 }]);
    expect(result.block.hitsTaken).toBe(1);
    expect(isBlockUsedUp(result.block)).toBe(false);
  });

  it('damageUpToMaxHits-drivesTheBlockToTerminalAndSaturates', () => {
    const terminal = applyBlockHit(makeBlock('crate')); // crate needs two hits
    const result = resolveHitEffects(terminal, [{ type: 'damage', amount: 999 }]);
    expect(isBlockUsedUp(result.block)).toBe(true);
    expect(result.block.hitsTaken).toBe(2);
  });
});
