import { level1, parseLevel, TILE_CHARS } from './level1';

describe('parseLevel', () => {
  it('charLayout-parsesInto-matchingTileMap', () => {
    const result = parseLevel(['G.', '.W']);
    expect(result).toEqual({
      terrain: [
        ['groundGrass', 'empty'],
        ['empty', 'wall'],
      ],
      width: 2,
      height: 2,
    });
  });

  it('unknownCharacter-throws', () => {
    expect(() => parseLevel(['G?'])).toThrow('Unknown level tile character: "?"');
  });

  it('tileChars-mapsEveryLegendCharacter', () => {
    expect(TILE_CHARS['.']).toBe('empty');
    expect(TILE_CHARS.G).toBe('groundGrass');
    expect(TILE_CHARS.R).toBe('groundRock');
    expect(TILE_CHARS.P).toBe('platform');
    expect(TILE_CHARS.W).toBe('wall');
    expect(TILE_CHARS.B).toBe('bridge');
  });
});

describe('level1', () => {
  it('dimensions-matchTerrainGridShape', () => {
    expect(level1.terrain).toHaveLength(level1.height);
    for (const row of level1.terrain) {
      expect(row).toHaveLength(level1.width);
    }
  });

  it('groundStrip-usesGrassBiomeOnLeftAndRockBiomeOnRight', () => {
    const lastRow = level1.terrain[level1.height - 1];
    expect(lastRow[0]).toBe('groundGrass');
    expect(lastRow[11]).toBe('groundGrass');
    expect(lastRow[12]).toBe('groundRock');
    expect(lastRow[19]).toBe('groundRock');
  });

  it('pit-atColumns2And3-isEmptyOnBothGroundRows', () => {
    expect(level1.terrain[level1.height - 1][2]).toBe('empty');
    expect(level1.terrain[level1.height - 1][3]).toBe('empty');
  });

  it('bridge-spansThePitAtRowAboveBottomRow', () => {
    expect(level1.terrain[level1.height - 2][2]).toBe('bridge');
    expect(level1.terrain[level1.height - 2][3]).toBe('bridge');
  });

  it('containsAtLeastOnePlatformTile', () => {
    const hasPlatform = level1.terrain.some((row) => row.includes('platform'));
    expect(hasPlatform).toBe(true);
  });

  it('containsAtLeastOneWallTile', () => {
    const hasWall = level1.terrain.some((row) => row.includes('wall'));
    expect(hasWall).toBe(true);
  });
});
