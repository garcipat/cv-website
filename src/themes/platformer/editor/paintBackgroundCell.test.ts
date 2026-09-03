import { describe, it, expect } from 'vitest';
import { placeBackgroundPiece, eraseBackgroundCell } from './paintBackgroundCell';
import type { BackgroundPlacement } from '../level/LevelData';

describe('placeBackgroundPiece', () => {
  it('placingOnAnEmptyList-addsTheSinglePlacement', () => {
    const result = placeBackgroundPiece([], 'dirtColumnA', 2, 3);
    expect(result).toEqual([{ pieceId: 'dirtColumnA', col: 2, row: 3 }]);
  });

  it('placingNextToAnExistingPlacement-keepsBothWhenFootprintsDoNotOverlap', () => {
    const existing: BackgroundPlacement[] = [{ pieceId: 'dirtColumnA', col: 0, row: 0 }];
    // dirtColumnA is 1x3 tiles, so (5, 0) doesn't overlap it.
    const result = placeBackgroundPiece(existing, 'dirtColumnA', 5, 0);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ pieceId: 'dirtColumnA', col: 0, row: 0 });
    expect(result).toContainEqual({ pieceId: 'dirtColumnA', col: 5, row: 0 });
  });

  it('placingOverAnExistingPlacementsFootprint-replacesTheExistingOne', () => {
    // dirtBlock3x3 anchored at (0,0) covers cols 0-2, rows 0-2.
    const existing: BackgroundPlacement[] = [{ pieceId: 'dirtBlock3x3', col: 0, row: 0 }];
    const result = placeBackgroundPiece(existing, 'dirtColumnA', 1, 1);
    expect(result).toEqual([{ pieceId: 'dirtColumnA', col: 1, row: 1 }]);
  });
});

describe('eraseBackgroundCell', () => {
  it('erasingACellInsideAMultiTilePiecesFootprint-removesTheWholePiece', () => {
    // dirtBlock2x3 anchored at (0,0) covers cols 0-1, rows 0-2.
    const existing: BackgroundPlacement[] = [{ pieceId: 'dirtBlock2x3', col: 0, row: 0 }];
    const result = eraseBackgroundCell(existing, 1, 2);
    expect(result).toEqual([]);
  });

  it('erasingACellWithNoPlacementThere-leavesTheListUnchanged', () => {
    const existing: BackgroundPlacement[] = [{ pieceId: 'dirtColumnA', col: 0, row: 0 }];
    const result = eraseBackgroundCell(existing, 9, 9);
    expect(result).toEqual(existing);
  });

  it('erasingOneOfSeveralPlacements-removesOnlyThatOne', () => {
    const existing: BackgroundPlacement[] = [
      { pieceId: 'dirtColumnA', col: 0, row: 0 },
      { pieceId: 'dirtColumnB', col: 5, row: 0 },
    ];
    const result = eraseBackgroundCell(existing, 5, 1);
    expect(result).toEqual([{ pieceId: 'dirtColumnA', col: 0, row: 0 }]);
  });
});
