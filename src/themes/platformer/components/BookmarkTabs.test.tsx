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
