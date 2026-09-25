import { describe, expect, it } from 'vitest';
import { advanceEffects, defaultExpired, defaultTick, type TransientEffect } from './transientEffect';
import type { EffectRegistryEntry } from './effectRegistry';
import { drawEffectsFrom } from './drawEffects';
import { makeMockContext, renderContext } from './testContext';

/**
 * The throwaway effect from the contributor recipe
 * (docs/TransientEffectRecipe.md): one module's worth of data/create/draw
 * behaviour, with no edit to the state collection, the tick, the draw pass, or
 * reset code. It reuses an existing `kind` slot because `EffectKind` is the
 * extensible shipped set; only the local registry below is consulted.
 */
interface ThrowawayState {
  brightness: number;
}

const createThrowawayEffect = (brightness: number): TransientEffect<ThrowawayState> => ({
  kind: 'puff',
  id: `throwaway-${brightness}`,
  duration: 0.5,
  elapsed: 0,
  state: { brightness },
  tick: defaultTick,
  draw: (effect, rc) => {
    rc.ctx.fillStyle = `brightness:${effect.state.brightness}`;
  },
  expired: defaultExpired,
});

/** The one registry line. */
const THROWAWAY_ENTRY: EffectRegistryEntry<ThrowawayState> = {
  kind: 'puff',
  create: createThrowawayEffect as unknown as (...args: never[]) => TransientEffect<ThrowawayState>,
  draw: (effect, rc) => effect.draw(effect, rc),
  layer: 'midWorld',
  resetScope: 'progress',
};

const asWidened = (entry: EffectRegistryEntry<ThrowawayState>): EffectRegistryEntry<unknown> =>
  entry as unknown as EffectRegistryEntry<unknown>;

describe('transient effect recipe', () => {
  it('aThrowawayKind-startsWithTheBaseFields', () => {
    const effect = createThrowawayEffect(3);
    expect(effect).toMatchObject({ id: 'throwaway-3', elapsed: 0, duration: 0.5 });
    expect(effect.state).toEqual({ brightness: 3 });
  });

  it('aThrowawayKind-advancesThroughTheOneAdvance', () => {
    const advanced = advanceEffects([createThrowawayEffect(3)], 0.2);
    expect(advanced).toHaveLength(1);
    expect(advanced[0].elapsed).toBeCloseTo(0.2, 10);
  });

  it('aThrowawayKind-expiresViaItsRegisteredBoundary', () => {
    expect(advanceEffects([createThrowawayEffect(3)], 0.5)).toHaveLength(1);
    expect(advanceEffects([createThrowawayEffect(3)], 0.5001)).toEqual([]);
  });

  it('aThrowawayKind-drawsOnlyAtItsDeclaredLayer', () => {
    const ctx = makeMockContext();
    const effect = createThrowawayEffect(7);
    const effects = [effect];
    const registry = [asWidened(THROWAWAY_ENTRY)];

    drawEffectsFrom(registry, renderContext(ctx, effects), 'worldEffects', effects);
    expect(ctx.fillStyle).toBe('');

    drawEffectsFrom(registry, renderContext(ctx, effects), 'midWorld', effects);
    expect(ctx.fillStyle).toBe('brightness:7');
  });
});
