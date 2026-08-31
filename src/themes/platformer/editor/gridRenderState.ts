import { TERRAIN_CHARS, type TileChar } from '../level/LevelParser';
import type { LevelDef, TileMap } from '../level/LevelData';
import { tileToPixel } from '../level/Terrain';
import type { PlayerState } from '../entities/Player';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import { toEnemyState, type EnemyState } from '../entities/Enemy';
import type { EnemyPlacement } from '../level/EnemyMapper';
import { toBlockState, type BlockState, type BlockKind } from '../entities/Block';
import type { BlockPlacement } from '../level/BlockMapper';
import { toChestState, type ChestState } from '../entities/Chest';
import type { ChestPlacement } from '../level/ChestMapper';
import type { CollectedFact } from '../types';

/**
 * Fed to every synthesized placeholder that requires a `fact: CollectedFact`
 * field (collectibles, enemies, chests). None of the reused draw functions
 * read `fact` — only position/kind/animation fields — so a single fixed
 * stub is safe everywhere it's needed.
 */
const PLACEHOLDER_FACT: CollectedFact = {
  id: 'editor-placeholder',
  sectionId: 'skills',
  sectionLabel: 'Skills',
  data: { category: 'Placeholder', skills: [] },
  sourceType: 'coin',
};

function findAllPositions(
  grid: TileChar[][],
  char: TileChar,
): { col: number; row: number }[] {
  const positions: { col: number; row: number }[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] === char) {
        positions.push({ col, row });
      }
    }
  }
  return positions;
}

/** Converts the grid's terrain characters into a `LevelDef`, via the same
 *  `TERRAIN_CHARS` mapping `parseLevel` uses — entity markers become
 *  `'empty'` terrain, matching `parseLevel`'s convention. */
export function gridToLevelDef(grid: TileChar[][]): LevelDef {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const terrain: TileMap = grid.map((row) => row.map((char) => TERRAIN_CHARS[char] ?? 'empty'));
  return { terrain, width, height };
}

/** Returns a fixed-idle placeholder `PlayerState` at the grid's `S` marker,
 *  or `null` if none exists yet. */
export function synthesizePlayerState(grid: TileChar[][]): PlayerState | null {
  const [spawn] = findAllPositions(grid, 'S');
  if (!spawn) return null;
  const { x, y } = tileToPixel(spawn.col, spawn.row);
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 'right',
    grounded: true,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    invincibleTimer: 0,
    knockbackTimer: 0,
    hitBlockIds: [],
    bounceAscending: false,
  };
}

/** Returns one fixed-frame coin placeholder per `C` marker. There is no
 *  fruit marker character — fruit only spawns from a hit question-mark
 *  block in the real game, so `spriteType` is always `'coin'` here. */
export function synthesizeCollectiblePlacements(grid: TileChar[][]): CollectiblePlacement[] {
  return findAllPositions(grid, 'C').map(({ col, row }, index) => {
    const { x, y } = tileToPixel(col, row);
    return {
      id: `editor-coin-${index}`,
      spriteType: 'coin',
      fact: PLACEHOLDER_FACT,
      x,
      y,
    };
  });
}

function synthesizeEnemyPlacements(
  grid: TileChar[][],
  char: TileChar,
  spriteType: EnemyPlacement['spriteType'],
  idPrefix: string,
): EnemyPlacement[] {
  return findAllPositions(grid, char).map(({ col, row }, index) => {
    const { x, y } = tileToPixel(col, row);
    return { id: `${idPrefix}-${index}`, spriteType, fact: PLACEHOLDER_FACT, x, y };
  });
}

/** Returns one fixed-idle-walk placeholder `EnemyState` per `E` (slimeGreen)
 *  and `M` (slimePurple) marker, built via the engine's own `toEnemyState`. */
export function synthesizeEnemyStates(grid: TileChar[][]): EnemyState[] {
  const green = synthesizeEnemyPlacements(grid, 'E', 'slimeGreen', 'editor-enemy-green');
  const purple = synthesizeEnemyPlacements(grid, 'M', 'slimePurple', 'editor-enemy-purple');
  return [...green, ...purple].map((placement) => toEnemyState(placement));
}

function synthesizeBlockPlacements(
  grid: TileChar[][],
  char: TileChar,
  blockKind: BlockKind,
  idPrefix: string,
): BlockPlacement[] {
  return findAllPositions(grid, char).map(({ col, row }, index) => {
    const { x, y } = tileToPixel(col, row);
    return { id: `${idPrefix}-${index}`, blockKind, x, y };
  });
}

/** Returns one intact (never-hit) placeholder `BlockState` per `X` (crate),
 *  `Q` (questionMark), and `F` (fragileRock) marker, via `toBlockState`. */
export function synthesizeBlockStates(grid: TileChar[][]): BlockState[] {
  const crates = synthesizeBlockPlacements(grid, 'X', 'crate', 'editor-crate');
  const questionMarks = synthesizeBlockPlacements(grid, 'Q', 'questionMark', 'editor-question');
  const fragileRocks = synthesizeBlockPlacements(grid, 'F', 'fragileRock', 'editor-fragile');
  return [...crates, ...questionMarks, ...fragileRocks].map((placement) => toBlockState(placement));
}

/** Returns one always-closed placeholder `ChestState` per `T` marker, via
 *  `toChestState` (which always defaults to `'closed'`). */
export function synthesizeChestStates(grid: TileChar[][]): ChestState[] {
  const placements: ChestPlacement[] = findAllPositions(grid, 'T').map(({ col, row }, index) => {
    const { x, y } = tileToPixel(col, row);
    return { id: `editor-chest-${index}`, fact: PLACEHOLDER_FACT, x, y };
  });
  return placements.map((placement) => toChestState(placement));
}
