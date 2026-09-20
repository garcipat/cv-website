import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importLayout } from './importLayout';
import { LEVEL_1_LAYOUT } from '../level/level';
import { BLANK_BLUEPRINT, type Blueprint } from '../level/BlueprintData';
import {
  armBlueprint,
  applyBackgroundPaint,
  applyPaint,
  commitPlacement,
  loadBlueprint,
  loadLevel,
  reconcilePersistedEditorState,
  saveCurrentBlueprint,
  saveCurrentLevel,
  selectBackgroundPiece,
  selectTool,
  setActiveLayer,
  setCanvasMode,
  setEditorAppearance,
  toggleEditorAppearance,
  undoLastPlacement,
} from './editorActions';
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
} from './editorState';
import { saveLevel } from './saveLevelFile';
import { saveBlueprint } from './saveBlueprintFile';

const { blueprintEntries } = vi.hoisted(() => ({ blueprintEntries: [] as Blueprint[] }));

vi.mock('../level/blueprintRegistry', () => ({
  BLUEPRINTS: blueprintEntries,
  findBlueprint: (id: string) => blueprintEntries.find((entry) => entry.id === id),
}));

vi.mock('./saveLevelFile', () => ({
  saveLevel: vi.fn(async () => ({ written: true, path: 'levels/cave-run.json' })),
}));

vi.mock('./saveBlueprintFile', () => ({
  saveBlueprint: vi.fn(async () => ({ written: false })),
}));

const CAVE_ROOM: Blueprint = {
  id: 'cave-room',
  name: 'Cave Room',
  layout: ['##'],
  background: [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  editorLevelSignal.value = importLayout(LEVEL_1_LAYOUT);
  editorSelectedToolSignal.value = 'G';
  editorLoadedLevelNameSignal.value = 'main';
  editorDirtySignal.value = false;
  editorBackgroundSignal.value = [];
  editorActiveLayerSignal.value = 'foreground';
  editorSelectedBackgroundPieceSignal.value = null;
  editorCanvasModeSignal.value = 'level';
  editorBlueprintSignal.value = importLayout(BLANK_BLUEPRINT.layout);
  editorBlueprintBackgroundSignal.value = [];
  editorLoadedBlueprintNameSignal.value = BLANK_BLUEPRINT.name;
  editorArmedBlueprintIdSignal.value = null;
  editorBlueprintDirtySignal.value = false;
  editorLastPlacementSnapshotSignal.value = null;
  editorSaveResultSignal.value = null;
  editorCenterRequestIdSignal.value = 1;
  editorLevelCenterPendingSignal.value = false;
  editorAppearanceSignal.value = 'light';
  blueprintEntries.length = 0;
});

afterEach(() => {
  blueprintEntries.length = 0;
});

