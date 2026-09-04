import { render, screen, fireEvent, act } from '@testing-library/react';
import { Journal } from './Journal';
import { journalPage } from './Journal.page';
import { currentCV } from '@/state/locale';
import {
  collectedFacts,
  activeJournalSection,
  collectedCollectibleIds,
  collectiblePlacements,
  blockPlacements,
  enemyPlacements,
} from '../PlatformerState';
import { currentLayout, LEVEL_1_LAYOUT } from '../level/level';
import { JOURNAL_OPEN_FRAME_COUNT, JOURNAL_OPEN_FRAME_INTERVAL_MS } from '../entities/JournalAnimation';
import { sectionTotal } from '../entities/JournalSections';
import type { CollectedFact } from '../types';

const originalFacts = collectedFacts.value;

// Journal.tsx schedules one `setTimeout` per frame (re-created by an effect
// each time `frame` changes), rather than a single repeating `setInterval`
// — so a single `advanceTimersByTime(N * INTERVAL)` call can fire the FIRST
// timeout but the clock races past where the SECOND one would have been
// scheduled, since React hasn't re-rendered/re-scheduled it yet. Advancing
// one interval at a time (each in its own `act()`) lets React flush and
// reschedule the next timeout before the clock moves further.
const advanceFrames = (count: number) => {
  for (let i = 0; i < count; i++) {
    act(() => {
      vi.advanceTimersByTime(JOURNAL_OPEN_FRAME_INTERVAL_MS);
    });
  }
};

const openBookAnimation = () => advanceFrames(JOURNAL_OPEN_FRAME_COUNT);

