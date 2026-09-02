import type { Direction } from './geometry';

/**
 * No capability here stores a `hitbox` or `spriteBox` field. Both are derived
 * functions of `type` + `x` + `y`, computed on demand rather than cached: a
 * stored box would be a second copy of position, needing re-sync on every one
 * of the ~60 position updates per second a moving entity gets, where a missed
 * sync is a silent collision bug.
 */

/**
 * Moves under its own power. `vy` is a capability of moving things rather than
 * a field every mover uses today — enemies patrol along one row and leave it
 * at zero — but a flying or jumping enemy would need it, and the player
 * already does.
 */
export interface Moving {
  vx: number;
  vy: number;
  direction: Direction;
}

/**
 * Advances its own animation on a per-instance timer, so two instances of one
 * type can be out of phase — the stagger enemies get at spawn and keep across
 * a respawn.
 *
 * A type whose frames come from the shared world clock instead — a spinning
 * coin, a bobbing key — needs none of this; its `frameIndex` reads `elapsed`.
 * Both are animated; only this one stores state.
 */
export interface SelfAnimated {
  animState: string;
  animFrame: number;
  animTimer: number;
}

/**
 * Takes damage and is gone at zero. `hitTimer` counts seconds since the last
 * hit landed; while it is below the type's reaction duration, the entity is in
 * its post-hit refractory window and further hits do not land.
 *
 * Blocks deliberately do NOT compose this: their `hitsTaken` counts up to a
 * per-kind maximum rather than down to zero, and a spent question-mark stays
 * solid in the world, so `alive` has no meaning for it.
 */
export interface Damageable {
  hitPoints: number;
  /** False once dead. A dead entity stays in its array at its index for the
   *  whole session so per-instance progress survives a respawn. */
  alive: boolean;
  hitTimer: number;
}

/**
 * Whether `state` is still inside its post-hit refractory window, during
 * which further hits do not land. The window is `hitTimer < reactionSeconds`,
 * so a `hitTimer` exactly at the duration is already outside it — the same
 * boundary the reaction animation uses when it ends.
 *
 * `reactionSeconds` is supplied by the caller rather than stored on the
 * capability: the player's window and each enemy type's window are different
 * lengths, and each family already owns its own constant.
 */
export function isInvulnerable(state: Damageable, reactionSeconds: number): boolean {
  return state.hitTimer < reactionSeconds;
}

/**
 * The type-side half of `Damageable`: the numbers a type of damageable thing
 * is born with, and what taking damage costs it beyond the shared reaction
 * every damageable thing gets.
 *
 * `onDamaged` is separate from whatever hook decides that a contact counts as
 * a hit: deciding what a touch MEANS and paying for a landed hit are
 * different jobs, and only the second one is a type's business once a hit is
 * a fact. It is optional because most types owe nothing beyond the shared
 * reaction.
 */
export interface DamageableType<S extends Damageable> {
  maxHitPoints: number;
  /** Length of the post-hit refractory window, in seconds — the window
   *  `isInvulnerable` reads. Every call site asking whether one of these is
   *  invulnerable takes the duration from here, never from a shared
   *  constant, so a type wanting a longer stun changes one field. */
  hitReactionSeconds: number;
  /** What taking a hit does to this type beyond decrementing hit points.
   *  Receives the already-decremented state and the damage that landed, and
   *  returns the state to store. */
  onDamaged?(state: S, amount: number): S;
}
