import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { levelWritePlugin } from './levelWritePlugin';
import {
  LEVELS_FOLDER,
  SAVE_LEVEL_ENDPOINT,
} from '../src/themes/platformer/editor/saveLevelEndpoint';

const VALID_CONTENTS = `${JSON.stringify({ name: 'Cave Run', layout: ['.S.', 'GGG'] }, null, 2)}\n`;

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => void,
) => void | Promise<void>;

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'level-plugin-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Mounts the plugin against a stub dev server and hands back its handler. */
const mountPlugin = () => {
  const mounted: { path?: string; handler?: Handler } = {};
  const server = {
    config: { root },
    middlewares: {
      use: (path: string, handler: Handler) => {
        mounted.path = path;
        mounted.handler = handler;
      },
    },
  };

  const plugin = levelWritePlugin();
  (plugin.configureServer as (s: typeof server) => void)(server);

  return mounted;
};

const fakeResponse = () => {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 0,
    body: '',
    setHeader: (key: string, value: string) => {
      headers[key] = value;
    },
    end: (text?: string) => {
      res.body = text ?? '';
    },
    headers,
  };
  return res;
};

const request = (method: string, body?: string) => {
  const req = Readable.from(body === undefined ? [] : [body]) as unknown as IncomingMessage;
  req.method = method;
  req.url = '/';
  return req;
};

const send = async (method: string, body?: string) => {
  const { handler } = mountPlugin();
  const res = fakeResponse();
  const next = vi.fn();

  await handler!(request(method, body), res as unknown as ServerResponse, next);

  return { res, next };
};

describe('levelWritePlugin', () => {
  it('appliesOnlyWhileTheDevServerIsServingNotToABuild', () => {
    expect(levelWritePlugin().apply).toBe('serve');
  });

  it('isNamed', () => {
    expect(levelWritePlugin().name).toBe('platformer-level-write');
  });

  it('mountsItsMiddlewareOnTheSaveEndpoint', () => {
    expect(mountPlugin().path).toBe(SAVE_LEVEL_ENDPOINT);
  });

  it('post-writesTheLevelIntoTheLevelsFolderAndReportsItsPath', async () => {
    const { res } = await send(
      'POST',
      JSON.stringify({ fileName: 'cave-run.json', contents: VALID_CONTENTS }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ path: `${LEVELS_FOLDER}cave-run.json` });
    expect(readFileSync(join(root, LEVELS_FOLDER, 'cave-run.json'), 'utf8')).toBe(VALID_CONTENTS);
  });

  it('post-respondsAsJson', async () => {
    const { res } = await send(
      'POST',
      JSON.stringify({ fileName: 'cave-run.json', contents: VALID_CONTENTS }),
    );

    expect(res.headers['Content-Type']).toContain('application/json');
  });

  it('post-withAFileNameThatEscapesTheLevelsFolder-isRejectedWithoutWriting', async () => {
    const { res } = await send(
      'POST',
      JSON.stringify({ fileName: '../../evil.json', contents: VALID_CONTENTS }),
    );

    expect(res.statusCode).toBe(400);
    expect(existsSync(join(root, 'evil.json'))).toBe(false);
  });

  it('post-withAnUnparseableEnvelope-isRejected', async () => {
    const { res } = await send('POST', '{ not json');

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBeTruthy();
  });

  it('post-withNoBody-isRejected', async () => {
    const { res } = await send('POST');

    expect(res.statusCode).toBe(400);
  });

  it('get-isPassedOnToTheNextMiddlewareRatherThanAnswered', async () => {
    const { res, next } = await send('GET');

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });
});
