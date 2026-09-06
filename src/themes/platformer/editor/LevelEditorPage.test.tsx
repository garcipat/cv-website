import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LevelEditorPage } from './LevelEditorPage';
import { LEVEL_1_LAYOUT, SCRATCH_LAYOUT, currentLayout } from '../level/level';
import { importLayout } from './importLayout';
import { centerPanOnSpawn } from './EditorPan';
import { exportLayout } from './exportLayout';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import {
  editorLevelSignal,
  editorSelectedToolSignal,
  editorLoadedLevelNameSignal,
  editorDirtySignal,
  editorBackgroundSignal,
  editorActiveLayerSignal,
  editorSelectedBackgroundPieceSignal,
  editorCanvasModeSignal,
  editorBlueprintSignal,
  editorBlueprintBackgroundSignal,
  editorLoadedBlueprintNameSignal,
} from './editorLevelState';
import { isDevEnvironmentSignal } from './devEnvironment';
import { BLANK_BLUEPRINT } from '../level/BlueprintData';
import { blueprintFileJson } from './saveBlueprintFile';
import { SAVE_BLUEPRINT_ENDPOINT } from './saveBlueprintEndpoint';
import { SAVE_LEVEL_ENDPOINT } from './saveLevelEndpoint';
import type { Blueprint } from '../level/BlueprintData';
import { currentTheme } from '@/state/theme';
import { currentPath } from '@/state/navigation';
import { enemyPlacements, enemyStates, collectedFacts, collectedCollectibleIds } from '../PlatformerState';
import { currentBackground } from '../level/level';

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
  drawSigns: vi.fn(),
  drawHazards: vi.fn(),
  drawBackgroundTiles: vi.fn(),
}));

// Adds one extra registry entry whose `background` mixes a valid, current
// pieceId with an unresolvable one — simulating a placement left over from a
// since-trimmed catalog (this branch's own catalog has been trimmed twice
// already). Every other test keeps using the real registry unchanged; this
// entry is additional, not a replacement, so it can't affect any test that
// picks 'main'/'empty'/'Cave Run' etc. by name.
//
// Defined via vi.hoisted since vi.mock factories are hoisted above normal
// top-level const declarations — referencing a plain const here would throw
// a "before initialization" error.
const { STALE_BACKGROUND_LEVEL } = vi.hoisted(() => ({
  STALE_BACKGROUND_LEVEL: {
    id: 'stale-background-level',
    name: 'stale-background-level',
    layout: ['...', '...', '...'],
    background: [
      { pieceId: 'dirtColumnTop1x1', col: 0, row: 0 },
      // Simulates a placement left over from a since-trimmed catalog — not a
      // real BackgroundPieceId, hence the cast.
      { pieceId: 'notARealPieceId', col: 1, row: 0 },
    ],
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
  editorSelectedBackgroundPieceSignal.value = null;
  currentBackground.value = [];
  editorCanvasModeSignal.value = 'level';
  editorBlueprintSignal.value = importLayout(BLANK_BLUEPRINT.layout);
  editorBlueprintBackgroundSignal.value = [];
  editorLoadedBlueprintNameSignal.value = BLANK_BLUEPRINT.name;
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
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    font: '',
    textAlign: '',
    textBaseline: '',
    lineJoin: '',
    fillText: vi.fn(),
    strokeText: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});

// LEVEL_1_LAYOUT is jagged (its ladder-shaft rows are short); importLayout
// right-pads to a rectangle the same way parseLevel does, and — as of this
// writing — LEVEL_1_LAYOUT's only all-'.' row is interior (between content
// rows), so content-cropping (exportLayout's job) removes nothing.
const EXPECTED_EXPORT_TEXT = importLayout(LEVEL_1_LAYOUT)
  .map((row) => `  '${row.join('')}',`)
  .join('\n');

async function openExportDialog() {
  await userEvent.click(screen.getByRole('button', { name: 'Export' }));
}

// The level dropdown's options are only mounted once it is opened (Base UI
// Select portals its popup content), so every selection opens it first.
async function selectLevel(name: string) {
  fireEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name }));
}

