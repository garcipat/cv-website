import { placeSigns, signBox } from './SignMapper';
import { tileToPixel, RENDERED_TILE_SIZE } from './Terrain';
import type { SignPlacement } from './SignMapper';

describe('placeSigns', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(placeSigns([])).toEqual([]);
  });

  it('oneMarker-returnsSignPlacementAtItsPixelPosition', () => {
    const result = placeSigns([{ col: 1, row: 1, hintId: 'bridgeDropThrough' }]);
    const { x, y } = tileToPixel(1, 1);
    expect(result).toEqual([{ id: 'sign-bridgeDropThrough-1-1', hintId: 'bridgeDropThrough', x, y }]);
  });

  it('twoMarkersOfTheSameHint-getDistinctIds', () => {
    const result = placeSigns([
      { col: 0, row: 0, hintId: 'bridgeDropThrough' },
      { col: 1, row: 1, hintId: 'bridgeDropThrough' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].id).not.toBe(result[1].id);
    expect(result.every((s) => s.hintId === 'bridgeDropThrough')).toBe(true);
  });
});

describe('signBox', () => {
  it('sign-returnsOneRenderedTileSquareAtItsPosition', () => {
    const sign: SignPlacement = { id: 'sign-bridgeDropThrough-1-1', hintId: 'bridgeDropThrough', x: 100, y: 100 };
    expect(signBox(sign)).toEqual({ x: 100, y: 100, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE });
  });
});
