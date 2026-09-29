/**
 * Reusable hit-impulse defaults. A source that needs a different strength keeps
 * its own constant next to itself (the purple slime's spike rebound, a pot's
 * bounce, the bouncy mushroom's launch); these cover everything that doesn't.
 * Keep `Math.abs(v) * MAX_DT < RENDERED_TILE_SIZE`.
 */
export const DEFAULT_HIT_KNOCKBACK = {
  /** Horizontal speed in px/s, applied away from the attacker. */
  vx: 250,
  /** Seconds the impulse overrides input (`PlayerState.knockbackTimer`). */
  duration: 0.25,
} as const;

/** Upward impulse (px/s, negative = up) on a stomp landing; jump-cut protected. */
export const DEFAULT_STOMP_BOUNCE_VY = -330;
