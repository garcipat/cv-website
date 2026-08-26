/**
 * Tunable player-physics constants, in one place so game feel can be
 * adjusted without hunting through engine logic. Later roadmap steps add
 * more fields here (walk speed, jump force, ...) instead of introducing new
 * scattered constants.
 */
export const PHYSICS_CONFIG = {
  /** Downward acceleration applied while airborne, in px/s^2. */
  gravity: 1800,
  /**
   * Maximum downward fall speed, in px/s. Discrete collision resolution
   * (Physics.ts) only prevents tunneling through a 1-tile-thick solid as
   * long as `terminalVelocity * MAX_DT < RENDERED_TILE_SIZE` (see
   * GameLoop.ts's MAX_DT and Terrain.ts's RENDERED_TILE_SIZE) — keep this
   * true when retuning any of the three.
   */
  terminalVelocity: 900,
  /**
   * Constant horizontal walk speed, in px/s, in either direction (FR-006:
   * instant direction change, no acceleration/deceleration). Same tunneling
   * invariant as `terminalVelocity` applies: `walkSpeed * MAX_DT` must stay
   * below `RENDERED_TILE_SIZE`.
   */
  walkSpeed: 200,
} as const;
