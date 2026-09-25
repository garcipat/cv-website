# Contract — Generic dispatch: `checkPickupCollisions` and `drawPickups`

Covers FR-002, FR-003, FR-007, FR-010, SC-001, SC-006, SC-008.

## One collision entry point — `engine/Collision.ts`

```ts
export interface PickupHit { kind: PickupKind; state: Pickup }

export function checkPickupCollisions(
  player: PlayerState,
  groups: PickupGroups,
  ctx: PickupCollisionContext,
): PickupHit[];
```

**Semantics.** For each kind present in `groups`:

1. `overlappingTriggers` (the existing shared helper, unchanged) with
   `boxOf = (s) => PICKUP_TYPES[kind].box(s)` and
   `eligible = (s) => !s.collected && (PICKUP_TYPES[kind].isCollectible?.(s, ctx) ?? true)`.
2. Apply `PICKUP_TYPES[kind].maxPerTick?.(ctx)` to the result in array order (`slice`); at the cap the
   kind yields nothing.
3. Concatenate per-kind results in `groups` insertion order.

**The shared base gate is `!state.collected`.** Every kind is ineligible once its state is collected,
through the one flag on `Pickup` — there is no `collectedIds` context field and no per-kind
collected-set. Each kind's optional `isCollectible` adds only its own extra gate.

**Removed (no shim/re-export — FR-011):** `checkCollectibleCollisions`, `checkFruitCollisions`,
`checkKeyPickupCollisions`, `checkHeartPickupCollisions`, `checkBombPickupCollisions`.
`overlappingTriggers` and `aabbOverlap` remain, still shared with chest/sign/hazard checks.

### Eligibility gate mapping

| Current function | Gate | Generic source |
| --- | --- | --- |
| `checkCollectibleCollisions` | `!collectedIds.has(id)` | coin base gate `!state.collected` (no extra gate) |
| `checkFruitCollisions` | `elapsed >= FRUIT_RISE_DURATION_SECONDS` | fruit `isCollectible` |
| `checkKeyPickupCollisions` | `!collected` | key base gate `!state.collected` (no extra gate) |
| `checkHeartPickupCollisions` | `hitPoints < MAX_HALF_HEARTS` | heart `isCollectible` (`ctx.playerHitPoints`) |
| `checkBombPickupCollisions` | `slice(0, max(0, cap − count))` | bomb `maxPerTick = ctx.capacity ?? 0` |

The caller computes `ctx.capacity = Math.max(0, MAX_BOMBS - carriedBombs.value)` so the cap thread
stays visible at the call site.

## One draw entry point — `engine/Renderer.ts`

```ts
export function drawPickups(
  ctx: CanvasRenderingContext2D,
  groups: PickupGroups,
  dc: DrawContext,
  layer?: PickupDrawLayer,
): void;
```

**Semantics.**

1. For each kind in `groups` (insertion order), skip the kind when `layer` is given and
   `PICKUP_TYPES[kind].drawLayer !== layer`.
2. Track a per-kind index over **all** items (incremented before the visibility test) so a coin's
   frame/placement index stays stable regardless of which entries have been collected.
3. Skip an item when `item.collected` — the shared visibility rule. There is **no collected-id
   parameter** and no per-kind `isVisible`.
4. Otherwise `PICKUP_TYPES[kind].draw(item, dc, index)`.

**Removed (no shim/re-export — FR-011):** `drawCollectibles`, `drawFruits`, `drawKeyPickups`,
`drawHeartPickups`, `drawBombPickups`.

### Draw bands (order preservation)

The current page draws fruit before blocks, coins before enemies, and keys/hearts/bombs after enemies,
so `drawPickups` is invoked at **three** bands (FR-003 / US1-AC3 require order preservation relative
to enemies):

| Band (`layer`) | Kinds | Page position |
| --- | --- | --- |
| `belowBlocks` | fruit | before `drawBlocks` (PlatformerPage ~804) |
| `beforeEnemies` | coin | after `drawEffects(…,'midWorld')`, before `drawEnemies` (~865/869) |
| `afterEnemies` | key, heart, bomb | after `drawEnemies` (~871–875) |

The band is declared by each kind (`drawLayer`) so the page never names a kind; a new kind picks its
band without a page edit.

## Page wiring (`PlatformerPage.tsx`)

```ts
const groups = pickupGroups.value;                 // PlatformerState: kind → live array
// draw — one function, three bands, no kind names, no collected-id set:
drawPickups(ctx, groups, drawContext, 'belowBlocks');
drawPickups(ctx, groups, drawContext, 'beforeEnemies');
drawPickups(ctx, groups, drawContext, 'afterEnemies');

// collision — one function; the base gate is each state's own `collected`:
const hits = checkPickupCollisions(playerState.value, groups, {
  playerHitPoints: playerState.value.hitPoints,
  capacity: Math.max(0, MAX_BOMBS - carriedBombs.value),
});

// collect — one shared applier: flag every hit, then apply its consequences
for (const kind of kindsWithHits) {
  const ids = new Set(hitsFor(kind).map((h) => h.state.id));
  pickupStores[kind].markCollected(ids);          // the ONE collect-once action
  // ...apply onPickup consequences uniformly (no disposition switch)
}
```

**Same-tick pacing.** The applier seeds `collectedBefore` from the pre-tick flagged count and advances
it per processed hit, so N coins collected in one tick reveal N successive fact windows exactly as
today (FR-009).

The per-kind arrays and reset scopes stay exactly as today (Clarification Q6): `resetGame()` keeps the
coin/fruit/key arrays (flags intact) and clears the heart/bomb arrays + placed bombs;
`resetGameProgress()` clears every pickup array and re-derives the placed coins uncollected. The
page's block terminal-outcome path spawns via
`pickupStores[kind].append(PICKUP_TYPES[kind].spawn(source))` and collects via the shared outcome
applier — neither branches on a kind name (FR-004/SC-002).

## Editor wiring (`editor/EditorCanvas.tsx`)

```ts
drawPickups(
  ctx,
  { coin: synthesizeCollectiblePlacements(grid) },  // every placement collected:false
  drawContext,
);
```

No `layer` (draw all present kinds, in the editor's existing order) and no collected-id set. Every
synthesized placement is `collected: false`, so the preview is pixel-identical. No `drawCollectibles`
symbol remains anywhere in the theme (SC-001).

## Kind-agnostic guarantee

- The page/collision/renderer/sprite-loader contain no pickup-kind comparison and no per-kind spawn or
  collect branch (SC-001/SC-002).
- Collect-once has exactly one mechanism: the shared `collected` flag. There is no
  `collectedCollectibleIds`, no per-kind removal/flag and no `disposition` switch; a future permanent
  kind composes `Pickup` and is simply not cleared on death (SC-008).
- Adding a pickup kind = one `entities/pickups/<Kind>.ts` module + one `PICKUP_TYPES` line. A brand-new
  family additionally declares its signal and `pickupStores`/`pickupGroups` entry in
  `PlatformerState.ts` (where signals live); the page/collision/renderer/loader are untouched
  (FR-007/SC-006; see research R9 for the honest boundary).
- The sprite loader keeps discovering assets from each type's `sprite.sheet`
  (`collectSheetSources` over `PICKUP_TYPES`) — no registry edit (FR-007).
