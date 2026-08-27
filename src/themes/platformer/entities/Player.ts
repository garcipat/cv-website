import { RENDER_SCALE } from '../level/Terrain';

export const PLAYER_FRAME_SIZE = 32;
export const PLAYER_RENDERED_SIZE = PLAYER_FRAME_SIZE * RENDER_SCALE;

/** Transparent rows below the knight's feet inside each 32px native frame. */
export const PLAYER_FOOT_PADDING = 4 * RENDER_SCALE; // 8 rendered px

/** Transparent rows above the knight's head inside each 32px native frame. */
export const PLAYER_HEAD_PADDING = 9 * RENDER_SCALE; // 18 rendered px

/**
 * Transparent margin on either side of the knight's silhouette inside each
 * 32px native frame (the placeholder sprite's art is ~13px wide, centered in
 * the 32px cell). Used by Physics.ts to define a narrower, centered
 * collision hitbox within the full PLAYER_RENDERED_SIZE render slot — not
 * used for any rendering-position shift; the sprite is always drawn at a
 * fixed position (see Renderer.ts's drawPlayer), only its artwork mirrors
 * for facing direction.
 */
export const PLAYER_SIDE_PADDING = 10 * RENDER_SCALE; // 20 rendered px

export type PlayerAnimState = 'idle' | 'walk' | 'jump';
export type PlayerFacing = 'left' | 'right';

export interface PlayerState {
  x: number;
  y: number;
  /** Horizontal velocity in px/s. Positive is rightward. */
  vx: number;
  /** Vertical velocity in px/s. Positive is downward. */
  vy: number;
  /** Direction the sprite is drawn facing. Only horizontal movement changes it. */
  facing: PlayerFacing;
  /** Whether the player is currently resting on a solid tile. */
  grounded: boolean;
  /** Whether the player is currently dropping through a `bridge` tile
   *  they deliberately fell through (Down held while resting on one) —
   *  see Physics.ts's ground-collision branch. Cleared once they land on
   *  real solid ground again. */
  isDroppingThroughBridge: boolean;
  animState: PlayerAnimState;
  animFrame: number;
  /** Seconds accumulated toward the next animation frame advance. */
  animTimer: number;
}

/**
 * Per-state animation timing and sprite-sheet row, keyed by `PlayerAnimState`.
 * Centralizing this as a lookup table (instead of a `switch` per function)
 * means adding a future state (e.g. `'jump'` in step 6) only requires one new
 * entry here, not new branches in both `playerFrameSource` and
 * `advancePlayerAnimation`.
 */
const ANIM_CONFIG: Record<
  PlayerAnimState,
  { frameCount: number; frameDuration: number; sy: number }
> = {
  idle: { frameCount: 4, frameDuration: 0.15, sy: 0 },
  walk: { frameCount: 8, frameDuration: 0.08, sy: PLAYER_FRAME_SIZE * 2 },
  jump: { frameCount: 7, frameDuration: 0.062, sy: 0 },
};

/** Seconds each idle frame is held before advancing to the next. */
export const IDLE_FRAME_DURATION = ANIM_CONFIG.idle.frameDuration;

export function playerFrameSource(
  animState: PlayerAnimState,
  frame: number,
): { sx: number; sy: number } {
  const { frameCount, sy } = ANIM_CONFIG[animState];
  return { sx: (frame % frameCount) * PLAYER_FRAME_SIZE, sy };
}

/**
 * `knight2.png` uses 128px frames (4x `PLAYER_FRAME_SIZE`) — the placeholder
 * `knight.png` sheet has no jump row, so jump/fall use this separate,
 * higher-resolution sheet and their own frame size instead of extending
 * `playerFrameSource`.
 */
export const JUMP_FRAME_SIZE = 128;
const JUMP_ROW_FRAME_COUNT = 7;
const JUMP_ROW_SY = 0;
const FALL_ROW_FRAME_COUNT = 4;
const FALL_ROW_SY = 161;

/**
 * Frame source for the jump/fall animation, keyed by the player's vertical
 * velocity rather than a separate `animState` value (FR-032 keeps
 * `animState` limited to `'idle' | 'walk' | 'jump'`): rising (`vy < 0`) uses
 * the 7-frame JUMP row, falling or at the arc's apex (`vy >= 0`) uses the
 * 4-frame FALL row.
 */
export function jumpFrameSource(vy: number, frame: number): { sx: number; sy: number } {
  if (vy < 0) {
    return { sx: (frame % JUMP_ROW_FRAME_COUNT) * JUMP_FRAME_SIZE, sy: JUMP_ROW_SY };
  }
  return { sx: (frame % FALL_ROW_FRAME_COUNT) * JUMP_FRAME_SIZE, sy: FALL_ROW_SY };
}

/** Advances the player's animation timer/frame by `dt` seconds. */
export function advancePlayerAnimation(player: PlayerState, dt: number): PlayerState {
  const { frameCount, frameDuration } = ANIM_CONFIG[player.animState];
  const animTimer = player.animTimer + dt;
  if (animTimer < frameDuration) {
    return { ...player, animTimer };
  }
  return {
    ...player,
    animTimer: animTimer - frameDuration,
    animFrame: (player.animFrame + 1) % frameCount,
  };
}

/**
 * Switches `animState` between `idle`/`walk`/`jump`, resetting the animation
 * frame/timer whenever the state actually changes so a leftover frame index
 * from the previous state's cycle never carries over. Airborne (`!grounded`)
 * takes priority over horizontal velocity — the character can be moving
 * horizontally while jumping, but it still reads as `'jump'`, not `'walk'`.
 */
export function updatePlayerAnimState(player: PlayerState): PlayerState {
  const animState: PlayerAnimState = !player.grounded
    ? 'jump'
    : player.vx !== 0
      ? 'walk'
      : 'idle';
  if (animState === player.animState) return player;
  return { ...player, animState, animFrame: 0, animTimer: 0 };
}