describe('editorActions — selection and toggles', () => {
  it('selectTool-setsTheToolAndDisarmsAnyBlueprint', () => {
    editorArmedBlueprintIdSignal.value = 'cave-room';
    selectTool('R');
    expect(editorSelectedToolSignal.value).toBe('R');
    expect(editorArmedBlueprintIdSignal.value).toBeNull();
  });

  it('selectBackgroundPiece-setsTheSelectedPieceAndLeavesTheLayerAlone', () => {
    selectBackgroundPiece('charcoalBlock3x3');
    expect(editorSelectedBackgroundPieceSignal.value).toBe('charcoalBlock3x3');
    expect(editorActiveLayerSignal.value).toBe('foreground');
  });

  it('setActiveLayer-setsTheLayer', () => {
    setActiveLayer('background');
    expect(editorActiveLayerSignal.value).toBe('background');
  });

  it('armBlueprint-clickingTheAlreadyArmedId-disarmsIt', () => {
    armBlueprint('cave-room');
    expect(editorArmedBlueprintIdSignal.value).toBe('cave-room');
    armBlueprint('cave-room');
    expect(editorArmedBlueprintIdSignal.value).toBeNull();
  });

  it('setCanvasMode-blueprintWithSpawnArmed-swapsItForTheFallbackTool', () => {
    editorSelectedToolSignal.value = 'S';
    setCanvasMode('blueprint');
    expect(editorSelectedToolSignal.value).toBe('G');
  });

  it('setCanvasMode-levelWithConnectionPointArmed-swapsItForTheFallbackTool', () => {
    editorSelectedToolSignal.value = '+';
    setCanvasMode('level');
    expect(editorSelectedToolSignal.value).toBe('G');
  });

  it('setCanvasMode-blueprint-disarmsAnyArmedBlueprintBecauseNestingIsOutOfScope', () => {
    editorArmedBlueprintIdSignal.value = 'cave-room';
    setCanvasMode('blueprint');
    expect(editorArmedBlueprintIdSignal.value).toBeNull();
  });

  it('setCanvasMode-levelWithACenterDebt-paysItByBumpingTheCenterRequest', () => {
    editorLevelCenterPendingSignal.value = true;
    const before = editorCenterRequestIdSignal.value;
    setCanvasMode('level');
    expect(editorCenterRequestIdSignal.value).toBe(before + 1);
    expect(editorLevelCenterPendingSignal.value).toBe(false);
  });

  it('reconcilePersistedEditorState-mountingInBlueprintModeWithSpawnArmed-disarmsIt', () => {
    editorCanvasModeSignal.value = 'blueprint';
    editorSelectedToolSignal.value = 'S';
    editorArmedBlueprintIdSignal.value = 'cave-room';
    reconcilePersistedEditorState();
    expect(editorSelectedToolSignal.value).toBe('G');
    expect(editorArmedBlueprintIdSignal.value).toBeNull();
  });

  it('reconcilePersistedEditorState-mountingInLevelModeWithTheConnectionPointArmed-disarmsIt', () => {
    editorCanvasModeSignal.value = 'level';
    editorSelectedToolSignal.value = '+';
    reconcilePersistedEditorState();
    expect(editorSelectedToolSignal.value).toBe('G');
  });

  it('reconcilePersistedEditorState-mountingInBlueprintModeWithTheConnectionPointArmed-keepsIt', () => {
    editorCanvasModeSignal.value = 'blueprint';
    editorSelectedToolSignal.value = '+';
    reconcilePersistedEditorState();
    expect(editorSelectedToolSignal.value).toBe('+');
  });
});

describe('editorActions — appearance', () => {
  it('toggleEditorAppearance-fromLight-setsDarkAndPersists', () => {
    editorAppearanceSignal.value = 'light';

    toggleEditorAppearance();

    expect(editorAppearanceSignal.value).toBe('dark');
    expect(JSON.parse(localStorage.getItem('platformer-editor-appearance')!)).toBe('dark');
  });

  it('toggleEditorAppearance-fromDark-setsLightAndPersists', () => {
    editorAppearanceSignal.value = 'dark';

    toggleEditorAppearance();

    expect(editorAppearanceSignal.value).toBe('light');
    expect(JSON.parse(localStorage.getItem('platformer-editor-appearance')!)).toBe('light');
  });

  it('setEditorAppearance-withEachLiteral-writesTheSignal', () => {
    setEditorAppearance('dark');
    expect(editorAppearanceSignal.value).toBe('dark');

    setEditorAppearance('light');
    expect(editorAppearanceSignal.value).toBe('light');
  });

  it('toggleEditorAppearance-whenRepeatedNeverLeavesSignalAndStorageOutOfStep', () => {
    for (let i = 0; i < 12; i += 1) toggleEditorAppearance();

    expect(JSON.parse(localStorage.getItem('platformer-editor-appearance')!)).toBe(
      editorAppearanceSignal.value,
    );
  });
});

