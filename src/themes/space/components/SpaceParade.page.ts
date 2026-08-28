import { screen, within } from '@testing-library/react';

export const spaceParadePage = {
  get root() {
    return screen.queryByTestId('space-parade');
  },
  // Some tests render more than one <SpaceParade> in the same test (e.g. to
  // compare two independent renders), which makes the global `screen`
  // queries ambiguous — scope the lookup to one render's container instead.
  within(container: HTMLElement) {
    return within(container).queryByTestId('space-parade');
  },
};
