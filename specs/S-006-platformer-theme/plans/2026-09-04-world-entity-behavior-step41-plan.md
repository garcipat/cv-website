# Blocks Own Their Outcomes (Roadmap Step 41) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give blocks the behavior half of the pattern enemies already have — a declarative `onHit` outcome plus a `triggerSides` field — so `PlatformerPage.tsx`'s tick handler stops branching on `blockKind`, all five fact-reveal call sites collapse onto one shared trigger, and the crate counter popup stops counting the wrong sections.

**Architecture:** Two small composable interfaces (`PlayerEffects`, `RewardEffects`) form a shared outcome vocabulary in `engine/Outcome.ts`; `CollisionOutcome` composes the first, blocks' `BlockHitOutcome` composes both. `BlockType` gains `triggerSides` (engine-applied, like the existing `maxHits`/`removeWhenUsedUp`) and `onHit` (per-kind consequences). The engine's two near-duplicate block-hit loops become one generic pass, and a per-tick `createRewardReveal` factory owns the dedup/flight-effect/counter-popup work every reveal site currently duplicates.

**Tech Stack:** TypeScript strict, `@preact/signals-react`, Vitest + React Testing Library (existing stack, no new dependencies).

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-04-world-entity-behavior-design.md` (read it alongside this plan — it carries the rationale for every decision here). Program context for pieces C and D: `specs/S-006-platformer-theme/plans/2026-09-04-block-item-architecture-followup-notes.md`.

## Global Constraints

- TypeScript strict mode, no `any` (constitution Principle I).
- TDD: tests before implementation, all tests passing before moving on (constitution Principle II).
- Named exports only, no default exports; named arrow functions for components (constitution Principle III).
- No new dependencies. In particular do NOT introduce `batch()` from `@preact/signals-react` — nothing in the repo uses it today, and the reveal trigger deliberately writes signals directly (the crate and chest sites already do exactly that). It is the documented escape hatch only if the manual browser check shows jank.
- Test naming: `{method}-{Condition}-{ExpectedResult}`, e.g. `crates-factFromChestPool-isNotCounted`.
- Run the full suite with `npm test`, a single file with `npx vitest run <path>`.
- Run `npm run lint` before every commit — tests and `tsc` do not catch lint-only rules, and lint errors have slipped through review in this repo before.
- Behavior-preserving unless a task says otherwise. Exactly one task (Task 1) changes user-visible behavior.
- `specs/S-006-platformer-theme/roadmap.md` step 41 gets checked off in the final task, after the manual browser check. This platformer step is tracked in `roadmap.md`, not in `docs/Features.md`'s F/S/O list — confirm `docs/Features.md` has no matching entry before skipping it.

## Suggested model per task

Put the per-task pick here rather than only in chat, so an executor reading the file alone gets it.

| Task | Model | Why |
| ---- | ----- | --- |
| 1 | Sonnet | Small, well-specified extraction plus a one-line call-site swap. |
| 2 | Sonnet | Mechanical: one computed plus seven call-site replacements. |
| 3 | Sonnet | Mechanical rename plus a field-type change across six files, all compiler-guided. |
| 4 | Sonnet | Four small type modules, each with its own unit test. |
| 5 | **Opus** | The genuinely hard one: collapsing two interleaved loops inside a 1800-line RAF closure, with `next`-mutation ordering that the type checker cannot verify. |
| 6 | **Opus** | Five call sites with subtly different staging, dedup and slot semantics that must come out behaviorally identical. |
| 7 | Sonnet | Verification and docs. |

---

## File Structure

New files:

- `src/themes/platformer/engine/Outcome.ts` — the shared `PlayerEffects`/`RewardEffects` vocabulary. Types only, no logic, no test file of its own (its consumers' tests cover it).
- `src/themes/platformer/engine/RewardReveal.ts` — the per-tick reveal trigger factory.
- `src/themes/platformer/engine/RewardReveal.test.ts` — its tests.

Modified files, by task:

| Task | Files |
| ---- | ----- |
| 1 | `entities/CollectiblesSummary.ts` + `.test.ts`, `PlatformerPage.tsx` |
| 2 | `PlatformerState.ts` + `.test.ts`, `entities/CollectiblesSummary.ts`, `components/Journal.tsx`, `PlatformerPage.tsx` |
| 3 | `engine/Outcome.ts` (new), `engine/Contact.ts`, `engine/Collision.ts` + `.test.ts`, `entities/pickups/index.ts`, `entities/enemies/SlimeGreen.ts`, `entities/enemies/SlimePurple.ts` + `.test.ts`, `PlatformerPage.tsx` |
| 4 | `entities/blocks/BlockType.ts`, `Crate.ts` + `.test.ts`, `QuestionMark.ts`, `CoinPot.ts` + `.test.ts`, `FragileRock.ts`, `blocks/index.test.ts` |
| 5 | `PlatformerPage.tsx` |
| 6 | `engine/RewardReveal.ts` + `.test.ts` (new), `PlatformerPage.tsx` |
| 7 | `specs/S-006-platformer-theme/roadmap.md` |

---

### Task 1: `COUNTER_SECTIONS` + `countCollectedFor` — fixes the crate numerator bug

This is the one task that changes user-visible behavior. Keep it as its own commit.

The bug: `PlatformerPage.tsx`'s crate popup numerator counts `sectionId === 'experience' || sectionId === 'education'`, but `level/BlockMapper.ts` maps crates from **education, activities, languages** — `'experience'` is the CHEST pool. So chest facts inflate the crate counter and activities/languages crates never increment it, while `CollectiblesSummary.ts` has the mapping right. The buggy expression is inline inside the `requestAnimationFrame` closure and cannot be reached from a test, so making it testable requires extracting the mapping — that extraction IS the fix.

**Files:**

- Modify: `src/themes/platformer/entities/CollectiblesSummary.ts`
- Modify: `src/themes/platformer/entities/CollectiblesSummary.test.ts`
- Modify: `src/themes/platformer/PlatformerPage.tsx` (the crate reward block, around line 1405)
- Test: `src/themes/platformer/entities/CollectiblesSummary.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `export type CounterKey = 'coins' | 'fruits' | 'enemies' | 'crates' | 'chests'`
  - `export const COUNTER_SECTIONS: Record<CounterKey, readonly SectionId[]>`
  - `export function countCollectedFor(counterKey: CounterKey, facts: readonly CollectedFact[]): number`
  - Consumed by Task 2 (remaining numerators) and Task 6 (`RewardReveal`).

- [ ] **Step 1: Write the failing tests**

Append to `src/themes/platformer/entities/CollectiblesSummary.test.ts`:

```ts
import { collectiblesSummary, countCollectedFor, COUNTER_SECTIONS } from './CollectiblesSummary';
import type { CounterKey } from './CollectiblesSummary';
import type { CollectedFact, SectionId } from '../types';

/** A minimal fact in the given section — only `sectionId` matters to
 *  countCollectedFor, but CollectedFact requires the rest. */
const factIn = (id: string, sectionId: SectionId): CollectedFact => ({
  id,
  sectionId,
  sectionLabel: sectionId,
  data: { category: 'x', skills: [] },
  sourceType: 'block',
});

describe('countCollectedFor', () => {
  it('crates-crateSectionFacts-countsEveryOne', () => {
    const facts = [
      factIn('a', 'education'),
      factIn('b', 'activities'),
      factIn('c', 'languages'),
    ];

    expect(countCollectedFor('crates', facts)).toBe(3);
  });

  // The bug this task fixes: PlatformerPage.tsx counted 'experience' (the
  // chest pool) as a crate, which let the crate popup read 3/3 with a single
  // crate broken.
  it('crates-factFromChestPool-isNotCounted', () => {
    expect(countCollectedFor('crates', [factIn('a', 'experience')])).toBe(0);
  });

  it('chests-experienceFact-isCounted', () => {
    expect(countCollectedFor('chests', [factIn('a', 'experience')])).toBe(1);
  });

  it('fruits-certificateAndProjectFacts-countsBoth', () => {
    const facts = [factIn('a', 'certificates'), factIn('b', 'projects')];

    expect(countCollectedFor('fruits', facts)).toBe(2);
  });

  it('coins-skillFact-isCounted', () => {
    expect(countCollectedFor('coins', [factIn('a', 'skills')])).toBe(1);
  });

  it('enemies-courseFact-isCounted', () => {
    expect(countCollectedFor('enemies', [factIn('a', 'courses')])).toBe(1);
  });

  it('anyCounter-noMatchingFacts-returnsZero', () => {
    expect(countCollectedFor('enemies', [factIn('a', 'skills')])).toBe(0);
  });
});

describe('COUNTER_SECTIONS', () => {
  it('everyCounter-hasAtLeastOneSection', () => {
    for (const sections of Object.values(COUNTER_SECTIONS)) {
      expect(sections.length).toBeGreaterThan(0);
    }
  });

  // The invariant that made the crate bug possible: 'experience' belonged to
  // both crates and chests in the two mappings. No section may feed two
  // counters, or a fact would be double-counted across popups.
  it('everySection-belongsToAtMostOneCounter', () => {
    const seen = new Set<SectionId>();
    for (const sections of Object.values(COUNTER_SECTIONS)) {
      for (const section of sections) {
        expect(seen.has(section)).toBe(false);
        seen.add(section);
      }
    }
  });
});
```

