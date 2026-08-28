# Journal Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Superseded design note (added 2026-08-28, after Tasks 1-7 shipped):** live
> browser iteration with the user, after this plan's tasks landed, revised
> several of Task 6's design decisions below — they're kept as-written for
> historical accuracy (this is what was actually reviewed and merged
> task-by-task), but the CODE THAT ACTUALLY SHIPPED differs. Treat
> `spec.md` (FR-013/015/016, amended 2026-08-28) and the actual source files
> as authoritative, not this task's original code blocks. Specifically:
> bookmark tabs moved from the book's right edge to its top-right edge, show
> an icon instead of a text label, and now cover 8 sections (including a
> provisional "About Me"/personality bookmark) instead of 7; the
> book-opening animation also plays in reverse on close (originally "no
> reverse-close animation") and is 90ms/frame, not the two intermediate
> speeds tried along the way; the selected bookmark section is remembered
> across closing/reopening via a `PlatformerState` signal, not local
> component state. See the git history and this plan's SDD ledger
> (`.superpowers/sdd/2026-08-28-journal-styling/progress.md`, deleted after
> merge — see the branch's commit messages instead) for the full sequence.

**Goal:** Implement roadmap step 14 — replace the unstyled journal skeleton
(step 13) with the real notebook look: a book-opening animation, the
`Caveat` handwriting font, ruled notebook paper, the Simple List entry style
(FR-017, Option A from `entry-styles-mockup.html`) with skill star ratings,
and (pulled forward from step 15, per discussion) clickable, color-coded
bookmark tabs — one per non-empty CV section — so the journal shows one
section's facts at a time. Per-section counters, pagination, and the Reset
Game button remain step 15's job.

**Architecture:** The user supplied real pixel-art assets in
`public/sprites/`: `journal_open_1.png` … `journal_open_9.png` (a 9-frame
book-opening sequence, closed cover → fully spread blank pages),
`journal.png` (a small closed-book icon replacing the 📖 emoji placeholder),
`bookmark_{blue,green,orange,purple,red,yellow}.png` (6 colored ribbon tabs),
and `banner_straight.png` (a ribbon banner, used for the section header
title). `Journal.tsx` is rewritten to: play through the 9 frames on mount
(a plain `setInterval`, matching this codebase's preference for simple
timing over rAF for non-game-loop UI), then hold on frame 9 (the open-pages
image) and overlay the actual content — a section header banner, the active
section's facts in Simple List style, or a per-section empty-state message —
directly on top of the pixel-art pages. A new `BookmarkTabs` component
(exactly the file name `spec.md`'s FR-030 proposed) renders one tab per
non-empty CV section (derived from `currentCV.value`, not from
`collectedFacts`, per FR-013 — a section's bookmark should exist even before
anything in it is collected) as a flex column beside the book, using the
color-coded sprites; clicking one switches `Journal`'s local `activeSection`
state. Two new pure, fully-unit-tested modules back this:
`entities/JournalAnimation.ts` (frame-index → sprite path) and
`entities/JournalEntry.ts` (a `CollectedFact` → icon/title/subtitle display
triple, including the skill/language star-rating format from FR-017) and
`entities/JournalSections.ts` (which sections get bookmarks, in what order,
and which color). The journal icon button moves from bottom-right to
top-left (per user feedback — bottom-right blended into the terrain) using
the real `journal.png` sprite instead of the 📖 emoji, sitting to the left of
the heart HUD; the canvas-drawn hearts shift right by a fixed offset
(`Renderer.ts`'s `drawHearts` gains an optional `startX` parameter, default
unchanged) to make room without touching any existing call site's behavior.

**Key design decision — default active section:** With `collectedFacts`
already seeded in step 13, opening the journal needs to land on *some*
section. `Journal.tsx` defaults `activeSection` to the `sectionId` of
`collectedFacts[0]` if any facts exist, else the first entry of
`nonEmptySections(currentCV.value)`. This keeps step 13's three existing
Journal tests passing (the seeded `'skills'` fact is still what's shown by
default) without hardcoding a section, and matches the intuitive "show me
what I just collected" behavior once real coin collection (step 12) lands.

**Key design decision — six bookmark colors for seven sections:** The user
supplied 6 bookmark sprite colors (blue/green/orange/purple/red/yellow) but
there are 7 sections with collectibles per FR-009 (experience, education,
courses, certificates, skills, languages, projects — personality/contact are
flagpole-only per FR-013 and excluded; `activities` isn't mapped to any
collectible type in FR-009 and is also excluded). `courses` and
`certificates` share the `red` sprite (both "credentials/learning" in
spirit) — the closest pairing available. Flag this if it reads as confusing
in the manual verification step; swapping the mapping in
`JournalSections.ts` is a one-line change.

**Key design decision — no reverse-close animation:** Per the "no feature
bloat" principle, closing the journal stays instant (as it was in step 13) —
only *opening* plays the book animation. A symmetric closing animation is a
polish-pass candidate (step 27), not built here.

**Key design decision — overlay content isn't split into left/right page
columns yet:** `journal_open_9.png` shows two physical page halves, but this
plan renders one continuous scrollable content region across both (header +
entries), not a precise per-half layout — splitting content across the two
visible pages is naturally paired with step 15's pagination (which already
needs to reason about "how much fits on a page") and would be rebuilt then
anyway.

**Tech Stack:** React 19 + TypeScript strict, `@preact/signals-react` for
`currentCV`/`collectedFacts`, Tailwind CSS 4, `@fontsource/caveat` (new
dependency), Vitest + React Testing Library (`vi.useFakeTimers()` for the
book-opening animation).

**Spec:** `specs/S-006-platformer-theme/spec.md` FR-009, FR-013, FR-015,
FR-016, FR-017, FR-025, FR-030 (bookmark tabs, notebook styling, entry
format, icon); `specs/S-006-platformer-theme/roadmap.md` step 14 (this plan
folds step 15's bookmark-tab bullet into step 14, per discussion — the
roadmap is updated in Task 8 to reflect this); `specs/S-006-platformer-theme/entry-styles-mockup.html`
(Option A, Simple List — already the chosen style, confirmed by FR-017's
wording); `specs/S-006-platformer-theme/journal-mockup.html` (bookmark tab
sizing: 12px inactive sliver, 48px active, distributed top-to-bottom).

## Global Constraints

- TDD: write the failing test before the implementation in every task with
  pure logic. Visual/layout code that has no meaningful assertion beyond "it
  renders" still gets a test for its testids/conditional branches (empty
  state vs. entries, active vs. inactive tab).
- TypeScript strict mode, no `any`.
- Named exports only (no default exports).
- Test names follow `{method}-{Condition}-{ExpectedResult}`.
- Components: named arrow function exports, props interface in the same
  file, `cn()` from `@/lib/utils` for conditional classes (used in
  `BookmarkTabs` for the active/inactive width toggle).
- Pure formatting/derivation logic lives in `src/themes/platformer/entities/`
  (matching `Health.ts`/`Player.ts`'s existing no-React-dependency
  convention), fully unit tested; components stay presentational.
- **Scope boundary — do NOT build in this plan:** per-section "N/M"
  collection counters, pagination within a section (both step 15), the
  Reset Game button (FR-018b, step 15), `CollectibleMapper`/real coin
  collection (steps 11/12), enemies/blocks (steps 16/19), a reverse
  closing animation (step 27 candidate). The seed data from step 13
  (`SEED_COLLECTED_FACTS` in `PlatformerState.ts`) is untouched by this
  plan — still temporary scaffolding until step 12.
- Branch: create `S-006-step14-journal-styling` off `S-006-platformer-theme`.
  PR target is `S-006-platformer-theme`, **not** `main`. Delete the step
  branch after merging.
- New dependency: `@fontsource/caveat` — justified by FR-015's explicit
  requirement for the `Caveat` handwriting font, following the exact
  `@fontsource/*` + `src/index.css` `@import` pattern already used for
  Geist/Inter/Fira Code/VT323.
- All four new sprite files referenced by path (`/sprites/journal_open_N.png`,
  `/sprites/journal.png`, `/sprites/bookmark_{color}.png`,
  `/sprites/banner_straight.png`) already exist in `public/sprites/` —
  confirmed present before writing this plan. No `loadImage()`/preloading
  needed for them: unlike the canvas-drawn sprites (`knight.png`,
  `hearts.png`, etc.), these are plain `<img>` tags in DOM/React, which the
  browser loads and caches like any other image — unnecessary to route
  through the canvas-sprite preloading system.

---

## Task 1: Add the `Caveat` font

**Files:**
- Modify: `package.json` (via `npm install`)
- Modify: `src/index.css`

**Interfaces:**
- Consumes: nothing.
- Produces: a `font-caveat` Tailwind utility class (via the `@theme inline`
  block's `--font-caveat` token, the same mechanism that already turns
  `--font-sans`/`--font-heading` into `font-sans`/`font-heading`). Task 6
  (`Journal.tsx`) and Task 5 (`BookmarkTabs.tsx`) use `font-caveat` in their
  className strings.

- [ ] **Step 1: Install the dependency**

Run: `npm install @fontsource/caveat`
Expected: `package.json`'s `dependencies` gains a `"@fontsource/caveat"`
entry (version `^5.x`, matching the existing `@fontsource/*` entries).

- [ ] **Step 2: Import it and register the Tailwind token**

In `src/index.css`, find:

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import 'shadcn/tailwind.css';
@import '@fontsource-variable/geist';
@import '@fontsource/inter';
@import '@fontsource/fira-code';
@import '@fontsource/vt323';
```

Replace with:

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import 'shadcn/tailwind.css';
@import '@fontsource-variable/geist';
@import '@fontsource/inter';
@import '@fontsource/fira-code';
@import '@fontsource/vt323';
@import '@fontsource/caveat';
```

Find:

```css
@theme inline {
  --font-heading: var(--font-sans);
  --font-sans: 'Geist Variable', sans-serif;
```

Replace with:

```css
@theme inline {
  --font-heading: var(--font-sans);
  --font-sans: 'Geist Variable', sans-serif;
  /* Journal handwriting font (FR-015) — scoped to the platformer theme's
     Journal/BookmarkTabs components via the `font-caveat` utility this
     token generates; not used anywhere else in the app. */
  --font-caveat: 'Caveat', cursive;
```

- [ ] **Step 3: Verify the utility class works**

Run: `npx tsc --noEmit` (confirms nothing broke — this is a CSS-only change,
no TypeScript to test directly).
Expected: PASS.

There's no unit test for a CSS token — this gets a visual confirmation in
Task 8's manual browser check instead (Simple List entries render in a
handwritten-looking font).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/index.css
git commit -m "feat(platformer): add Caveat font for journal styling"
```

---

## Task 2: `JournalAnimation.ts` — book-opening frame sequencing (pure)

**Files:**
- Create: `src/themes/platformer/entities/JournalAnimation.ts`
- Test: `src/themes/platformer/entities/JournalAnimation.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `JOURNAL_OPEN_FRAME_COUNT` (9), `JOURNAL_OPEN_FRAME_INTERVAL_MS`
  (50), `journalOpenFrameSrc(frame: number): string`. Task 6 (`Journal.tsx`)
  imports all three: a `setInterval` ticking every
  `JOURNAL_OPEN_FRAME_INTERVAL_MS` advances a `frame` state variable from 1
  to `JOURNAL_OPEN_FRAME_COUNT`, and `<img src={journalOpenFrameSrc(frame)}>`
  renders the current frame.

