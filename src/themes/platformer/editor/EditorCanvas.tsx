import { useEffect, useRef, useState } from 'react';
import { SIGN_CHARS, parseBackgroundLayout, type TileChar, type BackgroundChar } from '../level/LevelParser';

const PATROL_CHAR: TileChar = 'P';
const CONNECTION_POINT_CHAR: TileChar = '+';
import { paintCell, type PaintResult } from './paintCell';
import { updatePanOffset, centerPanOnSpawn, type PanOffset } from './EditorPan';
import {
  ZOOM_LEVELS,
  DEFAULT_ZOOM,
  stepZoom,
  anchoredPan,
  sliderZoomIndex,
  type ZoomLevel,
} from './EditorZoom';
import { Slider } from '@/components/ui/slider';
import {
  gridToLevelDef,
  synthesizePlayerState,
  synthesizeCollectiblePlacements,
  synthesizeEnemyStates,
  synthesizeBlockStates,
  synthesizeChestStates,
  synthesizeCheckpointStates,
  synthesizeSignPlacements,
  synthesizeHazardPlacements,
  synthesizeLadderBundleStates,
} from './gridRenderState';
import { RENDERED_TILE_SIZE, tileToPixel } from '../level/Terrain';
import { PATROL_GLYPH, CONNECTION_POINT_GLYPH } from './paletteTiles';
import {
  drawTerrain,
  drawPlayer,
  drawCollectibles,
  drawEnemies,
  drawBlocks,
  drawChests,
  drawCheckpoints,
  drawSigns,
  drawHazards,
  drawBackgroundTiles,
  drawDeployableLadders,
  drawDarkness,
  drawEnemyEyes,
  drawHeldTorch,
} from '../engine/Renderer';
import { caveLightingPreview } from './caveLightingPreview';
import { paintBackgroundCell, eraseBackgroundCell } from './paintBackgroundCell';
import type { DrawContext } from '../engine/DrawContext';
import type { EditorAppearance } from './editorState';
import { computePotRenderPlan } from '../entities/blocks/potRenderPlan';
import {
  SLIME_GREEN_SHEET,
  SLIME_PURPLE_SHEET,
  COIN_SHEET,
  FRUIT_SHEET,
  WORLD_TILESET_SHEET,
  CRACK_OVERLAY_SHEET,
  CHEST_CLOSED_SHEET,
  STATIC_OBJECTS_SHEET,
  DECORATIONS_SHEET,
  SPEAR_SHEET,
} from '../entities/sprites/sheets';
import { CHECKPOINT_FLAG_SHEET } from '../entities/Checkpoint';

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
  checkpoint: HTMLImageElement | null;
  backgroundAtlas: HTMLImageElement | null;
  staticObjects: HTMLImageElement | null;
  decorations: HTMLImageElement | null;
  torch: HTMLImageElement | null;
  ropeLadder: HTMLImageElement | null;
  mushroom: HTMLImageElement | null;
  spears: HTMLImageElement | null;
}

/** The cells a pending placement would write, in absolute grid coordinates,
 *  and whether it currently fits (`blueprintFit.ts`) — blue when it does, red
 *  when it does not. Each cell carries its own `char` so the preview can draw
 *  a connection point's glyph the same way the level canvas does once it's
 *  actually placed, rather than letting it disappear into the tint. */
export interface PlacementPreview {
  cells: readonly { row: number; col: number; char: TileChar }[];
  valid: boolean;
}

/** Everything the canvas needs while a blueprint is armed for placement
 *  (roadmap step 44c). Its non-null-ness IS "a blueprint is armed": while it is
 *  set, clicks preview/place/cancel instead of painting. */
