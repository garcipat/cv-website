import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { EditorCanvas, PATROL_MARKER_GLYPH } from './EditorCanvas';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { centerPanOnSpawn } from './EditorPan';
import type { TileChar } from '../level/LevelParser';
import type { EditorImages } from './EditorCanvas';
import { COIN_SHEET } from '../entities/sprites/sheets';

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

import {
  drawTerrain,
  drawPlayer,
  drawCollectibles,
  drawEnemies,
  drawBlocks,
  drawChests,
  drawBackgroundTiles,
} from '../engine/Renderer';

const EMPTY_IMAGES: EditorImages = {
  tileset: null,
  groundAtlas: null,
  player: null,
  coin: null,
  fruit: null,
  slimeGreen: null,
  slimePurple: null,
  crackOverlay: null,
  chestClosed: null,
  backgroundAtlas: null,
};

// Default props shared by every pre-existing test in this file (all of
// which predate the background layer and only care about the foreground):
// the background layer stays inactive/empty so it doesn't affect them.
const BACKGROUND_LAYER_DEFAULT_PROPS = {
  backgroundPlacements: [],
  activeLayer: 'foreground' as const,
  selectedBackgroundPiece: null,
  onPaintBackground: () => {},
};

function stubCanvasContext() {
  const ctx = {
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
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  return ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EditorCanvas', () => {
  it("takes the canvas out of its container's layout flow (absolute positioning) so the container's size never depends on the canvas's own content size — otherwise the ResizeObserver below watches a target whose size the canvas itself helps determine, a feedback loop that spirals toward 0x0 and leaves the canvas invisible", () => {
    stubCanvasContext();
    const { container } = render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    const wrapper = canvas.parentElement!;
    expect(wrapper.className).toContain('relative');
    expect(canvas.className).toContain('absolute');
  });

  it('resizes the canvas to match its container via ResizeObserver, instead of staying a fixed size', () => {
    stubCanvasContext();
    let resizeCallback: ResizeObserverCallback = () => {};
    class FakeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const { container } = render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    const canvas = container.querySelector('canvas')! as HTMLCanvasElement;
    const defaultWidth = canvas.width;

    act(() => {
      resizeCallback(
        [{ contentRect: { width: 500, height: 300 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(canvas.width).not.toBe(defaultWidth);
    expect(canvas.width).toBe(500);
    expect(canvas.height).toBe(300);

    vi.unstubAllGlobals();
  });

  it('redraws after a resize even with no other prop change, since resizing a <canvas> clears its buffer (would otherwise leave it blank/invisible until an unrelated paint or pan happened to redraw it)', () => {
    const ctx = stubCanvasContext();
    let resizeCallback: ResizeObserverCallback = () => {};
    class FakeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    const fillRectCallsBeforeResize = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(fillRectCallsBeforeResize).toBeGreaterThan(0);

    act(() => {
      resizeCallback(
        [{ contentRect: { width: 500, height: 300 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      fillRectCallsBeforeResize,
    );

    vi.unstubAllGlobals();
  });

  it('renders every visible cell as background before drawing terrain, so panning never shows blank canvas', () => {
    const ctx = stubCanvasContext();
    const grid: TileChar[][] = [['G']];
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
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

  it('draws grid lines across the visible canvas so cell boundaries are visible while clicking', () => {
    const ctx = stubCanvasContext();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(ctx.stroke).toHaveBeenCalled();
    expect((ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
  });

  it('calls drawTerrain with both the tileset and the ground atlas when they are loaded', () => {
    stubCanvasContext();
    const tileset = {} as HTMLImageElement;
    const groundAtlas = {} as HTMLImageElement;
    const grid: TileChar[][] = [['G']];
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={grid}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, tileset, groundAtlas }}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(drawTerrain).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 1, height: 1 }),
      tileset,
      groundAtlas,
      0,
      0,
    );
  });

  it('skips drawTerrain when the ground atlas has not loaded yet', () => {
    stubCanvasContext();
    const tileset = {} as HTMLImageElement;
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['G']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, tileset, groundAtlas: null }}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(drawTerrain).not.toHaveBeenCalled();
  });

  it('skips drawTerrain when the tileset image has not loaded yet', () => {
    stubCanvasContext();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
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
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
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
      expect.objectContaining({ direction: 'right', animState: 'idle' }),
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
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
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
      expect.any(Set),
      expect.objectContaining({
        originX: 5,
        originY: 7,
        sprites: expect.objectContaining({ [COIN_SHEET.src]: coin }),
      }),
    );
    expect(drawEnemies).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ type: 'slimeGreen' })]),
      expect.objectContaining({ originX: 5, originY: 7 }),
    );
    expect(drawBlocks).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ blockKind: 'crate' })]),
      expect.objectContaining({ originX: 5, originY: 7 }),
    );
    expect(drawChests).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ id: 'editor-chest-0' })]),
      expect.objectContaining({ originX: 5, originY: 7 }),
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
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
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
      expect.objectContaining({
        grid: [
          ['.', 'G'],
          ['.', '.'],
        ],
      }),
    );
  });

  it('paints every cell along a left-click drag, not just the start and end', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const grid: TileChar[][] = [['.', '.', '.']];
    const { container } = render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
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
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
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
          {...BACKGROUND_LAYER_DEFAULT_PROPS}
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
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
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
          {...BACKGROUND_LAYER_DEFAULT_PROPS}
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

  it('calls onPan on a middle-click drag and prevents the context menu', () => {
    stubCanvasContext();
    const onPan = vi.fn();
    const { container } = render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={onPan}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { button: 1, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { button: 1, clientX: 90, clientY: 80 });
    fireEvent.mouseUp(canvas, { button: 1 });
    expect(onPan).toHaveBeenCalledWith({ x: -10, y: -20 });

    const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    canvas.dispatchEvent(contextMenuEvent);
    expect(contextMenuEvent.defaultPrevented).toBe(true);
  });

  it('erases with a right-click regardless of the selected tool, and continues erasing along a right-click drag', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const grid: TileChar[][] = [['G', 'G', 'G']];
    const { container } = render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
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

    fireEvent.mouseDown(canvas, { button: 2, clientX: 1, clientY: 1 });
    expect(onPaint).toHaveBeenCalledWith(expect.objectContaining({ grid: [['.', 'G', 'G']] }));

    // The `grid` prop isn't updated between events in this test (the real
    // app re-renders EditorCanvas with the new grid after each onPaint —
    // see LevelEditorPage), so this second paint is still computed against
    // the original grid: only the newly-entered column (1) is erased.
    fireEvent.mouseMove(canvas, { button: 2, clientX: RENDERED_TILE_SIZE + 1, clientY: 1 });
    expect(onPaint).toHaveBeenLastCalledWith(expect.objectContaining({ grid: [['G', '.', 'G']] }));

    fireEvent.mouseUp(canvas, { button: 2 });
  });
});

