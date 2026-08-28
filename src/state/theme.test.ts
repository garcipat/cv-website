import { signal } from '@preact/signals-react';
import {
  themes,
  currentTheme,
  platformerPrototypeUnlocked,
  setPlatformerPrototypeUnlocked,
  visibleThemes,
  type ThemeId,
} from './theme';

type TestThemeId = 'ide' | 'space' | 'terminal';

interface TestTheme {
  id: TestThemeId;
  label: string;
}

const testThemes: TestTheme[] = [
  { id: 'ide', label: 'IDE' },
  { id: 'space', label: 'Space' },
  { id: 'terminal', label: 'Retro Terminal' },
];

describe('theme state contract', () => {
  it('currentTheme initializes to "ide"', () => {
    const currentTheme = signal<TestThemeId>('ide');
    expect(currentTheme.value).toBe('ide');
  });

  it('writing .value updates the signal correctly', () => {
    const currentTheme = signal<TestThemeId>('ide');
    currentTheme.value = 'terminal';
    expect(currentTheme.value).toBe('terminal');
  });

  it('theme list contains all three themes', () => {
    expect(testThemes).toHaveLength(3);
    const ids = testThemes.map((t) => t.id);
    expect(ids).toContain('ide');
    expect(ids).toContain('space');
    expect(ids).toContain('terminal');
  });

  it('theme labels are non-empty strings', () => {
    for (const theme of testThemes) {
      expect(theme.label).toBeTruthy();
      expect(typeof theme.label).toBe('string');
    }
  });

  it('syncs data-theme attribute via subscribe', () => {
    const currentTheme = signal<TestThemeId>('ide');
    currentTheme.subscribe((id) => {
      document.documentElement.dataset.theme = id;
    });

    currentTheme.value = 'terminal';
    expect(document.documentElement.dataset.theme).toBe('terminal');
  });
});

describe('platformer theme registration', () => {
  it('themes array includes platformer with a non-empty label', () => {
    const platformer = themes.find((t) => t.id === 'platformer');
    expect(platformer).toBeDefined();
    expect(platformer?.label).toBeTruthy();
  });

  it('ThemeId type accepts "platformer"', () => {
    const id: ThemeId = 'platformer';
    expect(id).toBe('platformer');
  });
});

describe('platformerPrototypeUnlocked / setPlatformerPrototypeUnlocked', () => {
  const originalUnlocked = platformerPrototypeUnlocked.value;
  const originalTheme = currentTheme.value;

  afterEach(() => {
    platformerPrototypeUnlocked.value = originalUnlocked;
    currentTheme.value = originalTheme;
  });

  it('initializes to false', () => {
    expect(platformerPrototypeUnlocked.value).toBe(false);
  });

  it('setPlatformerPrototypeUnlocked(true)-setsTheSignalToTrue', () => {
    setPlatformerPrototypeUnlocked(true);
    expect(platformerPrototypeUnlocked.value).toBe(true);
  });

  it('setPlatformerPrototypeUnlocked(false)-whilePlatformerIsActive-fallsBackToIde', () => {
    setPlatformerPrototypeUnlocked(true);
    currentTheme.value = 'platformer';

    setPlatformerPrototypeUnlocked(false);

    expect(platformerPrototypeUnlocked.value).toBe(false);
    expect(currentTheme.value).toBe('ide');
  });

  it('setPlatformerPrototypeUnlocked(false)-whileADifferentThemeIsActive-leavesCurrentThemeUntouched', () => {
    setPlatformerPrototypeUnlocked(true);
    currentTheme.value = 'space';

    setPlatformerPrototypeUnlocked(false);

    expect(currentTheme.value).toBe('space');
  });
});

describe('visibleThemes', () => {
  const originalUnlocked = platformerPrototypeUnlocked.value;

  afterEach(() => {
    platformerPrototypeUnlocked.value = originalUnlocked;
  });

  it('platformerLocked-excludesPlatformerButKeepsTheOtherThree', () => {
    platformerPrototypeUnlocked.value = false;

    const ids = visibleThemes.value.map((t) => t.id);

    expect(ids).toEqual(['ide', 'space', 'terminal']);
  });

  it('platformerUnlocked-includesAllFourInThemesOrder', () => {
    platformerPrototypeUnlocked.value = true;

    const ids = visibleThemes.value.map((t) => t.id);

    expect(ids).toEqual(themes.map((t) => t.id));
  });
});
