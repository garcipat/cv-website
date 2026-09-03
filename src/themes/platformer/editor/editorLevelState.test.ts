import { editorLevelSignal, editorSelectedToolSignal, editorBackgroundSignal, editorActiveLayerSignal, editorSelectedBackgroundPieceSignal } from './editorLevelState';
import { importLayout } from './importLayout';
import { LEVEL_1_LAYOUT } from '../level/level';

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
    editorSelectedToolSignal.value = 'E';

    expect(JSON.parse(localStorage.getItem('platformer-editor-selected-tool')!)).toBe('E');
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
