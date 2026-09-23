/**
 * The torch's flame animation — a pure module (no React, no canvas, no
 * signals), mirroring `StaticObjectsCatalog.ts`/`Terrain.ts`.
 *
 * The torch is a stateless decorative terrain tile: it holds no per-instance
 * state and no timer. Its visible frame is a pure function of its grid
 * position and the shared world clock, so every torch animates for free and
 * neighbouring torches flicker out of phase (spec FR-009).
 */

import type { TorchStrength } from '../level/LevelData';

/** Seconds each flame frame is held — a calm, visible sparkle (spec FR-002). */
export const TORCH_FRAME_DURATION_SECONDS = 0.2;

/** Distinct flame frames in one sparkle loop (spec FR-003). */
export const TORCH_FRAME_COUNT = 4;

/** Sheet frame size — the 12x14 stride of `torch.png`'s 48x14 strip (spec
 *  FR-004). NOTE: the torch *artwork* is only 6x14, authored centred in the
 *  frame with a 3px transparent margin on each side (see `TORCH_CONTENT_WIDTH`). */
export const TORCH_FRAME_WIDTH = 12;
export const TORCH_FRAME_HEIGHT = 14;

/** The torch artwork's visible width — 6px (the flame and bracket at their
 *  widest). Narrower than the 12px frame, whose extra 3px-per-side margin
 *  gives the flickering flame horizontal breathing room. */
export const TORCH_CONTENT_WIDTH = 6;

/**
 * Horizontal inset (native px) centring the 12px frame in a 16px cell:
 * (16 - 12) / 2 = 2. Drawing the full frame at this inset also centres the
 * 6px artwork — it sits at frame offset 3, so its own inset is 2 + 3 = 5 =
 * (16 - 6) / 2. The artwork is bottom-aligned, so the only vertical slack is
 * the 16 - 14 = 2px gap at the top.
 */
export const TORCH_INSET_X = 2;

/**
 * Deterministic per-tile phase offset from grid position — the same
 * `Math.imul` position-hash technique as `StaticObjectsCatalog.ts`'s
 * `pickVariant`, but used to offset a frame index rather than pick a variant.
 * Returns an integer in `[0, TORCH_FRAME_COUNT)`, stable across sessions
 * (spec FR-009).
 */
export function torchPhase(col: number, row: number): number {
  const hash = (Math.imul(col, 374761393) ^ Math.imul(row, 668265263)) >>> 0;
  return hash % TORCH_FRAME_COUNT;
}

/**
 * The flame frame for a torch at `(col, row)` at `worldElapsed` seconds.
 *
 * At `worldElapsed = 0` this is exactly `torchPhase(col, row)` — the static,
 * deterministic frame the editor previews. It advances by one every
 * `TORCH_FRAME_DURATION_SECONDS` and wraps seamlessly modulo the frame count
 * (spec FR-006). Never throws for any integer `col`/`row` or `worldElapsed >= 0`.
 */
export function torchFrameIndex(col: number, row: number, worldElapsed: number): number {
  return (
    Math.floor(worldElapsed / TORCH_FRAME_DURATION_SECONDS) + torchPhase(col, row)
  ) % TORCH_FRAME_COUNT;
}

/**
 * The strength a `torch` with no marker resolves to. Calibrated to today's fixed
 * torch light (`TORCH_LIGHT_RADIUS_PX`), so an unadjusted level — and every
 * level authored before this feature — lights exactly as it did.
 */
export const DEFAULT_TORCH_STRENGTH: TorchStrength = 5;

/**
 * Every strength, in ascending order — the order the torch tool's re-click
 * cycle follows.
 */
export const TORCH_STRENGTHS: readonly TorchStrength[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** The editor badge's code for a strength — its own digit, `'0'`–`'9'`. */
export function torchStrengthCode(strength: TorchStrength): string {
  return String(strength);
}

/** The next strength the torch tool cycles to, wrapping `9` → `0`. */
export function nextTorchStrength(strength: TorchStrength): TorchStrength {
  return ((strength + 1) % 10) as TorchStrength;
}

/** Forgiving validation of a stored marker's `strength` (0–9). */
export function isTorchStrength(value: unknown): value is TorchStrength {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9;
}

/**
 * A torch's light-radius scale relative to the default: `strength /
 * DEFAULT_TORCH_STRENGTH`. So the default is `1`, `0` is `0` (dark), and `9` is
 * `1.8` (roughly double).
 */
export function torchLightScale(strength: TorchStrength): number {
  return strength / DEFAULT_TORCH_STRENGTH;
}
