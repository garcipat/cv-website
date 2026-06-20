import { createLocalStorageSignal } from '@/lib/utils';

/**
 * Valid theme identifiers.
 */
export type ThemeId = 'ide' | 'space' | 'terminal';

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
  { id: 'space', label: '3D Room' },
  { id: 'terminal', label: 'Retro Terminal' },
];

/**
 * The currently active theme signal.
 * - Persisted to localStorage under the key 'theme'.
 * - Writing to .value automatically syncs to `document.documentElement.dataset.theme`.
 * - Default: 'ide'.
 * - Invalid localStorage values fall back to 'ide'.
 */
export const activeTheme = createLocalStorageSignal<ThemeId>('theme', 'ide');

// Sync the signal value to the DOM whenever it changes
activeTheme.subscribe((id: ThemeId) => {
  document.documentElement.dataset.theme = id;
});
