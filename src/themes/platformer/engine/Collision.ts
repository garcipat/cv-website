import {
  PLAYER_RENDERED_SIZE,
  PLAYER_SIDE_PADDING,
  PLAYER_HEAD_PADDING,
  PLAYER_FOOT_PADDING,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import { COIN_RENDERED_SIZE } from '../entities/Coin';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import {
  enemyRenderedSize,
  enemyTileOffsetX,
  enemyTileOffsetY,
  enemyHitboxSidePadding,
  enemyHitboxTopPadding,
} from '../entities/Enemy';
import type { EnemyState } from '../entities/Enemy';
import { typeOf } from '../entities/enemies';
import type { ContactSide } from './Contact';
import { bonusFruitY, BONUS_FRUIT_RISE_DURATION_SECONDS } from '../entities/BonusFruit';
import type { BonusFruitState } from '../entities/BonusFruit';
import { FRUIT_RENDERED_SIZE } from '../entities/Fruit';
import {
  CHEST_CLOSED_RENDERED_WIDTH,
  CHEST_CLOSED_RENDERED_HEIGHT,
  CHEST_CLOSED_OFFSET_X,
  isChestOpen,
} from '../entities/Chest';
import type { ChestState } from '../entities/Chest';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { SignPlacement } from '../level/SignMapper';
import type { HintId } from '../types';
import type { KeyPickupState } from '../entities/KeyPickup';
import {
  KEY_RENDERED_WIDTH,
  KEY_RENDERED_HEIGHT,
  KEY_TILE_OFFSET_X,
  KEY_TILE_OFFSET_Y,
} from '../entities/KeyPickup';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The player's collision box — same narrower-than-render-slot box
 * Physics.ts's terrain collision already uses (PLAYER_SIDE_PADDING on each
 * side, PLAYER_HEAD_PADDING off the top, PLAYER_FOOT_PADDING off the
 * bottom), so a coin the player's sprite art doesn't actually touch never
 * registers as collected.
 */
export function playerHitbox(player: PlayerState): Box {
  return {
    x: player.x + PLAYER_SIDE_PADDING,
    y: player.y + PLAYER_HEAD_PADDING,
    width: PLAYER_RENDERED_SIZE - 2 * PLAYER_SIDE_PADDING,
    height: PLAYER_RENDERED_SIZE - PLAYER_HEAD_PADDING - PLAYER_FOOT_PADDING,
  };
}

/** Standard axis-aligned bounding box overlap — touching edges (zero-area
 *  intersection) do not count as overlapping. */
