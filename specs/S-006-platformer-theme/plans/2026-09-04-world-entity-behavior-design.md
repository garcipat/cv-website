# Design: Blocks Own Their Outcomes, One Shared Reveal Trigger

Roadmap step 41. Covers piece A and piece B of the four-part program in
`2026-09-04-block-item-architecture-followup-notes.md`, plus one live bug the
refactor's mechanism removes. Pieces C (pickups/chests) and D (terrain) are
out of scope here.

## Goal

Blocks own what a hit MEANS, the way enemies already own what a contact means.
`PlatformerPage.tsx`'s tick handler stops branching on `blockKind`, and the
five near-duplicate reward call sites collapse onto one trigger.

## Non-goals

- Pickups and chests keep their current lifecycle handling (piece C).
- Terrain keeps its `TileType` predicates (piece D).
- Enemy `onPlayerCollide` changes in one field only (`bouncePlayer` →
  `bounceVelocity`); its structure is already correct and is the model here.
- No new counter popup for chests. `CounterPopupLabelKey` deliberately omits
  chests because chests already have a PERMANENT HUD counter drawn every
  frame (`PlatformerPage.tsx`'s render, the `chestClosedSpriteRef` block); a
  transient popup would duplicate it.

## The bug this fixes

The crate counter popup's numerator counts the wrong sections:

```ts
// PlatformerPage.tsx, crate terminal hit
const crateCollected = collectedFacts.value.filter(
  (f) => f.sectionId === 'experience' || f.sectionId === 'education',
).length;
```

`BlockMapper.ts` maps crates from **education, activities, languages**;
`'experience'` is the CHEST pool. So the numerator counts chest facts as
crates and ignores activities/languages crates entirely.
`CollectiblesSummary.ts` has the mapping right, so the HUD popup and the
Journal's crate row report different numbers for the same thing.

Reproduction, on a level with 3 crates (education/activities/languages):
break the education and activities crates — the HUD popup shows `1/3` while
the Journal's crate row shows `2/3`. Open two chests first and the popup can
read `3/3` with a single crate broken.

The enemy numerator has the same shape of problem without the wrong result:
the popup uses `sourceType === 'enemy'` where the Journal uses
`sectionId === 'courses'`. Different expressions, same set today.

Fixed FIRST, as its own commit, so the fix is reviewable separately and
everything after it is a behavior-preserving refactor.

The buggy expression is inline inside the `requestAnimationFrame` closure and
so has no unit-test seam of its own. Writing the failing test for the mapping
therefore *requires* extracting it: the fix commit introduces `COUNTER_SECTIONS` and a
`countCollectedFor(counterKey, facts)` helper (section 5), tests that against
both mappings, and calls it from the crate site. That extraction is the
smallest change that makes the bug testable at all — not scope creep bolted
onto a one-line fix.

Explicitly NOT a bug, checked: the coin total is computed independently in
`PlatformerPage.tsx` and `Journal.tsx` with different expressions, but they
come out equal in every case. Piece A removes a drift risk, not a live defect.

## Architecture

### 1. Shared effect vocabulary — new `engine/Outcome.ts`

```ts
export interface PlayerEffects {
  damagePlayer?: number;
  /** Upward impulse in px/s (negative = up). The TYPE supplies its own
   *  constant (stompBounceVelocity, coinPotBounceVelocity); the engine
   *  applies `vy` + `bounceAscending: true` uniformly. */
  bounceVelocity?: number;
  knockback?: 'none' | 'away' | 'awayAndUp';
}

export interface RewardEffects {
  revealFact?: CollectedFact;
  /** Which HUD counter popup this reward feeds, declared by the entity rather
   *  than assumed by the engine. Omitted means no transient popup — the chest
   *  case, which has a permanent HUD counter instead. */
  counterKey?: CounterPopupLabelKey;
  /** Which pickup to spawn at this entity's position, keyed by PICKUP_TYPES —
   *  one field rather than a boolean per spawnable thing, so a block that
   *  drops a key needs no new field here. Deliberately NOT named
   *  `*Effect`: in this codebase an Effect is a transient visual
   *  (FlightEffect/PuffEffect/CounterPopupEffect), whereas a spawned pickup is
   *  real world state the player can walk over and collect. `'fruit'` and
   *  `'bonusFruit'` are separate registry keys with different state types —
   *  the rising, fact-carrying one a question mark drops is `'bonusFruit'`. */
  spawnPickup?: PickupKind;
}
```

Two small composable interfaces rather than one growing outcome type —
`Contact.ts` warns that an outcome type past a handful of fields "has become
the scattered conditionals it replaced", and a unified type would give every
family fields meaningless to it.

- `CollisionOutcome<S>` (stays in `Contact.ts`) becomes
  `{ self?: S } & PlayerEffects`.
- `BlockHitOutcome = PlayerEffects & RewardEffects`. No `self`: block hit
  counting stays generic (`maxHits` + `applyBlockHit`), so no module needs to
  return replacement state.

`pickups/index.ts`'s `PickupTypeKey` is renamed to `PickupKind` on the way in.
It matches this codebase's existing convention for "which variant"
(`BlockKind`, `blockKind`, `ItemKind`), drops a redundant word, and stays
unambiguous where a bare `PickupKey` would not — there IS a key pickup
(`ItemKind = 'key'`), so `PickupKey` would read as "the key pickup". The rename
is free: the type currently has zero consumers, and `spawnPickup` is its first.

`bouncePlayer: boolean` → `bounceVelocity?: number` is the one behavioral
interface change. Today the APPLIER picks the constant — `stompBounceVelocity`
in `PlatformerPage.tsx`, `coinPotBounceVelocity` inline in the block handler —
so a shared boolean cannot express both. Both bounces set
`bounceAscending: true` (only `awayAndUpKnockbackVy` does not, and that is the
separate `knockback` field), so one uniform application covers both. Touches
`Collision.ts`, `SlimeGreen.ts`, `SlimePurple.ts`, and the `suppressJumpCut`
read that currently treats `bouncePlayer` as a boolean.

### 2. `BlockType` gains two members

```ts
/** Which contact sides register a hit on this kind, in the block's own
 *  four-face vocabulary (`BlockContactSide`, from `PlayerState.blockContacts`
 *  — 'top' | 'bottom' | 'left' | 'right'), not the enemy `ContactSide`
 *  classification. Required and non-empty for every kind — the engine
 *  filters `blockContacts` against it generically, replacing the hardcoded
 *  `blockKind !== 'coinPot'` / `=== 'coinPot'` filters. */
triggerSides: readonly BlockContactSide[];
/** What a registering hit MEANS for this kind. Receives the block AFTER
 *  `applyBlockHit`, so comparing `block.hitsTaken` against this kind's own
 *  `maxHits` constant is how it knows this hit was its terminal one.
 *  Deliberately NOT `isBlockUsedUp(block)`: that lives in `entities/Block.ts`,
 *  which imports `BLOCK_TYPES`, so a block module calling it would close an
 *  import cycle (Block.ts -> blocks/index.ts -> Crate.ts -> Block.ts). A kind
 *  knowing its own threshold is also simply more local. Omitted by a kind with
 *  no consequences. */
onHit?(block: BlockState): BlockHitOutcome;
```

Per kind:

| Kind         | `triggerSides` | `onHit` returns                                                  |
| ------------ | -------------- | ---------------------------------------------------------------- |
| crate        | `['bottom']`   | `hitsTaken >= MAX_HITS && fact ? { revealFact: fact } : {}`      |
| questionMark | `['bottom']`   | `{ spawnPickup: 'bonusFruit' }`                                  |
| coinPot      | `['top']`      | `{ spawnPickup: 'coin', bounceVelocity: coinPotBounceVelocity }` |
| fragileRock  | `['bottom']`   | no hook                                                          |

Crate's `hitsTaken >= 2` check moves out of the page and into `Crate.ts`,
against a module-local `MAX_HITS` constant that also feeds its `maxHits` field
— that migration is the point of the whole piece.
`questionMark` and `coinPot` have `maxHits: 1`, so for them every registering
hit is already terminal.

### 3. Engine: two loops collapse into one

`hittableBlockIds` and `landedOnTopIds` are near-duplicates differing only by
side and by their hardcoded coinPot filters. They become one pass:

1. Filter `next.blockContacts` to `triggerSides.includes(c.side)` and
   `!isBlockUsedUp(block)`.
2. `applyBlockHit` every survivor.
3. Per block: `firePuffIfJustUsedUp(block)`, then apply
   `BLOCK_TYPES[block.blockKind].onHit?.(block)`.

`spawnPickup` is applied by ONE dispatch keyed by pickup type, replacing the
per-`blockKind` branches. The engine keeps what is genuinely its business
rather than the block's: the `nextBonusFruitIcon++` cycle (`'bonusFruit'`), and
the dropped coin's id and position (`'coin'` →
`{ id: block.id, spriteType: 'coin', x: block.x, y: block.y }` — the pot's own
id, which the coin-total guard matches against). The two differ because their
target arrays differ (`bonusFruitStates` vs `spawnedCoinPlacements`), so the
dispatch cannot be collapsed further — but it now lives in one place, keyed by
pickup type rather than by block kind, and a block spawning an existing pickup
needs no engine change at all. No `blockKind` string remains in the tick
handler.

