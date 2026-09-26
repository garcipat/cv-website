import type { LevelDef } from '../../level/LevelData';
import { isSolid, tileAt, tileToPixel, RENDERED_TILE_SIZE, RENDER_SCALE } from '../../level/Terrain';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_SIDE_PADDING,
} from '../Player';
import type { PlayerState } from '../Player';
import { clamp01 } from '../../shared/math';
import { findLandingRow } from '../../engine/Standable';
import {
  ROPE_BUNDLE,
  ROPE_STEP,
  ROPE_BOTTOM_CAP,
  ropeLadderShaftPieces,
} from '../../tiles/ropeLadder';
import { ROPE_LADDER_SHEET } from '../sprites/sheets';
import type { DrawContext } from '../../contracts/DrawContext';
import type {
  DeployableItemState,
  DeployableItemInteractContext,
  DeployableItemInteractionOutcome,
  TerrainCellWrite,
  WorldInteractableType,
} from './DeployableItemType';

/**
 * A deployable rope-ladder bundle's deployment lifecycle. `rolled` is the
 * author-placed state; `deploying` is the ~0.5 s unroll; `deployed` is
 * permanent until a session reset. Strictly one-way.
 */
export type RopeLadderPhase = 'rolled' | 'deploying' | 'deployed';

/**
 * Per-bundle runtime state — the only new stored value this feature adds.
 * Tiles stay stateless values in `LevelDef.terrain`; this lives alongside the
 * other per-instance session state in `PlatformerState.ts` and contributes to
 * the effective grid through its `effectiveTerrainCells` hook.
 */
export interface RopeLadderState extends DeployableItemState {
  kind: 'ladder';
  /** The lowest row the shaft fills (`>= row`), decided at deploy time. */
  landingRow: number;
  phase: RopeLadderPhase;
  /** Seconds elapsed while `deploying`; 0 while `rolled`, capped at
   *  `UNROLL_SECONDS` once `deployed`. */
  elapsed: number;
}

/** Fixed unroll duration, independent of shaft length. */
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
 * unroll; a bundle on the bottom row is a zero-length landing. Never throws —
 * `tileAt` resolves out-of-bounds to `'empty'`, but the loop is bounded by
 * `level.height` regardless.
 */
export function ropeLadderLandingRow(level: LevelDef, col: number, row: number): number {
  const landing = findLandingRow(level, col, row, (l, c, r) => isSolid(tileAt(l, c, r)));
  return landing === null ? level.height - 1 : landing - 1;
}

/** Seeds one `rolled` state for an authored `@` cell. Pure. */
export function createRopeLadderState(
  level: LevelDef,
  col: number,
  row: number,
): RopeLadderState {
  const { x, y } = tileToPixel(col, row);
  return {
    id: `ladder-bundle-${col}-${row}`,
    kind: 'ladder',
    col,
    row,
    x,
    y,
    landingRow: ropeLadderLandingRow(level, col, row),
    phase: 'rolled',
    elapsed: 0,
  };
}

/** Starts the unroll. Idempotent — a state past `rolled` is returned unchanged. */
export function beginDeploy(state: RopeLadderState): RopeLadderState {
  if (state.phase !== 'rolled') return state;
  return { ...state, phase: 'deploying', elapsed: 0 };
}

/**
 * Advances an in-progress unroll by `dt` seconds, completing it at
 * `UNROLL_SECONDS`. A non-`deploying` state or a non-positive `dt` is returned
 * unchanged. Strictly one-way: never returns to `rolled`/`deploying` from
 * `deployed`.
 */
export function advanceRopeLadder(state: RopeLadderState, dt: number): RopeLadderState {
  if (state.phase !== 'deploying' || dt <= 0) return state;
  const elapsed = state.elapsed + dt;
  if (elapsed >= UNROLL_SECONDS) {
    return { ...state, phase: 'deployed', elapsed: UNROLL_SECONDS };
  }
  return { ...state, elapsed };
}

/** Rung cells below the bundle cell (0 for a zero-length landing). The bundle
 *  cell itself is always rung one. */
export function shaftCellCount(state: RopeLadderState): number {
  return state.landingRow - state.row;
}

/** Total 8 px steps a completed shaft reveals (two per rung cell below). */
export function totalStepCount(state: RopeLadderState): number {
  return shaftCellCount(state) * STEPS_PER_TILE;
}

/** Steps revealed so far: 0 while `rolled`, all once `deployed`, and a
 *  proportional floor while `deploying`. */
export function revealedStepCount(state: RopeLadderState): number {
  if (state.phase === 'deployed') return totalStepCount(state);
  if (state.phase === 'rolled') return 0;
  const progress = clamp01(state.elapsed / UNROLL_SECONDS);
  return Math.floor(totalStepCount(state) * progress);
}

/**
 * Whether a specific rolled bundle is deployable by the player right now.
 * True when the player is grounded, the bundle's column is within the
 * player's hitbox columns, and the bundle row equals the player's feet row
 * (standing ON the bundle) or one below it (standing in the bundle's own
 * cell). Uses the same feet row `Physics.ts`'s ground scan uses, so both cases
 * line up. A non-`rolled` bundle never matches.
 */
