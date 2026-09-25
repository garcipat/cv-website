import { spike } from './Spike';
import { spear } from './Spear';
import { floorSpike } from './FloorSpike';
import { fallingStalactite } from './FallingStalactite';
import type { HazardType } from './HazardType';
import type { HazardPlacement } from '../../level/HazardMapper';

/** Every hazard kind in the game, derived from the registry. Adding one is one
 *  line here plus its module — nothing else in the codebase changes. */
export const HAZARD_TYPES = { spike, spear, floorSpike, fallingStalactite };

export type HazardKind = keyof typeof HAZARD_TYPES;

/** The module owning `hazard` — same cast convention as entities/enemies/
 *  index.ts's typeOf, for the same reason (HAZARD_TYPES is heterogeneous
 *  once a second kind is added). */
export function typeOf(hazard: HazardPlacement): HazardType<HazardPlacement> {
  return HAZARD_TYPES[hazard.hazardType as HazardKind] as unknown as HazardType<HazardPlacement>;
}

// The merged hazard state machines live in (and are re-exported from) their
// owning kind modules — a kind is one self-contained module (FR-011). No
// orphan `phases.ts` re-export remains.
export {
  armFloorSpike,
  advanceFloorSpikes,
  floorSpikePhaseAt,
  floorSpikePhaseFor,
  isFloorSpikeArmed,
  floorSpikeExtensionAt,
  floorSpikeExtensionFor,
  FLOOR_SPIKE_DELAY_SECONDS,
  FLOOR_SPIKE_WARNING_SECONDS,
  FLOOR_SPIKE_FULL_EXTEND_SECONDS,
  FLOOR_SPIKE_RETRACT_SECONDS,
  FLOOR_SPIKE_CYCLE_SECONDS,
} from './FloorSpike';
export type { FloorSpikePhase, FloorSpikeTimerState } from './FloorSpike';

export {
  armFallingStalactite,
  advanceFallingStalactites,
  isFallingStalactiteArmed,
  fallingStalactiteElapsedFor,
  fallingStalactiteOffsetYAt,
  fallingStalactiteShakeOffsetXAt,
  fallingStalactiteLandingRow,
  fallingStalactiteSpriteHeight,
  fallingStalactiteRestOffsetY,
  fallingStalactitePhaseFor,
  fallingStalactiteShatter,
  detectionZoneCells,
  FALLING_STALACTITE_SHAKE_SECONDS,
  FALLING_STALACTITE_FALL_SPEED,
  FALLING_STALACTITE_MAX_DETECTION_DEPTH,
  FALLING_STALACTITE_ZONE_HALF_WIDTH,
} from './FallingStalactite';
export type { FallingStalactitePhase, FallingStalactiteTimerState } from './FallingStalactite';
