import { editorLevelSignal, editorSelectedToolSignal, editorBackgroundSignal, editorActiveLayerSignal, editorSelectedBackgroundPieceSignal, editorCanvasModeSignal, editorBlueprintSignal, editorBlueprintBackgroundSignal, editorLoadedBlueprintNameSignal } from './editorLevelState';
import { importLayout } from './importLayout';
import { LEVEL_1_LAYOUT } from '../level/level';
import { BLANK_BLUEPRINT } from '../level/BlueprintData';

describe('editorLevelSignal', () => {
  const original = editorLevelSignal.value;

  afterEach(() => {
    editorLevelSignal.value = original;
  });

  it('initialValue-onModuleLoad-withNothingInLocalStorage-isTheImportedDefaultLayout', () => {
    // createLocalStorageSignal (src/lib/utils.ts) falls back to its
    // defaultValue when nothing is stored yet — jsdom's localStorage starts
    // empty in this test environment, so this is that fallback path.
    expect(editorLevelSignal.value).toEqual(importLayout(LEVEL_1_LAYOUT));
  });

  it('writingValue-persistsToLocalStorageUnderTheExpectedKey', () => {
    const grid = importLayout(['GGG']);
    editorLevelSignal.value = grid;

    expect(JSON.parse(localStorage.getItem('platformer-editor-level')!)).toEqual(grid);
  });
});

describe('editorSelectedToolSignal', () => {
  const original = editorSelectedToolSignal.value;

  afterEach(() => {
    editorSelectedToolSignal.value = original;
  });

  it('initialValue-onModuleLoad-withNothingInLocalStorage-defaultsToGroundGrass', () => {
    expect(editorSelectedToolSignal.value).toBe('G');
  });

  it('writingValue-persistsToLocalStorageUnderTheExpectedKey', () => {
    editorSelectedToolSignal.value = 'M';

    expect(JSON.parse(localStorage.getItem('platformer-editor-selected-tool')!)).toBe('M');
  });
});

describe('editorLevelState — background layer signals', () => {
  it('editorBackgroundSignal-defaultsToAnEmptyList', () => {
    expect(editorBackgroundSignal.value).toEqual([]);
  });

  it('editorActiveLayerSignal-defaultsToForeground', () => {
    expect(editorActiveLayerSignal.value).toBe('foreground');
  });

  it('editorSelectedBackgroundPieceSignal-defaultsToNull', () => {
    expect(editorSelectedBackgroundPieceSignal.value).toBeNull();
  });
});

describe('editorLevelState — blueprint canvas signals', () => {
  it('editorCanvasModeSignal-defaultsToLevel', () => {
    expect(editorCanvasModeSignal.value).toBe('level');
  });

  it('editorBlueprintSignal-defaultsToASingleEmptyCell', () => {
    expect(editorBlueprintSignal.value).toEqual(importLayout(BLANK_BLUEPRINT.layout));
  });

  it('editorBlueprintBackgroundSignal-defaultsToAnEmptyList', () => {
    expect(editorBlueprintBackgroundSignal.value).toEqual([]);
  });

  it('editorLoadedBlueprintNameSignal-defaultsToTheBlankEntrysName', () => {
    expect(editorLoadedBlueprintNameSignal.value).toBe(BLANK_BLUEPRINT.name);
  });

  it('writingTheBlueprintGrid-persistsToLocalStorageUnderTheExpectedKey', () => {
    const original = editorBlueprintSignal.value;
    try {
      const grid = importLayout(['##']);
      editorBlueprintSignal.value = grid;

      expect(JSON.parse(localStorage.getItem('platformer-editor-blueprint')!)).toEqual(grid);
    } finally {
      editorBlueprintSignal.value = original;
    }
  });
});
