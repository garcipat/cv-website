import { hazardBox, placeHazards } from './HazardMapper';
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

describe('hazardBox', () => {
  it('anyFacing-returnsTheFullTileRect', () => {
    // Facing is cosmetic only — every facing's hitbox is the same full tile,
    // touching any part of it damages the player regardless of which face.
    const hazard = { id: 'h1', hazardType: 'spike' as const, facing: 'left' as const, x: 32, y: 48 };
    expect(hazardBox(hazard)).toEqual({ x: 32, y: 48, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE });
  });
});
