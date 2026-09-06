/**
 * Constants shared by the browser-side editor and the dev-server plugin that
 * writes its saved blueprints to disk (`vite/writeBlueprintFile.ts`).
 * Deliberately free of imports: the plugin runs in Node inside
 * `vite.config.ts`, so anything reachable from here must be safe for both
 * runtimes. Exact counterpart of `saveLevelEndpoint.ts`.
 */

/** Where saved blueprint files live, relative to the repository root. */
export const BLUEPRINTS_FOLDER = 'src/themes/platformer/level/blueprints/';

/**
 * Dev-server route the editor POSTs a saved blueprint to. Double-underscored
 * to mark it as tooling rather than anything the real site serves — it exists
 * only while `npm run dev` is running (the plugin is `apply: 'serve'`).
 */
export const SAVE_BLUEPRINT_ENDPOINT = '/__save-blueprint';
