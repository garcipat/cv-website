/**
 * The single home for raw level/blueprint file validation and parsing (FR-012):
 * the shared path-stem helper, the three shape validators, and the two module
 * parsers the registries use to turn an `import.meta.glob` result into registry
 * entries. Replaces the copies that lived in `levelRegistry.ts`,
 * `BlueprintData.ts`, and `blueprintRegistry.ts` (FR-013).
 *
 * `level/` vocabulary only — it must never import `engine/`.
 */

import type { MarkerPlacement } from './LevelData';
import type { LevelEntry } from './levelRegistry';
import { isBlueprint, type Blueprint } from './BlueprintData';

/** `'./levels/cave-run.json'` → `'cave-run'`. */
export function idFromPath(path: string): string {
  return path.split('/').pop()?.replace(/\.json$/, '') ?? path;
}

/** Non-empty array of strings — a level must have at least one layout row. */
export function isLayout(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((row) => typeof row === 'string');
}

/**
 * `background`'s shape check: the same "array of strings" check as `isLayout`,
 * but without its non-empty requirement — an all-empty background layer may
 * legally be `[]`. The old array-of-arrays `BackgroundGrid`/pre-O-014
 * `BackgroundPlacement[]` formats both fail this — their entries are
 * arrays/objects, not strings — so such a file loads with `background` unset,
 * the FR-013 "no conversion" behaviour for free from the shape check alone.
 */
export function isBackground(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((row) => typeof row === 'string');
}

/** `markers`'s shape check: an array whose entries each carry numeric
 *  `col`/`row` and a `marker` object with a string `kind`. Forgiving — a
 *  malformed field costs only that field, and a missing field means the level
 *  is pre-feature (the `T` generation rule). */
export function isMarkers(value: unknown): value is MarkerPlacement[] {
  return (
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
    })
  );
}

/**
 * Turns an `import.meta.glob` result into level registry entries, skipping
 * anything malformed (spec FR-027). A hand-edited or half-written JSON file in
 * `levels/` must not take the editor down with it — the level whose file is
 * broken simply doesn't appear in the dropdown, and every other one still
 * does.
 *
 * Accepts both `{ default: {...} }` (how Vite hands over an eagerly-imported
 * JSON module) and a bare object, so tests can pass either.
 */
export function parseLevelModules(modules: Record<string, unknown>): LevelEntry[] {
  return Object.entries(modules)
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
}

/**
 * Turns an `import.meta.glob` result into blueprint entries, skipping anything
 * malformed — the same rule `parseLevelModules` applies to level JSON.
 *
 * Validation routes through `isBlueprint` rather than a second set of private
 * checks. Each optional field is attached independently, so a malformed
 * `background` or `markers` costs only that field, exactly like levels.
 */
export function parseBlueprintModules(modules: Record<string, unknown>): Blueprint[] {
  return Object.entries(modules)
    .map(([path, module]): Blueprint | null => {
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
      const id = idFromPath(path);
      const base: unknown = {
        id,
        name: typeof name === 'string' && name !== '' ? name : id,
        layout,
      };
      if (!isBlueprint(base)) return null;

      let entry: Blueprint = base;
      if (background !== undefined) {
        const withBackground: unknown = { ...entry, background };
        if (isBlueprint(withBackground)) entry = withBackground;
      }
      if (markers !== undefined) {
        const withMarkers: unknown = { ...entry, markers };
        if (isBlueprint(withMarkers)) entry = withMarkers;
      }
      return entry;
    })
    .filter((entry): entry is Blueprint => entry !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
}
