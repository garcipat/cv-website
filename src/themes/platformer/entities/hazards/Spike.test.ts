import { spike } from './Spike';
import { SIDE_HIT_DAMAGE } from '../Health';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';
import type { HazardPlacement } from '../../level/HazardMapper';

function hazardAt(facing: HazardPlacement['facing']): HazardPlacement {
  return { id: 'h1', hazardType: 'spike', facing, x: 16, y: 32 };
}

describe('spike', () => {
  it('key-isSpike', () => {
    expect(spike.key).toBe('spike');
  });

  it('damage-isOneHalfHeartSameAsAnyOtherHit', () => {
    expect(spike.damage).toBe(SIDE_HIT_DAMAGE);
  });

  // Each facing's hitbox is only the band of the tile its visible spikes
  // actually occupy (measured directly from staticObjects.png: 5 of the
  // tile's 16 native px, i.e. 10 of its 32 rendered px, anchored to the
  // edge the tip points away from) — not the full tile. A player passing
  // through the rest of the cell (e.g. jumping well clear of a floor
  // spike's tip) never takes damage.
  const BAND = 10;

  it('up-hitboxIsTheBottomBandOnly', () => {
    expect(spike.box(hazardAt('up'))).toEqual({
      x: 16,
      y: 32 + RENDERED_TILE_SIZE - BAND,
      width: RENDERED_TILE_SIZE,
      height: BAND,
    });
  });

  it('down-hitboxIsTheTopBandOnly', () => {
    expect(spike.box(hazardAt('down'))).toEqual({ x: 16, y: 32, width: RENDERED_TILE_SIZE, height: BAND });
  });

  it('right-hitboxIsTheLeftBandOnly', () => {
    // Mounted on a wall to the left, sticking out only partway — the
    // visible spikes are the LEFT band of the tile, nearest that wall.
    expect(spike.box(hazardAt('right'))).toEqual({ x: 16, y: 32, width: BAND, height: RENDERED_TILE_SIZE });
  });

  it('left-hitboxIsTheRightBandOnly', () => {
    expect(spike.box(hazardAt('left'))).toEqual({
      x: 16 + RENDERED_TILE_SIZE - BAND,
      y: 32,
      width: BAND,
      height: RENDERED_TILE_SIZE,
    });
  });
});

describe('spike facing sprite coordinates', () => {
  // Pins the 4 facings against the actual pre-drawn art in
  // staticObjects.png (columns 3-4, rows 6-7, 16px native tiles) confirmed
  // against the real asset before this plan was written — a regression here
  // would silently swap which facing shows which sprite.
  it.each([
    ['up', 48, 112],
    ['down', 64, 96],
    ['left', 64, 112],
    ['right', 48, 96],
  ] as const)('%s-mapsToTheConfirmedSpriteCoordinates', (facing, sx, sy) => {
    expect(spike.spriteCoords(facing)).toEqual({ sx, sy });
  });
});
