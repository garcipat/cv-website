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
