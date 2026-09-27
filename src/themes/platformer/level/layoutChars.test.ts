import { describe, it, expect } from 'vitest';
import { layoutWidth, walkLayout } from './layoutChars';

describe('layoutWidth', () => {
  it('aJaggedLayout-returnsTheWidestRowsLength', () => {
    expect(layoutWidth(['G', 'GGS', 'GG'])).toBe(3);
  });

  it('anEmptyLayout-returnsZero', () => {
    expect(layoutWidth([])).toBe(0);
  });
});

describe('walkLayout', () => {
  it('aRectangularLayout-visitsEveryCellInReadingOrder', () => {
    const seen: string[] = [];
    walkLayout(['GS', 'RR'], (cell) => seen.push(`${cell.col},${cell.row}:${cell.char}`));
    expect(seen).toEqual(['0,0:G', '1,0:S', '0,1:R', '1,1:R']);
  });

  it('aShortRow-skipsItsMissingTrailingCells', () => {
    const seen: string[] = [];
    walkLayout(['GS', 'R'], (cell) => seen.push(`${cell.col},${cell.row}:${cell.char}`));
    expect(seen).toEqual(['0,0:G', '1,0:S', '0,1:R']);
  });

  it('anEmptyLayout-visitsNothing', () => {
    const seen: unknown[] = [];
    walkLayout([], (cell) => seen.push(cell));
    expect(seen).toEqual([]);
  });
});
