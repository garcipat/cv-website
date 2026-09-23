import type { Signal } from '@preact/signals-react';
import { importLayout, importBackgroundLayout, importMarkerGrid } from './importLayout';
import { blueprintCells } from './blueprintCells';
import { blueprintFits } from './blueprintFit';
import {
  placeBlueprint,
  placeBlueprintMarkers,
  blueprintMarkers,
  rebaseBlueprintBackground,
} from './placeBlueprint';
import { cropLevelForExport } from './cropLevelForExport';
import { saveLevel } from './saveLevelFile';
import { saveBlueprint } from './saveBlueprintFile';
import { findBlueprint } from '../level/blueprintRegistry';
import { currentLayout, currentBackgroundLayout, currentMarkers } from '../level/level';
import type { LevelEntry } from '../level/levelRegistry';
import type { Blueprint } from '../level/BlueprintData';
import type { BackgroundChar, TileChar } from '../level/LevelParser';
import type { MarkerGrid } from '../level/LevelData';
import { shiftMarkerGrid as shiftMarkerGridPure, resizeMarkerGrid } from './paintMarkerCell';
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
  editorBlueprintMarkerSignal,
  editorBlueprintSignal,
  editorCanvasModeSignal,
  editorCenterRequestIdSignal,
  editorDirtySignal,
  editorLastPlacementSnapshotSignal,
  editorLevelCenterPendingSignal,
  editorLevelSignal,
  editorLoadedBlueprintNameSignal,
  editorLoadedLevelNameSignal,
  editorMarkerSignal,
  editorSaveResultSignal,
  editorSelectedBackgroundMaterialSignal,
  editorSelectedToolSignal,
  type EditorAppearance,
  type EditorCanvasMode,
  type EditorLayer,
  type EditorTool,
} from './editorState';

export interface GrowthShift {
  colShift: number;
  rowShift: number;
}

// Blueprint mode has no Spawn tool and level mode has no Connection Point tool
// (Palette.tsx), so an already-armed one of either is swapped for this when the
// canvas it does not belong to becomes active.
const SPAWN_CHAR: TileChar = 'S';
const FALLBACK_TOOL: EditorTool = 'G';

/**
 * Shifts a background grid in place by a foreground grid growth, by inserting
 * empty rows/columns at the start (a leftward/upward growth) or simply
 * leaving the grid's own array alone (a rightward/downward growth needs no
 * shift — new foreground cells appended past the background grid's own
 * bounds already read as `null` via `backgroundAt`). Renamed from
 * `shiftBackgroundPlacements` (there is no longer a placement list to shift —
 * a grid grows, it doesn't shift discrete placements) and reimplemented as an
 * array/row-shift over `BackgroundGrid` rather than a per-placement
 * coordinate rebase.
 */
const shiftBackgroundGrid = (
  target: Signal<BackgroundChar[][]>,
  colShift: number,
  rowShift: number,
): void => {
  if (colShift === 0 && rowShift === 0) return;
  const grid = target.value;
  const shiftedRows = grid.map((row) => [...new Array<BackgroundChar>(colShift).fill('.'), ...row]);
  const newWidth = (grid[0]?.length ?? 0) + colShift;
  const emptyRow = (): BackgroundChar[] => new Array<BackgroundChar>(newWidth).fill('.');
  target.value = [...Array.from({ length: rowShift }, emptyRow), ...shiftedRows];
};

/**
 * The marker grid's own analogue of `shiftBackgroundGrid` (D9): a left/up
 * growth prepends empty rows/columns so every marker keeps its cell, and a
 * right/down growth needs no shift. Marker paint itself never grows, so this
 * is only ever called from a terrain growth (a paint or a placement).
 */
const shiftMarkerGrid = (
  target: Signal<MarkerGrid>,
  colShift: number,
  rowShift: number,
  width: number,
  height: number,
): void => {
  const shifted = shiftMarkerGridPure(target.value, colShift, rowShift);
  const resized = resizeMarkerGrid(shifted, width, height);
  if (resized !== target.value) target.value = resized;
};

