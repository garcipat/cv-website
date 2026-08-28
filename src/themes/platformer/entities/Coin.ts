import { RENDER_SCALE } from '../level/Terrain';

/** `coin.png` is a 192x16 sheet: 12 frames of 16x16, one spin cycle. */
export const COIN_FRAME_SIZE = 16;
export const COIN_RENDERED_SIZE = COIN_FRAME_SIZE * RENDER_SCALE;
export const COIN_FRAME_COUNT = 12;

/** Seconds each spin frame is held before advancing — a snappier cycle than
 *  the player's idle animation, since a coin's spin is a small ambient loop
 *  rather than a state-driven animation. */
export const COIN_FRAME_DURATION = 0.12;

/**
 * Spin-cycle frame index for a given elapsed time, shared by every coin (all
 * coins spin in sync, so no per-coin animation state is needed — unlike
 * Player.ts's animState/animFrame/animTimer, which vary per player). Clamps
 * negative elapsed time to frame 0 defensively, though callers only ever pass
 * an accumulated (non-negative) timer.
 */
export function coinFrameIndex(elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  const frame = Math.floor(elapsedSeconds / COIN_FRAME_DURATION);
  return frame % COIN_FRAME_COUNT;
}

/** Sprite-sheet source rect for a given frame index (wraps, matching
 *  Player.ts's playerFrameSource convention). */
export function coinFrameSource(frame: number): { sx: number; sy: number } {
  return { sx: (frame % COIN_FRAME_COUNT) * COIN_FRAME_SIZE, sy: 0 };
}

/** Vertical bob distance in rendered px, and the full up-down-up cycle's
 *  duration in seconds — a small ambient float layered on top of the spin,
 *  driven by the same shared elapsed clock as coinFrameIndex. */
export const COIN_BOB_AMPLITUDE = 3;
export const COIN_BOB_PERIOD_SECONDS = 1.6;

/**
 * Vertical offset (rendered px, positive = downward, matching the canvas y
 * axis) to add to every coin's y position for the current elapsed time — a
 * sine wave shared by every coin, so they all bob in sync just like they all
 * spin in sync (see coinFrameIndex). Independent of the spin frame's own
 * timing (COIN_FRAME_DURATION) since the two are unrelated cycles.
 */
export function coinBobOffset(elapsedSeconds: number): number {
  return COIN_BOB_AMPLITUDE * Math.sin((elapsedSeconds / COIN_BOB_PERIOD_SECONDS) * Math.PI * 2);
}
