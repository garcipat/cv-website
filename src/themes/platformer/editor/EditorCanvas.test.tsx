import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act, cleanup, screen } from '@testing-library/react';
import {
  EditorCanvas,
  readGameBackgroundColor,
  PATROL_MARKER_GLYPH,
  CONNECTION_POINT_MARKER_GLYPH,
  PLACEMENT_VALID_COLOR,
  PLACEMENT_INVALID_COLOR,
} from './EditorCanvas';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { centerPanOnSpawn } from './EditorPan';
import { levelEditorPage } from './LevelEditorPage.page';
import type { TileChar, BackgroundChar } from '../level/LevelParser';
import type { MarkerEntry } from '../level/LevelData';
import type { EditorImages } from './EditorCanvas';
import { COIN_SHEET, STATIC_OBJECTS_SHEET, SPEAR_SHEET, BEE_SHEET } from '../entities/sprites/sheets';
import { PALETTE_TILE_SPRITES } from './paletteTiles';

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

import {
  drawTerrain,
  drawPlayer,
  drawCollectibles,
  drawEnemies,
  drawBlocks,
  drawChests,
  drawCheckpoints,
  drawHazards,
  drawBackgroundTiles,
  drawDarkness,
  drawEnemyEyes,
  drawHeldTorch,
} from '../engine/Renderer';
import { EDITOR_PREVIEW_DARKNESS } from './caveLightingPreview';

const EMPTY_IMAGES: EditorImages = {
  tileset: null,
  groundAtlas: null,
  player: null,
  coin: null,
  fruit: null,
  slimeGreen: null,
  slimePurple: null,
  bee: null,
  crackOverlay: null,
  chestClosed: null,
  checkpoint: null,
  backgroundAtlas: null,
  staticObjects: null,
  decorations: null,
  torch: null,
  ropeLadder: null,
  mushroom: null,
  spears: null,
  floorSpike: null,
  crumbleFloor: null,
  crumbleCracks: null,
};

// The O-027 stalactite tint pass masks its wash against the decorations sheet
// (a scratch `source-atop` composite). The actual `drawImage` is a stub, so a
// truthy stand-in is enough to exercise the tint path.
const TINT_IMAGES: EditorImages = { ...EMPTY_IMAGES, decorations: {} as HTMLImageElement };

// Default props shared by every pre-existing test in this file (all of
// which predate the background layer and only care about the foreground):
// the background layer stays inactive/empty so it doesn't affect them.
const BACKGROUND_LAYER_DEFAULT_PROPS = {
  backgroundGrid: [],
  activeLayer: 'foreground' as const,
  selectedBackgroundMaterial: null,
  onPaintBackground: () => {},
};

