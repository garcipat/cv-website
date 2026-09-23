import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importLayout } from './importLayout';
import { LEVEL_1_LAYOUT } from '../level/level';
import { BLANK_BLUEPRINT, type Blueprint } from '../level/BlueprintData';
import { paintCell } from './paintCell';
import {
  armBlueprint,
  applyBackgroundPaint,
  applyMarkerPaint,
  applyPaint,
  commitPlacement,
  loadBlueprint,
  loadLevel,
  reconcilePersistedEditorState,
  saveCurrentBlueprint,
  saveCurrentLevel,
  selectBackgroundMaterial,
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
  editorMarkerSignal,
  editorBlueprintMarkerSignal,
  editorSaveResultSignal,
  editorSelectedBackgroundMaterialSignal,
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
  background: ['d'],
};

beforeEach(() => {
  vi.clearAllMocks();
  editorLevelSignal.value = importLayout(LEVEL_1_LAYOUT);
  editorMarkerSignal.value = [];
  editorBlueprintMarkerSignal.value = [];
  editorSelectedToolSignal.value = 'G';
  editorLoadedLevelNameSignal.value = 'main';
  editorDirtySignal.value = false;
  editorBackgroundSignal.value = [];
  editorActiveLayerSignal.value = 'foreground';
  editorSelectedBackgroundMaterialSignal.value = null;
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

  it('selectBackgroundMaterial-setsTheSelectedMaterialAndLeavesTheLayerAlone', () => {
    selectBackgroundMaterial('c');
    expect(editorSelectedBackgroundMaterialSignal.value).toBe('c');
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
    editorSelectedToolSignal.value = 'connectionPoint';
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
    editorSelectedToolSignal.value = 'connectionPoint';
    reconcilePersistedEditorState();
    expect(editorSelectedToolSignal.value).toBe('G');
  });

  it('reconcilePersistedEditorState-mountingInBlueprintModeWithTheConnectionPointArmed-keepsIt', () => {
    editorCanvasModeSignal.value = 'blueprint';
    editorSelectedToolSignal.value = 'connectionPoint';
    reconcilePersistedEditorState();
    expect(editorSelectedToolSignal.value).toBe('connectionPoint');
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
    editorBackgroundSignal.value = [['d']];
    const result = applyPaint({ grid: importLayout(['GGG']), colShift: 1, rowShift: 0 });

    expect(editorLevelSignal.value).toEqual(importLayout(['GGG']));
    expect(editorDirtySignal.value).toBe(true);
    expect(editorBackgroundSignal.value).toEqual([['.', 'd']]);
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
    applyBackgroundPaint([['c']]);
    expect(editorBackgroundSignal.value).toEqual([['c']]);
    expect(editorDirtySignal.value).toBe(true);
  });

  it('applyBackgroundPaint-blueprintMode-writesTheBlueprintBackgroundOnly', () => {
    editorCanvasModeSignal.value = 'blueprint';
    applyBackgroundPaint([['c']]);
    expect(editorBlueprintBackgroundSignal.value).toEqual([['c']]);
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
    // The blueprint's own background stamped onto the anchor.
    expect(editorBackgroundSignal.value[1]?.[1]).toBe('d');
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
      background: ['dz'],
    });

    expect(editorLevelSignal.value).toEqual(importLayout(['GG']));
    // Unresolvable characters are dropped (replaced with '.') at load time.
    expect(editorBackgroundSignal.value).toEqual([['d', '.']]);
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

    expect(saveLevel).toHaveBeenCalledWith(
      'Cave Run',
      expect.any(Array),
      expect.any(Array),
      expect.any(Array),
    );
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

    expect(saveBlueprint).toHaveBeenCalledWith(
      'Test Room',
      expect.any(Array),
      expect.any(Array),
      expect.any(Array),
    );
    expect(editorSaveResultSignal.value).toEqual({
      target: 'blueprint',
      result: { written: false },
    });
    expect(editorLoadedBlueprintNameSignal.value).toBe('Test Room');
    expect(editorBlueprintDirtySignal.value).toBe(false);
  });
});

describe('editorActions — marker layer', () => {
  it('applyMarkerPaint-writesTheActiveGridMarksItDirtyAndClearsTheSnapshot', () => {
    editorLevelSignal.value = importLayout(['..']);
    editorMarkerSignal.value = [[null, null]];
    editorLastPlacementSnapshotSignal.value = {
      grid: importLayout(['..']),
      background: [],
      markers: [[null, null]],
    };

    applyMarkerPaint([[{ kind: 'patrolBoundary' }, null]]);

    expect(editorMarkerSignal.value).toEqual([[{ kind: 'patrolBoundary' }, null]]);
    expect(editorDirtySignal.value).toBe(true);
    expect(editorLastPlacementSnapshotSignal.value).toBeNull();
  });

  it('applyPaint-aLeftwardGrowth-shiftsTheMarkerGridToStayAligned', () => {
    editorLevelSignal.value = importLayout(['..']);
    editorMarkerSignal.value = [[{ kind: 'patrolBoundary' }, null]];

    // Painting at col -1 grows the terrain grid left by one column.
    applyPaint(paintCell(importLayout(['..']), -1, 0, 'G'));

    expect(editorMarkerSignal.value[0][1]).toEqual({ kind: 'patrolBoundary' });
    expect(editorMarkerSignal.value[0][0]).toBeNull();
  });

  it('applyPaint-aRightwardGrowth-padsTheMarkerGridToTheNewWidth', () => {
    editorLevelSignal.value = importLayout(['..']);
    editorMarkerSignal.value = [[null, null]];

    applyPaint(paintCell(importLayout(['..']), 4, 0, 'G'));

    expect(editorMarkerSignal.value[0]).toHaveLength(5);
    expect(editorMarkerSignal.value[0][4]).toBeNull();
  });

  it('commitPlacement-stampsTheBlueprintsMarkersAtTheAnchorAndUndoRestoresThem', () => {
    blueprintEntries.push({
      id: 'room',
      name: 'Room',
      layout: ['#.'],
      markers: [{ col: 1, row: 0, marker: { kind: 'connectionPoint' } }],
    });
    editorLevelSignal.value = importLayout(['...', '...']);
    editorMarkerSignal.value = [
      [null, null, null],
      [null, null, null],
    ];
    editorArmedBlueprintIdSignal.value = 'room';

    commitPlacement(0, 0);
    expect(editorMarkerSignal.value[0][1]).toEqual({ kind: 'connectionPoint' });

    undoLastPlacement();
    expect(editorMarkerSignal.value).toEqual([
      [null, null, null],
      [null, null, null],
    ]);
  });

  it('loadLevel-migratesALegacyLayoutAndItsStoredMarkers', () => {
    loadLevel({
      id: 'legacy',
      name: 'Legacy',
      layout: ['P1.'],
    });
    expect(editorLevelSignal.value).toEqual([['.', 'T', '.']]);
    expect(editorMarkerSignal.value).toEqual([
      [{ kind: 'patrolBoundary' }, { kind: 'sign', hintId: 'bridgeDropThrough' }, null],
    ]);
  });
});
