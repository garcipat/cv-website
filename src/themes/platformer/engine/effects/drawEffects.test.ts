import { describe, expect, it, vi } from 'vitest';
import { makeMockContext, renderContext } from './testContext';
import { drawEffects } from './drawEffects';
import { startPuffEffect } from './puff';
import { startFadeOutTextEffect } from './fadeOutText';
import { startHealAuraEffect } from './healAura';
import { startCounterPopup } from './counterPopup';
import { startDebrisEffect } from './debris';
import { startExplosionEffect } from './explosion';
import type { EffectRenderContext } from './transientEffect';

const withSprites = (
  ctx: CanvasRenderingContext2D,
  effects: EffectRenderContext['effects'],
  sprites: Record<string, HTMLImageElement>,
  origin = { x: 0, y: 0 },
): EffectRenderContext =>
  renderContext(ctx, effects, {
    dc: { ctx, sprites, originX: origin.x, originY: origin.y, worldElapsed: 0 },
  });

describe('drawEffects — layer filtering', () => {
  it('drawsOnlyTheRequestedLayer', () => {
    const ctx = makeMockContext() as unknown as { createRadialGradient: ReturnType<typeof vi.fn> };
    const aura = startHealAuraEffect('h');
    const effects = [aura];

    drawEffects(renderContext(ctx as unknown as CanvasRenderingContext2D, effects), 'worldEffects', effects);
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();

    drawEffects(renderContext(ctx as unknown as CanvasRenderingContext2D, effects), 'midWorld', effects);
    expect(ctx.createRadialGradient).toHaveBeenCalled();
  });

  it('midWorldDrawsOnlyHealAuras', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effects = [startFadeOutTextEffect('f', 0, 0, 'x'), startHealAuraEffect('h')];
    drawEffects(
      renderContext(ctx as unknown as CanvasRenderingContext2D, effects),
      'midWorld',
      effects,
    );
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('aboveWorldDrawsOnlyExplosions', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn>; arc: ReturnType<typeof vi.fn> };
    const puff = startPuffEffect('p', 0, 0);
    const explosion = startExplosionEffect('e', 100, 200);
    const effects = [puff, explosion];
    const rc = withSprites(ctx as unknown as CanvasRenderingContext2D, effects, {
      '/sprites/explosion.png': { tag: 'explosion' } as unknown as HTMLImageElement,
    });
    drawEffects(rc, 'aboveWorld', effects);
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('hudLastDrawsOnlyCounterPopups', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn>; arc: ReturnType<typeof vi.fn> };
    const coinIcon = { tag: 'coin' } as unknown as HTMLImageElement;
    const popup = startCounterPopup('coins', 1, 4);
    const puff = startPuffEffect('p', 0, 0);
    const effects = [popup, puff];
    const rc = renderContext(ctx as unknown as CanvasRenderingContext2D, effects, {
      popupIcons: { coins: { icon: coinIcon, iconFrame: { sx: 0, sy: 0, size: 16 } } },
    });
    drawEffects(rc, 'hudLast', effects);
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalledWith(
      coinIcon,
      0,
      0,
      16,
      16,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('emptyCollection-drawsNothingAtAnyLayer', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn>; arc: ReturnType<typeof vi.fn>; drawImage: ReturnType<typeof vi.fn> };
    for (const layer of ['midWorld', 'worldEffects', 'aboveWorld', 'hudLast'] as const) {
      drawEffects(renderContext(ctx as unknown as CanvasRenderingContext2D, []), layer, []);
    }
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawEffects — ordering and context', () => {
  it('withinALayer-followsRegistryDeclarationOrder', () => {
    const order: string[] = [];
    const ctx = {
      ...makeMockContext(),
      arc: vi.fn(() => order.push('arc')),
      fillText: vi.fn(() => order.push('fillText')),
    } as unknown as CanvasRenderingContext2D;
    // World-effects declaration order is puff → debris → hitSplatter → fadeOutText.
    const effects = [startFadeOutTextEffect('f', 0, 0, 'x'), startPuffEffect('p', 10, 10)];
    drawEffects(renderContext(ctx, effects), 'worldEffects', effects);
    expect(order.indexOf('arc')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('fillText')).toBeGreaterThan(order.indexOf('arc'));
  });

  it('midWorldHealAuraReceivesTheLivePlayerAnchor', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const aura = startHealAuraEffect('h');
    const effects = [aura];
    drawEffects(
      renderContext(ctx as unknown as CanvasRenderingContext2D, effects, {
        playerAnchor: { centerX: 123, centerY: 456, headBottomY: 0, width: 64 },
      }),
      'midWorld',
      effects,
    );
    const [cx, cy] = ctx.arc.mock.calls[0];
    expect(cx).toBeCloseTo(123, 0);
    expect(cy).toBeCloseTo(456, 0);
  });

  it('worldEffectsFadeOutTextReceivesTheDrawContextOrigin', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effect = startFadeOutTextEffect('f', 100, 200, 'Checkpoint');
    const effects = [effect];
    drawEffects(
      renderContext(ctx as unknown as CanvasRenderingContext2D, effects, {
        dc: {
          ctx: ctx as unknown as CanvasRenderingContext2D,
          sprites: {},
          originX: 50,
          originY: 20,
          worldElapsed: 0,
        },
      }),
      'worldEffects',
      effects,
    );
    expect(ctx.fillText).toHaveBeenCalledWith('Checkpoint', 150, 220);
  });

  it('worldEffectsDebrisReceivesTheDrawContextOrigin', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const image = { tag: 'debris' } as unknown as HTMLImageElement;
    const effect = startDebrisEffect('d', 100, 200, [
      { sheet: 'a.png', sx: 0, sy: 0, width: 8, height: 8 },
    ]);
    const effects = [effect];
    drawEffects(
      withSprites(ctx as unknown as CanvasRenderingContext2D, effects, { 'a.png': image }, { x: 10, y: 0 }),
      'worldEffects',
      effects,
    );
    expect(ctx.drawImage).toHaveBeenCalledTimes(4);
    // First quarter at rest: origin 10 + effect x 100 + 0 offset.
    expect(ctx.drawImage.mock.calls[0][5]).toBe(110);
  });

  it('hudLastCounterPopupReceivesTheLiveCollectionForRowLayout', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const coin = startCounterPopup('coins', 2, 4);
    const fruit = startCounterPopup('fruits', 1, 2);
    const effects = [coin, fruit];
    const rc = renderContext(ctx as unknown as CanvasRenderingContext2D, effects, {
      popupIcons: {
        coins: { icon: {} as HTMLImageElement, iconFrame: { sx: 0, sy: 0, size: 16 } },
        fruits: { icon: {} as HTMLImageElement, iconFrame: { sx: 0, sy: 0, size: 16 } },
      },
    });
    drawEffects(rc, 'hudLast', effects);
    expect(ctx.fillText).toHaveBeenCalledWith('2 / 4', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('1 / 2', expect.any(Number), expect.any(Number));
  });
});
