/**
 * Tunable player-physics constants, in one place so game feel can be
 * adjusted without hunting through engine logic. Later roadmap steps add
 * more fields here (walk speed, jump force, ...) instead of introducing new
 * scattered constants.
 */
export const PHYSICS_CONFIG = {
  /** Downward acceleration applied while airborne, in px/s^2. */
  gravity: 1800,
  /** Maximum downward fall speed, in px/s. */
  terminalVelocity: 900,
} as const;
