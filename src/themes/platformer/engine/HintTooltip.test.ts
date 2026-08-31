import {
  startHintTooltip,
  beginHintTooltipExit,
  tickHintTooltip,
  hintTooltipGrowthAndOpacity,
  HINT_TOOLTIP_FADE_IN_SECONDS,
  HINT_TOOLTIP_FADE_OUT_SECONDS,
} from './HintTooltip';

describe('startHintTooltip', () => {
  it('createsAnEnteringStateAtZeroElapsed', () => {
    expect(startHintTooltip('bridgeDropThrough')).toEqual({
      hintId: 'bridgeDropThrough',
      phase: 'entering',
      elapsed: 0,
    });
  });
});

describe('tickHintTooltip', () => {
  it('entering-beforeFadeInCompletes-staysEnteringAndAdvancesElapsed', () => {
    const state = startHintTooltip('bridgeDropThrough');

    const ticked = tickHintTooltip(state, HINT_TOOLTIP_FADE_IN_SECONDS / 2);

    expect(ticked).toEqual({ ...state, elapsed: HINT_TOOLTIP_FADE_IN_SECONDS / 2 });
  });

  it('entering-onceFadeInCompletes-becomesShownAndResetsElapsed', () => {
    const state = startHintTooltip('bridgeDropThrough');

    const ticked = tickHintTooltip(state, HINT_TOOLTIP_FADE_IN_SECONDS);

    expect(ticked).toEqual({ ...state, phase: 'shown', elapsed: 0 });
  });

  it('shown-ticking-staysShownIndefinitely', () => {
    const state = { hintId: 'bridgeDropThrough' as const, phase: 'shown' as const, elapsed: 0 };

    const ticked = tickHintTooltip(state, 5);

    expect(ticked).toEqual({ ...state, elapsed: 5 });
  });

  it('exiting-beforeFadeOutCompletes-staysExitingAndAdvancesElapsed', () => {
    const state = beginHintTooltipExit({ hintId: 'bridgeDropThrough', phase: 'shown', elapsed: 0 });

    const ticked = tickHintTooltip(state, HINT_TOOLTIP_FADE_OUT_SECONDS / 2);

    expect(ticked).toEqual({ ...state, elapsed: HINT_TOOLTIP_FADE_OUT_SECONDS / 2 });
  });

  it('exiting-onceFadeOutCompletes-returnsNull', () => {
    const state = beginHintTooltipExit({ hintId: 'bridgeDropThrough', phase: 'shown', elapsed: 0 });

    const ticked = tickHintTooltip(state, HINT_TOOLTIP_FADE_OUT_SECONDS);

    expect(ticked).toBeNull();
  });
});

describe('beginHintTooltipExit', () => {
  it('fromShown-switchesToExitingAtZeroElapsed', () => {
    const shown = { hintId: 'bridgeDropThrough' as const, phase: 'shown' as const, elapsed: 3 };

    expect(beginHintTooltipExit(shown)).toEqual({ ...shown, phase: 'exiting', elapsed: 0 });
  });
});

describe('hintTooltipGrowthAndOpacity', () => {
  it('entering-atStart-isFullyCollapsedAndInvisible', () => {
    const state = startHintTooltip('bridgeDropThrough');

    expect(hintTooltipGrowthAndOpacity(state)).toEqual({ growth: 0, opacity: 0 });
  });

  it('entering-halfwayThroughFadeIn-isHalfGrownAndHalfOpaque', () => {
    const state = { ...startHintTooltip('bridgeDropThrough'), elapsed: HINT_TOOLTIP_FADE_IN_SECONDS / 2 };

    const result = hintTooltipGrowthAndOpacity(state);

    expect(result.growth).toBeCloseTo(0.5);
    expect(result.opacity).toBeCloseTo(0.5);
  });

  it('shown-isFullyGrownAndFullyOpaque', () => {
    const state = { hintId: 'bridgeDropThrough' as const, phase: 'shown' as const, elapsed: 0 };

    expect(hintTooltipGrowthAndOpacity(state)).toEqual({ growth: 1, opacity: 1 });
  });

  it('exiting-atStart-isFullyGrownAndFullyOpaque', () => {
    const state = beginHintTooltipExit({ hintId: 'bridgeDropThrough', phase: 'shown', elapsed: 0 });

    expect(hintTooltipGrowthAndOpacity(state)).toEqual({ growth: 1, opacity: 1 });
  });

  it('exiting-halfwayThroughFadeOut-isHalfGrownAndHalfOpaque', () => {
    const exiting = beginHintTooltipExit({ hintId: 'bridgeDropThrough', phase: 'shown', elapsed: 0 });
    const halfway = { ...exiting, elapsed: HINT_TOOLTIP_FADE_OUT_SECONDS / 2 };

    const result = hintTooltipGrowthAndOpacity(halfway);

    expect(result.growth).toBeCloseTo(0.5);
    expect(result.opacity).toBeCloseTo(0.5);
  });

  it('exiting-onceFadeOutWouldExceedOne-staysClampedAtFullyCollapsed', () => {
    // hintTooltipGrowthAndOpacity is a pure function of elapsed — it doesn't
    // know tickHintTooltip would have already returned null by this point,
    // so it still needs to behave sanely (clamped, not negative) if ever
    // called with an elapsed value past the fade-out duration.
    const exiting = beginHintTooltipExit({ hintId: 'bridgeDropThrough', phase: 'shown', elapsed: 0 });
    const pastEnd = { ...exiting, elapsed: HINT_TOOLTIP_FADE_OUT_SECONDS * 2 };

    expect(hintTooltipGrowthAndOpacity(pastEnd)).toEqual({ growth: 0, opacity: 0 });
  });
});
