import type { PickupSpawnSource, PickupType } from './PickupType';
import type { Pickup } from '../../contracts/Pickup';
import { KEY_SHEET } from '../sprites/sheets';
import { frameSource } from '../sprites/SpriteSheet';
import { coinBobOffset } from './Coin';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';

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
 * 14:22 aspect ratio.
 */
export const KEY_RENDERED_HEIGHT = RENDERED_TILE_SIZE;
export const KEY_RENDERED_WIDTH = Math.round((KEY_FRAME_WIDTH / KEY_FRAME_HEIGHT) * KEY_RENDERED_HEIGHT);

/** Horizontal centering offset over the key's placement tile (same formula
 *  Enemy.ts's enemyTileOffsetX uses). */
export const KEY_TILE_OFFSET_X = (RENDERED_TILE_SIZE - KEY_RENDERED_WIDTH) / 2;

/** Bottom-anchoring offset — 0 here (the key's rendered height exactly fills
 *  one tile), kept as its own named constant so `box`/`draw`/`onPickup` read
 *  the same bottom-anchoring pattern Enemy.ts's enemyTileOffsetY establishes. */
export const KEY_TILE_OFFSET_Y = RENDERED_TILE_SIZE - KEY_RENDERED_HEIGHT;

/**
 * A dropped key, sitting in the world as its own bobbing pickup (bob reuses
 * Coin.ts's coinBobOffset directly). `id` reuses the source purple slime's own
 * `id`, identifying the pickup for collection within `keyPickupStates` — it is
 * not a dedup key. The no-second-key guarantee (a purple slime respawned after
 * death and defeated again never drops a second key) lives on the source
 * enemy's own `EnemyState.rewardGiven` (see PlatformerPage.tsx's defeat
 * handler). Composes the shared `Pickup` base — `collected` comes from there,
 * not an inline field.
 */
export interface KeyPickupState extends Pickup {
  kind: 'key';
}

/** Spawns a key pickup at a defeated purple slime's position (its `x`/`y` at
 *  the moment of defeat — the same tile-anchored pixel coordinates the enemy
 *  itself occupied). */
export function spawnKeyPickup(id: string, x: number, y: number): KeyPickupState {
  return { id, kind: 'key', x, y, collected: false };
}

/**
 * The `PickupType` view of a dropped key. A single standalone image, not a
 * sheet, so frameIndex is always 0. Bobs exactly like a coin (Coin.ts's
 * coinBobOffset — reused as-is). Collecting it banks a key and flies a static
 * "Key" caption to the canvas-drawn HUD key counter; the shared applier flags
 * it `collected` so it is retained but skipped on draw/collision.
 */
export const key: PickupType<KeyPickupState> = {
  key: 'key',
  drawLayer: 'afterEnemies',
  sprite: {
    sheet: KEY_SHEET,
    // The key's rendered size comes from KEY_RENDERED_WIDTH/KEY_RENDERED_HEIGHT
    // via box(), not from frameWidth * renderScale — the shared sheet-drawing
    // helper (drawSpriteSheetEntity) must not be used to draw this pickup, or
    // it will render at the wrong (square) size and aspect.
    renderScale: 1,
    animations: {},
  },
  box: (pickup) => ({
    x: pickup.x + KEY_TILE_OFFSET_X,
    y: pickup.y + KEY_TILE_OFFSET_Y,
    width: KEY_RENDERED_WIDTH,
    height: KEY_RENDERED_HEIGHT,
  }),
  frameIndex: () => 0,
  bobOffset: (_pickup, elapsed) => coinBobOffset(elapsed),
  spawn: (source: PickupSpawnSource): KeyPickupState =>
    spawnKeyPickup(source.id, source.x, source.y),
  // The flying-text start is the key's world position plus its own
  // tile-offset convention; the shared applier adds the camera origin and the
  // tick's stack offset and maps `keyCounter` to the HUD position.
  onPickup: (pickup) => ({
    bankKey: true,
    flyingText: {
      effectId: pickup.id,
      label: 'Key',
      x: pickup.x + KEY_TILE_OFFSET_X,
      y: pickup.y + KEY_TILE_OFFSET_Y,
      target: 'keyCounter',
    },
  }),
  // Draws at KEY_RENDERED_WIDTH/HEIGHT (via box(), the non-square
  // 14:22-derived size), NOT the shared sheet-drawing helper (see the note
  // above).
  draw: (pickup, dc) => {
    const image = dc.sprites[KEY_SHEET.src];
    if (!image) return;

    const { sx, sy } = frameSource(KEY_SHEET, key.frameIndex(pickup, dc.worldElapsed, 0));
    const bob = key.bobOffset(pickup, dc.worldElapsed);

    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      sx,
      sy,
      KEY_FRAME_WIDTH,
      KEY_FRAME_HEIGHT,
      pickup.x + KEY_TILE_OFFSET_X + dc.originX,
      pickup.y + KEY_TILE_OFFSET_Y + dc.originY + bob,
      KEY_RENDERED_WIDTH,
      KEY_RENDERED_HEIGHT,
    );
  },
};
