import { render, screen, fireEvent, act } from '@testing-library/react';
import { Journal } from './Journal';
import { currentCV } from '@/state/locale';
import { collectedFacts, activeJournalSection } from '../PlatformerState';
import { JOURNAL_OPEN_FRAME_COUNT, JOURNAL_OPEN_FRAME_INTERVAL_MS } from '../entities/JournalAnimation';
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
    vi.useRealTimers();
  });

  it('render-onMount-showsFirstAnimationFrame', () => {
    render(<Journal onClose={() => {}} closeRequested={false} />);

    expect(screen.getByTestId('journal-book')).toHaveAttribute(
      'src',
      '/sprites/journal_open_1.png',
    );
  });

  it('render-afterAnimationCompletes-showsFinalFrame', () => {
    render(<Journal onClose={() => {}} closeRequested={false} />);

    openBookAnimation();

    expect(screen.getByTestId('journal-book')).toHaveAttribute(
      'src',
      `/sprites/journal_open_${JOURNAL_OPEN_FRAME_COUNT}.png`,
    );
  });

  it('render-beforeAnimationCompletes-contentNotYetShown', () => {
    render(<Journal onClose={() => {}} closeRequested={false} />);

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

    render(<Journal onClose={() => {}} closeRequested={false} />);
    openBookAnimation();

    expect(screen.getByTestId('bookmark-tab-skills')).toBeInTheDocument();
    const items = screen.getAllByTestId('journal-fact-item');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('React ★★★★☆');
  });

  it('render-noCollectedFacts-defaultsToPersonalitySectionShowingBio', () => {
    // 'personality' is always non-empty (CVData.personality is required)
    // and first in JOURNAL_SECTION_ORDER, so it's the fallback default
    // section when nothing has been collected yet.
    collectedFacts.value = [];

    render(<Journal onClose={() => {}} closeRequested={false} />);
    openBookAnimation();

    expect(screen.getByText(currentCV.value.personality.name)).toBeInTheDocument();
    expect(screen.queryByTestId('journal-empty-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('journal-fact-item')).not.toBeInTheDocument();
  });

  it('render-persistedSectionNotInCurrentBookmarks-fallsBackToDefaultSection', () => {
    // 'activities' is a real SectionId but nonEmptySections() never returns
    // it (JournalSections.ts excludes it from JOURNAL_SECTION_ORDER) — this
    // simulates a stale/invalid persisted selection (e.g. from a previous
    // CV/locale) and asserts Journal falls back to defaultSection instead of
    // crashing or rendering nothing.
    collectedFacts.value = [];
    activeJournalSection.value = 'activities';

    render(<Journal onClose={() => {}} closeRequested={false} />);
    openBookAnimation();

    expect(screen.getByText(currentCV.value.personality.name)).toBeInTheDocument();
    expect(screen.queryByTestId('journal-empty-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('journal-fact-item')).not.toBeInTheDocument();
  });

  it('render-withNoFactsInActiveSection-showsEmptyStateAfterAnimation', () => {
    collectedFacts.value = [];

    render(<Journal onClose={() => {}} closeRequested={false} />);
    openBookAnimation();
    fireEvent.click(screen.getByTestId('bookmark-tab-experience'));

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

    render(<Journal onClose={() => {}} closeRequested={false} />);
    openBookAnimation();
    expect(screen.getAllByTestId('journal-fact-item')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('bookmark-tab-experience'));

    expect(screen.queryByTestId('journal-fact-item')).not.toBeInTheDocument();
    expect(screen.getByTestId('journal-empty-state')).toBeInTheDocument();
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

    const { unmount } = render(<Journal onClose={() => {}} closeRequested={false} />);
    openBookAnimation();
    fireEvent.click(screen.getByTestId('bookmark-tab-experience'));
    expect(screen.getByTestId('journal-empty-state')).toBeInTheDocument();
    unmount();

    render(<Journal onClose={() => {}} closeRequested={false} />);
    openBookAnimation();

    // Still on 'experience' (empty), not back to the skills-fact default.
    expect(screen.getByTestId('journal-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('journal-fact-item')).not.toBeInTheDocument();
  });

  it('closeButtonClicked-immediately-hidesContentButDoesNotCallOnCloseYet', () => {
    collectedFacts.value = [];
    const onClose = vi.fn();

    render(<Journal onClose={onClose} closeRequested={false} />);
    openBookAnimation();
    fireEvent.click(screen.getByTestId('journal-close-button'));

    // The close animation plays in reverse before onClose actually fires —
    // content hides right away, but onClose is not called yet.
    expect(screen.queryByTestId('journal-close-button')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closeButtonClicked-duringCloseAnimation-playsFramesInReverse', () => {
    collectedFacts.value = [];

    render(<Journal onClose={() => {}} closeRequested={false} />);
    openBookAnimation();
    fireEvent.click(screen.getByTestId('journal-close-button'));

    advanceFrames(1);

    expect(screen.getByTestId('journal-book')).toHaveAttribute(
      'src',
      `/sprites/journal_open_${JOURNAL_OPEN_FRAME_COUNT - 1}.png`,
    );
  });

  it('closeButtonClicked-afterCloseAnimationCompletes-callsOnClose', () => {
    collectedFacts.value = [];
    const onClose = vi.fn();

    render(<Journal onClose={onClose} closeRequested={false} />);
    openBookAnimation();
    fireEvent.click(screen.getByTestId('journal-close-button'));

    advanceFrames(JOURNAL_OPEN_FRAME_COUNT);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closeRequestedPropBecomesTrue-whileOpen-startsSameReverseAnimationAsCloseButton', () => {
    collectedFacts.value = [];
    const onClose = vi.fn();

    const { rerender } = render(<Journal onClose={onClose} closeRequested={false} />);
    openBookAnimation();
    expect(screen.getByTestId('journal-close-button')).toBeInTheDocument();

    // Simulates the icon button / `J` key (PlatformerPage) requesting a
    // close, instead of clicking Journal's own in-book × button.
    rerender(<Journal onClose={onClose} closeRequested={true} />);

    expect(screen.queryByTestId('journal-close-button')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    advanceFrames(JOURNAL_OPEN_FRAME_COUNT);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('render-beforeLastTwoFrames-bookmarkTabsNotYetShown', () => {
    render(<Journal onClose={() => {}} closeRequested={false} />);

    expect(screen.queryByTestId('bookmark-tabs')).not.toBeInTheDocument();

    // Still not shown one frame before the last two.
    advanceFrames(JOURNAL_OPEN_FRAME_COUNT - 3);
    expect(screen.queryByTestId('bookmark-tabs')).not.toBeInTheDocument();
  });

  it('render-onLastTwoFrames-bookmarkTabsShown', () => {
    render(<Journal onClose={() => {}} closeRequested={false} />);

    advanceFrames(JOURNAL_OPEN_FRAME_COUNT - 1);

    expect(screen.getByTestId('bookmark-tabs')).toBeInTheDocument();
  });

  it('skillCategoryFact-rendered-showsCategoryNameAndSkillCount', () => {
    // A SkillCategoryFact (roadmap step 12 — skills are collected as a
    // whole category, not individually) is a different `fact.data` shape
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

    render(<Journal onClose={() => {}} closeRequested={false} />);
    openBookAnimation();

    expect(screen.getByText(/Backend/)).toBeInTheDocument();
    expect(screen.getByText(/C#/)).toBeInTheDocument();
    expect(screen.getByText(/\.NET/)).toBeInTheDocument();
  });
});
