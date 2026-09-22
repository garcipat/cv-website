import { describe, it, expect } from 'vitest';
import {
  CRUMBLING_FLOOR_CRACK_SECONDS,
  CRUMBLING_FLOOR_BROKEN_SECONDS,
  CRUMBLING_FLOOR_REFORM_SECONDS,
  CRUMBLING_FLOOR_CYCLE_SECONDS,
  armCrumblingFloor,
  advanceCrumblingFloors,
  crumblingFloorPhaseAt,
  crumblingFloorPhaseFor,
  isCrumblingFloorArmed,
  isCrumblingFloorSolidPhase,
  isCrumblingFloorBroken,
  crumblingFloorCrackRatioAt,
  crumblingFloorCrackRatioFor,
  crumblingFloorReformRatioAt,
  crumblingFloorReformRatioFor,
  crumblingFloorShakeOffsetXAt,
} from './CrumblingFloor';

describe('armCrumblingFloor', () => {
  it('unarmedCell-addsANewZeroElapsedEntry', () => {
    const next = armCrumblingFloor([], 1, 2);
    expect(next).toEqual([{ col: 1, row: 2, elapsed: 0 }]);
  });

  it('alreadyArmedCell-leavesItsElapsedUnchanged', () => {
    const states = [{ col: 1, row: 2, elapsed: 0.4 }];
    const next = armCrumblingFloor(states, 1, 2);
    expect(next).toEqual([{ col: 1, row: 2, elapsed: 0.4 }]);
  });

  it('unrelatedCells-areUnaffected', () => {
    const states = [{ col: 5, row: 5, elapsed: 0.1 }];
    const next = armCrumblingFloor(states, 1, 2);
    expect(next).toEqual([{ col: 5, row: 5, elapsed: 0.1 }, { col: 1, row: 2, elapsed: 0 }]);
  });
});

describe('advanceCrumblingFloors', () => {
  it('runningCycle-addsDtToElapsed', () => {
    const next = advanceCrumblingFloors([{ col: 0, row: 0, elapsed: 0.1 }], 0.2);
    expect(next).toHaveLength(1);
    expect(next[0]?.col).toBe(0);
    expect(next[0]?.row).toBe(0);
    expect(next[0]?.elapsed).toBeCloseTo(0.3, 5);
  });

  it('cycleReachingFullDuration-isDropped', () => {
    const next = advanceCrumblingFloors(
      [{ col: 0, row: 0, elapsed: CRUMBLING_FLOOR_CYCLE_SECONDS - 0.01 }],
      0.02,
    );
    expect(next).toEqual([]);
  });

  it('nonPositiveDt-leavesElapsedUnchangedButStillPrunesExpired', () => {
    const next = advanceCrumblingFloors(
      [
        { col: 0, row: 0, elapsed: 0.5 },
        { col: 1, row: 1, elapsed: CRUMBLING_FLOOR_CYCLE_SECONDS },
      ],
      0,
    );
    expect(next).toEqual([{ col: 0, row: 0, elapsed: 0.5 }]);
  });
});

describe('crumblingFloorPhaseAt', () => {
  it('zeroElapsed-isCracking', () => {
    // Arming and "at rest" are distinguished by state PRESENCE (see
    // crumblingFloorPhaseFor), not by elapsed==0 — an armed entry has
    // already started its cycle the instant it exists.
    expect(crumblingFloorPhaseAt(0)).toBe('cracking');
  });

  it('justBeforeCrackEnds-isStillCracking', () => {
    expect(crumblingFloorPhaseAt(CRUMBLING_FLOOR_CRACK_SECONDS - 0.01)).toBe('cracking');
  });

  it('justAfterCrackEnds-isBroken', () => {
    expect(crumblingFloorPhaseAt(CRUMBLING_FLOOR_CRACK_SECONDS + 0.01)).toBe('broken');
  });

  it('justBeforeBrokenEnds-isStillBroken', () => {
    expect(
      crumblingFloorPhaseAt(CRUMBLING_FLOOR_CRACK_SECONDS + CRUMBLING_FLOOR_BROKEN_SECONDS - 0.01),
    ).toBe('broken');
  });

  it('justAfterBrokenEnds-isReforming', () => {
    expect(
      crumblingFloorPhaseAt(CRUMBLING_FLOOR_CRACK_SECONDS + CRUMBLING_FLOOR_BROKEN_SECONDS + 0.01),
    ).toBe('reforming');
  });

  it('atOrPastFullCycle-isReforming', () => {
    // The timer entry is pruned once elapsed reaches the full cycle
    // (advanceCrumblingFloors), so 'atRest' is never actually reached via
    // this function — it's reported by crumblingFloorPhaseFor when no entry
    // exists at all.
    expect(crumblingFloorPhaseAt(CRUMBLING_FLOOR_CYCLE_SECONDS)).toBe('reforming');
  });
});

describe('crumblingFloorPhaseFor', () => {
  it('noEntryForCell-isAtRest', () => {
    expect(crumblingFloorPhaseFor([], 0, 0)).toBe('atRest');
  });

  it('entryPresent-usesItsElapsedPhase', () => {
    const states = [{ col: 2, row: 3, elapsed: CRUMBLING_FLOOR_CRACK_SECONDS + 0.1 }];
    expect(crumblingFloorPhaseFor(states, 2, 3)).toBe('broken');
  });
});