Leave the existing `describe('collectiblesSummary', ...)` block untouched — it is the regression net proving the extraction did not change the summary's behavior.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/entities/CollectiblesSummary.test.ts`
Expected: FAIL — `countCollectedFor` and `COUNTER_SECTIONS` are not exported from `./CollectiblesSummary`.

- [ ] **Step 3: Add the map and helper**

In `src/themes/platformer/entities/CollectiblesSummary.ts`, add the import of `SectionId` to the existing type import and insert this above `CollectibleSummaryRow`:

```ts
import type { CollectedFact, SectionId } from '../types';

/** Which collectible counters exist — the HUD's transient popups
 *  (`CounterPopupLabelKey`, which omits `chests`: chests have a permanent HUD
 *  counter instead) plus the journal's summary rows, which do include it. */
export type CounterKey = 'coins' | 'fruits' | 'enemies' | 'crates' | 'chests';

/**
 * Which CV sections each collectible counter is fed by — the single source of
 * truth for both the journal's summary rows and the in-game counter popups.
 *
 * This mapping used to exist twice, and the two copies disagreed: the crate
 * popup counted `'experience'` (the CHEST pool) as a crate and ignored
 * activities/languages entirely, so the HUD and the journal reported
 * different numbers for the same thing. One map, two consumers, no way to
 * drift again — `COUNTER_SECTIONS`'s own test asserts no section feeds two
 * counters, which is exactly the invariant that broke.
 *
 * Keyed by `sectionId` rather than `sourceType`: a fact's `sourceType` alone
 * cannot distinguish which pool it came from (`'block'` covers both crates and
 * question-mark fruit).
 */
export const COUNTER_SECTIONS: Record<CounterKey, readonly SectionId[]> = {
  coins: ['skills'],
  fruits: ['certificates', 'projects'],
  enemies: ['courses'],
  crates: ['education', 'activities', 'languages'],
  chests: ['experience'],
};

/** How many of `facts` feed the given counter. The numerator for every
 *  counter popup and summary row — except the coins row, which overrides it
 *  (see `CollectibleSummaryTotals.coinsCollected`): under proportional
 *  pacing a coin carries no fixed fact, so "skill facts revealed" and "coins
 *  collected" are different numbers. */
export function countCollectedFor(
  counterKey: CounterKey,
  facts: readonly CollectedFact[],
): number {
  const sections = COUNTER_SECTIONS[counterKey];
  return facts.filter((fact) => sections.includes(fact.sectionId)).length;
}
```

Then change `CollectibleSummaryRow.labelKey` to reuse the new alias, and route every row through the helper:

```ts
export interface CollectibleSummaryRow {
  labelKey: CounterKey;
  collected: number;
  total: number;
}
```

Inside `collectiblesSummary`, replace each inline `facts.filter(...)` with `countCollectedFor(...)`:

```ts
  if (totals.coins > 0) {
    rows.push({
      labelKey: 'coins',
      collected: totals.coinsCollected ?? countCollectedFor('coins', facts),
      total: totals.coins,
    });
  }

  if (totals.fruits > 0) {
    rows.push({ labelKey: 'fruits', collected: countCollectedFor('fruits', facts), total: totals.fruits });
  }

  if (totals.enemies > 0) {
    rows.push({ labelKey: 'enemies', collected: countCollectedFor('enemies', facts), total: totals.enemies });
  }

  if (totals.crates > 0) {
    rows.push({ labelKey: 'crates', collected: countCollectedFor('crates', facts), total: totals.crates });
  }

  if (totals.chests > 0) {
    rows.push({ labelKey: 'chests', collected: countCollectedFor('chests', facts), total: totals.chests });
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/CollectiblesSummary.test.ts`
Expected: PASS — the new tests plus every pre-existing `collectiblesSummary` test.

- [ ] **Step 5: Fix the call site — this is the actual bug fix**

In `src/themes/platformer/PlatformerPage.tsx`, in the crate terminal-hit block (around line 1405), delete the inline numerator and call the helper. Before:

```ts
              const crateCollected = collectedFacts.value.filter(
                (f) => f.sectionId === 'experience' || f.sectionId === 'education',
              ).length;
```

After:

```ts
              const crateCollected = countCollectedFor('crates', collectedFacts.value);
```

Add `countCollectedFor` to the existing import from `./entities/CollectiblesSummary` if the page already imports from it; otherwise add a new import line beside the other `./entities/...` imports.

- [ ] **Step 6: Verify the whole suite and lint**

Run: `npm test`
Expected: PASS, no regressions.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/entities/CollectiblesSummary.ts src/themes/platformer/entities/CollectiblesSummary.test.ts src/themes/platformer/PlatformerPage.tsx
git commit -m "fix(platformer): count the right sections in the crate counter popup"
```

---

### Task 2: `levelTotals` — one computed for every placed-in-level count

**Files:**

- Modify: `src/themes/platformer/entities/CollectiblesSummary.ts` (split `LevelTotals` out of `CollectibleSummaryTotals`)
- Modify: `src/themes/platformer/PlatformerState.ts` (the new computed)
- Modify: `src/themes/platformer/PlatformerState.test.ts`
- Modify: `src/themes/platformer/components/Journal.tsx` (spread the computed)
- Modify: `src/themes/platformer/PlatformerPage.tsx` (replace six total computations)
- Test: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**

- Consumes: `countCollectedFor`, `CounterKey` (Task 1).
- Produces:
  - `export interface LevelTotals { coins: number; fruits: number; enemies: number; crates: number; chests: number }` in `entities/CollectiblesSummary.ts`
  - `export type CollectibleSummaryTotals = LevelTotals & { coinsCollected?: number }` (same name as today, so `collectiblesSummary`'s signature is unchanged)
  - `export const levelTotals: ReadonlySignal<LevelTotals>` in `PlatformerState.ts`, consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/PlatformerState.test.ts` (add `levelTotals` to the existing import from `./PlatformerState`, and `currentLayout`/`LEVEL_1_LAYOUT` are already imported from `./level/level`):

```ts
describe('levelTotals', () => {
  afterEach(() => {
    // currentLayout is module-level (see level.ts's doc comment) — restore it
    // so this describe block doesn't leak a stripped-down layout into every
    // other test in this file.
    currentLayout.value = LEVEL_1_LAYOUT;
  });

  it('layoutWithNoMarkers-isAllZeroes', () => {
    currentLayout.value = ['GGG'];

    expect(levelTotals.value).toEqual({ coins: 0, fruits: 0, enemies: 0, crates: 0, chests: 0 });
  });

  // A coin-pot's coin does not exist in allCollectiblePlacements until the pot
  // is destroyed, so the total counts placed coins PLUS every pot up front —
  // otherwise the denominator would creep upward during play instead of
  // staying fixed all session.
  it('layoutWithOneCoinAndOneCoinPot-countsBothAsCoins', () => {
    currentLayout.value = ['SCu', 'GGG'];

    expect(levelTotals.value.coins).toBe(2);
  });

  it('layoutWithOneCoinAndOneCoinPot-countsNoOtherCollectible', () => {
    currentLayout.value = ['SCu', 'GGG'];

    expect(levelTotals.value).toMatchObject({ fruits: 0, enemies: 0, crates: 0, chests: 0 });
  });

  it('level1Layout-matchesTheSamePlacementFiltersEveryCallSiteUsedBefore', () => {
    // Guards against a mis-wired field (crates reading questionMark, say) —
    // each field must equal the exact expression its former call site used.
    expect(levelTotals.value).toEqual({
      coins:
        collectiblePlacements.value.filter((p) => p.spriteType === 'coin').length +
        blockPlacements.value.filter((b) => b.blockKind === 'coinPot').length,
      fruits: blockPlacements.value.filter((b) => b.blockKind === 'questionMark' && b.fact).length,
      enemies: enemyPlacements.value.filter((p) => p.fact).length,
      crates: blockPlacements.value.filter((b) => b.blockKind === 'crate').length,
      chests: chestPlacements.value.length,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: FAIL — `levelTotals` is not exported from `./PlatformerState`.

- [ ] **Step 3: Split `LevelTotals` out in `CollectiblesSummary.ts`**

Replace the existing `CollectibleSummaryTotals` interface with a `LevelTotals` interface plus an intersection alias. Keep the existing `coinsCollected` doc comment verbatim — only its home changes:

```ts
/**
 * Every placed-in-level count, one per collectible counter. Derived once by
 * `PlatformerState.ts`'s `levelTotals` computed and read by both the journal's
 * summary rows and the HUD's counter popups, so the two can never disagree.
 * Totalling against placement counts rather than raw CVData length avoids a
 * row showing more than the level actually has placed — e.g. Projects showing
 * "0/3" forever when 0 of its 3 entries have a question-mark marker.
 */
export interface LevelTotals {
  coins: number;
  fruits: number;
  enemies: number;
  crates: number;
  chests: number;
}

