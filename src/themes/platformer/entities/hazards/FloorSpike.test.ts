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

  // box() is NOT phase-gated (see Collision.ts's resolveHazardContacts doc
  // comment) — it's the broad-phase geometric rect every phase shares;
  // isContact (below) is what decides whether an overlap actually counts.
  it.each([undefined, 'atRest', 'delay', 'warning', 'retracting', 'fullExtend'] as const)(
    'phase %s-isAlwaysTheBottomBandSameAsAStaticUpFacingSpike',
    (phase) => {
      expect(floorSpike.box(hazardAt(phase))).toEqual({
        x: 16,
        y: 32 + RENDERED_TILE_SIZE - BAND,
        width: RENDERED_TILE_SIZE,
        height: BAND,
      });
    },
  );
});

describe('floorSpike.isContact', () => {
  it.each([undefined, 'atRest', 'delay', 'warning', 'retracting'] as const)(
    'phase %s-isNotAContact',
    (phase) => {
      expect(floorSpike.isContact!(hazardAt(phase), {} as never, {} as never)).toBe(false);
    },
  );

  it('fullExtend-isAContact', () => {
    expect(floorSpike.isContact!(hazardAt('fullExtend'), {} as never, {} as never)).toBe(true);
  });
});
