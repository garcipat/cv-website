/**
 * The debris family (R-004 US1): a shatter burst that splits one or more art
 * layers into four falling quarters. Shared by the crumbling floor's break and
 * the falling stalactite's landing shatter.
 */
import { CRUMBLE_FLOOR_SHEET, CRUMBLE_CRACKS_SHEET } from '../../entities/sprites/sheets';
import { frameSource } from '../../entities/sprites/SpriteSheet';
import { RENDER_SCALE } from '../../level/Terrain';
import { particleList, type Particle } from './particles';
import type { EffectRenderContext, TransientEffect } from './transientEffect';

/** Total seconds the falling pieces take to fully fade. */
export const DEBRIS_DURATION_SECONDS = 0.5;

/** One art layer of a debris effect: a sprite-sheet crop (native, un-scaled
 *  px) drawn as one quarter of the burst. */
export interface DebrisLayer {
  /** Sprite sheet src, resolved through `DrawContext.sprites`. */
  sheet: string;
  sx: number;
  sy: number;
  width: number;
  height: number;
}

/** The debris payload: world-space top-left of the source art plus its layers. */
export interface DebrisState {
  x: number;
  y: number;
  layers: readonly DebrisLayer[];
}

export function startDebrisEffect(
  id: string,
  x: number,
  y: number,
  layers: readonly DebrisLayer[],
): TransientEffect<DebrisState> {
  return {
    kind: 'debris',
    id,
    duration: DEBRIS_DURATION_SECONDS,
    elapsed: 0,
    state: { x, y, layers },
    tick: tickDebrisEffect,
    draw: drawDebrisEffect,
    expired: (effect) => effect.elapsed > effect.duration,
  };
}

export function tickDebrisEffect(
  effect: TransientEffect<DebrisState>,
  dt: number,
): TransientEffect<DebrisState> {
  return { ...effect, elapsed: effect.elapsed + dt };
}

/** One falling piece's current render offset (rendered px, relative to the
 *  effect's own x/y) and opacity. */
export type DebrisPiece = Particle;

/** Simple constant gravity, rendered px/s^2. */
const DEBRIS_GRAVITY_PX_PER_SEC2 = 300;

/** Each piece's initial kick (rendered px/s), in the fixed quarter order
 *  top-left, top-right, bottom-left, bottom-right. */
const DEBRIS_PIECE_KICKS: readonly { vx: number; vy: number }[] = [
  { vx: -24, vy: -36 },
  { vx: 24, vy: -36 },
  { vx: -16, vy: -16 },
  { vx: 16, vy: -16 },
];

/** Every piece's current offset/opacity — always 4 entries, in the fixed
 *  order `DEBRIS_PIECE_KICKS` declares. Routes the emission loop through
 *  `particles.ts`'s `particleList`; the gravity/kick arithmetic stays here
 *  byte-for-byte. */
export function debrisPieces(effect: TransientEffect<DebrisState>): Particle[] {
  const t = effect.elapsed;
  const opacity = Math.max(0, 1 - t / DEBRIS_DURATION_SECONDS);
  return particleList(
    DEBRIS_PIECE_KICKS.length,
    (i) => {
      const { vx, vy } = DEBRIS_PIECE_KICKS[i];
      return { dx: vx * t + 0, dy: vy * t + 0.5 * DEBRIS_GRAVITY_PX_PER_SEC2 * t * t + 0 };
    },
    () => opacity,
  );
}

/** The crumbling floor's two debris layers (the plain ledge middle frame plus
 *  the heavy crack frame). */
export function crumbleDebrisLayers(): DebrisLayer[] {
  const ledgeMid = frameSource(CRUMBLE_FLOOR_SHEET, 1);
  const heavyCrack = frameSource(CRUMBLE_CRACKS_SHEET, 2);
  return [
    {
      sheet: CRUMBLE_FLOOR_SHEET.src,
      sx: ledgeMid.sx,
      sy: ledgeMid.sy,
      width: CRUMBLE_FLOOR_SHEET.frameWidth,
      height: CRUMBLE_CRACKS_SHEET.frameHeight,
    },
    {
      sheet: CRUMBLE_CRACKS_SHEET.src,
      sx: heavyCrack.sx,
      sy: heavyCrack.sy,
      width: CRUMBLE_CRACKS_SHEET.frameWidth,
      height: CRUMBLE_CRACKS_SHEET.frameHeight,
    },
  ];
}

/** The debris family's registered draw — the former Renderer.ts
 *  `drawDebrisEffects` body, per effect. */
export function drawDebrisEffect(
  effect: TransientEffect<DebrisState>,
  rc: EffectRenderContext,
): void {
  const ctx = rc.ctx;
  const dc = rc.dc;
  const pieces = debrisPieces(effect);
  for (const layer of effect.state.layers) {
    const image = dc.sprites[layer.sheet];
    if (!image) continue;
    const halfW = Math.floor(layer.width / 2);
    const halfH = Math.floor(layer.height / 2);
    const quarters: readonly { sx: number; sy: number; width: number; height: number }[] = [
      { sx: layer.sx, sy: layer.sy, width: halfW, height: halfH },
      { sx: layer.sx + halfW, sy: layer.sy, width: layer.width - halfW, height: halfH },
      { sx: layer.sx, sy: layer.sy + halfH, width: halfW, height: layer.height - halfH },
      {
        sx: layer.sx + halfW,
        sy: layer.sy + halfH,
        width: layer.width - halfW,
        height: layer.height - halfH,
      },
    ];
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      if (piece.opacity <= 0) continue;
      const quarter = quarters[i];
      ctx.globalAlpha = piece.opacity;
      ctx.drawImage(
        image,
        quarter.sx,
        quarter.sy,
        quarter.width,
        quarter.height,
        effect.state.x + dc.originX + (quarter.sx - layer.sx) * RENDER_SCALE + piece.dx,
        effect.state.y + dc.originY + (quarter.sy - layer.sy) * RENDER_SCALE + piece.dy,
        quarter.width * RENDER_SCALE,
        quarter.height * RENDER_SCALE,
      );
    }
  }
  ctx.globalAlpha = 1;
}
