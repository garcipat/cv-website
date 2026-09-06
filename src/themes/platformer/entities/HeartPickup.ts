import { RENDERED_TILE_SIZE } from '../level/Terrain';

/**
 * Rendered size of a dropped heart pickup — deliberately smaller than the
 * HUD's own heart icon (`Health.ts`'s `HEART_RENDERED_SIZE`, 32px), so a
 * heart lying in the world reads as a lesser, collectible version of the HUD
 * icon rather than a duplicate of it.
 */
export const HEART_PICKUP_RENDERED_SIZE = 24;

/** Centers the smaller rendered pickup within its one-tile marker, on both
 *  axes — mirrors `KeyPickup.ts`'s `KEY_TILE_OFFSET_X`/`KEY_TILE_OFFSET_Y`
 *  centering convention. */
export const HEART_PICKUP_TILE_OFFSET_X = (RENDERED_TILE_SIZE - HEART_PICKUP_RENDERED_SIZE) / 2;
export const HEART_PICKUP_TILE_OFFSET_Y = (RENDERED_TILE_SIZE - HEART_PICKUP_RENDERED_SIZE) / 2;

/**
 * A heart dropped by a destroyed potion-pot, sitting in the world as its own
 * bobbing pickup (bob reuses `Coin.ts`'s `coinBobOffset`, same as
 * `KeyPickup.ts` — see `entities/pickups/Heart.ts`). Unlike `KeyPickupState`,
 * there is no `collected` flag: a heart is removed from its live array
 * outright the instant it's touched, the same convention `BonusFruitState`
 * uses (see `PlatformerPage.tsx`'s bonus-fruit collision handling) — there is
 * no HUD counter a heart needs to keep contributing to after collection, so
 * nothing needs it to linger flagged.
 */
export interface HeartPickupState {
  id: string;
  x: number;
  y: number;
}

/** Spawns a heart pickup at a just-destroyed potion-pot's position (its
 *  `x`/`y` at the moment of destruction), reusing the pot's own id as the
 *  pickup's id — a potion-pot only ever drops once in its lifetime (it's
 *  removed from the world on its one hit), so there's no collision risk. */
export function spawnHeartPickup(id: string, x: number, y: number): HeartPickupState {
  return { id, x, y };
}
