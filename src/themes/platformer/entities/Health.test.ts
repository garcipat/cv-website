import {
  MAX_HEARTS,
  MAX_HALF_HEARTS,
  PIT_FALL_DAMAGE,
  HEART_FRAME_SIZE,
  HEART_RENDERED_SIZE,
  takeDamage,
  heartRemaining,
  heartFrameIndex,
} from './Health';

describe('Health constants', () => {
  it('maxHearts-is3AndMaxHalfHearts-is6', () => {
    expect(MAX_HEARTS).toBe(3);
    expect(MAX_HALF_HEARTS).toBe(6);
  });

  it('pitFallDamage-isOneHalfHeartUnit', () => {
    expect(PIT_FALL_DAMAGE).toBe(1);
  });

  it('heartRenderedSize-isFrameSizeTimesRenderScale', () => {
    expect(HEART_FRAME_SIZE).toBe(32);
    expect(HEART_RENDERED_SIZE).toBe(64);
  });
});

describe('takeDamage', () => {
  it('fullHealth-losingHalfHeart-subtractsAmount', () => {
    expect(takeDamage(MAX_HALF_HEARTS, PIT_FALL_DAMAGE)).toBe(5);
  });

  it('amountExceedsCurrent-clampsToZero', () => {
    expect(takeDamage(1, 5)).toBe(0);
  });

  it('atZero-furtherDamage-staysAtZero', () => {
    expect(takeDamage(0, PIT_FALL_DAMAGE)).toBe(0);
  });

  it('repeatedPitFalls-eventuallyReachesZero', () => {
    let health = MAX_HALF_HEARTS;
    for (let i = 0; i < 6; i++) health = takeDamage(health, PIT_FALL_DAMAGE);
    expect(health).toBe(0);
  });
});

describe('heartRemaining', () => {
  it('sixHalfHearts-allThreeHeartsFull', () => {
    expect(heartRemaining(6, 0)).toBe(2);
    expect(heartRemaining(6, 1)).toBe(2);
    expect(heartRemaining(6, 2)).toBe(2);
  });

  it('fiveHalfHearts-firstTwoFullThirdHalf', () => {
    expect(heartRemaining(5, 0)).toBe(2);
    expect(heartRemaining(5, 1)).toBe(2);
    expect(heartRemaining(5, 2)).toBe(1);
  });

  it('oneHalfHeart-onlyFirstHeartHalfRestEmpty', () => {
    expect(heartRemaining(1, 0)).toBe(1);
    expect(heartRemaining(1, 1)).toBe(0);
    expect(heartRemaining(1, 2)).toBe(0);
  });

  it('zeroHalfHearts-allThreeHeartsEmpty', () => {
    expect(heartRemaining(0, 0)).toBe(0);
    expect(heartRemaining(0, 1)).toBe(0);
    expect(heartRemaining(0, 2)).toBe(0);
  });
});

describe('heartFrameIndex', () => {
  it('twoRemaining-returnsFullFrame', () => {
    expect(heartFrameIndex(2)).toBe(0);
  });

  it('oneRemaining-returnsHalfFrame', () => {
    expect(heartFrameIndex(1)).toBe(1);
  });

  it('zeroRemaining-returnsEmptyFrame', () => {
    expect(heartFrameIndex(0)).toBe(2);
  });
});
