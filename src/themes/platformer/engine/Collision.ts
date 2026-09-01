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
  const size = enemyRenderedSize(enemy.spriteType);
  const sidePad = enemyHitboxSidePadding(enemy.spriteType);
  const topPad = enemyHitboxTopPadding(enemy.spriteType);
  return {
    x: enemy.x + enemyTileOffsetX(enemy.spriteType) + sidePad,
    y: enemy.y + enemyTileOffsetY(enemy.spriteType) + topPad,
    width: size - 2 * sidePad,
    height: size - topPad,
  };
}

/**
 * Returns the ids of every not-yet-fatally-hit, not-currently-`spiked` enemy
 * the player just stomped this frame: overlapping AND falling (`player.vy >
 * 0`) AND landing on the enemy's upper half (the player's hitbox bottom edge
 * is at or above the enemy's vertical midpoint) — this is what distinguishes
 * "jumped on top of" from a side/below touch (a separate concern,
 * intentionally not handled here: this function returns [] for that case,
 * same as for no contact at all). An enemy no longer `alive`, or one whose
 * `hitPoints` has already reached 0 (mid `hit`-reaction, about to be flagged
 * `alive: false` in place), is excluded — without this, a stomp's own bounce naturally arcs back down
 * onto the same enemy, and would otherwise keep decrementing `hitPoints`
 * arbitrarily far below 0 every time. A `spiked` enemy is excluded too — its
 * spikes make the top un-stompable until they retract (see `Enemy.ts`'s
 * `applyStomp`, `EnemyAI.ts`'s `stepEnemySpikeCooldown`); the same
 * top-landing on a spiked enemy is instead picked up by
 * `checkEnemySideCollisions` below and treated as player damage. Not gated
 * on `animState === 'hit'` alone — a still-airborne bounce back onto a
 * non-spiked, still-alive enemy (possible only for a single non-fatal stomp,
 * since that same stomp immediately sets `spiked: true`) is unaffected by
 * this function; `spiked` is what actually prevents repeat top-stomps now.
 */
export function checkEnemyStompCollisions(player: PlayerState, enemies: EnemyState[]): string[] {
  if (player.vy <= 0) return [];
  const hitbox = playerHitbox(player);
  const stomped: string[] = [];
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.hitPoints <= 0 || enemy.spiked) continue;
    const box = enemyHitbox(enemy);
    if (!aabbOverlap(hitbox, box)) continue;
    const enemyMidY = box.y + box.height / 2;
    if (hitbox.y + hitbox.height <= enemyMidY) {
      stomped.push(enemy.id);
    }
  }
  return stomped;
}

/**
 * Returns the ids of every still-alive, non-reacting enemy the player is
 * touching in a way that counts as damage — the exact inverse of
 * `checkEnemyStompCollisions`'s landing condition, EXCEPT for one case: a
 * `spiked` enemy's top is never treated as a legal stomp landing (its
 * spikes make it un-stompable — see `checkEnemyStompCollisions`'s doc
 * comment above), so any overlap with a `spiked` enemy counts as a hit here,
 * including a fall-and-land-on-top that would be a stomp against a
 * non-spiked enemy. For a non-spiked enemy, this is still the exact inverse
 * it always was: any overlap where the player either isn't falling (`vy <=
 * 0`) or is falling but contacting the enemy's lower half (side or below),
 * not landing on its upper half. An enemy currently playing its `hit`
 * reaction is excluded here too, same as stomp detection — otherwise,
 * immediately bouncing off a stomp while still overlapping the now-frozen
 * enemy (rising, or drifting beside it before separating) would register as
 * a spurious side-hit against the very enemy just stomped. A stunned/
 * reacting enemy is harmless in every way until its reaction ends, not just
 * immune to a second stomp — note a freshly-stomped enemy is BOTH `'hit'`
 * and `spiked` at once (`applyStomp` sets both), so this `animState`
 * exclusion is what actually protects it during its stun; `spiked` alone
 * would otherwise make a still-`'hit'`-reacting enemy's top count as damage
 * the instant its stomp registers.
 */
export function checkEnemySideCollisions(player: PlayerState, enemies: EnemyState[]): string[] {
  const hitbox = playerHitbox(player);
  const hits: string[] = [];
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.animState === 'hit') continue;
    const box = enemyHitbox(enemy);
    if (!aabbOverlap(hitbox, box)) continue;
    const enemyMidY = box.y + box.height / 2;
    const isStompLanding = !enemy.spiked && player.vy > 0 && hitbox.y + hitbox.height <= enemyMidY;
    if (!isStompLanding) hits.push(enemy.id);
  }
  return hits;
}

/**
 * True when the player's overlap with `enemy` is exactly the "landing on
 * its upper half while falling" shape `checkEnemyStompCollisions` would
 * normally register as a stomp, but `checkEnemySideCollisions` reported as
 * damage instead because `enemy.spiked` blocked it. Used by
 * `PlatformerPage.tsx` to add a bit of upward knockback on top of the usual
 * horizontal push for this specific case — a failed stomp attempt against
 * spikes should read as "bounced off the top", not identically to a plain
 * side/below touch. Deliberately re-derives the same geometry rather than
 * having `checkEnemySideCollisions` return richer per-hit metadata — this
 * is the only caller that needs the distinction, and every existing caller
 * of `checkEnemySideCollisions` (Collision.test.ts included) keeps working
 * against its unchanged `string[]` return type.
 */
export function isSpikedTopLanding(player: PlayerState, enemy: EnemyState): boolean {
  if (!enemy.spiked || player.vy <= 0) return false;
  const hitbox = playerHitbox(player);
  const box = enemyHitbox(enemy);
  const enemyMidY = box.y + box.height / 2;
  return hitbox.y + hitbox.height <= enemyMidY;
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
