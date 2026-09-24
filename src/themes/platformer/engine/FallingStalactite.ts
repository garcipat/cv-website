import type { HazardPlacement } from '../level/HazardMapper';
import type { LevelDef } from '../level/LevelData';
import type { BlockPlacement } from '../level/BlockMapper';
import type { CrumblingFloorTimerState } from './CrumblingFloor';
import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../level/Terrain';
import { findLandingRow, isStandableCell } from './Standable';
import { isStalactiteTwin, TWIN_LEFT_RECT, TWIN_RIGHT_RECT } from './StaticObjectsCatalog';
import { shakeOffsetX } from '../shared/math';
import type {
  FallingStalactitePhase,
  FallingStalactiteTimerState,
} from '../entities/hazards/phases';

/** Seconds the shake telegraph lasts before the drop (spec's 0.4–0.6s). */
export const FALLING_STALACTITE_SHAKE_SECONDS = 0.5;
/** Downward fall speed, in rendered px/s. */
export const FALLING_STALACTITE_FALL_SPEED = 320;
/** Maximum detection-zone depth below the hazard, in tiles (FR-003). */
export const FALLING_STALACTITE_MAX_DETECTION_DEPTH = 10;
/** Flanking columns included in the detection zone on each side (FR-003). */
export const FALLING_STALACTITE_ZONE_HALF_WIDTH = 1;

/** Amplitude of the shake's horizontal jitter, in rendered px. */
const SHAKE_AMPLITUDE_RENDERED_PX = 1.5;

/** Arms `id`'s timer if it isn't already running — a no-op re-contact while
 *  an entry exists (arming is irreversible, FR-004). */
export function armFallingStalactite(
  states: readonly FallingStalactiteTimerState[],
  id: string,
): FallingStalactiteTimerState[] {
  if (states.some((state) => state.id === id)) return [...states];
  return [...states, { id, elapsed: 0 }];
}

/** Advances every timer by `dt`. Never prunes: a `gone` entry must persist for
 *  the rest of the attempt (FR-013), cleared only by `resetGame()` (FR-014). */
export function advanceFallingStalactites(
  states: readonly FallingStalactiteTimerState[],
  dt: number,
): FallingStalactiteTimerState[] {
  return states.map((state) => ({ ...state, elapsed: dt > 0 ? state.elapsed + dt : state.elapsed }));
}

/** Whether `id` has a timer entry at all — the eligibility gate for trigger
 *  detection (only a hanging hazard can arm). */
export function isFallingStalactiteArmed(
  states: readonly FallingStalactiteTimerState[],
  id: string,
): boolean {
  return states.some((state) => state.id === id);
}

/** `id`'s raw elapsed seconds since arming — 0 when no entry exists (hanging).
 *  Used by the per-tick merge to derive the fall/shake offsets. */
export function fallingStalactiteElapsedFor(
  states: readonly FallingStalactiteTimerState[],
  id: string,
): number {
  const state = states.find((entry) => entry.id === id);
  return state ? state.elapsed : 0;
}

/** Downward offset (rendered px) from the hanging position — 0 through the
 *  shake, then linear at `FALLING_STALACTITE_FALL_SPEED`. */
export function fallingStalactiteOffsetYAt(elapsed: number): number {
  if (elapsed < FALLING_STALACTITE_SHAKE_SECONDS) return 0;
  return (elapsed - FALLING_STALACTITE_SHAKE_SECONDS) * FALLING_STALACTITE_FALL_SPEED;
}

/** Horizontal shake offset (rendered px) — a deterministic sine, 0 outside the
 *  shake phase (same technique as `crumblingFloorShakeOffsetXAt`). */
export function fallingStalactiteShakeOffsetXAt(elapsed: number): number {
  if (elapsed < 0 || elapsed >= FALLING_STALACTITE_SHAKE_SECONDS) return 0;
  return shakeOffsetX(elapsed, SHAKE_AMPLITUDE_RENDERED_PX);
}

/**
 * Nearest standable row strictly below `fromRow` in `col` (the first one the
 * fall reaches), or `null` past the level bottom. Re-evaluated each tick so a
 * crumbling floor that breaks mid-fall no longer stops it (FR-008).
 */
