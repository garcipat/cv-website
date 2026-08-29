import { RENDER_SCALE } from '../level/Terrain';

/** Whole hearts shown in the HUD. */
export const MAX_HEARTS = 3;

/** Health is tracked in half-heart integer units so pit-fall damage (half a
 *  heart) and a future full-heart hit (roadmap step 18) both fit as whole
 *  numbers instead of needing fractional health values. */
export const MAX_HALF_HEARTS = MAX_HEARTS * 2;

/**
 * Half-heart units lost per pit fall. Roadmap step 19 (enemy side/below
 * damage, see SIDE_HIT_DAMAGE below) reuses `takeDamage` with the same amount
 * — confirmed live with the user, overriding the roadmap's original "full
 * heart" text — instead of introducing a separate damage function.
 */
export const PIT_FALL_DAMAGE = 1;

/**
 * Half-heart units lost when touched by an enemy from the side or below (a
 * non-stomp contact, roadmap step 19) — the same half heart as a pit fall,
 * not a full heart as the roadmap originally specified (revised live with
 * the user), reusing the same `takeDamage` mechanism rather than a separate
 * function. Kept as its own named constant (even though its value currently
 * equals `PIT_FALL_DAMAGE`) since it represents a conceptually distinct
 * damage source that could change independently later.
 */
export const SIDE_HIT_DAMAGE = 1;

/**
 * Seconds of invincibility granted after a side-hit — gates
 * `checkEnemySideCollisions` (Collision.ts) from registering another hit and
 * drives the player's render blink (PlatformerPage.tsx) for the same
 * duration. Chosen live with the user: long enough to read clearly as "just
 * got hurt" without dragging on.
 */
export const INVINCIBILITY_DURATION_SECONDS = 1.2;

/** `hearts.png` is a 16px-per-frame sheet (matching TILE_SIZE), scaled up by
 *  the same RENDER_SCALE as terrain/player sprites — 32px rendered, matching
 *  the ~32px height of the theme/language dropdown selects in
 *  FloatingControls.tsx. */
export const HEART_FRAME_SIZE = 16;
export const HEART_RENDERED_SIZE = HEART_FRAME_SIZE * RENDER_SCALE;

/** Subtracts `amount` half-heart units from `current`, clamped to [0, MAX_HALF_HEARTS]. */
export function takeDamage(current: number, amount: number): number {
  return Math.max(0, Math.min(MAX_HALF_HEARTS, current - amount));
}

/**
 * How many half-heart units (0, 1, or 2) the heart at `heartIndex` (0-based,
 * left to right) should show, given the total half-heart count. Heart 0
 * covers units 0-1 of total health, heart 1 covers units 2-3, heart 2 covers
 * units 4-5.
 */
export function heartRemaining(totalHalfHearts: number, heartIndex: number): number {
  return Math.max(0, Math.min(2, totalHalfHearts - heartIndex * 2));
}

/** Maps a single heart's remaining half-heart units (0, 1, or 2) to its
 *  sprite frame index in `hearts.png` (0 = full, 1 = half, 2 = empty). */
export function heartFrameIndex(remainingForThisHeart: number): number {
  if (remainingForThisHeart >= 2) return 0;
  if (remainingForThisHeart === 1) return 1;
  return 2;
}
