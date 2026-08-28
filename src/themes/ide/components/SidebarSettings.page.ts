import { screen } from '@testing-library/react';

export const sidebarSettingsPage = {
  themeRadio: {
    get ide() {
      return screen.getByTestId('theme-radio-ide');
    },
    get space() {
      return screen.getByTestId('theme-radio-space');
    },
    get terminal() {
      return screen.getByTestId('theme-radio-terminal');
    },
    get platformer() {
      return screen.queryByTestId('theme-radio-platformer');
    },
  },
  localeRadio: {
    get en() {
      return screen.getByTestId('locale-radio-en');
    },
    get de() {
      return screen.getByTestId('locale-radio-de');
    },
  },
};
