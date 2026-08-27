import { tileToPixel } from './Terrain';
import type { CoinPlacement } from '../entities/Coin';

interface CoinTile {
  id: string;
  col: number;
  row: number;
}

/**
 * Hardcoded test coins for level1, for visually verifying coin
 * rendering/animation before real CVData-driven placement exists (deferred
 * to the coin-collection roadmap step, which needs the same Skill/Language
 * data to know what to display on collection — see this plan's "Key scope
 * decision"). Two coins float above the row-7 floating platform (cols 8-14,
 * "PPPBBPP" — see level1.ts's LEVEL_1_LAYOUT comment) and two rest above the
 * row-10 rock ground floor, clear of the cols 2-4 pit.
 */
const LEVEL_1_COIN_TILES: readonly CoinTile[] = [
  { id: 'test-platform-1', col: 9, row: 6 },
  { id: 'test-platform-2', col: 13, row: 6 },
  { id: 'test-floor-1', col: 20, row: 9 },
  { id: 'test-floor-2', col: 30, row: 9 },
];

export const level1Coins: CoinPlacement[] = LEVEL_1_COIN_TILES.map(({ id, col, row }) => {
  const { x, y } = tileToPixel(col, row);
  return { id, x, y };
});