export interface PlacementMode {
  /** `null` until the mouse has hovered over the canvas at least once since
   *  arming (see `onHover`) — cleared again once it leaves. */
  preview: PlacementPreview | null;
  /** Fires on every mouse move over the canvas while armed, reporting the
   *  cell under the cursor so the preview can follow it live with no click
   *  required; fires with `null` when the cursor leaves the canvas. */
  onHover: (cell: { col: number; row: number } | null) => void;
  onPlace: (cell: { col: number; row: number }) => void;
  onCancel: () => void;
}

interface EditorCanvasProps {
  grid: TileChar[][];
  selectedTool: TileChar;
  panOffset: PanOffset;
  images: EditorImages;
  /** The editor-owned appearance. Only `'dark'` draws the cave-lighting
   *  preview; the default keeps every existing render site unchanged. */
  appearance?: EditorAppearance;
  /** True while the blueprint canvas is active. Blueprints carry no spawn
   *  probe, so they never draw the cave-lighting preview (FR-011). */
  isBlueprintMode?: boolean;
  /** Bump this to ask the canvas to re-center itself on the spawn tile (see
   *  the effect below). It is a request id rather than a boolean so a
   *  repeated request — Reset pressed twice, say — still fires each time. */
  centerRequestId?: number;
  backgroundGrid: BackgroundChar[][];
  activeLayer: 'foreground' | 'background';
  selectedBackgroundMaterial: BackgroundChar | null;
  /** Set while a blueprint is armed for placement; omitted/`null` otherwise, so
   *  every existing render site is unaffected. */
  placement?: PlacementMode | null;
  /** Current zoom level (O-019). Defaults to 100% so every existing caller
   *  that doesn't pass it renders exactly as it did before this feature. */
  zoom?: ZoomLevel;
  /** Fires when the wheel or the zoom slider changes the zoom level. Carries
   *  the fully-anchored new pan alongside the new zoom so the parent applies
   *  both atomically (EditorZoom.ts's `anchoredPan`). Optional so every
   *  existing caller that doesn't offer zoom control keeps compiling. */
  onZoomChange?: (next: ZoomLevel, pan: PanOffset) => void;
  onPaint: (result: PaintResult) => void;
  onPaintBackground: (next: BackgroundChar[][]) => void;
  onPan: (offset: PanOffset) => void;
}

// Fallback size used before the first ResizeObserver measurement lands (or
// in environments without ResizeObserver, e.g. some test runners) — after
// that, the canvas tracks its container's actual size (see the
// ResizeObserver effect below), so it grows/shrinks with the browser
// window instead of staying fixed.
const DEFAULT_CANVAS_WIDTH_PX = 800;
const DEFAULT_CANVAS_HEIGHT_PX = 480;
// Fallback colour used when the editor's `--editor-canvas-backdrop` token is
// unavailable (e.g. jsdom in tests). Its value is the light appearance's
// daylight sky (`editor.css`), so the editor's canvas looks like the real
// game's background rather than an arbitrary dev-tool colour.
const FALLBACK_BACKGROUND_COLOR = '#53b0de';
const GRID_LINE_COLOR = 'rgba(255, 255, 255, 0.25)';

/**
 * The editor canvas backdrop, read from the editor-owned
 * `--editor-canvas-backdrop` token so it follows the light/dark appearance
 * rather than the site-wide theme's `--background` (O-015 FR-006).
 *
 * Exported so its token lookup can be unit-tested directly; it is a pure
 * helper rather than a component, which the fast-refresh heuristic cannot
 * distinguish, so that one rule is silenced here.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const readGameBackgroundColor = (): string => {
  if (typeof document === 'undefined') return FALLBACK_BACKGROUND_COLOR;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--editor-canvas-backdrop')
    .trim();
  return value || FALLBACK_BACKGROUND_COLOR;
};

function drawGridLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  panOffset: PanOffset,
  zoom: ZoomLevel,
): void {
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 1;
  const step = RENDERED_TILE_SIZE * zoom;

  const startX = ((panOffset.x % step) + step) % step;
  for (let x = startX; x <= width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }

  const startY = ((panOffset.y % step) + step) % step;
  for (let y = startY; y <= height; y += step) {
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
  zoom: ZoomLevel,
): void {
  ctx.save();
  ctx.font = `${SIGN_BADGE_FONT_SIZE * zoom}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const char = grid[row][col];
      if (!SIGN_CHARS[char]) continue;
      const { x, y } = tileToPixel(col, row);
      const destX = x * zoom + originX;
      const destY = y * zoom + originY;
      ctx.fillStyle = '#000';
      ctx.fillText(char, destX + 1, destY + 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(char, destX, destY);
    }
  }
  ctx.restore();
}

/** The character drawn on a patrol tile in the editor — the same one its
 *  palette button shows, so a placed tile is recognizable as the tool that
 *  painted it. */