function stubCanvasContext() {
  const ctx = {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
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
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    arc: vi.fn(),
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
    const canvas = levelEditorPage.canvas;
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
    const canvas = levelEditorPage.canvas as HTMLCanvasElement;
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
      null,
      null,
      null,
      0,
      null,
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

  it('paints a mixed u p row and previews one merged pot run with a filler on the seam', () => {
    stubCanvasContext();
    const staticObjects = {} as HTMLImageElement;
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['u', 'p']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, staticObjects }}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    const drawContext = vi.mocked(drawBlocks).mock.calls[0][2];
    const plan = drawContext.potPlan!;
    expect(plan.runsByOwnerId.size).toBe(1);
    const run = [...plan.runsByOwnerId.values()][0];
    expect(run.blocks).toHaveLength(2);
    expect(run.fillers).toHaveLength(1);
  });

  it('calls drawCollectibles, drawEnemies, drawBlocks, and drawChests with the synthesized state', () => {
    stubCanvasContext();
    const tileset = {} as HTMLImageElement;
    const coin = {} as HTMLImageElement;
    const staticObjects = {} as HTMLImageElement;
    const grid: TileChar[][] = [['o', 'M', '=', '$', 'u']];
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={grid}
        selectedTool="G"
        panOffset={{ x: 5, y: 7 }}
        images={{ ...EMPTY_IMAGES, tileset, coin, staticObjects }}
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
    // Regression test (see EditorCanvas.ts's potPlan/STATIC_OBJECTS_SHEET
    // wiring): a real bug found by manual play-testing was that the editor's
    // drawContext never included STATIC_OBJECTS_SHEET at all (only used for
    // bush/fence via drawTerrain's own dedicated argument, never for a
    // generic block before pot), nor a potPlan — a clay pot fell back to its
    // kind's "no plan provided" isolated-draw path silently, and without the
    // sheet it rendered nothing at all.
    expect(drawBlocks).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({ blockKind: 'crate' }),
        expect.objectContaining({ blockKind: 'coinPot' }),
      ]),
      expect.objectContaining({
        originX: 5,
        originY: 7,
        sprites: expect.objectContaining({ [STATIC_OBJECTS_SHEET.src]: staticObjects }),
        potPlan: expect.objectContaining({
          ownerBlockId: expect.any(Map),
          runsByOwnerId: expect.any(Map),
        }),
      }),
    );
    expect(drawChests).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ id: 'editor-chest-0' })]),
      expect.objectContaining({ originX: 5, originY: 7 }),
    );
  });

  it('a "q" cell previews the bee sprite through the draw context sprite map', () => {
    stubCanvasContext();
    const bee = {} as HTMLImageElement;
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['q']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, bee }}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(drawEnemies).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ type: 'bee', animState: 'fly' })]),
      expect.objectContaining({
        sprites: expect.objectContaining({ [BEE_SHEET.src]: bee }),
      }),
    );
  });

  it('draws a dormant checkpoint preview at each "C" cell', () => {
    stubCanvasContext();
    const checkpoint = {} as HTMLImageElement;
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.', 'C']]}
        selectedTool="G"
        panOffset={{ x: 5, y: 7 }}
        images={{ ...EMPTY_IMAGES, checkpoint }}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(drawCheckpoints).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ col: 1, row: 0, activated: false, activatedAt: null })],
      checkpoint,
      null,
      expect.objectContaining({ originX: 5, originY: 7 }),
    );
  });

  it('passes the spears image through to drawHazards for a "¦" cell', () => {
    stubCanvasContext();
    const spears = {} as HTMLImageElement;
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['¦']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, spears }}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(drawHazards).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ hazardType: 'spear', facing: 'up' })]),
      expect.objectContaining({
        sprites: expect.objectContaining({ [SPEAR_SHEET.src]: spears }),
      }),
    );
  });

  it('calls onPaint with the painted cell on left-click, translated by panOffset', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const grid: TileChar[][] = [
      ['.', '.'],
      ['.', '.'],
    ];
    render(
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
    const canvas = levelEditorPage.canvas;
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

  describe('EditorCanvas zoom-aware pointer math', () => {
    it('paintsTheCellUnderTheCursorAt50PercentZoom-notTheCellA100PercentClickWouldHit', () => {
      const onPaint = vi.fn();
      stubCanvasContext();
      render(
        <EditorCanvas
          {...BACKGROUND_LAYER_DEFAULT_PROPS}
          grid={[
            ['.', '.', '.', '.'],
            ['.', '.', '.', '.'],
          ]}
          selectedTool="G"
          panOffset={{ x: 0, y: 0 }}
          zoom={0.5}
          images={EMPTY_IMAGES}
          onPaint={onPaint}
          onPan={() => {}}
        />,
      );
      const canvas = levelEditorPage.canvas;
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
      } as DOMRect);

      // At zoom 0.5, screen x = RENDERED_TILE_SIZE (one full tile at 100%) lands
      // in world column 2, not column 1 — the pointer covers twice the world
      // distance per screen pixel.
      fireEvent.mouseDown(canvas, { button: 0, clientX: RENDERED_TILE_SIZE, clientY: 0 });

      expect(onPaint).toHaveBeenCalledWith(
        expect.objectContaining({ grid: expect.any(Array) }),
      );
      // paintCell's own contract is exercised elsewhere; here we only need to
      // know WHICH cell it was asked to paint. Re-derive it the same way
      // paintCell reports growth-free paints: the returned grid's column 2
      // (not column 1) should have changed from '.' to 'G'.
      const paintedGrid = onPaint.mock.calls[0][0].grid as string[][];
      expect(paintedGrid[0][2]).toBe('G');
      expect(paintedGrid[0][1]).toBe('.');
    });

    it('accountsForBothPanAndZoomTogether', () => {
      const onPaint = vi.fn();
      stubCanvasContext();
      render(
        <EditorCanvas
          {...BACKGROUND_LAYER_DEFAULT_PROPS}
          grid={[['.', '.', '.', '.']]}
          selectedTool="G"
          panOffset={{ x: RENDERED_TILE_SIZE, y: 0 }}
          zoom={0.5}
          images={EMPTY_IMAGES}
          onPaint={onPaint}
          onPan={() => {}}
        />,
      );
      const canvas = levelEditorPage.canvas;
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
      } as DOMRect);

      // screenX=RENDERED_TILE_SIZE*1.5 -> subtract pan (RENDERED_TILE_SIZE) ->
      // RENDERED_TILE_SIZE*0.5 remaining -> /zoom(0.5) -> RENDERED_TILE_SIZE ->
      // /RENDERED_TILE_SIZE -> col 1.
      fireEvent.mouseDown(canvas, {
        button: 0,
        clientX: RENDERED_TILE_SIZE * 1.5,
        clientY: 0,
      });

      const paintedGrid = onPaint.mock.calls[0][0].grid as string[][];
      expect(paintedGrid[0][1]).toBe('G');
    });

    it('defaultsToFullSize(100Percent)WhenZoomIsOmitted-existingCallersAreUnaffected', () => {
      const onPaint = vi.fn();
      stubCanvasContext();
      render(
        <EditorCanvas
          {...BACKGROUND_LAYER_DEFAULT_PROPS}
          grid={[['.', '.']]}
          selectedTool="G"
          panOffset={{ x: 0, y: 0 }}
          images={EMPTY_IMAGES}
          onPaint={onPaint}
          onPan={() => {}}
        />,
      );
      const canvas = levelEditorPage.canvas;
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
      } as DOMRect);

      fireEvent.mouseDown(canvas, { button: 0, clientX: RENDERED_TILE_SIZE + 1, clientY: 1 });

      const paintedGrid = onPaint.mock.calls[0][0].grid as string[][];
      expect(paintedGrid[0][1]).toBe('G');
    });
  });

  it('paints every cell along a left-click drag, not just the start and end', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const grid: TileChar[][] = [['.', '.', '.']];
    render(
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
    const canvas = levelEditorPage.canvas;
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
    const { rerender } = render(
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
    const canvas = levelEditorPage.canvas;
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
    const { rerender } = render(
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
    const canvas = levelEditorPage.canvas;
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
    render(
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
    const canvas = levelEditorPage.canvas;
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
    render(
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
    const canvas = levelEditorPage.canvas;
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
        grid={[['.']]}
        markerGrid={[[{ kind: 'patrolBoundary' }]]}
        selectedTool="patrolBoundary"
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
        grid={[['.']]}
        markerGrid={[[{ kind: 'patrolBoundary' }]]}
        selectedTool="patrolBoundary"
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

describe('EditorCanvas overlay drawing at non-100% zoom', () => {
  it('scalesAPatrolMarkersTintedRectangleAndPositionByZoom', () => {
    const ctx = stubCanvasContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        // A non-zero column is essential here: tileToPixel(0,0) = (0,0), so
        // `0 * zoom + origin === origin` regardless of whether `* zoom` is
        // even applied. Column 1 (world x = RENDERED_TILE_SIZE) is the
        // smallest grid that actually exercises the position-scaling term.
        grid={[['.', '.']]}
        markerGrid={[[null, { kind: 'patrolBoundary' }]]}
        selectedTool="."
        panOffset={{ x: 100, y: 40 }}
        zoom={0.5}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    // tileToPixel(1,0) = (RENDERED_TILE_SIZE, 0) in world space;
    // screen = world * zoom + origin.
    expect(ctx.fillRect).toHaveBeenCalledWith(
      RENDERED_TILE_SIZE * 0.5 + 100,
      40,
      RENDERED_TILE_SIZE * 0.5,
      RENDERED_TILE_SIZE * 0.5,
    );
  });

  it('scalesTheGridLineStepByZoom', () => {
    const ctx = stubCanvasContext() as unknown as {
      moveTo: ReturnType<typeof vi.fn>;
    };
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="."
        // A non-zero pan is essential here: with panOffset 0,
        // `((0 % step) + step) % step === 0` for ANY step value, so a
        // regression that left `startX` computed against the unscaled
        // `RENDERED_TILE_SIZE` (rather than the zoom-scaled `step`) would
        // still pass. With pan 20 and zoom 0.5 (step = 16), the correct
        // startX is ((20 % 16) + 16) % 16 = 4; the old, unfixed modulo
        // against RENDERED_TILE_SIZE (32) would instead give 20 — the two
        // formulas diverge, so this discriminates the fix.
        panOffset={{ x: 20, y: 0 }}
        zoom={0.5}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(ctx.moveTo).toHaveBeenCalledWith(4.5, 0);
  });

  it('scalesThePlacementPreviewsFillAndBorderByZoom', () => {
    const ctx = stubCanvasContext() as unknown as {
      fillRect: ReturnType<typeof vi.fn>;
      strokeRect: ReturnType<typeof vi.fn>;
    };
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.', '.', '.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        zoom={0.5}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
        placement={{
          preview: {
            cells: [
              { row: 0, col: 1, char: '.' },
              { row: 0, col: 2, char: '.' },
            ],
            valid: true,
          },
          onHover: () => {},
          onPlace: () => {},
          onCancel: () => {},
        }}
      />,
    );
    // Per-cell fills: tileToPixel(1,0) = (32,0) and tileToPixel(2,0) = (64,0);
    // screen = world * zoom, size = RENDERED_TILE_SIZE * zoom = 16.
    expect(ctx.fillRect).toHaveBeenCalledWith(
      RENDERED_TILE_SIZE * 0.5,
      0,
      RENDERED_TILE_SIZE * 0.5,
      RENDERED_TILE_SIZE * 0.5,
    );
    expect(ctx.fillRect).toHaveBeenCalledWith(
      RENDERED_TILE_SIZE,
      0,
      RENDERED_TILE_SIZE * 0.5,
      RENDERED_TILE_SIZE * 0.5,
    );
    // Border: two-cell-wide bounding box. Its width MUST be
    // `(maxCol - minCol + 1) * size` (2 * 16 = 32) — a regression that scaled
    // the border's position but left its extent as
    // `(maxCol - minCol + 1) * RENDERED_TILE_SIZE` (2 * 32 = 64) would slip
    // past a single-cell preview, which is why this test uses two cells.
    expect(ctx.strokeRect).toHaveBeenCalledWith(
      RENDERED_TILE_SIZE * 0.5,
      0,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE * 0.5,
    );
  });

  it('centersAPatrolMarkersGlyphOnTheZoomScaledTileSize', () => {
    const ctx = stubCanvasContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        markerGrid={[[{ kind: 'patrolBoundary' }]]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        zoom={0.5}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    // drawMarkerGlyph centers on `size / 2`. If `size` were left unscaled
    // (RENDERED_TILE_SIZE = 32), the center would be 16; scaled by zoom 0.5
    // (size = 16), the correct center is 8.
    expect(ctx.fillText).toHaveBeenCalledWith(PATROL_MARKER_GLYPH, 8, 8);
  });

  // FR-006: overlays scale *together with* the tiles, which covers their text
  // and stroke weights, not just their positions and rectangle extents — an
  // 18px glyph on a 16px tile is exactly the "mismatched size relative to the
  // tiles around it" the spec's edge-case list rules out.
  it('scalesAMarkersFontSizeAndHaloStrokeWidthByZoom', () => {
    const ctx = stubCanvasContext();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        markerGrid={[[{ kind: 'patrolBoundary' }]]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        zoom={0.5}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    // MARKER_FONT_SIZE is 18, MARKER_HALO_WIDTH is 3.
    expect(ctx.font).toBe(`${18 * 0.5}px sans-serif`);
    expect(ctx.lineWidth).toBe(3 * 0.5);
  });

  it('scalesASignBadgesFontSizeByZoom', () => {
    const ctx = stubCanvasContext();
    // drawTileMarkers runs after drawSignBadges and reassigns `ctx.font`, so
    // sample the font at the moment the badge itself is painted.
    const fontsWhileDrawingBadges: string[] = [];
    (ctx.fillText as ReturnType<typeof vi.fn>).mockImplementation((text: string) => {
      if (text === '1') fontsWhileDrawingBadges.push(ctx.font);
    });

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['T']]}
        markerGrid={[[{ kind: 'sign', hintId: 'bridgeDropThrough' }]]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        zoom={0.5}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    // SIGN_BADGE_FONT_SIZE is 12.
    expect(fontsWhileDrawingBadges.length).toBeGreaterThan(0);
    expect(new Set(fontsWhileDrawingBadges)).toEqual(new Set([`${12 * 0.5}px sans-serif`]));
  });

  it('scalesThePlacementPreviewsBorderWidthByZoom', () => {
    const ctx = stubCanvasContext();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        // No 'P'/'+' cells, so drawMarkerGlyph never runs and the last
        // lineWidth assignment is the placement border's own.
        grid={[['.', '.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        zoom={0.5}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
        placement={{
          preview: { cells: [{ row: 0, col: 1, char: '.' }], valid: true },
          onHover: () => {},
          onPlace: () => {},
          onCancel: () => {},
        }}
      />,
    );
    // PLACEMENT_BORDER_WIDTH is 3.
    expect(ctx.lineWidth).toBe(3 * 0.5);
  });

  it('leavesOverlayFontAndStrokeWidthsAtTheirUnscaledValuesAt100Percent', () => {
    const ctx = stubCanvasContext();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        markerGrid={[[{ kind: 'patrolBoundary' }]]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(ctx.font).toBe('18px sans-serif');
    expect(ctx.lineWidth).toBe(3);
  });
});

describe('EditorCanvas blueprint connection point markers', () => {
  it('draws an editor-only marker over every connection point tile, which the game itself never shows', () => {
    const ctx = stubCanvasContext() as unknown as {
      fillText: ReturnType<typeof vi.fn>;
      fillRect: ReturnType<typeof vi.fn>;
    };

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        markerGrid={[[{ kind: 'connectionPoint' }]]}
        selectedTool="connectionPoint"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    const glyphCalls = ctx.fillText.mock.calls.filter(
      (call: unknown[]) => call[0] === CONNECTION_POINT_MARKER_GLYPH,
    );
    expect(glyphCalls).not.toHaveLength(0);
    // Tinted cell behind the glyph, at the tile's own top-left corner.
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
  });

  it('offsets the connection point marker by the pan offset, like every other drawn layer', () => {
    const ctx = stubCanvasContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        markerGrid={[[{ kind: 'connectionPoint' }]]}
        selectedTool="connectionPoint"
        panOffset={{ x: 100, y: 40 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    expect(ctx.fillRect).toHaveBeenCalledWith(100, 40, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
  });

  it('draws no connection point marker for a grid without any connection point tile', () => {
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
      (call: unknown[]) => call[0] === CONNECTION_POINT_MARKER_GLYPH,
    );
    expect(glyphCalls).toHaveLength(0);
  });

  it('gives the patrol tile and the connection point tile their own distinct glyphs in one grid', () => {
    // Both are sprite-less markers; one shared symbol would make a room's
    // border unreadable.
    const ctx = stubCanvasContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    expect(CONNECTION_POINT_MARKER_GLYPH).not.toBe(PATROL_MARKER_GLYPH);

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.', '.']]}
        markerGrid={[[{ kind: 'patrolBoundary' }, { kind: 'connectionPoint' }]]}
        selectedTool="connectionPoint"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    const drawn = ctx.fillText.mock.calls.map((call: unknown[]) => call[0]);
    expect(drawn).toContain(PATROL_MARKER_GLYPH);
    expect(drawn).toContain(CONNECTION_POINT_MARKER_GLYPH);
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
    render(
      <EditorCanvas
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        backgroundGrid={[]}
        activeLayer="background"
        selectedBackgroundMaterial="d"
        onPaint={vi.fn()}
        onPaintBackground={onPaintBackground}
        onPan={vi.fn()}
      />,
    );

    const canvas = levelEditorPage.canvas;
    fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0, button: 0 });

    expect(onPaintBackground).toHaveBeenCalledWith([['d']]);
  });

  it('rightClickWithBackgroundLayerActive-callsOnPaintBackgroundWithThePlacementErased', () => {
    stubCanvasContext();
    const onPaintBackground = vi.fn();
    render(
      <EditorCanvas
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        backgroundGrid={[['d']]}
        activeLayer="background"
        selectedBackgroundMaterial={null}
        onPaint={vi.fn()}
        onPaintBackground={onPaintBackground}
        onPan={vi.fn()}
      />,
    );

    const canvas = levelEditorPage.canvas;
    fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0, button: 2 });

    expect(onPaintBackground).toHaveBeenCalledWith([['.']]);
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
        backgroundGrid={[]}
        activeLayer="background"
        selectedBackgroundMaterial={null}
        onPaint={vi.fn()}
        onPaintBackground={vi.fn()}
        onPan={vi.fn()}
      />,
    );

    expect(alphaDuringDrawTerrain).toBe(0.2);
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

  it('staticObjectsLoaded-passedThroughToDrawTerrain', () => {
    stubCanvasContext();
    const tileset = {} as HTMLImageElement;
    const groundAtlas = {} as HTMLImageElement;
    const fakeStaticObjects = {} as HTMLImageElement;
    render(
      <EditorCanvas
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, tileset, groundAtlas, staticObjects: fakeStaticObjects }}
        backgroundGrid={[]}
        activeLayer="foreground"
        selectedBackgroundMaterial={null}
        onPaint={vi.fn()}
        onPaintBackground={vi.fn()}
        onPan={vi.fn()}
      />,
    );

    expect(drawTerrain).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), expect.anything(),
      expect.anything(), expect.anything(), fakeStaticObjects, null, null, 0, null,
    );
  });

  it('torchLoaded-passedThroughToDrawTerrainWithZeroElapsed', () => {
    stubCanvasContext();
    const tileset = {} as HTMLImageElement;
    const groundAtlas = {} as HTMLImageElement;
    const fakeTorch = {} as HTMLImageElement;
    render(
      <EditorCanvas
        grid={[['¥']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, tileset, groundAtlas, torch: fakeTorch }}
        backgroundGrid={[]}
        activeLayer="foreground"
        selectedBackgroundMaterial={null}
        onPaint={vi.fn()}
        onPaintBackground={vi.fn()}
        onPan={vi.fn()}
      />,
    );

    // The editor previews each torch cell at worldElapsed 0, so it shows that
    // cell's deterministic position-hashed frame rather than a live animation.
    expect(drawTerrain).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), expect.anything(),
      expect.anything(), expect.anything(), null, null, fakeTorch, 0, null,
    );
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
        backgroundGrid={[]}
        activeLayer="background"
        selectedBackgroundMaterial={null}
        onPaint={vi.fn()}
        onPaintBackground={vi.fn()}
        onPan={vi.fn()}
      />,
    );

    expect(alphaDuringDrawPlayer).toBe(0.2);
  });
});

describe('EditorCanvas — readGameBackgroundColor', () => {
  it('readGameBackgroundColor-whenEditorBackdropTokenIsSet-returnsIt', () => {
    const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (prop: string) =>
        prop === '--editor-canvas-backdrop' ? '  #123456  ' : '',
    } as unknown as CSSStyleDeclaration);

    expect(readGameBackgroundColor()).toBe('#123456');

    spy.mockRestore();
  });

  it('readGameBackgroundColor-whenTokenIsMissing-fallsBackToTheDaylightConstant', () => {
    const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration);

    expect(readGameBackgroundColor()).toBe('#53b0de');

    spy.mockRestore();
  });
});

