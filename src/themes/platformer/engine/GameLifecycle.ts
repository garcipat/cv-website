import {
  IRIS_DURATION_SECONDS,
  IRIS_HOLD_SECONDS,
  IRIS_CLOSE_SECONDS,
  IRIS_SMALL_RADIUS,
  lerpRadius,
} from './IrisTransition';

/**
 * `intro`: circle already held small, then growing open at game
 * start/restart (non-blocking — see this plan's Architecture note; physics
 * still runs underneath).
 * `playing`: normal gameplay, no overlay drawn.
 * `dying`: circle shrinking closed on death, game loop paused.
 * `awaitingRestart`: fully black, "Press any button to restart" shown,
 * game loop paused, waiting for input.
 * `paused`: the journal overlay is open (or, in a later step, the floating
 * controls are open) — game loop paused, no iris overlay drawn (the DOM
 * overlay covers the screen instead).
 * `ending-screen`: the Thank You screen is open (every chest in the level has
 * been opened, spec.md FR-024) — game loop paused, no iris overlay drawn (the
 * DOM overlay covers the screen instead), same as `paused`.
 */
export type GamePhase = 'intro' | 'playing' | 'dying' | 'awaitingRestart' | 'paused' | 'ending-screen';

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

/**
 * `intro` total timeline: held at IRIS_SMALL_RADIUS for IRIS_HOLD_SECONDS,
 * then grows IRIS_SMALL_RADIUS -> maxRadius over IRIS_DURATION_SECONDS.
 */
const INTRO_TOTAL_SECONDS = IRIS_HOLD_SECONDS + IRIS_DURATION_SECONDS;

/**
 * `dying` total timeline: shrinks maxRadius -> IRIS_SMALL_RADIUS over
 * IRIS_DURATION_SECONDS, holds there for IRIS_HOLD_SECONDS (the character is
 * fully encircled — a beat of held tension), then closes
 * IRIS_SMALL_RADIUS -> 0 over IRIS_CLOSE_SECONDS.
 */
const DYING_TOTAL_SECONDS = IRIS_DURATION_SECONDS + IRIS_HOLD_SECONDS + IRIS_CLOSE_SECONDS;

export function introState(centerX: number, centerY: number): LifecycleState {
  return { phase: 'intro', elapsed: 0, centerX, centerY };
}

export function startDeath(centerX: number, centerY: number): LifecycleState {
  return { phase: 'dying', elapsed: 0, centerX, centerY };
}

/** Transitions to `paused` (e.g. the journal opening) without touching the
 *  frozen `elapsed`/`centerX`/`centerY` — there's no animation running while
 *  paused, so nothing else needs to change. */
export function pauseForJournal(state: LifecycleState): LifecycleState {
  return { ...state, phase: 'paused' };
}

/** Transitions back to `playing` (e.g. the journal closing). */
export function resumeFromJournal(state: LifecycleState): LifecycleState {
  return { ...state, phase: 'playing' };
}

/** Transitions to `ending-screen` (every chest just got opened) without
 *  touching the frozen `elapsed`/`centerX`/`centerY` — mirrors
 *  pauseForJournal. */
export function showEndingScreen(state: LifecycleState): LifecycleState {
  return { ...state, phase: 'ending-screen' };
}

/** Transitions back to `playing` (the Thank You screen was dismissed) —
 *  mirrors resumeFromJournal. */
export function dismissEndingScreen(state: LifecycleState): LifecycleState {
  return { ...state, phase: 'playing' };
}

/**
 * Advances `elapsed` by `dt` seconds for the two time-driven phases,
 * transitioning 'intro' -> 'playing' and 'dying' -> 'awaitingRestart' once
 * that phase's total duration is reached or exceeded. No-op (same reference
 * returned) for 'playing'/'awaitingRestart', which have no timer running.
 */
export function tickLifecycle(state: LifecycleState, dt: number): LifecycleState {
  if (state.phase !== 'intro' && state.phase !== 'dying') return state;
  const elapsed = state.elapsed + dt;
  const totalDuration = state.phase === 'intro' ? INTRO_TOTAL_SECONDS : DYING_TOTAL_SECONDS;
  if (elapsed >= totalDuration) {
    return {
      ...state,
      elapsed: totalDuration,
      phase: state.phase === 'intro' ? 'playing' : 'awaitingRestart',
    };
  }
  return { ...state, elapsed };
}

/**
 * Circle radius to draw for the current phase, or `null` when 'playing'
 * (no overlay drawn at all — the caller should skip the draw call entirely
 * rather than draw a full-radius, fully-transparent circle every frame).
 *
 * 'intro' and 'dying' each hold at IRIS_SMALL_RADIUS (clamped to maxRadius,
 * for a canvas too small to need a bigger circle) for a beat before/after
 * the main grow/shrink segment — see INTRO_TOTAL_SECONDS/DYING_TOTAL_SECONDS
 * above for the full timeline of each.
 */
export function currentIrisRadius(state: LifecycleState, maxRadius: number): number | null {
  if (state.phase === 'playing' || state.phase === 'paused' || state.phase === 'ending-screen') return null;
  if (state.phase === 'awaitingRestart') return 0;

  const smallRadius = Math.min(IRIS_SMALL_RADIUS, maxRadius);

  if (state.phase === 'intro') {
    if (state.elapsed < IRIS_HOLD_SECONDS) return smallRadius;
    const growProgress = (state.elapsed - IRIS_HOLD_SECONDS) / IRIS_DURATION_SECONDS;
    return lerpRadius(growProgress, smallRadius, maxRadius);
  }

  // 'dying'
  if (state.elapsed < IRIS_DURATION_SECONDS) {
    const shrinkProgress = state.elapsed / IRIS_DURATION_SECONDS;
    return lerpRadius(shrinkProgress, maxRadius, smallRadius);
  }
  if (state.elapsed < IRIS_DURATION_SECONDS + IRIS_HOLD_SECONDS) return smallRadius;
  const closeProgress =
    (state.elapsed - IRIS_DURATION_SECONDS - IRIS_HOLD_SECONDS) / IRIS_CLOSE_SECONDS;
  return lerpRadius(closeProgress, smallRadius, 0);
}
