import {
  parseLevel,
  findSpawnTile,
  findGreenEnemyTiles,
  findPurpleEnemyTiles,
  findCoinTiles,
  findCrateTiles,
  findQuestionMarkTiles,
  findFragileRockTiles,
  findChestTiles,
  TERRAIN_CHARS,
  ENTITY_CHARS,
  SIGN_CHARS,
  findSignTiles,
  type TileChar,
} from './LevelParser';

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

  it('terrainChars-mapsEveryTerrainCharacter', () => {
    expect(TERRAIN_CHARS['.']).toBe('empty');
    expect(TERRAIN_CHARS.G).toBe('groundGrass');
    expect(TERRAIN_CHARS.R).toBe('groundRock');
    expect(TERRAIN_CHARS.W).toBe('wall');
    expect(TERRAIN_CHARS.B).toBe('bridge');
  });

  it('TERRAIN_CHARS-n-mapsToBush', () => {
    expect(TERRAIN_CHARS.n).toBe('bush');
  });

  it('TERRAIN_CHARS-N-mapsToFence', () => {
    expect(TERRAIN_CHARS.N).toBe('fence');
  });

  it('entityChars-mapsEveryEntityMarker', () => {
    expect(ENTITY_CHARS.S).toBe('spawn');
    expect(ENTITY_CHARS.E).toBe('enemyGreen');
    expect(ENTITY_CHARS.M).toBe('enemyPurple');
    expect(ENTITY_CHARS.C).toBe('coin');
    expect(ENTITY_CHARS.X).toBe('crate');
    expect(ENTITY_CHARS.Q).toBe('questionMark');
    expect(ENTITY_CHARS.F).toBe('fragileRock');
    expect(ENTITY_CHARS.T).toBe('chest');
  });

  it('noTerrainAndEntityCharOverlap-documentedByTheModuleLoadGuard', () => {
    // LevelParser.ts throws at import time if TERRAIN_CHARS/ENTITY_CHARS
    // ever share a key — this file having loaded at all is that guard
    // having already passed. This test exists to document the invariant
    // by name, not to catch a violation itself (a real overlap fails the
    // whole file at import, before any test body runs).
    const shared = Object.keys(TERRAIN_CHARS).filter((char) => char in ENTITY_CHARS);
    expect(shared).toEqual([]);
  });

  it('spawnMarker-parsesAsEmptyWalkableTile', () => {
    const result = parseLevel(['S.', 'G.']);
    expect(result.terrain[0][0]).toBe('empty');
  });

  it('enemyMarkers-parseAsEmptyWalkableTile', () => {
    const result = parseLevel(['EM', 'GG']);
    expect(result.terrain[0][0]).toBe('empty');
    expect(result.terrain[0][1]).toBe('empty');
  });

  it('coinAndFragileRockMarkers-parseAsEmptyWalkableTile', () => {
    const result = parseLevel(['CF', 'GG']);
    expect(result.terrain[0][0]).toBe('empty');
    expect(result.terrain[0][1]).toBe('empty');
  });

  it('oneRow-heightIsOne', () => {
    // Height is read from the layout, never assumed — a level need only be
    // as tall as its content requires.
    const result = parseLevel(['GGG']);
    expect(result.height).toBe(1);
    expect(result.width).toBe(3);
  });
});

describe('parseLevel ragged rows (padding, not throwing)', () => {
  it('shorterRow-padsWithEmptyUpToWidestRowsWidth', () => {
    const result = parseLevel(['GGG', 'G']);
    expect(result.width).toBe(3);
    expect(result.terrain[1]).toEqual(['groundGrass', 'empty', 'empty']);
  });

  it('allRowsAlreadyEqualLength-behavesExactlyAsBefore', () => {
    const result = parseLevel(['GG', 'WW']);
    expect(result.width).toBe(2);
    expect(result.terrain).toEqual([
      ['groundGrass', 'groundGrass'],
      ['wall', 'wall'],
    ]);
  });
});

describe('patrol terrain character', () => {
  it('P-mapsToThePatrolTileType', () => {
    expect(TERRAIN_CHARS.P).toBe('patrol');
  });

  it('parseLevel-patrolChar-keepsItAsItsOwnTileRatherThanEmpty', () => {
    // A patrol tile is invisible in game, but it is NOT empty — EnemyAI
    // reads it straight out of the terrain grid to reverse a patrol.
    expect(parseLevel(['.P.'])).toEqual({
      terrain: [['empty', 'patrol', 'empty']],
      width: 3,
      height: 1,
    });
  });
});

describe('ladder terrain character', () => {
  it('terrainChars-mapsLToLadder', () => {
    expect(TERRAIN_CHARS.L).toBe('ladder');
  });

  it('ladderChar-parsesAsLadderTile', () => {
    const result = parseLevel(['L.', 'GG']);
    expect(result.terrain[0][0]).toBe('ladder');
  });
});

