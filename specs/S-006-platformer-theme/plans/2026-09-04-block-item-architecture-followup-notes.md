# Follow-up: World-Entity Behavior Architecture

Program-level notes for a four-part rework. Pieces A and B are specced as
roadmap step 41 (`2026-09-04-world-entity-behavior-design.md`); pieces C and D
are backlog, each needing its own brainstorming pass before a plan.

## The gap

Enemies own their own behavior: `EnemyType.onPlayerCollide` returns a
declarative `CollisionOutcome` (`engine/Contact.ts`) and the engine applies it
uniformly, with no per-type branching anywhere. `onDamaged` and `onTick` follow
the same shape. Adding an enemy is one module plus one line in
`enemies/index.ts`.

Every other world-entity family got only HALF of that pattern — a type module
owning appearance and geometry — while its consequences stayed hardcoded in
`PlatformerPage.tsx`. Terrain got neither half.

| Family  | Registry       | Owns appearance                    | Owns behavior / consequences                                        |
| ------- | -------------- | ---------------------------------- | ------------------------------------------------------------------- |
| Enemies | `ENEMY_TYPES`  | yes                                | yes — `onPlayerCollide` → `CollisionOutcome`, `onDamaged`, `onTick` |
| Blocks  | `BLOCK_TYPES`  | yes                                | no — `PlatformerPage.tsx` branches on `blockKind`                   |
| Pickups | `PICKUP_TYPES` | yes (geometry + draw)              | no — `PickupType` states it "carries no lifecycle"                  |
| Chests  | `CHEST`        | yes                                | no — `ChestType` states it owns "not what standing on it means"     |
| Terrain | none           | in `Renderer.ts` / tileset helpers | no — `TileType` string-union predicates in `Terrain.ts`             |

Consequences of the gap, all confirmed live:

- `PlatformerPage.tsx`'s tick handler branches on `blockKind` for rewards
  (`questionMark`, `crate`, `coinPot`).
- FIVE near-duplicate reward call sites each do "push a fact to
  `collectedFacts`, start a `FlightEffect`, bump a `CounterPopupEffect`"
  slightly differently: enemy defeat (~846), coin/coin-pot pickup (~996),
  bonus fruit (~1058), chest open (~1120/1177), crate terminal hit (~1409).
- Adding a terrain tile means editing four predicates (`isSolid`,
  `isSolidExcludingBridge`, `isClimbable`, `isStandableLadderTop`) plus stray
  comparisons in `Physics.ts` (`tileAt(...) === 'bridge'`) and `Renderer.ts`
  (`=== 'groundGrass'`).
- Each of the five totals is recomputed per call site, and the "coins" total is
  computed independently in both `PlatformerPage.tsx` (counter popup) and
  `Journal.tsx` (summary row) with near-identical `.filter(...).length`
  expressions that can silently drift.

Before touching any of this, know about the proportional skill-fact pacing
system (`level/SkillFactPacing.ts`, `level/CollectibleMapper.ts`'s
`mapCVDataToSkillFactPool`): a coin's reward is resolved dynamically at pickup
time, not bound to the placement, which changes what "a reward" even means for
a coin.

## Piece A — one `levelTotals` computed

A single computed in `PlatformerState.ts` holding
`{ coins, fruits, chests, crates, enemies }`, read by both
`PlatformerPage.tsx`'s counter popups and `Journal.tsx`'s `collectiblesSummary`
call, replacing seven separate `.filter(...).length` sites. Natural fit
alongside `CollectiblesSummary.ts`'s existing `CollectibleSummaryTotals` shape
— this becomes the computed that produces that shape, rather than `Journal.tsx`
assembling it inline from four placement arrays every render.

Design constraints:

- Read base `collectiblePlacements`, NOT `allCollectiblePlacements`. That makes
  the coin total a fixed session constant by construction (replacing the
  current `!allCollectiblePlacements.some(...)` de-double-counting dance) and
  keeps the computed invalidated only by layout/CV changes — reading
  `allCollectiblePlacements` would invalidate it on every coin-pot drop,
  mid-play.
