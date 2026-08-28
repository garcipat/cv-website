import { screen } from '@testing-library/react';

export const sunPage = {
  get root() {
    return screen.queryByTestId('sun');
  },
};
