import type { PickupType } from './PickupType';
import { BOMB_SHEET } from '../sprites/sheets';
import { frameSource } from '../sprites/SpriteSheet';
import {
  BOMB_PICKUP_RENDERED_SIZE,
  BOMB_PICKUP_TILE_OFFSET_X,
  BOMB_PICKUP_TILE_OFFSET_Y,
  type BombPickupState,
} from '../BombPickup';
import { coinBobOffset } from '../Coin';

/** The `PickupType` view of a dropped bomb — BombPickup.ts remains the source
 *  of truth for every constant. Always draws `bomb.png`'s frame 0 (the unlit
 *  bomb, the same art the HUD icon uses); the placed bomb's lit frames 1-5
 *  are never drawn for a world pickup. Bobs exactly like a coin/heart
 *  (`Coin.ts`'s `coinBobOffset`, reused as-is). */
export const bomb: PickupType<BombPickupState> = {
  key: 'bomb',
  sprite: {
    sheet: BOMB_SHEET,
    renderScale: 1,
    // Frame selection goes through frameIndex (always 0), not named
    // animations — same convention as Heart.ts/Key.ts.
    animations: {},
  },
  box: (pickup) => ({
    x: pickup.x + BOMB_PICKUP_TILE_OFFSET_X,
    y: pickup.y + BOMB_PICKUP_TILE_OFFSET_Y,
    width: BOMB_PICKUP_RENDERED_SIZE,
    height: BOMB_PICKUP_RENDERED_SIZE,
  }),
  frameIndex: () => 0,
  bobOffset: (_pickup, elapsed) => coinBobOffset(elapsed),
  draw: (pickup, dc) => {
    const image = dc.sprites[BOMB_SHEET.src];
    if (!image) return;

    const { sx, sy } = frameSource(BOMB_SHEET, bomb.frameIndex(pickup, dc.worldElapsed, 0));
    const bob = bomb.bobOffset(pickup, dc.worldElapsed);

    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      sx,
      sy,
      BOMB_SHEET.frameWidth,
      BOMB_SHEET.frameHeight,
      pickup.x + BOMB_PICKUP_TILE_OFFSET_X + dc.originX,
      pickup.y + BOMB_PICKUP_TILE_OFFSET_Y + dc.originY + bob,
      BOMB_PICKUP_RENDERED_SIZE,
      BOMB_PICKUP_RENDERED_SIZE,
    );
  },
};
