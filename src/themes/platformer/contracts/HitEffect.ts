/**
 * A hit is an ordered list of these generic primitives; the array order is the
 * application order (`engine/HitResolver.ts` folds left to right). Members name
 * mechanics, never use-cases — a new source composes them and a new visual is a
 * separate effect the caller spawns. This module imports nothing so both
 * `engine/` and `entities/` can use it without a layer edge.
 */
export type HitEffect =
  /** Reduce health. For a block, `amount` is a hit count (saturating at used-up). */
  | { readonly type: 'damage'; readonly amount: number }
  /**
   * A velocity impulse. `x` is signed px/s and also sets facing; `y` is px/s
   * (negative = up); `duration` overrides input for that many seconds;
   * `preserveJump` applies `bounceAscending` so the jump-cut can't shear it.
   */
  | {
      readonly type: 'velocity';
      readonly x?: number;
      readonly y?: number;
      readonly duration?: number;
      readonly preserveJump?: boolean;
    }
  /**
   * Enter the post-hit state. `blinkOnly` is the window-only pit reaction (no
   * red flash, velocity/facing untouched); otherwise the red `'hit'` reaction.
   */
  | { readonly type: 'reaction'; readonly blinkOnly?: boolean };
