import { useEffect, useRef, useState } from 'react';
import { SIGN_CHARS, type TileChar } from '../level/LevelParser';
import { paintCell, type PaintResult } from './paintCell';
import { updatePanOffset, type PanOffset } from './EditorPan';
import {
  gridToLevelDef,
  synthesizePlayerState,
  synthesizeCollectiblePlacements,
  synthesizeEnemyStates,
  synthesizeBlockStates,
  synthesizeChestStates,
  synthesizeSignPlacements,
} from './gridRenderState';
import { RENDERED_TILE_SIZE, tileToPixel } from '../level/Terrain';
import {
  drawTerrain,
  drawPlayer,
  drawCollectibles,
  drawEnemies,
  drawBlocks,
  drawChests,
  drawSigns,
} from '../engine/Renderer';
import type { DrawContext } from '../engine/DrawContext';
import {
  SLIME_GREEN_SHEET,
  SLIME_PURPLE_SHEET,
  COIN_SHEET,
  FRUIT_SHEET,
  WORLD_TILESET_SHEET,
  CRACK_OVERLAY_SHEET,
  CHEST_CLOSED_SHEET,
} from '../entities/sprites/sheets';

export interface EditorImages {
  tileset: HTMLImageElement | null;
  player: HTMLImageElement | null;
  coin: HTMLImageElement | null;
  fruit: HTMLImageElement | null;
  slimeGreen: HTMLImageElement | null;
  slimePurple: HTMLImageElement | null;
  crackOverlay: HTMLImageElement | null;
  chestClosed: HTMLImageElement | null;
}

interface EditorCanvasProps {
  grid: TileChar[][];
  selectedTool: TileChar;
  panOffset: PanOffset;
  images: EditorImages;
  onPaint: (result: PaintResult) => void;
  onPan: (offset: PanOffset) => void;
}

// Fallback size used before the first ResizeObserver measurement lands (or
// in environments without ResizeObserver, e.g. some test runners) — after
// that, the canvas tracks its container's actual size (see the
// ResizeObserver effect below), so it grows/shrinks with the browser
// window instead of staying fixed.
const DEFAULT_CANVAS_WIDTH_PX = 800;
const DEFAULT_CANVAS_HEIGHT_PX = 480;
// Matches the platformer theme's own sky color (`--background` in
// platformer.css) so the editor's canvas looks like the real game's
// background rather than an arbitrary dev-tool color. Falls back to the
// same color hardcoded (its computed value) for environments where the
// CSS custom property isn't available (e.g. jsdom in tests).
const FALLBACK_BACKGROUND_COLOR = '#53b0de';
const GRID_LINE_COLOR = 'rgba(255, 255, 255, 0.25)';

function readGameBackgroundColor(): string {
  if (typeof document === 'undefined') return FALLBACK_BACKGROUND_COLOR;
  const value = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
  return value || FALLBACK_BACKGROUND_COLOR;
}

function drawGridLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  panOffset: PanOffset,
): void {
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 1;

  const startX = ((panOffset.x % RENDERED_TILE_SIZE) + RENDERED_TILE_SIZE) % RENDERED_TILE_SIZE;
  for (let x = startX; x <= width; x += RENDERED_TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }

  const startY = ((panOffset.y % RENDERED_TILE_SIZE) + RENDERED_TILE_SIZE) % RENDERED_TILE_SIZE;
  for (let y = startY; y <= height; y += RENDERED_TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }
}

const SIGN_BADGE_FONT_SIZE = 12;

/** Draws each sign marker's own digit character in its tile's top-left
 *  corner — lets an author tell apart otherwise-identical signpost sprites
 *  at a glance while placing/cycling them (Task 7). Editor-only: the real
 *  game's own drawSigns/drawSignBubble never show this. */