- [ ] **Step 1: Write the failing tests**

```ts
import { JOURNAL_OPEN_FRAME_COUNT, journalOpenFrameSrc } from './JournalAnimation';

describe('journalOpenFrameSrc', () => {
  it('called-withFrameOne-returnsFirstFrameSpritePath', () => {
    expect(journalOpenFrameSrc(1)).toBe('/sprites/journal_open_1.png');
  });

  it('called-withFinalFrame-returnsFinalFrameSpritePath', () => {
    expect(journalOpenFrameSrc(JOURNAL_OPEN_FRAME_COUNT)).toBe(
      `/sprites/journal_open_${JOURNAL_OPEN_FRAME_COUNT}.png`,
    );
  });

  it('called-withFrameBelowOne-clampsToFrameOne', () => {
    expect(journalOpenFrameSrc(0)).toBe('/sprites/journal_open_1.png');
    expect(journalOpenFrameSrc(-5)).toBe('/sprites/journal_open_1.png');
  });

  it('called-withFrameAboveCount-clampsToFinalFrame', () => {
    expect(journalOpenFrameSrc(JOURNAL_OPEN_FRAME_COUNT + 3)).toBe(
      `/sprites/journal_open_${JOURNAL_OPEN_FRAME_COUNT}.png`,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/entities/JournalAnimation.test.ts`
Expected: FAIL — cannot find module `./JournalAnimation`.

- [ ] **Step 3: Write the implementation**

```ts
/** Total frames in the book-opening sequence (`journal_open_1.png` …
 * `journal_open_9.png` in `public/sprites/`) — frame 1 is the closed cover,
 * frame `JOURNAL_OPEN_FRAME_COUNT` is the fully spread-open blank pages the
 * journal's actual content renders on top of. */
export const JOURNAL_OPEN_FRAME_COUNT = 9;

/** Milliseconds each frame is held before advancing to the next — 9 frames
 * at this interval gives a ~400ms open animation, played once whenever the
 * journal mounts (opening is the only animated transition; closing is
 * instant, see this plan's Architecture note). */
export const JOURNAL_OPEN_FRAME_INTERVAL_MS = 50;

/** Sprite path for a given 1-indexed frame, clamped to the valid range so an
 * out-of-range frame (e.g. a stray extra interval tick) never 404s. */
export function journalOpenFrameSrc(frame: number): string {
  const clamped = Math.max(1, Math.min(JOURNAL_OPEN_FRAME_COUNT, frame));
  return `/sprites/journal_open_${clamped}.png`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/JournalAnimation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/JournalAnimation.ts src/themes/platformer/entities/JournalAnimation.test.ts
git commit -m "feat(platformer): add journal book-opening frame sequencing"
```

---

## Task 3: `JournalEntry.ts` — Simple List entry formatting (pure)

