/**
 * The heal-aura family (R-004 US1/US5): a golden glow, light rays, and
 * sparkles anchored live to the moving player. It stores NO position of its
 * own — the draw re-derives its anchor from `EffectRenderContext.playerAnchor`
 * every frame.
 */
import type { EffectRenderContext, TransientEffect } from './transientEffect';

/** One cycle of a heal aura's rise-and-fade takes this long. */
export const HEAL_AURA_DURATION_SECONDS = 0.5;

/** The aura's payload is empty: it is anchored to the live player each frame. */
export type HealAuraState = Record<string, never>;

export function startHealAuraEffect(id: string): TransientEffect<HealAuraState> {
  return {
    kind: 'healAura',
    id,
    duration: HEAL_AURA_DURATION_SECONDS,
    elapsed: 0,
    state: {},
    tick: tickHealAuraEffect,
    draw: drawHealAuraEffect,
    expired: (effect) => effect.elapsed > effect.duration,
  };
}

/** Advances the aura by `dt`. No phase machine. */
export function tickHealAuraEffect(
  effect: TransientEffect<HealAuraState>,
  dt: number,
): TransientEffect<HealAuraState> {
  return { ...effect, elapsed: effect.elapsed + dt };
}

/** Shared fade curve for every part of the aura. */
export function healAuraOpacity(elapsed: number): number {
  if (elapsed < 0 || elapsed > HEAL_AURA_DURATION_SECONDS) return 0;
  return 1 - elapsed / HEAL_AURA_DURATION_SECONDS;
}

const HEAL_AURA_RAY_COUNT = 5;

export interface HealAuraRay {
  dx: number;
  height: number;
}

/** The aura's light rays for the given elapsed time, spread across `width`. */
export function healAuraRays(elapsed: number, width: number): HealAuraRay[] {
  if (elapsed < 0 || elapsed > HEAL_AURA_DURATION_SECONDS) return [];
  const progress = elapsed / HEAL_AURA_DURATION_SECONDS;
  const height = width * (0.25 + 0.75 * progress);
  const spacing = width / (HEAL_AURA_RAY_COUNT + 1);
  return Array.from({ length: HEAL_AURA_RAY_COUNT }, (_, i) => ({
    dx: spacing * (i + 1) - width / 2,
    height,
  }));
}

const HEAL_AURA_SPARKLE_OFFSETS = [-0.3, -0.1, 0.15, 0.35];

export interface HealAuraSparkle {
  dx: number;
  dy: number;
}

/** The aura's sparkle motes, drifting upward from the anchor. */
export function healAuraSparkles(elapsed: number, width: number): HealAuraSparkle[] {
  if (elapsed < 0 || elapsed > HEAL_AURA_DURATION_SECONDS) return [];
  const progress = elapsed / HEAL_AURA_DURATION_SECONDS;
  const rise = width * 0.6 * progress;
  return HEAL_AURA_SPARKLE_OFFSETS.map((frac) => ({ dx: frac * width, dy: -rise }));
}

/** The heal-aura family's registered draw — the former Renderer.ts
 *  `drawHealAuraEffects` body, re-anchored from the live player each frame. */
export function drawHealAuraEffect(
  effect: TransientEffect<HealAuraState>,
  rc: EffectRenderContext,
): void {
  const ctx = rc.ctx;
  const anchorX = rc.playerAnchor.centerX;
  const anchorY = rc.playerAnchor.centerY;
  const width = rc.playerAnchor.width;

  const opacity = healAuraOpacity(effect.elapsed);
  if (opacity <= 0) return;

  const glowRadius = width * 0.9;
  ctx.save();
  ctx.globalAlpha = opacity;
  const glow = ctx.createRadialGradient(anchorX, anchorY, 0, anchorX, anchorY, glowRadius);
  glow.addColorStop(0, 'rgba(255,224,120,0.9)');
  glow.addColorStop(0.5, 'rgba(255,200,60,0.4)');
  glow.addColorStop(1, 'rgba(255,200,60,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(anchorX, anchorY, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  for (const ray of healAuraRays(effect.elapsed, width)) {
    ctx.save();
    ctx.globalAlpha = opacity;
    const rayGradient = ctx.createLinearGradient(
      anchorX + ray.dx,
      anchorY,
      anchorX + ray.dx,
      anchorY - ray.height,
    );
    rayGradient.addColorStop(0, 'rgba(255,230,140,0.95)');
    rayGradient.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = rayGradient;
    ctx.fillRect(anchorX + ray.dx - 1, anchorY - ray.height, 2, ray.height);
    ctx.restore();
  }

  for (const sparkle of healAuraSparkles(effect.elapsed, width)) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#fff8d6';
    ctx.beginPath();
    ctx.arc(anchorX + sparkle.dx, anchorY + sparkle.dy, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
