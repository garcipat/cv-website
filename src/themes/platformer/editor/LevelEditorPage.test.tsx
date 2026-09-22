import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LevelEditorPage } from './LevelEditorPage';
import { LEVEL_1_LAYOUT, LEVEL_1_BACKGROUND, SCRATCH_LAYOUT, currentLayout } from '../level/level';
import { importLayout, importBackgroundLayout } from './importLayout';
import { centerPanOnSpawn } from './EditorPan';
import { exportLayout } from './exportLayout';
import { cropLevelForExport } from './cropLevelForExport';
import type { TileChar, BackgroundChar } from '../level/LevelParser';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import {
  editorLevelSignal,
  editorSelectedToolSignal,
  editorLoadedLevelNameSignal,
  editorDirtySignal,
  editorBackgroundSignal,
  editorActiveLayerSignal,
  editorSelectedBackgroundMaterialSignal,
  editorCanvasModeSignal,
  editorAppearanceSignal,
  editorBlueprintSignal,
  editorBlueprintBackgroundSignal,
  editorLoadedBlueprintNameSignal,
  editorArmedBlueprintIdSignal,
} from './editorState';
import { levelEditorPage } from './LevelEditorPage.page';
import { isDevEnvironmentSignal } from './devEnvironment';
import { BLANK_BLUEPRINT } from '../level/BlueprintData';
import { blueprintFileJson } from './saveBlueprintFile';
import { SAVE_BLUEPRINT_ENDPOINT } from './saveBlueprintEndpoint';
import { SAVE_LEVEL_ENDPOINT } from './saveLevelEndpoint';
import type { Blueprint } from '../level/BlueprintData';
import { currentTheme } from '@/state/theme';
import { currentPath } from '@/state/navigation';
import { readFileSync } from 'node:fs';
import { enemyPlacements, enemyStates, collectedFacts, collectedCollectibleIds } from '../PlatformerState';
import { currentBackgroundLayout } from '../level/level';

const { blueprintEntries } = vi.hoisted(() => ({ blueprintEntries: [] as Blueprint[] }));

vi.mock('../level/blueprintRegistry', () => ({
  BLUEPRINTS: blueprintEntries,
  findBlueprint: (id: string) => blueprintEntries.find((entry) => entry.id === id),
}));

vi.mock('../engine/SpriteLoader', () => ({
  loadImage: vi.fn((src: string) => Promise.resolve({ src } as unknown as HTMLImageElement)),
}));

vi.mock('../engine/Renderer', () => ({
  drawTerrain: vi.fn(),
  drawPlayer: vi.fn(),
  drawCollectibles: vi.fn(),
  drawEnemies: vi.fn(),
  drawBlocks: vi.fn(),
  drawChests: vi.fn(),
  drawCheckpoints: vi.fn(),
  drawSigns: vi.fn(),
  drawHazards: vi.fn(),
  drawBackgroundTiles: vi.fn(),
  drawDeployableLadders: vi.fn(),
  drawDarkness: vi.fn(),
  drawEnemyEyes: vi.fn(),
  drawHeldTorch: vi.fn(),
  drawCrumblingFloors: vi.fn(),
  heldTorchLightPosition: vi.fn(() => ({ x: 0, y: 0 })),
}));

// Adds one extra registry entry whose `background` grid mixes a valid,
// current material id with an unresolvable one — simulating a cell left over
// from a since-trimmed catalog (this branch's own catalog has been trimmed
// twice already). Every other test keeps using the real registry unchanged;
// this entry is additional, not a replacement, so it can't affect any test
// that picks 'main'/'empty'/'Cave Run' etc. by name.
//
// Defined via vi.hoisted since vi.mock factories are hoisted above normal
// top-level const declarations — referencing a plain const here would throw
// a "before initialization" error.
const { STALE_BACKGROUND_LEVEL } = vi.hoisted(() => ({
  STALE_BACKGROUND_LEVEL: {
    id: 'stale-background-level',
    name: 'stale-background-level',
    layout: ['...', '...', '...'],
    // Simulates a leftover character from a since-trimmed catalog — 'z' is
    // not a recognized BACKGROUND_CHARS key.
    background: ['dz'],
  },
}));

vi.mock('../level/levelRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../level/levelRegistry')>();
  const LEVELS = [...actual.LEVELS, STALE_BACKGROUND_LEVEL];
  return {
    ...actual,
    LEVELS,
    findLevel: (id: string) => LEVELS.find((entry) => entry.id === id),
  };
});

import { drawTerrain } from '../engine/Renderer';

beforeEach(() => {
  vi.clearAllMocks();
  // These are module-level, localStorage-backed signals, so a test that loads
  // a different level (or edits one) would otherwise seed the next test's
  // editor with it and make this suite order-dependent.
  editorLevelSignal.value = importLayout(LEVEL_1_LAYOUT);
  editorLoadedLevelNameSignal.value = 'main';
  editorDirtySignal.value = false;
  editorBackgroundSignal.value = [];
  editorActiveLayerSignal.value = 'foreground';
  editorSelectedBackgroundMaterialSignal.value = null;
  currentBackgroundLayout.value = [];
  editorCanvasModeSignal.value = 'level';
  editorAppearanceSignal.value = 'light';
  editorBlueprintSignal.value = importLayout(BLANK_BLUEPRINT.layout);
  editorBlueprintBackgroundSignal.value = [];
  editorLoadedBlueprintNameSignal.value = BLANK_BLUEPRINT.name;
  editorArmedBlueprintIdSignal.value = null;
  blueprintEntries.length = 0;
  // Not reset by the suite today, and the new Spawn-disarm test writes 'S'
  // into it — without this, that write would leak into every test that runs
  // after it and silently change which tool their clicks paint.
  editorSelectedToolSignal.value = 'G';
  // Every pre-existing Save/Save Blueprint test in this file assumes the
  // controls are on screen, which is now conditional. The editor is a
  // dev-only tool, so "there is a dev server" is the realistic default for
  // the suite; the gate's own tests below set it false explicitly.
  isDevEnvironmentSignal.value = true;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    font: '',
    textAlign: '',
    textBaseline: '',
    lineJoin: '',
    fillText: vi.fn(),
    strokeText: vi.fn(),
    setLineDash: vi.fn(),
    arc: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});

/** Formats both crop layers into the exact `  'ROW',`-per-line, background-
 *  section-appended shape `EditorToolbar`'s Export dialog produces (see its
 *  `cropLevelForExport`-based `exportedText`), so every test asserting on
 *  the dialog's textarea content can build the expectation from the same
 *  grids the toolbar reads rather than hand-formatting a duplicate string. */
function expectedExportText(
  grid: TileChar[][],
  background: BackgroundChar[][] = [],
): string {
  const cropped = cropLevelForExport(grid, background);
  const formatRows = (rows: readonly string[]) => rows.map((row) => `  '${row}',`).join('\n');
  return `${formatRows(cropped.layout)}\n// LEVEL_1_BACKGROUND\n${formatRows(cropped.background)}`;
}

// LEVEL_1_LAYOUT is jagged (its ladder-shaft rows are short); importLayout
// right-pads to a rectangle the same way parseLevel does, and — as of this
// writing — LEVEL_1_LAYOUT's only all-'.' row is interior (between content
// rows), so content-cropping (exportLayout's job) removes nothing.
const EXPECTED_EXPORT_TEXT = expectedExportText(importLayout(LEVEL_1_LAYOUT));

async function openExportDialog() {
  await userEvent.click(levelEditorPage.toolbar.export);
}

// The level dropdown's options are only mounted once it is opened (Base UI
// Select portals its popup content), so every selection opens it first.
async function selectLevel(id: string) {
  fireEvent.click(levelEditorPage.entrySelect.trigger);
  await userEvent.click(await levelEditorPage.entrySelect.findOption(id));
}

function paintOneCell() {
  const canvas = levelEditorPage.canvas;
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
  fireEvent.mouseDown(canvas, { button: 0, clientX: 1, clientY: 1 });
}

// jsdom has no Blob-URL support and would navigate on a real anchor click, so
// the download fallback is observed through the anchor it builds. `fetch` is
// stubbed too: unstubbed, every save would attempt a real request to the
// dev-server write endpoint.
function stubDownloads() {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:level'),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no dev server'))));
  const anchorClick = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  return { anchorClick };
}

/** A dev server that accepts the write, so nothing is downloaded. */
function stubDevServerWrite(path = 'src/themes/platformer/level/levels/cave-run.json') {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ path }) } as Response)),
  );
  const anchorClick = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  return { anchorClick };
}

/**
 * A dev server that accepts a blueprint write, so nothing is downloaded.
 *
 * `fetchCalls` rather than the mock itself: `vi.fn(() => …)` types
 * `mock.calls` from its zero-argument factory, i.e. as `[][]`, so
 * `calls.find(([url]) => …)` is a `strict` compile error ("Tuple type '[]' of
 * length '0' has no element at index '0'"). The real calls come from `fetch`
 * with arguments, so the widened view is the honest one — the same reason
 * `saveLevelFile.test.ts` reads `mock.calls[0]` through
 * `as unknown as [string, RequestInit]`.
 */
function stubBlueprintWrite(path = 'src/themes/platformer/level/blueprints/test-room.json') {
  const fetchMock = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ path }) } as Response),
  );
  vi.stubGlobal('fetch', fetchMock);
  const anchorClick = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  const fetchCalls = (): unknown[][] => fetchMock.mock.calls as unknown as unknown[][];
  return { fetchCalls, anchorClick };
}

/** The body of the one POST that went to the blueprint write endpoint. */
function blueprintPostBody(fetchCalls: () => unknown[][]) {
  const call = fetchCalls().find(([url]) => url === SAVE_BLUEPRINT_ENDPOINT);
  expect(call).toBeDefined();
  return JSON.parse((call![1] as RequestInit).body as string) as {
    fileName: string;
    contents: string;
  };
}

async function saveAs(name: string) {
  await userEvent.click(levelEditorPage.toolbar.save);
  const nameField = levelEditorPage.saveDialog.nameInput;
  await userEvent.clear(nameField);
  await userEvent.type(nameField, name);
  await userEvent.click(levelEditorPage.saveDialog.confirm);
}

afterEach(() => {
  vi.unstubAllGlobals();
  isDevEnvironmentSignal.value = false;
});

