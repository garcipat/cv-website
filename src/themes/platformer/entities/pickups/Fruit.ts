import type { PickupType } from './PickupType';
import type { CollectiblePlacement } from '../../level/CollectibleMapper';
import { FRUIT_SHEET } from '../sprites/sheets';
import { FRUIT_RENDERED_SIZE, fruitPackedIndex } from '../Fruit';
import { coinBobOffset } from '../Coin';

/** The `PickupType` view of a placed fruit collectible — Fruit.ts remains
 *  the source of truth for every constant. A placed fruit carries no
 *  per-instance icon index today (unlike BonusFruit's `iconIndex` — see
 *  CollectibleMapper.ts's note that no fruit `CollectibleDef` is ever
 *  produced yet), so frameIndex always resolves logical icon 0 through
 *  FRUIT_ICON_ORDER's mapping until that changes. Fruits bob exactly like
 *  coins (Coin.ts's coinBobOffset, reused as-is — bobbing is visual, not
 *  coin-specific). */
export const fruit: PickupType<CollectiblePlacement> = {
  key: 'fruit',
  sprite: {
    sheet: FRUIT_SHEET,
    renderScale: 1,
    animations: {
      idle: {
        frames: [fruitPackedIndex(0)],
        frameDuration: 1, // unused — a single-frame animation never advances.
      },
    },
  },
  box: (placement) => ({
    x: placement.x,
    y: placement.y,
    width: FRUIT_RENDERED_SIZE,
    height: FRUIT_RENDERED_SIZE,
  }),
  frameIndex: () => fruitPackedIndex(0),
  bobOffset: (_placement, elapsed) => coinBobOffset(elapsed),
  // Filled in when rendering moves into these modules.
  draw: () => {},
};