function drawSignBadges(
  ctx: CanvasRenderingContext2D,
  grid: TileChar[][],
  originX: number,
  originY: number,
): void {
  ctx.save();
  ctx.font = `${SIGN_BADGE_FONT_SIZE}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const char = grid[row][col];
      if (!SIGN_CHARS[char]) continue;
      const { x, y } = tileToPixel(col, row);
      ctx.fillStyle = '#000';
      ctx.fillText(char, x + originX + 1, y + originY + 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(char, x + originX, y + originY);
    }
  }
  ctx.restore();
}

export const EditorCanvas = ({
  grid,
  selectedTool,
  panOffset,
  images,
  onPaint,
  onPan,
}: EditorCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  type DragState =
    | { mode: 'paint'; tool: TileChar; lastCol: number; lastRow: number }
    | { mode: 'pan'; lastX: number; lastY: number };
  const dragRef = useRef<DragState | null>(null);
  const [canvasSize, setCanvasSize] = useState({
    width: DEFAULT_CANVAS_WIDTH_PX,
    height: DEFAULT_CANVAS_HEIGHT_PX,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = readGameBackgroundColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGridLines(ctx, canvas.width, canvas.height, panOffset);

    if (images.tileset) {
      drawTerrain(ctx, gridToLevelDef(grid), images.tileset, panOffset.x, panOffset.y);
    }

    if (images.tileset) {
      drawSigns(ctx, synthesizeSignPlacements(grid), images.tileset, panOffset.x, panOffset.y);
    }
    drawSignBadges(ctx, grid, panOffset.x, panOffset.y);

    const drawContext: DrawContext = {
      ctx,
      sprites: {
        [SLIME_GREEN_SHEET.src]: images.slimeGreen,
        [SLIME_PURPLE_SHEET.src]: images.slimePurple,
        [COIN_SHEET.src]: images.coin,
        [FRUIT_SHEET.src]: images.fruit,
        [WORLD_TILESET_SHEET.src]: images.tileset,
        [CRACK_OVERLAY_SHEET.src]: images.crackOverlay,
        [CHEST_CLOSED_SHEET.src]: images.chestClosed,
      },
      originX: panOffset.x,
      originY: panOffset.y,
      worldElapsed: 0,
    };

    drawCollectibles(ctx, synthesizeCollectiblePlacements(grid), new Set(), drawContext);

    drawEnemies(ctx, synthesizeEnemyStates(grid), drawContext);

    drawBlocks(ctx, synthesizeBlockStates(grid), drawContext);

    drawChests(ctx, synthesizeChestStates(grid), drawContext);

    const player = synthesizePlayerState(grid);
    if (player && images.player) {
      drawPlayer(ctx, player, images.player, panOffset.x, panOffset.y, null, true);
    }
    // `canvasSize` is read only via `canvas.width`/`canvas.height` above,
    // not referenced directly here — but it MUST stay a dependency.
    // Changing a <canvas> element's width/height attribute clears its
    // entire backing store (HTML spec), and React applies that attribute
    // change on every canvasSize update from the ResizeObserver effect
    // above. Without this dependency, a resize would blank the canvas and
    // nothing would redraw it until some unrelated state change (a paint
    // or pan) happened to run this effect again — the canvas would sit
    // invisible until the next interaction "fixed" it as a side effect.
  }, [grid, panOffset, images, canvasSize]);

  const cellFromEvent = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return {
      col: Math.floor((x - panOffset.x) / RENDERED_TILE_SIZE),
      row: Math.floor((y - panOffset.y) / RENDERED_TILE_SIZE),
    };
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.button === 1) {
      event.preventDefault(); // suppress the browser's middle-click auto-scroll cursor
      dragRef.current = {
        mode: 'pan',
        lastX: event.clientX,
        lastY: event.clientY,
      };
      return;
    }
    // Right-click always erases, regardless of the selected palette tool;
    // left-click paints with it.
    const tool = event.button === 2 ? '.' : selectedTool;
    const { col, row } = cellFromEvent(event.clientX, event.clientY);
    const result = paintCell(grid, col, row, tool);
    dragRef.current = {
      mode: 'paint',
      tool,
      lastCol: col + result.colShift,
      lastRow: row + result.rowShift,
    };
    onPaint(result);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.mode === 'pan') {
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      dragRef.current = { ...drag, lastX: event.clientX, lastY: event.clientY };
      onPan(updatePanOffset(panOffset, dx, dy));
      return;
    }

    const { col, row } = cellFromEvent(event.clientX, event.clientY);
    if (col === drag.lastCol && row === drag.lastRow) return;
    const result = paintCell(grid, col, row, drag.tool);
    dragRef.current = {
      ...drag,
      lastCol: col + result.colShift,
      lastRow: row + result.rowShift,
    };
    onPaint(result);
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  return (
    // `position: relative` + the canvas absolutely positioned (`inset-0`)
    // takes the canvas out of this container's layout flow entirely, so
    // the container's size depends only on the surrounding flex layout —
    // never on the canvas's own content/attribute size. Without this, the
    // ResizeObserver below would watch a container whose size the canvas
    // itself helps determine, which is exactly the classic
    // ResizeObserver feedback loop: canvas resizes -> container's content
    // size changes -> observer fires again -> canvas resizes again,
    // spiraling toward 0x0 before the browser's built-in loop-guard cuts
    // it off, leaving the canvas stuck invisible.
    <div ref={containerRef} className="relative min-h-0 min-w-0 flex-1">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute inset-0 block h-full w-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  );
};
