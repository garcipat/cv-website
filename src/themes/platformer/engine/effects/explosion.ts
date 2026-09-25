/**
 * The explosion family (R-004 US1): a one-shot sheet animation centred on a
 * world point. Purely cosmetic — never a hazard.
 */
import { EXPLOSION_SHEET } from '../../entities/sprites/sheets';
import { frameSource } from '../../entities/sprites/SpriteSheet';
import { RENDER_SCALE } from '../../level/Terrain';
import { clamp01 } from '../../shared/math';
import type { EffectRenderContext, TransientEffect } from './transientEffect';

/** Seconds each explosion frame is shown. */
const EXPLOSION_FRAME_SECONDS = 0.05;
/** Frames in the explosion sheet. */
export const EXPLOSION_FRAME_COUNT = EXPLOSION_SHEET.columns;
/** Total seconds an explosion plays before it is removed. */
export const EXPLOSION_DURATION_SECONDS = EXPLOSION_FRAME_COUNT * EXPLOSION_FRAME_SECONDS;
/** The explosion draws at `renderScale 2` scaled by this. */
export const EXPLOSION_DRAW_SCALE = 1.5;

/** The explosion payload: the blast centre in world px. */
export interface ExplosionState {
  x: number;
  y: number;
}

export function startExplosionEffect(
  id: string,
  x: number,
  y: number,
): TransientEffect<ExplosionState> {
  return {
    kind: 'explosion',
    id,
    duration: EXPLOSION_DURATION_SECONDS,
    elapsed: 0,
    state: { x, y },
    tick: tickExplosionEffect,
    draw: drawExplosionEffect,
    expired: (effect) => effect.elapsed > effect.duration,
  };
}

/** Advances the effect by `dt`. No phase machine. */
export function tickExplosionEffect(
  effect: TransientEffect<ExplosionState>,
  dt: number,
): TransientEffect<ExplosionState> {
  return { ...effect, elapsed: effect.elapsed + dt };
}

/** The active sheet's frame to draw, playing each frame once in order and
 *  clamping to the last frame at/past the duration. */
export function explosionFrameIndex(effect: TransientEffect<ExplosionState>): number {
  const progress = clamp01(effect.elapsed / EXPLOSION_DURATION_SECONDS);
  return Math.min(Math.floor(progress * EXPLOSION_FRAME_COUNT), EXPLOSION_FRAME_COUNT - 1);
}

/** The explosion family's registered draw — the former Renderer.ts
 *  `drawExplosions` body. */
export function drawExplosionEffect(
  effect: TransientEffect<ExplosionState>,
  rc: EffectRenderContext,
): void {
  const ctx = rc.ctx;
  ctx.imageSmoothingEnabled = false;
  const image = rc.dc.sprites[EXPLOSION_SHEET.src];
  if (!image) return;

  const size = EXPLOSION_SHEET.frameWidth * RENDER_SCALE * EXPLOSION_DRAW_SCALE;
  const { sx, sy } = frameSource(EXPLOSION_SHEET, explosionFrameIndex(effect));
  ctx.drawImage(
    image,
    sx,
    sy,
    EXPLOSION_SHEET.frameWidth,
    EXPLOSION_SHEET.frameHeight,
    effect.state.x + rc.dc.originX - size / 2,
    effect.state.y + rc.dc.originY - size / 2,
    size,
    size,
  );
}