export type CollectibleSummaryTotals = LevelTotals & {
  /**
   * Overrides the coins row's "collected" count — needed because a coin no
   * longer carries a fixed 1:1 fact binding (see CollectibleMapper.ts's
   * mapCVDataToSkillFactPool doc comment): under proportional fact pacing
   * (level/SkillFactPacing.ts), "skill facts revealed" and "coins collected"
   * are different numbers whenever the coin count and the skill-category
   * count differ, so deriving "collected" from `facts` the way every other
   * row still does would show a numerator in different units than the
   * denominator (and could even exceed it). Falls back to the
   * facts-derived count when omitted.
   */
  coinsCollected?: number;
};
```

- [ ] **Step 4: Add the computed**

In `src/themes/platformer/PlatformerState.ts`, after `chestPlacements` (so it sits with the placement computeds it derives from), add:

```ts
/**
 * Every placed-in-level count, computed once. Read by `PlatformerPage.tsx`'s
 * counter popups and `Journal.tsx`'s `collectiblesSummary` call — this used to
 * be seven separate `.filter(...).length` expressions across those two files,
 * with the coin total spelled two different ways.
 *
 * Two constraints that must survive later edits:
 *
 * 1. It reads base `collectiblePlacements`, NOT `allCollectiblePlacements`.
 *    Every coin-pot WILL drop a coin eventually, so counting placed coins plus
 *    every pot up front makes the coin total a fixed session constant by
 *    construction — and keeps this computed invalidated only by
 *    `currentLayout`/`currentCV` changes. Reading `allCollectiblePlacements`
 *    would invalidate it on every pot drop, mid-play.
 * 2. ONE combined computed, not five. Every input derives from `currentLayout`
 *    + `currentCV`, so no event invalidates one total without invalidating all
 *    of them; splitting per field would skip zero work and re-scatter the
 *    single source of truth this exists to create.
 *
 * `skillFactPool` deliberately stays separate: every total here is
 * level-dependent by construction (COIN_TILES/CRATE_TILES/etc. are all
 * `computed(() => findXTiles(currentLayout.value))`, which is what makes the
 * Level Editor's "Try" button update every downstream total reactively),
 * whereas the pool is CVData-derived and level-independent. Do not collapse
 * the two.
 */
