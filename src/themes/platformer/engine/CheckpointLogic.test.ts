import { hasSolidGroundBelow, resolveCheckpointContacts } from './CheckpointLogic';
import { parseLevel } from '../level/LevelParser';
import { tileToPixel, isSolid, tileAt } from '../level/Terrain';
import { placeCheckpoints } from '../level/CheckpointMapper';
import type { CheckpointPlacement } from '../level/CheckpointMapper';
import { toCheckpointState, activateCheckpoint } from '../entities/Checkpoint';
import type { CheckpointState } from '../entities/Checkpoint';
import type { PlayerState } from '../entities/Player';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_HIT_REACTION_SECONDS,
} from '../entities/Player';

function makePlayer(x: number, y: number): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: true,
    climbing: false,
    crouching: false,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    prevFeetY: y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    blockContacts: [],
    hitPoints: 6,
    alive: true,
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
  };
}

function placementsFor(markers: readonly { col: number; row: number }[]): CheckpointPlacement[] {
  return placeCheckpoints(markers);
}

function statesFor(markers: readonly { col: number; row: number }[]): CheckpointState[] {
  return placementsFor(markers).map(toCheckpointState);
}

/** A player standing exactly on a marker's cell — its hitbox (24x38) always
 *  overlaps the cell's 32x32 box. */
function playerOn(col: number, row: number): PlayerState {
  const { x, y } = tileToPixel(col, row);
  return makePlayer(x, y);
}

describe('hasSolidGroundBelow', () => {
  it('equals-isSolid-of-the-cell-directly-beneath', () => {
    const level = parseLevel(['C.', 'G.']);
    expect(hasSolidGroundBelow(level, 0, 0)).toBe(isSolid(tileAt(level, 0, 1)));
    expect(hasSolidGroundBelow(level, 0, 0)).toBe(true);
    expect(hasSolidGroundBelow(level, 1, 0)).toBe(false);
  });

  it('bottomRow-hasNothingBelowIt', () => {
    const level = parseLevel(['GG']);
    expect(hasSolidGroundBelow(level, 0, 0)).toBe(false);
  });
});

describe('resolveCheckpointContacts — ground gating (FR-004)', () => {
  it('dormantOverlapWithSolidGroundBelow-raisesItAndReportsIt', () => {
    const level = parseLevel(['C', 'G']);
    const placements = placementsFor([{ col: 0, row: 0 }]);
    const result = resolveCheckpointContacts(
      playerOn(0, 0),
      placements,
      statesFor([{ col: 0, row: 0 }]),
      level,
      null,
      5,
      true,
    );

    expect(result.activatedIds).toEqual(['checkpoint-0-0']);
    expect(result.activeId).toBe('checkpoint-0-0');
    expect(result.states[0]).toMatchObject({ activated: true, activatedAt: 5 });
  });

  it('dormantOverlapWithNoSolidGroundBelow-isSkippedEntirely', () => {
    const level = parseLevel(['C', '.', '.']);
    const result = resolveCheckpointContacts(
      playerOn(0, 0),
      placementsFor([{ col: 0, row: 0 }]),
      statesFor([{ col: 0, row: 0 }]),
      level,
      null,
      5,
      true,
    );

    expect(result.activatedIds).toEqual([]);
    expect(result.activeId).toBeNull();
    expect(result.states[0].activated).toBe(false);
  });

  it('noOverlap-returnsThePreviousActiveIdAndUnchangedStates', () => {
    const level = parseLevel(['C.', 'GG']);
    const states = statesFor([{ col: 0, row: 0 }]);
    const result = resolveCheckpointContacts(
      makePlayer(1000, 0),
      placementsFor([{ col: 0, row: 0 }]),
      states,
      level,
      'checkpoint-9-9',
      5,
      true,
    );

    expect(result.activatedIds).toEqual([]);
    expect(result.activeId).toBe('checkpoint-9-9');
    expect(result.states).toEqual(states);
  });

  it('noInteractPress-overlappingDormantCheckpointDoesNothing', () => {
    const level = parseLevel(['C', 'G']);
    const states = statesFor([{ col: 0, row: 0 }]);
    const result = resolveCheckpointContacts(
      playerOn(0, 0),
      placementsFor([{ col: 0, row: 0 }]),
      states,
      level,
      null,
      5,
      false,
    );

    expect(result.activatedIds).toEqual([]);
    expect(result.activeId).toBeNull();
    expect(result.states).toEqual(states);
    expect(result.states[0].activated).toBe(false);
  });
});

