import {
  PLAYER_RENDERED_SIZE,
  PLAYER_SIDE_PADDING,
  PLAYER_FOOT_PADDING,
  playerHeadPaddingFor,
  playerBoxHeightFor,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import type { EnemyState } from '../entities/Enemy';
import { typeOf } from '../entities/enemies';
import { isChestOpen } from '../entities/Chest';
import type { ChestState } from '../entities/Chest';
import { CHEST_TYPE } from '../entities/chests';
import { signBox } from '../level/SignMapper';
import type { SignPlacement } from '../level/SignMapper';
import { typeOf as hazardTypeOf } from '../entities/hazards';
import type { HazardPlacement } from '../level/HazardMapper';
import type { HazardTickContext } from '../entities/hazards/HazardType';
import { RENDERED_TILE_SIZE, tileAt } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import type { CrumblingFloorTimerState } from './CrumblingFloor';
import { isCrumblingFloorArmed } from './CrumblingFloor';
import type { SignHintId } from '../level/HintCatalog';
import { PICKUP_TYPES } from '../entities/pickups';
import type { Pickup, PickupGroups } from '../contracts/Pickup';
import type { PickupKind } from '../contracts/PickupKind';
import type { PickupCollisionContext } from '../contracts/Pickup';
import { strongerBounce, type ContactSide } from '../contracts/Outcome';
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
 * pickups carry the shared `Pickup.collected` flag, chests read their own
 * open/closed state, and signs are reusable and never become ineligible at all
 * (they omit the predicate). The overlap mechanism is shared; the policy stays
 * with whoever owns it.
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

/** One overlapped pickup: its kind discriminant and its state. */
export interface PickupHit {
  kind: PickupKind;
  state: Pickup;
}

/**
 * THE one generic pickup collision path — returns every pickup the player's
 * hitbox overlaps and that its kind's own eligibility allows, in each kind's
 * array order and concatenated in `groups` insertion order. Replaces the five
 * family-specific collision functions.
 *
 * The shared base gate is each state's own `!collected` (the one collect-once
 * flag; there is no external id set and nothing is removed on collect). Each
 * kind may add one extra gate via `PICKUP_TYPES[kind].isCollectible`
 * (fruit rise, heart full-health) and cap its per-tick selection via
 * `maxPerTick` (bomb capacity) — so no family-specific rule is lost while the
 * engine names no kind. Boxes come from `PICKUP_TYPES[kind].box`, which
 * ignores the cosmetic draw-only bob offset so the hitbox does not jitter.
 */
export function checkPickupCollisions(
  player: PlayerState,
  groups: PickupGroups,
  ctx: PickupCollisionContext,
): PickupHit[] {
  const hits: PickupHit[] = [];
  for (const kind of Object.keys(groups) as PickupKind[]) {
    const items = groups[kind];
    if (!items) continue;
    const type = PICKUP_TYPES[kind];
    const matched = overlappingTriggers(
      player,
      items,
      (state) => type.box(state),
      (state) => !state.collected && (type.isCollectible?.(state, ctx) ?? true),
    );
    const cap = type.maxPerTick?.(ctx);
    const limited = cap === undefined ? matched : matched.slice(0, Math.max(0, cap));
    for (const state of limited) hits.push({ kind, state });
  }
  return hits;
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
 * Returns the id of the first closed chest the player's hitbox currently
 * overlaps, or `undefined` if none — spec.md FR-023: unlike every other
 * collectible, a chest does NOT open on touch; the caller (PlatformerPage.tsx)
 * only opens it once this returns an id AND the visitor has pressed Arrow Up
 * this tick. Only a chest's CLOSED footprint is checked (its open sprite is a
 * different size and the chest is un-openable again anyway, so an open
 * chest's box is irrelevant here) — mirrors the pickups' single-box-per-item
 * convention. The box comes from `CHEST_TYPE.box`,
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
 * overlaps, or `undefined` if none. Unlike the pickup collision path, this
 * is NOT destructive/dedup-tracked — a sign is reusable, so the same sign
 * returns its hintId every tick the player stands on it, and again the next
 * time they walk back onto it. The box comes from `signBox`
 * (level/SignMapper.ts) — exactly one rendered tile, matching how it's
 * drawn (Renderer.ts).
 */
export function checkSignOverlap(
  player: PlayerState,
  signs: readonly SignPlacement[],
): SignHintId | undefined {
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

/**
 * Returns the ids of every hazard the player's hitbox currently overlaps a
 * NEW-ARMING trigger rect for — candidates `PlatformerPage.tsx` should arm
 * this tick (spec FR-003: contact starts the cycle exactly once). The
 * trigger geometry and the already-armed eligibility gate are the hazard
 * kind's own knowledge (`HazardType.armTriggerRects`): a floor spike returns
 * its trigger band only while at rest, a falling stalactite its detection-zone
 * cells only while hanging, and a static kind (spike/spear) omits the hook
 * entirely. Iterates in array order, exactly as the two replaced kind-switched
 * functions did. Pure; never mutates its inputs.
 */
export function checkHazardArmTriggers(
  player: PlayerState,
  hazards: readonly HazardPlacement[],
  ctx: HazardTickContext,
): string[] {
  const hitbox = playerHitbox(player);
  const ids: string[] = [];
  for (const hazard of hazards) {
    const rects = hazardTypeOf(hazard).armTriggerRects?.(hazard, ctx);
    if (!rects) continue;
    if (rects.some((rect) => aabbOverlap(hitbox, rect))) ids.push(hazard.id);
  }
  return ids;
}

/**
 * Returns the grid cells of every at-rest crumbling floor tile the player's
 * feet currently overlap — candidates `PlatformerPage.tsx` should arm this
 * tick (spec FR-003). Unlike `checkHazardArmTriggers`, there is no
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

