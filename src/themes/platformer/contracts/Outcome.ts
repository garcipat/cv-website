import type { CollectedFact } from '../types';
import type { Rect } from './geometry';
import type { PickupKind } from './PickupKind';
import type { CounterPopupLabelKey } from './counters';

/**
 * What an entity asks the engine to do to the PLAYER about a contact.
 * Composed by every family's outcome type rather than restated per family, so
 * "bounce the player" means one thing everywhere.
 *
 * Deliberately two small interfaces (this and `RewardEffects`) rather than one
 * outcome type covering everything: see `CollisionOutcome`'s doc comment —
 * an outcome type that grows past a handful of fields has become the
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
   * (`stompBounceVelocity`, -330) and a pot landing
   * (`potBounceVelocity`, -220) are deliberately different strengths, so
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
   * transient visual (`FlyingTextEffect`/`PuffEffect`/`CounterPopupEffect`),
   * whereas a spawned pickup is real world state the player can walk over and
   * collect. `'fruit'` names the rising, fact-carrying reward a question-mark
   * block drops (the former `'bonusFruit'`; R-002 FR-022).
   */
  spawnPickup?: PickupKind;
}

/**
 * The narrow world interface a defeated enemy's `EnemyType.onDefeat` hook uses
 * to fire its consequences. Supplied by the shared reward applier
 * (`state/enemyRewards.ts`); the kind never writes engine state directly and
 * never returns a reward value — a defeat may fire several consequences (spawn
 * a pickup, reveal several facts, bump a counter) in one call, or none (the
 * bee). This is the `onDefeat(entity, world)` hook shape `CollisionOutcome`'s
 * own doc comment reserves for anything beyond a handful of `RewardEffects`
 * fields.
 *
 * Leaf-safe: imports only `../types` (`CollectedFact`) and sibling `contracts/`
 * types (`PickupKind`, `CounterPopupLabelKey`).
 */
export interface DefeatApi {
  /** Spawns a pickup of `kind` at the enemy's position (its `x`/`y` at the
   *  moment of defeat), routed through `PICKUP_TYPES[kind].spawn` + the
   *  generic pickup store — never a page-side `spawnKeyPickup` call. */
  spawnPickup(kind: PickupKind): void;
  /** Reveals one fact at the enemy's position. Per-fact: a kind that owns
   *  several facts (a green slime with `fact` + `extraFacts`) calls this once
   *  per fact. */
  revealFact(fact: CollectedFact, effectId: string): void;
  /** Requests a transient HUD counter popup for `key`. The applier dedupes by
   *  key and flushes after the `rewardGiven`/`deathEffectGiven` update, so
   *  several same-tick defeats bump a key exactly once. */
  bumpCounter(key: CounterPopupLabelKey): void;
}

export type ContactSide = 'top' | 'side' | 'bottom';

/**
 * The geometry of one player-versus-entity overlap, computed once by the
 * engine and handed to the entity's type so it can decide what the contact
 * MEANS. The engine never decides consequences; the type never computes
 * geometry.
 */
export interface Contact {
  /** 'top' iff the player is falling AND its hitbox bottom edge is at or above
   *  the entity hitbox's vertical midpoint — the rule that distinguishes
   *  "jumped on" from "walked into". */
  side: ContactSide;
  playerVx: number;
  playerVy: number;
  playerBox: Rect;
  selfBox: Rect;
}

/**
 * What an entity asks the engine to do about a contact. Returned as data
 * rather than applied directly so the hook stays a pure function — no signals,
 * no canvas — and the engine remains the only writer of game state.
 *
 * `RewardReveal.ts` is the one sanctioned exception to that "only writer"
 * rule: the per-tick reveal trigger writes `collectedFacts` and the unified
 * `activeEffects` collection (via `spawnEffect`) directly rather than staging
 * them back through the engine, because five call sites across three families
 * would otherwise each need their own staging array.
 *
 * Keep this small. It is the shared vocabulary of everything that can happen
 * in the world; if it grows past a handful of fields it has become the
 * scattered conditionals it replaced. Anything exotic goes through an
 * `onDefeat(entity, world)` style hook receiving a narrow WorldApi instead.
 *
 * Folded in here from the removed `contracts/Contact.ts` (R-002 FR-020) so the
 * contract vocabulary has one home and stays a strict `contracts/` leaf.
 */
export interface CollisionOutcome<S> extends PlayerEffects {
  /** Replacement state, if the contact changed this entity. */
  self?: S;
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
