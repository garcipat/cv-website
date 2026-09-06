import { tileToPixel } from './Terrain';
import type { HazardFacing, HazardKind } from './LevelParser';

export interface HazardPlacement {
  id: string;
  hazardType: HazardKind;
  facing: HazardFacing;
  x: number;
  y: number;
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
