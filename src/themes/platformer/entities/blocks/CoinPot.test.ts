import { coinPot } from './CoinPot';
import { toBlockState } from '../Block';
import { PHYSICS_CONFIG } from '../../engine/PhysicsConfig';

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

describe('coinPot.onHit', () => {
  it('itsOnlyHit-dropsACoinAndBouncesThePlayer', () => {
    const pot = toBlockState({ id: 'p1', blockKind: 'coinPot', x: 0, y: 0 });

    const outcome = coinPot.onHit!({ ...pot, hitsTaken: 1 });

    expect(outcome).toEqual({
      spawnPickup: 'coin',
      bounceVelocity: PHYSICS_CONFIG.coinPotBounceVelocity,
    });
  });
});
