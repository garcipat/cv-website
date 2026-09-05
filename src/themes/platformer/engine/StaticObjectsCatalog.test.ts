import { describe, it, expect } from 'vitest';
import { bushOrTreeEntry, staticObjectEntry, chainRunPieces } from './StaticObjectsCatalog';
import type { ChainAttachment } from '../level/Terrain';

// Bush/tree art comes from world_tileset.png (256x256); fence art comes from
// the separate staticObjects.png (288x144) — two different sheets, so each
// gets its own bounds check.
const TILESET_SHEET_WIDTH = 256;
const TILESET_SHEET_HEIGHT = 256;
const STATIC_OBJECTS_SHEET_WIDTH = 288;
const STATIC_OBJECTS_SHEET_HEIGHT = 144;
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
});
