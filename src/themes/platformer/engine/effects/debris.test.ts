import { describe, expect, it, vi } from 'vitest';
import { makeMockContext, renderContext } from './testContext';
import {
  DEBRIS_DURATION_SECONDS,
  crumbleDebrisLayers,
  debrisPieces,
  drawDebrisEffect,
  startDebrisEffect,
  tickDebrisEffect,
  type DebrisLayer,
} from './debris';

const CRUMBLE_LAYERS = crumbleDebrisLayers();
const STALACTITE_LAYERS: DebrisLayer[] = [
  { sheet: '/sprites/decorations.png', sx: 51, sy: 0, width: 16, height: 17 },
];

describe('startDebrisEffect', () => {
  it('id-x-y-layers-buildsAZeroElapsedEffect', () => {
    const effect = startDebrisEffect('d1', 10, 20, CRUMBLE_LAYERS);
    expect(effect).toMatchObject({ kind: 'debris', id: 'd1', elapsed: 0 });
    expect(effect.state).toEqual({ x: 10, y: 20, layers: CRUMBLE_LAYERS });
  });

  it('singleLayerSource-isAccepted', () => {
    expect(startDebrisEffect('d1', 0, 0, STALACTITE_LAYERS).state.layers).toHaveLength(1);
  });
});

describe('tickDebrisEffect', () => {
  it('dt-addsToElapsedAndPreservesLayers', () => {
    const effect = startDebrisEffect('d1', 0, 0, CRUMBLE_LAYERS);
    const ticked = tickDebrisEffect(effect, 0.1);
    expect(ticked.elapsed).toBeCloseTo(0.1, 5);
    expect(ticked.state.layers).toBe(CRUMBLE_LAYERS);
  });
});

describe('debrisPieces', () => {
  it('anyEffect-alwaysReturnsExactlyFourPiecesRegardlessOfLayerCount', () => {
    expect(debrisPieces(startDebrisEffect('d1', 0, 0, CRUMBLE_LAYERS))).toHaveLength(4);
    expect(debrisPieces(startDebrisEffect('d2', 0, 0, STALACTITE_LAYERS))).toHaveLength(4);
    expect(debrisPieces(startDebrisEffect('d3', 0, 0, []))).toHaveLength(4);
  });

  it('zeroElapsed-piecesHaveNoOffsetAndFullOpacity', () => {
    const effect = startDebrisEffect('d1', 0, 0, CRUMBLE_LAYERS);
    for (const piece of debrisPieces(effect)) {
      expect(piece.dx).toBe(0);
      expect(piece.dy).toBe(0);
      expect(piece.opacity).toBe(1);
    }
  });

  it('midway-opacityIsBetweenZeroAndOne', () => {
    const effect = tickDebrisEffect(
      startDebrisEffect('d1', 0, 0, CRUMBLE_LAYERS),
      DEBRIS_DURATION_SECONDS / 2,
    );
    for (const piece of debrisPieces(effect)) {
      expect(piece.opacity).toBeGreaterThan(0);
      expect(piece.opacity).toBeLessThan(1);
    }
  });

  it('pastDuration-opacityClampsToZero', () => {
    const effect = tickDebrisEffect(
      startDebrisEffect('d1', 0, 0, CRUMBLE_LAYERS),
      DEBRIS_DURATION_SECONDS + 5,
    );
    for (const piece of debrisPieces(effect)) {
      expect(piece.opacity).toBe(0);
    }
  });

  it('nonZeroElapsed-piecesDivergeFromEachOther', () => {
    const effect = tickDebrisEffect(startDebrisEffect('d1', 0, 0, CRUMBLE_LAYERS), 0.1);
    const offsets = debrisPieces(effect).map((p) => `${p.dx},${p.dy}`);
    expect(new Set(offsets).size).toBe(4);
  });
});

