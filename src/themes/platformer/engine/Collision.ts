import {
  PLAYER_RENDERED_SIZE,
  PLAYER_SIDE_PADDING,
  PLAYER_HEAD_PADDING,
  PLAYER_FOOT_PADDING,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import { COIN_RENDERED_SIZE } from '../entities/Coin';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import { ENEMY_RENDERED_SIZE } from '../entities/Enemy';
import type { EnemyState } from '../entities/Enemy';

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

/** An enemy's collision box — the full render slot (enemies have no
 *  transparent-padding trim the way the player's hitbox does; see Enemy.ts's
 *  doc comment on `ENEMY_TILE_OFFSET_Y`). */
export function enemyHitbox(enemy: EnemyState): Box {
  return { x: enemy.x, y: enemy.y, width: ENEMY_RENDERED_SIZE, height: ENEMY_RENDERED_SIZE };
}

/**
 * Returns the ids of every not-yet-fatally-hit enemy the player just stomped
 * this frame: overlapping AND falling (`player.vy > 0`) AND landing on the
 * enemy's upper half (the player's hitbox bottom edge is at or above the
 * enemy's vertical midpoint) — this is what distinguishes "jumped on top of"
 * from a side/below touch (roadmap step 19's separate concern, intentionally
 * not handled here: this function returns [] for that case, same as for no
 * contact at all). An enemy already `defeated`, or one whose `hitPoints` has
 * already reached 0 (mid `hit`-reaction, awaiting removal), is excluded —
 * without this, a stomp's own bounce naturally arcs back down onto the same
 * enemy, and would otherwise keep decrementing `hitPoints` arbitrarily far
 * below 0 every time (found via live testing). Deliberately NOT gated on
 * `animState === 'hit'` alone, nor on any player-side cooldown/landing/
 * separation tracking — this engine has no double-jump, so "the player
 * lands on the same still-alive enemy again while still airborne from their
 * own stomp bounce" is a deliberate, desired mechanic (chain-stomping a
 * 2-hit purple enemy in one fluid motion), confirmed live with the user, not
 * a bug to guard against. `hitPoints > 0` is the only thing that should stop
 * a stomp from registering.
 */
export function checkEnemyStompCollisions(player: PlayerState, enemies: EnemyState[]): string[] {
  if (player.vy <= 0) return [];
  const hitbox = playerHitbox(player);
  const stomped: string[] = [];
  for (const enemy of enemies) {
    if (enemy.defeated || enemy.hitPoints <= 0) continue;
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
 * Returns the ids of every non-defeated, non-reacting enemy the player is
 * touching in a way that is NOT a stomp (roadmap step 19) — the exact
 * inverse of `checkEnemyStompCollisions`'s landing condition: any overlap
 * where the player either isn't falling (`vy <= 0`) or is falling but
 * contacting the enemy's lower half (side or below), not landing on its
 * upper half. An enemy currently playing its `hit` reaction is excluded here
 * too, same as stomp detection — this was originally left hurt-capable
 * per an earlier design decision, but live testing showed that immediately
 * bouncing off a stomp while still overlapping the now-frozen enemy (rising,
 * or drifting beside it before separating) registered as a spurious side-hit
 * against the very enemy just stomped. A stunned/reacting enemy is now
 * harmless in every way until its reaction ends, not just immune to a
 * second stomp.
 */
export function checkEnemySideCollisions(player: PlayerState, enemies: EnemyState[]): string[] {
  const hitbox = playerHitbox(player);
  const hits: string[] = [];
  for (const enemy of enemies) {
    if (enemy.defeated || enemy.animState === 'hit') continue;
    const box = enemyHitbox(enemy);
    if (!aabbOverlap(hitbox, box)) continue;
    const enemyMidY = box.y + box.height / 2;
    const isStompLanding = player.vy > 0 && hitbox.y + hitbox.height <= enemyMidY;
    if (!isStompLanding) hits.push(enemy.id);
  }
  return hits;
}
