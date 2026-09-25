import { describe, expect, it } from 'vitest';
import {
  activeSpeechBubble,
  beginSpeechBubbleEnter,
  beginSpeechBubbleExit,
  drawSpeechBubble,
  drawSpeechBubbleEffect,
  SPEECH_BUBBLE_FADE_IN_SECONDS,
  SPEECH_BUBBLE_FADE_OUT_SECONDS,
  SPEECH_BUBBLE_TRANSIENT_DWELL_SECONDS,
  speechBubbleGrowthAndOpacity,
  startSpeechBubble,
  tickSpeechBubbleEffect,
  withSpeechBubbleText,
} from './speechBubble';
import { effectKeyOf } from './effectRegistry';
import { startPuffEffect } from './puff';
import { makeMockContext, renderContext } from './testContext';

const bridge = () => startSpeechBubble('bridgeDropThrough', 'Hold Down to drop through a bridge.');

describe('startSpeechBubble', () => {
  it('createsAnEnteringEffectAtZeroElapsedCarryingTheResolvedText', () => {
    const effect = bridge();

    expect(effect.kind).toBe('speechBubble');
    expect(effect.elapsed).toBe(0);
    expect(effect.state).toEqual({
      messageId: 'bridgeDropThrough',
      text: 'Hold Down to drop through a bridge.',
      phase: 'entering',
    });
  });
});

describe('tickSpeechBubbleEffect', () => {
  it('entering-beforeFadeInCompletes-staysEnteringAndAdvancesElapsed', () => {
    const effect = bridge();

    const ticked = tickSpeechBubbleEffect(effect, SPEECH_BUBBLE_FADE_IN_SECONDS / 2)!;

    expect(ticked.elapsed).toBe(SPEECH_BUBBLE_FADE_IN_SECONDS / 2);
    expect(ticked.state.phase).toBe('entering');
    expect(ticked.state.text).toBe(effect.state.text);
  });

  it('entering-onceFadeInCompletes-becomesShownAndResetsElapsed', () => {
    const ticked = tickSpeechBubbleEffect(bridge(), SPEECH_BUBBLE_FADE_IN_SECONDS)!;

    expect(ticked!.state.phase).toBe('shown');
    expect(ticked!.elapsed).toBe(0);
  });

  it('shown-ticking-staysShownIndefinitely', () => {
    const effect = bridge();
    const shown = { ...effect, state: { ...effect.state, phase: 'shown' as const } };

    const ticked = tickSpeechBubbleEffect(shown, 5)!;

    expect(ticked.state.phase).toBe('shown');
    expect(ticked.elapsed).toBe(5);
  });

  it('exiting-beforeFadeOutCompletes-staysExitingAndAdvancesElapsed', () => {
    const effect = bridge();
    const exiting = beginSpeechBubbleExit({ ...effect, state: { ...effect.state, phase: 'shown' } });

    const ticked = tickSpeechBubbleEffect(exiting, SPEECH_BUBBLE_FADE_OUT_SECONDS / 2)!;

    expect(ticked.state.phase).toBe('exiting');
    expect(ticked.elapsed).toBe(SPEECH_BUBBLE_FADE_OUT_SECONDS / 2);
  });

  it('exiting-onceFadeOutCompletes-returnsNull', () => {
    const effect = bridge();
    const exiting = beginSpeechBubbleExit({ ...effect, state: { ...effect.state, phase: 'shown' } });

    expect(tickSpeechBubbleEffect(exiting, SPEECH_BUBBLE_FADE_OUT_SECONDS)).toBeNull();
  });
});

