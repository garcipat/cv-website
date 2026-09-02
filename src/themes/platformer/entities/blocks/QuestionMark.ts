import type { BlockType } from './BlockType';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';
import { drawBlockTile } from './drawBlockTile';

/** Row 2, column 0 while intact. */
const INTACT_FRAME = 32;
/** The plain top-exposed groundRock tile (row 0, column 1) — a spent
 *  question-mark blends into ordinary ground rather than reading as a
 *  distinct block kind. */
const SPENT_FRAME = 1;

function questionMarkFrameIndex(hitsTaken: number): number {
  return hitsTaken >= 1 ? SPENT_FRAME : INTACT_FRAME;
}

export const questionMark: BlockType = {
  key: 'questionMark',
  sprite: { sheet: WORLD_TILESET_SHEET, renderScale: 1, animations: {} },
  maxHits: 1,
  // Stays as a permanent solid block once spent; only its frame changes.
  removeWhenUsedUp: false,
  frameIndex: questionMarkFrameIndex,
  draw: (block, dc) => drawBlockTile(block, dc, questionMarkFrameIndex(block.hitsTaken)),
};