// --- Selection / toggles -----------------------------------------------------

/** Selecting a tool is unambiguously "I want to paint again", so it
 *  disarms any armed blueprint. The reverse is deliberately not true: arming a
 *  blueprint leaves `selectedTool` alone so disarming restores it. */
export const selectTool = (tool: EditorTool): void => {
  editorSelectedToolSignal.value = tool;
  editorArmedBlueprintIdSignal.value = null;
};

export const selectBackgroundMaterial = (material: BackgroundChar): void => {
  editorSelectedBackgroundMaterialSignal.value = material;
};

export const setActiveLayer = (layer: EditorLayer): void => {
  editorActiveLayerSignal.value = layer;
};

export const setCanvasMode = (mode: EditorCanvasMode): void => {
  editorCanvasModeSignal.value = mode;

  if (mode === 'blueprint' && editorSelectedToolSignal.value === SPAWN_CHAR) {
    selectTool(FALLBACK_TOOL);
  }
  if (mode === 'level' && editorSelectedToolSignal.value === 'connectionPoint') {
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
    editorSelectedToolSignal.value === 'connectionPoint'
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
    shiftBackgroundGrid(editorBlueprintBackgroundSignal, colShift, rowShift);
    shiftMarkerGrid(
      editorBlueprintMarkerSignal,
      colShift,
      rowShift,
      grid[0]?.length ?? 0,
      grid.length,
    );
    return { colShift, rowShift };
  }

  editorLevelSignal.value = grid;
  if (!editorDirtySignal.value) editorDirtySignal.value = true;
  editorSaveResultSignal.value = null;
  shiftBackgroundGrid(editorBackgroundSignal, colShift, rowShift);
  shiftMarkerGrid(editorMarkerSignal, colShift, rowShift, grid[0]?.length ?? 0, grid.length);
  editorLastPlacementSnapshotSignal.value = null;
  return { colShift, rowShift };
};

/**
 * Writes the active canvas's marker grid, marks it dirty, and clears the save
 * result and placement snapshot. There is no `GrowthShift` because marker
 * paint never grows the grid (FR-010) — the caller writes a terrain growth's
 * shift through `applyPaint` first, then calls this at the post-growth
 * coordinates (D8's ordering invariant).
 */
export const applyMarkerPaint = (next: MarkerGrid): void => {
  if (editorCanvasModeSignal.value === 'blueprint') {
    editorBlueprintMarkerSignal.value = next;
    editorBlueprintDirtySignal.value = true;
    return;
  }

  editorMarkerSignal.value = next;
  if (!editorDirtySignal.value) editorDirtySignal.value = true;
  editorSaveResultSignal.value = null;
  editorLastPlacementSnapshotSignal.value = null;
};

export const applyBackgroundPaint = (next: BackgroundChar[][]): void => {
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
    markers: editorMarkerSignal.value,
  };

  const result = placeBlueprint(grid, armedCells, col, row);
  editorLevelSignal.value = result.grid;
  if (!editorDirtySignal.value) editorDirtySignal.value = true;
  editorSaveResultSignal.value = null;

  // Order matters: shift the grid the level ALREADY had by the growth, then
  // stamp the blueprint's own background at that same shift already folded
  // in — stamping first would shift it twice.
  shiftBackgroundGrid(editorBackgroundSignal, result.colShift, result.rowShift);
  editorBackgroundSignal.value = rebaseBlueprintBackground(
    editorBackgroundSignal.value,
    importBackgroundLayout(armedBlueprint.background ?? []),
    col + result.colShift,
    row + result.rowShift,
  );

  // Same ordering for markers: shift first, then stamp at the post-growth
  // anchor, overwriting (FR-018/FR-020).
  shiftMarkerGrid(
    editorMarkerSignal,
    result.colShift,
    result.rowShift,
    result.grid[0]?.length ?? 0,
    result.grid.length,
  );
  editorMarkerSignal.value = placeBlueprintMarkers(
    editorMarkerSignal.value,
    blueprintMarkers(armedBlueprint),
    col + result.colShift,
    row + result.rowShift,
  );

  return { colShift: result.colShift, rowShift: result.rowShift };
};

