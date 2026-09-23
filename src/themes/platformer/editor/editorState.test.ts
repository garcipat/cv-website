import { describe, it, expect, afterEach, vi } from 'vitest';
import type { Signal } from '@preact/signals-react';
import { importLayout, importMarkerGrid } from './importLayout';
import { LEVEL_1_LAYOUT, LEVEL_1_MARKERS } from '../level/level';
import { BLANK_BLUEPRINT } from '../level/BlueprintData';
import {
  EDITOR_STORAGE_DEBOUNCE_MS,
  editorActiveDirtySignal,
  editorActiveLayerSignal,
  editorArmedBlueprintIdSignal,
  editorBackgroundGridSignal,
  editorBackgroundSignal,
  editorBlueprintBackgroundSignal,
  editorBlueprintDirtySignal,
  editorBlueprintSignal,
  editorCanvasModeSignal,
  editorCenterRequestIdSignal,
  editorDirtySignal,
  editorGridSignal,
  editorIsBlueprintModeSignal,
  editorLastPlacementSnapshotSignal,
  editorLevelCenterPendingSignal,
  editorLevelSignal,
  editorLoadedBlueprintNameSignal,
  editorLoadedLevelNameSignal,
  editorMarkerGridSignal,
  editorMarkerSignal,
  editorBlueprintMarkerSignal,
  editorSaveResultSignal,
  editorSelectedBackgroundMaterialSignal,
  editorSelectedToolSignal,
} from './editorState';

/** Writes `value`, flushes the debounced storage write when needed, and asserts
 *  the exact key round-trips. */
function expectRoundTrip<T>(sig: Signal<T>, key: string, value: T, debounced = false): void {
  sig.value = value;
  if (debounced) vi.advanceTimersByTime(EDITOR_STORAGE_DEBOUNCE_MS);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(value);
}

describe('editorState — persisted signal defaults', () => {
  it('levelGrid-defaultsToTheImportedDefaultLayout', () => {
    expect(editorLevelSignal.value).toEqual(importLayout(LEVEL_1_LAYOUT));
  });

  it('selectedTool-defaultsToGroundGrass', () => {
    expect(editorSelectedToolSignal.value).toBe('G');
  });

  it('loadedLevelName-defaultsToMain', () => {
    expect(editorLoadedLevelNameSignal.value).toBe('main');
  });

  it('dirty-defaultsToFalse', () => {
    expect(editorDirtySignal.value).toBe(false);
  });

  it('background-defaultsToAnEmptyGrid', () => {
    expect(editorBackgroundSignal.value).toEqual([]);
  });

  it('activeLayer-defaultsToForeground', () => {
    expect(editorActiveLayerSignal.value).toBe('foreground');
  });

  it('selectedBackgroundMaterial-defaultsToNull', () => {
    expect(editorSelectedBackgroundMaterialSignal.value).toBeNull();
  });

  it('canvasMode-defaultsToLevel', () => {
    expect(editorCanvasModeSignal.value).toBe('level');
  });

  it('blueprintGrid-defaultsToASingleEmptyCell', () => {
    expect(editorBlueprintSignal.value).toEqual(importLayout(BLANK_BLUEPRINT.layout));
  });

  it('blueprintBackground-defaultsToAnEmptyGrid', () => {
    expect(editorBlueprintBackgroundSignal.value).toEqual([]);
  });

  it('loadedBlueprintName-defaultsToTheBlankEntrysName', () => {
    expect(editorLoadedBlueprintNameSignal.value).toBe(BLANK_BLUEPRINT.name);
  });

  it('armedBlueprintId-defaultsToNull', () => {
    expect(editorArmedBlueprintIdSignal.value).toBeNull();
  });
});

