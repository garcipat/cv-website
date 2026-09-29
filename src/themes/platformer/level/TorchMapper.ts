import { tileToPixel, RENDERED_TILE_SIZE } from './Terrain';
import { DEFAULT_TORCH_STRENGTH, type TorchLight } from '../tiles/torch';
import type { MarkerGrid } from './LevelData';

/**
 * One torch light source: the tile it sits in, its world-space centre and its
 * light strength. The same shape the render pass's darkness/eye passes consume
 * (`tiles/torch.ts`'s `TorchLight`), typed here so both the state layer's
 * `torchPositions` and the editor's cave-lighting preview speak the same
 * vocabulary instead of re-deriving it.
 */
export type TorchPlacement = TorchLight;

/**
 * The one torch mapper: turns the level's torch tiles plus its marker layer
 * into typed placements, in input order. A cell's `torch` marker supplies its
 * strength (`parseLevel`'s already-clamped value, consumed rather than
 * re-normalised); a missing marker or any other marker kind yields
 * `DEFAULT_TORCH_STRENGTH` and never an error. No placement carries an `id` —
 * a torch is a pure level feature, not a live entity.
 *
 * Pure and argument-preserving: it reads its inputs and allocates only the
 * result, so callers on both sides of the layer boundary share exactly one
 * derivation and cannot drift.
 */
export function placeTorches(
  torchTiles: readonly { col: number; row: number }[],
  level: { markers?: MarkerGrid },
): TorchPlacement[] {
  return torchTiles.map(({ col, row }) => {
    const { x, y } = tileToPixel(col, row);
    const marker = level.markers?.[row]?.[col] ?? null;
    return {
      col,
      row,
      x: x + RENDERED_TILE_SIZE / 2,
      y: y + RENDERED_TILE_SIZE / 2,
      strength: marker?.kind === 'torch' ? marker.strength : DEFAULT_TORCH_STRENGTH,
    };
  });
}
