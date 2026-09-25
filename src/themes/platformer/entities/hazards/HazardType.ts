import type { WorldType, Boxed } from '../../contracts/WorldType';
import type { PlayerState } from '../Player';
import type { Rect } from '../../contracts/geometry';
import type { LevelDef } from '../../level/LevelData';
import type { BlockPlacement } from '../../level/BlockMapper';
import type { HazardPlacement } from '../../level/HazardMapper';
import type { GridTimerState } from '../../shared/timedTile';
import type { FloorSpikeTimerState } from './FloorSpike';
import type { FallingStalactiteTimerState } from './FallingStalactite';

/**
 * The caller-supplied inputs a stateful hazard kind reads to merge its live
 * per-tick state and compute its arming-trigger rects. Assembled by
 * `PlatformerState.hazardPlacementsForTick()` / `PlatformerPage.tsx` and passed
 * as a parameter, so a hook reads no state directly — no new
 * `entities/ → state/` edge. `crumblingFloorTimers` is typed against the
 * dependency-free `GridTimerState` shape (not `engine/CrumblingFloor`) so this
 * module gains no `entities/ → engine/` import, matching
 * `FallingStalactite.ts`'s existing choice.
 */
export interface HazardTickContext {
  floorSpikeTimers: readonly FloorSpikeTimerState[];
  fallingStalactiteTimers: readonly FallingStalactiteTimerState[];
  activeLevel: LevelDef;
  blockStates: readonly BlockPlacement[];
  crumblingFloorTimers: readonly GridTimerState[];
}

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
  /** Whether a qualifying non-lethal contact knocks the player back. `false`
   *  for the floor spike and falling stalactite (half-heart, no knockback);
   *  `true` for the spike and spear. The crouch suppression (a crouched hit
   *  never knocks back) is player-side and is NOT this flag. */
  knocksBack: boolean;
  /** Whether this specific overlap qualifies as a contact. Absent = always
   *  true (any `box` overlap), preserving every existing kind's behavior.
   *  The spear returns true only for a descent onto its top tips from above
   *  (O-020 FR-003). `PlayerState` is a type-only import and `Rect` (rather
   *  than `Collision.ts`'s structurally-identical `Box`) avoids a
   *  hazard↔collision import cycle. */
  isContact?(state: S, player: PlayerState, hitbox: Rect): boolean;
  /** Merges this kind's live per-tick state into the placement, returning a
   *  new placement. Only stateful kinds implement it (floor spike:
   *  phase/extension; falling stalactite: phase/offset/shake); every other
   *  kind passes through unchanged by omitting it (`?? placement`). Reads
   *  only its parameters — no state import. */
  withTickState?(placement: HazardPlacement, timers: HazardTickContext): HazardPlacement;
  /** The player-overlap rects (world space) that arm this hazard, returned
   *  only when the hazard is eligible to be newly armed (not already armed).
   *  Present only on armed-then-cycle kinds (floor spike: its trigger band;
   *  falling stalactite: its detection-zone cells as rects); a static kind
   *  (spike/spear) omits it. The engine overlaps the player's hitbox against
   *  each rect and arms the hazard once. Reads only its parameters. */
  armTriggerRects?(hazard: HazardPlacement, timers: HazardTickContext): readonly Rect[];
}
