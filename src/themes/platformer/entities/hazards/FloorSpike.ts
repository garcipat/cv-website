import type { HazardType } from './HazardType';
import type { HazardPlacement } from '../../level/HazardMapper';
import { FLOOR_SPIKE_SHEET } from '../sprites/sheets';
import { RENDERED_TILE_SIZE, RENDER_SCALE } from '../../level/Terrain';
import { SIDE_HIT_DAMAGE } from '../Health';
import type { Rect } from '../../contracts/geometry';
import type { DrawContext } from '../../contracts/DrawContext';
import { clamp01 } from '../../shared/math';
import {
  advanceTimedTiles,
  armTimedTile,
  timedTileHas,
  timedTileStateFor,
  type TimedTileConfig,
} from '../../shared/timedTile';

/**
 * The floor-spike hazard kind (R-004 US4): its view, timer state, constants,
 * phase vocabulary, and cycle/extension functions in one self-contained
 * module, matching the enemy/block "one kind, one module" pattern. The
 * arm/advance/presence scaffolding delegates to `shared/timedTile.ts`; this
 * module keeps only its durations and phase/extension mapping.
 */

/** Seconds between first contact and the warning pose appearing (FR-003/004). */
export const FLOOR_SPIKE_DELAY_SECONDS = 0.6;
/** Seconds the partial-rise warning pose is shown (FR-004). */
export const FLOOR_SPIKE_WARNING_SECONDS = 0.25;
/** Seconds the spike stays fully extended and hazardous (FR-005/FR-007). */
export const FLOOR_SPIKE_FULL_EXTEND_SECONDS = 0.6;
/** Seconds the retract animation takes before re-arming (FR-007/FR-009). */
export const FLOOR_SPIKE_RETRACT_SECONDS = 0.3;
/** Total cycle length — once elapsed reaches this, the tile is at rest again. */
export const FLOOR_SPIKE_CYCLE_SECONDS =
  FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS + FLOOR_SPIKE_FULL_EXTEND_SECONDS + FLOOR_SPIKE_RETRACT_SECONDS;

/**
 * A floor spike's cycle phase (spec.md's Key Entities). `'atRest'` is the
 * only phase with no tracked timer entry at all — everything else is driven
 * by elapsed time since arming. `'delay'` and `'atRest'` render identically
 * (the ground tell only) but are distinct states so a second contact during
 * the delay is a no-op rather than a fresh trigger (spec FR-008).
 * `'fullExtend'` covers both the spec's "full-extend" and "holding" phases —
 * both are hazardous and render identically.
 */
export type FloorSpikePhase = 'atRest' | 'delay' | 'warning' | 'fullExtend' | 'retracting';

/** One floor spike's live timer. Presence in the states array means its
 *  cycle is running; absence means at rest and triggerable. */
export interface FloorSpikeTimerState {
  id: string;
  /** Seconds since this tile was armed. */
  elapsed: number;
}

const CONFIG: TimedTileConfig<FloorSpikeTimerState, string> = {
  keyOf: (state) => state.id,
  duration: FLOOR_SPIKE_CYCLE_SECONDS,
  prune: true,
  rearm: 'noop',
};

/** Arms `id`'s cycle if it isn't already running — a no-op re-contact during
 *  an in-progress cycle (spec FR-008), matching the mushroom's "replace an
 *  in-progress entry" shape except here a running cycle is left untouched
 *  rather than restarted. */
export function armFloorSpike(
  states: readonly FloorSpikeTimerState[],
  id: string,
): FloorSpikeTimerState[] {
  return armTimedTile(states, CONFIG, id, () => ({ id, elapsed: 0 }));
}

/** Advances every running cycle by `dt` and drops any that reached the full
 *  cycle duration — the tile is at rest again the instant it's dropped
 *  (spec FR-009). `dt <= 0` leaves elapsed unchanged but still prunes
 *  already-expired entries. */
export function advanceFloorSpikes(
  states: readonly FloorSpikeTimerState[],
  dt: number,
): FloorSpikeTimerState[] {
  return advanceTimedTiles(states, dt, CONFIG);
}

/** Pure elapsed-time → phase mapping, same technique as `bombFuseFrame`. */
export function floorSpikePhaseAt(elapsed: number): FloorSpikePhase {
  if (elapsed < FLOOR_SPIKE_DELAY_SECONDS) return 'delay';
  if (elapsed < FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS) return 'warning';
  if (elapsed < FLOOR_SPIKE_DELAY_SECONDS + FLOOR_SPIKE_WARNING_SECONDS + FLOOR_SPIKE_FULL_EXTEND_SECONDS) {
    return 'fullExtend';
  }
  return 'retracting';
}

