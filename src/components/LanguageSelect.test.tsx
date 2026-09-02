import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
});

async function setupEnglish() {
  await vi.resetModules();
  await import('@/state/locale');
  const { changeLocale } = await import('@/state/locale');
  changeLocale('en');
  await vi.resetModules();
  const { LanguageSelect } = await import('./LanguageSelect');
  return { LanguageSelect };
}

describe('LanguageSelect', () => {
  it('renders the current locale name in the trigger', async () => {
    const { LanguageSelect } = await setupEnglish();
    render(<LanguageSelect />);
    expect(screen.getByRole('combobox')).toHaveTextContent('English');
  });

  it('switches locale to German when Deutsch is selected', async () => {
    const { LanguageSelect } = await setupEnglish();
    render(<LanguageSelect />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getAllByText('Deutsch')[0]);
    expect(screen.getByRole('combobox')).toHaveTextContent('Deutsch');
  });

  it('shows translated language names after switching locale', async () => {
    const { LanguageSelect } = await setupEnglish();
    render(<LanguageSelect />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getAllByText('Deutsch')[0]);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getAllByText('Englisch').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Deutsch').length).toBeGreaterThanOrEqual(1);
  });

  it('open-doesNotAlignItemWithTrigger', async () => {
    const { LanguageSelect } = await setupEnglish();
    render(<LanguageSelect />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox'));

    const popup = document.querySelector('[data-slot="select-content"]');
    expect(popup).toHaveAttribute('data-align-trigger', 'false');
  });
});
