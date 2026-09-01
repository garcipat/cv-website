import { RENDERED_TILE_SIZE } from '../level/Terrain';

/** Native pixel dimensions of public/sprites/key.png (generated, chroma-keyed
 *  from a magenta-background render, cropped tight on all sides). A single
 *  standalone image, not a sheet — no sx/sy frame lookup needed, matching
 *  Chest.ts's convention for its own standalone (non-tiling) sprites. */
export const KEY_FRAME_WIDTH = 14;
export const KEY_FRAME_HEIGHT = 28;

/**
 * World-rendered size of a key pickup. Unlike most sprites here, this is NOT
 * simply the native frame scaled by RENDER_SCALE (that formula would produce
 * a 56px-tall key — almost twice a tile — sinking into the ground below and
 * badly out of family with every other pickup, which render at one tile,
 * 32px: COIN_RENDERED_SIZE/FRUIT_RENDERED_SIZE). Instead the key is clamped
 * to fit within one rendered tile height, keeping its native 14:28 aspect
 * ratio, so width comes out proportionally narrower.
 */
export const KEY_RENDERED_HEIGHT = RENDERED_TILE_SIZE;
export const KEY_RENDERED_WIDTH = Math.round((KEY_FRAME_WIDTH / KEY_FRAME_HEIGHT) * KEY_RENDERED_HEIGHT);

/** Horizontal centering offset — the key's rendered width is narrower than
 *  one tile, so this centers it over its placement tile (same formula
 *  Enemy.ts's enemyTileOffsetX uses). */
export const KEY_TILE_OFFSET_X = (RENDERED_TILE_SIZE - KEY_RENDERED_WIDTH) / 2;

/** Bottom-anchoring offset — the key's rendered height fits exactly one tile
 *  here, so this is 0, but it's kept as its own named constant (rather than
 *  inlined as 0) so drawKeyPickups reads the same bottom-anchoring pattern
 *  Enemy.ts's enemyTileOffsetY establishes, and so a future resize of
 *  KEY_RENDERED_HEIGHT keeps the key's visible bottom sitting on the ground
 *  instead of silently drifting back out of alignment. */
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
