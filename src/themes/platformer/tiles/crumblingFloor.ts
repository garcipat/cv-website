import { clamp01 } from '../shared/math';
import {
  advanceTimedTiles,
  armTimedTile,
  timedTileElapsedFor,
  timedTileHas,
  timedTileShakeOffsetX,
  type TimedTileConfig,
} from '../shared/timedTile';
import {
  RENDER_SCALE,
  RENDERED_TILE_SIZE,
  TILE_SIZE,
  horizontalRunPosition,
  tileAt,
} from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import type {
  TileDrawContext,
  TileModule,
  TileRuleContext,
  TileSolidRegion,
  TileStateDescriptor,
} from './TileModule';

/**
 * `crumblingFloor` — the crack/break/reform ledge (`g`). This module owns the
 * tile kind's whole shipped body ( moved it here from
 * `engine/CrumblingFloor.ts`): its cycle phases, durations, phase/offset
 * helpers, its declared transient state (routed through `shared/timedTile.ts`),
 * and its per-phase/inset `solidRegionAt` rule. Deliberately declares no plain
 * `solid` flag — its solidity is entirely phase- and inset-aware. Fogged;
 * drawn in the `afterHazards` band.
 */

/**
 * A crumbling floor tile's cycle phase. Unlike
 * `entities/hazards/FloorSpike.ts`'s timer states (keyed by a `HazardPlacement`'s own
 * `id`), a crumbling floor tile has no placement list of its own — it's a
 * plain terrain `TileType` — so its live state is keyed by grid position
 * directly, the same convention `entities/blocks/Mushroom.ts` uses for cap
 * dips. `'atRest'` has no tracked timer entry at all (state PRESENCE means
 * "cycle running", same as `FloorSpikeTimerState`); every other phase is a
 * pure function of elapsed time since arming.
 */
export type CrumblingFloorPhase = 'atRest' | 'cracking' | 'broken' | 'reforming';

/** Seconds a tile spends visibly cracking (light -> medium -> heavy) before
 * it breaks. Solid the entire time. */
export const CRUMBLING_FLOOR_CRACK_SECONDS = 0.9;
/** Seconds the tile stays a bare, non-solid gap before it starts reforming
 * (the "fixed delay"). */
export const CRUMBLING_FLOOR_BROKEN_SECONDS = 1.5;
/** Seconds the grow-from-small-square reform animation takes.
 * Non-solid for the whole duration. */
export const CRUMBLING_FLOOR_REFORM_SECONDS = 0.4;
/** Total cycle length — once elapsed reaches this, the tile is at rest
 * again and its timer entry is pruned. */
export const CRUMBLING_FLOOR_CYCLE_SECONDS =
  CRUMBLING_FLOOR_CRACK_SECONDS + CRUMBLING_FLOOR_BROKEN_SECONDS + CRUMBLING_FLOOR_REFORM_SECONDS;

/**
 * Height, in rendered px, of a crumbling floor tile's solid region:
 * its art top-aligns within its cell and is only half a tile tall, and its
 * collision matches that exactly rather than the full cell every other solid
 * tile uses. This is the tile's "vertical hitbox inset" — the first one in
 * this codebase; every existing inset (`hitboxInsetXForBlock`) is horizontal
 * and block-only.
 *
 * Declared as the literal `16` rather than `RENDERED_TILE_SIZE / 2` on
 * purpose: this module sits on the accepted `level/ ↔ tiles/` cycle, so
 * reading `level/Terrain`'s const at module-evaluation time would be a TDZ
 * error. `tiles/crumblingFloor.test.ts` pins the value against
 * `RENDERED_TILE_SIZE / 2`, the codebase's "declare locally + test agreement"
 * convention.
 */
export const CRUMBLING_FLOOR_SOLID_HEIGHT = 16;

/** One crumbling floor tile's live timer, keyed by grid position. Presence
 * in the states array means its cycle is running. */
export interface CrumblingFloorTimerState {
  col: number;
  row: number;
  /** Seconds since this tile was first stepped on. */
  elapsed: number;
}

interface GridKey {
  col: number;
  row: number;
}

const CONFIG: TimedTileConfig<CrumblingFloorTimerState, GridKey> = {
  keyOf: (state) => ({ col: state.col, row: state.row }),
  duration: CRUMBLING_FLOOR_CYCLE_SECONDS,
  prune: true,
  rearm: 'noop',
};

/** Arms `(col, row)`'s cycle if it isn't already running — a no-op
 * re-contact during an in-progress cycle, same shape as
 * `entities/hazards/FloorSpike.ts`'s `armFloorSpike`. */
export function armCrumblingFloor(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): CrumblingFloorTimerState[] {
  return armTimedTile(states, CONFIG, { col, row }, () => ({ col, row, elapsed: 0 }));
}

/** Advances every running cycle by `dt` and drops any that reached the full
 * cycle duration — the tile is at rest again the instant it's dropped
 *. `dt <= 0` leaves elapsed unchanged but still prunes
 * already-expired entries. */