/** `id`'s current phase — `'atRest'` when no timer entry exists for it. */
export function floorSpikePhaseFor(
  states: readonly FloorSpikeTimerState[],
  id: string,
): FloorSpikePhase {
  const state = timedTileStateFor(states, id, CONFIG);
  return state ? floorSpikePhaseAt(state.elapsed) : 'atRest';
}

/** Whether `id` has a running cycle at all — the eligibility gate for
 *  trigger detection (only an unarmed tile can start a new cycle). */
export function isFloorSpikeArmed(states: readonly FloorSpikeTimerState[], id: string): boolean {
  return timedTileHas(states, id, CONFIG);
}

/**
 * How far out the spike currently is, from 0 (flush with the ground) to 1
 * (fully extended) — the continuous counterpart to `floorSpikePhaseAt`'s
 * discrete phase name. `'atRest'`/`'delay'` are both 0 (nothing has started
 * rising yet — the delay phase shows a separate "armed" pose, not a
 * partially-risen spike); it rises linearly 0→1 across the warning phase,
 * holds at 1 through full-extend, then falls linearly 1→0 across retract.
 * This module's `draw` uses this to crop a variable-height slice of the
 * spike art rather than picking between fixed poses.
 */
export function floorSpikeExtensionAt(elapsed: number): number {
  const warningStart = FLOOR_SPIKE_DELAY_SECONDS;
  const warningEnd = warningStart + FLOOR_SPIKE_WARNING_SECONDS;
  const fullExtendEnd = warningEnd + FLOOR_SPIKE_FULL_EXTEND_SECONDS;
  const retractEnd = fullExtendEnd + FLOOR_SPIKE_RETRACT_SECONDS;

  if (elapsed < warningStart) return 0;
  if (elapsed < warningEnd) return (elapsed - warningStart) / FLOOR_SPIKE_WARNING_SECONDS;
  if (elapsed < fullExtendEnd) return 1;
  if (elapsed < retractEnd) return 1 - (elapsed - fullExtendEnd) / FLOOR_SPIKE_RETRACT_SECONDS;
  return 0;
}

/** `id`'s current extension ratio — 0 when no timer entry exists for it
 *  (at rest, nothing rising). */
