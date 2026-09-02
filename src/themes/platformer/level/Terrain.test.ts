import {
  tileAt,
  isSolid,
  isSolidExcludingBridge,
  isClimbable,
  isStandableLadderTop,
  isTopExposed,
  tileToPixel,
  bridgeRunPosition,
  horizontalRunPosition,
  neighbourMask,
  NEIGHBOUR_UP,
  NEIGHBOUR_RIGHT,
  NEIGHBOUR_DOWN,
  NEIGHBOUR_LEFT,
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

  it('isSolid-groundWallBridge-returnsTrue', () => {
    expect(isSolid('groundGrass')).toBe(true);
    expect(isSolid('groundRock')).toBe(true);
    expect(isSolid('wall')).toBe(true);
    expect(isSolid('bridge')).toBe(true);
  });

  it('isSolid-empty-returnsFalse', () => {
    expect(isSolid('empty')).toBe(false);
  });

  it('isSolidExcludingBridge-groundWall-returnsTrue', () => {
    expect(isSolidExcludingBridge('groundGrass')).toBe(true);
    expect(isSolidExcludingBridge('groundRock')).toBe(true);
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

  it('neighbourMask-isolatedTile-returnsZero', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    expect(neighbourMask(level, 0, 0)).toBe(0);
  });

  it('neighbourMask-solidAbove-setsUpBit', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    expect(neighbourMask(level, 0, 1)).toBe(NEIGHBOUR_UP);
  });

  it('neighbourMask-solidBelow-setsDownBit', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    expect(neighbourMask(level, 0, 0)).toBe(NEIGHBOUR_DOWN);
  });

  it('neighbourMask-solidLeftAndRight-setsBothHorizontalBits', () => {
    const level: LevelDef = {
      width: 3,
      height: 1,
      terrain: [['groundGrass', 'groundGrass', 'groundGrass']],
    };
    expect(neighbourMask(level, 1, 0)).toBe(NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT);
  });

  it('neighbourMask-surroundedBySolid-setsAllBits', () => {
    const level: LevelDef = {
      width: 3,
      height: 3,
      terrain: [
        ['groundGrass', 'groundGrass', 'groundGrass'],
        ['groundGrass', 'groundGrass', 'groundGrass'],
        ['groundGrass', 'groundGrass', 'groundGrass'],
      ],
    };
    expect(neighbourMask(level, 1, 1)).toBe(
      NEIGHBOUR_UP | NEIGHBOUR_RIGHT | NEIGHBOUR_DOWN | NEIGHBOUR_LEFT,
    );
  });

  it('neighbourMask-nonSolidNeighbour-leavesBitClear', () => {
    // A ladder is deliberately not solid, so it does not open the edge.
    const level: LevelDef = {
      width: 2,
      height: 1,
      terrain: [['groundGrass', 'ladder']],
    };
    expect(neighbourMask(level, 0, 0) & NEIGHBOUR_RIGHT).toBe(0);
  });

  it('neighbourMask-differentSolidMaterial-opensEdge', () => {
    // Borders are about facing air, so any solid neighbour opens the edge.
    const level: LevelDef = {
      width: 2,
      height: 1,
      terrain: [['groundGrass', 'wall']],
    };
    expect(neighbourMask(level, 0, 0) & NEIGHBOUR_RIGHT).toBe(NEIGHBOUR_RIGHT);
  });

  it('neighbourMask-upBitClear-matchesIsTopExposed', () => {
    // These two must never drift: the grass pass keys off the UP bit while
    // other code still calls isTopExposed.
    const level: LevelDef = {
      width: 2,
      height: 2,
      terrain: [
        ['groundGrass', 'empty'],
        ['groundGrass', 'groundGrass'],
      ],
    };
    for (let row = 0; row < level.height; row++) {
      for (let col = 0; col < level.width; col++) {
        const upClear = (neighbourMask(level, col, row) & NEIGHBOUR_UP) === 0;
        expect(upClear).toBe(isTopExposed(level, col, row));
      }
    }
  });

  it('horizontalRunPosition-noMatchingNeighbours-returnsSingle', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const isGround = (l: LevelDef, c: number, r: number) => tileAt(l, c, r) === 'groundGrass';
    expect(horizontalRunPosition(level, 0, 0, isGround)).toBe('single');
  });

  it('horizontalRunPosition-onlyRightMatches-returnsLeft', () => {
    const level: LevelDef = {
      width: 2,
      height: 1,
      terrain: [['groundGrass', 'groundGrass']],
    };
    const isGround = (l: LevelDef, c: number, r: number) => tileAt(l, c, r) === 'groundGrass';
    expect(horizontalRunPosition(level, 0, 0, isGround)).toBe('left');
  });

  it('horizontalRunPosition-onlyLeftMatches-returnsRight', () => {
    const level: LevelDef = {
      width: 2,
      height: 1,
      terrain: [['groundGrass', 'groundGrass']],
    };
    const isGround = (l: LevelDef, c: number, r: number) => tileAt(l, c, r) === 'groundGrass';
    expect(horizontalRunPosition(level, 1, 0, isGround)).toBe('right');
  });

  it('horizontalRunPosition-bothNeighboursMatch-returnsMiddle', () => {
    const level: LevelDef = {
      width: 3,
      height: 1,
      terrain: [['groundGrass', 'groundGrass', 'groundGrass']],
    };
    const isGround = (l: LevelDef, c: number, r: number) => tileAt(l, c, r) === 'groundGrass';
    expect(horizontalRunPosition(level, 1, 0, isGround)).toBe('middle');
  });

  it('horizontalRunPosition-predicateRejectsNeighbour-capsTheRun', () => {
    // The predicate, not mere adjacency, decides continuity.
    const level: LevelDef = {
      width: 2,
      height: 1,
      terrain: [['groundGrass', 'groundRock']],
    };
    const isGround = (l: LevelDef, c: number, r: number) => tileAt(l, c, r) === 'groundGrass';
    expect(horizontalRunPosition(level, 0, 0, isGround)).toBe('single');
  });
});

describe('isClimbable', () => {
  it('ladder-returnsTrue', () => {
    expect(isClimbable('ladder')).toBe(true);
  });

  it('everyOtherTile-returnsFalse', () => {
    expect(isClimbable('groundGrass')).toBe(false);
    expect(isClimbable('groundRock')).toBe(false);
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
