import type { PickupType } from './PickupType';
import type { CollectiblePlacement } from '../../level/CollectibleMapper';
import { COIN_SHEET } from '../sprites/sheets';
import {
  COIN_RENDERED_SIZE,
  COIN_FRAME_COUNT,
  COIN_FRAME_DURATION,
  coinFrameIndex,
  coinBobOffset,
} from '../Coin';

/** The `PickupType` view of a placed coin — Coin.ts remains the source of
 *  truth for every constant and for coinFrameIndex/coinBobOffset; this module
 *  only wraps them behind the shape Collision.ts/Renderer.ts expect. */
export const coin: PickupType<CollectiblePlacement> = {
  key: 'coin',
  sprite: {
    sheet: COIN_SHEET,
    renderScale: 1,
    animations: {
      spin: {
        frames: Array.from({ length: COIN_FRAME_COUNT }, (_, i) => i),
        frameDuration: COIN_FRAME_DURATION,
      },
    },
  },
  box: (placement) => ({
    x: placement.x,
    y: placement.y,
    width: COIN_RENDERED_SIZE,
    height: COIN_RENDERED_SIZE,
  }),
  frameIndex: (_placement, elapsed, _index) => coinFrameIndex(elapsed),
  bobOffset: (_placement, elapsed) => coinBobOffset(elapsed),
  // Filled in when rendering moves into these modules.
  draw: () => {},
};