describe('EditorCanvas — placement clicks (step 44c)', () => {
  const placementProps = (overrides: Partial<Parameters<typeof EditorCanvas>[0]> = {}) => ({
    ...BACKGROUND_LAYER_DEFAULT_PROPS,
    grid: [['.', '.'], ['.', '.']] as TileChar[][],
    selectedTool: 'G' as TileChar,
    panOffset: { x: 0, y: 0 },
    images: EMPTY_IMAGES,
    onPaint: vi.fn(),
    onPan: vi.fn(),
    ...overrides,
  });

  const clickCanvas = (
    canvas: HTMLCanvasElement,
    col: number,
    row: number,
    button = 0,
  ) => {
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    fireEvent.mouseDown(canvas, {
      button,
      clientX: col * RENDERED_TILE_SIZE + 1,
      clientY: row * RENDERED_TILE_SIZE + 1,
    });
  };

  it('blueprintArmed-leftClick-reportsTheClickedCellInsteadOfPainting', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const onPlace = vi.fn();
    render(
      <EditorCanvas
        {...placementProps({ onPaint })}
        placement={{ preview: null, onHover: vi.fn(), onPlace, onCancel: vi.fn() }}
      />,
    );

    clickCanvas(levelEditorPage.canvas, 1, 1);

    expect(onPlace).toHaveBeenCalledWith({ col: 1, row: 1 });
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('blueprintArmed-leftClickWithBackgroundLayerActive-reportsTheClickedCellInsteadOfPaintingBackground', () => {
    // The armed-placement branch in handleMouseDown is checked BEFORE the
    // activeLayer === 'background' branch, so an armed blueprint must win
    // even while the Background layer (not just Foreground) is active.
    // Every other placement test above uses BACKGROUND_LAYER_DEFAULT_PROPS,
    // whose activeLayer is 'foreground' — none of them would catch the
    // placement check accidentally being moved after the background branch.
    stubCanvasContext();
    const onPaint = vi.fn();
    const onPaintBackground = vi.fn();
    const onPlace = vi.fn();
    render(
      <EditorCanvas
        {...placementProps({ onPaint, activeLayer: 'background', onPaintBackground })}
        placement={{ preview: null, onHover: vi.fn(), onPlace, onCancel: vi.fn() }}
      />,
    );

    clickCanvas(levelEditorPage.canvas, 1, 1);

    expect(onPlace).toHaveBeenCalledWith({ col: 1, row: 1 });
    expect(onPaintBackground).not.toHaveBeenCalled();
  });

  it('blueprintArmed-rightClick-cancelsInsteadOfErasing', () => {
    // Right-click has no erase meaning during a placement preview — nothing is
    // being painted — so it is repurposed as an immediate cancel, saving a trip
    // back to the palette (design, Step 44c — Placement).
    stubCanvasContext();
    const onPaint = vi.fn();
    const onCancel = vi.fn();
    render(
      <EditorCanvas
        {...placementProps({ onPaint })}
        placement={{ preview: null, onHover: vi.fn(), onPlace: vi.fn(), onCancel }}
      />,
    );

    clickCanvas(levelEditorPage.canvas, 1, 1, 2);

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('blueprintArmed-middleClick-stillPansSoARoomCanBeLinedUp', () => {
    stubCanvasContext();
    const onPan = vi.fn();
    const onPlace = vi.fn();
    render(
      <EditorCanvas
        {...placementProps({ onPan })}
        placement={{ preview: null, onHover: vi.fn(), onPlace, onCancel: vi.fn() }}
      />,
    );
    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);

    fireEvent.mouseDown(canvas, { button: 1, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(canvas, { clientX: 40, clientY: 0 });

    expect(onPan).toHaveBeenCalledWith({ x: 40, y: 0 });
    expect(onPlace).not.toHaveBeenCalled();
  });

  it('blueprintArmed-draggingAfterAPlacementClick-paintsNothing', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    render(
      <EditorCanvas
        {...placementProps({ onPaint })}
        placement={{ preview: null, onHover: vi.fn(), onPlace: vi.fn(), onCancel: vi.fn() }}
      />,
    );
    const canvas = levelEditorPage.canvas;

    clickCanvas(canvas, 0, 0);
    fireEvent.mouseMove(canvas, { clientX: 40, clientY: 40 });

    expect(onPaint).not.toHaveBeenCalled();
  });

  it('blueprintArmed-mouseMove-reportsTheHoveredCellForALivePreview', () => {
    stubCanvasContext();
    const onHover = vi.fn();
    render(
      <EditorCanvas
        {...placementProps({})}
        placement={{ preview: null, onHover, onPlace: vi.fn(), onCancel: vi.fn() }}
      />,
    );
    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);

    fireEvent.mouseMove(canvas, {
      clientX: 2 * RENDERED_TILE_SIZE + 1,
      clientY: RENDERED_TILE_SIZE + 1,
    });

    expect(onHover).toHaveBeenCalledWith({ col: 2, row: 1 });
  });

  it('blueprintArmed-mouseLeavesTheCanvas-clearsTheHoveredCell', () => {
    stubCanvasContext();
    const onHover = vi.fn();
    render(
      <EditorCanvas
        {...placementProps({})}
        placement={{ preview: null, onHover, onPlace: vi.fn(), onCancel: vi.fn() }}
      />,
    );
    const canvas = levelEditorPage.canvas;

    fireEvent.mouseLeave(canvas);

    expect(onHover).toHaveBeenCalledWith(null);
  });

  it('noPlacementProp-mouseLeavesTheCanvas-doesNotThrowOrCallAnything', () => {
    stubCanvasContext();
    render(<EditorCanvas {...placementProps({})} />);
    const canvas = levelEditorPage.canvas;

    expect(() => fireEvent.mouseLeave(canvas)).not.toThrow();
  });

  it('noPlacementProp-leftClickStillPaintsExactlyAsBefore', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    render(<EditorCanvas {...placementProps({ onPaint })} />);

    clickCanvas(levelEditorPage.canvas, 1, 1);

    expect(onPaint).toHaveBeenCalledOnce();
  });

  it('placementPropExplicitlyNull-leftClickStillPaints', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    render(
      <EditorCanvas {...placementProps({ onPaint })} placement={null} />,
    );

    clickCanvas(levelEditorPage.canvas, 1, 1);

    expect(onPaint).toHaveBeenCalledOnce();
  });
});

