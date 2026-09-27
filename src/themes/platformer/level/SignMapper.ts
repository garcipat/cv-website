import { RENDERED_TILE_SIZE } from './Terrain';
import { placeAtMarkers } from './placement';
import type { Box } from '../contracts/geometry';
import type { SignDef, SignHintId } from './HintCatalog';

export interface SignPlacement extends SignDef {
  x: number;
  y: number;
}

/**
 * A sign's collision box — exactly one rendered tile (`RENDERED_TILE_SIZE`
 * square), matching how it's drawn (SceneRenderer.ts). A bare function rather
 * than a full type module (compare `PICKUP_TYPES`/`BLOCK_TYPES`/`CHEST_TYPE`):
 * a sign has no state and no per-instance variation beyond its `hintId`
 * payload, so there is no second method or per-kind registry for a type
 * object to carry.
 */
export function signBox(sign: SignPlacement): Box {
  return { x: sign.x, y: sign.y, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE };
}

/**
 * Places a `SignPlacement` at every hand-authored sign marker through the
 * shared `placeAtMarkers` — unlike placeCollectibles/placeEnemies/
 * placeBlocks/placeChests, there's no CVData-derived "def" to zip against a
 * marker queue: each entry already carries its resolved hintId
 * (LevelParser.ts's `findSignTiles` pairs a `T` cell with its `sign`
 * marker's hint). The `id` override keeps the `sign-${hintId}-${col}-${row}`
 * format so two signs showing the same hint at different spots get distinct
 * ids.
 */
export function placeSigns(
  markers: readonly { col: number; row: number; hintId: SignHintId }[],
): SignPlacement[] {
  return placeAtMarkers<{ col: number; row: number; hintId: SignHintId }, SignPlacement>(markers, {
    idPrefix: 'sign',
    id: (marker) => `sign-${marker.hintId}-${marker.col}-${marker.row}`,
    build: (marker) => ({ hintId: marker.hintId }),
  });
}
