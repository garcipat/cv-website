import { describe, it, expect } from 'vitest';
import {
  armFallingStalactite,
  advanceFallingStalactites,
  isFallingStalactiteArmed,
  fallingStalactiteOffsetYAt,
  fallingStalactiteShakeOffsetXAt,
  fallingStalactitePhaseFor,
  fallingStalactiteSpriteHeight,
  fallingStalactiteRestOffsetY,
  detectionZoneCells,
  fallingStalactiteLandingRow,
  FALLING_STALACTITE_SHAKE_SECONDS,
  FALLING_STALACTITE_FALL_SPEED,
  FALLING_STALACTITE_MAX_DETECTION_DEPTH,
  FALLING_STALACTITE_ZONE_HALF_WIDTH,
  type FallingStalactiteTimerState,
  type FallingStalactitePhase,
} from './FallingStalactite';
import { parseLevel } from '../level/LevelParser';
import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../level/Terrain';
import { TWIN_LEFT_RECT, TWIN_RIGHT_RECT } from './StaticObjectsCatalog';
import type { CrumblingFloorTimerState } from './CrumblingFloor';

const NO_BLOCKS: never[] = [];
const NO_CRUMBLING: readonly CrumblingFloorTimerState[] = [];

// Hazard at (1,0), three empty rows, ground on row 3.
const LEVEL = parseLevel(['.T..', '....', '....', 'GGGG']);
// Same but no floor at all — a hazard that falls off the bottom.
const PIT_LEVEL = parseLevel(['.T..', '....', '....', '....']);
// A solid ledge directly under the hazard's own column at row 2.
const LEDGE_LEVEL = parseLevel(['.T..', '....', '.G..', '....', 'GGGG']);
// A crumbling floor directly under the hazard's own column at row 2.
const CRUMBLING_LEVEL = parseLevel(['.T..', '....', '.g..', '....', 'GGGG']);

const HAZARD = { id: 'h', col: 1, row: 0 };

describe('armFallingStalactite', () => {
  it('unarmedId-addsAnEntryAtZeroElapsed', () => {
    expect(armFallingStalactite([], 'h')).toEqual([{ id: 'h', elapsed: 0 }]);
  });

  it('alreadyArmedId-isIdempotent', () => {
    const states: FallingStalactiteTimerState[] = [{ id: 'h', elapsed: 0.2 }];
    expect(armFallingStalactite(states, 'h')).toEqual([{ id: 'h', elapsed: 0.2 }]);
  });

  it('doesNotMutateTheInputArray', () => {
    const states: FallingStalactiteTimerState[] = [];
    armFallingStalactite(states, 'h');
    expect(states).toEqual([]);
  });
});

describe('advanceFallingStalactites', () => {
  it('addsDtToEveryEntry', () => {
    expect(advanceFallingStalactites([{ id: 'h', elapsed: 0.1 }], 0.2)).toEqual([
      { id: 'h', elapsed: 0.30000000000000004 },
    ]);
  });

  it('neverPrunesAnEntryEvenLongPastTheFall', () => {
    const advanced = advanceFallingStalactites([{ id: 'h', elapsed: 100 }], 1000);
    expect(advanced).toHaveLength(1);
    expect(advanced[0].id).toBe('h');
  });

  it('nonPositiveDt-leavesElapsedUnchangedButStillKeepsEntries', () => {
    const advanced = advanceFallingStalactites([{ id: 'h', elapsed: 5 }], 0);
    expect(advanced).toEqual([{ id: 'h', elapsed: 5 }]);
  });
});

describe('isFallingStalactiteArmed', () => {
  it('noEntryForId-isFalse', () => {
    expect(isFallingStalactiteArmed([], 'h')).toBe(false);
  });

  it('entryForId-isTrue', () => {
    expect(isFallingStalactiteArmed([{ id: 'h', elapsed: 0 }], 'h')).toBe(true);
  });
});

