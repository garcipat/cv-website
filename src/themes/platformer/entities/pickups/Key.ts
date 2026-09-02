import type { PickupType } from './PickupType';
import { KEY_SHEET } from '../sprites/sheets';
import { frameSource } from '../sprites/SpriteSheet';
import {
  KEY_FRAME_WIDTH,
  KEY_FRAME_HEIGHT,
  KEY_RENDERED_WIDTH,
  KEY_RENDERED_HEIGHT,
  KEY_TILE_OFFSET_X,
  KEY_TILE_OFFSET_Y,
  type KeyPickupState,
} from '../KeyPickup';
import { coinBobOffset } from '../Coin';

/** The `PickupType` view of a dropped key — KeyPickup.ts remains the source
 *  of truth for every constant. A single standalone image, not a sheet, so
 *  frameIndex is always 0. Bobs exactly like a coin (Coin.ts's
 *  coinBobOffset — reused as-is, this module's own `draw` applies it). */
export const key: PickupType<KeyPickupState> = {
  key: 'key',
  sprite: {
    sheet: KEY_SHEET,
    // The key's rendered size comes from KEY_RENDERED_WIDTH/KEY_RENDERED_HEIGHT
    // via box(), not from frameWidth * renderScale — the shared sheet-drawing
    // helper (drawSpriteSheetEntity) must not be used to draw this pickup, or
    // it will render at the wrong (square) size and aspect.
    renderScale: 1,
    // Frame selection goes through frameIndex (always 0 — a single standalone
    // image), not through named animations — this stays empty rather than
    // restating unread frame/duration data.
    animations: {},
  },
  box: (pickup) => ({
    x: pickup.x + KEY_TILE_OFFSET_X,
    y: pickup.y + KEY_TILE_OFFSET_Y,
    width: KEY_RENDERED_WIDTH,
    height: KEY_RENDERED_HEIGHT,
  }),
  frameIndex: () => 0,
  bobOffset: (_pickup, elapsed) => coinBobOffset(elapsed),
  // Draws at KEY_RENDERED_WIDTH/HEIGHT (via box(), the non-square
  // 14:22-derived size), NOT the shared sheet-drawing helper (see the note
  // above).
  draw: (pickup, dc) => {
    const image = dc.sprites[KEY_SHEET.src];
    if (!image) return;

    const { sx, sy } = frameSource(KEY_SHEET, key.frameIndex(pickup, dc.worldElapsed, 0));
    const bob = key.bobOffset(pickup, dc.worldElapsed);

    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      sx,
      sy,
      KEY_FRAME_WIDTH,
      KEY_FRAME_HEIGHT,
      pickup.x + KEY_TILE_OFFSET_X + dc.originX,
      pickup.y + KEY_TILE_OFFSET_Y + dc.originY + bob,
      KEY_RENDERED_WIDTH,
      KEY_RENDERED_HEIGHT,
    );
  },
};