describe('editorActions — canvas paint routing', () => {
  it('applyPaint-levelMode-writesTheLevelGridMarksDirtyAndShiftsBackground', () => {
    editorBackgroundSignal.value = [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }];
    const result = applyPaint({ grid: importLayout(['GGG']), colShift: 1, rowShift: 0 });

    expect(editorLevelSignal.value).toEqual(importLayout(['GGG']));
    expect(editorDirtySignal.value).toBe(true);
    expect(editorBackgroundSignal.value).toEqual([
      { pieceId: 'dirtColumnTop1x1', col: 1, row: 0 },
    ]);
    expect(editorLastPlacementSnapshotSignal.value).toBeNull();
    expect(result).toEqual({ colShift: 1, rowShift: 0 });
  });

  it('applyPaint-blueprintMode-writesTheBlueprintGridOnlyAndLeavesTheLevelAlone', () => {
    editorCanvasModeSignal.value = 'blueprint';
    const levelBefore = editorLevelSignal.value;
    applyPaint({ grid: importLayout(['##']), colShift: 0, rowShift: 0 });

    expect(editorBlueprintSignal.value).toEqual(importLayout(['##']));
    expect(editorBlueprintDirtySignal.value).toBe(true);
    expect(editorDirtySignal.value).toBe(false);
    expect(editorLevelSignal.value).toEqual(levelBefore);
  });

  it('applyPaint-clearsAnyRecordedSaveResult', () => {
    editorSaveResultSignal.value = { target: 'level', result: { written: true, path: 'x' } };
    applyPaint({ grid: importLayout(['GGG']), colShift: 0, rowShift: 0 });
    expect(editorSaveResultSignal.value).toBeNull();
  });

  it('applyBackgroundPaint-levelMode-writesTheLevelBackgroundAndMarksDirty', () => {
    applyBackgroundPaint([{ pieceId: 'charcoalBlock3x3', col: 2, row: 2 }]);
    expect(editorBackgroundSignal.value).toEqual([
      { pieceId: 'charcoalBlock3x3', col: 2, row: 2 },
    ]);
    expect(editorDirtySignal.value).toBe(true);
  });

  it('applyBackgroundPaint-blueprintMode-writesTheBlueprintBackgroundOnly', () => {
    editorCanvasModeSignal.value = 'blueprint';
    applyBackgroundPaint([{ pieceId: 'charcoalBlock3x3', col: 2, row: 2 }]);
    expect(editorBlueprintBackgroundSignal.value).toEqual([
      { pieceId: 'charcoalBlock3x3', col: 2, row: 2 },
    ]);
    expect(editorBackgroundSignal.value).toEqual([]);
  });
});

describe('editorActions — placement snapshot and undo', () => {
  beforeEach(() => {
    blueprintEntries.push(CAVE_ROOM);
    editorLevelSignal.value = importLayout(['...', '...', '...']);
  });

  it('commitPlacement-withNothingArmed-writesNothing', () => {
    expect(commitPlacement(1, 1)).toBeNull();
    expect(editorLevelSignal.value).toEqual(importLayout(['...', '...', '...']));
  });

  it('commitPlacement-overlappingExistingTerrain-refusesAndWritesNothing', () => {
    editorLevelSignal.value = importLayout(['G..', '...', '...']);
    armBlueprint('cave-room');
    expect(commitPlacement(0, 0)).toBeNull();
    expect(editorDirtySignal.value).toBe(false);
  });

  it('commitPlacement-writesTheBlueprintSnapshotsAndKeepsItArmed', () => {
    armBlueprint('cave-room');
    const shift = commitPlacement(1, 1);

    expect(shift).toEqual({ colShift: 0, rowShift: 0 });
    expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...']));
    expect(editorDirtySignal.value).toBe(true);
    expect(editorLastPlacementSnapshotSignal.value).not.toBeNull();
    expect(editorArmedBlueprintIdSignal.value).toBe('cave-room');
    // The blueprint's own background piece rebased onto the anchor.
    expect(editorBackgroundSignal.value).toEqual([
      { pieceId: 'dirtColumnTop1x1', col: 1, row: 1 },
    ]);
  });

  it('undoLastPlacement-restoresTheSnapshotAndClearsIt', () => {
    armBlueprint('cave-room');
    commitPlacement(1, 1);

    undoLastPlacement();

    expect(editorLevelSignal.value).toEqual(importLayout(['...', '...', '...']));
    expect(editorBackgroundSignal.value).toEqual([]);
    expect(editorLastPlacementSnapshotSignal.value).toBeNull();
  });

  it('undoLastPlacement-withNoSnapshot-isANoOp', () => {
    expect(() => undoLastPlacement()).not.toThrow();
    expect(editorLevelSignal.value).toEqual(importLayout(['...', '...', '...']));
  });

  it('applyPaint-afterAPlacement-clearsTheUndoSnapshot', () => {
    armBlueprint('cave-room');
    commitPlacement(1, 1);
    selectTool('G');
    applyPaint({ grid: importLayout(['G..', '.##', '...']), colShift: 0, rowShift: 0 });
    expect(editorLastPlacementSnapshotSignal.value).toBeNull();
  });
});

