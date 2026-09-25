import { describe, expect, it, vi } from 'vitest';
import { makeMockContext, renderContext } from './testContext';
import {
  COLLECTION_TEXT_SLOT_COUNT,
  COLLECTION_TEXT_STACK_ROW_HEIGHT,
  FLY_DURATION_SECONDS,
  HOLD_DURATION_SECONDS,
  RISE_DURATION_SECONDS,
  createSlotAllocator,
  drawFlyingText,
  flyingTextExpired,
  flyingTextPosition,
  startFlyingText,
  tickFlyingText,
} from './flyingText';

describe('startFlyingText', () => {
  it('called-returnsRisingPhaseAtZeroElapsed', () => {
    const effect = startFlyingText('a', 'German', 10, 20, 400, 300, 900, 600);
    expect(effect).toMatchObject({ kind: 'flyingText', id: 'a', elapsed: 0 });
    expect(effect.state).toEqual({
      text: 'German',
      startX: 10,
      startY: 20,
      midX: 400,
      midY: 300,
      targetX: 900,
      targetY: 600,
      phase: 'rising',
    });
  });

  it('calledWithIcon-includesIconOnTheState', () => {
    const effect = startFlyingText('a', 'German', 10, 20, 400, 300, 900, 600, '🇩🇪');
    expect(effect.state.icon).toBe('🇩🇪');
  });

  it('calledWithoutIcon-iconIsUndefined', () => {
    const effect = startFlyingText('a', 'German', 10, 20, 400, 300, 900, 600);
    expect(effect.state.icon).toBeUndefined();
  });
});

describe('tickFlyingText', () => {
  const start = () => startFlyingText('a', 't', 0, 0, 0, 0, 0, 0);

  it('withinRiseDuration-staysRisingPhase', () => {
    expect(tickFlyingText(start(), RISE_DURATION_SECONDS / 2).state.phase).toBe('rising');
  });

  it('pastRiseDuration-transitionsToHoldingPhase', () => {
    expect(tickFlyingText(start(), RISE_DURATION_SECONDS + 0.01).state.phase).toBe('holding');
  });

  it('pastRisePlusHoldDuration-transitionsToFlyingPhase', () => {
    expect(
      tickFlyingText(start(), RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS + 0.01).state.phase,
    ).toBe('flying');
  });

  it('pastRisePlusHoldPlusFlyDuration-transitionsToDonePhase', () => {
    expect(
      tickFlyingText(
        start(),
        RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS + FLY_DURATION_SECONDS + 0.01,
      ).state.phase,
    ).toBe('done');
  });

  it('donePhase-tickedAgain-returnsSameReference', () => {
    const done = tickFlyingText(
      start(),
      RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS + FLY_DURATION_SECONDS + 0.01,
    );
    expect(tickFlyingText(done, 1)).toBe(done);
  });

  it('atExactlyRiseDuration-transitionsToHoldingPhase', () => {
    expect(tickFlyingText(start(), RISE_DURATION_SECONDS).state.phase).toBe('holding');
  });

  it('atExactlyRisePlusHold-transitionsToFlyingPhase', () => {
    expect(
      tickFlyingText(start(), RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS).state.phase,
    ).toBe('flying');
  });

  it('atExactlyTheFullDuration-transitionsToDonePhase', () => {
    expect(tickFlyingText(start(), FLY_DURATION_SECONDS + RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS).state.phase).toBe(
      'done',
    );
  });
});

describe('flyingTextExpired', () => {
  it('runningPhase-isNotExpired', () => {
    expect(flyingTextExpired(startFlyingText('a', 't', 0, 0, 0, 0, 0, 0))).toBe(false);
  });

  it('donePhase-isExpired', () => {
    const done = tickFlyingText(startFlyingText('a', 't', 0, 0, 0, 0, 0, 0), 100);
    expect(flyingTextExpired(done)).toBe(true);
  });
});

