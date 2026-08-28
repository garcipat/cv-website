import { screen } from '@testing-library/react';

export const nebulaPage = {
  get root() {
    return screen.queryByTestId('nebula');
  },
  get blobs() {
    return screen.queryAllByTestId('nebula-blob');
  },
};
