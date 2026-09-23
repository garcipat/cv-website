import { describe, it, expect } from 'vitest';
import {
  bushOrTreeEntry,
  staticObjectEntry,
  stalactiteEntry,
  stalagmiteEntry,
  isStalactiteTwin,
  TWIN_LEFT_RECT,
  TWIN_RIGHT_RECT,
  chainRunPieces,
  ropeLadderShaftPieces,
  ROPE_TOP_CAP,
  ROPE_STEP,
  ROPE_BOTTOM_CAP,
  COBWEB_CORNER_ENTRY,
  COBWEB_FLAT_ENTRY,
  mushroomEntry,
  mushroomHasCap,
  MUSHROOM_CAP_SOURCE_HEIGHT,
} from './StaticObjectsCatalog';
import type { ChainAttachment } from '../level/Terrain';

// Bush/tree art comes from world_tileset.png (256x256); fence art comes from
// the separate staticObjects.png (288x144) — two different sheets, so each
// gets its own bounds check.
const TILESET_SHEET_WIDTH = 256;
const TILESET_SHEET_HEIGHT = 256;
const STATIC_OBJECTS_SHEET_WIDTH = 288;
const STATIC_OBJECTS_SHEET_HEIGHT = 144;
// decorations.png is hand-spaced, not a uniform 16px grid — each entry
// carries its own width/height (StaticObjectEntry), so the tests below check
// against those rather than assuming every crop is TILE_SIZE square or
// grid-aligned.
const DECORATIONS_SHEET_WIDTH = 67;
const DECORATIONS_SHEET_HEIGHT = 35;
const TILE_SIZE = 16;
const ROLES = ['only', 'bottom', 'middle', 'top'] as const;

