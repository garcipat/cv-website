import {
  playerFrameSource,
  PLAYER_FRAME_SIZE,
  PLAYER_RENDERED_SIZE,
  advancePlayerAnimation,
  IDLE_FRAME_DURATION,
} from './Player';
import type { PlayerState } from './Player';
import { RENDER_SCALE } from '../level/Terrain';

function idlePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 0,
    y: 0,
    vy: 0,
    grounded: true,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    ...overrides,
  };
}

describe('Player', () => {
  it('playerRenderedSize-scalesByRenderScale', () => {
    expect(PLAYER_RENDERED_SIZE).toBe(PLAYER_FRAME_SIZE * RENDER_SCALE);
  });

  it('playerFrameSource-idleFrame0-returnsFirstColumnSource', () => {
    expect(playerFrameSource('idle', 0)).toEqual({ sx: 0, sy: 0 });
  });

  it('playerFrameSource-idleFrame2-returnsThirdColumnSource', () => {
    expect(playerFrameSource('idle', 2)).toEqual({ sx: 2 * PLAYER_FRAME_SIZE, sy: 0 });
  });

  it('playerFrameSource-idleFrame4-wrapsToFirstColumnSource', () => {
    expect(playerFrameSource('idle', 4)).toEqual({ sx: 0, sy: 0 });
  });
});

describe('advancePlayerAnimation', () => {
  it('advancePlayerAnimation-belowFrameDuration-accumulatesTimerWithoutAdvancingFrame', () => {
    const next = advancePlayerAnimation(idlePlayer(), IDLE_FRAME_DURATION / 2);
    expect(next.animTimer).toBeCloseTo(IDLE_FRAME_DURATION / 2);
    expect(next.animFrame).toBe(0);
  });

  it('advancePlayerAnimation-reachesFrameDuration-advancesFrameAndCarriesRemainder', () => {
    const next = advancePlayerAnimation(
      idlePlayer({ animTimer: IDLE_FRAME_DURATION - 0.01 }),
      0.02,
    );
    expect(next.animFrame).toBe(1);
    expect(next.animTimer).toBeCloseTo(0.01);
  });

  it('advancePlayerAnimation-lastFrameReachesDuration-wrapsToFrameZero', () => {
    const next = advancePlayerAnimation(
      idlePlayer({ animFrame: 3, animTimer: IDLE_FRAME_DURATION }),
      0,
    );
    expect(next.animFrame).toBe(0);
  });
});
