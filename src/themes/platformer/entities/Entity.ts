/**
 * The shape every world object shares: where it is, how it is moving, which
 * way it faces, and where it is in its animation. Concrete families (enemies,
 * the player, blocks, chests, pickups) extend this and add their own fields.
 *
 * `type` is the key into that family's type registry — the module that owns
 * this object's numbers, mechanics, and rendering.
 *
 * Deliberately carries no `hitbox`/`spriteBox` FIELDS. Those are derived
 * functions of `type` + `x` + `y`: a stored box would be a second copy of the
 * position needing re-sync on every one of the ~60 position updates per
 * second, and a missed sync is a silent collision bug.
 */
export interface Entity {
  /** Key into this family's type registry. */
  type: string;
  /** Render-slot top-left in world pixels — NOT the hitbox corner. */
  x: number;
  y: number;
  /** Horizontal velocity in px/s. Positive is rightward. */
  vx: number;
  /** Vertical velocity in px/s. Positive is downward. Always 0 for enemies,
   *  which patrol along a single row (spec.md FR-019's patrol-only scope). */
  vy: number;
  direction: Direction;
  animState: string;
  animFrame: number;
  /** Seconds accumulated toward the next animation frame advance. */
  animTimer: number;
}

export type Direction = 'left' | 'right';

/** An axis-aligned box in world pixels. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An entity that can be hurt and killed. */
export interface Damageable {
  hitPoints: number;
  /** False once dead. A dead entity stays in its array at its index for the
   *  whole session so per-instance progress survives a respawn. */
  alive: boolean;
}
