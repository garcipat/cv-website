import { describe, it, expect, vi, afterEach } from 'vitest';
import { levelFileName, saveLevel } from './saveLevelFile';
import { SAVE_LEVEL_ENDPOINT } from './saveLevelEndpoint';
import { layoutFileJson } from './layoutFileJson';
import { SCRATCH_LAYOUT } from '../../level/level';

describe('levelFileName', () => {
  it('plainName-getsAJsonExtension', () => {
    expect(levelFileName('cave')).toBe('cave.json');
  });

  it('mixedCaseNameWithSpaces-isLowercasedAndHyphenated', () => {
    expect(levelFileName('Cave Run Two')).toBe('cave-run-two.json');
  });

  it('punctuationAndRunsOfSeparators-collapseToSingleHyphens', () => {
    expect(levelFileName('Cave!! __ Run??  Two')).toBe('cave-run-two.json');
  });

  it('leadingAndTrailingSeparators-areTrimmed', () => {
    expect(levelFileName('  -- cave run -- ')).toBe('cave-run.json');
  });

  it('nameThatSlugifiesToNothing-fallsBackToLevel', () => {
    expect(levelFileName('!!!')).toBe('level.json');
  });

  it('emptyName-fallsBackToLevel', () => {
    expect(levelFileName('')).toBe('level.json');
  });

  it('digitsAreKept', () => {
    expect(levelFileName('Level 2')).toBe('level-2.json');
  });
});

describe('saveLevel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const stubDownload = () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:level'),
      revokeObjectURL: vi.fn(),
    });
    return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  };

  const stubFetch = (response: Partial<Response> | Error) => {
    const fetchMock = vi.fn(() =>
      response instanceof Error ? Promise.reject(response) : Promise.resolve(response as Response),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  const okResponse = (path: string): Partial<Response> => ({
    ok: true,
    json: () => Promise.resolve({ path }),
  });

  const layout = SCRATCH_LAYOUT;

  it('devServerAccepts-postsTheSlugifiedFileNameAndContentsToTheWriteEndpoint', async () => {
    const fetchMock = stubFetch(okResponse('src/themes/platformer/level/levels/cave-run.json'));

    await saveLevel('Cave Run', layout, []);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SAVE_LEVEL_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      fileName: 'cave-run.json',
      contents: layoutFileJson('Cave Run', layout, []),
    });
  });

  it('devServerAccepts-reportsTheWrittenPathAndDoesNotDownloadAnything', async () => {
    stubFetch(okResponse('src/themes/platformer/level/levels/cave-run.json'));
    const click = stubDownload();

    const result = await saveLevel('Cave Run', layout, []);

    expect(result).toEqual({
      written: true,
      path: 'src/themes/platformer/level/levels/cave-run.json',
    });
    expect(click).not.toHaveBeenCalled();
  });

  it('endpointMissing-fallsBackToDownloadingTheFile', async () => {
    stubFetch({ ok: false, status: 404, json: () => Promise.resolve({}) });
    const click = stubDownload();

    const result = await saveLevel('Cave Run', layout, []);

    expect(result.written).toBe(false);
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('cave-run.json');
  });

  it('fetchThrows-fallsBackToDownloadingTheFile', async () => {
    stubFetch(new Error('offline'));
    const click = stubDownload();

    const result = await saveLevel('Cave Run', layout, []);

    expect(result.written).toBe(false);
    expect(click).toHaveBeenCalledOnce();
  });

  it('endpointRejectsTheLevel-reportsTheServersReasonAndStillDownloads', async () => {
    stubFetch({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'fileName must be a slugified name ending in .json' }),
    });
    const click = stubDownload();

    const result = await saveLevel('Cave Run', layout, []);

    expect(result).toEqual({
      written: false,
      error: 'fileName must be a slugified name ending in .json',
    });
    expect(click).toHaveBeenCalledOnce();
  });
});