function paintOneCell() {
  const canvas = document.querySelector('canvas')!;
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
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  const nameField = await screen.findByLabelText(/level name/i);
  await userEvent.clear(nameField);
  await userEvent.type(nameField, name);
  await userEvent.click(screen.getByRole('button', { name: 'Save level file' }));
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
    expect(screen.queryByTestId('export-output')).not.toBeInTheDocument();
  });

  it('opens a dialog with the export textarea, whose content is LEVEL_1_LAYOUT cropped to its content (SC-009 ruling) and formatted as paste-ready quoted rows', async () => {
    render(<LevelEditorPage />);
    await openExportDialog();
    const textarea = (await screen.findByTestId('export-output')) as HTMLTextAreaElement;
    expect(textarea.value).toBe(EXPECTED_EXPORT_TEXT);
  });

  it('marks the export textarea read-only', async () => {
    render(<LevelEditorPage />);
    await openExportDialog();
    expect(await screen.findByTestId('export-output')).toHaveAttribute('readonly');
  });

  it('renders the palette (as a grid catalog) and canvas', () => {
    render(<LevelEditorPage />);
    expect(screen.getByRole('toolbar', { name: 'Palette' })).toBeInTheDocument();
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('selectingAPaletteTool-remountingThePage-stillHasThatToolSelected', () => {
    const original = editorSelectedToolSignal.value;
    try {
      render(<LevelEditorPage />);
      expect(screen.getByRole('button', { name: 'Ground Grass' })).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(screen.getByRole('button', { name: 'Enemy Green' }));
      expect(screen.getByRole('button', { name: 'Enemy Green' })).toHaveAttribute('aria-pressed', 'true');

      cleanup();
      render(<LevelEditorPage />);
      expect(screen.getByRole('button', { name: 'Enemy Green' })).toHaveAttribute('aria-pressed', 'true');
    } finally {
      editorSelectedToolSignal.value = original;
    }
  });

  it('renders a Copy Layout button inside the dialog that writes the export text to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<LevelEditorPage />);
    await openExportDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Copy Layout' }));
    expect(writeText).toHaveBeenCalledWith(EXPECTED_EXPORT_TEXT);
  });

  it('selectingAnotherLevelWithAnUnchangedGrid-loadsItWithNoConfirmation', async () => {
    render(<LevelEditorPage />);

    await selectLevel('empty');

    await openExportDialog();
    const textarea = (await screen.findByTestId('export-output')) as HTMLTextAreaElement;
    expect(textarea.value).toBe(SCRATCH_LAYOUT.map((row) => `  '${row}',`).join('\n'));
  });

  it('selectingALevelAfterEditing-opensTheDiscardDialogRatherThanLoadingImmediately', async () => {
    render(<LevelEditorPage />);
    paintOneCell();

    await selectLevel('empty');

    expect(await screen.findByRole('heading', { name: /discard changes/i })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /discard changes/i })).not.toBeInTheDocument(),
    );
    // Not loaded — only the confirmation dialog opened.
    await openExportDialog();
    const textarea = (await screen.findByTestId('export-output')) as HTMLTextAreaElement;
    expect(textarea.value).not.toBe(EXPECTED_EXPORT_TEXT);
  });

  it('confirmingTheDiscardDialog-reloadsTheShippedLayoutDiscardingEdits', async () => {
    render(<LevelEditorPage />);
    paintOneCell();

    await selectLevel('main');
    await userEvent.click(await screen.findByRole('button', { name: 'Discard and load' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /discard changes/i })).not.toBeInTheDocument(),
    );

    await openExportDialog();
    const textarea = (await screen.findByTestId('export-output')) as HTMLTextAreaElement;
    expect(textarea.value).toBe(EXPECTED_EXPORT_TEXT);
  });

  it('cancellingTheDiscardDialog-keepsTheEdits', async () => {
    render(<LevelEditorPage />);
    paintOneCell();

    await selectLevel('main');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /discard changes/i })).not.toBeInTheDocument(),
    );

    await openExportDialog();
    const textarea = (await screen.findByTestId('export-output')) as HTMLTextAreaElement;
    expect(textarea.value).not.toBe(EXPECTED_EXPORT_TEXT);
  });

  it('selectingEmpty-recentersTheViewOnItsSpawnRatherThanLeavingItWhereTheOldLevelWas', async () => {
    render(<LevelEditorPage />);
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());

    await selectLevel('empty');

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
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

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
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
    expect(screen.queryByRole('heading', { name: /discard changes/i })).not.toBeInTheDocument();
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

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(anchorClick).not.toHaveBeenCalled();
  });

  it('save-devServerWrites-reportsThePathItWasWrittenToInTheSidebar', async () => {
    stubDevServerWrite();
    render(<LevelEditorPage />);

    await saveAs('Cave Run');

    expect(await screen.findByText(/levels\/cave-run\.json/)).toBeInTheDocument();
  });

  it('save-devServerWrites-paintingAgain-dropsTheSavedPathBecauseTheFileIsNowStale', async () => {
    stubDevServerWrite();
    render(<LevelEditorPage />);
    await saveAs('Cave Run');
    await screen.findByText(/levels\/cave-run\.json/);

    paintOneCell();

    await waitFor(() =>
      expect(screen.queryByText(/levels\/cave-run\.json/)).not.toBeInTheDocument(),
    );
  });

  it('save-devServerWrites-loadingAnotherLevel-dropsTheSavedPath', async () => {
    stubDevServerWrite();
    render(<LevelEditorPage />);
    await saveAs('Cave Run');
    await screen.findByText(/levels\/cave-run\.json/);

    await selectLevel('empty');

    await waitFor(() =>
      expect(screen.queryByText(/levels\/cave-run\.json/)).not.toBeInTheDocument(),
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

    expect(await screen.findByText(/move it into/i)).toHaveTextContent(
      'src/themes/platformer/level/levels/',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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

    expect(await screen.findByText(/contents must be JSON/)).toBeInTheDocument();
  });

  it('saveDialog-beforeSaving-namesTheFolderTheLevelIsWrittenTo', async () => {
    render(<LevelEditorPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'src/themes/platformer/level/levels/',
    );
  });

  it('saveDialog-reopenedAfterAFallbackDownload-noLongerShowsThePreviousResult', async () => {
    stubDownloads();
    render(<LevelEditorPage />);
    await saveAs('Cave Run');
    await screen.findByText(/move it into/i);

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByText(/move it into/i)).not.toBeInTheDocument();
  });

  it('save-thenSelectingAnotherLevel-doesNotWarnAboutDiscardingChanges', async () => {
    stubDevServerWrite();
    render(<LevelEditorPage />);
    paintOneCell();

    await saveAs('Cave Run');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await selectLevel('empty');

    expect(screen.queryByRole('heading', { name: /discard changes/i })).not.toBeInTheDocument();
  });

  it('save-namesTheSavedLevelOnTheDropdownTrigger', async () => {
    stubDevServerWrite();
    render(<LevelEditorPage />);

    await saveAs('Cave Run');

    // A successful save closes the dialog, which is what makes the trigger
    // reachable again — an open dialog hides the page from the a11y tree.
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('Cave Run'));
  });

  it('compensates panOffset by exactly -colShift * RENDERED_TILE_SIZE when a paint grows the grid leftward, so existing content does not visually move (spec SC-006)', async () => {
    render(<LevelEditorPage />);
    // Wait for the mocked loadImage promises to resolve so images.tileset is
    // set and EditorCanvas's redraw effect actually calls drawTerrain.
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());

    const callsBefore = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
    const [, , , , originXBefore] = callsBefore[callsBefore.length - 1];

    const canvas = document.querySelector('canvas')!;
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
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    const textarea = (await screen.findByTestId('export-output')) as HTMLTextAreaElement;
    expect(textarea.value).toBe(editedGrid.map((row) => `  '${row.join('')}',`).join('\n'));
  });

  it('paintingACell-doesNotSyncToEditorLevelSignalImmediately', () => {
    render(<LevelEditorPage />);
    const canvas = document.querySelector('canvas')!;

    paint(canvas);

    expect(editorLevelSignal.value).toEqual(defaultGrid);
  });

  it('paintingACell-afterTheDebounceWindowElapses-syncsTheGridToEditorLevelSignal', () => {
    vi.useFakeTimers();
    render(<LevelEditorPage />);
    const canvas = document.querySelector('canvas')!;

    paint(canvas);
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(editorLevelSignal.value).not.toEqual(defaultGrid);
  });

  it('reloadingMainAfterConfirmation-alsoResetsEditorLevelSignalBackToTheDefaultLayout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<LevelEditorPage />);
    const canvas = document.querySelector('canvas')!;

    paint(canvas);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(editorLevelSignal.value).not.toEqual(defaultGrid);

    await selectLevel('main');
    fireEvent.click(await screen.findByRole('button', { name: 'Discard and load' }));

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
    fireEvent.click(await screen.findByRole('button', { name: 'Discard and load' }));

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

    await userEvent.click(screen.getByRole('button', { name: 'Try' }));

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
    await userEvent.click(screen.getByRole('button', { name: 'Try' }));

    expect(enemyStates.value).toHaveLength(enemyPlacements.value.length);
    expect(collectedFacts.value).toEqual([]);
    expect(collectedCollectibleIds.value.size).toBe(0);
  });
});

