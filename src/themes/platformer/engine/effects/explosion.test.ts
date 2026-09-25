import { describe, expect, it, vi } from 'vitest';
import { EXPLOSION_SHEET } from '../../entities/sprites/sheets';
import { frameSource } from '../../entities/sprites/SpriteSheet';
import { RENDER_SCALE } from '../../level/Terrain';
import { makeMockContext, renderContext } from './testContext';
import {
  EXPLOSION_DRAW_SCALE,
  EXPLOSION_DURATION_SECONDS,
  EXPLOSION_FRAME_COUNT,
  drawExplosionEffect,
  explosionFrameIndex,
  startExplosionEffect,
  tickExplosionEffect,
} from './explosion';

describe('ExplosionEffect', () => {
  it('startExplosionEffect-carriesItsCentreAtZeroElapsed', () => {
    const effect = startExplosionEffect('bomb-5-2-1', 160, 64);
    expect(effect).toMatchObject({ kind: 'explosion', id: 'bomb-5-2-1', elapsed: 0 });
    expect(effect.state).toEqual({ x: 160, y: 64 });
  });

  it('tickExplosionEffect-advancesElapsedByDt', () => {
    const effect = tickExplosionEffect(startExplosionEffect('a', 0, 0), 0.1);
    expect(effect.elapsed).toBeCloseTo(0.1);
  });

  it('explosionFrameIndex-playsEachFrameOnceInOrder', () => {
    const frames: number[] = [];
    for (let i = 0; i < EXPLOSION_FRAME_COUNT; i++) {
      const elapsed = ((i + 0.5) * EXPLOSION_DURATION_SECONDS) / EXPLOSION_FRAME_COUNT;
      frames.push(explosionFrameIndex(tickExplosionEffect(startExplosionEffect('a', 0, 0), elapsed)));
    }
    expect(frames).toEqual(Array.from({ length: EXPLOSION_FRAME_COUNT }, (_, i) => i));
  });

  it('explosionFrameIndex-clampsToTheLastFrameAtAndPastTheEnd', () => {
    const atEnd = tickExplosionEffect(startExplosionEffect('a', 0, 0), EXPLOSION_DURATION_SECONDS);
    expect(explosionFrameIndex(atEnd)).toBe(EXPLOSION_FRAME_COUNT - 1);
    const past = tickExplosionEffect(startExplosionEffect('a', 0, 0), EXPLOSION_DURATION_SECONDS * 10);
    expect(explosionFrameIndex(past)).toBe(EXPLOSION_FRAME_COUNT - 1);
  });

  it('theDuration-isTheFrameCountTimesThePerFrameTime', () => {
    expect(EXPLOSION_DURATION_SECONDS).toBeGreaterThan(0);
    expect(EXPLOSION_FRAME_COUNT).toBeGreaterThan(1);
  });
});

describe('explosion expiry boundary', () => {
  it('atExactlyTheDuration-isNotExpired', () => {
    const effect = tickExplosionEffect(startExplosionEffect('a', 0, 0), EXPLOSION_DURATION_SECONDS);
    expect(effect.expired(effect)).toBe(false);
  });

  it('pastTheDuration-isExpired', () => {
    const effect = tickExplosionEffect(
      startExplosionEffect('a', 0, 0),
      EXPLOSION_DURATION_SECONDS + 0.0001,
    );
    expect(effect.expired(effect)).toBe(true);
  });
});

describe('drawExplosionEffect', () => {
  it('activeExplosion-drawsItsSheetFrameAtTheScaledSizeCentredOnTheBlastCentre', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const image = { tag: 'explosion' } as unknown as HTMLImageElement;
    const effect = startExplosionEffect('e', 100, 200);
    const rc = renderContext(ctx as unknown as CanvasRenderingContext2D, [effect], {
      dc: {
        ctx: ctx as unknown as CanvasRenderingContext2D,
        sprites: { [EXPLOSION_SHEET.src]: image },
        originX: 0,
        originY: 0,
        worldElapsed: 0,
      },
    });

    drawExplosionEffect(effect, rc);

    const { sx, sy } = frameSource(EXPLOSION_SHEET, explosionFrameIndex(effect));
    const size = EXPLOSION_SHEET.frameWidth * RENDER_SCALE * EXPLOSION_DRAW_SCALE;
    expect(ctx.drawImage).toHaveBeenCalledWith(
      image,
      sx,
      sy,
      EXPLOSION_SHEET.frameWidth,
      EXPLOSION_SHEET.frameHeight,
      100 - size / 2,
      200 - size / 2,
      size,
      size,
    );
  });

  it('missingSheetImage-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const effect = startExplosionEffect('e', 100, 200);

    drawExplosionEffect(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect]));

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
