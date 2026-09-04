import type { CollectedFact } from '../types';
import type { PickupKind } from '../entities/pickups';

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
