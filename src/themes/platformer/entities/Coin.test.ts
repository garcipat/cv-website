import {
  COIN_FRAME_COUNT,
  COIN_FRAME_SIZE,
  COIN_FRAME_DURATION,
  COIN_BOB_AMPLITUDE,
  COIN_BOB_PERIOD_SECONDS,
  coinFrameIndex,
  coinFrameSource,
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

describe('coinFrameSource', () => {
  it('frameZero-returnsTopLeftOfSheet', () => {
    expect(coinFrameSource(0)).toEqual({ sx: 0, sy: 0 });
  });

  it('frameFive-returnsFifthFrameOffset', () => {
    expect(coinFrameSource(5)).toEqual({ sx: 5 * COIN_FRAME_SIZE, sy: 0 });
  });

  it('frameEqualToFrameCount-wrapsToFirstFrame', () => {
    expect(coinFrameSource(COIN_FRAME_COUNT)).toEqual({ sx: 0, sy: 0 });
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
