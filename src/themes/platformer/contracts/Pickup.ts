import type { CollectedFact } from '../types';
import type { CounterPopupLabelKey } from './counters';
import type { PickupKind } from './PickupKind';

/**
 * Identity, stored position, discriminator and the single collect-once flag
 * that every pickup state composes — mirroring `EnemyState.type` /
 * `BlockState.blockKind`. Shared vocabulary, not an entity: `level/CollectibleMapper`
 * and every pickup module import it downward, so it lives in `contracts/`
 * beside `PickupKind` rather than under `entities/` (which would create a
 * `level/ → entities/` file edge and a cycle with `entities/pickups/Coin.ts`'s
 * existing `level/CollectibleMapper` import).
 *
 * `collected` is THE one collect-once mechanism: true once collected. Collected
 * entries are retained, skipped on draw and collision, and never removed. A
 * state's `kind` MUST equal its slot in `PICKUP_TYPES` (pinned by the registry).
 */
export interface Pickup {
  id: string;
  /** Stored world x — no longer derived on read. */
  x: number;
  /** Stored world y — a rising fruit keeps this in sync with its rise easing. */
  y: number;
  kind: PickupKind;
  /** The one collect-once flag every kind shares. */
  collected: boolean;
}

/**
 * Per-kind live arrays for the generic dispatch functions (`checkPickupCollisions`,
 * `drawPickups`). Partial so a caller with only some families (the editor
 * preview) can pass just those.
 */
export type PickupGroups = Partial<Record<PickupKind, readonly Pickup[]>>;

/**
 * One CV fact a pickup asks the shared applier to reveal, plus the effect id
 * that unique-keys its flying text and (optionally) the counter popup it feeds.
 * A fact-resolving pickup returns these as data; the applier calls the reveal
 * trigger. Mirrors the reveal options `state/rewards.ts` already consumes.
 */
export interface PickupReveal {
  fact: CollectedFact;
  effectId: string;
  counterKey?: CounterPopupLabelKey;
}

/**
 * What a pickup kind's own eligibility gate may read. Carries no collected-id
 * set: the shared base gate is each state's own `!state.collected`.
 */
export interface PickupCollisionContext {
  playerHitPoints: number;
  /** Remaining room for a kind that caps per-tick collection (bomb). */
  capacity?: number;
}

/**
 * What a kind's `onPickup` may read to resolve its consequences. Only the coin
 * (the one kind whose reward is resolved dynamically by proportional pacing)
 * reads `pool`/`total`/`collectedBefore`.
 */
export interface PickupContext {
  /** Reward pool a fact-resolving kind may read. */
  pool: readonly CollectedFact[];
  /** Total sources of this kind in the level. */
  total: number;
  /** Sources of this kind already collected before this tick. */
  collectedBefore: number;
}

/**
 * The collect consequences one pickup kind asks for — counter/reward, heal,
 * bomb/key banking, flying text. There is deliberately no disposition and no
 * `self`: every kind is stored and flagged alike, and the shared applier's one
 * universal collect-once action is setting `collected: true` on the hit state.
 */
export interface PickupOutcome {
  facts?: readonly PickupReveal[];
  counterKey?: CounterPopupLabelKey;
  heal?: number;
  bombs?: number;
  bankKey?: boolean;
  flyingText?: {
    effectId: string;
    label: string;
    x: number;
    y: number;
    target: 'journal' | 'keyCounter';
  };
}
