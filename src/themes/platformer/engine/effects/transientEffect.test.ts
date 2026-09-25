import { describe, expect, it } from 'vitest';
import {
  advanceEffects,
  clearEffectsByResetScope,
  defaultExpired,
  defaultTick,
  effectCount,
  type TransientEffect,
} from './transientEffect';
import { startPuffEffect } from './puff';
import { startFadeOutTextEffect } from './fadeOutText';
import { startPlayerHitSplatter } from './hitSplatter';

/** A minimal effect with a controllable duration/kind, for boundary tests. */
const stub = (
  kind: TransientEffect<unknown>['kind'],
  id: string,
  duration: number,
  elapsed = 0,
): TransientEffect<unknown> => ({
  kind,
  id,
  duration,
  elapsed,
  state: {},
  tick: defaultTick,
  draw: () => undefined,
  expired: defaultExpired,
});

describe('defaultTick', () => {
  it('called-advancesElapsedByDtPreservingEverythingElse', () => {
    const effect = startPuffEffect('p', 1, 2, 3, true);
    const ticked = defaultTick(effect, 0.1);
    expect(ticked.elapsed).toBeCloseTo(0.1, 10);
    expect(ticked.state).toEqual({ x: 1, y: 2, scale: 3, pixel: true });
  });
});

describe('defaultExpired', () => {
  it('atExactlyDuration-isNotExpired', () => {
    expect(defaultExpired(stub('puff', 'p', 1, 1))).toBe(false);
  });

  it('pastDuration-isExpired', () => {
    expect(defaultExpired(stub('puff', 'p', 1, 1.0001))).toBe(true);
  });

  it('beforeDuration-isNotExpired', () => {
    expect(defaultExpired(stub('puff', 'p', 1, 0.5))).toBe(false);
  });
});

describe('advanceEffects', () => {
  it('noFilter-ticksAndKeepsLiveEffects', () => {
    const effect = startPuffEffect('p', 0, 0);
    const next = advanceEffects([effect], 0.1);
    expect(next).toHaveLength(1);
    expect(next[0].elapsed).toBeCloseTo(0.1, 10);
  });

  it('expiredEffect-isDropped', () => {
    const effect = startPuffEffect('p', 0, 0);
    const next = advanceEffects([effect], 10);
    expect(next).toEqual([]);
  });

  it('counterPopupNullSentinel-isDropped', () => {
    // The counter popup's tick returns null at/after its duration; advanceEffects
    // must drop it rather than keep a null in the collection.
    const effect = startFadeOutTextEffect('f', 0, 0, 'x');
    const next = advanceEffects([effect], 10);
    expect(next).toEqual([]);
  });

  it('withKindsFilter-ticksOnlyNamedKindsAndLeavesOthersByteUnchanged', () => {
    const splatter = startPlayerHitSplatter('s', 0, 0, 1);
    const puff = startPuffEffect('p', 0, 0);
    const next = advanceEffects([splatter, puff], 0.2, { kinds: ['hitSplatter'] });
    expect(next[0]).not.toBe(splatter);
    expect(next[0].elapsed).toBeCloseTo(0.2, 10);
    expect(next[1]).toBe(puff);
    expect(next[1].elapsed).toBe(0);
  });

  it('withKindsFilter-prunesOnlyNamedKindsExpired', () => {
    const splatter = startPlayerHitSplatter('s', 0, 0, 1);
    const puff = startPuffEffect('p', 0, 0);
    const next = advanceEffects([splatter, puff], 10, { kinds: ['hitSplatter'] });
    expect(next).toEqual([puff]);
  });
});

describe('clearEffectsByResetScope', () => {
  it('deathScope-removesOnlyFadeOutTextEffects', () => {
    const fade = startFadeOutTextEffect('f', 0, 0, 'x');
    const puff = startPuffEffect('p', 0, 0);
    const next = clearEffectsByResetScope([fade, puff], 'death');
    expect(next).toEqual([puff]);
  });

  it('progressScope-removesEveryNonDeathKind', () => {
    const fade = startFadeOutTextEffect('f', 0, 0, 'x');
    const puff = startPuffEffect('p', 0, 0);
    const next = clearEffectsByResetScope([fade, puff], 'progress');
    expect(next).toEqual([fade]);
  });

  it('omittedScope-clearsEverything', () => {
    const fade = startFadeOutTextEffect('f', 0, 0, 'x');
    const puff = startPuffEffect('p', 0, 0);
    expect(clearEffectsByResetScope([fade, puff])).toEqual([]);
  });
});

describe('effectCount', () => {
  it('emptyCollection-isZero', () => {
    expect(effectCount([], 'flight')).toBe(0);
  });

  it('countsOnlyTheNamedKind', () => {
    const collection = [
      startPuffEffect('p1', 0, 0),
      startPuffEffect('p2', 0, 0),
      startFadeOutTextEffect('f', 0, 0, 'x'),
    ];
    expect(effectCount(collection, 'puff')).toBe(2);
    expect(effectCount(collection, 'flight')).toBe(0);
  });

  it('unrelatedKind-inACollectionOfOtherKindsIsZero', () => {
    const collection = [startPlayerHitSplatter('s', 0, 0, 1), startPlayerHitSplatter('s2', 0, 0, 1)];
    expect(effectCount(collection, 'debris')).toBe(0);
  });
});
