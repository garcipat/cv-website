import { RENDERED_TILE_SIZE, TILE_SIZE, cobwebOrientation } from '../level/Terrain';
import type { StaticObjectEntry } from './spriteRects';
import type { TileDrawContext, TileModule } from './TileModule';

/**
 * `cobweb` — the corner/flat cave-web decoration (`X`). Non-solid,
 * non-climbable, fogged; drawn in the terrain band. Owns the two web entries +
 * the orientation draw relocated from `engine/StaticObjectsCatalog.ts`/
 * `engine/Renderer.ts` (US4/T032).
 */

/**
 * The corner and flat cobweb sprites, from `decorations.png`. Which of the two
 * draws is NOT picked from position hash — it's driven entirely by
 * `cobwebOrientation` (does this cell sit in a corner formed by two adjacent
 * solid neighbours?), so each is kept as its own named single entry rather than
 * routed through `pickVariant`.
 */
export const COBWEB_CORNER_ENTRY: StaticObjectEntry = { sx: 0, sy: 0, width: 16, height: 16 };
export const COBWEB_FLAT_ENTRY: StaticObjectEntry = { sx: 17, sy: 0, width: 16, height: 17 };

function draw(rc: TileDrawContext): void {
  const { ctx, level, col, row, destX, destY, images } = rc;
  const decorations = images.decorations;
  if (!decorations) return;
  const orientation = cobwebOrientation(level, col, row);
  if (!orientation.corner) {
    ctx.drawImage(
      decorations,
      COBWEB_FLAT_ENTRY.sx, COBWEB_FLAT_ENTRY.sy,
      COBWEB_FLAT_ENTRY.width ?? TILE_SIZE, COBWEB_FLAT_ENTRY.height ?? TILE_SIZE,
      destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
    );
    return;
  }
  if (orientation.rotation === 0) {
    ctx.drawImage(
      decorations,
      COBWEB_CORNER_ENTRY.sx, COBWEB_CORNER_ENTRY.sy,
      COBWEB_CORNER_ENTRY.width ?? TILE_SIZE, COBWEB_CORNER_ENTRY.height ?? TILE_SIZE,
      destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
    );
    return;
  }
  const half = RENDERED_TILE_SIZE / 2;
  ctx.save();
  ctx.translate(destX + half, destY + half);
  ctx.rotate((orientation.rotation * Math.PI) / 2);
  ctx.drawImage(
    decorations,
    COBWEB_CORNER_ENTRY.sx, COBWEB_CORNER_ENTRY.sy,
    COBWEB_CORNER_ENTRY.width ?? TILE_SIZE, COBWEB_CORNER_ENTRY.height ?? TILE_SIZE,
    -half, -half, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
  );
  ctx.restore();
}

export const cobwebModule = {
  char: 'X',
  fogExempt: false,
  drawBand: 'terrain',
  draw,
} as const satisfies TileModule;
