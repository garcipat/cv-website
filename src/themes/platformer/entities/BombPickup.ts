import { RENDERED_TILE_SIZE } from '../level/Terrain';

/**
 * Rendered size of a dropped bomb pickup — deliberately smaller than a tile,
 * matching the heart pickup's `HEART_PICKUP_RENDERED_SIZE` (24). A bomb
 * lying in the world reads as a collectible version of the HUD icon rather
 * than a placed bomb (O-012).
 */
export const BOMB_PICKUP_RENDERED_SIZE = 24;

/** Centers the smaller rendered pickup within its one-tile marker, on both
 *  axes — mirrors `HeartPickup.ts`'s offsets. */
export const BOMB_PICKUP_TILE_OFFSET_X = (RENDERED_TILE_SIZE - BOMB_PICKUP_RENDERED_SIZE) / 2;
export const BOMB_PICKUP_TILE_OFFSET_Y = (RENDERED_TILE_SIZE - BOMB_PICKUP_RENDERED_SIZE) / 2;

/**
 * A bomb dropped by a destroyed bomb-pot, sitting in the world as its own
 * bobbing pickup (bob reuses `Coin.ts`'s `coinBobOffset`, same as the heart).
 * Like `HeartPickupState` there is no `collected` flag: a bomb is removed
 * from its live array outright the instant it's collected (or left in the
 * world untouched while the inventory is at its cap — see
 * `checkBombPickupCollisions`). A bomb carries no CV fact (FR-011).
 */
export interface BombPickupState {
  id: string;
  x: number;
  y: number;
}

/** Spawns a bomb pickup at a just-destroyed bomb-pot's position, reusing the
 *  pot's own id — a bomb-pot is removed from the world on its one hit, and
 *  `bombPickupStates` is cleared on respawn, so there's no collision risk
 *  (same convention as `spawnHeartPickup`). */
export function spawnBombPickup(id: string, x: number, y: number): BombPickupState {
  return { id, x, y };
}
