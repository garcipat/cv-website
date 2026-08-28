import { screen } from '@testing-library/react';

export const bookmarkTabsPage = {
  get root() {
    return screen.queryByTestId('bookmark-tabs');
  },
  get personality() {
    return screen.getByTestId('bookmark-tab-personality');
  },
  get experience() {
    return screen.getByTestId('bookmark-tab-experience');
  },
  get education() {
    return screen.getByTestId('bookmark-tab-education');
  },
  get courses() {
    return screen.getByTestId('bookmark-tab-courses');
  },
  get certificates() {
    return screen.getByTestId('bookmark-tab-certificates');
  },
  get skills() {
    return screen.getByTestId('bookmark-tab-skills');
  },
  get languages() {
    return screen.getByTestId('bookmark-tab-languages');
  },
  get projects() {
    return screen.getByTestId('bookmark-tab-projects');
  },
};
