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
} from './editorLevelState';
import { currentTheme } from '@/state/theme';
import { currentPath } from '@/state/navigation';
import { enemyPlacements, enemyStates, collectedFacts, collectedCollectibleIds } from '../PlatformerState';
import { currentBackground } from '../level/level';

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
  drawBackgroundTiles: vi.fn(),
}));

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

async function saveAs(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  const nameField = await screen.findByLabelText(/level name/i);
  await userEvent.clear(nameField);
  await userEvent.type(nameField, name);
  await userEvent.click(screen.getByRole('button', { name: 'Save level file' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
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
    // PlatformerPage.tsx gates its debug panel on `new
    // URLSearchParams(window.location.search).has('debug')` — any `debug`
    // param shows it, so this must land on a URL satisfying that exactly.
    expect(currentPath.value).toBe('/?debug=1');
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
});
