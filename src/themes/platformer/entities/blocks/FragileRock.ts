import type { BlockType } from './BlockType';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';
import { drawBlockTile } from './drawBlockTile';

/** Row 0, column 3 of the shared tileset. */
const FRAGILE_ROCK_FRAME = 3;

export const fragileRock: BlockType = {
  key: 'fragileRock',
  sprite: { sheet: WORLD_TILESET_SHEET, renderScale: 1, animations: {} },
  maxHits: 1,
  removeWhenUsedUp: true,
  triggerSides: ['bottom'],
  frameIndex: () => FRAGILE_ROCK_FRAME,
  draw: (block, dc) => drawBlockTile(block, dc, FRAGILE_ROCK_FRAME),
};
