import { describe, it, expect, vi } from 'vitest';
import {
  drawBackgroundLayers,
  SKY_SOURCE_RECT,
  CLOUDS_SOURCE_RECT,
  VILLAGE_SOURCE_RECT,
  RIVER_FRAME_DURATION_SECONDS,
  RIVER_DEST_OFFSET,
  BACKGROUND_RENDER_SCALE,
  type BackgroundLayerImages,
} from './BackgroundLayers';

function fakeImage(width: number, height: number): HTMLImageElement {
  return { width, height } as unknown as HTMLImageElement;
}

function fakeImages(): BackgroundLayerImages {
  return {
    layers: fakeImage(160, 141),
    grass: fakeImage(7, 20),
    river: fakeImage(160, 60),
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

    drawBackgroundLayers(ctx, images, 320, 200, 500, 0);

    const skyCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, SKY_SOURCE_RECT.sy);
    expect(skyCalls.length).toBeGreaterThan(0);
    for (const call of skyCalls) {
      expect(call[ARG.dy]).toBe(0);
    }
  });

  it('village-pinnedAboveCanvasBottom-atFixedOffsetRegardlessOfCanvasHeight', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 400, 0, 0);

    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    expect(villageCalls.length).toBeGreaterThan(0);
    const destY = villageCalls[0][ARG.dy] as number;
    const destHeight = villageCalls[0][ARG.dh] as number;
    expect(destY + destHeight).toBeLessThanOrEqual(400);

    const ctx2 = fakeCtx();
    drawBackgroundLayers(ctx2, images, 320, 250, 0, 0);
    const villageCalls2 = callsForSourceY(ctx2.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const destY2 = villageCalls2[0][ARG.dy] as number;
    const destHeight2 = villageCalls2[0][ARG.dh] as number;
    expect(400 - (destY + destHeight)).toBe(250 - (destY2 + destHeight2));
  });

  it('grass-fillsFromVillageBottomToCanvasBottom-noGapPastEdge', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 300, 0, 0);

    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const villageBottom = (villageCalls[0][ARG.dy] as number) + (villageCalls[0][ARG.dh] as number);

    const grassCalls = ctx.drawImage.mock.calls.filter((call) => call[ARG.image] === images.grass);
    expect(grassCalls.length).toBeGreaterThan(0);
    const topmostGrassY = Math.min(...grassCalls.map((call) => call[ARG.dy] as number));
    const bottommostGrassEdge = Math.max(...grassCalls.map((call) => (call[ARG.dy] as number) + (call[ARG.dh] as number)));
    expect(topmostGrassY).toBeLessThanOrEqual(villageBottom);
    expect(bottommostGrassEdge).toBeGreaterThanOrEqual(300);
  });

  it('grass-drawnAtBackgroundRenderScale-sourceStaysNativeButDestinationIsScaled', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 300, 0, 0);

    const grassCalls = ctx.drawImage.mock.calls.filter((call) => call[ARG.image] === images.grass);
    expect(grassCalls.length).toBeGreaterThan(0);
    for (const call of grassCalls) {
      // Source rect (sw/sh) stays at the grass image's own native size...
      expect(call[ARG.sw]).toBe(images.grass.width);
      expect(call[ARG.sh]).toBe(images.grass.height);
      // ...while the destination rect (dw/dh) is scaled up by BACKGROUND_RENDER_SCALE.
      expect(call[ARG.dw]).toBe(images.grass.width * BACKGROUND_RENDER_SCALE);
      expect(call[ARG.dh]).toBe(images.grass.height * BACKGROUND_RENDER_SCALE);
    }
  });

  it('grass-tilesStepByTheScaledSize-noOverlapAndNoGapBetweenAdjacentTiles', () => {
    // Regression guard for the fill-loop step size: if drawTiledArea/
    // drawTiledRow ever stepped by the grass image's NATIVE height/width
    // instead of the SCALED one, adjacent tiles would overlap (drawn too close
    // together) rather than tiling edge-to-edge.
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 300, 0, 0);

    const grassCalls = ctx.drawImage.mock.calls.filter((call) => call[ARG.image] === images.grass);
    const rowYs = [...new Set(grassCalls.map((call) => call[ARG.dy] as number))].sort((a, b) => a - b);
    expect(rowYs.length).toBeGreaterThan(1);
    for (let i = 1; i < rowYs.length; i++) {
      expect(rowYs[i] - rowYs[i - 1]).toBe(images.grass.height * BACKGROUND_RENDER_SCALE);
    }

    const firstRowCalls = grassCalls.filter((call) => call[ARG.dy] === rowYs[0]);
    const colXs = [...new Set(firstRowCalls.map((call) => call[ARG.dx] as number))].sort((a, b) => a - b);
    expect(colXs.length).toBeGreaterThan(1);
    for (let i = 1; i < colXs.length; i++) {
      expect(colXs[i] - colXs[i - 1]).toBe(images.grass.width * BACKGROUND_RENDER_SCALE);
    }
  });

  it('cloudsAndHills-drawnExactlyOnce-withRemainingGapFilledByFlatSkyColor', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 500, 0, 0);

    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const villageTop = Math.min(...villageCalls.map((call) => call[ARG.dy] as number));

    // Clouds/hills is drawn exactly once (no vertical tiling): every clouds
    // call shares the same dy, positioned directly under the (scaled) sky.
    const cloudCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, CLOUDS_SOURCE_RECT.sy);
    expect(cloudCalls.length).toBeGreaterThan(0);
    const cloudDys = [...new Set(cloudCalls.map((call) => call[ARG.dy] as number))];
    expect(cloudDys).toEqual([SKY_SOURCE_RECT.height * BACKGROUND_RENDER_SCALE]);
    const cloudTop = cloudDys[0];
    const cloudBottom = cloudTop + CLOUDS_SOURCE_RECT.height * BACKGROUND_RENDER_SCALE;

    // The remaining gap between the clouds' bottom edge and the village's top
    // edge is filled with a flat rect in the sampled sky color, not a second
    // copy of the clouds tile.
    const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(fillCalls.length).toBe(1);
    expect(fillCalls[0]).toEqual([0, cloudBottom, 320, villageTop - cloudBottom]);
    expect(ctx.fillStyle).toBe('rgb(66, 154, 215)');
  });

  it('layers-tileHorizontally-coveringTheFullCanvasWidth', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 500, 200, 0, 0);

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

    drawBackgroundLayers(ctxA, images, 320, 200, 0, 0);
    drawBackgroundLayers(ctxB, images, 320, 200, 999, 0);

    const skyCallsA = callsForSourceY(ctxA.drawImage.mock.calls, images.layers, SKY_SOURCE_RECT.sy);
    const skyCallsB = callsForSourceY(ctxB.drawImage.mock.calls, images.layers, SKY_SOURCE_RECT.sy);
    expect(skyCallsA.map((call) => call[ARG.dx])).toEqual(skyCallsB.map((call) => call[ARG.dx]));
  });

  it('clouds-shiftLessThanGrass-forCameraXGreaterThanZero', () => {
    const ctxAtZero = fakeCtx();
    const ctxAtOffset = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctxAtZero, images, 320, 200, 0, 0);
    drawBackgroundLayers(ctxAtOffset, images, 320, 200, 5, 0);

    const firstCloudX = (calls: unknown[][]) =>
      Math.min(...callsForSourceY(calls, images.layers, CLOUDS_SOURCE_RECT.sy).map((call) => call[ARG.dx] as number));
    const firstGrassX = (calls: unknown[][]) =>
      Math.min(...calls.filter((call) => call[ARG.image] === images.grass).map((call) => call[ARG.dx] as number));

    const cloudShift = Math.abs(firstCloudX(ctxAtOffset.drawImage.mock.calls) - firstCloudX(ctxAtZero.drawImage.mock.calls));
    const grassShift = Math.abs(firstGrassX(ctxAtOffset.drawImage.mock.calls) - firstGrassX(ctxAtZero.drawImage.mock.calls));

    expect(cloudShift).toBeLessThan(grassShift);
  });

  it('river-alternatesFrame-basedOnWorldElapsedSeconds', () => {
    const ctx0 = fakeCtx();
    const ctx1 = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx0, images, 320, 200, 0, 0);
    drawBackgroundLayers(ctx1, images, 320, 200, 0, RIVER_FRAME_DURATION_SECONDS);

    const riverCalls0 = ctx0.drawImage.mock.calls.filter((call) => call[ARG.image] === images.river);
    const riverCalls1 = ctx1.drawImage.mock.calls.filter((call) => call[ARG.image] === images.river);
    expect(riverCalls0.length).toBeGreaterThan(0);
    expect(riverCalls1[0][ARG.sy]).not.toBe(riverCalls0[0][ARG.sy]);
  });

  it('river-drawnAtVillageDyPlusOffsetAndSameSpeedAsVillage', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 400, 250, 0);

    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const riverCalls = ctx.drawImage.mock.calls.filter((call) => call[ARG.image] === images.river);
    // The river overlay's own water-line sits 11px (native) lower within its
    // frame than the village band's baked-in river line sits within its own
    // top — see RIVER_DEST_OFFSET's doc comment in BackgroundLayers.ts — so
    // the overlay is intentionally drawn RIVER_DEST_OFFSET (scaled) below the
    // village row's dy, not at the exact same dy.
    expect(riverCalls[0][ARG.dy]).toBe(
      (villageCalls[0][ARG.dy] as number) + RIVER_DEST_OFFSET * BACKGROUND_RENDER_SCALE,
    );
    // Same x position/parallax speed as the village row, unaffected by the
    // y offset above.
    expect(riverCalls[0][ARG.dx]).toBe(villageCalls[0][ARG.dx]);
  });
});
