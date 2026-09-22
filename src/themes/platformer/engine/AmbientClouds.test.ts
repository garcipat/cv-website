import { describe, it, expect, vi } from 'vitest';
import {
  AMBIENT_CLOUD_SOURCE_RECTS,
  AMBIENT_CLOUD_PARALLAX_FACTOR,
  CLOUD_MIN_SPEED_PX_PER_SEC,
  CLOUD_MAX_SPEED_PX_PER_SEC,
  MIN_CLOUD_COUNT,
  MIN_SHAPE_HEIGHT,
  cloudPopulationFor,
  createCloudField,
  stepCloudField,
  drawAmbientClouds,
} from './AmbientClouds';
import { BACKGROUND_RENDER_SCALE } from './BackgroundLayers';

// drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) — argument indices used below.
const ARG = { image: 0, sx: 1, sy: 2, sw: 3, sh: 4, dx: 5, dy: 6, dw: 7, dh: 8 } as const;

function fakeCtx() {
  return {
    imageSmoothingEnabled: true,
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D & { drawImage: ReturnType<typeof vi.fn> };
}

function fakeImage(): HTMLImageElement {
  return { src: '/sprites/ambient_clouds.png' } as unknown as HTMLImageElement;
}

function shapeOf(sx: number) {
  const shape = AMBIENT_CLOUD_SOURCE_RECTS.find((rect) => rect.sx === sx);
  if (!shape) throw new Error(`no source rect starts at sx=${sx}`);
  return shape;
}

describe('cloudPopulationFor', () => {
  it('cloudPopulationFor-wideningPlayArea-neverDecreasesAndStaysAtLeastTheMinimum', () => {
    const widths = [0, 120, 300, 600, 900, 1200, 1280];
    const counts = widths.map(cloudPopulationFor);

    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
    for (const count of counts) {
      expect(count).toBeGreaterThanOrEqual(MIN_CLOUD_COUNT);
    }
  });
});

describe('createCloudField', () => {
  it('createCloudField-defaultPopulation-buildsOneCloudPerLaneWithADistinctSpeedInRange', () => {
    const width = 1024;
    const field = createCloudField(width, 32, 390);

    expect(field.clouds.length).toBe(cloudPopulationFor(width));

    // Every cloud owns its own lane, so no two sit on the same vertical line.
    const lanes = new Set(field.clouds.map((cloud) => cloud.lane));
    expect(lanes.size).toBe(field.clouds.length);

    for (const cloud of field.clouds) {
      expect(cloud.speed).toBeGreaterThanOrEqual(CLOUD_MIN_SPEED_PX_PER_SEC);
      expect(cloud.speed).toBeLessThanOrEqual(CLOUD_MAX_SPEED_PX_PER_SEC);
    }
  });

  it('createCloudField-defaultPopulation-showsAtLeastThreeDistinctSpeedsAndHeights', () => {
    const field = createCloudField(1024, 32, 390);

    expect(new Set(field.clouds.map((cloud) => cloud.speed)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(field.clouds.map((cloud) => cloud.y)).size).toBeGreaterThanOrEqual(3);
  });

  it('createCloudField-sameSeedAndInputs-yieldsAnEqualField', () => {
    const a = createCloudField(1024, 32, 390, 1234);
    const b = createCloudField(1024, 32, 390, 1234);

    expect(b).toEqual(a);
  });

  it('createCloudField-initialPlacement-keepsEveryCloudBetweenTheLeftEdgeAndThePlayAreaWidth', () => {
    const playAreaWidth = 1024;
    const maxShapeWidth = Math.max(...AMBIENT_CLOUD_SOURCE_RECTS.map((rect) => rect.width));
    const field = createCloudField(playAreaWidth, 32, 390);

    for (const cloud of field.clouds) {
      expect(cloud.x).toBeGreaterThanOrEqual(-maxShapeWidth);
      expect(cloud.x).toBeLessThan(playAreaWidth);
    }
  });

  it('createCloudField-population-givesEveryCloudAUniqueLaneAndMoreThanOneSilhouette', () => {
    const field = createCloudField(1024, 32, 390);

    expect(new Set(field.clouds.map((cloud) => cloud.lane)).size).toBe(field.clouds.length);
    expect(new Set(field.clouds.map((cloud) => cloud.shapeIndex)).size).toBeGreaterThan(1);
  });
});

describe('stepCloudField', () => {
  it('stepCloudField-advancingTime-movesEveryCloudLeftWithoutAnyCameraInput', () => {
    const field = createCloudField(1024, 32, 390);
    const stepped = stepCloudField(field, 1, false);

    stepped.clouds.forEach((cloud, i) => {
      expect(cloud.x).toBeLessThan(field.clouds[i].x);
    });
  });

  it('stepCloudField-cloudFullyPastTheLeftEdge-respawnsFromTheRightWithANewSpeedAndShape', () => {
    const playAreaWidth = 1024;
    const field = createCloudField(playAreaWidth, 32, 390);

    // A huge step carries every cloud fully past the left edge, so all respawn.
    const stepped = stepCloudField(field, 10000, false);

    stepped.clouds.forEach((cloud, i) => {
      const previous = field.clouds[i];
      expect(cloud.shapeIndex).not.toBe(previous.shapeIndex);
      expect(cloud.speed).not.toBe(previous.speed);
      expect(cloud.x).toBeGreaterThanOrEqual(playAreaWidth);
      // The lane (and therefore the vertical line) is preserved.
      expect(cloud.lane).toBe(previous.lane);
    });
  });
});

describe('drawAmbientClouds', () => {
  it('drawAmbientClouds-eachCloud-roundsDestXAndScalesDestWidth', () => {
    const ctx = fakeCtx();
    const image = fakeImage();
    const field = createCloudField(1024, 32, 390);

    drawAmbientClouds(ctx, image, field, 0);

    expect(ctx.drawImage).toHaveBeenCalledTimes(field.clouds.length);
    field.clouds.forEach((cloud, i) => {
      const call = ctx.drawImage.mock.calls[i];
      const shape = shapeOf(AMBIENT_CLOUD_SOURCE_RECTS[cloud.shapeIndex].sx);
      expect(call[ARG.image]).toBe(image);
      expect(call[ARG.dx]).toBe(Math.round(cloud.x));
      expect(Number.isInteger(call[ARG.dx])).toBe(true);
      expect(call[ARG.dw]).toBe(shape.width * BACKGROUND_RENDER_SCALE);
      expect(call[ARG.dh]).toBe(shape.height * BACKGROUND_RENDER_SCALE);
    });
  });

  it('drawAmbientClouds-nonZeroCameraX-shiftsEveryDestXLeftByThePaintedCloudsParallaxFactor', () => {
    const ctx = fakeCtx();
    const cameraX = 500;
    const field = createCloudField(1024, 32, 390);

    drawAmbientClouds(ctx, fakeImage(), field, cameraX);

    expect(ctx.drawImage).toHaveBeenCalledTimes(field.clouds.length);
    field.clouds.forEach((cloud, i) => {
      const call = ctx.drawImage.mock.calls[i];
      expect(call[ARG.dx]).toBe(Math.round(cloud.x - cameraX * AMBIENT_CLOUD_PARALLAX_FACTOR));
    });
  });

  it('drawAmbientClouds-cloudsWiderThanPlayArea-drawsThemAtFullScaledSize', () => {
    const ctx = fakeCtx();
    const image = fakeImage();
    // A play area narrower than every authored cloud, so each draw would be
    // clipped at the canvas edge rather than resized.
    const field = createCloudField(40, 32, 390);

    drawAmbientClouds(ctx, image, field, 0);

    expect(ctx.drawImage).toHaveBeenCalledTimes(field.clouds.length);
    for (const call of ctx.drawImage.mock.calls) {
      const shape = shapeOf(call[ARG.sx] as number);
      expect(call[ARG.dw]).toBe(shape.width * BACKGROUND_RENDER_SCALE);
      expect(call[ARG.dw]).toBeGreaterThan(40);
    }
  });

  it('drawAmbientClouds-nullImageOrEmptyField-drawsNothing', () => {
    const ctx = fakeCtx();
    const field = createCloudField(1024, 32, 390);

    drawAmbientClouds(ctx, null, field, 0);
    expect(ctx.drawImage).not.toHaveBeenCalled();

    // A sky band too short for even the shortest shape yields an empty field.
    const emptyField = createCloudField(1024, 100, 100 + MIN_SHAPE_HEIGHT * BACKGROUND_RENDER_SCALE - 1);
    expect(emptyField.clouds).toEqual([]);
    drawAmbientClouds(ctx, fakeImage(), emptyField, 0);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('reduced motion', () => {
  it('stepCloudField-reducedMotionRequested-leavesEveryCloudPositionUnchanged', () => {
    const field = createCloudField(1024, 32, 390);
    const stepped = stepCloudField(field, 5, true);

    expect(stepped.clouds.map((cloud) => cloud.x)).toEqual(field.clouds.map((cloud) => cloud.x));
  });

  it('stepCloudField-motionAllowed-advancesEveryCloudPosition', () => {
    const field = createCloudField(1024, 32, 390);
    const stepped = stepCloudField(field, 1, false);

    expect(stepped.clouds.map((cloud) => cloud.x)).not.toEqual(field.clouds.map((cloud) => cloud.x));
  });
});

describe('containment', () => {
  it('createCloudField-skyTooShortForTheShortestShape-returnsNoClouds', () => {
    const skyTop = 100;
    const tooShortBottom = skyTop + MIN_SHAPE_HEIGHT * BACKGROUND_RENDER_SCALE - 1;

    const field = createCloudField(1024, skyTop, tooShortBottom);

    expect(field.clouds).toEqual([]);
  });

  it('stepCloudField-longRunIncludingRespawns-keepsEveryCloudInsideTheSkyRegion', () => {
    const skyTop = 100;
    const openSkyBottom = 500;
    let field = createCloudField(1024, skyTop, openSkyBottom);
    let sawRespawn = false;

    for (let i = 0; i < 800; i++) {
      const before = field;
      field = stepCloudField(field, 0.25, false);
      field.clouds.forEach((cloud, index) => {
        const renderedHeight =
          AMBIENT_CLOUD_SOURCE_RECTS[cloud.shapeIndex].height * BACKGROUND_RENDER_SCALE;
        expect(cloud.y).toBeGreaterThanOrEqual(skyTop);
        expect(cloud.y + renderedHeight).toBeLessThanOrEqual(openSkyBottom);
        if (cloud.shapeIndex !== before.clouds[index].shapeIndex) sawRespawn = true;
      });
    }

    // The run must actually have exercised the respawn path (which re-fits y).
    expect(sawRespawn).toBe(true);
  });
});