describe('StaticObjectsCatalog', () => {
  it.each(ROLES)('bushOrTreeEntry-%s-resolvesToARectInsideTheTilesetOnA16pxGrid', (role) => {
    const entry = bushOrTreeEntry(role, 0, 0);
    expect(entry.sx % TILE_SIZE).toBe(0);
    expect(entry.sy % TILE_SIZE).toBe(0);
    expect(entry.sx + TILE_SIZE).toBeLessThanOrEqual(TILESET_SHEET_WIDTH);
    expect(entry.sy + TILE_SIZE).toBeLessThanOrEqual(TILESET_SHEET_HEIGHT);
  });

  it('bushOrTreeEntry-sameRoleAndPosition-isDeterministic', () => {
    expect(bushOrTreeEntry('bottom', 3, 5)).toEqual(bushOrTreeEntry('bottom', 3, 5));
  });

  it('bushOrTreeEntry-differentRoles-resolveToDifferentEntries', () => {
    const only = bushOrTreeEntry('only', 0, 0);
    const bottom = bushOrTreeEntry('bottom', 0, 0);
    const middle = bushOrTreeEntry('middle', 0, 0);
    const top = bushOrTreeEntry('top', 0, 0);
    expect(only).not.toEqual(bottom);
    expect(bottom).not.toEqual(middle);
    expect(middle).not.toEqual(top);
    expect(top).not.toEqual(only);
  });

  it('staticObjectEntry-fence-resolvesToARectInsideTheSheetOnA16pxGrid', () => {
    const entry = staticObjectEntry('fence', 0, 0);
    expect(entry.sx % TILE_SIZE).toBe(0);
    expect(entry.sy % TILE_SIZE).toBe(0);
    expect(entry.sx + TILE_SIZE).toBeLessThanOrEqual(STATIC_OBJECTS_SHEET_WIDTH);
    expect(entry.sy + TILE_SIZE).toBeLessThanOrEqual(STATIC_OBJECTS_SHEET_HEIGHT);
  });

  it('staticObjectEntry-fence-ignoresPositionAndAlwaysReturnsTheSameEntry', () => {
    expect(staticObjectEntry('fence', 1, 1)).toEqual(staticObjectEntry('fence', 9, 9));
  });

  const DECORATION_TILES = ['crystalCluster'] as const;

  it.each(DECORATION_TILES)('staticObjectEntry-%s-resolvesToARectInsideTheDecorationsSheet', (tile) => {
    const entry = staticObjectEntry(tile, 0, 0);
    expect(entry.sx + (entry.width ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_WIDTH);
    expect(entry.sy + (entry.height ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_HEIGHT);
  });

  it('staticObjectEntry-crystalCluster-ignoresPositionAndAlwaysReturnsTheSameEntry', () => {
    expect(staticObjectEntry('crystalCluster', 1, 1)).toEqual(staticObjectEntry('crystalCluster', 9, 9));
  });

  it('cobwebCornerEntry-and-cobwebFlatEntry-resolveToRectsInsideTheDecorationsSheet', () => {
    for (const entry of [COBWEB_CORNER_ENTRY, COBWEB_FLAT_ENTRY]) {
      expect(entry.sx + (entry.width ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_WIDTH);
      expect(entry.sy + (entry.height ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_HEIGHT);
    }
    expect(COBWEB_CORNER_ENTRY).not.toEqual(COBWEB_FLAT_ENTRY);
  });

  it.each(['stalactiteEntry', 'stalagmiteEntry'] as const)(
    '%s-resolvesToARectInsideTheDecorationsSheetForEveryPosition',
    (fnName) => {
      const fn = fnName === 'stalactiteEntry' ? stalactiteEntry : stalagmiteEntry;
      for (let col = 0; col < 8; col++) {
        for (let row = 0; row < 8; row++) {
          const entry = fn(col, row);
          expect(entry.sx + (entry.width ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_WIDTH);
          expect(entry.sy + (entry.height ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_HEIGHT);
        }
      }
    },
  );

  it('stalactiteEntry-sameColAndRow-isDeterministic', () => {
    expect(stalactiteEntry(4, 6)).toEqual(stalactiteEntry(4, 6));
  });

  it('stalagmiteEntry-sameColAndRow-isDeterministic', () => {
    expect(stalagmiteEntry(4, 6)).toEqual(stalagmiteEntry(4, 6));
  });

  it.each(['stalactiteEntry', 'stalagmiteEntry'] as const)(
    '%s-acrossManyPositions-reachesBothSizeVariants',
    (fnName) => {
      const fn = fnName === 'stalactiteEntry' ? stalactiteEntry : stalagmiteEntry;
      const seen = new Set<string>();
      for (let col = 0; col < 20; col++) {
        for (let row = 0; row < 20; row++) {
          const entry = fn(col, row);
          seen.add(`${entry.sx},${entry.sy}`);
        }
      }
      expect(seen.size).toBe(2);
    },
  );

  const ATTACHMENTS: readonly ChainAttachment[] = ['ceiling', 'left', 'right', 'floating'];
  it.each(ATTACHMENTS)('chainRunPieces-%s-runLength1-isJustThatAttachmentsCap', (attachment) => {
    const pieces = chainRunPieces(attachment, 1);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].height).toBeGreaterThan(0);
    expect(pieces[0].width).toBeGreaterThan(0);
  });

  it('chainRunPieces-ceilingRunLength4-continuesThenOneMiddleThenBottom', () => {
    // continues(16) + middle(18) + bottom(15) = 49 <= 4*16=64;
    // a second middle would make 67 > 64, so exactly one middle fits.
    const pieces = chainRunPieces('ceiling', 4);
    expect(pieces).toHaveLength(3);
    expect(pieces[0]).toEqual({ sx: 91, sy: 120, width: 5, height: 16 });
    expect(pieces[1]).toEqual({ sx: 128, sy: 118, width: 5, height: 18 });
    expect(pieces[2]).toEqual({ sx: 137, sy: 118, width: 5, height: 15 });
  });

  it('chainRunPieces-leftRunLength2-continuesThenBottomWithNoMiddle', () => {
    // continues(15) + middle(18) + bottom(15) = 48 > 2*16=32, so no middle fits.
    const pieces = chainRunPieces('left', 2);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toEqual({ sx: 99, sy: 121, width: 7, height: 15 });
    expect(pieces[1]).toEqual({ sx: 137, sy: 118, width: 5, height: 15 });
  });

  it('chainRunPieces-rightRunLength3-fitsExactlyOneMiddle', () => {
    // continues(15) + middle(18) + bottom(15) = 48 == 3*16=48 exactly.
    const pieces = chainRunPieces('right', 3);
    expect(pieces).toHaveLength(3);
    expect(pieces[0]).toEqual({ sx: 110, sy: 121, width: 7, height: 15 });
    expect(pieces[1]).toEqual({ sx: 128, sy: 118, width: 5, height: 18 });
    expect(pieces[2]).toEqual({ sx: 137, sy: 118, width: 5, height: 15 });
  });

  it('chainRunPieces-floatingRunLength1-isTheFloatingCap', () => {
    expect(chainRunPieces('floating', 1)).toEqual([{ sx: 119, sy: 102, width: 5, height: 12 }]);
  });

  it('chainRunPieces-leftAndRight-are7pxWide-widerThanCeilingAndFloating', () => {
    // The extra 2px is the connector bar baked into the hook art itself.
    expect(chainRunPieces('left', 1)[0].width).toBe(7);
    expect(chainRunPieces('right', 1)[0].width).toBe(7);
    expect(chainRunPieces('ceiling', 1)[0].width).toBe(5);
    expect(chainRunPieces('floating', 1)[0].width).toBe(5);
  });

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
});

describe('mushroomEntry / mushroomHasCap', () => {
  it('mushroomEntry-eachRole-resolvesToItsDocumentedCrop', () => {
    expect(mushroomEntry('only')).toEqual({ sx: 0, sy: 0 });
    expect(mushroomEntry('top')).toEqual({ sx: 16, sy: 0 });
    expect(mushroomEntry('middle')).toEqual({ sx: 48, sy: 0 });
    expect(mushroomEntry('bottom')).toEqual({ sx: 48, sy: 16 });
  });

  it('mushroomHasCap-onlyAndTop-areTrue', () => {
    expect(mushroomHasCap('only')).toBe(true);
    expect(mushroomHasCap('top')).toBe(true);
  });

  it('mushroomHasCap-middleAndBottom-areFalse', () => {
    expect(mushroomHasCap('middle')).toBe(false);
    expect(mushroomHasCap('bottom')).toBe(false);
  });

  it('MUSHROOM_CAP_SOURCE_HEIGHT-staysWithinThe16pxCell', () => {
    expect(MUSHROOM_CAP_SOURCE_HEIGHT).toBeGreaterThan(0);
    expect(MUSHROOM_CAP_SOURCE_HEIGHT).toBeLessThanOrEqual(TILE_SIZE);
  });
});

describe('isStalactiteTwin', () => {
  it('matchesTheTwinVariantOfStalactiteEntryAtEveryPosition', () => {
    for (let col = 0; col < 20; col++) {
      for (let row = 0; row < 20; row++) {
        const entry = stalactiteEntry(col, row);
        const entryIsTwin = entry.sx === 0 && entry.sy === 19;
        expect(isStalactiteTwin(col, row)).toBe(entryIsTwin);
      }
    }
  });

  it('acrossManyPositions-reachesBothTrueAndFalse', () => {
    const seen = new Set<boolean>();
    for (let col = 0; col < 20; col++) {
      for (let row = 0; row < 20; row++) {
        seen.add(isStalactiteTwin(col, row));
      }
    }
    expect(seen).toEqual(new Set([true, false]));
  });

  it('sameColAndRow-isDeterministic', () => {
    expect(isStalactiteTwin(4, 6)).toBe(isStalactiteTwin(4, 6));
  });
});

describe('TWIN_LEFT_RECT / TWIN_RIGHT_RECT', () => {
  it('splitTheTwinEntryExactlyAtX8', () => {
    expect(TWIN_LEFT_RECT).toEqual({ sx: 0, sy: 19, width: 8, height: 16 });
    expect(TWIN_RIGHT_RECT).toEqual({ sx: 8, sy: 19, width: 8, height: 10 });
  });

  it('shareTheTwinEntryOriginAndTileWidth', () => {
    // Both halves attach to the ceiling at the twin entry's own sy and
    // together span exactly the 16px tile.
    expect(TWIN_LEFT_RECT.sx).toBe(0);
    expect(TWIN_RIGHT_RECT.sx).toBe(TWIN_LEFT_RECT.width);
    expect(TWIN_LEFT_RECT.sy).toBe(TWIN_RIGHT_RECT.sy);
    expect(TWIN_RIGHT_RECT.sx + TWIN_RIGHT_RECT.width).toBe(TILE_SIZE);
    // The left (larger) one is taller than the right (smaller) one.
    expect(TWIN_LEFT_RECT.height).toBeGreaterThan(TWIN_RIGHT_RECT.height);
  });
});
