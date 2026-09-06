import type { WorldType, Boxed } from '../WorldType';

/**
 * Everything the engine needs to know about one hazard kind, owned entirely
 * by that kind's own module — same "one file + one registry line" promise
 * as `BlockType`/`EnemyType`, but WITHOUT anything from `Damageable`: a
 * hazard is never damaged, never dies, and never moves, so forcing those
 * fields on it the way `BlockType` would (hitPoints, revive, patrol) would
 * mean faking an entire interface a static hazard has no use for.
 */
export interface HazardType<S> extends WorldType<S>, Boxed<S> {
  /** Must equal this module's slot in HAZARD_TYPES. */
  key: string;
  /** Half-heart units a single touch costs — see Health.ts's SIDE_HIT_DAMAGE
   *  for the shared convention every other damage source already uses. */
  damage: number;
}
