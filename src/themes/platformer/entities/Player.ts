import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { Moving, SelfAnimated, Damageable } from '../contracts/capabilities';
import { isInvulnerable } from '../contracts/capabilities';

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

/**
 * The crouched collision box's height — exactly one rendered tile (32 px), the
 * pixel-level meaning of the spec's "one tile tall" (FR-002). The feet line
 * (`y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING`) is unchanged by crouch, so
 * the box shrinks upward from the ground line: a standing box spans
 * `[feetY - 38, feetY)`, a crouched box `[feetY - 32, feetY)`.
 */
export const PLAYER_CROUCH_BOX_HEIGHT = RENDERED_TILE_SIZE; // 32

/**
 * Box top offset from the render slot's `y` — the single source of truth shared
 * by `Collision.playerHitbox`, `Physics.stepPlayerPhysics` and
 * `DebugOverlay.drawDebugOverlay` (SC-008). Standing uses the sprite's own
 * transparent head padding (18); crouched uses the reduced box height so the
 * box's bottom edge stays on the unchanged feet line (24).
 */
export function playerHeadPaddingFor(crouching: boolean): number {
  return crouching
    ? PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING - PLAYER_CROUCH_BOX_HEIGHT // 24
    : PLAYER_HEAD_PADDING; // 18
}

/**
 * The player's collision box height — the standing box's full silhouette height
 * (38), or the one-tile crouched height (32). The companion to
 * `playerHeadPaddingFor`; both consumers must read this pair so no check can
 * keep the standing height while crouched (SC-008).
 */
export function playerBoxHeightFor(crouching: boolean): number {
  return crouching
    ? PLAYER_CROUCH_BOX_HEIGHT // 32
    : PLAYER_RENDERED_SIZE - PLAYER_HEAD_PADDING - PLAYER_FOOT_PADDING; // 38
}

export type PlayerAnimState = 'idle' | 'walk' | 'jump' | 'climb' | 'crouch' | 'hit' | 'death';

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
  /** Whether the player is currently crouched (FR-001): a one-tile collision
   *  box and interaction hitbox (FR-002), a slower crawl speed and no jump
   *  (FR-003/FR-004). Set by `stepPlayerPhysics` each tick from the pure
   *  `resolveCrouching` decision; a required field, always seeded `false` by
   *  both player-state factories, so a respawn/reset returns the character
   *  standing (FR-012). Kept separate from the derived `'crouch'` `animState`
   *  because a hit reaction sets `animState: 'hit'` while the box must stay
   *  one tile (FR-011). */
  crouching: boolean;
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
  /** The feet line (`y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING`) at the
   *  start of the previous physics step — genuine motion history beside
   *  `lastGroundedX/Y`. Compared against the current feet by the floor
   *  spear's swept contact-from-above test (`entities/hazards/SpearArt.ts`),
   *  so a single-tick fast fall still registers while a side graze does not.
   *  Written by `Physics.ts`'s `stepPlayerPhysics` on every return and by
   *  `resolvePitFall`, and seeded to the state's own feet by both player-state
   *  factories (`PlatformerState.ts`'s `playerStateAtTile` and
   *  `editor/gridRenderState.ts`'s `synthesizePlayerState`) so a spawn/respawn
   *  never carries a stale pre-death feet line. */
  prevFeetY: number;
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
/**
 * `knight.png`'s 6th row (its 3rd frame red-tinted) — only the first 3 of
 * its 4 columns are used (the 4th repeats the same neutral pose as the
 * 1st/2nd with nothing added), so the red flash recurs every 0.3s instead of
 * every 0.4s. Same per-frame timing as an enemy's own hit reaction
 * (EnemyAnimation.ts's HIT_FRAME_DURATION). Named separately from
 * `ANIM_CONFIG` (which still holds them too, for `playerFrameSource`'s sake)
 * because `hitFrameFromTimer` below needs them directly.
 */
const HIT_FRAME_COUNT = 3;
const HIT_FRAME_DURATION = 0.1;

/**
 * The `hit` row's red-tinted frame — its 3rd of the 3 used frames. The standing
 * hit flashes red only on this frame (0.1s out of every 0.3s), so the crouched
 * hit's render-time tint reuses it to pulse at the same cadence instead of
 * staying red for the whole reaction window.
 */
export const HIT_RED_FRAME_INDEX = HIT_FRAME_COUNT - 1;

const ANIM_CONFIG: Record<
  PlayerAnimState,
  { frameCount: number; frameDuration: number; sy: number }
