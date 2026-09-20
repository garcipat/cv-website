import { useCallback, useEffect, useState } from 'react';
import { EditorCanvas, type EditorImages } from './EditorCanvas';
import { updatePanOffset, type PanOffset } from './EditorPan';
import { findBlueprint } from '../level/blueprintRegistry';
import { blueprintCells } from './blueprintCells';
import { blueprintFits } from './blueprintFit';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { loadImage } from '../engine/SpriteLoader';
import { CHECKPOINT_FLAG_SHEET } from '../entities/Checkpoint';
import {
  TERRAIN_BACKGROUND_SHEET,
  STATIC_OBJECTS_SHEET,
  DECORATIONS_SHEET,
  TORCH_SHEET,
  ROPE_LADDER_SHEET,
} from '../entities/sprites/sheets';
import {
  applyBackgroundPaint,
  applyPaint,
  armBlueprint,
  commitPlacement,
  undoLastPlacement,
  type GrowthShift,
} from './editorActions';
import type { EditorLayer, PlacementSnapshot } from './editorState';
import type { BackgroundPlacement, BackgroundPieceId } from '../level/LevelData';
import type { TileChar } from '../level/LevelParser';

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
  checkpoint: null,
  backgroundAtlas: null,
  staticObjects: null,
  decorations: null,
  torch: null,
  ropeLadder: null,
};

const IMAGE_SOURCES: { key: keyof EditorImages; src: string }[] = [
  { key: 'tileset', src: '/sprites/world_tileset.png' },
  { key: 'groundAtlas', src: '/sprites/tile_atlas.png' },
  { key: 'player', src: '/sprites/knight.png' },
  { key: 'coin', src: '/sprites/coin.png' },
  { key: 'fruit', src: '/sprites/fruit.png' },
  { key: 'slimeGreen', src: '/sprites/slime_green.png' },
  { key: 'slimePurple', src: '/sprites/slime_purple.png' },
  { key: 'crackOverlay', src: '/sprites/crack_overlay.png' },
  { key: 'chestClosed', src: '/sprites/chest_closed.png' },
  { key: 'checkpoint', src: CHECKPOINT_FLAG_SHEET.src },
  { key: 'backgroundAtlas', src: TERRAIN_BACKGROUND_SHEET.src },
  { key: 'staticObjects', src: STATIC_OBJECTS_SHEET.src },
  { key: 'decorations', src: DECORATIONS_SHEET.src },
  { key: 'torch', src: TORCH_SHEET.src },
  { key: 'ropeLadder', src: ROPE_LADDER_SHEET.src },
];

export interface EditorCanvasPaneProps {
  isBlueprintMode: boolean;
  grid: TileChar[][];
  backgroundPlacements: BackgroundPlacement[];
  selectedTool: TileChar;
  activeLayer: EditorLayer;
  selectedBackgroundPiece: BackgroundPieceId | null;
  armedBlueprintId: string | null;
  centerRequestId: number;
  lastPlacementSnapshot: PlacementSnapshot | null;
}

/**
 * Container that wires the editor values into the presentational
 * `EditorCanvas` (FR-015). It owns only the transient interaction state
 * FR-019 carves out — the per-canvas pan offset, the hovered cell and the
 * loaded sprite images — and delegates every mutation to `editorActions`.
 */
export const EditorCanvasPane = ({
  isBlueprintMode,
  grid,
  backgroundPlacements,
  selectedTool,
  activeLayer,
  selectedBackgroundPiece,
  armedBlueprintId,
  centerRequestId,
  lastPlacementSnapshot,
}: EditorCanvasPaneProps) => {
  const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const [blueprintPanOffset, setBlueprintPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  // The hovered cell carries the (armed id, center request) key it was captured
  // under. A change of what is armed, or a fresh centering request (e.g. a
  // level load), invalidates the stale hover without an effect or an extra
  // render: the derived `activeHover` simply reads as no hover until the next
  // mouse move re-stamps it with the current key.
  const hoverResetKey = `${armedBlueprintId ?? ''}|${centerRequestId}`;
  const [hoveredCell, setHoveredCell] = useState<{
    key: string;
    col: number;
    row: number;
  } | null>(null);
  const activeHover = hoveredCell !== null && hoveredCell.key === hoverResetKey ? hoveredCell : null;
  const [images, setImages] = useState<EditorImages>(EMPTY_IMAGES);

  const activePanOffset = isBlueprintMode ? blueprintPanOffset : panOffset;
  const setActivePanOffset = isBlueprintMode ? setBlueprintPanOffset : setPanOffset;

  useEffect(() => {
    IMAGE_SOURCES.forEach(({ key, src }) => {
      loadImage(src)
        .then((img) => setImages((prev) => ({ ...prev, [key]: img })))
        .catch(() => {});
    });
  }, []);

  /** Moves the active pan by the negative of a grid growth so existing content
   *  does not visually move (spec SC-006). */
  const compensateForGrowth = useCallback(
    (shift: GrowthShift | null) => {
      if (shift === null || (shift.colShift === 0 && shift.rowShift === 0)) return;
      setActivePanOffset((prev) =>
        updatePanOffset(prev, -shift.colShift * RENDERED_TILE_SIZE, -shift.rowShift * RENDERED_TILE_SIZE),
      );
    },
    // `setActivePanOffset` is a state setter chosen from the active mode; the
    // shift itself is the only meaningful input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isBlueprintMode],
  );

  const armedBlueprint =
    armedBlueprintId === null ? null : (findBlueprint(armedBlueprintId) ?? null);
  const armedCells = armedBlueprint === null ? null : blueprintCells(armedBlueprint.layout);

  const placementActive = !isBlueprintMode && activeLayer === 'foreground' && armedCells !== null;
  const placementPreview =
    placementActive && armedCells !== null && activeHover !== null
      ? {
          cells: armedCells.map(({ row, col, char }) => ({
            row: row + activeHover.row,
            col: col + activeHover.col,
            char,
          })),
          valid: blueprintFits(grid, armedCells, activeHover.col, activeHover.row),
        }
      : null;

  const handlePlacementClick = useCallback(
    ({ col, row }: { col: number; row: number }) => {
      compensateForGrowth(commitPlacement(col, row));
    },
    [compensateForGrowth],
  );

  // Ctrl+Z (Cmd+Z on Mac) is the same "Undo placement" the button offers.
  // Ignored while typing in a text field and while the blueprint canvas is
  // active, matching the button's own Level-only visibility.
  useEffect(() => {
    if (isBlueprintMode || lastPlacementSnapshot === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'z' && event.key !== 'Z') return;
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      undoLastPlacement();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBlueprintMode, lastPlacementSnapshot]);

  return (
    <div data-testid="editor-canvas-pane" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <EditorCanvas
        grid={grid}
        selectedTool={selectedTool}
        panOffset={activePanOffset}
        images={images}
        centerRequestId={centerRequestId}
        backgroundPlacements={backgroundPlacements}
        activeLayer={activeLayer}
        selectedBackgroundPiece={selectedBackgroundPiece}
        placement={
          placementActive
            ? {
                preview: placementPreview,
                onHover: (cell) =>
                  setHoveredCell(
                    cell === null ? null : { key: hoverResetKey, col: cell.col, row: cell.row },
                  ),
                onPlace: handlePlacementClick,
                onCancel: () => armBlueprint(null),
              }
            : null
        }
        onPaintBackground={(next) => applyBackgroundPaint(next)}
        onPaint={(result) => compensateForGrowth(applyPaint(result))}
        onPan={setActivePanOffset}
      />
    </div>
  );
};
