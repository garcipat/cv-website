import { exportLayout } from './exportLayout';
import { LEVELS_FOLDER, SAVE_LEVEL_ENDPOINT } from './saveLevelEndpoint';
import type { BackgroundPlacement } from '../level/LevelData';
import type { TileChar } from '../level/LevelParser';

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

/**
 * The file's contents: the level's name plus its exported (cropped) layout,
 * pretty-printed and newline-terminated so the file reads like the rest of
 * the repo's JSON rather than one long line. The background layer is only
 * included when it holds placements, so levels without one keep the same
 * shape they had before the background layer existed.
 */
export const levelFileJson = (name: string, grid: TileChar[][], background: BackgroundPlacement[]): string =>
  `${JSON.stringify(
    { name, layout: exportLayout(grid), ...(background.length > 0 ? { background } : {}) },
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
  grid: TileChar[][],
  background: BackgroundPlacement[],
): Promise<SaveLevelResult> => {
  try {
    const response = await fetch(SAVE_LEVEL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: levelFileName(name),
        contents: levelFileJson(name, grid, background),
      }),
    });
    const body = (await response.json()) as { path?: string; error?: string };

    if (response.ok && typeof body.path === 'string') {
      return { written: true, path: body.path };
    }

    downloadLevelFile(name, grid, background);
    return body.error === undefined ? { written: false } : { written: false, error: body.error };
  } catch {
    // No dev server behind this page at all (built site, or served statically).
    downloadLevelFile(name, grid, background);
    return { written: false };
  }
};

export const downloadLevelFile = (name: string, grid: TileChar[][], background: BackgroundPlacement[]): void => {
  const blob = new Blob([levelFileJson(name, grid, background)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = levelFileName(name);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
