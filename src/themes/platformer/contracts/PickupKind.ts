/** Which pickup kind — named for this codebase's existing convention for
 *  "which variant" (`BlockKind`, `blockKind`). Deliberately not `PickupKey`:
 *  there IS a key pickup (`'key'`), so that name would read as "the key
 *  pickup" rather than the whole vocabulary.
 *
 *  R-007 unified the former enemy-only held-item type into this contract:
 *  `EnemyType.heldItem` is now `PickupKind | null`, so a held drop and a
 *  spawned pickup share one vocabulary (the old alias was deleted outright,
 *  with no re-export). Spelled out here rather than derived from the
 *  `PICKUP_TYPES` registry, so this vocabulary stays a strict leaf the
 *  contracts layer can own. The registry conforms to it via a
 *  `Record<PickupKind, PickupType<Pickup>>` annotation, so the two cannot
 *  drift. */
export type PickupKind = 'coin' | 'fruit' | 'key' | 'heart' | 'bomb';