describe('LevelEditorPage', () => {
  it('renders a page title', () => {
    render(<LevelEditorPage />);
    expect(screen.getByRole('heading', { name: 'Platformer Level Editor' })).toBeInTheDocument();
  });

  it('does not show the export output until the Export button is clicked', () => {
    render(<LevelEditorPage />);
    expect(levelEditorPage.exportDialog.queryRoot).not.toBeInTheDocument();
  });

  it('opens a dialog with the export textarea, whose content is LEVEL_1_LAYOUT cropped to its content (SC-009 ruling) and formatted as paste-ready quoted rows', async () => {
    render(<LevelEditorPage />);
    await openExportDialog();
    const textarea = (await levelEditorPage.exportDialog.findOutput()) as HTMLTextAreaElement;
    expect(textarea.value).toBe(EXPECTED_EXPORT_TEXT);
  });

  it('marks the export textarea read-only', async () => {
    render(<LevelEditorPage />);
    await openExportDialog();
    expect(await levelEditorPage.exportDialog.findOutput()).toHaveAttribute('readonly');
  });

  it('renders the palette (as a grid catalog) and canvas', () => {
    render(<LevelEditorPage />);
    expect(levelEditorPage.palette.root).toBeInTheDocument();
    expect(levelEditorPage.canvas).toBeInTheDocument();
  });

  it('selectingAPaletteTool-remountingThePage-stillHasThatToolSelected', () => {
    const original = editorSelectedToolSignal.value;
    try {
      render(<LevelEditorPage />);
      expect(levelEditorPage.palette.tile('G')).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(levelEditorPage.palette.tile('M'));
      expect(levelEditorPage.palette.tile('M')).toHaveAttribute('aria-pressed', 'true');

      cleanup();
      render(<LevelEditorPage />);
      expect(levelEditorPage.palette.tile('M')).toHaveAttribute('aria-pressed', 'true');
    } finally {
      editorSelectedToolSignal.value = original;
    }
  });

  it('renders a Copy Layout button inside the dialog that writes the export text to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<LevelEditorPage />);
    await openExportDialog();
    await userEvent.click(levelEditorPage.exportDialog.copy);
    expect(writeText).toHaveBeenCalledWith(EXPECTED_EXPORT_TEXT);
  });

  it('selectingAnotherLevelWithAnUnchangedGrid-loadsItWithNoConfirmation', async () => {
    render(<LevelEditorPage />);

    await selectLevel('empty');

    await openExportDialog();
    const textarea = (await levelEditorPage.exportDialog.findOutput()) as HTMLTextAreaElement;
    expect(textarea.value).toBe(expectedExportText(importLayout(SCRATCH_LAYOUT)));
  });

  it('selectingALevelAfterEditing-opensTheDiscardDialogRatherThanLoadingImmediately', async () => {
    render(<LevelEditorPage />);
    paintOneCell();

    await selectLevel('empty');

    expect(await levelEditorPage.entrySelect.findDiscardDialog()).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(levelEditorPage.entrySelect.queryDiscardDialog).not.toBeInTheDocument(),
    );
    // Not loaded — only the confirmation dialog opened.
    await openExportDialog();
    const textarea = (await levelEditorPage.exportDialog.findOutput()) as HTMLTextAreaElement;
    expect(textarea.value).not.toBe(EXPECTED_EXPORT_TEXT);
  });

  it('confirmingTheDiscardDialog-reloadsTheShippedLayoutDiscardingEdits', async () => {
    render(<LevelEditorPage />);
    paintOneCell();

    await selectLevel('main');
    await userEvent.click(await levelEditorPage.entrySelect.findDiscardConfirm());
    await waitFor(() =>
      expect(levelEditorPage.entrySelect.queryDiscardDialog).not.toBeInTheDocument(),
    );

    await openExportDialog();
    const textarea = (await levelEditorPage.exportDialog.findOutput()) as HTMLTextAreaElement;
    // Reloading 'main' also reloads its shipped background (LEVEL_1_BACKGROUND),
    // unlike the fresh-mount default (an empty background) EXPECTED_EXPORT_TEXT
    // assumes elsewhere in this file.
    expect(textarea.value).toBe(
      expectedExportText(importLayout(LEVEL_1_LAYOUT), importBackgroundLayout(LEVEL_1_BACKGROUND)),
    );
  });

  it('cancellingTheDiscardDialog-keepsTheEdits', async () => {
    render(<LevelEditorPage />);
    paintOneCell();

    await selectLevel('main');
    await userEvent.click(await levelEditorPage.entrySelect.findDiscardCancel());
    await waitFor(() =>
      expect(levelEditorPage.entrySelect.queryDiscardDialog).not.toBeInTheDocument(),
    );

    await openExportDialog();
    const textarea = (await levelEditorPage.exportDialog.findOutput()) as HTMLTextAreaElement;
    expect(textarea.value).not.toBe(EXPECTED_EXPORT_TEXT);
  });

  it('selectingEmpty-recentersTheViewOnItsSpawnRatherThanLeavingItWhereTheOldLevelWas', async () => {
    render(<LevelEditorPage />);
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());

    await selectLevel('empty');

    const canvas = levelEditorPage.canvas;
    const expected = centerPanOnSpawn(importLayout(SCRATCH_LAYOUT), canvas.width, canvas.height);
    await waitFor(() => {
      const calls = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
      const [, , , , originX, originY] = calls[calls.length - 1];
      expect({ x: originX, y: originY }).toEqual(expected);
    });
  });

  it('selectingMain-recentersTheViewOnTheShippedLayoutsSpawn', async () => {
    render(<LevelEditorPage />);
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());

    await selectLevel('empty');
    await selectLevel('main');

    const canvas = levelEditorPage.canvas;
    const expected = centerPanOnSpawn(importLayout(LEVEL_1_LAYOUT), canvas.width, canvas.height);
    await waitFor(() => {
      const calls = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
      const [, , , , originX, originY] = calls[calls.length - 1];
      expect({ x: originX, y: originY }).toEqual(expected);
    });
  });

  it('selectingALevel-persistsToTheEditorSignalSoTheDebouncedSyncCannotUndoIt', async () => {
    render(<LevelEditorPage />);

    await selectLevel('empty');

    await waitFor(() => expect(editorLevelSignal.value).toEqual(importLayout(SCRATCH_LAYOUT)));
  });

  it('selectingALevel-remountingThePage-stillComparesAgainstThatLevelRatherThanTheShippedOne', async () => {
    render(<LevelEditorPage />);
    await selectLevel('empty');
    await waitFor(() => expect(editorLoadedLevelNameSignal.value).toBe('empty'));
    cleanup();

    render(<LevelEditorPage />);

    // Nothing has been painted since `empty` was loaded, so selecting another
    // level must not warn — proving the remounted page compares against
    // `empty`, not the shipped layout it was originally seeded from.
    await selectLevel('main');
    expect(levelEditorPage.entrySelect.queryDiscardDialog).not.toBeInTheDocument();
  });

  it('doesNotRenderTheOldResetOrScratchButtons', () => {
    render(<LevelEditorPage />);

    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scratch' })).not.toBeInTheDocument();
  });

  it('save-devServerWrites-closesTheDialogAndDownloadsNothing', async () => {
    const { anchorClick } = stubDevServerWrite();
    render(<LevelEditorPage />);

    await saveAs('Cave Run');

    await waitFor(() => expect(levelEditorPage.saveDialog.queryRoot).not.toBeInTheDocument());
    expect(anchorClick).not.toHaveBeenCalled();
  });

  it('save-devServerWrites-reportsThePathItWasWrittenToInTheSidebar', async () => {
    stubDevServerWrite();
    render(<LevelEditorPage />);

    await saveAs('Cave Run');

    expect(await levelEditorPage.toolbar.findSaveStatus()).toBeInTheDocument();
  });

  it('save-devServerWrites-paintingAgain-dropsTheSavedPathBecauseTheFileIsNowStale', async () => {
    stubDevServerWrite();
    render(<LevelEditorPage />);
    await saveAs('Cave Run');
    await levelEditorPage.toolbar.findSaveStatus();

    paintOneCell();

    await waitFor(() =>
      expect(levelEditorPage.toolbar.querySaveStatus).not.toBeInTheDocument(),
    );
  });

  it('save-devServerWrites-loadingAnotherLevel-dropsTheSavedPath', async () => {
    stubDevServerWrite();
    render(<LevelEditorPage />);
    await saveAs('Cave Run');
    await levelEditorPage.toolbar.findSaveStatus();

    await selectLevel('empty');

    await waitFor(() =>
      expect(levelEditorPage.toolbar.querySaveStatus).not.toBeInTheDocument(),
    );
  });

  it('save-noDevServer-fallsBackToDownloadingTheGridAsJsonUnderTheEnteredName', async () => {
    const { anchorClick } = stubDownloads();
    render(<LevelEditorPage />);

    await saveAs('Cave Run');

    await waitFor(() => expect(anchorClick).toHaveBeenCalled());
    const anchor = anchorClick.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('cave-run.json');
  });

  it('save-noDevServer-keepsTheDialogOpenAndSaysToMoveTheDownloadedFileIn', async () => {
    stubDownloads();
    render(<LevelEditorPage />);

    await saveAs('Cave Run');

    expect(await levelEditorPage.saveDialog.findResult()).toHaveTextContent(
      'src/themes/platformer/level/levels/',
    );
    expect(levelEditorPage.saveDialog.root).toBeInTheDocument();
  });

  it('save-devServerRefuses-showsTheReasonItGaveRatherThanClaimingSuccess', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:level'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'contents must be JSON' }),
        } as Response),
      ),
    );
    render(<LevelEditorPage />);

    await saveAs('Cave Run');

    expect(await levelEditorPage.saveDialog.findResult()).toBeInTheDocument();
  });

  it('saveDialog-beforeSaving-namesTheFolderTheLevelIsWrittenTo', async () => {
    render(<LevelEditorPage />);

    await userEvent.click(levelEditorPage.toolbar.save);

    expect(await levelEditorPage.saveDialog.findRoot()).toHaveTextContent(
      'src/themes/platformer/level/levels/',
    );
  });

  it('saveDialog-reopenedAfterAFallbackDownload-noLongerShowsThePreviousResult', async () => {
    stubDownloads();
    render(<LevelEditorPage />);
    await saveAs('Cave Run');
    await levelEditorPage.saveDialog.findResult();

    await userEvent.click(levelEditorPage.saveDialog.cancel);
    await waitFor(() => expect(levelEditorPage.saveDialog.queryRoot).not.toBeInTheDocument());
    await userEvent.click(levelEditorPage.toolbar.save);

    expect(levelEditorPage.saveDialog.queryResult).not.toBeInTheDocument();
  });

  it('save-thenSelectingAnotherLevel-doesNotWarnAboutDiscardingChanges', async () => {
    stubDevServerWrite();
    render(<LevelEditorPage />);
    paintOneCell();

    await saveAs('Cave Run');
    await waitFor(() => expect(levelEditorPage.saveDialog.queryRoot).not.toBeInTheDocument());

    await selectLevel('empty');

    expect(levelEditorPage.entrySelect.queryDiscardDialog).not.toBeInTheDocument();
  });

  it('save-namesTheSavedLevelOnTheDropdownTrigger', async () => {
    stubDevServerWrite();
    render(<LevelEditorPage />);

    await saveAs('Cave Run');

    // A successful save closes the dialog, which is what makes the trigger
    // reachable again — an open dialog hides the page from the a11y tree.
    await waitFor(() => expect(levelEditorPage.entrySelect.trigger).toHaveTextContent('Cave Run'));
  });

  it('compensates panOffset by exactly -colShift * RENDERED_TILE_SIZE when a paint grows the grid leftward, so existing content does not visually move (spec SC-006)', async () => {
    render(<LevelEditorPage />);
    // Wait for the mocked loadImage promises to resolve so images.tileset is
    // set and EditorCanvas's redraw effect actually calls drawTerrain.
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());

    const callsBefore = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
    const [, , , , originXBefore] = callsBefore[callsBefore.length - 1];

    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    // LEVEL_1_LAYOUT's leftmost column is column 0 — clicking one pixel left
    // of where column 0 currently draws targets column -1, which must grow
    // the grid left by exactly one column (colShift 1). The click is taken
    // relative to the CURRENT origin rather than to 0, since the editor
    // opens centered on the spawn rather than unpanned.
    fireEvent.mouseDown(canvas, { button: 0, clientX: originXBefore - 1, clientY: 1 });

    await waitFor(() => {
      const callsAfter = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
      const [, , , , originXAfter] = callsAfter[callsAfter.length - 1];
      expect(originXAfter).toBe(originXBefore - RENDERED_TILE_SIZE);
    });
  });
});

