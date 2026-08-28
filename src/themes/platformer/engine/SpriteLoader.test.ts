import { loadImage } from './SpriteLoader';

class MockImageSuccess {
  onload: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  private _src = '';
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
}

class MockImageFailure {
  onload: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  private _src = '';
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onerror?.(new Error('load failed')));
  }
}

describe('SpriteLoader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadImage-onLoad-resolvesWithImageElement', async () => {
    vi.stubGlobal('Image', MockImageSuccess);
    const img = await loadImage('/sprites/world_tileset.png');
    expect(img).toBeInstanceOf(MockImageSuccess);
    expect((img as unknown as MockImageSuccess).src).toBe('/sprites/world_tileset.png');
  });

  it('loadImage-onError-rejects', async () => {
    vi.stubGlobal('Image', MockImageFailure);
    await expect(loadImage('/sprites/missing.png')).rejects.toThrow();
  });
});
