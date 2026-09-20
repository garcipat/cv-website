import type { BlockState } from '../entities/Block';
import { isBlockUsedUp } from '../entities/Block';
import { BLOCK_TYPES } from '../entities/blocks';
import type { EnemyState } from '../entities/Enemy';
import { typeOf } from '../entities/enemies';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { aabbOverlap, type Box } from './Collision';

/** Blast radius in tiles — a radius of 2 gives a rounded 5×5 area (FR-018). */
export const BLAST_RADIUS = 2;

/** One tile in a blast's area. */
export interface BlastTile {
  col: number;
  row: number;
}

/**
 * The rounded block of cells centred on `(col, row)` — `BLAST_RADIUS` tiles in
 * every direction (a 5×5 at the default radius of 2), minus the corner tiles,
 * so the area reads as a circle rather than a square. A tile is kept when its
 * centre lies within `BLAST_RADIUS + 0.5` tiles of the blast centre — the
 * circle that touches the square's edge midpoints — which for radius 2 keeps
 * 21 of the 25 cells (the four extreme `(±2, ±2)` corners are dropped).
 * Clipped to the level bounds (FR-018). Pure; no side effects, and no
 * line-of-sight rule — a blast reaches through intervening blocks (FR-024).
 */
export function blastTiles(col: number, row: number, width: number, height: number): BlastTile[] {
  const tiles: BlastTile[] = [];
  const reachSquared = (BLAST_RADIUS + 0.5) ** 2;
  for (let r = row - BLAST_RADIUS; r <= row + BLAST_RADIUS; r++) {
    for (let c = col - BLAST_RADIUS; c <= col + BLAST_RADIUS; c++) {
      const dx = c - col;
      const dy = r - row;
      if (dx * dx + dy * dy > reachSquared) continue;
      if (c >= 0 && c < width && r >= 0 && r < height) tiles.push({ col: c, row: r });
    }
  }
  return tiles;
}

function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * Every live, destructible block whose tile is in the blast. "Destructible"
 * means the kind leaves the world when used up (`removeWhenUsedUp`) — a
 * crate, fragile rock or any pot. A question-mark block never leaves the
 * world, so it is not a target (FR-019/FR-022), and an already-used-up block
 * is inert. Terrain and static objects are not blocks and are never
 * enumerated (FR-022).
 */
export function blocksInBlast(blocks: readonly BlockState[], tiles: readonly BlastTile[]): BlockState[] {
  const keys = new Set(tiles.map((tile) => tileKey(tile.col, tile.row)));
  return blocks.filter((block) => {
    if (!BLOCK_TYPES[block.blockKind].removeWhenUsedUp) return false;
    if (isBlockUsedUp(block)) return false;
    const col = Math.round(block.x / RENDERED_TILE_SIZE);
    const row = Math.round(block.y / RENDERED_TILE_SIZE);
    return keys.has(tileKey(col, row));
  });
}

/**
 * Every alive enemy whose hitbox overlaps any blast tile (FR-020). Overlap is
 * an AABB intersection, so an enemy straddling the area's boundary counts if
 * any part of its box overlaps.
 */
export function enemiesInBlast(
  enemies: readonly EnemyState[],
  tiles: readonly BlastTile[],
  tileSize: number,
): EnemyState[] {
  return enemies.filter((enemy) => {
    if (!enemy.alive) return false;
    const box = typeOf(enemy).box(enemy);
    return tiles.some((tile) =>
      aabbOverlap(box, {
        x: tile.col * tileSize,
        y: tile.row * tileSize,
        width: tileSize,
        height: tileSize,
      }),
    );
  });
}

/** Whether the player's hitbox (the caller passes `playerHitbox(player)`)
 *  overlaps any blast tile (FR-021). */
export function playerInBlast(playerBox: Box, tiles: readonly BlastTile[], tileSize: number): boolean {
  return tiles.some((tile) =>
    aabbOverlap(playerBox, {
      x: tile.col * tileSize,
      y: tile.row * tileSize,
      width: tileSize,
      height: tileSize,
    }),
  );
}
