import {
  parseLevel,
  findSpawnTile,
  findGreenEnemyTiles,
  findPurpleEnemyTiles,
  findBeeTiles,
  findCoinTiles,
  findCrateTiles,
  findQuestionMarkTiles,
  findFragileRockTiles,
  findCoinPotTiles,
  findPotionPotTiles,
  findBombPotTiles,
  findChestTiles,
  findCheckpointTiles,
  TERRAIN_CHARS,
  ENTITY_CHARS,
  SIGN_CHARS,
  findSignTiles,
  HAZARD_CHARS,
  findHazardTiles,
  findTorchTiles,
  findLadderBundleTiles,
  BACKGROUND_CHARS,
  parseBackgroundLayout,
  type TileChar,
  type BackgroundChar,
} from './LevelParser';

describe('parseLevel', () => {
  it('charLayout-parsesInto-matchingTileMap', () => {
    const result = parseLevel(['G.', '.#']);
    expect(result).toEqual({
      terrain: [
        ['groundGrass', 'empty'],
        ['empty', 'wall'],
      ],
      width: 2,
      height: 2,
    });
  });

  it('unknownCharacter-isSkippedAsEmptyAndWarns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseLevel(['GZ']);
    expect(result).toEqual({
      terrain: [['groundGrass', 'empty']],
      width: 2,
      height: 1,
    });
    expect(warn).toHaveBeenCalledWith('Skipping unknown level tile character(s): "Z"');
    warn.mockRestore();
  });

  it('terrainChars-mapsEveryTerrainCharacter', () => {
    expect(TERRAIN_CHARS['.']).toBe('empty');
    expect(TERRAIN_CHARS.G).toBe('groundGrass');
    expect(TERRAIN_CHARS.R).toBe('groundRock');
    expect(TERRAIN_CHARS['#']).toBe('wall');
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
    expect(ENTITY_CHARS.M).toBe('enemyGreen');
    expect(ENTITY_CHARS.m).toBe('enemyPurple');
    expect(ENTITY_CHARS.q).toBe('enemyBee');
    expect(ENTITY_CHARS.o).toBe('coin');
    expect(ENTITY_CHARS['=']).toBe('crate');
    expect(ENTITY_CHARS['?']).toBe('questionMark');
    expect(ENTITY_CHARS.F).toBe('fragileRock');
    expect(ENTITY_CHARS.u).toBe('coinPot');
    expect(ENTITY_CHARS.p).toBe('potionPot');
    expect(ENTITY_CHARS.b).toBe('bombPot');
    expect(ENTITY_CHARS.$).toBe('chest');
    expect(ENTITY_CHARS.C).toBe('checkpoint');
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
    const result = parseLevel(['Mm', 'GG']);
    expect(result.terrain[0][0]).toBe('empty');
    expect(result.terrain[0][1]).toBe('empty');
  });

  it('coinAndFragileRockMarkers-parseAsEmptyWalkableTile', () => {
    const result = parseLevel(['oF', 'GG']);
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
    const result = parseLevel(['GG', '##']);
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

describe('blueprint connection point terrain character', () => {
  it('plus-mapsToTheBlueprintConnectionPointTileType', () => {
    expect(TERRAIN_CHARS['+']).toBe('blueprintConnectionPoint');
  });

  it('parseLevel-connectionPointChar-keepsItAsItsOwnTileRatherThanEmpty', () => {
    // Same reason a patrol tile is not parsed to `empty`: the character has
    // to survive a parse/export round trip so a saved blueprint still knows
    // where its connection points are (step 44c reads them back out of the
    // layout).
    expect(parseLevel(['.+.'])).toEqual({
      terrain: [['empty', 'blueprintConnectionPoint', 'empty']],
      width: 3,
      height: 1,
    });
  });

  it('connectionPointChar-collidesWithNoOtherCharacterMap', () => {
    // The module-load guard in LevelParser.ts already throws on a shared
    // key; this names the invariant for '+' specifically, since 44b is the
    // step that claimed it.
    expect('+' in ENTITY_CHARS).toBe(false);
    expect('+' in SIGN_CHARS).toBe(false);
    expect('+' in HAZARD_CHARS).toBe(false);
  });
});

describe('ladder terrain character', () => {
  it('terrainChars-mapsLToLadder', () => {
    expect(TERRAIN_CHARS.H).toBe('ladder');
  });

  it('ladderChar-parsesAsLadderTile', () => {
    const result = parseLevel(['H.', 'GG']);
    expect(result.terrain[0][0]).toBe('ladder');
  });
});

describe('chain terrain character', () => {
  it('terrainChars-mapsIToChain', () => {
    expect(TERRAIN_CHARS.I).toBe('chain');
  });

  it('chainChar-parsesAsChainTile', () => {
    const result = parseLevel(['I.', 'GG']);
    expect(result.terrain[0][0]).toBe('chain');
  });
});

describe('torch terrain character', () => {
  it('terrainChars-mapsYenSignToTorch', () => {
    expect(TERRAIN_CHARS['¥']).toBe('torch');
  });

  it('torchChar-parsesAsTorchTile', () => {
    const result = parseLevel(['¥.', 'GG']);
    expect(result.terrain[0][0]).toBe('torch');
  });

  it('torchChar-collidesWithNoOtherCharacterMap', () => {
    // The module-load guard in LevelParser.ts already throws on a shared
    // key; this names the invariant for '¥' specifically, so a future tile
    // cannot quietly claim the same glyph.
    expect('¥' in ENTITY_CHARS).toBe(false);
    expect('¥' in SIGN_CHARS).toBe(false);
    expect('¥' in HAZARD_CHARS).toBe(false);
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
    expect(findGreenEnemyTiles(['.M', 'M.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('purpleMarker-isNotCountedAsGreen', () => {
    expect(findGreenEnemyTiles(['m.'])).toEqual([]);
  });
});

describe('findPurpleEnemyTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findPurpleEnemyTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findPurpleEnemyTiles(['.m', 'm.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('greenMarker-isNotCountedAsPurple', () => {
    expect(findPurpleEnemyTiles(['M.'])).toEqual([]);
  });
});

describe('findBeeTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findBeeTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findBeeTiles(['.q', 'q.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('otherEnemyMarkers-areNotCountedAsBees', () => {
    expect(findBeeTiles(['Mm'])).toEqual([]);
  });
});

describe('findCoinTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findCoinTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findCoinTiles(['.o', 'o.'])).toEqual([
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
    expect(findCrateTiles(['.=', '=.'])).toEqual([
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
    expect(findQuestionMarkTiles(['.?', '?.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('crateOrFragileRockMarker-isNotCountedAsQuestionMark', () => {
    expect(findQuestionMarkTiles(['=F'])).toEqual([]);
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
    expect(findFragileRockTiles(['=?'])).toEqual([]);
  });
});

describe('findCoinPotTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findCoinPotTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findCoinPotTiles(['.u', 'u.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('crateOrQuestionMarkMarker-isNotCountedAsCoinPot', () => {
    expect(findCoinPotTiles(['=?'])).toEqual([]);
  });
});

describe('findPotionPotTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findPotionPotTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findPotionPotTiles(['.p', 'p.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('coinPotMarker-isNotCountedAsPotionPot', () => {
    expect(findPotionPotTiles(['uQ'])).toEqual([]);
  });
});

describe('findBombPotTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findBombPotTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findBombPotTiles(['.b', 'b.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('coinPotOrPotionPotMarker-isNotCountedAsBombPot', () => {
    expect(findBombPotTiles(['up'])).toEqual([]);
  });

  it('bombPotChar-parsesAsEmptyWalkableTile', () => {
    expect(parseLevel(['b.', 'GG']).terrain[0][0]).toBe('empty');
  });

  it('bombPotChar-collidesWithNoOtherCharacterMap', () => {
    // The module-load guard in LevelParser.ts already throws on a shared
    // key; this names the invariant for 'b' specifically.
    expect('b' in TERRAIN_CHARS).toBe(false);
    expect('b' in SIGN_CHARS).toBe(false);
    expect('b' in HAZARD_CHARS).toBe(false);
  });
});

describe('findChestTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findChestTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findChestTiles(['.$', '$.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('crateOrFragileRockMarker-isNotCountedAsChest', () => {
    expect(findChestTiles(['=F'])).toEqual([]);
  });
});

describe('checkpoint marker', () => {
  it('uppercaseC-mapsToTheCheckpointEntityKind', () => {
    expect(ENTITY_CHARS.C).toBe('checkpoint');
  });

  it('parseLevel-checkpointChar-parsesAsEmptyWalkableTile', () => {
    const result = parseLevel(['C', 'G']);
    expect(result.terrain[0][0]).toBe('empty');
  });

  it('checkpointChar-collidesWithNoOtherCharacterMap', () => {
    // The module-load guard in LevelParser.ts already throws on a shared
    // key; this names the invariant for 'C' specifically.
    expect('C' in TERRAIN_CHARS).toBe(false);
    expect('C' in SIGN_CHARS).toBe(false);
    expect('C' in HAZARD_CHARS).toBe(false);
  });
});

describe('findCheckpointTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findCheckpointTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findCheckpointTiles(['.C', 'C.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('chestMarker-isNotCountedAsCheckpoint', () => {
    expect(findCheckpointTiles(['$'])).toEqual([]);
  });
});

describe('SIGN_CHARS', () => {
  it('digitOne-mapsToBridgeDropThroughHint', () => {
    expect(SIGN_CHARS['1']).toBe('bridgeDropThrough');
  });

  it('digitsTwoThroughSix-mapToTheirRegisteredHints', () => {
    expect(SIGN_CHARS['2']).toBe('ladderClimbUp');
    expect(SIGN_CHARS['3']).toBe('fragileRockBreaksFromBelow');
    expect(SIGN_CHARS['4']).toBe('chestNeedsKey');
    expect(SIGN_CHARS['5']).toBe('openAllChestsHaveFun');
    expect(SIGN_CHARS['6']).toBe('bomb');
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

describe('HAZARD_CHARS', () => {
  it('eachDirectionCharacter-mapsToSpikeWithItsFacing', () => {
    expect(HAZARD_CHARS['^']).toEqual({ hazardType: 'spike', facing: 'up' });
    expect(HAZARD_CHARS.v).toEqual({ hazardType: 'spike', facing: 'down' });
    expect(HAZARD_CHARS['<']).toEqual({ hazardType: 'spike', facing: 'left' });
    expect(HAZARD_CHARS['>']).toEqual({ hazardType: 'spike', facing: 'right' });
  });

  it('brokenBar-mapsToTheFloorSpearFacingUp', () => {
    expect(HAZARD_CHARS['¦']).toEqual({ hazardType: 'spear', facing: 'up' });
  });

  it('noOverlapWithTerrainEntityOrSignChars-documentedByTheModuleLoadGuard', () => {
    const keys = Object.keys(HAZARD_CHARS);
    expect(keys.filter((char) => char in TERRAIN_CHARS)).toEqual([]);
    expect(keys.filter((char) => char in ENTITY_CHARS)).toEqual([]);
    expect(keys.filter((char) => char in SIGN_CHARS)).toEqual([]);
  });

  it('brokenBar-collidesWithNoOtherCharacterMap', () => {
    // The module-load guard in LevelParser.ts already throws on a shared
    // key; this names the invariant for '¦' specifically.
    expect('¦' in TERRAIN_CHARS).toBe(false);
    expect('¦' in ENTITY_CHARS).toBe(false);
    expect('¦' in SIGN_CHARS).toBe(false);
  });

  it('star-mapsToFloorSpikeFacingUp', () => {
    expect(HAZARD_CHARS['A']).toEqual({ hazardType: 'floorSpike', facing: 'up' });
  });
});

describe('parseLevel — hazard markers', () => {
  it('hazardMarker-parsesAsEmptyWalkableTile', () => {
    const result = parseLevel(['^.', 'GG']);
    expect(result.terrain[0][0]).toBe('empty');
  });

  it('spearMarker-parsesAsEmptyWalkableTile', () => {
    const result = parseLevel(['¦.', 'GG']);
    expect(result.terrain[0][0]).toBe('empty');
  });
});

describe('findHazardTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findHazardTiles(['GG', 'GG'])).toEqual([]);
  });

  it('oneOfEachDirection-returnsAllWithTheirFacing', () => {
    expect(findHazardTiles(['^v', '<>'])).toEqual([
      { col: 0, row: 0, hazardType: 'spike', facing: 'up' },
      { col: 1, row: 0, hazardType: 'spike', facing: 'down' },
      { col: 0, row: 1, hazardType: 'spike', facing: 'left' },
      { col: 1, row: 1, hazardType: 'spike', facing: 'right' },
    ]);
  });

  it('spearMarker-returnsTheSpearFacingUp', () => {
    expect(findHazardTiles(['.¦', 'G.'])).toEqual([
      { col: 1, row: 0, hazardType: 'spear', facing: 'up' },
    ]);
  });

  it('mixedStaticAndFloorSpikeCharacters-returnsBothKinds', () => {
    expect(findHazardTiles(['^A'])).toEqual([
      { col: 0, row: 0, hazardType: 'spike', facing: 'up' },
      { col: 1, row: 0, hazardType: 'floorSpike', facing: 'up' },
    ]);
  });
});

describe('findTorchTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findTorchTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findTorchTiles(['.¥', '¥.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('otherTerrainAndEntityChars-areNotCountedAsTorches', () => {
    expect(findTorchTiles(['=F', 'oC'])).toEqual([]);
  });
});

describe('findLadderBundleTiles', () => {
  it('TERRAIN_CHARS-mapsAtToLadderBundle', () => {
    expect(TERRAIN_CHARS['@']).toBe('ladderBundle');
  });

  it('noMarkers-returnsEmptyArray', () => {
    expect(findLadderBundleTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findLadderBundleTiles(['.@', '@.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('otherTerrainAndEntityChars-areNotCountedAsBundles', () => {
    expect(findLadderBundleTiles(['H=H', 'oG¥'])).toEqual([]);
  });

  it('ropeLadder-isNotALevelCharacter', () => {
    expect(Object.values(TERRAIN_CHARS)).not.toContain('ropeLadder');
  });
});

describe('mushroom terrain characters', () => {
  it('TERRAIN_CHARS-sectionSign-mapsToBouncyMushroom', () => {
    expect(TERRAIN_CHARS['§']).toBe('bouncyMushroom');
  });

  it('TERRAIN_CHARS-s-mapsToDecorativeMushroom', () => {
    expect(TERRAIN_CHARS.s).toBe('decorativeMushroom');
  });

  it('parseLevel-bouncyMushroomChar-parsesAsBouncyMushroomTile', () => {
    const result = parseLevel(['§.', 'GG']);
    expect(result.terrain[0][0]).toBe('bouncyMushroom');
  });

  it('parseLevel-decorativeMushroomChar-parsesAsDecorativeMushroomTile', () => {
    const result = parseLevel(['s.', 'GG']);
    expect(result.terrain[0][0]).toBe('decorativeMushroom');
  });

  it('mushroomChars-collideWithNoOtherForegroundCharacterMap', () => {
    // The module-load guard in LevelParser.ts already throws on a shared
    // key; this names the invariant for '§' and 's' specifically. ('s' also
    // appears in BACKGROUND_CHARS as surfaceStone, which is allowed: the
    // background is a separate layer whose characters may overlap the
    // foreground ones.)
    expect('§' in ENTITY_CHARS).toBe(false);
    expect('§' in SIGN_CHARS).toBe(false);
    expect('§' in HAZARD_CHARS).toBe(false);
    expect('s' in ENTITY_CHARS).toBe(false);
    expect('s' in SIGN_CHARS).toBe(false);
    expect('s' in HAZARD_CHARS).toBe(false);
  });
});

describe('crumblingFloor terrain character', () => {
  it('TERRAIN_CHARS-crumblingFloorChar-mapsToCrumblingFloorTile', () => {
    expect(TERRAIN_CHARS['g']).toBe('crumblingFloor');
  });

  it('parseLevel-crumblingFloorChar-parsesAsCrumblingFloorTile', () => {
    const result = parseLevel(['g.', 'GG']);
    expect(result.terrain[0][0]).toBe('crumblingFloor');
  });

  it('crumblingFloorChar-notSharedWithOtherCharMaps', () => {
    expect('g' in ENTITY_CHARS).toBe(false);
    expect('g' in SIGN_CHARS).toBe(false);
    expect('g' in HAZARD_CHARS).toBe(false);
  });
});

describe('TileChar', () => {
  it('includes every TERRAIN_CHARS, ENTITY_CHARS, SIGN_CHARS, and HAZARD_CHARS key', () => {
    const tileChars: readonly TileChar[] = [
      '.', 'G', 'R', '#', 'B', 'H', 'I', 'P', '+', 'S', 'M', 'm', 'q', 'o', '=', '?', 'F', '$', 'u', 'p',
      'b', 'n', 'N', 'X', 'c', '⊤', '⊥', '¥', '1', '2', '3', '4', '5', '6', '^', 'v', '<', '>', 'A', 'C', '@',
      '§', 's', 'g', '¦',
    ];
    const allKeys = [
      ...Object.keys(TERRAIN_CHARS),
      ...Object.keys(ENTITY_CHARS),
      ...Object.keys(SIGN_CHARS),
      ...Object.keys(HAZARD_CHARS),
    ];
    for (const key of allKeys) {
      expect(tileChars).toContain(key);
    }
  });
});

describe('parseBackgroundLayout', () => {
  it('charLayout-parsesIntoMatchingBackgroundGrid', () => {
    const result = parseBackgroundLayout(['.d.', '.cv'], 3, 2);
    expect(result).toEqual([
      [null, 'dirt', null],
      [null, 'charcoal', 'caveStone'],
    ]);
  });

  it('everyBackgroundChar-mapsToItsDocumentedMaterial', () => {
    expect(BACKGROUND_CHARS.d).toBe('dirt');
    expect(BACKGROUND_CHARS.r).toBe('rust');
    expect(BACKGROUND_CHARS.s).toBe('surfaceStone');
    expect(BACKGROUND_CHARS.c).toBe('charcoal');
    expect(BACKGROUND_CHARS.m).toBe('maroon');
    expect(BACKGROUND_CHARS.v).toBe('caveStone');
  });

  it('unrecognizedCharacter-silentlyReadsAsEmptyWithNoWarning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseBackgroundLayout(['?'], 1, 1);
    expect(result).toEqual([[null]]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('layoutShorterThanTerrainHeight-padsMissingRowsAsAllEmpty', () => {
    const result = parseBackgroundLayout(['d'], 1, 3);
    expect(result).toEqual([['dirt'], [null], [null]]);
  });

  it('layoutNarrowerThanTerrainWidth-padsMissingColumnsAsEmpty', () => {
    const result = parseBackgroundLayout(['d'], 3, 1);
    expect(result).toEqual([['dirt', null, null]]);
  });

  it('layoutTallerThanTerrainHeight-clampsExtraRowsAway', () => {
    const result = parseBackgroundLayout(['d', 'r', 'c'], 1, 1);
    expect(result).toEqual([['dirt']]);
  });

  it('layoutWiderThanTerrainWidth-clampsExtraColumnsAway', () => {
    const result = parseBackgroundLayout(['drc'], 1, 1);
    expect(result).toEqual([['dirt']]);
  });

  it('emptyLayout-producesAnAllEmptyGridOfTheGivenSize', () => {
    const result = parseBackgroundLayout([], 2, 2);
    expect(result).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it('backgroundCharUnion-coversEveryBackgroundCharsKeyPlusEmpty', () => {
    const chars: BackgroundChar[] = ['.', 'd', 'r', 's', 'c', 'm', 'v', 'w'];
    for (const key of Object.keys(BACKGROUND_CHARS)) {
      expect(chars).toContain(key);
    }
  });
});
