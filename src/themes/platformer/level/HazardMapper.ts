import { tileToPixel, RENDERED_TILE_SIZE } from './Terrain';
import type { Box } from '../engine/Collision';
import type { HazardFacing } from './LevelParser';

export interface HazardPlacement {
  id: string;
  hazardType: 'spike';
  facing: HazardFacing;
  x: number;
  y: number;
}

/**
 * A hazard's collision box — the full rendered tile, regardless of facing:
 * touching any part of a spike's tile damages the player, so facing only
 * ever selects which sprite Spike.ts draws (see its own doc comment), never
 * the hitbox shape. Same "one rendered tile, no per-instance variation
 * beyond a payload field" shape as SignMapper.ts's signBox.
 */
export function hazardBox(hazard: HazardPlacement): Box {
  return { x: hazard.x, y: hazard.y, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE };
}

/**
 * Places a `HazardPlacement` at every hand-authored hazard marker — same
 * direct marker-to-placement conversion as SignMapper.ts's placeSigns (a
 * marker's character already fully determines its hazardType/facing via
 * LevelParser.ts's HAZARD_CHARS, so there's no CVData-derived defs list to
 * zip against).
 */
export function placeHazards(
  markers: readonly { col: number; row: number; hazardType: 'spike'; facing: HazardFacing }[],
): HazardPlacement[] {
  return markers.map(({ col, row, hazardType, facing }) => {
    const { x, y } = tileToPixel(col, row);
    return { id: `hazard-${hazardType}-${col}-${row}`, hazardType, facing, x, y };
  });
}
