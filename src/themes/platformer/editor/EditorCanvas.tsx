import { useEffect, useRef, useState } from 'react';
import { SIGN_CHARS, type TileChar } from '../level/LevelParser';

const PATROL_CHAR: TileChar = 'P';
import { paintCell, type PaintResult } from './paintCell';
import { updatePanOffset, centerPanOnSpawn, type PanOffset } from './EditorPan';
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
import { PATROL_GLYPH } from './paletteTiles';
import {
  drawTerrain,
  drawPlayer,
  drawCollectibles,
  drawEnemies,
  drawBlocks,
  drawChests,
  drawSigns,
  drawBackgroundTiles,
} from '../engine/Renderer';
import { placeBackgroundPiece, eraseBackgroundCell } from './paintBackgroundCell';
import type { BackgroundPlacement, BackgroundPieceId } from '../level/LevelData';
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
  groundAtlas: HTMLImageElement | null;
  player: HTMLImageElement | null;
  coin: HTMLImageElement | null;
  fruit: HTMLImageElement | null;
  slimeGreen: HTMLImageElement | null;
  slimePurple: HTMLImageElement | null;
  crackOverlay: HTMLImageElement | null;
  chestClosed: HTMLImageElement | null;
  backgroundAtlas: HTMLImageElement | null;
}