> = {
  idle: { frameCount: 4, frameDuration: 0.15, sy: 0 },
  walk: { frameCount: 8, frameDuration: 0.08, sy: PLAYER_FRAME_SIZE * 2 },
  jump: { frameCount: 7, frameDuration: 0.062, sy: 0 },
  climb: { frameCount: 4, frameDuration: 0.1, sy: 0 },
  // `knight.png`'s 9th row (0-indexed 8) — the dedicated DUCK row (S-012),
  // drawn low and horizontal so the crouch reads as a duck/crawl rather than
  // standing (`idle`=0, `walk`=2, `hit`=6, `death`=7; `jump`/`climb` use the
  // separate knight2.png). Four crawl frames loop 0→1→2→3→0 while the player
  // crawls (FR-008); a stationary crouch holds its current frame. `frameDuration`
  // sits between `walk`'s 0.08 and `idle`'s 0.15 so the crawl reads as effortful.
  crouch: { frameCount: 4, frameDuration: 0.12, sy: PLAYER_FRAME_SIZE * 8 },
  hit: { frameCount: HIT_FRAME_COUNT, frameDuration: HIT_FRAME_DURATION, sy: PLAYER_FRAME_SIZE * 6 },
  // `knight.png`'s 7th row (its 4th frame a shrunken "collapsed" pose) —
  // slower than `hit` so the collapse reads as weighty; played once by
  // PlatformerPage.tsx's game loop during the 'dying' phase's lead-in (see
  // GameLifecycle.ts's DEATH_ANIM_SECONDS), then held on its last frame.
  death: { frameCount: 4, frameDuration: 0.15, sy: PLAYER_FRAME_SIZE * 7 },
};

/** Seconds each idle frame is held before advancing to the next. */
export const IDLE_FRAME_DURATION = ANIM_CONFIG.idle.frameDuration;

/**
 * The `hit` sprite's frame index, computed directly from `hitTimer` rather
 * than from `animFrame`/`animTimer` — unlike every other animState, `hit`'s
 * frame is NOT incrementally advanced by `advancePlayerAnimation` (which
 * treats `hit` as a no-op, the same way it already freezes `climb` while
 * stationary). `hitTimer` is already the single source of truth the
 * invulnerability window itself is built on (`isInvulnerable`,
 * `isPlayerBlinkVisible`), advanced exactly once per tick by
 * `advancePlayerHitTimer` — deriving the frame from it directly, the same
 * way `isPlayerBlinkVisible` derives the blink phase, makes the red flash a
 * pure function of elapsed time. An incrementally-advanced counter can only
 * ever match that by construction; deriving it directly removes the
 * possibility of drift entirely, rather than relying on it.
 */
export function hitFrameFromTimer(hitTimer: number): number {
  return Math.floor(hitTimer / HIT_FRAME_DURATION) % HIT_FRAME_COUNT;
}

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

/** Advances the player's animation timer/frame by `dt` seconds. No-op for
 *  `'hit'` — its frame is derived directly from `hitTimer` at render time
 *  instead (see `hitFrameFromTimer`), not advanced incrementally here. */
