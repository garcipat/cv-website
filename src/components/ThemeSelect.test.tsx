import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeSelect } from './ThemeSelect';
import { currentTheme } from '@/state/theme';

const originalTheme = currentTheme.value;

// The dropdown's options are only mounted once opened (Base UI Select
// portals its popup content), so every test must open it first.
const openDropdown = () => fireEvent.click(screen.getByRole('combobox'));

describe('ThemeSelect', () => {
  afterEach(() => {
    currentTheme.value = originalTheme;
  });

  it('open-listsAllFourThemesIncludingPlatformer', () => {
    render(<ThemeSelect />);
    openDropdown();

    expect(screen.getByRole('option', { name: /^ide$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /space/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /terminal/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /platformer/i })).toBeInTheDocument();
  });

  it('open-doesNotAlignItemWithTrigger', () => {
    render(<ThemeSelect />);
    openDropdown();

    const popup = document.querySelector('[data-slot="select-content"]');
    expect(popup).toHaveAttribute('data-align-trigger', 'false');
  });

  it('opened-callsOnOpenChangeWithTrue', () => {
    const onOpenChange = vi.fn();
    render(<ThemeSelect onOpenChange={onOpenChange} />);

    openDropdown();

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('closedAfterOpen-callsOnOpenChangeWithFalse', () => {
    const onOpenChange = vi.fn();
    render(<ThemeSelect onOpenChange={onOpenChange} />);
    openDropdown();

    fireEvent.click(screen.getByRole('option', { name: /^ide$/i }));

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
