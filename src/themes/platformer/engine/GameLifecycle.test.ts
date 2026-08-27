import { introState, startDeath, tickLifecycle, currentIrisRadius } from './GameLifecycle';
import type { LifecycleState } from './GameLifecycle';
import {
  IRIS_DURATION_SECONDS,
  IRIS_HOLD_SECONDS,
  IRIS_CLOSE_SECONDS,
  IRIS_SMALL_RADIUS,
} from './IrisTransition';

const INTRO_TOTAL_SECONDS = IRIS_HOLD_SECONDS + IRIS_DURATION_SECONDS;
const DYING_TOTAL_SECONDS = IRIS_DURATION_SECONDS + IRIS_HOLD_SECONDS + IRIS_CLOSE_SECONDS;

describe('introState', () => {
  it('called-returns-introPhaseAtZeroElapsedWithGivenCenter', () => {
    expect(introState(10, 20)).toEqual({ phase: 'intro', elapsed: 0, centerX: 10, centerY: 20 });
  });
});

describe('startDeath', () => {
  it('called-returns-dyingPhaseAtZeroElapsedWithGivenCenter', () => {
    expect(startDeath(30, 40)).toEqual({ phase: 'dying', elapsed: 0, centerX: 30, centerY: 40 });
  });
});

describe('tickLifecycle', () => {
  it('introPhase-beforeTotalDuration-advancesElapsedStaysIntro', () => {
    const next = tickLifecycle(introState(0, 0), 0.5);
    expect(next.phase).toBe('intro');
    expect(next.elapsed).toBe(0.5);
  });

  it('introPhase-elapsedReachesTotalDuration-transitionsToPlaying', () => {
    const next = tickLifecycle(introState(0, 0), INTRO_TOTAL_SECONDS);
    expect(next.phase).toBe('playing');
  });

  it('introPhase-elapsedExceedsTotalDuration-transitionsToPlaying', () => {
    const next = tickLifecycle(introState(0, 0), INTRO_TOTAL_SECONDS + 1);
    expect(next.phase).toBe('playing');
  });

  it('dyingPhase-beforeTotalDuration-advancesElapsedStaysDying', () => {
    const next = tickLifecycle(startDeath(0, 0), 0.5);
    expect(next.phase).toBe('dying');
    expect(next.elapsed).toBe(0.5);
  });

  it('dyingPhase-elapsedReachesTotalDuration-transitionsToAwaitingRestart', () => {
    const next = tickLifecycle(startDeath(0, 0), DYING_TOTAL_SECONDS);
    expect(next.phase).toBe('awaitingRestart');
  });

  it('playingPhase-ticked-returnsSameReference', () => {
    const state: LifecycleState = { phase: 'playing', elapsed: 0, centerX: 0, centerY: 0 };
    expect(tickLifecycle(state, 1)).toBe(state);
  });

  it('awaitingRestartPhase-ticked-returnsSameReference', () => {
    const state: LifecycleState = { phase: 'awaitingRestart', elapsed: 0, centerX: 0, centerY: 0 };
    expect(tickLifecycle(state, 1)).toBe(state);
  });
});

