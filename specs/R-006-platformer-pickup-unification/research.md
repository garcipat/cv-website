# Research — Platformer Pickup Unification (R-006)

Phase 0 output. Every "NEEDS CLARIFICATION" in the Technical Context is resolved here, and every
spec assumption/clarification that touches a concrete code shape is validated against the current
source.

> **Re-plan note (2026-09-25, after spec amendment).** The spec gained a collect-once clarification:
> **`collected: boolean` on the shared `Pickup` model is the single collect-once mechanism**; every
> kind is stored and flagged and nothing is removed on collect; the external `collectedCollectibleIds`
> set and the per-kind `PickupDisposition = 'remove' | 'flag' | 'dedup'` vocabulary are deleted;
> `checkPickupCollisions`'s base gate is `!state.collected`; `drawPickups` takes no collected-id set;
> and permanence is expressed **only** by array reset scope (SC-008). Findings R1, R3, R5, R6, R7, R8,
> R9 and R10 below were regenerated to reflect that amendment. R2 (the fruit-kind deviation from
> issue #94), R4 (the module merge + sheet cycle) and R12 (out of scope) are unchanged.

> Method note: findings below were produced by reading the actual `src/themes/platformer/` modules
> (not the analysis doc's line numbers, which drift). Where the spec's illustrative wording and the
> current source disagree, the discrepancy is called out and a resolution is recorded.

The spec's Clarifications (session 2026-09-25) fix the big decisions: the `kind` discriminator shape,
keeping `'fruit'`, the `Pickup` base contents (including `collected`), `CollectiblePlacement` joining
the family, one `drawPickups` at multiple depths with no merged collection, the editor routing through
`drawPickups`, one module per family, `contracts/` owning the base, and the unified collect-once
mechanism. This document resolves the remaining *planning* decisions those clarifications leave open
(hook shapes, exact signatures, the mutable base-coin seam, the sheet-cycle hazard, and the draw-band
count).

---

## R1 — The shared `Pickup` base lives in `contracts/Pickup.ts`

**Decision.** Add `src/themes/platformer/contracts/Pickup.ts`:

```ts
import type { PickupKind } from './PickupKind';

/** Identity, stored position, discriminator and the single collect-once flag
 *  that every pickup state composes — mirroring `EnemyState.type` /
 *  `BlockState.blockKind`. Lives in `contracts/` beside `PickupKind` (spec
 *  Clarification Q8): it is shared vocabulary, not an entity, and
 *  `level/CollectibleMapper`'s `CollectiblePlacement` composes it. */
export interface Pickup {
  id: string;
  x: number;
  y: number;
  kind: PickupKind;
  /** The one collect-once mechanism (FR-002/SC-008): true once collected.
   *  Nothing is removed on collect; collected entries are skipped on draw and
   *  collision. */
  collected: boolean;
}

/** Per-kind live arrays, keyed by kind. Partial so a caller that only has some
 *  families (the editor preview) can pass just those. */
export type PickupGroups = Partial<Record<PickupKind, readonly Pickup[]>>;
```

**Rationale.** The spec's Clarification Q8 is explicit: `contracts/`, not `entities/`, so
`level/CollectibleMapper` and every pickup module import it downward. `contracts/` importing
`./PickupKind` (itself in `contracts/`) and only lib types keeps it a strict leaf (R-001 FR-002).
`collected` on the base is the amended spec's core change (FR-001/FR-002/SC-008).

**Alternatives considered.** Putting `Pickup` in `entities/pickups/PickupType.ts` — rejected: it
would create a `level/ → entities/` edge (CollectiblePlacement would import it) and a file cycle with
`entities/pickups/Coin.ts`'s existing `level/CollectibleMapper` import. Putting it in
`contracts/PickupKind.ts` — rejected: the vocabulary module stays a pure union (R-002's kind-unions
contract), and a base interface is a separate concern.

**TypeScript note (no `any`).** `PickupType<S>` members are declared with **method syntax** so that
`PickupType<ConcreteState>` remains assignable to the widened `PickupType<Pickup>` used by the generic
engine dispatch (method parameters are bivariant; function-typed *properties* are checked
contravariantly under `strictFunctionTypes`). See R6.

---

## R2 — The `'fruit'` kind stays: a deliberate deviation from issue #94

**Decision.** Keep `'fruit'` in `contracts/PickupKind.ts`, keep `entities/pickups/Fruit.ts` (now the
merged reward-fruit module), and keep `PICKUP_TYPES.fruit`. R-006 retires only the already-dead
placed-fruit vocabulary.

**Evidence (current source).**
- `contracts/PickupKind.ts` is `'coin' | 'fruit' | 'key' | 'heart' | 'bomb'`.
- `RewardEffects.spawnPickup?: PickupKind` (`contracts/Outcome.ts`), and `BlockMapper`'s
  question-mark outcome returns `spawnPickup: 'fruit'`.
- `PlatformerPage.tsx` ticks `fruitStates` (line 1262), spawns via `spawnFruit` (2060), and collects
  via `checkFruitCollisions` / reveal (1459–1475).
- `PICKUP_TYPES.fruit` is used by `Collision.ts` and `Renderer.ts`'s fruit draw.
- R-002 FR-022 already removed `CollectibleMarkerPositions.fruit`, the `placeCollectibles` fruit
  branch and `entities/BonusFruit.ts`; `CollectiblePlacement.spriteType` is already `'coin'`-only.

**Rationale.** Removing `'fruit'` would break the registry and `RewardEffects.spawnPickup`, and would
force the reward-vocabulary unification that is R-007's (analysis D2). The spec (Clarifications,
FR-006, US4-AC3, Assumptions) explicitly supersedes issue #94's literal bullet. The amended spec adds
only that the live fruit is now **flagged `collected` rather than removed** — its kind is unchanged.

**Recorded in:** plan.md "Documented Deviation from Issue #94". Implementation MUST NOT remove the
live fruit kind, and MUST NOT leave the old `entities/Fruit.ts` as a second home.

---

## R3 — `CollectiblePlacement` composes `Pickup` with `kind: 'coin'` and `collected`

**Decision.** In `level/CollectibleMapper.ts`:

```ts
import type { Pickup } from '../contracts/Pickup';

export interface CollectiblePlacement extends Pickup {
  kind: 'coin';
}
```

`placeCollectibles` emits `{ id, kind: 'coin', x, y, collected: false }`; the `spriteType` field is
deleted (not kept as an alias — FR-006/FR-011).

**Rationale.** Spec Clarification Q4/FR-001/FR-006: the placed coin was the one pickup keyed by
`spriteType`; `kind: 'coin'` makes the generic collision/draw paths uniform and makes FR-001 literally
true. `Pickup` supplies `id`/`x`/`y`/`collected`, so the interface only narrows `kind`. Every placed
coin now carries the shared collect-once flag, which is why the base placements must be held mutably
(R9).

**Ripple (all mechanical `spriteType → kind`, plus a `collected` field):** `PlatformerState.ts:392`,
`Journal.tsx:464`, `PlatformerPage.tsx:1403/1410/1446/2068`, `editor/gridRenderState.ts:111`, and
their tests. Because `CollectiblePlacement` is always a coin, the existing always-true filters
(`p.spriteType === 'coin'`) are rewritten to `p.kind === 'coin'` verbatim to avoid a
behaviour-adjacent simplification; the plan does not mandate dropping them. `gridRenderState`'s
`synthesizeCollectiblePlacements` emits `collected: false` for every synthesized preview placement.

---

## R4 — One module per family; the `sprites/sheets.ts` cycle hazard

**Decision (merges, spec Clarification Q7/FR-005).** Each family becomes exactly one self-contained
module under `entities/pickups/`, and the top-level module is deleted:

| Merged module | Absorbs | Deleted |
| --- | --- | --- |
| `entities/pickups/Coin.ts` | current view + `entities/Coin.ts` (frame constants, `coinFrameIndex`, `coinBobOffset`, bob constants) | `entities/Coin.ts` |
| `entities/pickups/Fruit.ts` | current view + `entities/Fruit.ts` (frame constants, `FRUIT_ICON_ORDER`, `fruitFrameSource`, rise duration, `FruitState`, `spawnFruit`, `tickFruit`, `fruitY`) | `entities/Fruit.ts` |
| `entities/pickups/Key.ts` | current view + `entities/KeyPickup.ts` (frame/rendered dims, tile offsets, `KeyPickupState`, `spawnKeyPickup`) | `entities/KeyPickup.ts` |
| `entities/pickups/Heart.ts` | current view + `entities/HeartPickup.ts` | `entities/HeartPickup.ts` |
| `entities/pickups/Bomb.ts` | current view + `entities/BombPickup.ts` | `entities/BombPickup.ts` |

`entities/Health.ts` and `entities/Torch.ts` stay put (US3-AC2/SC-003). `coinBobOffset` (used by
key/heart/bomb too) resolves from its moved home `entities/pickups/Coin.ts` without duplication
(US3-AC4) and other pickup modules import it from `./Coin`.

**Hazard found and resolved — the new import cycle.** `entities/sprites/sheets.ts` currently imports
`KEY_FRAME_WIDTH/HEIGHT` from `../KeyPickup`, `COIN_FRAME_SIZE/COUNT` from `../Coin`, and
`FRUIT_FRAME_SIZE/FRUIT_ICON_COLUMNS` from `../Fruit` (lines 2–4). Each current view module imports
its `*_SHEET` from `../sprites/sheets`. Merging state+view into `pickups/<Kind>.ts` therefore turns
those edges into a cycle `sprites/sheets.ts ⇄ pickups/<Kind>.ts` (e.g. `sheets` needs
`COIN_FRAME_SIZE` at module-eval time to build `COIN_SHEET`, while `pickups/Coin.ts` imports
`COIN_SHEET`), which would throw at runtime from the temporal-dead-zone.

**Resolution.** `sheets.ts` stops importing the pickup modules and declares the KEY/COIN/FRUIT sheet
geometry with its own literals — the same convention it already uses for `BOMB_SHEET`, `SLIME_*`,
`HEARTS_SHEET` etc. The pickup modules remain the single behavioural source of truth for addressing
constants. Add/keep assertions that the two agree, extending the existing
`entities/pickups/PickupType.test.ts` pattern (`FRUIT_SHEET.columns === FRUIT_ICON_COLUMNS`) with
`COIN_SHEET.frameWidth === COIN_FRAME_SIZE`, `COIN_SHEET.columns === COIN_FRAME_COUNT`,
`KEY_SHEET.frameWidth === KEY_FRAME_WIDTH`, `KEY_SHEET.frameHeight === KEY_FRAME_HEIGHT`. Values are
unchanged (US3-AC3/FR-005).

**Other importer retargets (import path only):** `entities/enemies/SlimePurple.ts` (KEY frame dims),
`components/Journal.tsx` (COIN frame size/count, FRUIT frame size), plus every test listed in the
plan's tree. No other module imports the deleted files.

**Alternative considered.** Moving the frame-size constants into `sprites/sheets.ts` as their home —
rejected: the spec's Clarification Q7 requires each family to be *self-contained*, and the sheet file
already duplicates such numbers for every other sheet.

---

## R5 — `FruitState` composes `Pickup` (stored `y`, `collected`); the rise tween stays byte-identical

**Decision.** `FruitState` composes `Pickup` and adds `kind: 'fruit'`, keeping `fact`, `iconIndex`,
`startY`, `restY`, `elapsed`. `x`/`y`/`collected` are the base's stored fields. `spawnFruit` seeds
`y = startY`, `collected: false` (elapsed 0). `tickFruit(fruit, dt)` computes
`elapsed' = elapsed + dt` and `y' = startY + (restY - startY) * clamp01(elapsed' /
FRUIT_RISE_DURATION_SECONDS)`, i.e. exactly the value the existing `fruitY` produces; `fruitY` may
remain as the shared easing helper the tick uses.

**Rationale.** Spec Clarification Q3/FR-001: every state stores a raw position, and a rising fruit
updates its stored `y` from the existing easing each tick rather than computing `y` on read; positions
stay identical. `fruit.box` now reads `fruit.y` (via the base) instead of calling `fruitY`, and
`PlatformerPage`'s reveal uses `fruit.y` instead of `fruitY(fruit)` (same value). Under the amended
spec the fruit is **retained and flagged** (`collected: true`) on collect rather than removed, so its
`collected` flag is the same shared mechanism every other kind uses (FR-002/SC-008).

**Test note.** Existing assertions that compare against `fruitY(fruit)` are re-expressed against the
stored `y` (same numeric expectations, e.g. `y === 200`, `y === 200 - RENDERED_TILE_SIZE`, mid-rise
proportional value) — strengthened, not weakened, because both the stored field and the easing can be
asserted to agree. Fruit collection tests now assert the entry is retained with `collected: true`
rather than absent from the array.

---

## R6 — `PickupType<S>` gains the spawn/collect seam; consequences only, no disposition

**Decision.** Extend `entities/pickups/PickupType.ts` (keeping every existing geometry/appearance
member) with:

```ts
import type { Pickup } from '../../contracts/Pickup';
import type { PickupKind } from '../../contracts/PickupKind';
import type {
  PickupCollisionContext,
  PickupContext,
  PickupOutcome,
} from '../../contracts/PickupOutcome';

export type PickupDrawLayer = 'belowBlocks' | 'beforeEnemies' | 'afterEnemies';

export interface PickupSpawnSource {
  id: string;
  x: number;
  y: number;
  fact?: CollectedFact;
  /** Lazy icon supplier so only a kind that consumes an icon advances the
   *  shared fruit-icon counter (preserves the current counter progression). */
  iconIndex?: () => number;
}

export interface PickupType<S extends Pickup = Pickup> extends WorldType<S>, Boxed<S> {
  key: PickupKind;
  sprite: SpriteDescriptor;
  drawLayer: PickupDrawLayer;                 // which band this kind draws in (R8)
  box(state: S): Rect;                        // unchanged
  frameIndex(state: S, elapsed: number, index: number): number;   // unchanged
  bobOffset(state: S, elapsed: number): number;                   // unchanged
  draw(state: S, dc: DrawContext, index?: number): void;          // unchanged

  spawn(source: PickupSpawnSource): S;                            // NEW
  /** OPTIONAL extra eligibility gate ON TOP OF the shared `!state.collected`
   *  base gate (fruit rise, heart full-health). Omitted = no extra gate. */
  isCollectible?(state: S, ctx: PickupCollisionContext): boolean; // NEW
  maxPerTick?(ctx: PickupCollisionContext): number;               // NEW — bomb cap only
  onPickup(state: S, ctx: PickupContext): PickupOutcome;          // NEW — consequences only
}
```

`isVisible` is **removed**: visibility is the shared `!state.collected`, and there is no per-kind
visibility special case (SC-008). `onPickup` is non-optional and returns only consequences.

**Collect vocabulary** (co-located in `contracts/Pickup.ts`, leaf-safe — imports only `CollectedFact`
from `../types` and `CounterPopupLabelKey` from `./counters`; it needs no separate module because
there is no `self`):

```ts
export interface PickupReveal {
  fact: CollectedFact;
  effectId: string;
  counterKey?: CounterPopupLabelKey;
}

export interface PickupCollisionContext {
  playerHitPoints: number;
  /** Remaining room for a kind that caps its per-tick collection (bomb). */
  capacity?: number;
}

export interface PickupContext {
  /** Reward pool a fact-resolving kind may read (coin: skill-fact pool). */
  pool: readonly CollectedFact[];
  /** Total sources of this kind in the level (coin: `levelTotals.coins`). */
  total: number;
  /** Sources of this kind already collected before this tick. */
  collectedBefore: number;
}

export interface PickupOutcome {
  /** Facts to reveal through the shared reveal trigger. */
  facts?: readonly PickupReveal[];
  /** A counter popup bumped by the applier (coin: 'coins'), accumulated per tick. */
  counterKey?: CounterPopupLabelKey;
  heal?: number;       // heart
  bombs?: number;      // bomb
  bankKey?: boolean;   // key's permanent HUD counter
  flyingText?: { effectId: string; label: string; x: number; y: number; target: 'journal' | 'keyCounter' };
}
```

There is **no `PickupDisposition`**, no `self`, and no `remove`/`flag`/`dedup`. The shared applier's
one collect-once action is to set `collected: true` on every hit state (via the store, R9); the
returned consequences are then applied (R9).

**Why plain data, not state writes.** Spec Assumptions: the seam "produces consequences (which
counter/reward, heal, bomb/key banking, flying text) that a shared applier executes", mirroring
`BlockType.onHit` returning `RewardEffects`. The coin's dynamic fact pacing stays in `Coin.ts`
(`onPickup` calls `level/SkillFactPacing`'s `revealedFactCountFor` with
`ctx.pool`/`ctx.total`/`ctx.collectedBefore`) rather than leaking pacing into the page.
`PickupCollisionContext` carries primitives only (no `PlayerState`) so `contracts/Pickup.ts`
stays a leaf (R-001 SC-007).

