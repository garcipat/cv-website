import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  blueprintId,
  blueprintFileName,
  blueprintFileJson,
  downloadBlueprintFile,
  saveBlueprint,
} from './saveBlueprintFile';
import { SAVE_BLUEPRINT_ENDPOINT } from './saveBlueprintEndpoint';

const LAYOUT = ['#G#'];

describe('blueprintId', () => {
  it('nameWithSpacesAndCaps-slugsToLowercaseHyphens', () => {
    expect(blueprintId('Cave Room Two')).toBe('cave-room-two');
  });

  it('nameWithNothingSlugWorthy-fallsBackToBlueprint', () => {
    expect(blueprintId('!!!')).toBe('blueprint');
  });

  it('nameThatSlugsToTheBlankEntrysId-isDisambiguated', () => {
    // BLANK_BLUEPRINT.id is 'new' and the save dialog pre-fills that name, so
    // an un-renamed save would otherwise write new.json and shadow the
    // dropdown's own blank entry forever.
    expect(blueprintId('new')).toBe('new-1');
    expect(blueprintId('New')).toBe('new-1');
  });
});

describe('blueprintFileName', () => {
  it('plainName-getsAJsonExtension', () => {
    expect(blueprintFileName('cave')).toBe('cave.json');
  });

  it('mixedCaseNameWithSpaces-isLowercasedAndHyphenated', () => {
    expect(blueprintFileName('Cave Room Two')).toBe('cave-room-two.json');
  });

  it('punctuationAndRunsOfSeparators-collapseToSingleHyphens', () => {
    expect(blueprintFileName('Cave!! __ Room??  Two')).toBe('cave-room-two.json');
  });

  it('leadingAndTrailingSeparators-areTrimmed', () => {
    expect(blueprintFileName('  -- cave room -- ')).toBe('cave-room.json');
  });

  it('emptyName-fallsBackToBlueprint', () => {
    expect(blueprintFileName('')).toBe('blueprint.json');
  });

  it('isAlwaysItsOwnRegistryIdPlusJson', () => {
    // The registry derives an id from the filename stem, so these two can
    // never be allowed to drift apart.
    expect(blueprintFileName('Cave Room')).toBe(`${blueprintId('Cave Room')}.json`);
  });
});

describe('blueprintFileJson', () => {
  it('holdsTheGivenNameAndLayout', () => {
    expect(JSON.parse(blueprintFileJson('Cave Room', LAYOUT, []))).toEqual({
      name: 'Cave Room',
      layout: LAYOUT,
    });
  });

  it('isPrettyPrintedSoTheFileIsReadableInTheRepo', () => {
    expect(blueprintFileJson('Cave Room', LAYOUT, [])).toContain('\n  "name"');
  });

  it('endsWithANewline', () => {
    expect(blueprintFileJson('Cave Room', LAYOUT, []).endsWith('\n')).toBe(true);
  });

  it('nonEmptyBackground-isIncludedInTheSerializedJson', () => {
    const json = blueprintFileJson('Cave Room', LAYOUT, [
      { pieceId: 'dirtColumnTop1x1', col: 0, row: 0 },
    ]);

    expect(JSON.parse(json)).toEqual({
      name: 'Cave Room',
      layout: LAYOUT,
      background: [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }],
    });
  });

  it('emptyBackground-isOmittedFromTheSerializedJson', () => {
    expect(JSON.parse(blueprintFileJson('Plain', LAYOUT, []))).toEqual({
      name: 'Plain',
      layout: LAYOUT,
    });
  });

  it('connectionPointCharacters-surviveSerializationUntouched', () => {
    // Step 44b's '+' is an ordinary layout character; the file format has to
    // carry it, since Part 2 reads connection points back out of `layout`.
    expect(JSON.parse(blueprintFileJson('Room', ['#+#'], [])).layout).toEqual(['#+#']);
  });
});

describe('downloadBlueprintFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const setUpObjectUrl = () => {
    const createObjectURL = vi.fn(() => 'blob:blueprint');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    return { createObjectURL, revokeObjectURL };
  };

  it('clicksAnAnchorCarryingTheSlugifiedFilename', () => {
    setUpObjectUrl();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlueprintFile('Cave Room', LAYOUT, []);

    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('cave-room.json');
    expect(anchor.href).toContain('blob:blueprint');
  });

  it('revokesTheObjectUrlItCreated', () => {
    const { createObjectURL, revokeObjectURL } = setUpObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlueprintFile('Cave Room', LAYOUT, []);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:blueprint');
  });

  it('leavesNoAnchorBehindInTheDocument', () => {
    setUpObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlueprintFile('Cave Room', LAYOUT, []);

    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });
});

describe('saveBlueprint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const stubDownload = () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:blueprint'),
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

  it('devServerAccepts-postsTheSlugifiedFileNameAndContentsToTheWriteEndpoint', async () => {
    const fetchMock = stubFetch(
      okResponse('src/themes/platformer/level/blueprints/cave-room.json'),
    );

    await saveBlueprint('Cave Room', LAYOUT, []);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SAVE_BLUEPRINT_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      fileName: 'cave-room.json',
      contents: blueprintFileJson('Cave Room', LAYOUT, []),
    });
  });

  it('devServerAccepts-reportsTheWrittenPathAndDoesNotDownloadAnything', async () => {
    stubFetch(okResponse('src/themes/platformer/level/blueprints/cave-room.json'));
    const click = stubDownload();

    const result = await saveBlueprint('Cave Room', LAYOUT, []);

    expect(result).toEqual({
      written: true,
      path: 'src/themes/platformer/level/blueprints/cave-room.json',
    });
    expect(click).not.toHaveBeenCalled();
  });

  it('endpointMissing-fallsBackToDownloadingTheFile', async () => {
    stubFetch({ ok: false, status: 404, json: () => Promise.resolve({}) });
    const click = stubDownload();

    const result = await saveBlueprint('Cave Room', LAYOUT, []);

    expect(result.written).toBe(false);
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('cave-room.json');
  });

  it('fetchThrows-fallsBackToDownloadingTheFile', async () => {
    stubFetch(new Error('offline'));
    const click = stubDownload();

    const result = await saveBlueprint('Cave Room', LAYOUT, []);

    expect(result.written).toBe(false);
    expect(click).toHaveBeenCalledOnce();
  });

  it('endpointRejectsTheBlueprint-reportsTheServersReasonAndStillDownloads', async () => {
    stubFetch({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'fileName must be a slugified name ending in .json' }),
    });
    const click = stubDownload();

    const result = await saveBlueprint('Cave Room', LAYOUT, []);

    expect(result).toEqual({
      written: false,
      error: 'fileName must be a slugified name ending in .json',
    });
    expect(click).toHaveBeenCalledOnce();
  });
});
