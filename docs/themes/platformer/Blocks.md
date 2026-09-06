# Blocks

The block API: what a block kind declares, how a hit turns into an outcome, and every
file that must change to add one. Blocks are the tile-aligned, solid, stateful things
the player breaks — crates, question-mark blocks, fragile rocks, coin pots and potion
pots.

For where blocks sit in the wider entity model, see [Entities.md](Entities.md). For the
level characters that place them, see [LevelFormat.md](LevelFormat.md).

| Source | Holds |
|---|---|
| `src/themes/platformer/entities/blocks/BlockType.ts` | The `BlockType` interface and `BlockHitOutcome` |
| `src/themes/platformer/entities/blocks/index.ts` | `BLOCK_TYPES`, the whole registry |
| `src/themes/platformer/entities/blocks/Crate.ts`, `QuestionMark.ts`, `FragileRock.ts`, `CoinPot.ts`, `PotionPot.ts` | One module per kind |
| `src/themes/platformer/entities/blocks/drawBlockTile.ts` | The shared plain-tile blit |
| `src/themes/platformer/entities/blocks/coinPotRenderPlan.ts` | Coin-pot run merging and variant assignment |
| `src/themes/platformer/entities/Block.ts` | `BlockKind`, `BlockState`, hit application, lifecycle predicates |
| `src/themes/platformer/engine/BlockAI.ts` | The bump/shatter animation and its offset |
| `src/themes/platformer/engine/Outcome.ts` | `PlayerEffects` and `RewardEffects`, the outcome halves |
| `src/themes/platformer/engine/RewardReveal.ts` | The shared fact-reveal trigger |
| `src/themes/platformer/entities/CollectiblesSummary.ts` | `CounterKey` and `COUNTER_SECTIONS` |

## `BlockType`, field by field

`BlockType` composes `WorldType<BlockState>` and nothing else — blocks deliberately do
not compose `Boxed`, because physics locates them by grid cell (`blockIdAt`,
`isBlockOccupied` in `src/themes/platformer/level/BlockMapper.ts`) and never computes a
block rectangle.

| Field | Type | What it controls |
|---|---|---|
| `key` | `string` | The registry key. Must equal this module's slot in `BLOCK_TYPES`. |
| `sprite` | `SpriteDescriptor` | Which sheet this kind draws from. Discovered by `PlatformerPage.tsx`'s loader by spreading `BLOCK_TYPES`, so a kind on an already-registered sheet needs no loader edit. |
| `maxHits` | `number` | Upward-or-otherwise registering hits this kind responds to before it is used up. |
| `removeWhenUsedUp` | `boolean` | Whether the kind leaves the world once used up and its animation settles. `false` leaves a permanent, solid, spent block. |
| `hitboxInsetX` | `number` (optional) | Rendered px to shrink the solid hitbox by on *each* side. Omitted or `0` means the full tile is solid. |
| `frameIndex` | `(hitsTaken: number) => number` | Which frame of `sprite.sheet` to draw for a given hit count. A kind whose appearance never changes ignores the argument. |
| `draw` | `(block: BlockState, dc: DrawContext) => void` | The kind's own rendering. `Renderer.ts` never branches on kind. |
| `triggerSides` | `readonly BlockContactSide[]` | Which contact sides register a hit. |
| `onHit` | `(block: BlockState) => BlockHitOutcome` (optional) | What a registering hit *means*. Omitted by a kind whose destruction has no consequences beyond the generic puff and removal. |

The current registry:

| Kind | `maxHits` | `removeWhenUsedUp` | `triggerSides` | `onHit` returns |
|---|---|---|---|---|
| `crate` | 2 | `true` | `['bottom']` | `{ counterKey: 'crates' }` on the terminal hit, `{}` otherwise |
| `questionMark` | 1 | `false` | `['bottom']` | `{ spawnPickup: 'bonusFruit' }` |
| `fragileRock` | 1 | `true` | `['bottom']` | — (no `onHit`) |
| `coinPot` | 1 | `true` | `['top']` | `{ spawnPickup: 'coin', bounceVelocity: PHYSICS_CONFIG.coinPotBounceVelocity }` |
| `potionPot` | 1 | `true` | `['top']` | `{ spawnPickup: 'heart', bounceVelocity: PHYSICS_CONFIG.coinPotBounceVelocity }` |

