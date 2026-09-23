import { describe, it, expect } from 'vitest';
import type { Signal } from '@preact/signals-react';
import {
  UNROLL_SECONDS,
  LADDER_STEP_NATIVE_PX,
  STEPS_PER_TILE,
  ladderLandingRow,
  createDeployableLadderState,
  beginDeploy,
  advanceDeployableLadder,
  shaftCellCount,
  totalStepCount,
  revealedStepCount,
  ladderBundleForPlayer,
  applyDeployedLadders,
  ladderBundleInteractable,
} from './DeployableLadder';
import type { DeployableLadderState } from './DeployableLadder';
import { parseLevel } from '../level/LevelParser';
import { RENDERED_TILE_SIZE, tileAt } from '../level/Terrain';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_HIT_REACTION_SECONDS,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';

// A bundle on the top row with two empty rows then solid ground: lands at row 2.
const DROP = parseLevel(['@', '.', '.', 'G']);
// A bundle with solid ground directly beneath it: a zero-length landing.
const ON_SOLID = parseLevel(['@', 'G']);
// A bundle on the level's bottom row: zero-length.
const ON_BOTTOM = parseLevel(['@']);
// A bundle whose first solid tile below is a bridge: the bridge stops it (row 1).
const BRIDGE_STOP = parseLevel(['@', '.', 'B', 'G']);

function basePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: false,
    climbing: false,
    crouching: false,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    isDroppingThroughBridge: false,
    lastGroundedX: 0,
    lastGroundedY: 0,
    prevFeetY: PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING,
    knockbackTimer: 0,
    bounceAscending: false,
    blockContacts: [],
    hitPoints: 6,
    alive: true,
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
    ...overrides,
  };
}

/** The player's y when standing on the tile at `row` (feet on its top edge). */
function standingYOnRow(row: number): number {
  return row * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
}

function stateFor(level = DROP, col = 0, row = 0): DeployableLadderState {
  return createDeployableLadderState(level, col, row);
}

describe('ladderLandingRow', () => {
  it('scanDownToFirstSolid-returnsLastEmptyRowAboveIt', () => {
    expect(ladderLandingRow(DROP, 0, 0)).toBe(2);
  });

  it('solidDirectlyBelow-returnsTheBundleRowItself', () => {
    expect(ladderLandingRow(ON_SOLID, 0, 0)).toBe(0);
  });

  it('bundleOnBottomRow-returnsTheBundleRow', () => {
    expect(ladderLandingRow(ON_BOTTOM, 0, 0)).toBe(0);
  });

  it('bridgeBelow-stopsTheUnrollLikeAnySolidTile', () => {
    expect(ladderLandingRow(BRIDGE_STOP, 0, 0)).toBe(1);
  });

  it('noSolidAnywhere-fillsToTheLevelBottom', () => {
    expect(ladderLandingRow(parseLevel(['@', '.', '.']), 0, 0)).toBe(2);
  });
});

describe('createDeployableLadderState', () => {
  it('buildsARolledStateWithIdAndLandingRow', () => {
    const state = stateFor();
    expect(state).toEqual({
      id: 'ladder-bundle-0-0',
      col: 0,
      row: 0,
      landRow: 2,
      phase: 'rolled',
      elapsed: 0,
    });
  });
});

describe('beginDeploy', () => {
  it('rolledBecomesDeployingWithZeroElapsed', () => {
    expect(beginDeploy(stateFor()).phase).toBe('deploying');
  });

  it('alreadyDeploying-isUnchanged', () => {
    const deploying = beginDeploy(stateFor());
    expect(beginDeploy(deploying)).toBe(deploying);
  });

  it('deployed-isUnchanged', () => {
    const deployed = { ...stateFor(), phase: 'deployed' as const };
    expect(beginDeploy(deployed)).toBe(deployed);
  });
});

