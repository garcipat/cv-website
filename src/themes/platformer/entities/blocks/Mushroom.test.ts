import { describe, it, expect } from 'vitest';
import {
  MUSHROOM_CAP_SOURCE_HEIGHT,
  MUSHROOM_SQUASH_DURATION_SECONDS,
  MUSHROOM_SQUASH_DIP_PX,
  advanceMushroomSquashes,
  mushroomEntry,
  mushroomHasCap,
  mushroomSquashDip,
  mushroomSquashDipAt,
  startMushroomSquash,
  type MushroomSquashState,
} from './Mushroom';

const TILE_SIZE = 16;

describe('startMushroomSquash', () => {
  it('emptyInput-appendsAFreshEntryAtElapsedZero', () => {
    expect(startMushroomSquash([], 3, 4)).toEqual([{ col: 3, row: 4, elapsed: 0 }]);
  });

  it('neverMutatesItsInputArray', () => {
    const input: MushroomSquashState[] = [{ col: 1, row: 2, elapsed: 0.05 }];
    const snapshot = JSON.parse(JSON.stringify(input));
    startMushroomSquash(input, 3, 4);
    expect(input).toEqual(snapshot);
  });

  it('sameCellAlreadySquashing-replacesItRatherThanQueueingASecond', () => {
    const states = startMushroomSquash([], 3, 4);
    const advanced = advanceMushroomSquashes(states, 0.05);
    const restarted = startMushroomSquash(advanced, 3, 4);
    expect(restarted).toHaveLength(1);
    expect(restarted[0]).toEqual({ col: 3, row: 4, elapsed: 0 });
  });

  it('differentCells-leavesOneEntryPerCell', () => {
    const states = startMushroomSquash(startMushroomSquash([], 3, 4), 5, 6);
    expect(states).toHaveLength(2);
  });
});

describe('advanceMushroomSquashes', () => {
  it('emptyInput-returnsEmptyArray', () => {
    expect(advanceMushroomSquashes([], 0.05)).toEqual([]);
  });

  it('entryBelowDuration-advancesElapsedByDt', () => {
    const advanced = advanceMushroomSquashes([{ col: 1, row: 2, elapsed: 0.02 }], 0.03);
    expect(advanced).toEqual([{ col: 1, row: 2, elapsed: 0.05 }]);
  });

  it('entryReachingExactlyDuration-isDropped', () => {
    const advanced = advanceMushroomSquashes(
      [{ col: 1, row: 2, elapsed: 0 }],
      MUSHROOM_SQUASH_DURATION_SECONDS,
    );
    expect(advanced).toEqual([]);
  });

  it('entryPastDuration-isDropped', () => {
    const advanced = advanceMushroomSquashes(
      [{ col: 1, row: 2, elapsed: 0 }],
      MUSHROOM_SQUASH_DURATION_SECONDS + 0.5,
    );
    expect(advanced).toEqual([]);
  });

  it('dtZero-stillPrunesAnAlreadyExpiredEntry', () => {
    const advanced = advanceMushroomSquashes(
      [{ col: 1, row: 2, elapsed: MUSHROOM_SQUASH_DURATION_SECONDS }],
      0,
    );
    expect(advanced).toEqual([]);
  });

  it('negativeDt-leavesAnUnexpiredEntryUnchanged', () => {
    const advanced = advanceMushroomSquashes([{ col: 1, row: 2, elapsed: 0.02 }], -1);
    expect(advanced).toEqual([{ col: 1, row: 2, elapsed: 0.02 }]);
  });

  it('neverMutatesItsInputArray', () => {
    const input: MushroomSquashState[] = [{ col: 1, row: 2, elapsed: 0.02 }];
    advanceMushroomSquashes(input, 0.03);
    expect(input).toEqual([{ col: 1, row: 2, elapsed: 0.02 }]);
  });
});

describe('mushroomSquashDip', () => {
  it('elapsedZero-returnsFullDip', () => {
    expect(mushroomSquashDip({ col: 1, row: 2, elapsed: 0 })).toBe(MUSHROOM_SQUASH_DIP_PX);
  });

  it('elapsedAtDuration-returnsZero', () => {
    expect(
      mushroomSquashDip({ col: 1, row: 2, elapsed: MUSHROOM_SQUASH_DURATION_SECONDS }),
    ).toBe(0);
  });

  it('elapsedPastDuration-returnsZeroNeverNegative', () => {
    expect(
      mushroomSquashDip({ col: 1, row: 2, elapsed: MUSHROOM_SQUASH_DURATION_SECONDS * 10 }),
    ).toBe(0);
  });

  it('elapsedHalfway-returnsHalfDip', () => {
    expect(
      mushroomSquashDip({ col: 1, row: 2, elapsed: MUSHROOM_SQUASH_DURATION_SECONDS / 2 }),
    ).toBeCloseTo(MUSHROOM_SQUASH_DIP_PX / 2);
  });
});

describe('mushroomSquashDipAt', () => {
  it('noEntryForTheCell-returnsZero', () => {
    expect(mushroomSquashDipAt([], 1, 2)).toBe(0);
    expect(mushroomSquashDipAt([{ col: 3, row: 4, elapsed: 0 }], 1, 2)).toBe(0);
  });

  it('entryForTheCell-returnsItsDip', () => {
    expect(mushroomSquashDipAt([{ col: 1, row: 2, elapsed: 0 }], 1, 2)).toBe(
      MUSHROOM_SQUASH_DIP_PX,
    );
  });
});

describe('mushroomEntry / mushroomHasCap', () => {
  it('mushroomEntry-eachRole-resolvesToItsDocumentedCrop', () => {
    expect(mushroomEntry('only')).toEqual({ sx: 0, sy: 0 });
    expect(mushroomEntry('top')).toEqual({ sx: 16, sy: 0 });
    expect(mushroomEntry('middle')).toEqual({ sx: 48, sy: 0 });
    expect(mushroomEntry('bottom')).toEqual({ sx: 48, sy: 16 });
  });

  it('mushroomHasCap-onlyAndTop-areTrue', () => {
    expect(mushroomHasCap('only')).toBe(true);
    expect(mushroomHasCap('top')).toBe(true);
  });

  it('mushroomHasCap-middleAndBottom-areFalse', () => {
    expect(mushroomHasCap('middle')).toBe(false);
    expect(mushroomHasCap('bottom')).toBe(false);
  });

  it('MUSHROOM_CAP_SOURCE_HEIGHT-staysWithinThe16pxCell', () => {
    expect(MUSHROOM_CAP_SOURCE_HEIGHT).toBeGreaterThan(0);
    expect(MUSHROOM_CAP_SOURCE_HEIGHT).toBeLessThanOrEqual(TILE_SIZE);
  });
});
