/**
 * Seconds the iris-in (grow, game start/restart) and iris-out (shrink, death)
 * animations each take. Chosen for a deliberately slow, dramatic beat rather
 * than a snappy transition.
 */
export const IRIS_DURATION_SECONDS = 1.75;

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
 * Circle radius at a given point in the animation. `progress` (0-1, clamped)
 * is elapsed time / IRIS_DURATION_SECONDS. `'in'` (game start/restart) grows
 * 0 -> maxRadius; `'out'` (death) shrinks maxRadius -> 0.
 */
export function irisRadius(
  progress: number,
  maxRadius: number,
  direction: 'in' | 'out',
): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return direction === 'in' ? clamped * maxRadius : (1 - clamped) * maxRadius;
}
