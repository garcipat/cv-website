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
