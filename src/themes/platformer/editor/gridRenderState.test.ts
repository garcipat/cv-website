import { describe, it, expect } from 'vitest';
import {
  gridToLevelDef,
  synthesizePlayerState,
  synthesizeCollectiblePlacements,
  synthesizeEnemyStates,
  synthesizeBlockStates,
  synthesizeChestStates,
  synthesizeSignPlacements,
} from './gridRenderState';
import { RENDERED_TILE_SIZE, tileToPixel } from '../level/Terrain';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import type { TileChar } from '../level/LevelParser';

describe('gridToLevelDef', () => {
  it('maps terrain characters to tile types and entity markers to empty', () => {
    const grid: TileChar[][] = [['G', 'S', 'R']];
    const level = gridToLevelDef(grid);
    expect(level.width).toBe(3);
    expect(level.height).toBe(1);
    expect(level.terrain).toEqual([['groundGrass', 'empty', 'groundRock']]);
  });
});

describe('synthesizePlayerState', () => {
  it('returns null when no spawn marker exists', () => {
    expect(synthesizePlayerState([['.', '.']])).toBeNull();
  });

  it('returns a fixed-idle placeholder PlayerState centered over the spawn tile with feet on its ground surface, matching the real game\'s spawnPlayerState formula exactly', () => {
    const grid: TileChar[][] = [['.', 'S']];
    const player = synthesizePlayerState(grid);
    expect(player).not.toBeNull();
    const spawnTileX = 1 * RENDERED_TILE_SIZE;
    const spawnTileY = 0;
    const expectedX = spawnTileX - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
    const expectedY = spawnTileY + RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    expect(player?.x).toBe(expectedX);
    expect(player?.y).toBe(expectedY);
    expect(player?.lastGroundedX).toBe(expectedX);
    expect(player?.lastGroundedY).toBe(expectedY);
    expect(player?.facing).toBe('right');
    expect(player?.animState).toBe('idle');
    expect(player?.animFrame).toBe(0);
  });
});

describe('synthesizeCollectiblePlacements', () => {
  it('returns one coin placeholder per "C" marker', () => {
    const grid: TileChar[][] = [['C', '.', 'C']];
    const placements = synthesizeCollectiblePlacements(grid);
    expect(placements).toHaveLength(2);
    expect(placements[0].spriteType).toBe('coin');
    expect(placements[0].x).toBe(0);
    expect(placements[1].x).toBe(2 * RENDERED_TILE_SIZE);
  });
});

describe('synthesizeEnemyStates', () => {
  it('returns a slimeGreen placeholder per "E" marker and slimePurple per "M" marker', () => {
    const grid: TileChar[][] = [['E', 'M']];
    const enemies = synthesizeEnemyStates(grid);
    expect(enemies).toHaveLength(2);
    expect(enemies.find((e) => e.type === 'slimeGreen')).toBeDefined();
    expect(enemies.find((e) => e.type === 'slimePurple')).toBeDefined();
  });
});

describe('synthesizeBlockStates', () => {
  it('returns one block placeholder per crate/questionMark/fragileRock marker, intact', () => {
    const grid: TileChar[][] = [['X', 'Q', 'F']];
    const blocks = synthesizeBlockStates(grid);
    expect(blocks).toHaveLength(3);
    expect(blocks.map((b) => b.blockKind).sort()).toEqual(
      ['crate', 'fragileRock', 'questionMark'].sort(),
    );
    expect(blocks.every((b) => b.hitsTaken === 0)).toBe(true);
  });
});

describe('synthesizeChestStates', () => {
  it('returns one closed chest placeholder per "T" marker', () => {
    const grid: TileChar[][] = [['T']];
    const chests = synthesizeChestStates(grid);
    expect(chests).toHaveLength(1);
    expect(chests[0].state).toBe('closed');
  });
});

describe('synthesizeSignPlacements', () => {
  it('noSignMarkers-returnsEmptyArray', () => {
    expect(synthesizeSignPlacements([['G', 'G']])).toEqual([]);
  });

  it('oneSignMarker-returnsItsHintIdAndPixelPosition', () => {
    const result = synthesizeSignPlacements([
      ['.', '.'],
      ['.', '1'],
    ]);
    const { x, y } = tileToPixel(1, 1);
    expect(result).toEqual([{ id: 'editor-sign-1-1', hintId: 'bridgeDropThrough', x, y }]);
  });
});