/** Restores the grid, background and markers from immediately before the most
 *  recently committed placement. A no-op with no snapshot. */
export const undoLastPlacement = (): void => {
  const snapshot = editorLastPlacementSnapshotSignal.value;
  if (snapshot === null) return;
  editorLevelSignal.value = snapshot.grid;
  editorBackgroundSignal.value = snapshot.background;
  editorMarkerSignal.value = snapshot.markers;
  editorLastPlacementSnapshotSignal.value = null;
};

// --- File / navigation -------------------------------------------------------

/** Loads a level onto the level canvas. Writes the persisted signals directly
 *  (not only through the debounce) so a pending write cannot resurrect
 *  discarded work. */
export const loadLevel = (level: LevelEntry): void => {
  // A file with no `markers` field is pre-feature, so its `T` is the old
  // falling-stalactite hazard and must migrate to `⊤` (the `T` generation
  // rule, D5). A new-format file's `T` stays the sign character.
  const legacyT = level.markers === undefined;
  const levelGrid = importLayout(level.layout, legacyT);
  editorLevelSignal.value = levelGrid;
  editorMarkerSignal.value = importMarkerGrid(level.layout, level.markers);

  if (editorCanvasModeSignal.value === 'blueprint') {
    editorLevelCenterPendingSignal.value = true;
  } else {
    editorCenterRequestIdSignal.value += 1;
  }

  // A character no longer a recognized BACKGROUND_CHARS key would render as
  // nothing and be permanently un-erasable, so drop it once at load time
  // (FR-012) rather than at every render — importBackgroundLayout already
  // does this.
  editorBackgroundSignal.value = importBackgroundLayout(level.background ?? []);
  editorLoadedLevelNameSignal.value = level.name;
  editorDirtySignal.value = false;
  editorSaveResultSignal.value = null;
  editorLastPlacementSnapshotSignal.value = null;
};

export const loadBlueprint = (blueprint: Blueprint): void => {
  const legacyT = blueprint.markers === undefined;
  const grid = importLayout(blueprint.layout, legacyT);
  editorBlueprintSignal.value = grid;
  editorBlueprintBackgroundSignal.value = importBackgroundLayout(blueprint.background ?? []);
  editorBlueprintMarkerSignal.value = importMarkerGrid(blueprint.layout, blueprint.markers);
  editorLoadedBlueprintNameSignal.value = blueprint.name;
  editorBlueprintDirtySignal.value = false;
};

export const saveCurrentLevel = async (name: string): Promise<void> => {
  const cropped = cropLevelForExport(
    editorLevelSignal.value,
    editorBackgroundSignal.value,
    editorMarkerSignal.value,
  );
  const result = await saveLevel(name, cropped.layout, cropped.background, cropped.markers);
  editorSaveResultSignal.value = { target: 'level', result };
  editorLoadedLevelNameSignal.value = name;
  editorDirtySignal.value = false;
};

export const saveCurrentBlueprint = async (name: string): Promise<void> => {
  const cropped = cropLevelForExport(
    editorBlueprintSignal.value,
    editorBlueprintBackgroundSignal.value,
    editorBlueprintMarkerSignal.value,
  );
  const result = await saveBlueprint(name, cropped.layout, cropped.background, cropped.markers);
  editorSaveResultSignal.value = { target: 'blueprint', result };
  editorLoadedBlueprintNameSignal.value = name;
  editorBlueprintDirtySignal.value = false;
};

/** Exports the level into the in-memory layout the game reads, resets game
 *  progress, and navigates into the game with the debug panel visible. */
export const tryLayout = (): void => {
  const cropped = cropLevelForExport(
    editorLevelSignal.value,
    editorBackgroundSignal.value,
    editorMarkerSignal.value,
  );
  currentLayout.value = cropped.layout;
  currentBackgroundLayout.value = cropped.background;
  currentMarkers.value = cropped.markers;
  resetGameProgress();
  currentTheme.value = 'platformer';
  navigateTo('/platformer?debug=1');
};