describe('fallingStalactiteOffsetYAt', () => {
  it('duringShake-isZero', () => {
    expect(fallingStalactiteOffsetYAt(0)).toBe(0);
    expect(fallingStalactiteOffsetYAt(FALLING_STALACTITE_SHAKE_SECONDS - 0.01)).toBe(0);
  });

  it('afterShake-growsWithElapsed', () => {
    expect(fallingStalactiteOffsetYAt(FALLING_STALACTITE_SHAKE_SECONDS)).toBe(0);
    expect(fallingStalactiteOffsetYAt(FALLING_STALACTITE_SHAKE_SECONDS + 1)).toBeCloseTo(
      FALLING_STALACTITE_FALL_SPEED,
      5,
    );
  });

  it('isMonotonicNonDecreasing', () => {
    let previous = -Infinity;
    for (let elapsed = 0; elapsed <= 2; elapsed += 0.05) {
      const offset = fallingStalactiteOffsetYAt(elapsed);
      expect(offset).toBeGreaterThanOrEqual(previous);
      previous = offset;
    }
  });
});

describe('fallingStalactiteShakeOffsetXAt', () => {
  it('duringShake-isNonZeroAtSomePoint', () => {
    let sawNonZero = false;
    for (let elapsed = 0; elapsed < FALLING_STALACTITE_SHAKE_SECONDS; elapsed += 0.01) {
      if (fallingStalactiteShakeOffsetXAt(elapsed) !== 0) sawNonZero = true;
    }
    expect(sawNonZero).toBe(true);
  });

  it('outsideShake-isZero', () => {
    expect(fallingStalactiteShakeOffsetXAt(FALLING_STALACTITE_SHAKE_SECONDS)).toBe(0);
    expect(fallingStalactiteShakeOffsetXAt(5)).toBe(0);
    expect(fallingStalactiteShakeOffsetXAt(-1)).toBe(0);
  });
});

describe('fallingStalactiteLandingRow', () => {
  it('groundBelow-returnsTheFirstStandableRow', () => {
    expect(fallingStalactiteLandingRow(LEVEL, NO_BLOCKS, NO_CRUMBLING, 1, 0)).toBe(3);
  });

  it('nothingStandableBelow-returnsNull', () => {
    expect(fallingStalactiteLandingRow(PIT_LEVEL, NO_BLOCKS, NO_CRUMBLING, 1, 0)).toBeNull();
  });

  it('ledgeCloserThanTheFloor-returnsTheLedgeRow', () => {
    expect(fallingStalactiteLandingRow(LEDGE_LEVEL, NO_BLOCKS, NO_CRUMBLING, 1, 0)).toBe(2);
  });

  it('intactCrumblingFloor-stopsTheFall', () => {
    expect(fallingStalactiteLandingRow(CRUMBLING_LEVEL, NO_BLOCKS, NO_CRUMBLING, 1, 0)).toBe(2);
  });

  it('brokenCrumblingFloor-noLongerStopsTheFall', () => {
    const broken: CrumblingFloorTimerState[] = [{ col: 1, row: 2, elapsed: 1.5 }];
    expect(fallingStalactiteLandingRow(CRUMBLING_LEVEL, NO_BLOCKS, broken, 1, 0)).toBe(4);
  });

  it('reformingCrumblingFloor-noLongerStopsTheFall', () => {
    const reforming: CrumblingFloorTimerState[] = [{ col: 1, row: 2, elapsed: 2.5 }];
    expect(fallingStalactiteLandingRow(CRUMBLING_LEVEL, NO_BLOCKS, reforming, 1, 0)).toBe(4);
  });
});

