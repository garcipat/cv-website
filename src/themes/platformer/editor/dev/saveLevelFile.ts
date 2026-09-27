import { LEVELS_FOLDER, SAVE_LEVEL_ENDPOINT } from './saveLevelEndpoint';
import { saveFile, type SaveResult } from './saveFile';
import { layoutFileJson } from './layoutFileJson';
import type { MarkerPlacement } from '../../level/LevelData';

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
 * Saves the level as a thin parameterisation of the one generic save module
 * (FR-011): the level endpoint and filename plus `layoutFileJson`'s contents.
 */
export const saveLevel = (
  name: string,
  layout: readonly string[],
  background: readonly string[],
  markers: readonly MarkerPlacement[] = [],
): Promise<SaveResult> =>
  saveFile({
    endpoint: SAVE_LEVEL_ENDPOINT,
    fileName: levelFileName(name),
    contents: layoutFileJson(name, layout, background, markers),
  });
