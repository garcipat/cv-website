/**
 * Tunable **general movement** physics, in one place so game feel can be
 * adjusted without hunting through engine logic: gravity, fall/climb speeds,
 * the jump arc and the variable-jump cut.
 *
 * Deliberately NOT here: per-entity hit impulses (a stomp bounce, a side-hit
 * knockback, a pot's launch). Those belong to the source that applies them
 * see `shared/knockback.ts` for the reusable defaults.
 */
export const PHYSICS_CONFIG = {
  /** Downward acceleration applied while airborne, in px/s^2. */
  gravity: 1200,
  /**
   * Maximum downward fall speed, in px/s. Discrete collision resolution
   * (Physics.ts) only prevents tunneling through a 1-tile-thick solid as
   * long as `terminalVelocity * MAX_DT < RENDERED_TILE_SIZE` (see
   * GameLoop.ts's MAX_DT and Terrain.ts's RENDERED_TILE_SIZE) — keep this
   * true when retuning any of the three.
   */
  terminalVelocity: 900,
  /**
   * Constant horizontal walk speed, in px/s, in either direction (
   * instant direction change, no acceleration/deceleration). Same tunneling
   * invariant as `terminalVelocity` applies: `walkSpeed * MAX_DT` must stay
   * below `RENDERED_TILE_SIZE`.
   */
  walkSpeed: 200,
  /**
   * Constant horizontal patrol speed for enemies, in px/s, in either
   * direction — slower than the player's walkSpeed (200) so a slime reads as
   * a plodding threat rather than matching the character's pace. Same
   * tunneling invariant as walkSpeed/terminalVelocity applies:
   * `enemyPatrolSpeed * MAX_DT` must stay below `RENDERED_TILE_SIZE`.
   */
  enemyPatrolSpeed: 60,
  /**
   * Constant vertical speed while climbing a ladder, in px/s, in either
   * direction — slower than horizontal walkSpeed (200) so
   * climbing reads as deliberate effort rather than matching normal
   * movement pace. Same tunneling invariant as the other velocity constants:
   * `climbSpeed * MAX_DT` must stay below RENDERED_TILE_SIZE (32px):
   * 120 * (1/30) = 4 < 32. ✓
   */
  climbSpeed: 120,
  /**
   * Constant horizontal crawl speed while crouched, in px/s, in either
   * direction — 60% of walkSpeed (200) so the crouch reads as a
   * deliberate, slower pace. Same tunneling invariant as every other velocity
   * constant: `crouchSpeed * MAX_DT` must stay below RENDERED_TILE_SIZE (32px):
   * 120 * (1/30) = 4 < 32. ✓ Knockback (`knockbackActive`) still overrides it.
   */
  crouchSpeed: 120,
  /**
   * Initial upward velocity impulse on jump press, in px/s (negative = up).
   * Same tunneling invariant as `terminalVelocity`/`walkSpeed` applies:
   * `Math.abs(jumpVelocity) * MAX_DT` must stay below `RENDERED_TILE_SIZE`.
   * With gravity=1200, jumpVelocity=-520 yields peak height of 520²/(2*1200) ≈ 112.7px
   * ≈ 3.5 tiles (RENDERED_TILE_SIZE=32px), comfortably clearing a 3-tile-high platform.
   * Time-to-apex ≈ 0.43s. Tunneling check: Math.abs(-520) * (1/30) ≈ 17.33 < 32. ✓
   */
  jumpVelocity: -520,
  /**
   * Multiplier applied to `vy` once per frame while ascending (`vy < 0`) and
   * the jump key isn't currently held ( variable jump height). A tap
   * lets gravity + this cutoff shrink the arc quickly into a small hop; a
   * full hold never triggers it, so the impulse decays only under gravity
   * and reaches the full arc.
   */
  jumpCutMultiplier: 0.45,
} as const;
