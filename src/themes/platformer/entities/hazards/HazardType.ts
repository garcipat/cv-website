import type { WorldType, Boxed } from '../../contracts/WorldType';
import type { PlayerState } from '../Player';
import type { Rect } from '../../contracts/geometry';

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
   *  for the shared convention every other damage source already uses.
   *  Never read when `lethal` is true. */
  damage: number;
  /** When true, a qualifying contact is an instant kill: health goes straight
   *  to zero and every invulnerability window is ignored. The kind applies no
   *  half-heart damage, knockback, hit animation or splatter (O-020 FR-004/
   *  FR-005). Absent/false leaves every existing kind's half-heart behavior
   *  untouched. */
  lethal?: boolean;
  /** Whether this specific overlap qualifies as a contact. Absent = always
   *  true (any `box` overlap), preserving every existing kind's behavior.
   *  The spear returns true only for a descent onto its top tips from above
   *  (O-020 FR-003). `PlayerState` is a type-only import and `Rect` (rather
   *  than `Collision.ts`'s structurally-identical `Box`) avoids a
   *  hazard↔collision import cycle. */
  isContact?(state: S, player: PlayerState, hitbox: Rect): boolean;
}