**Files:**
- Create: `src/themes/platformer/entities/JournalEntry.ts`
- Test: `src/themes/platformer/entities/JournalEntry.test.ts`

**Interfaces:**
- Consumes: `CollectedFact`, `SectionId` from `../types` (step 13).
- Produces: `JournalEntryDisplay` interface (`{ icon: string; title: string;
  subtitle?: string }`) and `formatJournalEntry(fact: CollectedFact):
  JournalEntryDisplay`. Task 6 (`Journal.tsx`) imports `formatJournalEntry`
  and renders `icon`/`title`/`subtitle` per collected fact, replacing the
  step-13 `factItemLabel` helper (deleted in Task 6).

- [ ] **Step 1: Write the failing tests**

```ts
import { formatJournalEntry } from './JournalEntry';
import type { CollectedFact } from '../types';

const fact = (overrides: Partial<CollectedFact>): CollectedFact => ({
  id: 'x',
  sectionId: 'skills',
  sectionLabel: 'Skills',
  data: {},
  sourceType: 'coin',
  ...overrides,
});

describe('formatJournalEntry', () => {
  it('skillFact-fullLevel-titleIncludesNameAndFiveFilledStars', () => {
    const result = formatJournalEntry(
      fact({ sectionId: 'skills', data: { name: 'TypeScript', level: 100 } }),
    );
    expect(result.title).toBe('TypeScript ★★★★★');
  });

  it('skillFact-zeroLevel-titleIncludesNameAndZeroFilledStars', () => {
    const result = formatJournalEntry(
      fact({ sectionId: 'skills', data: { name: 'COBOL', level: 0 } }),
    );
    expect(result.title).toBe('COBOL ☆☆☆☆☆');
  });

  it('skillFact-midLevel-roundsToNearestStar', () => {
    // 80/20 = 4 exactly
    const result = formatJournalEntry(
      fact({ sectionId: 'skills', data: { name: 'React', level: 80 } }),
    );
    expect(result.title).toBe('React ★★★★☆');
  });

  it('languageFact-anyLevel-titleIncludesNameAndStarsIconIsFlag', () => {
    const result = formatJournalEntry(
      fact({
        sectionId: 'languages',
        data: { name: 'German', flag: '🇩🇪', level: 100 },
      }),
    );
    expect(result.title).toBe('German ★★★★★');
    expect(result.icon).toBe('🇩🇪');
  });

  it('experienceFact-anyData-titleIsCompanyAndRoleSubtitleIsDateRange', () => {
    const result = formatJournalEntry(
      fact({
        sectionId: 'experience',
        data: {
          company: 'Acme Corp',
          role: 'Senior Engineer',
          startDate: '2020-01',
          endDate: '2023-06',
          highlights: [],
        },
      }),
    );
    expect(result.title).toBe('Acme Corp — Senior Engineer');
    expect(result.subtitle).toBe('2020-01–2023-06');
    expect(result.icon).toBe('🏢');
  });

  it('experienceFact-noEndDate-subtitleSaysPresent', () => {
    const result = formatJournalEntry(
      fact({
        sectionId: 'experience',
        data: { company: 'Acme Corp', role: 'Senior Engineer', startDate: '2020-01', highlights: [] },
      }),
    );
    expect(result.subtitle).toBe('2020-01–Present');
  });

  it('educationFact-anyData-titleIsDegreeSubtitleIsInstitution', () => {
    const result = formatJournalEntry(
      fact({
        sectionId: 'education',
        data: { degree: 'B.Sc. Computer Science', institution: 'TU Berlin', startDate: '2016-10' },
      }),
    );
    expect(result.title).toBe('B.Sc. Computer Science');
    expect(result.subtitle).toBe('TU Berlin');
    expect(result.icon).toBe('🎓');
  });

  it('courseFact-anyData-titleIsCourseTitleSubtitleIsProvider', () => {
    const result = formatJournalEntry(
      fact({
        sectionId: 'courses',
        data: { title: 'Advanced React Patterns', provider: 'Frontend Masters', date: '2024-06', category: 'Web Development' },
      }),
    );
    expect(result.title).toBe('Advanced React Patterns');
    expect(result.subtitle).toBe('Frontend Masters');
    expect(result.icon).toBe('📘');
  });

  it('certificateFact-anyData-titleIsNameSubtitleIsIssuer', () => {
    const result = formatJournalEntry(
      fact({
        sectionId: 'certificates',
        data: { name: 'AWS Solutions Architect Associate', issuer: 'Amazon Web Services', date: '2023-06' },
      }),
    );
    expect(result.title).toBe('AWS Solutions Architect Associate');
    expect(result.subtitle).toBe('Amazon Web Services');
    expect(result.icon).toBe('📜');
  });

  it('projectFact-anyData-titleIsNameNoSubtitle', () => {
    const result = formatJournalEntry(
      fact({ sectionId: 'projects', data: { name: 'Open Source Task Runner', description: 'A thing' } }),
    );
    expect(result.title).toBe('Open Source Task Runner');
    expect(result.subtitle).toBeUndefined();
    expect(result.icon).toBe('🚀');
  });

  it('unrecognizedSectionShapeMissingFields-fallsBackToSectionLabel', () => {
    const result = formatJournalEntry(
      fact({ sectionId: 'activities', sectionLabel: 'Activities', data: {} }),
    );
    expect(result.title).toBe('Activities');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/entities/JournalEntry.test.ts`
Expected: FAIL — cannot find module `./JournalEntry`.

- [ ] **Step 3: Write the implementation**

```ts
import type { CollectedFact, SectionId } from '../types';

export interface JournalEntryDisplay {
  icon: string;
  title: string;
  subtitle?: string;
}

/** One emoji per section, per FR-017 ("🏢 for experience, 🎓 for
 * education, etc."). Used as the fallback icon — `languages` entries use
 * the fact's own flag emoji instead (see `formatJournalEntry` below). */
const SECTION_ICON: Record<SectionId, string> = {
  personality: '👤',
  experience: '🏢',
  skills: '💡',
  courses: '📘',
  education: '🎓',
  certificates: '📜',
  languages: '🌐',
  projects: '🚀',
  activities: '🧭',
};

/** 0-100 integer level → a 5-star rating string, e.g. level 80 → "★★★★☆"
 * (FR-017: "TypeScript ★★★★☆"). Rounds to the nearest star rather than
 * flooring, so 80 (exactly 4 stars) doesn't read as weaker than intended. */
function starRating(level: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(level / 20)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

/**
 * Formats a collected fact for the Simple List entry style (FR-017): an
 * icon, a one-line title, and an optional subtitle (dates/institution/
 * provider — whatever the section's second-most-important field is).
 * Falls back to the fact's `sectionLabel` for any section shape not
 * explicitly handled below (defensive — every section FR-009 maps to a
 * collectible is covered; this only matters for malformed/future data).
 */
export function formatJournalEntry(fact: CollectedFact): JournalEntryDisplay {
  const icon = SECTION_ICON[fact.sectionId];
  const data = fact.data as Record<string, unknown>;

  switch (fact.sectionId) {
    case 'skills':
      return { icon, title: `${data.name} ${starRating(data.level as number)}` };
    case 'languages':
      return {
        icon: typeof data.flag === 'string' ? data.flag : icon,
        title: `${data.name} ${starRating(data.level as number)}`,
      };
    case 'experience':
      return {
        icon,
        title: `${data.company} — ${data.role}`,
        subtitle: `${data.startDate}–${data.endDate ?? 'Present'}`,
      };
    case 'education':
      return { icon, title: `${data.degree}`, subtitle: `${data.institution}` };
    case 'courses':
      return { icon, title: `${data.title}`, subtitle: `${data.provider}` };
    case 'certificates':
      return { icon, title: `${data.name}`, subtitle: `${data.issuer}` };
    case 'projects':
      return { icon, title: `${data.name}` };
    default:
      return { icon, title: fact.sectionLabel };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/JournalEntry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/JournalEntry.ts src/themes/platformer/entities/JournalEntry.test.ts
git commit -m "feat(platformer): add Simple List entry formatting for collected facts"
```

