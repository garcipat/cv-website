import { describe, it, expect } from 'vitest';
import { blueprintCells } from './blueprintCells';

describe('blueprintCells', () => {
  it('nonEmptyCells-areReturnedWithTheirRowColAndCharacter', () => {
    expect(blueprintCells(['#.', '.G'])).toEqual([
      { row: 0, col: 0, char: '#' },
      { row: 1, col: 1, char: 'G' },
    ]);
  });

  it('emptyCells-areDroppedBecauseTheyAreBoundingBoxPaddingNotContent', () => {
    // A blueprint's '.' cells are the crop's padding around its shape, never
    // "erase this spot" — placing a room must not blank out terrain the target
    // level already had there (design, Step 44c — Placement).
    expect(blueprintCells(['..', '..'])).toEqual([]);
  });

  it('cells-areReturnedInRowMajorOrder', () => {
    expect(blueprintCells(['##', '##']).map(({ row, col }) => `${row},${col}`)).toEqual([
      '0,0',
      '0,1',
      '1,0',
      '1,1',
    ]);
  });

  it('jaggedLayout-isRightPaddedLikeImportLayout-soAShortRowAddsNoCells', () => {
    // exportLayout can produce jagged rows; importLayout right-pads them with
    // '.', which this reuses rather than re-implementing — so the padded cell
    // at (1,1) is padding and contributes nothing.
    expect(blueprintCells(['##', '#'])).toEqual([
      { row: 0, col: 0, char: '#' },
      { row: 0, col: 1, char: '#' },
      { row: 1, col: 0, char: '#' },
    ]);
  });

  it('connectionPointCells-areReturnedLikeAnyOtherCharacter', () => {
    // Placement never treats '+' specially: it is written and it counts as
    // occupied, and nothing reads a facing off it (design, Goal section).
    expect(blueprintCells(['+'])).toEqual([{ row: 0, col: 0, char: '+' }]);
  });
});