export function advanceCrumblingFloors(
  states: readonly CrumblingFloorTimerState[],
  dt: number,
): CrumblingFloorTimerState[] {
  return advanceTimedTiles(states, dt, CONFIG);
}

/** Pure elapsed-time -> phase mapping. `'atRest'` is never returned here
 * it only applies when no timer entry exists at all (see
 * `crumblingFloorPhaseFor`), since a running cycle starts already
 * `'cracking'` the instant it's armed. */
export function crumblingFloorPhaseAt(elapsed: number): CrumblingFloorPhase {
  if (elapsed < CRUMBLING_FLOOR_CRACK_SECONDS) return 'cracking';
  if (elapsed < CRUMBLING_FLOOR_CRACK_SECONDS + CRUMBLING_FLOOR_BROKEN_SECONDS) return 'broken';
  return 'reforming';
}

/** `(col, row)`'s current phase — `'atRest'` when no timer entry exists. */
export function crumblingFloorPhaseFor(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): CrumblingFloorPhase {
  const state = states.find((entry) => entry.col === col && entry.row === row);
  return state ? crumblingFloorPhaseAt(state.elapsed) : 'atRest';
}

/** `(col, row)`'s raw elapsed time since arming — 0 when no timer entry
 * exists. Unlike the ratio/phase accessors, this is seconds, not a
 * normalized [0,1] value; the draw's shake jitter needs the real
 * elapsed time since `crumblingFloorShakeOffsetXAt` is tuned in seconds
 * (see its own doc comment), not a phase-relative ratio. */
export function crumblingFloorElapsedFor(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): number {
  return timedTileElapsedFor(states, { col, row }, CONFIG);
}

/** Whether `(col, row)` has a running cycle at all — the eligibility gate
 * for trigger detection (only an unarmed tile can start a new cycle). */
export function isCrumblingFloorArmed(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): boolean {
  return timedTileHas(states, { col, row }, CONFIG);
}

/** Whether a phase is solid ground (spec's Key Entities: at-rest and
 * cracking are solid; broken and reforming are not). */
export function isCrumblingFloorSolidPhase(phase: CrumblingFloorPhase): boolean {
  return phase === 'atRest' || phase === 'cracking';
}

/** Whether `(col, row)` is CURRENTLY non-solid — covers both the broken gap
 * and the still-growing reform, since both are non-solid per .
 * This is the one predicate `engine/Physics.ts` actually consults. */
export function isCrumblingFloorBroken(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): boolean {
  return !isCrumblingFloorSolidPhase(crumblingFloorPhaseFor(states, col, row));
}

/** How far through the cracking phase `elapsed` is, from 0 (just armed, no
 * cracks) to 1 (fully cracked, about to break) — `entities`-side rendering
 * uses this to pick between the 3 crack frames. Clamped to [0, 1] so a
 * broken/reforming elapsed value (past the crack phase) still returns a
 * sane value rather than growing unbounded. */
export function crumblingFloorCrackRatioAt(elapsed: number): number {
  return clamp01(elapsed / CRUMBLING_FLOOR_CRACK_SECONDS);
}

/** `(col, row)`'s current crack ratio — 0 when no timer entry exists (at
 * rest, no cracks). */
export function crumblingFloorCrackRatioFor(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): number {
  const state = states.find((entry) => entry.col === col && entry.row === row);
  return state ? crumblingFloorCrackRatioAt(state.elapsed) : 0;
}

/** How far through the reform animation `elapsed` is, from 0 (just started
 * reforming, a small square) to 1 (fully grown) — 0 for every elapsed value
 * before reforming starts (cracking/broken read as "nothing to grow yet"),
 * matching `entities/hazards/FloorSpike.ts`'s `floorSpikeExtensionAt` shape. */
export function crumblingFloorReformRatioAt(elapsed: number): number {
  const reformStart = CRUMBLING_FLOOR_CRACK_SECONDS + CRUMBLING_FLOOR_BROKEN_SECONDS;
  if (elapsed < reformStart) return 0;
  return clamp01((elapsed - reformStart) / CRUMBLING_FLOOR_REFORM_SECONDS);
}

/** `(col, row)`'s current reform ratio — 0 when no timer entry exists. */
export function crumblingFloorReformRatioFor(
  states: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
): number {
  const state = states.find((entry) => entry.col === col && entry.row === row);
  return state ? crumblingFloorReformRatioAt(state.elapsed) : 0;
}

/** Small deterministic horizontal jitter (native px) for the shake tell
 * during cracking — a sine wave rather than `Math.random()`
 * so rendering stays a pure function of elapsed time, matching
 * `Torch.ts`'s `torchFrameIndex` convention of deriving animation from the
 * clock rather than mutable random state. Routes through the shared core's
 * shake helper; the crumbling floor always shakes (no window gate). */
const SHAKE_AMPLITUDE_NATIVE_PX = 1;
export function crumblingFloorShakeOffsetXAt(elapsed: number): number {
  return timedTileShakeOffsetX(elapsed, SHAKE_AMPLITUDE_NATIVE_PX);
}

