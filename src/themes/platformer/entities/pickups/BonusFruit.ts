import type { PickupType } from './PickupType';
import { FRUIT_SHEET } from '../sprites/sheets';
import { FRUIT_FRAME_SIZE, FRUIT_RENDERED_SIZE, fruitFrameSource } from '../Fruit';
import { bonusFruitY, type BonusFruitState } from '../BonusFruit';

/** The `PickupType` view of a question-mark block's spawned bonus fruit —
 *  BonusFruit.ts remains the source of truth for every constant. `box`'s
 *  `y` is state-dependent because the fruit tweens upward while rising (see
 *  bonusFruitY). Unlike a coin/fruit/key, a bonus fruit does not bob —
 *  this module's own `draw` draws it at bonusFruitY(fruit) with no bob
 *  offset added, since its own rise tween already supplies its vertical
 *  motion. `frameIndex` returns the fruit's own `iconIndex` as-is — that is
 *  already the LOGICAL index (spawnBonusFruit wraps it mod
 *  FRUIT_ICON_COUNT); packed-slot mapping via FRUIT_ICON_ORDER happens
 *  later, at draw time, same as every other pickup type. */
export const bonusFruit: PickupType<BonusFruitState> = {
  key: 'bonusFruit',
  sprite: {
    sheet: FRUIT_SHEET,
    renderScale: 1,
    // Frame selection goes through frameIndex (fruit.iconIndex), not through
    // named animations — this stays empty rather than restating unread
    // frame/duration data.
    animations: {},
  },
  box: (fruit) => ({
    x: fruit.x,
    y: bonusFruitY(fruit),
    width: FRUIT_RENDERED_SIZE,
    height: FRUIT_RENDERED_SIZE,
  }),
  frameIndex: (fruit) => fruit.iconIndex,
  bobOffset: () => 0,
  // No bob offset added (see bobOffset above and the doc comment on this module).
  draw: (fruitState, dc) => {
    const image = dc.sprites[FRUIT_SHEET.src];
    if (!image) return;

    const { sx, sy } = fruitFrameSource(bonusFruit.frameIndex(fruitState, dc.worldElapsed, 0));

    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      sx,
      sy,
      FRUIT_FRAME_SIZE,
      FRUIT_FRAME_SIZE,
      fruitState.x + dc.originX,
      bonusFruitY(fruitState) + dc.originY,
      FRUIT_RENDERED_SIZE,
      FRUIT_RENDERED_SIZE,
    );
  },
};
