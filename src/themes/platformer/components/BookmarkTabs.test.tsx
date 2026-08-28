import { render, fireEvent } from '@testing-library/react';
import { BookmarkTabs } from './BookmarkTabs';
import { bookmarkTabsPage } from './BookmarkTabs.page';

describe('BookmarkTabs', () => {
  it('render-withSections-rendersOneTabPerSection', () => {
    render(
      <BookmarkTabs
        sections={['experience', 'skills', 'projects']}
        activeSection="skills"
        onSelect={() => {}}
      />,
    );

    expect(bookmarkTabsPage.experience).toBeInTheDocument();
    expect(bookmarkTabsPage.skills).toBeInTheDocument();
    expect(bookmarkTabsPage.projects).toBeInTheDocument();
  });

  it('render-anySection-showsSectionIconOnEveryTab', () => {
    render(
      <BookmarkTabs sections={['experience', 'skills']} activeSection="skills" onSelect={() => {}} />,
    );

    // Text labels were hard to read rotated on a narrow tab (user feedback)
    // — tabs show an icon instead, on both active and inactive tabs.
    expect(bookmarkTabsPage.experience).toHaveTextContent('🏢');
    expect(bookmarkTabsPage.skills).toHaveTextContent('💡');
  });

  it('inactiveTabClicked-always-callsOnSelectWithThatSection', () => {
    const onSelect = vi.fn();
    render(
      <BookmarkTabs sections={['experience', 'skills']} activeSection="skills" onSelect={onSelect} />,
    );

    fireEvent.click(bookmarkTabsPage.experience);

    expect(onSelect).toHaveBeenCalledWith('experience');
  });

  it('activeTabClicked-still-callsOnSelectWithSameSection', () => {
    const onSelect = vi.fn();
    render(
      <BookmarkTabs sections={['experience', 'skills']} activeSection="skills" onSelect={onSelect} />,
    );

    fireEvent.click(bookmarkTabsPage.skills);

    expect(onSelect).toHaveBeenCalledWith('skills');
  });
});