/** The crumbling floor's phase/inset-aware solidity, dispatched through the registry. */
function solidRegionAt(
  _level: LevelDef,
  col: number,
  row: number,
  ctx: TileRuleContext,
): TileSolidRegion | null {
  if (isCrumblingFloorBroken(ctx.transient.crumblingFloorTimers, col, row)) return null;
  return { top: 0, bottom: CRUMBLING_FLOOR_SOLID_HEIGHT };
}

// The two sheet frame geometries the merged pass needs, declared locally (a
// `tiles/` module cannot import `entities/sprites/sheets`; the draw's output is
// pinned by `engine/Renderer.test.ts`).
const CRUMBLE_FLOOR_FRAME_WIDTH = 16;
const CRUMBLE_CRACKS_FRAME_WIDTH = 16;
const CRUMBLE_CRACKS_FRAME_HEIGHT = 8;

/** Whether a cell is a crumbling floor tile — the run classifier's predicate. */
function isCrumblingFloorTile(level: LevelDef, col: number, row: number): boolean {
  return tileAt(level, col, row) === 'crumblingFloor';
}

/**
 * Draws one crumbling floor cell at its current cycle phase (the moved
 * `drawCrumblingFloors` body). `'broken'` draws nothing (the bare gap).
 * `'atRest'`/`'cracking'` draw the full ledge, with the crack overlay's frame
 * 0/1/2 composited on top once cracking starts (picked from the continuous
 * crack ratio) plus a small horizontal shake jitter. `'reforming'` draws the
 * ledge scaled from small to full, anchored to the cell's own top-center so it
 * grows toward where its collision boundary already sits.
 */
function draw(rc: TileDrawContext): void {
  const { ctx, level, col, row, destX, destY, images, transient } = rc;
  const ledge = images.crumblingLedge;
  if (!ledge) return;
  const cracks = images.crumblingCracks;
  const states = transient.crumblingFloorTimers;

  const phase = crumblingFloorPhaseFor(states, col, row);
  if (phase === 'broken') return;

  // 'single' (an isolated tile with no crumblingFloor neighbour on either side)
  // gets its own frame, rounded on both edges — not the flat middle frame a
  // run's interior tiles use.
  const runPosition = horizontalRunPosition(level, col, row, isCrumblingFloorTile);
  const frameIndex =
    runPosition === 'left' ? 0 : runPosition === 'right' ? 2 : runPosition === 'single' ? 3 : 1;
  const ledgeSx = frameIndex * CRUMBLE_FLOOR_FRAME_WIDTH;

  if (phase === 'reforming') {
    const ratio = crumblingFloorReformRatioFor(states, col, row);
    if (ratio <= 0) return;
    const w = RENDERED_TILE_SIZE * ratio;
    const h = RENDERED_TILE_SIZE * ratio;
    const dx = destX + (RENDERED_TILE_SIZE - w) / 2;
    ctx.drawImage(ledge, ledgeSx, 0, TILE_SIZE, TILE_SIZE, dx, destY, w, h);
    return;
  }

  // atRest or cracking.
  const elapsedSeconds = phase === 'cracking' ? crumblingFloorElapsedFor(states, col, row) : 0;
  const shakeX =
    phase === 'cracking' ? crumblingFloorShakeOffsetXAt(elapsedSeconds) * RENDER_SCALE : 0;
  ctx.drawImage(
    ledge,
    ledgeSx,
    0,
    TILE_SIZE,
    TILE_SIZE,
    destX + shakeX,
    destY,
    RENDERED_TILE_SIZE,
    RENDERED_TILE_SIZE,
  );

  if (phase === 'cracking' && cracks) {
    const ratio = crumblingFloorCrackRatioFor(states, col, row);
    const crackFrame = Math.min(2, Math.floor(ratio * 3));
    const crackSx = crackFrame * CRUMBLE_CRACKS_FRAME_WIDTH;
    const destHeight = (CRUMBLE_CRACKS_FRAME_HEIGHT / TILE_SIZE) * RENDERED_TILE_SIZE;
    ctx.drawImage(
      cracks,
      crackSx,
      0,
      CRUMBLE_CRACKS_FRAME_WIDTH,
      CRUMBLE_CRACKS_FRAME_HEIGHT,
      destX + shakeX,
      destY,
      RENDERED_TILE_SIZE,
      destHeight,
    );
  }
}

/**
 * The crumbling floor's declared transient state ( owns the lifecycle):
 * key shape, the 2.8 s cycle duration, prune/re-arm policy and the phase
 * mapping. The module never implements its own arm/advance/prune loop
 * `shared/timedTile.ts` does, driven from `PlatformerState.ts`'s single
 * signal/tick/reset.
 */
const STATE: TileStateDescriptor = {
  keyOf: (state) => ({ col: state.col, row: state.row }),
  duration: CRUMBLING_FLOOR_CYCLE_SECONDS,
  prune: true,
  rearm: 'noop',
  phaseOf: crumblingFloorPhaseAt,
};

export const crumblingFloorModule = {
  char: 'g',
  fogExempt: false,
  drawBand: 'afterHazards',
  solidRegionAt,
  draw,
  state: STATE,
} as const satisfies TileModule;
