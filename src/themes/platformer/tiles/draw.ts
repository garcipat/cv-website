import { RENDERED_TILE_SIZE, TILE_SIZE } from '../level/Terrain';

/**
 * Shared tile-draw primitives (moved out of `engine/Renderer.ts`, /): a
 * source-rect crop from an atlas image, optionally rotated a quarter-turn about
 * the destination cell's centre. Used by the ground-grass and background-mass
 * passes, which index into 16px-tile atlases the same way and differ only in
 * image + lookup table.
 *
 * A quarter turn moves a border onto an adjacent edge (and would also swing a
 * vertical brightness ramp sideways, so the ground caller only uses one on
 * cells measured flat — see `GroundAtlas`'s doc comment); a half turn maps every
 * edge onto its opposite.
 */
export function drawRotatedTile(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  entry: { sx: number; sy: number; rotation: 0 | 1 | 2 | 3 },
  destX: number,
  destY: number,
): void {
  if (entry.rotation === 0) {
    ctx.drawImage(
      atlas,
      entry.sx,
      entry.sy,
      TILE_SIZE,
      TILE_SIZE,
      destX,
      destY,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
    return;
  }

  const half = RENDERED_TILE_SIZE / 2;
  ctx.save();
  ctx.translate(destX + half, destY + half);
  ctx.rotate((entry.rotation * Math.PI) / 2);
  ctx.drawImage(
    atlas,
    entry.sx,
    entry.sy,
    TILE_SIZE,
    TILE_SIZE,
    -half,
    -half,
    RENDERED_TILE_SIZE,
    RENDERED_TILE_SIZE,
  );
  ctx.restore();
}