describe('fallingStalactiteSpriteHeight / fallingStalactiteRestOffsetY', () => {
  it('largeVariant-isAFullRenderedTileTall', () => {
    // (col 0, row 0) hashes to the large variant.
    expect(fallingStalactiteSpriteHeight(0, 0)).toBe(RENDERED_TILE_SIZE);
  });

  it('twinOnAnOddColumn-isTheShorterRightHalf', () => {
    // (col 1, row 0) hashes to the twin; an odd column drops the right half.
    expect(fallingStalactiteSpriteHeight(1, 0)).toBe(TWIN_RIGHT_RECT.height * RENDER_SCALE);
  });

  it('twinOnAnEvenColumn-isTheTallerLeftHalf', () => {
    // (col 0, row 1) hashes to the twin; an even column drops the left half.
    expect(fallingStalactiteSpriteHeight(0, 1)).toBe(TWIN_LEFT_RECT.height * RENDER_SCALE);
  });

  it('restOffsetLeavesTheSpriteRestingOnTopOfTheLandingSolid', () => {
    // HAZARD is (1,0), a twin-right (10px tall) with ground at row 3: its top
    // must stop one sprite-height above row 3's top, so its bottom meets the
    // floor instead of sinking a whole tile into it.
    expect(fallingStalactiteRestOffsetY(HAZARD, 3)).toBe(
      3 * RENDERED_TILE_SIZE - TWIN_RIGHT_RECT.height * RENDER_SCALE,
    );
    // A full-tile-tall large sprite rests exactly one tile higher.
    expect(fallingStalactiteRestOffsetY({ col: 0, row: 0 }, 3)).toBe(2 * RENDERED_TILE_SIZE);
  });

  it('noLanding-returnsNull', () => {
    expect(fallingStalactiteRestOffsetY(HAZARD, null)).toBeNull();
  });
});

describe('detectionZoneCells', () => {
  it('spansThreeColumnsBeneathTheHazard', () => {
    const cells = detectionZoneCells(HAZARD, LEVEL, NO_BLOCKS, NO_CRUMBLING);
    const cols = new Set(cells.map((c) => c.col));
    expect([...cols].sort()).toEqual([0, 1, 2]);
    expect(FALLING_STALACTITE_ZONE_HALF_WIDTH).toBe(1);
  });

  it('neverExceedsTheMaxDepthAndStaysBelowTheHazard', () => {
    const cells = detectionZoneCells(HAZARD, PIT_LEVEL, NO_BLOCKS, NO_CRUMBLING);
    expect(cells.length).toBeLessThanOrEqual(3 * FALLING_STALACTITE_MAX_DETECTION_DEPTH);
    for (const cell of cells) {
      expect(cell.row).toBeGreaterThan(HAZARD.row);
      expect(cell.row).toBeLessThanOrEqual(HAZARD.row + FALLING_STALACTITE_MAX_DETECTION_DEPTH);
    }
  });

  it('isClippedByTheFirstStandableCellInEachColumn', () => {
    // Ground at row 3 in every column; own-column depth is 2 (rows 1-2), and
    // no zone cell may be the standable row itself.
    const cells = detectionZoneCells(HAZARD, LEVEL, NO_BLOCKS, NO_CRUMBLING);
    expect(cells).toEqual([
      { col: 0, row: 1 },
      { col: 0, row: 2 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 1 },
      { col: 2, row: 2 },
    ]);
  });

  it('aStandableCellInTheOwnColumnShortensTheZone', () => {
    // LEDGE_LEVEL has a standable cell at (1,2): own-column depth becomes 1,
    // so the zone stops at row 1 in every column (col 0's/2's floor at row 4
    // is beyond that depth).
    const cells = detectionZoneCells(HAZARD, LEDGE_LEVEL, NO_BLOCKS, NO_CRUMBLING);
    expect(cells).toEqual([
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
    ]);
  });

  it('neverReturnsAStandableCell', () => {
    for (const level of [LEVEL, LEDGE_LEVEL, CRUMBLING_LEVEL]) {
      for (const cell of detectionZoneCells(HAZARD, level, NO_BLOCKS, NO_CRUMBLING)) {
        const tile = level.terrain[cell.row]?.[cell.col];
        expect(tile).not.toBe('groundGrass');
      }
    }
  });

  it('outOfBoundsFlankingColumnsContributeNoCells', () => {
    // Hazard in the level's leftmost column: only columns 0 and 1 exist.
    const cells = detectionZoneCells(HAZARD, LEVEL, NO_BLOCKS, NO_CRUMBLING);
    expect(cells.every((c) => c.col >= 0 && c.col < LEVEL.width)).toBe(true);
  });
});