### The instance side

`BlockState` (`entities/Block.ts`) extends `BlockPlacement` with `hitsTaken`,
`animState` (`'idle' | 'bump' | 'shatter'`) and `animTimer`. Blocks compose none of the
capability interfaces from `entities/capabilities.ts` — see
[Entities.md](Entities.md) for why.

The lifecycle predicates all read the type through the registry, so no caller branches
on kind:

- `maxHitsForBlock(kind)` → `BLOCK_TYPES[kind].maxHits`
- `hitboxInsetXForBlock(kind)` → `BLOCK_TYPES[kind].hitboxInsetX ?? 0`
- `isBlockUsedUp(block)` — took every hit its kind responds to; may still be animating.
- `isBlockRemoved(block)` — `removeWhenUsedUp` *and* used up *and* settled back to
  `'idle'`. A question-mark is never removed.
- `applyBlockHit(block)` — increments `hitsTaken` and enters `'bump'` from frame zero.
  A no-op on an already-used-up block.

## `triggerSides` and the declarative `onHit`

These two fields exist to keep per-kind knowledge out of the page component.

`Physics.ts` writes `player.blockContacts` — a list of `{ id, side }` entries, where
`side` is a `BlockContactSide` (`'top' | 'bottom' | 'left' | 'right'`, declared in
`entities/Player.ts`). This is the block's own four-face vocabulary, not the enemy
`ContactSide` classification.

`PlatformerPage.tsx` then runs **one** generic filter:

```ts
const hitBlocks = next.blockContacts
  .map((contact) => ({ contact, block: blockStates.value.find((b) => b.id === contact.id) }))
  .filter((entry) =>
    entry.block !== undefined &&
    !isBlockUsedUp(entry.block) &&
    BLOCK_TYPES[entry.block.blockKind].triggerSides.includes(entry.contact.side),
  );
```

That single loop replaces two near-duplicates: one over `'bottom'` contacts that
excluded `coinPot` by name, and one over `'top'` contacts that admitted only `coinPot`.
The kind-name conditionals are gone; the difference now lives in each kind's
`triggerSides`.

`onHit` does the same for consequences. Its return type is
`BlockHitOutcome = PlayerEffects & RewardEffects` (`engine/Outcome.ts`) — a *description*
of what should happen, not a mutation:

| Field | From | Meaning |
|---|---|---|
| `damagePlayer` | `PlayerEffects` | Half-hearts to deal. Ignored while the player is invulnerable; no block knows invulnerability exists. |
| `bounceVelocity` | `PlayerEffects` | Upward impulse in px/s, supplied by the type. Applied as `vy` + `bounceAscending: true`. |
| `knockback` | `PlayerEffects` | `'none'` / `'away'` / `'awayAndUp'` — an involuntary reaction, deliberately not gated by `bounceAscending`. |
| `revealFact` | `RewardEffects` | A CV fact to route through the reveal trigger. |
| `counterKey` | `RewardEffects` | Which HUD counter popup this reward feeds — declared by the block, never assumed by the engine. |
| `spawnPickup` | `RewardEffects` | Which `PICKUP_TYPES` entry to spawn at this block's position. |

`BlockHitOutcome` carries no `self`: hit counting is generic (`maxHits` +
`applyBlockHit`), so no kind ever returns replacement state.

Two contracts hold for `onHit`:

1. **It receives the block *after* `applyBlockHit`.** Comparing `block.hitsTaken`
   against the kind's own max-hits constant is how a multi-hit kind knows this hit was
   its terminal one. `Crate.ts` does exactly that:
   `onHit: (block) => (block.hitsTaken >= MAX_HITS ? { counterKey: 'crates' } : {})`.
