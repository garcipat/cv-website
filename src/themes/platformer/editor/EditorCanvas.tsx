import { useEffect, useRef } from 'react';
import type { TileChar } from '../level/LevelParser';
import { paintCell, type PaintResult } from './paintCell';
import { updatePanOffset, type PanOffset } from './EditorPan';
import {
  gridToLevelDef,
  synthesizePlayerState,
  synthesizeCollectiblePlacements,
  synthesizeEnemyStates,
  synthesizeBlockStates,
  synthesizeChestStates,
} from './gridRenderState';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import {
  drawTerrain,
  drawPlayer,
  drawCollectibles,
  drawEnemies,
  drawBlocks,
  drawChests,
} from '../engine/Renderer';

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

const CANVAS_WIDTH_PX = 800;
const CANVAS_HEIGHT_PX = 480;
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

export const EditorCanvas = ({
  grid,
  selectedTool,
  panOffset,
  images,
  onPaint,
  onPan,
}: EditorCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    mode: 'paint' | 'pan';
    lastCol: number;
    lastRow: number;
    lastX: number;
    lastY: number;
  } | null>(null);

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

    drawCollectibles(
      ctx,
      synthesizeCollectiblePlacements(grid),
      images.coin,
      images.fruit,
      new Set(),
      0,
      panOffset.x,
      panOffset.y,
    );

    drawEnemies(
      ctx,
      synthesizeEnemyStates(grid),
      images.slimeGreen,
      images.slimePurple,
      panOffset.x,
      panOffset.y,
    );

    if (images.tileset) {
      drawBlocks(
        ctx,
        synthesizeBlockStates(grid),
        images.tileset,
        images.crackOverlay,
        panOffset.x,
        panOffset.y,
      );
    }

    drawChests(
      ctx,
      synthesizeChestStates(grid),
      images.chestClosed,
      null,
      panOffset.x,
      panOffset.y,
    );

    const player = synthesizePlayerState(grid);
    if (player && images.player) {
      drawPlayer(ctx, player, images.player, panOffset.x, panOffset.y, null, true);
    }
  }, [grid, panOffset, images]);

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
    if (event.button === 2) {
      dragRef.current = {
        mode: 'pan',
        lastCol: 0,
        lastRow: 0,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      return;
    }
    const { col, row } = cellFromEvent(event.clientX, event.clientY);
    const result = paintCell(grid, col, row, selectedTool);
    dragRef.current = {
      mode: 'paint',
      lastCol: col + result.colShift,
      lastRow: row + result.rowShift,
      lastX: 0,
      lastY: 0,
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
    const result = paintCell(grid, col, row, selectedTool);
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
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH_PX}
      height={CANVAS_HEIGHT_PX}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
};