export function aabbOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Returns the ids of every placement the player's hitbox currently overlaps,
 * excluding ids already in `collectedIds` — collision against an
 * already-collected (visually removed) collectible is a no-op, not a
 * duplicate-collect (FR-020c). Uses each placement's fixed x/y, ignoring the
 * cosmetic bob offset (Renderer.ts's drawCollectibles) so the
 * hitbox doesn't jitter a few pixels every frame independent of the sprite.
 */
export function checkCollectibleCollisions(
  player: PlayerState,
  placements: CollectiblePlacement[],
  collectedIds: ReadonlySet<string>,
): string[] {
  const hitbox = playerHitbox(player);
  const collected: string[] = [];
  for (const placement of placements) {
    if (collectedIds.has(placement.id)) continue;
    const box: Box = {
      x: placement.x,
      y: placement.y,
      width: COIN_RENDERED_SIZE,
      height: COIN_RENDERED_SIZE,
    };
    if (aabbOverlap(hitbox, box)) collected.push(placement.id);
  }
  return collected;
}

/**
 * An enemy's collision box — inset from the full render slot by the same
 * tile-centering offset `drawEnemies` draws the sprite at
 * (`enemyTileOffsetX`/`enemyTileOffsetY`), plus a further sprite-shape inset
 * (`enemyHitboxSidePadding`/`enemyHitboxTopPadding`, measured from the
 * sprite's own transparent margins) so the box coincides with the visible,
 * rounded slime silhouette rather than its full square render slot.
 */
export function enemyHitbox(enemy: EnemyState): Box {
  const size = enemyRenderedSize(enemy.type);
  const sidePad = enemyHitboxSidePadding(enemy.type);
  const topPad = enemyHitboxTopPadding(enemy.type);
  return {
    x: enemy.x + enemyTileOffsetX(enemy.type) + sidePad,
    y: enemy.y + enemyTileOffsetY(enemy.type) + topPad,
    width: size - 2 * sidePad,
    height: size - topPad,
  };
}

export interface EnemyContactResult {
  /** The enemy array with every contacted enemy's returned `self` merged in.
   *  Enemies with no contact are returned unchanged, by reference. */
  enemies: EnemyState[];
  /** Half-hearts. The caller drops this while the player is invincible. */
  damagePlayer: number;
  bouncePlayer: boolean;
  knockback: 'none' | 'away' | 'awayAndUp';
  /** Which way "away" points: -1 pushes the player left, 1 right. Derived from
   *  the first damaging contact's hitbox centers — the geometry stays here so
   *  no caller has to re-derive it. Meaningless while `knockback` is 'none'. */
  knockbackDirection: -1 | 1;
}

const KNOCKBACK_RANK = { none: 0, away: 1, awayAndUp: 2 } as const;

/**
 * Computes contact geometry against every living enemy and asks each one's
 * type what the contact means, then aggregates.
 *
 * Aggregation rules, owned here and nowhere else: at most one damage applies
 * per tick regardless of how many enemies are touched; a bounce applies if any
 * outcome requests one; 'awayAndUp' wins over 'away', which wins over 'none'.
 */
export function resolveEnemyContacts(
  player: PlayerState,
  enemies: readonly EnemyState[],
): EnemyContactResult {
  const playerBox = playerHitbox(player);
  let merged: EnemyState[] | undefined;
  let damagePlayer = 0;
  let bouncePlayer = false;
  let knockback: 'none' | 'away' | 'awayAndUp' = 'none';
  let knockbackDirection: -1 | 1 = 1;

  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];
    if (!enemy.alive) continue;
    const selfBox = enemyHitbox(enemy);
    if (!aabbOverlap(playerBox, selfBox)) continue;

    const landsOnUpperHalf = playerBox.y + playerBox.height <= selfBox.y + selfBox.height / 2;
    const side: ContactSide = player.vy > 0 && landsOnUpperHalf ? 'top' : 'side';
    const outcome = typeOf(enemy).onPlayerCollide(enemy, player, {
      side,
      playerVx: player.vx,
      playerVy: player.vy,
      playerBox,
      selfBox,
    });

    if (outcome.self) {
      merged ??= [...enemies];
      merged[i] = outcome.self;
    }
    if (outcome.bouncePlayer) bouncePlayer = true;
    if (outcome.damagePlayer && outcome.damagePlayer > damagePlayer) {
      // Max, not sum: touching two enemies in one tick still costs one hit.
      damagePlayer = outcome.damagePlayer;
      // Pushes the player back toward whichever side of the enemy their own
      // hitbox center is already on, i.e. away from it and back the way they
      // came. Compares hitbox centers rather than raw x, since each entity's
      // x is its own render-slot top-left, not its visual center.
      const playerCenterX = playerBox.x + playerBox.width / 2;
      const selfCenterX = selfBox.x + selfBox.width / 2;
      knockbackDirection = playerCenterX <= selfCenterX ? -1 : 1;
    }
    const requested = outcome.knockback ?? 'none';
    if (KNOCKBACK_RANK[requested] > KNOCKBACK_RANK[knockback]) knockback = requested;
  }

  return {
    enemies: merged ?? enemies.slice(),
    damagePlayer,
    bouncePlayer,
    knockback,
    knockbackDirection,
  };
}

/**
 * Returns the ids of every bonus fruit the player's hitbox currently
 * overlaps AND that has finished rising (`elapsed >=
 * BONUS_FRUIT_RISE_DURATION_SECONDS`) — spec.md's "lands as a touchable
 * pickup", i.e. not collectible mid-rise. Unlike
 * `checkCollectibleCollisions`, there's no `collectedIds` dedup set here:
 * `PlatformerPage.tsx` removes a touched bonus fruit from its live array
 * entirely the same tick, so it simply can't be checked against again.
 */
