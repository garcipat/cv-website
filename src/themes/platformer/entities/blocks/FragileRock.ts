import type { BlockType } from './BlockType';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';

/** Row 0, column 3 of the shared tileset. */
const FRAGILE_ROCK_FRAME = 3;

export const fragileRock: BlockType = {
  key: 'fragileRock',
  sprite: { sheet: WORLD_TILESET_SHEET, renderScale: 1, animations: {} },
  maxHits: 1,
  removeWhenUsedUp: true,
  frameIndex: () => FRAGILE_ROCK_FRAME,
  // Filled in when rendering moves into this module.
  draw: () => {},
};
