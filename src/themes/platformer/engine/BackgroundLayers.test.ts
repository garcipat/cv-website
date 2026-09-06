import { describe, it, expect, vi } from 'vitest';
import {
  drawBackgroundLayers,
  SKY_SOURCE_RECT,
  CLOUDS_SOURCE_RECT,
  VILLAGE_SOURCE_RECT,
  RIVER_FRAME_DURATION_SECONDS,
  RIVER_DEST_OFFSET,
  BACKGROUND_RENDER_SCALE,
  SKY_TOP_MARGIN,
  CLOUDS_VILLAGE_GAP,
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
  it('sky-alwaysDrawnBelowTopMargin-pinnedRegardlessOfCameraX', () => {
    const ctx = fakeCtx();
    const images = fakeImages();
    const skyTopMarginHeight = SKY_TOP_MARGIN * BACKGROUND_RENDER_SCALE;

    drawBackgroundLayers(ctx, images, 320, 200, 500, 0);

    // The sky image itself is drawn just below the flat dark-blue top
    // margin, not at dy=0 — the margin fill (checked below) occupies
    // [0, skyTopMarginHeight).
    const skyCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, SKY_SOURCE_RECT.sy);
    expect(skyCalls.length).toBeGreaterThan(0);
    for (const call of skyCalls) {
      expect(call[ARG.dy]).toBe(skyTopMarginHeight);
    }

    // A flat fill covers the top margin above the sky image — verified by
    // position/size here; the color itself is verified via the
    // SKY_DARK_COLOR constant's usage in BackgroundLayers.ts (same pattern
    // as the sky-fill/grass-fill tests below).
    const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    const marginFillCall = fillCalls.find((call) => call[1] === 0 && call[3] === skyTopMarginHeight);
    expect(marginFillCall).toEqual([0, 0, 320, skyTopMarginHeight]);
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

  it('grass-drawnExactlyOnce-withRemainingGapFilledByFlatGrassColor', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 300, 0, 0);

    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const villageBottom = (villageCalls[0][ARG.dy] as number) + (villageCalls[0][ARG.dh] as number);

    // Grass is drawn exactly once (no vertical tiling): every grass call
    // shares the same dy, positioned at the village layer's bottom edge.
    const grassCalls = ctx.drawImage.mock.calls.filter((call) => call[ARG.image] === images.grass);
    expect(grassCalls.length).toBeGreaterThan(0);
    const grassDys = [...new Set(grassCalls.map((call) => call[ARG.dy] as number))];
    expect(grassDys).toEqual([villageBottom]);
    const grassBottom = villageBottom + images.grass.height * BACKGROUND_RENDER_SCALE;

    // The remaining gap between the grass's bottom edge and the canvas
    // bottom is filled with a flat rect in the sampled grass color, not a
    // second (or third...) copy of the grass tile.
    const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    const grassFillCall = fillCalls.find((call) => call[1] === grassBottom);
    expect(grassFillCall).toEqual([0, grassBottom, 320, 300 - grassBottom]);
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

  it('cloudsAndHills-drawnExactlyOnce-positionedAboveVillageWithSkyGapFilledByFlatSkyColor', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 500, 0, 0);

    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const villageTop = Math.min(...villageCalls.map((call) => call[ARG.dy] as number));
    const skyBottom = SKY_TOP_MARGIN * BACKGROUND_RENDER_SCALE + SKY_SOURCE_RECT.height * BACKGROUND_RENDER_SCALE;

    // Clouds/hills is drawn exactly once (no vertical tiling): every clouds
    // call shares the same dy, positioned above the village layer with the
    // extra CLOUDS_VILLAGE_GAP so it reads as floating above the treeline.
    const cloudCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, CLOUDS_SOURCE_RECT.sy);
    expect(cloudCalls.length).toBeGreaterThan(0);
    const cloudDys = [...new Set(cloudCalls.map((call) => call[ARG.dy] as number))];
    const cloudsDestHeight = CLOUDS_SOURCE_RECT.height * BACKGROUND_RENDER_SCALE;
    expect(cloudDys).toEqual([villageTop - cloudsDestHeight - CLOUDS_VILLAGE_GAP * BACKGROUND_RENDER_SCALE]);
    const cloudTop = cloudDys[0];

    // The remaining gap between the sky's bottom edge and the clouds' top
    // edge is filled with a flat rect in the sampled sky color, not a second
    // copy of the clouds tile.
    // Note: ctx.fillStyle is a single mutable property (not per-call), and
    // the grass fill (drawn later) overwrites it — so the color itself is
    // verified via the SKY_FILL_COLOR constant's usage in BackgroundLayers.ts
    // rather than asserted here against the final fillStyle value.
    const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    const skyFillCall = fillCalls.find((call) => call[1] === skyBottom);
    expect(skyFillCall).toEqual([0, skyBottom, 320, cloudTop - skyBottom]);
  });

  it('cloudsAndVillage-drawnExactlyOnce-withRemainingGapFilledByFlatCloudsVillageColor', () => {
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 500, 0, 0);

    const villageCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, VILLAGE_SOURCE_RECT.sy);
    const villageTop = Math.min(...villageCalls.map((call) => call[ARG.dy] as number));

    const cloudCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, CLOUDS_SOURCE_RECT.sy);
    const cloudDys = [...new Set(cloudCalls.map((call) => call[ARG.dy] as number))];
    const cloudsDestHeight = CLOUDS_SOURCE_RECT.height * BACKGROUND_RENDER_SCALE;
    const cloudsBottom = cloudDys[0] + cloudsDestHeight;

    // The remaining gap between the clouds' bottom edge and the village's
    // top edge is filled with a flat rect in the sampled clouds/hills color,
    // not a second copy of the clouds tile.
    // Note: ctx.fillStyle is a single mutable property (not per-call), and
    // later fills overwrite it — so the color itself is verified via the
    // CLOUDS_VILLAGE_GAP_COLOR constant's usage in BackgroundLayers.ts
    // rather than asserted here against the final fillStyle value.
    const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    const cloudsVillageFillCall = fillCalls.find((call) => call[1] === cloudsBottom);
    expect(cloudsVillageFillCall).toEqual([0, cloudsBottom, 320, villageTop - cloudsBottom]);
  });

  it('tiledRow-roundsOffsetToWholePixel-avoidingSeamsWhenCameraTimesParallaxIsFractional', () => {
    // Regression guard for the horizontal tile seam: with cameraX = 7 and
    // CLOUDS_PARALLAX_FACTOR = 0.2, cameraX * parallaxFactor = 1.4, a
    // fractional value. Every recorded drawImage dx for the clouds layer must
    // still be a whole number, or adjacent tiles will show a 1px seam once
    // imageSmoothingEnabled is false.
    const ctx = fakeCtx();
    const images = fakeImages();

    drawBackgroundLayers(ctx, images, 320, 500, 7, 0);

    const cloudCalls = callsForSourceY(ctx.drawImage.mock.calls, images.layers, CLOUDS_SOURCE_RECT.sy);
    expect(cloudCalls.length).toBeGreaterThan(0);
    for (const call of cloudCalls) {
      expect(Number.isInteger(call[ARG.dx] as number)).toBe(true);
    }
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
