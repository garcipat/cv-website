import { describe, it, expect } from 'vitest';
import { importLayout, importBackgroundLayout } from './importLayout';

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

  it('right-pads shorter rows with "." to match the widest row, like parseLevel does', () => {
    const result = importLayout(['GG', 'G', 'GGGG']);
    expect(result).toEqual([
      ['G', 'G', '.', '.'],
      ['G', '.', '.', '.'],
      ['G', 'G', 'G', 'G'],
    ]);
  });

  it('carries the floor spear marker "¦" through literally', () => {
    expect(importLayout(['S¦.', 'GGG'])).toEqual([
      ['S', '¦', '.'],
      ['G', 'G', 'G'],
    ]);
  });
});

describe('importBackgroundLayout', () => {
  it('converts a single-row background layout into a one-row grid of the same characters', () => {
    expect(importBackgroundLayout(['d.c'])).toEqual([['d', '.', 'c']]);
  });

  it('converts a multi-row background layout into a grid with one array per row, top row first', () => {
    const result = importBackgroundLayout(['.d.', 'ccc']);
    expect(result).toEqual([
      ['.', 'd', '.'],
      ['c', 'c', 'c'],
    ]);
  });

  it('returns an empty array for an empty layout', () => {
    expect(importBackgroundLayout([])).toEqual([]);
  });

  it('right-pads shorter rows with "." to match the widest row', () => {
    const result = importBackgroundLayout(['dd', 'd', 'dddd']);
    expect(result).toEqual([
      ['d', 'd', '.', '.'],
      ['d', '.', '.', '.'],
      ['d', 'd', 'd', 'd'],
    ]);
  });

  it('an unrecognized character reads as empty ("."), never carried through literally', () => {
    expect(importBackgroundLayout(['d?c'])).toEqual([['d', '.', 'c']]);
  });
});
