import {
  bombLandingRow,
  createPlacedBomb,
  stepPlacedBomb,
  checkBombFellOut,
  bombFuseFrame,
  hasDetonated,
  bombDeployableItem,
  bomb,
  spawnBombPickup,
  BOMB_PICKUP_RENDERED_SIZE,
  BOMB_PICKUP_TILE_OFFSET_X,
  BOMB_PICKUP_TILE_OFFSET_Y,
  BOMB_PULSE_SCALE,
  BOMB_BURN_FRAMES,
  BOMB_BURN_SECONDS,
  BOMB_FUSE_SECONDS,
  BOMB_FUSE_SEQUENCE,
  BOMB_PULSE_FRAMES,
  BOMB_PULSE_SECONDS,
} from './Bomb';
import type { PlacedBombState } from './Bomb';
import { parseLevel } from '../../level/LevelParser';
import { tileToPixel, RENDERED_TILE_SIZE } from '../../level/Terrain';
import { toBlockState } from '../Block';
import { BOMB_SHEET } from '../sprites/sheets';
import { frameSource } from '../sprites/SpriteSheet';

describe('bombLandingRow', () => {
  it('cellDirectlyBelowIsSolid-returnsTheBombsOwnRow', () => {
    const level = parseLevel(['..', 'GG']);
    expect(bombLandingRow(level, [], 0, 0)).toBe(0);
  });

  it('openAirBelowTheBomb-returnsTheRowAboveTheFirstSolidCell', () => {
    const level = parseLevel(['.', '.', 'G']);
    expect(bombLandingRow(level, [], 0, 0)).toBe(1);
  });

  it('bridgeBelowTheBomb-countsAsAFloor', () => {
    const level = parseLevel(['.', 'B', '.']);
    expect(bombLandingRow(level, [], 0, 0)).toBe(0);
  });

  it('ladderBelowTheBomb-isOpenAir', () => {
    const level = parseLevel(['.', 'H', 'G']);
    expect(bombLandingRow(level, [], 0, 0)).toBe(1);
  });

  it('atRestCrumblingFloorBelowTheBomb-countsAsAFloor', () => {
    const level = parseLevel(['.', 'g']);
    expect(bombLandingRow(level, [], 0, 0)).toBe(0);
  });

  it('brokenCrumblingFloorBelowTheBomb-isOpenAir', () => {
    const level = parseLevel(['.', 'g', 'G']);
    const states = [{ col: 0, row: 1, elapsed: 1.0 }]; // mid "broken"
    expect(bombLandingRow(level, [], 0, 0, states)).toBe(1);
  });

  it('aBlockPlacementBelowTheBomb-countsAsAFloor', () => {
    const level = parseLevel(['.', '.', '.']);
    const block = toBlockState({
      id: 'crate-0-1',
      blockKind: 'crate',
      ...tileToPixel(0, 1),
    });
    expect(bombLandingRow(level, [block], 0, 0)).toBe(0);
  });

  it('noFloorBeforeTheLevelsBottom-returnsNull', () => {
    const level = parseLevel(['.', '.']);
    expect(bombLandingRow(level, [], 0, 0)).toBeNull();
  });
});

describe('createPlacedBomb', () => {
  it('called-startsAtTheTileWithNoVelocityAndAnEmptyFuse', () => {
    const level = parseLevel(['.', 'G']);
    const bombState = createPlacedBomb('bomb-0-0-1', level, [], 0, 0);
    expect(bombState).toMatchObject({
      id: 'bomb-0-0-1',
      kind: 'bomb',
      ...tileToPixel(0, 0),
      vy: 0,
      col: 0,
      row: 0,
      landingRow: 0,
      fuseElapsed: 0,
      landed: false,
    });
  });
});

