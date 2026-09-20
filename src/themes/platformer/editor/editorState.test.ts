import { describe, it, expect, afterEach, vi } from 'vitest';
import type { Signal } from '@preact/signals-react';
import { importLayout } from './importLayout';
import { LEVEL_1_LAYOUT } from '../level/level';
import { BLANK_BLUEPRINT } from '../level/BlueprintData';
import {
  EDITOR_STORAGE_DEBOUNCE_MS,
  editorActiveDirtySignal,
  editorActiveLayerSignal,
  editorArmedBlueprintIdSignal,
  editorBackgroundPlacementsSignal,
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
  editorSaveResultSignal,
  editorSelectedBackgroundPieceSignal,
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

  it('background-defaultsToAnEmptyList', () => {
    expect(editorBackgroundSignal.value).toEqual([]);
  });

  it('activeLayer-defaultsToForeground', () => {
    expect(editorActiveLayerSignal.value).toBe('foreground');
  });

  it('selectedBackgroundPiece-defaultsToNull', () => {
    expect(editorSelectedBackgroundPieceSignal.value).toBeNull();
  });

  it('canvasMode-defaultsToLevel', () => {
    expect(editorCanvasModeSignal.value).toBe('level');
  });

  it('blueprintGrid-defaultsToASingleEmptyCell', () => {
    expect(editorBlueprintSignal.value).toEqual(importLayout(BLANK_BLUEPRINT.layout));
  });

  it('blueprintBackground-defaultsToAnEmptyList', () => {
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
    selectedPiece: editorSelectedBackgroundPieceSignal.value,
    canvasMode: editorCanvasModeSignal.value,
    blueprint: editorBlueprintSignal.value,
    blueprintBackground: editorBlueprintBackgroundSignal.value,
    loadedBlueprint: editorLoadedBlueprintNameSignal.value,
    armed: editorArmedBlueprintIdSignal.value,
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
    editorSelectedBackgroundPieceSignal.value = originals.selectedPiece;
    editorCanvasModeSignal.value = originals.canvasMode;
    editorBlueprintSignal.value = originals.blueprint;
    editorBlueprintBackgroundSignal.value = originals.blueprintBackground;
    editorLoadedBlueprintNameSignal.value = originals.loadedBlueprint;
    editorArmedBlueprintIdSignal.value = originals.armed;
    vi.advanceTimersByTime(EDITOR_STORAGE_DEBOUNCE_MS);
    vi.useRealTimers();
  });

  it('editorLevelSignal-persistsUnderPlatformerEditorLevel', () => {
    expectRoundTrip(editorLevelSignal, 'platformer-editor-level', importLayout(['GGG']), true);
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
      [{ pieceId: 'dirtColumnTop1x1', col: 2, row: 3 }],
      true,
    );
  });

  it('editorActiveLayerSignal-persistsUnderPlatformerEditorActiveLayer', () => {
    expectRoundTrip(editorActiveLayerSignal, 'platformer-editor-active-layer', 'background');
  });

  it('editorSelectedBackgroundPieceSignal-persistsUnderPlatformerEditorSelectedBackgroundPiece', () => {
    expectRoundTrip(
      editorSelectedBackgroundPieceSignal,
      'platformer-editor-selected-background-piece',
      'charcoalBlock3x3',
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
      [{ pieceId: 'charcoalColumnTop1x1', col: 0, row: 0 }],
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
    levelDirty: editorDirtySignal.value,
    blueprintDirty: editorBlueprintDirtySignal.value,
  };

  afterEach(() => {
    editorCanvasModeSignal.value = originals.canvasMode;
    editorLevelSignal.value = originals.level;
    editorBlueprintSignal.value = originals.blueprint;
    editorBackgroundSignal.value = originals.levelBackground;
    editorBlueprintBackgroundSignal.value = originals.blueprintBackground;
    editorDirtySignal.value = originals.levelDirty;
    editorBlueprintDirtySignal.value = originals.blueprintDirty;
  });

  it('levelMode-theDerivedSignalsReadTheLevelSignals', () => {
    editorCanvasModeSignal.value = 'level';
    editorLevelSignal.value = importLayout(['GG']);
    editorBackgroundSignal.value = [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }];
    editorDirtySignal.value = true;

    expect(editorIsBlueprintModeSignal.value).toBe(false);
    expect(editorGridSignal.value).toEqual(importLayout(['GG']));
    expect(editorBackgroundPlacementsSignal.value).toEqual([
      { pieceId: 'dirtColumnTop1x1', col: 0, row: 0 },
    ]);
    expect(editorActiveDirtySignal.value).toBe(true);
  });

  it('blueprintMode-theDerivedSignalsReadTheBlueprintSignals', () => {
    editorCanvasModeSignal.value = 'blueprint';
    editorBlueprintSignal.value = importLayout(['##']);
    editorBlueprintBackgroundSignal.value = [{ pieceId: 'charcoalBlock3x3', col: 1, row: 1 }];
    editorBlueprintDirtySignal.value = true;
    editorDirtySignal.value = false;

    expect(editorIsBlueprintModeSignal.value).toBe(true);
    expect(editorGridSignal.value).toEqual(importLayout(['##']));
    expect(editorBackgroundPlacementsSignal.value).toEqual([
      { pieceId: 'charcoalBlock3x3', col: 1, row: 1 },
    ]);
    expect(editorActiveDirtySignal.value).toBe(true);
  });
});
