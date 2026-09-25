import type { HazardType } from './HazardType';
import type { HazardPlacement } from '../../level/HazardMapper';
import type { LevelDef } from '../../level/LevelData';
import type { BlockPlacement } from '../../level/BlockMapper';
import { DECORATIONS_SHEET } from '../sprites/sheets';
import { RENDER_SCALE, RENDERED_TILE_SIZE, TILE_SIZE } from '../../level/Terrain';
import { SIDE_HIT_DAMAGE } from '../Health';
import {
  isStalactiteTwin,
  stalactiteEntry,
  TWIN_LEFT_RECT,
  TWIN_RIGHT_RECT,
} from '../../engine/StaticObjectsCatalog';
import { findLandingRow, isStandableCell } from '../../engine/Standable';
import type { Rect } from '../../contracts/geometry';
import type { DrawContext } from '../../contracts/DrawContext';
import type { DebrisLayer } from '../../engine/effects/debris';
import {
  advanceTimedTiles,
  armTimedTile,
  timedTileElapsedFor,
  timedTileHas,
  timedTileShakeOffsetX,
  type GridTimerState,
  type TimedTileConfig,
} from '../../shared/timedTile';

/**
 * The falling-stalactite hazard kind (R-004 US4): its view, timer state,
 * constants, phase vocabulary, and arm/advance/fall/landing/detection
 * functions in one self-contained module. The arm/advance/presence/shake
 * scaffolding delegates to `shared/timedTile.ts`; this module keeps its
 * durations and phase/offset mapping.
 *
 * It preserves the pre-existing `entities/ → engine/` imports the view already
 * carried (`findLandingRow`, the `StaticObjectsCatalog` twin geometry, and the
 * `DebrisLayer` type) and adds no new forbidden edge: its `crumblingFloorStates`
 * parameter is typed against the dependency-free `GridTimerState` shape, so the
 * merge imports no `engine/CrumblingFloor`.
 */

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

/**
 * A falling stalactite's phase (O-027, spec.md's Key Entities). `'hanging'`
 * is the absence of a timer entry — the only triggerable phase — while the
 * timer-derived phases are `shaking` → `falling` → `gone`.
 *
 * Unlike the floor spike's cycle, a `gone` entry is NEVER pruned: it
 * persists for the rest of the attempt (FR-013) and is cleared only by
 * `resetGame()` (FR-014). Keeping `elapsed` as the only mutable field makes
 * every phase a pure function of elapsed time.
 */
export type FallingStalactitePhase = 'hanging' | 'shaking' | 'falling' | 'gone';

/** One falling stalactite's live timer. Presence in the states array means
 *  armed (shaking or later); absence means hanging and triggerable. */
export interface FallingStalactiteTimerState {
  id: string;
  /** Seconds since armed. */
  elapsed: number;
}

const CONFIG: TimedTileConfig<FallingStalactiteTimerState, string> = {
  keyOf: (state) => state.id,
  duration: FALLING_STALACTITE_SHAKE_SECONDS,
  prune: false,
  rearm: 'noop',
};

/** Arms `id`'s timer if it isn't already running — a no-op re-contact while
 *  an entry exists (arming is irreversible, FR-004). */
export function armFallingStalactite(
  states: readonly FallingStalactiteTimerState[],
  id: string,
): FallingStalactiteTimerState[] {
  return armTimedTile(states, CONFIG, id, () => ({ id, elapsed: 0 }));
}

/** Advances every timer by `dt`. Never prunes: a `gone` entry must persist for
 *  the rest of the attempt (FR-013), cleared only by `resetGame()` (FR-014). */
export function advanceFallingStalactites(
  states: readonly FallingStalactiteTimerState[],
  dt: number,
): FallingStalactiteTimerState[] {
  return advanceTimedTiles(states, dt, CONFIG);
}

/** Whether `id` has a timer entry at all — the eligibility gate for trigger
 *  detection (only a hanging hazard can arm). */
