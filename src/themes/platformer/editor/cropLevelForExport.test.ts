import { describe, it, expect } from 'vitest';
import { cropLevelForExport } from './cropLevelForExport';
import { exportLayout } from './exportLayout';
import type { TileChar, BackgroundChar } from '../level/LevelParser';
import type { MarkerGrid } from '../level/LevelData';

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

  it('crops the background to the same sub-rectangle exportLayout used for the foreground, as a string[]', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.', '.'],
      ['.', 'G', 'S', '.'],
      ['.', 'R', 'R', '.'],
      ['.', '.', '.', '.'],
    ];
    // Foreground content's bounding box is rows 1-2, cols 1-2.
    const background: BackgroundChar[][] = [
      ['.', '.', '.', '.'],
      ['.', 'd', '.', '.'],
      ['.', '.', 'c', '.'],
      ['.', '.', '.', '.'],
    ];
    const result = cropLevelForExport(grid, background);
    expect(result.layout).toEqual(['GS', 'RR']);
    expect(result.background).toEqual(['d.', '.c']);
  });

  it('does NOT extend the crop to include background content reaching further right/down than any foreground cell — the layout stays foreground-only', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.', '.', '.'],
      ['.', 'G', '.', '.', '.'],
      ['.', '.', '.', '.', '.'],
    ];
    const background: BackgroundChar[][] = [
      ['.', '.', '.', '.', '.'],
      ['.', '.', '.', 'd', '.'],
      ['.', '.', '.', '.', '.'],
    ];
    const result = cropLevelForExport(grid, background);
    // Layout crops to the single foreground cell — background reaching
    // further out never widens it.
    expect(result.layout).toEqual(['G']);
    expect(result.background).toEqual(['.']);
  });

  it('a background cell missing from a shorter/smaller grid resolves to \'.\' rather than throwing', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.'],
      ['.', 'G', '.'],
      ['.', '.', '.'],
    ];
    const result = cropLevelForExport(grid, []);
    expect(result.layout).toEqual(['G']);
    expect(result.background).toEqual(['.']);
  });

  it("returns ['.'] and an empty background when there is no foreground content at all", () => {
    const grid: TileChar[][] = [
      ['.', '.'],
      ['.', '.'],
    ];
    const background: BackgroundChar[][] = [['.', 'd']];
    const result = cropLevelForExport(grid, background);
    expect(result.layout).toEqual(['.']);
    expect(result.background).toEqual([]);
  });

  it('returns a single-row all-empty background when the background grid itself is empty', () => {
    const grid: TileChar[][] = [['G']];
    expect(cropLevelForExport(grid, [])).toEqual({
      layout: ['G'],
      background: ['.'],
      markers: [],
    });
  });

  it('aMarkerOnAnEmptyCell-expandsTheCropBoxAndSurvives', () => {
    const grid: TileChar[][] = [['G', '.']];
    const markers: MarkerGrid = [[null, { kind: 'patrolBoundary' }]];
    const result = cropLevelForExport(grid, [], markers);
    expect(result.layout).toEqual(['G.']);
    expect(result.markers).toEqual([{ col: 1, row: 0, marker: { kind: 'patrolBoundary' } }]);
  });

  it('markers-areSerializedRelativeToTheCropOrigin', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.'],
      ['.', 'G', '.'],
      ['.', '.', '.'],
    ];
    const markers: MarkerGrid = [
      [null, null, null],
      [null, null, { kind: 'connectionPoint' }],
      [null, null, null],
    ];
    const result = cropLevelForExport(grid, [], markers);
    expect(result.layout).toEqual(['G.']);
    // The marker sits at grid (2,1); the crop origin is (1,1), so it is (1,0).
    expect(result.markers).toEqual([{ col: 1, row: 0, marker: { kind: 'connectionPoint' } }]);
  });

  it('anAllEmptyLevel-exportsAnEmptyMarkerList', () => {
    const result = cropLevelForExport(
      [
        ['.', '.'],
        ['.', '.'],
      ],
      [],
    );
    expect(result.markers).toEqual([]);
  });
});
