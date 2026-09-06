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

  it('aConnectionPointAlreadyInTheGrid-countsAsOccupiedLikeAnyOtherCell', () => {
    // A placed '+' is ordinary occupied terrain as far as the next placement is
    // concerned; nothing gives it special treatment (design, Goal section).
    expect(blueprintFits([['+']], blueprintCells(['#']), 0, 0)).toBe(false);
  });

  it('aBlueprintsOwnConnectionPoint-stillNeedsAnEmptyTargetCell', () => {
    expect(blueprintFits([['G']], blueprintCells(['+']), 0, 0)).toBe(false);
    expect(blueprintFits([['.']], blueprintCells(['+']), 0, 0)).toBe(true);
  });

  it('aBlueprintWithNoCellsAtAll-fitsAnywhere', () => {
    expect(blueprintFits([['G']], blueprintCells(['..']), 0, 0)).toBe(true);
  });
});
