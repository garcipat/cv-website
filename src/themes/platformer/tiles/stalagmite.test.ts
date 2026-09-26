import { describe, it, expect } from 'vitest';
import { stalagmiteEntry } from './stalagmite';

const DECORATIONS_SHEET_WIDTH = 67;
const DECORATIONS_SHEET_HEIGHT = 35;
const TILE_SIZE = 16;

describe('stalagmiteEntry', () => {
  it('resolvesToARectInsideTheDecorationsSheetForEveryPosition', () => {
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 8; row++) {
        const entry = stalagmiteEntry(col, row);
        expect(entry.sx + (entry.width ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_WIDTH);
        expect(entry.sy + (entry.height ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_HEIGHT);
      }
    }
  });

  it('sameColAndRow-isDeterministic', () => {
    expect(stalagmiteEntry(4, 6)).toEqual(stalagmiteEntry(4, 6));
  });

  it('acrossManyPositions-reachesBothSizeVariants', () => {
    const seen = new Set<string>();
    for (let col = 0; col < 20; col++) {
      for (let row = 0; row < 20; row++) {
        const entry = stalagmiteEntry(col, row);
        seen.add(`${entry.sx},${entry.sy}`);
      }
    }
    expect(seen.size).toBe(2);
  });
});