describe('flyingTextPosition', () => {
  const start = () => startFlyingText('a', 't', 100, 100, 400, 300, 900, 600);

  it('risingPhaseStart-positionedAtStart', () => {
    const pos = flyingTextPosition(start());
    expect(pos.x).toBeCloseTo(100);
    expect(pos.y).toBeCloseTo(100);
    expect(pos.opacity).toBe(1);
  });

  it('risingPhaseEnd-positionedAtMidWithFullOpacity', () => {
    const pos = flyingTextPosition(tickFlyingText(start(), RISE_DURATION_SECONDS));
    expect(pos.x).toBeCloseTo(400);
    expect(pos.y).toBeCloseTo(300);
    expect(pos.opacity).toBe(1);
  });

  it('holdingPhase-staysFixedAtMidWithFullOpacity', () => {
    const pos = flyingTextPosition(
      tickFlyingText(start(), RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS / 2),
    );
    expect(pos.x).toBeCloseTo(400);
    expect(pos.y).toBeCloseTo(300);
    expect(pos.opacity).toBe(1);
  });

  it('flyingTextStart-positionedAtMid', () => {
    const pos = flyingTextPosition(
      tickFlyingText(start(), RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS),
    );
    expect(pos.x).toBeCloseTo(400);
    expect(pos.y).toBeCloseTo(300);
  });

  it('flyEnd-positionedAtTargetWithZeroOpacity', () => {
    const pos = flyingTextPosition(
      tickFlyingText(start(), RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS + FLY_DURATION_SECONDS),
    );
    expect(pos.x).toBeCloseTo(900);
    expect(pos.y).toBeCloseTo(600);
    expect(pos.opacity).toBeCloseTo(0, 1);
  });

  it('donePhase-returnsZeroOpacity', () => {
    const effect = tickFlyingText(startFlyingText('a', 't', 0, 0, 0, 0, 0, 0), 100);
    expect(flyingTextPosition(effect).opacity).toBe(0);
  });
});

describe('createSlotAllocator', () => {
  it('zeroInFlight-startsAtOffsetZero', () => {
    expect(createSlotAllocator(0)()).toBe(0);
  });

  it('successiveCalls-advanceByOneRow', () => {
    const allocate = createSlotAllocator(0);
    allocate();
    expect(allocate()).toBe(COLLECTION_TEXT_STACK_ROW_HEIGHT);
  });

  it('nonZeroInFlight-startsSeededByThatCount', () => {
    expect(createSlotAllocator(1)()).toBe(COLLECTION_TEXT_STACK_ROW_HEIGHT);
  });

  it('inFlightCountAboveSlotCount-wrapsTheSeed', () => {
    expect(createSlotAllocator(COLLECTION_TEXT_SLOT_COUNT)()).toBe(0);
  });

  it('pastTheSlotCount-cyclesBackToOffsetZero', () => {
    const allocate = createSlotAllocator(0);
    const offsets = Array.from({ length: COLLECTION_TEXT_SLOT_COUNT + 1 }, () => allocate());
    expect(offsets[COLLECTION_TEXT_SLOT_COUNT]).toBe(offsets[0]);
    expect(new Set(offsets.slice(0, COLLECTION_TEXT_SLOT_COUNT)).size).toBe(COLLECTION_TEXT_SLOT_COUNT);
  });
});

describe('drawFlyingText', () => {
  it('risingEffect-drawsTextPartwayToMid', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effect = tickFlyingText(
      startFlyingText('a', 'German', 50, 60, 400, 300, 900, 900),
      RISE_DURATION_SECONDS / 2,
    );

    drawFlyingText(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    expect(ctx.fillText).toHaveBeenCalledWith('German', expect.any(Number), expect.any(Number));
  });

  it('effectWithIcon-drawsIconInSeparateSansSerifFillTextCall', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn>; font: string };
    const fontsAtCall: string[] = [];
    ctx.fillText.mockImplementation(() => {
      fontsAtCall.push(ctx.font);
    });
    const effect = startFlyingText('a', 'German', 50, 60, 400, 300, 900, 900, '🇩🇪');

    drawFlyingText(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    // 4 outline offsets + 1 final fill for the text, then the icon.
    expect(ctx.fillText).toHaveBeenCalledTimes(6);
    const lastCall = ctx.fillText.mock.calls.length;
    expect(ctx.fillText).toHaveBeenNthCalledWith(lastCall, '🇩🇪', expect.any(Number), expect.any(Number));
    const iconFont = fontsAtCall[fontsAtCall.length - 1];
    expect(iconFont).toContain('sans-serif');
    expect(iconFont).not.toContain('"');
  });

  it('effectWithoutIcon-drawsOutlinedTextOnly', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effect = startFlyingText('a', 'German', 50, 60, 400, 300, 900, 900);

    drawFlyingText(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    expect(ctx.fillText).toHaveBeenCalledTimes(5);
    ctx.fillText.mock.calls.forEach((call) => expect(call[0]).toBe('German'));
  });

  it('freshEffect-drawsNoSparkleCircles-sparkleIsNowPuffOnly', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = startFlyingText('a', 'German', 50, 60, 400, 300, 900, 900);

    drawFlyingText(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    expect(ctx.arc).not.toHaveBeenCalled();
  });
});