describe('transient speech bubbles', () => {
  it('startSpeechBubble-withTransient-marksTheStateTransient', () => {
    const effect = startSpeechBubble('noBombs', 'I have no bombs.', { transient: true });
    expect(effect.state.transient).toBe(true);
  });

  it('startSpeechBubble-withoutOptions-isNotTransient', () => {
    expect(startSpeechBubble('noBombs', 'I have no bombs.').state.transient).toBeUndefined();
  });

  it('transientShown-afterTheDwell-autoBeginsItsExit', () => {
    const effect = startSpeechBubble('noBombs', 'I have no bombs.', { transient: true });
    const shown = { ...effect, state: { ...effect.state, phase: 'shown' as const } };

    const ticked = tickSpeechBubbleEffect(shown, SPEECH_BUBBLE_TRANSIENT_DWELL_SECONDS)!;

    expect(ticked.state.phase).toBe('exiting');
    expect(ticked.elapsed).toBe(0);
  });

  it('transientShown-beforeTheDwell-staysShownAndAccumulatesElapsed', () => {
    const effect = startSpeechBubble('noBombs', 'I have no bombs.', { transient: true });
    const shown = { ...effect, state: { ...effect.state, phase: 'shown' as const } };

    const ticked = tickSpeechBubbleEffect(shown, SPEECH_BUBBLE_TRANSIENT_DWELL_SECONDS / 2)!;

    expect(ticked.state.phase).toBe('shown');
    expect(ticked.elapsed).toBe(SPEECH_BUBBLE_TRANSIENT_DWELL_SECONDS / 2);
  });

  it('nonTransientShown-pastTheDwell-stillWaitsForAnExplicitExit', () => {
    const effect = bridge();
    const shown = { ...effect, state: { ...effect.state, phase: 'shown' as const } };

    const ticked = tickSpeechBubbleEffect(shown, SPEECH_BUBBLE_TRANSIENT_DWELL_SECONDS * 10)!;

    expect(ticked.state.phase).toBe('shown');
    expect(ticked.elapsed).toBe(SPEECH_BUBBLE_TRANSIENT_DWELL_SECONDS * 10);
  });
});

describe('beginSpeechBubbleExit', () => {
  it('fromShown-switchesToExitingAtZeroElapsed', () => {
    const effect = bridge();
    const shown = { ...effect, elapsed: 3, state: { ...effect.state, phase: 'shown' as const } };

    const exited = beginSpeechBubbleExit(shown);

    expect(exited.state.phase).toBe('exiting');
    expect(exited.elapsed).toBe(0);
    expect(exited.state.text).toBe(effect.state.text);
  });
});

describe('beginSpeechBubbleEnter', () => {
  it('fromExiting-restartsEnteringAtZeroElapsed', () => {
    const effect = bridge();
    const exiting = { ...effect, elapsed: 0.1, state: { ...effect.state, phase: 'exiting' as const } };

    const restarted = beginSpeechBubbleEnter(exiting);

    expect(restarted.state.phase).toBe('entering');
    expect(restarted.elapsed).toBe(0);
    expect(restarted.state.text).toBe(effect.state.text);
  });
});

