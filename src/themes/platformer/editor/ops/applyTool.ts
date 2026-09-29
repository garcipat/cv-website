import { paintCell, type PaintResult } from './paintCell';
import {
  eraseMarkerCell,
  paintMarkerCell,
  paintSignMarker,
  paintTorchMarker,
  shiftMarkerGrid,
} from './paintMarkerCell';
import type { MarkerEntry, MarkerGrid } from '../../level/LevelData';
import type { TileChar } from '../../level/LevelParser';
import type { EditorTool } from '../editorState';

/**
 * The shared per-tool paint/marker op: what a canvas click writes
 * for a given tool, expressed once so the canvas and the ops cannot diverge.
 * Pure — it returns the paint result and/or marker grid for the caller to
 * write through `onPaint`/`onPaintMarker`; it never touches React.
 *
 * `paint` is `null` for a pure marker tool (patrol/connection) and `markers`
 * is `null` when the click writes no marker, so the caller emits exactly the
 * callbacks the old `EditorCanvas.applyToolAt` did.
 */
export interface ApplyToolResult {
  paint: PaintResult | null;
  markers: MarkerGrid | null;
  /** The (post-growth) cell a drag should remember. */
  target: { col: number; row: number };
}

/** The marker kinds a repaint clears: a marker that describes the tile it
 * sits on, rather than an independent overlay. `patrolBoundary` and
 * `connectionPoint` deliberately survive a repaint. */
const MARKER_REMOVED_ON_REPAINT: ReadonlySet<MarkerEntry['kind']> = new Set([
  'sign',
  'fallingStalactite',
  'torch',
]);

/** Whether repainting this marker's own cell clears the marker. */
export function markerRemovedOnRepaint(kind: MarkerEntry['kind']): boolean {
  return MARKER_REMOVED_ON_REPAINT.has(kind);
}

/** Erases `(col, row)`'s marker only when one is present — preserving the
 * old "no marker write when there was nothing to clear" no-op. */
function eraseMarkerIfPresent(markers: MarkerGrid, col: number, row: number): MarkerGrid | null {
  return markers[row]?.[col] ? eraseMarkerCell(markers, col, row) : null;
}

/**
 * Applies `tool` at `(col, row)`.
 *
 * - Pure marker tools (`patrolBoundary`/`connectionPoint`) write only the
 * marker grid (never grown) and produce no paint.
 * - The sign (`T`) and falling-stalactite tools write their terrain character
 * plus their own marker at the post-growth coordinates; erasing them clears
 * the terrain and whatever marker was on the cell.
 * - The torch (`¥`) tool lays a default torch on a fresh click and cycles an
 * already-placed one's strength; erasing clears terrain + marker.
 * - Every other tool paints its character, and clears a marker on the cell
 * that describes the tile (sign/fallingStalactite/torch) or any marker on an
 * erase gesture — a `patrolBoundary`/`connectionPoint` survives a repaint.
 */
export function applyTool(
  grid: TileChar[][],
  markers: MarkerGrid,
  col: number,
  row: number,
  tool: EditorTool,
  isErase: boolean,
): ApplyToolResult {
  if (tool === 'patrolBoundary' || tool === 'connectionPoint') {
    return {
      paint: null,
      markers: isErase
        ? eraseMarkerCell(markers, col, row)
        : paintMarkerCell(markers, col, row, { kind: tool }),
      target: { col, row },
    };
  }

  if (tool === 'T' || tool === 'fallingStalactite') {
    // Right-click removes the whole cell — the terrain character AND whatever
    // marker is on it, not just this tool's own kind.
    if (isErase) {
      return {
        paint: paintCell(grid, col, row, '.'),
        markers: eraseMarkerIfPresent(markers, col, row),
        target: { col, row },
      };
    }
    const result = paintCell(grid, col, row, tool === 'T' ? 'T' : '⊤');
    const targetCol = col + result.colShift;
    const targetRow = row + result.rowShift;
    const shifted = shiftMarkerGrid(markers, result.colShift, result.rowShift);
    return {
      paint: result,
      markers:
        tool === 'T'
          ? paintSignMarker(shifted, targetCol, targetRow)
          : paintMarkerCell(shifted, targetCol, targetRow, { kind: 'fallingStalactite' }),
      target: { col: targetCol, row: targetRow },
    };
  }

  if (tool === '¥') {
    if (isErase) {
      return {
        paint: paintCell(grid, col, row, '.'),
        markers: eraseMarkerIfPresent(markers, col, row),
        target: { col, row },
      };
    }
    const alreadyTorch = grid[row]?.[col] === '¥';
    const result = paintCell(grid, col, row, '¥');
    const targetCol = col + result.colShift;
    const targetRow = row + result.rowShift;
    // Only cycle on an already-placed torch: a fresh click lays a default
    // torch (no marker), and the next clicks step its strength up 0–9.
    return {
      paint: result,
      markers: alreadyTorch
        ? paintTorchMarker(
            shiftMarkerGrid(markers, result.colShift, result.rowShift),
            targetCol,
            targetRow,
          )
        : null,
      target: { col: targetCol, row: targetRow },
    };
  }

  const result = paintCell(grid, col, row, isErase ? '.' : tool);
  const existing = markers[row]?.[col];
  const clearsCell = isErase || tool === '.';
  return {
    paint: result,
    markers:
      existing && (clearsCell || markerRemovedOnRepaint(existing.kind))
        ? eraseMarkerCell(markers, col, row)
        : null,
    target: { col: col + result.colShift, row: row + result.rowShift },
  };
}
