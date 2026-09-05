import { RENDER_SCALE } from '../level/Terrain';
import type { Moving, SelfAnimated, Damageable } from './capabilities';

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

export type PlayerAnimState = 'idle' | 'walk' | 'jump' | 'climb';

/** Which of a touched block's four faces the player's collision resolved
 *  against, from the block's own perspective — `'bottom'` means the
 *  player's head hit its underside while rising, `'top'` means the player
 *  landed on it from above, `'left'`/`'right'` mean the player walked into
 *  that side wall. */
export type BlockContactSide = 'top' | 'bottom' | 'left' | 'right';

/** One block the player touched this tick, tagged with which side. */
export interface BlockContact {
  id: string;
  side: BlockContactSide;
}

/**
 * Player-only state, layered onto `Moving`'s `vx`/`vy` (px/s, positive
 * right/down) and `direction` (the direction the sprite is drawn facing —
 * only horizontal movement changes it), onto `SelfAnimated`'s `animFrame`
 * and `animTimer` (seconds accumulated toward the next animation frame
 * advance), both keyed by `animState`, narrowed below, and onto
 * `Damageable`'s `hitPoints`/`alive`/`hitTimer` — `hitPoints` is a plain
 * half-heart count (see entities/Health.ts's MAX_HALF_HEARTS/takeDamage),
 * with all heart-display presentation unchanged, and `hitTimer` counts
 * seconds since the last hit landed, gating further hits through
 * `isInvulnerable` exactly as it does for an enemy.
 */
