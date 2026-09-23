import { describe, it, expect } from 'vitest';
import { applyTerrainOverrides } from './TerrainOverrides';
import type { LevelDef } from './LevelData';

function makeLevel(): LevelDef {
  return {
    width: 3,
    height: 2,
    terrain: [
      ['empty', 'empty', 'empty'],
      ['empty', 'empty', 'empty'],
    ],
  };
}

interface FakeState {
  active: boolean;
  col: number;
  row: number;
}

describe('applyTerrainOverrides-noActiveStates-returnsSameLevelByReference', () => {
  it('is a no-op identity when nothing is active', () => {
    const level = makeLevel();
    const states: FakeState[] = [{ active: false, col: 0, row: 0 }];
    const result = applyTerrainOverrides(
      level,
      states,
      (s) => s.active,
      (s) => [{ col: s.col, row: s.row, tile: 'wall' }],
    );
    expect(result).toBe(level);
  });
});

describe('applyTerrainOverrides-oneActiveState-writesItsCellsOnly', () => {
  it('writes only the active state\'s cells, cloning the grid', () => {
    const level = makeLevel();
    const states: FakeState[] = [
      { active: true, col: 1, row: 0 },
      { active: false, col: 2, row: 1 },
    ];
    const result = applyTerrainOverrides(
      level,
      states,
      (s) => s.active,
      (s) => [{ col: s.col, row: s.row, tile: 'wall' }],
    );
    expect(result).not.toBe(level);
    expect(result.terrain[0][1]).toBe('wall');
    expect(result.terrain[1][2]).toBe('empty'); // the inactive state's cell untouched
    expect(level.terrain[0][1]).toBe('empty'); // original never mutated
  });
});

describe('applyTerrainOverrides-oneStateMultipleCells-writesEveryCell', () => {
  it('writes every cell cellsFor yields for one state', () => {
    const level = makeLevel();
    const states: FakeState[] = [{ active: true, col: 0, row: 0 }];
    const result = applyTerrainOverrides(
      level,
      states,
      () => true,
      (s) => [
        { col: s.col, row: 0, tile: 'wall' },
        { col: s.col + 1, row: 1, tile: 'ladder' },
      ],
    );
    expect(result.terrain[0][0]).toBe('wall');
    expect(result.terrain[1][1]).toBe('ladder');
  });
});
