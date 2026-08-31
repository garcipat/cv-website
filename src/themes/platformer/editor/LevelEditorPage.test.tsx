import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LevelEditorPage } from './LevelEditorPage';
import { LEVEL_1_LAYOUT, currentLayout } from '../level/level';
import { importLayout } from './importLayout';
import { exportLayout } from './exportLayout';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { editorLevelSignal } from './editorLevelState';
import { currentTheme } from '@/state/theme';
import { currentPath } from '@/state/navigation';

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
}));

import { drawTerrain } from '../engine/Renderer';

beforeEach(() => {
  vi.clearAllMocks();
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
    fillText: vi.fn(),
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

  it('renders a Copy Layout button inside the dialog that writes the export text to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<LevelEditorPage />);
    await openExportDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Copy Layout' }));
    expect(writeText).toHaveBeenCalledWith(EXPECTED_EXPORT_TEXT);
  });

  it('renders a Reset button that reloads the default layout after confirmation, discarding edits', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<LevelEditorPage />);

    const canvas = document.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 1, clientY: 1 });

    await openExportDialog();
    const editedTextarea = (await screen.findByTestId('export-output')) as HTMLTextAreaElement;
    expect(editedTextarea.value).not.toBe(EXPECTED_EXPORT_TEXT);
    // The Dialog hides the rest of the page from the accessibility tree
    // while open — close it before interacting with anything outside it.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('export-output')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(window.confirm).toHaveBeenCalled();

    await openExportDialog();
    const resetTextarea = (await screen.findByTestId('export-output')) as HTMLTextAreaElement;
    expect(resetTextarea.value).toBe(EXPECTED_EXPORT_TEXT);
  });

  it('does not reset when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<LevelEditorPage />);

    const canvas = document.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 1, clientY: 1 });

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

    await openExportDialog();
    const textarea = (await screen.findByTestId('export-output')) as HTMLTextAreaElement;
    expect(textarea.value).not.toBe(EXPECTED_EXPORT_TEXT);
  });

  it('compensates panOffset by exactly -colShift * RENDERED_TILE_SIZE when a paint grows the grid leftward, so existing content does not visually move (spec SC-006)', async () => {
    render(<LevelEditorPage />);
    // Wait for the mocked loadImage promises to resolve so images.tileset is
    // set and EditorCanvas's redraw effect actually calls drawTerrain.
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());

    const callsBefore = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
    const [, , , originXBefore, originYBefore] = callsBefore[callsBefore.length - 1];
    expect(originXBefore).toBe(0);
    expect(originYBefore).toBe(0);

    const canvas = document.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    // LEVEL_1_LAYOUT's leftmost column is column 0 — clicking one tile-width
    // left of the canvas origin targets column -1, which must grow the grid
    // left by exactly one column (colShift 1).
    fireEvent.mouseDown(canvas, { button: 0, clientX: -1, clientY: 1 });

    await waitFor(() => {
      const callsAfter = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
      const [, , , originXAfter] = callsAfter[callsAfter.length - 1];
      expect(originXAfter).toBe(-RENDERED_TILE_SIZE);
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

  it('reset-afterConfirmation-alsoResetsEditorLevelSignalBackToTheDefaultLayout', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.useFakeTimers();
    render(<LevelEditorPage />);
    const canvas = document.querySelector('canvas')!;

    paint(canvas);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(editorLevelSignal.value).not.toEqual(defaultGrid);

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(editorLevelSignal.value).toEqual(defaultGrid);
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
});