export interface PlayerState extends Moving, SelfAnimated, Damageable {
  x: number;
  y: number;
  /** Whether the player is currently resting on a solid tile. */
  grounded: boolean;
  /** Whether the player is currently climbing a `'ladder'` or `'chain'` tile
   *  — while true, `Physics.ts`'s stepPlayerPhysics suspends gravity and
   *  drives vertical movement directly from Up/Down instead. */
  climbing: boolean;
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
   *  than a spawn/checkpoint. */
  lastGroundedX: number;
  lastGroundedY: number;
  /** Narrowed from `SelfAnimated`'s `string` to the player's finite set of
   *  animation states. */
  animState: PlayerAnimState;
  /** Seconds remaining of forced knockback velocity — 0 means normal
   *  input-driven movement. While positive, Physics.ts's `stepPlayerPhysics`
   *  ignores held movement keys and holds the knockback `vx` instead; much
   *  shorter than PLAYER_HIT_REACTION_SECONDS so the player regains full
   *  control well before the refractory window (and its blink) ends. Counts
   *  DOWN, unlike `hitTimer`, and is ticked down inside `stepPlayerPhysics`
   *  itself rather than here, since that function is the one that reads
   *  it. */
  knockbackTimer: number;
  /**
   * Every block the player touched this tick, tagged with which side (see
   * `BlockContact`) — always freshly computed by `Physics.ts`'s collision
   * checks (all four directions), never carried over from a previous tick.
   * Empty on any tick with no block collision at all. `PlatformerPage.tsx`
   * reads this once per tick, filtered by the side a given mechanic cares
   * about (`'bottom'` for crate/questionMark/fragileRock's existing
   * hit-from-below reaction, `'top'` for coin-pot's landing reaction) — a
   * block kind simply never reacts to a side it doesn't filter for, so
   * adding a new side-sensitive mechanic (e.g. a future spike hazard
   * reacting to any side) never requires touching `Physics.ts` again.
   */
  blockContacts: BlockContact[];
  /**
   * True while the player is ascending from a stomp bounce — suppresses
   * `stepPlayerPhysics`'s variable-jump-height cut for every tick of the
   * ascent, not just the one the bounce was applied on. The jump-cut
   * multiplier re-applies EVERY tick the jump key isn't held (not just
   * once), so a single-tick `suppressJumpCut` override would only protect
   * the very first frame — on the next frame, since a stomp bounce is never
   * actually "held" like a real jump, the cut would immediately shear the
   * bounce down to ~45% of its intended magnitude regardless of how large
   * `PHYSICS_CONFIG.stompBounceVelocity` is configured. Set `true` by
   * `PlatformerPage.tsx` in the same assignment that sets the bounce `vy`;
   * `stepPlayerPhysics` clears it back to `false` itself once the ascent
   * ends (`vy` is no longer negative), so it never lingers into a later,
   * unrelated jump.
   */
  bounceAscending: boolean;
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
  climb: { frameCount: 4, frameDuration: 0.1, sy: 0 },
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

/**
 * `knight2.png`'s third row — a 4-frame "climb (back view)" cycle. Row
 * spacing matches JUMP_ROW_SY (0) / FALL_ROW_SY (161): the sheet is
 * 1024x484px, i.e. three ~161.3px-tall rows, so the third starts at
 * 2*161=322.
 */
const CLIMB_ROW_SY = 322;
const CLIMB_ROW_FRAME_COUNT = 4;

/**
 * Frame source for the climbing animation — a simple 4-frame cycle (unlike
 * `jumpFrameSource`, there's no rising/falling branch: climbing has one
 * direction-agnostic loop). Uses the same 128px `JUMP_FRAME_SIZE`/sheet as
 * jump/fall.
 */
export function climbFrameSource(frame: number): { sx: number; sy: number } {
  return { sx: (frame % CLIMB_ROW_FRAME_COUNT) * JUMP_FRAME_SIZE, sy: CLIMB_ROW_SY };
}

/** Advances the player's animation timer/frame by `dt` seconds. */
export function advancePlayerAnimation(player: PlayerState, dt: number): PlayerState {
  if (player.animState === 'climb' && player.vy === 0) return player;
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
 * Switches `animState` between `idle`/`walk`/`jump`/`climb`, resetting the animation
 * frame/timer whenever the state actually changes so a leftover frame index
 * from the previous state's cycle never carries over. Climbing takes priority
 * over airborne/grounded/velocity checks — the character can be moving or
 * airborne while climbing, but it still reads as `'climb'`, not other states.
 */
export function updatePlayerAnimState(player: PlayerState): PlayerState {
  const animState: PlayerAnimState = player.climbing
    ? 'climb'
    : !player.grounded
      ? 'jump'
      : player.vx !== 0
        ? 'walk'
        : 'idle';
  if (animState === player.animState) return player;
  return { ...player, animState, animFrame: 0, animTimer: 0 };
}

/**
 * Advances `hitTimer` by `dt` seconds, clamped at PLAYER_HIT_REACTION_SECONDS
 * — a no-op (returns the same reference) once already clamped. The clamp is
 * what stops a long session from accumulating a meaninglessly large number:
 * every reader only ever asks whether the timer is still below the reaction
 * duration, so anything past it is the same answer. Called once per
 * game-loop tick (PlatformerPage.tsx); unlike `knockbackTimer` (decremented
 * inside `stepPlayerPhysics`, since that function is the one that reads it),
 * the refractory window isn't consumed by physics at all, only by the damage
 * gate and the render blink.
 */
export function advancePlayerHitTimer(player: PlayerState, dt: number): PlayerState {
  if (player.hitTimer >= PLAYER_HIT_REACTION_SECONDS) return player;
  return {
    ...player,
    hitTimer: Math.min(PLAYER_HIT_REACTION_SECONDS, player.hitTimer + dt),
  };
}

/**
 * Applies a side-hit's knockback and refractory window in one step: sets `vx`
 * to `direction * knockbackVx` (facing to match, so the character visually
 * faces away from whatever hit it), starts `knockbackTimer` (how long
 * `stepPlayerPhysics` overrides input-driven horizontal movement) and
 * restarts `hitTimer` (how long further hits are ignored and the render
 * blink plays). The two run independently and differ a lot in length —
 * control comes back long before the blink ends. The refractory window takes
 * no duration argument: its length is PLAYER_HIT_REACTION_SECONDS, read by
 * whoever asks `isInvulnerable`, so starting one is just zeroing the timer.
 */
export function applyKnockback(
  player: PlayerState,
  direction: -1 | 1,
  knockbackVx: number,
  knockbackDuration: number,
): PlayerState {
  return {
    ...player,
    vx: direction * knockbackVx,
    direction: direction < 0 ? 'left' : 'right',
    knockbackTimer: knockbackDuration,
    hitTimer: 0,
  };
}

/**
 * Starts the post-hit refractory window with no knockback — used by a pit
 * fall, since the window is a property of taking damage generally, not just
 * of enemy contact specifically. Unlike `applyKnockback`, there's no
 * "direction to push away from" for a pit fall, and no reason to touch
 * `vx`/`direction`/`knockbackTimer` at all — `resolvePitFall` already
 * handles repositioning the character back to solid ground.
 */
export function beginHitReaction(player: PlayerState): PlayerState {
  return { ...player, hitTimer: 0 };
}

/**
 * Seconds the player's post-hit refractory window lasts: further hits are
 * dropped and the render blink plays for this long after a hit lands. Long
 * enough to read clearly as "just got hurt" without dragging on. The enemy
 * equivalent is each type's own `hitReactionSeconds`.
 */
export const PLAYER_HIT_REACTION_SECONDS = 1.2;

/** Seconds between blink phase flips while the player is invulnerable. */
export const PLAYER_BLINK_INTERVAL_SECONDS = 0.1;

/**
 * Whether the player sprite is drawn on this frame of the post-hit blink.
 *
 * The phase is measured from the END of the window, not its start:
 * `reactionSeconds - hitTimer` is the time REMAINING, and it is that
 * remainder — not the elapsed time — whose blink-interval parity decides
 * on/off. Taking the parity of `hitTimer` directly would blink at the same
 * rate for the same duration with every frame's on/off state swapped.
 *
 * Callers gate this behind `isInvulnerable`; outside the window the
 * remainder goes negative and the result is meaningless.
 */
export function isPlayerBlinkVisible(hitTimer: number, reactionSeconds: number): boolean {
  const remaining = reactionSeconds - hitTimer;
  return Math.floor(remaining / PLAYER_BLINK_INTERVAL_SECONDS) % 2 === 0;
}
