import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { TileChar } from '../level/LevelParser';

/**
 * Editor-only 2D pan state, driven by right-mouse-button drag. Unrelated to
 * the game's `engine/Camera.ts` (a 1D auto-follow-the-player behavior) —
 * kept in its own module so the two are never confused or coupled.
 */
const SPAWN_CHAR: TileChar = 'S';

export interface PanOffset {
  x: number;
  y: number;
}

export function updatePanOffset(current: PanOffset, dx: number, dy: number): PanOffset {
  return { x: current.x + dx, y: current.y + dy };
}

/**
 * The pan offset that puts the grid's spawn tile in the middle of a canvas
 * of the given size — what the editor opens on, and what Reset/Scratch
 * return to, so the view always starts where the level itself starts rather
 * than at whatever the grid's top-left corner happens to hold. Centers the
 * tile's CENTER, not its corner, so the player sprite lands on the canvas
 * midpoint instead of half a tile off it.
 *
 * A spawn-less grid falls back to the unpanned origin: the marker can be
 * erased and not yet repainted mid-edit, and centering on nothing would
 * otherwise produce NaN offsets that blank the canvas.
 */
export function centerPanOnSpawn(
  grid: TileChar[][],
  canvasWidth: number,
  canvasHeight: number,
): PanOffset {
  for (let row = 0; row < grid.length; row++) {
    const col = grid[row].indexOf(SPAWN_CHAR);
    if (col === -1) continue;
    return {
      x: canvasWidth / 2 - (col + 0.5) * RENDERED_TILE_SIZE,
      y: canvasHeight / 2 - (row + 0.5) * RENDERED_TILE_SIZE,
    };
  }
  return { x: 0, y: 0 };
}
