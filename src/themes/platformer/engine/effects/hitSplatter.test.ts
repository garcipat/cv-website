import { describe, expect, it, vi } from 'vitest';
import { makeMockContext, renderContext } from './testContext';
import {
  HIT_SPLATTER_DURATION_SECONDS,
  drawHitSplatterEffect,
  hitSplatterDroplets,
  startEnemyHitSplatter,
  startPlayerHitSplatter,
  startSpearBloodSplatter,
  tickHitSplatterEffect,
} from './hitSplatter';

describe('startPlayerHitSplatter', () => {
  it('contactSideRight-anchorsRightOfAndBelowCenter', () => {
    const effect = startPlayerHitSplatter('p', 100, 200, 1);
    expect(effect.state.x).toBeGreaterThan(100);
    expect(effect.state.y).toBeGreaterThan(200);
    expect(effect.state.dirBiasX).toBeGreaterThan(0);
  });

  it('contactSideLeft-anchorsLeftOfCenterMirroringTheRightCase', () => {
    const right = startPlayerHitSplatter('p', 100, 200, 1);
    const left = startPlayerHitSplatter('p', 100, 200, -1);
    expect(left.state.x - 100).toBeCloseTo(-(right.state.x - 100));
    expect(left.state.dirBiasX).toBeCloseTo(-right.state.dirBiasX);
  });

  it('noContactSide-anchorsExactlyAtCenterX', () => {
    const effect = startPlayerHitSplatter('p', 100, 200, 0);
    expect(effect.state.x).toBe(100);
    expect(effect.state.dirBiasX).toBe(0);
  });

  it('called-usesRedAndSevenDroplets', () => {
    const effect = startPlayerHitSplatter('p', 0, 0, 1);
    expect(effect.state.color).toBe('#a30f1f');
    expect(effect.state.dropletCount).toBe(7);
    expect(effect.elapsed).toBe(0);
  });
});

describe('startSpearBloodSplatter', () => {
  it('anchorsAtTheCharacterFeetWithNoHorizontalLean', () => {
    const effect = startSpearBloodSplatter('s', 100, 250);
    expect(effect.state.x).toBe(100);
    expect(effect.state.y).toBe(250);
    expect(effect.state.dirBiasX).toBe(0);
  });

  it('leansUpwardAndUsesTheSharedBloodRed', () => {
    const effect = startSpearBloodSplatter('s', 0, 0);
    expect(effect.state.dirBiasY).toBeLessThan(0);
    expect(effect.state.color).toBe('#a30f1f');
    expect(effect.elapsed).toBe(0);
  });

  it('shuffleStrideIsCoprimeWithTheDropletCount', () => {
    const effect = startSpearBloodSplatter('s', 0, 0);
    expect(effect.state.dropletCount % 3).not.toBe(0);
  });
});

describe('startEnemyHitSplatter', () => {
  it('greenSlime-usesGreenGooColor', () => {
    expect(startEnemyHitSplatter('e', 50, 60, 'slimeGreen').state.color).toBe('#3ddc55');
  });

  it('purpleSlime-usesPurpleGooColorDistinctFromGreen', () => {
    const green = startEnemyHitSplatter('e', 50, 60, 'slimeGreen');
    const purple = startEnemyHitSplatter('e', 50, 60, 'slimePurple');
    expect(purple.state.color).not.toBe(green.state.color);
  });

  it('called-anchorsExactlyAtGivenTopXY', () => {
    const effect = startEnemyHitSplatter('e', 50, 60, 'slimeGreen');
    expect(effect.state.x).toBe(50);
    expect(effect.state.y).toBe(60);
  });

  it('called-usesMoreDropletsThanThePlayersSplatter', () => {
    const effect = startEnemyHitSplatter('e', 0, 0, 'slimeGreen');
    expect(effect.state.dropletCount).toBe(13);
    expect(effect.state.dropletCount).toBeGreaterThan(
      startPlayerHitSplatter('p', 0, 0, 1).state.dropletCount,
    );
  });

  it('called-biasesUpwardNotSideways', () => {
    const effect = startEnemyHitSplatter('e', 0, 0, 'slimeGreen');
    expect(effect.state.dirBiasY).toBeLessThan(0);
    expect(effect.state.dirBiasX).toBe(0);
  });
});

describe('tickHitSplatterEffect', () => {
  it('called-advancesElapsedByDt', () => {
    const effect = tickHitSplatterEffect(startPlayerHitSplatter('p', 0, 0, 1), 0.1);
    expect(effect.elapsed).toBeCloseTo(0.1);
  });
});

