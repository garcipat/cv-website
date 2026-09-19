import { RENDERED_TILE_SIZE, RENDER_SCALE } from '../level/Terrain';
import type { CheckpointPlacement } from '../level/CheckpointMapper';
import type { Box } from '../engine/Collision';
import type { EffectAnchor } from './Enemy';
import type { SpriteSheet } from './sprites/SpriteSheet';

/** Native size of one frame in `checkpoint-flag-strip.png` (64x24: four
 *  16x24 frames). A checkpoint is a single tile cell, but its art is taller
 *  than wide — the flag pole — so the height is deliberately not
 *  `RENDERED_TILE_SIZE`'s source (16). */
export const CHECKPOINT_FRAME_COUNT = 4;
export const CHECKPOINT_FRAME_WIDTH = 16;
export const CHECKPOINT_FRAME_HEIGHT = 24;

/** Frame index the flag rests on once fully raised. */
export const CHECKPOINT_RAISED_FRAME = 3;

/** Seconds the four-frame raise plays for — frame 3 is reached exactly here
 *  (see `checkpointFrameIndex`). */
export const CHECKPOINT_RAISE_DURATION_SECONDS = 0.4;

/** Seconds between successive raise frames — the frames are spread evenly
 *  across the raise, so `CHECKPOINT_FRAME_COUNT - 1` steps land on the last
 *  frame at the duration. */
export const CHECKPOINT_FRAME_STEP_SECONDS =
  CHECKPOINT_RAISE_DURATION_SECONDS / (CHECKPOINT_FRAME_COUNT - 1);

/** The four-frame raise strip, shared by the game and the editor preview. */
export const CHECKPOINT_FLAG_SHEET: SpriteSheet = {
  src: '/sprites/checkpoint-flag-strip.png',
  frameWidth: CHECKPOINT_FRAME_WIDTH,
  frameHeight: CHECKPOINT_FRAME_HEIGHT,
  columns: CHECKPOINT_FRAME_COUNT,
};

/** Rendered size of one frame. The flag is taller than a tile (48 vs 32), so
 *  it is drawn bottom-anchored and horizontally centred on its cell — the
 *  pole reads as standing on the ground with the banner rising above it. */
export const CHECKPOINT_RENDERED_WIDTH = CHECKPOINT_FRAME_WIDTH * RENDER_SCALE;
export const CHECKPOINT_RENDERED_HEIGHT = CHECKPOINT_FRAME_HEIGHT * RENDER_SCALE;

/**
 * Live per-instance checkpoint state — mirrors `ChestState extends
 * ChestPlacement`. `activated` is a permanent record for the run (the flag
 * stays raised; only Reset Game returns it to dormant), and `activatedAt` is
 * a snapshot of the shared world clock taken once at activation, from which
 * the raise frame is derived at draw time (no per-frame state write).
 */
export interface CheckpointState extends CheckpointPlacement {
  activated: boolean;
  activatedAt: number | null;
}

/** Converts a placed-but-static `CheckpointPlacement` into its initial live
 *  state — always dormant, with no activation time. */
export function toCheckpointState(placement: CheckpointPlacement): CheckpointState {
  return { ...placement, activated: false, activatedAt: null };
}

/** A checkpoint's trigger box — exactly one rendered tile, mirroring
 *  `signBox` (level/SignMapper.ts). The flag art is taller than a tile, but
 *  the footprint the player steps on is the cell itself. */
export function checkpointBox(state: CheckpointState): Box {
  return { x: state.x, y: state.y, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE };
}

/**
 * Which frame of the raise strip to draw. Dormant is always frame 0. Once
 * activated, the frame advances with the shared world clock from
 * `activatedAt` — frame 3 is reached exactly at
 * `CHECKPOINT_RAISE_DURATION_SECONDS` and held forever after. Pure, and
 * derived from the clock rather than ticked per frame, so the raise freezes
 * with the rest of the world during death/pause (same convention as
 * `Coin.ts`'s `coinFrameIndex`). The tiny epsilon guards the even-step
 * boundaries against IEEE-754 rounding (e.g. `2 * step / step` coming out
 * fractionally below 2).
 */
export function checkpointFrameIndex(
  state: CheckpointState,
  worldElapsed: number,
): 0 | 1 | 2 | 3 {
  if (state.activatedAt === null) return 0;
  const elapsed = worldElapsed - state.activatedAt;
  if (elapsed <= 0) return 0;
  if (elapsed >= CHECKPOINT_RAISE_DURATION_SECONDS) return CHECKPOINT_RAISED_FRAME;
  const frame = Math.floor(elapsed / CHECKPOINT_FRAME_STEP_SECONDS + 1e-9);
  return Math.min(CHECKPOINT_RAISED_FRAME, frame) as 0 | 1 | 2 | 3;
}

/** Raises a dormant checkpoint, stamping `now` (the shared world clock) as
 *  the activation instant. A no-op (same reference) once activated — the
 *  activation instant is written exactly once (FR-006/FR-008), mirroring
 *  `Chest.ts`'s `openChest`. */
export function activateCheckpoint(state: CheckpointState, now: number): CheckpointState {
  if (state.activated) return state;
  return { ...state, activated: true, activatedAt: now };
}

/** A world-space anchor + unit scale for the activation burst at this
 *  checkpoint's tile — mirrors `blockEffectAnchor` (a checkpoint is a single
 *  tile, so there is no per-instance size variance). */
export function checkpointEffectAnchor(state: CheckpointState): EffectAnchor {
  return {
    x: state.x + RENDERED_TILE_SIZE / 2,
    y: state.y + RENDERED_TILE_SIZE / 2,
    scale: 1,
  };
}
