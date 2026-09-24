/** Which pickup kind — named for this codebase's existing convention for
 *  "which variant" (`BlockKind`, `blockKind`, `ItemKind`). Deliberately not
 *  `PickupKey`: there IS a key pickup (`ItemKind = 'key'`), so that name would
 *  read as "the key pickup".
 *
 *  Spelled out here rather than derived from the `PICKUP_TYPES` registry, so
 *  this vocabulary stays a strict leaf the contracts layer can own. The
 *  registry conforms to it via `satisfies Record<PickupKind, unknown>`, so the
 *  two cannot drift. */
export type PickupKind = 'coin' | 'fruit' | 'key' | 'heart' | 'bomb';
