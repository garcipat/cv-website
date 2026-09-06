import type { Plugin } from 'vite';
import { DEV_ENVIRONMENT_ENDPOINT } from '../src/themes/platformer/editor/devEnvironmentEndpoint';

/**
 * Answers a fixed `{ isDev: true }` on `DEV_ENVIRONMENT_ENDPOINT`, so the Level
 * Editor can tell whether it is running behind `npm run dev` and hide the
 * controls that need a dev server to do anything (Save, Save Blueprint).
 *
 * `apply: 'serve'` is the entire mechanism, not an optimization: a built site
 * has no such route, so the editor's ping there fails and the controls stay
 * hidden. Nothing about the running site's behavior depends on this answer —
 * it gates editor affordances only.
 */
export const devEnvironmentPlugin = (): Plugin => ({
  name: 'platformer-dev-environment',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(DEV_ENVIRONMENT_ENDPOINT, (_req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ isDev: true }));
    });
  },
});