export function fallingStalactiteLandingRow(
  level: LevelDef,
  blocks: readonly BlockPlacement[],
  crumblingFloorStates: readonly CrumblingFloorTimerState[],
  col: number,
  fromRow: number,
): number | null {
  return findLandingRow(level, col, fromRow, (l, c, r) =>
    isStandableCell(l, blocks, crumblingFloorStates, c, r),
  );
}

/**
 * The rendered height of the sprite that actually falls: a full tile for the
 * large variant (the decoration is stretched to its cell, so the falling one
 * is too), or the parity-selected twin half's own height (left is taller than
 * right, FR-019).
 */
export function fallingStalactiteSpriteHeight(col: number, row: number): number {
  if (!isStalactiteTwin(col, row)) return RENDERED_TILE_SIZE;
  const rect = col % 2 === 0 ? TWIN_LEFT_RECT : TWIN_RIGHT_RECT;
  return rect.height * RENDER_SCALE;
}

/**
 * The downward offset at which the falling sprite's BOTTOM first meets the
 * landing solid's top — i.e. its top ends one sprite-height above the landing
 * row's top, so it comes to rest in the cell directly above the solid instead
 * of sinking into it. `null` when there is no landing below.
 */
export function fallingStalactiteRestOffsetY(
  hazard: Pick<HazardPlacement, 'col' | 'row'>,
  landingRow: number | null,
): number | null {
  if (landingRow === null) return null;
  return (
    (landingRow - hazard.row) * RENDERED_TILE_SIZE -
    fallingStalactiteSpriteHeight(hazard.col, hazard.row)
  );
}

/**
 * The hazard's current phase. `'hanging'` is the absence of a timer entry;
 * otherwise the phase is a pure function of elapsed time and the resolved
 * landing row (never pruned, so `'gone'` persists).
 */
export function fallingStalactitePhaseFor(
  states: readonly FallingStalactiteTimerState[],
  hazard: Pick<HazardPlacement, 'id' | 'col' | 'row'>,
  level: LevelDef,
  blocks: readonly BlockPlacement[],
  crumblingFloorStates: readonly CrumblingFloorTimerState[],
): FallingStalactitePhase {
  const state = states.find((entry) => entry.id === hazard.id);
  if (!state) return 'hanging';
  if (state.elapsed < FALLING_STALACTITE_SHAKE_SECONDS) return 'shaking';
  const landingRow = fallingStalactiteLandingRow(
    level,
    blocks,
    crumblingFloorStates,
    hazard.col,
    hazard.row,
  );
  const restOffset = fallingStalactiteRestOffsetY(hazard, landingRow);
  if (restOffset === null) return 'gone';
  return fallingStalactiteOffsetYAt(state.elapsed) >= restOffset ? 'gone' : 'falling';
}

/**
 * The cells of a hanging hazard's detection zone (FR-003): the three columns
 * directly beneath it, reaching down to whichever comes first — the first
 * standable cell in its own column, or `FALLING_STALACTITE_MAX_DETECTION_DEPTH`
 * tiles. Within each column a standable cell clips the zone, so the result
 * contains only clear cells and never a standable one.
 */
export function detectionZoneCells(
  hazard: Pick<HazardPlacement, 'col' | 'row'>,
  level: LevelDef,
  blocks: readonly BlockPlacement[],
  crumblingFloorStates: readonly CrumblingFloorTimerState[],
): { col: number; row: number }[] {
  // Own-column depth: the first standable cell's distance minus one, capped.
  let ownDepth = FALLING_STALACTITE_MAX_DETECTION_DEPTH;
  for (let k = 1; k <= FALLING_STALACTITE_MAX_DETECTION_DEPTH; k++) {
    if (isStandableCell(level, blocks, crumblingFloorStates, hazard.col, hazard.row + k)) {
      ownDepth = k - 1;
      break;
    }
  }

  const cells: { col: number; row: number }[] = [];
  for (let offset = -FALLING_STALACTITE_ZONE_HALF_WIDTH; offset <= FALLING_STALACTITE_ZONE_HALF_WIDTH; offset++) {
    const col = hazard.col + offset;
    if (col < 0 || col >= level.width) continue;
    let depth = ownDepth;
    for (let k = 1; k <= ownDepth; k++) {
      if (isStandableCell(level, blocks, crumblingFloorStates, col, hazard.row + k)) {
        depth = k - 1;
        break;
      }
    }
    for (let k = 1; k <= depth; k++) {
      cells.push({ col, row: hazard.row + k });
    }
  }
  return cells;
}
