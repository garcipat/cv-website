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

  it('render-anySection-showsSectionIconOnEveryTab', () => {
    render(
      <BookmarkTabs sections={['experience', 'skills']} activeSection="skills" onSelect={() => {}} />,
    );

    // Text labels were hard to read rotated on a narrow tab (user feedback)
    // — tabs show an icon instead, on both active and inactive tabs.
    expect(screen.getByTestId('bookmark-tab-experience')).toHaveTextContent('🏢');
    expect(screen.getByTestId('bookmark-tab-skills')).toHaveTextContent('💡');
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
