import { RENDERED_TILE_SIZE } from '../level/Terrain';

/** Native pixel dimensions of public/sprites/key.png — a hand-drawn asset the
 *  user provided (as a screenshot, not an exact pixel-perfect export),
 *  reconstructed here by center-sampling each of its ~16-physical-pixel
 *  blocks (avoiding the blur a plain resize would introduce at the block
 *  boundaries) and snapping the result to a small flat color palette. A
 *  single standalone image, not a sheet — no sx/sy frame lookup needed,
 *  matching Chest.ts's convention for its own standalone (non-tiling)
 *  sprites. */
export const KEY_FRAME_WIDTH = 14;
export const KEY_FRAME_HEIGHT = 22;

/**
 * World-rendered size of a key pickup — fixed to exactly one tile
 * (RENDERED_TILE_SIZE, 32px tall), independent of any other pickup's own
 * size (a coin renders smaller than a tile; the key deliberately doesn't
 * follow that as a reference point). Width is derived from the native
 * 14:22 aspect ratio. This is a non-integer scale factor from the native
 * frame (32/22 ≈ 1.455x) rather than a clean RENDER_SCALE multiple, which
 * nearest-neighbor upscaling can turn into slightly uneven pixel duplication
 * in principle — but this asset's bold, thick shapes and flat color-snapped
 * palette hide that well in practice (confirmed by rendering at this exact
 * size and inspecting the result). If a future key asset reads as visibly
 * distorted at this size, that tradeoff needs revisiting.
 */
export const KEY_RENDERED_HEIGHT = RENDERED_TILE_SIZE;
export const KEY_RENDERED_WIDTH = Math.round((KEY_FRAME_WIDTH / KEY_FRAME_HEIGHT) * KEY_RENDERED_HEIGHT);

/** Horizontal centering offset over the key's placement tile (same formula
 *  Enemy.ts's enemyTileOffsetX uses). */
export const KEY_TILE_OFFSET_X = (RENDERED_TILE_SIZE - KEY_RENDERED_WIDTH) / 2;

/** Bottom-anchoring offset — 0 here (the key's rendered height exactly fills
 *  one tile), kept as its own named constant so drawKeyPickups reads the
 *  same bottom-anchoring pattern Enemy.ts's enemyTileOffsetY establishes. */
export const KEY_TILE_OFFSET_Y = RENDERED_TILE_SIZE - KEY_RENDERED_HEIGHT;

/**
 * A dropped key, sitting in the world as its own bobbing pickup (bob reuses
 * Coin.ts's coinBobOffset directly — see Renderer.ts's drawKeyPickups). `id`
 * reuses the source purple slime's own `id` — see PlatformerPage.tsx's
 * defeat handler, which checks whether a KeyPickupState with that id already
 * exists in `keyPickupStates` before spawning a new one, so a purple slime
 * respawned after death and defeated again never drops a second key.
 */
export interface KeyPickupState {
  id: string;
  x: number;
  y: number;
  collected: boolean;
}

/** Spawns a key pickup at a defeated purple slime's position (its `x`/`y` at
 *  the moment of defeat — the same tile-anchored pixel coordinates the enemy
 *  itself occupied). */
export function spawnKeyPickup(id: string, x: number, y: number): KeyPickupState {
  return { id, x, y, collected: false };
}
