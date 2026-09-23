import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals-react';
import { createDebouncedLocalStorageSignal, createLocalStorageSignal } from '@/lib/utils';
import { importLayout, importMarkerGrid } from './importLayout';
import { LEVEL_1_LAYOUT, LEVEL_1_MARKERS } from '../level/level';
import { BLANK_BLUEPRINT } from '../level/BlueprintData';
import type { BackgroundChar, TileChar } from '../level/LevelParser';
import type { MarkerEntry, MarkerGrid } from '../level/LevelData';

export type EditorCanvasMode = 'level' | 'blueprint';
export type EditorLayer = 'foreground' | 'background';
export type EditorAppearance = 'light' | 'dark';

/** The palette's marker tools — a marker kind a click writes to the tile meta
 *  layer. The sign (`T`) and decorative (`⊤`) tools are `TileChar`s, not
 *  `MarkerTool`s: the sign is the one variant tool whose marker kind is not
 *  itself a tool name, and the decorative stalactite writes no marker at all.
 *  `connectionPoint` is offered on the blueprint canvas only (FR-007/FR-010). */
export type MarkerTool = 'patrolBoundary' | 'connectionPoint' | 'fallingStalactite';

/** Every palette tool: a terrain/entity/hazard/sign character, or a marker
 *  tool (FR-013). A pure marker tool writes only its own marker; the sign and
 *  falling-stalactite tools write a terrain character plus their own marker. */
export type EditorTool = TileChar | MarkerTool;

/**
 * Forgiving shape guard for a persisted marker grid — the one untyped
 * boundary (localStorage). Mirrors the "a malformed value costs only that
 * field" policy the terrain/background grids use: an entry that is not
 * `null` and does not look like a `{kind}` marker is dropped.
 */
