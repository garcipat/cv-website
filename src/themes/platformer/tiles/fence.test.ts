import { describe, it, expect } from 'vitest';
import { fenceEntry } from './fence';

// Fence art comes from the separate staticObjects.png (288x144).
const STATIC_OBJECTS_SHEET_WIDTH = 288;
const STATIC_OBJECTS_SHEET_HEIGHT = 144;
const TILE_SIZE = 16;

describe('fenceEntry', () => {
  it('resolvesToARectInsideTheSheetOnA16pxGrid', () => {
    const entry = fenceEntry(0, 0);
    expect(entry.sx % TILE_SIZE).toBe(0);
    expect(entry.sy % TILE_SIZE).toBe(0);
    expect(entry.sx + TILE_SIZE).toBeLessThanOrEqual(STATIC_OBJECTS_SHEET_WIDTH);
    expect(entry.sy + TILE_SIZE).toBeLessThanOrEqual(STATIC_OBJECTS_SHEET_HEIGHT);
  });

  it('ignoresPositionAndAlwaysReturnsTheSameEntry', () => {
    expect(fenceEntry(1, 1)).toEqual(fenceEntry(9, 9));
  });
});
