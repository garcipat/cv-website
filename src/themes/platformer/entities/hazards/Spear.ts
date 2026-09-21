import type { HazardType } from './HazardType';
import type { HazardPlacement } from '../../level/HazardMapper';
import { SPEAR_SHEET } from '../sprites/sheets';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../Player';
import type { PlayerState } from '../Player';
import { spearTipSweepHits, getSpearTipMask } from './SpearArt';

/** The character's visible feet line — the bottom of its hitbox, excluding
 *  the transparent foot-padding rows below the sprite. */
function feetOf(player: PlayerState): number {
  return player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING;
}

/**
 * The floor spear (O-020): a static, non-solid, floor-mounted tile of uneven
 * blood-tipped spear points. Lethal only to a character that falls onto it
 * from above the spear's own height — `isContact` combines the downward-motion
 * predicate with the tile-top-crossing test (`SpearArt.ts`), so a walk-through,
 * stand, rise, jump-through, a jump that does not clear the spear's full
 * height, a transparent-margin touch, and a descending side/shaft graze are
 * all harmless. `box` is the full rendered tile for broad phase only.
 */
export const spear: HazardType<HazardPlacement> = {
  key: 'spear',
  lethal: true,
  damage: 0,
  box: (hazard) => ({
    x: hazard.x,
    y: hazard.y,
    width: RENDERED_TILE_SIZE,
    height: RENDERED_TILE_SIZE,
  }),
  // The feet must have crossed the spear tile's top edge downward this step
  // (see `spearTipSweepHits`) — a jump from inside the tile that clears only a
  // shorter side spear never does.
  isContact: (hazard, player, hitbox) =>
    player.vy > 0 &&
    spearTipSweepHits(hitbox, hazard, getSpearTipMask(), player.prevFeetY, feetOf(player)),
  draw: (hazard, dc) => {
    const image = dc.sprites[SPEAR_SHEET.src];
    if (!image) return;
    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      0,
      0,
      SPEAR_SHEET.frameWidth,
      SPEAR_SHEET.frameHeight,
      hazard.x + dc.originX,
      hazard.y + dc.originY,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
  },
};
