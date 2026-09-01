import { RENDER_SCALE } from '../level/Terrain';

/** `fruit.png` is a 64x64 sheet, but only its first 3 columns hold icons
 *  (12 distinct fruits, 4 rows) — the 4th column is empty transparent space
 *  and is never addressed. Unlike coin.png, it's not an animation strip.
 *  Fruits bob (see Coin.ts's coinBobOffset, reused as-is — bobbing is
 *  visual, not coin-specific) but never change frame. */
export const FRUIT_FRAME_SIZE = 16;
export const FRUIT_RENDERED_SIZE = FRUIT_FRAME_SIZE * RENDER_SCALE;
export const FRUIT_ICON_COLUMNS = 3;
export const FRUIT_ICON_COUNT = 12;

/** Maps a logical fruit index (0-based, in *use* order) to its packed
 *  position (0-11, row-major over the sheet's 3 real columns — the empty
 *  4th column is skipped entirely rather than addressed). Live user
 *  feedback (2026-08-30): packed positions 0, 2, 3, 8, 9 read as the most
 *  realistic-looking icons and should appear first — everything else
 *  follows in its original sheet order as a reserve pool for future fruit
 *  types. */
export const FRUIT_ICON_ORDER = [0, 2, 3, 8, 9, 1, 4, 5, 6, 7, 10, 11];

/** Maps a logical fruit index (wraps at FRUIT_ICON_COUNT) to its packed
 *  sheet position via FRUIT_ICON_ORDER — the single place that mapping
 *  happens, reused by fruitFrameSource and by entities/pickups' frameIndex
 *  implementations. */
export function fruitPackedIndex(index: number): number {
  const wrapped = ((index % FRUIT_ICON_COUNT) + FRUIT_ICON_COUNT) % FRUIT_ICON_COUNT;
  return FRUIT_ICON_ORDER[wrapped];
}

/** Sprite-sheet source rect for a given logical icon index (wraps at
 *  FRUIT_ICON_COUNT; see FRUIT_ICON_ORDER for the logical-to-packed
 *  mapping). */
export function fruitFrameSource(index: number): { sx: number; sy: number } {
  const packed = fruitPackedIndex(index);
  const col = packed % FRUIT_ICON_COLUMNS;
  const row = Math.floor(packed / FRUIT_ICON_COLUMNS);
  return { sx: col * FRUIT_FRAME_SIZE, sy: row * FRUIT_FRAME_SIZE };
}
