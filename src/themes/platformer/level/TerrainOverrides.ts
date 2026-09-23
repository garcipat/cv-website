import type { LevelDef, TileType } from './LevelData';

/** One cell a state wants written into the effective grid. */
export interface TerrainOverrideCell {
  col: number;
  row: number;
  tile: TileType;
}

/**
 * The shared shape behind every "runtime terrain override" this codebase
 * has (O-011's deployed rope-ladder bundles, O-029's opened doors): filter
 * per-instance states down to the ones currently affecting the grid; if
 * none, return `level` UNCHANGED BY REFERENCE so the common no-override
 * case allocates nothing; otherwise clone `level.terrain` exactly once and
 * write every active state's cells into that one clone. `isActive` and
 * `cellsFor` carry everything feature-specific (which states qualify, which
 * cells each one writes) — this function owns only the filter/clone/
 * identity mechanics, not knows what a bundle or a door is. See design.md's
 * "A shared applyTerrainOverrides helper" for why this exists instead of a
 * second copy of the same plumbing.
 */
export function applyTerrainOverrides<S>(
  level: LevelDef,
  states: readonly S[],
  isActive: (state: S) => boolean,
  cellsFor: (state: S) => Iterable<TerrainOverrideCell>,
): LevelDef {
  const active = states.filter(isActive);
  if (active.length === 0) return level;
  const terrain = level.terrain.map((row) => [...row]);
  for (const state of active) {
    for (const cell of cellsFor(state)) {
      terrain[cell.row][cell.col] = cell.tile;
    }
  }
  return { ...level, terrain };
}
