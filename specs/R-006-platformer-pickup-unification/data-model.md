# Data Model — Platformer Pickup Unification (R-006)

Phase 1 output. This feature adds **no runtime data**: no JSON, level, marker, sprite, or
`localStorage` shape changes (spec Assumptions: "No data migration"). The "data model" here is the
**module and type structure** the refactor introduces or changes. It is organized by the feature's
user stories and by concept.

> **Re-plan note (2026-09-25, after spec amendment).** Collect-once is unified into a single
> `collected: boolean` on the shared `Pickup` model. Every kind is **stored and flagged**; nothing is
> removed on collect. The `PickupDisposition = 'remove' | 'flag' | 'dedup'` vocabulary, the per-kind
> `self` replacement, the external `collectedCollectibleIds` set and the `isVisible` member are all
> gone. Permanence is expressed **only** by array reset scope (SC-008). The base coins are held as a
> mutable, flag-carrying signal (section 5).

Conventions (from [docs/Architecture.md](../../docs/Architecture.md) and the platformer's own
conventions): named exports, `PascalCase` for type-like modules, `camelCase` for function/registry
modules, `contracts/` is a strict leaf, and co-located `.test.ts` files.

---

## 1. Contract vocabulary (new / changed)

### `Pickup` — `contracts/Pickup.ts` (NEW, leaf)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | Identity within the kind's array; coin ids are position-derived, others reuse the source's id. |
| `x` | `number` | Stored world x (no longer derived on read). |
| `y` | `number` | Stored world y (fruit now keeps this in sync with its rise easing). |
| `kind` | `PickupKind` | Discriminator; MUST equal the state's `PICKUP_TYPES` slot. |
| `collected` | `boolean` | **The single collect-once flag.** `true` once collected; the entry is retained, skipped on draw/collision, and never removed. |

Also exported here: `PickupGroups = Partial<Record<PickupKind, readonly Pickup[]>>`.

### `PickupKind` — `contracts/PickupKind.ts` (UNCHANGED)

`'coin' | 'fruit' | 'key' | 'heart' | 'bomb'`. `'fruit'` **stays** (R2 deviation). Pinned to
`PICKUP_TYPES` by the registry's `Record<PickupKind, …>` annotation.

### `CollectiblePlacement` — `level/CollectibleMapper.ts` (CHANGED)

```ts
export interface CollectiblePlacement extends Pickup { kind: 'coin'; }
```

`id`/`x`/`y`/`collected` come from `Pickup`; `spriteType: 'coin'` is **removed**. `placeCollectibles`
emits `{ id, kind: 'coin', x, y, collected: false }`. The dormant placed-fruit path stays retired (no
fruit variant/branch/marker field).

### Collect outcome vocabulary — in `contracts/Pickup.ts` (leaf)

| Type | Shape | Consumer |
| --- | --- | --- |
| `PickupReveal` | `{ fact: CollectedFact; effectId: string; counterKey?: CounterPopupLabelKey }` | shared reveal trigger |
| `PickupCollisionContext` | `{ playerHitPoints: number; capacity?: number }` | `isCollectible` / `maxPerTick` — **no `collectedIds`** |
| `PickupContext` | `{ pool: readonly CollectedFact[]; total: number; collectedBefore: number }` | `onPickup` (coin pacing) |
| `PickupOutcome` | `{ facts?; counterKey?; heal?; bombs?; bankKey?; flyingText? }` | shared collect applier — **consequences only** |

**Deleted:** `PickupDisposition` (`'remove' | 'flag' | 'dedup'`) and `PickupOutcome.self`. There is no
per-kind collection storage instruction of any kind; the applier sets `collected: true` itself and
then applies `PickupOutcome`'s consequences. All fields are primitives or `contracts/`+`types.ts`
types, so the module stays a leaf (it imports only `../types` and `./counters`).

---

## 2. Per-kind state (each composes `Pickup`, including `collected`)

| Kind | State type | Module | Fields beyond `Pickup` |
| --- | --- | --- | --- |
| `coin` | `CollectiblePlacement` | `entities/pickups/Coin.ts` | *(none — positional only)* |
| `fruit` | `FruitState` | `entities/pickups/Fruit.ts` | `startY`, `restY`, `elapsed`, `fact?`, `iconIndex` |
| `key` | `KeyPickupState` | `entities/pickups/Key.ts` | *(none — `collected` now comes from `Pickup`)* |
| `heart` | `HeartPickupState` | `entities/pickups/Heart.ts` | *(none)* |
| `bomb` | `BombPickupState` | `entities/pickups/Bomb.ts` | *(none)* |

Every state's `collected` now comes from the shared base — including the key, whose former inline
`collected` field is gone (its own module still seeds/reads it, but the field is declared once on
`Pickup`). The position-only states are structurally `Pickup` plus their extra tween/flag fields, so
the generic engine treats them uniformly at runtime while each module keeps its narrowed type.

