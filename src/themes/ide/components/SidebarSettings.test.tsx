import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { currentTheme, platformerPrototypeUnlocked } from '@/state/theme';
import { currentLocale } from '@/state/locale';
import { SidebarSettings } from './SidebarSettings';
import { sidebarSettingsPage } from './SidebarSettings.page';

beforeEach(() => {
  currentTheme.value = 'ide';
  currentLocale.value = 'en';
  platformerPrototypeUnlocked.value = false;
});

describe('SidebarSettings', () => {
  it('renders-THEMES-radio-group-with-three-options-IDE-selected-platformerLocked', () => {
    render(<SidebarSettings />);
    expect(sidebarSettingsPage.themeRadio.ide).toBeChecked();
    expect(sidebarSettingsPage.themeRadio.space).toBeInTheDocument();
    expect(sidebarSettingsPage.themeRadio.terminal).toBeInTheDocument();
    // Platformer stays out of this list until unlocked (see
    // state/theme.ts's `visibleThemes`) — same source ThemeSelect.tsx uses.
    expect(sidebarSettingsPage.themeRadio.platformer).not.toBeInTheDocument();
  });

  it('platformerUnlocked-rendersAllFourThemeOptions', () => {
    platformerPrototypeUnlocked.value = true;

    render(<SidebarSettings />);

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
