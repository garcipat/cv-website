import type { TileChar } from '../../level/LevelParser';
import { TERRAIN_CHARS } from '../../tiles/registry';
import type { MarkerGrid } from '../../level/LevelData';
import { torchLightSource } from '../../tiles/torch';
import type { TorchLight } from '../../tiles/torch';
import { placeTorches } from '../../level/TorchMapper';
import type { LightSource } from '../../contracts/lighting';
import { playerLightSource } from '../../entities/Player';
import { previewPlayerState } from './previewPlacements';
import { gridToLayout } from './gridLayout';

/**
 * How dark the editor's cave preview gets. Deliberately lighter than the game's
 * `MAX_DARKNESS` (≈ 0.97): in play the camera follows the player, so their
 * carried light is always on screen, while the editor's viewport can sit away
 * from any light — at the game's full darkness the level would read as a black
 * rectangle. Preview-only; it never changes the in-game darkness.
 */
export const EDITOR_PREVIEW_DARKNESS = 0.82;

/**
 * The inputs the engine's cave-lighting draw passes need for the editor's
 * dark-mode preview. Pure, derived, and stored nowhere. The lights
 * are the shared `LightSource` list both passes consume; the spawn only
 * supplies its carried light and never decides *whether* the scene darkens.
 */
export interface CaveLightingPreview {
  /** Always `EDITOR_PREVIEW_DARKNESS` while the preview is active. */
  darknessLevel: number;
  /** Wall torches at `t = 0` plus the spawn's carried light when one exists. */
  lights: LightSource[];
}

/**
 * One light per `torch` terrain tile. The tile scan stays here (the editor
 * owns its `TileChar[][]`), but the placement maths and the strength rule come
 * from the one shared `placeTorches` mapper the state layer's `torchPositions`
 * also consumes — so the preview's lights and the game's can never disagree.
 * Pure, never mutating its arguments.
 */
export function torchLightsFromGrid(grid: TileChar[][], markers?: MarkerGrid): TorchLight[] {
  const torchCells: Array<{ col: number; row: number }> = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (TERRAIN_CHARS[grid[row][col]] !== 'torch') continue;
      torchCells.push({ col, row });
    }
  }
  return placeTorches(torchCells, { markers });
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
  const player = previewPlayerState(gridToLayout(grid));
  // Resolve torch radii at `worldElapsed = 0`, matching the editor's static
  // preview frame.
  const lights: LightSource[] = torchLightsFromGrid(grid, markers).map((torch) =>
    torchLightSource(torch, 0),
  );
  if (player) lights.push(playerLightSource(player));
  return {
    darknessLevel: EDITOR_PREVIEW_DARKNESS,
    lights,
  };
}
