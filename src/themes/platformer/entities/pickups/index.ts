import type { PickupKind } from '../../contracts/PickupKind';
import { coin } from './Coin';
import { fruit } from './Fruit';
import { key } from './Key';
import { heart } from './Heart';
import { bomb } from './Bomb';

/** Every pickup type in the game. Adding a pickup is one line here plus its
 *  own module — pickups live in separate homogeneous arrays (unlike enemies),
 *  so every call site already knows statically which type it is iterating
 *  and no dispatcher is needed.
 *
 *  The `satisfies` clause pins the registry to the contract vocabulary, so a
 *  kind added to one side without the other fails to compile. */
export const PICKUP_TYPES = { coin, fruit, key, heart, bomb } satisfies Record<
  PickupKind,
  unknown
>;
