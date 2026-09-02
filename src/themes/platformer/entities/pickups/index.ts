import { coin } from './Coin';
import { fruit } from './Fruit';
import { key } from './Key';
import { bonusFruit } from './BonusFruit';

/** Every pickup type in the game. Adding a pickup is one line here plus its
 *  own module — pickups live in separate homogeneous arrays (unlike enemies),
 *  so every call site already knows statically which type it is iterating
 *  and no dispatcher is needed. */
export const PICKUP_TYPES = { coin, fruit, key, bonusFruit };

export type PickupTypeKey = keyof typeof PICKUP_TYPES;
