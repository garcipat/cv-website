import { describe, expect, it } from 'vitest';
import { shakeOffsetX } from './math';
import {
  advanceTimedTiles,
  armTimedTile,
  timedTileElapsedFor,
  timedTileHas,
  timedTileKeysEqual,
  timedTileShakeOffsetX,
  timedTileStateFor,
  type GridTimerState,
  type TimedTileConfig,
} from './timedTile';

interface GridState {
  col: number;
  row: number;
  elapsed: number;
}

interface IdState {
  id: string;
  elapsed: number;
}

const GRID_DURATION = 1;
const GRID_CONFIG: TimedTileConfig<GridState, { col: number; row: number }> = {
  keyOf: (state) => ({ col: state.col, row: state.row }),
  duration: GRID_DURATION,
  prune: true,
  rearm: 'replace',
};

const NOOP_CONFIG: TimedTileConfig<GridState, { col: number; row: number }> = {
  ...GRID_CONFIG,
  rearm: 'noop',
};

const KEEPER_CONFIG: TimedTileConfig<IdState, string> = {
  keyOf: (state) => state.id,
  duration: GRID_DURATION,
  prune: false,
  rearm: 'noop',
};

describe('GridTimerState', () => {
  it('isStructurallySatisfiedByAGridTimerEntry', () => {
    const entry: GridTimerState = { col: 3, row: 4, elapsed: 0 };
    expect(entry).toEqual({ col: 3, row: 4, elapsed: 0 });
  });
});

describe('timedTileKeysEqual', () => {
  it('compositeStructuralKeys-compareByValue', () => {
    expect(timedTileKeysEqual({ col: 1, row: 2 }, { col: 1, row: 2 })).toBe(true);
    expect(timedTileKeysEqual({ col: 1, row: 2 }, { col: 2, row: 1 })).toBe(false);
  });

  it('primitiveKeys-compareByIdentity', () => {
    expect(timedTileKeysEqual('h1', 'h1')).toBe(true);
    expect(timedTileKeysEqual('h1', 'h2')).toBe(false);
  });
});

describe('armTimedTile', () => {
  it('unarmedKey-appendsAFreshEntryAtElapsedZero', () => {
    const next = armTimedTile([], GRID_CONFIG, { col: 3, row: 4 }, (elapsed) => ({
      col: 3,
      row: 4,
      elapsed,
    }));
    expect(next).toEqual([{ col: 3, row: 4, elapsed: 0 }]);
  });

  it('replacePolicy-restartsAnInProgressEntry', () => {
    const states: GridState[] = [{ col: 1, row: 2, elapsed: 0.4 }];
    const next = armTimedTile(states, GRID_CONFIG, { col: 1, row: 2 }, (elapsed) => ({
      col: 1,
      row: 2,
      elapsed,
    }));
    expect(next).toEqual([{ col: 1, row: 2, elapsed: 0 }]);
  });

  it('noopPolicy-leavesAnInProgressEntryRunning', () => {
    const states: GridState[] = [{ col: 1, row: 2, elapsed: 0.4 }];
    const next = armTimedTile(states, NOOP_CONFIG, { col: 1, row: 2 }, (elapsed) => ({
      col: 1,
      row: 2,
      elapsed,
    }));
    expect(next).toEqual([{ col: 1, row: 2, elapsed: 0.4 }]);
  });

  it('unrelatedKeys-areUnaffected', () => {
    const states: GridState[] = [{ col: 5, row: 5, elapsed: 0.1 }];
    const next = armTimedTile(states, GRID_CONFIG, { col: 1, row: 2 }, (elapsed) => ({
      col: 1,
      row: 2,
      elapsed,
    }));
    expect(next).toEqual([
      { col: 5, row: 5, elapsed: 0.1 },
      { col: 1, row: 2, elapsed: 0 },
    ]);
  });

  it('neverMutatesItsInputArray', () => {
    const states: GridState[] = [{ col: 1, row: 2, elapsed: 0.1 }];
    armTimedTile(states, GRID_CONFIG, { col: 1, row: 2 }, (elapsed) => ({
      col: 1,
      row: 2,
      elapsed,
    }));
    expect(states).toEqual([{ col: 1, row: 2, elapsed: 0.1 }]);
  });
});

