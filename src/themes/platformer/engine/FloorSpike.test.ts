import { describe, it, expect } from 'vitest';
import {
  FLOOR_SPIKE_DELAY_SECONDS,
  FLOOR_SPIKE_WARNING_SECONDS,
  FLOOR_SPIKE_FULL_EXTEND_SECONDS,
  FLOOR_SPIKE_RETRACT_SECONDS,
  FLOOR_SPIKE_CYCLE_SECONDS,
  armFloorSpike,
  advanceFloorSpikes,
  floorSpikePhaseAt,
  floorSpikePhaseFor,
  isFloorSpikeArmed,
} from './FloorSpike';

describe('FLOOR_SPIKE_CYCLE_SECONDS', () => {
  it('isTheSumOfEveryPhaseDuration', () => {
    expect(FLOOR_SPIKE_CYCLE_SECONDS).toBe(
      FLOOR_SPIKE_DELAY_SECONDS +
        FLOOR_SPIKE_WARNING_SECONDS +
        FLOOR_SPIKE_FULL_EXTEND_SECONDS +
        FLOOR_SPIKE_RETRACT_SECONDS,
    );
  });
});

describe('armFloorSpike', () => {
  it('unarmedId-addsANewZeroElapsedEntry', () => {
    const next = armFloorSpike([], 'h1');
    expect(next).toEqual([{ id: 'h1', elapsed: 0 }]);
  });

  it('alreadyArmedId-leavesItsElapsedUnchanged', () => {
    const states = [{ id: 'h1', elapsed: 0.4 }];
    const next = armFloorSpike(states, 'h1');
    expect(next).toEqual([{ id: 'h1', elapsed: 0.4 }]);
  });

  it('unrelatedIds-areUnaffected', () => {
    const states = [{ id: 'other', elapsed: 0.1 }];
    const next = armFloorSpike(states, 'h1');
    expect(next).toEqual([{ id: 'other', elapsed: 0.1 }, { id: 'h1', elapsed: 0 }]);
  });
});

describe('advanceFloorSpikes', () => {
  it('inProgress-advancesElapsedByDt', () => {
    const next = advanceFloorSpikes([{ id: 'h1', elapsed: 0.2 }], 0.1);
    expect(next).toEqual([{ id: 'h1', elapsed: expect.closeTo(0.3, 5) }]);
  });

  it('crossingTheFullCycleDuration-dropsTheEntry', () => {
    const next = advanceFloorSpikes(
      [{ id: 'h1', elapsed: FLOOR_SPIKE_CYCLE_SECONDS - 0.01 }],
      0.02,
    );
    expect(next).toEqual([]);
  });

  it('nonPositiveDt-leavesElapsedUnchangedButStillPrunesExpired', () => {
    const next = advanceFloorSpikes(
      [
        { id: 'inProgress', elapsed: 0.2 },
        { id: 'expired', elapsed: FLOOR_SPIKE_CYCLE_SECONDS },
      ],
      0,
    );
    expect(next).toEqual([{ id: 'inProgress', elapsed: 0.2 }]);
  });

  it('advancing-neverMutatesItsInput', () => {
    const states = [{ id: 'h1', elapsed: 0.1 }];
    const snapshot = JSON.parse(JSON.stringify(states));
    advanceFloorSpikes(states, 0.1);
    expect(states).toEqual(snapshot);
  });
});

describe('floorSpikePhaseAt', () => {
  it.each([
    [0, 'delay'],
    [FLOOR_SPIKE_DELAY_SECONDS - 0.001, 'delay'],
    [FLOOR_SPIKE_DELAY_SECONDS, 'warning'],
    [FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS - 0.001, 'warning'],
    [FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS, 'fullExtend'],
    [
      FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS + FLOOR_SPIKE_FULL_EXTEND_SECONDS - 0.001,
      'fullExtend',
    ],
    [
      FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS + FLOOR_SPIKE_FULL_EXTEND_SECONDS,
      'retracting',
    ],
    [FLOOR_SPIKE_CYCLE_SECONDS - 0.001, 'retracting'],
  ] as const)('elapsed %d-mapsTo %s', (elapsed, expected) => {
    expect(floorSpikePhaseAt(elapsed)).toBe(expected);
  });
});

describe('floorSpikePhaseFor', () => {
  it('noEntryForId-returnsAtRest', () => {
    expect(floorSpikePhaseFor([], 'h1')).toBe('atRest');
  });

  it('entryPresent-delegatesToFloorSpikePhaseAt', () => {
    const states = [{ id: 'h1', elapsed: FLOOR_SPIKE_DELAY_SECONDS }];
    expect(floorSpikePhaseFor(states, 'h1')).toBe('warning');
  });
});

describe('isFloorSpikeArmed', () => {
  it('noEntry-returnsFalse', () => {
    expect(isFloorSpikeArmed([], 'h1')).toBe(false);
  });

  it('entryPresent-returnsTrue', () => {
    expect(isFloorSpikeArmed([{ id: 'h1', elapsed: 0 }], 'h1')).toBe(true);
  });
});
