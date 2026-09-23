import { TERRAIN_CHARS, type TileChar } from '../level/LevelParser';
import { RENDERED_TILE_SIZE, tileToPixel } from '../level/Terrain';
import type { MarkerGrid } from '../level/LevelData';
import { DEFAULT_TORCH_STRENGTH } from '../engine/Torch';
import { type Point, type TorchLight } from '../engine/Lighting';
import { heldTorchLightPosition } from '../engine/Renderer';
import { synthesizePlayerState } from './gridRenderState';

/**
 * How dark the editor's cave preview gets. Deliberately lighter than the game's
 * `MAX_DARKNESS` (≈ 0.97): in play the camera follows the player, so their
 * carried light is always on screen, while the editor's viewport can sit away
 * from any light — at the game's full darkness the level would read as a black
 * rectangle. Preview-only; it never changes the in-game darkness (O-015 FR-016).
 */
export const EDITOR_PREVIEW_DARKNESS = 0.82;

/**
 * The three inputs the engine's cave-lighting draw passes need for the
 * editor's dark-mode preview (O-015 US3). Pure, derived, and stored nowhere.
 */
export interface CaveLightingPreview {
  /** Always `EDITOR_PREVIEW_DARKNESS` while the preview is active (FR-013). */
  darknessLevel: number;
  /** One light per `torch` terrain tile in the grid, at its world centre. */
  torches: TorchLight[];
  /** The spawn player's carried light, or `null` when there is no spawn. */
  playerLight: Point | null;
}

/**
 * One light per `torch` terrain tile, at `tileToPixel` + half a rendered tile —
 * the same conversion `PlatformerState`'s `torchPositions` uses. Each light's
 * strength is its `torch` marker's value, or `DEFAULT_TORCH_STRENGTH` when it
 * carries none. A pure scan of the editor's `TileChar[][]` (O-015 D6), never
 * mutating its arguments.
 */
export function torchLightsFromGrid(grid: TileChar[][], markers?: MarkerGrid): TorchLight[] {
  const torches: TorchLight[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (TERRAIN_CHARS[grid[row][col]] !== 'torch') continue;
      const { x, y } = tileToPixel(col, row);
      const marker = markers?.[row]?.[col];
      torches.push({
        col,
        row,
        x: x + RENDERED_TILE_SIZE / 2,
        y: y + RENDERED_TILE_SIZE / 2,
        strength: marker?.kind === 'torch' ? marker.strength : DEFAULT_TORCH_STRENGTH,
      });
    }
  }
  return torches;
}

/**
 * The preview inputs for the current grid, recomputed on every edit/toggle.
 *
 * Dark mode always previews the cave as if the player were underground: the
 * scene is darkened to `EDITOR_PREVIEW_DARKNESS`, every wall torch punches a
 * warm light pool through it, and the spawn's carried light keeps the player
 * discernible. The spawn only supplies that carried light — its position no
 * longer decides *whether* the scene darkens. Pure and never throws.
 */
export function caveLightingPreview(grid: TileChar[][], markers?: MarkerGrid): CaveLightingPreview {
  const player = synthesizePlayerState(grid);
  return {
    darknessLevel: EDITOR_PREVIEW_DARKNESS,
    torches: torchLightsFromGrid(grid, markers),
    playerLight: player ? heldTorchLightPosition(player) : null,
  };
}
