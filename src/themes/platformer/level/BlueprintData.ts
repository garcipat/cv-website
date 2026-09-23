import type { MarkerPlacement } from './LevelData';

/**
 * A named, reusable room authored on the Level Editor's own blueprint canvas.
 * Deliberately the SAME shape a saved level file has — `layout` is
 * `exportLayout`'s cropped `readonly string[]`, `background` is
 * `cropLevelForExport`'s equally-cropped `readonly string[]` (O-014's
 * storage-unification revision), and `markers` is its cropped tile meta layer
 * — so importLayout/parseLevel/cropLevelForExport/parseBackgroundLayout all
 * apply unchanged and blueprint placement can parse a blueprint with the same
 * per-character mapping it already uses for levels. Purely editor-time: see
 * `specs/O-006-platformer-blueprints/design.md`.
 */
export interface Blueprint {
  /** Slug, also the filename stem of the saved `.json` file under
   *  `blueprints/` — mirrors `LevelEntry`'s id. */
  id: string;
  name: string;
  layout: readonly string[];
  background?: readonly string[];
  /** The room's tile meta layer — absent when the room has no markers. */
  markers?: readonly MarkerPlacement[];
}

/** The blank entry the Blueprint Select dropdown offers, mirroring the level
 *  registry's built-in `empty`: one empty cell, nothing painted. Unlike
 *  `SCRATCH_LAYOUT` it carries no `S` — a blueprint has no spawn. */
export const BLANK_BLUEPRINT: Blueprint = { id: 'new', name: 'new', layout: ['.'] };

const isLayout = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((row) => typeof row === 'string');

/** Same "array of strings" shape check `levelRegistry.ts`'s `isBackground`
 *  uses — see its doc comment for why the old array-of-arrays/
 *  `BackgroundPlacement[]` formats both fail this for free. */
const isBackground = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((row) => typeof row === 'string');

/** Forgiving shape check for the `markers` field: an array whose entries each
 *  carry numeric `col`/`row` and a `marker` object with a string `kind`. Same
 *  "a malformed field costs only that field" policy `background` has. */
const isMarkers = (value: unknown): value is MarkerPlacement[] =>
  Array.isArray(value) &&
  value.every((entry) => {
    if (entry === null || typeof entry !== 'object') return false;
    const { col, row, marker } = entry as { col?: unknown; row?: unknown; marker?: unknown };
    return (
      typeof col === 'number' &&
      typeof row === 'number' &&
      marker !== null &&
      typeof marker === 'object' &&
      typeof (marker as { kind?: unknown }).kind === 'string'
    );
  });

/**
 * Whether `value` is a well-formed `Blueprint`. Same "skip anything
 * malformed" role `levelRegistry.ts`'s validation plays for level JSON:
 * saved blueprints are hand-editable JSON files under `blueprints/`
 * (`blueprintRegistry.ts` globs them at build time), and one bad file must
 * not take the whole dropdown (or the editor) down with it.
 */
export function isBlueprint(value: unknown): value is Blueprint {
  if (value === null || typeof value !== 'object') return false;
  const { id, name, layout, background, markers } = value as {
    id?: unknown;
    name?: unknown;
    layout?: unknown;
    background?: unknown;
    markers?: unknown;
  };
  if (typeof id !== 'string' || typeof name !== 'string') return false;
  if (!isLayout(layout)) return false;
  if (background !== undefined && !isBackground(background)) return false;
  if (markers !== undefined && !isMarkers(markers)) return false;
  return true;
}
