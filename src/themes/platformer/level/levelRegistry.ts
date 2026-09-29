import { LEVEL_1_LAYOUT, LEVEL_1_BACKGROUND, LEVEL_1_MARKERS, SCRATCH_LAYOUT } from './level';
import type { LayoutFile } from './rawLayoutFile';
import { parseLevelModules } from './layoutFile';

/**
 * One level the Level Editor can load. `layout` is the same
 * one-character-per-tile shape `parseLevel` and `importLayout` consume — a
 * registry entry is just a named layout, with no engine state attached.
 * `background`, since 's storage-unification revision, is the SAME
 * `readonly string[]` shape as `layout` (one character per cell, via
 * `BACKGROUND_CHARS`) rather than a pre-parsed `BackgroundGrid` — a
 * registry entry stores raw layouts only, exactly like `layout` itself;
 * `parseBackgroundLayout` turns it into the engine-facing `BackgroundGrid`
 * at load time.
 */
export interface LevelEntry extends LayoutFile {
  readonly id: string;
  readonly name: string;
}

/**
 * The two levels that ship in code rather than as files: `main` is the real
 * level the game loads, `empty` is the three-tile starting grid. They come
 * first in the dropdown and cannot be removed, which is what makes "put back
 * what ships" and "give me an empty page" always one selection away — the
 * editor has no separate Reset or Scratch button.
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

/**
 * Every level the editor offers: the built-ins, then the saved JSON files.
 * The glob is resolved at build time, so a file dropped into `levels/` shows
 * up after the dev server picks the new module up — which is exactly what the
 * Save dialog tells the developer (see `editor/saveLevelFile.ts`).
 */
const BUILT_IN_IDS = new Set(BUILT_IN_LEVELS.map((entry) => entry.id));

export const LEVELS: readonly LevelEntry[] = [
  ...BUILT_IN_LEVELS,
  ...parseLevelModules(import.meta.glob('./levels/*.json', { eager: true })).filter(
    // A saved file can never shadow a built-in id: `main`'s own data now lives
    // in `levels/main.json` (imported by `level.ts`), but `main` stays a
    // built-in entry so it keeps its first position and its unremovable slot.
    (entry) => !BUILT_IN_IDS.has(entry.id),
  ),
];

export const findLevel = (id: string): LevelEntry | undefined =>
  LEVELS.find((entry) => entry.id === id);
