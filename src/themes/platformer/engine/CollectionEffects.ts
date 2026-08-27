/** Seconds the fact text lingers near the collection point before flying
 *  off, and how long the flight itself takes. */
export const HOVER_DURATION_SECONDS = 0.5;
export const FLIGHT_DURATION_SECONDS = 0.6;

/**
 * One in-flight collected-fact animation. `startX/startY` and
 * `targetX/targetY` are both SCREEN-space (not world-space) — computed once
 * at collection time by the caller (PlatformerPage.tsx, Task 8) using the
 * camera origin at that instant, since the animation is short-lived (~1.1s)
 * and re-deriving world-to-screen every frame isn't worth the complexity for
 * an effect this brief. `text` is the short label shown while flying (the
 * category or language name — see this plan's "Key design decisions" for
 * why it's not the full skill list).
 */
export interface FlightEffect {
  id: string;
  text: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  elapsed: number;
  phase: 'hover' | 'flying' | 'done';
}

export function startFlightEffect(
  id: string,
  text: string,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
): FlightEffect {
  return { id, text, startX, startY, targetX, targetY, elapsed: 0, phase: 'hover' };
}

/** Advances the effect by `dt` seconds, transitioning hover -> flying ->
 *  done as HOVER_DURATION_SECONDS then FLIGHT_DURATION_SECONDS elapse.
 *  No-op (same reference) once `done`. */
export function tickFlightEffect(effect: FlightEffect, dt: number): FlightEffect {
  if (effect.phase === 'done') return effect;
  const elapsed = effect.elapsed + dt;
  if (elapsed >= HOVER_DURATION_SECONDS + FLIGHT_DURATION_SECONDS) {
    return { ...effect, elapsed, phase: 'done' };
  }
  return { ...effect, elapsed, phase: elapsed >= HOVER_DURATION_SECONDS ? 'flying' : 'hover' };
}

/** A gentle upward drift while hovering, so the text doesn't feel frozen in
 *  place even before it starts flying. */
const HOVER_RISE_PX = 12;

/**
 * Current screen-space position and opacity (0-1) to draw the fact text at.
 * `hover`: drifts upward from startY, full opacity. `flying`: linearly
 * interpolates start -> target, fading out over the final 40% of the flight
 * so it doesn't pop out of existence right at the icon. `done`: invisible.
 */
export function flightEffectPosition(effect: FlightEffect): { x: number; y: number; opacity: number } {
  if (effect.phase === 'done') {
    return { x: effect.targetX, y: effect.targetY, opacity: 0 };
  }
  if (effect.phase === 'hover') {
    const progress = Math.min(1, effect.elapsed / HOVER_DURATION_SECONDS);
    return { x: effect.startX, y: effect.startY - HOVER_RISE_PX * progress, opacity: 1 };
  }
  const flightElapsed = effect.elapsed - HOVER_DURATION_SECONDS;
  const progress = Math.min(1, flightElapsed / FLIGHT_DURATION_SECONDS);
  const x = effect.startX + (effect.targetX - effect.startX) * progress;
  const y = effect.startY + (effect.targetY - effect.startY) * progress;
  const opacity = progress < 0.6 ? 1 : 1 - (progress - 0.6) / 0.4;
  return { x, y, opacity };
}

export const SPARKLE_DURATION_SECONDS = 0.4;
const SPARKLE_COUNT = 6;
const SPARKLE_MAX_RADIUS = 18;

export interface SparkleParticle {
  dx: number;
  dy: number;
  opacity: number;
}

/**
 * A fixed ring of small dots radiating outward from a collection point and
 * fading, in place of a full particle system — see this plan's "Key design
 * decisions". Returns offsets (dx/dy) relative to the collection point, not
 * absolute positions, so the caller (Renderer.ts, Task 6) just adds them to
 * wherever the collectible was.
 */
export function sparkleParticles(elapsedSinceCollect: number): SparkleParticle[] {
  if (elapsedSinceCollect < 0 || elapsedSinceCollect > SPARKLE_DURATION_SECONDS) return [];
  const progress = elapsedSinceCollect / SPARKLE_DURATION_SECONDS;
  const radius = SPARKLE_MAX_RADIUS * progress;
  const opacity = 1 - progress;
  return Array.from({ length: SPARKLE_COUNT }, (_, i) => {
    const angle = (i / SPARKLE_COUNT) * Math.PI * 2;
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius, opacity };
  });
}
