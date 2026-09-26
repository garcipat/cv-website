import { describe, it, expect } from 'vitest';
import {
  stalactiteEntry,
  isStalactiteTwin,
  TWIN_LEFT_RECT,
  TWIN_RIGHT_RECT,
} from './stalactite';

const DECORATIONS_SHEET_WIDTH = 67;
const DECORATIONS_SHEET_HEIGHT = 35;
const TILE_SIZE = 16;

describe('stalactiteEntry', () => {
  it('resolvesToARectInsideTheDecorationsSheetForEveryPosition', () => {
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 8; row++) {
        const entry = stalactiteEntry(col, row);
        expect(entry.sx + (entry.width ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_WIDTH);
        expect(entry.sy + (entry.height ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_HEIGHT);
      }
    }
  });

  it('sameColAndRow-isDeterministic', () => {
    expect(stalactiteEntry(4, 6)).toEqual(stalactiteEntry(4, 6));
  });

  it('acrossManyPositions-reachesBothSizeVariants', () => {
    const seen = new Set<string>();
    for (let col = 0; col < 20; col++) {
      for (let row = 0; row < 20; row++) {
        const entry = stalactiteEntry(col, row);
        seen.add(`${entry.sx},${entry.sy}`);
      }
    }
    expect(seen.size).toBe(2);
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
    // Both halves attach to the ceiling at the twin entry's own sy and together
    // span exactly the 16px tile.
    expect(TWIN_LEFT_RECT.sx).toBe(0);
    expect(TWIN_RIGHT_RECT.sx).toBe(TWIN_LEFT_RECT.width);
    expect(TWIN_LEFT_RECT.sy).toBe(TWIN_RIGHT_RECT.sy);
    expect(TWIN_RIGHT_RECT.sx + TWIN_RIGHT_RECT.width).toBe(TILE_SIZE);
    // The left (larger) one is taller than the right (smaller) one.
    expect(TWIN_LEFT_RECT.height).toBeGreaterThan(TWIN_RIGHT_RECT.height);
  });
});
