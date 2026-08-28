import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeSelect } from './ThemeSelect';
import { currentTheme, platformerPrototypeUnlocked } from '@/state/theme';

const originalTheme = currentTheme.value;
const originalUnlocked = platformerPrototypeUnlocked.value;

// The dropdown's options are only mounted once opened (Base UI Select
// portals its popup content), so every test must open it first.
const openDropdown = () => fireEvent.click(screen.getByRole('combobox'));

describe('ThemeSelect', () => {
  afterEach(() => {
    currentTheme.value = originalTheme;
    platformerPrototypeUnlocked.value = originalUnlocked;
  });

  it('platformerLocked-doesNotListPlatformerOption', () => {
    platformerPrototypeUnlocked.value = false;

    render(<ThemeSelect />);
    openDropdown();

    expect(screen.queryByRole('option', { name: /platformer/i })).not.toBeInTheDocument();
  });

  it('platformerUnlocked-listsPlatformerOption', () => {
    platformerPrototypeUnlocked.value = true;

    render(<ThemeSelect />);
    openDropdown();

    expect(screen.getByRole('option', { name: /platformer/i })).toBeInTheDocument();
  });

  it('platformerLocked-stillListsTheOtherThreeThemes', () => {
    platformerPrototypeUnlocked.value = false;

    render(<ThemeSelect />);
    openDropdown();

    expect(screen.getByRole('option', { name: /^ide$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /space/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /terminal/i })).toBeInTheDocument();
  });
});
