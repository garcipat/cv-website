import { describe, it, expect } from 'vitest';
import { bushOrTreeEntry, staticObjectEntry, chainEntry } from './StaticObjectsCatalog';

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

  it('chainEntry-anyAttachmentAndColumn-resolvesToARectInsideTheSheetOnA16pxGrid', () => {
    for (const attachment of ['ceiling', 'left', 'right'] as const) {
      for (const col of [0, 1, 2, 3]) {
        const entry = chainEntry(attachment, col);
        expect(entry.sx % TILE_SIZE).toBe(0);
        expect(entry.sy % TILE_SIZE).toBe(0);
        expect(entry.sx + TILE_SIZE).toBeLessThanOrEqual(STATIC_OBJECTS_SHEET_WIDTH);
        expect(entry.sy + TILE_SIZE).toBeLessThanOrEqual(STATIC_OBJECTS_SHEET_HEIGHT);
      }
    }
  });

  it('chainEntry-sameAttachmentAndColumn-isDeterministic', () => {
    expect(chainEntry('left', 3)).toEqual(chainEntry('left', 3));
  });

  it('chainEntry-leftAttachment-alwaysPicksALeftLeaningVariant', () => {
    expect(chainEntry('left', 0)).toEqual({ sx: 80, sy: 112 });
    expect(chainEntry('left', 1)).toEqual({ sx: 112, sy: 112 });
  });

  it('chainEntry-rightAttachment-alwaysPicksARightLeaningVariant', () => {
    expect(chainEntry('right', 0)).toEqual({ sx: 96, sy: 112 });
    expect(chainEntry('right', 1)).toEqual({ sx: 128, sy: 112 });
  });

  it('chainEntry-ceilingAttachment-alternatesByColumnParity', () => {
    expect(chainEntry('ceiling', 0)).toEqual({ sx: 80, sy: 112 });
    expect(chainEntry('ceiling', 1)).toEqual({ sx: 128, sy: 112 });
  });

  it('chainEntry-sameColumnDifferentRows-wouldBeIdentical-becauseRowIsNotHashed', () => {
    // Regression pin for the bug this fix corrects: a chain shaft's variant
    // must depend on column only, never row, so every cell of one vertical
    // shaft renders the same sprite. chainEntry doesn't take a row
    // parameter at all — this test just re-states that guarantee for a
    // reader who might otherwise expect row-based variety like
    // bushOrTreeEntry has.
    expect(chainEntry('left', 5)).toEqual(chainEntry('left', 5));
    expect(chainEntry('right', 5)).toEqual(chainEntry('right', 5));
  });
});
