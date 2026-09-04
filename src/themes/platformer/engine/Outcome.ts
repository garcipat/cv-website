import type { CollectedFact } from '../types';
import type { PickupKind } from '../entities/pickups';
import type { CounterPopupLabelKey } from './CollectionEffects';

/**
 * What an entity asks the engine to do to the PLAYER about a contact.
 * Composed by every family's outcome type rather than restated per family, so
 * "bounce the player" means one thing everywhere.
 *
 * Deliberately two small interfaces (this and `RewardEffects`) rather than one
 * outcome type covering everything: see Contact.ts's `CollisionOutcome` doc
 * comment — an outcome type that grows past a handful of fields has become the
 * scattered conditionals it replaced, and a unified type would hand every
 * family fields that are meaningless to it.
 */
export interface PlayerEffects {
  /** Half-hearts to deal to the player. The engine ignores this while the
   *  player is invulnerable; no entity ever knows invulnerability exists. */
  damagePlayer?: number;
  /**
   * Upward velocity impulse in px/s (negative = up), supplied by the TYPE
   * rather than chosen by the applier — an enemy stomp
   * (`stompBounceVelocity`, -330) and a coin-pot landing
   * (`coinPotBounceVelocity`, -220) are deliberately different strengths, so
   * a boolean here could not express both. The engine applies it uniformly as
   * `vy` + `bounceAscending: true` (the flag that protects the impulse from
   * the variable-jump-height cut). Not to be confused with `knockback`'s
   * `'awayAndUp'`, which is an involuntary reaction and deliberately NOT
   * gated by `bounceAscending`.
   */
  bounceVelocity?: number;
  knockback?: 'none' | 'away' | 'awayAndUp';
}

/**
 * What an entity asks the engine to add to the WORLD about a contact or hit.
 * Consumed by `RewardReveal.ts` (`revealFact`) and by the engine's pickup
 * dispatch (`spawnPickup`).
 */
export interface RewardEffects {
  /** A CV fact to reveal — pushed to `collectedFacts`, flown to the journal,
   *  and counted in its counter popup, all by `RewardReveal.ts`. */
  revealFact?: CollectedFact;
  /**
   * Which HUD counter popup this reward feeds, declared by the entity rather
   * than assumed by the engine — a second fact-bearing block kind would
   * otherwise have its reveal silently attributed to whatever counter the
   * engine happened to hardcode. Omitting it means no transient popup at all,
   * which is the chest case: chests have a permanent HUD counter instead
   * (hence `CounterPopupLabelKey` having no `'chests'` member).
   */
  counterKey?: CounterPopupLabelKey;
  /**
   * Which pickup to spawn at this entity's position, keyed by `PICKUP_TYPES` —
   * one field rather than a boolean per spawnable thing, so a block that drops
   * a key needs no new field here.
   *
   * Deliberately NOT named `*Effect`: in this codebase an Effect is a
   * transient visual (`FlightEffect`/`PuffEffect`/`CounterPopupEffect`),
   * whereas a spawned pickup is real world state the player can walk over and
   * collect. Note `'fruit'` and `'bonusFruit'` are separate registry keys with
   * different state types — the rising, fact-carrying one a question mark
   * drops is `'bonusFruit'`.
   */
  spawnPickup?: PickupKind;
}

/**
 * The stronger of two bounce impulses, where "stronger" means more negative
 * (velocities are px/s with negative = up). Returns `candidate` when nothing
 * has been chosen yet, and keeps `current` on a tie.
 *
 * Exists so both aggregation sites — several enemies contacted in one tick
 * (`Collision.ts`) and several blocks hit in one tick
 * (`PlatformerPage.tsx`) — share one rule rather than re-deriving it, and so
 * the rule is testable with differing values: every entity type that bounces
 * today happens to use the same constant, which makes the tie-break
 * unobservable through either caller.
 *
 * The rule aggregates WITHIN a family, not across families: the enemy applier
 * writes `playerState.value` while the block applier writes the tick-local
 * `next`, so a stomp and a coin-pot landing in the same tick resolve
 * independently rather than picking the stronger of the two.
 */
export function strongerBounce(current: number | undefined, candidate: number | undefined): number | undefined {
  if (candidate === undefined) return current;
  if (current === undefined) return candidate;
  return candidate < current ? candidate : current;
}
