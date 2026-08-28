# Journal Counters, Pagination & Reset Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish roadmap step 15 — per-section "N/M" collection counters, pagination within
a section, and a Reset Game button in the journal overlay built in step 14.

**Architecture:** Three small, independently testable additions layered onto the existing
`Journal.tsx`/`PlatformerState.ts`/`entities/JournalSections.ts` module boundaries — no new
components, no change to the book-opening animation or bookmark tabs built in step 14.
`sectionTotal`/`isPaginatedSection` are pure functions added to `JournalSections.ts` (same
module as the existing `nonEmptySections`/`sectionLabel`); a new `CollectiblesSummary.ts`
entity computes the personality page's coin/fruit summary; `PlatformerState.ts` gets one new
exported function (`resetGameProgress`) that extends the existing `resetGame()` seam;
`Journal.tsx` wires all three into its render, replacing the flat two-column fact list with a
per-section-type branch (grouped vs. paginated vs. personality).

**Tech Stack:** React 19, TypeScript strict, `@preact/signals-react`, Vitest + React Testing
Library + jsdom, Tailwind CSS 4.

**Spec:** `specs/S-006-platformer-theme/spec.md` (FR-015, FR-016, FR-017b, FR-018b) and
`specs/S-006-platformer-theme/roadmap.md` (step 15).

## Global Constraints

- TypeScript strict mode, no `any` (constitution Principle I).
- Named arrow function exports, props interfaces in the same file, `cn()` for conditional
  Tailwind classes where used (constitution Principle III) — not needed in this plan's files,
  none of them use conditional class composition.
- TDD: tests written and passing before/alongside each implementation step (constitution
  Principle II). Test naming: `{method}-{Condition}-{ExpectedResult}`.
- No new shadcn/ui components, no API calls, no new dependencies.
- Reuse the existing `resetGame()` seam in `PlatformerState.ts` rather than duplicating its
  spawn/health/camera reset logic (its own docstring names step 15 as the intended extension
  point).
- No new pixel-art assets — page-flip arrows reuse the existing plain-CSS-glyph pattern the
  in-book × close button already established (no sprite for that button either).

---

## Status

Tasks 1-3 below were implemented and verified passing before this plan document was written
(mid-implementation, per user request to formalize the process) — their code is included here
as the record of what was built, not as a forward-looking prescription. Task 4 is where the
plan resumes as an actual to-do: `Journal.tsx`'s wiring is drafted but has a failing test
(`clicked-journalStaysOpenAndSectionsShowPlaceholders`) whose root cause has not yet been
found. Task 4 starts with root-causing that failure (per `systematic-debugging`) before any
further code changes to `Journal.tsx`.

---

### Task 1: `sectionTotal` and `isPaginatedSection` in `JournalSections.ts`

**Files:**
- Modify: `src/themes/platformer/entities/JournalSections.ts`
- Test: `src/themes/platformer/entities/JournalSections.test.ts`

**Interfaces:**
- Produces: `sectionTotal(cv: CVData, section: SectionId): number`, `isPaginatedSection(section: SectionId): boolean` — both consumed by Task 4 (`Journal.tsx`) and Task 2 (`CollectiblesSummary.ts` uses `sectionTotal`).

- [x] **Step 1: Write the failing tests**

```typescript
describe('sectionTotal', () => {
  it('sectionWithItems-returnsItemCount', () => {
    const cv: CVData = {
      ...emptyCV,
      experience: [
        { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
        { company: 'Z', role: 'W', startDate: '2021-01', highlights: [] },
      ],
    };
    expect(sectionTotal(cv, 'experience')).toBe(2);
  });

  it('emptySection-returnsZero', () => {
    expect(sectionTotal(emptyCV, 'projects')).toBe(0);
  });

  it('languagesUndefined-returnsZero', () => {
    const cv: CVData = { ...emptyCV, languages: undefined };
    expect(sectionTotal(cv, 'languages')).toBe(0);
  });

  it('skillsSection-countsCategoriesNotIndividualSkills', () => {
    const cv: CVData = {
      ...emptyCV,
      skills: [
        { category: 'Frontend', skills: [{ name: 'React', level: 80 }, { name: 'Vue', level: 60 }] },
        { category: 'Backend', skills: [{ name: 'Go', level: 70 }] },
      ],
    };
    expect(sectionTotal(cv, 'skills')).toBe(2);
  });
});

describe('isPaginatedSection', () => {
  it('longEntrySections-returnTrue', () => {
    expect(isPaginatedSection('experience')).toBe(true);
    expect(isPaginatedSection('projects')).toBe(true);
    expect(isPaginatedSection('education')).toBe(true);
    expect(isPaginatedSection('courses')).toBe(true);
    expect(isPaginatedSection('certificates')).toBe(true);
  });

  it('compactEntrySections-returnFalse', () => {
    expect(isPaginatedSection('skills')).toBe(false);
    expect(isPaginatedSection('languages')).toBe(false);
  });
});
```

