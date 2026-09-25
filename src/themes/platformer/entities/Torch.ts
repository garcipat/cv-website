/**
 * The torch's flame animation — a pure module (no React, no canvas, no
 * signals), mirroring `StaticObjectsCatalog.ts`/`Terrain.ts`.
 *
 * The torch is a stateless decorative terrain tile: it holds no per-instance
 * state and no timer. Its visible frame is a pure function of its grid
 * position and the shared world clock, so every torch animates for free and
 * neighbouring torches flicker out of phase (spec FR-009).
 */

import { hash2D, pulse, radialFalloffAt } from '../shared/math';
import type { LightSource } from '../contracts/lighting';

/**
 * A wall torch's light strength, `0`-`9`. `5` is the default
 * (`DEFAULT_TORCH_STRENGTH`): a torch with no marker lights at today's radius,
 * and the other values scale that radius linearly, so `0` is dark and `9` is
 * roughly double.
 *
 * Owned here rather than in `level/LevelData.ts` so the whole torch module —
 * type, constants, frame animation and validator — stays together and free of
 * any `level/` dependency (the `level/ → engine/` edge R-001 removes).
 */
export type TorchStrength = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

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
 * Deterministic per-tile phase offset from grid position — the shared
 * `shared/math.ts` `hash2D`, used to offset a frame index rather than pick a
 * variant. Returns an integer in `[0, TORCH_FRAME_COUNT)`, stable across
 * sessions (spec FR-009).
 */
export function torchPhase(col: number, row: number): number {
  return hash2D(col, row) % TORCH_FRAME_COUNT;
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

/**
 * A torch light source, derived from a `torch` terrain tile (R-003 finding X5
 * — the light half now lives with its subject). `col`/`row` drive the pulse
 * phase and `strength` scales the radius, so the generic `LightSource` cannot
 * replace this descriptor; it is the adapter's input.
 *
 * `x`/`y` are declared inline rather than extending `engine/Lighting.ts`'s
 * `Point`, so this module keeps reaching only `shared/math` and
 * `contracts/lighting` (no `entities/ → engine/` edge; FR-017).
 */
export interface TorchLight {
  col: number;
  row: number;
  /** World-space centre X, in rendered pixels. */
  x: number;
  /** World-space centre Y, in rendered pixels. */
  y: number;
  /** The torch's strength (0–9) — its light radius scales with this. */
  strength: TorchStrength;
}

/** Soft glow radius in rendered pixels — roughly a 3.5-tile radius (FR-009).
 *  3.5 × `RENDERED_TILE_SIZE` (16 native px × 2 render scale = 32) is inlined
 *  so this module takes no `level/` import. */
export const TORCH_LIGHT_RADIUS_PX = 3.5 * 32;

/** Pulse depth as a fraction of the light radius (FR-013, SC-007). */
export const TORCH_PULSE_AMPLITUDE = 0.05;

/**
 * Seconds per full pulse breath. Deliberately much slower than the torch's
 * 0.8 s flame loop: the light should read as a slow, calm breathing, not a
 * flicker locked to the fast frame changes (FR-013, SC-007). Each torch keeps
 * its own phase offset (from `torchPhase`) so they never breathe in unison.
 */
export const TORCH_PULSE_PERIOD_SECONDS = 2.6;

/** Warm orange/gold glow, visually distinct from the neutral darkness (FR-014). */
export const TORCH_GLOW_COLOR = 'rgb(255, 176, 74)';

/**
 * A multiplier around `1` whose depth is `TORCH_PULSE_AMPLITUDE` and whose
 * period is the slow `TORCH_PULSE_PERIOD_SECONDS` — a calm breathing rather
 * than a nervous flicker (FR-013, SC-007). Each torch keeps its own phase
 * offset from `torchPhase` so neighbouring torches do not breathe in unison.
 * Always within `[1 - TORCH_PULSE_AMPLITUDE, 1 + TORCH_PULSE_AMPLITUDE]`.
 */
export function torchPulseScale(torch: TorchLight, worldElapsed: number): number {
  const phaseOffset = torchPhase(torch.col, torch.row) / TORCH_FRAME_COUNT;
  return 1 + TORCH_PULSE_AMPLITUDE * pulse(worldElapsed / TORCH_PULSE_PERIOD_SECONDS + phaseOffset);
}

/**
 * A torch's current light radius in rendered pixels — the base radius scaled by
 * the torch's own strength (`torchLightScale`) and its pulse. The single source
 * of truth for both the darkness pass and `torchGlowStrengthAt`, so the hole
 * that pass punches and the glow it adds can never drift apart.
 */
export function torchLightRadius(torch: TorchLight, worldElapsed: number): number {
  return TORCH_LIGHT_RADIUS_PX * torchLightScale(torch.strength) * torchPulseScale(torch, worldElapsed);
}

/**
 * A torch's light contribution at `(x, y)` in `[0, 1]`: `1` at the torch
 * centre, falling smoothly to `0` at `torchLightRadius`, and `0` beyond it.
 * Distance alone decides — no occlusion (FR-011). Delegates the falloff to
 * `shared/math.ts`'s `radialFalloffAt` so the formula has one implementation
 * (FR-010).
 */
export function torchGlowStrengthAt(
  torch: TorchLight,
  x: number,
  y: number,
  worldElapsed: number,
): number {
  return radialFalloffAt(x, y, torch.x, torch.y, torchLightRadius(torch, worldElapsed));
}

/**
 * The torch's `LightSource` adapter (FR-003): maps a torch descriptor plus the
 * caller's `worldElapsed` to the shared render contract, with a radius
 * byte-identical to `torchLightRadius`. `intensity: 1` means the glow's
 * `globalAlpha` is just `darknessLevel`, and `glowMidAlpha: 0.35` reproduces the
 * torch's own gradient mid stop.
 */
export function torchLightSource(torch: TorchLight, worldElapsed: number): LightSource {
  return {
    x: torch.x,
    y: torch.y,
    radius: torchLightRadius(torch, worldElapsed),
    color: TORCH_GLOW_COLOR,
    intensity: 1,
    glowMidAlpha: 0.35,
    punchHole: true,
  };
}