---

## Task 4: `JournalSections.ts` — bookmark order/colors/visibility (pure) + missing i18n key

**Files:**
- Create: `src/themes/platformer/entities/JournalSections.ts`
- Test: `src/themes/platformer/entities/JournalSections.test.ts`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/de.json`

**Interfaces:**
- Consumes: `SectionId` from `../types` (step 13); `CVData` from
  `@/types/cv`; `currentUI` from `@/state/locale`.
- Produces: `JOURNAL_SECTION_ORDER: SectionId[]`,
  `SECTION_BOOKMARK_COLOR: Record<(typeof JOURNAL_SECTION_ORDER)[number],
  BookmarkColor>` (where `BookmarkColor = 'blue' | 'green' | 'orange' |
  'purple' | 'red' | 'yellow'`, also exported), `nonEmptySections(cv:
  CVData): SectionId[]`, `sectionLabel(section: SectionId): string`. Task 5
  (`BookmarkTabs.tsx`) imports `SECTION_BOOKMARK_COLOR`/`BookmarkColor`/
  `sectionLabel`. Task 6 (`Journal.tsx`) imports
  `JOURNAL_SECTION_ORDER`/`nonEmptySections`/`sectionLabel` — centralizing
  `sectionLabel` here (rather than duplicating it in both components) is a
  correction made during this plan's self-review.

- [ ] **Step 1: Write the failing tests**

```ts
import {
  JOURNAL_SECTION_ORDER,
  SECTION_BOOKMARK_COLOR,
  nonEmptySections,
  sectionLabel,
} from './JournalSections';
import type { CVData } from '@/types/cv';

const emptyCV: CVData = {
  personality: { name: 'Test', tagline: 'Test', summary: 'Test' },
  experience: [],
  skills: [],
  courses: [],
  education: [],
  certificates: [],
  languages: [],
  projects: [],
};

describe('JOURNAL_SECTION_ORDER', () => {
  it('always-excludesPersonalityAndActivities', () => {
    expect(JOURNAL_SECTION_ORDER).not.toContain('personality');
    expect(JOURNAL_SECTION_ORDER).not.toContain('activities');
  });

  it('always-containsExactlyTheSevenCollectibleBackedSections', () => {
    expect([...JOURNAL_SECTION_ORDER].sort()).toEqual(
      ['certificates', 'courses', 'education', 'experience', 'languages', 'projects', 'skills'].sort(),
    );
  });
});

describe('SECTION_BOOKMARK_COLOR', () => {
  it('always-assignsAColorToEveryJournalSection', () => {
    for (const section of JOURNAL_SECTION_ORDER) {
      expect(SECTION_BOOKMARK_COLOR[section]).toBeTruthy();
    }
  });
});

describe('nonEmptySections', () => {
  it('allSectionsEmpty-returnsEmptyArray', () => {
    expect(nonEmptySections(emptyCV)).toEqual([]);
  });

  it('onlySkillsNonEmpty-returnsOnlySkills', () => {
    const cv: CVData = { ...emptyCV, skills: [{ category: 'Frontend', skills: [{ name: 'React', level: 80 }] }] };
    expect(nonEmptySections(cv)).toEqual(['skills']);
  });

  it('languagesUndefined-treatedAsEmpty', () => {
    const cv: CVData = { ...emptyCV, languages: undefined };
    expect(nonEmptySections(cv)).toEqual([]);
  });

  it('multipleSectionsNonEmpty-returnsThemInJournalSectionOrder', () => {
    const cv: CVData = {
      ...emptyCV,
      projects: [{ name: 'A Project', description: 'desc' }],
      experience: [{ company: 'X', role: 'Y', startDate: '2020-01', highlights: [] }],
    };
    // experience comes before projects in JOURNAL_SECTION_ORDER
    expect(nonEmptySections(cv)).toEqual(['experience', 'projects']);
  });
});

