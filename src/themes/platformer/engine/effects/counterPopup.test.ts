import { describe, expect, it, vi } from 'vitest';
import { makeMockContext, renderContext } from './testContext';
import { effectKeyOf } from './effectRegistry';
import { upsertEffect } from './transientEffect';
import { startPuffEffect } from './puff';
import {
  COUNTER_POPUP_DURATION_SECONDS,
  COUNTER_POPUP_HOLD_SECONDS,
  counterPopupOpacity,
  drawCounterPopup,
  startCounterPopup,
  tickCounterPopup,
  type CounterPopupState,
} from './counterPopup';
import type { TransientEffect } from './transientEffect';

describe('startCounterPopup', () => {
  it('called-returnsZeroElapsedWithGivenFields', () => {
    const effect = startCounterPopup('fruits', 1, 4);
    expect(effect).toMatchObject({ kind: 'counterPopup', id: 'counterPopup:fruits', elapsed: 0 });
    expect(effect.state).toEqual({ labelKey: 'fruits', collected: 1, total: 4 });
  });
});

describe('tickCounterPopup', () => {
  it('withinDuration-advancesElapsed', () => {
    const effect = tickCounterPopup(startCounterPopup('coins', 2, 4), 0.5);
    expect(effect?.elapsed).toBe(0.5);
    expect(effect?.state).toEqual({ labelKey: 'coins', collected: 2, total: 4 });
  });

  it('pastDuration-returnsNull', () => {
    expect(tickCounterPopup(startCounterPopup('coins', 2, 4), COUNTER_POPUP_DURATION_SECONDS + 0.01)).toBeNull();
  });

  it('atExactlyTheDuration-returnsNullSentinel', () => {
    expect(tickCounterPopup(startCounterPopup('coins', 2, 4), COUNTER_POPUP_DURATION_SECONDS)).toBeNull();
  });
});

describe('counterPopupOpacity', () => {
  it('duringHold-returnsFullOpacity', () => {
    const effect = tickCounterPopup(startCounterPopup('coins', 1, 4), COUNTER_POPUP_HOLD_SECONDS - 0.01)!;
    expect(counterPopupOpacity(effect)).toBe(1);
  });

  it('midFade-returnsPartialOpacity', () => {
    const effect = tickCounterPopup(
      startCounterPopup('coins', 1, 4),
      COUNTER_POPUP_DURATION_SECONDS - (COUNTER_POPUP_DURATION_SECONDS - COUNTER_POPUP_HOLD_SECONDS) / 2,
    )!;
    expect(counterPopupOpacity(effect)).toBeCloseTo(0.5);
  });
});

describe('drawCounterPopup', () => {
  const coinIcon = { tag: 'coin' } as unknown as HTMLImageElement;

  it('calledWithOneItem-drawsIconThenSpacedText', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };
    const effect = startCounterPopup('coins', 1, 4);
    const rc = renderContext(ctx as unknown as CanvasRenderingContext2D, [effect], {
      popupIcons: { coins: { icon: coinIcon, iconFrame: { sx: 0, sy: 0, size: 16 } } },
    });

    drawCounterPopup(effect, rc);

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
    expect(ctx.fillText).toHaveBeenCalledWith('1 / 4', expect.any(Number), expect.any(Number));
  });

  it('calledWithZeroOpacityItem-skipsIt', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };
    // At/after the duration the popup would have been dropped; its opacity is 0.
    const effect = { ...startCounterPopup('coins', 1, 4), elapsed: COUNTER_POPUP_DURATION_SECONDS };
    const rc = renderContext(ctx as unknown as CanvasRenderingContext2D, [effect], {
      popupIcons: { coins: { icon: coinIcon, iconFrame: { sx: 0, sy: 0, size: 16 } } },
    });

    drawCounterPopup(effect, rc);

    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('calledWithNoItems-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };
    const effect = startCounterPopup('coins', 1, 4);

    drawCounterPopup(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, []));

    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('twoPopups-areLaidOutSideBySideAsOneCenteredGroup', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };
    const coin = startCounterPopup('coins', 2, 4);
    const fruit = startCounterPopup('fruits', 1, 2);
    const fruitIcon = { tag: 'fruit' } as unknown as HTMLImageElement;
    const rc = renderContext(ctx as unknown as CanvasRenderingContext2D, [coin, fruit], {
      popupIcons: {
        coins: { icon: coinIcon, iconFrame: { sx: 0, sy: 0, size: 16 } },
        fruits: { icon: fruitIcon, iconFrame: { sx: 0, sy: 0, size: 16 } },
      },
    });

    drawCounterPopup(coin, rc);
    drawCounterPopup(fruit, rc);

    expect(ctx.fillText).toHaveBeenCalledWith('2 / 4', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('1 / 2', expect.any(Number), expect.any(Number));

    const coinCallX = ctx.drawImage.mock.calls.find((c: unknown[]) => c[0] === coinIcon)![5] as number;
    const fruitCallX = ctx.drawImage.mock.calls.find((c: unknown[]) => c[0] === fruitIcon)![5] as number;
    expect(fruitCallX).toBeGreaterThan(coinCallX);
  });
});

describe('counterPopup keyed slot (US5-1/FR-016)', () => {
  const keyOf = (collection: readonly TransientEffect<unknown>[]) =>
    collection.filter(
      (effect): effect is TransientEffect<CounterPopupState> => effect.kind === 'counterPopup',
    );

  it('twoCollectsOfTheSameLabel-leaveExactlyOneRefreshedPopup', () => {
    let collection: TransientEffect<unknown>[] = [];
    collection = upsertEffect(collection, startCounterPopup('coins', 1, 5), effectKeyOf);
    collection = upsertEffect(collection, startCounterPopup('coins', 2, 5), effectKeyOf);

    const popups = keyOf(collection);
    expect(popups).toHaveLength(1);
    expect(popups[0].state).toEqual({ labelKey: 'coins', collected: 2, total: 5 });
  });

  it('aRefreshedPopup-restartsItsTimer', () => {
    let collection: TransientEffect<unknown>[] = [];
    collection = upsertEffect(collection, startCounterPopup('coins', 1, 5), effectKeyOf);
    collection = collection.map((effect) => tickCounterPopup(effect as TransientEffect<CounterPopupState>, 0.5) ?? effect);
    collection = upsertEffect(collection, startCounterPopup('coins', 2, 5), effectKeyOf);

    expect(keyOf(collection)[0].elapsed).toBe(0);
  });

  it('differentLabels-coexistSideBySide', () => {
    let collection: TransientEffect<unknown>[] = [];
    collection = upsertEffect(collection, startCounterPopup('coins', 1, 5), effectKeyOf);
    collection = upsertEffect(collection, startCounterPopup('fruits', 3, 4), effectKeyOf);

    expect(keyOf(collection)).toHaveLength(2);
    expect(keyOf(collection).map((popup) => popup.state.labelKey).sort()).toEqual(['coins', 'fruits']);
  });

  it('anUnkeyedKind-simplyAppends', () => {
    let collection: TransientEffect<unknown>[] = [];
    collection = upsertEffect(collection, startPuffEffect('p', 0, 0), effectKeyOf);
    collection = upsertEffect(collection, startPuffEffect('p', 0, 0), effectKeyOf);

    expect(collection.filter((effect) => effect.kind === 'puff')).toHaveLength(2);
  });
});