export function checkBonusFruitCollisions(
  player: PlayerState,
  fruits: readonly BonusFruitState[],
): string[] {
  const hitbox = playerHitbox(player);
  const hits: string[] = [];
  for (const fruit of fruits) {
    if (fruit.elapsed < BONUS_FRUIT_RISE_DURATION_SECONDS) continue;
    const box: Box = { x: fruit.x, y: bonusFruitY(fruit), width: FRUIT_RENDERED_SIZE, height: FRUIT_RENDERED_SIZE };
    if (aabbOverlap(hitbox, box)) hits.push(fruit.id);
  }
  return hits;
}

/**
 * Returns the id of the first closed chest the player's hitbox currently
 * overlaps, or `undefined` if none — spec.md FR-023: unlike every other
 * collectible, a chest does NOT open on touch; the caller (PlatformerPage.tsx)
 * only opens it once this returns an id AND the visitor has pressed Arrow Up
 * this tick. Only a chest's CLOSED footprint is checked (its open sprite is a
 * different size and the chest is un-openable again anyway, so an open
 * chest's box is irrelevant here) — mirrors checkBonusFruitCollisions'
 * single-box-per-item convention. The box's x is shifted by
 * CHEST_CLOSED_OFFSET_X (see entities/Chest.ts) so it matches exactly where
 * the closed chest is now drawn (centered on its tile, not left-aligned to
 * the tile's top-left corner).
 */
export function chestPlayerIsStandingOn(
  player: PlayerState,
  chests: readonly ChestState[],
): string | undefined {
  const hitbox = playerHitbox(player);
  for (const chest of chests) {
    if (isChestOpen(chest)) continue;
    const box: Box = {
      x: chest.x + CHEST_CLOSED_OFFSET_X,
      y: chest.y,
      width: CHEST_CLOSED_RENDERED_WIDTH,
      height: CHEST_CLOSED_RENDERED_HEIGHT,
    };
    if (aabbOverlap(hitbox, box)) return chest.id;
  }
  return undefined;
}

/**
 * Returns the `hintId` of the first sign the player's hitbox currently
 * overlaps, or `undefined` if none. Unlike checkCollectibleCollisions, this
 * is NOT destructive/dedup-tracked — a sign is reusable, so the same sign
 * returns its hintId every tick the player stands on it, and again the next
 * time they walk back onto it. A sign's box is exactly one rendered tile
 * (RENDERED_TILE_SIZE square), matching how it's drawn (Renderer.ts).
 */
export function checkSignOverlap(
  player: PlayerState,
  signs: readonly SignPlacement[],
): HintId | undefined {
  const hitbox = playerHitbox(player);
  for (const sign of signs) {
    const box: Box = { x: sign.x, y: sign.y, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE };
    if (aabbOverlap(hitbox, box)) return sign.hintId;
  }
  return undefined;
}

/**
 * Returns the ids of every NOT-yet-collected key pickup the player's hitbox
 * currently overlaps. Unlike checkCollectibleCollisions, there's no external
 * `collectedIds` set — a pickup's own `collected` flag is the source of
 * truth (PlatformerState.ts's keyPickupStates keeps collected entries around,
 * flagged rather than removed, so the renderer can skip drawing them — see
 * KeyPickup.ts's doc comment). A defeated purple slime can never drop a
 * second key on a later respawn because of a separate mechanism: the source
 * enemy's own `rewardGiven` flag (Enemy.ts), which `reviveEnemy` leaves
 * untouched. The box is offset by KEY_TILE_OFFSET_X/Y, the same
 * centering/bottom-anchoring Renderer.ts's drawKeyPickups applies, so the
 * collidable area matches where the key is actually drawn rather than the
 * tile's raw top-left corner.
 */
export function checkKeyPickupCollisions(
  player: PlayerState,
  pickups: readonly KeyPickupState[],
): string[] {
  const hitbox = playerHitbox(player);
  const hits: string[] = [];
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    const box: Box = {
      x: pickup.x + KEY_TILE_OFFSET_X,
      y: pickup.y + KEY_TILE_OFFSET_Y,
      width: KEY_RENDERED_WIDTH,
      height: KEY_RENDERED_HEIGHT,
    };
    if (aabbOverlap(hitbox, box)) hits.push(pickup.id);
  }
  return hits;
}
