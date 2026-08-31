import { tileToPixel } from './Terrain';
import type { SignDef, HintId } from '../types';

export interface SignPlacement extends SignDef {
  x: number;
  y: number;
}

/**
 * Places a `SignPlacement` at every hand-authored sign marker — unlike
 * placeCollectibles/placeEnemies/placeBlocks/placeChests, there's no
 * CVData-derived "def" to zip against a marker queue: a sign marker's
 * character already fully determines its hintId (LevelParser.ts's
 * SIGN_CHARS), so this is a direct marker-to-placement conversion, same
 * shape as the other *Mapper.ts files' own placeX function but with no
 * `defs` parameter. The id includes col/row so two signs showing the same
 * hint at different spots in the level get distinct ids.
 */
export function placeSigns(
  markers: readonly { col: number; row: number; hintId: HintId }[],
): SignPlacement[] {
  return markers.map(({ col, row, hintId }) => {
    const { x, y } = tileToPixel(col, row);
    return { id: `sign-${hintId}-${col}-${row}`, hintId, x, y };
  });
}
