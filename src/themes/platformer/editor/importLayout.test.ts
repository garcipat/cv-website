import { describe, it, expect } from 'vitest';
import { importLayout } from './importLayout';

describe('importLayout', () => {
  it('converts a single-row layout into a one-row grid of the same characters', () => {
    expect(importLayout(['G.S'])).toEqual([['G', '.', 'S']]);
  });

  it('converts a multi-row layout into a grid with one array per row, top row first', () => {
    const result = importLayout(['.S.', 'GGG']);
    expect(result).toEqual([
      ['.', 'S', '.'],
      ['G', 'G', 'G'],
    ]);
  });

  it('returns an empty array for an empty layout', () => {
    expect(importLayout([])).toEqual([]);
  });
});
