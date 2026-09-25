import type { PickupSpawnSource, PickupType } from './PickupType';
import type { Pickup } from '../../contracts/Pickup';
import { HEARTS_SHEET } from '../sprites/sheets';
import { frameSource } from '../sprites/SpriteSheet';
import { coinBobOffset } from './Coin';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';
import { HEART_PICKUP_HEAL_AMOUNT, MAX_HALF_HEARTS } from '../Health';

/**
 * Rendered size of a dropped heart pickup — deliberately smaller than the
 * HUD's own heart icon (`Health.ts`'s `HEART_RENDERED_SIZE`, 32px), so a
 * heart lying in the world reads as a lesser, collectible version of the HUD
 * icon rather than a duplicate of it.
 */
export const HEART_PICKUP_RENDERED_SIZE = 24;

/** Centers the smaller rendered pickup within its one-tile marker, on both
 *  axes — mirrors Key.ts's KEY_TILE_OFFSET_X/KEY_TILE_OFFSET_Y centering
 *  convention. */
export const HEART_PICKUP_TILE_OFFSET_X = (RENDERED_TILE_SIZE - HEART_PICKUP_RENDERED_SIZE) / 2;
export const HEART_PICKUP_TILE_OFFSET_Y = (RENDERED_TILE_SIZE - HEART_PICKUP_RENDERED_SIZE) / 2;

/**
 * A heart dropped by a destroyed potion-pot, sitting in the world as its own
 * bobbing pickup (bob reuses Coin.ts's coinBobOffset, same as Key.ts).
 * Composes the shared `Pickup` base: a touched heart is retained and flagged
 * `collected`, skipped on draw/collision, and cleared from its array only by a
 * death/respawn (`resetGame()`).
 */
export interface HeartPickupState extends Pickup {
  kind: 'heart';
}

/** Spawns a heart pickup at a just-destroyed potion-pot's position (its
 *  `x`/`y` at the moment of destruction), reusing the pot's own id as the
 *  pickup's id — a potion-pot only ever drops once in its lifetime (it is
 *  removed from the world on its one hit), so there's no collision risk. */
export function spawnHeartPickup(id: string, x: number, y: number): HeartPickupState {
  return { id, kind: 'heart', x, y, collected: false };
}

/**
 * The `PickupType` view of a dropped heart. Always draws `hearts.png`'s frame 0
 * (the full-heart icon — see `Health.ts`'s `heartFrameIndex`), since a dropped
 * heart is never anything but a whole one. Bobs exactly like a coin. Its extra
 * eligibility gate (`hitPoints < MAX_HALF_HEARTS`) makes a heart wait in the
 * world at full health rather than being consumed for nothing.
 */
export const heart: PickupType<HeartPickupState> = {
  key: 'heart',
  drawLayer: 'afterEnemies',
  sprite: {
    sheet: HEARTS_SHEET,
    renderScale: 1,
    // Frame selection goes through frameIndex (always 0), not through named
    // animations — this stays empty, same convention as Key.ts/Coin.ts.
    animations: {},
  },
  box: (pickup) => ({
    x: pickup.x + HEART_PICKUP_TILE_OFFSET_X,
    y: pickup.y + HEART_PICKUP_TILE_OFFSET_Y,
    width: HEART_PICKUP_RENDERED_SIZE,
    height: HEART_PICKUP_RENDERED_SIZE,
  }),
  frameIndex: () => 0,
  bobOffset: (_pickup, elapsed) => coinBobOffset(elapsed),
  spawn: (source: PickupSpawnSource): HeartPickupState =>
    spawnHeartPickup(source.id, source.x, source.y),
  isCollectible: (_pickup, ctx) => ctx.playerHitPoints < MAX_HALF_HEARTS,
  onPickup: () => ({ heal: HEART_PICKUP_HEAL_AMOUNT }),
  draw: (pickup, dc) => {
    const image = dc.sprites[HEARTS_SHEET.src];
    if (!image) return;

    const { sx, sy } = frameSource(HEARTS_SHEET, heart.frameIndex(pickup, dc.worldElapsed, 0));
    const bob = heart.bobOffset(pickup, dc.worldElapsed);

    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      sx,
      sy,
      HEARTS_SHEET.frameWidth,
      HEARTS_SHEET.frameHeight,
      pickup.x + HEART_PICKUP_TILE_OFFSET_X + dc.originX,
      pickup.y + HEART_PICKUP_TILE_OFFSET_Y + dc.originY + bob,
      HEART_PICKUP_RENDERED_SIZE,
      HEART_PICKUP_RENDERED_SIZE,
    );
  },
};
