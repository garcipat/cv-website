import {
  PLAYER_RENDERED_SIZE,
  PLAYER_SIDE_PADDING,
  PLAYER_FOOT_PADDING,
  playerHeadPaddingFor,
  playerBoxHeightFor,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import type { EnemyState } from '../entities/Enemy';
import { typeOf } from '../entities/enemies';
import type { ContactSide } from '../contracts/Contact';
import { BONUS_FRUIT_RISE_DURATION_SECONDS } from '../entities/BonusFruit';
import type { BonusFruitState } from '../entities/BonusFruit';
import { isChestOpen } from '../entities/Chest';
import type { ChestState } from '../entities/Chest';
import { CHEST_TYPE } from '../entities/chests';
import { signBox } from '../level/SignMapper';
import type { SignPlacement } from '../level/SignMapper';
import { typeOf as hazardTypeOf } from '../entities/hazards';
import type { HazardPlacement } from '../level/HazardMapper';
import { RENDER_SCALE, RENDERED_TILE_SIZE, tileAt } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import type { FloorSpikeTimerState } from '../entities/hazards/phases';
import { isFloorSpikeArmed } from './FloorSpike';
import type { CrumblingFloorTimerState } from './CrumblingFloor';
import { isCrumblingFloorArmed } from './CrumblingFloor';
import { isFallingStalactiteArmed, detectionZoneCells } from './FallingStalactite';
import type { FallingStalactiteTimerState } from '../entities/hazards/phases';
import type { BlockPlacement } from '../level/BlockMapper';
import type { HintId } from '../types';
import type { KeyPickupState } from '../entities/KeyPickup';
import type { HeartPickupState } from '../entities/HeartPickup';
import type { BombPickupState } from '../entities/BombPickup';
import { MAX_HALF_HEARTS } from '../entities/Health';
import { PICKUP_TYPES } from '../entities/pickups';
import { strongerBounce } from '../contracts/Outcome';
import type { Box } from '../contracts/geometry';

/**
 * The player's collision box — same narrower-than-render-slot box
 * Physics.ts's terrain collision already uses (PLAYER_SIDE_PADDING on each
 * side, PLAYER_HEAD_PADDING off the top, PLAYER_FOOT_PADDING off the
 * bottom), so a coin the player's sprite art doesn't actually touch never
 * registers as collected. The top offset and height come from the shared
 * `playerHeadPaddingFor`/`playerBoxHeightFor` pair, so every consumer of this
 * box sees the one-tile crouched height while `player.crouching` is true and
 * the full standing height otherwise (FR-002/SC-008).
 */
export function playerHitbox(player: PlayerState): Box {
  return {
    x: player.x + PLAYER_SIDE_PADDING,
    y: player.y + playerHeadPaddingFor(player.crouching),
    width: PLAYER_RENDERED_SIZE - 2 * PLAYER_SIDE_PADDING,
    height: playerBoxHeightFor(player.crouching),
  };
}

/** Standard axis-aligned bounding box overlap — touching edges (zero-area
 *  intersection) do not count as overlapping. */
export function aabbOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

const ALWAYS_ELIGIBLE = () => true;

/**
 * Every trigger — pickup, chest, sign — whose box overlaps the player's
 * hitbox and that its caller considers eligible right now, in the order the
 * items were given. Matches are returned by reference, so a tick that touches
 * nothing allocates only the empty array. Callers wanting just the nearest-in-
 * array trigger take `[0]`.
 *
 * Eligibility is a caller-supplied predicate rather than a property of the
 * item, because the trigger families record "no longer available" differently:
 * placed collectibles are deduplicated against an external id Set, dropped
 * keys carry a `collected` flag, bonus fruits are removed from their array
 * outright, chests read their own open/closed state, and signs are reusable
 * and never become ineligible at all (they omit the predicate). The overlap
 * mechanism is shared; the policy stays with whoever owns it.
 */
export function overlappingTriggers<T>(
  player: PlayerState,
  items: readonly T[],
  boxOf: (item: T) => Box,
  eligible: (item: T) => boolean = ALWAYS_ELIGIBLE,
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
  return overlappingTriggers(
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
  /** The strongest (most negative) bounce any contacted enemy asked for, or
   *  undefined if none did. Most-negative-wins rather than last-wins so the
   *  result does not depend on enemy array order. */
  bounceVelocity?: number;
  knockback: 'none' | 'away' | 'awayAndUp';
  /** Which way "away" points: -1 pushes the player left, 1 right. Derived from
   *  the first damaging contact's hitbox centers — the geometry stays here so
   *  no caller has to re-derive it. Meaningless while `knockback` is 'none'. */
  knockbackDirection: -1 | 1;
  /** Ids of every enemy that actually took damage this tick (hit points
   *  decreased), whether or not that hit defeated it — drives the hit
   *  splatter effect (S-010), independent of the existing defeat puff.
   *  Unlike `damagePlayer` (max of one hit per tick, to protect the
   *  player from a multi-enemy pile-on), there's no "at most one" rule
   *  here: each contacted enemy is its own event. */
  damagedEnemyIds: string[];
}

const KNOCKBACK_RANK = { none: 0, away: 1, awayAndUp: 2 } as const;

/**
 * Computes contact geometry against every living enemy and asks each one's
 * type what the contact means, then aggregates.
 *
 * Aggregation rules, owned here and nowhere else: at most one damage applies
 * per tick regardless of how many enemies are touched; the strongest requested
 * bounce applies; 'awayAndUp' wins over 'away', which wins over 'none'.
 */
export function resolveEnemyContacts(
  player: PlayerState,
  enemies: readonly EnemyState[],
): EnemyContactResult {
  const playerBox = playerHitbox(player);
  let merged: EnemyState[] | undefined;
  let damagePlayer = 0;
  let bounceVelocity: number | undefined;
  let knockback: 'none' | 'away' | 'awayAndUp' = 'none';
  let knockbackDirection: -1 | 1 = 1;
  const damagedEnemyIds: string[] = [];

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
      if (damage > 0) damagedEnemyIds.push(enemy.id);
      merged ??= [...enemies];
      merged[i] =
        damage > 0 && enemyType.onDamaged ? enemyType.onDamaged(outcome.self, damage) : outcome.self;
    }
    bounceVelocity = strongerBounce(bounceVelocity, outcome.bounceVelocity);
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
    bounceVelocity,
    knockback,
    knockbackDirection,
    damagedEnemyIds,
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
  return overlappingTriggers(
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
  return overlappingTriggers(player, chests, CHEST_TYPE.box, (c) => !isChestOpen(c))[0]?.id;
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
  return overlappingTriggers(player, signs, signBox)[0]?.hintId;
}

/** The outcome of one tick's hazard contacts — see `resolveHazardContacts`. */
export interface HazardContactResult {
  /** The first qualifying lethal hazard this tick, or undefined. */
  lethal?: HazardPlacement;
  /** Half-hearts an ordinary contact costs; 0 when none or when lethal. */
  damage: number;
  /** The hazard that will apply `damage` (for knockback direction), if any. */
  hazard?: HazardPlacement;
}

/**
 * Resolves the player's hazard contacts for one tick, kind-agnostically: the
 * broad phase is each kind's own `box` overlap, and each kind's optional
 * `isContact` decides whether that overlap actually qualifies (absent =
 * always true, so every existing kind is unchanged). A floor spike's own
 * `isContact` is what excludes it outside its full-extend phase — `box()`
 * stays a constant geometric rect, not a phase-gated one, since a zero-size
 * rect AT the hazard's position can still satisfy `aabbOverlap`'s strict
 * `<`/`>` comparisons whenever the player's hitbox straddles that exact
 * point (which it almost always does while simply standing on the tile);
 * `isContact` is the correct place to encode "not hazardous right now",
 * checked only after the broad-phase box overlap already passed.
 *
 * A qualifying `lethal` kind is returned as `lethal` and takes precedence
 * over any ordinary hazard in the same tick (FR-012); otherwise the first
 * qualifying non-lethal hazard supplies `damage`/`hazard`, so at most one
 * ordinary hit registers per tick (O-005 FR-005). Never mutates its inputs;
 * allocates only the result object.
 *
 * Replaces `checkHazardCollisions` (an overlap-only list) as the single
 * hazard-resolution path — see `PlatformerPage.tsx`'s tick.
 */
export function resolveHazardContacts(
  player: PlayerState,
  hazards: readonly HazardPlacement[],
): HazardContactResult {
  const playerBox = playerHitbox(player);
  let damage = 0;
  let hazard: HazardPlacement | undefined;

  for (const candidate of hazards) {
    const hazardType = hazardTypeOf(candidate);
    if (!aabbOverlap(playerBox, hazardType.box(candidate))) continue;
    if (hazardType.isContact && !hazardType.isContact(candidate, player, playerBox)) continue;
    if (hazardType.lethal) return { lethal: candidate, damage: 0 };
    if (hazard === undefined) {
      damage = hazardType.damage;
      hazard = candidate;
    }
  }

  return { damage, hazard };
}

/** Same visible-band convention as Spike.ts / FloorSpike.ts's BAND_NATIVE —
 *  duplicated here (rather than imported) deliberately: this is a TRIGGER
 *  box, constant regardless of phase, not the hazard's own phase-varying
 *  damage box (`floorSpike.box`). The two happen to share dimensions today
 *  (both are floor-only, both use the same band) but conceptually answer
 *  different questions — "can this tile arm?" vs. "is this tile hazardous
 *  right now?" — so they are kept as separate functions rather than one
 *  reused across both purposes.
 */
function floorSpikeTriggerBox(hazard: HazardPlacement): Box {
  const band = 5 * RENDER_SCALE;
  return {
    x: hazard.x,
    y: hazard.y + RENDERED_TILE_SIZE - band,
    width: RENDERED_TILE_SIZE,
    height: band,
  };
}

/**
 * Returns the ids of every at-rest floor spike the player's hitbox
 * currently overlaps — candidates `PlatformerPage.tsx` should arm this tick
 * (spec FR-003: contact starts the cycle exactly once). A floor spike whose
 * cycle is already running is not eligible (spec FR-008), which is why this
 * takes `timers` rather than relying on `hazards` alone — a floor spike's
 * `HazardPlacement` carries no in-progress-or-not information of its own.
 */
export function checkFloorSpikeTriggers(
  player: PlayerState,
  hazards: readonly HazardPlacement[],
  timers: readonly FloorSpikeTimerState[],
): string[] {
  return overlappingTriggers(
    player,
    hazards,
    floorSpikeTriggerBox,
    (h) => h.hazardType === 'floorSpike' && !isFloorSpikeArmed(timers, h.id),
  ).map((h) => h.id);
}

/**
 * Returns the grid cells of every at-rest crumbling floor tile the player's
 * feet currently overlap — candidates `PlatformerPage.tsx` should arm this
 * tick (spec FR-003). Unlike `checkFloorSpikeTriggers`, there is no
 * `HazardPlacement` list to scan: a crumbling floor tile is a plain terrain
 * cell, so this walks the same footRow/column-range the ground-collision
 * branch of `Physics.ts` uses, rather than `overlappingTriggers`' box-list
 * approach.
 */
export function checkCrumblingFloorTriggers(
  player: PlayerState,
  level: LevelDef,
  states: readonly CrumblingFloorTimerState[],
): { col: number; row: number }[] {
  // Only an actually-grounded player can arm a tile — otherwise a jump arc
  // whose feet-row Y momentarily coincides with a crumbling floor tile
  // (jumping over it, or through the space above it) would incorrectly
  // start its crack cycle without the player ever landing on it.
  if (!player.grounded) return [];
  const hitboxWidth = PLAYER_RENDERED_SIZE - 2 * PLAYER_SIDE_PADDING;
  const leftCol = Math.floor((player.x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE);
  const rightCol = Math.floor((player.x + PLAYER_SIDE_PADDING + hitboxWidth - 1) / RENDERED_TILE_SIZE);
  const feetY = player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING;
  const footRow = Math.floor(feetY / RENDERED_TILE_SIZE);

  const results: { col: number; row: number }[] = [];
  for (let col = leftCol; col <= rightCol; col++) {
    if (tileAt(level, col, footRow) !== 'crumblingFloor') continue;
    if (isCrumblingFloorArmed(states, col, footRow)) continue;
    results.push({ col, row: footRow });
  }
  return results;
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
  return overlappingTriggers(
    player,
    pickups,
    (p) => PICKUP_TYPES.key.box(p),
    (p) => !p.collected,
  ).map((p) => p.id);
}

/**
 * Returns the ids of every heart pickup the player's hitbox currently
 * overlaps AND that the player can actually benefit from — gated on
 * `hitPoints < MAX_HALF_HEARTS` so a heart waits in the world rather than
 * being consumed for nothing at full health. Otherwise mirrors
 * `checkBonusFruitCollisions` (no `collectedIds`/`collected` flag):
 * `PlatformerPage.tsx` removes a touched heart from its live array entirely
 * the same tick, same as a bonus fruit.
 */
export function checkHeartPickupCollisions(
  player: PlayerState,
  hearts: readonly HeartPickupState[],
): string[] {
  if (player.hitPoints >= MAX_HALF_HEARTS) return [];
  return overlappingTriggers(player, hearts, (h) => PICKUP_TYPES.heart.box(h)).map((h) => h.id);
}

/**
 * Returns the ids of bomb pickups the player's hitbox currently overlaps,
 * limited to `max(0, cap - count)` ids in array order (FR-008/FR-009) — so a
 * tick that touches several pickups at once can never overfill the inventory.
 * At the cap it returns `[]`, leaving every pickup in the world, still
 * bobbing. Uses the same `overlappingTriggers` helper as the heart/key checks;
 * `bobOffset` is a draw-only offset, so collision ignores it.
 */
export function checkBombPickupCollisions(
  player: PlayerState,
  bombs: readonly BombPickupState[],
  count: number,
  cap: number,
): string[] {
  const capacity = Math.max(0, cap - count);
  if (capacity === 0) return [];
  return overlappingTriggers(player, bombs, (b) => PICKUP_TYPES.bomb.box(b))
    .slice(0, capacity)
    .map((b) => b.id);
}

/**
 * Returns the ids of every hanging falling stalactite whose detection zone the
 * player's hitbox currently overlaps — candidates `PlatformerPage.tsx` should
 * arm this tick (FR-003). An already-armed hazard is not eligible (arming is
 * irreversible, FR-004), which is why this takes `states` rather than relying
 * on `hazards` alone — a placement carries no armed-or-not information of its
 * own. Pure; never mutates its inputs.
 */
export function checkFallingStalactiteTriggers(
  player: PlayerState,
  hazards: readonly HazardPlacement[],
  states: readonly FallingStalactiteTimerState[],
  level: LevelDef,
  blocks: readonly BlockPlacement[],
  crumblingFloorStates: readonly CrumblingFloorTimerState[],
): string[] {
  const hitbox = playerHitbox(player);
  const ids: string[] = [];
  for (const hazard of hazards) {
    if (hazard.hazardType !== 'fallingStalactite') continue;
    if (isFallingStalactiteArmed(states, hazard.id)) continue;
    const zone = detectionZoneCells(hazard, level, blocks, crumblingFloorStates);
    const overlaps = zone.some((cell) =>
      aabbOverlap(hitbox, {
        x: cell.col * RENDERED_TILE_SIZE,
        y: cell.row * RENDERED_TILE_SIZE,
        width: RENDERED_TILE_SIZE,
        height: RENDERED_TILE_SIZE,
      }),
    );
    if (overlaps) ids.push(hazard.id);
  }
  return ids;
}
