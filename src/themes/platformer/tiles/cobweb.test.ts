import { describe, it, expect } from 'vitest';
import { COBWEB_CORNER_ENTRY, COBWEB_FLAT_ENTRY } from './cobweb';

const DECORATIONS_SHEET_WIDTH = 67;
const DECORATIONS_SHEET_HEIGHT = 35;
const TILE_SIZE = 16;

describe('cobweb entries', () => {
  it('cornerAndFlat-resolveToRectsInsideTheDecorationsSheet', () => {
    for (const entry of [COBWEB_CORNER_ENTRY, COBWEB_FLAT_ENTRY]) {
      expect(entry.sx + (entry.width ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_WIDTH);
      expect(entry.sy + (entry.height ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_HEIGHT);
    }
    expect(COBWEB_CORNER_ENTRY).not.toEqual(COBWEB_FLAT_ENTRY);
  });
});