interface EditorCanvasProps {
  grid: TileChar[][];
  selectedTool: TileChar;
  panOffset: PanOffset;
  images: EditorImages;
  /** Bump this to ask the canvas to re-center itself on the spawn tile (see
   *  the effect below). It is a request id rather than a boolean so a
   *  repeated request — Reset pressed twice, say — still fires each time. */
  centerRequestId?: number;
  backgroundPlacements: BackgroundPlacement[];
  activeLayer: 'foreground' | 'background';
  selectedBackgroundPiece: BackgroundPieceId | null;
  onPaint: (result: PaintResult) => void;
  onPaintBackground: (next: BackgroundPlacement[]) => void;
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

/** The character drawn on a patrol tile in the editor — the same one its
 *  palette button shows, so a placed tile is recognizable as the tool that
 *  painted it. */
export const PATROL_MARKER_GLYPH = PATROL_GLYPH;

const PATROL_MARKER_TINT = 'rgba(255, 96, 96, 0.35)';
const PATROL_MARKER_FONT_SIZE = 18;
// The glyph is drawn as a dark core inside a light halo rather than in one
// flat color: a patrol tile can sit over anything the editor draws — pale
// sky, dark ground, a ladder — and the editor itself renders in both a light
// and a dark theme, so no single fill stays legible everywhere.
const PATROL_MARKER_GLYPH_COLOR = '#3d0a0a';
const PATROL_MARKER_HALO_COLOR = 'rgba(255, 255, 255, 0.9)';
const PATROL_MARKER_HALO_WIDTH = 3;

/** Draws a tinted cell with a turn-around glyph on every patrol tile.
 *  Editor-only, exactly like drawSignBadges above: a patrol boundary is
 *  invisible in the real game by design (Renderer.ts's tileSource returns
 *  null for it), which would otherwise leave an author painting tiles they
 *  cannot see. */
function drawPatrolMarkers(
  ctx: CanvasRenderingContext2D,
  grid: TileChar[][],
  originX: number,
  originY: number,
): void {
  ctx.save();
  ctx.font = `${PATROL_MARKER_FONT_SIZE}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] !== PATROL_CHAR) continue;
      const { x, y } = tileToPixel(col, row);
      const destX = x + originX;
      const destY = y + originY;
      ctx.fillStyle = PATROL_MARKER_TINT;
      ctx.fillRect(destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
      const centerX = destX + RENDERED_TILE_SIZE / 2;
      const centerY = destY + RENDERED_TILE_SIZE / 2;
      ctx.lineWidth = PATROL_MARKER_HALO_WIDTH;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = PATROL_MARKER_HALO_COLOR;
      ctx.strokeText(PATROL_MARKER_GLYPH, centerX, centerY);
      ctx.fillStyle = PATROL_MARKER_GLYPH_COLOR;
      ctx.fillText(PATROL_MARKER_GLYPH, centerX, centerY);
    }
  }
  ctx.restore();
}

export const EditorCanvas = ({
  grid,
  selectedTool,
  panOffset,
  images,
  centerRequestId,
  backgroundPlacements,
  activeLayer,
  selectedBackgroundPiece,
  onPaint,
  onPaintBackground,
  onPan,
}: EditorCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  type DragState =
    | { mode: 'paint'; tool: TileChar; lastCol: number; lastRow: number }
    | { mode: 'paintBackground'; isErase: boolean; lastCol: number; lastRow: number }
    | { mode: 'pan'; lastX: number; lastY: number };
  const dragRef = useRef<DragState | null>(null);
  const [canvasSize, setCanvasSize] = useState({
    width: DEFAULT_CANVAS_WIDTH_PX,
    height: DEFAULT_CANVAS_HEIGHT_PX,
  });
  // Whether `canvasSize` reflects a real measurement yet, rather than the
  // fallback above. Only the centering effect below cares: centering against
  // the fallback leaves the view off by half the difference between the two
  // sizes. Starts true where there is no ResizeObserver to wait for (some
  // test runners), since then the fallback is all there will ever be.
  const [canvasMeasured, setCanvasMeasured] = useState(
    () => typeof ResizeObserver === 'undefined',
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
        setCanvasMeasured(true);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Centering the view on the spawn is the CANVAS's job rather than the
  // page's, because only this component knows its measured size. The pending
  // ref is what makes it fire exactly once per request: a fresh request id
  // arms it, and the effect can then only act once the ResizeObserver above
  // has delivered a real size (its first measurement lands AFTER mount, so
  // acting before `canvasMeasured` would center against the fallback size
  // and never correct itself). Once it has centered, it disarms — which is also what
  // stops a later window resize, or any unrelated re-render, from yanking a
  // hand-panned view back to the spawn.
  const pendingCenterRef = useRef<number | undefined>(centerRequestId);
  useEffect(() => {
    pendingCenterRef.current = centerRequestId;
  }, [centerRequestId]);
  useEffect(() => {
    if (!canvasMeasured || pendingCenterRef.current === undefined) return;
    pendingCenterRef.current = undefined;
    onPan(centerPanOnSpawn(grid, canvasSize.width, canvasSize.height));
    // `grid`/`onPan` are deliberately NOT dependencies: this must run when a
    // centering is requested or a new size arrives, not on every paint
    // stroke (which would re-center mid-edit the moment a request happened
    // to still be armed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerRequestId, canvasSize, canvasMeasured]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = readGameBackgroundColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGridLines(ctx, canvas.width, canvas.height, panOffset);

    if (images.backgroundAtlas) {
      drawBackgroundTiles(
        ctx,
        { terrain: [], width: 0, height: 0, background: backgroundPlacements },
        images.backgroundAtlas,
        panOffset.x,
        panOffset.y,
      );
    }

    // While the Background layer is active, the entire foreground scene —
    // terrain plus every entity/marker drawn on top of it — is dimmed
    // (rather than hidden) so the painter can still see where platforms and
    // entities will sit without them obscuring the background pieces being
    // placed underneath. `drawBackgroundTiles` above stays outside this
    // wrapper always, since it's the layer being emphasized, never dimmed —
    // mid-execution addition to the original design.
    const foregroundAlpha = activeLayer === 'background' ? 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = foregroundAlpha;

    if (images.tileset && images.groundAtlas) {
      drawTerrain(
        ctx,
        gridToLevelDef(grid),
        images.tileset,
        images.groundAtlas,
        panOffset.x,
        panOffset.y,
      );
    }

    if (images.tileset) {
      drawSigns(ctx, synthesizeSignPlacements(grid), images.tileset, panOffset.x, panOffset.y);
    }
    drawSignBadges(ctx, grid, panOffset.x, panOffset.y);
    drawPatrolMarkers(ctx, grid, panOffset.x, panOffset.y);

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

    ctx.restore();
    // `canvasSize` is read only via `canvas.width`/`canvas.height` above,
    // not referenced directly here — but it MUST stay a dependency.
    // Changing a <canvas> element's width/height attribute clears its
    // entire backing store (HTML spec), and React applies that attribute
    // change on every canvasSize update from the ResizeObserver effect
    // above. Without this dependency, a resize would blank the canvas and
    // nothing would redraw it until some unrelated state change (a paint
    // or pan) happened to run this effect again — the canvas would sit
    // invisible until the next interaction "fixed" it as a side effect.
  }, [grid, panOffset, images, canvasSize, backgroundPlacements, activeLayer]);

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

    if (activeLayer === 'background') {
      const { col, row } = cellFromEvent(event.clientX, event.clientY);
      const isErase = event.button === 2;
      const next = isErase
        ? eraseBackgroundCell(backgroundPlacements, col, row)
        : selectedBackgroundPiece
          ? placeBackgroundPiece(backgroundPlacements, selectedBackgroundPiece, col, row)
          : backgroundPlacements;
      dragRef.current = { mode: 'paintBackground', isErase, lastCol: col, lastRow: row };
      onPaintBackground(next);
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

    if (drag.mode === 'paintBackground') {
      const { col, row } = cellFromEvent(event.clientX, event.clientY);
      if (col === drag.lastCol && row === drag.lastRow) return;
      const next = drag.isErase
        ? eraseBackgroundCell(backgroundPlacements, col, row)
        : selectedBackgroundPiece
          ? placeBackgroundPiece(backgroundPlacements, selectedBackgroundPiece, col, row)
          : backgroundPlacements;
      dragRef.current = { ...drag, lastCol: col, lastRow: row };
      onPaintBackground(next);
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
