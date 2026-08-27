import {
  PLAYER_RENDERED_SIZE,
  PLAYER_SIDE_PADDING,
  PLAYER_HEAD_PADDING,
  PLAYER_FOOT_PADDING,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import { COIN_RENDERED_SIZE } from '../entities/Coin';
import type { CollectiblePlacement } from '../level/CollectibleMapper';

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
 * cosmetic bob offset (Renderer.ts's drawCoins/drawCollectibles) so the
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