describe('editorState — non-persisted signal defaults', () => {
  it('blueprintDirty-defaultsToFalse', () => {
    expect(editorBlueprintDirtySignal.value).toBe(false);
  });

  it('lastPlacementSnapshot-defaultsToNull', () => {
    expect(editorLastPlacementSnapshotSignal.value).toBeNull();
  });

  it('saveResult-defaultsToNull', () => {
    expect(editorSaveResultSignal.value).toBeNull();
  });

  it('centerRequestId-defaultsTo1SoOpeningTheEditorIsItselfARequest', () => {
    expect(editorCenterRequestIdSignal.value).toBe(1);
  });

  it('levelCenterPending-defaultsToFalse', () => {
    expect(editorLevelCenterPendingSignal.value).toBe(false);
  });
});

describe('editorState — storage-key round-trips (FR-022, SC-006)', () => {
  const originals = {
    level: editorLevelSignal.value,
    tool: editorSelectedToolSignal.value,
    loadedLevel: editorLoadedLevelNameSignal.value,
    dirty: editorDirtySignal.value,
    background: editorBackgroundSignal.value,
    activeLayer: editorActiveLayerSignal.value,
    selectedMaterial: editorSelectedBackgroundMaterialSignal.value,
    canvasMode: editorCanvasModeSignal.value,
    blueprint: editorBlueprintSignal.value,
    blueprintBackground: editorBlueprintBackgroundSignal.value,
    loadedBlueprint: editorLoadedBlueprintNameSignal.value,
    armed: editorArmedBlueprintIdSignal.value,
    levelMarkers: editorMarkerSignal.value,
    blueprintMarkers: editorBlueprintMarkerSignal.value,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    editorLevelSignal.value = originals.level;
    editorSelectedToolSignal.value = originals.tool;
    editorLoadedLevelNameSignal.value = originals.loadedLevel;
    editorDirtySignal.value = originals.dirty;
    editorBackgroundSignal.value = originals.background;
    editorActiveLayerSignal.value = originals.activeLayer;
    editorSelectedBackgroundMaterialSignal.value = originals.selectedMaterial;
    editorCanvasModeSignal.value = originals.canvasMode;
    editorBlueprintSignal.value = originals.blueprint;
    editorBlueprintBackgroundSignal.value = originals.blueprintBackground;
    editorLoadedBlueprintNameSignal.value = originals.loadedBlueprint;
    editorArmedBlueprintIdSignal.value = originals.armed;
    editorMarkerSignal.value = originals.levelMarkers;
    editorBlueprintMarkerSignal.value = originals.blueprintMarkers;
    vi.advanceTimersByTime(EDITOR_STORAGE_DEBOUNCE_MS);
    vi.useRealTimers();
  });

  it('editorLevelSignal-persistsUnderPlatformerEditorLevel', () => {
    expectRoundTrip(editorLevelSignal, 'platformer-editor-level', importLayout(['GGG']), true);
  });

  it('editorMarkerSignal-persistsUnderPlatformerEditorMarkers', () => {
    expectRoundTrip(
      editorMarkerSignal,
      'platformer-editor-markers',
      [[{ kind: 'patrolBoundary' }, null]],
      true,
    );
  });

  it('editorBlueprintMarkerSignal-persistsUnderPlatformerEditorBlueprintMarkers', () => {
    expectRoundTrip(
      editorBlueprintMarkerSignal,
      'platformer-editor-blueprint-markers',
      [[null, { kind: 'connectionPoint' }]],
      true,
    );
  });

  it('editorSelectedToolSignal-persistsUnderPlatformerEditorSelectedTool', () => {
    expectRoundTrip(editorSelectedToolSignal, 'platformer-editor-selected-tool', 'M');
  });

  it('editorLoadedLevelNameSignal-persistsUnderPlatformerEditorLoadedLevel', () => {
    expectRoundTrip(editorLoadedLevelNameSignal, 'platformer-editor-loaded-level', 'cave-run');
  });

  it('editorDirtySignal-persistsUnderPlatformerEditorDirty', () => {
    expectRoundTrip(editorDirtySignal, 'platformer-editor-dirty', true);
  });

  it('editorBackgroundSignal-persistsUnderPlatformerEditorBackground', () => {
    expectRoundTrip(
      editorBackgroundSignal,
      'platformer-editor-background',
      [['.', 'd']],
      true,
    );
  });

  it('editorActiveLayerSignal-persistsUnderPlatformerEditorActiveLayer', () => {
    expectRoundTrip(editorActiveLayerSignal, 'platformer-editor-active-layer', 'background');
  });

  it('editorSelectedBackgroundMaterialSignal-persistsUnderPlatformerEditorSelectedBackgroundPiece', () => {
    expectRoundTrip(
      editorSelectedBackgroundMaterialSignal,
      'platformer-editor-selected-background-piece',
      'c',
    );
  });

  it('editorCanvasModeSignal-persistsUnderPlatformerEditorCanvasMode', () => {
    expectRoundTrip(editorCanvasModeSignal, 'platformer-editor-canvas-mode', 'blueprint');
  });

  it('editorBlueprintSignal-persistsUnderPlatformerEditorBlueprint', () => {
    expectRoundTrip(editorBlueprintSignal, 'platformer-editor-blueprint', importLayout(['##']), true);
  });

  it('editorBlueprintBackgroundSignal-persistsUnderPlatformerEditorBlueprintBackground', () => {
    expectRoundTrip(
      editorBlueprintBackgroundSignal,
      'platformer-editor-blueprint-background',
      [['c']],
      true,
    );
  });

  it('editorLoadedBlueprintNameSignal-persistsUnderPlatformerEditorLoadedBlueprint', () => {
    expectRoundTrip(
      editorLoadedBlueprintNameSignal,
      'platformer-editor-loaded-blueprint',
      'cave-room',
    );
  });

  it('editorArmedBlueprintIdSignal-persistsUnderPlatformerEditorArmedBlueprint', () => {
    expectRoundTrip(
      editorArmedBlueprintIdSignal,
      'platformer-editor-armed-blueprint',
      'cave-room',
    );
  });
});

