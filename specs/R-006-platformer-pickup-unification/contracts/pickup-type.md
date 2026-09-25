# Contract — `PickupType<S>` spawn/collect seam and outcome vocabulary

Covers FR-001, FR-002, FR-004, FR-006, FR-008, FR-009 and US2/SC-008.

## Goal

Each pickup kind's own module owns how it is spawned from a source and what collecting it asks for,
surfaced as consequences that a shared applier executes — so the page names no kinds and a new kind
needs no page edit to spawn or collect.

## `PickupType<S>` — `entities/pickups/PickupType.ts`

```ts
import type { Rect } from '../../contracts/geometry';
import type { WorldType, Boxed } from '../../contracts/WorldType';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { DrawContext } from '../../contracts/DrawContext';
import type { Pickup } from '../../contracts/Pickup';
import type { PickupKind } from '../../contracts/PickupKind';
import type { CollectedFact } from '../../types';
import type {
  PickupCollisionContext,
  PickupContext,
  PickupOutcome,
} from '../../contracts/PickupOutcome';

/** The band drawPickups draws this kind in (see generic-dispatch.md). */
export type PickupDrawLayer = 'belowBlocks' | 'beforeEnemies' | 'afterEnemies';

/** Where and how a pickup is created from its source (a block today). */
export interface PickupSpawnSource {
  id: string;
  x: number;
  y: number;
  fact?: CollectedFact;
  /** Lazy so only a kind that consumes an icon advances the shared counter. */
  iconIndex?: () => number;
}

export interface PickupType<S extends Pickup = Pickup> extends WorldType<S>, Boxed<S> {
  key: PickupKind;                                             // narrowed per module
  sprite: SpriteDescriptor;
  drawLayer: PickupDrawLayer;

  box(state: S): Rect;                                         // unchanged
  frameIndex(state: S, elapsed: number, index: number): number; // unchanged
  bobOffset(state: S, elapsed: number): number;                // unchanged
  draw(state: S, dc: DrawContext, index?: number): void;       // unchanged

  spawn(source: PickupSpawnSource): S;
  /** OPTIONAL extra eligibility gate on top of the shared `!state.collected`
   *  base gate (fruit rise, heart full-health). Omitted = no extra gate. */
  isCollectible?(state: S, ctx: PickupCollisionContext): boolean;
  maxPerTick?(ctx: PickupCollisionContext): number;
  onPickup(state: S, ctx: PickupContext): PickupOutcome;
}
```

**Method syntax is deliberate.** Declaring members as methods (not function-typed properties) keeps
`PickupType<ConcreteState>` assignable to the widened `PickupType<Pickup>` used by the generic engine
dispatch under `strictFunctionTypes`, with no `any`.

**Removed:** `isVisible`. Visibility is the shared `!state.collected`; there is no per-kind visibility
special case (SC-008). The base `collected` flag is not a `PickupType` member — it lives on the state.

## Outcome vocabulary — in `contracts/Pickup.ts` (leaf)

```ts
export interface PickupReveal {
  fact: CollectedFact;
  effectId: string;
  counterKey?: CounterPopupLabelKey;
}

export interface PickupCollisionContext {
  playerHitPoints: number;
  /** Remaining room for a kind that caps per-tick collection (bomb). */
  capacity?: number;
}

export interface PickupContext {
  /** Reward pool a fact-resolving kind may read. */
  pool: readonly CollectedFact[];
  /** Total sources of this kind in the level. */
  total: number;
  /** Sources of this kind already collected before this tick. */
  collectedBefore: number;
}

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
```

There is **no `PickupDisposition`** (`'remove' | 'flag' | 'dedup'`) and no `self` replacement — every
kind is stored and flagged alike, so the collection-storage instruction the old model carried is
deleted. `PickupCollisionContext` also no longer carries `collectedIds`: the shared base gate is
`!state.collected`. The module imports only `../types` and `./counters`, so `contracts/` stays a leaf.

## Why consequences, not state writes

