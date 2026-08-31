import { createLocalStorageSignal } from '@/lib/utils';
import { importLayout } from './importLayout';
import { LEVEL_1_LAYOUT } from '../level/level';
import type { TileChar } from '../level/LevelParser';

/**
 * The Level Editor's grid, persisted to localStorage — separate from
 * `level.ts`'s `currentLayout` (the in-memory signal the GAME reads),
 * which deliberately resets to the hardcoded default on every real page
 * load. This one is the opposite: it's meant to survive reloads/closing the
 * tab, so a play-tester's in-progress edits are still there next time they
 * open `/platformer/editor`. `LevelEditorPage.tsx` keeps its own `grid` as
 * local `useState` for the painting hot path and only syncs it here on a
 * debounce, rather than writing to this signal on every stroke.
 */
export const editorLevelSignal = createLocalStorageSignal<TileChar[][]>(
  'platformer-editor-level',
  importLayout(LEVEL_1_LAYOUT),
);

/**
 * The Level Editor's currently-selected palette tool, persisted the same
 * way `editorLevelSignal` is above — so reopening `/platformer/editor`
 * keeps whichever tool was last selected instead of always resetting to
 * Ground Grass.
 */
export const editorSelectedToolSignal = createLocalStorageSignal<TileChar>('platformer-editor-selected-tool', 'G');