export const levelTotals = computed<LevelTotals>(() => ({
  coins:
    collectiblePlacements.value.filter((p) => p.spriteType === 'coin').length +
    blockPlacements.value.filter((b) => b.blockKind === 'coinPot').length,
  fruits: blockPlacements.value.filter((b) => b.blockKind === 'questionMark' && b.fact).length,
  enemies: enemyPlacements.value.filter((p) => p.fact).length,
  crates: blockPlacements.value.filter((b) => b.blockKind === 'crate').length,
  chests: chestPlacements.value.length,
}));
```

Add `import type { LevelTotals } from './entities/CollectiblesSummary';` to the file's imports.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: PASS.

- [ ] **Step 6: Replace the call sites in `PlatformerPage.tsx`**

Six replacements. Add `levelTotals` to the existing `./PlatformerState` import.

1. Enemy total (around line 879) — delete `const enemyTotal = ...` and use `levelTotals.value.enemies` in the `startCounterPopup('enemies', ...)` call.
2. Coin total (around lines 947–951) — delete BOTH `const coinPotIds = ...` and `const totalCoinCount = ...`, then use `levelTotals.value.coins` everywhere `totalCoinCount` appeared. Note there are three such uses: the two `revealedFactCountFor(...)` calls and the `startCounterPopup('coins', ...)` call. This is exactly equivalent — the deleted expression counted placed coins plus pots-not-yet-dropped, which is the same fixed number.
3. Bonus fruit total (around line 1085) — delete `const bonusFruitTotal = ...`, use `levelTotals.value.fruits`.
4. Crate total (around line 1406) — delete `const crateTotal = ...`, use `levelTotals.value.crates`.
5. Key-counter chest total (around line 1119) — replace `chestPlacements.value.length` with `levelTotals.value.chests` in the `keyCounterX(...)` call.
6. HUD chest counter in `render()` (around lines 593–608) — replace all three `chestPlacements.value.length` uses with `levelTotals.value.chests`.

While here, route the remaining inline numerators through Task 1's helper:

- Bonus fruit numerator (around line 1088): `const bonusFruitCollected = countCollectedFor('fruits', newFacts);`
- Enemy numerator (around line 878): `const enemyDefeated = countCollectedFor('enemies', newFacts);` — this replaces `newFacts.filter((f) => f.sourceType === 'enemy').length`. Behavior-equivalent today (Courses is the only enemy-sourced section) and now consistent with every other counter. Keep the existing doc comment about the denominator counting only fact-bearing placements.

- [ ] **Step 7: Replace the totals assembly in `Journal.tsx`**

In `src/themes/platformer/components/Journal.tsx` (around line 422), replace the inline four-array object with a spread. Before:

```tsx
                        {collectiblesSummary(facts, {
                          coins:
                            collectiblePlacements.value.filter((p) => p.spriteType === 'coin').length +
                            blockPlacements.value.filter((b) => b.blockKind === 'coinPot').length,
                          // ... long coinsCollected comment ...
                          coinsCollected: allCollectiblePlacements.value.filter(
                            (p) => p.spriteType === 'coin' && collectedCollectibleIds.value.has(p.id),
                          ).length,
                          fruits: blockPlacements.value.filter((b) => b.blockKind === 'questionMark' && b.fact).length,
                          enemies: enemyPlacements.value.filter((p) => p.fact).length,
                          crates: blockPlacements.value.filter((b) => b.blockKind === 'crate').length,
                          chests: chestPlacements.value.length,
                        }).map((row) => (
```

After:

```tsx
                        {collectiblesSummary(facts, {
                          ...levelTotals.value,
                          // Explicit override, not derived from `facts` — under
                          // proportional fact pacing a coin carries no fixed
                          // fact of its own (see CollectibleMapper.ts's
                          // mapCVDataToSkillFactPool doc comment), so "skill
                          // facts revealed" and "coins collected" are different
                          // numbers. This counts actual collected coin
                          // placements, the same quantity the in-game HUD popup
                          // shows, so the two never disagree.
                          coinsCollected: allCollectiblePlacements.value.filter(
                            (p) => p.spriteType === 'coin' && collectedCollectibleIds.value.has(p.id),
                          ).length,
                        }).map((row) => (
```

Then remove any now-unused imports from `Journal.tsx` (`collectiblePlacements`, `blockPlacements`, `enemyPlacements`, `chestPlacements` may all become unused — `npm run lint` will tell you which) and add `levelTotals`.

- [ ] **Step 8: Verify the whole suite and lint**

Run: `npm test`
Expected: PASS. `Journal.test.tsx` is the regression net here — if it fails, the spread changed a total, which is a real signal, not a test to update.

Run: `npm run lint`
Expected: no errors (in particular, no unused imports left in `Journal.tsx`).

- [ ] **Step 9: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts src/themes/platformer/entities/CollectiblesSummary.ts src/themes/platformer/components/Journal.tsx src/themes/platformer/PlatformerPage.tsx
git commit -m "refactor(platformer): derive every level total from one computed"
```

---

### Task 3: Shared outcome vocabulary + `bounceVelocity`

**Files:**

- Create: `src/themes/platformer/engine/Outcome.ts`
- Modify: `src/themes/platformer/entities/pickups/index.ts` (rename `PickupTypeKey` → `PickupKind`)
- Modify: `src/themes/platformer/engine/Contact.ts`
- Modify: `src/themes/platformer/engine/Collision.ts`
- Modify: `src/themes/platformer/engine/Collision.test.ts`
- Modify: `src/themes/platformer/entities/enemies/SlimeGreen.ts`
- Modify: `src/themes/platformer/entities/enemies/SlimePurple.ts`
- Modify: `src/themes/platformer/entities/enemies/SlimePurple.test.ts`
- Modify: `src/themes/platformer/PlatformerPage.tsx` (around lines 1256 and 1319)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `export interface PlayerEffects { damagePlayer?: number; bounceVelocity?: number; knockback?: 'none' | 'away' | 'awayAndUp' }`
  - `export interface RewardEffects { revealFact?: CollectedFact; spawnPickup?: PickupKind }`
  - `export type PickupKind = keyof typeof PICKUP_TYPES` (renamed)
  - `CollisionOutcome<S>` now extends `PlayerEffects`; `EnemyContactResult.bounceVelocity?: number` replaces `bouncePlayer: boolean`.
  - All consumed by Task 4 (`BlockHitOutcome`) and Task 6.

- [ ] **Step 1: Write the failing tests**

In `src/themes/platformer/engine/Collision.test.ts`, update the two existing bounce assertions (around lines 350 and 364) to the new field:

```ts
    // was: expect(result.bouncePlayer).toBe(false);
    expect(result.bounceVelocity).toBeUndefined();
```

```ts
    // was: expect(result.bouncePlayer).toBe(true);
    expect(result.bounceVelocity).toBe(PHYSICS_CONFIG.stompBounceVelocity);
```

Add `import { PHYSICS_CONFIG } from './PhysicsConfig';` if that file does not already import it.

Then add a new test for the aggregation rule, in the same `describe` as the existing bounce tests:

```ts
  it('twoStompedEnemiesInOneTick-appliesTheStrongestBounce', () => {
    // Aggregation is "most negative wins", not last-wins, so the result is
    // deterministic regardless of array order. Both green slimes bounce with
    // the same constant today, so this pins the rule rather than depending on
    // two different constants existing.
    //
    // Positions follow the same hitbox arithmetic the surrounding aggregation
    // tests use: the two green hitboxes span x 2..30 and 26..54, and the
    // player's spans 20..44, so it lands on both at once.
    const left = makeEnemy(0, 100);
    const right = makeEnemy(24, 100);
    const player = { ...playerLandingOnTopOf(left), vy: 300, grounded: false };

    const result = resolveEnemyContacts(player, [left, right]);

    expect(result.bounceVelocity).toBe(PHYSICS_CONFIG.stompBounceVelocity);
  });
```

`makeEnemy` and `playerLandingOnTopOf` are the file's own existing helpers — do not add new fixtures.

In `src/themes/platformer/entities/enemies/SlimePurple.test.ts` (around line 101):

```ts
    // was: expect(outcome.bouncePlayer).toBe(true);
    expect(outcome.bounceVelocity).toBe(PHYSICS_CONFIG.stompBounceVelocity);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Collision.test.ts src/themes/platformer/entities/enemies/SlimePurple.test.ts`
Expected: FAIL — `bounceVelocity` does not exist on the outcome or the result.

- [ ] **Step 3: Create `engine/Outcome.ts`**

```ts
import type { CollectedFact } from '../types';
import type { PickupKind } from '../entities/pickups';

/**
 * What an entity asks the engine to do to the PLAYER about a contact.
 * Composed by every family's outcome type rather than restated per family, so
 * "bounce the player" means one thing everywhere.
 *
 * Deliberately two small interfaces (this and `RewardEffects`) rather than one
 * outcome type covering everything: see Contact.ts's `CollisionOutcome` doc
 * comment — an outcome type that grows past a handful of fields has become the
 * scattered conditionals it replaced, and a unified type would hand every
 * family fields that are meaningless to it.
 */
export interface PlayerEffects {
  /** Half-hearts to deal to the player. The engine ignores this while the
   *  player is invulnerable; no entity ever knows invulnerability exists. */
  damagePlayer?: number;
  /**
   * Upward velocity impulse in px/s (negative = up), supplied by the TYPE
   * rather than chosen by the applier — an enemy stomp
   * (`stompBounceVelocity`, -330) and a coin-pot landing
   * (`coinPotBounceVelocity`, -220) are deliberately different strengths, so
   * a boolean here could not express both. The engine applies it uniformly as
   * `vy` + `bounceAscending: true` (the flag that protects the impulse from
   * the variable-jump-height cut). Not to be confused with `knockback`'s
   * `'awayAndUp'`, which is an involuntary reaction and deliberately NOT
   * gated by `bounceAscending`.
   */
  bounceVelocity?: number;
  knockback?: 'none' | 'away' | 'awayAndUp';
}

/**
 * What an entity asks the engine to add to the WORLD about a contact or hit.
 * Consumed by `RewardReveal.ts` (`revealFact`) and by the engine's pickup
 * dispatch (`spawnPickup`).
 */
export interface RewardEffects {
  /** A CV fact to reveal — pushed to `collectedFacts`, flown to the journal,
   *  and counted in its counter popup, all by `RewardReveal.ts`. */
  revealFact?: CollectedFact;
  /**
   * Which pickup to spawn at this entity's position, keyed by `PICKUP_TYPES` —
   * one field rather than a boolean per spawnable thing, so a block that drops
   * a key needs no new field here.
   *
   * Deliberately NOT named `*Effect`: in this codebase an Effect is a
   * transient visual (`FlightEffect`/`PuffEffect`/`CounterPopupEffect`),
   * whereas a spawned pickup is real world state the player can walk over and
   * collect. Note `'fruit'` and `'bonusFruit'` are separate registry keys with
   * different state types — the rising, fact-carrying one a question mark
   * drops is `'bonusFruit'`.
   */
  spawnPickup?: PickupKind;
}
```

- [ ] **Step 4: Rename `PickupTypeKey` → `PickupKind`**

In `src/themes/platformer/entities/pickups/index.ts`:

```ts
/** Which pickup kind — named for this codebase's existing convention for
 *  "which variant" (`BlockKind`, `blockKind`, `ItemKind`). Deliberately not
 *  `PickupKey`: there IS a key pickup (`ItemKind = 'key'`), so that name would
 *  read as "the key pickup". */
export type PickupKind = keyof typeof PICKUP_TYPES;
```

The old name has zero consumers (verify with `grep -rn "PickupTypeKey" src/`), so this is a pure rename with no call sites to update.

- [ ] **Step 5: Compose `PlayerEffects` into `CollisionOutcome`**

In `src/themes/platformer/engine/Contact.ts`, keep the existing doc comment and replace the interface body:

```ts
import type { PlayerEffects } from './Outcome';

export interface CollisionOutcome<S> extends PlayerEffects {
  /** Replacement state, if the contact changed this entity. */
  self?: S;
}
```

Delete the now-duplicated `damagePlayer`, `bouncePlayer` and `knockback` fields from it — they live in `PlayerEffects` now.

- [ ] **Step 6: Update the aggregation in `Collision.ts`**

In `EnemyContactResult`, replace `bouncePlayer: boolean;` with:

```ts
  /** The strongest (most negative) bounce any contacted enemy asked for, or
   *  undefined if none did. Most-negative-wins rather than last-wins so the
   *  result does not depend on enemy array order. */
  bounceVelocity?: number;
```

In `resolveEnemyContacts`, replace `let bouncePlayer = false;` with `let bounceVelocity: number | undefined;`, replace the `if (outcome.bouncePlayer) bouncePlayer = true;` line with:

```ts
    if (
      outcome.bounceVelocity !== undefined &&
      (bounceVelocity === undefined || outcome.bounceVelocity < bounceVelocity)
    ) {
      bounceVelocity = outcome.bounceVelocity;
    }
```

and change the returned object's `bouncePlayer,` to `bounceVelocity,`. Update the function's doc comment line "a bounce applies if any outcome requests one" to "the strongest requested bounce applies".

- [ ] **Step 7: Update both enemy modules**

In `SlimeGreen.ts` and `SlimePurple.ts`, add `import { PHYSICS_CONFIG } from '../../engine/PhysicsConfig';` and change each stomp branch:

```ts
    if (contact.side === 'top') {
      return { self: takeHit(enemy), bounceVelocity: PHYSICS_CONFIG.stompBounceVelocity };
    }
```

- [ ] **Step 8: Update the applier in `PlatformerPage.tsx`**

Around line 1256:

```ts
      if (contacts.bounceVelocity !== undefined) {
        playerState.value = {
          ...playerState.value,
          vy: contacts.bounceVelocity,
          bounceAscending: true,
        };
      }
```

Around line 1319, `suppressJumpCut: contacts.bouncePlayer` becomes:

```ts
          suppressJumpCut: contacts.bounceVelocity !== undefined,
```

`PHYSICS_CONFIG.stompBounceVelocity` may now be unused in `PlatformerPage.tsx` — `npm run lint` will say so; remove the import only if nothing else in the file uses `PHYSICS_CONFIG`.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. If `tsc` (via `npm run build`) is quicker to consult for the field rename's ripple, run `npx tsc -b` too.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/themes/platformer/engine/Outcome.ts src/themes/platformer/engine/Contact.ts src/themes/platformer/engine/Collision.ts src/themes/platformer/engine/Collision.test.ts src/themes/platformer/entities/pickups/index.ts src/themes/platformer/entities/enemies/SlimeGreen.ts src/themes/platformer/entities/enemies/SlimePurple.ts src/themes/platformer/entities/enemies/SlimePurple.test.ts src/themes/platformer/PlatformerPage.tsx
git commit -m "refactor(platformer): share one player-effects vocabulary, types own their bounce strength"
```

---

### Task 4: `BlockType.triggerSides` + per-kind `onHit`

The engine still uses its old hardcoded filters after this task — nothing changes behaviorally. Task 5 switches the engine over. That split is deliberate: this task's deliverable is unit-testable in isolation, Task 5's is not.

**Files:**

- Modify: `src/themes/platformer/entities/blocks/BlockType.ts`
- Modify: `src/themes/platformer/entities/blocks/Crate.ts` + `Crate.test.ts`
- Modify: `src/themes/platformer/entities/blocks/QuestionMark.ts`
- Modify: `src/themes/platformer/entities/blocks/CoinPot.ts` + `CoinPot.test.ts`
- Modify: `src/themes/platformer/entities/blocks/FragileRock.ts`
- Modify: `src/themes/platformer/entities/blocks/index.test.ts`

**Interfaces:**

- Consumes: `PlayerEffects`, `RewardEffects` (Task 3).
- Produces:
  - `export type BlockHitOutcome = PlayerEffects & RewardEffects` in `blocks/BlockType.ts`
  - `BlockType.triggerSides: readonly ContactSide[]` (required on every kind)
  - `BlockType.onHit?(block: BlockState): BlockHitOutcome`
  - All consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

In `src/themes/platformer/entities/blocks/index.test.ts`, add
`import { toBlockState } from '../Block';` and add to the
`describe('BLOCK_TYPES', ...)` block:

```ts
  it('everyEntry-declaresANonEmptyTriggerSides', () => {
    for (const type of Object.values(BLOCK_TYPES)) {
      expect(type.triggerSides.length).toBeGreaterThan(0);
    }
  });

  // These are the values PlatformerPage.tsx's two hardcoded
  // `blockKind === 'coinPot'` filters encoded before the engine read the
  // registry.
  it('coinPot-reactsOnlyToALandingFromAbove', () => {
    expect(BLOCK_TYPES.coinPot.triggerSides).toEqual(['top']);
  });

  it('everyOtherKind-reactsOnlyToAHitFromBelow', () => {
    for (const [key, type] of Object.entries(BLOCK_TYPES)) {
      if (key === 'coinPot') continue;
      expect(type.triggerSides).toEqual(['bottom']);
    }
  });
```

In `src/themes/platformer/entities/blocks/Crate.test.ts`, add (following the file's existing fixture style for building a `BlockState`):

```ts
describe('crate.onHit', () => {
  const crateFact: CollectedFact = {
    id: 'crate-edu-1',
    sectionId: 'education',
    sectionLabel: 'Education',
    data: { degree: 'BSc', institution: 'X', period: '2010' },
    sourceType: 'block',
  };

  // A crate takes two hits: the first cracks it, the second shatters it and
  // pays out. onHit receives the block AFTER applyBlockHit, so hitsTaken is
  // already incremented when it runs.
  it('firstOfTwoHits-revealsNothing', () => {
    const outcome = crate.onHit!(block({ hitsTaken: 1, fact: crateFact }));

    expect(outcome).toEqual({});
  });

  it('terminalHit-revealsItsFact', () => {
    const outcome = crate.onHit!(block({ hitsTaken: 2, fact: crateFact }));

    expect(outcome).toEqual({ revealFact: crateFact });
  });

  it('terminalHitWithNoFact-revealsNothing', () => {
    const outcome = crate.onHit!(block({ hitsTaken: 2, fact: undefined }));

    expect(outcome).toEqual({});
  });
});
```

`block(overrides)` is the file's own existing fixture helper (it wraps
`toBlockState` around a crate `BlockPlacement`) — reuse it, don't add another.
Add `CollectedFact` to the file's type imports.

In `src/themes/platformer/entities/blocks/CoinPot.test.ts`, add:

`CoinPot.test.ts` has no block fixture yet (it only asserts registry fields),
so build one with `toBlockState`:

```ts
import { toBlockState } from '../Block';
import { PHYSICS_CONFIG } from '../../engine/PhysicsConfig';

describe('coinPot.onHit', () => {
  it('itsOnlyHit-dropsACoinAndBouncesThePlayer', () => {
    const pot = toBlockState({ id: 'p1', blockKind: 'coinPot', x: 0, y: 0 });

    const outcome = coinPot.onHit!({ ...pot, hitsTaken: 1 });

    expect(outcome).toEqual({
      spawnPickup: 'coin',
      bounceVelocity: PHYSICS_CONFIG.coinPotBounceVelocity,
    });
  });
});
```

And a question-mark test — `QuestionMark.ts` has no test file of its own today, so add these cases to `index.test.ts` where its frame behavior is already tested:

```ts
describe('questionMark.onHit', () => {
  it('itsOnlyHit-spawnsABonusFruit', () => {
    // maxHits is 1, so its only registering hit is always its terminal one.
    const qmark = toBlockState({ id: 'q1', blockKind: 'questionMark', x: 0, y: 0 });

    expect(BLOCK_TYPES.questionMark.onHit!({ ...qmark, hitsTaken: 1 })).toEqual({
      spawnPickup: 'bonusFruit',
    });
  });
});

describe('fragileRock', () => {
  it('anyHit-hasNoConsequencesBeyondBreaking', () => {
    expect(BLOCK_TYPES.fragileRock.onHit).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/entities/blocks/`
Expected: FAIL — `triggerSides` and `onHit` do not exist on `BlockType`.

- [ ] **Step 3: Extend `BlockType`**

In `src/themes/platformer/entities/blocks/BlockType.ts`, add the imports and the type alias above the interface:

```ts
import type { ContactSide } from '../../engine/Contact';
import type { PlayerEffects, RewardEffects } from '../../engine/Outcome';

/** What a registering hit on a block MEANS — the block equivalent of
 *  `CollisionOutcome`. Carries no `self`: block hit counting stays generic
 *  (`maxHits` + `applyBlockHit`), so no kind needs to return replacement
 *  state. */
export type BlockHitOutcome = PlayerEffects & RewardEffects;
```

Then add these two members to the `BlockType` interface, and delete the sentence "Carries no trigger mechanism." from its doc comment (it does now):

```ts
  /**
   * Which contact sides register a hit on this kind. The engine filters
   * `player.blockContacts` against this generically — it used to hardcode
   * `blockKind !== 'coinPot'` for its below-hit loop and
   * `blockKind === 'coinPot'` for its landed-on-top loop, which is exactly
   * the per-kind knowledge that belongs here instead.
   */
  triggerSides: readonly ContactSide[];
  /**
   * What a registering hit MEANS for this kind. Receives the block AFTER
   * `applyBlockHit`, so comparing `block.hitsTaken` against this kind's own
   * max-hits constant is how it knows this hit was its terminal one.
   *
   * Deliberately NOT `isBlockUsedUp(block)`: that lives in `entities/Block.ts`,
   * which imports `BLOCK_TYPES`, so a block module calling it would close an
   * import cycle (Block.ts -> blocks/index.ts -> Crate.ts -> Block.ts). The
   * type-only `import type { BlockState }` these modules already have is
   * erased at build time and so is fine.
   *
   * Omitted by a kind whose destruction has no consequences beyond the
   * generic puff and removal (fragileRock).
   */
  onHit?(block: BlockState): BlockHitOutcome;
```

- [ ] **Step 4: Implement each kind**

`Crate.ts` — hoist the max-hits number into a named constant so `maxHits` and `onHit` cannot drift apart:

```ts
/** Two hits: the first cracks it, the second shatters it. */
const MAX_HITS = 2;
```

then in the object literal, `maxHits: MAX_HITS,` plus:

```ts
  triggerSides: ['bottom'],
  // Receives the block after applyBlockHit, so hitsTaken is already
  // incremented — the terminal hit is the one that reaches MAX_HITS. This
  // check used to live in PlatformerPage.tsx as `hitsTaken >= 2`.
  onHit: (block) => (block.hitsTaken >= MAX_HITS && block.fact ? { revealFact: block.fact } : {}),
```

`QuestionMark.ts`:

```ts
  triggerSides: ['bottom'],
  // maxHits is 1, so its only registering hit is always its terminal one.
  // The engine supplies the icon index (see PlatformerPage.tsx's
  // nextBonusFruitIcon) — a block never picks its fruit's appearance.
  onHit: () => ({ spawnPickup: 'bonusFruit' }),
```

`CoinPot.ts` — add `import { PHYSICS_CONFIG } from '../../engine/PhysicsConfig';` and:

```ts
  triggerSides: ['top'],
  // Destroyed by landing on it, not by a hit from below. Always drops a coin,
  // regardless of whether the skill-fact pool still has anything left — see
  // mapCVDataToSkillFactPool's doc comment: WHICH fact (if any) that coin
  // reveals is resolved when it is walked over, not here.
  onHit: () => ({
    spawnPickup: 'coin',
    bounceVelocity: PHYSICS_CONFIG.coinPotBounceVelocity,
  }),
```

`FragileRock.ts` — only the field, no hook:

```ts
  triggerSides: ['bottom'],
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/blocks/`
Expected: PASS.

Run: `npm test`
Expected: PASS — nothing else changed behaviorally.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/entities/blocks/
git commit -m "feat(platformer): let each block kind own its trigger sides and hit outcome"
```

---

### Task 5: The engine's two block loops collapse into one

**Model: Opus.** This edits a ~130-line region inside a 1800-line `requestAnimationFrame` closure, and the `next`-mutation ordering it depends on is not something the type checker can verify.

**Files:**

- Modify: `src/themes/platformer/PlatformerPage.tsx` (the region currently spanning roughly lines 1354–1483)

**Interfaces:**

- Consumes: `BLOCK_TYPES[kind].triggerSides` / `.onHit` and `BlockHitOutcome` (Task 4); `levelTotals` (Task 2); `countCollectedFor` (Task 1).
- Produces: no new exports. Task 6 replaces the reveal body inside this loop.

- [ ] **Step 1: Read the region first**

Read `src/themes/platformer/PlatformerPage.tsx` from the `firePuffIfJustUsedUp` definition through the end of the `landedOnTopIds` block. Note three things that must be preserved exactly:

1. `firePuffIfJustUsedUp` is shared by both loops and must stay shared.
2. The coin-pot bounce writes to `next` (the local), NOT `playerState.value` — `next` is persisted further down the tick, so a direct `playerState.value` write here is silently clobbered.
3. `originX`/`originY` are already in scope from the collectible-collision block above and are deliberately reused, not redeclared.

- [ ] **Step 2: Replace both loops with one pass**

Delete the `hittableBlockIds` block and the `landedOnTopIds` block entirely, and put this in their place (keeping `firePuffIfJustUsedUp` above it unchanged):

```ts
      // Every block whose contact side this kind actually reacts to (see
      // BlockType.triggerSides) and that isn't already used up. This replaces
      // two near-duplicate loops — one for 'bottom' contacts that excluded
      // coinPot by name, one for 'top' contacts that admitted only coinPot —
      // whose only real difference was per-kind knowledge that now lives in
      // the registry.
      const hitBlocks = next.blockContacts
        .map((contact) => ({ contact, block: blockStates.value.find((b) => b.id === contact.id) }))
        .filter(
          (entry): entry is { contact: BlockContact; block: BlockState } =>
            entry.block !== undefined &&
            !isBlockUsedUp(entry.block) &&
            BLOCK_TYPES[entry.block.blockKind].triggerSides.includes(entry.contact.side),
        );

      if (hitBlocks.length > 0) {
        const hitIds = new Set(hitBlocks.map((entry) => entry.block.id));
        blockStates.value = blockStates.value.map((block) =>
          hitIds.has(block.id) ? applyBlockHit(block) : block,
        );

        const journalRect = journalButtonRef.current?.getBoundingClientRect();
        const targetX = journalRect ? journalRect.left + journalRect.width / 2 : canvas.width - 32;
        const targetY = journalRect ? journalRect.top + journalRect.height / 2 : canvas.height - 32;
        const midX = canvas.width / 2;
        const midY = canvas.height * 0.3;

        // Most negative wins, so several blocks bouncing the player in one
        // tick is deterministic regardless of iteration order.
        let bounceVelocity: number | undefined;

        for (const id of hitIds) {
          // Re-read from the post-applyBlockHit array: onHit must see the
          // incremented hitsTaken, which is how a kind knows this hit was its
          // terminal one.
          const block = blockStates.value.find((b) => b.id === id);
          if (!block) continue;

          // A world-event burst on destruction, independent of whether a
          // reward is also awarded alongside it (B-003).
          firePuffIfJustUsedUp(block);

          const outcome = BLOCK_TYPES[block.blockKind].onHit?.(block) ?? {};

          if (
            outcome.bounceVelocity !== undefined &&
            (bounceVelocity === undefined || outcome.bounceVelocity < bounceVelocity)
          ) {
            bounceVelocity = outcome.bounceVelocity;
          }

          // One dispatch keyed by pickup type, replacing the old per-blockKind
          // branches. The two arms differ because their target arrays differ,
          // and each keeps what is the engine's business rather than the
          // block's: the fruit icon cycle, and the dropped coin's id/position.
          if (outcome.spawnPickup === 'bonusFruit') {
            bonusFruitStates.value = [
              ...bonusFruitStates.value,
              spawnBonusFruit(block.id, block.x, block.y, block.fact, nextBonusFruitIcon++),
            ];
          } else if (outcome.spawnPickup === 'coin') {
            // `block.id` is the pot's own id, not a fact id (the block never
            // had one) — this is what the coin-total dedup guard matches
            // against once this coin exists in allCollectiblePlacements.
            spawnedCoinPlacements.value = [
              ...spawnedCoinPlacements.value,
              { id: block.id, spriteType: 'coin', x: block.x, y: block.y },
            ];
          }

          if (outcome.revealFact) {
            const fact = outcome.revealFact;
            // Dedup by fact id, same defensive guard every other reward path
            // uses (FR-020c).
            if (!collectedFacts.value.some((f) => f.id === fact.id)) {
              const { icon, title: label } = formatJournalEntry(fact);
              const slot = nextTextSlot;
              nextTextSlot = (nextTextSlot + 1) % COLLECTION_TEXT_SLOT_COUNT;
              const stackOffsetY = slot * COLLECTION_TEXT_STACK_ROW_HEIGHT;
              collectedFacts.value = [...collectedFacts.value, fact];
              activeCounterPopups.value = {
                ...activeCounterPopups.value,
                crates: startCounterPopup(
                  'crates',
                  countCollectedFor('crates', collectedFacts.value),
                  levelTotals.value.crates,
                ),
              };
              activeEffects.value = [
                ...activeEffects.value,
                startFlightEffect(
                  block.id,
                  label,
                  block.x + originX,
                  block.y + originY + stackOffsetY,
                  midX,
                  midY + stackOffsetY,
                  targetX,
                  targetY,
                  icon,
                ),
              ];
            }
          }
        }

        if (bounceVelocity !== undefined) {
          // Mutates `next`, not `playerState.value` — `next` is what gets
          // persisted further down this tick (after the pit-fall check and
          // anim-state updates), so a direct playerState.value write here
          // would be silently clobbered by that later assignment.
          next = { ...next, vy: bounceVelocity, bounceAscending: true };
        }
      }
```

Note the hardcoded `'crates'` counter key in the reveal branch: today only crates reveal a fact from a block, and Task 6 replaces this whole `if (outcome.revealFact)` body with a `revealFact(...)` call that takes the counter key as a parameter. Leave it hardcoded here rather than inventing a second mechanism that Task 6 will delete.

- [ ] **Step 3: Fix up imports and types**

- Add `BlockContact` to the page's type imports — it is already exported from `src/themes/platformer/entities/Player.ts` (line 46), alongside `BlockContactSide`. No new export is needed.
- `BLOCK_TYPES` and `isBlockUsedUp` are already imported by the page (verify); add them if not.
- `countCollectedFor` and `levelTotals` come from Tasks 1 and 2.

- [ ] **Step 4: Verify no `blockKind` branch remains in the tick handler**

Run: `grep -n "blockKind ===\|blockKind !==" src/themes/platformer/PlatformerPage.tsx`
Expected: no hits inside the tick handler. (A `blockKind` mention may legitimately remain in a comment; a comparison must not.)

- [ ] **Step 5: Run the tests and lint**

Run: `npm test`
Expected: PASS. `PlatformerPage.test.tsx` does not drive the RAF loop, so it will not catch a logic error here — Task 7's browser check is what verifies this task.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx
git commit -m "refactor(platformer): apply block hits generically from the registry"
```

---

### Task 6: `engine/RewardReveal.ts` and the five reveal sites

**Model: Opus.** Five call sites with subtly different staging, dedup and slot semantics that must come out behaviorally identical.

**Files:**

- Create: `src/themes/platformer/engine/RewardReveal.ts`
- Create: `src/themes/platformer/engine/RewardReveal.test.ts`
- Modify: `src/themes/platformer/PlatformerPage.tsx` (five sites)

**Interfaces:**

- Consumes: `countCollectedFor`, `CounterKey` (Task 1); `levelTotals` (Task 2).
- Produces:
  - `export interface RevealContext { originX: number; originY: number; canvasWidth: number; canvasHeight: number; journalRect: DOMRect | null; inFlightCount: number }`
  - `export interface RevealOptions { x: number; y: number; effectId: string; counterKey?: CounterPopupLabelKey; collectedOverride?: number }` — `counterKey` is OPTIONAL and uses the existing narrow popup union (which has no `'chests'`), so the chest site reveals its fact without bumping any popup.
  - `export function createRewardReveal(ctx: RevealContext): (fact: CollectedFact, options: RevealOptions) => boolean`

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/engine/RewardReveal.test.ts`:

```ts
import { createRewardReveal } from './RewardReveal';
import { collectedFacts, activeEffects, activeCounterPopups } from '../PlatformerState';
import { COLLECTION_TEXT_SLOT_COUNT } from './CollectionEffects';
import type { CollectedFact } from '../types';

const factIn = (id: string, sectionId: CollectedFact['sectionId']): CollectedFact => ({
  id,
  sectionId,
  sectionLabel: sectionId,
  data: { category: 'x', skills: [] },
  sourceType: 'block',
});

const ctx = {
  originX: 0,
  originY: 0,
  canvasWidth: 800,
  canvasHeight: 600,
  journalRect: null,
  inFlightCount: 0,
};

describe('createRewardReveal', () => {
  beforeEach(() => {
    collectedFacts.value = [];
    activeEffects.value = [];
    activeCounterPopups.value = {};
  });

  afterEach(() => {
    collectedFacts.value = [];
    activeEffects.value = [];
    activeCounterPopups.value = {};
  });

  it('freshFact-collectsItAndReturnsTrue', () => {
    const reveal = createRewardReveal(ctx);

    const revealed = reveal(factIn('a', 'education'), {
      x: 100,
      y: 200,
      effectId: 'block-1',
      counterKey: 'crates',
    });

    expect(revealed).toBe(true);
    expect(collectedFacts.value.map((f) => f.id)).toEqual(['a']);
  });

  it('freshFact-startsOneFlightEffect', () => {
    const reveal = createRewardReveal(ctx);

    reveal(factIn('a', 'education'), { x: 100, y: 200, effectId: 'block-1', counterKey: 'crates' });

    expect(activeEffects.value).toHaveLength(1);
    expect(activeEffects.value[0]).toMatchObject({ id: 'block-1', startX: 100 });
  });

  it('alreadyCollectedFact-revealsNothingAndReturnsFalse', () => {
    const fact = factIn('a', 'education');
    collectedFacts.value = [fact];
    const reveal = createRewardReveal(ctx);

    const revealed = reveal(fact, { x: 0, y: 0, effectId: 'block-1', counterKey: 'crates' });

    expect(revealed).toBe(false);
    expect(activeEffects.value).toEqual([]);
    expect(collectedFacts.value).toHaveLength(1);
  });

  it('twoRevealsInOneTick-stackTheirTextOnSuccessiveSlots', () => {
    const reveal = createRewardReveal(ctx);

    reveal(factIn('a', 'education'), { x: 0, y: 0, effectId: 'e1', counterKey: 'crates' });
    reveal(factIn('b', 'activities'), { x: 0, y: 0, effectId: 'e2', counterKey: 'crates' });

    // Slot 0 then slot 1 — the same vertical stacking the five inline call
    // sites produced via the shared nextTextSlot counter.
    expect(activeEffects.value[0].startY).toBeLessThan(activeEffects.value[1].startY);
  });

  it('contextWithEffectsAlreadyInFlight-seedsTheFirstSlotFromThatCount', () => {
    const reveal = createRewardReveal({ ...ctx, inFlightCount: 1 });
    const fresh = createRewardReveal(ctx);

    reveal(factIn('a', 'education'), { x: 0, y: 0, effectId: 'e1', counterKey: 'crates' });
    const seededY = activeEffects.value[0].startY;
    collectedFacts.value = [];
    activeEffects.value = [];
    fresh(factIn('b', 'education'), { x: 0, y: 0, effectId: 'e2', counterKey: 'crates' });

    // An isolated reveal lands on slot 0; one starting with an effect already
    // in flight lands lower. This is the reseed-from-live-in-flight-count
    // behavior, not an ever-incrementing counter.
    expect(seededY).toBeGreaterThan(activeEffects.value[0].startY);
  });

  it('crateFact-bumpsTheCrateCounterWithTheSectionDerivedNumerator', () => {
    const reveal = createRewardReveal(ctx);

    reveal(factIn('a', 'education'), { x: 0, y: 0, effectId: 'e1', counterKey: 'crates' });

    expect(activeCounterPopups.value.crates).toMatchObject({ labelKey: 'crates', collected: 1 });
  });

  it('collectedOverride-winsOverTheSectionDerivedNumerator', () => {
    const reveal = createRewardReveal(ctx);

    reveal(factIn('a', 'skills'), {
      x: 0,
      y: 0,
      effectId: 'e1',
      counterKey: 'coins',
      collectedOverride: 7,
    });

    expect(activeCounterPopups.value.coins).toMatchObject({ collected: 7 });
  });

  it('noCounterKey-revealsTheFactWithoutBumpingAnyPopup', () => {
    // The chest site: chests have a permanent HUD counter, so opening one
    // must not create a transient popup.
    const reveal = createRewardReveal(ctx);

    const revealed = reveal(factIn('a', 'experience'), { x: 0, y: 0, effectId: 'chest-1' });

    expect(revealed).toBe(true);
    expect(activeCounterPopups.value).toEqual({});
    expect(activeEffects.value).toHaveLength(1);
  });

  it('slotCycling-wrapsAfterTheSlotCount', () => {
    const reveal = createRewardReveal(ctx);

    for (let i = 0; i <= COLLECTION_TEXT_SLOT_COUNT; i += 1) {
      reveal(factIn(`f${i}`, 'education'), { x: 0, y: 0, effectId: `e${i}`, counterKey: 'crates' });
    }

    // The (COLLECTION_TEXT_SLOT_COUNT + 1)-th reveal is back on slot 0.
    expect(activeEffects.value[COLLECTION_TEXT_SLOT_COUNT].startY).toBe(activeEffects.value[0].startY);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/RewardReveal.test.ts`
Expected: FAIL — `./RewardReveal` does not exist.

- [ ] **Step 3: Move the stack-row constant so both callers can share it**

`COLLECTION_TEXT_STACK_ROW_HEIGHT` is currently a module-level `const` in `PlatformerPage.tsx` (line 173). Move it to `engine/CollectionEffects.ts`, beside `COLLECTION_TEXT_SLOT_COUNT`, and export it:

```ts
/** Vertical gap between successive collection-text slots, in screen px (see
 *  COLLECTION_TEXT_SLOT_COUNT). */
export const COLLECTION_TEXT_STACK_ROW_HEIGHT = 34;
```

Then import it in `PlatformerPage.tsx` (it still has non-reveal uses around lines 535 and 583) and delete the local `const`.

- [ ] **Step 4: Create `engine/RewardReveal.ts`**

```ts
import { collectedFacts, activeEffects, activeCounterPopups, levelTotals } from '../PlatformerState';
import {
  startFlightEffect,
  startCounterPopup,
  COLLECTION_TEXT_SLOT_COUNT,
  COLLECTION_TEXT_STACK_ROW_HEIGHT,
} from './CollectionEffects';
import { countCollectedFor } from '../entities/CollectiblesSummary';
import type { CounterPopupLabelKey } from './CollectionEffects';
import { formatJournalEntry } from '../entities/JournalEntry';
import type { CollectedFact } from '../types';

/**
 * Everything a tick's reveals share: this frame's world-to-screen origin, the
 * canvas size, where the journal button currently is, and how many fact-flight
 * effects are still in the air from previous ticks.
 */
export interface RevealContext {
  originX: number;
  originY: number;
  canvasWidth: number;
  canvasHeight: number;
  /** The journal button's screen rect, or null when it hasn't mounted yet —
   *  the flight then targets the bottom-right corner instead. */
  journalRect: DOMRect | null;
  /** `activeEffects.value.length` at the top of this tick. Seeds the first
   *  slot, so an isolated pickup always lands on slot 0 and only genuinely
   *  concurrent pickups spread across further slots. */
  inFlightCount: number;
}

export interface RevealOptions {
  /** The revealing entity's world-space position. */
  x: number;
  y: number;
  /** Unique id for the flight effect — usually the entity's own id, but a
   *  coin revealing more than one fact needs one per fact. */
  effectId: string;
  /**
   * Which HUD counter popup to bump, or omitted for a reveal that bumps none.
   * Typed against `CounterPopupLabelKey` (which deliberately has no
   * `'chests'`) rather than `CounterKey`: chests already have a PERMANENT HUD
   * counter, so the chest site omits this and gets no transient popup. That
   * is a spec non-goal, not an oversight.
   */
  counterKey?: CounterPopupLabelKey;
  /**
   * Overrides the counter popup's numerator. Coins need it: under
   * proportional pacing (level/SkillFactPacing.ts) a coin carries no fixed
   * fact, so "skill facts revealed" and "coins collected" are different
   * numbers, and a section-derived numerator would be in different units than
   * its denominator.
   */
  collectedOverride?: number;
}

/**
 * Builds this tick's fact-reveal trigger: the one place that turns "this
 * entity revealed a fact" into collected state, a flight effect and a counter
 * popup. Every fact-reveal site in the game goes through it — enemy defeat,
 * coin pickup, bonus fruit, chest open, crate destruction — replacing five
 * near-duplicate inline blocks that each did the same three things slightly
 * differently.
 *
 * The key pickup deliberately does NOT go through this: it reveals no fact,
 * has a static caption, and flies to the HUD key counter rather than the
 * journal.
 *
 * Writes the signals directly rather than staging into local arrays. Two of
 * the five original sites (crate, chest) already did exactly that. Do not wrap
 * these in `batch()` — nothing in this repo uses it, and it is the escape
 * hatch only if a browser check ever shows jank from several reveals landing
 * in one tick.
 *
 * Returns whether it actually revealed, so a caller can still gate its own
 * side effects on a fresh reveal rather than a deduped one.
 */
export function createRewardReveal(
  ctx: RevealContext,
): (fact: CollectedFact, options: RevealOptions) => boolean {
  const targetX = ctx.journalRect
    ? ctx.journalRect.left + ctx.journalRect.width / 2
    : ctx.canvasWidth - 32;
  const targetY = ctx.journalRect
    ? ctx.journalRect.top + ctx.journalRect.height / 2
    : ctx.canvasHeight - 32;
  // Fact text rises toward the upper-middle of the screen and holds there
  // before flying on to the journal icon, so it's actually readable.
  // Deliberately above dead-center: gameplay sits in the lower half, so a
  // dead-center pause competes with it.
  const midX = ctx.canvasWidth / 2;
  const midY = ctx.canvasHeight * 0.3;

  let nextSlot = ctx.inFlightCount % COLLECTION_TEXT_SLOT_COUNT;

  return (fact, options) => {
    // Dedup by fact id — the guard every one of the five original sites had.
    if (collectedFacts.value.some((f) => f.id === fact.id)) return false;

    // Reuses the journal's own title/icon derivation: formatJournalEntry gets
    // every section's display title right (Course's `title`, Experience's
    // `role`/`company`, Education's `degree`), unlike an ad-hoc
    // `'name' in data` check. `icon` is passed to startFlightEffect
    // separately, NOT concatenated into `label`: Renderer.ts draws it in a
    // different font, and the pixel font `label` uses has no emoji glyphs.
    const { icon, title: label } = formatJournalEntry(fact);
    const slot = nextSlot;
    nextSlot = (nextSlot + 1) % COLLECTION_TEXT_SLOT_COUNT;
    // The offset applies to BOTH the rise's start and its mid hold point —
    // offsetting mid alone still let two effects starting near the same world
    // position overlap through most of the rise.
    const stackOffsetY = slot * COLLECTION_TEXT_STACK_ROW_HEIGHT;

    collectedFacts.value = [...collectedFacts.value, fact];

    if (options.counterKey) {
      const counterKey = options.counterKey;
      activeCounterPopups.value = {
        ...activeCounterPopups.value,
        [counterKey]: startCounterPopup(
          counterKey,
          options.collectedOverride ?? countCollectedFor(counterKey, collectedFacts.value),
          levelTotals.value[counterKey],
        ),
      };
    }

    activeEffects.value = [
      ...activeEffects.value,
      startFlightEffect(
        options.effectId,
        label,
        options.x + ctx.originX,
        options.y + ctx.originY + stackOffsetY,
        midX,
        midY + stackOffsetY,
        targetX,
        targetY,
        icon,
      ),
    ];

    return true;
  };
}
```

Note on the two unions: `CounterKey` (five counters, `CollectiblesSummary.ts`) is what the journal's summary rows use and DOES include `'chests'`; `CounterPopupLabelKey` (four, `CollectionEffects.ts`) is what transient HUD popups use and deliberately does not. `RevealOptions.counterKey` uses the narrow one, so nothing here widens `CounterPopupLabelKey`, `activeCounterPopups` cannot gain a `'chests'` entry, and `drawCounterPopups` needs no change. `countCollectedFor` accepts the narrow union fine, since it is a subset of `CounterKey`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/RewardReveal.test.ts`
Expected: PASS.

- [ ] **Step 6: Build the trigger once per tick in `PlatformerPage.tsx`**

At the top of the tick, right after `nextTextSlot` is reseeded (around line 710) and after the camera has settled, compute the origins once and build the trigger:

```ts
      // Computed once per tick and shared by every reveal site below — these
      // same two expressions used to be duplicated in the enemy-defeat block
      // and the collectible block.
      const levelPixelHeight = currentLevel.value.height * RENDERED_TILE_SIZE;
      const originX = -cameraPositionX.value;
      const originY = canvas.height - levelPixelHeight + cameraPositionY.value;
      const revealFact = createRewardReveal({
        originX,
        originY,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        journalRect: journalButtonRef.current?.getBoundingClientRect() ?? null,
        inFlightCount: activeEffects.value.length,
      });
```

Then delete the now-redundant `originX`/`originY`/`levelPixelHeight` declarations in the enemy-defeat block and the collectible block, and delete the module-level `nextTextSlot` variable and its per-tick reseed — the trigger owns slot allocation now. Keep `nextBonusFruitIcon` (the engine still owns that).

- [ ] **Step 7: Migrate all five reveal sites**

Each site loses its `formatJournalEntry`/slot/`startFlightEffect`/`startCounterPopup`/dedup code and becomes a `revealFact(...)` call. Work one site at a time, running `npm test` after each.

1. **Enemy defeat** (around line 846) — inside the `justDefeated` loop, replace the whole fact-reveal body with:

```ts
          if (revealFact(fact, { x: enemy.x, y: enemy.y, effectId: enemy.id, counterKey: 'enemies' })) {
            anyEnemyRewarded = true;
          }
```

The puff push, the `rewardGiven`/`deathEffectGiven` marking, and the purple-slime key drop all stay exactly as they are. The block's local `newFacts`/`newEffects` staging arrays for FACTS and EFFECTS go away (the trigger writes those signals itself); `newPuffs` stays. Delete the trailing `collectedFacts.value = newFacts;` and `activeEffects.value = newEffects;` and the `if (anyEnemyRewarded) { ... startCounterPopup ... }` block.

2. **Coin / coin-pot pickup** (around line 996) — inside the `for (let factIndex = ...)` loop:

```ts
            revealFact(fact, {
              x: placement.x,
              y: placement.y,
              // A unique key per revealed fact, not just per coin — one coin
              // can reveal more than one fact when fewer coins are placed than
              // there are CVData facts.
              effectId: `${id}-${factIndex}`,
              counterKey: 'coins',
              // Coins collected, not skill facts revealed — see
              // RevealOptions.collectedOverride.
              collectedOverride: coinsCollectedSoFar,
            });
```

The pacing loop, `coinsCollectedSoFar` bookkeeping and `collectedCollectibleIds` update all stay. The separate `if (touchedIds.some(...coin...)) { ... startCounterPopup('coins', ...) }` block at the end goes away — the trigger bumps the popup per reveal now. **Behavior note to verify in the browser:** a coin that reveals no fact (the pacing formula's `factCountBefore === factCountAfter` case) previously still refreshed the coins popup, and now will not. If that regression is visible, re-add an explicit `startCounterPopup('coins', coinsCollectedSoFar, levelTotals.value.coins)` for the no-fact case rather than changing the trigger.

3. **Bonus fruit** (around line 1058):

```ts
          if (revealFact(fruit.fact, {
            x: fruit.x,
            y: bonusFruitY(fruit),
            effectId: id,
            counterKey: 'fruits',
          })) {
            anyBonusFruitRewarded = true;
          }
```

The `bonusFruitStates` filter-out stays; the staging arrays and trailing popup block go.

4. **Chest open** (around line 1177):

```ts
          revealFact(chest.fact, {
            // Shifted by CHEST_CLOSED_OFFSET_X (see entities/Chest.ts) to start
            // from the chest's actual centered-on-tile left edge — only the
            // closed offset applies, since this fires the instant a closed
            // chest is opened.
            x: chest.x + CHEST_CLOSED_OFFSET_X,
            y: chest.y,
            effectId: chest.id,
            // No counterKey: chests have a permanent HUD counter, so this
            // reveal deliberately bumps no transient popup — same as today.
          });
```

The `openChest` state change and the `collectedKeys` decrement stay.

5. **Crate** — replace the `if (outcome.revealFact) { ... }` body written in Task 5 with:

```ts
          if (outcome.revealFact) {
            revealFact(outcome.revealFact, {
              x: block.x,
              y: block.y,
              effectId: block.id,
              counterKey: 'crates',
            });
          }
```

- [ ] **Step 8: Verify no duplicated reveal machinery remains**

Run: `grep -c "startFlightEffect" src/themes/platformer/PlatformerPage.tsx`
Expected: 1 — only the key pickup's own call (which deliberately stays outside the trigger).

Run: `grep -c "startCounterPopup" src/themes/platformer/PlatformerPage.tsx`
Expected: 0 — every popup now goes through the trigger.

- [ ] **Step 9: Run the tests and lint**

Run: `npm test`
Expected: PASS.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/themes/platformer/engine/RewardReveal.ts src/themes/platformer/engine/RewardReveal.test.ts src/themes/platformer/engine/CollectionEffects.ts src/themes/platformer/PlatformerPage.tsx
git commit -m "refactor(platformer): reveal every fact through one shared trigger"
```

---

### Task 7: Manual browser verification and roadmap check-off

**Files:**

- Modify: `specs/S-006-platformer-theme/roadmap.md`

- [ ] **Step 1: Run the full gate**

Run: `npm test`
Run: `npm run lint`
Run: `npx tsc -b`
Expected: all clean. Do not proceed to Step 2 with any of them failing.

- [ ] **Step 2: Verify in the browser**

Start the dev server via the preview tooling (never a raw `npm run dev` in a shell) and walk the level. The tick handler has no test harness, so this IS the integration test for Tasks 5 and 6. Check each:

1. **Crate, hit 1** — cracks, bumps, no fact text, no puff.
2. **Crate, hit 2** — shatters, puff fires, fact text flies to the journal, crate popup increments.
3. **Crate popup numerator matches the journal** — open the journal immediately after and compare the crates row to the popup. This is Task 1's bug fix; they must agree.
4. **Open a chest, then break a crate** — the crate popup must NOT jump by the chest's fact. This is the specific bug reproduction.
5. **Question mark** — one hit from below spawns a rising bonus fruit; collecting it reveals its fact and bumps the fruits popup; successive fruits look different from each other (the icon cycle still works).
6. **Coin pot** — landing on top destroys it, bounces the player at the weaker coin-pot strength (not the full stomp bounce), puffs, and drops a collectible coin. Walking under a pot must do nothing.
7. **Enemy stomp** — still bounces at full stomp strength, puffs, reveals its fact, bumps the enemies popup. Stomp a purple slime with spikes out to confirm the `awayAndUp` knockback is unaffected.
8. **Two pickups at once** — collect two coins/fruits in quick succession and confirm their fact texts stack on different vertical slots rather than overlapping.
9. **One pickup in isolation** — after everything settles, collect one and confirm its text lands on the top slot, not offset downward.
10. **Chest open** — the fact flies to the journal and NO transient counter popup appears (the permanent HUD chest counter still updates). A popup here means the chest site passed a `counterKey` it should have omitted.

- [ ] **Step 3: Check off the roadmap step**

In `specs/S-006-platformer-theme/roadmap.md`, change step 41's `- [ ]` to `- [x]`.

Confirm `docs/Features.md` has no matching entry (`grep -n "step 41\|world-entity\|reveal trigger" docs/Features.md`) — platformer roadmap steps are tracked in `roadmap.md`, not in the F/S/O feature list, so no `Features.md` edit is expected.

- [ ] **Step 4: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs(platformer): mark roadmap step 41 done"
```

- [ ] **Step 5: Request a whole-branch review**

Use `superpowers:requesting-code-review` for the full branch before opening the PR. Tell the reviewer explicitly to run `npm run lint` — lint-only errors have slipped past clean test/tsc reviews in this repo before.
