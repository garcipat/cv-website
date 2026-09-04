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
   * same string would silently fail to render (canvas `fillText` doesn't
   * fall back to a system emoji font the way DOM text does). */
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

/** Vertical gap between successive collection-text slots, in screen px (see
 *  COLLECTION_TEXT_SLOT_COUNT). */
export const COLLECTION_TEXT_STACK_ROW_HEIGHT = 34;

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

/** Seconds the "(icon) collected / total" counter popup stays fully visible
 *  before fading, and the total seconds until it's gone — a per-collection
 *  running-count popup shown near the collection point rather than a
 *  persistent HUD counter, to avoid clutter at the top. Sized so the popup's
 *  total lifetime (HOLD + FADE) slightly exceeds the fact-flight text's own
 *  total lifetime (RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS +
 *  FLIGHT_DURATION_SECONDS = 2.0s), so the counter doesn't disappear before
 *  the flight text below it is done, which would read as vanishing too
 *  fast. */
export const COUNTER_POPUP_HOLD_SECONDS = 1.7;
export const COUNTER_POPUP_FADE_SECONDS = 0.4;
export const COUNTER_POPUP_DURATION_SECONDS = COUNTER_POPUP_HOLD_SECONDS + COUNTER_POPUP_FADE_SECONDS;

export type CounterPopupLabelKey = 'coins' | 'fruits' | 'enemies' | 'crates';

/**
 * One "(icon) collected / total" counter popup for a single collectible
 * type. `PlatformerState.ts`'s `activeCounterPopups` keeps at most one of
 * these PER TYPE (keyed by `labelKey`) — collecting another coin while a
 * coin popup is already showing refreshes that same slot (new count, timer
 * restarted) rather than queuing a second one, but collecting a coin and a
 * fruit close together shows both side by side, since they're genuinely
 * different information (unlike the fact-flight text's rotating slots, which
 * exist purely to avoid overlapping the SAME kind of text). Drawn at a fixed
 * screen position above the fact-flight text's stacked slots (see
 * PlatformerPage.tsx/Renderer.ts), not tied to the collection point.
 */
export interface CounterPopupEffect {
  labelKey: CounterPopupLabelKey;
  collected: number;
  total: number;
  elapsed: number;
}

export function startCounterPopup(
  labelKey: CounterPopupEffect['labelKey'],
  collected: number,
  total: number,
): CounterPopupEffect {
  return { labelKey, collected, total, elapsed: 0 };
}

/** Advances the popup by `dt` seconds; returns `null` once its total
 *  duration has elapsed (the caller clears the signal at that point). */
export function tickCounterPopup(effect: CounterPopupEffect, dt: number): CounterPopupEffect | null {
  const elapsed = effect.elapsed + dt;
  if (elapsed >= COUNTER_POPUP_DURATION_SECONDS) return null;
  return { ...effect, elapsed };
}

/** 1 while held, then linearly fades to 0 over the final
 *  COUNTER_POPUP_FADE_SECONDS. */
export function counterPopupOpacity(effect: CounterPopupEffect): number {
  if (effect.elapsed < COUNTER_POPUP_HOLD_SECONDS) return 1;
  return Math.max(0, 1 - (effect.elapsed - COUNTER_POPUP_HOLD_SECONDS) / COUNTER_POPUP_FADE_SECONDS);
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
 * just adds them to wherever the collectible was. `scale` multiplies the
 * ring's radius (default 1, unchanged from before this parameter existed) —
 * PuffEffect below uses it to make a bigger entity's puff visibly bigger.
 */
export function sparkleParticles(elapsedSinceCollect: number, scale = 1): SparkleParticle[] {
  if (elapsedSinceCollect < 0 || elapsedSinceCollect > SPARKLE_DURATION_SECONDS) return [];
  const progress = elapsedSinceCollect / SPARKLE_DURATION_SECONDS;
  const radius = SPARKLE_MAX_RADIUS * scale * progress;
  const opacity = 1 - progress;
  return Array.from({ length: SPARKLE_COUNT }, (_, i) => {
    const angle = (i / SPARKLE_COUNT) * Math.PI * 2;
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius, opacity };
  });
}

/**
 * A standalone sparkle burst at a world event — an enemy defeated, a block
 * broken — that carries no fact and flies nowhere (unlike FlightEffect,
 * which is always fact-bearing). Kept as its own type rather than a
 * degenerate FlightEffect (empty text, equal start/mid/target coordinates):
 * see B-003 (docs/bugs/B-003-puff-bound-to-fact-reward/ticket.md) for why
 * that hack was the wrong shape. `scale` lets a bigger entity (a purple
 * slime vs. a green slime) produce a visibly bigger burst — see
 * entities/Enemy.ts's `enemyEffectAnchor`.
 */
export interface PuffEffect {
  id: string;
  x: number;
  y: number;
  scale: number;
  elapsed: number;
}

export function startPuffEffect(id: string, x: number, y: number, scale = 1): PuffEffect {
  return { id, x, y, scale, elapsed: 0 };
}

/** Advances the puff by `dt` seconds. No phase machine (unlike
 *  tickFlightEffect) — a puff has exactly one phase, bursting, and callers
 *  filter it out once `elapsed` passes SPARKLE_DURATION_SECONDS (same bound
 *  `sparkleParticles` itself already enforces by returning `[]`). */
export function tickPuffEffect(effect: PuffEffect, dt: number): PuffEffect {
  return { ...effect, elapsed: effect.elapsed + dt };
}