- [x] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/themes/platformer/entities/JournalSections.test.ts`
Expected: FAIL — `sectionTotal`/`isPaginatedSection` not exported.

- [x] **Step 3: Implement**

```typescript
export function sectionTotal(cv: CVData, section: SectionId): number {
  if (section === 'languages') return cv.languages?.length ?? 0;
  if (section === 'personality' || section === 'activities') return 0;
  return cv[section].length;
}

const PAGINATED_SECTIONS = new Set<SectionId>([
  'experience',
  'projects',
  'education',
  'courses',
  'certificates',
]);

export function isPaginatedSection(section: SectionId): boolean {
  return PAGINATED_SECTIONS.has(section);
}
```

- [x] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/themes/platformer/entities/JournalSections.test.ts`
Expected: PASS (14 tests total in the file).

- [x] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/JournalSections.ts src/themes/platformer/entities/JournalSections.test.ts
git commit -m "feat(platformer): add sectionTotal and isPaginatedSection helpers"
```

---

### Task 2: `CollectiblesSummary.ts` (personality page's coin/fruit summary)

**Files:**
- Create: `src/themes/platformer/entities/CollectiblesSummary.ts`
- Test: `src/themes/platformer/entities/CollectiblesSummary.test.ts`

**Interfaces:**
- Consumes: `sectionTotal(cv, section)` from Task 1.
- Produces: `collectiblesSummary(cv: CVData, facts: CollectedFact[]): CollectibleSummaryRow[]`, `interface CollectibleSummaryRow { icon: string; label: string; collected: number; total: number }` — consumed by Task 4.

- [x] **Step 1: Write the failing tests**

```typescript
describe('collectiblesSummary', () => {
  it('cvWithSkillsAndLanguages-noneCollected-returnsBothRowsWithZeroCollected', () => {
    const cv: CVData = {
      ...emptyCV,
      skills: [{ category: 'Frontend', skills: [{ name: 'React', level: 80 }] }],
      languages: [{ name: 'English', level: 100 }],
    };
    expect(collectiblesSummary(cv, [])).toEqual([
      { icon: '🪙', label: 'Coins', collected: 0, total: 1 },
      { icon: '🍎', label: 'Fruits', collected: 0, total: 1 },
    ]);
  });

  it('cvWithSkillsAndLanguages-someCollected-countsMatchingFactsPerType', () => {
    const cv: CVData = {
      ...emptyCV,
      skills: [
        { category: 'Frontend', skills: [{ name: 'React', level: 80 }] },
        { category: 'Backend', skills: [{ name: 'Go', level: 70 }] },
      ],
      languages: [{ name: 'English', level: 100 }],
    };
    const facts: CollectedFact[] = [
      { id: 'coin-frontend', sectionId: 'skills', sectionLabel: 'Skills', data: { category: 'Frontend', skills: [{ name: 'React', level: 80 }] }, sourceType: 'coin' },
      { id: 'fruit-english', sectionId: 'languages', sectionLabel: 'Languages', data: { name: 'English', level: 100 }, sourceType: 'coin' },
    ];
    expect(collectiblesSummary(cv, facts)).toEqual([
      { icon: '🪙', label: 'Coins', collected: 1, total: 2 },
      { icon: '🍎', label: 'Fruits', collected: 1, total: 1 },
    ]);
  });

  it('cvWithNoSkillsOrLanguages-returnsNoRows', () => {
    expect(collectiblesSummary(emptyCV, [])).toEqual([]);
  });

  it('cvWithOnlySkills-omitsFruitsRow', () => {
    const cv: CVData = { ...emptyCV, skills: [{ category: 'Frontend', skills: [{ name: 'React', level: 80 }] }] };
    expect(collectiblesSummary(cv, [])).toEqual([{ icon: '🪙', label: 'Coins', collected: 0, total: 1 }]);
  });
});
```

- [x] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/themes/platformer/entities/CollectiblesSummary.test.ts`
Expected: FAIL — module doesn't exist.

- [x] **Step 3: Implement**

