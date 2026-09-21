import { describe, it, expect } from 'vitest';
import { floorSpike } from './FloorSpike';
import { SIDE_HIT_DAMAGE } from '../Health';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';
import type { HazardPlacement } from '../../level/HazardMapper';
import type { FloorSpikePhase } from '../../engine/FloorSpike';

function hazardAt(phase: FloorSpikePhase | undefined): HazardPlacement {
  return { id: 'h1', hazardType: 'floorSpike', facing: 'up', x: 16, y: 32, floorSpikePhase: phase };
}

describe('floorSpike', () => {
  it('key-isFloorSpike', () => {
    expect(floorSpike.key).toBe('floorSpike');
  });

  it('damage-isOneHalfHeartSameAsTheStaticSpike', () => {
    expect(floorSpike.damage).toBe(SIDE_HIT_DAMAGE);
  });
});

describe('floorSpike.box', () => {
  const BAND = 10; // BAND_NATIVE (5) * RENDER_SCALE (2), same as Spike.ts

  it.each([undefined, 'atRest', 'delay', 'warning', 'retracting'] as const)(
    'phase %s-isEmptyAndNonHazardous',
    (phase) => {
      expect(floorSpike.box(hazardAt(phase))).toEqual({ x: 16, y: 32, width: 0, height: 0 });
    },
  );

  it('fullExtend-isTheBottomBandOnlySameAsAStaticUpFacingSpike', () => {
    expect(floorSpike.box(hazardAt('fullExtend'))).toEqual({
      x: 16,
      y: 32 + RENDERED_TILE_SIZE - BAND,
      width: RENDERED_TILE_SIZE,
      height: BAND,
    });
  });
});
