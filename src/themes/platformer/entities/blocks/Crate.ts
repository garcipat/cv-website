import type { BlockType } from './BlockType';
import type { BlockState } from '../Block';
import { frameSource } from '../sprites/SpriteSheet';
import { WORLD_TILESET_SHEET, CRACK_OVERLAY_SHEET } from '../sprites/sheets';
import { TILE_SIZE, RENDERED_TILE_SIZE } from '../../level/Terrain';
import { blockBumpOffsetY, CRATE_SHATTER_DURATION_SECONDS } from '../../engine/BlockAI';

/** Row 3, column 7 of the shared tileset. */
const CRATE_FRAME = 55;

/** Whether a crate's cracked-overlay sprite (`crack_overlay.png`) should be
 *  composited over its base tile — only between its first hit (cracked) and
 *  second hit (shattered/removed), never on an intact or fully-broken
 *  crate. */
export function crateCrackOverlayVisible(hitsTaken: number): boolean {
  return hitsTaken === 1;
}

/**
 * Opacity (0-1) to draw a crate at — 1 (fully opaque) unless it's currently
 * `'shatter'`ing, in which case it linearly fades to 0 over
 * `CRATE_SHATTER_DURATION_SECONDS`.
 */
export function crateShatterOpacity(block: BlockState): number {
  if (block.animState !== 'shatter') return 1;
  return Math.max(0, 1 - block.animTimer / CRATE_SHATTER_DURATION_SECONDS);
}

export const crate: BlockType = {
  key: 'crate',
  sprite: { sheet: WORLD_TILESET_SHEET, renderScale: 1, animations: {} },
  // Two hits: the first cracks it, the second shatters it.
  maxHits: 2,
  removeWhenUsedUp: true,
  frameIndex: () => CRATE_FRAME,
  // Its own copy of the plain blit (see drawBlockTile.ts's doc comment for
  // why this isn't shared) — wrapped in the shatter opacity, plus the crack
  // overlay composited at the same position when cracked. crack_overlay.png
  // is a standalone sprite, not part of world_tileset.png, so it's drawn as
  // a second, separate drawImage call.
  draw: (block, dc) => {
    const image = dc.sprites[WORLD_TILESET_SHEET.src];
    if (!image) return;

    const { sx, sy } = frameSource(WORLD_TILESET_SHEET, CRATE_FRAME);
    const dx = block.x + dc.originX;
    const dy = block.y + dc.originY + blockBumpOffsetY(block);

    dc.ctx.globalAlpha = crateShatterOpacity(block);
    dc.ctx.drawImage(image, sx, sy, TILE_SIZE, TILE_SIZE, dx, dy, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);

    const overlayImage = dc.sprites[CRACK_OVERLAY_SHEET.src];
    if (overlayImage && crateCrackOverlayVisible(block.hitsTaken)) {
      dc.ctx.drawImage(overlayImage, 0, 0, TILE_SIZE, TILE_SIZE, dx, dy, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
    }
    dc.ctx.globalAlpha = 1;
  },
};