describe('stepPlacedBomb', () => {
  const level = parseLevel(['.', '.', 'G']);

  it('falling-advancesMonotonicallyAndSnapsToTheRestingSurface', () => {
    let bombState = createPlacedBomb('bomb-0-0-1', level, [], 0, 0);
    const restingY = tileToPixel(0, 1).y;
    let previousY = bombState.y;

    for (let i = 0; i < 60 && !bombState.landed; i++) {
      bombState = stepPlacedBomb(bombState, 1 / 60);
      expect(bombState.y).toBeGreaterThanOrEqual(previousY);
      expect(bombState.y).toBeLessThanOrEqual(restingY);
      previousY = bombState.y;
    }

    expect(bombState.landed).toBe(true);
    expect(bombState.y).toBe(restingY);
    expect(bombState.vy).toBe(0);
  });

  it('falling-stillAdvancesTheFuseEveryStep', () => {
    let bombState = createPlacedBomb('bomb-0-0-1', level, [], 0, 0);
    bombState = stepPlacedBomb(bombState, 0.1);
    expect(bombState.fuseElapsed).toBeCloseTo(0.1);
    expect(bombState.landed).toBe(false);
    bombState = stepPlacedBomb(bombState, 0.1);
    expect(bombState.fuseElapsed).toBeCloseTo(0.2);
  });

  it('nonPositiveDt-returnsTheSameState', () => {
    const bombState = createPlacedBomb('bomb-0-0-1', level, [], 0, 0);
    expect(stepPlacedBomb(bombState, 0)).toBe(bombState);
    expect(stepPlacedBomb(bombState, -1)).toBe(bombState);
  });

  it('stepping-neverMutatesItsInput', () => {
    const bombState = createPlacedBomb('bomb-0-0-1', level, [], 0, 0);
    const before = { ...bombState };
    stepPlacedBomb(bombState, 0.1);
    expect(bombState).toEqual(before);
  });
});

describe('checkBombFellOut', () => {
  const level = parseLevel(['.', '.']);
  const base: PlacedBombState = {
    id: 'bomb-0-0-1',
    kind: 'bomb',
    x: 0,
    y: 0,
    vy: 0,
    col: 0,
    row: 0,
    landingRow: null,
    fuseElapsed: 0,
    landed: false,
  };

  it('bottomEdgeBelowTheLevel-returnsTrue', () => {
    expect(checkBombFellOut({ ...base, y: level.height * RENDERED_TILE_SIZE }, level)).toBe(true);
  });

  it('stillInsideTheLevel-returnsFalse', () => {
    expect(checkBombFellOut({ ...base, y: 10 }, level)).toBe(false);
  });
});

describe('bombFuseFrame', () => {
  const burnPer = BOMB_BURN_SECONDS / BOMB_BURN_FRAMES.length;
  const pulsePer = BOMB_PULSE_SECONDS / BOMB_PULSE_FRAMES.length;

  it('startOfTheFuse-showsTheFirstLitFrame', () => {
    expect(bombFuseFrame(0).frame).toBe(1);
  });

  it('overTheBurnDown-playsFramesOneThroughThree', () => {
    const frames = BOMB_BURN_FRAMES.map((_, i) => bombFuseFrame((i + 0.5) * burnPer).frame);
    expect(frames).toEqual([1, 2, 3]);
  });

  it('overThePulse-playsTheFourFiveAlternationEndingOnFive', () => {
    const frames = BOMB_PULSE_FRAMES.map(
      (_, i) => bombFuseFrame(BOMB_BURN_SECONDS + (i + 0.5) * pulsePer).frame,
    );
    expect(frames).toEqual([4, 5, 4, 5, 4, 5]);
  });

  it('overTheWholeFuse-playsTheFixedSequenceNeverFrameZero', () => {
    const times = [
      ...BOMB_BURN_FRAMES.map((_, i) => (i + 0.5) * burnPer),
      ...BOMB_PULSE_FRAMES.map((_, i) => BOMB_BURN_SECONDS + (i + 0.5) * pulsePer),
    ];
    const frames = times.map((t) => bombFuseFrame(t).frame);
    expect(frames).toEqual([1, 2, 3, 4, 5, 4, 5, 4, 5]);
    expect(frames).toEqual([...BOMB_FUSE_SEQUENCE]);
    expect(frames).not.toContain(0);
  });

  it('burnDownOccupiesMoreTimeThanThePulse-soTheEarlyStagesDoNotFlashPast', () => {
    expect(BOMB_BURN_SECONDS).toBeGreaterThan(BOMB_PULSE_SECONDS);
    expect(burnPer).toBeGreaterThan(pulsePer);
  });

  it('onlyTheOrangeFrame-isScaledUp', () => {
    const times = [
      ...BOMB_BURN_FRAMES.map((_, i) => (i + 0.5) * burnPer),
      ...BOMB_PULSE_FRAMES.map((_, i) => BOMB_BURN_SECONDS + (i + 0.5) * pulsePer),
    ];
    for (const t of times) {
      const { frame, scale } = bombFuseFrame(t);
      expect(scale).toBe(frame === 5 ? BOMB_PULSE_SCALE : 1);
    }
  });

  it('endOfTheFuse-endsOnTheOrangeFrame', () => {
    expect(bombFuseFrame(BOMB_FUSE_SECONDS).frame).toBe(5);
    expect(bombFuseFrame(BOMB_FUSE_SECONDS * 0.999).frame).toBe(5);
  });

  it('pastTheEnd-clampsToTheFinalFrame', () => {
    expect(bombFuseFrame(BOMB_FUSE_SECONDS * 10).frame).toBe(5);
  });
});

