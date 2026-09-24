import { crate } from './Crate';
import { questionMark } from './QuestionMark';
import { fragileRock } from './FragileRock';
import { coinPot } from './CoinPot';
import { potionPot } from './PotionPot';
import { bombPot } from './BombPot';

/** Every block kind in the game, derived from the registry. Adding a kind is
 *  one line here plus its own module — `BlockState.blockKind` indexes this
 *  registry directly and every entry shares the same state type, so no
 *  dispatcher is needed. */
export const BLOCK_TYPES = { crate, questionMark, fragileRock, coinPot, potionPot, bombPot };

export type BlockKind = keyof typeof BLOCK_TYPES;
