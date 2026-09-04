import { coinPot } from './CoinPot';

describe('coinPot BlockType', () => {
  it('maxHits-isOne', () => {
    expect(coinPot.maxHits).toBe(1);
  });

  it('removeWhenUsedUp-isTrue', () => {
    expect(coinPot.removeWhenUsedUp).toBe(true);
  });

  it('frameIndex-returnsAConstantFallback', () => {
    // The real per-instance visual comes from draw()'s use of
    // dc.coinPotPlan (see coinPotRenderPlan.ts) — frameIndex only exists to
    // satisfy BlockType for callers outside draw (e.g. blockFrameSource).
    expect(coinPot.frameIndex(0)).toBe(coinPot.frameIndex(1));
  });
});
