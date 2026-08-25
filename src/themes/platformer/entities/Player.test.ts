import { playerFrameSource, PLAYER_FRAME_SIZE, PLAYER_RENDERED_SIZE } from './Player';
import { RENDER_SCALE } from '../level/Terrain';

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