describe('EditorCanvas patrol markers', () => {
  it('draws an editor-only marker over every patrol tile, which the game itself never shows', () => {
    const ctx = stubCanvasContext() as unknown as {
      fillText: ReturnType<typeof vi.fn>;
      fillRect: ReturnType<typeof vi.fn>;
    };

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['P']]}
        selectedTool="P"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    const glyphCalls = ctx.fillText.mock.calls.filter(
      (call: unknown[]) => call[0] === PATROL_MARKER_GLYPH,
    );
    expect(glyphCalls).not.toHaveLength(0);
    // Tinted cell behind the glyph, at the tile's own top-left corner.
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
  });

  it('offsets the patrol marker by the pan offset, like every other drawn layer', () => {
    const ctx = stubCanvasContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['P']]}
        selectedTool="P"
        panOffset={{ x: 100, y: 40 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    expect(ctx.fillRect).toHaveBeenCalledWith(100, 40, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
  });

  it('draws no patrol marker for a grid without any patrol tile', () => {
    const ctx = stubCanvasContext() as unknown as { fillText: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['G']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    const glyphCalls = ctx.fillText.mock.calls.filter(
      (call: unknown[]) => call[0] === PATROL_MARKER_GLYPH,
    );
    expect(glyphCalls).toHaveLength(0);
  });
});