const isMarkerEntry = (value: unknown): value is MarkerEntry => {
  if (value === null || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return (
    kind === 'patrolBoundary' ||
    kind === 'connectionPoint' ||
    kind === 'fallingStalactite' ||
    (kind === 'sign' && typeof (value as { hintId?: unknown }).hintId === 'string')
  );
};

const isMarkerGrid = (value: unknown): value is MarkerGrid =>
  Array.isArray(value) &&
  value.every(
    (row) =>
      Array.isArray(row) &&
      row.every((cell) => cell === null || cell === undefined || isMarkerEntry(cell)),
  );

/** The unified result of a level or blueprint save. Structurally identical to
 *  the two per-file result types it replaces (`SaveLevelResult`,
 *  `SaveBlueprintResult`). */
export interface SaveResult {
  /** True when the dev server wrote the file into the repository itself. */
  written: boolean;
  /** Repository-relative path of the written file, when it was written. */
  path?: string;
  /** Why the dev server refused, when it answered but declined to write. */
  error?: string;
}

/** The grid + background from immediately before the most recently committed
 *  placement — the one-shot Undo slot. */
export interface PlacementSnapshot {
  grid: TileChar[][];
  background: BackgroundChar[][];
  markers: MarkerGrid;
}

/** Which save last ran and what it did. */
export interface SaveResultState {
  target: 'level' | 'blueprint';
  result: SaveResult;
}

// How long the debounced storage write waits after the last grid/background
// change — long enough that a rapid drag-paint session writes once at the end
// instead of on every cell, short enough that closing the tab moments after
// the last stroke still persists it.
export const EDITOR_STORAGE_DEBOUNCE_MS = 400;

/**
 * The Level Editor's state — the single home for every editor value (FR-016).
 * The persisted signals keep the exact storage keys `editorLevelState.ts` used
 * (FR-022); the grids and background-placement lists write to localStorage on
 * a debounce while the signal itself stays the immediate source of truth
 * (FR-017, FR-018).
 */
export const editorLevelSignal = createDebouncedLocalStorageSignal<TileChar[][]>(
  'platformer-editor-level',
  importLayout(LEVEL_1_LAYOUT),
  EDITOR_STORAGE_DEBOUNCE_MS,
);

export const editorSelectedToolSignal = createLocalStorageSignal<EditorTool>(
  'platformer-editor-selected-tool',
  'G',
);

export const editorMarkerSignal = createDebouncedLocalStorageSignal<MarkerGrid>(
  'platformer-editor-markers',
  importMarkerGrid(LEVEL_1_LAYOUT, LEVEL_1_MARKERS),
  EDITOR_STORAGE_DEBOUNCE_MS,
  isMarkerGrid,
);

export const editorLoadedLevelNameSignal = createLocalStorageSignal<string>(
  'platformer-editor-loaded-level',
  'main',
);

export const editorDirtySignal = createLocalStorageSignal<boolean>('platformer-editor-dirty', false);

export const editorBackgroundSignal = createDebouncedLocalStorageSignal<BackgroundChar[][]>(
  'platformer-editor-background',
  [],
  EDITOR_STORAGE_DEBOUNCE_MS,
);

export const editorActiveLayerSignal = createLocalStorageSignal<EditorLayer>(
  'platformer-editor-active-layer',
  'foreground',
);

export const editorSelectedBackgroundMaterialSignal = createLocalStorageSignal<BackgroundChar | null>(
  'platformer-editor-selected-background-piece',
  null,
);

export const editorCanvasModeSignal = createLocalStorageSignal<EditorCanvasMode>(
  'platformer-editor-canvas-mode',
  'level',
);

/**
 * The editor's own light/dark look, persisted under its own key and validated
 * against the two literals. Defaults to 'light'; an absent or invalid stored
 * value also resolves to 'light' (O-015 FR-003). It is deliberately independent
 * of the site-wide `currentTheme` (FR-004, SC-007).
 */
export const editorAppearanceSignal = createLocalStorageSignal<EditorAppearance>(
  'platformer-editor-appearance',
  'light',
  (value): value is EditorAppearance => value === 'light' || value === 'dark',
);

export const editorBlueprintSignal = createDebouncedLocalStorageSignal<TileChar[][]>(
  'platformer-editor-blueprint',
  importLayout(BLANK_BLUEPRINT.layout),
  EDITOR_STORAGE_DEBOUNCE_MS,
);

export const editorBlueprintBackgroundSignal = createDebouncedLocalStorageSignal<BackgroundChar[][]>(
  'platformer-editor-blueprint-background',
  [],
  EDITOR_STORAGE_DEBOUNCE_MS,
);

export const editorBlueprintMarkerSignal = createDebouncedLocalStorageSignal<MarkerGrid>(
  'platformer-editor-blueprint-markers',
  importMarkerGrid(BLANK_BLUEPRINT.layout, BLANK_BLUEPRINT.markers),
  EDITOR_STORAGE_DEBOUNCE_MS,
  isMarkerGrid,
);

export const editorLoadedBlueprintNameSignal = createLocalStorageSignal<string>(
  'platformer-editor-loaded-blueprint',
  BLANK_BLUEPRINT.name,
);

export const editorArmedBlueprintIdSignal = createLocalStorageSignal<string | null>(
  'platformer-editor-armed-blueprint',
  null,
);

// Non-persisted signals — values that used to be page-local `useState`. They
// deliberately do NOT survive a reload, matching their previous lifetimes.

/** The blueprint canvas's own dirty flag, separate from the level's. */
export const editorBlueprintDirtySignal: Signal<boolean> = signal(false);

/** The one-shot Undo slot; `null` once anything other than the placement it
 *  records has happened. */
export const editorLastPlacementSnapshotSignal: Signal<PlacementSnapshot | null> = signal(null);

/** Which save last ran and what it did; cleared by any paint/load. */
export const editorSaveResultSignal: Signal<SaveResultState | null> = signal(null);

/** Bumped to ask `EditorCanvas` to re-center on the spawn. Starts at 1 so
 *  opening the editor is itself a request. */
export const editorCenterRequestIdSignal: Signal<number> = signal(1);

/** The "level still owes itself a centering" debt paid on the first switch
 *  back to Level. Seeded from the mount-time canvas mode: mounting already in
 *  blueprint mode lets that canvas consume the one-shot centering request, so
 *  the level still owes itself one (design note 5). */
export const editorLevelCenterPendingSignal: Signal<boolean> = signal(
  editorCanvasModeSignal.value === 'blueprint',
);

// Derived signals — every `isBlueprintMode ? x : y` ternary in one place.

export const editorIsBlueprintModeSignal: ReadonlySignal<boolean> = computed(
  () => editorCanvasModeSignal.value === 'blueprint',
);

export const editorGridSignal: ReadonlySignal<TileChar[][]> = computed(() =>
  editorCanvasModeSignal.value === 'blueprint' ? editorBlueprintSignal.value : editorLevelSignal.value,
);

/** The active canvas's background grid — "placements" no longer exist as a
 *  concept post-O-014, hence the rename from `editorBackgroundPlacementsSignal`. */
export const editorBackgroundGridSignal: ReadonlySignal<BackgroundChar[][]> = computed(() =>
  editorCanvasModeSignal.value === 'blueprint'
    ? editorBlueprintBackgroundSignal.value
    : editorBackgroundSignal.value,
);

/** The active canvas's tile meta layer — the marker analogue of
 *  `editorBackgroundGridSignal`. */
export const editorMarkerGridSignal: ReadonlySignal<MarkerGrid> = computed(() =>
  editorCanvasModeSignal.value === 'blueprint'
    ? editorBlueprintMarkerSignal.value
    : editorMarkerSignal.value,
);

export const editorActiveDirtySignal: ReadonlySignal<boolean> = computed(() =>
  editorCanvasModeSignal.value === 'blueprint'
    ? editorBlueprintDirtySignal.value
    : editorDirtySignal.value,
);