describe('isCrumblingFloorArmed', () => {
  it('noEntry-isNotArmed', () => {
    expect(isCrumblingFloorArmed([], 0, 0)).toBe(false);
  });

  it('entryPresent-isArmed', () => {
    expect(isCrumblingFloorArmed([{ col: 0, row: 0, elapsed: 0 }], 0, 0)).toBe(true);
  });
});

describe('isCrumblingFloorSolidPhase', () => {
  it.each(['atRest', 'cracking'] as const)('%s-isSolid', (phase) => {
    expect(isCrumblingFloorSolidPhase(phase)).toBe(true);
  });

  it.each(['broken', 'reforming'] as const)('%s-isNotSolid', (phase) => {
    expect(isCrumblingFloorSolidPhase(phase)).toBe(false);
  });
});

describe('isCrumblingFloorBroken', () => {
  it('noEntry-isNotBroken', () => {
    expect(isCrumblingFloorBroken([], 0, 0)).toBe(false);
  });

  it('crackingPhase-isNotBroken', () => {
    const states = [{ col: 0, row: 0, elapsed: 0.1 }];
    expect(isCrumblingFloorBroken(states, 0, 0)).toBe(false);
  });

  it('brokenPhase-isBroken', () => {
    const states = [{ col: 0, row: 0, elapsed: CRUMBLING_FLOOR_CRACK_SECONDS + 0.1 }];
    expect(isCrumblingFloorBroken(states, 0, 0)).toBe(true);
  });

  it('reformingPhase-isBroken', () => {
    const states = [
      { col: 0, row: 0, elapsed: CRUMBLING_FLOOR_CRACK_SECONDS + CRUMBLING_FLOOR_BROKEN_SECONDS + 0.1 },
    ];
    expect(isCrumblingFloorBroken(states, 0, 0)).toBe(true);
  });
});

describe('crumblingFloorCrackRatioAt', () => {
  it('zeroElapsed-isZero', () => {
    expect(crumblingFloorCrackRatioAt(0)).toBe(0);
  });

  it('halfwayThroughCracking-isAroundHalf', () => {
    expect(crumblingFloorCrackRatioAt(CRUMBLING_FLOOR_CRACK_SECONDS / 2)).toBeCloseTo(0.5, 5);
  });

  it('atCrackEnd-isOne', () => {
    expect(crumblingFloorCrackRatioAt(CRUMBLING_FLOOR_CRACK_SECONDS)).toBeCloseTo(1, 5);
  });

  it('pastCracking-staysClampedAtOne', () => {
    expect(crumblingFloorCrackRatioAt(CRUMBLING_FLOOR_CRACK_SECONDS + 10)).toBe(1);
  });
});

describe('crumblingFloorReformRatioAt', () => {
  const reformStart = CRUMBLING_FLOOR_CRACK_SECONDS + CRUMBLING_FLOOR_BROKEN_SECONDS;

  it('beforeReformStarts-isZero', () => {
    expect(crumblingFloorReformRatioAt(reformStart - 0.01)).toBe(0);
  });

  it('atReformStart-isZero', () => {
    expect(crumblingFloorReformRatioAt(reformStart)).toBe(0);
  });

  it('halfwayThroughReform-isAroundHalf', () => {
    expect(crumblingFloorReformRatioAt(reformStart + CRUMBLING_FLOOR_REFORM_SECONDS / 2)).toBeCloseTo(0.5, 5);
  });

  it('atFullCycle-isOne', () => {
    expect(crumblingFloorReformRatioAt(CRUMBLING_FLOOR_CYCLE_SECONDS)).toBeCloseTo(1, 5);
  });
});

describe('crumblingFloorShakeOffsetXAt', () => {
  it('zeroElapsed-isZero', () => {
    expect(crumblingFloorShakeOffsetXAt(0)).toBe(0);
  });

  it('isBoundedByASmallAmplitude', () => {
    for (let t = 0; t < 2; t += 0.05) {
      expect(Math.abs(crumblingFloorShakeOffsetXAt(t))).toBeLessThanOrEqual(1);
    }
  });
});

describe('crumblingFloorCrackRatioFor', () => {
  it('noEntryForCell-isZero', () => {
    expect(crumblingFloorCrackRatioFor([], 0, 0)).toBe(0);
  });

  it('entryPresent-usesItsElapsedRatio', () => {
    const states = [{ col: 2, row: 3, elapsed: CRUMBLING_FLOOR_CRACK_SECONDS / 2 }];
    expect(crumblingFloorCrackRatioFor(states, 2, 3)).toBeCloseTo(0.5, 5);
  });
});

describe('crumblingFloorReformRatioFor', () => {
  it('noEntryForCell-isZero', () => {
    expect(crumblingFloorReformRatioFor([], 0, 0)).toBe(0);
  });

  it('entryPresent-usesItsElapsedRatio', () => {
    const reformStart = CRUMBLING_FLOOR_CRACK_SECONDS + CRUMBLING_FLOOR_BROKEN_SECONDS;
    const states = [{ col: 5, row: 5, elapsed: reformStart + CRUMBLING_FLOOR_REFORM_SECONDS / 2 }];
    expect(crumblingFloorReformRatioFor(states, 5, 5)).toBeCloseTo(0.5, 5);
  });
});
