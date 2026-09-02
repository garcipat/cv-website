import { takeHit, baseEnemyState, baseRevive, ENEMY_HIT_REACTION_SECONDS } from './shared';
import { ENEMY_TYPES } from './index';
import { isInvulnerable } from '../capabilities';
import type { EnemyPlacement } from '../../level/EnemyMapper';

function makeGreenPlacement(): EnemyPlacement {
  return { id: 'enemy-cert-x', type: 'slimeGreen', x: 320, y: 96 };
}

describe('takeHit', () => {
  it('anyEnemy-entersHitStateAtFrameZeroAndFreezesMovement', () => {
    const state = { ...ENEMY_TYPES.slimeGreen.create(makeGreenPlacement(), 0), vx: 60, direction: 'right' as const };
    const next = takeHit(state);
    expect(next.animState).toBe('hit');
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
    expect(next.hitTimer).toBe(0);
    expect(next.vx).toBe(0);
  });

  it('enemyAlreadyMidHitReactionFromAnEarlierStomp-resetsAnimationAgain', () => {
    // takeHit itself never refuses a second call (see its doc comment) —
    // calling it again mid-reaction must replay from frame 0, not continue
    // wherever the first stomp's animation had gotten to. The type module's
    // own `onPlayerCollide` (via `isInvulnerable`) is what actually prevents this
    // from happening via real player input while mid-reaction — this test
    // exercises the function directly, bypassing that gate.
    const placement: EnemyPlacement = { id: 'enemy-cert-x', type: 'slimePurple', x: 320, y: 96 };
    const state = {
      ...ENEMY_TYPES.slimePurple.create(placement, 0),
      hitPoints: 2,
      animState: 'hit' as const,
      animFrame: 3,
      animTimer: 0.05,
      hitTimer: 0.2,
    };
    const next = takeHit(state);
    expect(next.hitPoints).toBe(1);
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
    expect(next.hitTimer).toBe(0);
  });
});

describe('baseEnemyState/baseRevive hitTimer seeding', () => {
  // Regression for a latent bug: both factories used to seed `hitTimer` from
  // the module-level ENEMY_HIT_REACTION_SECONDS constant instead of the
  // caller-supplied duration. That was invisible today because every current
  // type happens to use that same value — a future type declaring a
  // different `hitReactionSeconds` would spawn seeded below its own
  // threshold and so read as permanently invulnerable. Using a duration that
  // deliberately differs from the shared constant proves the seed tracks the
  // argument, not the constant.
  const differentDuration = ENEMY_HIT_REACTION_SECONDS + 0.6;

  it('baseEnemyState-seedsHitTimerFromArgumentNotSharedConstant-spawnsVulnerable', () => {
    const placement: EnemyPlacement = { id: 'enemy-cert-x', type: 'slimeGreen', x: 320, y: 96 };
    const state = baseEnemyState(placement, 0, 1, differentDuration);
    expect(state.hitTimer).toBe(differentDuration);
    expect(isInvulnerable(state, differentDuration)).toBe(false);
  });

  it('baseRevive-seedsHitTimerFromArgumentNotSharedConstant-revivesVulnerable', () => {
    const placement: EnemyPlacement = { id: 'enemy-cert-x', type: 'slimeGreen', x: 320, y: 96 };
    const spawned = { ...baseEnemyState(placement, 0, 1, ENEMY_HIT_REACTION_SECONDS), type: 'slimeGreen' as const };
    const revived = baseRevive(spawned, 1, differentDuration);
    expect(revived.hitTimer).toBe(differentDuration);
    expect(isInvulnerable(revived, differentDuration)).toBe(false);
  });

  it('bothSlimeTypes-stillSeedTheSharedConstantAndSpawnVulnerable', () => {
    const greenPlacement: EnemyPlacement = { id: 'enemy-cert-x', type: 'slimeGreen', x: 320, y: 96 };
    const purplePlacement: EnemyPlacement = { id: 'enemy-cert-y', type: 'slimePurple', x: 320, y: 96 };
    const greenState = ENEMY_TYPES.slimeGreen.create(greenPlacement, 0);
    const purpleState = ENEMY_TYPES.slimePurple.create(purplePlacement, 0);

    expect(greenState.hitTimer).toBe(ENEMY_HIT_REACTION_SECONDS);
    expect(isInvulnerable(greenState, ENEMY_TYPES.slimeGreen.hitReactionSeconds)).toBe(false);
    expect(purpleState.hitTimer).toBe(ENEMY_HIT_REACTION_SECONDS);
    expect(isInvulnerable(purpleState, ENEMY_TYPES.slimePurple.hitReactionSeconds)).toBe(false);
  });
});

describe('deathEffectGiven', () => {
  const placement: EnemyPlacement = { id: 'enemy-cert-x', type: 'slimeGreen', x: 320, y: 96 };

  it('baseEnemyState-startsFalse', () => {
    const state = baseEnemyState(placement, 0, 1, ENEMY_HIT_REACTION_SECONDS);
    expect(state.deathEffectGiven).toBe(false);
  });

  it('baseRevive-resetsDeathEffectGivenToFalse-evenIfItWasTrue', () => {
    const state = { ...baseEnemyState(placement, 0, 1, ENEMY_HIT_REACTION_SECONDS), type: 'slimeGreen' as const, deathEffectGiven: true, alive: false };
    const revived = baseRevive(state, 1, ENEMY_HIT_REACTION_SECONDS);
    expect(revived.deathEffectGiven).toBe(false);
  });

  it('baseRevive-preservesRewardGiven-unlikeDeathEffectGiven', () => {
    // Contrast case: rewardGiven is permanent (see baseRevive's own doc
    // comment); deathEffectGiven is per-life. Both fields exist on the same
    // object but behave oppositely across a revive.
    const state = {
      ...baseEnemyState(placement, 0, 1, ENEMY_HIT_REACTION_SECONDS),
      type: 'slimeGreen' as const,
      rewardGiven: true,
      deathEffectGiven: true,
      alive: false,
    };
    const revived = baseRevive(state, 1, ENEMY_HIT_REACTION_SECONDS);
    expect(revived.rewardGiven).toBe(true);
    expect(revived.deathEffectGiven).toBe(false);
  });
});
