/**
 * The hit-splatter family (R-004 US1): a deterministic, non-randomized burst
 * of colored droplets played when a hit lands on the player or an enemy.
 */
import type { EnemyTypeKey } from '../../entities/enemies';
import { particleList, type Particle } from './particles';
import type { EffectRenderContext, TransientEffect } from './transientEffect';

/** Total seconds a hit splatter plays before it is fully faded and removed. */
export const HIT_SPLATTER_DURATION_SECONDS = 0.6;
/** Opaque until this fraction of the duration has elapsed, then fades to 0. */
const HIT_SPLATTER_FADE_START_FRACTION = 0.7;
/** Downward pixel-acceleration term pulling every droplet back down. */
const HIT_SPLATTER_GRAVITY = 60;
/**
 * Stride used to shuffle which droplet index gets which vertical-spread slot.
 * MUST be coprime with every `dropletCount` this effect uses (7 and 13).
 */
const HIT_SPLATTER_SHUFFLE_STRIDE = 3;

const PLAYER_HIT_SPLATTER_COLOR = '#a30f1f';
const PLAYER_HIT_SPLATTER_DROPLET_COUNT = 7;
const PLAYER_HIT_SPLATTER_ANCHOR_OFFSET_X = 11;
const PLAYER_HIT_SPLATTER_ANCHOR_OFFSET_Y = 2;
const PLAYER_HIT_SPLATTER_DIR_BIAS_X = 6;
const PLAYER_HIT_SPLATTER_SPREAD_X = 17;
const PLAYER_HIT_SPLATTER_SPREAD_Y = 12;

const SPEAR_BLOOD_SPLATTER_DROPLET_COUNT = 11;
const SPEAR_BLOOD_SPLATTER_DIR_BIAS_Y = -40;
const SPEAR_BLOOD_SPLATTER_SPREAD_X = 40;
const SPEAR_BLOOD_SPLATTER_SPREAD_Y = 30;

const ENEMY_HIT_SPLATTER_DROPLET_COUNT = 13;
const ENEMY_HIT_SPLATTER_DIR_BIAS_Y = -45;
const ENEMY_HIT_SPLATTER_SPREAD_X = 64;
const ENEMY_HIT_SPLATTER_SPREAD_Y = 44;

/** Each enemy type splatters its own color, matching its body color. */
const ENEMY_HIT_SPLATTER_COLOR: Record<EnemyTypeKey, string> = {
  slimeGreen: '#3ddc55',
  slimePurple: '#8e3dd9',
  bee: '#f2c14e',
};

/** The splatter family's payload. */
export interface HitSplatterState {
  x: number;
  y: number;
  color: string;
  dropletCount: number;
  dirBiasX: number;
  dirBiasY: number;
  spreadX: number;
  spreadY: number;
}

/** Starts a red hit-splatter burst on the character. `contactSide` is -1, 1,
 *  or 0 when no side is known (a pit fall). */
export function startPlayerHitSplatter(
  id: string,
  playerCenterX: number,
  playerCenterY: number,
  contactSide: -1 | 0 | 1,
): TransientEffect<HitSplatterState> {
  return startHitSplatter(id, {
    x: playerCenterX + PLAYER_HIT_SPLATTER_ANCHOR_OFFSET_X * contactSide,
    y: playerCenterY + PLAYER_HIT_SPLATTER_ANCHOR_OFFSET_Y,
    color: PLAYER_HIT_SPLATTER_COLOR,
    dropletCount: PLAYER_HIT_SPLATTER_DROPLET_COUNT,
    dirBiasX: PLAYER_HIT_SPLATTER_DIR_BIAS_X * contactSide,
    dirBiasY: 0,
    spreadX: PLAYER_HIT_SPLATTER_SPREAD_X,
    spreadY: PLAYER_HIT_SPLATTER_SPREAD_Y,
  });
}

/** Starts the blood burst for a spear kill, anchored at the character's feet
 *  and leaning upward/outward. */
export function startSpearBloodSplatter(
  id: string,
  playerCenterX: number,
  feetY: number,
): TransientEffect<HitSplatterState> {
  return startHitSplatter(id, {
    x: playerCenterX,
    y: feetY,
    color: PLAYER_HIT_SPLATTER_COLOR,
    dropletCount: SPEAR_BLOOD_SPLATTER_DROPLET_COUNT,
    dirBiasX: 0,
    dirBiasY: SPEAR_BLOOD_SPLATTER_DIR_BIAS_Y,
    spreadX: SPEAR_BLOOD_SPLATTER_SPREAD_X,
    spreadY: SPEAR_BLOOD_SPLATTER_SPREAD_Y,
  });
}

