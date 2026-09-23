import { describe, it, expect } from 'vitest';
import { isStandableCell } from './Standable';
import { parseLevel } from '../level/LevelParser';
import { placeBlocks } from '../level/BlockMapper';
import {
  CRUMBLING_FLOOR_CRACK_SECONDS,
  CRUMBLING_FLOOR_BROKEN_SECONDS,
  type CrumblingFloorTimerState,
} from './CrumblingFloor';

const NO_BLOCKS = placeBlocks([], { crate: [], questionMark: [], fragileRock: [] });
const NO_CRUMBLING: readonly CrumblingFloorTimerState[] = [];

/** A level whose only content is a ground row, so cells above it are empty. */
const GROUND = parseLevel(['..', 'GG']);

describe('isStandableCell — terrain', () => {
  it('groundGrass-isStandable', () => {
    expect(isStandableCell(parseLevel(['G']), NO_BLOCKS, NO_CRUMBLING, 0, 0)).toBe(true);
  });

  it('groundRock-isStandable', () => {
    expect(isStandableCell(parseLevel(['R']), NO_BLOCKS, NO_CRUMBLING, 0, 0)).toBe(true);
  });

  it('wall-isStandable', () => {
    expect(isStandableCell(parseLevel(['#']), NO_BLOCKS, NO_CRUMBLING, 0, 0)).toBe(true);
  });

  it('emptyCell-isNotStandable', () => {
    expect(isStandableCell(GROUND, NO_BLOCKS, NO_CRUMBLING, 0, 0)).toBe(false);
  });

  it('bridge-isStandableByDefault', () => {
    expect(isStandableCell(parseLevel(['B']), NO_BLOCKS, NO_CRUMBLING, 0, 0)).toBe(true);
  });

  it('bridge-withExcludeBridge-isNotStandable', () => {
    expect(
      isStandableCell(parseLevel(['B']), NO_BLOCKS, NO_CRUMBLING, 0, 0, { excludeBridge: true }),
    ).toBe(false);
  });

  it('excludeBridge-leavesEveryOtherSolidStandable', () => {
    expect(
      isStandableCell(parseLevel(['G']), NO_BLOCKS, NO_CRUMBLING, 0, 0, { excludeBridge: true }),
    ).toBe(true);
  });
});

describe('isStandableCell — crumbling floor state', () => {
  const CRUMBLING = parseLevel(['g', 'G']);

  it('intactCrumblingFloor-isStandable', () => {
    expect(isStandableCell(CRUMBLING, NO_BLOCKS, NO_CRUMBLING, 0, 0)).toBe(true);
  });

  it('crackingCrumblingFloor-isStillStandable', () => {
    const states: CrumblingFloorTimerState[] = [
      { col: 0, row: 0, elapsed: CRUMBLING_FLOOR_CRACK_SECONDS / 2 },
    ];
    expect(isStandableCell(CRUMBLING, NO_BLOCKS, states, 0, 0)).toBe(true);
  });

  it('brokenCrumblingFloor-isNotStandable', () => {
    const states: CrumblingFloorTimerState[] = [
      { col: 0, row: 0, elapsed: CRUMBLING_FLOOR_CRACK_SECONDS + 0.1 },
    ];
    expect(isStandableCell(CRUMBLING, NO_BLOCKS, states, 0, 0)).toBe(false);
  });

  it('reformingCrumblingFloor-isNotStandable', () => {
    const states: CrumblingFloorTimerState[] = [
      { col: 0, row: 0, elapsed: CRUMBLING_FLOOR_CRACK_SECONDS + CRUMBLING_FLOOR_BROKEN_SECONDS + 0.1 },
    ];
    expect(isStandableCell(CRUMBLING, NO_BLOCKS, states, 0, 0)).toBe(false);
  });

  it('brokenCrumblingFloor-isNotStandableEvenWithExcludeBridge', () => {
    const states: CrumblingFloorTimerState[] = [
      { col: 0, row: 0, elapsed: CRUMBLING_FLOOR_CRACK_SECONDS + 0.1 },
    ];
    expect(isStandableCell(CRUMBLING, NO_BLOCKS, states, 0, 0, { excludeBridge: true })).toBe(false);
  });
});

describe('isStandableCell — one-way ground terms', () => {
  it('standableLadderTop-isStandable', () => {
    // The top rung of a shaft with open space above it.
    const level = parseLevel(['H.', 'H.', 'G.']);
    expect(isStandableCell(level, NO_BLOCKS, NO_CRUMBLING, 0, 0)).toBe(true);
  });

  it('ladderMiddleCell-isNotStandable', () => {
    // (0,1) has a continuing ladder above it, so it is not the top.
    const level = parseLevel(['H.', 'H.', 'G.']);
    expect(isStandableCell(level, NO_BLOCKS, NO_CRUMBLING, 0, 1)).toBe(false);
  });

  it('rolledLadderBundleTop-isStandable', () => {
    const level = parseLevel(['@', '.']);
    expect(isStandableCell(level, NO_BLOCKS, NO_CRUMBLING, 0, 0)).toBe(true);
  });

  it('bouncyMushroomCap-isStandable', () => {
    const level = parseLevel(['§', '§']);
    expect(isStandableCell(level, NO_BLOCKS, NO_CRUMBLING, 0, 0)).toBe(true);
  });

  it('bouncyMushroomStalk-isNotStandable', () => {
    const level = parseLevel(['§', '§']);
    expect(isStandableCell(level, NO_BLOCKS, NO_CRUMBLING, 0, 1)).toBe(false);
  });
});

describe('isStandableCell — blocks', () => {
  it('blockOccupiedCell-isStandable', () => {
    const blocks = placeBlocks([], {
      crate: [],
      questionMark: [{ col: 0, row: 0 }],
      fragileRock: [],
    });
    expect(isStandableCell(GROUND, blocks, NO_CRUMBLING, 0, 0)).toBe(true);
  });

  it('cellWithNoBlock-isNotStandable', () => {
    const blocks = placeBlocks([], {
      crate: [],
      questionMark: [{ col: 1, row: 0 }],
      fragileRock: [],
    });
    expect(isStandableCell(GROUND, blocks, NO_CRUMBLING, 0, 0)).toBe(false);
  });
});
