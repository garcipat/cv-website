import { level1Coins } from './level1Coins';
import { level1 } from './level1';
import { RENDERED_TILE_SIZE, isSolid, tileAt } from './Terrain';

describe('level1Coins', () => {
  it('called-returns-fourUniquelyIdentifiedCoins', () => {
    expect(level1Coins).toHaveLength(4);
    const ids = level1Coins.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('everyCoin-positioned-onAnEmptyTileDirectlyAboveASolidTile', () => {
    for (const coin of level1Coins) {
      const col = coin.x / RENDERED_TILE_SIZE;
      const row = coin.y / RENDERED_TILE_SIZE;
      expect(isSolid(tileAt(level1, col, row))).toBe(false);
      expect(isSolid(tileAt(level1, col, row + 1))).toBe(true);
    }
  });

  it('atLeastOneCoin-sitsAbovePlatformRow-andAtLeastOneAboveGroundRow', () => {
    // Row 7 is the floating platform row, row 10 is the ground row (see
    // level1.ts's LEVEL_1_LAYOUT comment) — the test set should cover both,
    // per the "place some on one platform ... or on the floor" testing goal.
    const rows = level1Coins.map((c) => c.y / RENDERED_TILE_SIZE);
    expect(rows).toContain(6); // one row above the platform row (7)
    expect(rows).toContain(9); // one row above the ground row (10)
  });
});