export const PATROL_MARKER_GLYPH = PATROL_GLYPH;
/** Same idea for the blueprint connection point (roadmap step 44b): the tile
 *  is invisible in game, so the editor draws its palette glyph on it. */
export const CONNECTION_POINT_MARKER_GLYPH = CONNECTION_POINT_GLYPH;

const PATROL_MARKER_TINT = 'rgba(255, 96, 96, 0.35)';
const PATROL_MARKER_GLYPH_COLOR = '#3d0a0a';
// Blue, so a connection point is never mistaken for a patrol boundary at a
// glance — both are tinted, sprite-less marker cells. Unrelated to step 44c's
// blue/red PLACEMENT PREVIEW border, which outlines a whole pending placement
// rather than tinting one cell.
const CONNECTION_POINT_MARKER_TINT = 'rgba(96, 168, 255, 0.4)';
const CONNECTION_POINT_MARKER_GLYPH_COLOR = '#0a2a4d';
const MARKER_FONT_SIZE = 18;
// The glyph is drawn as a dark core inside a light halo rather than in one
// flat color: a marker tile can sit over anything the editor draws — pale
// sky, dark ground, a ladder — and the editor itself renders in both a light
// and a dark theme, so no single fill stays legible everywhere.
const MARKER_HALO_COLOR = 'rgba(255, 255, 255, 0.9)';
const MARKER_HALO_WIDTH = 3;

/** Border colour of a placement preview that fits — a saturated stroke around
 *  the whole room, deliberately NOT the pale per-cell blue 44b tints a
 *  connection point with, so the two never read as the same thing. */
export const PLACEMENT_VALID_COLOR = '#1d4ed8';
/** Border colour of a placement that would overlap existing terrain. */
export const PLACEMENT_INVALID_COLOR = '#b91c1c';
const PLACEMENT_VALID_FILL = 'rgba(29, 78, 216, 0.28)';
const PLACEMENT_INVALID_FILL = 'rgba(185, 28, 28, 0.28)';
const PLACEMENT_BORDER_WIDTH = 3;

/**
 * The pending placement: every cell the blueprint would write, tinted, plus one
 * border around their bounding box — blue when the placement fits, red when it
 * overlaps something (`blueprintFit.ts`). One border rather than a per-cell
 * outline is deliberate: a per-cell blue would be indistinguishable from 44b's
 * connection-point tint at a glance.
 *
 * Coordinates are absolute grid cells and may be negative — a room anchored
 * past the grid's top-left corner previews exactly where committing would grow
 * the grid to put it.
 */
/** Draws `glyph` centered on the tile whose top-left pixel is `(destX, destY)`,
 *  as a dark core inside a light halo (see `MARKER_HALO_COLOR`'s doc comment).
 *  Assumes the caller has already set `ctx.font`/`textAlign`/`textBaseline`. */