describe('LevelEditorPage — background layer', () => {
  function paintBackgroundOnce() {
    const canvas = document.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    fireEvent.mouseDown(canvas, { clientX: 1, clientY: 1, button: 0 });
  }

  it('selectingTheBackgroundLayerThenAPieceThenPaintingOnCanvas-addsAPlacement', async () => {
    render(<LevelEditorPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dirt Column Top (1×1)' }));

    paintBackgroundOnce();

    await waitFor(() => expect(editorBackgroundSignal.value.length).toBeGreaterThan(0));
  });

  it('tryingTheLevelWithBackgroundPlacementsPainted-carriesThemIntoCurrentBackground', async () => {
    render(<LevelEditorPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dirt Column Top (1×1)' }));
    paintBackgroundOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Try' }));

    expect(currentBackground.value.length).toBeGreaterThan(0);
  });

  it('loadingALevelWithBackgroundPlacements-populatesTheLocalBackgroundState', async () => {
    render(<LevelEditorPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dirt Column Top (1×1)' }));
    paintBackgroundOnce();
    await waitFor(() => expect(editorBackgroundSignal.value.length).toBeGreaterThan(0));

    // Loading 'empty' (a built-in level with no background) must clear the
    // placements back out rather than leaving the previous level's painted
    // pieces stuck on screen. Painting the background marks the editor dirty
    // (see the dirty-flag test below), so the level select now asks to
    // confirm the discard first, same as a foreground paint would.
    fireEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'empty' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard and load' }));

    await waitFor(() => expect(editorBackgroundSignal.value).toEqual([]));
  });

  it('paintingABackgroundCell-marksTheEditorDirty', async () => {
    render(<LevelEditorPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dirt Column Top (1×1)' }));

    paintBackgroundOnce();

    await waitFor(() => expect(editorDirtySignal.value).toBe(true));
  });

  it('shifts existing backgroundPlacements by colShift/rowShift when a FOREGROUND paint grows the grid, keeping the two layers from drifting apart (Task 20 gap #1)', async () => {
    render(<LevelEditorPage />);
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());

    // Place a background piece first, well inside the current grid (no
    // growth expected from this paint) — this is the placement that must
    // move when the FOREGROUND grid grows next.
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dirt Column Top (1×1)' }));
    paintBackgroundOnce();
    await waitFor(() => expect(editorBackgroundSignal.value.length).toBeGreaterThan(0));
    const placedCol = editorBackgroundSignal.value[0].col;
    const placedRow = editorBackgroundSignal.value[0].row;

    // Switch back to the foreground layer and paint one column left of the
    // grid's current left edge, growing it left by one column.
    fireEvent.click(screen.getByRole('button', { name: 'Foreground' }));
    const canvas = document.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    const callsBefore = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
    const [, , , , originXBefore] = callsBefore[callsBefore.length - 1];
    fireEvent.mouseDown(canvas, { button: 0, clientX: originXBefore - 1, clientY: 1 });

    await waitFor(() => {
      expect(editorBackgroundSignal.value[0].col).toBe(placedCol + 1);
      expect(editorBackgroundSignal.value[0].row).toBe(placedRow);
    });
  });

  it('loadingALevelWithAnUnresolvablePieceId-silentlyDropsOnlyThatPlacement', async () => {
    render(<LevelEditorPage />);

    fireEvent.click(screen.getByRole('combobox'));
    await userEvent.click(
      await screen.findByRole('option', { name: 'stale-background-level' }),
    );

    await waitFor(() => {
      expect(editorBackgroundSignal.value).toEqual([
        { pieceId: 'dirtColumnTop1x1', col: 0, row: 0 },
      ]);
    });
  });
});

// The blueprint canvas starts as one empty cell at pan {0,0}, so a click at
// col * RENDERED_TILE_SIZE + 1 lands on exactly that column (see the
// test-determinism notes in the plan).
function paintBlueprintCell(col: number, row: number) {
  const canvas = document.querySelector('canvas')!;
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
  fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));
}

describe('LevelEditorPage — Level/Blueprint canvas toggle (step 44a)', () => {
  it('onMount-theLevelCanvasIsActiveAndTheLayerToggleIsStillThere', () => {
    render(<LevelEditorPage />);

    expect(screen.getByRole('button', { name: 'Level' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Blueprint' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // Two independent axes: picking a canvas never removes the layer toggle.
    expect(screen.getByRole('button', { name: 'Foreground' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Background' })).toBeInTheDocument();
  });

  it('clickingBlueprint-marksTheBlueprintCanvasActiveAndPersistsTheMode', () => {
    render(<LevelEditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(screen.getByRole('button', { name: 'Blueprint' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(editorCanvasModeSignal.value).toBe('blueprint');
  });

  it('blueprintModeActive-thePaletteDropsTheSpawnTool', () => {
    render(<LevelEditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(screen.queryByRole('button', { name: 'Spawn' })).not.toBeInTheDocument();
  });

  it('backToLevelMode-thePaletteOffersSpawnAgain', () => {
    render(<LevelEditorPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    fireEvent.click(screen.getByRole('button', { name: 'Level' }));

    expect(screen.getByRole('button', { name: 'Spawn' })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dirt Column Top (1×1)' }));

    paintBlueprintCell(0, 0);

    await waitFor(() => expect(editorBlueprintBackgroundSignal.value).toHaveLength(1));
    expect(editorBackgroundSignal.value).toEqual([]);
  });

  it('blueprintCanvasContent-survivesSwitchingToTheLevelAndBack', async () => {
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    await waitFor(() => expect(editorBlueprintSignal.value[1][2]).toBe('G'));

    fireEvent.click(screen.getByRole('button', { name: 'Level' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(editorSelectedToolSignal.value).not.toBe('S');
    expect(screen.getByRole('button', { name: 'Ground Grass' })).toHaveAttribute(
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
    expect(screen.queryByRole('button', { name: 'Spawn' })).not.toBeInTheDocument();
  });

  it('mountedInBlueprintMode-firstSwitchToLevel-centersTheLevelOnItsSpawn', async () => {
    // Mounting in blueprint mode lets the blueprint canvas consume the
    // editor's one-shot centering request, which is a no-op on a spawn-less
    // grid — the level must still get centered when it first becomes active
    // (design note 5), rather than sitting unpanned at its top-left corner.
    editorCanvasModeSignal.value = 'blueprint';
    render(<LevelEditorPage />);
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Level' }));

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
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
    fireEvent.click(screen.getByRole('button', { name: 'Level' }));
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
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
    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Level' }));

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

async function saveBlueprintAs(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Save Blueprint' }));
  const nameField = await screen.findByLabelText(/blueprint name/i);
  await userEvent.clear(nameField);
  await userEvent.type(nameField, name);
  await userEvent.click(screen.getByRole('button', { name: 'Save blueprint' }));
}

describe('LevelEditorPage — blueprint select and save (step 44a)', () => {
  // Belt-and-suspenders alongside the file's top-level afterEach above: every
  // test in this block stubs `fetch` (stubBlueprintWrite/stubDownloads), and
  // a leaked stub here would silently answer the next test's dev-environment
  // ping as well as its saves.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('levelMode-showsTheLevelSelectAndSaveButOfferNoBlueprintPair', () => {
    render(<LevelEditorPage />);

    // Exactly one combobox — getByRole throws on a second, so this is also
    // the "never both pairs stacked" assertion.
    expect(screen.getByRole('combobox')).toHaveTextContent('main');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Blueprint' })).not.toBeInTheDocument();
  });

  it('blueprintMode-swapsInTheBlueprintPairAndHidesTheLevelPair', () => {
    render(<LevelEditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(screen.getByRole('combobox')).toHaveTextContent('new');
    expect(screen.getByRole('button', { name: 'Save Blueprint' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    // Export serializes the level grid and Try boots the game from it —
    // both meaningless for a spawn-less blueprint, so they go with the
    // level pair rather than staying visible and broken.
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try' })).not.toBeInTheDocument();
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

    expect(screen.getByRole('combobox')).toHaveTextContent('Test Room');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
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

  it('savingABlueprintWithBackgroundPieces-postsThemRebasedOntoTheSameOrigin', async () => {
    const { fetchCalls } = stubBlueprintWrite();
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dirt Column Top (1×1)' }));
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    // The foreground crop's origin is (col 2, row 1) — the only painted cell —
    // so a background piece placed on that same cell rebases to (col 0, row 0).
    expect(JSON.parse(blueprintPostBody(fetchCalls).contents).background).toEqual([
      { pieceId: 'dirtColumnTop1x1', col: 0, row: 0 },
    ]);
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
    expect(await screen.findByText(/move it into/i)).toBeInTheDocument();
  });

  it('reopeningABlueprintFromTheRegistry-loadsItsLayoutOntoTheCanvas', async () => {
    // A saved file only reaches the dropdown once Vite has picked it up, so
    // this stands in for "after the reload" — the registry entry is present
    // and the dropdown must load it onto the canvas.
    blueprintEntries.push({ id: 'test-room', name: 'Test Room', layout: ['G+'] });
    renderEditorInBlueprintMode();

    fireEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'Test Room' }));

    await waitFor(() => {
      expect(editorBlueprintSignal.value).toEqual(importLayout(['G+']));
    });
    expect(screen.getByRole('combobox')).toHaveTextContent('Test Room');
  });

  it('loadingABlueprintWithUnsavedEdits-asksBeforeDiscardingThem', async () => {
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    // Wait for the debounced sync FIRST. Without it the signal would still
    // hold the pre-paint blank canvas, and the "was not replaced" assertion
    // below would pass for the wrong reason (or fail, depending on timing) —
    // the blank canvas is exactly what loading would have written.
    await waitFor(() => expect(editorBlueprintSignal.value[1][2]).toBe('G'));

    fireEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'new' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    // `loadBlueprint` writes the signal directly (not only local state), so
    // the painted cell still being there proves nothing was loaded yet.
    expect(editorBlueprintSignal.value[1][2]).toBe('G');
  });
});

describe('LevelEditorPage — blueprint connection points (step 44b)', () => {
  it('blueprintMode-thePaletteOffersTheConnectionPointTool', () => {
    render(<LevelEditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(screen.getByRole('button', { name: 'Connection Point' })).toBeInTheDocument();
  });

  it('levelMode-thePaletteDoesNotOfferTheConnectionPointTool', () => {
    render(<LevelEditorPage />);

    expect(screen.queryByRole('button', { name: 'Connection Point' })).not.toBeInTheDocument();
  });

  it('paintingWithTheConnectionPointTool-writesItsCharacterIntoTheBlueprintGrid', async () => {
    renderEditorInBlueprintMode();
    fireEvent.click(screen.getByRole('button', { name: 'Connection Point' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Connection Point' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Level' }));

    expect(editorSelectedToolSignal.value).not.toBe('+');
    expect(screen.getByRole('button', { name: 'Ground Grass' })).toHaveAttribute(
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
    expect(screen.queryByRole('button', { name: 'Connection Point' })).not.toBeInTheDocument();
  });

  it('blueprintModeWithTheConnectionPointArmed-keepsItArmedAcrossAMountInThatMode', () => {
    // The mirror case must NOT be disarmed: '+' is a perfectly valid armed
    // tool on the blueprint canvas.
    editorCanvasModeSignal.value = 'blueprint';
    editorSelectedToolSignal.value = '+';

    render(<LevelEditorPage />);

    expect(editorSelectedToolSignal.value).toBe('+');
    expect(screen.getByRole('button', { name: 'Connection Point' })).toHaveAttribute(
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

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('noDevEnvironment-levelMode-keepsEverythingThatNeedsNoServer', () => {
    isDevEnvironmentSignal.value = false;
    render(<LevelEditorPage />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try' })).toBeInTheDocument();
  });

  it('noDevEnvironment-blueprintMode-offersNoSaveBlueprintButtonButKeepsTheDropdown', () => {
    isDevEnvironmentSignal.value = false;
    render(<LevelEditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(screen.queryByRole('button', { name: 'Save Blueprint' })).not.toBeInTheDocument();
    // Loading an already-saved blueprint needs no server — the registry is a
    // static import — so the dropdown stays.
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('devEnvironment-showsBothSaveControlsInTheirOwnModes', () => {
    render(<LevelEditorPage />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(screen.getByRole('button', { name: 'Save Blueprint' })).toBeInTheDocument();
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

    expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
