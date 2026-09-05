import { describe, it, expect } from 'vitest';
import { bushOrTreeEntry, staticObjectEntry } from './StaticObjectsCatalog';

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

  it('chain-resolvesToARectInsideTheSheetOnA16pxGrid', () => {
    const entry = staticObjectEntry('chain', 0, 0);
    expect(entry.sx % TILE_SIZE).toBe(0);
    expect(entry.sy % TILE_SIZE).toBe(0);
    expect(entry.sx + TILE_SIZE).toBeLessThanOrEqual(STATIC_OBJECTS_SHEET_WIDTH);
    expect(entry.sy + TILE_SIZE).toBeLessThanOrEqual(STATIC_OBJECTS_SHEET_HEIGHT);
  });

  it('chain-sameColAndRow-isDeterministic', () => {
    expect(staticObjectEntry('chain', 3, 5)).toEqual(staticObjectEntry('chain', 3, 5));
  });

  it('chain-differentPositions-canResolveToDifferentVariants', () => {
    // (0,0) and (1,1) land on different variants of the 4 available (see
    // StaticObjectsCatalog.ts's CHAIN_VARIANTS) — confirms position actually
    // drives variant choice, unlike fence's single-variant array.
    expect(staticObjectEntry('chain', 0, 0)).toEqual({ sx: 80, sy: 112 });
    expect(staticObjectEntry('chain', 1, 1)).toEqual({ sx: 112, sy: 112 });
  });
});
