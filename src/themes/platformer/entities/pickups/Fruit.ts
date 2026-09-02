import type { PickupType } from './PickupType';
import type { CollectiblePlacement } from '../../level/CollectibleMapper';
import { FRUIT_SHEET } from '../sprites/sheets';
import { FRUIT_FRAME_SIZE, FRUIT_RENDERED_SIZE, fruitFrameSource } from '../Fruit';
import { coinBobOffset } from '../Coin';

/** The `PickupType` view of a placed fruit collectible — Fruit.ts remains
 *  the source of truth for every constant. A placed fruit carries no
 *  per-instance icon index (unlike BonusFruit's `iconIndex`); its icon comes
 *  from its position among all fruit placements instead, supplied through
 *  this module's own `frameIndex`/`draw` `index` parameter (the caller counts
 *  placements as it iterates) — so `frameIndex` returns `index` itself (the
 *  LOGICAL index; packed-slot mapping via `FRUIT_ICON_ORDER` happens later,
 *  at draw time). Fruits bob exactly like coins (Coin.ts's coinBobOffset,
 *  reused as-is — bobbing is visual, not coin-specific). */
export const fruit: PickupType<CollectiblePlacement> = {
  key: 'fruit',
  sprite: {
    sheet: FRUIT_SHEET,
    renderScale: 1,
    // Frame selection goes through frameIndex, not through named animations —
    // this stays empty rather than restating unread frame/duration data.
    animations: {},
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
  // The logical index (this placement's position among all fruit
  // placements, supplied by the caller — see drawCollectibles) is mapped to
  // a packed sheet position by fruitFrameSource, NOT the generic
  // frameSource — passing it to frameSource directly would treat the
  // logical index as an already-packed slot and render the wrong icon.
  draw: (placement, dc, index = 0) => {
    const image = dc.sprites[FRUIT_SHEET.src];
    if (!image) return;

    const { sx, sy } = fruitFrameSource(fruit.frameIndex(placement, dc.worldElapsed, index));
    const bob = fruit.bobOffset(placement, dc.worldElapsed);

    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      sx,
      sy,
      FRUIT_FRAME_SIZE,
      FRUIT_FRAME_SIZE,
      placement.x + dc.originX,
      placement.y + dc.originY + bob,
      FRUIT_RENDERED_SIZE,
      FRUIT_RENDERED_SIZE,
    );
  },
};
