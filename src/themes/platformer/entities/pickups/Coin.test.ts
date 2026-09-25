import {
  COIN_FRAME_COUNT,
  COIN_FRAME_DURATION,
  COIN_BOB_AMPLITUDE,
  COIN_BOB_PERIOD_SECONDS,
  coinFrameIndex,
  coinBobOffset,
  coin,
} from './Coin';

describe('coinFrameIndex', () => {
  it('elapsedZero-returnsFrameZero', () => {
    expect(coinFrameIndex(0)).toBe(0);
  });

  it('elapsedJustBeforeFrameDuration-staysFrameZero', () => {
    expect(coinFrameIndex(COIN_FRAME_DURATION - 0.001)).toBe(0);
  });

  it('elapsedAtFrameDuration-advancesToFrameOne', () => {
    expect(coinFrameIndex(COIN_FRAME_DURATION)).toBe(1);
  });

  it('elapsedAfterFullCycle-wrapsBackToFrameZero', () => {
    expect(coinFrameIndex(COIN_FRAME_DURATION * COIN_FRAME_COUNT)).toBe(0);
  });

  it('elapsedNegative-clampsToFrameZero', () => {
    expect(coinFrameIndex(-1)).toBe(0);
  });
});

describe('coinBobOffset', () => {
  it('elapsedZero-returnsZero', () => {
    expect(coinBobOffset(0)).toBe(0);
  });

  it('elapsedQuarterPeriod-returnsPositiveAmplitude', () => {
    expect(coinBobOffset(COIN_BOB_PERIOD_SECONDS / 4)).toBeCloseTo(COIN_BOB_AMPLITUDE);
  });

  it('elapsedHalfPeriod-returnsCloseToZero', () => {
    expect(coinBobOffset(COIN_BOB_PERIOD_SECONDS / 2)).toBeCloseTo(0);
  });

  it('elapsedThreeQuarterPeriod-returnsNegativeAmplitude', () => {
    expect(coinBobOffset((COIN_BOB_PERIOD_SECONDS * 3) / 4)).toBeCloseTo(-COIN_BOB_AMPLITUDE);
  });

  it('elapsedFullPeriod-returnsCloseToZero', () => {
    expect(coinBobOffset(COIN_BOB_PERIOD_SECONDS)).toBeCloseTo(0);
  });
});

describe('coin view', () => {
  it('key-isCoin-andDrawLayerIsBeforeEnemies', () => {
    expect(coin.key).toBe('coin');
    expect(coin.drawLayer).toBe('beforeEnemies');
  });

  it('spawn-seedsAnUncollectedCoinAtTheSourcePosition', () => {
    expect(coin.spawn({ id: 'pot', x: 1, y: 2 })).toEqual({
      id: 'pot',
      kind: 'coin',
      x: 1,
      y: 2,
      collected: false,
    });
  });

  it('onPickup-alwaysAsksForTheCoinsCounterPopup', () => {
    const placement = { id: 'coin-1', kind: 'coin' as const, x: 0, y: 0, collected: false };
    const outcome = coin.onPickup(placement, { pool: [], total: 1, collectedBefore: 0 });
    expect(outcome.counterKey).toBe('coins');
    expect(outcome.facts).toEqual([]);
  });

  it('onPickup-retainsTheEntryAndCarriesNoDisposition', () => {
    const placement = { id: 'coin-1', kind: 'coin' as const, x: 0, y: 0, collected: false };
    const outcome = coin.onPickup(placement, { pool: [], total: 1, collectedBefore: 0 });
    expect('disposition' in outcome).toBe(false);
    expect('self' in outcome).toBe(false);
  });
});
