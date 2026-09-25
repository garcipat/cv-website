import { TERRAIN_CHARS, type TileChar } from '../level/LevelParser';
import { RENDERED_TILE_SIZE, tileToPixel } from '../level/Terrain';
import type { MarkerGrid } from '../level/LevelData';
import { DEFAULT_TORCH_STRENGTH, torchLightSource } from '../entities/Torch';
import type { TorchLight } from '../entities/Torch';
import type { LightSource } from '../contracts/lighting';
import { playerLightSource } from '../entities/Player';
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
 * The inputs the engine's cave-lighting draw passes need for the editor's
 * dark-mode preview (O-015 US3). Pure, derived, and stored nowhere. The lights
 * are the shared `LightSource` list both passes consume; the spawn only
 * supplies its carried light and never decides *whether* the scene darkens.
 */
export interface CaveLightingPreview {
  /** Always `EDITOR_PREVIEW_DARKNESS` while the preview is active (FR-013). */
  darknessLevel: number;
  /** Wall torches at `t = 0` plus the spawn's carried light when one exists. */
  lights: LightSource[];
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
  // Resolve torch radii at `worldElapsed = 0`, matching the editor's static
  // preview frame (FR-013).
  const lights: LightSource[] = torchLightsFromGrid(grid, markers).map((torch) =>
    torchLightSource(torch, 0),
  );
  if (player) lights.push(playerLightSource(player));
  return {
    darknessLevel: EDITOR_PREVIEW_DARKNESS,
    lights,
  };
}
