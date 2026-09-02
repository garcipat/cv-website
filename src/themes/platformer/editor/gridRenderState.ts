import { TERRAIN_CHARS, SIGN_CHARS, type TileChar } from '../level/LevelParser';
import type { LevelDef, TileMap } from '../level/LevelData';
import { tileToPixel, RENDERED_TILE_SIZE } from '../level/Terrain';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import { MAX_HALF_HEARTS } from '../entities/Health';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import { toEnemyState, type EnemyState } from '../entities/Enemy';
import type { EnemyPlacement } from '../level/EnemyMapper';
import { toBlockState, type BlockState, type BlockKind } from '../entities/Block';
import type { BlockPlacement } from '../level/BlockMapper';
import { toChestState, type ChestState } from '../entities/Chest';
import type { ChestPlacement } from '../level/ChestMapper';
import type { SignPlacement } from '../level/SignMapper';
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

function findAllPositions(grid: TileChar[][], char: TileChar): { col: number; row: number }[] {
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
 *  or `null` if none exists yet. Position matches the real game's own
 *  `spawnPlayerState` (`PlatformerState.ts`) exactly — the player's 64px
 *  render slot is horizontally centered over the 32px spawn tile, and
 *  vertically placed so the sprite's visible feet (not the render slot's
 *  bottom edge) land on the tile's ground surface, accounting for
 *  `PLAYER_FOOT_PADDING`'s transparent rows below the feet. Without this,
 *  the player renders visibly offset from its tile. */
export function synthesizePlayerState(grid: TileChar[][]): PlayerState | null {
  const [spawn] = findAllPositions(grid, 'S');
  if (!spawn) return null;
  const spawnCell = tileToPixel(spawn.col, spawn.row);
  const groundSurfaceY = spawnCell.y + RENDERED_TILE_SIZE;
  const x = spawnCell.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
  const y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: true,
    climbing: false,
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
    hitPoints: MAX_HALF_HEARTS,
    alive: true,
    hitTimer: 0,
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
  type: EnemyPlacement['type'],
  idPrefix: string,
): EnemyPlacement[] {
  return findAllPositions(grid, char).map(({ col, row }, index) => {
    const { x, y } = tileToPixel(col, row);
    return { id: `${idPrefix}-${index}`, type, fact: PLACEHOLDER_FACT, x, y };
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

/** Returns a `SignPlacement` for every cell whose character is registered in
 *  `SIGN_CHARS` — unlike `findAllPositions` (used by every other
 *  `synthesizeX` function above), this scans for ANY sign character at once
 *  and resolves each one's own `hintId` directly, mirroring
 *  `LevelParser.ts`'s `findSignTiles`/`SignMapper.ts`'s `placeSigns` (the
 *  real game's own sign-placement path) rather than duplicating a
 *  one-char-at-a-time helper that wouldn't generalize past a single digit. */
export function synthesizeSignPlacements(grid: TileChar[][]): SignPlacement[] {
  const placements: SignPlacement[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const hintId = SIGN_CHARS[grid[row][col]];
      if (!hintId) continue;
      const { x, y } = tileToPixel(col, row);
      placements.push({ id: `editor-sign-${col}-${row}`, hintId, x, y });
    }
  }
  return placements;
}
