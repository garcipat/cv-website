import { describe, it, expect } from 'vitest';
import {
  gridToLevelDef,
  synthesizePlayerState,
  synthesizeCollectiblePlacements,
  synthesizeEnemyStates,
  synthesizeBlockStates,
  synthesizeChestStates,
  synthesizeSignPlacements,
  synthesizeHazardPlacements,
  synthesizeCheckpointStates,
} from './gridRenderState';
import { RENDERED_TILE_SIZE, tileToPixel } from '../level/Terrain';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import type { TileChar } from '../level/LevelParser';
import { computePotRenderPlan } from '../entities/blocks/potRenderPlan';
import { PALETTE_TILE_SPRITES, PALETTE_TILE_LABELS } from './paletteTiles';

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
    expect(player?.prevFeetY).toBe(expectedY + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING);
    expect(player?.direction).toBe('right');
    expect(player?.animState).toBe('idle');
    expect(player?.animFrame).toBe(0);
  });
});

describe('synthesizeCollectiblePlacements', () => {
  it('returns one coin placeholder per "o" marker', () => {
    const grid: TileChar[][] = [['o', '.', 'o']];
    const placements = synthesizeCollectiblePlacements(grid);
    expect(placements).toHaveLength(2);
    expect(placements[0].spriteType).toBe('coin');
    expect(placements[0].x).toBe(0);
    expect(placements[1].x).toBe(2 * RENDERED_TILE_SIZE);
  });
});

describe('synthesizeEnemyStates', () => {
  it('returns a slimeGreen placeholder per "M" marker and slimePurple per "m" marker', () => {
    const grid: TileChar[][] = [['M', 'm']];
    const enemies = synthesizeEnemyStates(grid);
    expect(enemies).toHaveLength(2);
    expect(enemies.find((e) => e.type === 'slimeGreen')).toBeDefined();
    expect(enemies.find((e) => e.type === 'slimePurple')).toBeDefined();
  });
});

describe('synthesizeBlockStates', () => {
  it('returns one block placeholder per crate/questionMark/fragileRock/coinPot/potionPot marker, intact', () => {
    // Regression test: the editor's preview canvas didn't know about
    // coinPot ('u') at all until this was added — a real bug found by
    // manual play-testing, not caught by the test suite (this test didn't
    // exist yet).
    const grid: TileChar[][] = [['=', '?', 'F', 'u', 'p']];
    const blocks = synthesizeBlockStates(grid);
    expect(blocks).toHaveLength(5);
    expect(blocks.map((b) => b.blockKind).sort()).toEqual(
      ['coinPot', 'crate', 'fragileRock', 'potionPot', 'questionMark'].sort(),
    );
    expect(blocks.every((b) => b.hitsTaken === 0)).toBe(true);
  });
});

describe('synthesizeBlockStates — bombPot', () => {
  it('aBombPotMarker-synthesizesABombPotBlockState', () => {
    const blocks = synthesizeBlockStates([['b']]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].blockKind).toBe('bombPot');
    expect(blocks[0].hitsTaken).toBe(0);
  });

  it('aBombPotBesideAnotherPot-mergesThroughTheSharedRenderPlanWithASeamFiller', () => {
    const blocks = synthesizeBlockStates([['b', 'u']]);
    const bombBlock = blocks.find((b) => b.blockKind === 'bombPot')!;
    const plan = computePotRenderPlan(blocks);
    const run = plan.runsByOwnerId.get(bombBlock.id)!;
    expect(run.blocks.map((m) => m.kind.drop)).toEqual(['bomb', 'coin']);
    expect(run.fillers).toHaveLength(1);
    expect(run.fillers[0].x).toBe(bombBlock.x + RENDERED_TILE_SIZE / 2);
  });

  it('theEditorPalette-hasNoPlacedBombOrExplosionEntry', () => {
    const keys = Object.keys(PALETTE_TILE_SPRITES);
    expect(keys).not.toContain('bomb');
    expect(keys).not.toContain('explosion');
    const labels = Object.values(PALETTE_TILE_LABELS);
    expect(labels.some((label) => /placed bomb|explosion/i.test(label))).toBe(false);
  });
});

describe('synthesizeChestStates', () => {
  it('returns one closed chest placeholder per "$" marker', () => {
    const grid: TileChar[][] = [['$']];
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

describe('synthesizeCheckpointStates', () => {
  it('noCheckpointMarkers-returnsEmptyArray', () => {
    expect(synthesizeCheckpointStates([['G', 'G']])).toEqual([]);
  });

  it('oneMarker-returnsADormantStateAtItsCell', () => {
    const { x, y } = tileToPixel(1, 0);
    expect(synthesizeCheckpointStates([['.', 'C']])).toEqual([
      { id: 'editor-checkpoint-0', col: 1, row: 0, x, y, activated: false, activatedAt: null },
    ]);
  });

  it('multipleMarkers-returnsOnePerCellInReadingOrder', () => {
    const result = synthesizeCheckpointStates([
      ['C', '.'],
      ['.', 'C'],
    ]);
    expect(result.map((c) => ({ col: c.col, row: c.row }))).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 1 },
    ]);
    expect(result.every((c) => !c.activated && c.activatedAt === null)).toBe(true);
  });
});

describe('synthesizeHazardPlacements', () => {
  it('noHazardMarkers-returnsEmptyArray', () => {
    expect(synthesizeHazardPlacements([['G', 'G']])).toEqual([]);
  });

  it('oneHazardMarker-returnsItsHazardTypeFacingAndPixelPosition', () => {
    const result = synthesizeHazardPlacements([
      ['.', '.'],
      ['.', '^'],
    ]);
    const { x, y } = tileToPixel(1, 1);
    expect(result).toEqual([
      { id: 'editor-hazard-1-1', hazardType: 'spike', facing: 'up', x, y },
    ]);
  });

  it('everyFacingCharacter-mapsToItsOwnFacing', () => {
    const result = synthesizeHazardPlacements([['^', 'v', '<', '>']]);
    expect(result.map((h) => h.facing)).toEqual(['up', 'down', 'left', 'right']);
    expect(result.every((h) => h.hazardType === 'spike')).toBe(true);
  });
});