describe('fallingStalactitePhaseFor', () => {
  it('noTimerEntry-isHanging', () => {
    expect(fallingStalactitePhaseFor([], HAZARD, LEVEL, NO_BLOCKS, NO_CRUMBLING)).toBe('hanging');
  });

  it('beforeShakeEnds-isShaking', () => {
    const states: FallingStalactiteTimerState[] = [{ id: 'h', elapsed: FALLING_STALACTITE_SHAKE_SECONDS / 2 }];
    expect(fallingStalactitePhaseFor(states, HAZARD, LEVEL, NO_BLOCKS, NO_CRUMBLING)).toBe('shaking');
  });

  it('afterShakeButBeforeLanding-isFalling', () => {
    const states: FallingStalactiteTimerState[] = [
      { id: 'h', elapsed: FALLING_STALACTITE_SHAKE_SECONDS + 0.01 },
    ];
    expect(fallingStalactitePhaseFor(states, HAZARD, LEVEL, NO_BLOCKS, NO_CRUMBLING)).toBe('falling');
  });

  it('onceTheOffsetReachesTheRestPosition-isGone', () => {
    const restOffset = fallingStalactiteRestOffsetY(HAZARD, 3)!; // hazard row 0 -> landing row 3
    const elapsedAtRest = FALLING_STALACTITE_SHAKE_SECONDS + restOffset / FALLING_STALACTITE_FALL_SPEED;
    const justBefore: FallingStalactiteTimerState[] = [
      { id: 'h', elapsed: FALLING_STALACTITE_SHAKE_SECONDS + (restOffset - 1) / FALLING_STALACTITE_FALL_SPEED },
    ];
    expect(fallingStalactitePhaseFor(justBefore, HAZARD, LEVEL, NO_BLOCKS, NO_CRUMBLING)).toBe('falling');
    const atRest: FallingStalactiteTimerState[] = [{ id: 'h', elapsed: elapsedAtRest }];
    expect(fallingStalactitePhaseFor(atRest, HAZARD, LEVEL, NO_BLOCKS, NO_CRUMBLING)).toBe('gone');
  });

  it('withNoLandingBelow-isGoneOncePastTheBottom', () => {
    // PIT_LEVEL has no standable cell, so any falling elapsed resolves gone.
    const states: FallingStalactiteTimerState[] = [
      { id: 'h', elapsed: FALLING_STALACTITE_SHAKE_SECONDS + 0.01 },
    ];
    expect(fallingStalactitePhaseFor(states, HAZARD, PIT_LEVEL, NO_BLOCKS, NO_CRUMBLING)).toBe('gone');
  });

  it('isMonotonicInElapsedForAFixedLanding', () => {
    const rank: Record<FallingStalactitePhase, number> = { hanging: 0, shaking: 1, falling: 2, gone: 3 };
    let previous = -1;
    for (let elapsed = 0; elapsed <= 5; elapsed += 0.05) {
      const states: FallingStalactiteTimerState[] = [{ id: 'h', elapsed }];
      const phase = fallingStalactitePhaseFor(states, HAZARD, LEVEL, NO_BLOCKS, NO_CRUMBLING);
      expect(rank[phase]).toBeGreaterThanOrEqual(previous);
      previous = rank[phase];
    }
  });

  it('aCrumblingFloorBreakingMidFallMovesTheLandingDown', () => {
    const restOffset = fallingStalactiteRestOffsetY(HAZARD, 4)!; // past the broken row 2, to row 4
    const elapsedAtNewRest =
      FALLING_STALACTITE_SHAKE_SECONDS + restOffset / FALLING_STALACTITE_FALL_SPEED;
    // Just past the broken-floor row, still falling (not gone), because the
    // tile broke and no longer stops the fall.
    const early: FallingStalactiteTimerState[] = [
      { id: 'h', elapsed: FALLING_STALACTITE_SHAKE_SECONDS + (2 * RENDERED_TILE_SIZE) / FALLING_STALACTITE_FALL_SPEED },
    ];
    const broken: CrumblingFloorTimerState[] = [{ col: 1, row: 2, elapsed: 1.5 }];
    expect(fallingStalactitePhaseFor(early, HAZARD, CRUMBLING_LEVEL, NO_BLOCKS, broken)).toBe('falling');
    const atNewLanding: FallingStalactiteTimerState[] = [{ id: 'h', elapsed: elapsedAtNewRest }];
    expect(fallingStalactitePhaseFor(atNewLanding, HAZARD, CRUMBLING_LEVEL, NO_BLOCKS, broken)).toBe('gone');
  });
});
