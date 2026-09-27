import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadFile, saveFile } from './saveFile';

const CONTENTS = '{\n  "name": "Cave"\n}\n';

describe('downloadFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const setUpObjectUrl = () => {
    const createObjectURL = vi.fn(() => 'blob:saved');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    return { createObjectURL, revokeObjectURL };
  };

  it('clicksAnAnchorCarryingTheGivenFilename', () => {
    setUpObjectUrl();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadFile('cave-run.json', CONTENTS);

    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('cave-run.json');
    expect(anchor.href).toContain('blob:saved');
  });

  it('revokesTheObjectUrlAndLeavesNoAnchorBehind', () => {
    const { createObjectURL, revokeObjectURL } = setUpObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadFile('cave-run.json', CONTENTS);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:saved');
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });
});

describe('saveFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const stubDownload = () =>
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  const stubFetch = (response: Partial<Response> | Error) => {
    const fetchMock = vi.fn(() =>
      response instanceof Error ? Promise.reject(response) : Promise.resolve(response as Response),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('devServerAccepts-postsTheFileNameAndContentsAndReportsThePathWithoutDownloading', async () => {
    const fetchMock = stubFetch({ ok: true, json: () => Promise.resolve({ path: 'levels/cave.json' }) });
    const click = stubDownload();

    const result = await saveFile({ endpoint: '/__save-level', fileName: 'cave.json', contents: CONTENTS });

    expect(result).toEqual({ written: true, path: 'levels/cave.json' });
    expect(click).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/__save-level');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ fileName: 'cave.json', contents: CONTENTS });
  });

  it('devServerRefuses-downloadsAndReportsTheReason', async () => {
    stubFetch({ ok: false, json: () => Promise.resolve({ error: 'outside the folder' }) });
    const click = stubDownload();

    const result = await saveFile({ endpoint: '/__save-level', fileName: 'cave.json', contents: CONTENTS });

    expect(result).toEqual({ written: false, error: 'outside the folder' });
    expect(click).toHaveBeenCalledOnce();
  });

  it('aResponseWithoutAPath-downloadsAndReportsNotWritten', async () => {
    stubFetch({ ok: true, json: () => Promise.resolve({}) });
    const click = stubDownload();

    const result = await saveFile({ endpoint: '/__save-level', fileName: 'cave.json', contents: CONTENTS });

    expect(result).toEqual({ written: false });
    expect(click).toHaveBeenCalledOnce();
  });

  it('aThrownFetch-downloadsAndReportsNotWritten', async () => {
    stubFetch(new Error('no dev server'));
    const click = stubDownload();

    const result = await saveFile({ endpoint: '/__save-level', fileName: 'cave.json', contents: CONTENTS });

    expect(result).toEqual({ written: false });
    expect(click).toHaveBeenCalledOnce();
  });
});