describe('EditorCanvas centering', () => {
  it('centers the view on the spawn tile when the centering request id changes', () => {
    stubCanvasContext();
    const onPan = vi.fn();
    const grid: TileChar[][] = [['.', 'S', '.']];

    const { rerender } = render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={grid}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        centerRequestId={1}
        onPaint={() => {}}
        onPan={onPan}
      />,
    );
    onPan.mockClear();

    rerender(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={grid}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        centerRequestId={2}
        onPaint={() => {}}
        onPan={onPan}
      />,
    );

    expect(onPan).toHaveBeenCalledWith(centerPanOnSpawn(grid, 800, 480));
  });

  it('centers once on mount, so opening the editor lands on the player', () => {
    stubCanvasContext();
    const onPan = vi.fn();
    const grid: TileChar[][] = [['.', 'S', '.']];

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={grid}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        centerRequestId={1}
        onPaint={() => {}}
        onPan={onPan}
      />,
    );

    expect(onPan).toHaveBeenCalledWith(centerPanOnSpawn(grid, 800, 480));
  });

  it('does not re-center on an unrelated re-render, so a manual pan survives', () => {
    stubCanvasContext();
    const onPan = vi.fn();
    const grid: TileChar[][] = [['.', 'S', '.']];
    const props = {
      ...BACKGROUND_LAYER_DEFAULT_PROPS,
      grid,
      selectedTool: 'G' as TileChar,
      images: EMPTY_IMAGES,
      centerRequestId: 1,
      onPaint: () => {},
      onPan,
    };

    const { rerender } = render(<EditorCanvas {...props} panOffset={{ x: 0, y: 0 }} />);
    onPan.mockClear();

    rerender(<EditorCanvas {...props} panOffset={{ x: 120, y: 60 }} />);

    expect(onPan).not.toHaveBeenCalled();
  });
});