- One combined computed, not five separate ones. Every input derives from
  `currentLayout` + `currentCV`, so no event invalidates one total without
  invalidating all of them; finer granularity would skip zero work and
  re-scatter the single source of truth this piece exists to create.
- Every total is ALREADY level-dependent by construction —
  `COIN_TILES`/`CRATE_TILES`/etc. (`level.ts`) are all
  `computed(() => findXTiles(currentLayout.value))` — so switching
  `currentLayout` (the editor's "Try") updates every downstream total
  reactively. The one deliberately level-INDEPENDENT piece is `skillFactPool`
  (CVData-derived, not level-derived); that split must stay when this is
  centralized, not get collapsed.

Independent of every other piece. Doing it first makes piece B's "each call
site computes its own total differently" question moot before that refactor
starts.

## Piece B — blocks own their outcomes, and one shared reveal trigger

The keystone: it defines the outcome vocabulary the later pieces reuse.

Give `BlockType` (`entities/blocks/BlockType.ts`) a hook returning a
declarative outcome instead of `PlatformerPage.tsx` branching on `blockKind`,
mirroring `EnemyType.onPlayerCollide` — something like:

```ts
onHit?(block: BlockState): PlayerEffects & RewardEffects;
```

where `RewardEffects` is `{ revealFact?, spawnPickup? }` — one
registry-keyed `spawnPickup: PickupKind` rather than a boolean per
spawnable thing, so a block dropping a key adds no field. See the design doc
for the full vocabulary.

The engine calls `BLOCK_TYPES[block.blockKind].onHit?.(block)` once,
generically, and applies whatever comes back. Each block module (`Crate.ts`,
`QuestionMark.ts`, `CoinPot.ts`) then owns its own reward logic, exactly as each
`entities/enemies/*.ts` owns `onPlayerCollide`.

Paired with it: a shared reveal trigger (`engine/RewardReveal.ts`'s
`revealFact`) called from ALL FIVE
reward call sites, collapsing that duplication into one place the way
`firePuffIfJustUsedUp` already unified the two block-destruction puff sites.
`onHit`'s `revealFact` field is exactly what this trigger consumes. Scope
decided: all five fact-reveal sites, including enemy defeat and chest open. The
key pickup stays outside it — it reveals no fact and targets the HUD key
counter rather than the journal.

Every open question here is resolved, and pieces A and B are specced together
as roadmap step 41 — see `2026-09-04-world-entity-behavior-design.md` for the
decisions (hook fires on every registering hit with the block deciding
terminality; side gating is a declarative `triggerSides` field; the outcome
vocabulary is two composable interfaces rather than one growing type) and for
the live crate-counter bug the refactor's mechanism removes.

## Piece C — pickups and chests onto the same vocabulary

Extend piece B's outcome vocabulary to `PickupType` (`onCollect`) and
`ChestType` (`onOpen`), deleting the explicit "carries no lifecycle" and "not
what standing on it means" caveats in those two interfaces. Depends on B — it
reuses the outcome type B introduces.

## Piece D — a `TerrainType` registry

One module per tile kind owning solidity, climbability, one-way rules
(`bridge`'s fall-through and rise-through exclusions, a ladder shaft's standable
top rung), and tileset drawing, replacing `TileType`'s string-union predicates
and the stray comparisons in `Physics.ts`/`Renderer.ts`. Registry plus
`index.ts`, mirroring `enemies/`.

Independent of A, B and C. Also the prerequisite that would make roadmap step 40
(spike hazard tiles) a one-module addition rather than another round of
predicate edits.

## Order of attack

1. **A** and **B** — specced together as roadmap step 41
   (`2026-09-04-world-entity-behavior-design.md`). A lands first within that
   step, since the shared trigger needs one place to read totals from.
2. **C** — mechanical once B's vocabulary exists.
3. **D** — any time; independent of the others.