describe('LevelEditorPage - debounced localStorage sync (editorLevelSignal)', () => {
  const defaultGrid = importLayout(LEVEL_1_LAYOUT);

  beforeEach(() => {
    editorLevelSignal.value = defaultGrid;
  });

  afterEach(() => {
    vi.useRealTimers();
    editorLevelSignal.value = defaultGrid;
  });

  function paint(canvas: Element) {
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 1, clientY: 1 });
  }

  it('initialGrid-onMount-comesFromEditorLevelSignalRatherThanAlwaysTheHardcodedDefault', async () => {
    // Seed localStorage-backed state with something other than the default
    // before mounting, so this only passes if the component's initial
    // useState actually reads editorLevelSignal.value instead of always
    // calling importLayout(LEVEL_1_LAYOUT) itself.
    const editedGrid = defaultGrid.map((row) => [...row]);
    editedGrid[0][0] = 'G';
    editorLevelSignal.value = editedGrid;

    render(<LevelEditorPage />);
    await userEvent.click(levelEditorPage.toolbar.export);
    const textarea = (await levelEditorPage.exportDialog.findOutput()) as HTMLTextAreaElement;
    expect(textarea.value).toBe(expectedExportText(editedGrid));
  });

  it('paintingACell-doesNotPersistToLocalStorageImmediately', () => {
    render(<LevelEditorPage />);
    const canvas = levelEditorPage.canvas;
    localStorage.setItem('platformer-editor-level', JSON.stringify(defaultGrid));

    paint(canvas);

    // The signal is the single source of truth and updates immediately; only
    // the localStorage write waits for the debounce window (FR-018).
    expect(JSON.parse(localStorage.getItem('platformer-editor-level')!)).toEqual(defaultGrid);
  });

  it('paintingACell-afterTheDebounceWindowElapses-persistsTheGridToLocalStorage', () => {
    vi.useFakeTimers();
    render(<LevelEditorPage />);
    const canvas = levelEditorPage.canvas;
    localStorage.setItem('platformer-editor-level', JSON.stringify(defaultGrid));

    paint(canvas);
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(JSON.parse(localStorage.getItem('platformer-editor-level')!)).not.toEqual(defaultGrid);
  });

  it('reloadingMainAfterConfirmation-alsoResetsEditorLevelSignalBackToTheDefaultLayout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<LevelEditorPage />);
    const canvas = levelEditorPage.canvas;

    paint(canvas);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(editorLevelSignal.value).not.toEqual(defaultGrid);

    await selectLevel('main');
    fireEvent.click(await levelEditorPage.entrySelect.findDiscardConfirm());

    expect(editorLevelSignal.value).toEqual(defaultGrid);
  });

  it('paintingACell-marksTheEditorDirty', () => {
    render(<LevelEditorPage />);

    paintOneCell();

    expect(editorDirtySignal.value).toBe(true);
  });

  it('loadingALevel-clearsTheDirtyFlag', async () => {
    render(<LevelEditorPage />);
    paintOneCell();

    await selectLevel('empty');
    fireEvent.click(await levelEditorPage.entrySelect.findDiscardConfirm());

    expect(editorDirtySignal.value).toBe(false);
  });
});

describe('LevelEditorPage - Try button', () => {
  beforeEach(() => {
    editorLevelSignal.value = importLayout(LEVEL_1_LAYOUT);
    currentTheme.value = 'ide';
    currentPath.value = '/platformer/editor';
  });

  afterEach(() => {
    currentTheme.value = 'ide';
    currentPath.value = '/';
  });

  it('click-setsCurrentLayoutFromTheGridSetsTheThemeToPlatformerAndNavigatesToTheDebugGameRoute', async () => {
    render(<LevelEditorPage />);

    await userEvent.click(levelEditorPage.toolbar.try);

    expect(currentLayout.value).toEqual(exportLayout(importLayout(LEVEL_1_LAYOUT)));
    expect(currentTheme.value).toBe('platformer');
    // PlatformerPage.tsx only reads `debug`/`level` query params on the
    // dedicated `/platformer` route, and gates its debug panel on `new
    // URLSearchParams(window.location.search).has('debug')` — any `debug`
    // param shows it, so this must land on a URL satisfying both exactly.
    expect(currentPath.value).toBe('/platformer?debug=1');
  });

  it('click-alsoResetsGameProgressSoStaleStateFromAnEarlierLayoutDoesNotLeakIn', async () => {
    // Regression test: enemyStates/blockStates/chestStates/bonusFruitStates
    // are all plain signals seeded once at module load, NOT computed signals
    // reactive to currentLayout — only resetGame()/resetGameProgress()
    // re-derives them. Without calling one of those, Try swapped
    // currentLayout but left enemyStates (etc.) pointing at whatever layout
    // was active before, so a marker just added in the editor (e.g. a new
    // enemy) never actually appeared when tried. Also verifies progress
    // (collected facts/coins) from a previous Try session doesn't leak into
    // the next one — trying a layout should be a clean slate.
    collectedFacts.value = [{ id: 'stale-fact', sectionId: 'courses', sectionLabel: 'Courses', data: {} as never, sourceType: 'enemy' }];
    collectedCollectibleIds.value = new Set(['stale-coin']);
    enemyStates.value = [];

    render(<LevelEditorPage />);
    await userEvent.click(levelEditorPage.toolbar.try);

    expect(enemyStates.value).toHaveLength(enemyPlacements.value.length);
    expect(collectedFacts.value).toEqual([]);
    expect(collectedCollectibleIds.value.size).toBe(0);
  });
});

describe('LevelEditorPage — background layer', () => {
  function paintBackgroundOnce() {
    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    fireEvent.mouseDown(canvas, { clientX: 1, clientY: 1, button: 0 });
  }

  /** The `(col, row)` of the first non-empty cell in a background grid (a
   *  `BackgroundChar[][]`) or layout (a `readonly string[]`), or `null` if
   *  it's entirely empty — used to assert on a single painted cell without
   *  caring about the grid's overall (possibly grown) dimensions. Accepts
   *  both shapes since this suite reads both the editor's own char grid
   *  (`editorBackgroundSignal`) and the game's parsed-from-layout background
   *  (`currentBackgroundLayout`, a plain `readonly string[]`). */
  function firstPaintedCell(
    grid: readonly (readonly string[] | string)[],
  ): { col: number; row: number } | null {
    for (let row = 0; row < grid.length; row++) {
      const rowChars = [...grid[row]];
      for (let col = 0; col < rowChars.length; col++) {
        if (rowChars[col] !== '.') return { col, row };
      }
    }
    return null;
  }

  it('selectingTheBackgroundLayerThenAMaterialThenPaintingOnCanvas-paintsACell', async () => {
    render(<LevelEditorPage />);
    fireEvent.click(levelEditorPage.toolbar.layerBackground);
    fireEvent.click(await levelEditorPage.palette.findBackgroundTile('dirt'));

    paintBackgroundOnce();

    await waitFor(() => expect(firstPaintedCell(editorBackgroundSignal.value)).not.toBeNull());
  });

  it('tryingTheLevelWithABackgroundCellPainted-carriesItIntoCurrentBackground', async () => {
    render(<LevelEditorPage />);
    fireEvent.click(levelEditorPage.toolbar.layerBackground);
    fireEvent.click(await levelEditorPage.palette.findBackgroundTile('dirt'));
    paintBackgroundOnce();
    await waitFor(() => expect(firstPaintedCell(editorBackgroundSignal.value)).not.toBeNull());

    fireEvent.click(levelEditorPage.toolbar.try);

    expect(firstPaintedCell(currentBackgroundLayout.value)).not.toBeNull();
  });

  it('loadingALevelWithAPaintedBackground-populatesTheLocalBackgroundState', async () => {
    render(<LevelEditorPage />);
    fireEvent.click(levelEditorPage.toolbar.layerBackground);
    fireEvent.click(await levelEditorPage.palette.findBackgroundTile('dirt'));
    paintBackgroundOnce();
    await waitFor(() => expect(firstPaintedCell(editorBackgroundSignal.value)).not.toBeNull());

    // Loading 'empty' (a built-in level with no background) must clear the
    // grid back out rather than leaving the previous level's painted cells
    // stuck on screen. Painting the background marks the editor dirty (see
    // the dirty-flag test below), so the level select now asks to confirm
    // the discard first, same as a foreground paint would.
    fireEvent.click(levelEditorPage.entrySelect.trigger);
    await userEvent.click(await levelEditorPage.entrySelect.findOption('empty'));
    fireEvent.click(await levelEditorPage.entrySelect.findDiscardConfirm());

    await waitFor(() => expect(editorBackgroundSignal.value).toEqual([]));
  });

  it('paintingABackgroundCell-marksTheEditorDirty', async () => {
    render(<LevelEditorPage />);
    fireEvent.click(levelEditorPage.toolbar.layerBackground);
    fireEvent.click(await levelEditorPage.palette.findBackgroundTile('dirt'));

    paintBackgroundOnce();

    await waitFor(() => expect(editorDirtySignal.value).toBe(true));
  });

  it('shifts the existing background grid by colShift/rowShift when a FOREGROUND paint grows the grid, keeping the two layers from drifting apart (Task 20 gap #1)', async () => {
    render(<LevelEditorPage />);
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());

    // Paint a background cell first, well inside the current grid (no
    // growth expected from this paint) — this is the cell that must move
    // when the FOREGROUND grid grows next.
    fireEvent.click(levelEditorPage.toolbar.layerBackground);
    fireEvent.click(await levelEditorPage.palette.findBackgroundTile('dirt'));
    paintBackgroundOnce();
    let placed: { col: number; row: number } | null = null;
    await waitFor(() => {
      placed = firstPaintedCell(editorBackgroundSignal.value);
      expect(placed).not.toBeNull();
    });
    const placedCol = placed!.col;
    const placedRow = placed!.row;

    // Switch back to the foreground layer and paint one column left of the
    // grid's current left edge, growing it left by one column.
    fireEvent.click(levelEditorPage.toolbar.layerForeground);
    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    const callsBefore = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
    const [, , , , originXBefore] = callsBefore[callsBefore.length - 1];
    fireEvent.mouseDown(canvas, { button: 0, clientX: originXBefore - 1, clientY: 1 });

    await waitFor(() => {
      const movedTo = firstPaintedCell(editorBackgroundSignal.value);
      expect(movedTo).toEqual({ col: placedCol + 1, row: placedRow });
    });
  });

  it('loadingALevelWithAnUnresolvableCharacter-silentlyDropsOnlyThatCell', async () => {
    render(<LevelEditorPage />);

    fireEvent.click(levelEditorPage.entrySelect.trigger);
    await userEvent.click(
      await levelEditorPage.entrySelect.findOption('stale-background-level'),
    );

    await waitFor(() => {
      expect(editorBackgroundSignal.value).toEqual([['d', '.']]);
    });
  });
});

