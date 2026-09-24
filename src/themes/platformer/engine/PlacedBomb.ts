import type { LevelDef } from '../level/LevelData';
import { isBlockOccupied, type BlockPlacement } from '../level/BlockMapper';
import { isSolid, tileAt, tileToPixel, RENDERED_TILE_SIZE } from '../level/Terrain';
import { PHYSICS_CONFIG } from '../contracts/PhysicsConfig';
import { isCrumblingFloorBroken, type CrumblingFloorTimerState } from './CrumblingFloor';
import { findLandingRow } from './Standable';

const NO_CRUMBLING_FLOOR_STATES: readonly CrumblingFloorTimerState[] = [];

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

/** Falling acceleration (px/s²) — the player's own gravity, reused. */
export const BOMB_GRAVITY = PHYSICS_CONFIG.gravity;
/** Falling speed cap (px/s) — the player's own terminal velocity, reused. */
export const BOMB_TERMINAL_VELOCITY = PHYSICS_CONFIG.terminalVelocity;
/** Scale applied to the orange pre-detonation frame (FR-017). */
export const BOMB_PULSE_SCALE = 1.25;
/** The fuse burn-down frames (1-3): the thread visibly shortening. */
export const BOMB_BURN_FRAMES: readonly number[] = [1, 2, 3];
/** The pulse frames: the orange 5 alternating with its 4 partner, ending on 5. */
export const BOMB_PULSE_FRAMES: readonly number[] = [4, 5, 4, 5, 4, 5];
/** Fixed pre-detonation frame order (FR-017). */
export const BOMB_FUSE_SEQUENCE: readonly number[] = [...BOMB_BURN_FRAMES, ...BOMB_PULSE_FRAMES];
/** Seconds the burn-down frames occupy — deliberately the larger share, so the
 *  early fuse stages read clearly instead of flashing past (each of frames
 *  1-3 gets a third of this). */
export const BOMB_BURN_SECONDS = 1.2;
/** Seconds the pulse frames occupy — short, so the 4/5 alternation reads as
 *  urgent. */
export const BOMB_PULSE_SECONDS = 0.8;
/** Fixed fuse duration (FR-016). */
export const BOMB_FUSE_SECONDS = BOMB_BURN_SECONDS + BOMB_PULSE_SECONDS;

/**
 * The lowest row a bomb placed at `(col, row)` rests in: scans downward from
 * `row + 1` while the cell is not solid for a bomb, returning the last such
 * row (i.e. the resting row, which equals `row` when the cell directly below
 * is solid), or `null` when the column has no floor before the level's bottom.
 *
 * "Solid for a bomb" is `isSolid(tileAt(...)) || isBlockOccupied(...)`, with
 * one exception: a crumbling floor tile (O-023) counts as solid too, as long
 * as it isn't currently broken/reforming — a bomb rests on it exactly like
 * ordinary ground while it's there. `isSolid` includes `bridge`, so a bridge
 * stops a bomb; `ladder` is not solid and `isStandableLadderTop` is
 * deliberately not consulted, so a ladder tile is open air (FR-015). Never
 * throws — `tileAt` resolves out-of-bounds reads to `'empty'`.
 */
export function bombLandingRow(
  level: LevelDef,
  blocks: readonly BlockPlacement[],
  col: number,
  row: number,
  crumblingFloorStates: readonly CrumblingFloorTimerState[] = NO_CRUMBLING_FLOOR_STATES,
): number | null {
  const landing = findLandingRow(level, col, row, (l, c, r) => {
    const tile = tileAt(l, c, r);
    const tileIsGround =
      tile === 'crumblingFloor' ? !isCrumblingFloorBroken(crumblingFloorStates, c, r) : isSolid(tile);
    return tileIsGround || isBlockOccupied(blocks, c, r);
  });
  return landing === null ? null : landing - 1;
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
  crumblingFloorStates: readonly CrumblingFloorTimerState[] = NO_CRUMBLING_FLOOR_STATES,
): PlacedBombState {
  const { x, y } = tileToPixel(col, row);
  return {
    id,
    x,
    y,
    vy: 0,
    col,
    row,
    landingRow: bombLandingRow(level, blocks, col, row, crumblingFloorStates),
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
 * The burn-down frames (1-3) share `BOMB_BURN_SECONDS` and the pulse frames
 * share `BOMB_PULSE_SECONDS`, so the early stages linger while the final 4/5
 * alternation is urgent. `bombFuseFrame(0)` is frame 1, the final segment is
 * frame 5, and frame 0 (the unlit icon) never appears (FR-017).
 */
export function bombFuseFrame(fuseElapsed: number): BombFrame {
  const t = Math.min(BOMB_FUSE_SECONDS, Math.max(0, fuseElapsed));
  let frame: number;
  if (t < BOMB_BURN_SECONDS) {
    const per = BOMB_BURN_SECONDS / BOMB_BURN_FRAMES.length;
    const index = Math.min(Math.floor(t / per), BOMB_BURN_FRAMES.length - 1);
    frame = BOMB_BURN_FRAMES[index];
  } else {
    const per = BOMB_PULSE_SECONDS / BOMB_PULSE_FRAMES.length;
    const index = Math.min(Math.floor((t - BOMB_BURN_SECONDS) / per), BOMB_PULSE_FRAMES.length - 1);
    frame = BOMB_PULSE_FRAMES[index];
  }
  return { frame, scale: frame === 5 ? BOMB_PULSE_SCALE : 1 };
}

/** Whether the fuse has burned down to detonation (FR-016). The caller
 *  detonates exactly once and removes the bomb. */
export function hasDetonated(state: PlacedBombState): boolean {
  return state.fuseElapsed >= BOMB_FUSE_SECONDS;
}
