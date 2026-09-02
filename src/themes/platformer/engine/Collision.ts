import {
  PLAYER_RENDERED_SIZE,
  PLAYER_SIDE_PADDING,
  PLAYER_HEAD_PADDING,
  PLAYER_FOOT_PADDING,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import type { EnemyState } from '../entities/Enemy';
import { typeOf } from '../entities/enemies';
import type { ContactSide } from './Contact';
import { BONUS_FRUIT_RISE_DURATION_SECONDS } from '../entities/BonusFruit';
import type { BonusFruitState } from '../entities/BonusFruit';
import { isChestOpen } from '../entities/Chest';
import type { ChestState } from '../entities/Chest';
import { CHEST_TYPE } from '../entities/chests';
import { signBox } from '../level/SignMapper';
import type { SignPlacement } from '../level/SignMapper';
import type { HintId } from '../types';
import type { KeyPickupState } from '../entities/KeyPickup';
import { PICKUP_TYPES } from '../entities/pickups';

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
 * Every item whose box overlaps the player's hitbox and that its caller
 * considers eligible right now.
 *
 * Eligibility is a caller-supplied predicate rather than a property of the
 * item, because the pickup families record "already collected" differently:
 * placed collectibles are deduplicated against an external id Set, dropped
 * keys carry a `collected` flag, and bonus fruits are removed from their
 * array outright. The overlap mechanism is shared; the policy stays with
 * whoever owns it.
 */
export function overlappingPickups<T>(
  player: PlayerState,
  items: readonly T[],
  boxOf: (item: T) => Box,
  eligible: (item: T) => boolean,
): T[] {
  const hitbox = playerHitbox(player);
  const hits: T[] = [];
  for (const item of items) {
    if (!eligible(item)) continue;
    if (aabbOverlap(hitbox, boxOf(item))) hits.push(item);
  }
  return hits;
}

/**
 * Returns the ids of every placement the player's hitbox currently overlaps,
 * excluding ids already in `collectedIds` — collision against an
 * already-collected (visually removed) collectible is a no-op, not a
 * duplicate-collect (FR-020c). Boxes come from `PICKUP_TYPES[spriteType].box`,
 * which uses each placement's fixed x/y, ignoring the cosmetic bob offset
 * (applied only when drawing — see each pickup type's own `bobOffset` under
 * entities/pickups/) so the hitbox doesn't jitter a few pixels every frame
 * independent of the sprite. A coin placement's box is
 * `COIN_RENDERED_SIZE` square and a fruit placement's is `FRUIT_RENDERED_SIZE`
 * square — both currently equal 32, so routing per-placement through its own
 * pickup type is a no-op versus the single shared size this function used to
 * hardcode.
 */
export function checkCollectibleCollisions(
  player: PlayerState,
  placements: CollectiblePlacement[],
  collectedIds: ReadonlySet<string>,
): string[] {
  return overlappingPickups(
    player,
    placements,
    (p) => PICKUP_TYPES[p.spriteType].box(p),
    (p) => !collectedIds.has(p.id),
  ).map((p) => p.id);
}

export interface EnemyContactResult {
  /** The enemy array with every contacted enemy's returned `self` merged in.
   *  Enemies with no contact are returned unchanged, by reference. */
  enemies: EnemyState[];
  /** Half-hearts. The caller drops this while the player is invulnerable. */
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
    const enemyType = typeOf(enemy);
    const selfBox = enemyType.box(enemy);
    if (!aabbOverlap(playerBox, selfBox)) continue;

    const landsOnUpperHalf = playerBox.y + playerBox.height <= selfBox.y + selfBox.height / 2;
    const side: ContactSide = player.vy > 0 && landsOnUpperHalf ? 'top' : 'side';
    const outcome = enemyType.onPlayerCollide(enemy, player, {
      side,
      playerVx: player.vx,
      playerVy: player.vy,
      playerBox,
      selfBox,
    });

    if (outcome.self) {
      // A contact that cost hit points is a landed hit, so whatever taking
      // one costs this type beyond the decrement (a temporary defense, say)
      // is applied here — the type decides what a touch means, the engine
      // decides that the resulting hit is a fact and pays for it.
      const damage = enemy.hitPoints - outcome.self.hitPoints;
      merged ??= [...enemies];
      merged[i] =
        damage > 0 && enemyType.onDamaged ? enemyType.onDamaged(outcome.self, damage) : outcome.self;
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
  return overlappingPickups(
    player,
    fruits,
    (f) => PICKUP_TYPES.bonusFruit.box(f),
    (f) => f.elapsed >= BONUS_FRUIT_RISE_DURATION_SECONDS,
  ).map((f) => f.id);
}

/**
 * Returns the id of the first closed chest the player's hitbox currently
 * overlaps, or `undefined` if none — spec.md FR-023: unlike every other
 * collectible, a chest does NOT open on touch; the caller (PlatformerPage.tsx)
 * only opens it once this returns an id AND the visitor has pressed Arrow Up
 * this tick. Only a chest's CLOSED footprint is checked (its open sprite is a
 * different size and the chest is un-openable again anyway, so an open
 * chest's box is irrelevant here) — mirrors checkBonusFruitCollisions'
 * single-box-per-item convention. The box comes from `CHEST_TYPE.box`,
 * which shifts its x by CHEST_CLOSED_OFFSET_X (see entities/Chest.ts) so it
 * matches exactly where the closed chest is drawn (centered on its tile,
 * not left-aligned to the tile's top-left corner).
 */
export function chestPlayerIsStandingOn(
  player: PlayerState,
  chests: readonly ChestState[],
): string | undefined {
  const hitbox = playerHitbox(player);
  for (const chest of chests) {
    if (isChestOpen(chest)) continue;
    if (aabbOverlap(hitbox, CHEST_TYPE.box(chest))) return chest.id;
  }
  return undefined;
}

/**
 * Returns the `hintId` of the first sign the player's hitbox currently
 * overlaps, or `undefined` if none. Unlike checkCollectibleCollisions, this
 * is NOT destructive/dedup-tracked — a sign is reusable, so the same sign
 * returns its hintId every tick the player stands on it, and again the next
 * time they walk back onto it. The box comes from `signBox`
 * (level/SignMapper.ts) — exactly one rendered tile, matching how it's
 * drawn (Renderer.ts).
 */
export function checkSignOverlap(
  player: PlayerState,
  signs: readonly SignPlacement[],
): HintId | undefined {
  const hitbox = playerHitbox(player);
  for (const sign of signs) {
    if (aabbOverlap(hitbox, signBox(sign))) return sign.hintId;
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
 * centering/bottom-anchoring entities/pickups/Key.ts's `box`/`draw` apply,
 * so the collidable area matches where the key is actually drawn rather
 * than the tile's raw top-left corner.
 */
export function checkKeyPickupCollisions(
  player: PlayerState,
  pickups: readonly KeyPickupState[],
): string[] {
  return overlappingPickups(
    player,
    pickups,
    (p) => PICKUP_TYPES.key.box(p),
    (p) => !p.collected,
  ).map((p) => p.id);
}
