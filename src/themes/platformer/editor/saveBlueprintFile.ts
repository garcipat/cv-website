import { BLUEPRINTS_FOLDER, SAVE_BLUEPRINT_ENDPOINT } from './saveBlueprintEndpoint';
import { BLANK_BLUEPRINT } from '../level/BlueprintData';
import type { MarkerPlacement } from '../level/LevelData';

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
 * `new.json`, whose id shadows the dropdown's own built-in blank entry —
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
 *  the file's stem and the id derived back out of it cannot drift apart. */
export const blueprintFileName = (name: string): string => `${blueprintId(name)}.json`;

/** Whether a background `string[]` layout holds at least one painted cell —
 *  a layout cropped alongside an all-empty foreground still has rows (of
 *  all-`.` characters), so this checks row content rather than just
 *  `.length`. */
const hasBackgroundContent = (background: readonly string[]): boolean =>
  background.some((row) => [...row].some((char) => char !== '.'));

/**
 * The file's contents: the blueprint's name plus its already-cropped layout,
 * pretty-printed and newline-terminated so the file reads like the rest of the
 * repo's JSON. `background` is only included when it holds at least one
 * painted cell, matching `levelFileJson` exactly — a `Blueprint` is
 * deliberately the same `{ name, layout, background? }` shape a saved level
 * file is.
 *
 * Takes the cropped `layout` (and `background`, already cropped to the same
 * origin) rather than a raw grid, for the same reason `levelFileJson` does:
 * re-cropping here with the foreground-only `exportLayout` would silently
 * undo the caller's `cropLevelForExport` crop.
 */
export const blueprintFileJson = (
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

export interface SaveBlueprintResult {
  /** True when the dev server wrote the file into `BLUEPRINTS_FOLDER` itself. */
  written: boolean;
  /** Repository-relative path of the written file, when it was written. */
  path?: string;
  /** Why the dev server refused, when it answered but declined to write. */
  error?: string;
}

/**
 * Saves the blueprint the way the developer actually wants it saved: POSTed to
 * the dev server, which writes it straight into `BLUEPRINTS_FOLDER` — the
 * folder `blueprintRegistry.ts` globs — so it needs no moving afterwards.
 *
 * The endpoint only exists while `npm run dev` is running (its plugin is
 * `apply: 'serve'`), so anything else falls back to a plain download. That
 * fallback is kept even though the Save control itself is now hidden off the
 * dev server (`isDevEnvironmentSignal`, see `devEnvironment.ts`): the gate is
 * a UI affordance, not a guarantee, and a dev server whose plugin failed to
 * register would otherwise lose the author's work outright.
 */
export const saveBlueprint = async (
  name: string,
  layout: readonly string[],
  background: readonly string[],
  markers: readonly MarkerPlacement[] = [],
): Promise<SaveBlueprintResult> => {
  try {
    const response = await fetch(SAVE_BLUEPRINT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: blueprintFileName(name),
        contents: blueprintFileJson(name, layout, background, markers),
      }),
    });
    const body = (await response.json()) as { path?: string; error?: string };

    if (response.ok && typeof body.path === 'string') {
      return { written: true, path: body.path };
    }

    downloadBlueprintFile(name, layout, background, markers);
    return body.error === undefined ? { written: false } : { written: false, error: body.error };
  } catch {
    // No dev server behind this page at all (built site, or served statically).
    downloadBlueprintFile(name, layout, background, markers);
    return { written: false };
  }
};

export const downloadBlueprintFile = (
  name: string,
  layout: readonly string[],
  background: readonly string[],
  markers: readonly MarkerPlacement[] = [],
): void => {
  const blob = new Blob([blueprintFileJson(name, layout, background, markers)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = blueprintFileName(name);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