**Per-kind module table** (the concrete values the merged modules implement):

| kind | state (module) | `spawn` | `isCollectible` (extra gate) | `maxPerTick` | `drawLayer` | `onPickup` |
| --- | --- | --- | --- | --- | --- | --- |
| `coin` | `CollectiblePlacement` (Coin) | `{id,kind:'coin',x,y,collected:false}` | — | — | `beforeEnemies` | facts resolved from pool pacing; `counterKey:'coins'` |
| `fruit` | `FruitState` (Fruit) | `spawnFruit(...)` | `elapsed >= FRUIT_RISE_DURATION_SECONDS` | — | `belowBlocks` | `state.fact` (if any) with `counterKey:'fruits'` |
| `key` | `KeyPickupState` (Key) | `spawnKeyPickup(...)` | — | — | `afterEnemies` | `bankKey:true`; static `flyingText` target `'keyCounter'` |
| `heart` | `HeartPickupState` (Heart) | `spawnHeartPickup(...)` | `ctx.playerHitPoints < MAX_HALF_HEARTS` | — | `afterEnemies` | `heal: HEART_PICKUP_HEAL_AMOUNT` |
| `bomb` | `BombPickupState` (Bomb) | `spawnBombPickup(...)` | — | `ctx.capacity ?? 0` | `afterEnemies` | `bombs: 1` |

