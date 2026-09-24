import {
  COIN_FRAME_COUNT,
  COIN_FRAME_DURATION,
  COIN_BOB_AMPLITUDE,
  COIN_BOB_PERIOD_SECONDS,
  coinFrameIndex,
  coinBobOffset,
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