```typescript
import { sectionTotal } from './JournalSections';
import type { CVData } from '@/types/cv';
import type { CollectedFact } from '../types';

export interface CollectibleSummaryRow {
  icon: string;
  label: string;
  collected: number;
  total: number;
}

export function collectiblesSummary(cv: CVData, facts: CollectedFact[]): CollectibleSummaryRow[] {
  const rows: CollectibleSummaryRow[] = [];

  const skillsTotal = sectionTotal(cv, 'skills');
  if (skillsTotal > 0) {
    rows.push({
      icon: '🪙',
      label: 'Coins',
      collected: facts.filter((f) => f.sectionId === 'skills').length,
      total: skillsTotal,
    });
  }

  const languagesTotal = sectionTotal(cv, 'languages');
  if (languagesTotal > 0) {
    rows.push({
      icon: '🍎',
      label: 'Fruits',
      collected: facts.filter((f) => f.sectionId === 'languages').length,
      total: languagesTotal,
    });
  }

  return rows;
}
```

Only `skills`/`languages` produce rows today (FR-009's only two mapped collectible types) — no
placeholder rows for enemies/blocks (steps 16-20), per user decision during brainstorming. A
row is omitted entirely when its section total is 0, matching how `nonEmptySections` hides
empty sections' bookmarks.

- [x] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/themes/platformer/entities/CollectiblesSummary.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/CollectiblesSummary.ts src/themes/platformer/entities/CollectiblesSummary.test.ts
git commit -m "feat(platformer): add collectiblesSummary for the personality page"
```

---

### Task 3: `resetGameProgress` in `PlatformerState.ts`

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`
- Test: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Consumes: existing `resetGame()`, `collectedFacts`, `collectedCollectibleIds`, `activeJournalSection` signals (all already in this file).
- Produces: `resetGameProgress(): void` — consumed by Task 4's Reset Game button.

- [x] **Step 1: Write the failing tests**

```typescript
describe('resetGameProgress', () => {
  afterEach(() => {
    collectedFacts.value = [];
    collectedCollectibleIds.value = new Set();
    activeJournalSection.value = undefined;
  });

  it('called-clearsCollectedFactsAndCollectibleIds', () => {
    collectedFacts.value = [
      { id: 'coin-backend', sectionId: 'skills', sectionLabel: 'Skills', data: { category: 'Backend', skills: [] }, sourceType: 'coin' },
    ];
    collectedCollectibleIds.value = new Set(['coin-backend']);
    activeJournalSection.value = 'skills';

    resetGameProgress();

    expect(collectedFacts.value).toEqual([]);
    expect(collectedCollectibleIds.value.size).toBe(0);
    expect(activeJournalSection.value).toBeUndefined();
  });

  it('called-alsoRestoresSpawnHealthAndCamera', () => {
    playerState.value = { ...playerState.value, x: 999 };
    healthState.value = 0;
    cameraPositionX.value = 300;

    resetGameProgress();

    expect(playerState.value).toEqual(spawnPlayerState());
    expect(healthState.value).toBe(MAX_HALF_HEARTS);
    expect(cameraPositionX.value).toBe(0);
  });
});
```

- [x] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: FAIL — `resetGameProgress` not exported.

- [x] **Step 3: Implement**

```typescript
export function resetGameProgress(): void {
  resetGame();
  collectedFacts.value = [];
  collectedCollectibleIds.value = new Set();
  activeJournalSection.value = undefined;
}
```

Placed directly after `resetGame()`. Clearing `collectedCollectibleIds` is what makes
already-collected coins/fruits reappear in the level — `PlatformerPage.tsx`'s render/collision
loop reads that signal live (`collectedCollectibleIds.value.has(p.id)`), so no change to
`PlatformerPage.tsx` is needed for FR-018b's "all coins/enemies/blocks respawn" (enemies/blocks
don't exist yet — steps 16-20 will need their own reset-on-`resetGameProgress` wiring when
built). Clearing `activeJournalSection` (back to `undefined`) is what makes the journal fall
back to its default section (`Journal.tsx`'s existing `defaultSection` logic) after a reset,
matching FR-018b's "journal shows placeholder messages for all sections".

- [x] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: PASS (21 tests total in the file).

- [x] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): add resetGameProgress for the Reset Game button"
```

---

### Task 4: Wire counters, pagination, personality summary, and Reset Game into `Journal.tsx`

**Files:**
- Modify: `src/themes/platformer/components/Journal.tsx`
- Test: `src/themes/platformer/components/Journal.test.tsx`

**Interfaces:**
- Consumes: `sectionTotal`, `isPaginatedSection` (Task 1), `collectiblesSummary` (Task 2), `resetGameProgress` (Task 3).
- Produces: new `data-testid`s (`journal-section-counter`, `journal-collectibles-summary`, `journal-page-prev`, `journal-page-next`, `journal-page-counter`, `journal-reset-button`) — no other component consumes these; they exist for tests and are stable UI hooks if a later step needs them.

**Current state (as of writing this plan):** the tests below are written and the implementation
below is drafted in the file already. 28 of 29 new/modified tests in
`Journal.test.tsx` pass. One fails:
`Reset Game button > clicked-journalStaysOpenAndSectionsShowPlaceholders`. Investigation so
far (informal, before this plan existed): clicking the Reset Game button, then clicking a
bookmark tab, updates the `activeJournalSection` signal's `.value` correctly (confirmed via a
throwaway debug test with `console.log`), but the rendered DOM does not reflect the new
section — the heading and `aria-current` stay on the previous section. A further probe showed
this isn't specific to Reset Game: two bookmark-tab clicks in a row, wrapped in `act()`, in a
**freshly rendered** component with no prior interaction, reproduced the same "signal updates,
DOM doesn't" symptom — but an *existing* step-14 test in the same file
(`switchingToAnotherSection-resetsPageBackToFirst`, added as part of this same task) clicks
bookmark tabs four times in a row, **without** wrapping in `act()`, and passes. The
differentiating variable between the reproducing and non-reproducing cases has not yet been
isolated. This must be root-caused (per `systematic-debugging`) before Task 4 is considered
done — do not patch around it (e.g. by rewriting the failing test to avoid the second click)
without understanding why the second click fails to re-render.

- [x] **Step 1: Write the failing tests** (already in `Journal.test.tsx`, see the file for full text — sections added: `per-section counter`, `empty state copy`, `grouped sections (skills/languages)`, `paginated sections (experience/projects/education/courses/certificates)`, `personality collectibles summary`, `Reset Game button`)

- [x] **Step 2: Run tests, confirm the new ones fail against the pre-Task-4 `Journal.tsx`**

Run: `npx vitest run src/themes/platformer/components/Journal.test.tsx`
Expected (before implementation): FAIL — new `data-testid`s don't exist yet.

- [x] **Step 3: Implement (draft — see "Current state" above for the one open failure)**

Add to the imports:

```typescript
import { collectedFacts, activeJournalSection, resetGameProgress } from '../PlatformerState';
import {
  JOURNAL_SECTION_ORDER,
  nonEmptySections,
  sectionLabel,
  sectionTotal,
  isPaginatedSection,
} from '../entities/JournalSections';
import { collectiblesSummary } from '../entities/CollectiblesSummary';
import type { CollectedFact, SectionId } from '../types';
```

Add page state, a resize-safe current-page clamp, the reset handler, and a shared fact-row
renderer inside the component body (after the existing `frame`/`closeClicked` state):

```typescript
const [page, setPage] = useState(0);

