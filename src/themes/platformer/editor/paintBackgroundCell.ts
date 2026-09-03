import type { BackgroundPlacement, BackgroundPieceId } from '../level/LevelData';
import { backgroundCatalogEntry } from '../engine/BackgroundCatalog';

interface Cell {
  col: number;
  row: number;
}

function footprintCells(placement: BackgroundPlacement): Cell[] {
  const { widthTiles, heightTiles } = backgroundCatalogEntry(placement.pieceId);
  const cells: Cell[] = [];
  for (let dr = 0; dr < heightTiles; dr++) {
    for (let dc = 0; dc < widthTiles; dc++) {
      cells.push({ col: placement.col + dc, row: placement.row + dr });
    }
  }
  return cells;
}

function coversCell(placement: BackgroundPlacement, col: number, row: number): boolean {
  return footprintCells(placement).some((cell) => cell.col === col && cell.row === row);
}

function footprintsOverlap(a: BackgroundPlacement, b: BackgroundPlacement): boolean {
  const bCells = footprintCells(b);
  return footprintCells(a).some((cellA) => bCells.some((cellB) => cellA.col === cellB.col && cellA.row === cellB.row));
}

/** Stamps `pieceId` at `(col, row)`. Any existing placement whose footprint
 *  overlaps the new piece's footprint is removed first — the same silent
 *  overwrite-on-paint convention `paintCell.ts` uses for the foreground
 *  layer. */
export function placeBackgroundPiece(
  placements: readonly BackgroundPlacement[],
  pieceId: BackgroundPieceId,
  col: number,
  row: number,
): BackgroundPlacement[] {
  const next: BackgroundPlacement = { pieceId, col, row };
  const withoutOverlaps = placements.filter((existing) => !footprintsOverlap(existing, next));
  return [...withoutOverlaps, next];
}

/** Removes whichever placement's footprint contains `(col, row)`, regardless
 *  of which piece is currently selected — matching the foreground layer's
 *  right-click-always-erases convention. A no-op (same contents) if nothing
 *  covers that cell. */
export function eraseBackgroundCell(
  placements: readonly BackgroundPlacement[],
  col: number,
  row: number,
): BackgroundPlacement[] {
  return placements.filter((placement) => !coversCell(placement, col, row));
}