describe('advanceDeployableLadder', () => {
  it('accumulatesElapsedWhileDeploying', () => {
    const next = advanceDeployableLadder(beginDeploy(stateFor()), 0.1);
    expect(next.phase).toBe('deploying');
    expect(next.elapsed).toBeCloseTo(0.1);
  });

  it('completesAtUnrollSecondsAndCapsElapsed', () => {
    let state = beginDeploy(stateFor());
    state = advanceDeployableLadder(state, UNROLL_SECONDS);
    expect(state.phase).toBe('deployed');
    expect(state.elapsed).toBe(UNROLL_SECONDS);
  });

  it('overshootingStillClampsToUnrollSeconds', () => {
    const state = advanceDeployableLadder(beginDeploy(stateFor()), UNROLL_SECONDS * 5);
    expect(state.phase).toBe('deployed');
    expect(state.elapsed).toBe(UNROLL_SECONDS);
  });

  it('nonPositiveDt-isANoOp', () => {
    const deploying = beginDeploy(stateFor());
    expect(advanceDeployableLadder(deploying, 0)).toBe(deploying);
    expect(advanceDeployableLadder(deploying, -1)).toBe(deploying);
  });

  it('rolledOrDeployed-isUnchanged', () => {
    const rolled = stateFor();
    expect(advanceDeployableLadder(rolled, 0.1)).toBe(rolled);
    const deployed = { ...rolled, phase: 'deployed' as const };
    expect(advanceDeployableLadder(deployed, 0.1)).toBe(deployed);
  });

  it('isStrictlyOneWay-neverReturnsToRolledOrDeploying', () => {
    const deployed = advanceDeployableLadder(beginDeploy(stateFor()), UNROLL_SECONDS);
    expect(advanceDeployableLadder(deployed, UNROLL_SECONDS).phase).toBe('deployed');
  });
});

describe('shaftCellCount / totalStepCount', () => {
  it('countsRungCellsBelowTheBundle', () => {
    expect(shaftCellCount(stateFor())).toBe(2);
    expect(shaftCellCount(stateFor(ON_SOLID))).toBe(0);
  });

  it('totalStepsIsTwoPerCellBelow', () => {
    expect(STEPS_PER_TILE).toBe(2);
    expect(LADDER_STEP_NATIVE_PX).toBe(8);
    expect(totalStepCount(stateFor())).toBe(4);
    expect(totalStepCount(stateFor(ON_SOLID))).toBe(0);
  });
});

describe('revealedStepCount', () => {
  it('rolledRevealsNothing', () => {
    expect(revealedStepCount(stateFor())).toBe(0);
  });

  it('deployedRevealsEveryStep', () => {
    const deployed = { ...stateFor(), phase: 'deployed' as const };
    expect(revealedStepCount(deployed)).toBe(totalStepCount(stateFor()));
  });

  it('deployingIsProportionalAndNeverExceedsTotal', () => {
    const half = { ...beginDeploy(stateFor()), elapsed: UNROLL_SECONDS / 2 };
    expect(revealedStepCount(half)).toBe(2);
    const all = { ...beginDeploy(stateFor()), elapsed: UNROLL_SECONDS };
    expect(revealedStepCount(all)).toBe(4);
  });

  it('zeroLengthShaftRevealsNothingWhileDeploying', () => {
    const state = { ...beginDeploy(stateFor(ON_SOLID)), elapsed: UNROLL_SECONDS / 2 };
    expect(revealedStepCount(state)).toBe(0);
  });
});

describe('ladderBundleForPlayer', () => {
  it('standingOnTheBundle-matches', () => {
    const states = [stateFor()];
    const player = basePlayer({ grounded: true, x: 0, y: standingYOnRow(0) });
    expect(ladderBundleForPlayer(DROP, states, player)?.id).toBe('ladder-bundle-0-0');
  });

  it('standingInTheBundlesOwnCell-matches', () => {
    const level = parseLevel(['@', 'G']);
    const states = [stateFor(level)];
    const player = basePlayer({ grounded: true, x: 0, y: standingYOnRow(1) });
    expect(ladderBundleForPlayer(level, states, player)?.id).toBe('ladder-bundle-0-0');
  });

  it('airborne-doesNotMatch', () => {
    const player = basePlayer({ grounded: false, x: 0, y: standingYOnRow(0) });
    expect(ladderBundleForPlayer(DROP, [stateFor()], player)).toBeNull();
  });

  it('offTheBundlesColumn-doesNotMatch', () => {
    const player = basePlayer({ grounded: true, x: RENDERED_TILE_SIZE * 5, y: standingYOnRow(0) });
    expect(ladderBundleForPlayer(DROP, [stateFor()], player)).toBeNull();
  });

  it('moreThanOneRowAway-doesNotMatch', () => {
    const player = basePlayer({ grounded: true, x: 0, y: standingYOnRow(3) });
    expect(ladderBundleForPlayer(DROP, [stateFor()], player)).toBeNull();
  });

  it('neverReturnsANonRolledBundle', () => {
    const deploying = beginDeploy(stateFor());
    const player = basePlayer({ grounded: true, x: 0, y: standingYOnRow(0) });
    expect(ladderBundleForPlayer(DROP, [deploying], player)).toBeNull();
  });
});