export function isFallingStalactiteArmed(
  states: readonly FallingStalactiteTimerState[],
  id: string,
): boolean {
  return timedTileHas(states, id, CONFIG);
}

/** `id`'s raw elapsed seconds since arming — 0 when no entry exists (hanging).
 *  Used by the per-tick merge to derive the fall/shake offsets. */
export function fallingStalactiteElapsedFor(
  states: readonly FallingStalactiteTimerState[],
  id: string,
): number {
  return timedTileElapsedFor(states, id, CONFIG);
}

/** Downward offset (rendered px) from the hanging position — 0 through the
 *  shake, then linear at `FALLING_STALACTITE_FALL_SPEED`. */
export function fallingStalactiteOffsetYAt(elapsed: number): number {
  if (elapsed < FALLING_STALACTITE_SHAKE_SECONDS) return 0;
  return (elapsed - FALLING_STALACTITE_SHAKE_SECONDS) * FALLING_STALACTITE_FALL_SPEED;
}

/** Horizontal shake offset (rendered px) — a deterministic sine, 0 outside the
 *  shake phase (the shared core's shake helper, window-gated to the shake
 *  phase). */
export function fallingStalactiteShakeOffsetXAt(elapsed: number): number {
  if (elapsed < 0) return 0;
  return timedTileShakeOffsetX(elapsed, SHAKE_AMPLITUDE_RENDERED_PX, {
    until: FALLING_STALACTITE_SHAKE_SECONDS,
  });
}

/**
 * Nearest standable row strictly below `fromRow` in `col` (the first one the
 * fall reaches), or `null` past the level bottom. Re-evaluated each tick so a
 * crumbling floor that breaks mid-fall no longer stops it (FR-008).
 */