describe('advanceTimedTiles', () => {
  it('pruningConfig-advancesByDtAndDropsExpired', () => {
    const next = advanceTimedTiles(
      [
        { col: 0, row: 0, elapsed: 0.2 },
        { col: 1, row: 1, elapsed: GRID_DURATION },
      ],
      0.1,
      GRID_CONFIG,
    );
    expect(next).toEqual([{ col: 0, row: 0, elapsed: expect.closeTo(0.3, 5) }]);
  });

  it('nonPositiveDt-leavesElapsedUnchangedButStillPrunesExpired', () => {
    const next = advanceTimedTiles(
      [
        { col: 0, row: 0, elapsed: 0.2 },
        { col: 1, row: 1, elapsed: GRID_DURATION },
      ],
      0,
      GRID_CONFIG,
    );
    expect(next).toEqual([{ col: 0, row: 0, elapsed: 0.2 }]);
  });

  it('negativeDt-leavesAnUnexpiredEntryUnchanged', () => {
    const next = advanceTimedTiles([{ col: 0, row: 0, elapsed: 0.2 }], -1, GRID_CONFIG);
    expect(next).toEqual([{ col: 0, row: 0, elapsed: 0.2 }]);
  });

  it('nonPruningConfig-neverPrunesEvenLongPastTheDuration', () => {
    const next = advanceTimedTiles([{ id: 'h', elapsed: 100 }], 1000, KEEPER_CONFIG);
    expect(next).toEqual([{ id: 'h', elapsed: 1100 }]);
  });

  it('nonPruningConfig-withNonPositiveDt-keepsElapsedUnchanged', () => {
    const next = advanceTimedTiles([{ id: 'h', elapsed: 5 }], 0, KEEPER_CONFIG);
    expect(next).toEqual([{ id: 'h', elapsed: 5 }]);
  });
});

describe('timedTileStateFor / timedTileHas / timedTileElapsedFor', () => {
  it('absentKey-returnsUndefinedFalseAndZero', () => {
    expect(timedTileStateFor([], { col: 0, row: 0 }, GRID_CONFIG)).toBeUndefined();
    expect(timedTileHas([], { col: 0, row: 0 }, GRID_CONFIG)).toBe(false);
    expect(timedTileElapsedFor([], { col: 0, row: 0 }, GRID_CONFIG)).toBe(0);
  });

  it('presentKey-resolvesTheEntry', () => {
    const states: GridState[] = [{ col: 2, row: 3, elapsed: 0.37 }];
    expect(timedTileStateFor(states, { col: 2, row: 3 }, GRID_CONFIG)).toEqual({
      col: 2,
      row: 3,
      elapsed: 0.37,
    });
    expect(timedTileHas(states, { col: 2, row: 3 }, GRID_CONFIG)).toBe(true);
    expect(timedTileElapsedFor(states, { col: 2, row: 3 }, GRID_CONFIG)).toBe(0.37);
  });
});

describe('timedTileShakeOffsetX', () => {
  it('noWindow-matchesShakeOffsetX', () => {
    for (let t = 0; t <= 2; t += 0.05) {
      expect(timedTileShakeOffsetX(t, 1.5)).toBe(shakeOffsetX(t, 1.5));
    }
  });

  it('withAWindow-returnsZeroAtAndAfterUntil', () => {
    expect(timedTileShakeOffsetX(0.5, 1)).not.toBe(0);
    expect(timedTileShakeOffsetX(0.5, 1.5, { until: 0.5 })).toBe(0);
    expect(timedTileShakeOffsetX(5, 1.5, { until: 0.5 })).toBe(0);
  });

  it('beforeTheWindowEnd-delegatesToTheSharedFormula', () => {
    expect(timedTileShakeOffsetX(0.25, 1.5, { until: 0.5 })).toBe(shakeOffsetX(0.25, 1.5));
  });
});
