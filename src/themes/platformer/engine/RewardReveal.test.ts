import { createRewardReveal } from './RewardReveal';
import { collectedFacts, activeEffects, activeCounterPopups } from '../PlatformerState';
import { COLLECTION_TEXT_SLOT_COUNT } from './CollectionEffects';
import type { CollectedFact } from '../types';

const factIn = (id: string, sectionId: CollectedFact['sectionId']): CollectedFact => ({
  id,
  sectionId,
  sectionLabel: sectionId,
  data: { category: 'x', skills: [] },
  sourceType: 'block',
});

const ctx = {
  originX: 0,
  originY: 0,
  canvasWidth: 800,
  canvasHeight: 600,
  journalRect: null,
  inFlightCount: 0,
};

describe('createRewardReveal', () => {
  beforeEach(() => {
    collectedFacts.value = [];
    activeEffects.value = [];
    activeCounterPopups.value = {};
  });

  afterEach(() => {
    collectedFacts.value = [];
    activeEffects.value = [];
    activeCounterPopups.value = {};
  });

  it('freshFact-collectsItAndReturnsTrue', () => {
    const reveal = createRewardReveal(ctx);

    const revealed = reveal(factIn('a', 'education'), {
      x: 100,
      y: 200,
      effectId: 'block-1',
      counterKey: 'crates',
    });

    expect(revealed).toBe(true);
    expect(collectedFacts.value.map((f) => f.id)).toEqual(['a']);
  });

  it('freshFact-startsOneFlightEffect', () => {
    const reveal = createRewardReveal(ctx);

    reveal(factIn('a', 'education'), { x: 100, y: 200, effectId: 'block-1', counterKey: 'crates' });

    expect(activeEffects.value).toHaveLength(1);
    expect(activeEffects.value[0]).toMatchObject({ id: 'block-1', startX: 100 });
  });

  it('alreadyCollectedFact-revealsNothingAndReturnsFalse', () => {
    const fact = factIn('a', 'education');
    collectedFacts.value = [fact];
    const reveal = createRewardReveal(ctx);

    const revealed = reveal(fact, { x: 0, y: 0, effectId: 'block-1', counterKey: 'crates' });

    expect(revealed).toBe(false);
    expect(activeEffects.value).toEqual([]);
    expect(collectedFacts.value).toHaveLength(1);
  });

  it('twoRevealsInOneTick-stackTheirTextOnSuccessiveSlots', () => {
    const reveal = createRewardReveal(ctx);

    reveal(factIn('a', 'education'), { x: 0, y: 0, effectId: 'e1', counterKey: 'crates' });
    reveal(factIn('b', 'activities'), { x: 0, y: 0, effectId: 'e2', counterKey: 'crates' });

    // Slot 0 then slot 1 — the same vertical stacking the five inline call
    // sites produced via the shared nextTextSlot counter.
    expect(activeEffects.value[0].startY).toBeLessThan(activeEffects.value[1].startY);
  });

  it('contextWithEffectsAlreadyInFlight-seedsTheFirstSlotFromThatCount', () => {
    const reveal = createRewardReveal({ ...ctx, inFlightCount: 1 });
    const fresh = createRewardReveal(ctx);

    reveal(factIn('a', 'education'), { x: 0, y: 0, effectId: 'e1', counterKey: 'crates' });
    const seededY = activeEffects.value[0].startY;
    collectedFacts.value = [];
    activeEffects.value = [];
    fresh(factIn('b', 'education'), { x: 0, y: 0, effectId: 'e2', counterKey: 'crates' });

    // An isolated reveal lands on slot 0; one starting with an effect already
    // in flight lands lower. This is the reseed-from-live-in-flight-count
    // behavior, not an ever-incrementing counter.
    expect(seededY).toBeGreaterThan(activeEffects.value[0].startY);
  });

  it('crateFact-bumpsTheCrateCounterWithTheSectionDerivedNumerator', () => {
    const reveal = createRewardReveal(ctx);

    reveal(factIn('a', 'education'), { x: 0, y: 0, effectId: 'e1', counterKey: 'crates' });

    expect(activeCounterPopups.value.crates).toMatchObject({ labelKey: 'crates', collected: 1 });
  });

  it('collectedOverride-winsOverTheSectionDerivedNumerator', () => {
    const reveal = createRewardReveal(ctx);

    reveal(factIn('a', 'skills'), {
      x: 0,
      y: 0,
      effectId: 'e1',
      counterKey: 'coins',
      collectedOverride: 7,
    });

    expect(activeCounterPopups.value.coins).toMatchObject({ collected: 7 });
  });

  it('noCounterKey-revealsTheFactWithoutBumpingAnyPopup', () => {
    // The chest site: chests have a permanent HUD counter, so opening one
    // must not create a transient popup.
    const reveal = createRewardReveal(ctx);

    const revealed = reveal(factIn('a', 'experience'), { x: 0, y: 0, effectId: 'chest-1' });

    expect(revealed).toBe(true);
    expect(activeCounterPopups.value).toEqual({});
    expect(activeEffects.value).toHaveLength(1);
  });

  it('slotCycling-wrapsAfterTheSlotCount', () => {
    const reveal = createRewardReveal(ctx);

    for (let i = 0; i <= COLLECTION_TEXT_SLOT_COUNT; i += 1) {
      reveal(factIn(`f${i}`, 'education'), { x: 0, y: 0, effectId: `e${i}`, counterKey: 'crates' });
    }

    // The (COLLECTION_TEXT_SLOT_COUNT + 1)-th reveal is back on slot 0.
    expect(activeEffects.value[COLLECTION_TEXT_SLOT_COUNT].startY).toBe(activeEffects.value[0].startY);
  });
});
