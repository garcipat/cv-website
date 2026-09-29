import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAssetLoader } from './AssetLoader';
import { SPRITE_MANIFEST } from '../entities/sprites/SpriteManifest';
import type { SpriteManifest } from '../entities/sprites/SpriteManifest';
import { SPEAR_SHEET } from '../entities/sprites/sheets';
import { setSpearTipMask } from '../entities/hazards/SpearArt';

vi.mock('../entities/hazards/SpearArt', () => ({
  spearTipMaskFromImage: (image: unknown) => ({ maskFor: image }),
  setSpearTipMask: vi.fn(),
}));

/** The same `new Image()` stub shape the page suite uses (`MockTilesetImage`),
 * extended with manual settle controls so a test can decide resolution order
 * and failures. */
class ControlledImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';

  static created: ControlledImage[] = [];

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    ControlledImage.created.push(this);
  }

  static reset(): void {
    ControlledImage.created = [];
  }

  static requested(): string[] {
    return ControlledImage.created.map((image) => image.src);
  }

  static resolve(src: string): void {
    for (const image of ControlledImage.created) {
      if (image.src === src) image.onload?.();
    }
  }

  static fail(src: string): void {
    for (const image of ControlledImage.created) {
      if (image.src === src) image.onerror?.();
    }
  }
}

/** Let the loader's promise chain drain. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const handlers = () => ({
  loaded: [] as Array<{ src: string; image: HTMLImageElement }>,
  readyCount: 0,
  onAssetLoaded(src: string, image: HTMLImageElement) {
    this.loaded.push({ src, image });
  },
  onReady() {
    this.readyCount += 1;
  },
});

describe('AssetLoader', () => {
  beforeEach(() => {
    ControlledImage.reset();
    vi.stubGlobal('Image', ControlledImage);
    vi.mocked(setSpearTipMask).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('start-requestsEveryManifestSourceExactlyOnce', async () => {
    // Arrange
    const h = handlers();
    const loader = createAssetLoader(SPRITE_MANIFEST, h);

    // Act
    loader.start();
    loader.start();
    await flush();

    // Assert
    const manifestSources = SPRITE_MANIFEST.images.map((entry) => entry.src);
    expect(ControlledImage.requested().sort()).toEqual([...manifestSources].sort());
  });

  it('resolvedAsset-writesTheLookupBySourcePathBeforeNotifying', async () => {
    // Arrange
    const h = handlers();
    const loader = createAssetLoader(SPRITE_MANIFEST, h);
    const src = SPRITE_MANIFEST.images[0].src;
    let lookupValueWhenNotified: unknown = 'never notified';
    h.onAssetLoaded = (loadedSrc, image) => {
      h.loaded.push({ src: loadedSrc, image });
      lookupValueWhenNotified = loader.lookup[loadedSrc];
    };

    // Act
    loader.start();
    ControlledImage.resolve(src);
    await flush();

    // Assert
    expect(h.loaded).toHaveLength(1);
    expect(h.loaded[0].src).toBe(src);
    expect(loader.lookup[src]).toBe(h.loaded[0].image);
    // The caller's repaint must be able to read the image it was told about.
    expect(lookupValueWhenNotified).toBe(h.loaded[0].image);
  });

  it('allEntriesSettled-firesOnReadyExactlyOnceAfterEveryNotification', async () => {
    // Arrange
    const h = handlers();
    const loader = createAssetLoader(SPRITE_MANIFEST, h);

    // Act
    loader.start();
    for (const entry of SPRITE_MANIFEST.images) ControlledImage.resolve(entry.src);
    await flush();

    // Assert
    expect(h.loaded).toHaveLength(SPRITE_MANIFEST.images.length);
    expect(h.readyCount).toBe(1);
    expect(h.loaded.at(-1)).toBeDefined();
  });

  it('oneFailingAsset-omitsOnlyItselfAndStillFiresOnReady', async () => {
    // Arrange
    const h = handlers();
    const loader = createAssetLoader(SPRITE_MANIFEST, h);
    const failed = SPRITE_MANIFEST.images[1].src;

    // Act
    loader.start();
    ControlledImage.fail(failed);
    for (const entry of SPRITE_MANIFEST.images) {
      if (entry.src !== failed) ControlledImage.resolve(entry.src);
    }
    await flush();

    // Assert: the key stays present with `null` — never `undefined` — so a
    // consumer's null guard skips the failed art rather than crashing on it.
    expect(loader.lookup[failed]).toBeNull();
    expect(h.loaded.some((entry) => entry.src === failed)).toBe(false);
    expect(h.loaded).toHaveLength(SPRITE_MANIFEST.images.length - 1);
    expect(h.readyCount).toBe(1);
  });

  it('beforeStart-lookupIsFullyKeyedWithNullSoEarlyFramesSkipEverySheet', () => {
    // Arrange
    const h = handlers();

    // Act
    const loader = createAssetLoader(SPRITE_MANIFEST, h);

    // Assert: `SpriteLookup`'s contract — every declared key is present with
    // `null` before anything loads, so a frame drawn before readiness (the
    // session repaints once inside `start()`, before `loader.start()`) skips
    // each sheet instead of passing `undefined` into `drawImage`.
    expect(Object.keys(loader.lookup)).toHaveLength(SPRITE_MANIFEST.images.length);
    for (const entry of SPRITE_MANIFEST.images) {
      expect(loader.lookup[entry.key ?? entry.src]).toBeNull();
    }
  });

  it('cancel-midLoad-writesNothingAndNotifiesNothing', async () => {
    // Arrange
    const h = handlers();
    const loader = createAssetLoader(SPRITE_MANIFEST, h);
    const src = SPRITE_MANIFEST.images[0].src;

    // Act
    loader.start();
    loader.cancel();
    ControlledImage.resolve(src);
    await flush();

    // Assert: the seeded `null`s are untouched — no key gained an image and
    // the key set is still complete.
    expect(Object.keys(loader.lookup)).toHaveLength(SPRITE_MANIFEST.images.length);
    expect(Object.values(loader.lookup).every((image) => image === null)).toBe(true);
    expect(h.loaded).toEqual([]);
    expect(h.readyCount).toBe(0);
    expect(setSpearTipMask).not.toHaveBeenCalled();
  });

  it('spearAsset-runsTheInstallerExactlyOnceAndOnlyAfterItResolves', async () => {
    // Arrange
    const manifest: SpriteManifest = { images: [{ src: SPEAR_SHEET.src }], fonts: [] };
    const h = handlers();
    const spearLoader = createAssetLoader(manifest, h);

    // Act — not before the image resolves.
    spearLoader.start();
    await flush();
    expect(setSpearTipMask).not.toHaveBeenCalled();

    ControlledImage.resolve(SPEAR_SHEET.src);
    await flush();

    // Assert
    expect(setSpearTipMask).toHaveBeenCalledTimes(1);
    expect(spearLoader.lookup[SPEAR_SHEET.src]).toBeDefined();
    expect(h.loaded).toHaveLength(1);
  });

  it('nonSpearAssets-neverRunTheInstaller', async () => {
    // Arrange
    const manifest: SpriteManifest = {
      images: SPRITE_MANIFEST.images.filter((entry) => entry.src !== SPEAR_SHEET.src),
      fonts: [],
    };
    const loader = createAssetLoader(manifest, handlers());

    // Act
    loader.start();
    for (const entry of manifest.images) ControlledImage.resolve(entry.src);
    await flush();

    // Assert
    expect(setSpearTipMask).not.toHaveBeenCalled();
  });
});
