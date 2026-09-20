import { describe, it, expect } from 'vitest';
import { backgroundRockEntry } from './BackgroundDecorCatalog';

// decorations.png is 67x35 (DECORATIONS_SHEET_WIDTH/HEIGHT in
// StaticObjectsCatalog.test.ts) — the same sheet rocks crop from.
const DECORATIONS_SHEET_WIDTH = 67;
const DECORATIONS_SHEET_HEIGHT = 35;
const TILE_SIZE = 16;

describe('backgroundRockEntry', () => {
  it('everyPosition-resolvesToARectInsideTheDecorationsSheetOnA16pxGrid', () => {
    for (let col = 0; col < 20; col++) {
      for (let row = 0; row < 20; row++) {
        const entry = backgroundRockEntry(col, row);
        expect(entry.sx + TILE_SIZE).toBeLessThanOrEqual(DECORATIONS_SHEET_WIDTH);
        expect(entry.sy + TILE_SIZE).toBeLessThanOrEqual(DECORATIONS_SHEET_HEIGHT);
      }
    }
  });

  it('samePosition-isDeterministic', () => {
    expect(backgroundRockEntry(4, 6)).toEqual(backgroundRockEntry(4, 6));
  });
});
