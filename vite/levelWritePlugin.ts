import type { Plugin } from 'vite';
import type { IncomingMessage } from 'node:http';
import { writeLevelFile } from './writeLevelFile';
import { SAVE_LEVEL_ENDPOINT } from '../src/themes/platformer/editor/saveLevelEndpoint';

const readBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
};

/**
 * Lets the Level Editor's Save button write straight into the folder the
 * level registry reads (`src/themes/platformer/level/levels/`), rather than
 * leaving the developer to move a downloaded file there by hand.
 *
 * `apply: 'serve'` keeps this out of every build: the deployed site has no
 * such route and stays a pure static bundle, which is also why the editor
 * falls back to a plain download when the endpoint isn't there (see
 * `editor/saveLevelFile.ts`). All validation lives in `writeLevelFile`.
 */
export const levelWritePlugin = (): Plugin => ({
  name: 'platformer-level-write',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(SAVE_LEVEL_ENDPOINT, async (req, res, next) => {
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
          ? writeLevelFile(server.config.root, request as { fileName: unknown; contents: unknown })
          : { status: 400, body: { error: 'body must be JSON with fileName and contents' } };

      res.statusCode = result.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result.body));
    });
  },
});
