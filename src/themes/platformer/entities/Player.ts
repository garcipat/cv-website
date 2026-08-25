import { RENDER_SCALE } from '../level/Terrain';

export const PLAYER_FRAME_SIZE = 32;
export const PLAYER_RENDERED_SIZE = PLAYER_FRAME_SIZE * RENDER_SCALE;

export type PlayerAnimState = 'idle';

export interface PlayerState {
  x: number;
  y: number;
  animState: PlayerAnimState;
  animFrame: number;
}

const IDLE_FRAME_COUNT = 4;

export function playerFrameSource(
  animState: PlayerAnimState,
  frame: number,
): { sx: number; sy: number } {
  switch (animState) {
    case 'idle':
      return { sx: (frame % IDLE_FRAME_COUNT) * PLAYER_FRAME_SIZE, sy: 0 };
    default: {
      const _exhaustive: never = animState;
      return _exhaustive;
    }
  }
}
