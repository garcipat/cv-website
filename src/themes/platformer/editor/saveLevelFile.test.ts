import { describe, it, expect, vi, afterEach } from 'vitest';
import { levelFileName, levelFileJson, downloadLevelFile, saveLevel } from './saveLevelFile';
import { SAVE_LEVEL_ENDPOINT } from './saveLevelEndpoint';
import { importLayout } from './importLayout';
import { exportLayout } from './exportLayout';
import { parseLevelModules } from '../level/levelRegistry';
import { SCRATCH_LAYOUT } from '../level/level';

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

describe('levelFileJson', () => {
  const grid = importLayout(SCRATCH_LAYOUT);

  it('holdsTheGivenNameAndTheExportedLayout', () => {
    expect(JSON.parse(levelFileJson('Cave Run', grid, []))).toEqual({
      name: 'Cave Run',
      layout: exportLayout(grid),
    });
  });

  it('isPrettyPrintedSoTheFileIsReadableInTheRepo', () => {
    expect(levelFileJson('Cave Run', grid, [])).toContain('\n  "name"');
  });

  it('endsWithANewline', () => {
    expect(levelFileJson('Cave Run', grid, []).endsWith('\n')).toBe(true);
  });

  // SC-012: a file the editor saved has to be a file the registry accepts.
  it('roundTripsBackThroughTheRegistryToAGridEqualToTheSavedOne', () => {
    const entries = parseLevelModules({
      './levels/cave-run.json': { default: JSON.parse(levelFileJson('Cave Run', grid, [])) },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Cave Run');
    expect(importLayout(entries[0].layout)).toEqual(grid);
  });
});

describe('levelFileJson — background field', () => {
  it('nonEmptyBackground-isIncludedInTheSerializedJson', () => {
    const json = levelFileJson('Cave', [['S']], [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }]);
    expect(JSON.parse(json)).toEqual({
      name: 'Cave',
      layout: ['S'],
      background: [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }],
    });
  });

  it('emptyBackground-isOmittedFromTheSerializedJson', () => {
    const json = levelFileJson('Plain', [['S']], []);
    expect(JSON.parse(json)).toEqual({ name: 'Plain', layout: ['S'] });
  });
});

describe('downloadLevelFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setUpObjectUrl = () => {
    const createObjectURL = vi.fn(() => 'blob:level');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    return { createObjectURL, revokeObjectURL };
  };

  it('clicksAnAnchorCarryingTheSlugifiedFilename', () => {
    setUpObjectUrl();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadLevelFile('Cave Run', importLayout(SCRATCH_LAYOUT), []);

    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('cave-run.json');
    expect(anchor.href).toContain('blob:level');
  });

  it('revokesTheObjectUrlItCreated', () => {
    const { createObjectURL, revokeObjectURL } = setUpObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadLevelFile('Cave Run', importLayout(SCRATCH_LAYOUT), []);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:level');
  });

  it('leavesNoAnchorBehindInTheDocument', () => {
    setUpObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadLevelFile('Cave Run', importLayout(SCRATCH_LAYOUT), []);

    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
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

  const grid = importLayout(SCRATCH_LAYOUT);

  it('devServerAccepts-postsTheSlugifiedFileNameAndContentsToTheWriteEndpoint', async () => {
    const fetchMock = stubFetch(okResponse('src/themes/platformer/level/levels/cave-run.json'));

    await saveLevel('Cave Run', grid, []);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SAVE_LEVEL_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      fileName: 'cave-run.json',
      contents: levelFileJson('Cave Run', grid, []),
    });
  });

  it('devServerAccepts-reportsTheWrittenPathAndDoesNotDownloadAnything', async () => {
    stubFetch(okResponse('src/themes/platformer/level/levels/cave-run.json'));
    const click = stubDownload();

    const result = await saveLevel('Cave Run', grid, []);

    expect(result).toEqual({
      written: true,
      path: 'src/themes/platformer/level/levels/cave-run.json',
    });
    expect(click).not.toHaveBeenCalled();
  });

  it('endpointMissing-fallsBackToDownloadingTheFile', async () => {
    stubFetch({ ok: false, status: 404, json: () => Promise.resolve({}) });
    const click = stubDownload();

    const result = await saveLevel('Cave Run', grid, []);

    expect(result.written).toBe(false);
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('cave-run.json');
  });

  it('fetchThrows-fallsBackToDownloadingTheFile', async () => {
    stubFetch(new Error('offline'));
    const click = stubDownload();

    const result = await saveLevel('Cave Run', grid, []);

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

    const result = await saveLevel('Cave Run', grid, []);

    expect(result).toEqual({
      written: false,
      error: 'fileName must be a slugified name ending in .json',
    });
    expect(click).toHaveBeenCalledOnce();
  });
});
