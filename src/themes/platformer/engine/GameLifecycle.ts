import { lerp } from '../shared/math';

/**
 * Seconds the main grow-open (intro) / shrink-closed (dying) segment of the
 * iris animation takes. Chosen for a deliberately slow, dramatic beat rather
 * than a snappy transition.
 */
export const IRIS_DURATION_SECONDS = 1.75;

/**
 * Seconds the iris pauses at IRIS_SMALL_RADIUS — already circled in at the
 * very start of `intro` (before growing open), and again mid-`dying` (after
 * shrinking down around the just-died character, before the final full
 * close) — a beat of held tension on both ends of the transition.
 */
export const IRIS_HOLD_SECONDS = 0.4;

/**
 * Seconds the final `dying` segment (IRIS_SMALL_RADIUS -> 0, the full black
 * close) takes. Short relative to IRIS_DURATION_SECONDS since it only
 * crosses a small remaining distance — reads as a quick, final snap shut.
 */
export const IRIS_CLOSE_SECONDS = 0.5;

/**
 * The radius the iris holds at when "encircling" the character — small
 * enough to read as a tight circle around the player (PLAYER_RENDERED_SIZE
 * is 64px), with a bit of margin. Not exported alongside a player-specific
 * import to keep this module free of a dependency on entities/Player.
 */
export const IRIS_SMALL_RADIUS = 60;

/**
 * The radius a circle centered at (centerX, centerY) needs to fully cover a
 * canvasWidth x canvasHeight rectangle — the distance to the farthest corner,
 * computed without enumerating all four corners: the farthest corner is
 * always at the horizontal edge farther from centerX combined with the
 * vertical edge farther from centerY.
 *
 * Merged here from the removed `engine/IrisTransition.ts`, which existed only
 * to hold this math for `GameLifecycle`.
 */
export function maxIrisRadius(
  canvasWidth: number,
  canvasHeight: number,
  centerX: number,
  centerY: number,
): number {
  const dx = Math.max(centerX, canvasWidth - centerX);
  const dy = Math.max(centerY, canvasHeight - centerY);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * `intro`: circle already held small, then growing open at game
 * start/restart (non-blocking — see this plan's Architecture note; physics
 * still runs underneath).
 * `playing`: normal gameplay, no overlay drawn.
 * `dying`: circle shrinking closed on death, game loop paused.
 * `awaitingRestart`: fully black, "Press any button to restart" shown,
 * game loop paused, waiting for input.
 * `paused`: the journal overlay or the floating theme/locale controls are
 * open — game loop paused, no iris overlay drawn (the DOM overlay covers the
 * screen instead).
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
 * Seconds the player's death animation (Player.ts's `'death'` animState, a
 * 4-frame collapse) plays before the iris starts closing in — a lead-in
 * during which `currentIrisRadius` holds at `maxRadius` (no visible mask, so
 * the collapse plays over an otherwise-normal-looking frozen scene) and
 * PlatformerPage.tsx's game loop advances the player's animation despite the
 * rest of the 'dying' phase leaving it frozen. Matches Player.ts's
 * `ANIM_CONFIG.death` (4 frames x 0.15s) exactly, so the animation lands on
 * its last (collapsed) frame right as the lead-in ends, and that frame stays
 * held for the rest of the 'dying' phase while the iris closes around it.
 */
export const DEATH_ANIM_SECONDS = 0.6;

/**
 * `dying` total timeline: holds the player's death animation on screen for
 * DEATH_ANIM_SECONDS (iris fully open, no visible mask), then shrinks
 * maxRadius -> IRIS_SMALL_RADIUS over IRIS_DURATION_SECONDS, holds there for
 * IRIS_HOLD_SECONDS (the character is fully encircled — a beat of held
 * tension), then closes IRIS_SMALL_RADIUS -> 0 over IRIS_CLOSE_SECONDS.
 */
const DYING_TOTAL_SECONDS =
  DEATH_ANIM_SECONDS + IRIS_DURATION_SECONDS + IRIS_HOLD_SECONDS + IRIS_CLOSE_SECONDS;

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
    return lerp(smallRadius, maxRadius, growProgress);
  }

  // 'dying' — the death-animation lead-in holds the mask fully open (no
  // visible circle) before the shrink/hold/close timeline below begins.
  if (state.elapsed < DEATH_ANIM_SECONDS) return maxRadius;
  const irisElapsed = state.elapsed - DEATH_ANIM_SECONDS;
  if (irisElapsed < IRIS_DURATION_SECONDS) {
    const shrinkProgress = irisElapsed / IRIS_DURATION_SECONDS;
    return lerp(maxRadius, smallRadius, shrinkProgress);
  }
  if (irisElapsed < IRIS_DURATION_SECONDS + IRIS_HOLD_SECONDS) return smallRadius;
  const closeProgress =
    (irisElapsed - IRIS_DURATION_SECONDS - IRIS_HOLD_SECONDS) / IRIS_CLOSE_SECONDS;
  return lerp(smallRadius, 0, closeProgress);
}