2. **It must not call `isBlockUsedUp`.** That lives in `entities/Block.ts`, which imports
   `BLOCK_TYPES`, so a block module calling it would close an import cycle
   (`Block.ts` → `blocks/index.ts` → `Crate.ts` → `Block.ts`). The type-only
   `import type { BlockState }` these modules carry is erased at build time and is fine.

The engine keeps what is genuinely its business: the bonus-fruit icon cycle, the dropped
coin's id and position, multi-block bounce aggregation (`strongerBounce`, most-negative
wins so several blocks bouncing the player in one tick is order-independent), and the
destruction puff.

### The puff is independent of reward

`firePuffIfJustUsedUp` fires a `PuffEffect` for any block that is `removeWhenUsedUp` and
now used up — crate, fragile rock, coin pot, potion pot — regardless of whether any
reward accompanied it. A fragile rock declares no `onHit` at all and still puffs.

## `hitboxInsetX`

Block art that does not fill its tile edge-to-edge would otherwise stop the player at
the full tile boundary, well outside the visible sprite, reading as an invisible wall.

`hitboxInsetX` is the number of *rendered* px to shrink the solid hitbox by on each
side. `Physics.ts`'s horizontal collision resolves against `tile boundary ± inset`
rather than the raw tile boundary, reading the value through
`hitboxInsetXForBlock(blockKind)`.

Only `coinPot` declares one today: `3 * RENDER_SCALE` = 6 rendered px, measured from the
three variant sprites' actual drawn pixels inside their native 16×16 tile (the narrowest
leaves ~3px of transparent margin per side, the widest ~2px). It is a single value used
for every variant, because which variant an instance renders as is decided per-frame by
`computeCoinPotRenderPlan` rather than fixed per block — the hitbox cannot reasonably
vary with it.

Vertical collision is unaffected; there is no `hitboxInsetY`.

## Sprites and crack stages

Every kind's `sprite.sheet` is discovered by the asset loader in `PlatformerPage.tsx`,
which spreads `Object.values(BLOCK_TYPES).map((t) => t.sprite)`. A kind drawing from an
already-registered sheet needs no loader edit. A kind introducing a brand-new sheet adds
it to `entities/sprites/sheets.ts` — and *only* if it is a secondary overlay rather than
the kind's own primary `sprite.sheet`, also to the loader's hand-listed exceptions,
since a spread over `BLOCK_TYPES` cannot discover a sheet that is no type's primary
descriptor.

| Kind | Sheet | Frame |
|---|---|---|
| `crate` | `WORLD_TILESET_SHEET` (`/sprites/world_tileset.png`) | 55 (row 3, col 7) |
| `questionMark` | `WORLD_TILESET_SHEET` | 32 intact (row 2, col 0); 1 spent (the plain top-exposed `groundRock` tile) |
| `fragileRock` | `WORLD_TILESET_SHEET` | 3 (row 0, col 3) |
| `coinPot` | `STATIC_OBJECTS_SHEET` (`/sprites/staticObjects.png`) | row 7, cols 0/1/2 — three size variants, addressed directly rather than by frame index |
| `potionPot` | `WORLD_TILESET_SHEET` | `8 * 16 + 1` (row 8, col 1) — the purple bottle |

`drawBlockTile.ts` is the plain shared blit — the given frame of `world_tileset.png` at
full opacity with the bump offset applied — used by `questionMark`, `fragileRock` and
`potionPot`. It takes the frame index as a parameter rather than looking it up, so it
never value-imports from `../Block` and the load cycle stays open.

### Crack stages

The crate is the only kind with a visible intermediate stage, and it is an **overlay,
not a frame swap**:

- `crateCrackOverlayVisible(hitsTaken)` is true only at `hitsTaken === 1` — between the
  first hit (cracked) and the second (shattered). Never on an intact or fully broken
  crate.