describe('Journal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    collectedFacts.value = originalFacts;
    // activeJournalSection is a module-level signal (deliberately, so the
    // selected bookmark survives Journal unmounting/remounting on close) —
    // it must be reset between tests the same way collectedFacts is, or a
    // manual tab click in one test leaks into the next test's default.
    activeJournalSection.value = undefined;
    collectedCollectibleIds.value = new Set();
    vi.useRealTimers();
  });

  it('render-onMount-showsFirstAnimationFrame', () => {
    render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);

    expect(journalPage.book).toHaveAttribute(
      'src',
      '/sprites/journal_open_1.png',
    );
  });

  it('render-afterAnimationCompletes-showsFinalFrame', () => {
    render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);

    openBookAnimation();

    expect(journalPage.book).toHaveAttribute(
      'src',
      `/sprites/journal_open_${JOURNAL_OPEN_FRAME_COUNT}.png`,
    );
  });

  it('render-beforeAnimationCompletes-contentNotYetShown', () => {
    render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);

    expect(journalPage.factItem).not.toBeInTheDocument();
    expect(journalPage.emptyState).not.toBeInTheDocument();
  });

  it('render-withSkillsFactCollected-stillDefaultsToPersonalitySection', () => {
    // The journal always opens on 'personality' ("About Me") regardless of
    // what's been collected (e.g. Skills here), until the user picks a
    // bookmark themselves.
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

    render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
    openBookAnimation();

    expect(screen.getByText(currentCV.value.personality.name)).toBeInTheDocument();
    expect(journalPage.factItem).not.toBeInTheDocument();

    fireEvent.click(journalPage.bookmarkTabs.skills);
    const items = journalPage.factItems;
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('React ★★★★☆');
  });

  it('render-noCollectedFacts-defaultsToPersonalitySectionShowingBio', () => {
    // 'personality' is always non-empty (CVData.personality is required)
    // and first in JOURNAL_SECTION_ORDER, so it's the fallback default
    // section when nothing has been collected yet.
    collectedFacts.value = [];

    render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
    openBookAnimation();

    expect(screen.getByText(currentCV.value.personality.name)).toBeInTheDocument();
    expect(journalPage.emptyState).not.toBeInTheDocument();
    expect(journalPage.factItem).not.toBeInTheDocument();
  });

  it('render-persistedSectionNotInCurrentBookmarks-fallsBackToDefaultSection', () => {
    // 'activities' is a real SectionId but nonEmptySections() never returns
    // it (JournalSections.ts excludes it from JOURNAL_SECTION_ORDER) — this
    // simulates a stale/invalid persisted selection (e.g. from a previous
    // CV/locale) and asserts Journal falls back to defaultSection instead of
    // crashing or rendering nothing.
    collectedFacts.value = [];
    activeJournalSection.value = 'activities';

    render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
    openBookAnimation();

    expect(screen.getByText(currentCV.value.personality.name)).toBeInTheDocument();
    expect(journalPage.emptyState).not.toBeInTheDocument();
    expect(journalPage.factItem).not.toBeInTheDocument();
  });

  it('render-withNoFactsInActiveSection-showsEmptyStateAfterAnimation', () => {
    collectedFacts.value = [];

    render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
    openBookAnimation();
    fireEvent.click(journalPage.bookmarkTabs.experience);

    expect(journalPage.emptyState).toBeInTheDocument();
    expect(journalPage.factItem).not.toBeInTheDocument();
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

    render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
    openBookAnimation();

    fireEvent.click(journalPage.bookmarkTabs.skills);
    expect(journalPage.factItems).toHaveLength(1);

    fireEvent.click(journalPage.bookmarkTabs.experience);

    expect(journalPage.factItem).not.toBeInTheDocument();
    expect(journalPage.emptyState).toBeInTheDocument();
  });

  it('bookmarkTabClicked-thenJournalUnmountedAndRemounted-remembersTheSelection', () => {
    // Journal fully unmounts on close (PlatformerPage renders it as
    // `{journalOpen && <Journal .../>}`), so the selected section can only
    // survive a close/reopen if it lives in a signal rather than local
    // useState — this is exactly that persistence, per user request.
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

    const { unmount } = render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
    openBookAnimation();
    fireEvent.click(journalPage.bookmarkTabs.experience);
    expect(journalPage.emptyState).toBeInTheDocument();
    unmount();

    render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
    openBookAnimation();

    // Still on 'experience' (empty), not back to the skills-fact default.
    expect(journalPage.emptyState).toBeInTheDocument();
    expect(journalPage.factItem).not.toBeInTheDocument();
  });

  it('closeButtonClicked-immediately-hidesContentButDoesNotCallOnCloseYet', () => {
    collectedFacts.value = [];
    const onClose = vi.fn();

    render(<Journal onClose={onClose} closeRequested={false} onResetGame={() => {}} />);
    openBookAnimation();
    fireEvent.click(journalPage.closeButton);

    // The close animation plays in reverse before onClose actually fires —
    // content hides right away, but onClose is not called yet.
    expect(journalPage.queryCloseButton).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closeButtonClicked-duringCloseAnimation-playsFramesInReverse', () => {
    collectedFacts.value = [];

    render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
    openBookAnimation();
    fireEvent.click(journalPage.closeButton);

    advanceFrames(1);

    expect(journalPage.book).toHaveAttribute(
      'src',
      `/sprites/journal_open_${JOURNAL_OPEN_FRAME_COUNT - 1}.png`,
    );
  });

  it('closeButtonClicked-afterCloseAnimationCompletes-callsOnClose', () => {
    collectedFacts.value = [];
    const onClose = vi.fn();

    render(<Journal onClose={onClose} closeRequested={false} onResetGame={() => {}} />);
    openBookAnimation();
    fireEvent.click(journalPage.closeButton);

    advanceFrames(JOURNAL_OPEN_FRAME_COUNT);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closeRequestedPropBecomesTrue-whileOpen-startsSameReverseAnimationAsCloseButton', () => {
    collectedFacts.value = [];
    const onClose = vi.fn();

    const { rerender } = render(<Journal onClose={onClose} closeRequested={false} onResetGame={() => {}} />);
    openBookAnimation();
    expect(journalPage.closeButton).toBeInTheDocument();

    // Simulates the icon button / `J` key (PlatformerPage) requesting a
    // close, instead of clicking Journal's own in-book × button.
    rerender(<Journal onClose={onClose} closeRequested={true} onResetGame={() => {}} />);

    expect(journalPage.queryCloseButton).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    advanceFrames(JOURNAL_OPEN_FRAME_COUNT);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('render-beforeLastTwoFrames-bookmarkTabsNotYetShown', () => {
    render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);

    expect(journalPage.bookmarkTabs.root).not.toBeInTheDocument();

    // Still not shown one frame before the last two.
    advanceFrames(JOURNAL_OPEN_FRAME_COUNT - 3);
    expect(journalPage.bookmarkTabs.root).not.toBeInTheDocument();
  });

  it('render-onLastTwoFrames-bookmarkTabsShown', () => {
    render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);

    advanceFrames(JOURNAL_OPEN_FRAME_COUNT - 1);

    expect(journalPage.bookmarkTabs.root).toBeInTheDocument();
  });

  it('skillCategoryFact-rendered-showsCategoryNameAndSkillCount', () => {
    // A SkillCategoryFact (skills are collected as a whole category, not
    // individually) is a different `fact.data` shape
    // than the plain `Skill` used elsewhere in this file; formatJournalEntry
    // (entities/JournalEntry.ts) is what actually branches on it.
    collectedFacts.value = [
      {
        id: 'coin-backend',
        sectionId: 'skills',
        sectionLabel: 'Skills',
        data: {
          category: 'Backend',
          skills: [
            { name: 'C#', level: 90 },
            { name: '.NET', level: 85 },
          ],
        },
        sourceType: 'coin',
      },
    ];

    render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
    openBookAnimation();
    fireEvent.click(journalPage.bookmarkTabs.skills);

    expect(screen.getByText(/Backend/)).toBeInTheDocument();
    expect(screen.getByText(/C#/)).toBeInTheDocument();
    expect(screen.getByText(/\.NET/)).toBeInTheDocument();
  });

  describe('per-section counter', () => {
    it('sectionWithOneCollectedFact-showsCollectedOverSectionTotal', () => {
      const total = sectionTotal(currentCV.value, 'skills');
      collectedFacts.value = [
        {
          id: 'coin-frontend',
          sectionId: 'skills',
          sectionLabel: 'Skills',
          data: { category: 'Frontend', skills: [{ name: 'React', level: 80 }] },
          sourceType: 'coin',
        },
      ];

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();
      fireEvent.click(journalPage.bookmarkTabs.skills);

      expect(journalPage.sectionCounter).toHaveTextContent(`1 / ${total}`);
    });

    it('personalitySection-showsNoCounter', () => {
      collectedFacts.value = [];

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();

      expect(journalPage.sectionCounter).not.toBeInTheDocument();
    });
  });

  describe('empty state copy', () => {
    it('sectionWithNoCollectedFacts-showsSpecPlaceholderMessage', () => {
      collectedFacts.value = [];

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();
      fireEvent.click(journalPage.bookmarkTabs.experience);

      expect(journalPage.emptyState).toHaveTextContent(
        'No facts discovered yet — keep exploring!',
      );
    });
  });

  describe('grouped sections (languages)', () => {
    it('multipleFactsCollected-showsAllOfThemWithoutPaginationControls', () => {
      activeJournalSection.value = 'languages';
      collectedFacts.value = [
        {
          id: 'fruit-english',
          sectionId: 'languages',
          sectionLabel: 'Languages',
          data: { name: 'English', level: 100 },
          sourceType: 'coin',
        },
        {
          id: 'fruit-german',
          sectionId: 'languages',
          sectionLabel: 'Languages',
          data: { name: 'German', level: 80 },
          sourceType: 'coin',
        },
      ];

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();

      expect(journalPage.factItems).toHaveLength(2);
      // No visible page count — bookmarks alone indicate more content
      // exists.
      expect(journalPage.pageCounter).not.toBeInTheDocument();
      // Each language line carries its own star rating, same format as a
      // single Skill entry ("Name ★★★★☆").
      expect(screen.getByText(/English ★★★★★/)).toBeInTheDocument();
      expect(screen.getByText(/German ★★★★☆/)).toBeInTheDocument();
    });
  });

  describe('paginated sections (experience/projects/education/courses/certificates/skills)', () => {
    const experienceFacts: CollectedFact[] = [
      {
        id: 'exp-1',
        sectionId: 'experience',
        sectionLabel: 'Experience',
        data: { company: 'Acme Corp', role: 'Engineer', startDate: '2020-01', highlights: [] },
        sourceType: 'coin',
      },
      {
        id: 'exp-2',
        sectionId: 'experience',
        sectionLabel: 'Experience',
        data: { company: 'Startup Inc', role: 'Lead', startDate: '2018-01', highlights: [] },
        sourceType: 'coin',
      },
    ];

    it('sectionWithMultipleFacts-showsOnlyOneFactAtATime', () => {
      collectedFacts.value = experienceFacts;

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();
      fireEvent.click(journalPage.bookmarkTabs.experience);

      expect(journalPage.factItems).toHaveLength(1);
      expect(journalPage.pageCounter).not.toBeInTheDocument();
    });

    it('nextButtonClicked-advancesToTheNextFact', () => {
      collectedFacts.value = experienceFacts;

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();
      fireEvent.click(journalPage.bookmarkTabs.experience);
      fireEvent.click(journalPage.pageNext);

      expect(screen.getByText(/Startup Inc/)).toBeInTheDocument();
      expect(screen.queryByText(/Acme Corp/)).not.toBeInTheDocument();
    });

    it('switchingToAnotherSection-resetsPageBackToFirst', () => {
      collectedFacts.value = experienceFacts;

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();
      fireEvent.click(journalPage.bookmarkTabs.experience);
      fireEvent.click(journalPage.pageNext);
      expect(screen.getByText(/Startup Inc/)).toBeInTheDocument();

      fireEvent.click(journalPage.bookmarkTabs.personality);
      fireEvent.click(journalPage.bookmarkTabs.experience);

      expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
      expect(screen.queryByText(/Startup Inc/)).not.toBeInTheDocument();
    });

    it('nextPastTheLastPageOfTheWholeBook-wrapsAroundToTheFirstPage', () => {
      // Prev/Next walk the flattened whole-book sequence
      // (buildJournalPages), not just the active section, and wrap at both
      // ends instead of disabling — 'projects' (empty, no collected facts)
      // is the last non-empty section in JOURNAL_SECTION_ORDER, so its one
      // empty-state page is the book's last page.
      collectedFacts.value = experienceFacts;

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();
      fireEvent.click(journalPage.bookmarkTabs.projects);
      expect(journalPage.emptyState).toBeInTheDocument();

      fireEvent.click(journalPage.pageNext);

      // Wrapped to the book's very first page — personality (About Me).
      expect(screen.getByText(currentCV.value.personality.name)).toBeInTheDocument();
    });

    it('prevOnTheFirstPageOfTheWholeBook-wrapsAroundToTheLastPage', () => {
      collectedFacts.value = experienceFacts;

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();
      fireEvent.click(journalPage.bookmarkTabs.personality);

      fireEvent.click(journalPage.pagePrev);

      fireEvent.click(journalPage.bookmarkTabs.projects);
      // Still the same (only) page 'projects' has — proves Prev landed
      // somewhere in/before 'projects', the book's last section, not that
      // it did nothing.
      expect(journalPage.emptyState).toBeInTheDocument();
    });

    it('sectionWithExactlyOneFact-showsThatOneFactAndHasNoDisabledArrows', () => {
      // No disabled state — Prev/Next wrap around the whole book regardless
      // of how many pages the active section has.
      collectedFacts.value = [experienceFacts[0]];

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();
      fireEvent.click(journalPage.bookmarkTabs.experience);

      expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
      expect(journalPage.pagePrev).not.toBeDisabled();
      expect(journalPage.pageNext).not.toBeDisabled();
    });

    it('skillsSectionWithMultipleCategories-paginatesOneCategoryPerPageWithStarRatings', () => {
      // Skills behaves like the other long-entry sections (paginated one
      // entry — here, one category — per page), unlike Languages, per user
      // feedback: a category's skill list reads better one page at a time
      // than all categories crammed into one scrolling list.
      collectedFacts.value = [
        {
          id: 'coin-frontend',
          sectionId: 'skills',
          sectionLabel: 'Skills',
          data: { category: 'Frontend', skills: [{ name: 'React', level: 80 }] },
          sourceType: 'coin',
        },
        {
          id: 'coin-backend',
          sectionId: 'skills',
          sectionLabel: 'Skills',
          data: { category: 'Backend', skills: [{ name: 'Go', level: 100 }] },
          sourceType: 'coin',
        },
      ];

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();
      fireEvent.click(journalPage.bookmarkTabs.skills);

      expect(journalPage.factItems).toHaveLength(1);
      expect(screen.getByText(/Frontend/)).toBeInTheDocument();
      // Name and star rating render as separate flex-row cells (for
      // right-alignment, see Journal.tsx's `ratedItems` branch), not one
      // joined text node — assert each independently.
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('★★★★☆')).toBeInTheDocument();
      expect(screen.queryByText(/Backend/)).not.toBeInTheDocument();

      fireEvent.click(journalPage.pageNext);

      expect(screen.getByText(/Backend/)).toBeInTheDocument();
      expect(screen.getByText('Go')).toBeInTheDocument();
      expect(screen.getByText('★★★★★')).toBeInTheDocument();
      expect(screen.queryByText(/Frontend/)).not.toBeInTheDocument();
    });
  });

  describe('personality collectibles summary', () => {
    it('personalitySectionActive-showsCollectiblesSummary', () => {
      collectedFacts.value = [];

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();

      expect(journalPage.collectiblesSummary).toBeInTheDocument();
      expect(screen.getByText(/Coins/)).toBeInTheDocument();
    });

    it('render-aboutMePage-showsChestsRowInCollectiblesSummary', () => {
      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();

      expect(screen.getByTestId('journal-collectibles-summary')).toHaveTextContent(/Chests/);
    });

    it('oneSkillsFactCollected-summaryRowShowsCollectedOverPlacedCoinCount', () => {
      // The "About Me" summary's total is the number of coin markers
      // actually placed in the level (collectiblePlacements), not the raw
      // CVData skills count — see CollectiblesSummary.ts's doc comment. A
      // coin-pot block always counts too (it always drops a coin — see
      // CollectibleMapper.ts's mapCVDataToSkillFactPool doc comment) — same
      // formula Journal.tsx itself uses.
      const total =
        collectiblePlacements.value.filter((p) => p.spriteType === 'coin').length +
        blockPlacements.value.filter((b) => b.blockKind === 'coinPot').length;
      collectedFacts.value = [
        {
          id: 'coin-frontend',
          sectionId: 'skills',
          sectionLabel: 'Skills',
          data: { category: 'Frontend', skills: [{ name: 'React', level: 80 }] },
          sourceType: 'coin',
        },
      ];
      // The coins row's "collected" count is now an explicit override (see
      // Journal.tsx/CollectiblesSummary.ts) derived from
      // `collectedCollectibleIds` matching a real coin placement, not from
      // `collectedFacts` alone — under proportional fact pacing those are
      // different numbers whenever the coin count and skill-category count
      // differ (see CollectibleMapper.ts's mapCVDataToSkillFactPool doc
      // comment), so this test must mark an actual coin placement as
      // collected too, not just push a fact.
      collectedCollectibleIds.value = new Set([collectiblePlacements.value[0].id]);

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();
      fireEvent.click(journalPage.bookmarkTabs.personality);

      const summary = journalPage.collectiblesSummary;
      expect(summary).toHaveTextContent(`1 / ${total}`);
    });

    it('coinsTotal-includesEveryCoinPotBlock', () => {
      // Every coin-pot block counts toward the coins total, matching how
      // the PlatformerPage's coin counter popup works (Task 9) — a coin-pot
      // always drops a coin regardless of any fact (see
      // CollectibleMapper.ts's mapCVDataToSkillFactPool doc comment), so
      // there's no "with fact vs without" distinction left to make.
      //
      // Driven through a real `currentLayout` write rather than a
      // `vi.spyOn(blockPlacements, 'value', 'get')` getter override: the
      // coins total is now sourced from `levelTotals`, a `computed()` in
      // PlatformerState.ts, and a getter override never notifies a
      // `computed`'s dependents (it isn't a real signal write), so a
      // `levelTotals` already read once with the real placements would stay
      // permanently stale — see task-2-report.md for the reproduction. A
      // real `currentLayout` write is the same pattern
      // `PlatformerState.test.ts`'s `describe('marker-derived placements
      // react to currentLayout', ...)` block uses.
      try {
        // S spawn, one placed coin (C), two coin-pots (u, u) -> coins total = 3.
        currentLayout.value = ['SCuu', 'GGGG'];
        collectedFacts.value = [];
        collectedCollectibleIds.value = new Set();

        render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
        openBookAnimation();

        const summary = journalPage.collectiblesSummary;
        expect(summary).toHaveTextContent('0 / 3');
      } finally {
        currentLayout.value = LEVEL_1_LAYOUT;
      }
    });

    it('otherSectionActive-hidesCollectiblesSummary', () => {
      collectedFacts.value = [];

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();
      fireEvent.click(journalPage.bookmarkTabs.experience);

      expect(journalPage.collectiblesSummary).not.toBeInTheDocument();
    });

    it('enemyMarkerBeyondCourseCount-plainEnemyDoesNotInflateEnemiesTotal', () => {
      // Enemy placement is not capped at CVData's course count — a "plain"
      // enemy marker beyond that count has no `fact` (EnemyDef.fact is
      // optional) and must not count toward the Journal's "Enemies"
      // denominator, matching how the `fruits` row already filters block
      // placements down to fact-bearing ones.
      //
      // Driven through a real `currentLayout` write rather than a
      // `vi.spyOn(enemyPlacements, 'value', 'get')` getter override: the
      // enemies total is sourced from `levelTotals`, a `computed()` in
      // PlatformerState.ts, and a getter override never notifies a
      // `computed`'s dependents (it isn't a real signal write), so a
      // `levelTotals` already read once with the real placements (by an
      // earlier test in this describe block) stays permanently stale — see
      // task-2-report.md for the reproduction. A real `currentLayout` write
      // is the same pattern the sibling `coinsTotal-includesEveryCoinPotBlock`
      // test above uses. Here the layout carries far more green-slime (`E`)
      // markers than CVData has courses, so the excess placements are
      // guaranteed to be fact-less "plain" enemies (see EnemyMapper.ts's
      // placeQueue).
      try {
        const enemyMarkerCount = 20;
        currentLayout.value = ['S' + 'E'.repeat(enemyMarkerCount), 'G'.repeat(enemyMarkerCount + 1)];
        collectedFacts.value = [];

        render(<Journal onClose={() => {}} closeRequested={false} onResetGame={() => {}} />);
        openBookAnimation();

        // Derived from the real reactive placements, not hardcoded — so this
        // stays correct whenever CVData's course count changes.
        const expectedEnemiesTotal = enemyPlacements.value.filter((p) => p.fact).length;
        // Confirms the layout actually exercises the beyond-count case: if
        // every marker got a fact, the "plain enemy" scenario this test names
        // would go untested even though the assertion below still passed.
        expect(expectedEnemiesTotal).toBeLessThan(enemyMarkerCount);

        const summary = journalPage.collectiblesSummary;
        // Anchored so a substring of a different total (e.g. "1" inside "12")
        // can't satisfy the assertion — the unanchored regex this replaced is
        // half of why the old spy-based test went silently vacuous.
        expect(summary).toHaveTextContent(new RegExp(`Enemies 0 / ${expectedEnemiesTotal}(?!\\d)`));
      } finally {
        currentLayout.value = LEVEL_1_LAYOUT;
      }
    });
  });

  describe('Reset Game button', () => {
    // Everything the button actually does (clearing collected progress,
    // closing the journal immediately with no animation, and starting the
    // iris-in "starting again" transition) lives in PlatformerPage.tsx's
    // handleResetGameRequested (see PlatformerPage.test.tsx) — Journal only
    // forwards the click via the `onResetGame` prop.
    it('clicked-callsOnResetGameProp', () => {
      const onResetGame = vi.fn();
      collectedFacts.value = [];

      render(<Journal onClose={() => {}} closeRequested={false} onResetGame={onResetGame} />);
      openBookAnimation();
      fireEvent.click(journalPage.resetButton);

      expect(onResetGame).toHaveBeenCalledTimes(1);
    });

    it('clicked-doesNotCallOnCloseItself', () => {
      // Closing (immediate, no animation) is the parent's responsibility —
      // it unmounts Journal directly (`journalOpen` state) rather than
      // going through `onClose`/the reverse-close animation path the ×
      // button and icon/`J` use.
      const onClose = vi.fn();
      collectedFacts.value = [];

      render(<Journal onClose={onClose} closeRequested={false} onResetGame={() => {}} />);
      openBookAnimation();
      fireEvent.click(journalPage.resetButton);

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
