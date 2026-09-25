import { describe, it, expect } from 'vitest';
import { floorSpike } from './FloorSpike';
import { SIDE_HIT_DAMAGE } from '../Health';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';
import type { HazardPlacement } from '../../level/HazardMapper';
import type { FloorSpikePhase } from './FloorSpike';
import type { HazardTickContext } from './HazardType';
import { parseLevel } from '../../level/LevelParser';

function hazardAt(phase: FloorSpikePhase | undefined): HazardPlacement {
  return { id: 'h1', hazardType: 'floorSpike', facing: 'up', x: 16, y: 32, col: 0, row: 0, floorSpikePhase: phase };
}

describe('floorSpike', () => {
  it('key-isFloorSpike', () => {
    expect(floorSpike.key).toBe('floorSpike');
  });

  it('damage-isOneHalfHeartSameAsTheStaticSpike', () => {
    expect(floorSpike.damage).toBe(SIDE_HIT_DAMAGE);
  });
});

describe('floorSpike.box', () => {
  const BAND = 10; // BAND_NATIVE (5) * RENDER_SCALE (2), same as Spike.ts

  // box() is NOT phase-gated (see Collision.ts's resolveHazardContacts doc
  // comment) — it's the broad-phase geometric rect every phase shares;
  // isContact (below) is what decides whether an overlap actually counts.
  it.each([undefined, 'atRest', 'delay', 'warning', 'retracting', 'fullExtend'] as const)(
    'phase %s-isAlwaysTheBottomBandSameAsAStaticUpFacingSpike',
    (phase) => {
      expect(floorSpike.box(hazardAt(phase))).toEqual({
        x: 16,
        y: 32 + RENDERED_TILE_SIZE - BAND,
        width: RENDERED_TILE_SIZE,
        height: BAND,
      });
    },
  );
});

describe('floorSpike.isContact', () => {
  it.each([undefined, 'atRest', 'delay', 'warning', 'retracting'] as const)(
    'phase %s-isNotAContact',
    (phase) => {
      expect(floorSpike.isContact!(hazardAt(phase), {} as never, {} as never)).toBe(false);
    },
  );

  it('fullExtend-isAContact', () => {
    expect(floorSpike.isContact!(hazardAt('fullExtend'), {} as never, {} as never)).toBe(true);
  });
});


// ---- merged from engine/FloorSpike.test.ts (R-004 US4) ----

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
  floorSpikeExtensionAt,
  floorSpikeExtensionFor,
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

describe('floorSpikeExtensionAt', () => {
  it.each([
    [0, 0],
    [FLOOR_SPIKE_DELAY_SECONDS - 0.001, 0],
    [FLOOR_SPIKE_DELAY_SECONDS, 0],
    [FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS / 2, 0.5],
    [FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS, 1],
    [FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS + FLOOR_SPIKE_FULL_EXTEND_SECONDS - 0.001, 1],
  ] as const)('elapsed %d-isCloseTo %d', (elapsed, expected) => {
    expect(floorSpikeExtensionAt(elapsed)).toBeCloseTo(expected, 5);
  });

  it('midRetract-isHalfway', () => {
    const fullExtendEnd = FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS + FLOOR_SPIKE_FULL_EXTEND_SECONDS;
    expect(floorSpikeExtensionAt(fullExtendEnd + FLOOR_SPIKE_RETRACT_SECONDS / 2)).toBeCloseTo(0.5, 5);
  });

  it('pastTheFullCycle-isZero', () => {
    expect(floorSpikeExtensionAt(FLOOR_SPIKE_CYCLE_SECONDS)).toBeCloseTo(0, 5);
  });
});

describe('floorSpikeExtensionFor', () => {
  it('noEntryForId-isZero', () => {
    expect(floorSpikeExtensionFor([], 'h1')).toBe(0);
  });

  it('entryPresent-delegatesToFloorSpikeExtensionAt', () => {
    const elapsed = FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS;
    expect(floorSpikeExtensionFor([{ id: 'h1', elapsed }], 'h1')).toBeCloseTo(1, 5);
  });
});

describe('floorSpike dispatch hooks (R-007 D3)', () => {
  function hazardCtx(overrides: Partial<HazardTickContext> = {}): HazardTickContext {
    return {
      floorSpikeTimers: [],
      fallingStalactiteTimers: [],
      activeLevel: parseLevel(['.']),
      blockStates: [],
      crumblingFloorTimers: [],
      ...overrides,
    };
  }

  it('knocksBack-isFalse', () => {
    // The floor spike deals half-heart damage with NO knockback.
    expect(floorSpike.knocksBack).toBe(false);
  });

  it('withTickState-mergesPhaseAndExtensionFromItsOwnTimers', () => {
    const placement = hazardAt(undefined);
    const elapsed = FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS;
    const merged = floorSpike.withTickState!(placement, hazardCtx({
      floorSpikeTimers: [{ id: 'h1', elapsed }],
    }));

    // Byte-identical to the phase/extension helpers the inline branch used.
    expect(merged.floorSpikePhase).toBe(floorSpikePhaseFor([{ id: 'h1', elapsed }], 'h1'));
    expect(merged.floorSpikeExtension).toBeCloseTo(floorSpikeExtensionFor([{ id: 'h1', elapsed }], 'h1'), 5);
    expect(merged.floorSpikePhase).toBe('fullExtend');
    expect(merged.floorSpikeExtension).toBeCloseTo(1, 5);
    // Every other field carried through untouched.
    expect({ ...merged, floorSpikePhase: undefined, floorSpikeExtension: undefined }).toEqual(placement);
  });

  it('withTickState-noTimer-readsAtRestAndZeroExtension', () => {
    const merged = floorSpike.withTickState!(hazardAt(undefined), hazardCtx());
    expect(merged.floorSpikePhase).toBe('atRest');
    expect(merged.floorSpikeExtension).toBe(0);
  });

  it('armTriggerRects-unarmedSpike-returnsItsTriggerBand', () => {
    const hazard = hazardAt(undefined);
    expect(floorSpike.armTriggerRects!(hazard, hazardCtx())).toEqual([
      {
        x: hazard.x,
        y: hazard.y + RENDERED_TILE_SIZE - 10,
        width: RENDERED_TILE_SIZE,
        height: 10,
      },
    ]);
  });

  it('armTriggerRects-alreadyArmedSpike-returnsNoRects', () => {
    const hazard = hazardAt(undefined);
    const ctx = hazardCtx({ floorSpikeTimers: [{ id: 'h1', elapsed: 0.1 }] });
    expect(floorSpike.armTriggerRects!(hazard, ctx)).toEqual([]);
  });
});
