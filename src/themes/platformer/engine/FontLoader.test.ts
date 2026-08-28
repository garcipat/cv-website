import { loadFont } from './FontLoader';

class MockFontFaceSuccess {
  family: string;
  source: string;
  constructor(family: string, source: string) {
    this.family = family;
    this.source = source;
  }
  load() {
    return Promise.resolve(this as unknown as FontFace);
  }
}

class MockFontFaceFailure {
  constructor(
    public family: string,
    public source: string,
  ) {}
  load() {
    return Promise.reject(new Error('font load failed'));
  }
}

describe('loadFont', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('onLoad-addsLoadedFontToDocumentFontsAndResolvesWithIt', async () => {
    vi.stubGlobal('FontFace', MockFontFaceSuccess);
    const add = vi.fn();
    Object.defineProperty(document, 'fonts', { value: { add }, configurable: true });

    const font = await loadFont('ByteBounce', '/fonts/bytebounce.medium.ttf');

    expect(add).toHaveBeenCalledWith(font);
    expect((font as unknown as MockFontFaceSuccess).family).toBe('ByteBounce');
  });

  it('onLoadFailure-rejects', async () => {
    vi.stubGlobal('FontFace', MockFontFaceFailure);
    Object.defineProperty(document, 'fonts', { value: { add: vi.fn() }, configurable: true });

    await expect(loadFont('ByteBounce', '/fonts/bytebounce.medium.ttf')).rejects.toThrow();
  });
});
