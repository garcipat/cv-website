import { describe, it, expect } from 'vitest';
import { placeBackgroundPiece, eraseBackgroundCell } from './paintBackgroundCell';
import type { BackgroundPlacement } from '../level/LevelData';

describe('placeBackgroundPiece', () => {
  it('placingOnAnEmptyList-addsTheSinglePlacement', () => {
    const result = placeBackgroundPiece([], 'dirtColumnTop1x1', 2, 3);
    expect(result).toEqual([{ pieceId: 'dirtColumnTop1x1', col: 2, row: 3 }]);
  });

  it('placingNextToAnExistingPlacement-keepsBothWhenFootprintsDoNotOverlap', () => {
    const existing: BackgroundPlacement[] = [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }];
    // dirtColumnTop1x1 is 1x1 tile, so (5, 0) doesn't overlap it.
    const result = placeBackgroundPiece(existing, 'dirtColumnTop1x1', 5, 0);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 });
    expect(result).toContainEqual({ pieceId: 'dirtColumnTop1x1', col: 5, row: 0 });
  });

  it('placingOverAnExistingPlacementsFootprint-replacesTheExistingOne', () => {
    // dirtBlock3x3 anchored at (0,0) covers cols 0-2, rows 0-2.
    const existing: BackgroundPlacement[] = [{ pieceId: 'dirtBlock3x3', col: 0, row: 0 }];
    const result = placeBackgroundPiece(existing, 'dirtColumnTop1x1', 1, 1);
    expect(result).toEqual([{ pieceId: 'dirtColumnTop1x1', col: 1, row: 1 }]);
  });
});

describe('eraseBackgroundCell', () => {
  it('erasingACellInsideAMultiTilePiecesFootprint-removesTheWholePiece', () => {
    // dirtBlock3x3 anchored at (0,0) covers cols 0-2, rows 0-2.
    const existing: BackgroundPlacement[] = [{ pieceId: 'dirtBlock3x3', col: 0, row: 0 }];
    const result = eraseBackgroundCell(existing, 1, 2);
    expect(result).toEqual([]);
  });

  it('erasingACellWithNoPlacementThere-leavesTheListUnchanged', () => {
    const existing: BackgroundPlacement[] = [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }];
    const result = eraseBackgroundCell(existing, 9, 9);
    expect(result).toEqual(existing);
  });

  it('erasingOneOfSeveralPlacements-removesOnlyThatOne', () => {
    const existing: BackgroundPlacement[] = [
      { pieceId: 'dirtColumnTop1x1', col: 0, row: 0 },
      { pieceId: 'dirtColumnTop1x1', col: 5, row: 0 },
    ];
    const result = eraseBackgroundCell(existing, 5, 0);
    expect(result).toEqual([{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }]);
  });

  it('erasingAtAnUnresolvablePlacementsAnchor-leavesItInPlace', () => {
    // An unknown pieceId has no catalog entry, so its footprint is treated as
    // empty and it never reports as covering its own anchor cell.
    const existing: BackgroundPlacement[] = [
      { pieceId: 'notARealPieceId' as BackgroundPlacement['pieceId'], col: 0, row: 0 },
    ];
    const result = eraseBackgroundCell(existing, 0, 0);
    expect(result).toEqual(existing);
  });
});
