import { toChestState, isChestOpen, openChest, allChestsOpen } from './Chest';
import type { ChestPlacement } from '../level/ChestMapper';

const placement: ChestPlacement = {
  id: 'chest-exp-x',
  x: 100,
  y: 200,
  fact: {
    id: 'chest-exp-x',
    sectionId: 'experience',
    sectionLabel: 'Experience',
    data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
    sourceType: 'chest',
  },
};

describe('toChestState', () => {
  it('placement-converts-toClosedState', () => {
    expect(toChestState(placement)).toEqual({ ...placement, state: 'closed' });
  });
});

describe('isChestOpen', () => {
  it('closedState-returns-false', () => {
    expect(isChestOpen(toChestState(placement))).toBe(false);
  });

  it('openState-returns-true', () => {
    expect(isChestOpen(openChest(toChestState(placement)))).toBe(true);
  });
});

describe('openChest', () => {
  it('closedChest-becomes-open', () => {
    const opened = openChest(toChestState(placement));
    expect(opened.state).toBe('open');
  });

  it('alreadyOpenChest-staysOpen-sameReference', () => {
    const opened = openChest(toChestState(placement));
    expect(openChest(opened)).toBe(opened);
  });
});

describe('allChestsOpen', () => {
  it('emptyArray-returns-false', () => {
    expect(allChestsOpen([])).toBe(false);
  });

  it('someClosed-returns-false', () => {
    const chests = [toChestState(placement), openChest(toChestState({ ...placement, id: 'chest-exp-y' }))];
    expect(allChestsOpen(chests)).toBe(false);
  });

  it('allOpen-returns-true', () => {
    const chests = [
      openChest(toChestState(placement)),
      openChest(toChestState({ ...placement, id: 'chest-exp-y' })),
    ];
    expect(allChestsOpen(chests)).toBe(true);
  });
});
