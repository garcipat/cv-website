import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { currentTheme } from '@/state/theme';
import { currentLocale } from '@/state/locale';
import { SidebarSettings } from './SidebarSettings';

beforeEach(() => {
  currentTheme.value = 'ide';
  currentLocale.value = 'en';
});

describe('SidebarSettings', () => {
  it('renders-THEMES-radio-group-with-four-options-IDE-selected', () => {
    render(<SidebarSettings />);
    const radios = screen.getAllByRole('radio');
    const themeRadios = radios.filter((r) => r.getAttribute('name') === 'theme');
    expect(themeRadios).toHaveLength(4);
    const ideRadio = themeRadios.find((r) => r.getAttribute('value') === 'ide');
    expect(ideRadio).toBeChecked();
  });

  it('renders-LANGUAGE-radio-group-with-EN-DE-options', () => {
    render(<SidebarSettings />);
    const radios = screen.getAllByRole('radio');
    const langRadios = radios.filter((r) => r.getAttribute('name') === 'locale');
    expect(langRadios).toHaveLength(2);
    const enRadio = langRadios.find((r) => r.getAttribute('value') === 'en');
    expect(enRadio).toBeChecked();
  });

  it('clicking-theme-radio-changes-currentTheme-value', async () => {
    const user = userEvent.setup();
    render(<SidebarSettings />);
    const radios = screen.getAllByRole('radio');
    const terminalRadio = radios.find(
      (r) => r.getAttribute('name') === 'theme' && r.getAttribute('value') === 'terminal',
    );
    expect(terminalRadio).toBeDefined();
    await user.click(terminalRadio!);
    expect(currentTheme.value).toBe('terminal');
  });

  it('clicking-language-radio-changes-currentLocale', async () => {
    const user = userEvent.setup();
    render(<SidebarSettings />);
    const radios = screen.getAllByRole('radio');
    const deRadio = radios.find(
      (r) => r.getAttribute('name') === 'locale' && r.getAttribute('value') === 'de',
    );
    expect(deRadio).toBeDefined();
    await user.click(deRadio!);
    expect(currentLocale.value).toBe('de');
  });
});
