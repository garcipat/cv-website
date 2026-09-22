import { tileToPixel } from './Terrain';
import type { HazardFacing, HazardKind } from './LevelParser';
import type { FloorSpikePhase } from '../engine/FloorSpike';

export interface HazardPlacement {
  id: string;
  hazardType: HazardKind;
  facing: HazardFacing;
  x: number;
  y: number;
  /** A floor spike's current cycle phase, merged in per-tick by
   *  PlatformerPage.tsx from `floorSpikeTimerStates` — `undefined` for
   *  every other hazard kind and for a floor spike before its first
   *  per-tick merge. `floorSpike.box()`/`.draw()` treat a missing value the
   *  same as `'atRest'`. */
  floorSpikePhase?: FloorSpikePhase;
  /** A floor spike's continuous 0..1 rise/fall ratio for this tick — the
   *  render-only counterpart to `floorSpikePhase` (see
   *  `engine/FloorSpike.ts`'s `floorSpikeExtensionAt`). `undefined`/missing
   *  is treated as 0 (nothing risen). */
  floorSpikeExtension?: number;
}

/**
 * Places a `HazardPlacement` at every hand-authored hazard marker — same
 * direct marker-to-placement conversion as SignMapper.ts's placeSigns (a
 * marker's character already fully determines its hazardType/facing via
 * LevelParser.ts's HAZARD_CHARS, so there's no CVData-derived defs list to
 * zip against).
 */
export function placeHazards(
  markers: readonly { col: number; row: number; hazardType: HazardKind; facing: HazardFacing }[],
): HazardPlacement[] {
  return markers.map(({ col, row, hazardType, facing }) => {
    const { x, y } = tileToPixel(col, row);
    return { id: `hazard-${hazardType}-${col}-${row}`, hazardType, facing, x, y };
  });
}
