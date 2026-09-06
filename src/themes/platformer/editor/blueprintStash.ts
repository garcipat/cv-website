import { createLocalStorageSignal } from '@/lib/utils';
import { isBlueprint, type Blueprint } from '../level/BlueprintData';
import type { BackgroundPlacement } from '../level/LevelData';

export const BLUEPRINT_STASH_KEY = 'platformer-editor-saved-blueprints';

/**
 * Every blueprint saved in this browser so far — a PLACEHOLDER store for
 * roadmap step 44a only. Step 44c replaces this module's body with a real
 * `saveBlueprintFile.ts` (POST to the dev server, falling back to a
 * download) plus a build-time `blueprintRegistry.ts` glob, exactly the way
 * levels already work; the read/write functions below deliberately mirror
 * `levelRegistry.ts`/`saveLevelFile.ts`'s shape so that swap needs no
 * changes in `BlueprintSelect` or `LevelEditorPage`.
 */
export const savedBlueprintsSignal = createLocalStorageSignal<Blueprint[]>(
  BLUEPRINT_STASH_KEY,
  [],
);

/**
 * `'Cave Room Two'` → `'cave-room-two'`. The exact slug rule
 * `saveLevelFile.ts`'s `levelFileName` uses, minus the `.json` suffix, since
 * a blueprint's id is likewise its future filename stem. A name with nothing
 * slug-worthy in it still has to produce a usable id, hence the fallback.
 */
export const blueprintId = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'blueprint' : slug;
};

/** Every well-formed stored blueprint. Anything malformed is skipped rather
 *  than thrown on (see `isBlueprint`). Order comes from the stored list,
 *  which `saveBlueprintToStash` keeps id-sorted on every write. */
export const readSavedBlueprints = (): Blueprint[] =>
  savedBlueprintsSignal.value.filter(isBlueprint);

export const findSavedBlueprint = (id: string): Blueprint | undefined =>
  readSavedBlueprints().find((entry) => entry.id === id);

/**
 * Stores `layout`/`background` (already cropped and rebased by
 * `cropLevelForExport`) under `name`, replacing any entry with the same
 * slugged id — saving under a name you already used overwrites it, the same
 * way saving a level file over its own filename does. `background` is
 * omitted entirely when empty, matching `levelFileJson`.
 */
export const saveBlueprintToStash = (
  name: string,
  layout: readonly string[],
  background: BackgroundPlacement[],
): Blueprint => {
  const blueprint: Blueprint = {
    id: blueprintId(name),
    name,
    layout,
    ...(background.length > 0 ? { background } : {}),
  };
  savedBlueprintsSignal.value = [
    ...savedBlueprintsSignal.value.filter((entry) => entry.id !== blueprint.id),
    blueprint,
  ].sort((a, b) => a.id.localeCompare(b.id));
  return blueprint;
};