// The blueprint canvas starts as one empty cell at pan {0,0}, so a click at
// col * RENDERED_TILE_SIZE + 1 lands on exactly that column (see the
// test-determinism notes in the plan).
function paintBlueprintCell(col: number, row: number) {
  const canvas = levelEditorPage.canvas;
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
  fireEvent.mouseDown(canvas, {
    button: 0,
    clientX: col * RENDERED_TILE_SIZE + 1,
    clientY: row * RENDERED_TILE_SIZE + 1,
  });
}

function renderEditorInBlueprintMode() {
  editorSelectedToolSignal.value = 'G';
  render(<LevelEditorPage />);
  fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);
}

describe('LevelEditorPage — Level/Blueprint canvas toggle (step 44a)', () => {
  it('onMount-theLevelCanvasIsActiveAndTheLayerToggleIsStillThere', () => {
    render(<LevelEditorPage />);

    expect(levelEditorPage.toolbar.canvasLevel).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(levelEditorPage.toolbar.canvasBlueprint).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // Two independent axes: picking a canvas never removes the layer toggle.
    expect(levelEditorPage.toolbar.layerForeground).toBeInTheDocument();
    expect(levelEditorPage.toolbar.layerBackground).toBeInTheDocument();
  });

  it('clickingBlueprint-marksTheBlueprintCanvasActiveAndPersistsTheMode', () => {
    render(<LevelEditorPage />);

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    expect(levelEditorPage.toolbar.canvasBlueprint).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(editorCanvasModeSignal.value).toBe('blueprint');
  });

  it('blueprintModeActive-thePaletteDropsTheSpawnTool', () => {
    render(<LevelEditorPage />);

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    expect(levelEditorPage.palette.queryTile('S')).not.toBeInTheDocument();
  });

  it('backToLevelMode-thePaletteOffersSpawnAgain', () => {
    render(<LevelEditorPage />);
    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    fireEvent.click(levelEditorPage.toolbar.canvasLevel);

    expect(levelEditorPage.palette.tile('S')).toBeInTheDocument();
  });

  it('paintingInBlueprintMode-writesToTheBlueprintGridAndLeavesTheLevelGridAlone', async () => {
    const levelGridBefore = editorLevelSignal.value;
    renderEditorInBlueprintMode();

    paintBlueprintCell(2, 1);

    await waitFor(() => {
      expect(editorBlueprintSignal.value[1][2]).toBe('G');
    });
    expect(editorLevelSignal.value).toEqual(levelGridBefore);
  });

  it('paintingInBlueprintMode-doesNotMarkTheLevelDirty', async () => {
    renderEditorInBlueprintMode();

    paintBlueprintCell(2, 1);

    await waitFor(() => expect(editorBlueprintSignal.value[1][2]).toBe('G'));
    expect(editorDirtySignal.value).toBe(false);
  });

  it('paintingTheBackgroundLayerInBlueprintMode-writesToTheBlueprintBackgroundOnly', async () => {
    renderEditorInBlueprintMode();
    // The Foreground/Background toggle keeps switching LAYERS, now on the
    // blueprint's own two layers.
    fireEvent.click(levelEditorPage.toolbar.layerBackground);
    fireEvent.click(await levelEditorPage.palette.findBackgroundTile('dirt'));

    paintBlueprintCell(0, 0);

    await waitFor(() => expect(editorBlueprintBackgroundSignal.value).toHaveLength(1));
    expect(editorBackgroundSignal.value).toEqual([]);
  });

  it('blueprintCanvasContent-survivesSwitchingToTheLevelAndBack', async () => {
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    await waitFor(() => expect(editorBlueprintSignal.value[1][2]).toBe('G'));

    fireEvent.click(levelEditorPage.toolbar.canvasLevel);
    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    // Assert on what actually got RENDERED after switching back, not on the
    // persisted signal — that signal's debounced write from before the
    // toggles already landed, so re-reading it here would still pass even if
    // the component's local `blueprintGrid` state were wrongly reset on every
    // mode switch. `gridToLevelDef` maps 'G' to the tile type 'groundGrass'
    // (see LevelParser.ts's TERRAIN_CHARS).
    await waitFor(() => {
      const calls = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
      const [, level] = calls[calls.length - 1] as [unknown, { terrain: string[][] }];
      expect(level.terrain[1][2]).toBe('groundGrass');
    });
  });

  it('spawnToolStillArmed-switchingToBlueprint-disarmsItSoClicksCannotPaintASpawn', () => {
    // The palette merely stops OFFERING Spawn (Task 4). `selectedTool` is
    // persisted and shared by both canvases, so without an explicit disarm a
    // session that left 'S' armed would paint spawn markers into a blueprint
    // through a palette showing nothing selected (design note 4).
    editorSelectedToolSignal.value = 'S';
    render(<LevelEditorPage />);

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    expect(editorSelectedToolSignal.value).not.toBe('S');
    expect(levelEditorPage.palette.tile('G')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('mountedInBlueprintModeWithSpawnArmed-disarmsItWithoutAnyToggleClick', () => {
    // Both the mode and the tool are persisted, so the editor can come back
    // up already on the blueprint canvas with 'S' selected and no toggle
    // click to trigger the other disarm path.
    editorCanvasModeSignal.value = 'blueprint';
    editorSelectedToolSignal.value = 'S';

    render(<LevelEditorPage />);

    expect(editorSelectedToolSignal.value).not.toBe('S');
    expect(levelEditorPage.palette.queryTile('S')).not.toBeInTheDocument();
  });

  it('mountedInBlueprintMode-firstSwitchToLevel-centersTheLevelOnItsSpawn', async () => {
    // Mounting in blueprint mode lets the blueprint canvas consume the
    // editor's one-shot centering request, which is a no-op on a spawn-less
    // grid — the level must still get centered when it first becomes active
    // (design note 5), rather than sitting unpanned at its top-left corner.
    editorCanvasModeSignal.value = 'blueprint';
    render(<LevelEditorPage />);
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());

    fireEvent.click(levelEditorPage.toolbar.canvasLevel);

    const canvas = levelEditorPage.canvas;
    const expected = centerPanOnSpawn(
      importLayout(LEVEL_1_LAYOUT),
      canvas.width,
      canvas.height,
    );
    await waitFor(() => {
      const calls = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
      const [, , , , originX, originY] = calls[calls.length - 1];
      expect({ x: originX, y: originY }).toEqual(expected);
    });
  });

  it('switchingBackToLevelASecondTime-doesNotYankAHandPannedViewBackToTheSpawn', async () => {
    // Mount already in Blueprint mode so there IS a centering debt to spend —
    // mounting in Level mode (the default) starts with the debt already
    // false and never proves the "only once" half of design note 5: the
    // first switch to Level must center (paying the debt), but a SECOND
    // switch must not re-center a view the user has since hand-panned.
    editorCanvasModeSignal.value = 'blueprint';
    render(<LevelEditorPage />);
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());

    // First switch to Level: pays back the mount-time debt and centers.
    fireEvent.click(levelEditorPage.toolbar.canvasLevel);
    const canvas = levelEditorPage.canvas;
    const expectedCenterX = centerPanOnSpawn(
      importLayout(LEVEL_1_LAYOUT),
      canvas.width,
      canvas.height,
    ).x;
    await waitFor(() => {
      const calls = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[calls.length - 1][4]).toBe(expectedCenterX);
    });

    // Pan the level view away from where it just centered.
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    fireEvent.mouseDown(canvas, { button: 1, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(canvas, { clientX: 40, clientY: 0 });
    fireEvent.mouseUp(canvas);
    await waitFor(() => {
      const calls = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[calls.length - 1][4]).not.toBe(expectedCenterX);
    });
    const pannedX = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls.at(-1)![4];

    // Second round trip: the debt was already spent by the first switch, so
    // this switch back to Level must not re-center and yank the hand-panned
    // view back to the spawn.
    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);
    fireEvent.click(levelEditorPage.toolbar.canvasLevel);

    await waitFor(() => {
      const calls = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[calls.length - 1][4]).toBe(pannedX);
    });
  });

  // A prior version of this test ("loadingADifferentLevelWhileInBlueprintMode
  // -stillCentersItOnceSwitchedBackToLevel") exercised loadLevel while the
  // blueprint canvas was active, which required LevelSelect to stay rendered
  // in blueprint mode — the test's own comment noted "only Task 7 hides it".
  // Task 7 does hide the Level Select+Save pair whenever the blueprint canvas
  // is active (see the swap tests below), which makes that scenario
  // unreachable through the UI: there is no LevelSelect to pick a level from
  // while in blueprint mode. The `levelCenterPendingRef`/`isBlueprintMode`
  // arming logic inside `loadLevel` itself is left untouched (Task 7's brief
  // does not ask for it to be removed), but the regression test for it is
  // retired here since it can no longer be driven through the rendered page.
});