export function floorSpikeExtensionFor(states: readonly FloorSpikeTimerState[], id: string): number {
  const state = timedTileStateFor(states, id, CONFIG);
  return state ? floorSpikeExtensionAt(state.elapsed) : 0;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Same visible-band convention as Spike.ts's BAND_NATIVE for the 'up'
 *  facing — a floor spike is floor-only (FR-013), so it only ever needs
 *  that one band. */
const BAND_NATIVE = 5;

/**
 * The spike's TRIGGER box — constant regardless of phase, NOT the
 * phase-varying damage `floorSpikeBox` above. The two happen to share
 * dimensions today (both are floor-only, both use that same visible band)
 * but conceptually answer different questions — "can this tile arm?" vs.
 * "is this tile hazardous right now?" — so they stay separate functions.
 * Moved here from `engine/Collision.ts` (R-007 D3), where the kind-switched
 * detection lived.
 */
function floorSpikeTriggerBox(hazard: HazardPlacement): Rect {
  const band = BAND_NATIVE * RENDER_SCALE;
  return {
    x: hazard.x,
    y: hazard.y + RENDERED_TILE_SIZE - band,
    width: RENDERED_TILE_SIZE,
    height: band,
  };
}

/**
 * The hazardous rect — identical to the static spike's 'up'-facing band
 * (Spike.ts's facingBox), and NOT phase-gated: it's the broad-phase overlap
 * test `resolveHazardContacts` runs before checking `isContact` below, so it
 * must stay a constant geometric rect. A zero-size rect at the hazard's own
 * position would still satisfy `aabbOverlap`'s strict `<`/`>` comparisons
 * whenever the player's hitbox straddles that exact point — which it almost
 * always does while simply standing on the tile — so phase-gating belongs in
 * `isContact`, not here.
 */
function floorSpikeBox(hazard: HazardPlacement): Rect {
  const band = BAND_NATIVE * RENDER_SCALE;
  return {
    x: hazard.x,
    y: hazard.y + RENDERED_TILE_SIZE - band,
    width: RENDERED_TILE_SIZE,
    height: band,
  };
}

/** `hazard.floorSpikePhase` is only meaningful once PlatformerPage.tsx has
 *  merged the live timer state in for this tick (see PlatformerState.ts's
 *  `hazardPlacementsForTick`); missing/`'atRest'` and every non-hazardous
 *  phase all fail this check, matching FR-005 (only full-extend is
 *  hazardous). */
function floorSpikeIsContact(hazard: HazardPlacement): boolean {
  return hazard.floorSpikePhase === 'fullExtend';
}

/** Native px per frame, read from the sheet itself rather than hardcoded —
 *  FLOOR_SPIKE_SHEET's frames are a couple px taller than a tile, so a
 *  frame drawn at a hazard's own tile-aligned position always bleeds its
 *  bottom rows onto the tile below. */
const FRAME_W = FLOOR_SPIKE_SHEET.frameWidth;
const FRAME_H = FLOOR_SPIKE_SHEET.frameHeight;

/** x-offsets (native px) of each of the 3 horizontally-laid-out frames. */
const TELL_FRAME_X = 0;
const ARMED_FRAME_X = FRAME_W;
const SPIKE_FRAME_X = FRAME_W * 2;

/**
 * Draws a `cropHeight`-native-px-tall bottom-anchored slice of the frame at
 * `sx`, starting `cropTop` native px down from the frame's own top. Every
 * frame shares the same fixed bottom anchor (`hazard.y` plus the full
 * frame's rendered height) regardless of how much of it is drawn, so a
 * partial crop of the spike frame never shifts relative to the full
 * tell/armed frames drawn elsewhere in the cycle.
 */
function drawFrameSlice(
  hazard: HazardPlacement,
  dc: DrawContext,
  sx: number,
  cropTop: number,
  cropHeight: number,
): void {
  if (cropHeight <= 0) return;
  const image = dc.sprites[FLOOR_SPIKE_SHEET.src];
  if (!image) return;
  const destHeight = cropHeight * RENDER_SCALE;
  const destY = hazard.y + FRAME_H * RENDER_SCALE - destHeight;
  dc.ctx.imageSmoothingEnabled = false;
  dc.ctx.drawImage(
    image,
    sx,
    cropTop,
    FRAME_W,
    cropHeight,
    hazard.x + dc.originX,
    destY + dc.originY,
    RENDERED_TILE_SIZE,
    destHeight,
  );
}

export const floorSpike: HazardType<HazardPlacement> = {
  key: 'floorSpike',
  damage: SIDE_HIT_DAMAGE,
  knocksBack: false,
  box: floorSpikeBox,
  isContact: floorSpikeIsContact,
  /** Merges the live cycle phase/extension — the exact per-kind branch the
   *  state layer's `hazardPlacementsForTick` used to inline. */
  withTickState: (placement, timers) => ({
    ...placement,
    floorSpikePhase: floorSpikePhaseFor(timers.floorSpikeTimers, placement.id),
    floorSpikeExtension: floorSpikeExtensionFor(timers.floorSpikeTimers, placement.id),
  }),
  /** The trigger band, returned only while the spike is still at rest (an
   *  already-running cycle is not re-eligible, FR-008). */
  armTriggerRects: (hazard, timers) =>
    isFloorSpikeArmed(timers.floorSpikeTimers, hazard.id) ? [] : [floorSpikeTriggerBox(hazard)],
  draw: (hazard, dc) => {
    // The ground tell (the holes) is the base every other pose is drawn on
    // top of. It's what stays visible under/around the spike once it's
    // out — the spike frame's own art doesn't repeat the holes (unlike the
    // armed frame, which does), so without this base layer they'd vanish
    // the instant the spike starts rising.
    drawFrameSlice(hazard, dc, TELL_FRAME_X, 0, FRAME_H);

    const phase = hazard.floorSpikePhase ?? 'atRest';
    if (phase === 'atRest') return;
    if (phase === 'delay') {
      drawFrameSlice(hazard, dc, ARMED_FRAME_X, 0, FRAME_H);
      return;
    }
    // warning / fullExtend / retracting: the spike frame, cropped to a
    // bottom-anchored slice proportional to how far out it currently is
    // (0..1, see this module's floorSpikeExtensionAt) — one piece of art
    // growing/shrinking continuously, rather than a fixed "half up" pose.
    const ratio = clamp01(hazard.floorSpikeExtension ?? 0);
    const cropHeight = Math.round(FRAME_H * ratio);
    if (cropHeight <= 0) return;
    const cropTop = FRAME_H - cropHeight;
    drawFrameSlice(hazard, dc, SPIKE_FRAME_X, cropTop, cropHeight);
  },
};
