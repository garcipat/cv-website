import { importLayout } from './importLayout';
import type { TileChar } from '../level/LevelParser';

/** One cell of a blueprint, positioned relative to the blueprint's own
 *  top-left corner — the anchor a placement adds to (see `placeBlueprint`). */
export interface BlueprintCell {
  row: number;
  col: number;
  char: TileChar;
}

const EMPTY_CHAR: TileChar = '.';

/**
 * Every cell of a blueprint's `layout` that actually holds something, parsed
 * through the same `importLayout` the editor already uses for a level (so a
 * jagged layout is right-padded with `'.'` exactly as `parseLevel` would pad
 * it, and this is well defined for anything `exportLayout` can produce).
 *
 * `'.'` cells are dropped rather than returned as "empty": they are the crop's
 * bounding-box padding around the room's shape, not an instruction to clear a
 * cell. They are therefore never checked for overlap (`blueprintFit.ts`) and
 * never written (`placeBlueprint.ts`), which is what makes placing a room
 * incapable of blanking out terrain the target level already had there.
 */
export const blueprintCells = (layout: readonly string[]): readonly BlueprintCell[] => {
  const grid = importLayout(layout);
  const cells: BlueprintCell[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const char = grid[row][col];
      if (char !== EMPTY_CHAR) cells.push({ row, col, char });
    }
  }
  return cells;
};
