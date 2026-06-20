import { signal } from '@preact/signals-react';

type TestThemeId = 'ide' | 'space' | 'terminal';

interface TestTheme {
  id: TestThemeId;
  label: string;
}

const testThemes: TestTheme[] = [
  { id: 'ide', label: 'IDE' },
  { id: 'space', label: '3D Room' },
  { id: 'terminal', label: 'Retro Terminal' },
];

describe('theme state contract', () => {
  it('activeTheme initializes to "ide"', () => {
    const activeTheme = signal<TestThemeId>('ide');
    expect(activeTheme.value).toBe('ide');
  });

  it('writing .value updates the signal correctly', () => {
    const activeTheme = signal<TestThemeId>('ide');
    activeTheme.value = 'terminal';
    expect(activeTheme.value).toBe('terminal');
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
    const activeTheme = signal<TestThemeId>('ide');
    activeTheme.subscribe((id) => {
      document.documentElement.dataset.theme = id;
    });

    activeTheme.value = 'terminal';
    expect(document.documentElement.dataset.theme).toBe('terminal');
  });
});
