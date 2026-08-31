import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LevelEditorPage } from './LevelEditorPage';
import { LEVEL_1_LAYOUT } from '../level/level1';
import { RENDERED_TILE_SIZE } from '../level/Terrain';

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
}));

import { drawTerrain } from '../engine/Renderer';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D);
});

describe('LevelEditorPage', () => {
  it('shows an export textarea whose initial content is LEVEL_1_LAYOUT cropped to its content (SC-009 ruling — LEVEL_1_LAYOUT has one leading all-"." row that content-cropping always strips, even unedited), formatted as paste-ready quoted rows', () => {
    render(<LevelEditorPage />);
    const textarea = screen.getByTestId('export-output') as HTMLTextAreaElement;
    expect(textarea.value).toBe(
      LEVEL_1_LAYOUT.slice(1)
        .map((row) => `  '${row}',`)
        .join('\n'),
    );
  });

  it('marks the export textarea read-only', () => {
    render(<LevelEditorPage />);
    expect(screen.getByTestId('export-output')).toHaveAttribute('readonly');
  });

  it('renders the palette and canvas', () => {
    render(<LevelEditorPage />);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('renders a Copy Layout button that writes the export text to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<LevelEditorPage />);
    screen.getByRole('button', { name: 'Copy Layout' }).click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(
      LEVEL_1_LAYOUT.slice(1)
        .map((row) => `  '${row}',`)
        .join('\n'),
    );
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