- The overlay is `CRACK_OVERLAY_SHEET` (`/sprites/crack_overlay.png`), a standalone
  one-frame sheet, composited as a second `drawImage` over the base tile at the same
  position.
- `crateShatterOpacity(block)` returns 1 unless `animState === 'shatter'`, in which case
  it fades linearly to 0 over `CRATE_SHATTER_DURATION_SECONDS` (0.25 s).

Because of the overlay and the wrapping opacity, `Crate.ts` keeps its own copy of the
base blit rather than calling `drawBlockTile`.

The question-mark takes the other route: it *does* swap frames, to the plain
`groundRock` tile, so a spent question-mark blends into ordinary ground rather than
reading as a still-special block.

### The bump animation

`engine/BlockAI.ts` owns the shared animation, driven by `applyBlockHit` entering
`'bump'`:

- `BLOCK_BUMP_DURATION_SECONDS` = 0.1, `BLOCK_BUMP_HEIGHT_PX` = 6.
- `blockBumpOffsetY(block)` is a triangle wave rising to `-6` px at the bump's midpoint
  and settling back to 0. Zero outside `'bump'`. Every kind's `draw` applies it.
- `stepBlockAnimation(block, dt)` advances the state machine: `'bump'` → `'idle'`,
  except a crate on its terminal hit, which goes `'bump'` → `'shatter'` → `'idle'`.
  `PlatformerPage.tsx` removes the block once `isBlockRemoved` reports true.

## The shared reveal trigger

`engine/RewardReveal.ts`'s `createRewardReveal(ctx)` builds, once per tick, the single
function that turns "this entity revealed a fact" into collected state, a flight effect
and a counter popup. **Every fact-revealing site in the game routes through it** — enemy
defeat, coin pickup, bonus fruit, chest open, crate destruction.

It does three things in one place, which is exactly why the counters stay consistent:

1. **Dedup by fact id.** It returns `false` when the fact is already in
   `collectedFacts`, so a caller can still gate its own side effects on a fresh reveal.
2. **Collect and label.** It appends to `collectedFacts` and derives the flight label
   and icon through `formatJournalEntry` — the journal's own derivation, so a fact's
   display title is identical in flight and in the journal.
3. **Bump the counter.** When `options.counterKey` is given it starts a counter popup
   with `countCollectedFor(counterKey, collectedFacts.value)` over
   `levelTotals.value[counterKey]`.

The slot allocator (`ctx.allocateSlotOffset`) is passed *in* rather than built inside,
because it is shared with the key pickup, which sits outside this trigger: one counter
across every flight-text site is what keeps two texts in the same tick off the same row.

Two deliberate non-members:

- **The key pickup** does not route through it — it reveals no fact, has a static
  caption, and flies to the HUD key counter rather than the journal.
- **`counterKey` is optional.** Chests omit it because they have a permanent HUD counter
  (hence `CounterPopupLabelKey` excluding `'chests'`). Coins omit it because a coin's
  reward is resolved dynamically at pickup time and most coins reveal no fact.

