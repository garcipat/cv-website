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

  it('box-isTheFullTileRegardlessOfFacing', () => {
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      expect(spike.box(hazardAt(facing))).toEqual({
        x: 16,
        y: 32,
        width: RENDERED_TILE_SIZE,
        height: RENDERED_TILE_SIZE,
      });
    }
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
