import { render, screen, fireEvent } from '@testing-library/react';
import { Journal } from './Journal';
import { collectedFacts } from '../PlatformerState';
import type { CollectedFact } from '../types';

const originalFacts = collectedFacts.value;

describe('Journal', () => {
  afterEach(() => {
    collectedFacts.value = originalFacts;
  });

  it('render-withCollectedFacts-listsEachFactsSectionLabel', () => {
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

    const items = screen.getAllByTestId('journal-fact-item');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Skills');
    expect(items[0]).toHaveTextContent('React');
  });

  it('render-withNoCollectedFacts-showsEmptyState', () => {
    collectedFacts.value = [];

    render(<Journal onClose={() => {}} />);

    expect(screen.getByTestId('journal-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('journal-fact-item')).not.toBeInTheDocument();
  });

  it('closeButtonClicked-always-callsOnClose', () => {
    collectedFacts.value = [];
    const onClose = vi.fn();

    render(<Journal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('journal-close-button'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
