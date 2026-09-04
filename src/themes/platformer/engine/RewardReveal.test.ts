import { createRewardReveal } from './RewardReveal';
import { collectedFacts, activeEffects, activeCounterPopups } from '../PlatformerState';
import { COLLECTION_TEXT_SLOT_COUNT, createSlotAllocator } from './CollectionEffects';
import type { SlotAllocator } from './CollectionEffects';
import type { CollectedFact } from '../types';

const factIn = (id: string, sectionId: CollectedFact['sectionId']): CollectedFact => ({
  id,
  sectionId,
  sectionLabel: sectionId,
  data: { category: 'x', skills: [] },
  sourceType: 'block',
});

// The allocator is stateful, so every context gets its own — except where a
// test deliberately shares one, which is the whole point of it living outside
// the trigger.
const ctxWith = (allocateSlotOffset: SlotAllocator = createSlotAllocator(0)) => ({
  originX: 0,
  originY: 0,
  canvasWidth: 800,
  canvasHeight: 600,
  journalRect: null,
  allocateSlotOffset,
});

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
    const reveal = createRewardReveal(ctxWith());

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
    const reveal = createRewardReveal(ctxWith());

    reveal(factIn('a', 'education'), { x: 100, y: 200, effectId: 'block-1', counterKey: 'crates' });

    expect(activeEffects.value).toHaveLength(1);
    expect(activeEffects.value[0]).toMatchObject({ id: 'block-1', startX: 100 });
  });

  it('alreadyCollectedFact-revealsNothingAndReturnsFalse', () => {
    const fact = factIn('a', 'education');
    collectedFacts.value = [fact];
    const reveal = createRewardReveal(ctxWith());

    const revealed = reveal(fact, { x: 0, y: 0, effectId: 'block-1', counterKey: 'crates' });

    expect(revealed).toBe(false);
    expect(activeEffects.value).toEqual([]);
    expect(collectedFacts.value).toHaveLength(1);
  });

  it('twoRevealsInOneTick-stackTheirTextOnSuccessiveSlots', () => {
    const reveal = createRewardReveal(ctxWith());

    reveal(factIn('a', 'education'), { x: 0, y: 0, effectId: 'e1', counterKey: 'crates' });
    reveal(factIn('b', 'activities'), { x: 0, y: 0, effectId: 'e2', counterKey: 'crates' });

    // Slot 0 then slot 1 — successive reveals step down a row rather than
    // stacking on top of each other.
    expect(activeEffects.value[0].startY).toBeLessThan(activeEffects.value[1].startY);
  });

  it('contextWithEffectsAlreadyInFlight-seedsTheFirstSlotFromThatCount', () => {
    const reveal = createRewardReveal(ctxWith(createSlotAllocator(1)));
    const fresh = createRewardReveal(ctxWith());

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
    const reveal = createRewardReveal(ctxWith());

    reveal(factIn('a', 'education'), { x: 0, y: 0, effectId: 'e1', counterKey: 'crates' });

    expect(activeCounterPopups.value.crates).toMatchObject({ labelKey: 'crates', collected: 1 });
  });

  it('allocatorSharedWithAnotherConsumer-theyNeverTakeTheSameSlot', () => {
    // The key pickup takes its slot from the SAME per-tick allocator, because
    // it is outside this trigger. Sharing one counter is what stops a key
    // caption from landing on a fact reveal's row.
    const allocateSlotOffset = createSlotAllocator(0);
    const reveal = createRewardReveal(ctxWith(allocateSlotOffset));

    reveal(factIn('a', 'education'), { x: 0, y: 0, effectId: 'e1', counterKey: 'crates' });
    const keyPickupOffset = allocateSlotOffset();

    expect(activeEffects.value[0].startY).not.toBe(keyPickupOffset);
    expect(keyPickupOffset).toBeGreaterThan(0);
  });

  it('noCounterKey-revealsTheFactWithoutBumpingAnyPopup', () => {
    // The chest site: chests have a permanent HUD counter, so opening one
    // must not create a transient popup.
    const reveal = createRewardReveal(ctxWith());

    const revealed = reveal(factIn('a', 'experience'), { x: 0, y: 0, effectId: 'chest-1' });

    expect(revealed).toBe(true);
    expect(activeCounterPopups.value).toEqual({});
    expect(activeEffects.value).toHaveLength(1);
  });

  it('slotCycling-wrapsAfterTheSlotCount', () => {
    const reveal = createRewardReveal(ctxWith());

    for (let i = 0; i <= COLLECTION_TEXT_SLOT_COUNT; i += 1) {
      reveal(factIn(`f${i}`, 'education'), { x: 0, y: 0, effectId: `e${i}`, counterKey: 'crates' });
    }

    // The (COLLECTION_TEXT_SLOT_COUNT + 1)-th reveal is back on slot 0.
    expect(activeEffects.value[COLLECTION_TEXT_SLOT_COUNT].startY).toBe(activeEffects.value[0].startY);
  });

  it('twoRevealsInOneTick-applyTheSameStackOffsetToStartYAndMidY', () => {
    const reveal = createRewardReveal(ctxWith());

    reveal(factIn('a', 'education'), { x: 0, y: 0, effectId: 'e1', counterKey: 'crates' });
    reveal(factIn('b', 'activities'), { x: 0, y: 0, effectId: 'e2', counterKey: 'crates' });

    // If the offset only moved startY (leaving every effect's midY at the
    // same screen row), the two effects would overlap through the entire
    // hold phase — the exact bug this design rejected. Pinning that the
    // startY gap and the midY gap match (and are non-zero) proves the
    // offset moves both points together, without hardcoding the row height.
    const [first, second] = activeEffects.value;
    const startYGap = second.startY - first.startY;
    const midYGap = second.midY - first.midY;

    expect(startYGap).not.toBe(0);
    expect(midYGap).toBe(startYGap);
  });

  it('nonZeroOrigin-addsItToTheEffectsStartCoordinates', () => {
    const reveal = createRewardReveal({ ...ctxWith(), originX: 40, originY: 25 });

    reveal(factIn('a', 'education'), { x: 100, y: 200, effectId: 'e1', counterKey: 'crates' });

    // Slot 0 contributes no stack offset, so startY is exactly y + originY.
    expect(activeEffects.value[0].startX).toBe(140);
    expect(activeEffects.value[0].startY).toBe(225);
  });
});
