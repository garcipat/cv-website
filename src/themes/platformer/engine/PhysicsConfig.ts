/**
 * Tunable player-physics constants, in one place so game feel can be
 * adjusted without hunting through engine logic. Later roadmap steps add
 * more fields here (walk speed, jump force, ...) instead of introducing new
 * scattered constants.
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
   * Constant horizontal walk speed, in px/s, in either direction (FR-006:
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
   * the jump key isn't currently held (FR-006: variable jump height). A tap
   * lets gravity + this cutoff shrink the arc quickly into a small hop; a
   * full hold never triggers it, so the impulse decays only under gravity
   * and reaches the full arc.
   */
  jumpCutMultiplier: 0.45,
  /**
   * Upward velocity impulse applied to the player immediately after a
   * stomp, in px/s (negative = up) — noticeably WEAKER than a normal jump
   * (`jumpVelocity`, -520), a small hop rather than a launch. Without
   * `PlayerState.bounceAscending` protecting it (see Physics.ts), the
   * variable-jump-height cut would silently shear this down to ~45% of its
   * configured value, so this magnitude must be read against the corrected
   * physics, not the pre-fix behavior. Peak height ≈ 330²/(2*1200) ≈ 45.4px
   * (~1.4 tiles), well under half of `jumpVelocity`'s own ≈112.7px peak.
   * Same tunneling invariant as the other velocity constants applies:
   * `Math.abs(stompBounceVelocity) * MAX_DT` must stay below
   * RENDERED_TILE_SIZE (32px): Math.abs(-330) * (1/30) = 11 < 32. ✓
   */
  stompBounceVelocity: -330,
  /**
   * Horizontal knockback speed applied to the player on a side-hit, in
   * px/s, away from the enemy that hit them — deliberately
   * faster than `walkSpeed` (200) so the push reads as forceful even if the
   * player is holding a direction key toward the enemy. Same tunneling
   * invariant as the other velocity constants: `sideHitKnockbackVx * MAX_DT`
   * must stay below RENDERED_TILE_SIZE (32px):
   * 250 * (1/30) ≈ 8.3 < 32. ✓
   */
  sideHitKnockbackVx: 250,
  /**
   * Seconds the knockback velocity above overrides normal input-driven
   * horizontal movement (see Physics.ts's `stepPlayerPhysics` and
   * `PlayerState.knockbackTimer`) — brief on purpose so the player regains
   * full control well before `INVINCIBILITY_DURATION_SECONDS` (Health.ts,
   * 1.2s) elapses.
   */
  sideHitKnockbackDuration: 0.25,
} as const;