export function fallingStalactiteLandingRow(
  level: LevelDef,
  blocks: readonly BlockPlacement[],
  crumblingFloorStates: readonly GridTimerState[],
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
  crumblingFloorStates: readonly GridTimerState[],
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
  crumblingFloorStates: readonly GridTimerState[],
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

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A native-pixel sprite crop. */
interface SpriteRect {
  sx: number;
  sy: number;
  width: number;
  height: number;
}

/** The large variant's own crop (the whole entry the decoration would draw). */
function largeRect(col: number, row: number): SpriteRect {
  const entry = stalactiteEntry(col, row);
  return { sx: entry.sx, sy: entry.sy, width: entry.width ?? TILE_SIZE, height: entry.height ?? TILE_SIZE };
}

/** The twin half that actually falls: left (larger) on an even column, right
 *  (smaller) on an odd column (FR-019). */
function selectedTwinRect(col: number): SpriteRect {
  return col % 2 === 0 ? TWIN_LEFT_RECT : TWIN_RIGHT_RECT;
}

/** The twin half that stays hanging — the other one. */
function survivorTwinRect(col: number): SpriteRect {
  return col % 2 === 0 ? TWIN_RIGHT_RECT : TWIN_LEFT_RECT;
}

/** The crop the falling sprite occupies. */
function fallingStalactiteRect(hazard: HazardPlacement): SpriteRect {
  return isStalactiteTwin(hazard.col, hazard.row)
    ? selectedTwinRect(hazard.col)
    : largeRect(hazard.col, hazard.row);
}

/**
 * The current falling rect: the large sprite (a whole tile wide) or the
 * parity-selected twin half (half a tile), shifted by the per-tick fall and
 * shake offsets merged into the placement. Non-solid at every phase (FR-010).
 */
function fallingStalactiteBox(hazard: HazardPlacement): Rect {
  const twin = isStalactiteTwin(hazard.col, hazard.row);
  const rect = fallingStalactiteRect(hazard);
  const shakeX = hazard.fallingStalactiteShakeOffsetX ?? 0;
  const offsetY = hazard.fallingStalactiteOffsetY ?? 0;
  const xOffset = twin ? rect.sx * RENDER_SCALE : 0;
  return {
    x: hazard.x + xOffset + shakeX,
    y: hazard.y + offsetY,
    width: rect.width * RENDER_SCALE,
    height: rect.height * RENDER_SCALE,
  };
}

/** Hazardous only while falling — hanging and shaking are inert (FR-005), and
 *  a `gone` hazard is no longer there (FR-013). Missing phase reads as
 *  hanging. */
function fallingStalactiteIsContact(hazard: HazardPlacement): boolean {
  return hazard.fallingStalactitePhase === 'falling';
}

/**
 * The world-space origin and single art layer of a landed hazard's shatter
 * debris (FR-020): the falling sprite's own crop, anchored at the hazard's
 * column (offset to the selected twin half) and at `landingRow`'s top edge —
 * exactly where the sprite came to rest.
 */
export function fallingStalactiteShatter(
  hazard: HazardPlacement,
  landingRow: number,
): { x: number; y: number; layers: DebrisLayer[] } {
  const twin = isStalactiteTwin(hazard.col, hazard.row);
  const rect = fallingStalactiteRect(hazard);
  const restOffset = fallingStalactiteRestOffsetY(hazard, landingRow) ?? 0;
  return {
    x: hazard.x + (twin ? rect.sx * RENDER_SCALE : 0),
    // The sprite's top at rest — one sprite-height above the landing row's
    // top, where its bottom came to meet the solid (not sunk into it).
    y: hazard.y + restOffset,
    layers: [
      { sheet: DECORATIONS_SHEET.src, sx: rect.sx, sy: rect.sy, width: rect.width, height: rect.height },
    ],
  };
}

/** Blits one crop of the decorations sheet, scaled to its own rendered size at
 *  `destX`/`destY` (world space; the caller adds no origin here). */
function blit(
  hazard: HazardPlacement,
  dc: DrawContext,
  image: HTMLImageElement,
  rect: SpriteRect,
  destX: number,
  destY: number,
): void {
  dc.ctx.drawImage(
    image,
    rect.sx,
    rect.sy,
    rect.width,
    rect.height,
    hazard.x + destX + dc.originX,
    hazard.y + destY + dc.originY,
    rect.width * RENDER_SCALE,
    rect.height * RENDER_SCALE,
  );
}

export const fallingStalactite: HazardType<HazardPlacement> = {
  key: 'fallingStalactite',
  damage: SIDE_HIT_DAMAGE,
  box: fallingStalactiteBox,
  isContact: fallingStalactiteIsContact,
  draw: (hazard, dc) => {
    const image = dc.sprites[DECORATIONS_SHEET.src];
    if (!image) return;
    const phase = hazard.fallingStalactitePhase ?? 'hanging';
    const shakeX = hazard.fallingStalactiteShakeOffsetX ?? 0;
    const offsetY = hazard.fallingStalactiteOffsetY ?? 0;
    dc.ctx.imageSmoothingEnabled = false;

    if (!isStalactiteTwin(hazard.col, hazard.row)) {
      // Large variant: one blit, exactly the decoration's own draw (source
      // 16x17 stretched to a full tile), so the hanging hazard is pixel-
      // identical to the decoration at its cell (SC-001).
      if (phase === 'gone') return;
      const entry = stalactiteEntry(hazard.col, hazard.row);
      dc.ctx.drawImage(
        image,
        entry.sx,
        entry.sy,
        entry.width ?? TILE_SIZE,
        entry.height ?? TILE_SIZE,
        hazard.x + shakeX + dc.originX,
        hazard.y + offsetY + dc.originY,
        RENDERED_TILE_SIZE,
        RENDERED_TILE_SIZE,
      );
      return;
    }

    // Twin variant: the survivor half always renders, statically and untinted,
    // for the rest of the attempt — including after the selected half has
    // shattered (FR-019) — so this branch never returns early on 'gone'.
    const survivor = survivorTwinRect(hazard.col);
    blit(hazard, dc, image, survivor, survivor.sx * RENDER_SCALE, 0);

    if (phase !== 'gone') {
      const selected = selectedTwinRect(hazard.col);
      blit(hazard, dc, image, selected, selected.sx * RENDER_SCALE + shakeX, offsetY);
    }
  },
};