`bounceVelocity` is applied to `next` (never `playerState.value` directly —
`next` is what gets persisted further down, so a direct write would be
clobbered). When several blocks return one in the same tick the engine applies
the most negative, which is deterministic and identical to today's behavior for
the single-pot case.

### 4. Shared reveal trigger — new `engine/RewardReveal.ts`

`createRewardReveal(ctx)` is built once per tick from
`{ originX, originY, canvasWidth, canvasHeight, journalRect, inFlightCount }`
and returns:

```ts
revealFact(fact, { x, y, effectId, counterKey?, collectedOverride? }): boolean
```

Building it once per tick also removes an existing small duplication: the
world-to-screen `originX`/`originY` expressions are computed twice per tick
today (once in the enemy-defeat block, once in the collectible block) from
identical expressions. The trigger's context computes them once, after the
camera has settled for the tick, and every reveal site reads them from there.

`counterKey` is optional and typed against the narrow `CounterPopupLabelKey`
(no `'chests'`), so the chest site reveals its fact and bumps no transient
popup — see the chests entry under Non-goals.

It owns, once, what all five sites currently each do slightly differently:

- the dedup-by-fact-id guard against `collectedFacts`
- appending to `collectedFacts`
- the slot allocator, seeded from `inFlightCount` — preserving today's
  reseed-from-live-in-flight-count semantics rather than an
  ever-incrementing counter
