import { createLocalStorageSignal } from '@/lib/utils';
import { importLayout } from './importLayout';
import { LEVEL_1_LAYOUT } from '../level/level';
import { BLANK_BLUEPRINT } from '../level/BlueprintData';
import type { TileChar } from '../level/LevelParser';
import type { BackgroundPlacement, BackgroundPieceId } from '../level/LevelData';

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

/**
 * The Level Editor's background-layer placements, persisted the same way
 * `editorLevelSignal` is above.
 */
export const editorBackgroundSignal = createLocalStorageSignal<BackgroundPlacement[]>(
  'platformer-editor-background',
  [],
);

/**
 * Which layer the palette and canvas clicks currently target.
 */
export const editorActiveLayerSignal = createLocalStorageSignal<'foreground' | 'background'>(
  'platformer-editor-active-layer',
  'foreground',
);

/**
 * The currently-selected background piece, persisted like
 * `editorSelectedToolSignal` above — `null` until the developer picks one.
 */
export const editorSelectedBackgroundPieceSignal = createLocalStorageSignal<BackgroundPieceId | null>(
  'platformer-editor-selected-background-piece',
  null,
);

/**
 * Which canvas the editor is currently painting: the level's own `grid`, or
 * the separate blueprint canvas below. Independent of
 * `editorActiveLayerSignal` — that one says which LAYER (foreground or
 * background) of whichever canvas is active gets painted, and both toggles
 * keep working together (roadmap step 44a).
 */
export const editorCanvasModeSignal = createLocalStorageSignal<'level' | 'blueprint'>(
  'platformer-editor-canvas-mode',
  'level',
);

/**
 * The blueprint canvas's own foreground grid — a second, fully independent
 * grid, NOT a region of the level. Starts as one empty cell (the same blank
 * `BLANK_BLUEPRINT.layout` the Blueprint Select dropdown's `new` entry
 * loads) and is persisted exactly like `editorLevelSignal` above, so a room
 * half-painted yesterday is still there today.
 */
export const editorBlueprintSignal = createLocalStorageSignal<TileChar[][]>(
  'platformer-editor-blueprint',
  importLayout(BLANK_BLUEPRINT.layout),
);

/** The blueprint canvas's background-layer placements — the blueprint's
 *  counterpart of `editorBackgroundSignal`. Blueprints carry the same
 *  decorative background layer levels do. */
export const editorBlueprintBackgroundSignal = createLocalStorageSignal<BackgroundPlacement[]>(
  'platformer-editor-blueprint-background',
  [],
);

/** The name of the blueprint the canvas was last loaded from (or last saved
 *  as) — what the Blueprint Select trigger shows, mirroring
 *  `editorLoadedLevelNameSignal`. */
export const editorLoadedBlueprintNameSignal = createLocalStorageSignal<string>(
  'platformer-editor-loaded-blueprint',
  BLANK_BLUEPRINT.name,
);

/**
 * The id of the blueprint currently armed for placement, or `null` when none
 * is (roadmap step 44c). Deliberately a SECOND axis alongside
 * `editorSelectedToolSignal` rather than a value inside it: `selectedTool` is a
 * `TileChar`, and a blueprint is a multi-cell object with an id, a name and a
 * layout — there is no character to give it, and inventing one would mean a
 * `TileChar` `parseLevel` must never see in a layout.
 *
 * Mutual exclusion between the two is enforced by `LevelEditorPage`'s setters
 * (arming clears nothing, selecting a tile tool disarms), not by the type: that
 * keeps `selectedTool` available to restore the author's previous tool when
 * they disarm, instead of dumping them on a fallback.
 *
 * Persisted like the armed tool is, so reopening the editor still shows what is
 * armed. An id whose blueprint file has since been deleted simply resolves to
 * nothing through `findBlueprint`, which reads as "not armed" everywhere.
 */
export const editorArmedBlueprintIdSignal = createLocalStorageSignal<string | null>(
  'platformer-editor-armed-blueprint',
  null,
);
