import { createLocalStorageSignal } from '@/lib/utils';

/**
 * Valid theme identifiers.
 */
export type ThemeId = 'ide' | 'space' | 'terminal' | 'platformer';

/**
 * Metadata describing a theme for UI display.
 */
export interface Theme {
  id: ThemeId;
  label: string;
}

/**
 * All available themes.
 */
export const themes: Theme[] = [
  { id: 'ide', label: 'IDE' },
  { id: 'space', label: 'Space' },
  { id: 'terminal', label: 'Retro Terminal' },
  { id: 'platformer', label: 'Platformer' },
];

/**
 * The currently active theme signal.
 * - Persisted to localStorage under the key 'theme'.
 * - Writing to .value automatically syncs to `document.documentElement.dataset.theme`.
 * - Default: 'ide'.
 * - Invalid localStorage values fall back to 'ide'.
 */
export const currentTheme = createLocalStorageSignal<ThemeId>('theme', 'ide');

// Sync the signal value to the DOM whenever it changes
currentTheme.subscribe((id: ThemeId) => {
  document.documentElement.dataset.theme = id;
});
