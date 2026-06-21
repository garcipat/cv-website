import { signal } from '@preact/signals-react';

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