The concrete per-kind factory helpers (`spawnFruit`, `spawnKeyPickup`, `spawnHeartPickup`,
`spawnBombPickup`) are kept exported from the merged modules and used by the `spawn` hook, so existing
factories/tests need only their import path updated. Every kind's `collected` flag is seeded
`false` at spawn by the shared base.

**Registry pinning.** `PICKUP_TYPES` becomes
`export const PICKUP_TYPES: Record<PickupKind, PickupType<Pickup>> = { coin, fruit, key, heart, bomb };`.
The explicit `Record<PickupKind, …>` annotation preserves the compile-time pin (a missing/extra kind
errors) while giving the engine a uniform widened view. Each module still annotates its own value
(`const coin: PickupType<CollectiblePlacement> = {...}`) for internal type-safety.

**Alternatives considered.** (a) A per-kind `PickupType` union with a mapped `StateFor<K>` registry —
more type-precise but complicates every generic call site for no runtime benefit; rejected. (b) Keeping
`isCollectible` logic in `Collision.ts` keyed by kind — rejected by the spec edge case ("supplied by
the kind module"). (c) Passing `PlayerState` in the collision context — rejected (would break the
`contracts/` leaf). (d) Keeping a `disposition`/`isVisible` member to mirror the old model — rejected:
the amended spec deletes that vocabulary and SC-008 forbids a per-kind collect-once special case.

