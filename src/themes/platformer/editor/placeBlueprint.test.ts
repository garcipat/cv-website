import { describe, it, expect } from 'vitest';
import {
  placeBlueprint,
  placeBlueprintMarkers,
  blueprintMarkers,
  rebaseBlueprintBackground,
} from './placeBlueprint';
import { blueprintCells } from './blueprintCells';
import type { TileChar, BackgroundChar } from '../level/LevelParser';
import type { MarkerGrid } from '../level/LevelData';

const EMPTY_3X3: TileChar[][] = [
  ['.', '.', '.'],
  ['.', '.', '.'],
  ['.', '.', '.'],
];

describe('placeBlueprint — fully in bounds', () => {
  // Fixture A: a 3x3 grid, the blueprint ['##','#.'] anchored at (col 1, row 1).
  // Its cells are (0,0), (0,1) and (1,0) — (1,1) is '.' and is not a cell.
  // Absolute targets are (1,1), (1,2) and (2,1), all inside 3x3, so both
  // growGrid calls are no-ops and both shifts are 0.
  const cells = blueprintCells(['##', '#.']);

  it('everyCellInBounds-writesThemAtTheAnchorWithNoShift', () => {
    const result = placeBlueprint(EMPTY_3X3, cells, 1, 1);

    expect(result.colShift).toBe(0);
    expect(result.rowShift).toBe(0);
    expect(result.grid).toEqual([
      ['.', '.', '.'],
      ['.', '#', '#'],
      ['.', '#', '.'],
    ]);
  });

  it('theBlueprintsOwnEmptyCells-areNotWritten', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.'],
      ['.', '.', '.'],
      ['.', '.', 'G'],
    ];

    // The blueprint's (1,1) is '.', which lands on the 'G' at (2,2) — placing
    // must leave it exactly where it is.
    expect(placeBlueprint(grid, cells, 1, 1).grid[2][2]).toBe('G');
  });

  it('doesNotMutateTheGridItWasGiven', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.'],
      ['.', '.', '.'],
      ['.', '.', '.'],
    ];

    placeBlueprint(grid, cells, 1, 1);

    expect(grid).toEqual(EMPTY_3X3);
  });
});

describe('placeBlueprint — growing left and up', () => {
  // Fixture B: a 1x1 grid holding 'G', the blueprint ['##'] anchored at
  // (col -1, row -1). Absolute cols -1..0, row -1.
  //   growGrid(grid, -1, -1) -> growLeft 1, growTop 1, growRight 0, growBottom 0
  //     -> a 2-wide x 2-high grid, colShift 1, rowShift 1.
  //   growGrid(that, maxCol + 1 = 0 + 1 = 1, maxRow + 1 = -1 + 1 = 0) -> both in
  //     bounds -> unchanged, shifts 0. Totals stay (1, 1).
  //   cell (0,0) -> (0 + -1 + 1, 0 + -1 + 1) = (0,0)
  //   cell (0,1) -> (0 + -1 + 1, 1 + -1 + 1) = (0,1)
  const cells = blueprintCells(['##']);

  it('anchoredPastTheTopLeftCorner-growsAndReportsBothShifts', () => {
    const result = placeBlueprint([['G']], cells, -1, -1);

    expect(result.colShift).toBe(1);
    expect(result.rowShift).toBe(1);
    expect(result.grid).toEqual([
      ['#', '#'],
      ['.', 'G'],
    ]);
  });
});

describe('placeBlueprint — growing right and down', () => {
  // Fixture C: a 1x1 grid holding 'G', the blueprint ['##'] anchored at
  // (col 1, row 1). Absolute row 1, cols 1..2.
  //   growGrid(grid, minCol 1, minRow 1) -> growRight 1-1+1 = 1,
  //     growBottom 1-1+1 = 1 -> 2 wide x 2 high, shifts 0.
  //   growGrid(that, maxCol + 0 = 2, maxRow + 0 = 1) -> width is 2, so
  //     growRight 2-2+1 = 1 -> 3 wide x 2 high, shifts 0.
  //   This second grow is the whole point: without it, column 2 is out of
  //   bounds and the bulk write index-errors.
  const cells = blueprintCells(['##']);

  it('anchoredPastTheBottomRightCorner-growsFarEnoughForTheWholeRoom', () => {
    const result = placeBlueprint([['G']], cells, 1, 1);

    expect(result.colShift).toBe(0);
    expect(result.rowShift).toBe(0);
    expect(result.grid).toEqual([
      ['G', '.', '.'],
      ['.', '#', '#'],
    ]);
  });
});