State carries **no behaviour** (spec Assumptions: the collect seam produces consequences). Each kind's
pickup trigger is its `PickupType.onPickup` in the same merged module — coin: paced skill fact +
`coins` counter; fruit: reveal `fact` + `fruits` counter; key: bank key + flying text; heart: heal;
bomb: add a bomb. No shipped kind has an empty trigger, and no `onPickup` removes an entry.

### State transitions (all flags — nothing is removed)

- **fruit rise:** `spawnFruit` → `y = startY`, `collected: false` (elapsed 0). `tickFruit(f, dt)` →
  `elapsed += dt` and `y = startY + (restY - startY) * clamp01(elapsed / FRUIT_RISE_DURATION_SECONDS)`.
  Collectible only once `elapsed >= FRUIT_RISE_DURATION_SECONDS` **and** `!collected`; on collect →
  `collected: true`, retained. Draws in the `belowBlocks` band so its source block occludes it
  mid-rise.
- **key:** `spawnKeyPickup` → `collected: false`. On collect → `collected: true`, retained (flagged),
  skipped on draw and collision.
- **coin:** each entry (base or spawned) carries `collected`; on collect the entry is flagged in
  place (base → `baseCoinPlacements`, pot drop → `spawnedCoinPlacements`) and retained.
- **heart/bomb:** on collect → `collected: true`, retained; `resetGame()` clears their arrays.

### Reset scopes — the ONLY per-kind difference (FR-009/SC-008)

| Kind | Death/respawn (`resetGame`) | Full reset (`resetGameProgress`) |
| --- | --- | --- |
| coin | persists (`baseCoinPlacements` flags intact; `spawnedCoinPlacements` kept) | base re-derived `collected:false`; spawned cleared |
| fruit | persists (flags intact) | cleared |
| key | persists (flags intact) | cleared (+ `collectedKeys = 0`) |
| heart | cleared | cleared |
| bomb | cleared (+ `carriedBombs = 0`, `placedBombs` cleared) | cleared |

The reset functions keep their explicit per-signal writes; no generic reset abstraction is introduced.
Permanence is array lifetime alone: a future permanent kind composes `Pickup` and is simply not
cleared in `resetGame()`.

---

## 3. `PickupType<S extends Pickup>` — `entities/pickups/PickupType.ts`

Existing members unchanged: `key`, `sprite`, `box`, `frameIndex`, `bobOffset`, `draw`.
Changed/added members (full signatures in [contracts/pickup-type.md](./contracts/pickup-type.md)):

| Member | Purpose |
| --- | --- |
| `key: PickupKind` | Narrowed per module; must equal the registry slot. |
| `drawLayer: PickupDrawLayer` | Which band (`belowBlocks` / `beforeEnemies` / `afterEnemies`) this kind draws in — lets `drawPickups` place it without the page naming the kind. |
| `spawn(source: PickupSpawnSource): S` | Module owns how the kind is created from a block (later enemy) source, including its id/position/fact convention, lazy icon index and `collected: false` seed. |
| `isCollectible?(state, ctx): boolean` | **Optional extra** eligibility gate on top of the shared `!state.collected` base gate (fruit rise, heart full-health). Omitted = no extra gate. |
| `maxPerTick?(ctx): number` | A kind's per-tick selection cap (bomb capacity); omitted = unlimited. |
| `onPickup(state, ctx): PickupOutcome` | Declares what collecting asks for as consequences (facts, counter, heal, bombs, banked key, flying text). |
| ~~`isVisible`~~ | **Removed** — visibility is the shared `!state.collected`. |

`PICKUP_TYPES` is `Record<PickupKind, PickupType<Pickup>>`, keeping the compile-time pin while giving
the engine a uniform view.

## 4. Generic dispatch (`engine/`)

### `checkPickupCollisions` — `engine/Collision.ts`

```ts
interface PickupHit { kind: PickupKind; state: Pickup }
function checkPickupCollisions(
  player: PlayerState,
  groups: PickupGroups,
  ctx: PickupCollisionContext,
): PickupHit[];
```

Per kind: `overlappingTriggers` with the kind's `box` and
`eligible = (s) => !s.collected && (PICKUP_TYPES[kind].isCollectible?.(s, ctx) ?? true)`, then
`maxPerTick` slice. Replaces `checkCollectibleCollisions`, `checkFruitCollisions`,
`checkKeyPickupCollisions`, `checkHeartPickupCollisions`, `checkBombPickupCollisions` (all deleted).
`overlappingTriggers` is unchanged and still shared with chest/sign/hazard checks.

### `drawPickups` — `engine/Renderer.ts`