**TS bivariance fallback.** If the widened registry assignment is rejected by the compiler (the
assignability note in R1), use a single documented widening helper typed as
`(kind: PickupKind) => PickupType<Pickup>` — no cast to `any` is permitted.

---

## R7 — One generic `checkPickupCollisions` with `!collected` as the base gate

**Decision.** In `engine/Collision.ts`:

```ts
export interface PickupHit { kind: PickupKind; state: Pickup; }

export function checkPickupCollisions(
  player: PlayerState,
  groups: PickupGroups,
  ctx: PickupCollisionContext,
): PickupHit[];
```

Semantics, exactly preserving today's rules (FR-002):

1. For each kind present in `groups`, call `overlappingTriggers` (the existing shared helper,
   unchanged) with `boxOf = (s) => PICKUP_TYPES[kind].box(s)` and
   `eligible = (s) => !s.collected && (PICKUP_TYPES[kind].isCollectible?.(s, ctx) ?? true)`.
   The `!s.collected` term is the **shared base gate**; the optional `isCollectible` supplies only the
   kind's extra gate.
2. Apply the kind's `maxPerTick?.(ctx)` to the resulting list in array order (`slice`); at the cap the
   kind contributes nothing. This is where the bomb's `max(0, cap - count)` rule now lives.
3. Concatenate per-kind results in `groups` insertion order; each hit is `{ kind, state }`.