- `startFlightEffect` with the stack offset applied to BOTH the rise start and
  the mid hold point
- the counter popup, with the total from `levelTotals` and the numerator from
  `COUNTER_SECTIONS`

Returns whether it actually revealed, so callers can still gate their own
side effects (a puff, a counter bump) on it.

It writes the signals directly rather than staging into local arrays. Two of
the five sites (crate, chest) already do exactly this in production, so it is
a proven pattern here; `batch()` is deliberately not introduced (nothing in the
repo uses it today). If the manual browser check shows jank from several
reveals in one tick, wrapping the per-tick application in `batch()` is the
escape hatch.

Called by all five fact-reveal sites: enemy defeat, coin/coin-pot pickup, bonus
fruit, chest open, crate terminal hit. The key pickup stays outside it — it
reveals no fact, has a static `'Key'` caption, and flies to the HUD key counter
rather than the journal.

### 5. `COUNTER_SECTIONS` — one section→counter map

The mapping from `SectionId` to counter is currently duplicated between
`CollectiblesSummary.ts` (correct) and four inline
`f.sectionId === ...` filters in `PlatformerPage.tsx` (one of them wrong — see
"The bug this fixes"). Extracted to one map consumed by both
`collectiblesSummary` and `RewardReveal`:

- coins → skills
- fruits → certificates, projects
- enemies → courses
- crates → education, activities, languages
- chests → experience

Coins pass `collectedOverride`: under proportional pacing a coin carries no
fixed fact, so "skill facts revealed" and "coins collected" are different
numbers — the same wrinkle `CollectibleSummaryTotals.coinsCollected` already
exists for.

### 6. `levelTotals` (piece A)

One combined computed in `PlatformerState.ts` holding
`{ coins, fruits, chests, crates, enemies }`, replacing seven separate
`.filter(...).length` sites across `PlatformerPage.tsx` and `Journal.tsx`.
`CollectibleSummaryTotals` becomes `LevelTotals & { coinsCollected?: number }`,
so `Journal.tsx` spreads the computed instead of assembling totals inline from
four placement arrays every render.

Two constraints that must survive later edits, both documented on the computed:

- It reads base `collectiblePlacements`, NOT `allCollectiblePlacements`. That
  makes the coin total a fixed session constant by construction (replacing the
  `!allCollectiblePlacements.some(...)` de-double-counting dance) and keeps the
  computed invalidated only by layout/CV changes. Reading
  `allCollectiblePlacements` would invalidate it on every coin-pot drop,
  mid-play.
- One combined computed, not five. Every input derives from `currentLayout` +
  `currentCV`, so no event invalidates one total without invalidating all of
  them; finer granularity would skip zero work and re-scatter the single source
  of truth this piece creates.

`skillFactPool` stays separate and CVData-derived. Every total here is
level-dependent by construction; the pool deliberately is not, and that split
must not get collapsed.

Lands before the reveal trigger, which needs one place to read totals from.

## Edge cases

