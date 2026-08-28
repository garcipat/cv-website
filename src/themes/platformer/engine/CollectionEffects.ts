/** Seconds each phase of a collected-fact animation takes: a quick rise from
 *  the collection point to the middle of the screen, a hold there so the
 *  fact is actually readable, then the flight to the journal icon. */
export const RISE_DURATION_SECONDS = 0.4;
export const HOLD_DURATION_SECONDS = 1.0;
export const FLIGHT_DURATION_SECONDS = 0.6;

/**
 * One in-flight collected-fact animation. `startX/startY` (the collection
 * point), `midX/midY` (the screen's center — where the text pauses to be
 * read), and `targetX/targetY` (the journal icon) are all SCREEN-space (not
 * world-space) — computed once at collection time by the caller
 * (PlatformerPage.tsx) using the camera origin and canvas size at that
 * instant, since the animation is short-lived (~2s) and re-deriving
 * world-to-screen every frame isn't worth the complexity for an effect this
 * brief. `text` is the short label shown throughout (the category or
 * language name — see the coin-collection plan's "Key design decisions" for
 * why it's not the full skill list).
 */
export interface FlightEffect {
  id: string;
  text: string;
  /** Optional icon (an emoji — a language's flag, or a section's generic
   * symbol) shown alongside `text`. Kept separate rather than baked into
   * `text` because Renderer.ts draws it with a different font: the pixel
   * font `text` uses has no emoji glyphs, so an emoji concatenated into the
   * same string silently failed to render (canvas `fillText` doesn't fall
   * back to a system emoji font the way DOM text does) — see this field's
   * addition for the fix. */
  icon?: string;
  startX: number;
  startY: number;
  midX: number;
  midY: number;
  targetX: number;
  targetY: number;
  elapsed: number;
  phase: 'rising' | 'holding' | 'flying' | 'done';
}

export function startFlightEffect(
  id: string,
  text: string,
  startX: number,
  startY: number,
  midX: number,
  midY: number,
  targetX: number,
  targetY: number,
  icon?: string,
): FlightEffect {
  return { id, text, icon, startX, startY, midX, midY, targetX, targetY, elapsed: 0, phase: 'rising' };
}

/** Fixed number of vertical text "slots" fast/simultaneous collections cycle
 *  through (see PlatformerPage.tsx's `nextTextSlot`) — 1, 2, 3, 1, 2, 3, ...
 *  so collecting several pickups in quick succession reads as a short
 *  rotating list instead of every fact text landing on the exact same
 *  screen position. */
export const COLLECTION_TEXT_SLOT_COUNT = 3;

/** Advances the effect by `dt` seconds, transitioning
 *  rising -> holding -> flying -> done as RISE_DURATION_SECONDS, then
 *  HOLD_DURATION_SECONDS, then FLIGHT_DURATION_SECONDS elapse. No-op (same
 *  reference) once `done`. */
export function tickFlightEffect(effect: FlightEffect, dt: number): FlightEffect {
  if (effect.phase === 'done') return effect;
  const elapsed = effect.elapsed + dt;
  const holdEnd = RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS;
  const flightEnd = holdEnd + FLIGHT_DURATION_SECONDS;
  if (elapsed >= flightEnd) {
    return { ...effect, elapsed, phase: 'done' };
  }
  const phase = elapsed >= holdEnd ? 'flying' : elapsed >= RISE_DURATION_SECONDS ? 'holding' : 'rising';
  return { ...effect, elapsed, phase };
}

/**
 * Current screen-space position and opacity (0-1) to draw the fact text at.
 * `rising`: interpolates start -> mid, full opacity. `holding`: fixed at
 * mid, full opacity — this is the readable pause. `flying`: linearly
 * interpolates mid -> target, fading out over the final 40% of the flight so
 * it doesn't pop out of existence right at the icon. `done`: invisible.
 */
export function flightEffectPosition(effect: FlightEffect): { x: number; y: number; opacity: number } {
  if (effect.phase === 'done') {
    return { x: effect.targetX, y: effect.targetY, opacity: 0 };
  }
  if (effect.phase === 'rising') {
    const progress = Math.min(1, effect.elapsed / RISE_DURATION_SECONDS);
    const x = effect.startX + (effect.midX - effect.startX) * progress;
    const y = effect.startY + (effect.midY - effect.startY) * progress;
    return { x, y, opacity: 1 };
  }
  if (effect.phase === 'holding') {
    return { x: effect.midX, y: effect.midY, opacity: 1 };
  }
  const flightElapsed = effect.elapsed - RISE_DURATION_SECONDS - HOLD_DURATION_SECONDS;
  const progress = Math.min(1, flightElapsed / FLIGHT_DURATION_SECONDS);
  const x = effect.midX + (effect.targetX - effect.midX) * progress;
  const y = effect.midY + (effect.targetY - effect.midY) * progress;
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
 * fading, in place of a full particle system — see the coin-collection
 * plan's "Key design decisions". Returns offsets (dx/dy) relative to the
 * collection point, not absolute positions, so the caller (Renderer.ts)
 * just adds them to wherever the collectible was.
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
