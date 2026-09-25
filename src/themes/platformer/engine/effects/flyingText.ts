/**
 * The collected-fact flying-text family (R-004 US1): a rising/holding/flying
 * four-phase machine that carries its own screen-space start/mid/target and an
 * optional emoji icon, plus the collection-text slot allocator every
 * flying-text site shares.
 */
import { clamp01, lerp } from '../../shared/math';
import { fillTextWithOutline, RESTART_PROMPT_FONT_FAMILY } from '../textDraw';
import type { EffectRenderContext, TransientEffect } from './transientEffect';

/** Seconds each phase of a collected-fact animation takes: a quick rise from
 *  the collection point to the middle of the screen, a hold there so the
 *  fact is actually readable, then the flying leg to the journal icon. */
export const RISE_DURATION_SECONDS = 0.4;
export const HOLD_DURATION_SECONDS = 1.0;
export const FLY_DURATION_SECONDS = 0.6;

/** Total lifetime of a flying-text effect (the default expiry bound is unused: the
 *  family expires on `phase === 'done'`). */
export const FLYING_TEXT_DURATION_SECONDS =
  RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS + FLY_DURATION_SECONDS;

export type FlyingTextPhase = 'rising' | 'holding' | 'flying' | 'done';

/**
 * The flying-text family's payload. `startX/startY`, `midX/midY`, and
 * `targetX/targetY` are all SCREEN-space, computed once at collection time by
 * the caller. `text` is the short label shown throughout; `icon` is an
 * optional emoji drawn in a different (system) font.
 */
export interface FlyingTextState {
  text: string;
  icon?: string;
  startX: number;
  startY: number;
  midX: number;
  midY: number;
  targetX: number;
  targetY: number;
  phase: FlyingTextPhase;
}

/** Fixed number of vertical text "slots" fast/simultaneous collections cycle
 *  through (handed out by `createSlotAllocator` below) — 1, 2, 3, 1, 2, 3, ... */
export const COLLECTION_TEXT_SLOT_COUNT = 3;

/** Vertical gap between successive collection-text slots, in screen px. */
export const COLLECTION_TEXT_STACK_ROW_HEIGHT = 34;

/** Hands out the next collection-text stack offset, in screen px. */
export type SlotAllocator = () => number;

/**
 * Builds one tick's collection-text slot allocator: successive calls step down
 * a row and cycle through `COLLECTION_TEXT_SLOT_COUNT` slots, starting from
 * `inFlightCount`. ONE allocator is created per tick and SHARED by every
 * flying-text site, so two texts in the same tick never land on the same row.
 */
export function createSlotAllocator(inFlightCount: number): SlotAllocator {
  let nextSlot = inFlightCount % COLLECTION_TEXT_SLOT_COUNT;
  return () => {
    const slot = nextSlot;
    nextSlot = (nextSlot + 1) % COLLECTION_TEXT_SLOT_COUNT;
    return slot * COLLECTION_TEXT_STACK_ROW_HEIGHT;
  };
}

/** Advances the effect by `dt`, transitioning `rising → holding → flying →
 *  done`. No-op (same reference) once `done`. */
export function tickFlyingText(
  effect: TransientEffect<FlyingTextState>,
  dt: number,
): TransientEffect<FlyingTextState> {
  if (effect.state.phase === 'done') return effect;
  const elapsed = effect.elapsed + dt;
  const holdEnd = RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS;
  const flyEnd = holdEnd + FLY_DURATION_SECONDS;
  if (elapsed >= flyEnd) {
    return { ...effect, elapsed, state: { ...effect.state, phase: 'done' } };
  }
  const phase: FlyingTextPhase =
    elapsed >= holdEnd ? 'flying' : elapsed >= RISE_DURATION_SECONDS ? 'holding' : 'rising';
  return { ...effect, elapsed, state: { ...effect.state, phase } };
}

/** The family's exact expiry boundary: the machine's terminal phase. */
export function flyingTextExpired(effect: TransientEffect<FlyingTextState>): boolean {
  return effect.state.phase === 'done';
}

/** Current screen-space position and opacity (0-1) to draw the text at. */
export function flyingTextPosition(
  effect: TransientEffect<FlyingTextState>,
): { x: number; y: number; opacity: number } {
  const s = effect.state;
  if (s.phase === 'done') {
    return { x: s.targetX, y: s.targetY, opacity: 0 };
  }
  if (s.phase === 'rising') {
    const x = lerp(s.startX, s.midX, effect.elapsed / RISE_DURATION_SECONDS);
    const y = lerp(s.startY, s.midY, effect.elapsed / RISE_DURATION_SECONDS);
    return { x, y, opacity: 1 };
  }
  if (s.phase === 'holding') {
    return { x: s.midX, y: s.midY, opacity: 1 };
  }
  const flyElapsed = effect.elapsed - RISE_DURATION_SECONDS - HOLD_DURATION_SECONDS;
  const progress = clamp01(flyElapsed / FLY_DURATION_SECONDS);
  const x = lerp(s.midX, s.targetX, flyElapsed / FLY_DURATION_SECONDS);
  const y = lerp(s.midY, s.targetY, flyElapsed / FLY_DURATION_SECONDS);
  const opacity = progress < 0.6 ? 1 : 1 - (progress - 0.6) / 0.4;
  return { x, y, opacity };
}

const COLLECTION_EFFECT_FONT_SIZE = 28;
const COLLECTION_EFFECT_ICON_FONT_SIZE = 20;
const COLLECTION_EFFECT_ICON_GAP = 6;

/** The flying-text family's registered draw — the former Renderer.ts collection-text
 *  draw body. Screen-space (no camera offset). */
export function drawFlyingText(effect: TransientEffect<FlyingTextState>, rc: EffectRenderContext): void {
  const ctx = rc.ctx;
  const { x, y, opacity } = flyingTextPosition(effect);
  if (opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#fff';
  ctx.font = `${COLLECTION_EFFECT_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fillTextWithOutline(ctx, effect.state.text, x, y);

  // The icon is drawn as a SEPARATE fillText, in a plain system font (the
  // pixel font has no emoji glyphs), positioned just left of the text using
  // the text's measured half-width.
  if (effect.state.icon) {
    const textHalfWidth = ctx.measureText(effect.state.text).width / 2;
    ctx.font = `${COLLECTION_EFFECT_ICON_FONT_SIZE}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(effect.state.icon, x - textHalfWidth - COLLECTION_EFFECT_ICON_GAP, y);
  }
  ctx.restore();
}

export function startFlyingText(
  id: string,
  text: string,
  startX: number,
  startY: number,
  midX: number,
  midY: number,
  targetX: number,
  targetY: number,
  icon?: string,
): TransientEffect<FlyingTextState> {
  return {
    kind: 'flyingText',
    id,
    duration: FLYING_TEXT_DURATION_SECONDS,
    elapsed: 0,
    state: { text, icon, startX, startY, midX, midY, targetX, targetY, phase: 'rising' },
    tick: tickFlyingText,
    draw: drawFlyingText,
    expired: flyingTextExpired,
  };
}
