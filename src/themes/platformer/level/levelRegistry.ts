import { LEVEL_1_LAYOUT, LEVEL_1_BACKGROUND, LEVEL_1_MARKERS, SCRATCH_LAYOUT } from './level';
import type { MarkerPlacement } from './LevelData';

/**
 * One level the Level Editor can load. `layout` is the same
 * one-character-per-tile shape `parseLevel` and `importLayout` consume — a
 * registry entry is just a named layout, with no engine state attached.
 * `background`, since O-014's storage-unification revision, is the SAME
 * `readonly string[]` shape as `layout` (one character per cell, via
 * `BACKGROUND_CHARS`) rather than a pre-parsed `BackgroundGrid` — a
 * registry entry stores raw layouts only, exactly like `layout` itself;
 * `parseBackgroundLayout` turns it into the engine-facing `BackgroundGrid`
 * at load time.
 */
export interface LevelEntry {
  readonly id: string;
  readonly name: string;
  readonly layout: readonly string[];
  readonly background?: readonly string[];
  /** The level's tile meta layer — absent for a pre-feature file, which is
   *  what tells `parseLevel` its `T` is a falling stalactite (the `T`
   *  generation rule, D5). */
  readonly markers?: readonly MarkerPlacement[];
}

/**
 * The two levels that ship in code rather than as files: `main` is the real
 * level the game loads, `empty` is the three-tile starting grid. They come
 * first in the dropdown and cannot be removed, which is what makes "put back
 * what ships" and "give me an empty page" always one selection away — the
 * editor has no separate Reset or Scratch button (spec FR-028).
 */
export const BUILT_IN_LEVELS: readonly LevelEntry[] = [
  {
    id: 'main',
    name: 'main',
    layout: LEVEL_1_LAYOUT,
    background: LEVEL_1_BACKGROUND,
    markers: LEVEL_1_MARKERS,
  },
  { id: 'empty', name: 'empty', layout: SCRATCH_LAYOUT },
];

/** `'./levels/cave-run.json'` → `'cave-run'`. */
const idFromPath = (path: string): string =>
  path.split('/').pop()?.replace(/\.json$/, '') ?? path;

const isLayout = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((row) => typeof row === 'string');

/**
 * `background`'s shape check, post-O-014: the exact same "array of strings"
 * check `isLayout` applies to `layout` — mirroring it, not a hand-rolled
 * variant, since the two fields are now the same shape. Unlike `layout`,
 * `background` may legally be an empty array (an all-empty background layer
 * that still holds SOME painted content elsewhere isn't required — this
 * validator only gates the field's own shape, not its content), so this
 * intentionally omits `isLayout`'s non-empty-array requirement. The old
 * array-of-arrays `BackgroundGrid`/pre-O-014 `BackgroundPlacement[]` formats
 * both fail this — their entries are arrays/objects, not strings — so a
 * level saved under either format simply loads with `background` unset
 * entirely, exactly the FR-013 "no conversion" behaviour, for free from the
 * shape check alone.
 */
const isBackground = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((row) => typeof row === 'string');

/** `markers`'s shape check: an array whose entries each carry numeric
 *  `col`/`row` and a `marker` object with a string `kind`. Forgiving in the
 *  same way `background` is — a malformed field costs only that field, and a
 *  missing field means the level is pre-feature (the `T` generation rule). */
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
 * Turns an `import.meta.glob` result into registry entries, skipping anything
 * malformed (spec FR-027). A hand-edited or half-written JSON file in
 * `levels/` must not take the editor down with it — the level whose file is
 * broken simply doesn't appear in the dropdown, and every other one still
 * does.
 *
 * Kept separate from `LEVELS` below (which passes it the real glob) so the
 * validation is testable without writing fixture files into `levels/`.
 * Accepts both `{ default: {...} }` (how Vite hands over an eagerly-imported
 * JSON module) and a bare object, so tests can pass either.
 */
export const parseLevelModules = (modules: Record<string, unknown>): LevelEntry[] =>
  Object.entries(modules)
    .map(([path, module]): LevelEntry | null => {
      const raw =
        module !== null && typeof module === 'object' && 'default' in module
          ? (module as { default: unknown }).default
          : module;
      if (raw === null || typeof raw !== 'object') return null;

      const { name, layout, background, markers } = raw as {
        name?: unknown;
        layout?: unknown;
        background?: unknown;
        markers?: unknown;
      };
      if (!isLayout(layout)) return null;

      const id = idFromPath(path);
      return {
        id,
        name: typeof name === 'string' && name !== '' ? name : id,
        layout,
        ...(isBackground(background) ? { background } : {}),
        ...(isMarkers(markers) ? { markers } : {}),
      };
    })
    .filter((entry): entry is LevelEntry => entry !== null)
    .sort((a, b) => a.id.localeCompare(b.id));

/**
 * Every level the editor offers: the built-ins, then the saved JSON files.
 * The glob is resolved at build time, so a file dropped into `levels/` shows
 * up after the dev server picks the new module up — which is exactly what the
 * Save dialog tells the developer (see `editor/saveLevelFile.ts`).
 */
export const LEVELS: readonly LevelEntry[] = [
  ...BUILT_IN_LEVELS,
  ...parseLevelModules(import.meta.glob('./levels/*.json', { eager: true })),
];

export const findLevel = (id: string): LevelEntry | undefined =>
  LEVELS.find((entry) => entry.id === id);
