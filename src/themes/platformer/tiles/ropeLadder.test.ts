import { describe, it, expect } from 'vitest';
import {
  ropeLadderShaftPieces,
  ROPE_TOP_CAP,
  ROPE_STEP,
  ROPE_BOTTOM_CAP,
} from './ropeLadder';

describe('ropeLadderShaftPieces', () => {
  it('zeroLength-isTopCapOverBottomCap', () => {
    expect(ropeLadderShaftPieces(0)).toEqual([ROPE_TOP_CAP, ROPE_BOTTOM_CAP]);
  });

  it('oneCell-isTwoTilesWorthOfHalfTilePieces', () => {
    // The bundle cell + one cell below = two 16px tiles = four 8px pieces.
    const pieces = ropeLadderShaftPieces(1);
    expect(pieces).toHaveLength(4);
    expect(pieces[0]).toBe(ROPE_TOP_CAP);
    expect(pieces[pieces.length - 1]).toBe(ROPE_BOTTOM_CAP);
  });

  it('nCells-areTwoHalfTilePiecesPerTile-withCapsOnTheEnds', () => {
    for (const cells of [1, 2, 3, 7]) {
      const pieces = ropeLadderShaftPieces(cells);
      // (cells + 1) tiles, each two 8px pieces.
      expect(pieces).toHaveLength((cells + 1) * 2);
      expect(pieces[0]).toBe(ROPE_TOP_CAP);
      expect(pieces[pieces.length - 1]).toBe(ROPE_BOTTOM_CAP);
      // Exactly `2 * cells` plain steps between the two caps.
      expect(pieces.filter((p) => p === ROPE_STEP)).toHaveLength(cells * 2);
      const totalNativeHeight = pieces.reduce((sum, p) => sum + p.height, 0);
      expect(totalNativeHeight).toBe((cells + 1) * 16);
    }
  });
});