- **Crate hit 1 of 2** — `onHit` fires, `hitsTaken` (1) is below `MAX_HITS`, returns `{}`.
  No reveal, no puff (the puff is gated separately by `firePuffIfJustUsedUp`),
  bump animation still plays via `applyBlockHit`.
- **Crate with no fact** — a crate placed beyond available CVData returns `{}`
  on its terminal hit: destruction and puff, no reveal.
- **Re-reveal of an already-collected fact** — the trigger's dedup guard
  returns false; no duplicate flight effect and no counter bump.
- **Several blocks hit in one tick** — each gets its own `onHit` and its own
  reveal; slot allocation spreads their flight text across vertical slots
  exactly as today.
- **Both a top and a bottom contact on one block in one tick** — the
  `triggerSides` filter admits at most the sides that kind declares, and
  `applyBlockHit` is a no-op once used up, so a kind declaring both sides can
  still only take one hit per `maxHits` step.
- **Layout switch mid-session (editor "Try")** — `levelTotals` recomputes
  reactively; the coin dedup guard in the pacing path stays necessary for
  exactly this reason.

## Testing

TDD throughout, tests before implementation.

| Unit                     | Tests                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| crate numerator bug      | Regression test asserting the popup numerator and the Journal's crate row agree — written first, failing |
| `COUNTER_SECTIONS`       | Every `CounterPopupLabelKey` has a non-empty section list; no section belongs to two counters      |
| `Crate.onHit`            | No reveal on hit 1; reveals on hit 2 with `counterKey: 'crates'`; no reveal without a fact          |
| `QuestionMark.onHit`     | Returns `spawnPickup: 'bonusFruit'`                                                                |
| `CoinPot.onHit`          | Returns `spawnPickup: 'coin'` and the coin-pot bounce velocity                                     |
| `blocks/index.test.ts`   | Every kind declares a non-empty `triggerSides`, alongside the existing key-equals-slot invariant    |
| `RewardReveal`           | Dedup guard; slot cycling from the seeded in-flight count; popup numerator/denominator; flight-effect coordinates including stack offset |
| `levelTotals`            | Each field against a known layout; reactivity across a `currentLayout` switch                      |
| `CollectiblesSummary`, `Journal` | Existing tests pass unchanged — the regression net on `COUNTER_SECTIONS` and the spread   |
| `PlatformerPage` (real ticks) | Crate terminal hit bumps the crates popup; a coin revealing no fact still bumps the coins popup; a chest open bumps no transient popup |

The tick handler IS reachable from the suite: `PlatformerPage.test.tsx` stubs
`requestAnimationFrame`, captures the frame callback and drives real ticks, so
the single block-hit pass and all five reveal sites run under test. The
counter-popup wiring is asserted there directly against
`activeCounterPopups` — the crate site bumping the crates popup, a coin that
reveals no fact still bumping the coins popup, and the chest site bumping no
transient popup at all.

The manual browser check the roadmap's working agreement requires still
covers what the suite cannot see — timing, layering and visual jank: break a
crate at each hit stage, land on a coin pot, hit a question mark, open a
chest, defeat an enemy, and confirm every popup's numerator matches the
Journal's row.

## Constitution check

| Principle                     | Outcome                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| I. Typed data architecture    | Pass. No new data files; `LevelTotals`/`BlockHitOutcome` are declared before use, no `any`.                          |
| II. Testing (non-negotiable)  | Pass. Tests first for every unit above, including a failing regression test for the bug. Tick-handler integration is manual-verified, as with every prior step. |
| III. Code quality             | Pass. New modules follow the existing `entities/*/` + `index.ts` registry pattern; no shadcn/ui components involved.  |
| IV. No feature bloat          | Pass. No new gameplay. The one candidate addition (a chests counter popup) is explicitly rejected as duplicating the permanent HUD counter. |
| V. Performance                | Pass. `levelTotals` is lazy and cached, invalidated only by layout/CV changes. The block pass replaces two loops with one. Reveal writes are direct, matching existing proven sites; `batch()` held in reserve. |

## Order of work

1. Crate-numerator bug fix, own commit: `COUNTER_SECTIONS` +
   `countCollectedFor`, failing test first, called from the crate site.
2. `levelTotals` (piece A), and the remaining numerators onto
   `countCollectedFor`.
3. `engine/Outcome.ts`, and `bouncePlayer` → `bounceVelocity` across enemies
   and `Collision.ts`.
4. `BlockType.triggerSides` + per-kind `onHit`; collapse the two engine loops
   into one.
5. `engine/RewardReveal.ts`; migrate all five reveal sites onto it.
6. Manual browser verification, then whole-branch review.
