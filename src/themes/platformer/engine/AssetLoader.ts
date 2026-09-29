import { loadImage } from './SpriteLoader';
import { loadFont } from './FontLoader';
import { spearTipMaskFromImage, setSpearTipMask } from '../entities/hazards/SpearArt';
import { SPEAR_SHEET } from '../entities/sprites/sheets';
import type { SpriteManifest, SpriteManifestEntry } from '../entities/sprites/SpriteManifest';
import type { SpriteLookup } from '../contracts/SpriteLookup';

/** What an asset load reports back to its caller. */
export interface AssetLoaderHandlers {
  /** One call per resolved image, in resolution order — the caller repaints,
   * so art appears progressively rather than in one batch at the end. */
  onAssetLoaded(src: string, image: HTMLImageElement): void;
  /** Exactly once, after every entry has settled (`Promise.allSettled`). */
  onReady(): void;
}

/** The loader's public surface: one live lookup plus start/cancel. */
export interface AssetLoader {
  /** Live, path-keyed image map — the identity the render path reads. It is
   * created once and mutated as assets land, so a caller may hold it. */
  readonly lookup: SpriteLookup;
  start(): void;
  cancel(): void;
}

/** A post-load step for one image source (never a font). */
type AssetInstaller = (image: HTMLImageElement) => void;

/**
 * The declared installer table — the one place an asset needs work beyond
 * landing in the lookup. Today exactly one entry: the floor spear's sheet must
 * also build the module-level tip mask the lethal contact test reads, or an
 * unloaded/failed spear stays inert and renders nothing.
 *
 * Declaring it here (loader ownership) keeps the manifest pure data and keeps
 * the installer out of an import-time side effect and out of any page effect.
 */
const ASSET_INSTALLERS: Readonly<Record<string, AssetInstaller>> = {
  [SPEAR_SHEET.src]: (image) => {
    const mask = spearTipMaskFromImage(image);
    if (mask) setSpearTipMask(mask);
  },
};

/**
 * Turns one `SpriteManifest` into a live path-keyed `SpriteLookup`.
 *
 * Semantics (frozen):
 *
 * 1. `start()` is non-blocking — one independent promise per entry, nothing
 *    awaits the set.
 * 2. A successful load runs that source's installer (if any), then writes
 *    `lookup[key ?? src]` and only then notifies, so the caller's repaint can
 *    read the image it was told about.
 * 3. A rejected load is isolated: the asset is simply absent from the lookup
 *    and no notification is emitted. The unit never rejects, never blocks the
 *    loop and never blanks the page; a failed font leaves `document.fonts`
 *    untouched and the text path keeps its fallbacks.
 * 4. `onReady()` fires once, after every entry has settled.
 * 5. After `cancel()` no lookup write, no installer and no notification
 *    happens — the unmount-mid-load rule.
 */
export function createAssetLoader(
  manifest: SpriteManifest,
  handlers: AssetLoaderHandlers,
): AssetLoader {
  // Seed every declared key with `null` at creation, before anything loads.
  // `SpriteLookup`'s contract is that a key is *present* (with `null`) while its
  // asset is loading, so a caller drawing an early frame — the session repaints
  // once before `start()` — skips the draw instead of receiving `undefined`.
  // That matters because the render path's guards are strict (`image === null`
  // in `drawAmbientClouds`/`HudRenderer`, `!== null` in `hudModel`), and an
  // index-signature lookup types as `HTMLImageElement | null`, so `undefined`
  // passes both the guards and the compiler only to blow up inside `drawImage`.
  // The key set never changes afterwards: a failed load leaves its `null`, so
  // every read is either an image or `null`.
  const lookup: SpriteLookup = {};
  for (const entry of manifest.images) lookup[entry.key ?? entry.src] = null;
  let started = false;
  let cancelled = false;

  const loadImageEntry = async (entry: SpriteManifestEntry): Promise<void> => {
    try {
      const image = await loadImage(entry.src);
      if (cancelled) return;
      ASSET_INSTALLERS[entry.src]?.(image);
      lookup[entry.key ?? entry.src] = image;
      handlers.onAssetLoaded(entry.src, image);
    } catch {
      // Per-asset failure isolation: the asset stays absent from the lookup
      // and nothing is notified for it.
    }
  };

  const loadFontEntry = async (family: string, url: string): Promise<void> => {
    try {
      await loadFont(family, url);
    } catch {
      // The restart prompt / counter popups fall back to their sans-serif and
      // monospace stacks when the custom font fails to load.
    }
  };

  return {
    lookup,
    start(): void {
      if (started) return;
      started = true;
      const imageLoads = manifest.images.map(loadImageEntry);
      const fontLoads = manifest.fonts.map((font) => loadFontEntry(font.family, font.url));
      void Promise.allSettled([...imageLoads, ...fontLoads]).then(() => {
        if (cancelled) return;
        handlers.onReady();
      });
    },
    cancel(): void {
      cancelled = true;
    },
  };
}
