import type { Signal } from '@preact/signals-react';
import { importLayout } from './importLayout';
import { blueprintCells } from './blueprintCells';
import { blueprintFits } from './blueprintFit';
import { placeBlueprint, rebaseBlueprintBackground } from './placeBlueprint';
import { cropLevelForExport } from './cropLevelForExport';
import { saveLevel } from './saveLevelFile';
import { saveBlueprint } from './saveBlueprintFile';
import { findBlueprint } from '../level/blueprintRegistry';
import { backgroundCatalogEntry } from '../engine/BackgroundCatalog';
import { currentLayout, currentBackground } from '../level/level';
import type { LevelEntry } from '../level/levelRegistry';
import type { Blueprint } from '../level/BlueprintData';
import type { BackgroundPlacement, BackgroundPieceId } from '../level/LevelData';
import type { TileChar } from '../level/LevelParser';
import type { PaintResult } from './paintCell';
import { resetGameProgress } from '../PlatformerState';
import { currentTheme } from '@/state/theme';
import { navigateTo } from '@/state/navigation';
import {
  editorActiveLayerSignal,
  editorAppearanceSignal,
  editorArmedBlueprintIdSignal,
  editorBackgroundSignal,
  editorBlueprintBackgroundSignal,
  editorBlueprintDirtySignal,
  editorBlueprintSignal,
  editorCanvasModeSignal,
  editorCenterRequestIdSignal,
  editorDirtySignal,
  editorLastPlacementSnapshotSignal,
  editorLevelCenterPendingSignal,
  editorLevelSignal,
  editorLoadedBlueprintNameSignal,
  editorLoadedLevelNameSignal,
  editorSaveResultSignal,
  editorSelectedBackgroundPieceSignal,
  editorSelectedToolSignal,
  type EditorAppearance,
  type EditorCanvasMode,
  type EditorLayer,
} from './editorState';

export interface GrowthShift {
  colShift: number;
  rowShift: number;
}

// Blueprint mode has no Spawn tool and level mode has no Connection Point tool
// (Palette.tsx), so an already-armed one of either is swapped for this when the
// canvas it does not belong to becomes active.
const SPAWN_CHAR: TileChar = 'S';
const CONNECTION_POINT_CHAR: TileChar = '+';
const FALLBACK_TOOL: TileChar = 'G';

/** Shifts a background-placement list in place by a grid growth, mirroring the
 *  `growGrid` shift that moved every foreground cell. */
const shiftBackgroundPlacements = (
  target: Signal<BackgroundPlacement[]>,
  colShift: number,
  rowShift: number,
): void => {
  if (colShift === 0 && rowShift === 0) return;
  target.value = target.value.map((placement) => ({
    ...placement,
    col: placement.col + colShift,
    row: placement.row + rowShift,
  }));
};

// --- Selection / toggles -----------------------------------------------------

/** Selecting a tile tool is unambiguously "I want to paint again", so it
 *  disarms any armed blueprint. The reverse is deliberately not true: arming a
 *  blueprint leaves `selectedTool` alone so disarming restores it. */
export const selectTool = (tool: TileChar): void => {
  editorSelectedToolSignal.value = tool;
  editorArmedBlueprintIdSignal.value = null;
};

export const selectBackgroundPiece = (pieceId: BackgroundPieceId): void => {
  editorSelectedBackgroundPieceSignal.value = pieceId;
};

export const setActiveLayer = (layer: EditorLayer): void => {
  editorActiveLayerSignal.value = layer;
};

export const setCanvasMode = (mode: EditorCanvasMode): void => {
  editorCanvasModeSignal.value = mode;

  if (mode === 'blueprint' && editorSelectedToolSignal.value === SPAWN_CHAR) {
    selectTool(FALLBACK_TOOL);
  }
  if (mode === 'level' && editorSelectedToolSignal.value === CONNECTION_POINT_CHAR) {
    selectTool(FALLBACK_TOOL);
  }
  if (mode === 'level' && editorLevelCenterPendingSignal.value) {
    editorLevelCenterPendingSignal.value = false;
    editorCenterRequestIdSignal.value += 1;
  }
  // Placement targets the level grid only — nesting a blueprint inside a
  // blueprint is out of scope.
  if (mode === 'blueprint') editorArmedBlueprintIdSignal.value = null;
};