describe('EditorCanvas centering waits for a real measurement', () => {
  it('centers against the measured canvas size, not the pre-measurement fallback', () => {
    // The ResizeObserver's first measurement lands AFTER mount. Centering
    // against the fallback size and disarming leaves the view off-center by
    // half the difference between the two heights — which is what actually
    // happened in the browser: the spawn sat in the upper third.
    stubCanvasContext();
    const onPan = vi.fn();
    let resizeCallback: ResizeObserverCallback = () => {};
    class FakeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const grid: TileChar[][] = [['.', 'S', '.']];

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={grid}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        centerRequestId={1}
        onPaint={() => {}}
        onPan={onPan}
      />,
    );

    expect(onPan).not.toHaveBeenCalled();

    act(() => {
      resizeCallback(
        [{ contentRect: { width: 714, height: 838 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(onPan).toHaveBeenCalledWith(centerPanOnSpawn(grid, 714, 838));
    vi.unstubAllGlobals();
  });
});

describe('EditorCanvas — background layer', () => {
  it('backgroundAtlasLoaded-callsDrawBackgroundTilesBeforeDrawTerrain', () => {
    stubCanvasContext();
    const tileset = {} as HTMLImageElement;
    const groundAtlas = {} as HTMLImageElement;
    const calls: string[] = [];
    (drawBackgroundTiles as ReturnType<typeof vi.fn>).mockImplementation(() =>
      calls.push('background'),
    );
    (drawTerrain as ReturnType<typeof vi.fn>).mockImplementation(() => calls.push('terrain'));

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, tileset, groundAtlas, backgroundAtlas: {} as HTMLImageElement }}
        onPaint={vi.fn()}
        onPan={vi.fn()}
      />,
    );

    expect(calls.indexOf('background')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('background')).toBeLessThan(calls.indexOf('terrain'));
  });

  it('leftClickWithBackgroundLayerActiveAndAPieceSelected-callsOnPaintBackgroundWithThePlacementAdded', () => {
    stubCanvasContext();
    const onPaintBackground = vi.fn();
    const { container } = render(
      <EditorCanvas
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        backgroundPlacements={[]}
        activeLayer="background"
        selectedBackgroundPiece="dirtColumnTop1x1"
        onPaint={vi.fn()}
        onPaintBackground={onPaintBackground}
        onPan={vi.fn()}
      />,
    );

    const canvas = container.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0, button: 0 });

    expect(onPaintBackground).toHaveBeenCalledWith([{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }]);
  });

  it('rightClickWithBackgroundLayerActive-callsOnPaintBackgroundWithThePlacementErased', () => {
    stubCanvasContext();
    const onPaintBackground = vi.fn();
    const { container } = render(
      <EditorCanvas
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        backgroundPlacements={[{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }]}
        activeLayer="background"
        selectedBackgroundPiece={null}
        onPaint={vi.fn()}
        onPaintBackground={onPaintBackground}
        onPan={vi.fn()}
      />,
    );

    const canvas = container.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0, button: 2 });

    expect(onPaintBackground).toHaveBeenCalledWith([]);
  });

  it('backgroundLayerActive-drawsForegroundTerrainAtReducedOpacity', () => {
    stubCanvasContext();
    const tileset = {} as HTMLImageElement;
    const groundAtlas = {} as HTMLImageElement;
    let alphaDuringDrawTerrain: number | undefined;
    (drawTerrain as ReturnType<typeof vi.fn>).mockImplementation((ctx: CanvasRenderingContext2D) => {
      alphaDuringDrawTerrain = ctx.globalAlpha;
    });

    render(
      <EditorCanvas
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, tileset, groundAtlas }}
        backgroundPlacements={[]}
        activeLayer="background"
        selectedBackgroundPiece={null}
        onPaint={vi.fn()}
        onPaintBackground={vi.fn()}
        onPan={vi.fn()}
      />,
    );

    expect(alphaDuringDrawTerrain).toBe(0.35);
  });

  it('foregroundLayerActive-drawsForegroundTerrainAtFullOpacity', () => {
    stubCanvasContext();
    const tileset = {} as HTMLImageElement;
    const groundAtlas = {} as HTMLImageElement;
    let alphaDuringDrawTerrain: number | undefined;
    (drawTerrain as ReturnType<typeof vi.fn>).mockImplementation((ctx: CanvasRenderingContext2D) => {
      alphaDuringDrawTerrain = ctx.globalAlpha;
    });

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, tileset, groundAtlas }}
        onPaint={vi.fn()}
        onPan={vi.fn()}
      />,
    );

    expect(alphaDuringDrawTerrain).toBe(1);
  });

  it('backgroundLayerActive-drawsPlayerAtReducedOpacityToo', () => {
    stubCanvasContext();
    const player = {} as HTMLImageElement;
    let alphaDuringDrawPlayer: number | undefined;
    (drawPlayer as ReturnType<typeof vi.fn>).mockImplementation((ctx: CanvasRenderingContext2D) => {
      alphaDuringDrawPlayer = ctx.globalAlpha;
    });

    render(
      <EditorCanvas
        grid={[['S']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, player }}
        backgroundPlacements={[]}
        activeLayer="background"
        selectedBackgroundPiece={null}
        onPaint={vi.fn()}
        onPaintBackground={vi.fn()}
        onPan={vi.fn()}
      />,
    );

    expect(alphaDuringDrawPlayer).toBe(0.35);
  });
});