describe('resolveCheckpointContacts — reading order and purity (FR-009)', () => {
  it('twoDormantOverlapsInOneTick-raiseBothAndPickTheFirstInReadingOrder', () => {
    const level = parseLevel(['CC', 'GG']);
    const result = resolveCheckpointContacts(
      playerOn(0, 0),
      placementsFor([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
      ]),
      statesFor([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
      ]),
      level,
      null,
      7,
      true,
    );

    expect(result.activatedIds).toEqual(['checkpoint-0-0', 'checkpoint-1-0']);
    expect(result.activeId).toBe('checkpoint-0-0');
    expect(result.states.every((s) => s.activated && s.activatedAt === 7)).toBe(true);
  });

  it('neverMutatesItsInputs', () => {
    const level = parseLevel(['C', 'G']);
    const states = statesFor([{ col: 0, row: 0 }]);
    const snapshot = states.map((s) => ({ ...s }));

    const result = resolveCheckpointContacts(
      playerOn(0, 0),
      placementsFor([{ col: 0, row: 0 }]),
      states,
      level,
      null,
      3,
      true,
    );

    expect(states).toEqual(snapshot);
    expect(result.states).not.toBe(states);
  });
});

describe('resolveCheckpointContacts — already-raised behaviour (FR-006/FR-008)', () => {
  it('alreadyRaisedOverlap-doesNotReplayAndIsNotInActivatedIds', () => {
    const level = parseLevel(['C', 'G']);
    const raised = [activateCheckpoint(toCheckpointState(placementsFor([{ col: 0, row: 0 }])[0]), 1)];

    const result = resolveCheckpointContacts(
      playerOn(0, 0),
      placementsFor([{ col: 0, row: 0 }]),
      raised,
      level,
      null,
      9,
      true,
    );

    expect(result.activatedIds).toEqual([]);
    expect(result.activeId).toBe('checkpoint-0-0');
    expect(result.states[0].activatedAt).toBe(1);
  });

  it('dormantAndRaisedOverlapsInOneTick-raiseBothAndPickTheDormantOne', () => {
    const level = parseLevel(['CC', 'GG']);
    const placements = placementsFor([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ]);
    const states = [activateCheckpoint(toCheckpointState(placements[0]), 1), toCheckpointState(placements[1])];

    const result = resolveCheckpointContacts(playerOn(0, 0), placements, states, level, null, 7, true);

    expect(result.activatedIds).toEqual(['checkpoint-1-0']);
    expect(result.activeId).toBe('checkpoint-1-0');
    expect(result.states[0].activatedAt).toBe(1);
    expect(result.states[1]).toMatchObject({ activated: true, activatedAt: 7 });
  });

  it('reEnteringAnAlreadyRaisedNonActiveCheckpoint-movesTheActiveIdWithNoActivation', () => {
    const level = parseLevel(['CC', 'GG']);
    const placements = placementsFor([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ]);
    const states = [
      activateCheckpoint(toCheckpointState(placements[0]), 1),
      activateCheckpoint(toCheckpointState(placements[1]), 2),
    ];

    const result = resolveCheckpointContacts(playerOn(1, 0), placements, states, level, 'checkpoint-0-0', 9, true);

    expect(result.activatedIds).toEqual([]);
    expect(result.activeId).toBe('checkpoint-1-0');
  });
});