describe('speechBubbleGrowthAndOpacity', () => {
  it('entering-atStart-isFullyCollapsedAndInvisible', () => {
    expect(speechBubbleGrowthAndOpacity(bridge())).toEqual({ growth: 0, opacity: 0 });
  });

  it('entering-halfwayThroughFadeIn-isHalfGrownAndHalfOpaque', () => {
    const effect = { ...bridge(), elapsed: SPEECH_BUBBLE_FADE_IN_SECONDS / 2 };

    const result = speechBubbleGrowthAndOpacity(effect);

    expect(result.growth).toBeCloseTo(0.5);
    expect(result.opacity).toBeCloseTo(0.5);
  });

  it('shown-isFullyGrownAndFullyOpaque', () => {
    const effect = bridge();
    const shown = { ...effect, state: { ...effect.state, phase: 'shown' as const } };

    expect(speechBubbleGrowthAndOpacity(shown)).toEqual({ growth: 1, opacity: 1 });
  });

  it('exiting-atStart-isFullyGrownAndFullyOpaque', () => {
    const effect = bridge();
    const exiting = beginSpeechBubbleExit({ ...effect, state: { ...effect.state, phase: 'shown' } });

    expect(speechBubbleGrowthAndOpacity(exiting)).toEqual({ growth: 1, opacity: 1 });
  });

  it('exiting-halfwayThroughFadeOut-isHalfGrownAndHalfOpaque', () => {
    const effect = bridge();
    const exiting = beginSpeechBubbleExit({ ...effect, state: { ...effect.state, phase: 'shown' } });
    const halfway = { ...exiting, elapsed: SPEECH_BUBBLE_FADE_OUT_SECONDS / 2 };

    const result = speechBubbleGrowthAndOpacity(halfway);

    expect(result.growth).toBeCloseTo(0.5);
    expect(result.opacity).toBeCloseTo(0.5);
  });

  it('exiting-onceFadeOutWouldExceedOne-staysClampedAtFullyCollapsed', () => {
    // The derive is a pure function of elapsed — it doesn't know the tick would
    // have already returned null by this point, so it must still behave sanely
    // (clamped, not negative) if ever called with an elapsed past the fade-out.
    const effect = bridge();
    const exiting = beginSpeechBubbleExit({ ...effect, state: { ...effect.state, phase: 'shown' } });
    const pastEnd = { ...exiting, elapsed: SPEECH_BUBBLE_FADE_OUT_SECONDS * 2 };

    expect(speechBubbleGrowthAndOpacity(pastEnd)).toEqual({ growth: 0, opacity: 0 });
  });
});

describe('singleton slot', () => {
  it('keyOf-constantValueMakesTheBubbleOneReplaceInPlaceSlot', () => {
    expect(effectKeyOf(bridge())).toBe('speechBubble');
  });
});

describe('activeSpeechBubble', () => {
  it('filtersTheCollectionByKind', () => {
    const puff = startPuffEffect('p', 0, 0);
    const bubble = bridge();

    expect(activeSpeechBubble([puff])).toBeUndefined();
    expect(activeSpeechBubble([puff, bubble])).toBe(bubble);
  });
});

describe('withSpeechBubbleText', () => {
  it('matchingText-returnsTheSameReference', () => {
    const bubble = startSpeechBubble('noBombs', 'I have no bombs.');

    expect(withSpeechBubbleText(bubble, 'I have no bombs.')).toBe(bubble);
  });

  it('differentText-returnsACopyWithTheNewTextOnly', () => {
    const bubble = startSpeechBubble('noBombs', 'I have no bombs.');

    const updated = withSpeechBubbleText(bubble, 'Ich habe keine Bomben.');

    expect(updated).not.toBe(bubble);
    expect(updated.state.text).toBe('Ich habe keine Bomben.');
    expect(updated.state.messageId).toBe('noBombs');
    expect(bubble.state.text).toBe('I have no bombs.');
  });
});

describe('drawSpeechBubbleEffect', () => {
  /** A fully-shown bubble (growth/opacity 1) so the primitive geometry is comparable. */
  const shownBubble = () => {
    const effect = startSpeechBubble('noBombs', 'I have no bombs.');
    return { ...effect, state: { ...effect.state, phase: 'shown' as const } };
  };

  it('readsTheStoredTextAndTheRenderContextsHeadAnchorNotAContextLookup', () => {
    const effect = shownBubble();
    const expected = makeMockContext() as unknown as { roundRect: ReturnType<typeof vi.fn> };
    drawSpeechBubble(expected as unknown as CanvasRenderingContext2D, effect.state.text, 200, 400);

    const actual = makeMockContext() as unknown as {
      roundRect: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };
    drawSpeechBubbleEffect(
      effect,
      renderContext(actual as unknown as CanvasRenderingContext2D, [effect], {
        playerAnchor: { centerX: 200, centerY: 0, headBottomY: 400, width: 64 },
      }),
    );

    // Identical geometry to the primitive called directly with the effect's own
    // stored text anchored at playerAnchor.centerX / playerAnchor.headBottomY —
    // nothing is resolved from a render-context text lookup.
    expect(actual.roundRect.mock.calls).toEqual(expected.roundRect.mock.calls);
    expect(actual.fillText).toHaveBeenCalledWith('I have no bombs.', 200, expect.any(Number));
  });
});

