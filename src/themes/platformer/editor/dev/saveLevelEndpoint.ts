/**
 * Constants shared by the browser-side editor and the dev-server plugin that
 * writes its saved levels to disk (`vite/writeLevelFile.ts`). Deliberately
 * free of imports: the plugin runs in Node inside `vite.config.ts`, so
 * anything reachable from here must be safe for both runtimes.
 */

/** Where saved level files live, relative to the repository root. */
export const LEVELS_FOLDER = 'src/themes/platformer/level/levels/';

/**
 * Dev-server route the editor POSTs a saved level to. Double-underscored to
 * mark it as tooling rather than anything the real site serves — it exists
 * only while `npm run dev` is running (the plugin is `apply: 'serve'`).
 */
export const SAVE_LEVEL_ENDPOINT = '/__save-level';
