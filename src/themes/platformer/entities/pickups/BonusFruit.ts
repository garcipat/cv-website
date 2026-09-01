import type { PickupType } from './PickupType';
import { FRUIT_SHEET } from '../sprites/sheets';
import { FRUIT_RENDERED_SIZE } from '../Fruit';
import { bonusFruitY, type BonusFruitState } from '../BonusFruit';

/** The `PickupType` view of a question-mark block's spawned bonus fruit —
 *  BonusFruit.ts remains the source of truth for every constant. `box`'s
 *  `y` is state-dependent because the fruit tweens upward while rising (see
 *  bonusFruitY). Unlike a coin/fruit/key, a bonus fruit does not bob —
 *  Renderer.ts's drawBonusFruits draws it at bonusFruitY(fruit) with no bob
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
    animations: {
      idle: {
        frames: [0],
        frameDuration: 1, // unused — a single-frame animation never advances.
      },
    },
  },
  box: (fruit) => ({
    x: fruit.x,
    y: bonusFruitY(fruit),
    width: FRUIT_RENDERED_SIZE,
    height: FRUIT_RENDERED_SIZE,
  }),
  frameIndex: (fruit, _elapsed, _index) => fruit.iconIndex,
  bobOffset: () => 0,
  // Filled in when rendering moves into these modules.
  draw: () => {},
};