useEffect(() => {
  setPage(0);
}, [effectiveSection]);

const handleResetGame = () => {
  resetGameProgress();
  setPage(0);
};

const renderFactRow = (fact: CollectedFact) => {
  const entry = formatJournalEntry(fact);
  return (
    <li key={fact.id} data-testid="journal-fact-item">
      <span>
        {entry.icon} {entry.title}
      </span>
      {entry.subtitle && <span className="ml-6 block text-sm text-gray-500">{entry.subtitle}</span>}
    </li>
  );
};
```

Compute the counter total and pagination flag alongside the existing `sectionFacts`:

```typescript
const sectionCounterTotal =
  effectiveSection && effectiveSection !== 'personality' ? sectionTotal(cv, effectiveSection) : undefined;
const paginated = effectiveSection ? isPaginatedSection(effectiveSection) : false;
const currentPage = Math.min(page, Math.max(0, sectionFacts.length - 1));
```

Replace the header `<h2>` to include the counter, and replace the single `columns-2` content
block with a three-way branch (personality / paginated / grouped) — full JSX is already in
`src/themes/platformer/components/Journal.tsx` as of this plan being written; see that file for
the exact markup (counter span, personality two-column grid with `journal-collectibles-summary`,
paginated single-entry view with `journal-page-prev`/`journal-page-next`/`journal-page-counter`,
and the always-visible `journal-reset-button`). Do not re-derive this from scratch — read the
current file first, since Steps 4-6 below are about fixing the one remaining bug in it, not
rewriting it.

- [ ] **Step 4: Root-cause the `clicked-journalStaysOpenAndSectionsShowPlaceholders` failure**

Follow `systematic-debugging` Phase 1 fully before changing any code:

1. Reproduce the minimal case: a fresh `render(<Journal .../>)`, then two `fireEvent.click`
   calls on two different bookmark tabs, each wrapped in its own `act()`, asserting the `<h2>`
   text after each click. Confirm whether this minimal case reproduces the bug in isolation
   (outside `Journal.test.tsx`'s existing `beforeEach(() => vi.useFakeTimers())` — try both with
   and without fake timers, since that's a candidate variable).
2. Compare against the passing `switchingToAnotherSection-resetsPageBackToFirst` test
   line-by-line: what's different? (Candidates to check off one at a time, not all at once:
   presence/absence of `act()` wrapping; whether a *local* `useState` update — e.g. the
   `journal-page-next` click — happens between the two signal-driven clicks; whether
   `collectedFacts.value` or other signals were mutated in the same synchronous block
   immediately before the clicks, the way `resetGameProgress()` mutates five signals at once.)
3. Add a temporary `console.log` of `effectiveSection` and a render counter directly inside
   `Journal`'s function body (not a separate scratch file this time — easier to remove
   cleanly with a diff review) to see whether the component re-renders at all after the second
   click, or re-renders but recomputes the same `effectiveSection`.
4. State the hypothesis explicitly in the plan or in a commit message before touching
   implementation code, e.g. "I think `@preact/signals-react`'s `useSignals()` hook fails to
   resubscribe when N signal writes happen in the same batch as a previous batch of M signal
   writes, because Y" — with actual evidence, not a guess.

- [ ] **Step 5: Implement the minimal fix for the confirmed root cause**

Only after Step 4 identifies the actual cause. Do not fix by working around the symptom (e.g.
forcing a remount, adding an arbitrary extra state update, or rewriting the test to only do one
click) unless the root-cause investigation concludes the *test* itself is wrong (e.g. relies on
timing that doesn't exist in real browser usage) — in that case, that conclusion must be
written down with evidence, not assumed.

- [ ] **Step 6: Run the full `Journal.tsx` test file, verify all tests pass**

Run: `npx vitest run src/themes/platformer/components/Journal.test.tsx`
Expected: PASS (all tests, including `clicked-journalStaysOpenAndSectionsShowPlaceholders`).

- [ ] **Step 7: Run the full platformer test suite, verify no regressions**

Run: `npx vitest run src/themes/platformer`
Expected: PASS — in particular `PlatformerPage.test.tsx` (Journal is rendered there too) and
`BookmarkTabs.test.tsx`.

- [ ] **Step 8: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/themes/platformer`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/themes/platformer/components/Journal.tsx src/themes/platformer/components/Journal.test.tsx
git commit -m "feat(platformer): add journal counters, pagination, and Reset Game button"
```

---

### Task 5: Manual browser verification

**Files:** none (manual step, per roadmap.md's working agreement: "TDD ..., then a manual
browser check before moving to the next step").

- [ ] **Step 1: Start the dev server and open the Platformer theme**

Run: start the `dev` launch config, navigate to the Platformer theme in the browser preview.

- [ ] **Step 2: Verify counters**

Collect a couple of Skills/Languages facts, open the journal (`J`), confirm the header shows
"Skills 2/N" (or similar) next to the section name, and that Personality shows no counter.

- [ ] **Step 3: Verify pagination**

Switch to Experience (or any of Projects/Education/Courses/Certificates) — even with 0
collected facts today (no collectibles map to them until steps 16/19), confirm the empty-state
message reads "No facts discovered yet — keep exploring!". If any facts exist, confirm only one
shows at a time with working ‹/› arrows and a "N / M" counter, and that arrows are visibly
present (not hover-only) and disable correctly at the first/last page.

- [ ] **Step 4: Verify the personality page's collectibles summary**

Open the About Me bookmark, confirm the right column shows "🪙 Coins x/y" and "🍎 Fruits x/y"
matching the actual collected/total counts.

- [ ] **Step 5: Verify Reset Game**

Collect a fact, click Reset Game inside the journal. Confirm: the journal stays open, the
just-collected fact's section now shows the empty-state placeholder, the character/camera/health
reset in the game view behind the journal, and previously-collected coins/fruits are visible
again in the level after closing the journal.

- [ ] **Step 6: Update roadmap.md**

Check off step 15 in `specs/S-006-platformer-theme/roadmap.md` (`- [ ]` → `- [x]`), per
`CLAUDE.md`'s feature completion tracking instructions (`docs/Features.md` is unrelated here —
that tracking applies to top-level `F-`/`S-`/`O-` features, not roadmap sub-steps, but the
roadmap checkbox itself is this step's completion record).