Crates are the third omission, for the same shape of reason as coins: a crate's facts
are a fixed, position-based slice of the pool (see `BlockMapper.ts`'s `placeCrates`), so
most crates reveal zero facts when the level has more crate markers than crate facts.
Gating the popup on a reveal would leave those destructions with no feedback, so
`PlatformerPage.tsx` bumps the `crates` popup once per tick in which any crate reached
its terminal hit, using `cratesDestroyed` rather than a facts-derived count.

## Declaring a block kind's counter section

Counters are declared in two places, both in
`src/themes/platformer/entities/CollectiblesSummary.ts`:

```ts
export type CounterKey = 'coins' | 'fruits' | 'enemies' | 'crates' | 'chests';

export const COUNTER_SECTIONS: Record<CounterKey, readonly SectionId[]> = {
  coins: ['skills'],
  fruits: ['certificates', 'projects'],
  enemies: ['courses'],
  crates: ['education', 'activities', 'languages'],
  chests: ['experience'],
};
```

`COUNTER_SECTIONS` is the single source of truth for both the journal's summary rows and
the in-game counter popups, keyed by `sectionId` rather than `sourceType` — a fact's
`sourceType` alone cannot distinguish pools, since `'block'` covers both crates and
question-mark fruit. Its own test asserts that no section feeds two counters.

The denominators come from `levelTotals`, a `computed()` in `PlatformerState.ts` shaped
as `LevelTotals` — a per-counter count of what the *level actually placed*, not of raw
`CVData` length, so a row never shows more than the level holds. Three rows override
their numerator (`coinsCollected`, `enemiesDefeated`, `cratesDestroyed`) because their
collectible count and their fact count are different units under proportional pacing.

So a new fact-bearing block kind declares its counter by:

1. adding a `CounterKey` member and its `COUNTER_SECTIONS` sections;
2. adding the matching field to `LevelTotals` and its placement count to `levelTotals`;
3. returning that key as `counterKey` from its `onHit` (or bumping the popup at the hit
   site, if its facts are a fixed pool slice like the crate's).

Without step 3, a second fact-bearing block kind would have its reveal silently
attributed to whatever counter the engine happened to hardcode. That is precisely why
`counterKey` is on the outcome.

## Container blocks

Coin pots and potion pots are the same `BlockType` contract with `triggerSides: ['top']`
instead of `['bottom']` — destroyed by *landing on* them rather than by a hit from
below. Nothing else about them is special-cased: the same generic filter, the same
`applyBlockHit`, the same puff, the same removal.

Both declare `bounceVelocity: PHYSICS_CONFIG.coinPotBounceVelocity` (−220 px/s, weaker
than the −330 enemy stomp) so landing on one gives a small hop. Neither carries a CV
fact of its own — `BlockMapper.ts` places both directly from level markers, with a
position-derived id and no def to zip against. Which fact a dropped coin eventually
reveals is resolved at pickup time from the shared skill-fact pool.

### Adjacent coin pots merge visually

`coinPotRenderPlan.ts` computes, fresh from the live block list **every frame**, how
every still-live coin-pot tile renders. Nothing is cached across ticks, so a hit tile
drops out of its run immediately (`isBlockUsedUp`), before its bump animation even
finishes — destroying the middle of a three-run leaves both survivors isolated on the
very next frame.

- Within one row, adjacent live tiles (column N and N+1) form a **run**.
- `permutationForColumn(col)` hashes the run's leftmost column into one of the six
  permutations of the three variant indices (0 = small round jar, 1 = tall narrow urn,
  2 = wide square urn) — the same position-hash trick `StaticObjectsCatalog.ts` uses for
  bush/tree variety.
- The run walks slot indices `0, 1, 2, …` through that permutation. Base tiles take the
  even slots; one **filler** pot per internal seam takes the odd slots, drawn centered on
  the tile boundary. The result reads as one merged bunch of varied sizes rather than N
  separate jars with visible gaps.
- Because a permutation's three entries are pairwise distinct, no two consecutive
  rendered pots ever share a variant, even across the `% 3` wraparound.

The plan is exposed on `DrawContext.coinPotPlan`. Only a run's **owner** (its leftmost
block) actually draws: it renders every base pot in the run, each with its *own* bump
offset, plus every filler, so a whole run renders from one `draw()` call regardless of
which tile the caller happens to be iterating. Non-owners return immediately. A block
absent from the plan — no plan supplied (a test drawing in isolation), or an instance
mid-bump after being hit — draws itself alone with the same deterministic
column-seeded fallback variant.

`EditorCanvas.tsx` builds the same plan over its synthesized editor placements, so the
palette preview merges runs exactly as the game does.

### The potion pot restores on respawn

Blocks are progress that persists across a death/respawn — `resetGame()` in
`PlatformerState.ts` leaves `blockStates` alone for crate, question-mark, fragile rock
and coin pot.

The potion pot is the single exception. `resetGame()` rebuilds every potion-pot
placement back to intact and clears `heartPickupStates`:

```ts
blockStates.value = [
  ...blockStates.value.filter((b) => b.blockKind !== 'potionPot'),
  ...blockPlacements.value.filter((p) => p.blockKind === 'potionPot').map(toBlockState),
];
heartPickupStates.value = [];
```

A dropped-but-uncollected heart is tied to its now-restored pot; leaving it in the world
would let the player collect a heal the pot itself is about to offer again. The heal
amount is applied at pickup time by `Health.ts`'s `healDamage`, never by the block.

The potion pot is implemented and reachable from the editor palette but is not placed in
the shipped level.

## Adding a block

Every file that must change, in order. The entity interfaces are not the friction here —
the placement pipeline is.

1. **`src/themes/platformer/entities/blocks/<Name>.ts`** — the module. Export a
   `BlockType` constant: `key`, `sprite`, `maxHits`, `removeWhenUsedUp`, `triggerSides`,
   `frameIndex`, `draw`, and `onHit` if the hit has consequences. Add `hitboxInsetX` if
   the art is narrower than its tile. Use `drawBlockTile` unless the kind needs its own
   compositing.
2. **`src/themes/platformer/entities/blocks/index.ts`** — one line in `BLOCK_TYPES`.
3. **`src/themes/platformer/entities/Block.ts`** — add the literal to the `BlockKind`
   union.
4. **`src/themes/platformer/types.ts`** — add the literal to `BlockDef.blockKind`, the
   parallel union `BlockPlacement` inherits. This union is easy to miss and is the one
   place a new kind silently diverges: `'potionPot'` is currently absent from it while
   present in `BlockKind`, which `tsc` reports at every potion-pot placement site.
5. **`src/themes/platformer/level/LevelParser.ts`** — add the character to
   `ENTITY_CHARS` (blocks are entity characters) and add a `findAllOfKind` finder beside
   the existing ones. See [LevelFormat.md](LevelFormat.md) for the full character table.
6. **`src/themes/platformer/level/BlockMapper.ts`** — add the marker array to
   `BlockMarkerPositions` and a placement loop to `placeBlocks`. A kind with no CVData
   mapping places directly with a position-derived id; a fact-bearing kind needs a
   `mapCVDataToBlocks` def and a zip or pool-slice rule.
7. **`src/themes/platformer/PlatformerState.ts`** — wire the marker signal into the
   marker-positions computed, and add the kind to `levelTotals` if it feeds a counter.
   Add it to `resetGame` only if it must be restored on respawn.
8. **`src/themes/platformer/editor/paletteTiles.ts`** — an entry in
   `PALETTE_TILE_SPRITES` (sheet, source rect, frame size),
   `PALETTE_TILE_DESCRIPTIONS` (what it does in the finished level) and
   `PALETTE_TILE_LABELS` (its readable name).
9. **`src/themes/platformer/editor/gridRenderState.ts`** — a
   `synthesizeBlockPlacements` call so the editor canvas previews it.
10. **`src/themes/platformer/entities/sprites/sheets.ts`** — only if the kind introduces
    a new sheet. Add it to `PlatformerPage.tsx`'s hand-listed loader exceptions only if
    it is a secondary overlay rather than the kind's primary `sprite.sheet`.
11. **`src/themes/platformer/entities/CollectiblesSummary.ts`** — only if the kind feeds
    a new counter: a `CounterKey` member, its `COUNTER_SECTIONS` sections, a
    `LevelTotals` field, and a row in `collectiblesSummary`.

Nothing in `Renderer.ts`, `Physics.ts` or `PlatformerPage.tsx`'s hit loop needs an edit:
the renderer never branches on kind, physics reads the inset through
`hitboxInsetXForBlock`, and the hit loop filters generically on `triggerSides` and
dispatches on `onHit`'s returned outcome.
