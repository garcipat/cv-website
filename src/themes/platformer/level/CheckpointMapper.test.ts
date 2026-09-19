import { placeCheckpoints } from './CheckpointMapper';
import { tileToPixel } from './Terrain';

describe('placeCheckpoints', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(placeCheckpoints([])).toEqual([]);
  });

  it('oneMarker-producesAPlacementWithACellUniqueId', () => {
    const { x, y } = tileToPixel(3, 4);
    expect(placeCheckpoints([{ col: 3, row: 4 }])).toEqual([
      { id: 'checkpoint-3-4', col: 3, row: 4, x, y },
    ]);
  });

  it('multipleMarkers-preservesReadingOrderAndDerivesIdsAndPixels', () => {
    const markers = [
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 2, row: 1 },
    ];
    const placements = placeCheckpoints(markers);

    expect(placements.map((p) => p.id)).toEqual([
      'checkpoint-1-0',
      'checkpoint-0-1',
      'checkpoint-2-1',
    ]);
    placements.forEach((placement, index) => {
      const { x, y } = tileToPixel(markers[index].col, markers[index].row);
      expect(placement.x).toBe(x);
      expect(placement.y).toBe(y);
    });
  });

  it('twoMarkersInDifferentCells-getDistinctIds', () => {
    const ids = placeCheckpoints([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ]).map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
  });
});