describe('placeBlueprint — markers', () => {
  it('connectionPointMarkers-areStampedAtTheAnchor', () => {
    const markers: MarkerGrid = [[null, null], [null, null]];
    const result = placeBlueprintMarkers(
      markers,
      [{ row: 0, col: 0, marker: { kind: 'connectionPoint' } }],
      1,
      1,
    );
    expect(result[1][1]).toEqual({ kind: 'connectionPoint' });
  });

  it('anExistingMarkerAtTheTarget-isReplaced', () => {
    const markers: MarkerGrid = [[{ kind: 'patrolBoundary' }]];
    const result = placeBlueprintMarkers(
      markers,
      [{ row: 0, col: 0, marker: { kind: 'connectionPoint' } }],
      0,
      0,
    );
    expect(result[0][0]).toEqual({ kind: 'connectionPoint' });
  });

  it('aSmallerMarkerGrid-isPaddedToFitThePlacement', () => {
    const result = placeBlueprintMarkers(
      [],
      [{ row: 2, col: 3, marker: { kind: 'fallingStalactite' } }],
      0,
      0,
    );
    expect(result).toHaveLength(3);
    expect(result[2][3]).toEqual({ kind: 'fallingStalactite' });
  });

  it('blueprintMarkers-liftsALegacyLayoutMarkerAndItsStoredMarkers', () => {
    expect(
      blueprintMarkers({ id: 'r', name: 'Room', layout: ['P.'] }),
    ).toEqual([{ row: 0, col: 0, marker: { kind: 'patrolBoundary' } }]);

    expect(
      blueprintMarkers({
        id: 'r',
        name: 'Room',
        layout: ['.'],
        markers: [{ col: 0, row: 0, marker: { kind: 'connectionPoint' } }],
      }),
    ).toEqual([{ row: 0, col: 0, marker: { kind: 'connectionPoint' } }]);
  });

  it('aBlueprintWithNoCells-leavesTheGridExactlyAsItWas', () => {
    const grid: TileChar[][] = [['G']];

    const result = placeBlueprint(grid, blueprintCells(['..']), 5, 5);

    expect(result).toEqual({ grid, colShift: 0, rowShift: 0 });
  });
});

describe('rebaseBlueprintBackground', () => {
  it('stampsTheBlueprintsBackgroundAtTheGivenOffsetWithinAnAlreadyBigEnoughTarget', () => {
    const target: BackgroundChar[][] = [
      ['.', '.', '.'],
      ['.', '.', '.'],
    ];
    const result = rebaseBlueprintBackground(target, [['d']], 1, 1);
    expect(result).toEqual([
      ['.', '.', '.'],
      ['.', 'd', '.'],
    ]);
  });

  it('emptyCellsInTheBlueprintsBackground-leaveTheTargetsExistingContentUntouched', () => {
    const target: BackgroundChar[][] = [['c', '.']];
    const result = rebaseBlueprintBackground(target, [['.', 'd']], 0, 0);
    expect(result).toEqual([['c', 'd']]);
  });

  it('emptyBlueprintBackground-returnsTheTargetUnchanged', () => {
    const target: BackgroundChar[][] = [['d']];
    expect(rebaseBlueprintBackground(target, [], 3, 2)).toBe(target);
  });

  it('blueprintBackgroundOfOnlyEmptyCells-returnsTheTargetUnchanged', () => {
    const target: BackgroundChar[][] = [['d']];
    expect(rebaseBlueprintBackground(target, [['.', '.']], 3, 2)).toBe(target);
  });

  it('offsetPastTheTargetsRightOrBottomEdge-growsTheTargetToFit', () => {
    const target: BackgroundChar[][] = [['d']];
    const result = rebaseBlueprintBackground(target, [['c']], 2, 1);
    expect(result).toEqual([
      ['d', '.', '.'],
      ['.', '.', 'c'],
    ]);
  });

  it('negativeOffset-growsAndShiftsTheTargetsExistingContentIntoTheNewOrigin', () => {
    const target: BackgroundChar[][] = [['d']];
    const result = rebaseBlueprintBackground(target, [['c']], -1, -1);
    expect(result).toEqual([
      ['c', '.'],
      ['.', 'd'],
    ]);
  });

  it('doesNotMutateTheTargetItWasGiven', () => {
    const target: BackgroundChar[][] = [['d']];
    rebaseBlueprintBackground(target, [['c']], 0, 0);
    expect(target).toEqual([['d']]);
  });
});
