import {
  bombLandingRow,
  createPlacedBomb,
  stepPlacedBomb,
  checkBombFellOut,
  bombFuseFrame,
  hasDetonated,
  BOMB_FUSE_SECONDS,
  BOMB_FUSE_SEQUENCE,
  BOMB_BURN_FRAMES,
  BOMB_BURN_SECONDS,
  BOMB_PULSE_FRAMES,
  BOMB_PULSE_SECONDS,
  BOMB_PULSE_SCALE,
} from './PlacedBomb';
import type { PlacedBombState } from './PlacedBomb';
import { parseLevel } from '../level/LevelParser';
import { tileToPixel, RENDERED_TILE_SIZE } from '../level/Terrain';
import { toBlockState } from '../entities/Block';

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
    const bomb = createPlacedBomb('bomb-0-0-1', level, [], 0, 0);
    expect(bomb).toMatchObject({
      id: 'bomb-0-0-1',
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
    let bomb = createPlacedBomb('bomb-0-0-1', level, [], 0, 0);
    const restingY = tileToPixel(0, 1).y;
    let previousY = bomb.y;

    for (let i = 0; i < 60 && !bomb.landed; i++) {
      bomb = stepPlacedBomb(bomb, level, [], 1 / 60);
      expect(bomb.y).toBeGreaterThanOrEqual(previousY);
      expect(bomb.y).toBeLessThanOrEqual(restingY);
      previousY = bomb.y;
    }

    expect(bomb.landed).toBe(true);
    expect(bomb.y).toBe(restingY);
    expect(bomb.vy).toBe(0);
  });

  it('falling-stillAdvancesTheFuseEveryStep', () => {
    let bomb = createPlacedBomb('bomb-0-0-1', level, [], 0, 0);
    bomb = stepPlacedBomb(bomb, level, [], 0.1);
    expect(bomb.fuseElapsed).toBeCloseTo(0.1);
    expect(bomb.landed).toBe(false);
    bomb = stepPlacedBomb(bomb, level, [], 0.1);
    expect(bomb.fuseElapsed).toBeCloseTo(0.2);
  });

  it('nonPositiveDt-returnsTheSameState', () => {
    const bomb = createPlacedBomb('bomb-0-0-1', level, [], 0, 0);
    expect(stepPlacedBomb(bomb, level, [], 0)).toBe(bomb);
    expect(stepPlacedBomb(bomb, level, [], -1)).toBe(bomb);
  });

  it('stepping-neverMutatesItsInput', () => {
    const bomb = createPlacedBomb('bomb-0-0-1', level, [], 0, 0);
    const before = { ...bomb };
    stepPlacedBomb(bomb, level, [], 0.1);
    expect(bomb).toEqual(before);
  });
});

describe('checkBombFellOut', () => {
  const level = parseLevel(['.', '.']);
  const base: PlacedBombState = {
    id: 'bomb-0-0-1',
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
