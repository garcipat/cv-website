import { RENDER_SCALE } from '../level/Terrain';

/** `fruit.png` is a 64x64 grid of static 16x16 icons (4x4 = 16 distinct
 *  fruits) — unlike coin.png, it's not an animation strip. Fruits bob (see
 *  Coin.ts's coinBobOffset, reused as-is — bobbing is visual, not
 *  coin-specific) but never change frame. */
export const FRUIT_FRAME_SIZE = 16;
export const FRUIT_RENDERED_SIZE = FRUIT_FRAME_SIZE * RENDER_SCALE;
const FRUIT_GRID_COLUMNS = 4;
export const FRUIT_ICON_COUNT = 16;

/** Sprite-sheet source rect for a given icon index (wraps at
 *  FRUIT_ICON_COUNT, row-major left-to-right top-to-bottom). */
export function fruitFrameSource(index: number): { sx: number; sy: number } {
  const wrapped = ((index % FRUIT_ICON_COUNT) + FRUIT_ICON_COUNT) % FRUIT_ICON_COUNT;
  const col = wrapped % FRUIT_GRID_COLUMNS;
  const row = Math.floor(wrapped / FRUIT_GRID_COLUMNS);
  return { sx: col * FRUIT_FRAME_SIZE, sy: row * FRUIT_FRAME_SIZE };
}
