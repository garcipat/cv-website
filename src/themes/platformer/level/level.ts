import mainLevel from './levels/main.json';
import type { MarkerPlacement } from './LevelData';

/**
 * The shipped level — a pure declaration read from `levels/main.json` (the
 * single copy, and the file the editor's Save writes). The level is authored
 * in the editor and verified by playing; no level-design prose lives in code.
 */
export const LEVEL_1_LAYOUT: readonly string[] = mainLevel.layout;
export const LEVEL_1_BACKGROUND: readonly string[] = mainLevel.background;
export const LEVEL_1_MARKERS: readonly MarkerPlacement[] =
  mainLevel.markers as unknown as readonly MarkerPlacement[];

/** The Level Editor's blank starting grid. */
export const SCRATCH_LAYOUT: readonly string[] = ['.S.', 'GGG'];
