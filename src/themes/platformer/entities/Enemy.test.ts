import {
  ENEMY_FRAME_SIZE,
  ENEMY_RENDERED_SIZE,
  ENEMY_IDLE_FRAME_COUNT,
  ENEMY_IDLE_FRAME_DURATION,
  enemyFrameSource,
  enemyIdleFrameIndex,
} from './Enemy';

describe('enemyFrameSource', () => {
  it('idleFrameZero-returnsRowZero', () => {
    expect(enemyFrameSource('idle', 0)).toEqual({ sx: 0, sy: 0 });
  });

  it('idleFrameTwo-returnsThirdFrameOffsetOnRowZero', () => {
    expect(enemyFrameSource('idle', 2)).toEqual({ sx: 2 * ENEMY_FRAME_SIZE, sy: 0 });
  });

  it('walkFrameZero-returnsRowOne', () => {
    expect(enemyFrameSource('walk', 0)).toEqual({ sx: 0, sy: ENEMY_FRAME_SIZE });
  });

  it('hitFrameZero-returnsRowTwo', () => {
    expect(enemyFrameSource('hit', 0)).toEqual({ sx: 0, sy: ENEMY_FRAME_SIZE * 2 });
  });

  it('idleFrameEqualToFrameCount-wrapsToFirstFrame', () => {
    expect(enemyFrameSource('idle', ENEMY_IDLE_FRAME_COUNT)).toEqual({ sx: 0, sy: 0 });
  });
});

describe('enemyIdleFrameIndex', () => {
  it('elapsedZero-returnsFrameZero', () => {
    expect(enemyIdleFrameIndex(0)).toBe(0);
  });

  it('elapsedJustBeforeFrameDuration-staysFrameZero', () => {
    expect(enemyIdleFrameIndex(ENEMY_IDLE_FRAME_DURATION - 0.001)).toBe(0);
  });

  it('elapsedAtFrameDuration-advancesToFrameOne', () => {
    expect(enemyIdleFrameIndex(ENEMY_IDLE_FRAME_DURATION)).toBe(1);
  });

  it('elapsedAfterFullCycle-wrapsBackToFrameZero', () => {
    expect(enemyIdleFrameIndex(ENEMY_IDLE_FRAME_DURATION * ENEMY_IDLE_FRAME_COUNT)).toBe(0);
  });

  it('elapsedNegative-clampsToFrameZero', () => {
    expect(enemyIdleFrameIndex(-1)).toBe(0);
  });
});

describe('ENEMY_RENDERED_SIZE', () => {
  it('equals-frameSizeTimesRenderScale', () => {
    expect(ENEMY_RENDERED_SIZE).toBe(ENEMY_FRAME_SIZE * 2);
  });
});
