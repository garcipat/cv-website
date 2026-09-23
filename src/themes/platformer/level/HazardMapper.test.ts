import { placeHazards } from './HazardMapper';
import type { HazardPlacement } from './HazardMapper';
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

  it('oneMarker-carriesItsGridColAndRow', () => {
    const placed = placeHazards([{ col: 2, row: 3, hazardType: 'spike', facing: 'up' }]);
    expect(placed[0]).toMatchObject({ col: 2, row: 3 });
  });

  it('multipleMarkers-eachGetsADistinctId', () => {
    const placed = placeHazards([
      { col: 0, row: 0, hazardType: 'spike', facing: 'up' },
      { col: 1, row: 0, hazardType: 'spike', facing: 'down' },
    ]);
    expect(new Set(placed.map((h) => h.id)).size).toBe(2);
  });
});

describe('HazardPlacement falling-stalactite merge fields', () => {
  it('acceptsThePhaseFallOffsetAndShakeOffset', () => {
    // Type-level contract: the per-tick merge fields a falling stalactite
    // carries must be optional members of HazardPlacement (O-027).
    const placement: HazardPlacement = {
      id: 'hazard-fallingStalactite-1-2',
      hazardType: 'fallingStalactite',
      facing: 'down',
      x: 0,
      y: 0,
      col: 1,
      row: 2,
      fallingStalactitePhase: 'falling',
      fallingStalactiteOffsetY: 12,
      fallingStalactiteShakeOffsetX: 1,
    };
    expect(placement.fallingStalactitePhase).toBe('falling');
    expect(placement.fallingStalactiteOffsetY).toBe(12);
    expect(placement.fallingStalactiteShakeOffsetX).toBe(1);
  });
});
