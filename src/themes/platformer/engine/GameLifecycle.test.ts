import { introState, startDeath, tickLifecycle, currentIrisRadius } from './GameLifecycle';
import type { LifecycleState } from './GameLifecycle';
import { IRIS_DURATION_SECONDS } from './IrisTransition';

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
  it('introPhase-beforeDuration-advancesElapsedStaysIntro', () => {
    const next = tickLifecycle(introState(0, 0), 0.5);
    expect(next.phase).toBe('intro');
    expect(next.elapsed).toBe(0.5);
  });

  it('introPhase-elapsedReachesDuration-transitionsToPlaying', () => {
    const next = tickLifecycle(introState(0, 0), IRIS_DURATION_SECONDS);
    expect(next.phase).toBe('playing');
  });

  it('introPhase-elapsedExceedsDuration-transitionsToPlaying', () => {
    const next = tickLifecycle(introState(0, 0), IRIS_DURATION_SECONDS + 1);
    expect(next.phase).toBe('playing');
  });

  it('dyingPhase-beforeDuration-advancesElapsedStaysDying', () => {
    const next = tickLifecycle(startDeath(0, 0), 0.5);
    expect(next.phase).toBe('dying');
    expect(next.elapsed).toBe(0.5);
  });

  it('dyingPhase-elapsedReachesDuration-transitionsToAwaitingRestart', () => {
    const next = tickLifecycle(startDeath(0, 0), IRIS_DURATION_SECONDS);
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

  it('introPhase-halfwayElapsed-returnsHalfMaxRadius', () => {
    const state: LifecycleState = {
      phase: 'intro',
      elapsed: IRIS_DURATION_SECONDS / 2,
      centerX: 0,
      centerY: 0,
    };
    expect(currentIrisRadius(state, 500)).toBeCloseTo(250);
  });

  it('dyingPhase-halfwayElapsed-returnsHalfMaxRadius', () => {
    const state: LifecycleState = {
      phase: 'dying',
      elapsed: IRIS_DURATION_SECONDS / 2,
      centerX: 0,
      centerY: 0,
    };
    expect(currentIrisRadius(state, 500)).toBeCloseTo(250);
  });

  it('introPhase-zeroElapsed-returnsZero', () => {
    const state: LifecycleState = { phase: 'intro', elapsed: 0, centerX: 0, centerY: 0 };
    expect(currentIrisRadius(state, 500)).toBe(0);
  });

  it('dyingPhase-zeroElapsed-returnsMaxRadius', () => {
    const state: LifecycleState = { phase: 'dying', elapsed: 0, centerX: 0, centerY: 0 };
    expect(currentIrisRadius(state, 500)).toBe(500);
  });
});