/** Arms (or, when it is already the armed id, disarms) a blueprint. */
export const armBlueprint = (id: string | null): void => {
  const next = id !== null && editorArmedBlueprintIdSignal.value === id ? null : id;
  editorArmedBlueprintIdSignal.value = next;
};

/** One-shot mount-time reconciliation of persisted state: the mode and the
 *  selected tool/armed blueprint are all persisted, so the editor can come back
 *  up on either canvas with the other canvas's exclusive tool still armed
 *  without any toggle click ever happening. */
export const reconcilePersistedEditorState = (): void => {
  // Mounting already in blueprint mode lets that canvas consume the one-shot
  // centering request (a no-op on a spawn-less grid), so the level owes itself
  // a centering to be paid on the FIRST switch back to Level.
  editorLevelCenterPendingSignal.value = editorCanvasModeSignal.value === 'blueprint';

  if (editorCanvasModeSignal.value === 'blueprint' && editorSelectedToolSignal.value === SPAWN_CHAR) {
    editorSelectedToolSignal.value = FALLBACK_TOOL;
  }
  if (
    editorCanvasModeSignal.value === 'level' &&
    editorSelectedToolSignal.value === CONNECTION_POINT_CHAR
  ) {
    editorSelectedToolSignal.value = FALLBACK_TOOL;
  }
  if (editorCanvasModeSignal.value === 'blueprint' && editorArmedBlueprintIdSignal.value !== null) {
    editorArmedBlueprintIdSignal.value = null;
  }
};

// --- Appearance --------------------------------------------------------------

/** Writes the editor's own light/dark appearance; the signal's subscription
 *  persists it immediately (a single scalar, so no debounce). */
export const setEditorAppearance = (appearance: EditorAppearance): void => {
  editorAppearanceSignal.value = appearance;
};

/** Flips the editor's appearance between light and dark (O-015 FR-001). */
export const toggleEditorAppearance = (): void => {
  editorAppearanceSignal.value = editorAppearanceSignal.value === 'dark' ? 'light' : 'dark';
};

// --- Canvas ------------------------------------------------------------------

/** Writes a paint result into the active canvas, marks it dirty, clears the
 *  save result and placement snapshot, and shifts any background placements by
 *  the growth. Returns the shift so the pane (owner of the transient pan) can
 *  compensate the viewport. */
export const applyPaint = (result: PaintResult): GrowthShift => {
  const { grid, colShift, rowShift } = result;

  if (editorCanvasModeSignal.value === 'blueprint') {
    editorBlueprintSignal.value = grid;
    editorBlueprintDirtySignal.value = true;
    shiftBackgroundPlacements(editorBlueprintBackgroundSignal, colShift, rowShift);
    return { colShift, rowShift };
  }

  editorLevelSignal.value = grid;
  if (!editorDirtySignal.value) editorDirtySignal.value = true;
  editorSaveResultSignal.value = null;
  shiftBackgroundPlacements(editorBackgroundSignal, colShift, rowShift);
  editorLastPlacementSnapshotSignal.value = null;
  return { colShift, rowShift };
};

export const applyBackgroundPaint = (next: BackgroundPlacement[]): void => {
  if (editorCanvasModeSignal.value === 'blueprint') {
    editorBlueprintBackgroundSignal.value = next;
    editorBlueprintDirtySignal.value = true;
    return;
  }

  editorBackgroundSignal.value = next;
  if (!editorDirtySignal.value) editorDirtySignal.value = true;
  editorSaveResultSignal.value = null;
  editorLastPlacementSnapshotSignal.value = null;
};

/** Commits an armed blueprint at `(col, row)`. Refuses (returns `null`, writes
 *  nothing) when nothing is armed or the blueprint does not fit; snapshots
 *  grid + background before writing and keeps the blueprint armed. */
