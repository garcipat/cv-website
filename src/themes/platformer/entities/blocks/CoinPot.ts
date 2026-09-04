import type { BlockType } from './BlockType';
import type { BlockState } from '../Block';
import type { DrawContext } from '../../engine/DrawContext';
import { STATIC_OBJECTS_SHEET } from '../sprites/sheets';
import { TILE_SIZE, RENDERED_TILE_SIZE, RENDER_SCALE } from '../../level/Terrain';
import { blockBumpOffsetY } from '../../engine/BlockAI';
import { permutationForColumn } from './coinPotRenderPlan';

/** Native tile column of each single-pot sprite on `staticObjects.png`'s row
 *  7 (16px tiles): 0=small round jar, 1=tall narrow urn, 2=wide square brick
 *  urn. The 2-tile-wide "cluster" sprite at row 8 is deliberately unused —
 *  see this step's plan for how these were located on the sheet and why. */
const VARIANT_TILE_COLUMNS: readonly number[] = [0, 1, 2];
const VARIANT_ROW = 7;

/**
 * Rendered px to shrink the solid hitbox by on each side (see
 * `BlockType.hitboxInsetX`'s doc comment). Measured directly from the 3
 * variant sprites' actual drawn pixels within their native 16x16 tile: the
 * narrowest (small pot) leaves ~3px of transparent margin on each side, the
 * widest (square pot) ~2px — 3px native * RENDER_SCALE (2) = 6 rendered px
 * is a single value close to every variant's real margin, used regardless
 * of which variant a given instance happens to render as (the displayed
 * variant is decided per-frame by `computeCoinPotRenderPlan`, not fixed per
 * block, so the hitbox can't reasonably vary with it).
 */
const HITBOX_INSET_X = 3 * RENDER_SCALE;

function drawVariantAt(dc: DrawContext, x: number, y: number, variantIndex: number, bumpOffsetY = 0): void {
  const image = dc.sprites[STATIC_OBJECTS_SHEET.src];
  if (!image) return;
  const sx = VARIANT_TILE_COLUMNS[variantIndex] * TILE_SIZE;
  const sy = VARIANT_ROW * TILE_SIZE;
  dc.ctx.drawImage(
    image,
    sx,
    sy,
    TILE_SIZE,
    TILE_SIZE,
    x + dc.originX,
    y + dc.originY + bumpOffsetY,
    RENDERED_TILE_SIZE,
    RENDERED_TILE_SIZE,
  );
}

export const coinPot: BlockType = {
  key: 'coinPot',
  sprite: { sheet: STATIC_OBJECTS_SHEET, renderScale: 1, animations: {} },
  maxHits: 1,
  removeWhenUsedUp: true,
  hitboxInsetX: HITBOX_INSET_X,
  // Only a generic fallback for callers outside draw (e.g. blockFrameSource)
  // — the real per-instance variant comes from dc.coinPotPlan inside draw.
  frameIndex: () => 0,
  draw: (block: BlockState, dc: DrawContext) => {
    const plan = dc.coinPotPlan;
    const variant = plan?.variantByBlockId.get(block.id);
    if (variant === undefined) {
      // Not part of the live plan — either dc.coinPotPlan wasn't provided
      // (a test drawing this block in isolation), or this instance is
      // mid-bump/shatter after being hit (computeCoinPotRenderPlan excludes
      // a used-up block immediately, before it's actually removed from the
      // world). Either way, draw itself alone with a deterministic
      // fallback variant, same column-seeded permutation an isolated pot
      // would use.
      const col = Math.round(block.x / RENDERED_TILE_SIZE);
      drawVariantAt(dc, block.x, block.y, permutationForColumn(col)[0], blockBumpOffsetY(block));
      return;
    }
    // Only a run's leftmost block ("owner") actually draws — it draws
    // every base pot in its run (each with its OWN bump offset) plus every
    // filler, so a whole run renders from one draw() call regardless of
    // which tile the caller happens to be iterating.
    if (plan!.ownerBlockId.get(block.id) !== block.id) return;
    const run = plan!.runsByOwnerId.get(block.id);
    if (!run) return;
    for (const member of run.blocks) {
      const memberVariant = plan!.variantByBlockId.get(member.id) ?? 0;
      drawVariantAt(dc, member.x, member.y, memberVariant, blockBumpOffsetY(member));
    }
    for (const filler of run.fillers) {
      drawVariantAt(dc, filler.x, filler.y, filler.variantIndex);
    }
  },
};
