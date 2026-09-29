import { coinPot } from './CoinPot';
import { toBlockState } from '../Block';
import { POT_BOUNCE_VY } from './pot';

describe('coinPot BlockType', () => {
  it('sharedFactoryContract-fixesOneHitTopTriggerAndRemoval', () => {
    expect(coinPot.maxHits).toBe(1);
    expect(coinPot.removeWhenUsedUp).toBe(true);
    expect(coinPot.triggerSides).toEqual(['top']);
  });

  it('declaresItsOwnDropDropPolicyAndRespawnFlag', () => {
    expect(coinPot.pot).toMatchObject({
      drop: 'coin',
      dropPolicy: 'once',
      restoredOnRespawn: false,
    });
  });

  it('frameIndex-returnsAConstantFallback', () => {
    // The real per-instance visual comes from the clay-variant positional
    // rule (see clayVariants.ts) — frameIndex only exists to satisfy
    // BlockType for callers outside draw (e.g. blockFrameSource).
    expect(coinPot.frameIndex(0)).toBe(coinPot.frameIndex(1));
  });
});

describe('coinPot.onHit', () => {
  it('whileRewardNotGiven-dropsACoinAndBouncesThePlayer', () => {
    const pot = toBlockState({ id: 'p1', blockKind: 'coinPot', x: 0, y: 0 });

    const outcome = coinPot.onHit!({ ...pot, hitsTaken: 1, rewardGiven: false });

    expect(outcome).toEqual({
      spawnPickup: 'coin',
      effects: [{ type: 'velocity', y: POT_BOUNCE_VY, preserveJump: true }],
    });
  });

  it('afterRewardGiven-doesNotDropAgainButStillBouncesThePlayer', () => {
    const pot = toBlockState({ id: 'p1', blockKind: 'coinPot', x: 0, y: 0 });

    const outcome = coinPot.onHit!({ ...pot, hitsTaken: 1, rewardGiven: true });

    expect(outcome).toEqual({
      effects: [{ type: 'velocity', y: POT_BOUNCE_VY, preserveJump: true }],
    });
  });
});
