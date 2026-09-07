import { screen } from '@testing-library/react';

// Getters, not spread-in values: every accessor must re-query the DOM at
// call time, so `menu(...)` results are composed by delegation rather than
// `{ ...menu('view') }` — a spread would evaluate each getter once at module
// load, before anything is rendered.
const menu = (id: string) => ({
  get trigger() {
    return screen.getByTestId(`menu-trigger-${id}`);
  },
  get dropdown() {
    return screen.getByTestId(`menu-dropdown-${id}`);
  },
});

const viewMenu = menu('view');

export const menuBarPage = {
  view: {
    get trigger() {
      return viewMenu.trigger;
    },
    get dropdown() {
      return viewMenu.dropdown;
    },
    get levelEditorItem() {
      return screen.getByTestId('menu-item-openLevelEditor');
    },
  },
  get backdrop() {
    return screen.getByTestId('menu-backdrop');
  },
};
