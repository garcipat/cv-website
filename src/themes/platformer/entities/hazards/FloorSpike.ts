import type { HazardType } from './HazardType';
import type { HazardPlacement } from '../../level/HazardMapper';
import type { FloorSpikePhase } from '../../engine/FloorSpike';
import { FLOOR_SPIKE_SHEET } from '../sprites/sheets';
import { TILE_SIZE, RENDERED_TILE_SIZE, RENDER_SCALE } from '../../level/Terrain';
import { SIDE_HIT_DAMAGE } from '../Health';
import type { Rect } from '../geometry';

/** Same visible-band convention as Spike.ts's BAND_NATIVE for the 'up'
 *  facing — a floor spike is floor-only (FR-013), so it only ever needs
 *  that one band. */
const BAND_NATIVE = 5;

/** The hazardous rect while fully extended — identical to the static
 *  spike's 'up'-facing band (Spike.ts's facingBox). */
function extendedBox(hazard: HazardPlacement): Rect {
  const band = BAND_NATIVE * RENDER_SCALE;
  return {
    x: hazard.x,
    y: hazard.y + RENDERED_TILE_SIZE - band,
    width: RENDERED_TILE_SIZE,
    height: band,
  };
}

/** A zero-size rect at the tile's own position — "no hazardous area here
 *  right now" (design.md: "the hazardous area is absent, rather than
 *  present but harmless", outside the full-extend phase). */
function emptyBox(hazard: HazardPlacement): Rect {
  return { x: hazard.x, y: hazard.y, width: 0, height: 0 };
}

/** `hazard.floorSpikePhase` is only meaningful once PlatformerPage.tsx has
 *  merged the live timer state in for this tick (see PlatformerState.ts's
 *  `hazardPlacementsForTick`); missing/`'atRest'` and every non-hazardous
 *  phase all resolve to the same empty box. */
function floorSpikeBox(hazard: HazardPlacement): Rect {
  return hazard.floorSpikePhase === 'fullExtend' ? extendedBox(hazard) : emptyBox(hazard);
}

/** Sprite row index into FLOOR_SPIKE_SHEET's 3-frame strip (Task 3):
 *  0 = tell (at rest/delay, and the undefined default before any merge),
 *  1 = warning (also reused for retracting — the spike passes back through
 *  the same partial-height pose on its way down), 2 = full-extend. */
function frameIndex(phase: FloorSpikePhase | undefined): number {
  switch (phase) {
    case 'warning':
    case 'retracting':
      return 1;
    case 'fullExtend':
      return 2;
    default:
      return 0;
  }
}

export const floorSpike: HazardType<HazardPlacement> = {
  key: 'floorSpike',
  damage: SIDE_HIT_DAMAGE,
  box: floorSpikeBox,
  draw: (hazard, dc) => {
    const image = dc.sprites[FLOOR_SPIKE_SHEET.src];
    if (!image) return;
    const frame = frameIndex(hazard.floorSpikePhase);
    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      0,
      frame * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
      hazard.x + dc.originX,
      hazard.y + dc.originY,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
  },
};
