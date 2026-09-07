import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { currentTheme } from '@/state/theme';
import { currentLocale } from '@/state/locale';
import { SidebarSettings } from './SidebarSettings';
import { sidebarSettingsPage } from './SidebarSettings.page';

beforeEach(() => {
  currentTheme.value = 'ide';
  currentLocale.value = 'en';
});

describe('SidebarSettings', () => {
  it('renders-THEMES-radio-group-with-all-four-options-IDE-selected', () => {
    render(<SidebarSettings />);
    expect(sidebarSettingsPage.themeRadio.ide).toBeChecked();
    expect(sidebarSettingsPage.themeRadio.space).toBeInTheDocument();
    expect(sidebarSettingsPage.themeRadio.terminal).toBeInTheDocument();
    expect(sidebarSettingsPage.themeRadio.platformer).toBeInTheDocument();
  });

  it('renders-LANGUAGE-radio-group-with-EN-DE-options', () => {
    render(<SidebarSettings />);
    expect(sidebarSettingsPage.localeRadio.en).toBeChecked();
    expect(sidebarSettingsPage.localeRadio.de).toBeInTheDocument();
  });

  it('clicking-theme-radio-changes-currentTheme-value', async () => {
    const user = userEvent.setup();
    render(<SidebarSettings />);
    await user.click(sidebarSettingsPage.themeRadio.terminal);
    expect(currentTheme.value).toBe('terminal');
  });

  it('clicking-language-radio-changes-currentLocale', async () => {
    const user = userEvent.setup();
    render(<SidebarSettings />);
    await user.click(sidebarSettingsPage.localeRadio.de);
    expect(currentLocale.value).toBe('de');
  });
});