export function ropeLadderBundleIsUnderPlayer(
  state: RopeLadderState,
  level: LevelDef,
  player: PlayerState,
): boolean {
  if (!player.grounded) return false;
  if (state.phase !== 'rolled') return false;
  if (tileAt(level, state.col, state.row) !== 'ladderBundle') return false;
  const leftCol = Math.floor((player.x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE);
  const rightCol = Math.floor(
    (player.x + PLAYER_RENDERED_SIZE - PLAYER_SIDE_PADDING - 1) / RENDERED_TILE_SIZE,
  );
  const footRow = Math.floor(
    (player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING) / RENDERED_TILE_SIZE,
  );
  if (state.col < leftCol || state.col > rightCol) return false;
  return state.row === footRow || state.row === footRow - 1;
}

/** The cells one `deployed` bundle writes: `ropeLadder` from its bundle row
 *  down to its landing row inclusive. `null` unless `deployed`. */
function deployedRopeLadderCells(state: RopeLadderState): TerrainCellWrite[] | null {
  if (state.phase !== 'deployed') return null;
  const cells: TerrainCellWrite[] = [];
  for (let row = state.row; row <= state.landingRow; row++) {
    cells.push({ col: state.col, row, tile: 'ropeLadder' });
  }
  return cells;
}

/**
 * The effective terrain grid: the raw level with every completed bundle's
 * column written as `ropeLadder` from the bundle cell down to its landing row.
 * Returns the SAME `level` object (identity) when nothing is deployed, so the
 * common case allocates nothing. Never mutates `level` or any state entry.
 */
export function applyDeployedRopeLadders(
  level: LevelDef,
  states: readonly RopeLadderState[],
): LevelDef {
  if (!states.some((state) => state.phase === 'deployed')) return level;
  const terrain = level.terrain.map((row) => [...row]);
  for (const state of states) {
    const cells = deployedRopeLadderCells(state);
    if (!cells) continue;
    for (const { col, row, tile } of cells) terrain[row][col] = tile;
  }
  return { ...level, terrain };
}

/**
 * The rope-ladder's entry: a `WorldInteractableType<RopeLadderState>` owning
 * its unroll lifecycle, its draw (the moved `drawDeployableLadders` body), its
 * deploy trigger and its effective-terrain contribution.
 */
export const ropeLadderDeployableItem: WorldInteractableType<RopeLadderState> = {
  key: 'ladder',
  sprite: { sheet: ROPE_LADDER_SHEET, renderScale: 1, animations: {} },
  drawLayer: 'terrain',
  resetScope: 'progress',
  interactionPriority: 0,
  step: (state, dt) => advanceRopeLadder(state, dt),
  onPlayerInteract: (
    state: RopeLadderState,
    ctx: DeployableItemInteractContext,
  ): DeployableItemInteractionOutcome<RopeLadderState> | null =>
    ropeLadderBundleIsUnderPlayer(state, ctx.level, ctx.player)
      ? { kind: 'activate', state: beginDeploy(state) }
      : null,
  effectiveTerrainCells: (state: RopeLadderState) => deployedRopeLadderCells(state),
  draw: (state: RopeLadderState, dc: DrawContext) => {
    const ropeSheet = dc.sprites[ROPE_LADDER_SHEET.src];
    if (!ropeSheet) return;
    dc.ctx.imageSmoothingEnabled = false;

    const destX = state.col * RENDERED_TILE_SIZE + dc.originX;
    const destY = state.row * RENDERED_TILE_SIZE + dc.originY;

    if (state.phase === 'deployed') {
      // Once complete, the bundle cell becomes the shaft's top rung: the top
      // cap plus a plain step fill it, and the steps below sit at exactly the
      // same rows the unroll had revealed them at, so nothing shifts.
      const pieces = ropeLadderShaftPieces(shaftCellCount(state));
      let drawY = destY;
      for (const piece of pieces) {
        dc.ctx.drawImage(
          ropeSheet,
          piece.sx, piece.sy, piece.width, piece.height,
          destX, drawY, piece.width * RENDER_SCALE, piece.height * RENDER_SCALE,
        );
        drawY += piece.height * RENDER_SCALE;
      }
      return;
    }

    // rolled / deploying: the rolled parcel in its cell, then the steps
    // revealed so far, starting at the bundle cell's bottom edge and clamped
    // so no step spills past the landing cell's bottom. The bottom-most
    // revealed step is the ladder's end (the knotted bottom cap), so it lands
    // in the same place the completed shaft's bottom cap will.
    dc.ctx.drawImage(
      ropeSheet,
      ROPE_BUNDLE.sx, ROPE_BUNDLE.sy, ROPE_BUNDLE.width, ROPE_BUNDLE.height,
      destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
    );

    const stepHeight = LADDER_STEP_NATIVE_PX * RENDER_SCALE;
    const shaftBottomY = (state.landingRow + 1) * RENDERED_TILE_SIZE + dc.originY;
    let drawY = destY + RENDERED_TILE_SIZE;
    let remaining = revealedStepCount(state);
    while (remaining > 0 && drawY + stepHeight <= shaftBottomY) {
      const piece = remaining === 1 ? ROPE_BOTTOM_CAP : ROPE_STEP;
      dc.ctx.drawImage(
        ropeSheet,
        piece.sx, piece.sy, piece.width, piece.height,
        destX, drawY, piece.width * RENDER_SCALE, piece.height * RENDER_SCALE,
      );
      drawY += stepHeight;
      remaining -= 1;
    }
  },
};
