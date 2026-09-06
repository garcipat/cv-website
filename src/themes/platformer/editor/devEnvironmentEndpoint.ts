/**
 * Constant shared by the editor and the dev-server plugin that answers this
 * route (`vite/devEnvironmentPlugin.ts`). Deliberately free of imports: the
 * plugin runs in Node inside `vite.config.ts`, so anything reachable from here
 * must be safe for both runtimes — same rule `saveLevelEndpoint.ts` follows.
 *
 * Double-underscored to mark it as tooling rather than anything the real site
 * serves. It exists only while `npm run dev` is running, and that absence is
 * the whole signal: a built site cannot answer it, so the editor knows not to
 * offer controls that need a dev server.
 */
export const DEV_ENVIRONMENT_ENDPOINT = '/__dev-environment';