describe('hasDetonated', () => {
  const base: PlacedBombState = {
    id: 'bomb-0-0-1',
    kind: 'bomb',
    x: 0,
    y: 0,
    vy: 0,
    col: 0,
    row: 0,
    landingRow: 0,
    fuseElapsed: 0,
    landed: true,
  };

  it('beforeTheFuseDuration-returnsFalse', () => {
    expect(hasDetonated(base)).toBe(false);
    expect(hasDetonated({ ...base, fuseElapsed: BOMB_FUSE_SECONDS - 0.001 })).toBe(false);
  });

  it('atOrAfterTheFuseDuration-returnsTrue', () => {
    expect(hasDetonated({ ...base, fuseElapsed: BOMB_FUSE_SECONDS })).toBe(true);
    expect(hasDetonated({ ...base, fuseElapsed: BOMB_FUSE_SECONDS + 1 })).toBe(true);
  });
});

describe('spawnBombPickup', () => {
  it('called-startsAtTheGivenPosition', () => {
    expect(spawnBombPickup('pot1', 100, 200)).toEqual({
      id: 'pot1',
      kind: 'bomb',
      x: 100,
      y: 200,
      collected: false,
    });
  });
});

describe('BOMB_PICKUP_RENDERED_SIZE', () => {
  it('matchesTheHeartPickupSize', () => {
    expect(BOMB_PICKUP_RENDERED_SIZE).toBe(24);
  });
});

describe('tile offsets', () => {
  it('centerTheRenderedSizeWithinOneTile', () => {
    expect(BOMB_PICKUP_TILE_OFFSET_X).toBe((RENDERED_TILE_SIZE - BOMB_PICKUP_RENDERED_SIZE) / 2);
    expect(BOMB_PICKUP_TILE_OFFSET_Y).toBe((RENDERED_TILE_SIZE - BOMB_PICKUP_RENDERED_SIZE) / 2);
  });
});

describe('bomb pickup box', () => {
  it('box-isTheCenteredSmallerRect', () => {
    expect(bomb.box(spawnBombPickup('b', 100, 200))).toEqual({
      x: 100 + BOMB_PICKUP_TILE_OFFSET_X,
      y: 200 + BOMB_PICKUP_TILE_OFFSET_Y,
      width: BOMB_PICKUP_RENDERED_SIZE,
      height: BOMB_PICKUP_RENDERED_SIZE,
    });
  });
});

describe('bomb view', () => {
  it('key-isBomb-andDrawLayerIsAfterEnemies', () => {
    expect(bomb.key).toBe('bomb');
    expect(bomb.drawLayer).toBe('afterEnemies');
  });

  it('maxPerTick-returnsTheRemainingCapacity', () => {
    expect(bomb.maxPerTick?.({ playerHitPoints: 6, capacity: 3 })).toBe(3);
    expect(bomb.maxPerTick?.({ playerHitPoints: 6 })).toBe(0);
  });

  it('onPickup-addsExactlyOneBomb', () => {
    const outcome = bomb.onPickup(spawnBombPickup('b1', 0, 0), {
      pool: [],
      total: 0,
      collectedBefore: 0,
    });
    expect(outcome).toEqual({ bombs: 1 });
    expect(outcome).not.toHaveProperty('disposition');
    expect(outcome).not.toHaveProperty('self');
  });
});

