import { RENDERED_TILE_SIZE } from '../level/Terrain';

/** Native pixel dimensions of public/sprites/key.png (generated, chroma-keyed
 *  from a magenta-background render, cropped tight on all sides) — a bold,
 *  diagonally-oriented key filling a roughly square bounding box. Deliberately
 *  16x16, matching TILE_SIZE (Terrain.ts) — every other sprite in this game
 *  (coin.png, hearts.png, ...) is also native 16px scaled by the game's flat
 *  RENDER_SCALE (2), and reusing that same convention here means the key
 *  scales by a clean INTEGER factor everywhere it's drawn. Two earlier
 *  versions (14x28, then 24x23) didn't: at a 32px render target, 32/28≈1.14x
 *  and 32/23≈1.39x are both non-integer scale factors, which makes
 *  nearest-neighbor upscaling duplicate source pixels unevenly — this reads
 *  as a distorted, blurry-edged sprite even though every individual pixel is
 *  either fully opaque or fully transparent (no actual blur in the asset). A
 *  single standalone image, not a sheet — no sx/sy frame lookup needed,
 *  matching Chest.ts's convention for its own standalone (non-tiling)
 *  sprites. */
export const KEY_FRAME_WIDTH = 16;
export const KEY_FRAME_HEIGHT = 16;

/**
 * World-rendered size of a key pickup. Because the native frame is exactly
 * TILE_SIZE (see KEY_FRAME_WIDTH/HEIGHT's doc comment), scaling it by
 * RENDER_SCALE lands exactly on RENDERED_TILE_SIZE — same formula every
 * other one-tile pickup uses (COIN_RENDERED_SIZE/FRUIT_RENDERED_SIZE), no
 * special-casing needed.
 */
export const KEY_RENDERED_HEIGHT = RENDERED_TILE_SIZE;
export const KEY_RENDERED_WIDTH = Math.round((KEY_FRAME_WIDTH / KEY_FRAME_HEIGHT) * KEY_RENDERED_HEIGHT);

/** Horizontal centering offset — currently 0 (the key's rendered width now
 *  exactly fills one tile), but kept as its own named constant rather than
 *  inlined so a future non-square key asset stays centered automatically
 *  (same formula Enemy.ts's enemyTileOffsetX uses) instead of silently
 *  drifting left-aligned. */
export const KEY_TILE_OFFSET_X = (RENDERED_TILE_SIZE - KEY_RENDERED_WIDTH) / 2;

/** Bottom-anchoring offset — currently 0 (the key's rendered height exactly
 *  fills one tile), kept as its own named constant so drawKeyPickups reads
 *  the same bottom-anchoring pattern Enemy.ts's enemyTileOffsetY
 *  establishes, and so a future resize of KEY_RENDERED_HEIGHT keeps the
 *  key's visible bottom sitting on the ground instead of silently drifting
 *  out of alignment. */
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
