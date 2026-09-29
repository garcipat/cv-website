import { RENDERED_TILE_SIZE, TILE_SIZE } from '../level/Terrain';
import { pickVariant } from '../shared/variants';
import type { StaticObjectEntry } from './spriteRects';
import type { TileDrawContext, TileModule } from './TileModule';

/**
 * `fence` — the fixed fence decoration (`N`). Non-solid, non-climbable, fogged;
 * drawn in the terrain band. Owns the fence variant table + lookup relocated
 * from `engine/StaticObjectsCatalog.ts`.
 */

const FENCE_VARIANTS: StaticObjectEntry[] = [{ sx: 32, sy: 64 }];

/** The fence sprite for a cell — one variant today, still routed through the
 * deterministic position hash so a second variant is a one-line addition. */
export function fenceEntry(col: number, row: number): StaticObjectEntry {
  return pickVariant(FENCE_VARIANTS, col, row);
}

function draw(rc: TileDrawContext): void {
  const { ctx, col, row, destX, destY, images } = rc;
  const staticObjects = images.staticObjects;
  if (!staticObjects) return;
  const entry = fenceEntry(col, row);
  ctx.drawImage(
    staticObjects,
    entry.sx,
    entry.sy,
    TILE_SIZE,
    TILE_SIZE,
    destX,
    destY,
    RENDERED_TILE_SIZE,
    RENDERED_TILE_SIZE,
  );
}

export const fenceModule = {
  char: 'N',
  fogExempt: false,
  drawBand: 'terrain',
  draw,
} as const satisfies TileModule;
