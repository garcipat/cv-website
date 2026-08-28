import { screen } from '@testing-library/react';
import { bookmarkTabsPage } from './BookmarkTabs.page';

export const journalPage = {
  bookmarkTabs: bookmarkTabsPage,
  get root() {
    return screen.queryByTestId('platformer-journal');
  },
  get book() {
    return screen.getByTestId('journal-book');
  },
  get closeButton() {
    return screen.getByTestId('journal-close-button');
  },
  get queryCloseButton() {
    return screen.queryByTestId('journal-close-button');
  },
  get resetButton() {
    return screen.getByTestId('journal-reset-button');
  },
  get sectionCounter() {
    return screen.queryByTestId('journal-section-counter');
  },
  get pageCounter() {
    return screen.queryByTestId('journal-page-counter');
  },
  get pagePrev() {
    return screen.getByTestId('journal-page-prev');
  },
  get pageNext() {
    return screen.getByTestId('journal-page-next');
  },
  get emptyState() {
    return screen.queryByTestId('journal-empty-state');
  },
  get factItem() {
    return screen.queryByTestId('journal-fact-item');
  },
  get factItems() {
    return screen.queryAllByTestId('journal-fact-item');
  },
  get collectiblesSummary() {
    return screen.queryByTestId('journal-collectibles-summary');
  },
};
