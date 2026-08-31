import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { EditorCanvas } from './EditorCanvas';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { TileChar } from '../level/LevelParser';
import type { EditorImages } from './EditorCanvas';

vi.mock('../engine/Renderer', () => ({
  drawTerrain: vi.fn(),
  drawPlayer: vi.fn(),
  drawCollectibles: vi.fn(),
  drawEnemies: vi.fn(),
  drawBlocks: vi.fn(),
  drawChests: vi.fn(),
}));

import {
  drawTerrain,
  drawPlayer,
  drawCollectibles,
  drawEnemies,
  drawBlocks,
  drawChests,
} from '../engine/Renderer';

const EMPTY_IMAGES: EditorImages = {
  tileset: null,
  player: null,
  coin: null,
  fruit: null,
  slimeGreen: null,
  slimePurple: null,
  crackOverlay: null,
  chestClosed: null,
};

function stubCanvasContext() {
  const ctx = { fillRect: vi.fn(), fillStyle: '' } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  return ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EditorCanvas', () => {
  it('renders every visible cell as background before drawing terrain, so panning never shows blank canvas', () => {
    const ctx = stubCanvasContext();
    const grid: TileChar[][] = [['G']];
    render(
      <EditorCanvas
        grid={grid}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('calls drawTerrain with the tileset image when it is loaded', () => {
    stubCanvasContext();
    const tileset = {} as HTMLImageElement;
    const grid: TileChar[][] = [['G']];
    render(
      <EditorCanvas
        grid={grid}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, tileset }}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(drawTerrain).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 1, height: 1 }),
      tileset,
      0,
      0,
    );
  });

  it('skips drawTerrain when the tileset image has not loaded yet', () => {
    stubCanvasContext();
    render(
      <EditorCanvas
        grid={[['G']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(drawTerrain).not.toHaveBeenCalled();
  });

  it('calls drawPlayer when a spawn marker exists and the player sprite is loaded', () => {
    stubCanvasContext();
    const player = {} as HTMLImageElement;
    render(
      <EditorCanvas
        grid={[['S']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, player }}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(drawPlayer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ facing: 'right', animState: 'idle' }),
      player,
      0,
      0,
      null,
      true,
    );
  });

  it('calls drawCollectibles, drawEnemies, drawBlocks, and drawChests with the synthesized state', () => {
    stubCanvasContext();
    const tileset = {} as HTMLImageElement;
    const coin = {} as HTMLImageElement;
    const grid: TileChar[][] = [['C', 'E', 'X', 'T']];
    render(
      <EditorCanvas
        grid={grid}
        selectedTool="G"
        panOffset={{ x: 5, y: 7 }}
        images={{ ...EMPTY_IMAGES, tileset, coin }}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(drawCollectibles).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ spriteType: 'coin' })]),
      coin,
      null,
      expect.any(Set),
      0,
      5,
      7,
    );
    expect(drawEnemies).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ spriteType: 'slimeGreen' })]),
      null,
      null,
      5,
      7,
    );
    expect(drawBlocks).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ blockKind: 'crate' })]),
      tileset,
      null,
      5,
      7,
    );
    expect(drawChests).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ id: 'editor-chest-0' })]),
      null,
      null,
      5,
      7,
    );
  });

  it('calls onPaint with the painted cell on left-click, translated by panOffset', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const grid: TileChar[][] = [
      ['.', '.'],
      ['.', '.'],
    ];
    const { container } = render(
      <EditorCanvas
        grid={grid}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={onPaint}
        onPan={() => {}}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
    } as DOMRect);
    fireEvent.mouseDown(canvas, {
      button: 0,
      clientX: RENDERED_TILE_SIZE + 1,
      clientY: 1,
    });
    expect(onPaint).toHaveBeenCalledWith(
      expect.objectContaining({ grid: [['.', 'G'], ['.', '.']] }),
    );
  });

  it('paints every cell along a left-click drag, not just the start and end', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const grid: TileChar[][] = [['.', '.', '.']];
    const { container } = render(
      <EditorCanvas
        grid={grid}
        selectedTool="R"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={onPaint}
        onPan={() => {}}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
    } as DOMRect);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 1, clientY: 1 });
    fireEvent.mouseMove(canvas, { button: 0, clientX: RENDERED_TILE_SIZE + 1, clientY: 1 });
    fireEvent.mouseUp(canvas, { button: 0 });
    expect(onPaint).toHaveBeenCalledTimes(2);
  });

  it('paints every cell along a leftward drag that crosses a grid-growth boundary, with no gaps in the middle of the run', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const grid: TileChar[][] = [['.', '.', '.']];
    const { container, rerender } = render(
      <EditorCanvas
        grid={grid}
        selectedTool="R"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={onPaint}
        onPan={() => {}}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
    } as DOMRect);

    // Start at col 1 (in-bounds) and drag left past the grid's left edge
    // (col 0), through col -1 and col -2 — each of those triggers a
    // one-column leftward grow, shifting panOffset by -RENDERED_TILE_SIZE.
    // The component under test owns panOffset internally via re-renders in
    // the real app; here we simulate the parent applying that compensation
    // between moves, exactly as LevelEditorPage does.
    let panOffset = { x: 0, y: 0 };
    const rerenderWithPan = () => {
      rerender(
        <EditorCanvas
          grid={grid}
          selectedTool="R"
          panOffset={panOffset}
          images={EMPTY_IMAGES}
          onPaint={onPaint}
          onPan={() => {}}
        />,
      );
    };

    fireEvent.mouseDown(canvas, { button: 0, clientX: RENDERED_TILE_SIZE + 1, clientY: 1 });
    expect(onPaint).toHaveBeenCalledTimes(1);

    // Move to col 0 (still in bounds, no growth).
    fireEvent.mouseMove(canvas, { button: 0, clientX: 1, clientY: 1 });
    expect(onPaint).toHaveBeenCalledTimes(2);

    // Move to col -1 — out of bounds, triggers a one-column leftward grow.
    // The real parent (LevelEditorPage) would compensate panOffset by
    // -RENDERED_TILE_SIZE at this point; simulate that here.
    fireEvent.mouseMove(canvas, { button: 0, clientX: -RENDERED_TILE_SIZE + 1, clientY: 1 });
    expect(onPaint).toHaveBeenCalledTimes(3);
    panOffset = { x: -RENDERED_TILE_SIZE, y: 0 };
    rerenderWithPan();

    // Move further left to what was col -2 before growth; with panOffset
    // now compensated, the same screen pixel maps to grid-index col -1 in
    // the (already-grown) current grid space — another leftward grow.
    fireEvent.mouseMove(canvas, { button: 0, clientX: -2 * RENDERED_TILE_SIZE + 1, clientY: 1 });
    expect(onPaint).toHaveBeenCalledTimes(4);

    fireEvent.mouseUp(canvas, { button: 0 });

    // Every intermediate cell along the drag must have been painted — no
    // dedup-skip should have dropped a cell from the middle of the run.
    expect(onPaint).toHaveBeenCalledTimes(4);
  });

  it('paints every cell along an upward drag that crosses a grid-growth boundary, with no gaps in the middle of the run', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const grid: TileChar[][] = [['.'], ['.'], ['.']];
    const { container, rerender } = render(
      <EditorCanvas
        grid={grid}
        selectedTool="R"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={onPaint}
        onPan={() => {}}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
    } as DOMRect);

    let panOffset = { x: 0, y: 0 };
    const rerenderWithPan = () => {
      rerender(
        <EditorCanvas
          grid={grid}
          selectedTool="R"
          panOffset={panOffset}
          images={EMPTY_IMAGES}
          onPaint={onPaint}
          onPan={() => {}}
        />,
      );
    };

    fireEvent.mouseDown(canvas, { button: 0, clientX: 1, clientY: RENDERED_TILE_SIZE + 1 });
    expect(onPaint).toHaveBeenCalledTimes(1);

    fireEvent.mouseMove(canvas, { button: 0, clientX: 1, clientY: 1 });
    expect(onPaint).toHaveBeenCalledTimes(2);

    fireEvent.mouseMove(canvas, { button: 0, clientX: 1, clientY: -RENDERED_TILE_SIZE + 1 });
    expect(onPaint).toHaveBeenCalledTimes(3);
    panOffset = { x: 0, y: -RENDERED_TILE_SIZE };
    rerenderWithPan();

    fireEvent.mouseMove(canvas, { button: 0, clientX: 1, clientY: -2 * RENDERED_TILE_SIZE + 1 });
    expect(onPaint).toHaveBeenCalledTimes(4);

    fireEvent.mouseUp(canvas, { button: 0 });

    expect(onPaint).toHaveBeenCalledTimes(4);
  });

  it('calls onPan on a right-click drag and prevents the context menu', () => {
    stubCanvasContext();
    const onPan = vi.fn();
    const { container } = render(
      <EditorCanvas
        grid={[['.']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={onPan}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { button: 2, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { button: 2, clientX: 90, clientY: 80 });
    fireEvent.mouseUp(canvas, { button: 2 });
    expect(onPan).toHaveBeenCalledWith({ x: -10, y: -20 });

    const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    canvas.dispatchEvent(contextMenuEvent);
    expect(contextMenuEvent.defaultPrevented).toBe(true);
  });
});
