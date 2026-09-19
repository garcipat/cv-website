/**
 * The cave-lighting math — a pure module (no React, no canvas, no signals),
 * mirroring `engine/Torch.ts` and `level/Terrain.ts`, so every rule in
 * contracts/lighting.md is unit-testable without a DOM.
 *
 * Everything here is derived: the darkness level is eased from the player's
 * foot cell, and torch light/enemy-eye opacity are computed from world
 * positions and the shared clock. Nothing in this file stores state or draws.
 */

import type { BackgroundPieceFamily, BackgroundPlacement } from '../level/LevelData';
import type { PlayerState } from '../entities/Player';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import { RENDERED_TILE_SIZE, RENDER_SCALE } from '../level/Terrain';
import { backgroundCatalogEntry, backgroundPieceFamily } from './BackgroundCatalog';
import { TORCH_FRAME_COUNT, torchPhase } from './Torch';

/**
 * `BackgroundPieceFamily` is declared once in `level/LevelData.ts` (the single
 * source of truth) and re-exported here so lighting consumers can name it
 * without reaching into the level module. Deliberately a type-only re-export —
 * this module does not re-declare the union.
 */
export type { BackgroundPieceFamily };

/** A grid cell. */
export interface Cell {
  col: number;
  row: number;
}

/** A world-space point. */
export interface Point {
  x: number;
  y: number;
}

/** A torch light source, derived from a `torch` terrain tile. */
export interface TorchLight extends Point {
  col: number;
  row: number;
}

/** Darkness cap — a brightness floor so the scene stays readable (FR-005). */
export const MAX_DARKNESS = 0.97;

/** Enter/exit fade duration in seconds (FR-003, SC-001). */
export const DARKNESS_FADE_SECONDS = 0.4;

/** Soft glow radius in rendered pixels — roughly a 3.5-tile radius (FR-009). */
export const TORCH_LIGHT_RADIUS_PX = 3.5 * RENDERED_TILE_SIZE;

/** Pulse depth as a fraction of the light radius (FR-013, SC-007). */
export const TORCH_PULSE_AMPLITUDE = 0.02;

/**
 * Seconds per full pulse breath. Deliberately much slower than the torch's
 * 0.8 s flame loop: the light should read as a slow, calm breathing, not a
 * flicker locked to the fast frame changes (FR-013, SC-007). Each torch keeps
 * its own phase offset (from `torchPhase`) so they never breathe in unison.
 */
export const TORCH_PULSE_PERIOD_SECONDS = 2.6;

/** Warm orange/gold glow, visually distinct from the neutral darkness (FR-014). */
export const TORCH_GLOW_COLOR = 'rgb(255, 176, 74)';

/** Below this local darkness, an enemy shows its normal sprite (FR-015). */
export const ENEMY_EYE_DARKNESS_THRESHOLD = 0.25;

/** Width of the fade band above the threshold (FR-016). */
export const ENEMY_EYE_FADE_RANGE = 0.25;

/** Glowing yellow eye marker colour (FR-015). */
export const ENEMY_EYE_COLOR = 'rgb(255, 204, 0)';

/** Eye square size in rendered pixels — 2 native px, so it reads as a pair of
 *  pixel-art eyes rather than a single dot (FR-018). */
export const ENEMY_EYE_SIZE_PX = 2 * RENDER_SCALE;

/** Centre-to-centre gap between the two eyes, in rendered pixels — 4 native
 *  px, wide enough to read as a face at the slimes' size (FR-018). */
export const ENEMY_EYE_GAP_PX = 4 * RENDER_SCALE;

function clampDarkness(value: number): number {
  return Math.max(0, Math.min(MAX_DARKNESS, value));
}

/**
 * Eases `current` toward `target` by `(dt / fadeSeconds) * MAX_DARKNESS`,
 * clamped so it never overshoots the target. `target` is always `0` or
 * `MAX_DARKNESS` in this feature but the function is written for any target in
 * `[0, MAX_DARKNESS]`.
 *
 * - `dt <= 0` returns `current` unchanged (a paused/degenerate tick must not
 *   move the darkness).
 * - `fadeSeconds <= 0` snaps straight to `target`.
 * - The result is always within `[0, MAX_DARKNESS]`.
 */
export function nextDarknessLevel(
  current: number,
  target: number,
  dt: number,
  fadeSeconds: number = DARKNESS_FADE_SECONDS,
): number {
  if (dt <= 0) return clampDarkness(current);
  if (fadeSeconds <= 0) return clampDarkness(target);

  const step = (dt / fadeSeconds) * MAX_DARKNESS;
  if (current < target) return clampDarkness(Math.min(target, current + step));
  if (current > target) return clampDarkness(Math.max(target, current - step));
  return clampDarkness(current);
}

/**
 * Whether `(col, row)` is covered by at least one **cave-family** background
 * placement's footprint. A boolean by construction, so overlapping cave pieces
 * can never compound (FR-007). An unknown/stale `pieceId` contributes nothing
 * and never throws (mirroring `backgroundCatalogEntry`).
 */
export function isCellDarkening(
  background: readonly BackgroundPlacement[],
  col: number,
  row: number,
): boolean {
  for (const placement of background) {
    if (backgroundPieceFamily(placement.pieceId) !== 'cave') continue;
    const entry = backgroundCatalogEntry(placement.pieceId);
    if (!entry) continue;
    if (
      col >= placement.col &&
      col < placement.col + entry.widthTiles &&
      row >= placement.row &&
      row < placement.row + entry.heightTiles
    ) {
      return true;
    }
  }
  return false;
}

