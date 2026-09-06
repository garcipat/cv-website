import { describe, it, expect, vi } from 'vitest';
import {
  drawBackgroundLayers,
  SKY_SOURCE_RECT,
  CLOUDS_SOURCE_RECT,
  VILLAGE_SOURCE_RECT,
  type BackgroundLayerImages,
} from './BackgroundLayers';

function fakeImage(width: number, height: number): HTMLImageElement {
  return { width, height } as unknown as HTMLImageElement;
}

function fakeImages(): BackgroundLayerImages {
  return {
    layers: fakeImage(160, 141),
    grass: fakeImage(7, 20),
  };
}

function fakeCtx() {
  return {
    imageSmoothingEnabled: true,
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D & { drawImage: ReturnType<typeof vi.fn> };
}

// drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) — argument indices used below.
const ARG = { image: 0, sx: 1, sy: 2, sw: 3, sh: 4, dx: 5, dy: 6, dw: 7, dh: 8 } as const;

function callsForSourceY(calls: unknown[][], image: HTMLImageElement, sy: number) {
  return calls.filter((call) => call[ARG.image] === image && call[ARG.sy] === sy);
}

describe('drawBackgroundLayers', () => {
  it('sky-alwaysDrawnAtOrigin-pinnedToTopRegardlessOfCameraX', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 200, 500);

    const skyCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, SKY_SOURCE_RECT.sy);
    expect(skyCalls.length).toBeGreaterThan(0);
    for (const call of skyCalls) {
      expect(call[ARG.dy]).toBe(0);
    }
  });

  it('village-pinnedAboveCanvasBottom-atFixedOffsetRegardlessOfCanvasHeight', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 400, 0);

    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    expect(villageCalls.length).toBeGreaterThan(0);
    const destY = villageCalls[0][ARG.dy] as number;
    const destHeight = villageCalls[0][ARG.dh] as number;
    expect(destY + destHeight).toBeLessThanOrEqual(400);

    const ctx2 = fakeCtx();
    drawBackgroundLayers(ctx2, images, 320, 250, 0);
    const villageCalls2 = callsForSourceY(ctx2.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const destY2 = villageCalls2[0][ARG.dy] as number;
    const destHeight2 = villageCalls2[0][ARG.dh] as number;
    expect(400 - (destY + destHeight)).toBe(250 - (destY2 + destHeight2));
  });

  it('grass-fillsFromVillageBottomToCanvasBottom-noGapPastEdge', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 300, 0);

    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const villageBottom = (villageCalls[0][ARG.dy] as number) + (villageCalls[0][ARG.dh] as number);

    const grassCalls = ctx.drawImage.mock.calls.filter((call) => call[ARG.image] === images.grass);
    expect(grassCalls.length).toBeGreaterThan(0);
    const topmostGrassY = Math.min(...grassCalls.map((call) => call[ARG.dy] as number));
    const bottommostGrassEdge = Math.max(...grassCalls.map((call) => (call[ARG.dy] as number) + (call[ARG.dh] as number)));
    expect(topmostGrassY).toBeLessThanOrEqual(villageBottom);
    expect(bottommostGrassEdge).toBeGreaterThanOrEqual(300);
  });

  it('cloudsAndHills-fillTheGapBetweenSkyBottomAndVillageTop-atAnyCanvasHeight', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 500, 0);

    const skyCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, SKY_SOURCE_RECT.sy);
    const skyBottom = Math.max(...skyCalls.map((call) => (call[ARG.dy] as number) + (call[ARG.dh] as number)));
    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const villageTop = Math.min(...villageCalls.map((call) => call[ARG.dy] as number));

    const cloudCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, CLOUDS_SOURCE_RECT.sy);
    expect(cloudCalls.length).toBeGreaterThan(0);
    const cloudTop = Math.min(...cloudCalls.map((call) => call[ARG.dy] as number));
    const cloudBottom = Math.max(...cloudCalls.map((call) => (call[ARG.dy] as number) + (call[ARG.dh] as number)));
    expect(cloudTop).toBeLessThanOrEqual(skyBottom);
    expect(cloudBottom).toBeGreaterThanOrEqual(villageTop);
  });

  it('layers-tileHorizontally-coveringTheFullCanvasWidth', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 500, 200, 0);

    for (const sy of [SKY_SOURCE_RECT.sy, CLOUDS_SOURCE_RECT.sy, VILLAGE_SOURCE_RECT.sy]) {
      const calls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, sy);
      const rightmost = Math.max(...calls.map((call) => (call[ARG.dx] as number) + (call[ARG.dw] as number)));
      expect(rightmost).toBeGreaterThanOrEqual(500);
    }
  });

  it('sky-neverShiftsHorizontally-regardlessOfCameraX', () => {
    const ctxA = fakeCtx();
    const ctxB = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctxA, images, 320, 200, 0);
    drawBackgroundLayers(ctxB, images, 320, 200, 999);

    const skyCallsA = callsForSourceY(ctxA.drawImage.mock.calls, images.layers, SKY_SOURCE_RECT.sy);
    const skyCallsB = callsForSourceY(ctxB.drawImage.mock.calls, images.layers, SKY_SOURCE_RECT.sy);
    expect(skyCallsA.map((call) => call[ARG.dx])).toEqual(skyCallsB.map((call) => call[ARG.dx]));
  });

  it('clouds-shiftLessThanGrass-forCameraXGreaterThanZero', () => {
    const ctxAtZero = fakeCtx();
    const ctxAtOffset = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctxAtZero, images, 320, 200, 0);
    drawBackgroundLayers(ctxAtOffset, images, 320, 200, 5);

    const firstCloudX = (calls: unknown[][]) =>
      Math.min(...callsForSourceY(calls, images.layers, CLOUDS_SOURCE_RECT.sy).map((call) => call[ARG.dx] as number));
    const firstGrassX = (calls: unknown[][]) =>
      Math.min(...calls.filter((call) => call[ARG.image] === images.grass).map((call) => call[ARG.dx] as number));

    const cloudShift = Math.abs(firstCloudX(ctxAtOffset.drawImage.mock.calls) - firstCloudX(ctxAtZero.drawImage.mock.calls));
    const grassShift = Math.abs(firstGrassX(ctxAtOffset.drawImage.mock.calls) - firstGrassX(ctxAtZero.drawImage.mock.calls));

    expect(cloudShift).toBeLessThan(grassShift);
  });
});
