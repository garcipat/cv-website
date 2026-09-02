import { tileToPixel, RENDERED_TILE_SIZE } from './Terrain';
import type { Box } from '../engine/Collision';
import type { SignDef, HintId } from '../types';

export interface SignPlacement extends SignDef {
  x: number;
  y: number;
}

/**
 * A sign's collision box — exactly one rendered tile (`RENDERED_TILE_SIZE`
 * square), matching how it's drawn (Renderer.ts). A bare function rather
 * than a full type module (compare `PICKUP_TYPES`/`BLOCK_TYPES`/`CHEST_TYPE`):
 * a sign has no state and no per-instance variation beyond its `hintId`
 * payload, so there is no second method or per-kind registry for a type
 * object to carry.
 */
export function signBox(sign: SignPlacement): Box {
  return { x: sign.x, y: sign.y, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE };
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
