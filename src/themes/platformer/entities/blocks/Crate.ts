import type { BlockType } from './BlockType';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';

/** Row 3, column 7 of the shared tileset. */
const CRATE_FRAME = 55;

export const crate: BlockType = {
  key: 'crate',
  sprite: { sheet: WORLD_TILESET_SHEET, renderScale: 1, animations: {} },
  // Two hits: the first cracks it, the second shatters it.
  maxHits: 2,
  removeWhenUsedUp: true,
  frameIndex: () => CRATE_FRAME,
  // Filled in when rendering moves into this module.
  draw: () => {},
};