describe('hitSplatterDroplets', () => {
  it('freshEffect-returnsExactlyDropletCountEntriesAllAtAnchorFullOpacity', () => {
    const effect = startPlayerHitSplatter('p', 0, 0, 1);
    const droplets = hitSplatterDroplets(effect);
    expect(droplets).toHaveLength(effect.state.dropletCount);
    for (const d of droplets) {
      expect(d.dx).toBe(0);
      expect(d.dy).toBe(0);
      expect(d.opacity).toBe(1);
    }
  });

  it('sevenDroplets-verticalSpreadIsNotDegenerate', () => {
    const effect = tickHitSplatterEffect(startPlayerHitSplatter('p', 0, 0, 1), 0.3);
    const dys = hitSplatterDroplets(effect).map((d) => d.dy);
    expect(new Set(dys).size).toBeGreaterThan(1);
  });

  it('thirteenDroplets-verticalSpreadIsNotDegenerate', () => {
    const effect = tickHitSplatterEffect(startEnemyHitSplatter('e', 0, 0, 'slimeGreen'), 0.3);
    const dys = hitSplatterDroplets(effect).map((d) => d.dy);
    expect(new Set(dys).size).toBeGreaterThan(1);
  });

  it('calledTwiceWithSameEffect-returnsIdenticalResult', () => {
    const effect = tickHitSplatterEffect(startEnemyHitSplatter('e', 10, 20, 'slimePurple'), 0.2);
    expect(hitSplatterDroplets(effect)).toEqual(hitSplatterDroplets(effect));
  });

  it('midway-appliesGravitySoDyExceedsLinearProjection', () => {
    const early = tickHitSplatterEffect(startEnemyHitSplatter('e', 0, 0, 'slimeGreen'), 0.1);
    const late = tickHitSplatterEffect(startEnemyHitSplatter('e', 0, 0, 'slimeGreen'), 0.5);
    const earlyDy0 = hitSplatterDroplets(early)[0].dy;
    const lateDy0 = hitSplatterDroplets(late)[0].dy;
    expect(lateDy0).toBeGreaterThan((earlyDy0 / 0.1) * 0.5);
  });

  it('beforeFadeStart-opacityIsFullyOpaque', () => {
    const effect = tickHitSplatterEffect(startPlayerHitSplatter('p', 0, 0, 1), 0.2);
    expect(hitSplatterDroplets(effect)[0].opacity).toBe(1);
  });

  it('pastFadeStart-opacityIsBelowOne', () => {
    const effect = tickHitSplatterEffect(
      startPlayerHitSplatter('p', 0, 0, 1),
      HIT_SPLATTER_DURATION_SECONDS * 0.85,
    );
    const opacity = hitSplatterDroplets(effect)[0].opacity;
    expect(opacity).toBeLessThan(1);
    expect(opacity).toBeGreaterThan(0);
  });

  it('atOrPastDuration-opacityIsZero', () => {
    const effect = tickHitSplatterEffect(startPlayerHitSplatter('p', 0, 0, 1), HIT_SPLATTER_DURATION_SECONDS);
    expect(hitSplatterDroplets(effect)[0].opacity).toBe(0);
    const wayPast = tickHitSplatterEffect(
      startPlayerHitSplatter('p', 0, 0, 1),
      HIT_SPLATTER_DURATION_SECONDS + 5,
    );
    expect(hitSplatterDroplets(wayPast)[0].opacity).toBe(0);
  });
});

describe('hit splatter expiry boundary', () => {
  it('atExactlyTheDuration-isNotExpired', () => {
    const effect = tickHitSplatterEffect(startPlayerHitSplatter('p', 0, 0, 1), HIT_SPLATTER_DURATION_SECONDS);
    expect(effect.expired(effect)).toBe(false);
  });

  it('pastTheDuration-isExpired', () => {
    const effect = tickHitSplatterEffect(
      startPlayerHitSplatter('p', 0, 0, 1),
      HIT_SPLATTER_DURATION_SECONDS + 0.0001,
    );
    expect(effect.expired(effect)).toBe(true);
  });
});

describe('drawHitSplatterEffect', () => {
  it('freshEffect-drawsOneFillRectPerDroplet', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    const effect = startPlayerHitSplatter('p', 100, 200, 1);

    drawHitSplatterEffect(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    expect(ctx.fillRect).toHaveBeenCalledTimes(effect.state.dropletCount);
  });

  it('expiredEffect-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    const effect = tickHitSplatterEffect(startPlayerHitSplatter('p', 100, 200, 1), 10);

    drawHitSplatterEffect(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('enemyEffect-usesTheEffectsOwnColorAsFillStyle', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    const setFillStyle = vi.fn();
    Object.defineProperty(ctx, 'fillStyle', { set: setFillStyle, get: () => '' });
    const effect = startEnemyHitSplatter('e', 10, 20, 'slimePurple');

    drawHitSplatterEffect(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    expect(setFillStyle).toHaveBeenCalledWith(effect.state.color);
  });
});

describe('hitSplatterDroplets byte identity', () => {
  it('sampledProgress-emitsTheExactPreRefactorOffsetsAndOpacity', () => {
    // contactSide 0 → dirBias 0; player spread is 17 x 12, 7 droplets, gravity 60.
    const effect = tickHitSplatterEffect(startPlayerHitSplatter('p', 0, 0, 0), 0.1);
    const progress = 0.1 / HIT_SPLATTER_DURATION_SECONDS;
    const droplets = hitSplatterDroplets(effect);

    expect(droplets).toHaveLength(7);
    // i=0: spreadFracX = -0.5, shuffled = 0 → spreadFracY = -0.5.
    expect(droplets[0].dx).toBeCloseTo(-0.5 * 17 * progress, 12);
    expect(droplets[0].dy).toBeCloseTo(-0.5 * 12 * progress + 60 * progress * progress, 12);
    expect(droplets[0].opacity).toBe(1);
  });
});