`overlappingTriggers` stays exported and tested as-is (it is shared with chest/sign/hazard checks).
The engine names no kind; the page never branches on one.

**Per-kind gate preservation (maps 1:1 to the current five functions):**

| Today | Generic equivalent |
| --- | --- |
| `checkCollectibleCollisions` (`!collectedIds.has`) | coin base gate `!state.collected` (no extra gate) |
| `checkFruitCollisions` (`elapsed >= RISE`) | fruit `isCollectible` (module reads its own `FRUIT_RISE_DURATION_SECONDS`) |
| `checkKeyPickupCollisions` (`!collected`) | key base gate `!state.collected` (no extra gate) |
| `checkHeartPickupCollisions` (early return `hitPoints >= MAX_HALF_HEARTS`) | heart `isCollectible` returning `ctx.playerHitPoints < MAX_HALF_HEARTS` |
| `checkBombPickupCollisions` (`slice(0, max(0, cap - count))`) | bomb `maxPerTick(ctx) = ctx.capacity ?? 0` |

`capacity` is computed by the caller as `Math.max(0, MAX_BOMBS - carriedBombs.value)` (the current
`checkBombPickupCollisions` argument), so the cap thread stays visible at the call site.

**SC-008 boundary.** Collision no longer consults any collected-id set; collect-once is the single
`state.collected` flag. A future permanent kind gets the base gate for free, so it needs no new
collision machinery.

**Test mapping.** Each `Collision.test.ts` describe migrates to a `checkPickupCollisions` call with
the same fixture and expected ids (and the same shape of assertion, e.g.
`hits.filter(h => h.kind === 'coin').map(h => h.state.id)`). The old `collectedIds`-set coin fixtures
become entries carrying `collected: true` (the same scenario: a collected coin is excluded, two
uncollected placements returned in order). The bomb clamp tests keep their concrete `(count, cap)`
inputs and expected `['b1']` / `['b1','b2']` / `[]`. See the plan's "Test Migration & Restructuring".

---

## R8 — `drawPickups` (no id set), per-type index, and the actual draw bands

**Decision.** In `engine/Renderer.ts`:

```ts
export function drawPickups(
  ctx: CanvasRenderingContext2D,
  groups: PickupGroups,
  dc: DrawContext,
  layer?: PickupDrawLayer,
): void;
```

Semantics (FR-003):

1. For each kind in `groups` (insertion order), skip the kind when `layer` is given and
   `PICKUP_TYPES[kind].drawLayer !== layer`.
2. Track a per-kind index over **all** items of the kind (incremented before the visibility check) so
   a coin's frame/placement index stays stable regardless of which entries are collected
   (US1-EDGE "per-type index stability"; now that collected entries are retained this is exactly what
   keeps the index stable).
3. Skip drawing an item when `item.collected` (the shared visibility rule — there is no per-kind
   `isVisible` and no collected-id-set argument).
4. Otherwise call `PICKUP_TYPES[kind].draw(item, dc, index)` — one dispatch, no family wrappers.

**The draw-band finding.** An earlier draft grouped the pickups into "two draw depths (fruit before
blocks; coin/key/heart/bomb after effects)"; the amended spec states **three** bands (Clarifications,
US1-AC3, FR-003). Reading the actual render order in `PlatformerPage.tsx`
(lines 804, 865–875) shows **coins draw before enemies** while **keys/hearts/bombs draw after
enemies**. FR-003/US1-AC3 make order preservation relative to *enemies* mandatory, so `drawPickups`
is invoked at **three** bands:

