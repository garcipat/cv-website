import type { PickupKind } from '../../contracts/PickupKind';
import type { Pickup } from '../../contracts/Pickup';
import type { PickupType } from './PickupType';
import { coin } from './Coin';
import { fruit } from './Fruit';
import { key } from './Key';
import { heart } from './Heart';
import { bomb } from './Bomb';

/**
 * Every pickup type in the game. Adding a pickup is one line here plus its own
 * module — the engine (`checkPickupCollisions`/`drawPickups`) and the page
 * dispatch on `kind`, so no call site names a pickup kind and no sprite
 * registry needs editing: the loader discovers assets from each type's
 * `sprite.sheet`.
 *
 * The `Record<PickupKind, …>` annotation pins the registry to the contract
 * vocabulary, so a kind added to one side without the other fails to compile.
 * The per-kind signal arrays stay separate (see PlatformerState.ts); the
 * shared thing here is the type contract.
 */
export const PICKUP_TYPES: Record<PickupKind, PickupType<Pickup>> = {
  coin,
  fruit,
  key,
  heart,
  bomb,
};
