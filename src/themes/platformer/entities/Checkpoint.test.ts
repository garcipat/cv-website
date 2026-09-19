import {
  CHECKPOINT_FRAME_COUNT,
  CHECKPOINT_FRAME_WIDTH,
  CHECKPOINT_FRAME_HEIGHT,
  CHECKPOINT_RAISED_FRAME,
  CHECKPOINT_RAISE_DURATION_SECONDS,
  CHECKPOINT_FRAME_STEP_SECONDS,
  CHECKPOINT_FLAG_SHEET,
  toCheckpointState,
  checkpointBox,
  checkpointFrameIndex,
  activateCheckpoint,
  checkpointEffectAnchor,
} from './Checkpoint';
import type { CheckpointState } from './Checkpoint';
import type { CheckpointPlacement } from '../level/CheckpointMapper';
import { RENDERED_TILE_SIZE } from '../level/Terrain';

function placement(overrides: Partial<CheckpointPlacement> = {}): CheckpointPlacement {
  return { id: 'checkpoint-1-2', col: 1, row: 2, x: 32, y: 64, ...overrides };
}

describe('checkpoint constants', () => {
  it('describesTheFourFrameRaiseStrip', () => {
    expect(CHECKPOINT_FRAME_COUNT).toBe(4);
    expect(CHECKPOINT_FRAME_WIDTH).toBe(16);
    expect(CHECKPOINT_FRAME_HEIGHT).toBe(24);
    expect(CHECKPOINT_RAISED_FRAME).toBe(3);
    expect(CHECKPOINT_RAISE_DURATION_SECONDS).toBe(0.4);
  });

  it('frameStepSpreadsEveryFrameEvenlyAcrossTheRaise', () => {
    expect(CHECKPOINT_FRAME_STEP_SECONDS).toBe(
      CHECKPOINT_RAISE_DURATION_SECONDS / (CHECKPOINT_FRAME_COUNT - 1),
    );
  });

  it('flagSheet-metadataMatchesTheShippedStrip', () => {
    expect(CHECKPOINT_FLAG_SHEET).toEqual({
      src: '/sprites/checkpoint-flag-strip.png',
      frameWidth: CHECKPOINT_FRAME_WIDTH,
      frameHeight: CHECKPOINT_FRAME_HEIGHT,
      columns: CHECKPOINT_FRAME_COUNT,
    });
  });
});

describe('toCheckpointState', () => {
  it('alwaysYieldsADormantStateWithNoActivationTime', () => {
    const state = toCheckpointState(placement());
    expect(state).toEqual({ ...placement(), activated: false, activatedAt: null });
  });

  it('preservesThePlacementsIdCellAndPixels', () => {
    const state = toCheckpointState(placement({ id: 'checkpoint-5-6', col: 5, row: 6, x: 10, y: 20 }));
    expect(state.id).toBe('checkpoint-5-6');
    expect(state.col).toBe(5);
    expect(state.row).toBe(6);
    expect(state.x).toBe(10);
    expect(state.y).toBe(20);
  });
});

describe('checkpointBox', () => {
  it('spansExactlyOneRenderedTileAtThePlacementsTopLeft', () => {
    const state = toCheckpointState(placement({ x: 32, y: 64 }));
    expect(checkpointBox(state)).toEqual({
      x: 32,
      y: 64,
      width: RENDERED_TILE_SIZE,
      height: RENDERED_TILE_SIZE,
    });
  });
});

describe('checkpointFrameIndex', () => {
  it('dormantState-returnsTheDormantFrameRegardlessOfClock', () => {
    const state = toCheckpointState(placement());
    expect(checkpointFrameIndex(state, 0)).toBe(0);
    expect(checkpointFrameIndex(state, 100)).toBe(0);
  });

  it('activatedState-returnsFrameZeroAtTheActivationInstant', () => {
    const state = activateCheckpoint(toCheckpointState(placement()), 10);
    expect(checkpointFrameIndex(state, 10)).toBe(0);
  });

  it('activatedState-advancesOneFramePerFrameStep', () => {
    const state = activateCheckpoint(toCheckpointState(placement()), 0);
    expect(checkpointFrameIndex(state, CHECKPOINT_FRAME_STEP_SECONDS)).toBe(1);
    expect(checkpointFrameIndex(state, CHECKPOINT_FRAME_STEP_SECONDS * 2)).toBe(2);
  });

  it('activatedState-holdsOnTheRaisedFrameAtAndAfterTheRaiseDuration', () => {
    const state = activateCheckpoint(toCheckpointState(placement()), 0);
    expect(checkpointFrameIndex(state, CHECKPOINT_RAISE_DURATION_SECONDS)).toBe(
      CHECKPOINT_RAISED_FRAME,
    );
    expect(checkpointFrameIndex(state, CHECKPOINT_RAISE_DURATION_SECONDS + 5)).toBe(
      CHECKPOINT_RAISED_FRAME,
    );
  });

  it('clockBeforeActivation-clampsToTheDormantFrame', () => {
    const state = activateCheckpoint(toCheckpointState(placement()), 10);
    expect(checkpointFrameIndex(state, 9)).toBe(0);
  });
});

describe('activateCheckpoint', () => {
  it('dormantState-raisesItAndStampsTheGivenClock', () => {
    const state = activateCheckpoint(toCheckpointState(placement()), 12.5);
    expect(state.activated).toBe(true);
    expect(state.activatedAt).toBe(12.5);
  });

  it('alreadyActivatedState-isANoOpReturningTheSameReference', () => {
    const activated = activateCheckpoint(toCheckpointState(placement()), 3);
    expect(activateCheckpoint(activated, 99)).toBe(activated);
  });

  it('doesNotMutateItsInput', () => {
    const state = toCheckpointState(placement());
    activateCheckpoint(state, 1);
    expect(state.activated).toBe(false);
    expect(state.activatedAt).toBeNull();
  });
});

describe('checkpointEffectAnchor', () => {
  it('returnsTheTileCentreWithUnitScale', () => {
    const state: CheckpointState = toCheckpointState(placement({ x: 32, y: 64 }));
    expect(checkpointEffectAnchor(state)).toEqual({
      x: 32 + RENDERED_TILE_SIZE / 2,
      y: 64 + RENDERED_TILE_SIZE / 2,
      scale: 1,
    });
  });
});
