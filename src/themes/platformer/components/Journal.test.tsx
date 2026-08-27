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
