import type { Plugin } from 'vite';
import type { IncomingMessage } from 'node:http';
import { writeBlueprintFile } from './writeBlueprintFile';
import { SAVE_BLUEPRINT_ENDPOINT } from '../src/themes/platformer/editor/saveBlueprintEndpoint';

const readBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
};

/**
 * Lets the Level Editor's Save Blueprint button write straight into the folder
 * the blueprint registry reads (`src/themes/platformer/level/blueprints/`),
 * rather than leaving the developer to move a downloaded file there by hand —
 * the blueprint counterpart of `levelWritePlugin.ts`.
 *
 * `apply: 'serve'` keeps this out of every build: the deployed site has no such
 * route and stays a pure static bundle, which is why the editor hides its Save
 * controls there entirely (see `editor/devEnvironment.ts`) and, if one is
 * somehow reached anyway, falls back to a plain download. All validation lives
 * in `writeBlueprintFile`.
 */
export const blueprintWritePlugin = (): Plugin => ({
  name: 'platformer-blueprint-write',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(SAVE_BLUEPRINT_ENDPOINT, async (req, res, next) => {
      if (req.method !== 'POST') {
        next();
        return;
      }

      let request: unknown;
      try {
        request = JSON.parse(await readBody(req));
      } catch {
        request = null;
      }

      const result =
        request !== null && typeof request === 'object'
          ? writeBlueprintFile(
              server.config.root,
              request as { fileName: unknown; contents: unknown },
            )
          : { status: 400, body: { error: 'body must be JSON with fileName and contents' } };

      res.statusCode = result.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result.body));
    });
  },
});