describe('the bomb has one home (both faces)', () => {
  it('heldFaceAndPlacedFace-shareTheSameBombSheetDescriptor', () => {
    expect(bomb.sprite.sheet).toBe(BOMB_SHEET);
    expect(bombDeployableItem.sprite.sheet).toBe(BOMB_SHEET);
  });

  it('placedFace-declaresTheBombRegistryFields', () => {
    expect(bombDeployableItem.key).toBe('bomb');
    expect(bombDeployableItem.drawLayer).toBe('afterBlocks');
    expect(bombDeployableItem.resetScope).toBe('death');
  });

  it('spawn-usesThePlacementTileAndLandingRules', () => {
    const level = parseLevel(['.', 'G']);
    const spawned = bombDeployableItem.spawn({
      id: 'bomb-0-0-0',
      col: 0,
      row: 0,
      x: 0,
      y: 0,
      level,
      blocks: [],
      crumblingFloorStates: [],
    });
    expect(spawned.kind).toBe('bomb');
    expect(spawned.landingRow).toBe(0);
    expect(spawned.fuseElapsed).toBe(0);
  });

  it('onTick-onExpiry-returnsARemoveWithTheBombBlastRequest', () => {
    const level = parseLevel(['.', 'G']);
    const detonating: PlacedBombState = {
      ...createPlacedBomb('bomb-1-1-0', level, [], 1, 0),
      fuseElapsed: BOMB_FUSE_SECONDS,
      y: RENDERED_TILE_SIZE,
    };
    expect(bombDeployableItem.onTick?.(detonating, { level })).toEqual({
      disposition: 'remove',
      blasts: [
        {
          col: 1,
          row: 1,
          x: RENDERED_TILE_SIZE,
          y: RENDERED_TILE_SIZE,
          effectId: 'bomb-1-1-0',
          hitEffectId: 'bomb-bomb-1-1-0',
        },
      ],
    });
  });

  it('onTick-fellOut-returnsARemoveWithNoBlast', () => {
    const level = parseLevel(['.', '.']);
    const fallen: PlacedBombState = {
      id: 'bomb-0-0-0',
      kind: 'bomb',
      x: 0,
      y: level.height * RENDERED_TILE_SIZE,
      vy: 0,
      col: 0,
      row: 0,
      landingRow: null,
      fuseElapsed: 0.1,
      landed: false,
    };
    expect(bombDeployableItem.onTick?.(fallen, { level })).toEqual({ disposition: 'remove' });
  });

  it('onTick-stillLive-returnsKeep', () => {
    const level = parseLevel(['.', 'G']);
    const live = createPlacedBomb('bomb-0-0-0', level, [], 0, 0);
    expect(bombDeployableItem.onTick?.(live, { level })).toEqual({ disposition: 'keep' });
  });
});

describe('bombDeployableItem.draw', () => {
  const baseBomb: PlacedBombState = {
    id: 'bomb-1',
    kind: 'bomb',
    x: 64,
    y: 32,
    vy: 0,
    col: 2,
    row: 1,
    landingRow: 1,
    fuseElapsed: 0,
    landed: true,
  };

  function makeMockContext() {
    return {
      imageSmoothingEnabled: true,
      drawImage: vi.fn(),
      save: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  }

  function makeDc(ctx: CanvasRenderingContext2D) {
    return {
      ctx,
      sprites: { [BOMB_SHEET.src]: { tag: 'bomb' } as unknown as HTMLImageElement },
      originX: 0,
      originY: 0,
      worldElapsed: 0,
    };
  }

  it('drawsTheFuseFrameForItsElapsedTime', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDc(ctx as unknown as CanvasRenderingContext2D);

    bombDeployableItem.draw(baseBomb, dc);

    const { sx, sy } = frameSource(BOMB_SHEET, bombFuseFrame(0).frame);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      dc.sprites[BOMB_SHEET.src],
      sx,
      sy,
      BOMB_SHEET.frameWidth,
      BOMB_SHEET.frameHeight,
      -RENDERED_TILE_SIZE / 2,
      -RENDERED_TILE_SIZE / 2,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
  });

  it('acrossTheWholeFuse-neverDrawsTheUnlitFrame', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDc(ctx as unknown as CanvasRenderingContext2D);
    const unlit = frameSource(BOMB_SHEET, 0);
    const frames: number[] = [];

    for (let i = 0; i < BOMB_FUSE_SEQUENCE.length; i++) {
      const fuseElapsed = ((i + 0.5) * BOMB_FUSE_SECONDS) / BOMB_FUSE_SEQUENCE.length;
      bombDeployableItem.draw({ ...baseBomb, fuseElapsed }, dc);
      frames.push(bombFuseFrame(fuseElapsed).frame);
    }

    expect(frames).not.toContain(0);
    for (const call of ctx.drawImage.mock.calls) {
      expect([call[1], call[2]]).not.toEqual([unlit.sx, unlit.sy]);
    }
  });

  it('theOrangeFrame-isScaledUpAboutTheTileCentre', () => {
    const ctx = makeMockContext() as unknown as { scale: ReturnType<typeof vi.fn> };
    const dc = makeDc(ctx as unknown as CanvasRenderingContext2D);

    bombDeployableItem.draw({ ...baseBomb, fuseElapsed: BOMB_FUSE_SECONDS * 0.999 }, dc);

    expect(ctx.scale).toHaveBeenCalledWith(BOMB_PULSE_SCALE, BOMB_PULSE_SCALE);
  });

  it('aFallingBomb-isDrawnAtItsCurrentY', () => {
    const ctx = makeMockContext() as unknown as { translate: ReturnType<typeof vi.fn> };
    const dc = makeDc(ctx as unknown as CanvasRenderingContext2D);

    bombDeployableItem.draw({ ...baseBomb, y: 96 }, dc);

    expect(ctx.translate).toHaveBeenCalledWith(
      64 + RENDERED_TILE_SIZE / 2,
      96 + RENDERED_TILE_SIZE / 2,
    );
  });
});
