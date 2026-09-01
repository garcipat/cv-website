import type { SpriteSheet } from './SpriteSheet';

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
 *  image, matching KeyPickup.ts's own KEY_FRAME_WIDTH/HEIGHT (the source of
 *  truth for these numbers; kept here too so a purple slime's held-key
 *  overlay can discover this sheet via the same registry-driven asset
 *  loading every other sprite uses). */
export const KEY_SHEET: SpriteSheet = {
  src: '/sprites/key.png',
  frameWidth: 14,
  frameHeight: 22,
  columns: 1,
};
