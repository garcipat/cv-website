import { render, screen, fireEvent } from '@testing-library/react';
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

// Base UI Select portals its popup, so every test must open it first.
// `fireEvent.click` on the trigger reliably opens it and fires `onOpenChange`
// (the same pattern ThemeSelect.test.tsx uses). Picking an item goes through
// `userEvent` with its pointer-events guard disabled, since the positioner's
// `pointer-events` comes from CSS classes jsdom doesn't apply.
const openDropdown = () => fireEvent.click(screen.getByRole('combobox'));
const clickOption = (name: string) =>
  userEvent.setup({ pointerEventsCheck: 0 }).click(screen.getByRole('option', { name }));

describe('LanguageSelect', () => {
  it('renders the current locale name in the trigger', async () => {
    const { LanguageSelect } = await setupEnglish();
    render(<LanguageSelect />);
    expect(screen.getByRole('combobox')).toHaveTextContent('English');
  });

  it('switches locale to German when Deutsch is selected', async () => {
    const { LanguageSelect } = await setupEnglish();
    render(<LanguageSelect />);
    openDropdown();
    await clickOption('Deutsch');
    expect(screen.getByRole('combobox')).toHaveTextContent('Deutsch');
  });

  it('shows translated language names after switching locale', async () => {
    const { LanguageSelect } = await setupEnglish();
    render(<LanguageSelect />);
    openDropdown();
    await clickOption('Deutsch');
    openDropdown();
    expect(screen.getAllByText('Englisch').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Deutsch').length).toBeGreaterThanOrEqual(1);
  });

  it('open-doesNotAlignItemWithTrigger', async () => {
    const { LanguageSelect } = await setupEnglish();
    render(<LanguageSelect />);
    openDropdown();

    const popup = document.querySelector('[data-slot="select-content"]');
    expect(popup).toHaveAttribute('data-align-trigger', 'false');
  });

  it('opened-callsOnOpenChangeWithTrue', async () => {
    const { LanguageSelect } = await setupEnglish();
    const onOpenChange = vi.fn();
    render(<LanguageSelect onOpenChange={onOpenChange} />);

    openDropdown();

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('closedAfterOpen-callsOnOpenChangeWithFalse', async () => {
    const { LanguageSelect } = await setupEnglish();
    const onOpenChange = vi.fn();
    render(<LanguageSelect onOpenChange={onOpenChange} />);
    openDropdown();

    await clickOption('Deutsch');

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
