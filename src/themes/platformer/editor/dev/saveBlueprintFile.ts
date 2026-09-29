import { BLUEPRINTS_FOLDER, SAVE_BLUEPRINT_ENDPOINT } from './saveBlueprintEndpoint';
import { saveFile, type SaveResult } from './saveFile';
import { layoutFileJson } from './layoutFileJson';
import { BLANK_BLUEPRINT } from '../../level/BlueprintData';
import type { MarkerPlacement } from '../../level/LevelData';

export { BLUEPRINTS_FOLDER };

/**
 * `'Cave Room Two'` → `'cave-room-two'`. The same slug rule
 * `saveLevelFile.ts`'s `levelFileName` uses, minus the extension, since a
 * blueprint's registry id is its filename stem (see `blueprintRegistry.ts`).
 * A name with nothing slug-worthy in it still has to produce a writable file,
 * hence the `blueprint` fallback.
 *
 * The extra `'new'` guard is not cosmetic: `BLANK_BLUEPRINT.id` is `'new'` and
 * the Save dialog pre-fills the name field with the loaded blueprint's name,
 * which starts out as `'new'` too. Accepting that default would write
 * `new.json`, whose id shadows the dropdown's own built-in blank entry
 * `find` would always resolve to the blank one and two `<SelectItem>`s would
 * share a key. Suffixing keeps the two apart permanently.
 */
export const blueprintId = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const stem = slug === '' ? 'blueprint' : slug;
  return stem === BLANK_BLUEPRINT.id ? `${stem}-1` : stem;
};

/** The blueprint's filename — always exactly its registry id plus `.json`, so
 * the file's stem and the id derived back out of it cannot drift apart. */
export const blueprintFileName = (name: string): string => `${blueprintId(name)}.json`;

/**
 * Saves the blueprint as a thin parameterisation of the one generic save
 * module: the blueprint endpoint and filename plus `layoutFileJson`'s
 * contents (a `Blueprint` is deliberately the same `{ name, layout,
 * background?, markers? }` shape a saved level file is).
 */
export const saveBlueprint = (
  name: string,
  layout: readonly string[],
  background: readonly string[],
  markers: readonly MarkerPlacement[] = [],
): Promise<SaveResult> =>
  saveFile({
    endpoint: SAVE_BLUEPRINT_ENDPOINT,
    fileName: blueprintFileName(name),
    contents: layoutFileJson(name, layout, background, markers),
  });