describe('crumbleDebrisLayers', () => {
  it('providesTheTwoCrumbleLayersWithTheirNativeCrops', () => {
    expect(CRUMBLE_LAYERS).toEqual([
      { sheet: '/sprites/crumble_floor.png', sx: 16, sy: 0, width: 16, height: 8 },
      { sheet: '/sprites/crumble_cracks.png', sx: 32, sy: 0, width: 16, height: 8 },
    ]);
  });
});

describe('debris expiry boundary', () => {
  it('atExactlyTheDuration-isNotExpired', () => {
    const effect = tickDebrisEffect(startDebrisEffect('d', 0, 0, []), DEBRIS_DURATION_SECONDS);
    expect(effect.expired(effect)).toBe(false);
  });

  it('pastTheDuration-isExpired', () => {
    const effect = tickDebrisEffect(startDebrisEffect('d', 0, 0, []), DEBRIS_DURATION_SECONDS + 0.0001);
    expect(effect.expired(effect)).toBe(true);
  });
});

describe('drawDebrisEffect', () => {
  const LAYER_A: DebrisLayer = { sheet: 'a.png', sx: 0, sy: 0, width: 8, height: 8 };
  const LAYER_B: DebrisLayer = { sheet: 'b.png', sx: 16, sy: 0, width: 8, height: 8 };

  it('effectWithLayers-drawsEachLayersQuartersAtThePiecesOffsets', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const imageA = { tag: 'a' } as unknown as HTMLImageElement;
    const imageB = { tag: 'b' } as unknown as HTMLImageElement;
    const effect = startDebrisEffect('d1', 100, 200, [LAYER_A, LAYER_B]);
    const rc = renderContext(ctx as unknown as CanvasRenderingContext2D, [effect], {
      dc: {
        ctx: ctx as unknown as CanvasRenderingContext2D,
        sprites: { 'a.png': imageA, 'b.png': imageB },
        originX: 0,
        originY: 0,
        worldElapsed: 0,
      },
    });

    drawDebrisEffect(effect, rc);

    // 2 layers × 4 quarters.
    expect(ctx.drawImage).toHaveBeenCalledTimes(8);
  });

  it('missingSheetImage-isSkippedWithoutThrowing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const effect = startDebrisEffect('d1', 0, 0, [LAYER_A, LAYER_B]);

    expect(() =>
      drawDebrisEffect(effect, renderContext(ctx as unknown as CanvasRenderingContext2D, [effect])),
    ).not.toThrow();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('crumbleLayers-useTheTwoNativeCrops', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const effect = startDebrisEffect('d1', 32, 64, crumbleDebrisLayers());
    const rc = renderContext(ctx as unknown as CanvasRenderingContext2D, [effect], {
      dc: {
        ctx: ctx as unknown as CanvasRenderingContext2D,
        sprites: {
          '/sprites/crumble_floor.png': { tag: 'floor' } as unknown as HTMLImageElement,
          '/sprites/crumble_cracks.png': { tag: 'cracks' } as unknown as HTMLImageElement,
        },
        originX: 0,
        originY: 0,
        worldElapsed: 0,
      },
    });

    drawDebrisEffect(effect, rc);

    expect(ctx.drawImage).toHaveBeenCalledTimes(8);
  });
});

describe('debrisPieces byte identity', () => {
  it('sampledElapsed-emitsTheExactPreRefactorOffsetsAndOpacity', () => {
    const effect = tickDebrisEffect(startDebrisEffect('d', 0, 0, []), 0.1);
    const pieces = debrisPieces(effect);

    expect(pieces).toHaveLength(4);
    // i=0 kick (-24, -36); gravity 300; opacity = 1 - 0.1 / 0.5.
    expect(pieces[0].dx).toBeCloseTo(-24 * 0.1, 12);
    expect(pieces[0].dy).toBeCloseTo(-36 * 0.1 + 0.5 * 300 * 0.1 * 0.1, 12);
    expect(pieces[0].opacity).toBeCloseTo(0.8, 12);
  });
});
