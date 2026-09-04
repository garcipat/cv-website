import { describe, it, expect } from 'vitest';
import { cropLevelForExport } from './cropLevelForExport';
import { exportLayout } from './exportLayout';
import type { TileChar } from '../level/LevelParser';
import type { BackgroundPieceId } from '../level/LevelData';

describe('cropLevelForExport', () => {
  it('crops the layout exactly like exportLayout, foreground content only', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.', '.'],
      ['.', 'G', 'S', '.'],
      ['.', 'R', 'R', '.'],
      ['.', '.', '.', '.'],
    ];
    expect(cropLevelForExport(grid, []).layout).toEqual(exportLayout(grid));
    expect(cropLevelForExport(grid, []).layout).toEqual(['GS', 'RR']);
  });

  it('rebases a background placement by the same origin the foreground crop used, when it sits inside the foreground bounds', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.', '.'],
      ['.', 'G', 'S', '.'],
      ['.', 'R', 'R', '.'],
      ['.', '.', '.', '.'],
    ];
    // Foreground content's bounding box starts at (row 1, col 1) — that's
    // the origin exportLayout crops to.
    const result = cropLevelForExport(grid, [
      { pieceId: 'dirtColumnTop1x1', col: 1, row: 1 },
    ]);
    expect(result.layout).toEqual(['GS', 'RR']);
    expect(result.background).toEqual([{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }]);
  });

  it('does NOT extend the crop to include a background placement reaching further right/down than any foreground cell — the layout stays foreground-only', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.', '.', '.'],
      ['.', 'G', '.', '.', '.'],
      ['.', '.', '.', '.', '.'],
    ];
    const result = cropLevelForExport(grid, [
      { pieceId: 'dirtBlock3x3', col: 2, row: 0 },
    ]);
    // Layout crops to the single foreground cell — background's footprint
    // reaching further out never widens it.
    expect(result.layout).toEqual(['G']);
    // Still rebased by the foreground-only origin (row 1, col 1) even though
    // that leaves the placement's row negative — expected, not clamped.
    expect(result.background).toEqual([{ pieceId: 'dirtBlock3x3', col: 1, row: -1 }]);
  });

  it('allows a rebased background placement to end up with a negative col/row without clamping or erroring', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.'],
      ['.', 'G', '.'],
      ['.', '.', '.'],
    ];
    // Placement anchored left of and above the foreground's own bounding box.
    const result = cropLevelForExport(grid, [
      { pieceId: 'dirtColumnTop1x1', col: 0, row: 0 },
    ]);
    expect(result.layout).toEqual(['G']);
    expect(result.background).toEqual([{ pieceId: 'dirtColumnTop1x1', col: -1, row: -1 }]);
  });

  it('does not need to resolve pieceId at all for the crop — an unresolvable (stale) pieceId is rebased the same as any other, never crashing', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.'],
      ['.', 'G', '.'],
      ['.', '.', '.'],
    ];
    const result = cropLevelForExport(grid, [
      { pieceId: 'notARealPieceId' as BackgroundPieceId, col: 5, row: 5 },
    ]);
    expect(result.layout).toEqual(['G']);
    expect(result.background).toEqual([{ pieceId: 'notARealPieceId', col: 4, row: 4 }]);
  });

  it('returns [\'.\'] and leaves background placements unshifted when there is no foreground content at all', () => {
    const grid: TileChar[][] = [
      ['.', '.'],
      ['.', '.'],
    ];
    const result = cropLevelForExport(grid, [
      { pieceId: 'dirtColumnTop1x1', col: 3, row: 4 },
    ]);
    expect(result.layout).toEqual(['.']);
    // No foreground bounding box to rebase against — the placement passes
    // through untouched rather than being shifted by an arbitrary origin.
    expect(result.background).toEqual([{ pieceId: 'dirtColumnTop1x1', col: 3, row: 4 }]);
  });

  it('returns an empty background array when there are no placements at all', () => {
    const grid: TileChar[][] = [['G']];
    expect(cropLevelForExport(grid, [])).toEqual({ layout: ['G'], background: [] });
  });
});
