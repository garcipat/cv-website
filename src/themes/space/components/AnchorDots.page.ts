import { screen } from '@testing-library/react';

export const anchorDotsPage = {
  get nav() {
    return screen.queryByTestId('anchor-dots-nav');
  },
  get dots() {
    return screen.queryAllByTestId(/^anchor-dot-/);
  },
  get about() {
    return screen.getByTestId('anchor-dot-about');
  },
  get experience() {
    return screen.getByTestId('anchor-dot-experience');
  },
  get projects() {
    return screen.getByTestId('anchor-dot-projects');
  },
  get skills() {
    return screen.getByTestId('anchor-dot-skills');
  },
  get education() {
    return screen.getByTestId('anchor-dot-education');
  },
  get courses() {
    return screen.getByTestId('anchor-dot-courses');
  },
  get certificates() {
    return screen.getByTestId('anchor-dot-certificates');
  },
  get contact() {
    return screen.getByTestId('anchor-dot-contact');
  },
};
