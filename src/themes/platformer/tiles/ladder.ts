import { RENDERED_TILE_SIZE, TILE_SIZE, tileAt } from '../level/Terrain';
import { isClimbableTile, isSolidTile } from './registry';
import type { LevelDef } from '../level/LevelData';
import type { TileDrawContext, TileModule } from './TileModule';

/**
 * `ladder` — the climbable ladder shaft (`H`). Climbable; fogged; drawn in the
 * terrain band.
 */

/**
 * Whether this cell is a ladder shaft's topmost tile with open space above it
 * the one ladder tile the character can actually stand ON. A shaft's top rung
 * is solid from above only: you climb out of the shaft onto it, land on it when
 * falling from above, and can step off it sideways or press Down to climb back
 * in. Every other ladder tile stays fully passable.
 *
 * "Open space above" excludes both a continuing ladder (that tile isn't the
 * top) and a solid tile (there'd be no room to stand). `chain`/`ropeLadder`
 * share this exact rule (they climb identically), so the check is expressed
 * through the registry's `isClimbableTile`, never a bare `tile === 'ladder'`.
 */
function standableAt(level: LevelDef, col: number, row: number): boolean {
  const above = tileAt(level, col, row - 1);
  return isClimbableTile(tileAt(level, col, row)) && !isClimbableTile(above) && !isSolidTile(above);
}

function draw(rc: TileDrawContext): void {
  const { ctx, destX, destY, images } = rc;
  ctx.drawImage(
    images.tileset,
    9 * TILE_SIZE,
    3 * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
    destX,
    destY,
    RENDERED_TILE_SIZE,
    RENDERED_TILE_SIZE,
  );
}

export const ladderModule = {
  char: 'H',
  fogExempt: false,
  climbable: true,
  drawBand: 'terrain',
  standableAt,
  draw,
} as const satisfies TileModule;