describe('editorActions — load and save routing', () => {
  it('loadLevel-writesTheGridAndBackgroundDirectlyAndResetsDirtyState', () => {
    const before = editorCenterRequestIdSignal.value;
    loadLevel({
      id: 'cave-run',
      name: 'Cave Run',
      layout: ['GG'],
      background: [
        { pieceId: 'dirtColumnTop1x1', col: 0, row: 0 },
        // Unresolvable pieceIds are dropped at load time.
        { pieceId: 'notARealPieceId' as never, col: 1, row: 0 },
      ],
    });

    expect(editorLevelSignal.value).toEqual(importLayout(['GG']));
    expect(editorBackgroundSignal.value).toEqual([
      { pieceId: 'dirtColumnTop1x1', col: 0, row: 0 },
    ]);
    expect(editorLoadedLevelNameSignal.value).toBe('Cave Run');
    expect(editorDirtySignal.value).toBe(false);
    expect(editorSaveResultSignal.value).toBeNull();
    expect(editorLastPlacementSnapshotSignal.value).toBeNull();
    expect(editorCenterRequestIdSignal.value).toBe(before + 1);
  });

  it('loadLevel-whileInBlueprintMode-defersCenteringAsADebtInsteadOfSpendingTheRequest', () => {
    editorCanvasModeSignal.value = 'blueprint';
    const before = editorCenterRequestIdSignal.value;
    loadLevel({ id: 'empty', name: 'empty', layout: ['.S.', 'GGG'] });
    expect(editorLevelCenterPendingSignal.value).toBe(true);
    expect(editorCenterRequestIdSignal.value).toBe(before);
  });

  it('loadBlueprint-writesTheBlueprintGridAndBackgroundAndClearsItsDirtyFlag', () => {
    editorBlueprintDirtySignal.value = true;
    loadBlueprint({ id: 'cave-room', name: 'Cave Room', layout: ['##'] });
    expect(editorBlueprintSignal.value).toEqual(importLayout(['##']));
    expect(editorLoadedBlueprintNameSignal.value).toBe('Cave Room');
    expect(editorBlueprintDirtySignal.value).toBe(false);
  });

  it('saveCurrentLevel-recordsTheResultUnderTheLevelTargetAndClearsDirty', async () => {
    editorDirtySignal.value = true;
    await saveCurrentLevel('Cave Run');

    expect(saveLevel).toHaveBeenCalledWith('Cave Run', expect.any(Array), expect.any(Array));
    expect(editorSaveResultSignal.value).toEqual({
      target: 'level',
      result: { written: true, path: 'levels/cave-run.json' },
    });
    expect(editorLoadedLevelNameSignal.value).toBe('Cave Run');
    expect(editorDirtySignal.value).toBe(false);
  });

  it('saveCurrentBlueprint-recordsTheResultUnderTheBlueprintTargetAndClearsItsDirtyFlag', async () => {
    editorBlueprintDirtySignal.value = true;
    await saveCurrentBlueprint('Test Room');

    expect(saveBlueprint).toHaveBeenCalledWith('Test Room', expect.any(Array), expect.any(Array));
    expect(editorSaveResultSignal.value).toEqual({
      target: 'blueprint',
      result: { written: false },
    });
    expect(editorLoadedBlueprintNameSignal.value).toBe('Test Room');
    expect(editorBlueprintDirtySignal.value).toBe(false);
  });
});