describe('drawSpeechBubble', () => {
  it('growth1-drawsBorderAndBubbleRoundRectsPlusCenteredText', () => {
    const ctx = makeMockContext() as unknown as {
      roundRect: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };

    drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Hold Down to drop through a bridge.', 200, 300);

    expect(ctx.roundRect).toHaveBeenCalledTimes(2); // border rounded-rect, then the inset bubble rounded-rect on top
    expect(ctx.fillText).toHaveBeenCalledWith(
      'Hold Down to drop through a bridge.',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('growthZero-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as {
      roundRect: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };

    drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 0);

    expect(ctx.roundRect).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('halfGrowth-drawsABubbleRectHalfAsTallAsFullGrowth', () => {
    const ctx = makeMockContext() as unknown as { roundRect: ReturnType<typeof vi.fn> };

    drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 1);
    const [, , , fullHeight] = ctx.roundRect.mock.calls[1]; // index 1: the inset bubble rect, not the border rect
    ctx.roundRect.mockClear();

    drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 0.5);
    const [, , , halfHeight] = ctx.roundRect.mock.calls[1];

    expect(halfHeight).toBeCloseTo(fullHeight / 2);
  });

  it('everyGrowth-keepsTheBoxsBottomEdgeFixed', () => {
    // The bubble must grow UPWARD from a fixed bottom edge (where the tail
    // meets it), not scale symmetrically — this is what makes it read as
    // "rising out of" the anchor point rather than just scaling in place.
    const ctx = makeMockContext() as unknown as { roundRect: ReturnType<typeof vi.fn> };

    drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 1);
    const [, fullTop, , fullHeight] = ctx.roundRect.mock.calls[1];
    const fullBottom = fullTop + fullHeight;
    ctx.roundRect.mockClear();

    drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 0.5);
    const [, halfTop, , halfHeight] = ctx.roundRect.mock.calls[1];
    const halfBottom = halfTop + halfHeight;

    expect(halfBottom).toBeCloseTo(fullBottom);
  });

  it('halfGrowth-tailWidthStaysFullWidthUnlikeItsHeight', () => {
    // Per the plan's explicit constraint: the bubble reveals at its full
    // WIDTH immediately — only height animates. The tail's horizontal span
    // (moveTo/lineTo x deltas around anchorX in the inset triangle, the
    // second beginPath/fill pair) must be identical at growth=1 and
    // growth=0.5, unlike its height which does shrink.
    const ctx = makeMockContext() as unknown as {
      moveTo: ReturnType<typeof vi.fn>;
      lineTo: ReturnType<typeof vi.fn>;
    };

    drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 1);
    // moveTo index 1 and lineTo index 3 are the inset cream tail's first
    // and last points (index 0/1 lineTo belong to the border tail drawn
    // first): moveTo(anchorX - tailHalfWidth, boxBottom) ... lineTo(anchorX
    // + tailHalfWidth, boxBottom) — their x delta is the tail's base span.
    const [fullMoveX] = ctx.moveTo.mock.calls[1];
    const [fullLineX] = ctx.lineTo.mock.calls[3];
    const fullSpan = fullLineX - fullMoveX;
    ctx.moveTo.mockClear();
    ctx.lineTo.mockClear();

    drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 0.5);
    const [halfMoveX] = ctx.moveTo.mock.calls[1];
    const [halfLineX] = ctx.lineTo.mock.calls[3];
    const halfSpan = halfLineX - halfMoveX;

    expect(halfSpan).toBeCloseTo(fullSpan);
  });

  it('withOpacity-setsGlobalAlphaBeforeDrawing', () => {
    const ctx = makeMockContext() as unknown as { globalAlpha: number; roundRect: ReturnType<typeof vi.fn> };
    // Capture globalAlpha at the moment roundRect is called — save()/restore()
    // are no-ops in the mock, so without capturing mid-call, reading
    // ctx.globalAlpha afterward could reflect whatever restore() reset it to.
    let alphaDuringDraw: number | undefined;
    ctx.roundRect.mockImplementation(() => {
      if (alphaDuringDraw === undefined) alphaDuringDraw = ctx.globalAlpha;
    });

    drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 1, 0.4);

    expect(alphaDuringDraw).toBe(0.4);
  });

  describe('multi-line text (\\n-separated)', () => {
    it('twoLineText-callsFillTextOncePerLineWithEachLinesOwnText', () => {
      const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };

      drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Line one\nLine two', 200, 300);

      expect(ctx.fillText).toHaveBeenCalledTimes(2);
      expect(ctx.fillText).toHaveBeenCalledWith('Line one', expect.any(Number), expect.any(Number));
      expect(ctx.fillText).toHaveBeenCalledWith('Line two', expect.any(Number), expect.any(Number));
    });

    it('singleLineText-stillCallsFillTextExactlyOnce-unaffectedByTheMultiLineChange', () => {
      const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };

      drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Just one line.', 200, 300);

      expect(ctx.fillText).toHaveBeenCalledTimes(1);
      expect(ctx.fillText).toHaveBeenCalledWith('Just one line.', expect.any(Number), expect.any(Number));
    });

    it('twoLineText-boxWidthUsesTheWidestLineNotJustTheFirst', () => {
      const ctx = makeMockContext() as unknown as {
        roundRect: ReturnType<typeof vi.fn>;
        measureText: ReturnType<typeof vi.fn>;
      };
      // Second line measures wider than the first — box width must track
      // the max, not whichever line happens to come first.
      ctx.measureText.mockImplementation((text: string) => ({
        width: text === 'A short line' ? 20 : 200,
      }));

      drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'A short line\nA much much longer second line', 200, 300);

      const [, , insetBoxWidth] = ctx.roundRect.mock.calls[1]; // index 1: inset bubble rect
      // BUBBLE_PADDING_X is 10 (module-private constant) — box width =
      // widest line's measured width (200) + padding on both sides.
      expect(insetBoxWidth).toBeCloseTo(200 + 10 * 2);
    });

    it('twoLineText-boxIsTallerThanOneLineTextAtFullGrowth', () => {
      const ctx = makeMockContext() as unknown as { roundRect: ReturnType<typeof vi.fn> };

      drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 1);
      const [, , , oneLineHeight] = ctx.roundRect.mock.calls[1];
      ctx.roundRect.mockClear();

      drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi\nHi', 200, 300, 1);
      const [, , , twoLineHeight] = ctx.roundRect.mock.calls[1];

      expect(twoLineHeight).toBeGreaterThan(oneLineHeight);
    });

    it('twoLineText-everyGrowth-stillKeepsTheBoxsBottomEdgeFixed', () => {
      // Same fixed-bottom-edge invariant as the single-line tests above,
      // regression-checked for the multi-line (taller) box too.
      const ctx = makeMockContext() as unknown as { roundRect: ReturnType<typeof vi.fn> };

      drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Line one\nLine two', 200, 300, 1);
      const [, fullTop, , fullHeight] = ctx.roundRect.mock.calls[1];
      const fullBottom = fullTop + fullHeight;
      ctx.roundRect.mockClear();

      drawSpeechBubble(ctx as unknown as CanvasRenderingContext2D, 'Line one\nLine two', 200, 300, 0.5);
      const [, halfTop, , halfHeight] = ctx.roundRect.mock.calls[1];
      const halfBottom = halfTop + halfHeight;

      expect(halfBottom).toBeCloseTo(fullBottom);
    });
  });
});
