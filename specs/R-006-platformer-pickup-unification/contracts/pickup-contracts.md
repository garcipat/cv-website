# Contract — Shared pickup vocabulary (`Pickup`, `PickupKind`, `CollectiblePlacement`)

Covers FR-001, FR-002, FR-006, FR-008, FR-011 and SC-002/SC-007/SC-008.

## Goal

Give every pickup state a discriminator, a shared base and **one collect-once flag** so the engine
dispatches generically and permanence is expressed only by array reset scope — while `contracts/`
stays a strict leaf and each kind's state stays self-contained.

## `Pickup` base — new `contracts/Pickup.ts`

```ts
import type { PickupKind } from './PickupKind';

/** Identity, stored position, discriminator and the single collect-once flag
 *  that every pickup state composes — mirroring EnemyState.type /
 *  BlockState.blockKind. Shared vocabulary, not an entity:
 *  level/CollectibleMapper and every pickup module import it downward. */
export interface Pickup {
  id: string;
  x: number;
  y: number;
  kind: PickupKind;
  /** The one collect-once mechanism: true once collected. Collected entries
   *  are retained, skipped on draw and collision, and never removed. */
  collected: boolean;
}

/** Per-kind live arrays for the generic dispatch functions. Partial so a
 *  caller with only some families (the editor preview) can pass just those. */
export type PickupGroups = Partial<Record<PickupKind, readonly Pickup[]>>;
```

- **Home:** `contracts/`, beside `PickupKind` (spec Clarification Q8).
- **Leaf:** imports only `./PickupKind`; no `level/`/`engine/`/`entities/`/state import.
- **No drift:** a state's `kind` equals its `PICKUP_TYPES` slot (asserted by the registry test).
- **One collect-once mechanism (SC-008):** `collected` is the only collect-once state. There is no
  external collected-id set and no per-kind removal/flag special case.

## `PickupKind` — `contracts/PickupKind.ts` (unchanged)

```ts
export type PickupKind = 'coin' | 'fruit' | 'key' | 'heart' | 'bomb';
```

`'fruit'` **remains first-class** — the live question-mark reward kind (R2 deviation from issue #94).
A `'fruit'`-dropping change is explicitly out of scope.

## `CollectiblePlacement` — `level/CollectibleMapper.ts`

```ts
import type { Pickup } from '../contracts/Pickup';

/** A placed coin collectible — purely positional. */
export interface CollectiblePlacement extends Pickup {
  kind: 'coin';
}
```

- The former `spriteType: 'coin'` field is **removed** (not kept as an alias — FR-006/FR-011).
- `placeCollectibles` emits `{ id, kind: 'coin', x, y, collected: false }`. Each placed coin's
  `collected` flag is held in `PlatformerState.baseCoinPlacements` (a mutable signal) so it survives
  death/respawn and is cleared only by a full reset — see
  [generic-dispatch.md](./generic-dispatch.md) and research R9.
- The dormant placed-fruit path stays retired: no fruit variant, branch or marker field (FR-006/US4).

**The coin's pickup trigger is NOT on this state — it is on the coin `PickupType`.** A `Pickup` value
is plain data with no lifecycle or behaviour, by design (spec Assumptions: "the collect seam produces
consequences, not state writes"). Collecting a coin is declared by the `coin` object in
`entities/pickups/Coin.ts` via its **non-optional** `onPickup` — the paced skill-fact reveal(s) from
`level/SkillFactPacing` and `counterKey: 'coins'` — and executed by the shared collect applier, which
first sets `collected: true` on the hit state. See [pickup-type.md](./pickup-type.md)'s per-kind
table and [generic-dispatch.md](./generic-dispatch.md). Every kind, coin included, has a trigger; a
pickup with no effect would be a kind whose `onPickup` returns nothing, which no shipped kind does.

## Registry pinning — `entities/pickups/index.ts`

```ts
import type { PickupKind } from '../../contracts/PickupKind';
import type { Pickup } from '../../contracts/Pickup';
import type { PickupType } from './PickupType';
import { coin } from './Coin';
import { fruit } from './Fruit';
import { key } from './Key';
import { heart } from './Heart';
import { bomb } from './Bomb';

export const PICKUP_TYPES: Record<PickupKind, PickupType<Pickup>> = {
  coin, fruit, key, heart, bomb,
};
```

The `Record<PickupKind, …>` annotation is the compile-time pin (a kind added to one side only fails to
compile), matching how `ENEMY_TYPES`/`BLOCK_TYPES` pin their own keys. Each module still annotates its
own value with its concrete `PickupType<S>` for internal safety.

## Invariants

1. **One home** — `Pickup`/`PickupGroups` exist only in `contracts/Pickup.ts`; no re-export or alias
   preserves a former path (FR-011).
2. **Direction** — `contracts/` imports nothing upward; `level/CollectibleMapper` and every
   `entities/pickups/*` import the base downward. No `level/ → entities/` or `contracts/ → level/`
   edge is created; `entities/pickups/Coin.ts`'s existing `level/CollectibleMapper` import is
   unchanged.
3. **One module per family** — no second state module for any kind survives under `entities/` (FR-005/
   SC-003); `entities/Health.ts` and `entities/Torch.ts` stay.
4. **Behaviour** — every constant value, box size/offset and position value is numerically unchanged.
5. **Collect-once** — `collected` is the only collect-once state; collected entries are retained and
   flagged, and a future permanent kind reuses the same flag by composing `Pickup` (SC-008).
