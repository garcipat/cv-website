import { describe, expect, it, vi } from 'vitest';
import { makeMockContext, renderContext } from './testContext';
import {
  SPARKLE_DURATION_SECONDS,
  drawPuffEffect,
  sparkleParticles,
  startPuffEffect,
  tickPuffEffect,
} from './puff';

describe('sparkleParticles', () => {
  it('elapsedZero-returnsSixParticlesAtFullOpacity', () => {
    const particles = sparkleParticles(0);
    expect(particles).toHaveLength(6);
    expect(particles.every((p) => p.opacity === 1)).toBe(true);
    expect(particles.every((p) => p.dx === 0 && p.dy === 0)).toBe(true);
  });

  it('midway-particlesHaveMovedAndFadedPartially', () => {
    const particles = sparkleParticles(SPARKLE_DURATION_SECONDS / 2);
    expect(particles.some((p) => p.dx !== 0 || p.dy !== 0)).toBe(true);
    expect(particles[0].opacity).toBeCloseTo(0.5);
  });

  it('pastDuration-returnsEmptyArray', () => {
    expect(sparkleParticles(SPARKLE_DURATION_SECONDS + 0.01)).toEqual([]);
  });
});

describe('sparkleParticles scale', () => {
  it('scaleOf2-doublesEveryParticlesOffsetFromDefault', () => {
    const base = sparkleParticles(SPARKLE_DURATION_SECONDS / 2);
    const scaled = sparkleParticles(SPARKLE_DURATION_SECONDS / 2, 2);
    expect(scaled).toHaveLength(base.length);
    scaled.forEach((particle, i) => {
      expect(particle.dx).toBeCloseTo(base[i].dx * 2);
      expect(particle.dy).toBeCloseTo(base[i].dy * 2);
    });
  });

  it('noScaleArgument-behavesExactlyLikeScaleOf1', () => {
    expect(sparkleParticles(SPARKLE_DURATION_SECONDS / 2)).toEqual(
      sparkleParticles(SPARKLE_DURATION_SECONDS / 2, 1),
    );
  });
});

describe('startPuffEffect / tickPuffEffect', () => {
  it('startPuffEffect-noScaleArgument-defaultsScaleTo1AndSoftStyle', () => {
    const effect = startPuffEffect('rock-1', 100, 200);
    expect(effect).toMatchObject({ kind: 'puff', id: 'rock-1', elapsed: 0 });
    expect(effect.state).toEqual({ x: 100, y: 200, scale: 1, pixel: false });
  });

  it('startPuffEffect-withScale-storesIt', () => {
    expect(startPuffEffect('slime-1', 50, 60, 1.5).state.scale).toBe(1.5);
  });

  it('startPuffEffect-withPixelStyle-storesIt', () => {
    expect(startPuffEffect('checkpoint-0-0', 10, 20, 1, true).state.pixel).toBe(true);
  });

  it('tickPuffEffect-advancesElapsedByDt-preservesEverythingElse', () => {
    const ticked = tickPuffEffect(startPuffEffect('rock-1', 100, 200, 1.5), 0.1);
    expect(ticked).toMatchObject({ id: 'rock-1', elapsed: 0.1 });
    expect(ticked.state).toEqual({ x: 100, y: 200, scale: 1.5, pixel: false });
  });
});

describe('puff expiry boundary', () => {
  it('atExactlyTheDuration-isNotExpired', () => {
    const effect = tickPuffEffect(startPuffEffect('p', 0, 0), SPARKLE_DURATION_SECONDS);
    expect(effect.expired(effect)).toBe(false);
  });

  it('pastTheDuration-isExpired', () => {
    const effect = tickPuffEffect(startPuffEffect('p', 0, 0), SPARKLE_DURATION_SECONDS + 0.0001);
    expect(effect.expired(effect)).toBe(true);
  });
});

describe('sparkleParticles byte identity', () => {
  it('sampledElapsedTimes-emitTheExactPreRefactorOffsetsAndOpacity', () => {
    const half = sparkleParticles(SPARKLE_DURATION_SECONDS / 2);
    // radius = 18 * 0.5 = 9, opacity = 1 - 0.5 = 0.5.
    expect(half[0]).toEqual({ dx: 9, dy: 0, opacity: 0.5 });
    expect(half[1].dx).toBeCloseTo(9 * Math.cos(Math.PI / 3), 12);
    expect(half[1].dy).toBeCloseTo(9 * Math.sin(Math.PI / 3), 12);
    expect(half.every((particle) => particle.opacity === 0.5)).toBe(true);

    const quarter = sparkleParticles(SPARKLE_DURATION_SECONDS / 4);
    expect(quarter[0].dx).toBeCloseTo(18 * 0.25, 12);
    expect(quarter[0].opacity).toBeCloseTo(0.75, 12);
  });
});

describe('drawPuffEffect', () => {
  it('freshPuff-drawsSixSparkleCircles', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = startPuffEffect('rock-1', 100, 200);

    drawPuffEffect(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    expect(ctx.arc).toHaveBeenCalledTimes(6);
  });

  it('freshPuff-neverCallsFillText', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effect = startPuffEffect('rock-1', 100, 200);

    drawPuffEffect(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('puffAtItsOwnXY-drawsCirclesCenteredThere-not0-0', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = startPuffEffect('rock-1', 100, 200);

    drawPuffEffect(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    const [cx, cy] = ctx.arc.mock.calls[0];
    expect(cx).toBeCloseTo(100, 0);
    expect(cy).toBeCloseTo(200, 0);
  });

  it('scaledPuff-drawsWiderCircleRadiusThanUnscaled', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const unscaled = startPuffEffect('a', 0, 0, 1);
    const scaled = startPuffEffect('b', 0, 0, 2);

    drawPuffEffect(unscaled, renderContext(ctx as unknown as CanvasRenderingContext2D, [unscaled]));
    const unscaledRadius = ctx.arc.mock.calls[0][2];
    ctx.arc.mockClear();
    drawPuffEffect(scaled, renderContext(ctx as unknown as CanvasRenderingContext2D, [scaled]));
    const scaledRadius = ctx.arc.mock.calls[0][2];

    expect(scaledRadius).toBeGreaterThan(unscaledRadius);
  });

  it('expiredPuff-doesNotDrawSparkleCircles', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = tickPuffEffect(startPuffEffect('rock-1', 100, 200), SPARKLE_DURATION_SECONDS + 0.01);

    drawPuffEffect(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    expect(ctx.arc).not.toHaveBeenCalled();
  });
});