describe('editorState — derived signals', () => {
  const originals = {
    canvasMode: editorCanvasModeSignal.value,
    level: editorLevelSignal.value,
    blueprint: editorBlueprintSignal.value,
    levelBackground: editorBackgroundSignal.value,
    blueprintBackground: editorBlueprintBackgroundSignal.value,
    levelMarkers: editorMarkerSignal.value,
    blueprintMarkers: editorBlueprintMarkerSignal.value,
    levelDirty: editorDirtySignal.value,
    blueprintDirty: editorBlueprintDirtySignal.value,
  };

  afterEach(() => {
    editorCanvasModeSignal.value = originals.canvasMode;
    editorLevelSignal.value = originals.level;
    editorBlueprintSignal.value = originals.blueprint;
    editorBackgroundSignal.value = originals.levelBackground;
    editorBlueprintBackgroundSignal.value = originals.blueprintBackground;
    editorMarkerSignal.value = originals.levelMarkers;
    editorBlueprintMarkerSignal.value = originals.blueprintMarkers;
    editorDirtySignal.value = originals.levelDirty;
    editorBlueprintDirtySignal.value = originals.blueprintDirty;
  });

  it('levelMode-theDerivedSignalsReadTheLevelSignals', () => {
    editorCanvasModeSignal.value = 'level';
    editorLevelSignal.value = importLayout(['GG']);
    editorBackgroundSignal.value = [['d', '.']];
    editorMarkerSignal.value = [[{ kind: 'patrolBoundary' }, null]];
    editorDirtySignal.value = true;

    expect(editorIsBlueprintModeSignal.value).toBe(false);
    expect(editorGridSignal.value).toEqual(importLayout(['GG']));
    expect(editorBackgroundGridSignal.value).toEqual([['d', '.']]);
    expect(editorMarkerGridSignal.value).toEqual([[{ kind: 'patrolBoundary' }, null]]);
    expect(editorActiveDirtySignal.value).toBe(true);
  });

  it('blueprintMode-theDerivedSignalsReadTheBlueprintSignals', () => {
    editorCanvasModeSignal.value = 'blueprint';
    editorBlueprintSignal.value = importLayout(['##']);
    editorBlueprintBackgroundSignal.value = [['c']];
    editorBlueprintMarkerSignal.value = [[null, { kind: 'connectionPoint' }]];
    editorBlueprintDirtySignal.value = true;
    editorDirtySignal.value = false;

    expect(editorIsBlueprintModeSignal.value).toBe(true);
    expect(editorGridSignal.value).toEqual(importLayout(['##']));
    expect(editorBackgroundGridSignal.value).toEqual([['c']]);
    expect(editorMarkerGridSignal.value).toEqual([[null, { kind: 'connectionPoint' }]]);
    expect(editorActiveDirtySignal.value).toBe(true);
  });
});

