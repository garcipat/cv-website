import { RENDER_SCALE } from '../level/Terrain';

export const PLAYER_FRAME_SIZE = 32;
export const PLAYER_RENDERED_SIZE = PLAYER_FRAME_SIZE * RENDER_SCALE;

/** Transparent rows below the knight's feet inside each 32px native frame. */
export const PLAYER_FOOT_PADDING = 4 * RENDER_SCALE; // 8 rendered px

export type PlayerAnimState = 'idle';

export interface PlayerState {
  x: number;
  y: number;
  /** Vertical velocity in px/s. Positive is downward. */
  vy: number;
  /** Whether the player is currently resting on a solid tile. */
  grounded: boolean;
  animState: PlayerAnimState;
  animFrame: number;
  /** Seconds accumulated toward the next animation frame advance. */
  animTimer: number;
}

const IDLE_FRAME_COUNT = 4;

/** Seconds each idle frame is held before advancing to the next. */
export const IDLE_FRAME_DURATION = 0.15;

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

/** Advances the player's animation timer/frame by `dt` seconds. */
export function advancePlayerAnimation(player: PlayerState, dt: number): PlayerState {
  switch (player.animState) {
    case 'idle': {
      const animTimer = player.animTimer + dt;
      if (animTimer < IDLE_FRAME_DURATION) {
        return { ...player, animTimer };
      }
      return {
        ...player,
        animTimer: animTimer - IDLE_FRAME_DURATION,
        animFrame: (player.animFrame + 1) % IDLE_FRAME_COUNT,
      };
    }
    default: {
      const _exhaustive: never = player.animState;
      return _exhaustive;
    }
  }
}
