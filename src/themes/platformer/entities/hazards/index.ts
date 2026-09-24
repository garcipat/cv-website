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