```ts
function drawPickups(
  ctx: CanvasRenderingContext2D,
  groups: PickupGroups,
  dc: DrawContext,
  layer?: PickupDrawLayer,
): void;
```

Per kind: `drawLayer` filter, per-kind index over all items (incremented before the visibility test),
skip when `item.collected`, then `PICKUP_TYPES[kind].draw(item, dc, index)`. Replaces
`drawCollectibles`, `drawFruits`, `drawKeyPickups`, `drawHeartPickups`, `drawBombPickups` (all
deleted). The former `collectedIds` parameter is removed — visibility is `!item.collected`.

## 5. State wiring (`PlatformerState.ts`)

| Export | Type | Purpose |
| --- | --- | --- |
| `collectiblePlacements` | `ComputedSignals<CollectiblePlacement[]>` | Pure, level-derived base-coin placements; read by `levelTotals` (never invalidated by collect/pot drop). |
| `baseCoinPlacements` | `Signal<CollectiblePlacement[]>` | **NEW mutable** base-coin state carrying each placed coin's `collected` flag. Initialised from `collectiblePlacements`; re-derived uncollected only by `resetGameProgress()` (the editor Try seam). Survives `resetGame()`. |
| `spawnedCoinPlacements` | `Signal<CollectiblePlacement[]>` | Coin-pot drops this session (each entry carries `collected`). |
| `allCollectiblePlacements` | `ComputedSignals<CollectiblePlacement[]>` | `baseCoinPlacements` + `spawnedCoinPlacements` — the single read view. |
| `pickupStores` | `Record<PickupKind, PickupStore>` | Kind→array adapter: `items` (live read view), `append` (spawn target; coin = `spawnedCoinPlacements`), `markCollected` (the shared applier's one collect-once action; coin updates **both** base and spawned arrays). |
| `pickupGroups` | `ComputedSignals<PickupGroups>` | The single per-kind groups value the page passes to both generic dispatch functions. |

Existing signals (`fruitStates`, `keyPickupStates`, `heartPickupStates`, `bombPickupStates`,
`carriedBombs`, `collectedKeys`) keep their names, types (states gain `kind`/`collected`), and reset
scopes. **`collectedCollectibleIds` is DELETED** — its coin-dedup role is now the base/spawned
entries' own `collected` flags, and `coinsCollectedSoFar` becomes
`allCollectiblePlacements.value.filter((p) => p.collected).length`.

## 6. Module map (created / changed / deleted)

- **Created:** `contracts/Pickup.ts` (the `Pickup` model + `PickupGroups` + the collect-outcome vocabulary).
- **Merged (state into view):** `entities/pickups/{Coin,Fruit,Key,Heart,Bomb}.ts`.
- **Deleted:** `entities/{Fruit,Coin,KeyPickup,HeartPickup,BombPickup}.ts` (+ their top-level tests,
  relocated).
- **Changed dispatch:** `engine/Collision.ts`, `engine/Renderer.ts`, `PlatformerPage.tsx`,
  `PlatformerState.ts`.
- **Changed imports/fields only:** `contracts/PickupKind.ts` (unchanged content),
  `level/CollectibleMapper.ts`, `editor/{EditorCanvas.tsx,gridRenderState.ts}`,
  `components/Journal.tsx`, `entities/sprites/sheets.ts`, `entities/enemies/SlimePurple.ts`,
  `entities/pickups/index.ts`.
- **Unchanged in place:** `entities/Health.ts`, `entities/Torch.ts`, `entities/CollectiblesSummary.ts`.

## 7. Relationships

```
contracts/PickupKind  ──owns──▶ PickupKind (leaf union)
contracts/Pickup      ──composes──▶ PickupKind; provides id/x/y/kind/collected
contracts/PickupOutcome ──references──▶ CollectedFact, CounterPopupLabelKey (leaf)
level/CollectiblePlacement ──extends──▶ Pickup (kind:'coin', collected)
entities/pickups/PickupType<S extends Pickup> ──consumes──▶ Pickup, PickupOutcome, SpriteDescriptor, DrawContext
entities/pickups/<Kind> ──exports──▶ state type + constants + PickupType<S> view
entities/pickups/index  ──registry──▶ PICKUP_TYPES: Record<PickupKind, PickupType<Pickup>>
engine/Collision ──reads──▶ PICKUP_TYPES + PickupGroups (checkPickupCollisions; base gate !collected)
engine/Renderer  ──reads──▶ PICKUP_TYPES + PickupGroups (drawPickups; skip !collected)
PlatformerState  ──provides──▶ baseCoinPlacements + pickupStores/pickupGroups; owns arrays, counters, reset scopes
PlatformerPage   ──drives──▶ generic draw (3 bands) + generic collision + shared collect applier (flags + consequences)
```