export function advancePlayerAnimation(player: PlayerState, dt: number): PlayerState {
  if (player.animState === 'hit') return player;
  if (player.animState === 'climb' && player.vy === 0) return player;
  // Mirrors the `climb` freeze: a stationary crouch holds one tucked frame,
  // and only alternates its two frames while actually crawling (FR-008).
  if (player.animState === 'crouch' && player.vx === 0) return player;
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
 * Switches `animState` between `idle`/`walk`/`jump`/`climb`/`crouch`, resetting
 * the animation frame/timer whenever the state actually changes so a leftover
 * frame index from the previous state's cycle never carries over.
 * `'death'` is deliberately not derived here — it's driven externally
 * (PlatformerPage.tsx sets it directly at the moment `alive` goes false),
 * since this function only ever runs during live gameplay, never during the
 * `'dying'` phase.
 *
 * `'hit'` is likewise never entered here — only `applyHitReaction` (called for
 * every attacker hit: an enemy or hazard touch) enters it directly, the same
 * way an enemy's own `takeHit` sets its `animState` straight to `'hit'`. A
 * pit fall (`beginPitFallReaction`) has no attacker to react to, so it leaves
 * `animState` alone and stays on the render blink instead (see
 * PlatformerPage.tsx's `isPlayerBlinkVisible` use) — this function's only
 * job regarding `'hit'` is holding it for as long as the invulnerability
 * window from that hit is still open (looping `advancePlayerAnimation`
 * continuously via the same-reference return below, rather than restarting
 * every tick) and falling back to a movement-derived state once it closes.
 * Climbing takes priority over airborne/grounded/velocity checks — the
 * character can be moving or airborne while climbing, but it still reads as
 * `'climb'`, not other states. `'crouch'` sits just below `'climb'` and above
 * the airborne check, so a crouched character that walks off a ledge keeps the
 * crouched pose for the fall (spec Edge Case).
 */
export function updatePlayerAnimState(player: PlayerState): PlayerState {
  if (player.animState === 'hit' && isInvulnerable(player, PLAYER_HIT_REACTION_SECONDS)) {
    return player;
  }
  const animState: PlayerAnimState = player.climbing
    ? 'climb'
    : player.crouching
      ? 'crouch'
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

/** Optional knockback bundled with a hit reaction: the direction/speed the
 *  player is pushed away from whatever hit them, and how long input is
 *  overridden. Omitted for a hit that deals damage without moving the player. */
export interface HitKnockback {
  /** Direction the player is pushed — and the facing they adopt. */
  direction: -1 | 1;
  /** Horizontal knockback speed in px/s (positive; the sign comes from `direction`). */
  vx: number;
  /** Seconds `knockbackTimer` overrides input-driven horizontal movement. */
  duration: number;
}

/**
 * Starts the shared red `'hit'` reaction — **always**: opens the refractory
 * window (`hitTimer = 0`) and switches `animState` straight to `'hit'` with its
 * frame/timer reset (the same entry an enemy's own `takeHit` uses).
 *
 * Knockback is a separate, optional effect: pass a `HitKnockback` to also set
 * `vx`/`direction` (facing away from the hit) and `knockbackTimer`; omit it for
 * a hit that deals damage but must not move the player (a floor spike, or any
 * hit taken while crouched — FR-011/SC-009). Keeping the visual here and the
 * knockback in the optional argument is what makes every damage source look the
 * same while each source decides for itself whether it knocks back.
 *
 * The refractory window takes no duration argument: its length is
 * PLAYER_HIT_REACTION_SECONDS, read by whoever asks `isInvulnerable`, so
 * starting one is just zeroing the timer. `knockbackTimer` runs independently
 * and is much shorter, so control comes back well before the reaction ends.
 *
 * Pure; never throws; no side effects.
 */
export function applyHitReaction(player: PlayerState, knockback?: HitKnockback): PlayerState {
  const hit: PlayerState = {
    ...player,
    hitTimer: 0,
    animState: 'hit',
    animFrame: 0,
    animTimer: 0,
  };
  if (!knockback) return hit;
  return {
    ...hit,
    vx: knockback.direction * knockback.vx,
    direction: knockback.direction < 0 ? 'left' : 'right',
    knockbackTimer: knockback.duration,
  };
}

/**
 * Starts a pit fall's post-hit refractory window with no knockback and no red
 * flash — the one deliberate exception to `applyHitReaction`. A pit fall has no
 * attacker to react to, and `resolvePitFall` already repositions the character
 * back to solid ground, so `vx`/`direction`/`knockbackTimer` are untouched and
 * `animState` is left alone: the character stays on the render blink
 * (`isPlayerBlinkVisible`) rather than switching to the `'hit'` sprite. Only the
 * shared refractory window (`hitTimer = 0`) is started, since that is a property
 * of taking damage generally, not of enemy contact specifically.
 */
export function beginPitFallReaction(player: PlayerState): PlayerState {
  return { ...player, hitTimer: 0 };
}

/**
 * Seconds the player's post-hit refractory window lasts: further hits are
 * dropped, and either the `hit` animation loops (an attacker hit) or the render
 * blink plays (a pit fall) for this long after a hit lands. Long enough to read
 * clearly as "just got hurt" without dragging on. The enemy equivalent is each
 * type's own `hitReactionSeconds`.
 */
export const PLAYER_HIT_REACTION_SECONDS = 0.8;

/** Seconds between blink phase flips while a pit fall's invulnerability
 *  window is open and `animState` is not `'hit'` (see `beginPitFallReaction`'s
 *  doc comment for why a pit fall never enters `'hit'`). */
export const PLAYER_BLINK_INTERVAL_SECONDS = 0.1;

/**
 * Whether the player sprite is drawn on this frame of a pit fall's blink.
 * Only meaningful while `animState !== 'hit'` — a directional knockback's
 * `hit` sprite flash is always drawn, never blinked (see
 * PlatformerPage.tsx's use of both).
 *
 * The phase is measured from the START of the window (elapsed `hitTimer`
 * parity, flipped so the first interval is hidden): the instant of the hit
 * must always read as the sprite vanishing, for any reaction duration —
 * anchoring from the window's END instead would make that first-frame
 * parity an accident of whether the duration happens to divide evenly by
 * `PLAYER_BLINK_INTERVAL_SECONDS`.
 */
export function isPlayerBlinkVisible(hitTimer: number): boolean {
  return Math.floor(hitTimer / PLAYER_BLINK_INTERVAL_SECONDS) % 2 === 1;
}
