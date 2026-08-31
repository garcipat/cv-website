import { RENDER_SCALE } from '../level/Terrain';

/** Native pixel dimensions of public/sprites/key.png (generated, chroma-keyed
 *  from a magenta-background render, cropped tight on all sides). A single
 *  standalone image, not a sheet — no sx/sy frame lookup needed, matching
 *  Chest.ts's convention for its own standalone (non-tiling) sprites. */
export const KEY_FRAME_WIDTH = 14;
export const KEY_FRAME_HEIGHT = 28;
export const KEY_RENDERED_WIDTH = KEY_FRAME_WIDTH * RENDER_SCALE;
export const KEY_RENDERED_HEIGHT = KEY_FRAME_HEIGHT * RENDER_SCALE;

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