export const commitPlacement = (col: number, row: number): GrowthShift | null => {
  const armedId = editorArmedBlueprintIdSignal.value;
  const armedBlueprint = armedId === null ? undefined : findBlueprint(armedId);
  if (armedBlueprint === undefined) return null;

  const armedCells = blueprintCells(armedBlueprint.layout);
  const grid = editorLevelSignal.value;
  if (!blueprintFits(grid, armedCells, col, row)) return null;

  editorLastPlacementSnapshotSignal.value = {
    grid,
    background: editorBackgroundSignal.value,
  };

  const result = placeBlueprint(grid, armedCells, col, row);
  editorLevelSignal.value = result.grid;
  if (!editorDirtySignal.value) editorDirtySignal.value = true;
  editorSaveResultSignal.value = null;

  // Order matters: shift the placements the level ALREADY had by the growth,
  // then append the blueprint's own rebased with that same shift already folded
  // in — appending first would shift them twice.
  shiftBackgroundPlacements(editorBackgroundSignal, result.colShift, result.rowShift);
  const rebased = rebaseBlueprintBackground(
    armedBlueprint.background ?? [],
    col + result.colShift,
    row + result.rowShift,
  );
  if (rebased.length > 0) {
    editorBackgroundSignal.value = [...editorBackgroundSignal.value, ...rebased];
  }

  return { colShift: result.colShift, rowShift: result.rowShift };
};

/** Restores the grid and background from immediately before the most recently
 *  committed placement. A no-op with no snapshot. */
export const undoLastPlacement = (): void => {
  const snapshot = editorLastPlacementSnapshotSignal.value;
  if (snapshot === null) return;
  editorLevelSignal.value = snapshot.grid;
  editorBackgroundSignal.value = snapshot.background;
  editorLastPlacementSnapshotSignal.value = null;
};

// --- File / navigation -------------------------------------------------------

/** Loads a level onto the level canvas. Writes the persisted signals directly
 *  (not only through the debounce) so a pending write cannot resurrect
 *  discarded work. */
export const loadLevel = (level: LevelEntry): void => {
  const levelGrid = importLayout(level.layout);
  editorLevelSignal.value = levelGrid;

  if (editorCanvasModeSignal.value === 'blueprint') {
    editorLevelCenterPendingSignal.value = true;
  } else {
    editorCenterRequestIdSignal.value += 1;
  }

  // A placement whose pieceId no longer resolves would render as nothing and
  // be permanently un-erasable, so drop it once at load time.
  const validBackground = (level.background ?? []).filter(
    (placement) => backgroundCatalogEntry(placement.pieceId) !== undefined,
  );
  editorBackgroundSignal.value = validBackground;
  editorLoadedLevelNameSignal.value = level.name;
  editorDirtySignal.value = false;
  editorSaveResultSignal.value = null;
  editorLastPlacementSnapshotSignal.value = null;
};

export const loadBlueprint = (blueprint: Blueprint): void => {
  const grid = importLayout(blueprint.layout);
  editorBlueprintSignal.value = grid;
  const background = [...(blueprint.background ?? [])];
  editorBlueprintBackgroundSignal.value = background;
  editorLoadedBlueprintNameSignal.value = blueprint.name;
  editorBlueprintDirtySignal.value = false;
};

export const saveCurrentLevel = async (name: string): Promise<void> => {
  const cropped = cropLevelForExport(editorLevelSignal.value, editorBackgroundSignal.value);
  const result = await saveLevel(name, cropped.layout, cropped.background);
  editorSaveResultSignal.value = { target: 'level', result };
  editorLoadedLevelNameSignal.value = name;
  editorDirtySignal.value = false;
};

export const saveCurrentBlueprint = async (name: string): Promise<void> => {
  const cropped = cropLevelForExport(editorBlueprintSignal.value, editorBlueprintBackgroundSignal.value);
  const result = await saveBlueprint(name, cropped.layout, cropped.background);
  editorSaveResultSignal.value = { target: 'blueprint', result };
  editorLoadedBlueprintNameSignal.value = name;
  editorBlueprintDirtySignal.value = false;
};

/** Exports the level into the in-memory layout the game reads, resets game
 *  progress, and navigates into the game with the debug panel visible. */
export const tryLayout = (): void => {
  const cropped = cropLevelForExport(editorLevelSignal.value, editorBackgroundSignal.value);
  currentLayout.value = cropped.layout;
  currentBackground.value = cropped.background;
  resetGameProgress();
  currentTheme.value = 'platformer';
  navigateTo('/platformer?debug=1');
};
