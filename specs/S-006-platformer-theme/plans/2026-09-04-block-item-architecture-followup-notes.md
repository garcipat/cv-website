# Follow-up: Block/Reward Architecture Rework

Backlog notes from the step-37 (coin-pot block) session, for a future
brainstorming pass — not a spec, not scheduled on the roadmap yet.

## Context

While shipping the coin-pot block (roadmap step 37), we noticed
`PlatformerPage.tsx`'s tick handler hardcodes per-`blockKind` branching for
rewards (`if (block.blockKind === 'questionMark')`, `if (block.blockKind ===
'crate' && ...)`, `if (block.blockKind === 'coinPot')`), while enemies
already went through this exact refactor: `EnemyType.onPlayerCollide`
returns a declarative `CollisionOutcome` (`engine/Contact.ts`), and the
engine applies it uniformly with no per-type branching. Blocks never got
the equivalent treatment.

Separately, the same session added a proportional skill-fact-reveal pacing
system for coins (`level/SkillFactPacing.ts`, `level/CollectibleMapper.ts`'s
`mapCVDataToSkillFactPool`) — worth knowing about before touching this, since
it changes what "a reward" even means for a coin (dynamically resolved at
pickup time, not bound to the placement).

## Idea 1: `BlockType.onBreak` hook, mirroring `EnemyType.onPlayerCollide`

Give `BlockType` (`entities/blocks/BlockType.ts`) an optional hook returning
a declarative outcome instead of `PlatformerPage.tsx` branching on
`blockKind` — something like:

```ts
interface BlockBreakOutcome {
  spawnBonusFruit?: boolean; // questionMark
  revealFact?: CollectedFact; // crate (terminal hit only)
  spawnCoinAt?: { x: number; y: number }; // coinPot
}
onBreak?(block: BlockState): BlockBreakOutcome;
```

The engine (`PlatformerPage.tsx`) would call `BLOCK_TYPES[block.blockKind].onBreak?.(block)`
once, generically, and apply whatever outcome comes back — no more
`if (block.blockKind === X)` branches in the tick handler. Each block module
(`Crate.ts`, `QuestionMark.ts`, `CoinPot.ts`) owns its own reward logic,
the same way each `entities/enemies/*.ts` already owns
`onPlayerCollide`.

**Open questions to resolve before writing a plan:**
- Does `onBreak` fire once per terminal hit only, or every hit (crate needs
  2 hits before its terminal reward — does an intermediate hit need its own
  no-op outcome, or is `onBreak` only called when `isBlockUsedUp` first
  becomes true)?
- Where does `landedOnTopIds`'s "top-side" trigger for coinPot fit — does
  `onBreak` fire regardless of which side triggered the hit, with the block
  itself not caring, or does the hook need the contact side too?

## Idea 2: A shared "reveal effect" trigger, unifying all reward call sites

Right now `PlatformerPage.tsx` has FIVE separate, near-duplicate call sites
each doing "push a fact to `collectedFacts`, start a `FlightEffect`, bump a
`CounterPopupEffect`" slightly differently:

- Enemy defeat (~line 846, `enemies` counter)
- Coin/coin-pot pickup (~line 996, `coins` counter — already unified with
  the new pacing logic this session, but still its own inline block)
- Bonus fruit pickup (~line 1058, `fruits` counter)
- Chest open (~line 1120/1177)
- Crate terminal hit (~line 1409, `crates` counter)

A shared helper (name TBD — `revealFact(fact, {position, counterKey, counterTotal})`
or similar) called from all five would collapse this duplication into one
place, the same way `firePuffIfJustUsedUp` (added this session) already
unified the two block-destruction puff-effect call sites. This is the
natural continuation of Idea 1: `onBreak`'s `revealFact` field is exactly
what this shared trigger would consume.

**Open questions to resolve before writing a plan:**
- Each of the 5 call sites computes its own "total" (`enemyTotal`,
  `coinTotal`, `bonusFruitTotal`, `crateTotal`, plus chests) slightly
  differently (some from `blockPlacements`, some from `enemyPlacements`,
  coins now from the pacing formula) — does the shared trigger take the
  total as a parameter, or does it need its own small per-`sectionId`
  lookup?
- `nextTextSlot`/`COLLECTION_TEXT_SLOT_COUNT` cycling is currently a single
  shared module-level counter across all 5 sites — needs to keep working
  the same way through a shared trigger.

## Idea 3: One `levelTotals` computed, instead of each total recomputed per call site

Confirmed today, live: the "coins" total is computed independently in both
`PlatformerPage.tsx` (the counter popup) and `Journal.tsx` (the summary
row), with near-identical `.filter(...).length` expressions that could
silently drift apart — the same duplication pattern Idea 2 is about, just
for TOTALS rather than the reveal-effect trigger. The same is already true
today for fruits/crates/chests/enemies, just less obviously since those
totals haven't been touched recently.

A single `computed` (`levelTotals`, or similar — derived from
`currentLevel`/`blockPlacements`/`enemyPlacements`/`chestPlacements` +
`skillFactPool`) holding `{ coins, fruits, chests, crates, enemies }` once,
read by both `PlatformerPage.tsx`'s counter popups and `Journal.tsx`'s
`collectiblesSummary` call, would remove this whole class of duplication.
Natural fit alongside `CollectiblesSummary.ts`'s existing
`CollectibleSummaryTotals` shape — this could just BE the computed that
produces that shape, rather than `Journal.tsx` assembling it inline from
four different placement arrays every render.

Also confirmed today (worth preserving as an explicit design note, not
rediscovering it later): every one of these totals is ALREADY
level-dependent by construction — `COIN_TILES`/`CRATE_TILES`/etc.
(`level.ts`) are all `computed(() => findXTiles(currentLayout.value))`, so
switching `currentLayout` (e.g. the Level Editor's "Try" button) already
updates every downstream total reactively. The one deliberately
level-INDEPENDENT piece is `skillFactPool` itself (CVData-derived, not
level-derived) — that split should stay when this is centralized, not get
accidentally collapsed.

## Suggested order of attack

1. Brainstorm Idea 1 and Idea 2 together (they're one refactor really) —
   probably worth a full `writing-plans` pass given the blast radius (touches
   every block module, `PlatformerPage.tsx`'s tick handler extensively, and
   likely `EnemyDef`/`ChestDef`'s reward paths too if the shared trigger is
   meant to generalize beyond blocks).
2. Consider whether enemies' defeat-reward path should ALSO move onto the
   same shared trigger while this is being reworked, for full consistency,
   or whether that's a separate follow-up again.
3. Idea 3 is more self-contained and could be done independently/first —
   it doesn't depend on Ideas 1-2 landing, and would make Idea 2's "each
   call site computes its own total differently" open question moot before
   that refactor even starts.