describe('findSpawnTile', () => {
  it('spawnMarkerPresent-returnsItsColAndRow', () => {
    expect(findSpawnTile(['..', '.S'])).toEqual({ col: 1, row: 1 });
  });

  it('noSpawnMarker-throws', () => {
    expect(() => findSpawnTile(['GG', 'GG'])).toThrow('Level layout has no spawn marker ("S")');
  });
});

describe('findGreenEnemyTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findGreenEnemyTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findGreenEnemyTiles(['.E', 'E.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('purpleMarker-isNotCountedAsGreen', () => {
    expect(findGreenEnemyTiles(['M.'])).toEqual([]);
  });
});

describe('findPurpleEnemyTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findPurpleEnemyTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findPurpleEnemyTiles(['.M', 'M.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('greenMarker-isNotCountedAsPurple', () => {
    expect(findPurpleEnemyTiles(['E.'])).toEqual([]);
  });
});

describe('findCoinTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findCoinTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findCoinTiles(['.C', 'C.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('fragileRockMarker-isNotCountedAsCoin', () => {
    expect(findCoinTiles(['F.'])).toEqual([]);
  });
});

describe('findCrateTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findCrateTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findCrateTiles(['.X', 'X.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('questionMarkOrFragileRockMarker-isNotCountedAsCrate', () => {
    expect(findCrateTiles(['QF'])).toEqual([]);
  });
});

describe('findQuestionMarkTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findQuestionMarkTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findQuestionMarkTiles(['.Q', 'Q.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('crateOrFragileRockMarker-isNotCountedAsQuestionMark', () => {
    expect(findQuestionMarkTiles(['XF'])).toEqual([]);
  });
});

describe('findFragileRockTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findFragileRockTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findFragileRockTiles(['.F', 'F.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('crateOrQuestionMarkMarker-isNotCountedAsFragileRock', () => {
    expect(findFragileRockTiles(['XQ'])).toEqual([]);
  });
});

describe('findChestTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findChestTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findChestTiles(['.T', 'T.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('crateOrFragileRockMarker-isNotCountedAsChest', () => {
    expect(findChestTiles(['XF'])).toEqual([]);
  });
});

describe('SIGN_CHARS', () => {
  it('digitOne-mapsToBridgeDropThroughHint', () => {
    expect(SIGN_CHARS['1']).toBe('bridgeDropThrough');
  });

  it('digitsTwoThroughFive-mapToTheirRegisteredHints', () => {
    expect(SIGN_CHARS['2']).toBe('ladderClimbUp');
    expect(SIGN_CHARS['3']).toBe('fragileRockBreaksFromBelow');
    expect(SIGN_CHARS['4']).toBe('chestNeedsKey');
    expect(SIGN_CHARS['5']).toBe('openAllChestsHaveFun');
  });

  it('noOverlapWithTerrainOrEntityChars-documentedByTheModuleLoadGuard', () => {
    // Same convention as the existing TERRAIN_CHARS/ENTITY_CHARS overlap
    // guard (see LevelParser.ts) — this file having loaded at all is that
    // guard having already passed.
    const overlapsTerrain = Object.keys(SIGN_CHARS).filter((char) => char in TERRAIN_CHARS);
    const overlapsEntity = Object.keys(SIGN_CHARS).filter((char) => char in ENTITY_CHARS);
    expect(overlapsTerrain).toEqual([]);
    expect(overlapsEntity).toEqual([]);
  });
});

describe('parseLevel — sign markers', () => {
  it('signMarker-parsesAsEmptyWalkableTile', () => {
    const result = parseLevel(['1.', 'GG']);
    expect(result.terrain[0][0]).toBe('empty');
  });
});

describe('findSignTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findSignTiles(['GG', 'GG'])).toEqual([]);
  });

  it('oneMarker-returnsItsColRowAndHintId', () => {
    expect(findSignTiles(['..', '.1'])).toEqual([{ col: 1, row: 1, hintId: 'bridgeDropThrough' }]);
  });

  it('multipleMarkersOfTheSameHint-returnsAllInReadingOrder', () => {
    // Only '1' is registered today — placing it twice is still valid (a
    // hint can be shown at more than one spot in the level).
    expect(findSignTiles(['1.', '.1'])).toEqual([
      { col: 0, row: 0, hintId: 'bridgeDropThrough' },
      { col: 1, row: 1, hintId: 'bridgeDropThrough' },
    ]);
  });
});

describe('TileChar', () => {
  it('includes every TERRAIN_CHARS, ENTITY_CHARS, and SIGN_CHARS key', () => {
    const tileChars: readonly TileChar[] = [
      '.', 'G', 'R', 'W', 'B', 'L', 'P', 'S', 'E', 'M', 'C', 'X', 'Q', 'F', 'T',
      '1', '2', '3', '4', '5', 'n', 'N',
    ];
    const allKeys = [...Object.keys(TERRAIN_CHARS), ...Object.keys(ENTITY_CHARS), ...Object.keys(SIGN_CHARS)];
    for (const key of allKeys) {
      expect(tileChars).toContain(key);
    }
  });
});
