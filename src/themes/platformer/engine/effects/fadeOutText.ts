/**
 * The fading world-text family (R-004 US1): a world-anchored label that fades
 * in place. It is the one `'death'`-scoped effect kind — a death/respawn
 * clears it (FR-006).
 */
import { fillTextWithOutline, RESTART_PROMPT_FONT_FAMILY } from '../textDraw';
import type { EffectRenderContext, TransientEffect } from './transientEffect';

/** Total seconds a fade-out label stays on screen before it is removed. */
export const FADE_OUT_TEXT_DURATION_SECONDS = 0.6;
const FADE_OUT_TEXT_FONT_SIZE = 16;

/** The fade-out-text payload. `text` is already localized. */
export interface FadeOutTextState {
  x: number;
  y: number;
  text: string;
}

export function startFadeOutTextEffect(
  id: string,
  x: number,
  y: number,
  text: string,
): TransientEffect<FadeOutTextState> {
  return {
    kind: 'fadeOutText',
    id,
    duration: FADE_OUT_TEXT_DURATION_SECONDS,
    elapsed: 0,
    state: { x, y, text },
    tick: tickFadeOutTextEffect,
    draw: drawFadeOutText,
    expired: (effect) => effect.elapsed > effect.duration,
  };
}

/** Advances the effect by `dt`. No phase machine. */
export function tickFadeOutTextEffect(
  effect: TransientEffect<FadeOutTextState>,
  dt: number,
): TransientEffect<FadeOutTextState> {
  return { ...effect, elapsed: effect.elapsed + dt };
}

/** 1 at the start, fading linearly to 0 by the duration, and 0 outside. */
export function fadeOutTextOpacity(elapsed: number): number {
  if (elapsed < 0 || elapsed > FADE_OUT_TEXT_DURATION_SECONDS) return 0;
  return 1 - elapsed / FADE_OUT_TEXT_DURATION_SECONDS;
}

/** The fade-out-text family's registered draw — the former Renderer.ts
 *  `drawFadeOutTexts` body. World-space, origin-shifted. */
export function drawFadeOutText(
  effect: TransientEffect<FadeOutTextState>,
  rc: EffectRenderContext,
): void {
  const opacity = fadeOutTextOpacity(effect.elapsed);
  if (opacity <= 0) return;

  const ctx = rc.ctx;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#fff';
  ctx.font = `${FADE_OUT_TEXT_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fillTextWithOutline(
    ctx,
    effect.state.text,
    effect.state.x + rc.dc.originX,
    effect.state.y + rc.dc.originY,
  );
  ctx.restore();
}