describe('applyDeployedLadders', () => {
  it('nothingDeployed-returnsTheSameLevelObject', () => {
    expect(applyDeployedLadders(DROP, [stateFor()])).toBe(DROP);
    expect(applyDeployedLadders(DROP, [])).toBe(DROP);
  });

  it('deployedWritesRopeLadderFromBundleRowToLandingRow', () => {
    const deployed = { ...stateFor(), phase: 'deployed' as const };
    const effective = applyDeployedLadders(DROP, [deployed]);
    expect(tileAt(effective, 0, 0)).toBe('ropeLadder');
    expect(tileAt(effective, 0, 1)).toBe('ropeLadder');
    expect(tileAt(effective, 0, 2)).toBe('ropeLadder');
    // The solid landing row is untouched.
    expect(tileAt(effective, 0, 3)).toBe('groundGrass');
  });

  it('zeroLengthDeployedWritesOnlyTheBundleCell', () => {
    const deployed = { ...stateFor(ON_SOLID), phase: 'deployed' as const };
    const effective = applyDeployedLadders(ON_SOLID, [deployed]);
    expect(tileAt(effective, 0, 0)).toBe('ropeLadder');
    expect(tileAt(effective, 0, 1)).toBe('groundGrass');
  });

  it('doesNotMutateTheInputLevel', () => {
    const deployed = { ...stateFor(), phase: 'deployed' as const };
    applyDeployedLadders(DROP, [deployed]);
    expect(tileAt(DROP, 0, 0)).toBe('ladderBundle');
  });

  it('twoDeployedBundlesBothWriteTheirOwnColumns', () => {
    const level = parseLevel(['@.@', 'G.G']);
    const left = { ...createDeployableLadderState(level, 0, 0), phase: 'deployed' as const };
    const right = { ...createDeployableLadderState(level, 2, 0), phase: 'deployed' as const };
    const effective = applyDeployedLadders(level, [left, right]);
    expect(tileAt(effective, 0, 0)).toBe('ropeLadder');
    expect(tileAt(effective, 2, 0)).toBe('ropeLadder');
    expect(tileAt(effective, 1, 0)).toBe('empty');
  });
});

describe('ladderBundleInteractable-groundedNearRolledBundle-candidateIsBundleId', () => {
  it('wraps ladderBundleForPlayer/beginDeploy as an Interactable', () => {
    const states: Signal<DeployableLadderState[]> = { value: [stateFor()] } as Signal<
      DeployableLadderState[]
    >;
    const player = basePlayer({ grounded: true, x: 0, y: standingYOnRow(0) });

    const interactable = ladderBundleInteractable(states, DROP, player);

    expect(interactable.kind).toBe('ladderBundle');
    expect(interactable.findCandidate()).toBe(states.value[0].id);
    interactable.applyInteract(states.value[0].id);
    expect(states.value[0].phase).toBe('deploying');
  });

  it('noRolledBundleNearby-findCandidateReturnsNull', () => {
    const states: Signal<DeployableLadderState[]> = { value: [stateFor()] } as Signal<
      DeployableLadderState[]
    >;
    const player = basePlayer({ grounded: false, x: 0, y: standingYOnRow(0) });

    const interactable = ladderBundleInteractable(states, DROP, player);

    expect(interactable.findCandidate()).toBeNull();
  });
});
