import { describe, expect, it, vi } from 'vitest';
import { makeMockContext, renderContext } from './testContext';
import {
  FADE_OUT_TEXT_DURATION_SECONDS,
  drawFadeOutText,
  fadeOutTextOpacity,
  startFadeOutTextEffect,
  tickFadeOutTextEffect,
} from './fadeOutText';

describe('FadeOutTextEffect', () => {
  it('startFadeOutTextEffect-carriesItsOwnTextAtZeroElapsed', () => {
    const effect = startFadeOutTextEffect('checkpoint-1-2', 30, 40, 'Checkpoint');
    expect(effect).toMatchObject({ kind: 'fadeOutText', id: 'checkpoint-1-2', elapsed: 0 });
    expect(effect.state).toEqual({ x: 30, y: 40, text: 'Checkpoint' });
  });

  it('tickFadeOutTextEffect-advancesElapsedByDt', () => {
    const effect = tickFadeOutTextEffect(startFadeOutTextEffect('a', 0, 0, 't'), 0.2);
    expect(effect.elapsed).toBeCloseTo(0.2);
  });

  it('fadeOutTextOpacity-isFullAtStartAndFadesLinearlyToZeroByTheDuration', () => {
    expect(fadeOutTextOpacity(0)).toBe(1);
    expect(fadeOutTextOpacity(FADE_OUT_TEXT_DURATION_SECONDS / 2)).toBeCloseTo(0.5);
    expect(fadeOutTextOpacity(FADE_OUT_TEXT_DURATION_SECONDS)).toBe(0);
  });

  it('fadeOutTextOpacity-isZeroOutsideTheWindow', () => {
    expect(fadeOutTextOpacity(-0.1)).toBe(0);
    expect(fadeOutTextOpacity(FADE_OUT_TEXT_DURATION_SECONDS + 1)).toBe(0);
  });
});

describe('fade-out text expiry boundary', () => {
  it('atExactlyTheDuration-isNotExpired', () => {
    const effect = tickFadeOutTextEffect(
      startFadeOutTextEffect('a', 0, 0, 't'),
      FADE_OUT_TEXT_DURATION_SECONDS,
    );
    expect(effect.expired(effect)).toBe(false);
  });

  it('pastTheDuration-isExpired', () => {
    const effect = tickFadeOutTextEffect(
      startFadeOutTextEffect('a', 0, 0, 't'),
      FADE_OUT_TEXT_DURATION_SECONDS + 0.0001,
    );
    expect(effect.expired(effect)).toBe(true);
  });
});

describe('drawFadeOutText', () => {
  it('activeLabel-drawsItsTextAtWorldXPlusOrigin', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effect = startFadeOutTextEffect('a', 100, 200, 'Checkpoint');
    const rc = renderContext(ctx as unknown as CanvasRenderingContext2D, [effect], {
      dc: {
        ctx: ctx as unknown as CanvasRenderingContext2D,
        sprites: {},
        originX: 50,
        originY: 20,
        worldElapsed: 0,
      },
    });

    drawFadeOutText(effect, rc);

    expect(ctx.fillText).toHaveBeenCalledWith('Checkpoint', 150, 220);
  });

  it('expiredLabel-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effect = tickFadeOutTextEffect(
      startFadeOutTextEffect('a', 0, 0, 'x'),
      FADE_OUT_TEXT_DURATION_SECONDS + 1,
    );

    drawFadeOutText(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});