describe('EditorCanvas — placement preview (step 44c)', () => {
  const previewProps = (preview: {
    cells: { row: number; col: number; char?: TileChar; marker?: MarkerEntry }[];
    valid: boolean;
  }) => ({
    ...BACKGROUND_LAYER_DEFAULT_PROPS,
    grid: [['.', '.'], ['.', '.']] as TileChar[][],
    selectedTool: 'G' as TileChar,
    images: EMPTY_IMAGES,
    onPaint: () => {},
    onPan: () => {},
    placement: {
      preview: {
        cells: preview.cells.map(({ row, col, char = 'R' as TileChar, marker }) => ({
          row,
          col,
          char,
          ...(marker ? { marker } : {}),
        })),
        valid: preview.valid,
      },
      onHover: () => {},
      onPlace: () => {},
      onCancel: () => {},
    },
  });

  it('tints every previewed cell and strokes one border around the whole room', () => {
    const ctx = stubCanvasContext() as unknown as {
      fillRect: ReturnType<typeof vi.fn>;
      strokeRect: ReturnType<typeof vi.fn>;
    };

    render(
      <EditorCanvas
        {...previewProps({
          cells: [
            { row: 0, col: 0 },
            { row: 1, col: 1 },
          ],
          valid: true,
        })}
        panOffset={{ x: 0, y: 0 }}
      />,
    );

    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
    expect(ctx.fillRect).toHaveBeenCalledWith(
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
    // One border around the 2x2 bounding box the two cells span — not one per
    // cell, which would read as another 44b-style cell marker.
    expect(ctx.strokeRect).toHaveBeenCalledTimes(1);
    expect(ctx.strokeRect).toHaveBeenCalledWith(
      0,
      0,
      2 * RENDERED_TILE_SIZE,
      2 * RENDERED_TILE_SIZE,
    );
  });

  it('offsets the preview by the pan offset, like every other drawn layer', () => {
    const ctx = stubCanvasContext() as unknown as { strokeRect: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...previewProps({ cells: [{ row: 0, col: 0 }], valid: true })}
        panOffset={{ x: 100, y: 40 }}
      />,
    );

    expect(ctx.strokeRect).toHaveBeenCalledWith(100, 40, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
  });

  it('handles a preview anchored at negative coordinates, where growth would happen', () => {
    const ctx = stubCanvasContext() as unknown as { strokeRect: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...previewProps({ cells: [{ row: -1, col: -1 }], valid: true })}
        panOffset={{ x: 0, y: 0 }}
      />,
    );

    expect(ctx.strokeRect).toHaveBeenCalledWith(
      -RENDERED_TILE_SIZE,
      -RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
  });

  it('borders a valid placement in blue and an invalid one in red', () => {
    // The preview is the LAST thing the draw effect does and the stubbed
    // save/restore are no-ops, so the context's strokeStyle still holds the
    // colour the preview chose.
    const validCtx = stubCanvasContext();
    render(
      <EditorCanvas
        {...previewProps({ cells: [{ row: 0, col: 0 }], valid: true })}
        panOffset={{ x: 0, y: 0 }}
      />,
    );
    expect(validCtx.strokeStyle).toBe(PLACEMENT_VALID_COLOR);

    cleanup();

    const invalidCtx = stubCanvasContext();
    render(
      <EditorCanvas
        {...previewProps({ cells: [{ row: 0, col: 0 }], valid: false })}
        panOffset={{ x: 0, y: 0 }}
      />,
    );
    expect(invalidCtx.strokeStyle).toBe(PLACEMENT_INVALID_COLOR);
    expect(PLACEMENT_INVALID_COLOR).not.toBe(PLACEMENT_VALID_COLOR);
  });

  it('drawsTheConnectionPointGlyphOnAConnectionPointCellInThePreview', () => {
    const ctx = stubCanvasContext() as unknown as { fillText: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...previewProps({
          cells: [
            { row: 0, col: 0, char: 'R' as TileChar },
            { row: 0, col: 1, marker: { kind: 'connectionPoint' } },
          ],
          valid: true,
        })}
        panOffset={{ x: 0, y: 0 }}
      />,
    );

    expect(ctx.fillText).toHaveBeenCalledWith(
      CONNECTION_POINT_MARKER_GLYPH,
      RENDERED_TILE_SIZE + RENDERED_TILE_SIZE / 2,
      RENDERED_TILE_SIZE / 2,
    );
  });

  it('drawsNoGlyphWhenThePreviewHasNoConnectionPointCells', () => {
    const ctx = stubCanvasContext() as unknown as { fillText: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...previewProps({ cells: [{ row: 0, col: 0, char: 'R' as TileChar }], valid: true })}
        panOffset={{ x: 0, y: 0 }}
      />,
    );

    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('draws nothing extra while a blueprint is armed but no anchor has been clicked yet', () => {
    const ctx = stubCanvasContext() as unknown as { strokeRect: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
        placement={{ preview: null, onHover: () => {}, onPlace: () => {}, onCancel: () => {} }}
      />,
    );

    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });
});

describe('EditorCanvas — cave lighting preview (O-015 US3)', () => {
  const CAVE_BACKGROUND: BackgroundChar[][] = [['c']];
  const SPAWN_IN_CAVE_GRID: TileChar[][] = [
    ['.', '.', '¥'],
    ['.', 'S', '.'],
    ['.', '.', '.'],
  ];

  const previewProps = (overrides: Partial<Parameters<typeof EditorCanvas>[0]> = {}) => ({
    ...BACKGROUND_LAYER_DEFAULT_PROPS,
    grid: SPAWN_IN_CAVE_GRID,
    selectedTool: 'G' as TileChar,
    panOffset: { x: 0, y: 0 },
    images: EMPTY_IMAGES,
    appearance: 'dark' as const,
    backgroundGrid: CAVE_BACKGROUND,
    onPaint: () => {},
    onPan: () => {},
    ...overrides,
  });

  it('canvas-whenDark-callsDrawDarknessDrawEnemyEyesAndDrawHeldTorchAtRest', () => {
    stubCanvasContext();

    render(<EditorCanvas {...previewProps()} />);

    expect(drawDarkness).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(Number),
      expect.any(Number),
      EDITOR_PREVIEW_DARKNESS,
      expect.arrayContaining([expect.objectContaining({ col: 2, row: 0 })]),
      expect.any(Number),
      expect.any(Number),
      0,
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      1,
    );
    expect(drawEnemyEyes).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Array),
      EDITOR_PREVIEW_DARKNESS,
      expect.any(Array),
      0,
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );
    expect(drawHeldTorch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ animState: 'idle' }),
      null,
      EDITOR_PREVIEW_DARKNESS,
      0,
      0,
      0,
    );
  });

  it('canvas-whenZoomedOut-stillDrawsTheWholeCavePreview', () => {
    stubCanvasContext();

    render(<EditorCanvas {...previewProps({ zoom: 0.5 })} />);

    expect(drawDarkness).toHaveBeenCalled();
    expect(drawEnemyEyes).toHaveBeenCalled();
    expect(drawHeldTorch).toHaveBeenCalled();
  });

  it('canvas-whenZoomedOut-passesDrawDarknessTheRawPanAndTheZoom', () => {
    // drawDarkness runs at IDENTITY transform and does its own zoom
    // multiplication internally, so it takes the RAW pan — deliberately the
    // opposite convention from drawTerrain & co., which run inside their own
    // ctx.scale() and therefore take the pan pre-divided by zoom.
    stubCanvasContext();

    render(<EditorCanvas {...previewProps({ zoom: 0.5, panOffset: { x: 40, y: 20 } })} />);

    expect(drawDarkness).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(Number),
      expect.any(Number),
      EDITOR_PREVIEW_DARKNESS,
      expect.any(Array),
      40, // raw panOffset.x, NOT 40 / 0.5
      20, // raw panOffset.y, NOT 20 / 0.5
      0,
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      0.5,
    );
  });

  it('canvas-whenZoomedOut-stillPassesTheDividedOriginToTheScaledCavePasses', () => {
    // drawHeldTorch and drawEnemyEyes stay inside a ctx.scale() segment (their
    // sprite/marker sizing is RENDERED_TILE_SIZE-based), so they keep the
    // divided origin. A regression here means their sizing broke.
    stubCanvasContext();

    render(<EditorCanvas {...previewProps({ zoom: 0.5, panOffset: { x: 40, y: 20 } })} />);

    expect(drawHeldTorch).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      null,
      EDITOR_PREVIEW_DARKNESS,
      80, // 40 / 0.5
      40, // 20 / 0.5
      0,
    );
    expect(drawEnemyEyes).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Array),
      EDITOR_PREVIEW_DARKNESS,
      expect.any(Array),
      0,
      80, // 40 / 0.5
      40, // 20 / 0.5
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );
  });

  it('canvas-whenZoomIsOmitted-passesDrawDarknessTheRawPanAndAZoomOfOne', () => {
    // At 100% the divided and the raw origin coincide, so this frame is
    // byte-identical to the pre-zoom one.
    stubCanvasContext();

    render(<EditorCanvas {...previewProps({ panOffset: { x: 40, y: 20 } })} />);

    expect(drawDarkness).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(Number),
      expect.any(Number),
      EDITOR_PREVIEW_DARKNESS,
      expect.any(Array),
      40,
      20,
      0,
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      1,
    );
  });

  it('canvas-whenLight-doesNotCallTheCavePasses', () => {
    stubCanvasContext();

    render(<EditorCanvas {...previewProps({ appearance: 'light' })} />);

    expect(drawDarkness).not.toHaveBeenCalled();
    expect(drawEnemyEyes).not.toHaveBeenCalled();
    expect(drawHeldTorch).not.toHaveBeenCalled();
  });

  it('canvas-whenBlueprintMode-doesNotCallTheCavePassesEvenWhenDark', () => {
    stubCanvasContext();

    render(<EditorCanvas {...previewProps({ isBlueprintMode: true })} />);

    expect(drawDarkness).not.toHaveBeenCalled();
    expect(drawEnemyEyes).not.toHaveBeenCalled();
    expect(drawHeldTorch).not.toHaveBeenCalled();
  });

  it('canvas-whenDarkEvenWithNoCaveBackground-callsDrawDarkness', () => {
    stubCanvasContext();

    render(<EditorCanvas {...previewProps({ backgroundGrid: [] })} />);

    expect(drawDarkness).toHaveBeenCalled();
  });

  it('canvas-whenPreviewActive-redrawsGridLinesSignBadgesAndMarkersAboveTheOverlay', () => {
    const ctx = stubCanvasContext();
    const order: string[] = [];
    (drawDarkness as ReturnType<typeof vi.fn>).mockImplementation(() => {
      order.push('darkness');
    });
    (ctx.stroke as ReturnType<typeof vi.fn>).mockImplementation(() => {
      order.push('grid');
    });
    (ctx.fillText as ReturnType<typeof vi.fn>).mockImplementation(() => {
      order.push('text');
    });

    // A marker on the grid so the affordance re-draw actually paints text.
    render(
      <EditorCanvas
        {...previewProps({
          markerGrid: [
            [null, null, null],
            [null, null, { kind: 'patrolBoundary' }],
            [null, null, null],
          ],
        })}
      />,
    );

    expect(order).toContain('darkness');
    // The affordances are re-drawn after the darkness overlay so they stay
    // legible on top of it (FR-012).
    expect(order.lastIndexOf('grid')).toBeGreaterThan(order.indexOf('darkness'));
    expect(order.lastIndexOf('text')).toBeGreaterThan(order.indexOf('darkness'));
  });
});

