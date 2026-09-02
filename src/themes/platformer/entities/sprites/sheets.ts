import type { SpriteSheet } from './SpriteSheet';
import { KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT } from '../KeyPickup';
import { COIN_FRAME_SIZE, COIN_FRAME_COUNT } from '../Coin';
import { FRUIT_FRAME_SIZE, FRUIT_ICON_COLUMNS } from '../Fruit';
import { TILE_SIZE } from '../../level/Terrain';
import {
  CHEST_CLOSED_WIDTH,
  CHEST_CLOSED_HEIGHT,
  CHEST_OPEN_WIDTH,
  CHEST_OPEN_HEIGHT,
} from '../Chest';

/**
 * Both slime sheets are 96x72: a 4x3 grid of 24x24 frames. Frames 0-2 read as a
 * mostly-featureless blob, frames 3-7 loop well as a breathing/bounce cycle,
 * and frames 8-11 read as the slime dissolving toward a near-black silhouette.
 * Frame 10 alone is recolored red in both sheets.
 */
const SLIME_FRAME_SIZE = 24;
const SLIME_COLUMNS = 4;

export const SLIME_GREEN_SHEET: SpriteSheet = {
  src: '/sprites/slime_green.png',
  frameWidth: SLIME_FRAME_SIZE,
  frameHeight: SLIME_FRAME_SIZE,
  columns: SLIME_COLUMNS,
};

export const SLIME_PURPLE_SHEET: SpriteSheet = {
  src: '/sprites/slime_purple.png',
  frameWidth: SLIME_FRAME_SIZE,
  frameHeight: SLIME_FRAME_SIZE,
  columns: SLIME_COLUMNS,
};

/** A standalone single image, not a sheet — one frame filling the whole
 *  image, reusing KeyPickup.ts's own KEY_FRAME_WIDTH/HEIGHT (the source of
 *  truth for these numbers) so a purple slime's held-key overlay can
 *  discover this sheet via the same registry-driven asset loading every
 *  other sprite uses. */
export const KEY_SHEET: SpriteSheet = {
  src: '/sprites/key.png',
  frameWidth: KEY_FRAME_WIDTH,
  frameHeight: KEY_FRAME_HEIGHT,
  columns: 1,
};

/** `coin.png` is a 192x16 strip: 12 frames of one spin cycle, so its
 *  addressing stride is the whole strip. `frameSource(COIN_SHEET, i)` does
 *  NOT wrap for `i >= 12` the way `coinFrameSource` does — harmless today
 *  since coin.png is a single row and every caller already passes a wrapped
 *  index, but this sheet is not a drop-in for `coinFrameSource`'s wrapping
 *  behavior. */
export const COIN_SHEET: SpriteSheet = {
  src: '/sprites/coin.png',
  frameWidth: COIN_FRAME_SIZE,
  frameHeight: COIN_FRAME_SIZE,
  columns: COIN_FRAME_COUNT,
};

/** `fruit.png` is physically 64x64, but only its first three 16px columns
 *  hold icons — the fourth is empty and never addressed. `columns` is the
 *  addressing stride, so it reuses Fruit.ts's own FRUIT_ICON_COLUMNS (the
 *  source of truth for that number) rather than the image's width in
 *  frames. */
export const FRUIT_SHEET: SpriteSheet = {
  src: '/sprites/fruit.png',
  frameWidth: FRUIT_FRAME_SIZE,
  frameHeight: FRUIT_FRAME_SIZE,
  columns: FRUIT_ICON_COLUMNS,
};

/** `world_tileset.png` is a 16x16 grid of 16px tiles, shared by terrain and
 *  every block kind. Terrain addresses it through its own neighbour-aware
 *  lookup rather than by frame index; the sheet is the unit of loading, not
 *  of addressing. */
export const WORLD_TILESET_SHEET: SpriteSheet = {
  src: '/sprites/world_tileset.png',
  frameWidth: TILE_SIZE,
  frameHeight: TILE_SIZE,
  columns: 16,
};

/** A single 16px overlay composited over a cracked crate. */
export const CRACK_OVERLAY_SHEET: SpriteSheet = {
  src: '/sprites/crack_overlay.png',
  frameWidth: TILE_SIZE,
  frameHeight: TILE_SIZE,
  columns: 1,
};

/** The chest's two states are separate standalone images of different sizes,
 *  so each is its own one-frame sheet. */
export const CHEST_CLOSED_SHEET: SpriteSheet = {
  src: '/sprites/chest_closed.png',
  frameWidth: CHEST_CLOSED_WIDTH,
  frameHeight: CHEST_CLOSED_HEIGHT,
  columns: 1,
};

export const CHEST_OPEN_SHEET: SpriteSheet = {
  src: '/sprites/chest_open.png',
  frameWidth: CHEST_OPEN_WIDTH,
  frameHeight: CHEST_OPEN_HEIGHT,
  columns: 1,
};
