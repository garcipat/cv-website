import { screen } from '@testing-library/react';

export const circleParadePage = {
  get stage() {
    return screen.queryByTestId('circle-parade-stage');
  },
};
