import type { PickupType } from './PickupType';
import type { CollectiblePlacement } from '../../level/CollectibleMapper';
import { FRUIT_SHEET } from '../sprites/sheets';
import { FRUIT_RENDERED_SIZE } from '../Fruit';
import { coinBobOffset } from '../Coin';

/** The `PickupType` view of a placed fruit collectible — Fruit.ts remains
 *  the source of truth for every constant. A placed fruit carries no
 *  per-instance icon index (unlike BonusFruit's `iconIndex`); its icon comes
 *  from its position among all fruit placements instead, matching
 *  Renderer.ts's current `drawCollectibles`, which counts placements as it
 *  iterates and feeds that running count into `fruitFrameSource` — so
 *  `frameIndex` returns `index` itself (the LOGICAL index; packed-slot
 *  mapping via `FRUIT_ICON_ORDER` happens later, at draw time). Fruits bob
 *  exactly like coins (Coin.ts's coinBobOffset, reused as-is — bobbing is
 *  visual, not coin-specific). */
export const fruit: PickupType<CollectiblePlacement> = {
  key: 'fruit',
  sprite: {
    sheet: FRUIT_SHEET,
    renderScale: 1,
    animations: {
      idle: {
        frames: [0],
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
  // Icon comes from placement order, not per-instance state — see doc comment above.
  frameIndex: (_state, _elapsed, index) => index,
  bobOffset: (_placement, elapsed) => coinBobOffset(elapsed),
  // Filled in when rendering moves into these modules.
  draw: () => {},
};
