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

/**
 * The name of the level the grid was last loaded from (or last saved as) —
 * what the level dropdown shows on its trigger. Persisted like the two
 * signals above, so reopening the editor still says which level is open
 * rather than claiming it's the shipped one.
 */
export const editorLoadedLevelNameSignal = createLocalStorageSignal<string>(
  'platformer-editor-loaded-level',
  'main',
);

/**
 * Whether the grid has been edited since it was loaded or saved. Set on every
 * paint/erase and cleared on load and save — deliberately a plain flag rather
 * than a comparison against the loaded layout, so nothing has to diff a
 * 220-column grid on every stroke. The cost is that painting a cell and
 * painting it back still counts as a change, which is how tile editors
 * generally behave anyway: the flag only decides whether loading another
 * level asks first.
 */
export const editorDirtySignal = createLocalStorageSignal<boolean>(
  'platformer-editor-dirty',
  false,
);
