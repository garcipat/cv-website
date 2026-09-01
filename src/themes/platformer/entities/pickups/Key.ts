import type { PickupType } from './PickupType';
import { KEY_SHEET } from '../sprites/sheets';
import {
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
 *  coinBobOffset — see Renderer.ts's drawKeyPickups). */
export const key: PickupType<KeyPickupState> = {
  key: 'key',
  sprite: {
    sheet: KEY_SHEET,
    // The key's rendered size comes from KEY_RENDERED_WIDTH/KEY_RENDERED_HEIGHT
    // via box(), not from frameWidth * renderScale — the shared sheet-drawing
    // helper (drawSpriteSheetEntity) must not be used to draw this pickup, or
    // it will render at the wrong (square) size and aspect.
    renderScale: 1,
    animations: {
      idle: {
        frames: [0],
        frameDuration: 1, // unused — a single-frame animation never advances.
      },
    },
  },
  box: (pickup) => ({
    x: pickup.x + KEY_TILE_OFFSET_X,
    y: pickup.y + KEY_TILE_OFFSET_Y,
    width: KEY_RENDERED_WIDTH,
    height: KEY_RENDERED_HEIGHT,
  }),
  frameIndex: (_pickup, _elapsed, _index) => 0,
  bobOffset: (_pickup, elapsed) => coinBobOffset(elapsed),
  // Filled in when rendering moves into these modules. Draw via box()'s own
  // width/height, not the shared sheet helper (see the note above).
  draw: () => {},
};
