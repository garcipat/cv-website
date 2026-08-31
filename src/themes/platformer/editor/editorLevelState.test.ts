import { editorLevelSignal } from './editorLevelState';
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
