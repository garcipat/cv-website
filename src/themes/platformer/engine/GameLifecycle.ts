import { IRIS_DURATION_SECONDS, irisRadius } from './IrisTransition';

/**
 * `intro`: circle growing open at game start/restart (non-blocking — see
 * this plan's Architecture note; physics still runs underneath).
 * `playing`: normal gameplay, no overlay drawn.
 * `dying`: circle shrinking closed on death, game loop paused.
 * `awaitingRestart`: fully black, "Press any button to restart" shown,
 * game loop paused, waiting for input.
 */
export type GamePhase = 'intro' | 'playing' | 'dying' | 'awaitingRestart';

export interface LifecycleState {
  phase: GamePhase;
  /** Seconds elapsed within the current 'intro'/'dying' animation. Frozen
   *  (not advanced) once 'playing' or 'awaitingRestart' is reached. */
  elapsed: number;
  /** World-space point (not screen-space — the caller adds camera offset at
   *  render time, matching Renderer.ts's originX/originY convention) the
   *  iris circle is centered on for the current animation. */
  centerX: number;
  centerY: number;
}

export function introState(centerX: number, centerY: number): LifecycleState {
  return { phase: 'intro', elapsed: 0, centerX, centerY };
}

export function startDeath(centerX: number, centerY: number): LifecycleState {
  return { phase: 'dying', elapsed: 0, centerX, centerY };
}

/**
 * Advances `elapsed` by `dt` seconds for the two time-driven phases,
 * transitioning 'intro' -> 'playing' and 'dying' -> 'awaitingRestart' once
 * IRIS_DURATION_SECONDS is reached or exceeded. No-op (same reference
 * returned) for 'playing'/'awaitingRestart', which have no timer running.
 */
export function tickLifecycle(state: LifecycleState, dt: number): LifecycleState {
  if (state.phase !== 'intro' && state.phase !== 'dying') return state;
  const elapsed = state.elapsed + dt;
  if (elapsed >= IRIS_DURATION_SECONDS) {
    return {
      ...state,
      elapsed: IRIS_DURATION_SECONDS,
      phase: state.phase === 'intro' ? 'playing' : 'awaitingRestart',
    };
  }
  return { ...state, elapsed };
}

/**
 * Circle radius to draw for the current phase, or `null` when 'playing'
 * (no overlay drawn at all — the caller should skip the draw call entirely
 * rather than draw a full-radius, fully-transparent circle every frame).
 */
export function currentIrisRadius(state: LifecycleState, maxRadius: number): number | null {
  if (state.phase === 'playing') return null;
  if (state.phase === 'awaitingRestart') return 0;
  const progress = state.elapsed / IRIS_DURATION_SECONDS;
  return state.phase === 'intro'
    ? irisRadius(progress, maxRadius, 'in')
    : irisRadius(progress, maxRadius, 'out');
}