describe('currentIrisRadius', () => {
  it('playingPhase-returns-null', () => {
    const state: LifecycleState = { phase: 'playing', elapsed: 0, centerX: 0, centerY: 0 };
    expect(currentIrisRadius(state, 500)).toBeNull();
  });

  it('awaitingRestartPhase-returns-zero', () => {
    const state: LifecycleState = { phase: 'awaitingRestart', elapsed: 0, centerX: 0, centerY: 0 };
    expect(currentIrisRadius(state, 500)).toBe(0);
  });

  it('introPhase-zeroElapsed-returnsSmallRadius', () => {
    const state: LifecycleState = { phase: 'intro', elapsed: 0, centerX: 0, centerY: 0 };
    expect(currentIrisRadius(state, 500)).toBe(IRIS_SMALL_RADIUS);
  });

  it('introPhase-stillWithinHold-returnsSmallRadius', () => {
    const state: LifecycleState = {
      phase: 'intro',
      elapsed: IRIS_HOLD_SECONDS / 2,
      centerX: 0,
      centerY: 0,
    };
    expect(currentIrisRadius(state, 500)).toBe(IRIS_SMALL_RADIUS);
  });

  it('introPhase-halfwayThroughGrow-returnsMidpointBetweenSmallAndMaxRadius', () => {
    const state: LifecycleState = {
      phase: 'intro',
      elapsed: IRIS_HOLD_SECONDS + IRIS_DURATION_SECONDS / 2,
      centerX: 0,
      centerY: 0,
    };
    expect(currentIrisRadius(state, 500)).toBeCloseTo((IRIS_SMALL_RADIUS + 500) / 2);
  });

  it('introPhase-growComplete-returnsMaxRadius', () => {
    const state: LifecycleState = {
      phase: 'intro',
      elapsed: INTRO_TOTAL_SECONDS,
      centerX: 0,
      centerY: 0,
    };
    expect(currentIrisRadius(state, 500)).toBeCloseTo(500);
  });

  it('dyingPhase-zeroElapsed-returnsMaxRadius', () => {
    const state: LifecycleState = { phase: 'dying', elapsed: 0, centerX: 0, centerY: 0 };
    expect(currentIrisRadius(state, 500)).toBe(500);
  });

  it('dyingPhase-halfwayThroughShrink-returnsMidpointBetweenMaxAndSmallRadius', () => {
    const state: LifecycleState = {
      phase: 'dying',
      elapsed: IRIS_DURATION_SECONDS / 2,
      centerX: 0,
      centerY: 0,
    };
    expect(currentIrisRadius(state, 500)).toBeCloseTo((500 + IRIS_SMALL_RADIUS) / 2);
  });

  it('dyingPhase-justAfterShrink-returnsSmallRadius', () => {
    const state: LifecycleState = {
      phase: 'dying',
      elapsed: IRIS_DURATION_SECONDS,
      centerX: 0,
      centerY: 0,
    };
    expect(currentIrisRadius(state, 500)).toBeCloseTo(IRIS_SMALL_RADIUS);
  });

  it('dyingPhase-stillWithinHold-returnsSmallRadius', () => {
    const state: LifecycleState = {
      phase: 'dying',
      elapsed: IRIS_DURATION_SECONDS + IRIS_HOLD_SECONDS / 2,
      centerX: 0,
      centerY: 0,
    };
    expect(currentIrisRadius(state, 500)).toBe(IRIS_SMALL_RADIUS);
  });

  it('dyingPhase-halfwayThroughFinalClose-returnsHalfSmallRadius', () => {
    const state: LifecycleState = {
      phase: 'dying',
      elapsed: IRIS_DURATION_SECONDS + IRIS_HOLD_SECONDS + IRIS_CLOSE_SECONDS / 2,
      centerX: 0,
      centerY: 0,
    };
    expect(currentIrisRadius(state, 500)).toBeCloseTo(IRIS_SMALL_RADIUS / 2);
  });

  it('dyingPhase-closeComplete-returnsZero', () => {
    const state: LifecycleState = {
      phase: 'dying',
      elapsed: DYING_TOTAL_SECONDS,
      centerX: 0,
      centerY: 0,
    };
    expect(currentIrisRadius(state, 500)).toBeCloseTo(0);
  });

  it('smallRadiusExceedsMaxRadius-clampsSmallRadiusToMaxRadius', () => {
    // A tiny canvas where maxRadius is smaller than IRIS_SMALL_RADIUS — the
    // hold radius must never exceed the circle needed to cover the canvas.
    const state: LifecycleState = { phase: 'intro', elapsed: 0, centerX: 0, centerY: 0 };
    expect(currentIrisRadius(state, 10)).toBe(10);
  });
});