describe('editorState — persisted marker grid validation', () => {
  // The marker signals are created at module load, so their creation-time
  // forgiving fallback can only be exercised by re-importing the module after
  // seeding localStorage. `vi.resetModules()` gives each test a fresh signal
  // without disturbing the statically-imported signals the other describes use.
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('aStoredMarkerGrid-withNoValue-fallsBackToTheDefault', async () => {
    const { editorMarkerSignal } = await import('./editorState');
    expect(editorMarkerSignal.value).toEqual(importMarkerGrid(LEVEL_1_LAYOUT, LEVEL_1_MARKERS));
  });

  it('aStoredMarkerGrid-withAMalformedValue-isRejectedInFavourOfTheDefault', async () => {
    localStorage.setItem('platformer-editor-markers', JSON.stringify([['not-a-marker']]));
    const { editorMarkerSignal } = await import('./editorState');
    expect(editorMarkerSignal.value).toEqual(importMarkerGrid(LEVEL_1_LAYOUT, LEVEL_1_MARKERS));
  });

  it('aStoredMarkerGrid-withAValidValue-isUsed', async () => {
    localStorage.setItem(
      'platformer-editor-markers',
      JSON.stringify([[{ kind: 'patrolBoundary' }, null]]),
    );
    const { editorMarkerSignal } = await import('./editorState');
    expect(editorMarkerSignal.value).toEqual([[{ kind: 'patrolBoundary' }, null]]);
  });
});

describe('editorState — editor appearance (O-015 FR-003)', () => {
  // The appearance signal is created at module load, so its creation-time
  // fallbacks can only be exercised by re-importing the module after seeding
  // localStorage. `vi.resetModules()` gives each test a fresh signal without
  // disturbing the statically-imported signals the other describes use.
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('editorAppearanceSignal-withNoStoredValue-defaultsToLight', async () => {
    const { editorAppearanceSignal } = await import('./editorState');
    expect(editorAppearanceSignal.value).toBe('light');
  });

  it('editorAppearanceSignal-withInvalidStoredValue-resolvesToLight', async () => {
    localStorage.setItem('platformer-editor-appearance', JSON.stringify('blue'));
    const { editorAppearanceSignal } = await import('./editorState');
    expect(editorAppearanceSignal.value).toBe('light');
  });

  it('editorAppearanceSignal-withValidStoredDarkValue-initialisesDark', async () => {
    localStorage.setItem('platformer-editor-appearance', JSON.stringify('dark'));
    const { editorAppearanceSignal } = await import('./editorState');
    expect(editorAppearanceSignal.value).toBe('dark');
  });

  it('editorAppearanceSignal-writingAValue-persistsUnderPlatformerEditorAppearance', async () => {
    const { editorAppearanceSignal } = await import('./editorState');
    editorAppearanceSignal.value = 'dark';
    expect(JSON.parse(localStorage.getItem('platformer-editor-appearance')!)).toBe('dark');
  });
});
