import { spike } from './Spike';
import type { HazardType } from './HazardType';
import type { HazardPlacement } from '../../level/HazardMapper';

/** Every hazard kind in the game. Adding one is one line here plus its
 *  module — nothing else in the codebase changes. */
export const HAZARD_TYPES = { spike };

export type HazardTypeKey = keyof typeof HAZARD_TYPES;

/** The module owning `hazard` — same cast convention as entities/enemies/
 *  index.ts's typeOf, for the same reason (HAZARD_TYPES is heterogeneous
 *  once a second kind is added). Only one member exists today, so the cast
 *  is currently a no-op in practice, but the shape is here so a second
 *  hazard kind costs nothing beyond its own file plus a registry line. */
export function typeOf(hazard: HazardPlacement): HazardType<HazardPlacement> {
  return HAZARD_TYPES[hazard.hazardType as HazardTypeKey] as unknown as HazardType<HazardPlacement>;
}