describe('editor zoom (O-019)', () => {
  // The base-ui Slider (this repo's shadcn style) puts the actual
  // keyboard-interactive element on a hidden native `<input type="range">`
  // inside the thumb, not on the outer `data-testid` container (that's the
  // Root, which has no tabIndex of its own) — matching EditorCanvas.test.tsx's
  // own "scrollingUpOverTheCanvasZoomsInAnchoredToTheCursor"-adjacent slider
  // tests, which target that inner input the same way.
  function sliderInput(): HTMLInputElement {
    const slider = screen.getByTestId('editor-canvas-zoom');
    return slider.querySelector('input') as HTMLInputElement;
  }

  it('keepsTheLevelCanvasAndBlueprintCanvasZoomLevelsIndependent', async () => {
    render(<LevelEditorPage />);

    act(() => {
      sliderInput().focus();
    });
    fireEvent.keyDown(sliderInput(), { key: 'ArrowDown' }); // 100% -> 75%
    expect(screen.getByTestId('editor-canvas-zoom-value')).toHaveTextContent('75%');

    await levelEditorPage.setCanvas('blueprint');
    expect(screen.getByTestId('editor-canvas-zoom-value')).toHaveTextContent('100%');

    act(() => {
      sliderInput().focus();
    });
    fireEvent.keyDown(sliderInput(), { key: 'ArrowDown' });
    fireEvent.keyDown(sliderInput(), { key: 'ArrowDown' }); // 100% -> 75% -> 50%
    expect(screen.getByTestId('editor-canvas-zoom-value')).toHaveTextContent('50%');

    await levelEditorPage.setCanvas('level');
    expect(screen.getByTestId('editor-canvas-zoom-value')).toHaveTextContent('75%');
  });

  it('resetsBothCanvasesZoomTo100PercentWhenALevelIsLoaded', async () => {
    render(<LevelEditorPage />);

    act(() => {
      sliderInput().focus();
    });
    fireEvent.keyDown(sliderInput(), { key: 'ArrowDown' });
    expect(screen.getByTestId('editor-canvas-zoom-value')).toHaveTextContent('75%');

    await selectLevel('empty'); // the file's own helper (line ~179); 'empty' is
    // an existing entry id already used by other tests (e.g. the discard-flow
    // test at line ~812) and the grid here is still clean, so no discard
    // dialog appears — the load proceeds immediately.

    expect(screen.getByTestId('editor-canvas-zoom-value')).toHaveTextContent('100%');
  });
});

describe('editor zoom — user stories (O-019)', () => {
  it('zoomingOutShowsTheSameLevelAtASmallerRenderedSize-userStory1', () => {
    render(<LevelEditorPage />);
    expect(levelEditorPage.zoomValue).toBe('100%');

    levelEditorPage.setZoomViaSlider(50);

    expect(levelEditorPage.zoomValue).toBe('50%');
  });

  it('paintingRemainsAccurateAfterZoomingOut-userStory2', async () => {
    render(<LevelEditorPage />);
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());
    levelEditorPage.setZoomViaSlider(50);

    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    // The editor opens centered on the spawn, so the pan is not 0. Recover it
    // from drawTerrain's origin argument, which Task 3 passes pre-divided by
    // zoom: panOffset = origin * zoom.
    const lastCall = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
    const panX = (lastCall[4] as number) * 0.5;
    const panY = (lastCall[5] as number) * 0.5;

    // One tile-width-plus-a-pixel right of column 0's left edge. This point
    // DISCRIMINATES the zoom-aware formula from a zoom-blind one: the correct
    // column is floor(33 / 0.5 / 32) = 2, while ignoring zoom would give
    // floor(33 / 32) = 1. (Clicking at +1px, as this test used to, resolves to
    // column 0 under BOTH formulas and so proved nothing.) Both columns are
    // positive, so no grid growth rebases the result.
    const untouchedBefore = editorLevelSignal.value[0][1];
    fireEvent.mouseDown(canvas, {
      button: 0,
      clientX: panX + RENDERED_TILE_SIZE + 1,
      clientY: panY + 1,
    });

    // editorSelectedToolSignal is 'G' by default (see beforeEach), matching
    // this file's own existing left-click paint assertions (e.g. line 1702).
    expect(editorLevelSignal.value[0][2]).toBe('G');
    // The zoom-blind column must be untouched.
    expect(editorLevelSignal.value[0][1]).toBe(untouchedBefore);
  });

  it('scalesGrowthPanCompensationByTheActiveZoom-soTheViewDoesNotJump', async () => {
    // The mirror of the 100%-zoom SC-006 test above: `compensateForGrowth`
    // shifts a RAW-pixel pan by a TILE-unit growth, so it has to carry the
    // active zoom. At 50% an unscaled compensation over-corrects by 2x.
    render(<LevelEditorPage />);
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());
    levelEditorPage.setZoomViaSlider(50);

    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    const originXBefore = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls.at(-1)![4] as number;

    // One pixel left of where column 0 draws -> column -1 -> colShift 1.
    fireEvent.mouseDown(canvas, { button: 0, clientX: originXBefore * 0.5 - 1, clientY: 1 });

    await waitFor(() => {
      const originXAfter = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls.at(-1)![4] as number;
      // The pan moves by -RENDERED_TILE_SIZE * zoom raw pixels; drawTerrain's
      // origin is that pan divided by zoom again, so it lands exactly one
      // unscaled tile lower. A zoom-blind compensation would move the pan by a
      // full raw tile and land this at -2 tiles instead.
      expect(originXAfter).toBeCloseTo(originXBefore - RENDERED_TILE_SIZE, 5);
    });
  });

  it('panningIsUnaffectedByTheCurrentZoomLevel-userStory3', async () => {
    render(<LevelEditorPage />);
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());
    levelEditorPage.setZoomViaSlider(50);

    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    const originXBefore = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls.at(-1)![4] as number;

    fireEvent.mouseDown(canvas, { button: 1, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 70, clientY: 100 }); // 30px raw screen drag, leftward
    fireEvent.mouseUp(canvas);

    await waitFor(() => {
      const originXAfter = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls.at(-1)![4] as number;
      // Task 3 divides panOffset by zoom before passing it as drawTerrain's
      // origin argument, so a 30px RAW screen drag (clientX 100 -> 70, i.e.
      // -30) at 50% zoom moves that argument by -30 / 0.5 = -60 — proving
      // the drag itself still moved the pan by exactly 30 raw pixels
      // (design.md "Panning stays in raw pixels, outside the scale"), not
      // by some zoom-scaled amount.
      expect(originXAfter - originXBefore).toBeCloseTo(-60, 5);
    });
  });

  it('theBlueprintCanvasZoomsIndependentlyOfTheLevelCanvas-userStory4', async () => {
    render(<LevelEditorPage />);
    levelEditorPage.setZoomViaSlider(50);
    await levelEditorPage.setCanvas('blueprint');
    expect(levelEditorPage.zoomValue).toBe('100%');
  });
});

async function saveBlueprintAs(name: string) {
  await userEvent.click(levelEditorPage.toolbar.save);
  const nameField = levelEditorPage.saveDialog.nameInput;
  await userEvent.clear(nameField);
  await userEvent.type(nameField, name);
  await userEvent.click(levelEditorPage.saveDialog.confirm);
}

describe('LevelEditorPage — blueprint select and save (step 44a)', () => {
  // Belt-and-suspenders alongside the file's top-level afterEach above: every
  // test in this block stubs `fetch` (stubBlueprintWrite/stubDownloads), and
  // a leaked stub here would silently answer the next test's dev-environment
  // ping as well as its saves.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('levelMode-showsTheLevelSelectAndSaveButOfferNoBlueprintPair', async () => {
    render(<LevelEditorPage />);

    // Exactly one selector — the shared component renders once, so this is
    // also the "never both pairs stacked" assertion.
    expect(levelEditorPage.entrySelect.trigger).toHaveTextContent('main');
    expect(levelEditorPage.toolbar.save).toBeInTheDocument();
    expect(levelEditorPage.toolbar.export).toBeInTheDocument();
    expect(levelEditorPage.toolbar.try).toBeInTheDocument();

    await userEvent.click(levelEditorPage.toolbar.save);
    expect(await screen.findByText('Save this level')).toBeInTheDocument();
  });

  it('blueprintMode-swapsInTheBlueprintPairAndHidesTheLevelPair', async () => {
    render(<LevelEditorPage />);

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    expect(levelEditorPage.entrySelect.trigger).toHaveTextContent('new');
    expect(levelEditorPage.toolbar.save).toBeInTheDocument();
    // Export serializes the level grid and Try boots the game from it —
    // both meaningless for a spawn-less blueprint, so they go with the
    // level pair rather than staying visible and broken.
    expect(levelEditorPage.toolbar.queryExport).not.toBeInTheDocument();
    expect(levelEditorPage.toolbar.queryTry).not.toBeInTheDocument();

    await userEvent.click(levelEditorPage.toolbar.save);
    expect(await screen.findByText('Save this blueprint')).toBeInTheDocument();
  });

  it('savingTheBlueprintCanvas-postsTheCroppedLayoutToTheBlueprintWriteEndpoint', async () => {
    const { fetchCalls } = stubBlueprintWrite();
    renderEditorInBlueprintMode();
    // One cell painted at (col 2, row 1) of an otherwise-empty canvas: the
    // crop's tightest non-'.' bounding box is that single cell, so the saved
    // layout is exactly ['G'].
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    expect(blueprintPostBody(fetchCalls)).toEqual({
      fileName: 'test-room.json',
      contents: blueprintFileJson('Test Room', ['G'], []),
    });
  });

  it('savingTheBlueprintCanvas-namesItOnTheDropdownTriggerAndClosesTheDialog', async () => {
    stubBlueprintWrite();
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    expect(levelEditorPage.entrySelect.trigger).toHaveTextContent('Test Room');
    await waitFor(() => expect(levelEditorPage.saveDialog.queryRoot).not.toBeInTheDocument());
  });

  it('savingTheBlueprintCanvas-writesNoLevelFileAndLeavesTheLevelUntouched', async () => {
    const levelGridBefore = editorLevelSignal.value;
    const { fetchCalls } = stubBlueprintWrite();
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    // The blueprint save must never reach the LEVEL write endpoint, and must
    // not disturb the level canvas sitting behind it.
    expect(fetchCalls().every(([url]) => url !== SAVE_LEVEL_ENDPOINT)).toBe(true);
    expect(editorLevelSignal.value).toEqual(levelGridBefore);
  });

  it('savingABlueprintWithAPaintedBackgroundCell-postsItCroppedOntoTheSameOrigin', async () => {
    const { fetchCalls } = stubBlueprintWrite();
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    fireEvent.click(levelEditorPage.toolbar.layerBackground);
    fireEvent.click(await levelEditorPage.palette.findBackgroundTile('dirt'));
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    // The foreground crop's origin is (col 2, row 1) — the only painted cell —
    // so a background cell painted on that same cell crops to a single-cell
    // grid holding it.
    expect(JSON.parse(blueprintPostBody(fetchCalls).contents).background).toEqual(['d']);
  });

  it('noDevServer-savingABlueprint-saysSoAndKeepsTheDialogOpenWithTheDownloadedFile', async () => {
    const { anchorClick } = stubDownloads();
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    expect(anchorClick).toHaveBeenCalledOnce();
    expect((anchorClick.mock.instances[0] as HTMLAnchorElement).download).toBe('test-room.json');
    // Same convention as a level save: a fallback download leaves the dialog
    // open, because the file still has to be moved.
    expect(await levelEditorPage.saveDialog.findResult()).toBeInTheDocument();
  });

  it('reopeningABlueprintFromTheRegistry-loadsItsLayoutOntoTheCanvas', async () => {
    // A saved file only reaches the dropdown once Vite has picked it up, so
    // this stands in for "after the reload" — the registry entry is present
    // and the dropdown must load it onto the canvas.
    blueprintEntries.push({ id: 'test-room', name: 'Test Room', layout: ['G+'] });
    renderEditorInBlueprintMode();

    fireEvent.click(levelEditorPage.entrySelect.trigger);
    await userEvent.click(await levelEditorPage.entrySelect.findOption('test-room'));

    await waitFor(() => {
      expect(editorBlueprintSignal.value).toEqual(importLayout(['G+']));
    });
    expect(levelEditorPage.entrySelect.trigger).toHaveTextContent('Test Room');
  });

  it('loadingABlueprintWithUnsavedEdits-asksBeforeDiscardingThem', async () => {
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    // Wait for the debounced sync FIRST. Without it the signal would still
    // hold the pre-paint blank canvas, and the "was not replaced" assertion
    // below would pass for the wrong reason (or fail, depending on timing) —
    // the blank canvas is exactly what loading would have written.
    await waitFor(() => expect(editorBlueprintSignal.value[1][2]).toBe('G'));

    fireEvent.click(levelEditorPage.entrySelect.trigger);
    await userEvent.click(await levelEditorPage.entrySelect.findOption('new'));

    expect(await levelEditorPage.entrySelect.findDiscardDialog()).toBeInTheDocument();
    // `loadBlueprint` writes the signal directly (not only local state), so
    // the painted cell still being there proves nothing was loaded yet.
    expect(editorBlueprintSignal.value[1][2]).toBe('G');
  });
});

