import { describe, it, expect } from 'vitest';
import { blueprintFits } from './blueprintFit';
import { blueprintCells } from './blueprintCells';
import type { TileChar } from '../level/LevelParser';

const EMPTY_3X3: TileChar[][] = [
  ['.', '.', '.'],
  ['.', '.', '.'],
  ['.', '.', '.'],
];

// Inferred as `readonly BlueprintCell[]` — no annotation, so this file never
// has to name a type it does not otherwise import.
const WALL = blueprintCells(['##']);

describe('blueprintFits', () => {
  it('everyTargetCellEmpty-fits', () => {
    expect(blueprintFits(EMPTY_3X3, WALL, 1, 1)).toBe(true);
  });

  it('aTargetCellHoldingTerrain-doesNotFit', () => {
    const grid: TileChar[][] = [
      ['.', '.', 'G'],
      ['.', '.', '.'],
      ['.', '.', '.'],
    ];

    // Anchored at (col 1, row 0) the two wall cells land on (0,1) and (0,2);
    // (0,2) already holds 'G'.
    expect(blueprintFits(grid, WALL, 1, 0)).toBe(false);
  });

  it('targetCellsEntirelyOutOfBounds-fitBecauseGrowthIsFree', () => {
    // Out of bounds is not a collision: committing grows the grid there,
    // exactly as painting there would (design, Step 44c — Placement).
    expect(blueprintFits(EMPTY_3X3, WALL, -5, -5)).toBe(true);
  });

  it('partlyOutOfBoundsWithTheInBoundsPartEmpty-fits', () => {
    // Anchored at (col -1, row 0): (0,-1) is out of bounds, (0,0) is empty.
    expect(blueprintFits(EMPTY_3X3, WALL, -1, 0)).toBe(true);
  });

  it('partlyOutOfBoundsWithTheInBoundsPartOccupied-doesNotFit', () => {
    const grid: TileChar[][] = [
      ['G', '.', '.'],
      ['.', '.', '.'],
      ['.', '.', '.'],
    ];

    expect(blueprintFits(grid, WALL, -1, 0)).toBe(false);
  });

  it('theBlueprintsOwnEmptyCells-areNeverChecked', () => {
    // The blueprint's (0,0) is '.', so the 'G' underneath it is irrelevant —
    // padding is not an overlap.
    const grid: TileChar[][] = [
      ['G', '.'],
      ['.', '.'],
    ];

    expect(blueprintFits(grid, blueprintCells(['.#']), 0, 0)).toBe(true);
  });

  it('aConnectionPointMarkerInTheBlueprint-writesNoTerrainCell', () => {
    // A connection point is a marker on the tile meta layer now, not a terrain
    // character — a layout that is only a connection point has no terrain
    // cells to place, so it fits anywhere (its marker is stamped separately).
    expect(blueprintCells(['+'])).toEqual([]);
    expect(blueprintFits([['G']], blueprintCells(['+']), 0, 0)).toBe(true);
  });

  it('markersInTheTargetGrid-neverBlockAPlacement', () => {
    // Placement validity is terrain-only (FR-019): blueprintFits never sees
    // the marker grid, so a marker alone can never block a placement.
    expect(blueprintFits(EMPTY_3X3, WALL, 0, 0)).toBe(true);
  });

  it('aBlueprintWithNoCellsAtAll-fitsAnywhere', () => {
    expect(blueprintFits([['G']], blueprintCells(['..']), 0, 0)).toBe(true);
  });
});
