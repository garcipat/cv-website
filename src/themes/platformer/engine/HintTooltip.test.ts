import type { Signal } from '@preact/signals-react';
import {
  startHintTooltip,
  beginHintTooltipExit,
  tickHintTooltip,
  hintTooltipGrowthAndOpacity,
  hintInteractable,
  HINT_TOOLTIP_FADE_IN_SECONDS,
  HINT_TOOLTIP_FADE_OUT_SECONDS,
  HINT_TOOLTIP_TRANSIENT_DWELL_SECONDS,
} from './HintTooltip';
import type { HintTooltipState } from './HintTooltip';

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

describe('transient tooltips', () => {
  it('startHintTooltip-withTransient-marksTheStateTransient', () => {
    const state = startHintTooltip('noBombs', { transient: true });
    expect(state.transient).toBe(true);
  });

  it('startHintTooltip-withoutOptions-isNotTransient', () => {
    expect(startHintTooltip('noBombs').transient).toBeUndefined();
  });

  it('transientShown-afterTheDwell-autoBeginsItsExit', () => {
    const shown = { ...startHintTooltip('noBombs', { transient: true }), phase: 'shown' as const, elapsed: 0 };

    const ticked = tickHintTooltip(shown, HINT_TOOLTIP_TRANSIENT_DWELL_SECONDS);

    expect(ticked).toEqual({ ...shown, phase: 'exiting', elapsed: 0 });
  });

  it('transientShown-beforeTheDwell-staysShownAndAccumulatesElapsed', () => {
    const shown = { ...startHintTooltip('noBombs', { transient: true }), phase: 'shown' as const, elapsed: 0 };

    const ticked = tickHintTooltip(shown, HINT_TOOLTIP_TRANSIENT_DWELL_SECONDS / 2);

    expect(ticked).toEqual({ ...shown, elapsed: HINT_TOOLTIP_TRANSIENT_DWELL_SECONDS / 2 });
  });

  it('nonTransientShown-pastTheDwell-stillWaitsForAnExplicitExit', () => {
    const shown = { hintId: 'bridgeDropThrough' as const, phase: 'shown' as const, elapsed: 0 };

    const ticked = tickHintTooltip(shown, HINT_TOOLTIP_TRANSIENT_DWELL_SECONDS * 10);

    expect(ticked).toEqual({ ...shown, elapsed: HINT_TOOLTIP_TRANSIENT_DWELL_SECONDS * 10 });
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

describe('hintInteractable-newHintId-startsTheTooltip', () => {
  it('starts a fresh tooltip for a new hint id', () => {
    const tooltipState: Signal<HintTooltipState | null> = { value: null } as Signal<HintTooltipState | null>;

    const interactable = hintInteractable(tooltipState, 'chestNeedsKey');

    expect(interactable.kind).toBe('hint');
    expect(interactable.findCandidate()).toBe('chestNeedsKey');
    interactable.applyInteract('chestNeedsKey');
    expect(tooltipState.value?.hintId).toBe('chestNeedsKey');
  });
});

describe('hintInteractable-currentlyExiting-restartsEntrance', () => {
  it('restarts the entrance when pressed again mid-exit', () => {
    const tooltipState: Signal<HintTooltipState | null> = {
      value: { hintId: 'chestNeedsKey', phase: 'exiting', elapsed: 0.3 },
    } as Signal<HintTooltipState | null>;

    const interactable = hintInteractable(tooltipState, 'chestNeedsKey');
    interactable.applyInteract('chestNeedsKey');

    expect(tooltipState.value?.phase).toBe('entering');
    expect(tooltipState.value?.elapsed).toBe(0);
  });
});

describe('hintInteractable-noOverlappingHint-noCandidate', () => {
  it('returns no candidate when nothing is overlapping', () => {
    const tooltipState: Signal<HintTooltipState | null> = { value: null } as Signal<HintTooltipState | null>;

    const interactable = hintInteractable(tooltipState, undefined);

    expect(interactable.findCandidate()).toBeNull();
  });
});
