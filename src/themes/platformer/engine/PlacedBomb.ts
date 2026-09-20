import type { LevelDef } from '../level/LevelData';
import { isBlockOccupied, type BlockPlacement } from '../level/BlockMapper';
import { isSolid, tileAt, tileToPixel, RENDERED_TILE_SIZE } from '../level/Terrain';
import { PHYSICS_CONFIG } from './PhysicsConfig';

/**
 * A placed bomb's live state — the one new stored value the bomb placement
 * feature adds (O-012). Mirrors `DeployableLadder.ts`'s `DeployableLadderState`
 * shape: a pure, canvas-free module so the fuse/fall rules are unit-testable
 * without a DOM. A placed bomb is never written into `blockPlacements`, so it
 * is non-solid and never blocks the player (FR-015).
 */
export interface PlacedBombState {
  /** Unique per placement, e.g. `bomb-${col}-${row}-${seq}`. */
  id: string;
  /** World px, tile top-left. */
  x: number;
  /** World px, current (falls under gravity). */
  y: number;
  /** px/s, positive down. */
  vy: number;
  /** Placement tile column (fixed). */
  col: number;
  /** Placement tile row (fixed; fuse/rest reference). */
  row: number;
  /** Resting row, or `null` when the column has no floor. */
  landingRow: number | null;
  /** Seconds; always advances, even while falling. */
  fuseElapsed: number;
  landed: boolean;
}

/** One frame of the pre-detonation fuse animation. */
export interface BombFrame {
  /** `bomb.png` frame index, 1..5 (never 0 — that is the unlit icon). */
  frame: number;
  /** 1, or `BOMB_PULSE_SCALE` on the orange pre-detonation frame. */
  scale: number;
}

/** Fixed fuse duration (FR-016). */
export const BOMB_FUSE_SECONDS = 2;
/** Falling acceleration (px/s²) — the player's own gravity, reused. */
export const BOMB_GRAVITY = PHYSICS_CONFIG.gravity;
/** Falling speed cap (px/s) — the player's own terminal velocity, reused. */
export const BOMB_TERMINAL_VELOCITY = PHYSICS_CONFIG.terminalVelocity;
/** Scale applied to the orange pre-detonation frame (FR-017). */
export const BOMB_PULSE_SCALE = 1.25;
/** Fixed pre-detonation frame order: 1-3 burn down, then 4/5 pulse three
 *  times, ending on 5 (FR-017). */
export const BOMB_FUSE_SEQUENCE: readonly number[] = [1, 2, 3, 4, 5, 4, 5, 4, 5];

/**
 * The lowest row a bomb placed at `(col, row)` rests in: scans downward from
 * `row + 1` while the cell is not solid for a bomb, returning the last such
 * row (i.e. the resting row, which equals `row` when the cell directly below
 * is solid), or `null` when the column has no floor before the level's bottom.
 *
 * "Solid for a bomb" is `isSolid(tileAt(...)) || isBlockOccupied(...)`.
 * `isSolid` includes `bridge`, so a bridge stops a bomb; `ladder` is not
 * solid and `isStandableLadderTop` is deliberately not consulted, so a ladder
 * tile is open air (FR-015). Never throws — `tileAt` resolves out-of-bounds
 * reads to `'empty'`.
 */
export function bombLandingRow(
  level: LevelDef,
  blocks: readonly BlockPlacement[],
  col: number,
  row: number,
): number | null {
  for (let r = row + 1; r < level.height; r++) {
    if (isSolid(tileAt(level, col, r)) || isBlockOccupied(blocks, col, r)) return r - 1;
  }
  return null;
}

/** Creates a placed bomb at `(col, row)` with its landing row resolved from
 *  the current level + live blocks. Pure; called once when the bomb is
 *  placed. */
export function createPlacedBomb(
  id: string,
  level: LevelDef,
  blocks: readonly BlockPlacement[],
  col: number,
  row: number,
): PlacedBombState {
  const { x, y } = tileToPixel(col, row);
  return {
    id,
    x,
    y,
    vy: 0,
    col,
    row,
    landingRow: bombLandingRow(level, blocks, col, row),
    fuseElapsed: 0,
    landed: false,
  };
}

/**
 * Advances a placed bomb by `dt` seconds. Always advances `fuseElapsed` (the
 * fuse keeps ticking while falling, FR-015). While it has a landing row and
 * has not reached it, gravity is applied and `y` advances; on reaching the
 * resting surface's top edge the bomb snaps to it and stops. With no landing
 * row it keeps falling (the caller removes it once `checkBombFellOut` is
 * true). `dt <= 0` returns the same state unchanged; never mutates its input.
 */
export function stepPlacedBomb(
  state: PlacedBombState,
  _level: LevelDef,
  _blocks: readonly BlockPlacement[],
  dt: number,
): PlacedBombState {
  if (dt <= 0) return state;

  const fuseElapsed = state.fuseElapsed + dt;
  const vy = Math.min(state.vy + BOMB_GRAVITY * dt, BOMB_TERMINAL_VELOCITY);
  let y = state.y + vy * dt;
  let landed = state.landed;

  if (state.landingRow !== null) {
    const restingY = tileToPixel(state.col, state.landingRow).y;
    if (y >= restingY) {
      y = restingY;
      landed = true;
      return { ...state, y, vy: 0, fuseElapsed, landed };
    }
  }

  return { ...state, y, vy, fuseElapsed, landed };
}

/** True once the bomb's bottom edge has passed the level's bottom — only
 *  meaningful when `landingRow === null`. The caller removes the bomb and
 *  does NOT explode it (FR-015). */
export function checkBombFellOut(state: PlacedBombState, level: LevelDef): boolean {
  return state.y + RENDERED_TILE_SIZE > level.height * RENDERED_TILE_SIZE;
}

/**
 * Maps the fuse's elapsed time onto the fixed pre-detonation frame sequence.
 * `bombFuseFrame(0)` is frame 1, the final segment is frame 5, and frame 0
 * (the unlit icon) never appears (FR-017).
 */
export function bombFuseFrame(fuseElapsed: number): BombFrame {
  const progress = Math.min(1, Math.max(0, fuseElapsed / BOMB_FUSE_SECONDS));
  const index = Math.min(
    Math.floor(progress * BOMB_FUSE_SEQUENCE.length),
    BOMB_FUSE_SEQUENCE.length - 1,
  );
  const frame = BOMB_FUSE_SEQUENCE[index];
  return { frame, scale: frame === 5 ? BOMB_PULSE_SCALE : 1 };
}

/** Whether the fuse has burned down to detonation (FR-016). The caller
 *  detonates exactly once and removes the bomb. */
export function hasDetonated(state: PlacedBombState): boolean {
  return state.fuseElapsed >= BOMB_FUSE_SECONDS;
}
