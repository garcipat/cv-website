import { screen } from '@testing-library/react';

const menu = (id: string) => ({
  get trigger() {
    return screen.getByTestId(`menu-trigger-${id}`);
  },
  get dropdown() {
    return screen.getByTestId(`menu-dropdown-${id}`);
  },
});

export const menuBarPage = {
  view: menu('view'),
  get backdrop() {
    return screen.getByTestId('menu-backdrop');
  },
};
