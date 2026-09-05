import { placeHazards } from './HazardMapper';
import { RENDERED_TILE_SIZE } from './Terrain';

describe('placeHazards', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(placeHazards([])).toEqual([]);
  });

  it('oneMarker-placesItAtItsTilePixelPosition', () => {
    const placed = placeHazards([{ col: 2, row: 3, hazardType: 'spike', facing: 'up' }]);
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({
      hazardType: 'spike',
      facing: 'up',
      x: 2 * RENDERED_TILE_SIZE,
      y: 3 * RENDERED_TILE_SIZE,
    });
  });

  it('multipleMarkers-eachGetsADistinctId', () => {
    const placed = placeHazards([
      { col: 0, row: 0, hazardType: 'spike', facing: 'up' },
      { col: 1, row: 0, hazardType: 'spike', facing: 'down' },
    ]);
    expect(new Set(placed.map((h) => h.id)).size).toBe(2);
  });
});
