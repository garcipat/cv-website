import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isDevEnvironmentSignal, probeDevEnvironment } from './devEnvironment';
import { DEV_ENVIRONMENT_ENDPOINT } from './devEnvironmentEndpoint';

const stubFetch = (response: Partial<Response> | Error) => {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response as Response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

beforeEach(() => {
  isDevEnvironmentSignal.value = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
  isDevEnvironmentSignal.value = false;
});

describe('isDevEnvironmentSignal', () => {
  it('beforeAnyProbe-isFalseSoAStaticSiteNeverShowsDevOnlyControls', () => {
    expect(isDevEnvironmentSignal.value).toBe(false);
  });
});

describe('probeDevEnvironment', () => {
  it('endpointAnswersIsDevTrue-setsTheSignalAndResolvesTrue', async () => {
    const fetchMock = stubFetch({ ok: true, json: () => Promise.resolve({ isDev: true }) });

    await expect(probeDevEnvironment()).resolves.toBe(true);
    expect(isDevEnvironmentSignal.value).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(DEV_ENVIRONMENT_ENDPOINT);
  });

  it('noRouteAtAll-leavesTheSignalFalse', async () => {
    stubFetch({ ok: false, status: 404, json: () => Promise.resolve({}) });

    await expect(probeDevEnvironment()).resolves.toBe(false);
    expect(isDevEnvironmentSignal.value).toBe(false);
  });

  it('builtSiteAnsweringIndexHtml-leavesTheSignalFalse', async () => {
    // A static host answers an unknown path with the SPA shell and a 200, so
    // `ok` proves nothing — the JSON parse is what fails, and must be caught.
    stubFetch({ ok: true, json: () => Promise.reject(new SyntaxError('Unexpected token <')) });

    await expect(probeDevEnvironment()).resolves.toBe(false);
    expect(isDevEnvironmentSignal.value).toBe(false);
  });

  it('routeAnsweringSomethingElse-leavesTheSignalFalse', async () => {
    stubFetch({ ok: true, json: () => Promise.resolve({ isDev: 'yes' }) });

    await expect(probeDevEnvironment()).resolves.toBe(false);
    expect(isDevEnvironmentSignal.value).toBe(false);
  });

  it('fetchThrows-leavesTheSignalFalseRatherThanRejecting', async () => {
    stubFetch(new Error('offline'));

    await expect(probeDevEnvironment()).resolves.toBe(false);
    expect(isDevEnvironmentSignal.value).toBe(false);
  });

  it('aFailedProbe-neverClearsASignalAnEarlierSuccessfulProbeSet', async () => {
    // Write-only-on-success: the ping can prove a dev server is there, never
    // that one is absent, and a transient failure must not hide the Save
    // controls mid-session.
    isDevEnvironmentSignal.value = true;
    stubFetch(new Error('offline'));

    await probeDevEnvironment();

    expect(isDevEnvironmentSignal.value).toBe(true);
  });
});