describe('LevelEditorPage — blueprint connection points (step 44b)', () => {
  it('blueprintMode-thePaletteOffersTheConnectionPointTool', () => {
    render(<LevelEditorPage />);

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    expect(levelEditorPage.palette.tile('+')).toBeInTheDocument();
  });

  it('levelMode-thePaletteDoesNotOfferTheConnectionPointTool', () => {
    render(<LevelEditorPage />);

    expect(levelEditorPage.palette.queryTile('+')).not.toBeInTheDocument();
  });

  it('paintingWithTheConnectionPointTool-writesItsCharacterIntoTheBlueprintGrid', async () => {
    renderEditorInBlueprintMode();
    fireEvent.click(levelEditorPage.palette.tile('+'));

    paintBlueprintCell(2, 1);

    await waitFor(() => {
      expect(editorBlueprintSignal.value[1][2]).toBe('+');
    });
  });

  it('savingABlueprintWithAConnectionPoint-keepsTheCharacterInThePostedLayout', async () => {
    // The crop/export path carries '+' like any other character — nothing in
    // saveBlueprint/cropLevelForExport knows about connection points, which is
    // exactly what Part 2's placement relies on to read them back.
    const { fetchCalls } = stubBlueprintWrite();
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    fireEvent.click(levelEditorPage.palette.tile('+'));
    paintBlueprintCell(3, 1);

    await saveBlueprintAs('Test Room');

    expect(JSON.parse(blueprintPostBody(fetchCalls).contents).layout).toEqual(['G+']);
  });

  it('connectionPointArmed-switchingToLevel-disarmsItSoClicksCannotPaintOneIntoTheLevel', () => {
    // The palette merely stops OFFERING the tool (Task 3). `selectedTool` is
    // persisted and shared by both canvases, so without an explicit disarm a
    // session that left '+' armed would paint inert markers into a real
    // level through a palette showing nothing selected.
    editorCanvasModeSignal.value = 'blueprint';
    editorSelectedToolSignal.value = '+';
    render(<LevelEditorPage />);

    fireEvent.click(levelEditorPage.toolbar.canvasLevel);

    expect(editorSelectedToolSignal.value).not.toBe('+');
    expect(levelEditorPage.palette.tile('G')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('mountedInLevelModeWithTheConnectionPointArmed-disarmsItWithoutAnyToggleClick', () => {
    // Both the mode and the tool are persisted, so the editor can come back
    // up on the level canvas with '+' selected and no toggle click to
    // trigger the other disarm path.
    editorCanvasModeSignal.value = 'level';
    editorSelectedToolSignal.value = '+';

    render(<LevelEditorPage />);

    expect(editorSelectedToolSignal.value).not.toBe('+');
    expect(levelEditorPage.palette.queryTile('+')).not.toBeInTheDocument();
  });

  it('blueprintModeWithTheConnectionPointArmed-keepsItArmedAcrossAMountInThatMode', () => {
    // The mirror case must NOT be disarmed: '+' is a perfectly valid armed
    // tool on the blueprint canvas.
    editorCanvasModeSignal.value = 'blueprint';
    editorSelectedToolSignal.value = '+';

    render(<LevelEditorPage />);

    expect(editorSelectedToolSignal.value).toBe('+');
    expect(levelEditorPage.palette.tile('+')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('LevelEditorPage — dev-only Save controls (step 44c)', () => {
  it('noDevEnvironment-levelMode-offersNoSaveButtonAtAll', () => {
    // A built/statically-served site cannot write a file, so the control is
    // hidden rather than left to fall back to a download nobody asked for.
    isDevEnvironmentSignal.value = false;
    render(<LevelEditorPage />);

    expect(levelEditorPage.toolbar.querySave).not.toBeInTheDocument();
  });

  it('noDevEnvironment-levelMode-keepsEverythingThatNeedsNoServer', () => {
    isDevEnvironmentSignal.value = false;
    render(<LevelEditorPage />);

    expect(levelEditorPage.entrySelect.trigger).toBeInTheDocument();
    expect(levelEditorPage.toolbar.export).toBeInTheDocument();
    expect(levelEditorPage.toolbar.try).toBeInTheDocument();
  });

  it('noDevEnvironment-blueprintMode-offersNoSaveBlueprintButtonButKeepsTheDropdown', () => {
    isDevEnvironmentSignal.value = false;
    render(<LevelEditorPage />);

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    expect(levelEditorPage.toolbar.querySave).not.toBeInTheDocument();
    // Loading an already-saved blueprint needs no server — the registry is a
    // static import — so the dropdown stays.
    expect(levelEditorPage.entrySelect.trigger).toBeInTheDocument();
  });

  it('devEnvironment-showsBothSaveControlsInTheirOwnModes', async () => {
    render(<LevelEditorPage />);

    expect(levelEditorPage.toolbar.save).toBeInTheDocument();
    await userEvent.click(levelEditorPage.toolbar.save);
    expect(await screen.findByText('Save this level')).toBeInTheDocument();
    await userEvent.click(levelEditorPage.saveDialog.cancel);

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    expect(levelEditorPage.toolbar.save).toBeInTheDocument();
    await userEvent.click(levelEditorPage.toolbar.save);
    expect(await screen.findByText('Save this blueprint')).toBeInTheDocument();
  });

  it('theMountPing-answeringIsDevTrue-bringsTheSaveButtonBack', async () => {
    // The realistic startup order: the page mounts with the signal still
    // false, pings, and the control appears when the answer lands.
    isDevEnvironmentSignal.value = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ isDev: true }) } as Response)),
    );

    render(<LevelEditorPage />);

    expect(await levelEditorPage.toolbar.findSave()).toBeInTheDocument();
  });
});

const CAVE_ROOM: Blueprint = { id: 'cave-room', name: 'Cave Room', layout: ['##'] };

/**
 * A spawn-less 3x3 level. `centerPanOnSpawn` falls back to `{ x: 0, y: 0 }` on a
 * grid with no 'S', so the level canvas's pan is a known zero and a click at
 * `col * RENDERED_TILE_SIZE + 1` lands on exactly that column — the same
 * determinism trick `paintBlueprintCell` relies on for the blueprint canvas.
 */
function renderEditorWithBlueprints(...blueprints: Blueprint[]) {
  blueprintEntries.push(...blueprints);
  editorLevelSignal.value = importLayout(['...', '...', '...']);
  render(<LevelEditorPage />);
}

function clickLevelCell(col: number, row: number, button = 0) {
  const canvas = levelEditorPage.canvas;
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
  fireEvent.mouseDown(canvas, {
    button,
    clientX: col * RENDERED_TILE_SIZE + 1,
    clientY: row * RENDERED_TILE_SIZE + 1,
  });
}

// The live hover preview is driven by mouse movement, not a click — this is
// the hover-only half of what a real mouse move over an armed placement does.
function hoverLevelCell(col: number, row: number) {
  const canvas = levelEditorPage.canvas;
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
  fireEvent.mouseMove(canvas, {
    clientX: col * RENDERED_TILE_SIZE + 1,
    clientY: row * RENDERED_TILE_SIZE + 1,
  });
}

describe('LevelEditorPage — arming a blueprint for placement (step 44c)', () => {
  it('levelMode-thePaletteListsTheSavedBlueprints', () => {
    renderEditorWithBlueprints(CAVE_ROOM);

    expect(levelEditorPage.palette.blueprintTile('cave-room')).toBeInTheDocument();
  });

  it('blueprintMode-thePaletteListsNoBlueprintsToPlace', () => {
    // Nesting is out of scope: a blueprint cannot be placed into a blueprint.
    renderEditorWithBlueprints(CAVE_ROOM);

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    expect(levelEditorPage.palette.queryBlueprintTile('cave-room')).not.toBeInTheDocument();
  });

  it('clickingABlueprintTile-armsItAndPersistsThat', () => {
    renderEditorWithBlueprints(CAVE_ROOM);

    fireEvent.click(levelEditorPage.palette.blueprintTile('cave-room'));

    expect(levelEditorPage.palette.blueprintTile('cave-room')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(editorArmedBlueprintIdSignal.value).toBe('cave-room');
  });

  it('clickingTheArmedBlueprintAgain-disarmsIt', () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    fireEvent.click(levelEditorPage.palette.blueprintTile('cave-room'));

    fireEvent.click(levelEditorPage.palette.blueprintTile('cave-room'));

    expect(editorArmedBlueprintIdSignal.value).toBeNull();
    expect(levelEditorPage.palette.blueprintTile('cave-room')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('armingABlueprint-leavesTheSelectedTileToolAloneSoDisarmingRestoresIt', () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    fireEvent.click(levelEditorPage.palette.tile('R'));

    fireEvent.click(levelEditorPage.palette.blueprintTile('cave-room'));

    expect(editorSelectedToolSignal.value).toBe('R');
    expect(levelEditorPage.palette.tile('R')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('pickingATileTool-disarmsTheBlueprint', () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    fireEvent.click(levelEditorPage.palette.blueprintTile('cave-room'));

    fireEvent.click(levelEditorPage.palette.tile('R'));

    expect(editorArmedBlueprintIdSignal.value).toBeNull();
    expect(levelEditorPage.palette.blueprintTile('cave-room')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('armedBlueprint-switchingToTheBlueprintCanvas-disarmsIt', () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    fireEvent.click(levelEditorPage.palette.blueprintTile('cave-room'));

    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    expect(editorArmedBlueprintIdSignal.value).toBeNull();
  });

  it('mountedInBlueprintModeWithABlueprintArmed-disarmsItWithoutAnyToggleClick', () => {
    // Both the mode and the armed id are persisted, so the editor can come back
    // up on the blueprint canvas with a blueprint still armed — the mirror of
    // the Spawn and Connection Point mount-time corrections.
    blueprintEntries.push(CAVE_ROOM);
    editorCanvasModeSignal.value = 'blueprint';
    editorArmedBlueprintIdSignal.value = 'cave-room';

    render(<LevelEditorPage />);

    expect(editorArmedBlueprintIdSignal.value).toBeNull();
  });

  it('aPersistedArmedIdWithNoBlueprintBehindIt-behavesAsNotArmedAndStillPaints', async () => {
    // The blueprint's file can be deleted between sessions. `findBlueprint`
    // returns undefined, which reads as "nothing armed" everywhere, so clicks
    // paint instead of silently doing nothing.
    editorArmedBlueprintIdSignal.value = 'deleted-room';
    editorLevelSignal.value = importLayout(['...', '...', '...']);
    render(<LevelEditorPage />);

    clickLevelCell(1, 1);

    expect(editorDirtySignal.value).toBe(true);
    await waitFor(() => expect(editorLevelSignal.value[1][1]).toBe('G'));
  });
});

describe('LevelEditorPage — placing a blueprint (step 44c)', () => {
  const armCaveRoom = () => fireEvent.click(levelEditorPage.palette.blueprintTile('cave-room'));

  it('hovering-previewsWithoutWritingAnythingOrDirtyingTheLevel', () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();

    hoverLevelCell(1, 1);

    // Painting sets the dirty flag synchronously, so this genuinely proves no
    // paint happened (the grid signal itself is debounced and would not have
    // changed yet either way).
    expect(editorDirtySignal.value).toBe(false);
  });

  it('hoverThenClick-stampsEveryCellOfTheRoomIntoTheLevelGrid', async () => {
    // A 3x3 level, ['##'] anchored at (col 1, row 1): absolute (1,1) and (1,2),
    // both in bounds, so neither growGrid call grows anything and both shifts
    // are 0.
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();

    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);

    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...']));
    });
    expect(editorDirtySignal.value).toBe(true);
  });

  it('hoveringElsewhereThenClicking-commitsAtTheNewHoverPositionNotTheOldOne', async () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();

    hoverLevelCell(0, 0);
    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);

    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...']));
    });
  });

  it('placingPastTheTopLeftCorner-growsTheGridTheSameWayPaintingThereWould', async () => {
    // Anchored at (col -1, row -1) on a 3x3 grid: growGrid(-1,-1) prepends one
    // column and one row (4 wide x 4 high, both shifts 1), the second grow is a
    // no-op, and the two cells land at (0,0) and (0,1) of the grown grid.
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();

    hoverLevelCell(-1, -1);
    clickLevelCell(-1, -1);

    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(
        importLayout(['##..', '....', '....', '....']),
      );
    });
  });

  it('overlappingExistingTerrain-clickWritesNothing', async () => {
    blueprintEntries.push(CAVE_ROOM);
    editorLevelSignal.value = importLayout(['G..', '...', '...']);
    render(<LevelEditorPage />);
    armCaveRoom();

    // Hovering (col 0, row 0) the room would land on (0,0), which holds 'G'.
    hoverLevelCell(0, 0);
    clickLevelCell(0, 0);

    expect(editorDirtySignal.value).toBe(false);
    await waitFor(() => expect(editorLevelSignal.value).toEqual(importLayout(['G..', '...', '...'])));
  });

  it('committing-keepsTheBlueprintArmedSoAnotherCopyCanBePlaced', () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();

    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);

    expect(editorArmedBlueprintIdSignal.value).toBe('cave-room');
  });

  it('rightClickWhileArmed-cancelsThePlacementAndDisarmsWithoutErasingAnything', async () => {
    blueprintEntries.push(CAVE_ROOM);
    editorLevelSignal.value = importLayout(['G..', '...', '...']);
    render(<LevelEditorPage />);
    armCaveRoom();
    hoverLevelCell(1, 1);

    clickLevelCell(0, 0, 2);

    expect(editorArmedBlueprintIdSignal.value).toBeNull();
    // Right-click normally erases, which would blank the 'G' and dirty the
    // level — during a placement it must do neither.
    expect(editorDirtySignal.value).toBe(false);
    await waitFor(() => expect(editorLevelSignal.value[0][0]).toBe('G'));
  });

  it('aBlueprintWithABackgroundCell-stampsItRebasedOntoTheAnchor', async () => {
    renderEditorWithBlueprints({
      id: 'cave-room',
      name: 'Cave Room',
      layout: ['##'],
      background: ['d'],
    });
    armCaveRoom();

    // Hovering (col 1, row 1) with no growth, so the cell rebases to (1,1).
    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);

    await waitFor(() => {
      expect(editorBackgroundSignal.value[1]?.[1]).toBe('d');
    });
  });

  it('growthOnCommit-shiftsTheLevelsOwnBackgroundButNotTheBlueprintsOwn', async () => {
    // The level already has a cell at (0,0); the placement grows one column and
    // one row, so that cell moves to (1,1). The blueprint's own cell is
    // rebased with the same shift already folded in — (0 + -1 + 1) = 0 on both
    // axes — and must not be shifted a second time.
    blueprintEntries.push({
      id: 'cave-room',
      name: 'Cave Room',
      layout: ['##'],
      background: ['d'],
    });
    editorLevelSignal.value = importLayout(['...', '...', '...']);
    editorBackgroundSignal.value = [['d']];
    render(<LevelEditorPage />);
    armCaveRoom();

    hoverLevelCell(-1, -1);
    clickLevelCell(-1, -1);

    await waitFor(() => {
      expect(editorBackgroundSignal.value[1]?.[1]).toBe('d');
      expect(editorBackgroundSignal.value[0]?.[0]).toBe('d');
    });
  });

  it('backgroundLayerActive-clicksStillPaintTheBackgroundEvenWithABlueprintArmed', async () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();
    fireEvent.click(levelEditorPage.toolbar.layerBackground);
    fireEvent.click(await levelEditorPage.palette.findBackgroundTile('dirt'));

    clickLevelCell(1, 1);

    await waitFor(() => expect(editorBackgroundSignal.value[1]?.[1]).toBe('d'));
  });
});

