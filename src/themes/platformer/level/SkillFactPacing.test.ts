import { revealedFactCountFor } from './SkillFactPacing';

describe('revealedFactCountFor', () => {
  it('coinsEqualsTotalEqualsPool-onePerCoinInOrder', () => {
    // The common case: totalCoinCount === poolLength, one new fact per coin.
    const results = Array.from({ length: 6 }, (_, i) => revealedFactCountFor(i, 5, 5));
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('moreCoinsThanFacts-spreadsRevealsEvenlyAcrossAllCoins', () => {
    // 10 coins, 5 facts: a new fact every 2 coins (the example from the
    // conversation this was designed around).
    const results = Array.from({ length: 11 }, (_, i) => revealedFactCountFor(i, 10, 5));
    expect(results).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
  });

  it('collectingEveryCoin-alwaysRevealsTheWholePoolExactly', () => {
    expect(revealedFactCountFor(10, 10, 5)).toBe(5);
    expect(revealedFactCountFor(7, 7, 3)).toBe(3);
    expect(revealedFactCountFor(1, 1, 1)).toBe(1);
  });

  it('fewerCoinsThanFacts-someCoinsRevealMoreThanOneFact', () => {
    // 3 coins, 5 facts: collecting all 3 must still reach the full pool.
    const results = Array.from({ length: 4 }, (_, i) => revealedFactCountFor(i, 3, 5));
    expect(results).toEqual([0, 1, 3, 5]);
  });

  it('emptyPool-alwaysReturnsZero', () => {
    expect(revealedFactCountFor(0, 10, 0)).toBe(0);
    expect(revealedFactCountFor(10, 10, 0)).toBe(0);
  });

  it('zeroTotalCoinCount-returnsZeroRegardlessOfCoinsCollected', () => {
    expect(revealedFactCountFor(0, 0, 5)).toBe(0);
  });

  it('negativeTotalCoinCount-returnsZero', () => {
    expect(revealedFactCountFor(0, -1, 5)).toBe(0);
  });
});
