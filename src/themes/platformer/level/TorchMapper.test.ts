import { describe, expect, it } from 'vitest';
import { placeTorches } from './TorchMapper';
import { tileToPixel, RENDERED_TILE_SIZE } from './Terrain';
import { DEFAULT_TORCH_STRENGTH } from '../tiles/torch';
import type { MarkerGrid } from './LevelData';

const tile = (col: number, row: number) => ({ col, row });

describe('placeTorches', () => {
  it('noMarkerLayer-yieldsTheDefaultStrength', () => {
    // Arrange / Act
    const placements = placeTorches([tile(2, 3)], {});

    // Assert
    expect(placements).toHaveLength(1);
    expect(placements[0].strength).toBe(DEFAULT_TORCH_STRENGTH);
    expect(placements[0].strength).toBe(5);
  });

  it('torchMarker-yieldsItsOwnStrength', () => {
    // Arrange
    const markers: MarkerGrid = [];
    markers[3] = [];
    markers[3][2] = { kind: 'torch', strength: 8 };

    // Act
    const placements = placeTorches([tile(2, 3)], { markers });

    // Assert
    expect(placements[0].strength).toBe(8);
  });

  it('anyTile-yieldsItsCentrePixel', () => {
    // Arrange
    const expected = tileToPixel(4, 5);

    // Act
    const placements = placeTorches([tile(4, 5)], {});

    // Assert
    expect(placements[0]).toMatchObject({ col: 4, row: 5 });
    expect(placements[0].x).toBe(expected.x + RENDERED_TILE_SIZE / 2);
    expect(placements[0].y).toBe(expected.y + RENDERED_TILE_SIZE / 2);
  });

  it('unknownMarkerKind-yieldsTheDefaultAndDoesNotThrow', () => {
    // Arrange
    const markers: MarkerGrid = [];
    markers[1] = [];
    markers[1][1] = { kind: 'patrolBoundary' };

    // Act
    const placements = placeTorches([tile(1, 1)], { markers });

    // Assert
    expect(placements[0].strength).toBe(DEFAULT_TORCH_STRENGTH);
  });

  it('otherMarkerKinds-contributeNoExtraPlacements', () => {
    // Arrange — a dense marker layer with one torch and several non-torches.
    const markers: MarkerGrid = [];
    markers[0] = [
      { kind: 'sign', hintId: 'bomb' },
      { kind: 'torch', strength: 3 },
    ];
    markers[1] = [{ kind: 'connectionPoint' }, { kind: 'fallingStalactite' }];

    // Act
    const placements = placeTorches([tile(1, 0)], { markers });

    // Assert
    expect(placements).toHaveLength(1);
    expect(placements[0].strength).toBe(3);
  });

  it('emptyTileList-yieldsAnEmptyList', () => {
    // Arrange / Act / Assert
    expect(placeTorches([], {})).toEqual([]);
  });

  it('called-doesNotMutateItsArguments', () => {
    // Arrange
    const tiles = [tile(1, 1), tile(2, 2)];
    const markers: MarkerGrid = [];
    markers[1] = [{ kind: 'torch', strength: 7 }];
    const tilesBefore = structuredClone(tiles);
    const markersBefore = structuredClone(markers);

    // Act
    placeTorches(tiles, { markers });

    // Assert
    expect(tiles).toEqual(tilesBefore);
    expect(markers).toEqual(markersBefore);
  });

  it('severalTiles-preservesInputOrder', () => {
    // Arrange / Act
    const placements = placeTorches([tile(3, 0), tile(1, 0), tile(2, 0)], {});

    // Assert
    expect(placements.map((placement) => placement.col)).toEqual([3, 1, 2]);
  });
});
