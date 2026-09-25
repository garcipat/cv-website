import { describe, expect, it, vi } from 'vitest';
import { makeMockContext, renderContext } from './testContext';
import {
  HEAL_AURA_DURATION_SECONDS,
  drawHealAuraEffect,
  healAuraOpacity,
  healAuraRays,
  healAuraSparkles,
  startHealAuraEffect,
  tickHealAuraEffect,
} from './healAura';

describe('startHealAuraEffect / tickHealAuraEffect', () => {
  it('startHealAuraEffect-startsAtZeroElapsed', () => {
    const effect = startHealAuraEffect('heart-1');
    expect(effect).toMatchObject({ kind: 'healAura', id: 'heart-1', elapsed: 0 });
    expect(effect.state).toEqual({});
  });

  it('tickHealAuraEffect-advancesElapsedByDt-preservesId', () => {
    const ticked = tickHealAuraEffect(startHealAuraEffect('heart-1'), 0.1);
    expect(ticked).toMatchObject({ id: 'heart-1', elapsed: 0.1 });
  });
});

describe('healAuraOpacity', () => {
  it('atStart-isFullyOpaque', () => {
    expect(healAuraOpacity(0)).toBe(1);
  });

  it('atHalfway-isHalfFaded', () => {
    expect(healAuraOpacity(HEAL_AURA_DURATION_SECONDS / 2)).toBeCloseTo(0.5);
  });

  it('pastDuration-isZero', () => {
    expect(healAuraOpacity(HEAL_AURA_DURATION_SECONDS + 0.01)).toBe(0);
  });

  it('negativeElapsed-isZero', () => {
    expect(healAuraOpacity(-0.01)).toBe(0);
  });
});

describe('healAuraRays', () => {
  it('pastDuration-returnsNoRays', () => {
    expect(healAuraRays(HEAL_AURA_DURATION_SECONDS + 0.01, 32)).toEqual([]);
  });

  it('withinDuration-returnsRaysSpreadAcrossTheGivenWidth', () => {
    const rays = healAuraRays(HEAL_AURA_DURATION_SECONDS / 2, 32);
    expect(rays.length).toBeGreaterThan(0);
    for (const ray of rays) {
      expect(Math.abs(ray.dx)).toBeLessThanOrEqual(16);
      expect(ray.height).toBeGreaterThan(0);
    }
  });

  it('laterElapsed-raysAreTaller', () => {
    const early = healAuraRays(0, 32)[0].height;
    const late = healAuraRays(HEAL_AURA_DURATION_SECONDS * 0.9, 32)[0].height;
    expect(late).toBeGreaterThan(early);
  });
});

describe('healAuraSparkles', () => {
  it('pastDuration-returnsNoSparkles', () => {
    expect(healAuraSparkles(HEAL_AURA_DURATION_SECONDS + 0.01, 32)).toEqual([]);
  });

  it('withinDuration-returnsSparklesRisingAboveTheAnchor', () => {
    const sparkles = healAuraSparkles(HEAL_AURA_DURATION_SECONDS / 2, 32);
    expect(sparkles.length).toBeGreaterThan(0);
    for (const sparkle of sparkles) {
      expect(sparkle.dy).toBeLessThan(0);
    }
  });

  it('laterElapsed-sparklesRiseFurther', () => {
    const early = healAuraSparkles(0.01, 32)[0].dy;
    const late = healAuraSparkles(HEAL_AURA_DURATION_SECONDS * 0.9, 32)[0].dy;
    expect(late).toBeLessThan(early);
  });
});

describe('heal aura expiry boundary', () => {
  it('atExactlyTheDuration-isNotExpired', () => {
    const effect = tickHealAuraEffect(startHealAuraEffect('h'), HEAL_AURA_DURATION_SECONDS);
    expect(effect.expired(effect)).toBe(false);
  });

  it('pastTheDuration-isExpired', () => {
    const effect = tickHealAuraEffect(startHealAuraEffect('h'), HEAL_AURA_DURATION_SECONDS + 0.0001);
    expect(effect.expired(effect)).toBe(true);
  });
});

describe('drawHealAuraEffect', () => {
  it('freshAura-drawsGlowCircleAndSparkleCirclesAtTheLiveAnchor', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = startHealAuraEffect('h1');

    drawHealAuraEffect(
      effect,
      renderContext(ctx as unknown as CanvasRenderingContext2D, [effect], {
        playerAnchor: { centerX: 100, centerY: 200, headBottomY: 0, width: 32 },
      }),
    );

    // 1 glow circle + 4 sparkle circles.
    expect(ctx.arc).toHaveBeenCalledTimes(5);
    const [cx, cy] = ctx.arc.mock.calls[0];
    expect(cx).toBeCloseTo(100, 0);
    expect(cy).toBeCloseTo(200, 0);
  });

  it('freshAura-drawsOneRayRectPerHealAuraRay', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    const effect = startHealAuraEffect('h1');

    drawHealAuraEffect(
      effect,
      renderContext(ctx as unknown as CanvasRenderingContext2D, [effect], {
        playerAnchor: { centerX: 100, centerY: 200, headBottomY: 0, width: 32 },
      }),
    );

    expect(ctx.fillRect).toHaveBeenCalledTimes(5);
  });

  it('expiredAura-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as {
      arc: ReturnType<typeof vi.fn>;
      fillRect: ReturnType<typeof vi.fn>;
    };
    const effect = tickHealAuraEffect(startHealAuraEffect('h1'), HEAL_AURA_DURATION_SECONDS + 0.01);

    drawHealAuraEffect(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});