/**
 * The cell the player's feet are within — the cell the player "occupies" for
 * the darkness probe (FR-002). Deterministic and matching the existing
 * centered-on-a-tile player model.
 *
 * The `- 1` matters: a standing player's feet rest exactly on the top edge of
 * the floor tile, so `floor(feetBottom / tile)` would return the *floor* tile
 * and never probe the cell the player's body is actually in. Subtracting one
 * lands inside the last pixel row of the feet, i.e. the occupied (air) cell —
 * the same "tile the feet are within" convention `Physics.ts` uses for its
 * horizontal-collision and climb checks. This is what lets the shipped cave's
 * charcoal backdrop (which covers the gallery's air cells) darken the view as
 * the player walks under it. Pure and never throws.
 */
export function playerOccupiedCell(player: PlayerState): Cell {
  return {
    col: Math.floor((player.x + PLAYER_RENDERED_SIZE / 2) / RENDERED_TILE_SIZE),
    row: Math.floor(
      (player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING - 1) / RENDERED_TILE_SIZE,
    ),
  };
}

/**
 * A multiplier around `1` whose depth is `TORCH_PULSE_AMPLITUDE` and whose
 * period is the slow `TORCH_PULSE_PERIOD_SECONDS` — a calm breathing rather
 * than a nervous flicker (FR-013, SC-007). Each torch keeps its own phase
 * offset from `torchPhase` so neighbouring torches do not breathe in unison.
 * Always within `[1 - TORCH_PULSE_AMPLITUDE, 1 + TORCH_PULSE_AMPLITUDE]`.
 */
export function torchPulseScale(torch: TorchLight, worldElapsed: number): number {
  const phaseOffset = torchPhase(torch.col, torch.row) / TORCH_FRAME_COUNT;
  const phase = (worldElapsed / TORCH_PULSE_PERIOD_SECONDS + phaseOffset) * Math.PI * 2;
  return 1 + TORCH_PULSE_AMPLITUDE * Math.sin(phase);
}

/**
 * A torch's light contribution at `(x, y)` in `[0, 1]`: `1` at the torch
 * centre, falling smoothly (smoothstep) to `0` at
 * `TORCH_LIGHT_RADIUS_PX * torchPulseScale`, and `0` beyond it. Distance alone
 * decides — no occlusion (FR-011).
 */
export function torchGlowStrengthAt(
  torch: TorchLight,
  x: number,
  y: number,
  worldElapsed: number,
): number {
  const radius = TORCH_LIGHT_RADIUS_PX * torchPulseScale(torch, worldElapsed);
  if (radius <= 0) return 0;

  const distance = Math.hypot(x - torch.x, y - torch.y);
  if (distance >= radius) return 0;

  const t = 1 - distance / radius;
  return t * t * (3 - 2 * t);
}

/**
 * The darkness left at `(x, y)` after torch light: `clamp(darknessLevel -
 * max(torchGlowStrengthAt(...)), 0, darknessLevel)`. Uses the **maximum**
 * contribution, not a sum, so overlapping pools never over-brighten; returns
 * `darknessLevel` unchanged when `torches` is empty.
 */
export function localDarknessAt(
  x: number,
  y: number,
  darknessLevel: number,
  torches: readonly TorchLight[],
  worldElapsed: number,
): number {
  let strongest = 0;
  for (const torch of torches) {
    const strength = torchGlowStrengthAt(torch, x, y, worldElapsed);
    if (strength > strongest) strongest = strength;
  }
  return Math.max(0, Math.min(darknessLevel, darknessLevel - strongest));
}

/**
 * How opaque an enemy's eye marker is at `localDarkness`: `0` at or below
 * `ENEMY_EYE_DARKNESS_THRESHOLD`, rising smoothly (smoothstep) to `1` at
 * `ENEMY_EYE_DARKNESS_THRESHOLD + ENEMY_EYE_FADE_RANGE`, and clamped to
 * `[0, 1]` (FR-015/FR-016).
 */
export function enemyEyeOpacity(localDarkness: number): number {
  if (localDarkness <= ENEMY_EYE_DARKNESS_THRESHOLD) return 0;
  const t = (localDarkness - ENEMY_EYE_DARKNESS_THRESHOLD) / ENEMY_EYE_FADE_RANGE;
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/** Seconds per full up-down bob of an enemy's eye marker (FR-018). */
export const ENEMY_EYE_BOB_PERIOD_SECONDS = 1.5;

/** Peak vertical travel of the eye bob, in rendered pixels (FR-018). */
export const ENEMY_EYE_BOB_AMPLITUDE_PX = 3;

/**
 * A small vertical offset (rendered px) that makes the eye marker bob gently
 * up and down over time, so a hidden enemy's eyes read as alive rather than as
 * two static dots. Driven by the shared world clock, so it freezes with the
 * rest of the world. Always within
 * `[-ENEMY_EYE_BOB_AMPLITUDE_PX, ENEMY_EYE_BOB_AMPLITUDE_PX]` (FR-018).
 */
export function enemyEyeBobOffset(worldElapsed: number): number {
  return (
    Math.sin((worldElapsed / ENEMY_EYE_BOB_PERIOD_SECONDS) * Math.PI * 2) *
    ENEMY_EYE_BOB_AMPLITUDE_PX
  );
}