| Band | `layer` value | Kinds placed | Page position (current lines) |
| --- | --- | --- | --- |
| before terrain occlusion | `belowBlocks` | fruit | before `drawBlocks` (804) |
| after mid-world effects, before enemies | `beforeEnemies` | coin | after `drawEffects(…,'midWorld')`, before `drawEnemies` (867/869) |
| after enemies | `afterEnemies` | key, heart, bomb | after `drawEnemies` (871–875) |

This still satisfies "one `drawPickups` function invoked at more than one depth" (FR-003); the
parenthetical's "two" was illustrative, and the third band is the one the enemy interleave requires.
The per-kind `drawLayer` metadata is what keeps the page from naming kinds, so a new kind picks its
band without a page edit.

**Editor routing (Clarification Q7/FR-003, task delta 7).** `EditorCanvas` replaces its
`drawCollectibles` call with
`drawPickups(ctx, { coin: synthesizeCollectiblePlacements(grid) }, drawContext)` — no `layer` (draw
all present kinds in the editor's existing order) and **no collected-id set**; every synthesized
placement is `collected: false`, so it draws exactly as before. No `drawCollectibles` symbol remains
anywhere (SC-001).

**Call-site shape.** The page reads a single `pickupGroups` value (R9) and calls:
`drawPickups(ctx, pickupGroups.value, drawContext, 'belowBlocks')` and the other two bands (read once
per frame to avoid three computed re-reads).

**Alternatives considered.** Filtering kinds by passing explicit arrays per band (page names bands) —
rejected (page edit per new kind). Putting a skip set into `DrawContext` — rejected: `DrawContext` is
a contracts leaf, and visibility is now just `!collected`.

---

## R9 — Page/state dispatch: mutable base coins, `pickupStores` + `pickupGroups`, one applier

**Decision — the mutable base-coin signal (`PlatformerState.ts`).** The base coins are level-derived
from a `computed` and must now carry writable `collected` flags that survive death/respawn (the
external id set is gone). Keep the pure computed and add one mutable signal:

```ts
/** Pure, level-derived placed-coin placements. Never mutate these: `levelTotals`
 *  reads them and must not be invalidated by a coin collect or a pot drop. */
export const collectiblePlacements = computed<CollectiblePlacement[]>(() =>
  placeCollectibles(COIN_TILES.value),
);

/** Mutable base-coin state — a copy of `collectiblePlacements` carrying each
 *  placed coin's `collected` flag. Held separately so a flag is not lost when
 *  the level-derived computed re-evaluates, and survives death/respawn.
 *  Initialised at module load and re-derived ONLY by `resetGameProgress()` —
 *  which is also the seam the editor's Try already calls after swapping the
 *  level (`editor/editorActions.ts`), so a level change re-derives it too. */
export const baseCoinPlacements = signal<CollectiblePlacement[]>(
  collectiblePlacements.value.map((p) => ({ ...p, collected: false })),
);

/** Coin-pot drops this session (each entry carries its own `collected`). */
export const spawnedCoinPlacements = signal<CollectiblePlacement[]>([]);

/** The single read view for collision/draw/totals. */
export const allCollectiblePlacements = computed<CollectiblePlacement[]>(() => [
  ...baseCoinPlacements.value,
  ...spawnedCoinPlacements.value,
]);
```

`collectedCollectibleIds` is **deleted** (SC-008). The coin-pacing `coinsCollectedSoFar` becomes
`allCollectiblePlacements.value.filter((p) => p.collected).length` (same count, no set).

**Decision — `pickupStores` (kind→array adapter).** To keep `PlatformerPage.tsx` free of kind names
while the per-kind arrays stay separate (Clarification Q6):

```ts
export interface PickupStore {
  readonly items: ReadonlySignal<readonly Pickup[]>;
  append(state: Pickup): void;                       // spawn target
  /** The shared applier's ONE collect-once action: set `collected: true` on the
   *  given ids. Nothing is removed (FR-002/SC-008). */
  markCollected(ids: ReadonlySet<string>): void;
}

export const pickupStores: Record<PickupKind, PickupStore> = { /* coin, fruit, key, heart, bomb */ };

export const pickupGroups = computed<PickupGroups>(() => ({
  coin: allCollectiblePlacements.value,   // base placements + spawned coins
  fruit: fruitStates.value,
  key: keyPickupStates.value,
  heart: heartPickupStates.value,
  bomb: bombPickupStates.value,
}));
```

- The four plain signals (`fruit`, `key`, `heart`, `bomb`) are backed by a tiny `signalStore(signal)`
  helper: `items` = the signal, `append` = `signal.value = [...signal.value, s]`, `markCollected(ids)`
  = `signal.value = signal.value.map((st) => ids.has(st.id) ? { ...st, collected: true } : st)`.
- The coin store is bespoke: `items` = `allCollectiblePlacements`, `append` = push onto
  `spawnedCoinPlacements` (a coin-pot's reward is always a spawned coin, never a base placement),
  and `markCollected(ids)` **updates BOTH arrays**:
  `baseCoinPlacements.value = baseCoinPlacements.value.map(flagMatching)` and
  `spawnedCoinPlacements.value = spawnedCoinPlacements.value.map(flagMatching)`. Coin ids are unique
  across the two arrays (base ids are `coin-<col>-<row>`; spawned ids reuse their pot's id), so the
  same id can never be flagged in both, and a placed coin's flag lands in `baseCoinPlacements` while a
  pot coin's flag lands in `spawnedCoinPlacements`.
- The casts needed at the generic boundary live in that one helper (a typed `as S`, never `any`).

**Spawn (page, replaces ~2053–2084).** The block terminal-outcome path becomes:

```ts
if (outcome.spawnPickup !== undefined) {
  const kind = outcome.spawnPickup;
  pickupStores[kind].append(
    PICKUP_TYPES[kind].spawn({
      id: block.id, x: block.x, y: block.y, fact: block.fact,
      iconIndex: () => nextFruitIcon++,   // lazy: only a fruit spawn advances it
    }),
  );
}
```

The lazy `iconIndex` supplier preserves the current counter progression exactly: today
`nextFruitIcon++` is evaluated only inside the `spawnPickup === 'fruit'` branch. The `spawn` hook
seeds `collected: false` on the new state.

**Collect (page, replaces ~1385–1567).** One shared applier processes the grouped
`checkPickupCollisions` result. For each kind:

1. Compute each hit's `PickupContext` **before** flagging, so `collectedBefore` starts at the pre-tick
   count: `pool`/`total` from the level/CVData (coin pacing), `collectedBefore =
   pickupGroups[kind] items with collected === true`; advance the running count per processed hit so
   multiple same-tick coins reveal successive fact windows (the current `coinsCollectedSoFar` staging).
2. Call `PICKUP_TYPES[kind].onPickup(hit.state, ctx)` per hit and collect the returned consequences.
3. Set the flag: `pickupStores[kind].markCollected(new Set(hits.map((h) => h.state.id)))` — this is the
   shared applier's only collect-once action.
4. Apply the consequences uniformly:
   - `facts` → `revealFact(fact, { x: state.x, y: state.y, effectId, counterKey })`;
   - `counterKey` (coin) → `startCounterPopup(key, collectedBefore + hitsThisTick,
     levelTotals[key])` once per tick;
   - `heal` → `healDamage(player.hitPoints, heal)` + one `startHealAuraEffect(id)` per healing hit;
   - `bombs` → `carriedBombs.value += bombs`;
   - `bankKey` → `collectedKeys.value += n`;
   - `flyingText` → `startFlyingText(…, target)` with `target === 'keyCounter'` mapped to the existing
     `keyCounterX`/`KEY_COUNTER_Y` position (still measured from the canvas HUD context).

No branch tests a pickup-kind name; the applier is parameterised only by the outcome vocabulary, and
no `disposition` switch exists.

**Reset scopes stay explicit (permanence = array lifetime only, task delta 5).**
- `resetGame()` (death/respawn) keeps `baseCoinPlacements` (flags intact), `spawnedCoinPlacements`,
  `fruitStates` and `keyPickupStates`; it clears `heartPickupStates`, `bombPickupStates` and
  `placedBombs` (and `carriedBombs = 0`), exactly as today. It does **not** touch the coin flags —
  previously it also left `collectedCollectibleIds` alone, so this is behaviour-identical.
- `resetGameProgress()` (full Reset Game / editor Try) re-derives the base coins uncollected
  (`baseCoinPlacements.value = collectiblePlacements.value.map((p) => ({ ...p, collected: false }))`),
  clears `spawnedCoinPlacements`, `fruitStates`, `heartPickupStates`, `keyPickupStates` (and, via
  `resetGame()`, the bomb array/placed bombs), and resets `collectedKeys = 0`. It **removes** the old
  `collectedCollectibleIds.value = new Set()` line.
- A future permanent pickup kind follows the same rule for free: compose `Pickup` and don't clear its
  array in `resetGame()` (SC-008).

**FR-007/SC-006 boundary (recorded honestly).** Adding a brand-new pickup *family* still declares its
signal and its `pickupStores`/`pickupGroups` line in `PlatformerState.ts` — the state layer is where
signals live, and the spec's "one module + one registry line" names the page/collision/renderer/sprite
registry, none of which is edited. A kind that reuses an existing store shape (e.g. a second
block-drop coin-like pickup) needs no state edit. This is the closest faithful realisation of SC-006
given the deliberately per-kind arrays; it is called out so implementation does not silently try to
merge arrays (which Clarification Q6 forbids).

---

## R10 — Test migration (no assertion weakened, skipped or deleted)

Every affected file and the required handling. The collection-storage change means the coin-dedup and
reset-scope scenarios legitimately change **shape** (an entry retained + flagged instead of an id set,
or removed) — but every scenario, gate and reset scope stays asserted (FR-010/SC-004/SC-008):

| Test file | Handling |
| --- | --- |
| `engine/Collision.test.ts` | **Restructure** the five family describes around `checkPickupCollisions`; every scenario and gate preserved (R7 table; plan's Test Migration section). The coin collect-once fixture changes from a `collectedIds` set to a `collected: true` entry (same assertion); import paths for fruit/key/heart/bomb change to `entities/pickups/…`. |
| `engine/Renderer.test.ts` | **Restructure** the five draw-wrapper describes around `drawPickups`; every visual assertion preserved (R8). Collected-skip assertions use `collected: true` entries and drop the id-set argument. |
| `editor/EditorCanvas.test.tsx` | `drawCollectibles` mock/assertion → `drawPickups`; assert `{coin: [objectContaining({kind:'coin', collected:false})]}` and **no** collected-id argument. |
| `editor/EditorToolbar.test.tsx`, `editor/LevelEditorPage.test.tsx` | Renderer mock rename only. `LevelEditorPage.test.tsx`'s Try test additionally asserts Try re-derives the base coins (flags cleared). |
| `editor/gridRenderState.test.ts` | `spriteType` → `kind`, plus `collected:false`. |
| `entities/pickups/index.test.ts` | `spriteType` → `kind`/`collected`; import paths; fruit stored-`y` assertions. |
| `entities/pickups/PickupType.test.ts` | Import paths; add the sheet/constant agreement assertions from R4. |
| `entities/{Fruit,Coin,KeyPickup,HeartPickup,BombPickup}.test.ts` | **Moved** co-located into `entities/pickups/` and merged with the view's coverage; no case dropped; per-kind collect tests assert retained + `collected:true`. |
| `level/CollectibleMapper.test.ts` | `spriteType` → `kind`; placements emit `collected:false`. |
| `components/Journal.test.tsx` | `spriteType` → `kind`. |
| `PlatformerState.test.ts` | `spriteType` → `kind`; the `collectedCollectibleIds` tests are re-expressed as base-coin flag persistence across `resetGame()` and re-derivation by `resetGameProgress()`; store/group wiring assertions added. |
| `PlatformerPage.test.tsx` | Kind/`collected`-shape updates; every pickup scenario (coin pacing off flagged entries, key flag, heart heal/full-health, bomb cap, block spawn, reset scopes) keeps its assertions. |
| `entities/WorldType.test.ts` | Continues iterating `PICKUP_TYPES`; each state's `kind === registry slot` is assertable (new `index.test.ts` case), matching the `ENEMY_TYPES`/`BLOCK_TYPES` idiom. |

New co-located coverage: `contracts/PickupOutcome` has no behaviour, so its vocabulary is exercised
through the per-kind `onPickup`/`isCollectible`/`maxPerTick` unit tests; `checkPickupCollisions`/
`drawPickups` generic behaviour is covered by the restructured suites plus explicit registry-dispatch
tests. One new assertion pair guards SC-008 directly: (a) a collected entry of any kind is retained
with `collected: true` and skipped by both generic paths, and (b) a collected base coin survives
`resetGame()` but is re-derived uncollected by `resetGameProgress()`.

---

## R11 — Layer and constitution re-check

- `contracts/Pickup.ts` imports only `./PickupKind`, `../types` (`CollectedFact`) and `./counters`
  (`CounterPopupLabelKey`) — no
  `engine/`/`entities/`/`level/`/state import, so `contracts/` remains a strict leaf (R-001 FR-002,
  SC-007/FR-008).
- No new `level/ → engine/` edge: `level/CollectibleMapper` now imports `contracts/Pickup` (downward),
  and `entities/pickups/Coin.ts`'s existing `level/CollectibleMapper` import is unchanged.
- No new `engine/ → state/` edge: the generic engine functions take `groups`/context as parameters;
  the state layer supplies them. The collect applier and `pickupStores` live in the state/page layer;
  `checkPickupCollisions` learns `!collected` from the value it is handed, not from state.
- `PickupKind` and `Pickup` both stay `contracts/` leaves (R-001 edge case "a contract that references
  a higher-layer type" is avoided by keeping the collision context primitive-only).
- FR-009/FR-010 behaviour preservation holds: tuning constants, eligibility gates, reset scopes,
  counters, the key flying-text target, and the bomb capacity rule are all unchanged in value and in
  observable effect. The only state-holding change — the mutable `baseCoinPlacements` signal — is
  behaviour-equivalent to the deleted `collectedCollectibleIds` set for coin permanence.
- SC-008 holds: `collected` on `Pickup` is the only collect-once state; no `collectedCollectibleIds`,
  no per-kind removal/flag special case; a future permanent kind composes `Pickup` and is not cleared
  on death.
- Post-Phase-1 Constitution Check: **PASS** (Principles I–V as in plan.md; no violation, no
  complexity exception required).

## R12 — Out of scope (unchanged plan)

`ItemKind`/`heldItem` and `EnemyType.onDefeat` + shared enemy reward applier (R-007/D2); hazard
knockback/`withTickState` and counter metadata (R-007); placeable world items (R-008); Renderer split
and atlas sharing (R-009); tile-module registry (R-015); mapper/editor unification (R-010);
state/page decomposition (R-011/R-012); sprite asset organisation (R-013); layer-boundary lint
(R-014). R-006 uses the existing `RewardEffects.spawnPickup` vocabulary and does not unify rewards.