function drawMarkerGlyph(
  ctx: CanvasRenderingContext2D,
  destX: number,
  destY: number,
  glyph: string,
  glyphColor: string,
  zoom: ZoomLevel,
): void {
  const size = RENDERED_TILE_SIZE * zoom;
  const centerX = destX + size / 2;
  const centerY = destY + size / 2;
  ctx.lineWidth = MARKER_HALO_WIDTH * zoom;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = MARKER_HALO_COLOR;
  ctx.strokeText(glyph, centerX, centerY);
  ctx.fillStyle = glyphColor;
  ctx.fillText(glyph, centerX, centerY);
}

function drawPlacementPreview(
  ctx: CanvasRenderingContext2D,
  preview: PlacementPreview,
  originX: number,
  originY: number,
  zoom: ZoomLevel,
): void {
  if (preview.cells.length === 0) return;

  ctx.save();
  ctx.fillStyle = preview.valid ? PLACEMENT_VALID_FILL : PLACEMENT_INVALID_FILL;
  const size = RENDERED_TILE_SIZE * zoom;

  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const { col, row } of preview.cells) {
    const { x, y } = tileToPixel(col, row);
    ctx.fillRect(x * zoom + originX, y * zoom + originY, size, size);
    if (col < minCol) minCol = col;
    if (row < minRow) minRow = row;
    if (col > maxCol) maxCol = col;
    if (row > maxRow) maxRow = row;
  }

  const topLeft = tileToPixel(minCol, minRow);
  ctx.lineWidth = PLACEMENT_BORDER_WIDTH * zoom;
  ctx.strokeStyle = preview.valid ? PLACEMENT_VALID_COLOR : PLACEMENT_INVALID_COLOR;
  ctx.strokeRect(
    topLeft.x * zoom + originX,
    topLeft.y * zoom + originY,
    (maxCol - minCol + 1) * size,
    (maxRow - minRow + 1) * size,
  );

  // A connection point would otherwise disappear into the tint — draw its
  // glyph on top, same as it renders once actually placed (drawTileMarkers
  // below), so the preview shows exactly what committing would leave behind.
  ctx.font = `${MARKER_FONT_SIZE * zoom}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const { col, row, char } of preview.cells) {
    if (char !== CONNECTION_POINT_CHAR) continue;
    const { x, y } = tileToPixel(col, row);
    drawMarkerGlyph(
      ctx,
      x * zoom + originX,
      y * zoom + originY,
      CONNECTION_POINT_MARKER_GLYPH,
      CONNECTION_POINT_MARKER_GLYPH_COLOR,
      zoom,
    );
  }
  ctx.restore();
}

/** Draws a tinted cell with `glyph` on every `char` tile. Editor-only,
 *  exactly like drawSignBadges above: both markers that use this — the patrol
 *  boundary and the blueprint connection point — are invisible in the real
 *  game by design (Renderer.ts's tileSource returns null for both), which
 *  would otherwise leave an author painting tiles they cannot see. */
function drawTileMarkers(
  ctx: CanvasRenderingContext2D,
  grid: TileChar[][],
  char: TileChar,
  glyph: string,
  tint: string,
  glyphColor: string,
  originX: number,
  originY: number,
  zoom: ZoomLevel,
): void {
  ctx.save();
  ctx.font = `${MARKER_FONT_SIZE * zoom}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = RENDERED_TILE_SIZE * zoom;
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] !== char) continue;
      const { x, y } = tileToPixel(col, row);
      const destX = x * zoom + originX;
      const destY = y * zoom + originY;
      ctx.fillStyle = tint;
      ctx.fillRect(destX, destY, size, size);
      drawMarkerGlyph(ctx, destX, destY, glyph, glyphColor, zoom);
    }
  }
  ctx.restore();
}