Spec Assumptions: `onPickup` "describes consequences (which counter/reward, heal, bomb/key banking,
flying text) that a shared applier executes", mirroring `BlockType.onHit` → `RewardEffects`. The one
universal state write (setting `collected: true`) belongs to the shared applier, not to any kind. The
coin's dynamic skill-fact pacing is resolved *inside* `Coin.ts` (calling `level/SkillFactPacing`'s
`revealedFactCountFor` with `ctx.pool`/`ctx.total`/`ctx.collectedBefore`) and returned as `facts`,
not leaked into the page.

## Per-kind mapping (the module table)

| kind | `spawn` | `isCollectible` (extra gate) | `maxPerTick` | `drawLayer` | `onPickup` |
| --- | --- | --- | --- | --- | --- |
| coin | `{id,kind:'coin',x,y,collected:false}` | — | — | `beforeEnemies` | facts from pool pacing; `counterKey:'coins'` |
| fruit | `spawnFruit(id,x,y,fact,iconIndex)` | `elapsed >= FRUIT_RISE_DURATION_SECONDS` | — | `belowBlocks` | `state.fact` (if any) with `counterKey:'fruits'` |
| key | `spawnKeyPickup(id,x,y)` | — | — | `afterEnemies` | `bankKey:true`; `flyingText` target `'keyCounter'` |
| heart | `spawnHeartPickup(id,x,y)` | `ctx.playerHitPoints < MAX_HALF_HEARTS` | — | `afterEnemies` | `heal: HEART_PICKUP_HEAL_AMOUNT` |
| bomb | `spawnBombPickup(id,x,y)` | — | `ctx.capacity ?? 0` | `afterEnemies` | `bombs: 1` |

Every `spawn` seeds `collected: false` via the shared base. Every kind's collect-once is the same
shared flag, not a per-kind behaviour.

## Shared applier responsibilities (page/state layer)

The applier has no kind-name branch and no disposition switch. For each kind's `PickupHit`s:

1. Compute each hit's `PickupContext` from the pre-tick state (`collectedBefore` = the count of this
   kind's entries already flagged `collected`; coin `pool`/`total` from `levelTotals`), then
   **advance the running `collectedBefore` per processed hit** so several same-tick coins reveal
   successive fact windows exactly as the current `coinsCollectedSoFar` loop does (FR-009; spec edge
   case "Multiple pickups overlapped in one tick").
2. Call `PICKUP_TYPES[kind].onPickup(hit.state, ctx)` and gather the consequences.
3. **Set the flag:** `pickupStores[kind].markCollected(new Set(hits.map((h) => h.state.id)))` — the
   applier's one collect-once action; nothing is removed.
4. Apply the consequences:
   - `facts` → `revealFact(fact, { x: state.x, y: state.y, effectId, counterKey })`.
   - `counterKey` → bump `startCounterPopup(key, collectedBefore + hitsThisTick, levelTotals[key])`
     once per tick (coin's `'coins'`).
   - `heal` → `healDamage(player.hitPoints, heal)` and spawn one heal-aura effect per healing hit.
   - `bombs` → `carriedBombs += bombs`.
   - `bankKey` → `collectedKeys += n`.
   - `flyingText` → `startFlyingText(…)`; `target:'keyCounter'` maps to the existing
     `keyCounterX`/`KEY_COUNTER_Y` HUD position, `'journal'` to the existing journal target.

## Invariants

1. **No page kind branch** — the page's spawn dispatch and collect dispatch never compare against a
   pickup-kind literal (FR-004/SC-002).
2. **Eligibility owned by the kind (extra gates only)** — the shared `!state.collected` base gate is
   applied by the generic collision path; each kind's own `isCollectible` adds only fruit-rise /
   heart-full-health, and the bomb cap is its `maxPerTick` (spec edge cases).
3. **Behaviour preserved** — gates, rewards, counters, draw depth and reset scopes are unchanged
   (FR-009).
4. **Collect-once is one mechanism** — `collected` on `Pickup` is the only collect-once state; the
   applier's only collect-once action is setting that flag; no kind removes its entry and no external
   id set exists (FR-002/SC-008). A future permanent kind composes `Pickup` and is not cleared on
   death to get the same behaviour for free.
