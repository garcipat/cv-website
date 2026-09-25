/**
 * The world-event puff family (R-004 US1): a fixed radial sparkle burst
 * anchored to a world point, with an optional pixel-art square style used by
 * the checkpoint activation burst.
 */
import { particleList, type Particle } from './particles';
import type { EffectRenderContext, TransientEffect } from './transientEffect';

/** Total seconds a puff plays before it is removed. */
export const SPARKLE_DURATION_SECONDS = 0.4;
const SPARKLE_COUNT = 6;
const SPARKLE_MAX_RADIUS = 18;

export type SparkleParticle = Particle;

/** A fixed ring of small dots radiating outward from a collection point and
 *  fading. `scale` multiplies the ring's radius. Routes the emission loop
 *  through `particles.ts`'s `particleList`; the ring's own arithmetic (the
 *  angle-per-index placement and radius/fade) stays here byte-for-byte. */
export function sparkleParticles(elapsedSinceCollect: number, scale = 1): Particle[] {
  if (elapsedSinceCollect < 0 || elapsedSinceCollect > SPARKLE_DURATION_SECONDS) return [];
  const progress = elapsedSinceCollect / SPARKLE_DURATION_SECONDS;
  const radius = SPARKLE_MAX_RADIUS * scale * progress;
  const opacity = 1 - progress;
  return particleList(
    SPARKLE_COUNT,
    (i) => {
      const angle = (i / SPARKLE_COUNT) * Math.PI * 2;
      return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
    },
    () => opacity,
  );
}

/** The puff family's payload. `pixel` swaps the soft dot ring for small
 *  integer-aligned pixel squares (the checkpoint's activation burst). */
export interface PuffState {
  x: number;
  y: number;
  scale: number;
  pixel: boolean;
}

export function startPuffEffect(
  id: string,
  x: number,
  y: number,
  scale = 1,
  pixel = false,
): TransientEffect<PuffState> {
  return {
    kind: 'puff',
    id,
    duration: SPARKLE_DURATION_SECONDS,
    elapsed: 0,
    state: { x, y, scale, pixel },
    tick: tickPuffEffect,
    draw: drawPuffEffect,
    expired: (effect) => effect.elapsed > effect.duration,
  };
}

/** Advances the puff by `dt`. No phase machine — a puff has exactly one
 *  phase, bursting. */
export function tickPuffEffect(
  effect: TransientEffect<PuffState>,
  dt: number,
): TransientEffect<PuffState> {
  return { ...effect, elapsed: effect.elapsed + dt };
}

/** Screen-px side of one pixel-art burst square (2 native px) and its warm
 *  gold colour. */
const SPARKLE_RADIUS_PX = 3;
const SPARKLE_PIXEL_SIZE = 4;
const SPARKLE_PIXEL_COLOR = '#ffe9a8';

/** The puff family's registered draw — the former Renderer.ts
 *  `drawSparkleBurst`/`drawPuffEffects` body. Screen-space. */
export function drawPuffEffect(effect: TransientEffect<PuffState>, rc: EffectRenderContext): void {
  const ctx = rc.ctx;
  const { x, y, scale, pixel } = effect.state;
  const particles = sparkleParticles(effect.elapsed, scale);
  if (pixel) {
    const half = SPARKLE_PIXEL_SIZE / 2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = SPARKLE_PIXEL_COLOR;
    for (const sparkle of particles) {
      ctx.globalAlpha = sparkle.opacity;
      ctx.fillRect(
        Math.round(x + sparkle.dx - half),
        Math.round(y + sparkle.dy - half),
        SPARKLE_PIXEL_SIZE,
        SPARKLE_PIXEL_SIZE,
      );
    }
    ctx.restore();
    return;
  }
  for (const sparkle of particles) {
    ctx.save();
    ctx.globalAlpha = sparkle.opacity;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + sparkle.dx, y + sparkle.dy, SPARKLE_RADIUS_PX * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
