import { signal } from '@preact/signals-react';

/**
 * The current in-app "route" — just `window.location.pathname`, kept as a
 * signal so `App.tsx` can react to client-side navigation (the Level
 * Editor's Try button, the Platformer game's Editor button) without a real
 * browser reload. Seeded once at module load from whatever the browser's
 * address bar already shows; a real reload always re-seeds it fresh, which
 * is intentional — see `navigateTo`'s doc comment below.
 */
export const currentPath = signal<string>(window.location.pathname);

/**
 * Navigates client-side to `path`: pushes it onto the browser history (so
 * the address bar and back/forward both behave normally) and updates
 * `currentPath` synchronously, WITHOUT ever triggering a real page
 * reload — unlike `window.location.href = path` or a plain
 * `<a href>` navigation, both of which would re-run every module's
 * top-level code, resetting any in-memory (non-localStorage) signal state.
 * That distinction matters for `level.ts`'s `currentLayout`: the Level
 * Editor's Try button relies on setting `currentLayout.value` and then
 * landing on a still-running app instance that actually observes the new
 * value, rather than a fresh reload that would silently discard it back to
 * the hardcoded default before the game ever reads it.
 */
export function navigateTo(path: string): void {
  history.pushState(null, '', path);
  currentPath.value = path;
}

// Registered once at module load (not per-component) so back/forward
// navigation updates `currentPath` regardless of which component is
// currently mounted.
window.addEventListener('popstate', () => {
  currentPath.value = window.location.pathname;
});
