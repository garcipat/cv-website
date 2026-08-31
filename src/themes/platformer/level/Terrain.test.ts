import {
  tileAt,
  isSolid,
  isSolidExcludingBridge,
  isClimbable,
  isStandableLadderTop,
  isTopExposed,
  tileToPixel,
  bridgeRunPosition,
  TILE_SIZE,
  RENDER_SCALE,
  RENDERED_TILE_SIZE,
} from './Terrain';
import { parseLevel } from './LevelParser';
import type { LevelDef } from './LevelData';

const testLevel: LevelDef = {
  width: 3,
  height: 3,
  terrain: [
    ['empty', 'groundGrass', 'wall'],
    ['bridge', 'empty', 'empty'],
    ['groundGrass', 'groundRock', 'empty'],
  ],
};

describe('Terrain', () => {
  it('tileAt-inBounds-returnsTile', () => {
    expect(tileAt(testLevel, 1, 0)).toBe('groundGrass');
    expect(tileAt(testLevel, 0, 1)).toBe('bridge');
  });

  it('tileAt-outOfBounds-returnsEmpty', () => {
    expect(tileAt(testLevel, -1, 0)).toBe('empty');
    expect(tileAt(testLevel, 3, 0)).toBe('empty');
    expect(tileAt(testLevel, 0, -1)).toBe('empty');
    expect(tileAt(testLevel, 0, 3)).toBe('empty');
  });

  it('isSolid-groundPlatformWallBridge-returnsTrue', () => {
    expect(isSolid('groundGrass')).toBe(true);
    expect(isSolid('groundRock')).toBe(true);
    expect(isSolid('platform')).toBe(true);
    expect(isSolid('wall')).toBe(true);
    expect(isSolid('bridge')).toBe(true);
  });

  it('isSolid-empty-returnsFalse', () => {
    expect(isSolid('empty')).toBe(false);
  });

  it('isSolidExcludingBridge-groundPlatformWall-returnsTrue', () => {
    expect(isSolidExcludingBridge('groundGrass')).toBe(true);
    expect(isSolidExcludingBridge('groundRock')).toBe(true);
    expect(isSolidExcludingBridge('platform')).toBe(true);
    expect(isSolidExcludingBridge('wall')).toBe(true);
  });

  it('isSolidExcludingBridge-bridge-returnsFalseUnlikePlainIsSolid', () => {
    // The one case isSolidExcludingBridge disagrees with isSolid: bridge is
    // solid from every direction except from below (or while dropping).
    expect(isSolid('bridge')).toBe(true);
    expect(isSolidExcludingBridge('bridge')).toBe(false);
  });

  it('isSolidExcludingBridge-empty-returnsFalse', () => {
    expect(isSolidExcludingBridge('empty')).toBe(false);
  });

  it('isTopExposed-emptyAbove-returnsTrue', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['empty'], ['groundGrass']],
    };
    expect(isTopExposed(level, 0, 1)).toBe(true);
  });

  it('isTopExposed-solidTileAbove-returnsFalse', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    expect(isTopExposed(level, 0, 1)).toBe(false);
  });

  it('isTopExposed-topRowOfLevel-returnsTrue', () => {
    const level: LevelDef = {
      width: 1,
      height: 1,
      terrain: [['groundGrass']],
    };
    expect(isTopExposed(level, 0, 0)).toBe(true);
  });

  it('tileToPixel-scalesByRenderedTileSize', () => {
    expect(RENDERED_TILE_SIZE).toBe(TILE_SIZE * RENDER_SCALE);
    expect(tileToPixel(2, 3)).toEqual({ x: 2 * RENDERED_TILE_SIZE, y: 3 * RENDERED_TILE_SIZE });
  });

  it('bridgeRunPosition-noBridgeNeighbors-returnsSingle', () => {
    const level: LevelDef = { width: 3, height: 1, terrain: [['empty', 'bridge', 'empty']] };
    expect(bridgeRunPosition(level, 1, 0)).toBe('single');
  });

  it('bridgeRunPosition-onlyRightNeighborIsBridge-returnsLeft', () => {
    const level: LevelDef = { width: 2, height: 1, terrain: [['bridge', 'bridge']] };
    expect(bridgeRunPosition(level, 0, 0)).toBe('left');
  });

  it('bridgeRunPosition-onlyLeftNeighborIsBridge-returnsRight', () => {
    const level: LevelDef = { width: 2, height: 1, terrain: [['bridge', 'bridge']] };
    expect(bridgeRunPosition(level, 1, 0)).toBe('right');
  });

  it('bridgeRunPosition-bothNeighborsAreBridge-returnsMiddle', () => {
    const level: LevelDef = { width: 3, height: 1, terrain: [['bridge', 'bridge', 'bridge']] };
    expect(bridgeRunPosition(level, 1, 0)).toBe('middle');
  });
});

describe('isClimbable', () => {
  it('ladder-returnsTrue', () => {
    expect(isClimbable('ladder')).toBe(true);
  });

  it('everyOtherTile-returnsFalse', () => {
    expect(isClimbable('groundGrass')).toBe(false);
    expect(isClimbable('groundRock')).toBe(false);
    expect(isClimbable('platform')).toBe(false);
    expect(isClimbable('wall')).toBe(false);
    expect(isClimbable('bridge')).toBe(false);
    expect(isClimbable('empty')).toBe(false);
  });
});

describe('isSolid ladder exception', () => {
  it('ladder-isNotSolid', () => {
    expect(isSolid('ladder')).toBe(false);
  });
});

describe('isStandableLadderTop', () => {
  it('ladderWithOpenSpaceAbove-returnsTrue', () => {
    const level = parseLevel(['.', 'L', 'G']);
    expect(isStandableLadderTop(level, 0, 1)).toBe(true);
  });

  it('ladderWithAnotherLadderAbove-returnsFalse-notTheTopRung', () => {
    const level = parseLevel(['L', 'L', 'G']);
    expect(isStandableLadderTop(level, 0, 1)).toBe(false);
  });

  it('ladderWithSolidTileAbove-returnsFalse-noRoomToStand', () => {
    const level = parseLevel(['G', 'L', 'G']);
    expect(isStandableLadderTop(level, 0, 1)).toBe(false);
  });

  it('nonLadderTile-returnsFalse-regardlessOfWhatsAbove', () => {
    const level = parseLevel(['.', 'G', 'G']);
    expect(isStandableLadderTop(level, 0, 1)).toBe(false);
  });
});
