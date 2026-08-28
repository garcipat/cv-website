# Idea: Page Objects for Component Tests

## Status: Design Exploration

## Summary

Introduce a page-object layer for React Testing Library component tests, and amend
`docs/TestingGuide.md` to require it. Right now every test file repeats raw `data-testid`
strings (`screen.getByTestId('journal-page-prev')`, `screen.getByTestId('bookmark-tab-skills')`,
...) inline. A test-id changes shape or gets renamed, and every test file touching that
component needs a manual find-and-replace instead of a one-line update.

## Motivation

Noticed while implementing S-006 roadmap step 15 (journal counters/pagination/Reset Game,
`src/themes/platformer/components/Journal.tsx`): that one component alone accumulated ~10
`data-testid`s across step 13/14/15 (`journal-book`, `journal-close-button`,
`journal-fact-item`, `journal-empty-state`, `bookmark-tab-{section}`, `journal-section-counter`,
`journal-page-prev`/`journal-page-next`/`journal-page-counter`, `journal-collectibles-summary`,
`journal-reset-button`), each repeated as a raw string across `Journal.test.tsx` and
`PlatformerPage.test.tsx`. This is exactly the kind of duplication a page-object wrapper
exists to remove.

## Proposed shape

A small per-component (or per-feature) object exposing typed getters/actions over
`@testing-library/react`'s `screen`, e.g.:

```typescript
// src/themes/platformer/components/Journal.page.ts (exact location TBD)
export const journalPage = {
  factItems: () => screen.getAllByTestId('journal-fact-item'),
  emptyState: () => screen.queryByTestId('journal-empty-state'),
  sectionCounter: () => screen.getByTestId('journal-section-counter'),
  clickBookmark: (section: SectionId) => fireEvent.click(screen.getByTestId(`bookmark-tab-${section}`)),
  clickReset: () => fireEvent.click(screen.getByTestId('journal-reset-button')),
  clickNextPage: () => fireEvent.click(screen.getByTestId('journal-page-next')),
  pageCounterText: () => screen.getByTestId('journal-page-counter').textContent,
};
```

Tests then read as `journalPage.clickBookmark('skills')` instead of
`fireEvent.click(screen.getByTestId('bookmark-tab-skills'))` repeated at every call site.

## Open questions (not decided yet)

- **Scope**: retrofit existing platformer test files, or only apply to new components going
  forward? A full retrofit is a real, separate effort — not a drive-by.
  - Also worth deciding whether `docs/TestingGuide.md` should keep the `data-testid` /
    `{method}-{Condition}-{ExpectedResult}` conventions untouched and only *add* the
    page-object requirement, or restate the whole convention section together.
- **Location convention**: co-located `Component.page.ts` next to `Component.tsx`, or a
  shared `test/page-objects/` directory?
- **Granularity**: one page object per component file, or per user-facing "screen"
  (Journal's page object might reasonably wrap `BookmarkTabs` too, since they're always
  tested together)?
- **How this interacts with the constitution's 80%+ component coverage target** — page
  objects are test infrastructure, not test cases; they shouldn't themselves need separate
  coverage, but the guideline amendment should say so explicitly to avoid confusion.

## Next step

When picked up: brainstorm the shape properly (probably a **bounded** task — existing test
files, existing convention doc), decide the open questions above, amend
`docs/TestingGuide.md`, then apply it starting with the platformer theme's test files (the
ones that prompted this) before deciding whether to retrofit the rest of the codebase.
