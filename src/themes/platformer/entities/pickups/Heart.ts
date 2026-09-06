import type { PickupType } from './PickupType';
import { HEARTS_SHEET } from '../sprites/sheets';
import { frameSource } from '../sprites/SpriteSheet';
import {
  HEART_PICKUP_RENDERED_SIZE,
  HEART_PICKUP_TILE_OFFSET_X,
  HEART_PICKUP_TILE_OFFSET_Y,
  type HeartPickupState,
} from '../HeartPickup';
import { coinBobOffset } from '../Coin';

/** The `PickupType` view of a dropped heart — HeartPickup.ts remains the
 *  source of truth for every constant. Always draws `hearts.png`'s frame 0
 *  (the full-heart icon — see `Health.ts`'s `heartFrameIndex`), since a
 *  dropped heart is never anything but a whole one. Bobs exactly like a coin
 *  (Coin.ts's coinBobOffset — reused as-is, same convention as
 *  entities/pickups/Key.ts). */
export const heart: PickupType<HeartPickupState> = {
  key: 'heart',
  sprite: {
    sheet: HEARTS_SHEET,
    renderScale: 1,
    // Frame selection goes through frameIndex (always 0), not through named
    // animations — this stays empty, same convention as Key.ts/Coin.ts.
    animations: {},
  },
  box: (pickup) => ({
    x: pickup.x + HEART_PICKUP_TILE_OFFSET_X,
    y: pickup.y + HEART_PICKUP_TILE_OFFSET_Y,
    width: HEART_PICKUP_RENDERED_SIZE,
    height: HEART_PICKUP_RENDERED_SIZE,
  }),
  frameIndex: () => 0,
  bobOffset: (_pickup, elapsed) => coinBobOffset(elapsed),
  draw: (pickup, dc) => {
    const image = dc.sprites[HEARTS_SHEET.src];
    if (!image) return;

    const { sx, sy } = frameSource(HEARTS_SHEET, heart.frameIndex(pickup, dc.worldElapsed, 0));
    const bob = heart.bobOffset(pickup, dc.worldElapsed);

    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      sx,
      sy,
      HEARTS_SHEET.frameWidth,
      HEARTS_SHEET.frameHeight,
      pickup.x + HEART_PICKUP_TILE_OFFSET_X + dc.originX,
      pickup.y + HEART_PICKUP_TILE_OFFSET_Y + dc.originY + bob,
      HEART_PICKUP_RENDERED_SIZE,
      HEART_PICKUP_RENDERED_SIZE,
    );
  },
};
