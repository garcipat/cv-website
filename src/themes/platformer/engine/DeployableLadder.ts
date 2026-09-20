import type { LevelDef } from '../level/LevelData';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_SIDE_PADDING,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';

/**
 * A deployable rope-ladder bundle's deployment lifecycle. `rolled` is the
 * author-placed state; `deploying` is the ~0.5 s unroll; `deployed` is
 * permanent until a session reset. Strictly one-way (FR-011).
 */
export type DeployableLadderPhase = 'rolled' | 'deploying' | 'deployed';

/**
 * Per-bundle runtime state — the only new stored value this feature adds.
 * Tiles stay stateless values in `LevelDef.terrain`; this lives alongside the
 * other per-instance session state in `PlatformerState.ts` and is derived into
 * an effective grid by `applyDeployedLadders`.
 */
export interface DeployableLadderState {
  /** `ladder-bundle-${col}-${row}` — stable per authored `@` cell. */
  id: string;
  col: number;
  row: number;
  /** The lowest row the shaft fills (`>= row`), decided at deploy time. */
  landRow: number;
  phase: DeployableLadderPhase;
  /** Seconds elapsed while `deploying`; 0 while `rolled`, capped at
   *  `UNROLL_SECONDS` once `deployed`. */
  elapsed: number;
}

/** Fixed unroll duration, independent of shaft length (FR-004/SC-004). */
export const UNROLL_SECONDS = 0.5;
/** A rope-ladder step is a half tile — the repeat unit of the shaft art. */
export const LADDER_STEP_NATIVE_PX = 8;
/** Two 8 px steps make one 16 px tile. */
export const STEPS_PER_TILE = 2;

/**
 * The lowest row a bundle at `(col, row)` unrolls to: scans downward from
 * `row + 1` while the cell is not solid, returning the last such row, or
 * `row` itself when the cell directly below is solid (or the bundle is on the
 * level's bottom row). `isSolid` includes `bridge`, so a bridge stops the
 * unroll (FR-005); a bundle on the bottom row is a zero-length landing
 * (FR-010). Never throws — `tileAt` resolves out-of-bounds to `'empty'`, but
 * the loop is bounded by `level.height` regardless.
 */
export function ladderLandingRow(level: LevelDef, col: number, row: number): number {
  let land = row;
  for (let r = row + 1; r < level.height; r++) {
    if (isSolid(tileAt(level, col, r))) break;
    land = r;
  }
  return land;
}

/** Seeds one `rolled` state for an authored `@` cell. Pure. */
export function createDeployableLadderState(
  level: LevelDef,
  col: number,
  row: number,
): DeployableLadderState {
  return {
    id: `ladder-bundle-${col}-${row}`,
    col,
    row,
    landRow: ladderLandingRow(level, col, row),
    phase: 'rolled',
    elapsed: 0,
  };
}

/** Starts the unroll. Idempotent — a state past `rolled` is returned unchanged. */
export function beginDeploy(state: DeployableLadderState): DeployableLadderState {
  if (state.phase !== 'rolled') return state;
  return { ...state, phase: 'deploying', elapsed: 0 };
}

/**
 * Advances an in-progress unroll by `dt` seconds, completing it at
 * `UNROLL_SECONDS`. A non-`deploying` state or a non-positive `dt` is returned
 * unchanged. Strictly one-way: never returns to `rolled`/`deploying` from
 * `deployed`.
 */
export function advanceDeployableLadder(
  state: DeployableLadderState,
  dt: number,
): DeployableLadderState {
  if (state.phase !== 'deploying' || dt <= 0) return state;
  const elapsed = state.elapsed + dt;
  if (elapsed >= UNROLL_SECONDS) {
    return { ...state, phase: 'deployed', elapsed: UNROLL_SECONDS };
  }
  return { ...state, elapsed };
}

/** Rung cells below the bundle cell (0 for a zero-length landing). The bundle
 *  cell itself is always rung one. */
export function shaftCellCount(state: DeployableLadderState): number {
  return state.landRow - state.row;
}

/** Total 8 px steps a completed shaft reveals (two per rung cell below). */
export function totalStepCount(state: DeployableLadderState): number {
  return shaftCellCount(state) * STEPS_PER_TILE;
}

/** Steps revealed so far: 0 while `rolled`, all once `deployed`, and a
 *  proportional floor while `deploying`. */
export function revealedStepCount(state: DeployableLadderState): number {
  if (state.phase === 'deployed') return totalStepCount(state);
  if (state.phase === 'rolled') return 0;
  const progress = Math.min(1, Math.max(0, state.elapsed / UNROLL_SECONDS));
  return Math.floor(totalStepCount(state) * progress);
}

/**
 * The first `rolled` bundle the player can deploy right now, or `null`. True
 * when the player is grounded, the bundle's column is within the player's
 * hitbox columns, and the bundle row equals the player's feet row (standing ON
 * the bundle) or one below it (standing in the bundle's own cell). Uses the
 * same feet row `Physics.ts`'s ground scan uses, so both cases line up. Never
 * returns a non-`rolled` bundle; never throws.
 */
export function ladderBundleForPlayer(
  level: LevelDef,
  states: readonly DeployableLadderState[],
  player: PlayerState,
): DeployableLadderState | null {
  if (!player.grounded) return null;
  const leftCol = Math.floor((player.x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE);
  const rightCol = Math.floor(
    (player.x + PLAYER_RENDERED_SIZE - PLAYER_SIDE_PADDING - 1) / RENDERED_TILE_SIZE,
  );
  const footRow = Math.floor(
    (player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING) / RENDERED_TILE_SIZE,
  );
  for (const state of states) {
    if (state.phase !== 'rolled') continue;
    if (tileAt(level, state.col, state.row) !== 'ladderBundle') continue;
    if (state.col < leftCol || state.col > rightCol) continue;
    if (state.row === footRow || state.row === footRow - 1) return state;
  }
  return null;
}

/**
 * The effective terrain grid: the raw level with every completed bundle's
 * column written as `ropeLadder` from the bundle cell down to its landing row.
 * Returns the SAME `level` object (identity) when nothing is deployed, so the
 * common case allocates nothing. Never mutates `level` or any state entry.
 */
export function applyDeployedLadders(
  level: LevelDef,
  states: readonly DeployableLadderState[],
): LevelDef {
  const deployed = states.filter((state) => state.phase === 'deployed');
  if (deployed.length === 0) return level;
  const terrain = level.terrain.map((row) => [...row]);
  for (const state of deployed) {
    for (let r = state.row; r <= state.landRow; r++) {
      terrain[r][state.col] = 'ropeLadder';
    }
  }
  return { ...level, terrain };
}
