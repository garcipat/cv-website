import { RENDER_SCALE } from '../level/Terrain';

export const PLAYER_FRAME_SIZE = 32;
export const PLAYER_RENDERED_SIZE = PLAYER_FRAME_SIZE * RENDER_SCALE;

/** Transparent rows below the knight's feet inside each 32px native frame. */
export const PLAYER_FOOT_PADDING = 4 * RENDER_SCALE; // 8 rendered px

/** Transparent rows above the knight's head inside each 32px native frame. */
export const PLAYER_HEAD_PADDING = 9 * RENDER_SCALE; // 18 rendered px

/**
 * Vertical offset from the player's render-slot top (`y`) to the visual
 * center of the knight's actual silhouette — the midpoint between
 * PLAYER_HEAD_PADDING (transparent rows above the head) and
 * PLAYER_FOOT_PADDING (transparent rows below the feet), not simply half of
 * PLAYER_RENDERED_SIZE (which includes that transparent padding and reads a
 * few pixels too high). Used to center the death/respawn iris transition on
 * the character rather than on its full transparent render slot.
 */
export const PLAYER_VISUAL_CENTER_Y_OFFSET =
  PLAYER_HEAD_PADDING + (PLAYER_RENDERED_SIZE - PLAYER_HEAD_PADDING - PLAYER_FOOT_PADDING) / 2;

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
  /** x/y as of the most recent frame where the hitbox's ENTIRE footprint
   *  rested on solid ground (Physics.ts's `fullyGrounded`) — deliberately
   *  stricter than the `grounded` field above, which stays lenient (any one
   *  spanned column solid counts) so the character doesn't feel like it
   *  falls the instant it's not 100% supported on a ledge. That leniency
   *  means `grounded` alone can be true while mostly hanging over a gap;
   *  using it here would let a pit-fall recovery visibly float the
   *  character over the pit it just fell into. Frozen the instant the
   *  footprint stops being fully supported (falls off an edge, jumps).
   *  Used by Physics.ts's resolvePitFall to reposition the character after a
   *  pit fall to "the last solid ground position before the fall" rather
   *  than a spawn/checkpoint (that's roadmap step 10's job). */
  lastGroundedX: number;
  lastGroundedY: number;
  animState: PlayerAnimState;
  animFrame: number;
  /** Seconds accumulated toward the next animation frame advance. */
  animTimer: number;
  /** Seconds remaining of post-hit invincibility (roadmap step 19) — 0 means
   *  not invincible. Gates `checkEnemySideCollisions` from registering a new
   *  hit (see Collision.ts) and drives the render blink (PlatformerPage.tsx);
   *  ticked down once per frame by `tickInvincibility` below. Unrelated to
   *  `knockbackTimer` — see this plan's "Key design decisions" for why they're
   *  separate. */
  invincibleTimer: number;
  /** Seconds remaining of forced knockback velocity — 0 means normal
   *  input-driven movement. While positive, Physics.ts's `stepPlayerPhysics`
   *  ignores held movement keys and holds the knockback `vx` instead; much
   *  shorter than `invincibleTimer` so the player regains full control well
   *  before invincibility (and its blink) ends. Ticked down inside
   *  `stepPlayerPhysics` itself, not here — see this plan's "Key design
   *  decisions". */
  knockbackTimer: number;
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

/**
 * Ticks down `invincibleTimer` by `dt` seconds, clamped at 0 — a no-op
 * (returns the same reference) once it's already 0. Called once per game-loop
 * tick (PlatformerPage.tsx); unlike `knockbackTimer` (decremented inside
 * `stepPlayerPhysics`, since that function is the one that reads it),
 * invincibility isn't consumed by physics at all, only by the side-hit
 * collision gate and the render blink.
 */
export function tickInvincibility(player: PlayerState, dt: number): PlayerState {
  if (player.invincibleTimer <= 0) return player;
  return { ...player, invincibleTimer: Math.max(0, player.invincibleTimer - dt) };
}

/**
 * Applies a side-hit's knockback + invincibility in one step (roadmap step
 * 19): sets `vx` to `direction * knockbackVx` (facing to match, so the
 * character visually faces away from whatever hit it), starts
 * `knockbackTimer` (how long `stepPlayerPhysics` overrides input-driven
 * horizontal movement) and `invincibleTimer` (how long further hits are
 * ignored and the render blink plays) independently — see this plan's "Key
 * design decisions" for why the two timers differ so much in length.
 */
export function applyKnockback(
  player: PlayerState,
  direction: -1 | 1,
  knockbackVx: number,
  knockbackDuration: number,
  invincibleDuration: number,
): PlayerState {
  return {
    ...player,
    vx: direction * knockbackVx,
    facing: direction < 0 ? 'left' : 'right',
    knockbackTimer: knockbackDuration,
    invincibleTimer: invincibleDuration,
  };
}

/**
 * Grants invincibility with no knockback — used by a pit fall (roadmap step
 * 19 extends step 9's mechanism this way, per user request: invincibility is
 * a property of taking damage generally, not just of enemy contact
 * specifically). Unlike `applyKnockback`, there's no "direction to push
 * away from" for a pit fall, and no reason to touch `vx`/`facing`/
 * `knockbackTimer` at all — `resolvePitFall` already handles repositioning
 * the character back to solid ground.
 */
export function grantInvincibility(player: PlayerState, duration: number): PlayerState {
  return { ...player, invincibleTimer: duration };
}
