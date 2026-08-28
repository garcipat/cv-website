import { screen } from '@testing-library/react';

export const floatingControlsPage = {
  get root() {
    return screen.queryByTestId('floating-controls');
  },
};