/** Starts a goo hit-splatter burst on an enemy, colored to match its type. */
export function startEnemyHitSplatter(
  id: string,
  topX: number,
  topY: number,
  enemyType: EnemyTypeKey,
): TransientEffect<HitSplatterState> {
  return startHitSplatter(id, {
    x: topX,
    y: topY,
    color: ENEMY_HIT_SPLATTER_COLOR[enemyType],
    dropletCount: ENEMY_HIT_SPLATTER_DROPLET_COUNT,
    dirBiasX: 0,
    dirBiasY: ENEMY_HIT_SPLATTER_DIR_BIAS_Y,
    spreadX: ENEMY_HIT_SPLATTER_SPREAD_X,
    spreadY: ENEMY_HIT_SPLATTER_SPREAD_Y,
  });
}

function startHitSplatter(id: string, state: HitSplatterState): TransientEffect<HitSplatterState> {
  return {
    kind: 'hitSplatter',
    id,
    duration: HIT_SPLATTER_DURATION_SECONDS,
    elapsed: 0,
    state,
    tick: tickHitSplatterEffect,
    draw: drawHitSplatterEffect,
    expired: (effect) => effect.elapsed > effect.duration,
  };
}

/** Advances a hit splatter by `dt` seconds. No phase machine. */
export function tickHitSplatterEffect(
  effect: TransientEffect<HitSplatterState>,
  dt: number,
): TransientEffect<HitSplatterState> {
  return { ...effect, elapsed: effect.elapsed + dt };
}

export type HitSplatterDroplet = Particle;

/** Current per-droplet offsets/opacity for a hit splatter. Deterministic.
 *  Routes the emission loop through `particles.ts`'s `particleList`; the
 *  spread/shuffle/gravity arithmetic stays here byte-for-byte. */
export function hitSplatterDroplets(
  effect: TransientEffect<HitSplatterState>,
): Particle[] {
  const s = effect.state;
  const progress = Math.min(1, effect.elapsed / HIT_SPLATTER_DURATION_SECONDS);
  const count = s.dropletCount;
  const opacity =
    progress < HIT_SPLATTER_FADE_START_FRACTION
      ? 1
      : Math.max(
          0,
          1 - (progress - HIT_SPLATTER_FADE_START_FRACTION) / (1 - HIT_SPLATTER_FADE_START_FRACTION),
        );
  return particleList(
    count,
    (i) => {
      const spreadFracX = count === 1 ? 0 : i / (count - 1) - 0.5;
      const shuffled = (i * HIT_SPLATTER_SHUFFLE_STRIDE) % count;
      const spreadFracY = count === 1 ? 0 : shuffled / (count - 1) - 0.5;
      // The `+ 0` terms normalize IEEE-754 −0 to +0: at progress 0, a negative base times zero yields −0,
      // but fresh effect droplets should read as a clean +0 for tests using strict equality (e.g. Object.is).
      const dx = (s.dirBiasX + spreadFracX * s.spreadX) * progress + 0;
      const dy =
        (s.dirBiasY + spreadFracY * s.spreadY) * progress +
        HIT_SPLATTER_GRAVITY * progress * progress +
        0;
      return { dx, dy };
    },
    () => opacity,
  );
}

const HIT_SPLATTER_DROPLET_SIZE_PX = 4;

/** The splatter family's registered draw — the former Renderer.ts
 *  `drawHitSplatterEffects` body. Screen-space, fixed per-effect x/y. */
export function drawHitSplatterEffect(
  effect: TransientEffect<HitSplatterState>,
  rc: EffectRenderContext,
): void {
  const ctx = rc.ctx;
  for (const droplet of hitSplatterDroplets(effect)) {
    if (droplet.opacity <= 0) continue;
    ctx.save();
    ctx.globalAlpha = droplet.opacity;
    ctx.fillStyle = effect.state.color;
    ctx.fillRect(
      effect.state.x + droplet.dx - HIT_SPLATTER_DROPLET_SIZE_PX / 2,
      effect.state.y + droplet.dy - HIT_SPLATTER_DROPLET_SIZE_PX / 2,
      HIT_SPLATTER_DROPLET_SIZE_PX,
      HIT_SPLATTER_DROPLET_SIZE_PX,
    );
    ctx.restore();
  }
}