describe('LevelEditorPage — undoing a placement (step 44c follow-up)', () => {
  const armCaveRoom = () => fireEvent.click(levelEditorPage.palette.blueprintTile('cave-room'));

  it('beforeAnyPlacement-thereIsNoUndoButton', () => {
    renderEditorWithBlueprints(CAVE_ROOM);

    expect(levelEditorPage.toolbar.queryUndo).not.toBeInTheDocument();
  });

  it('afterCommittingAPlacement-anUndoButtonAppears', async () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();
    hoverLevelCell(1, 1);

    clickLevelCell(1, 1);

    await waitFor(() =>
      expect(levelEditorPage.toolbar.undo).toBeInTheDocument(),
    );
  });

  it('clickingUndo-restoresTheGridAndBackgroundFromBeforeThatPlacementAndHidesTheButton', async () => {
    blueprintEntries.push({
      id: 'cave-room',
      name: 'Cave Room',
      layout: ['##'],
      background: ['d'],
    });
    editorLevelSignal.value = importLayout(['...', '...', '...']);
    editorBackgroundSignal.value = [];
    render(<LevelEditorPage />);
    armCaveRoom();
    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);
    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...']));
    });

    fireEvent.click(levelEditorPage.toolbar.undo);

    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '...', '...']));
    });
    expect(editorBackgroundSignal.value).toEqual([]);
    expect(levelEditorPage.toolbar.queryUndo).not.toBeInTheDocument();
  });

  it('paintingAfterAPlacement-clearsTheUndoButton', async () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();
    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);
    await waitFor(() =>
      expect(levelEditorPage.toolbar.undo).toBeInTheDocument(),
    );

    // Picking a tile tool disarms the blueprint; painting with it is a
    // regular edit that must invalidate undoing the earlier placement.
    fireEvent.click(levelEditorPage.palette.tile('R'));
    clickLevelCell(0, 0);

    expect(levelEditorPage.toolbar.queryUndo).not.toBeInTheDocument();
  });

  it('erasingAfterAPlacement-clearsTheUndoButton', async () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();
    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);
    await waitFor(() =>
      expect(levelEditorPage.toolbar.undo).toBeInTheDocument(),
    );

    fireEvent.click(levelEditorPage.palette.tile('R'));
    clickLevelCell(0, 0, 2); // right-click erases once nothing is armed

    expect(levelEditorPage.toolbar.queryUndo).not.toBeInTheDocument();
  });

  it('paintingTheBackgroundLayerAfterAPlacement-clearsTheUndoButton', async () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();
    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);
    await waitFor(() =>
      expect(levelEditorPage.toolbar.undo).toBeInTheDocument(),
    );

    fireEvent.click(levelEditorPage.toolbar.layerBackground);
    fireEvent.click(await levelEditorPage.palette.findBackgroundTile('dirt'));
    clickLevelCell(0, 0);

    expect(levelEditorPage.toolbar.queryUndo).not.toBeInTheDocument();
  });

  it('committingASecondPlacement-replacesTheUndoTargetWithTheNewOne', async () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();
    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);
    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...']));
    });

    hoverLevelCell(0, 0);
    clickLevelCell(0, 0);
    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['##.', '.##', '...']));
    });

    fireEvent.click(levelEditorPage.toolbar.undo);

    // Undo restores to just before the SECOND placement — the first stamped
    // room is still there — not all the way back to the original empty grid.
    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...']));
    });
  });

  it('pressingCtrlZ-undoesTheMostRecentPlacementJustLikeTheButton', async () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();
    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);
    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...']));
    });

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '...', '...']));
    });
    expect(levelEditorPage.toolbar.queryUndo).not.toBeInTheDocument();
  });

  it('pressingCmdZ-alsoUndoes', async () => {
    // Mac uses Cmd instead of Ctrl for the same shortcut.
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();
    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);
    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...']));
    });

    fireEvent.keyDown(window, { key: 'z', metaKey: true });

    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '...', '...']));
    });
  });

  it('pressingCtrlZWithNothingToUndo-doesNothing', () => {
    renderEditorWithBlueprints(CAVE_ROOM);

    expect(() => fireEvent.keyDown(window, { key: 'z', ctrlKey: true })).not.toThrow();
    expect(editorLevelSignal.value).toEqual(importLayout(['...', '...', '...']));
  });

  it('pressingCtrlZWhileTypingInATextField-doesNotUndo', async () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();
    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);
    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...']));
    });
    fireEvent.click(levelEditorPage.toolbar.save);
    const nameInput = levelEditorPage.saveDialog.nameInput;

    fireEvent.keyDown(nameInput, { key: 'z', ctrlKey: true });

    // The browser's own field-level undo, not this page's, owns Ctrl+Z here.
    // (Not asserting the "Undo placement" button's presence here: opening the
    // Save dialog makes the rest of the page aria-hidden, which getByRole
    // correctly treats as not present regardless of this shortcut.)
    expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...']));
  });

  it('pressingCtrlZInBlueprintMode-doesNothing', async () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();
    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);
    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...']));
    });
    fireEvent.click(levelEditorPage.toolbar.canvasBlueprint);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    // Undoing a level placement while looking at the blueprint canvas would
    // be invisible and confusing — the shortcut matches the button's own
    // Level-only visibility (see `placementActive`'s `!isBlueprintMode`).
    fireEvent.click(levelEditorPage.toolbar.canvasLevel);
    expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...']));
  });
});

