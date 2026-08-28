import { computed } from '@preact/signals-react';
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

/**
 * Whether the Platformer theme is unlocked in every theme switcher UI.
 * Persisted to localStorage under 'platformerPrototypeUnlocked', default
 * `false` — Platformer stays hidden until unlocked via the IDE theme's
 * "View" menu (`MenuBar.tsx`'s "Show \"Platformer\"" toggle), since
 * iterations 2/3 of its roadmap aren't done yet and it isn't meant to be
 * publicly discoverable.
 */
export const platformerPrototypeUnlocked = createLocalStorageSignal<boolean>(
  'platformerPrototypeUnlocked',
  false,
);

/**
 * Sets the unlock signal. Locking it back (`unlocked: false`) while
 * Platformer is the active theme also falls back to `'ide'` — otherwise the
 * visitor would be stranded on a theme no switcher UI lists anymore.
 */
export function setPlatformerPrototypeUnlocked(unlocked: boolean): void {
  platformerPrototypeUnlocked.value = unlocked;
  if (!unlocked && currentTheme.value === 'platformer') {
    currentTheme.value = 'ide';
  }
}

/**
 * The single source of truth every theme switcher UI (`ThemeSelect.tsx`'s
 * dropdown, the IDE theme's `SidebarSettings.tsx` radio list, and any
 * future one) should render from, instead of each independently
 * re-filtering `themes` by `platformerPrototypeUnlocked` — that duplication
 * is exactly what let the IDE sidebar keep showing Platformer unfiltered
 * after `ThemeSelect.tsx` was gated, since the two never shared the logic.
 */
export const visibleThemes = computed<Theme[]>(() =>
  platformerPrototypeUnlocked.value ? themes : themes.filter((t) => t.id !== 'platformer'),
);