describe('sectionLabel', () => {
  it('called-withKnownSection-returnsTranslatedLabel', () => {
    // Relies on the test environment's default locale being 'en' (jsdom's
    // default navigator.language), matching src/i18n/locales/en.json.
    expect(sectionLabel('experience')).toBe('Experience');
    expect(sectionLabel('languages')).toBe('Languages');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/entities/JournalSections.test.ts`
Expected: FAIL — cannot find module `./JournalSections`.

- [ ] **Step 3: Write the implementation**

```ts
import type { CVData } from '@/types/cv';
import { currentUI } from '@/state/locale';
import type { SectionId } from '../types';

/**
 * The CV sections that can back a journal bookmark today, per FR-009's
 * collectible mapping (Coins → Skills/Languages, Blocks → Experience/
 * Education/Courses, Enemies → Certificates/Projects). `personality` and
 * `activities` are deliberately excluded: Personality has no collectibles
 * until step 22's flagpole ending screen adds it (FR-013), and `activities`
 * isn't mapped to any collectible type in FR-009. Order here is the order
 * bookmarks are distributed top-to-bottom (per `journal-mockup.html`).
 */
export const JOURNAL_SECTION_ORDER: SectionId[] = [
  'experience',
  'education',
  'courses',
  'certificates',
  'skills',
  'languages',
  'projects',
];

export type BookmarkColor = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow';

/**
 * Six sprite colors (`public/sprites/bookmark_{color}.png`) for seven
 * sections — `courses` and `certificates` share `red` (both
 * "credentials/learning" in spirit), the closest pairing available. See
 * this plan's "six bookmark colors for seven sections" design note if this
 * needs revisiting.
 */
export const SECTION_BOOKMARK_COLOR: Record<(typeof JOURNAL_SECTION_ORDER)[number], BookmarkColor> = {
  experience: 'orange',
  education: 'green',
  courses: 'red',
  certificates: 'red',
  skills: 'yellow',
  languages: 'purple',
  projects: 'blue',
};

/**
 * Which journal sections have at least one CV item — and therefore get a
 * bookmark — regardless of whether anything in them has been *collected*
 * yet (FR-013: "Empty CV sections produce no collectibles and hide their
 * journal bookmark", evaluated against the CV data itself, not session
 * progress). Returned in `JOURNAL_SECTION_ORDER`'s order.
 */
export function nonEmptySections(cv: CVData): SectionId[] {
  const isNonEmpty: Record<(typeof JOURNAL_SECTION_ORDER)[number], boolean> = {
    experience: cv.experience.length > 0,
    education: cv.education.length > 0,
    courses: cv.courses.length > 0,
    certificates: cv.certificates.length > 0,
    skills: cv.skills.length > 0,
    languages: (cv.languages?.length ?? 0) > 0,
    projects: cv.projects.length > 0,
  };
  return JOURNAL_SECTION_ORDER.filter((section) => isNonEmpty[section]);
}

/**
 * Locale-aware display label for a journal section, e.g. `'skills'` →
 * `'Skills'` (en) / `'Kenntnisse'` (de). Shared by `BookmarkTabs` (tab
 * labels) and `Journal` (active section's page header) so the two never
 * drift out of sync with each other.
 */
export function sectionLabel(section: SectionId): string {
  return currentUI.value.sections[section as keyof typeof currentUI.value.sections] ?? section;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/JournalSections.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the missing `languages` section label**

`sections.languages` doesn't exist in either locale file yet (only `nav.*`/
`sections.*` for experience/skills/projects/education/courses/certificates/
contact — `languages` was never added because no UI needed the label before
now). `BookmarkTabs` (Task 5) needs it for the languages tab's title.

In `src/i18n/locales/en.json`, find:

```json
  "sections": {
    "summary": "Summary",
    "experience": "Experience",
    "skills": "Skills",
    "projects": "Projects",
    "education": "Education",
    "courses": "Courses",
    "certificates": "Certificates",
    "contact": "Contact"
  },
```

Replace with:

```json
  "sections": {
    "summary": "Summary",
    "experience": "Experience",
    "skills": "Skills",
    "languages": "Languages",
    "projects": "Projects",
    "education": "Education",
    "courses": "Courses",
    "certificates": "Certificates",
    "contact": "Contact"
  },
```

In `src/i18n/locales/de.json`, find:

```json
  "sections": {
    "summary": "Zusammenfassung",
    "experience": "Erfahrung",
    "skills": "Kenntnisse",
    "projects": "Projekte",
    "education": "Studium",
    "courses": "Kurse",
    "certificates": "Zertifikate",
    "contact": "Kontakt"
  },
```

Replace with:

```json
  "sections": {
    "summary": "Zusammenfassung",
    "experience": "Erfahrung",
    "skills": "Kenntnisse",
    "languages": "Sprachen",
    "projects": "Projekte",
    "education": "Studium",
    "courses": "Kurse",
    "certificates": "Zertifikate",
    "contact": "Kontakt"
  },
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (the `Translation` type is inferred from `en.json`, so adding
a key there and mirroring it in `de.json` keeps both in sync automatically —
no separate type file to update).

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/entities/JournalSections.ts src/themes/platformer/entities/JournalSections.test.ts src/i18n/locales/en.json src/i18n/locales/de.json
git commit -m "feat(platformer): add journal bookmark section order/colors, languages i18n label"
```

---

## Task 5: `BookmarkTabs` component

**Files:**
- Create: `src/themes/platformer/components/BookmarkTabs.tsx`
- Test: `src/themes/platformer/components/BookmarkTabs.test.tsx`

**Interfaces:**
- Consumes: `SECTION_BOOKMARK_COLOR`, `BookmarkColor`, `sectionLabel` from
  `../entities/JournalSections` (Task 4); `SectionId` from `../types`
  (step 13); `cn` from `@/lib/utils`.
- Produces: `BookmarkTabs` component, props `{ sections: SectionId[];
  activeSection: SectionId; onSelect: (section: SectionId) => void }`.
  Task 6 (`Journal.tsx`) renders `<BookmarkTabs sections={...}
  activeSection={...} onSelect={setActiveSection} />`. Exposes
  `data-testid={`bookmark-tab-${section}`}` per tab.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BookmarkTabs } from './BookmarkTabs';

describe('BookmarkTabs', () => {
  it('render-withSections-rendersOneTabPerSection', () => {
    render(
      <BookmarkTabs
        sections={['experience', 'skills', 'projects']}
        activeSection="skills"
        onSelect={() => {}}
      />,
    );

    expect(screen.getByTestId('bookmark-tab-experience')).toBeInTheDocument();
    expect(screen.getByTestId('bookmark-tab-skills')).toBeInTheDocument();
    expect(screen.getByTestId('bookmark-tab-projects')).toBeInTheDocument();
  });

  it('render-activeSection-onlyActiveTabShowsLabel', () => {
    render(
      <BookmarkTabs sections={['experience', 'skills']} activeSection="skills" onSelect={() => {}} />,
    );

    expect(screen.getByTestId('bookmark-tab-skills')).toHaveTextContent('Skills');
    expect(screen.getByTestId('bookmark-tab-experience')).not.toHaveTextContent('Experience');
  });

  it('inactiveTabClicked-always-callsOnSelectWithThatSection', () => {
    const onSelect = vi.fn();
    render(
      <BookmarkTabs sections={['experience', 'skills']} activeSection="skills" onSelect={onSelect} />,
    );

    fireEvent.click(screen.getByTestId('bookmark-tab-experience'));

    expect(onSelect).toHaveBeenCalledWith('experience');
  });

  it('activeTabClicked-still-callsOnSelectWithSameSection', () => {
    const onSelect = vi.fn();
    render(
      <BookmarkTabs sections={['experience', 'skills']} activeSection="skills" onSelect={onSelect} />,
    );

    fireEvent.click(screen.getByTestId('bookmark-tab-skills'));

    expect(onSelect).toHaveBeenCalledWith('skills');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/components/BookmarkTabs.test.tsx`
Expected: FAIL — cannot find module `./BookmarkTabs`.

- [ ] **Step 3: Write the implementation**

```tsx
import { useSignals } from '@preact/signals-react/runtime';
import { cn } from '@/lib/utils';
import { SECTION_BOOKMARK_COLOR, sectionLabel, type BookmarkColor } from '../entities/JournalSections';
import type { SectionId } from '../types';

interface BookmarkTabsProps {
  sections: SectionId[];
  activeSection: SectionId;
  onSelect: (section: SectionId) => void;
}

const BOOKMARK_SPRITE: Record<BookmarkColor, string> = {
  blue: '/sprites/bookmark_blue.png',
  green: '/sprites/bookmark_green.png',
  orange: '/sprites/bookmark_orange.png',
  purple: '/sprites/bookmark_purple.png',
  red: '/sprites/bookmark_red.png',
  yellow: '/sprites/bookmark_yellow.png',
};

/**
 * Colored bookmark tabs along the journal's right edge — one per non-empty
 * CV section (per FR-013/FR-016). Inactive tabs are a thin 12px sliver of
 * their sprite; the active tab widens to 48px and shows its vertical label.
 * Per-section counters and pagination are step 15, not built here.
 */
export const BookmarkTabs = ({ sections, activeSection, onSelect }: BookmarkTabsProps) => {
  useSignals();

  return (
    <div className="flex flex-col justify-between" data-testid="bookmark-tabs">
      {sections.map((section) => {
        const isActive = section === activeSection;
        const label = sectionLabel(section);
        return (
          <button
            key={section}
            type="button"
            onClick={() => onSelect(section)}
            data-testid={`bookmark-tab-${section}`}
            aria-label={label}
            className={cn(
              'flex items-center justify-center overflow-hidden bg-cover bg-left transition-all duration-150',
              isActive ? 'h-20 w-12' : 'h-16 w-3',
            )}
            style={{ backgroundImage: `url(${BOOKMARK_SPRITE[SECTION_BOOKMARK_COLOR[section]]})` }}
          >
            {isActive && (
              <span
                className="font-caveat text-sm font-bold text-white"
                style={{ writingMode: 'vertical-rl' }}
              >
                {label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/components/BookmarkTabs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/components/BookmarkTabs.tsx src/themes/platformer/components/BookmarkTabs.test.tsx
git commit -m "feat(platformer): add BookmarkTabs component"
```

---

## Task 6: Rewrite `Journal.tsx` — book animation, notebook styling, bookmarks

**Files:**
- Modify: `src/themes/platformer/components/Journal.tsx`
- Modify: `src/themes/platformer/components/Journal.test.tsx`

**Interfaces:**
- Consumes: `journalOpenFrameSrc`, `JOURNAL_OPEN_FRAME_COUNT`,
  `JOURNAL_OPEN_FRAME_INTERVAL_MS` from `../entities/JournalAnimation`
  (Task 2); `formatJournalEntry` from `../entities/JournalEntry` (Task 3);
  `JOURNAL_SECTION_ORDER`, `nonEmptySections`, `sectionLabel` from
  `../entities/JournalSections` (Task 4); `BookmarkTabs` from
  `./BookmarkTabs` (Task 5); `currentCV` from `@/state/locale`;
  `collectedFacts` from `../PlatformerState` (step 13); `SectionId` from
  `../types` (step 13).
- Produces: `Journal` component, same props as before (`{ onClose: () =>
  void }`) — no change to how `PlatformerPage.tsx` renders it. Testids:
  `platformer-journal` (outer wrapper, unchanged), `journal-close-button`
  (unchanged), `journal-book` (new, the animated book image), `journal-fact-item`
  (unchanged name, new rendered content), `journal-empty-state` (unchanged
  name, now per-section).

- [ ] **Step 1: Write the failing tests**

Read `src/themes/platformer/components/Journal.test.tsx` first (it will be
entirely replaced — the step-13 tests assumed a flat, unsectioned fact list
with no animation; this task's rewrite needs fake timers to get past the
book-opening animation before asserting on content, and asserts section
labels on the *page header* rather than repeated per-entry, matching
`entry-styles-mockup.html`'s Simple List style, which doesn't repeat the
section name on every bullet).

```tsx
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Journal } from './Journal';
import { collectedFacts } from '../PlatformerState';
import { JOURNAL_OPEN_FRAME_COUNT, JOURNAL_OPEN_FRAME_INTERVAL_MS } from '../entities/JournalAnimation';
import type { CollectedFact } from '../types';

const originalFacts = collectedFacts.value;

const openBookAnimation = () => {
  act(() => {
    vi.advanceTimersByTime(JOURNAL_OPEN_FRAME_COUNT * JOURNAL_OPEN_FRAME_INTERVAL_MS);
  });
};

describe('Journal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    collectedFacts.value = originalFacts;
    vi.useRealTimers();
  });

  it('render-onMount-showsFirstAnimationFrame', () => {
    render(<Journal onClose={() => {}} />);

    expect(screen.getByTestId('journal-book')).toHaveAttribute(
      'src',
      '/sprites/journal_open_1.png',
    );
  });

  it('render-afterAnimationCompletes-showsFinalFrame', () => {
    render(<Journal onClose={() => {}} />);

    openBookAnimation();

    expect(screen.getByTestId('journal-book')).toHaveAttribute(
      'src',
      `/sprites/journal_open_${JOURNAL_OPEN_FRAME_COUNT}.png`,
    );
  });

  it('render-beforeAnimationCompletes-contentNotYetShown', () => {
    render(<Journal onClose={() => {}} />);

    expect(screen.queryByTestId('journal-fact-item')).not.toBeInTheDocument();
    expect(screen.queryByTestId('journal-empty-state')).not.toBeInTheDocument();
  });

  it('render-withSkillsFactAfterAnimation-defaultsToSkillsSectionAndListsIt', () => {
    const facts: CollectedFact[] = [
      {
        id: 'fact-1',
        sectionId: 'skills',
        sectionLabel: 'Skills',
        data: { name: 'React', level: 80 },
        sourceType: 'coin',
      },
    ];
    collectedFacts.value = facts;

    render(<Journal onClose={() => {}} />);
    openBookAnimation();

    expect(screen.getByTestId('bookmark-tab-skills')).toBeInTheDocument();
    const items = screen.getAllByTestId('journal-fact-item');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('React ★★★★☆');
  });

  it('render-withNoFactsInActiveSection-showsEmptyStateAfterAnimation', () => {
    collectedFacts.value = [];

    render(<Journal onClose={() => {}} />);
    openBookAnimation();

    expect(screen.getByTestId('journal-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('journal-fact-item')).not.toBeInTheDocument();
  });

  it('bookmarkTabClicked-afterAnimation-switchesDisplayedSection', () => {
    const facts: CollectedFact[] = [
      {
        id: 'fact-1',
        sectionId: 'skills',
        sectionLabel: 'Skills',
        data: { name: 'React', level: 80 },
        sourceType: 'coin',
      },
    ];
    collectedFacts.value = facts;

    render(<Journal onClose={() => {}} />);
    openBookAnimation();
    expect(screen.getAllByTestId('journal-fact-item')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('bookmark-tab-experience'));

    expect(screen.queryByTestId('journal-fact-item')).not.toBeInTheDocument();
    expect(screen.getByTestId('journal-empty-state')).toBeInTheDocument();
  });

  it('closeButtonClicked-always-callsOnClose', () => {
    collectedFacts.value = [];
    const onClose = vi.fn();

    render(<Journal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('journal-close-button'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/components/Journal.test.tsx`
Expected: FAIL — `journal-book` testid and section-switching behavior don't
exist yet in the current (step-13) `Journal.tsx`.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/themes/platformer/components/Journal.tsx`
with:

```tsx
import { useEffect, useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentCV } from '@/state/locale';
import { collectedFacts } from '../PlatformerState';
import { formatJournalEntry } from '../entities/JournalEntry';
import { JOURNAL_SECTION_ORDER, nonEmptySections, sectionLabel } from '../entities/JournalSections';
import {
  journalOpenFrameSrc,
  JOURNAL_OPEN_FRAME_COUNT,
  JOURNAL_OPEN_FRAME_INTERVAL_MS,
} from '../entities/JournalAnimation';
import { BookmarkTabs } from './BookmarkTabs';
import type { SectionId } from '../types';

interface JournalProps {
  onClose: () => void;
}

/**
 * Notebook journal overlay (roadmap step 14). Plays the book-opening sprite
 * sequence once on mount, then overlays the active section's collected
 * facts (Simple List style, FR-017) or a per-section empty-state message on
 * top of the open pages. Bookmark tabs (pulled forward from step 15, per
 * discussion) switch which section is shown. Per-section counters,
 * pagination, and the Reset Game button are step 15's job, not built here.
 */
export const Journal = ({ onClose }: JournalProps) => {
  useSignals();
  const facts = collectedFacts.value;
  const sections = nonEmptySections(currentCV.value);

  const [frame, setFrame] = useState(1);
  useEffect(() => {
    if (frame >= JOURNAL_OPEN_FRAME_COUNT) return;
    const id = setInterval(() => {
      setFrame((prev) => Math.min(prev + 1, JOURNAL_OPEN_FRAME_COUNT));
    }, JOURNAL_OPEN_FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [frame]);

  const defaultSection: SectionId | undefined = facts[0]?.sectionId ?? sections[0];
  const [activeSection, setActiveSection] = useState<SectionId | undefined>(defaultSection);
  const effectiveSection = activeSection ?? defaultSection;

  const animationDone = frame >= JOURNAL_OPEN_FRAME_COUNT;
  const sectionFacts = effectiveSection
    ? facts.filter((fact) => fact.sectionId === effectiveSection)
    : [];

  return (
    <div
      data-testid="platformer-journal"
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
    >
      <div className="pointer-events-auto flex items-stretch drop-shadow-2xl">
        <div className="relative w-[min(900px,90vw)]" style={{ aspectRatio: '900 / 439' }}>
          <img
            data-testid="journal-book"
            src={journalOpenFrameSrc(frame)}
            alt=""
            className="absolute inset-0 h-full w-full"
            style={{ imageRendering: 'pixelated' }}
          />
          {animationDone && (
            <div
              className="absolute inset-[6%_10%] overflow-y-auto text-gray-800"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(transparent, transparent 27px, rgba(90,120,190,0.25) 27px, rgba(90,120,190,0.25) 28px)',
              }}
            >
              {effectiveSection && (
                <h2 className="font-caveat mb-2 text-3xl font-bold">{sectionLabel(effectiveSection)}</h2>
              )}
              {sectionFacts.length === 0 ? (
                <p data-testid="journal-empty-state" className="font-caveat text-lg text-gray-500">
                  No facts collected yet.
                </p>
              ) : (
                <ul className="font-caveat flex flex-col gap-1 text-lg">
                  {sectionFacts.map((fact) => {
                    const entry = formatJournalEntry(fact);
                    return (
                      <li key={fact.id} data-testid="journal-fact-item">
                        <span>
                          {entry.icon} {entry.title}
                        </span>
                        {entry.subtitle && (
                          <span className="ml-6 block text-sm text-gray-500">{entry.subtitle}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
        <BookmarkTabs
          sections={JOURNAL_SECTION_ORDER.filter((s) => sections.includes(s))}
          activeSection={effectiveSection ?? JOURNAL_SECTION_ORDER[0]}
          onSelect={setActiveSection}
        />
      </div>
      <button
        type="button"
        onClick={onClose}
        data-testid="journal-close-button"
        className="pointer-events-auto fixed top-4 right-4 rounded bg-gray-700 px-3 py-1 text-sm text-white"
      >
        Close
      </button>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/components/Journal.test.tsx`
Expected: PASS.

Then run the full suite once to confirm nothing else regressed:

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/components/Journal.tsx src/themes/platformer/components/Journal.test.tsx
git commit -m "feat(platformer): style the journal with the book animation, notebook paper, and bookmarks"
```

---

## Task 7: Real journal icon, top-left placement, hearts HUD shift

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `drawHearts` gains an optional 4th parameter `startX: number =
  HUD_MARGIN` (default preserves every existing call site's behavior and
  every existing `Renderer.test.ts` assertion unchanged); a new exported
  `HEARTS_START_X` constant. `PlatformerPage.tsx` imports `HEARTS_START_X`
  and passes it to `drawHearts`.

- [ ] **Step 1: Write the failing tests**

In `src/themes/platformer/engine/Renderer.test.ts`, find the existing
`describe('drawHearts', ...)` block's imports at the top of the file and add
`HEARTS_START_X` to the existing import from `./Renderer`. Then add this
test inside the `describe('drawHearts', ...)` block:

```ts
  it('called-withCustomStartX-offsetsAllHeartsHorizontally', () => {
    const ctx = createFakeContext();
    const fakeHeartsSheet = {} as HTMLImageElement;

    drawHearts(ctx, MAX_HALF_HEARTS, fakeHeartsSheet, HEARTS_START_X);

    const firstCall = ctx.drawImage.mock.calls[0];
    const secondCall = ctx.drawImage.mock.calls[1];
    expect(firstCall[5]).toBe(HEARTS_START_X); // dx
    expect(secondCall[5]).toBe(HEARTS_START_X + HEART_RENDERED_SIZE + 4); // + spacing
  });
```

(This test reuses whatever `createFakeContext`/`MAX_HALF_HEARTS`/
`HEART_RENDERED_SIZE` helpers the existing `describe('drawHearts', ...)`
tests already use — read the file first to match the exact existing helper
names before writing this addition.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL — `HEARTS_START_X` is not exported from `./Renderer`, and
`drawHearts` doesn't accept a 4th argument yet.

- [ ] **Step 3: Write the implementation**

In `src/themes/platformer/engine/Renderer.ts`, find:

```ts
const HUD_MARGIN = 16;
const HEART_SPACING = 4;

/**
 * Draws the heart HUD at a fixed screen position (top-left), unlike
 * `drawTerrain`/`drawPlayer` which take camera-scroll `originX`/`originY` —
 * the HUD must stay put on screen regardless of how far the camera has
 * scrolled into the level.
 */
export function drawHearts(
  ctx: CanvasRenderingContext2D,
  halfHearts: number,
  heartsSheet: HTMLImageElement,
): void {
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < MAX_HEARTS; i++) {
    const remaining = heartRemaining(halfHearts, i);
    const sx = heartFrameIndex(remaining) * HEART_FRAME_SIZE;
    const x = HUD_MARGIN + i * (HEART_RENDERED_SIZE + HEART_SPACING);
```

Replace with:

```ts
const HUD_MARGIN = 16;
const HEART_SPACING = 4;

/**
 * Reserves room at the HUD's top-left for the journal icon button (a DOM
 * `<img>`/`<button>`, not canvas-drawn — see `PlatformerPage.tsx`) so the
 * heart HUD doesn't render underneath it. 40 is the icon button's size
 * (`size-10` in Tailwind), 8 is the gap between it and the first heart —
 * both must stay in sync with `PlatformerPage.tsx`'s icon button sizing if
 * either changes.
 */
export const HEARTS_START_X = HUD_MARGIN + 40 + 8;

/**
 * Draws the heart HUD at a fixed screen position (top-left by default),
 * unlike `drawTerrain`/`drawPlayer` which take camera-scroll
 * `originX`/`originY` — the HUD must stay put on screen regardless of how
 * far the camera has scrolled into the level. `startX` defaults to
 * `HUD_MARGIN` (the original, unshifted position) so existing callers are
 * unaffected; `PlatformerPage.tsx` passes `HEARTS_START_X` explicitly to
 * make room for the journal icon button.
 */
export function drawHearts(
  ctx: CanvasRenderingContext2D,
  halfHearts: number,
  heartsSheet: HTMLImageElement,
  startX: number = HUD_MARGIN,
): void {
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < MAX_HEARTS; i++) {
    const remaining = heartRemaining(halfHearts, i);
    const sx = heartFrameIndex(remaining) * HEART_FRAME_SIZE;
    const x = startX + i * (HEART_RENDERED_SIZE + HEART_SPACING);
```

- [ ] **Step 4: Run the Renderer tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing `PlatformerPage` test**

In `src/themes/platformer/PlatformerPage.test.tsx`, add this test (inside
the existing `describe('PlatformerPage', ...)` block, anywhere among the
other rendering tests):

```ts
  it('render-default-showsRealJournalIconAtTopLeft', () => {
    render(<PlatformerPage />);

    const icon = screen.getByTestId('journal-open-button');
    expect(icon.tagName).toBe('IMG');
    expect(icon).toHaveAttribute('src', '/sprites/journal.png');
  });
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: FAIL — `journal-open-button` is currently a `<button>` containing
a 📖 emoji, not an `<img>`.

- [ ] **Step 7: Update the implementation**

In `src/themes/platformer/PlatformerPage.tsx`, find:

```ts
import {
  drawTerrain,
  drawPlayer,
  drawHearts,
  drawIrisOverlay,
  drawRestartPrompt,
  RESTART_PROMPT_FONT_FAMILY,
  RESTART_PROMPT_FONT_URL,
} from './engine/Renderer';
```

Replace with:

```ts
import {
  drawTerrain,
  drawPlayer,
  drawHearts,
  drawIrisOverlay,
  drawRestartPrompt,
  RESTART_PROMPT_FONT_FAMILY,
  RESTART_PROMPT_FONT_URL,
  HEARTS_START_X,
} from './engine/Renderer';
```

Find:

```ts
      if (heartsSpriteRef.current) {
        drawHearts(ctx, healthState.value, heartsSpriteRef.current);
      }
```

Replace with:

```ts
      if (heartsSpriteRef.current) {
        drawHearts(ctx, healthState.value, heartsSpriteRef.current, HEARTS_START_X);
      }
```

Find:

```tsx
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" tabIndex={-1} />
      <FloatingControls />
      {journalOpen && <Journal onClose={handleJournalToggle} />}
      {/* PLACEHOLDER icon: no journal/book pixel-art sprite exists yet
          (public/sprites/, public/icons.svg) — swap this emoji for a real
          sprite once one is added. FR-025: bottom-right, same action as `J`. */}
      <button
        type="button"
        onClick={handleJournalToggle}
        data-testid="journal-open-button"
        aria-label="Toggle journal"
        className="fixed right-4 bottom-4 z-50 rounded-full bg-gray-800/80 px-3 py-2 text-xl"
      >
        📖
      </button>
```

Replace with:

```tsx
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" tabIndex={-1} />
      <FloatingControls />
      {journalOpen && <Journal onClose={handleJournalToggle} />}
      {/* Moved from bottom-right to top-left (was hard to spot against the
          terrain) — sits left of the hearts HUD, which HEARTS_START_X
          shifts right to make room. size-10 (40px) must match the 40 baked
          into HEARTS_START_X's computation in Renderer.ts. */}
      <button
        type="button"
        onClick={handleJournalToggle}
        aria-label="Toggle journal"
        className="fixed top-4 left-4 z-50 size-10 overflow-hidden rounded"
      >
        <img
          src="/sprites/journal.png"
          alt=""
          data-testid="journal-open-button"
          className="h-full w-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      </button>
```

(Note: `data-testid="journal-open-button"` moves from the `<button>` to the
inner `<img>` — Step 5's test queries `getByTestId('journal-open-button')`
and asserts `tagName === 'IMG'`; the `<button>` remains the clickable/focus
target, wrapping the image.)

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS.

Then run the full suite once to confirm nothing else regressed:

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): move journal icon to top-left with the real sprite, shift hearts HUD"
```

---

## Task 8: Manual browser verification + roadmap checkoff

- [ ] **Step 1: Manual browser check**

Start the dev server and open the Platformer theme. Confirm:

1. The top-left HUD shows the closed-book icon (`journal.png`) to the left
   of the 3 hearts, not overlapping them.
2. Click the icon (or press `J`) — the book animation plays (cover flipping
   open, ~400ms) and settles on the open-pages image.
3. The open pages show a section header (e.g. "Skills"), the Caveat
   handwriting font is visibly applied, and (if any seed facts exist for
   that section) entries in Simple List style — e.g. "💡 TypeScript
   ★★★★☆" — with faint ruled horizontal lines visible across the page.
4. Colored bookmark tabs appear along the book's right edge, one per
   non-empty CV section, distributed top-to-bottom; the active section's
   tab is wider and shows its label, others are thin slivers.
5. Click a different bookmark tab — the displayed section switches; if it
   has no collected facts yet, a "No facts collected yet." message shows
   instead (this section's own facts, not step 13's flat generic message).
6. Click Close (or press `J` again) — the journal closes instantly (no
   reverse animation), the game resumes.
7. Resize the window with the journal open — the book image scales
   (`w-[min(900px,90vw)]`) without breaking layout.
8. Visually compare the entry style against
   `specs/S-006-platformer-theme/entry-styles-mockup.html`'s **Option A**
   (Simple List) — adjust padding/font-size/line-height in `Journal.tsx` by
   eye if it doesn't read as close enough; the values in Task 6's code are
   a starting point, not exact.

- [ ] **Step 2: Check off the roadmap step**

In `specs/S-006-platformer-theme/roadmap.md`, find:

```
- [ ] **14. Journal styling** — notebook paper, `Caveat` handwriting font, Simple
  List entry style per the mockup.
  *Verify: visually matches `entry-styles-mockup.html`.*
- [ ] **15. Bookmark tabs + counters + pagination + Reset button** — per-section
  tabs, "N/M" counters, pagination within a section, Reset Game button.
  *Verify: switch sections, counters update correctly, Reset clears all state.*
```

Replace with:

```
- [x] **14. Journal styling** — notebook paper, `Caveat` handwriting font, Simple
  List entry style per the mockup, the book-opening animation
  (`journal_open_1-9.png`) and real icon (`journal.png`, moved to top-left
  per user feedback — bottom-right blended into the terrain). Bookmark tabs
  (`bookmark_*.png`, one per non-empty CV section, click-to-switch) were
  pulled forward from step 15 into this step, per discussion — only
  per-section counters, pagination, and the Reset Game button remain in
  step 15.
  *Verify: visually matches `entry-styles-mockup.html`.*
- [ ] **15. Counters + pagination + Reset button** — "N/M" counters per
  section, pagination within a section, Reset Game button. (Bookmark tabs
  themselves moved into step 14.)
  *Verify: counters update correctly, pagination works within a section with
  many facts, Reset clears all state.*
```

- [ ] **Step 3: Commit the checkoff**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs(platformer): check off roadmap step 14 (journal styling), fold bookmark tabs in from step 15"
```

## After this plan

Open a PR from `S-006-step14-journal-styling` into `S-006-platformer-theme`
(not `main`). Delete the step branch after merging.
