import type { BlockType } from './BlockType';
import type { BlockState } from '../Block';
import type { DrawContext } from '../../engine/DrawContext';
import { STATIC_OBJECTS_SHEET } from '../sprites/sheets';
import { RENDERED_TILE_SIZE, RENDER_SCALE } from '../../level/Terrain';
import { blockBumpOffsetY } from '../../engine/BlockAI';
import { clayVariantAt, drawClayPotAt } from './clayVariants';
import { createPotType } from './pot';

/**
 * Rendered px to shrink the solid hitbox by on each side (see
 * `BlockType.hitboxInsetX`'s doc comment). Measured directly from the 3
 * variant sprites' actual drawn pixels within their native 16x16 tile: the
 * narrowest (small pot) leaves ~3px of transparent margin on each side, the
 * widest (square pot) ~2px — 3px native * RENDER_SCALE (2) = 6 rendered px
 * is a single value close to every variant's real margin, used regardless
 * of which variant a given instance happens to render as (the displayed
 * variant is decided per-frame from the tile's own position, not fixed per
 * block, so the hitbox can't reasonably vary with it).
 */
const HITBOX_INSET_X = 3 * RENDER_SCALE;

/**
 * The coin pot: a clay jar destroyed by landing on it, dropping one coin.
 * Declares only its kind-specific facts — marker, sprite, drop, drop policy,
 * respawn flag and its single-pot draw — and inherits collision, the
 * land-on-top trigger, the shared bounce and one-hit removal from
 * `createPotType` (FR-001/FR-002).
 */
export const coinPot: BlockType = createPotType({
  key: 'coinPot',
  sprite: { sheet: STATIC_OBJECTS_SHEET, renderScale: 1, animations: {} },
  drop: 'coin',
  // A coin pot pays out once per session: `PlatformerPage.tsx` marks the
  // instance's `rewardGiven` when the coin is handed out, and the factory's
  // `onHit` gate never drops a second coin (FR-017).
  dropPolicy: 'once',
  restoredOnRespawn: false,
  hitboxInsetX: HITBOX_INSET_X,
  // Only a generic fallback for callers outside draw (e.g. blockFrameSource)
  // — the real per-instance variant is the tile's own positional
  // `clayVariantAt` value, drawn below.
  frameIndex: () => 0,
  drawPot: (block: BlockState, dc: DrawContext) => {
    const col = Math.round(block.x / RENDERED_TILE_SIZE);
    const row = Math.round(block.y / RENDERED_TILE_SIZE);
    drawClayPotAt(dc, block.x, block.y, clayVariantAt(col, row), blockBumpOffsetY(block));
  },
});
