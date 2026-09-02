import type { BlockState } from '../Block';
import { blockBumpOffsetY } from '../../engine/BlockAI';
import { frameSource } from '../sprites/SpriteSheet';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';
import { TILE_SIZE, RENDERED_TILE_SIZE } from '../../level/Terrain';
import type { DrawContext } from '../../engine/DrawContext';

/**
 * The plain shared-tileset blit common to every block kind: the given frame
 * index of `world_tileset.png`, at full opacity, with the shared bump nudge
 * offset applied. `frameIndex` is the caller's own frame for the block's
 * current `hitsTaken` (each kind knows its own — see `BlockType.frameIndex`),
 * kept as a parameter rather than looked up here so this module never
 * value-imports from `../Block` (which would close the `Block.ts ->
 * blocks/index.ts -> this module` load cycle). Skips drawing entirely if the
 * tileset image hasn't loaded yet.
 *
 * Crate.ts does not call this — its base tile draws through the same
 * `world_tileset.png`/bump-offset math, but wrapped in a caller-supplied
 * opacity and followed by its crack overlay, so it keeps its own copy rather
 * than forcing that through this shared signature.
 */
export function drawBlockTile(block: BlockState, dc: DrawContext, frameIndex: number): void {
  const image = dc.sprites[WORLD_TILESET_SHEET.src];
  if (!image) return;

  const { sx, sy } = frameSource(WORLD_TILESET_SHEET, frameIndex);
  const dx = block.x + dc.originX;
  const dy = block.y + dc.originY + blockBumpOffsetY(block);

  dc.ctx.drawImage(image, sx, sy, TILE_SIZE, TILE_SIZE, dx, dy, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
}