describe('EditorCanvas — scaling the shared renderer', () => {
  it('wrapsTheSharedRendererCallsInACtxScaleMatchingTheCurrentZoom', async () => {
    const ctx = stubCanvasContext() as unknown as {
      scale: ReturnType<typeof vi.fn>;
    };
    const player = {} as HTMLImageElement;
    const backgroundAtlas = {} as HTMLImageElement;
    const { drawTerrain, drawBackgroundTiles: drawBackgroundTilesFn, drawPlayer: drawPlayerFn } =
      await import('../engine/Renderer');

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['G', 'S']]}
        selectedTool="."
        panOffset={{ x: 40, y: 20 }}
        zoom={0.5}
        images={{
          ...EMPTY_IMAGES,
          tileset: {} as HTMLImageElement,
          groundAtlas: {} as HTMLImageElement,
          backgroundAtlas,
          player,
        }}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    // Exactly 3 scaled segments — background, terrain/ladders/signs, entities
    // — never a single blanket scale (which would double-scale the markers
    // Task 4 makes zoom-aware in screen space).
    expect(ctx.scale).toHaveBeenCalledTimes(3);
    expect(ctx.scale).toHaveBeenCalledWith(0.5, 0.5);
    // The origin passed to the shared renderer must be pre-divided by zoom,
    // so that after ctx.scale re-multiplies it, it lands back at the raw
    // panOffset — panOffset itself must stay zoom-independent (design.md
    // "Panning stays in raw pixels, outside the scale").
    expect(drawTerrain).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      80, // 40 / 0.5
      40, // 20 / 0.5
      // EMPTY_IMAGES leaves these null; expect.anything() never matches
      // null/undefined, so assert the literal values, matching the
      // convention the pre-existing drawTerrain test uses above.
      null,
      null,
      null,
      0,
      null,
    );
    // Background segment (hoisted, its own scale) gets the same divided origin.
    expect(drawBackgroundTilesFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      backgroundAtlas,
      80, // 40 / 0.5
      40, // 20 / 0.5
      null, // EMPTY_IMAGES leaves decorations null; anything() never matches null
    );
    // Entity segment (scaled segment 2) also gets the same divided origin.
    expect(drawPlayerFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      player,
      80, // 40 / 0.5
      40, // 20 / 0.5
      null,
      true,
    );
  });

  it('scalesBy1AndDividesOriginBy1WhenZoomIsOmitted-todaysFramesAreByte-for-byteUnchanged', async () => {
    const ctx = stubCanvasContext() as unknown as { scale: ReturnType<typeof vi.fn> };
    const { drawTerrain } = await import('../engine/Renderer');
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['G']]}
        selectedTool="."
        panOffset={{ x: 5, y: 7 }}
        images={{ ...EMPTY_IMAGES, tileset: {} as HTMLImageElement, groundAtlas: {} as HTMLImageElement }}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(ctx.scale).toHaveBeenCalledWith(1, 1);
    expect(drawTerrain).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      5,
      7,
      null,
      null,
      null,
      0,
      null,
    );
  });
});

