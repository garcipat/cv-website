import { LEVEL_1_LAYOUT, LEVEL_1_BACKGROUND, LEVEL_1_MARKERS, SCRATCH_LAYOUT } from './level';
import type { MarkerPlacement } from './LevelData';
import { parseLevelModules } from './layoutFile';

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
