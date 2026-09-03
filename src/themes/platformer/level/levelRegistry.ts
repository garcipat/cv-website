import { LEVEL_1_LAYOUT, SCRATCH_LAYOUT } from './level';

/**
 * One level the Level Editor can load. `layout` is the same
 * one-character-per-tile shape `parseLevel` and `importLayout` consume — a
 * registry entry is just a named layout, with no engine state attached.
 */
export interface LevelEntry {
  readonly id: string;
  readonly name: string;
  readonly layout: readonly string[];
}

/**
 * The two levels that ship in code rather than as files: `main` is the real
 * level the game loads, `empty` is the three-tile starting grid. They come
 * first in the dropdown and cannot be removed, which is what makes "put back
 * what ships" and "give me an empty page" always one selection away — the
 * editor has no separate Reset or Scratch button (spec FR-028).
 */
export const BUILT_IN_LEVELS: readonly LevelEntry[] = [
  { id: 'main', name: 'main', layout: LEVEL_1_LAYOUT },
  { id: 'empty', name: 'empty', layout: SCRATCH_LAYOUT },
];

/** `'./levels/cave-run.json'` → `'cave-run'`. */
const idFromPath = (path: string): string =>
  path.split('/').pop()?.replace(/\.json$/, '') ?? path;

const isLayout = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((row) => typeof row === 'string');

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

      const { name, layout } = raw as { name?: unknown; layout?: unknown };
      if (!isLayout(layout)) return null;

      const id = idFromPath(path);
      return { id, name: typeof name === 'string' && name !== '' ? name : id, layout };
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
