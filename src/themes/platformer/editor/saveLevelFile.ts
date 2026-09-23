import { LEVELS_FOLDER, SAVE_LEVEL_ENDPOINT } from './saveLevelEndpoint';
import type { MarkerPlacement } from '../level/LevelData';

export { LEVELS_FOLDER };

/**
 * `'Cave Run Two'` → `'cave-run-two.json'`. Non-alphanumerics collapse to
 * single hyphens so the filename is also a usable registry `id` (the id is
 * the filename stem — see `levelRegistry.ts`). A name with nothing
 * slug-worthy in it still has to produce a downloadable file, hence the
 * `level` fallback.
 */
export const levelFileName = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug === '' ? 'level' : slug}.json`;
};

/** Whether a background `string[]` layout holds at least one painted cell —
 *  a layout cropped alongside an all-empty foreground still has rows (of
 *  all-`.` characters), so this checks row content rather than just
 *  `.length`. */
const hasBackgroundContent = (background: readonly string[]): boolean =>
  background.some((row) => [...row].some((char) => char !== '.'));

/**
 * The file's contents: the level's name plus its already-cropped layout,
 * pretty-printed and newline-terminated so the file reads like the rest of
 * the repo's JSON rather than one long line. The background layer is only
 * included when it holds at least one painted cell, so levels without one
 * keep the same shape they had before the background layer existed.
 *
 * Takes the cropped `layout` (and `background`, already cropped to the same
 * origin) rather than a raw grid and re-cropping here itself — see
 * `cropLevelForExport.ts`. Re-cropping here with the foreground-only
 * `exportLayout` would silently undo the caller's crop.
 */
export const levelFileJson = (
  name: string,
  layout: readonly string[],
  background: readonly string[],
  markers: readonly MarkerPlacement[] = [],
): string =>
  `${JSON.stringify(
    {
      name,
      layout,
      ...(hasBackgroundContent(background) ? { background } : {}),
      ...(markers.length > 0 ? { markers } : {}),
    },
    null,
    2,
  )}\n`;

/**
 * Hands the level to the browser as a download — the only way a static site
 * can produce a file (spec FR-031: no writes into the repository). The
 * developer moves it into `LEVELS_FOLDER` themselves, which is what the Save
 * dialog explains.
 *
 * The anchor is created, clicked, and removed within the call, and the object
 * URL is revoked immediately afterwards: nothing about the download outlives
 * it.
 */
export interface SaveLevelResult {
  /** True when the dev server wrote the file into `LEVELS_FOLDER` itself. */
  written: boolean;
  /** Repository-relative path of the written file, when it was written. */
  path?: string;
  /** Why the dev server refused, when it answered but declined to write. */
  error?: string;
}

/**
 * Saves the level the way the developer actually wants it saved: POSTed to
 * the dev server, which writes it straight into `LEVELS_FOLDER` — the folder
 * the level registry globs — so it needs no moving afterwards (spec FR-032).
 *
 * The endpoint only exists while `npm run dev` is running (its plugin is
 * `apply: 'serve'`), so anything else — a built site, a missing plugin, a
 * refused write — falls back to the plain download, which the developer then
 * moves themselves. The caller gets told which of the two happened so the UI
 * can say so rather than implying a file landed somewhere it didn't.
 */
export const saveLevel = async (
  name: string,
  layout: readonly string[],
  background: readonly string[],
  markers: readonly MarkerPlacement[] = [],
): Promise<SaveLevelResult> => {
  try {
    const response = await fetch(SAVE_LEVEL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: levelFileName(name),
        contents: levelFileJson(name, layout, background, markers),
      }),
    });
    const body = (await response.json()) as { path?: string; error?: string };

    if (response.ok && typeof body.path === 'string') {
      return { written: true, path: body.path };
    }

    downloadLevelFile(name, layout, background, markers);
    return body.error === undefined ? { written: false } : { written: false, error: body.error };
  } catch {
    // No dev server behind this page at all (built site, or served statically).
    downloadLevelFile(name, layout, background, markers);
    return { written: false };
  }
};

export const downloadLevelFile = (
  name: string,
  layout: readonly string[],
  background: readonly string[],
  markers: readonly MarkerPlacement[] = [],
): void => {
  const blob = new Blob([levelFileJson(name, layout, background, markers)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = levelFileName(name);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