describe('EditorCanvas zoom controls', () => {
  it('rendersASliderAndAPercentageLabelReflectingTheCurrentZoom', () => {
    stubCanvasContext();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        zoom={0.5}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
        onZoomChange={() => {}}
      />,
    );
    expect(screen.getByTestId('editor-canvas-zoom-value')).toHaveTextContent('50%');
    expect(screen.getByTestId('editor-canvas-zoom')).toBeInTheDocument();
  });

  it('scrollingUpOverTheCanvasZoomsInAnchoredToTheCursor', () => {
    stubCanvasContext();
    const onZoomChange = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        zoom={0.5}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
        onZoomChange={onZoomChange}
      />,
    );
    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);

    fireEvent.wheel(canvas, { deltaY: -100, clientX: 20, clientY: 10 });

    // anchoredPan({x:0,y:0}, {x:20,y:10}, 0.5, 0.75) = (20,10) - 1.5*(20,10) = (-10,-5)
    expect(onZoomChange).toHaveBeenCalledWith(0.75, { x: -10, y: -5 });
  });

  it('scrollingDownOverTheCanvasZoomsOut', () => {
    stubCanvasContext();
    const onZoomChange = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        zoom={0.75}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
        onZoomChange={onZoomChange}
      />,
    );
    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);

    fireEvent.wheel(canvas, { deltaY: 100, clientX: 20, clientY: 10 });

    expect(onZoomChange).toHaveBeenCalledWith(0.5, expect.anything());
  });

  it('doesNotCallOnZoomChangeWhenAlreadyAtTheCeilingAndScrollingIn', () => {
    stubCanvasContext();
    const onZoomChange = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
        onZoomChange={onZoomChange}
      />,
    );
    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);

    fireEvent.wheel(canvas, { deltaY: -100, clientX: 0, clientY: 0 });

    expect(onZoomChange).not.toHaveBeenCalled();
  });

  it('movingTheSliderZoomsAnchoredToTheCanvasCenter', () => {
    stubCanvasContext();
    const onZoomChange = vi.fn();
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
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        zoom={1}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
        onZoomChange={onZoomChange}
      />,
    );
    act(() => {
      resizeCallback(
        [{ contentRect: { width: 200, height: 100 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    // The base-ui Slider (this repo's shadcn style) puts the actual
    // keyboard-interactive element on a hidden native `<input type="range">`
    // inside the thumb, not on the outer `data-testid` container (that's the
    // Root, which has no tabIndex of its own) — so the interaction targets
    // that input rather than the outer element the testid is attached to.
    const slider = screen.getByTestId('editor-canvas-zoom');
    const sliderInput = slider.querySelector('input') as HTMLInputElement;
    act(() => {
      sliderInput.focus();
      fireEvent.keyDown(sliderInput, { key: 'ArrowDown' });
    });

    // Stepping down once from index 3 (100%) lands on index 2 (75%).
    // Center = (100, 50).
    // anchoredPan({x:0,y:0}, {x:100,y:50}, 1, 0.75) = (100,50) - 0.75*(100,50) = (25, 12.5)
    expect(onZoomChange).toHaveBeenCalledWith(0.75, { x: 25, y: 12.5 });

    vi.unstubAllGlobals();
  });
});

describe('EditorCanvas falling-stalactite tint (O-027)', () => {
  const TINT = PALETTE_TILE_SPRITES.fallingStalactite!.tint!;

  it('tintsEveryFallingMarkerCellWithTheEditorOnlyReddishWashAndNoGlyph', () => {
    const ctx = stubCanvasContext() as unknown as {
      fillRect: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
      drawImage: ReturnType<typeof vi.fn>;
      fillStyle: string;
    };

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['⊤']]}
        markerGrid={[[{ kind: 'fallingStalactite' }]]}
        selectedTool="fallingStalactite"
        panOffset={{ x: 0, y: 0 }}
        images={TINT_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    // The wash is applied to the scratch sprite mask at native size
    // (`source-atop`) — NOT as a full-cell rectangle at the cell's offset —
    // so only the stalactite's own opaque pixels get tinted.
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
    expect(ctx.fillStyle).toBe(TINT);
    // The tinted sprite is then blitted to the cell (identity pan/zoom here).
    const blit = ctx.drawImage.mock.calls.find((call) => call[0] instanceof HTMLCanvasElement);
    expect(blit?.slice(1)).toEqual([0, 0, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE]);
    // No glyph is drawn for the hazard cell — it is not a sprite-less marker.
    expect(ctx.fillText.mock.calls.filter((call: unknown[]) => call[0] === 'T')).toHaveLength(0);
  });

  it('leavesTheDecorativeStalactiteCellUntinted', () => {
    const ctx = stubCanvasContext() as unknown as {
      fillRect: ReturnType<typeof vi.fn>;
      drawImage: ReturnType<typeof vi.fn>;
    };

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['⊤']]}
        selectedTool="⊤"
        panOffset={{ x: 0, y: 0 }}
        images={TINT_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    expect(ctx.fillRect).not.toHaveBeenCalledWith(0, 0, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
    expect(
      ctx.drawImage.mock.calls.find((call) => call[0] instanceof HTMLCanvasElement),
    ).toBeUndefined();
  });

  it('offsetsTheFallingTintByThePanOffsetAndZoom', () => {
    const ctx = stubCanvasContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.', '⊤']]}
        markerGrid={[[null, { kind: 'fallingStalactite' }]]}
        selectedTool="fallingStalactite"
        panOffset={{ x: 100, y: 40 }}
        zoom={0.5}
        images={TINT_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    const blit = ctx.drawImage.mock.calls.find((call) => call[0] instanceof HTMLCanvasElement);
    expect(blit?.slice(1)).toEqual([
      RENDERED_TILE_SIZE * 0.5 + 100,
      40,
      RENDERED_TILE_SIZE * 0.5,
      RENDERED_TILE_SIZE * 0.5,
    ]);
  });
});

describe('EditorCanvas — marker tool clicks (US1)', () => {
  function clickCell(col: number, row: number, button = 0) {
    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    fireEvent.mouseDown(canvas, {
      button,
      clientX: col * RENDERED_TILE_SIZE + 1,
      clientY: row * RENDERED_TILE_SIZE + 1,
    });
  }

  it('aPureMarkerToolClick-writesOnlyTheMarkerGridAndNeverTerrain', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.', '.']]}
        markerGrid={[[null, null]]}
        selectedTool="patrolBoundary"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={onPaint}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(1, 0);

    expect(onPaint).not.toHaveBeenCalled();
    expect(onPaintMarker).toHaveBeenCalledWith([[null, { kind: 'patrolBoundary' }]]);
  });

  it('aTerrainToolClick-leavesTheMarkerGridAlone', () => {
    stubCanvasContext();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.', '.']]}
        markerGrid={[[{ kind: 'patrolBoundary' }, null]]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(1, 0);

    expect(onPaintMarker).not.toHaveBeenCalled();
  });

  it('anEntityOrHazardOrBackgroundToolClick-leavesTheMarkerGridUntouched', () => {
    // FR-013: no tool writes a marker of a kind other than its own.
    for (const tool of ['M', '^'] as const) {
      stubCanvasContext();
      const onPaintMarker = vi.fn();
      const { unmount } = render(
        <EditorCanvas
          {...BACKGROUND_LAYER_DEFAULT_PROPS}
          grid={[['.', '.']]}
          markerGrid={[[{ kind: 'patrolBoundary' }, null]]}
          selectedTool={tool}
          panOffset={{ x: 0, y: 0 }}
          images={EMPTY_IMAGES}
          onPaint={() => {}}
          onPaintMarker={onPaintMarker}
          onPan={() => {}}
        />,
      );
      clickCell(1, 0);
      expect(onPaintMarker).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('theEraseGesture-clearsOnlyTheSelectedMarkerToolCell', () => {
    stubCanvasContext();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.', '.']]}
        markerGrid={[[{ kind: 'patrolBoundary' }, { kind: 'connectionPoint' }]]}
        selectedTool="patrolBoundary"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0, 2);

    // Only the patrol boundary is cleared; the connection point is untouched.
    expect(onPaintMarker).toHaveBeenCalledWith([
      [null, { kind: 'connectionPoint' }],
    ]);
  });

  it('theSignTool-writesTAndADefaultHintMarker', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.', '.']]}
        markerGrid={[[null, null]]}
        selectedTool="T"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={onPaint}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(1, 0);

    expect(onPaint).toHaveBeenCalledWith(expect.objectContaining({ grid: [['.', 'T']] }));
    expect(onPaintMarker).toHaveBeenCalledWith([[null, { kind: 'sign', hintId: 'bridgeDropThrough' }]]);
  });

  it('theSignTool-reClicked-cyclesTheHint', () => {
    stubCanvasContext();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['T', '.']]}
        markerGrid={[[{ kind: 'sign', hintId: 'bridgeDropThrough' }, null]]}
        selectedTool="T"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0);

    expect(onPaintMarker).toHaveBeenCalledWith([[{ kind: 'sign', hintId: 'ladderClimbUp' }, null]]);
  });

  it('theDecorativeStalactiteTool-paintsOnlyTheTileAndNoMarker', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        markerGrid={[[null]]}
        selectedTool="⊤"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={onPaint}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0);

    expect(onPaint).toHaveBeenCalledWith(expect.objectContaining({ grid: [['⊤']] }));
    expect(onPaintMarker).not.toHaveBeenCalled();
  });

  it('theFallingStalactiteTool-paintsTheTilePlusItsOwnMarker', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        markerGrid={[[null]]}
        selectedTool="fallingStalactite"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={onPaint}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0);

    expect(onPaint).toHaveBeenCalledWith(expect.objectContaining({ grid: [['⊤']] }));
    expect(onPaintMarker).toHaveBeenCalledWith([[{ kind: 'fallingStalactite' }]]);
  });

  it('theSignTool-rightClick-removesTheTileAndItsMarker', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['T', '.']]}
        markerGrid={[[{ kind: 'sign', hintId: 'bridgeDropThrough' }, null]]}
        selectedTool="T"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={onPaint}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0, 2);

    // The whole sign goes: the `T` terrain and the sign marker (a bare `T`
    // would otherwise still resolve to the default hint).
    expect(onPaint).toHaveBeenCalledWith(expect.objectContaining({ grid: [['.', '.']] }));
    expect(onPaintMarker).toHaveBeenCalledWith([[null, null]]);
  });

  it('theFallingStalactiteTool-rightClick-removesTheTileAndItsMarker', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['⊤']]}
        markerGrid={[[{ kind: 'fallingStalactite' }]]}
        selectedTool="fallingStalactite"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={onPaint}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0, 2);

    expect(onPaint).toHaveBeenCalledWith(expect.objectContaining({ grid: [['.']] }));
    expect(onPaintMarker).toHaveBeenCalledWith([[null]]);
  });

  it('theEraser-overASignTile-clearsTheStaleSignMarker', () => {
    stubCanvasContext();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['T']]}
        markerGrid={[[{ kind: 'sign', hintId: 'bridgeDropThrough' }]]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0, 2);

    expect(onPaintMarker).toHaveBeenCalledWith([[null]]);
  });

  it('paintingAnotherTileOverAFallingStalactite-clearsTheStaleMarker', () => {
    stubCanvasContext();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['⊤']]}
        markerGrid={[[{ kind: 'fallingStalactite' }]]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0);

    expect(onPaintMarker).toHaveBeenCalledWith([[null]]);
  });

  it('paintingTerrainOverAPatrolBoundary-leavesItsMarker', () => {
    stubCanvasContext();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        markerGrid={[[{ kind: 'patrolBoundary' }]]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0);

    // A patrol boundary is independent of its terrain (FR-002).
    expect(onPaintMarker).not.toHaveBeenCalled();
  });

  it('rightClick-overAPatrolBoundary-clearsItWhateverTheTool', () => {
    stubCanvasContext();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['G']]}
        markerGrid={[[{ kind: 'patrolBoundary' }]]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0, 2);

    // Right-click erases the cell's metadata too, whatever the tool.
    expect(onPaintMarker).toHaveBeenCalledWith([[null]]);
  });

  it('theEraserTool-overAPatrolBoundary-clearsIt', () => {
    stubCanvasContext();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        markerGrid={[[{ kind: 'patrolBoundary' }]]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0);

    expect(onPaintMarker).toHaveBeenCalledWith([[null]]);
  });

  it('theTorchTool-freshCell-paintsTheTileWithNoMarker', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        markerGrid={[[null]]}
        selectedTool="¥"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={onPaint}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0);

    expect(onPaint).toHaveBeenCalledWith(expect.objectContaining({ grid: [['¥']] }));
    // A default torch stores no marker.
    expect(onPaintMarker).not.toHaveBeenCalled();
  });

  it('theTorchTool-reClick-raisesTheStrength', () => {
    stubCanvasContext();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['¥']]}
        markerGrid={[[null]]}
        selectedTool="¥"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0);

    // Default 5 -> 6. Stores a strength marker for `6`.
    expect(onPaintMarker).toHaveBeenCalledWith([[{ kind: 'torch', strength: 6 }]]);
  });

  it('theTorchTool-rightClick-removesTheTileAndItsMarker', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['¥']]}
        markerGrid={[[{ kind: 'torch', strength: 9 }]]}
        selectedTool="¥"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={onPaint}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0, 2);

    expect(onPaint).toHaveBeenCalledWith(expect.objectContaining({ grid: [['.']] }));
    expect(onPaintMarker).toHaveBeenCalledWith([[null]]);
  });

  it('rightClickWithTheTorchTool-overASign-clearsTheSignMarkerToo', () => {
    // The regression: erasing with a *different* variant tool must still clear
    // the cell's marker, whatever kind it is — not just the tool's own kind.
    stubCanvasContext();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['T']]}
        markerGrid={[[{ kind: 'sign', hintId: 'bomb' }]]}
        selectedTool="¥"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0, 2);

    expect(onPaintMarker).toHaveBeenCalledWith([[null]]);
  });

  it('rightClickWithTheSignTool-overATorch-clearsTheTorchMarkerToo', () => {
    stubCanvasContext();
    const onPaintMarker = vi.fn();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['¥']]}
        markerGrid={[[{ kind: 'torch', strength: 8 }]]}
        selectedTool="T"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPaintMarker={onPaintMarker}
        onPan={() => {}}
      />,
    );

    clickCell(0, 0, 2);

    expect(onPaintMarker).toHaveBeenCalledWith([[null]]);
  });
});

describe('EditorCanvas — marker hover tooltip (FR-029)', () => {
  it('hoveringASign-showsItsHintsOwnTranslatedText', () => {
    stubCanvasContext();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['T']]}
        markerGrid={[[{ kind: 'sign', hintId: 'bridgeDropThrough' }]]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);

    fireEvent.mouseMove(canvas, { clientX: 1, clientY: 1 });

    const tooltip = screen.getByTestId('editor-marker-tooltip');
    expect(tooltip).toHaveTextContent('Hold Down to drop through a bridge.');
  });

  it('hoveringAPatrolBoundary-namesTheMarker', () => {
    stubCanvasContext();
    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        markerGrid={[[{ kind: 'patrolBoundary' }]]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    const canvas = levelEditorPage.canvas;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);

    fireEvent.mouseMove(canvas, { clientX: 1, clientY: 1 });

    expect(screen.getByTestId('editor-marker-tooltip')).toHaveTextContent('Patrol boundary');
  });
});
