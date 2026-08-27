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
 * Linear interpolation between `fromRadius` and `toRadius`. `progress`
 * (0-1, clamped) is elapsed time / segment duration for whichever animation
 * segment the caller is in.
 */
export function lerpRadius(progress: number, fromRadius: number, toRadius: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return fromRadius + (toRadius - fromRadius) * clamped;
}
