import { ENEMY_TYPES } from '../entities/enemies';
import { applyEnemyDefeats } from './enemyRewards';
import {
  activeEffects,
  collectedFacts,
  enemyStates,
  keyPickupStates,
  levelTotals,
} from '../PlatformerState';
import type { EnemyState } from '../entities/enemies';
import type { SlimeGreenState } from '../entities/enemies/SlimeGreen';
import type { SlimePurpleState } from '../entities/enemies/SlimePurple';
import type { CollectedFact } from '../types';
import type { RevealOptions } from './rewards';

/** A CV fact usable as a green slime's `fact`/`extraFacts`. */
function courseFact(id: string): CollectedFact {
  return {
    id,
    sectionId: 'courses',
    sectionLabel: 'Course',
    data: { category: id, skills: [] },
    sourceType: 'enemy',
  };
}

function defeatedSlimeGreen(overrides: Partial<SlimeGreenState> = {}): EnemyState {
  return {
    ...ENEMY_TYPES.slimeGreen.create({ id: 'green', type: 'slimeGreen', x: 0, y: 0 }, 0),
    alive: false,
    hitPoints: 0,
    ...overrides,
  };
}

function defeatedSlimePurple(overrides: Partial<SlimePurpleState> = {}): EnemyState {
  return {
    ...ENEMY_TYPES.slimePurple.create({ id: 'purple', type: 'slimePurple', x: 0, y: 0 }, 0),
    alive: false,
    hitPoints: 0,
    ...overrides,
  };
}

function defeatContext() {
  return {
    revealFact: vi.fn<(fact: CollectedFact, options: RevealOptions) => boolean>(() => true),
    originX: 100,
    originY: 50,
  };
}

describe('applyEnemyDefeats', () => {
  beforeEach(() => {
    enemyStates.value = [];
    activeEffects.value = [];
    keyPickupStates.value = [];
    collectedFacts.value = [];
  });

  it('freshDefeat-invokesTheKindsOnDefeatExactlyOnce', () => {
    const spy = vi.spyOn(ENEMY_TYPES.slimeGreen, 'onDefeat');
    enemyStates.value = [defeatedSlimeGreen({ id: 'g1' })];

    applyEnemyDefeats(enemyStates.value, defeatContext());

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('alreadyRewardedDefeat-doesNotInvokeOnDefeat', () => {
    const spy = vi.spyOn(ENEMY_TYPES.slimeGreen, 'onDefeat');
    enemyStates.value = [defeatedSlimeGreen({ id: 'g1', rewardGiven: true })];

    applyEnemyDefeats(enemyStates.value, defeatContext());

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('defeat-queuesThePuffUnconditionallyEvenWhenAlreadyRewarded', () => {
    enemyStates.value = [defeatedSlimeGreen({ id: 'g1', rewardGiven: true })];

    applyEnemyDefeats(enemyStates.value, defeatContext());

    expect(activeEffects.value.some((e) => e.kind === 'puff' && e.id === 'g1')).toBe(true);
  });

  it('everyDefeatedId-getsRewardGivenAndDeathEffectGivenSet', () => {
    enemyStates.value = [defeatedSlimeGreen({ id: 'g1' }), defeatedSlimeGreen({ id: 'g2' })];

    applyEnemyDefeats(enemyStates.value, defeatContext());

    expect(enemyStates.value.find((e) => e.id === 'g1')).toMatchObject({
      rewardGiven: true,
      deathEffectGiven: true,
    });
    expect(enemyStates.value.find((e) => e.id === 'g2')).toMatchObject({
      rewardGiven: true,
      deathEffectGiven: true,
    });
  });

  it('spawnPickup-routesThroughTheGenericPickupStore', () => {
    enemyStates.value = [defeatedSlimePurple({ id: 'p1' })];

    applyEnemyDefeats(enemyStates.value, defeatContext());

    expect(keyPickupStates.value.some((k) => k.id === 'p1')).toBe(true);
  });

  it('revealFact-revealsEachFactAtTheEnemyPosition', () => {
    const ctx = defeatContext();
    const fact = courseFact('course-a');
    enemyStates.value = [defeatedSlimeGreen({ id: 'g1', fact })];

    applyEnemyDefeats(enemyStates.value, ctx);

    expect(ctx.revealFact).toHaveBeenCalledWith(fact, { x: 0, y: 0, effectId: 'g1-0' });
  });

  it('bumpCounter-dedupesPerKeyAndReadsTheTickFinalNumerator', () => {
    // Two green slimes defeated in one tick must bump the enemies popup once,
    // with this tick's own defeats already in the numerator (the flush runs
    // after the rewardGiven update).
    enemyStates.value = [defeatedSlimeGreen({ id: 'g1' }), defeatedSlimeGreen({ id: 'g2' })];

    applyEnemyDefeats(enemyStates.value, defeatContext());

    const popups = activeEffects.value.filter((e) => e.kind === 'counterPopup');
    expect(popups).toHaveLength(1);
    expect(popups[0].state).toMatchObject({
      labelKey: 'enemies',
      collected: 2,
      total: levelTotals.value.enemies,
    });
  });

  it('aKindWithNoOnDefeat-queuesOnlyItsPuffAndNoCounterBump', () => {
    enemyStates.value = [
      {
        ...ENEMY_TYPES.bee.create({ id: 'b1', type: 'bee', x: 0, y: 0 }, 0),
        alive: false,
        hitPoints: 0,
      },
    ];

    applyEnemyDefeats(enemyStates.value, defeatContext());

    expect(activeEffects.value.some((e) => e.kind === 'puff' && e.id === 'b1')).toBe(true);
    expect(activeEffects.value.some((e) => e.kind === 'counterPopup')).toBe(false);
  });
});
