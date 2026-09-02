import { crate } from './Crate';
import { questionMark } from './QuestionMark';
import { fragileRock } from './FragileRock';

/** Every block kind in the game. Adding a kind is one line here plus its own
 *  module — `BlockState.blockKind` indexes this registry directly and every
 *  entry shares the same state type, so no dispatcher is needed. */
export const BLOCK_TYPES = { crate, questionMark, fragileRock };

export type BlockTypeKey = keyof typeof BLOCK_TYPES;
