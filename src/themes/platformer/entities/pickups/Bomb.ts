import type { PickupSpawnSource, PickupType } from './PickupType';
import type { Pickup } from '../../contracts/Pickup';
import { BOMB_SHEET } from '../sprites/sheets';
import { frameSource } from '../sprites/SpriteSheet';
import { coinBobOffset } from './Coin';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';

/**
 * Rendered size of a dropped bomb pickup — deliberately smaller than a tile,
 * matching the heart pickup's `HEART_PICKUP_RENDERED_SIZE` (24). A bomb
 * lying in the world reads as a collectible version of the HUD icon rather
 * than a placed bomb (O-012).
 */
export const BOMB_PICKUP_RENDERED_SIZE = 24;

/** Centers the smaller rendered pickup within its one-tile marker, on both
 *  axes — mirrors Heart.ts's offsets. */
export const BOMB_PICKUP_TILE_OFFSET_X = (RENDERED_TILE_SIZE - BOMB_PICKUP_RENDERED_SIZE) / 2;
export const BOMB_PICKUP_TILE_OFFSET_Y = (RENDERED_TILE_SIZE - BOMB_PICKUP_RENDERED_SIZE) / 2;

/**
 * A bomb dropped by a destroyed bomb-pot, sitting in the world as its own
 * bobbing pickup (bob reuses Coin.ts's coinBobOffset, same as the heart).
 * Composes the shared `Pickup` base: a touched bomb is retained and flagged
 * `collected` (skipped on draw/collision) and cleared from its array by
 * `resetGame()`. At the inventory cap the bomb kind's `maxPerTick` yields
 * nothing, so it is left in the world untouched. A bomb carries no CV fact.
 */
export interface BombPickupState extends Pickup {
  kind: 'bomb';
}

/** Spawns a bomb pickup at a just-destroyed bomb-pot's position, reusing the
 *  pot's own id — a bomb-pot is removed from the world on its one hit, and
 *  `bombPickupStates` is cleared on respawn, so there's no collision risk
 *  (same convention as `spawnHeartPickup`). */
export function spawnBombPickup(id: string, x: number, y: number): BombPickupState {
  return { id, kind: 'bomb', x, y, collected: false };
}

/**
 * The `PickupType` view of a dropped bomb. Always draws `bomb.png`'s frame 0
 * (the unlit bomb, the same art the HUD icon uses); the placed bomb's lit
 * frames 1-5 are never drawn for a world pickup. Bobs exactly like a
 * coin/heart. Its `maxPerTick` (the remaining inventory capacity) is what
 * leaves a bomb in the world at the cap.
 */
export const bomb: PickupType<BombPickupState> = {
  key: 'bomb',
  drawLayer: 'afterEnemies',
  sprite: {
    sheet: BOMB_SHEET,
    renderScale: 1,
    // Frame selection goes through frameIndex (always 0), not named
    // animations — same convention as Heart.ts/Key.ts.
    animations: {},
  },
  box: (pickup) => ({
    x: pickup.x + BOMB_PICKUP_TILE_OFFSET_X,
    y: pickup.y + BOMB_PICKUP_TILE_OFFSET_Y,
    width: BOMB_PICKUP_RENDERED_SIZE,
    height: BOMB_PICKUP_RENDERED_SIZE,
  }),
  frameIndex: () => 0,
  bobOffset: (_pickup, elapsed) => coinBobOffset(elapsed),
  spawn: (source: PickupSpawnSource): BombPickupState =>
    spawnBombPickup(source.id, source.x, source.y),
  maxPerTick: (ctx) => ctx.capacity ?? 0,
  onPickup: () => ({ bombs: 1 }),
  draw: (pickup, dc) => {
    const image = dc.sprites[BOMB_SHEET.src];
    if (!image) return;

    const { sx, sy } = frameSource(BOMB_SHEET, bomb.frameIndex(pickup, dc.worldElapsed, 0));
    const bob = bomb.bobOffset(pickup, dc.worldElapsed);

    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      sx,
      sy,
      BOMB_SHEET.frameWidth,
      BOMB_SHEET.frameHeight,
      pickup.x + BOMB_PICKUP_TILE_OFFSET_X + dc.originX,
      pickup.y + BOMB_PICKUP_TILE_OFFSET_Y + dc.originY + bob,
      BOMB_PICKUP_RENDERED_SIZE,
      BOMB_PICKUP_RENDERED_SIZE,
    );
  },
};