export const EditorCanvas = ({
  grid,
  selectedTool,
  panOffset,
  images,
  appearance = 'light',
  isBlueprintMode = false,
  centerRequestId,
  backgroundGrid,
  activeLayer,
  selectedBackgroundMaterial,
  placement = null,
  zoom = DEFAULT_ZOOM,
  onZoomChange,
  onPaint,
  onPaintBackground,
  onPan,
}: EditorCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The reusable offscreen layer `drawDarkness` punches its light holes into —
  // allocated once and resized with the canvas, mirroring PlatformerPage's own
  // `darknessLayerRef` (O-015 D8).
  const darknessLayerRef = useRef<HTMLCanvasElement | null>(null);
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

    // The cave-lighting preview is derived from the live grid/background and
    // drawn only in the dark appearance on the level canvas (FR-008/FR-011).
    const previewActive = appearance === 'dark' && !isBlueprintMode;
    const preview = previewActive ? caveLightingPreview(grid) : null;
    const showPreview = preview !== null && preview.darknessLevel > 0;

    ctx.fillStyle = readGameBackgroundColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGridLines(ctx, canvas.width, canvas.height, panOffset, zoom);

    if (images.backgroundAtlas) {
      // Same conversion `gridToLevelDef` performs for the foreground
      // `TileChar[][]` grid below, mirrored for background: the editor's own
      // `BackgroundChar[][]` grid is joined into the `string[]` layout shape
      // `parseBackgroundLayout` consumes, clamped to the grid's own bounds
      // (not the foreground's) so nothing painted in the preview is dropped.
      const backgroundHeight = backgroundGrid.length;
      const backgroundWidth = backgroundGrid[0]?.length ?? 0;
      const backgroundRows = backgroundGrid.map((row) => row.join(''));
      ctx.save();
      ctx.scale(zoom, zoom);
      drawBackgroundTiles(
        ctx,
        {
          terrain: [],
          width: 0,
          height: 0,
          background: parseBackgroundLayout(backgroundRows, backgroundWidth, backgroundHeight),
        },
        images.backgroundAtlas,
        panOffset.x / zoom,
        panOffset.y / zoom,
        images.decorations,
      );
      ctx.restore();
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
    try {
      ctx.globalAlpha = foregroundAlpha;

      // --- scaled segment 1: Renderer.ts-backed terrain, ladders, signs ---
      ctx.save();
      ctx.scale(zoom, zoom);
      const originX = panOffset.x / zoom;
      const originY = panOffset.y / zoom;

      if (images.tileset && images.groundAtlas) {
        drawTerrain(
          ctx,
          gridToLevelDef(grid),
          images.tileset,
          images.groundAtlas,
          originX,
          originY,
          images.staticObjects,
          images.decorations,
          images.torch,
          0,
          images.mushroom,
        );
      }

      // Editor preview: a translucent ghost of the fully-deployed shaft below
      // each bundle, so an author sees exactly how far the ladder will reach,
      // then the opaque curled bundle drawn on top of it. Never drawn in game.
      const bundleStates = synthesizeLadderBundleStates(grid);
      const previousAlpha = ctx.globalAlpha;
      ctx.save();
      ctx.globalAlpha = 0.4;
      drawDeployableLadders(
        ctx,
        gridToLevelDef(grid),
        bundleStates.map((state) => ({ ...state, phase: 'deployed' as const })),
        images.ropeLadder,
        originX,
        originY,
      );
      ctx.restore();
      // Restore explicitly too: test canvas stubs make save()/restore() no-ops,
      // so without this the ghost's alpha would leak into later draws.
      ctx.globalAlpha = previousAlpha;
      drawDeployableLadders(
        ctx,
        gridToLevelDef(grid),
        bundleStates,
        images.ropeLadder,
        originX,
        originY,
      );

      if (images.tileset) {
        drawSigns(ctx, synthesizeSignPlacements(grid), images.tileset, originX, originY);
      }
      ctx.restore(); // pop scaled segment 1 — back to unscaled, alpha still foregroundAlpha

      // --- unscaled: editor-local overlays (Task 4 handles their own zoom math) ---
      drawSignBadges(ctx, grid, panOffset.x, panOffset.y, zoom);
      drawTileMarkers(
        ctx,
        grid,
        PATROL_CHAR,
        PATROL_MARKER_GLYPH,
        PATROL_MARKER_TINT,
        PATROL_MARKER_GLYPH_COLOR,
        panOffset.x,
        panOffset.y,
        zoom,
      );
      drawTileMarkers(
        ctx,
        grid,
        CONNECTION_POINT_CHAR,
        CONNECTION_POINT_MARKER_GLYPH,
        CONNECTION_POINT_MARKER_TINT,
        CONNECTION_POINT_MARKER_GLYPH_COLOR,
        panOffset.x,
        panOffset.y,
        zoom,
      );

      // The offscreen layer `drawDarkness` punches its light holes into is
      // created and sized here, once per frame and independently of the
      // transform state, because it is read from two places below that sit on
      // opposite sides of segment 2's `ctx.scale()`.
      let darknessLayer: HTMLCanvasElement | null = null;
      if (preview && showPreview) {
        darknessLayer = darknessLayerRef.current ?? document.createElement('canvas');
        darknessLayerRef.current = darknessLayer;
        if (darknessLayer.width !== canvas.width) darknessLayer.width = canvas.width;
        if (darknessLayer.height !== canvas.height) darknessLayer.height = canvas.height;
      }

      // --- scaled segment 2: Renderer.ts-backed entities ---
      ctx.save();
      ctx.scale(zoom, zoom);

      const editorBlockStates = synthesizeBlockStates(grid);

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
          [CHECKPOINT_FLAG_SHEET.src]: images.checkpoint,
          [STATIC_OBJECTS_SHEET.src]: images.staticObjects,
          [DECORATIONS_SHEET.src]: images.decorations,
          [SPEAR_SHEET.src]: images.spears,
        },
        originX,
        originY,
        worldElapsed: 0,
        // Same per-frame computation the real game does (PlatformerPage.tsx)
        // — without this, every pot falls back to its kind's isolated draw
        // path (never merged with a neighbour), which is why the editor
        // preview used to look different from the actual game.
        potPlan: computePotRenderPlan(editorBlockStates),
      };

      drawCollectibles(ctx, synthesizeCollectiblePlacements(grid), new Set(), drawContext);

      drawHazards(ctx, synthesizeHazardPlacements(grid), drawContext);

      drawEnemies(ctx, synthesizeEnemyStates(grid), drawContext);

      drawBlocks(ctx, editorBlockStates, drawContext);

      drawChests(ctx, synthesizeChestStates(grid), drawContext);

      drawCheckpoints(
        ctx,
        synthesizeCheckpointStates(grid),
        images.checkpoint,
        null,
        drawContext,
      );

      const player = synthesizePlayerState(grid);
      if (player && images.player) {
        drawPlayer(ctx, player, images.player, originX, originY, null, true);
      }

      // The preview composes the game's own draw passes unchanged, inside the
      // foreground-alpha block so the background-layer dimming applies to it
      // too. `worldElapsed = 0` keeps it static (FR-013).
      // `drawHeldTorch` draws a sprite at `RENDERED_TILE_SIZE`-based internal
      // sizing, so it belongs inside this scaled segment, unlike `drawDarkness`
      // below.
      if (preview && showPreview && player !== null) {
        drawHeldTorch(
          ctx,
          player,
          images.torch,
          preview.darknessLevel,
          originX,
          originY,
          0,
        );
      }
      ctx.restore(); // pop scaled segment 2 — drawDarkness below needs identity transform

      // `drawDarkness` punches its light holes into an always-unscaled
      // offscreen layer and then composites that layer with a single
      // `ctx.drawImage(layer, 0, 0, canvasWidth, canvasHeight)` — a call whose
      // destination rect IS subject to the active transform. Running it inside
      // segment 2's scale therefore covered only the top-left `zoom` fraction
      // of the canvas. So it runs here at identity instead, taking the RAW
      // (undivided) pan and its own `zoom` argument, which it applies to every
      // world-space position and radius internally. The outer alpha save is
      // still in effect, so the background-layer dimming applies exactly as
      // before.
      if (preview && showPreview && darknessLayer !== null) {
        drawDarkness(
          ctx,
          darknessLayer,
          canvas.width,
          canvas.height,
          preview.darknessLevel,
          preview.torches,
          panOffset.x,
          panOffset.y,
          0,
          preview.playerLight,
          zoom,
        );
      }

      // --- scaled segment 3: enemy-eye markers, drawn over the overlay ---
      // Back inside a scale, since these are RENDERED_TILE_SIZE-based markers
      // like segment 2's entities.
      if (preview && showPreview) {
        ctx.save();
        ctx.scale(zoom, zoom);
        drawEnemyEyes(
          ctx,
          synthesizeEnemyStates(grid),
          preview.darknessLevel,
          preview.torches,
          0,
          originX,
          originY,
          preview.playerLight,
        );
        ctx.restore();
      }
    } finally {
      ctx.restore(); // pop the outer alpha save
    }

    // Re-draw the editor affordances above the darkness overlay so grid lines,
    // sign badges and the tile markers stay legible while previewing (FR-012).
    // Only when the preview is active, so the light frame is byte-for-byte the
    // pre-feature frame (FR-007, SC-004).
    if (showPreview) {
      drawGridLines(ctx, canvas.width, canvas.height, panOffset, zoom);
      drawSignBadges(ctx, grid, panOffset.x, panOffset.y, zoom);
      drawTileMarkers(
        ctx,
        grid,
        PATROL_CHAR,
        PATROL_MARKER_GLYPH,
        PATROL_MARKER_TINT,
        PATROL_MARKER_GLYPH_COLOR,
        panOffset.x,
        panOffset.y,
        zoom,
      );
      drawTileMarkers(
        ctx,
        grid,
        CONNECTION_POINT_CHAR,
        CONNECTION_POINT_MARKER_GLYPH,
        CONNECTION_POINT_MARKER_TINT,
        CONNECTION_POINT_MARKER_GLYPH_COLOR,
        panOffset.x,
        panOffset.y,
        zoom,
      );
    }

    // Outside the alpha block on purpose: a pending placement is the thing the
    // author is looking at, so it is drawn last and at full opacity even while
    // the background layer dims everything else.
    if (placement?.preview) {
      drawPlacementPreview(ctx, placement.preview, panOffset.x, panOffset.y, zoom);
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
  }, [grid, panOffset, images, canvasSize, backgroundGrid, activeLayer, placement, appearance, isBlueprintMode, zoom]);

  const cellFromEvent = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return {
      col: Math.floor((x - panOffset.x) / zoom / RENDERED_TILE_SIZE),
      row: Math.floor((y - panOffset.y) / zoom / RENDERED_TILE_SIZE),
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

    // An armed blueprint owns every remaining button, checked BEFORE the
    // background and paint branches so it can never paint a tile and preview at
    // the same time. Right-click cancels rather than erases: nothing is being
    // painted during a preview, so there is nothing to erase (design, Step 44c
    // — Placement). No `dragRef` is set, so a placement click starts no drag.
    if (placement) {
      if (event.button === 2) {
        placement.onCancel();
        return;
      }
      if (event.button !== 0) return;
      placement.onPlace(cellFromEvent(event.clientX, event.clientY));
      return;
    }

    if (activeLayer === 'background') {
      const { col, row } = cellFromEvent(event.clientX, event.clientY);
      const isErase = event.button === 2;
      const next = isErase
        ? eraseBackgroundCell(backgroundGrid, col, row)
        : selectedBackgroundMaterial
          ? paintBackgroundCell(backgroundGrid, col, row, selectedBackgroundMaterial)
          : backgroundGrid;
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

    // Middle-click panning is checked first because it is the one drag mode
    // that CAN coexist with an armed placement (handleMouseDown's button-1
    // branch runs before its placement check) — a room still needs to be
    // lined up against content off to the side while armed.
    if (drag?.mode === 'pan') {
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      dragRef.current = { ...drag, lastX: event.clientX, lastY: event.clientY };
      onPan(updatePanOffset(panOffset, dx, dy));
      return;
    }

    // An armed blueprint never sets any OTHER drag mode (see handleMouseDown
    // above), so this branch fully replaces the remaining drag-based logic
    // below while armed rather than needing to coexist with it.
    if (placement) {
      placement.onHover(cellFromEvent(event.clientX, event.clientY));
      return;
    }

    if (!drag) return;

    if (drag.mode === 'paintBackground') {
      const { col, row } = cellFromEvent(event.clientX, event.clientY);
      if (col === drag.lastCol && row === drag.lastRow) return;
      const next = drag.isErase
        ? eraseBackgroundCell(backgroundGrid, col, row)
        : selectedBackgroundMaterial
          ? paintBackgroundCell(backgroundGrid, col, row, selectedBackgroundMaterial)
          : backgroundGrid;
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

  // Separate from handleMouseUp (used for onMouseUp too): releasing a button
  // without the cursor leaving the canvas must not clear a live hover
  // preview, but the cursor actually leaving it must — nothing should stay
  // previewed at a position the mouse is no longer over.
  const handleMouseLeave = () => {
    handleMouseUp();
    if (placement) placement.onHover(null);
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    if (!onZoomChange) return;
    const direction = event.deltaY < 0 ? 1 : -1;
    const next = stepZoom(zoom, direction);
    if (next === zoom) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    onZoomChange(next, anchoredPan(panOffset, anchor, zoom, next));
  };

  const handleSliderZoom = (index: number) => {
    if (!onZoomChange) return;
    const next = ZOOM_LEVELS[index];
    if (next === zoom) return;
    const anchor = { x: canvasSize.width / 2, y: canvasSize.height / 2 };
    onZoomChange(next, anchoredPan(panOffset, anchor, zoom, next));
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
      {onZoomChange && (
        // `pointer-events-none` on the wrapper, re-enabled on each control:
        // the wrapper spans a wider box than the controls themselves, and
        // without this it swallowed clicks meant for the canvas cells beneath
        // that whole top-left corner.
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-2 rounded-md bg-background/80 px-2 py-1 shadow-sm">
          <span className="pointer-events-auto text-xs text-muted-foreground">Zoom</span>
          {/* The Slider's own root carries `data-horizontal:w-full`, which needs
              an ancestor with a definite width to resolve against — as a bare
              flex item it collapsed to just its thumb (~16px). This explicit,
              non-shrinking box is that ancestor. */}
          <div className="pointer-events-auto w-20 shrink-0">
            <Slider
              data-testid="editor-canvas-zoom"
              aria-label="Zoom level"
              min={0}
              max={ZOOM_LEVELS.length - 1}
              step={1}
              value={[ZOOM_LEVELS.indexOf(zoom)]}
              // base-ui hands a single-thumb slider's callback a plain NUMBER,
              // not an array — destructuring it as `([index])` threw
              // "number N is not iterable" inside the pointer handler, which
              // left click and drag doing nothing at all (only the wheel and
              // the keyboard worked). `value` above still has to be an array:
              // slider.tsx renders one thumb per entry and falls back to TWO
              // thumbs for a non-array value.
              onValueChange={(value) => handleSliderZoom(sliderZoomIndex(value))}
              className="w-full"
            />
          </div>
          <span
            data-testid="editor-canvas-zoom-value"
            className="pointer-events-auto w-10 text-right text-xs tabular-nums"
          >
            {Math.round(zoom * 100)}%
          </span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        data-testid="editor-canvas"
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute inset-0 block h-full w-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  );
};
