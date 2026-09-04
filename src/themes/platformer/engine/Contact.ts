import type { Rect } from '../entities/geometry';
import type { PlayerEffects } from './Outcome';

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
 * rule: the per-tick reveal trigger writes `collectedFacts`/`activeEffects`/
 * `activeCounterPopups` directly rather than staging them back through the
 * engine, because five call sites across three families would otherwise each
 * need their own staging array.
 *
 * Keep this small. It is the shared vocabulary of everything that can happen
 * in the world; if it grows past a handful of fields it has become the
 * scattered conditionals it replaced. Anything exotic goes through an
 * `onDefeat(entity, world)` style hook receiving a narrow WorldApi instead.
 */
export interface CollisionOutcome<S> extends PlayerEffects {
  /** Replacement state, if the contact changed this entity. */
  self?: S;
}