describe('LevelEditorPage — full authoring loop through the toolbar (US2)', () => {
  const LOOP_ROOM: Blueprint = { id: 'cave-room', name: 'Cave Room', layout: ['##'] };

  it('selectTool-paint-place-undo-export-save-tryAllWorkFromTheToolbar', async () => {
    stubDevServerWrite();
    blueprintEntries.push(LOOP_ROOM);
    editorLevelSignal.value = importLayout(['...', '...', '...']);
    render(<LevelEditorPage />);

    // Pick a tool from the palette and paint a cell.
    fireEvent.click(levelEditorPage.palette.tile('R'));
    clickLevelCell(0, 0);
    await waitFor(() => expect(editorLevelSignal.value[0][0]).toBe('R'));

    // Arm a blueprint from the palette, hover and place it.
    fireEvent.click(levelEditorPage.palette.blueprintTile('cave-room'));
    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);
    await waitFor(() =>
      expect(editorLevelSignal.value).toEqual(importLayout(['R..', '.##', '...'])),
    );
    await waitFor(() => expect(levelEditorPage.toolbar.undo).toBeInTheDocument());

    // Undo the placement from the toolbar.
    await userEvent.click(levelEditorPage.toolbar.undo);
    await waitFor(() =>
      expect(editorLevelSignal.value).toEqual(importLayout(['R..', '...', '...'])),
    );
    expect(levelEditorPage.toolbar.queryUndo).not.toBeInTheDocument();

    // Export the layout from the toolbar.
    await userEvent.click(levelEditorPage.toolbar.export);
    // cropLevelForExport crops to the tightest non-'.' box — the single painted cell.
    expect(await levelEditorPage.exportDialog.findOutput()).toHaveValue(
      expectedExportText(importLayout(['R..', '...', '...'])),
    );
    await userEvent.keyboard('{Escape}');

    // Save the layout from the toolbar.
    await userEvent.click(levelEditorPage.toolbar.save);
    await userEvent.clear(levelEditorPage.saveDialog.nameInput);
    await userEvent.type(levelEditorPage.saveDialog.nameInput, 'Loop');
    await userEvent.click(levelEditorPage.saveDialog.confirm);
    expect(await levelEditorPage.toolbar.findSaveStatus()).toBeInTheDocument();

    // Try the layout from the toolbar. `tryLayout` boots the game from the
    // exported grid, which must hold a spawn marker, so seed one first.
    editorLevelSignal.value = importLayout(['S.R', '...', '...']);
    currentPath.value = '/platformer/editor';
    await userEvent.click(levelEditorPage.toolbar.try);
    expect(currentLayout.value).toEqual(exportLayout(importLayout(['S.R', '...', '...'])));
    expect(currentPath.value).toBe('/platformer?debug=1');
  });

  it('ctrlZUndoesAPlacementThroughTheSameActionAsTheToolbarControl', async () => {
    renderEditorWithBlueprints(LOOP_ROOM);
    fireEvent.click(levelEditorPage.palette.blueprintTile('cave-room'));
    hoverLevelCell(1, 1);
    clickLevelCell(1, 1);
    await waitFor(() =>
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...'])),
    );

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    await waitFor(() =>
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '...', '...'])),
    );
    expect(levelEditorPage.toolbar.queryUndo).not.toBeInTheDocument();
  });
});

describe('LevelEditorPage — editor appearance (O-015 US1)', () => {
  it('editor-whenStoredAppearanceIsDark-rendersDarkOnMount', () => {
    editorAppearanceSignal.value = 'dark';

    render(<LevelEditorPage />);

    expect(levelEditorPage.editorAppearanceAttribute).toBe('dark');
    expect(levelEditorPage.toolbar.appearanceToggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('editor-whenToggledToDarkAndRemounted-restoresDark', async () => {
    render(<LevelEditorPage />);
    expect(levelEditorPage.editorAppearanceAttribute).toBe('light');

    await levelEditorPage.toggleAppearance();
    expect(levelEditorPage.editorAppearanceAttribute).toBe('dark');

    cleanup();
    render(<LevelEditorPage />);

    expect(levelEditorPage.editorAppearanceAttribute).toBe('dark');
  });

  it('editor-whileMounted-setsTheAppearanceAttributeOnHtml', () => {
    render(<LevelEditorPage />);

    expect(levelEditorPage.editorAppearanceAttribute).toBe(editorAppearanceSignal.value);
  });

  it('editor-onUnmount-removesTheAppearanceAttribute', () => {
    render(<LevelEditorPage />);
    expect(levelEditorPage.editorAppearanceAttribute).toBe('light');

    cleanup();

    expect(levelEditorPage.editorAppearanceAttribute).toBeUndefined();
  });
});

describe('LevelEditorPage — editor appearance is independent of the site theme (O-015 US2)', () => {
  it('editor-whenCurrentThemeChanges-keepsItsOwnAppearanceValueAndAttribute', () => {
    const themeBefore = currentTheme.value;
    try {
      editorAppearanceSignal.value = 'dark';
      render(<LevelEditorPage />);
      expect(levelEditorPage.editorAppearanceAttribute).toBe('dark');

      currentTheme.value = 'space';
      expect(editorAppearanceSignal.value).toBe('dark');
      expect(levelEditorPage.editorAppearanceAttribute).toBe('dark');

      currentTheme.value = 'terminal';
      expect(editorAppearanceSignal.value).toBe('dark');
      expect(levelEditorPage.editorAppearanceAttribute).toBe('dark');
    } finally {
      currentTheme.value = themeBefore;
    }
  });

  it('editor-whenDarkAndAPortaledDialogIsOpen-keepsTheAttributeOnHtmlSoPortalsInheritThePalette', async () => {
    editorAppearanceSignal.value = 'dark';
    render(<LevelEditorPage />);

    await openExportDialog();
    await levelEditorPage.exportDialog.findOutput();

    // The dialog portals out to <body>; the attribute on <html> is what lets
    // its tokens resolve to the editor's dark palette (FR-005).
    expect(levelEditorPage.editorAppearanceAttribute).toBe('dark');
  });

  it('editor-whenDarkWithANonIdeSiteTheme-resolvesTheDarkPaletteFromItsOwnBlock', () => {
    // Vitest stubs CSS imports (including `?raw`), so read the stylesheet
    // straight from disk for this static guard.
    const editorCss = readFileSync('src/styles/themes/editor.css', 'utf8');
    const darkStart = editorCss.indexOf("[data-editor-appearance='dark']");
    expect(darkStart).toBeGreaterThanOrEqual(0);
    const darkBlock = editorCss.slice(darkStart);

    // Inlined values only: `var(--color-ctp-*)` is declared inside
    // `[data-theme='ide']` and would resolve to nothing under any other theme.
    expect(darkBlock).not.toContain('var(--color-ctp-');
    expect(darkBlock).toContain('--background: #1e1e2e');
    expect(darkBlock).toContain('--muted-foreground: #a6adc8');
    expect(darkBlock).toContain('--editor-canvas-backdrop:');
  });

  it('editor-whenMounted-neverWritesTheDataThemeAttribute', () => {
    document.documentElement.dataset.theme = 'space';
    editorAppearanceSignal.value = 'dark';

    render(<LevelEditorPage />);

    expect(document.documentElement.dataset.theme).toBe('space');
    expect(levelEditorPage.editorAppearanceAttribute).toBe('dark');
  });
});

describe('LevelEditorPage — the cave preview is view-only (O-015 US3)', () => {
  function stubLevelWrite() {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ path: 'src/themes/platformer/level/levels/parity.json' }),
      } as Response),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const levelPosts = (): { fileName: string; contents: string }[] =>
      (fetchMock.mock.calls as unknown as [string, RequestInit][])
        .filter(([url]) => url === SAVE_LEVEL_ENDPOINT)
        .map(([, init]) => JSON.parse(init.body as string) as { fileName: string; contents: string });
    return { levelPosts };
  }

  async function exportText() {
    await userEvent.click(levelEditorPage.toolbar.export);
    const textarea = (await levelEditorPage.exportDialog.findOutput()) as HTMLTextAreaElement;
    const value = textarea.value;
    await userEvent.keyboard('{Escape}');
    return value;
  }

  async function saveAsParity() {
    await userEvent.click(levelEditorPage.toolbar.save);
    const nameField = levelEditorPage.saveDialog.nameInput;
    await userEvent.clear(nameField);
    await userEvent.type(nameField, 'Parity');
    await userEvent.click(levelEditorPage.saveDialog.confirm);
    await waitFor(() => expect(levelEditorPage.saveDialog.queryRoot).not.toBeInTheDocument());
  }

  it('editor-withDarkModeOn-exportsAndSavesTheSameLayoutAsWithItOff', async () => {
    const { levelPosts } = stubLevelWrite();
    editorLevelSignal.value = importLayout(['S..', 'G..', '...']);

    // Light appearance.
    render(<LevelEditorPage />);
    const lightExport = await exportText();
    await saveAsParity();
    cleanup();

    // Dark appearance — same level, same edits.
    editorAppearanceSignal.value = 'dark';
    render(<LevelEditorPage />);
    const darkExport = await exportText();
    await saveAsParity();

    expect(darkExport).toBe(lightExport);
    expect(levelPosts()).toHaveLength(2);
    expect(levelPosts()[1]).toEqual(levelPosts()[0]);
  });
});
