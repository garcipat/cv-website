import type { BlockType } from './BlockType';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';

/** Row 2, column 0 while intact. */
const INTACT_FRAME = 32;
/** The plain top-exposed groundRock tile (row 0, column 1) — a spent
 *  question-mark blends into ordinary ground rather than reading as a
 *  distinct block kind. */
const SPENT_FRAME = 1;

export const questionMark: BlockType = {
  key: 'questionMark',
  sprite: { sheet: WORLD_TILESET_SHEET, renderScale: 1, animations: {} },
  maxHits: 1,
  // Stays as a permanent solid block once spent; only its frame changes.
  removeWhenUsedUp: false,
  frameIndex: (hitsTaken) => (hitsTaken >= 1 ? SPENT_FRAME : INTACT_FRAME),
  // Filled in when rendering moves into this module.
  draw: () => {},
};
