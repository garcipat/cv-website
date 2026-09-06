import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { devEnvironmentPlugin } from './devEnvironmentPlugin';
import { DEV_ENVIRONMENT_ENDPOINT } from '../src/themes/platformer/editor/devEnvironmentEndpoint';

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => void,
) => void | Promise<void>;

const mountPlugin = () => {
  const mounted: { path?: string; handler?: Handler } = {};
  const server = {
    config: { root: '/tmp' },
    middlewares: {
      use: (path: string, handler: Handler) => {
        mounted.path = path;
        mounted.handler = handler;
      },
    },
  };

  const plugin = devEnvironmentPlugin();
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

const send = async (method: string) => {
  const { handler } = mountPlugin();
  const req = Readable.from([]) as unknown as IncomingMessage;
  req.method = method;
  req.url = '/';
  const res = fakeResponse();
  const next = vi.fn();

  await handler!(req, res as unknown as ServerResponse, next);

  return { res, next };
};

describe('devEnvironmentPlugin', () => {
  it('appliesOnlyWhileTheDevServerIsServingNotToABuild', () => {
    // The whole mechanism: a built site cannot answer this route, which is how
    // the editor knows to hide its dev-server-backed controls there.
    expect(devEnvironmentPlugin().apply).toBe('serve');
  });

  it('isNamed', () => {
    expect(devEnvironmentPlugin().name).toBe('platformer-dev-environment');
  });

  it('mountsItsMiddlewareOnTheDevEnvironmentEndpoint', () => {
    expect(mountPlugin().path).toBe(DEV_ENVIRONMENT_ENDPOINT);
  });

  it('get-answersIsDevTrueAsJson', async () => {
    const { res } = await send('GET');

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ isDev: true });
    expect(res.headers['Content-Type']).toContain('application/json');
  });

  it('anyOtherMethod-isAnsweredTooRatherThanFallingThrough', async () => {
    const { res, next } = await send('POST');

    expect(next).not.toHaveBeenCalled();
    expect(JSON.parse(res.body)).toEqual({ isDev: true });
  });
});
