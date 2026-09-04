import { coin } from './Coin';
import { fruit } from './Fruit';
import { key } from './Key';
import { bonusFruit } from './BonusFruit';

/** Every pickup type in the game. Adding a pickup is one line here plus its
 *  own module — pickups live in separate homogeneous arrays (unlike enemies),
 *  so every call site already knows statically which type it is iterating
 *  and no dispatcher is needed. */
export const PICKUP_TYPES = { coin, fruit, key, bonusFruit };

/** Which pickup kind — named for this codebase's existing convention for
 *  "which variant" (`BlockKind`, `blockKind`, `ItemKind`). Deliberately not
 *  `PickupKey`: there IS a key pickup (`ItemKind = 'key'`), so that name would
 *  read as "the key pickup". */
export type PickupKind = keyof typeof PICKUP_TYPES;
