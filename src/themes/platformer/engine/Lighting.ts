/**
 * The cave-lighting math — a pure module (no React, no canvas, no signals),
 * mirroring `engine/Torch.ts` and `level/Terrain.ts`, so every rule in
 * contracts/lighting.md is unit-testable without a DOM.
 *
 * Everything here is derived: the darkness level is eased from the player's
 * foot cell, and torch light/enemy-eye opacity are computed from world
 * positions and the shared clock. Nothing in this file stores state or draws.
 */

import type { BackgroundMaterialFamily, LevelDef, TorchStrength } from '../level/LevelData';
import { backgroundMaterialFamily } from '../level/LevelData';
import type { PlayerState } from '../entities/Player';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import { RENDERED_TILE_SIZE, RENDER_SCALE, backgroundAt, tileToPixel } from '../level/Terrain';
import { TORCH_FRAME_COUNT, torchPhase, torchLightScale } from './Torch';

/**
 * `BackgroundMaterialFamily` is declared once in `level/LevelData.ts` (the
 * single source of truth) and re-exported here so lighting consumers can name
 * it without reaching into the level module. Deliberately a type-only
 * re-export — this module does not re-declare the union.
 */
export type { BackgroundMaterialFamily };

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
  /** The torch's strength (0–9) — its light radius scales with this. */
  strength: TorchStrength;
}

/** Darkness cap — a brightness floor so the scene stays readable (FR-005). */
export const MAX_DARKNESS = 0.97;

/** Enter/exit fade duration in seconds (FR-003, SC-001). */
export const DARKNESS_FADE_SECONDS = 0.4;

/**
 * Cave fog's flat tint, as an `"r, g, b"` triplet (so callers can build both
 * `rgb(...)` and `rgba(..., alpha)` strings from it) — a cool, muted slate
 * tone, deliberately distinct from darkness's neutral black so a visitor
 * reads "fogged from outside" and "dark because I'm inside" as two different
 * things rather than the same overlay at two strengths (O-028 FR-009).
 */
export const FOG_TINT_RGB = '92, 108, 122';

/**
 * A fog puff's radius, in rendered pixels — well over a full tile so
 * neighbouring puffs overlap generously and read as one continuous bank of
 * fog rather than a row of separate dots, and bleed a little into whatever
 * clear cell sits next to a cave-family one instead of stopping dead at the
 * grid line.
 */
export const FOG_PUFF_RADIUS_PX = 1.35 * RENDERED_TILE_SIZE;

/**
 * How far into a puff's radius the fully-opaque plateau extends, as a
 * fraction of the radius, before the soft fade to transparent begins. Kept
 * small deliberately: most of a puff's radius is gradient, not flat color,
 * so it reads as drifting haze rather than a solid painted disc — a large
 * plateau (near the puff's own radius) is what made the first version read
 * as "gray paint" instead of fog. Still enough of a solid centre that a
 * fogged cell's own middle stays opaque.
 *
 * Known tradeoff: because the fade starts this close to centre, content on
 * an ISOLATED single- or two-cell fog patch — one with no neighbouring
 * cave-family cell whose own puff would otherwise overlap and reinforce
 * it — can sit close enough to this puff's soft rim to be faintly
 * legible, rather than fully hidden as FR-002 asks for in the strict
 * case. Two stricter alternatives were tried and reverted: extending the
 * plateau (reads as flat paint again) and a separate small solid coverage
 * circle under the haze (reads as an obvious second circle wherever the
 * haze has faded past it). In practice this only matters for small,
 * isolated cave pockets — every cave-family region in the shipped level is
 * large enough that overlapping neighbouring puffs cover any single
 * cell's content regardless of where its own puff's fade lands.
 */
export const FOG_PUFF_PLATEAU = 0.3;

/**
 * How far a fog puff's centre can drift from its own cell's centre, in
 * rendered pixels — small enough to stay visibly anchored to its cell,
 * large enough that a bank of fogged cells doesn't read as a perfectly
 * grid-aligned stamp. Kept modest rather than generous: every pixel of
 * drift widens the gap `FOG_PUFF_PLATEAU`'s doc comment describes between
 * a puff's centre and its cell's own farthest corner, so a smaller jitter
 * directly narrows the isolated-cell tradeoff described there.
 */
export const FOG_PUFF_JITTER_PX = 0.12 * RENDERED_TILE_SIZE;

/** Depth of a fog puff's own gentle "breathing" pulse, as a fraction of its
 *  radius — same shape as `TORCH_PULSE_AMPLITUDE` below, kept as its own
 *  constant since fog and torch light are unrelated effects that happen to
 *  share a technique. */
export const FOG_PULSE_AMPLITUDE = 0.06;

/** Seconds per full fog-puff breath — slow and calm, the same spirit as
 *  `TORCH_PULSE_PERIOD_SECONDS`: barely perceptible, never a flicker. */
export const FOG_PULSE_PERIOD_SECONDS = 3.4;

/**
 * A deterministic pseudo-random value in `[0, 1)` for `(col, row, salt)` —
 * the same `Math.imul` position-hash `Torch.ts`'s `torchPhase` uses,
 * generalized with a salt so one cell can draw several independent values
 * (a jitter angle, a jitter distance, a pulse phase) without them
 * correlating. Pure: the same inputs always produce the same output, so a
 * cell's puff always drifts and breathes the same way.
 */
function cellHash01(col: number, row: number, salt: number): number {
  const hash =
    (Math.imul(col + salt * 92821, 374761393) ^ Math.imul(row + salt * 68917, 668265263)) >>> 0;
  return hash / 0xffffffff;
}

/**
 * One fog puff's current centre and (pulsing) radius for the cell at
 * `(col, row)` at `worldElapsed` — the jitter offset and pulse phase are
 * both derived from the cell's own position via `cellHash01`, so the same
 * cell always drifts to the same spot and breathes on its own phase,
 * mirroring how `torchPulseScale` gives each torch its own phase offset so
 * neighbouring instances never move in unison.
 */
export function fogPuffAt(
  col: number,
  row: number,
  worldElapsed: number,
): { x: number; y: number; radius: number } {
  const { x: tileX, y: tileY } = tileToPixel(col, row);
  const centerX = tileX + RENDERED_TILE_SIZE / 2;
  const centerY = tileY + RENDERED_TILE_SIZE / 2;

  const jitterAngle = cellHash01(col, row, 1) * Math.PI * 2;
  const jitterDistance = cellHash01(col, row, 2) * FOG_PUFF_JITTER_PX;
  const phaseOffset = cellHash01(col, row, 3);
  const pulse =
    1 +
    FOG_PULSE_AMPLITUDE *
      Math.sin((worldElapsed / FOG_PULSE_PERIOD_SECONDS + phaseOffset) * Math.PI * 2);

  return {
    x: centerX + Math.cos(jitterAngle) * jitterDistance,
    y: centerY + Math.sin(jitterAngle) * jitterDistance,
    radius: FOG_PUFF_RADIUS_PX * pulse,
  };
}

/**
 * How close the player must be to a fog puff before it starts thinning, in
 * rendered pixels — roughly a 2.5-tile radius, so a visitor gets a beat of
 * warning before actually crossing into a fogged cell rather than stepping
 * in blind.
 */
export const FOG_PEEK_RADIUS_PX = 2.5 * RENDERED_TILE_SIZE;

/**
 * How much a fog puff at `(x, y)` should thin because the player is nearby,
 * in `[0, 1]` — `1` right at the player's own position (fully cleared),
 * falling smoothly (smoothstep) to `0` at `FOG_PEEK_RADIUS_PX`, and `0`
 * beyond it. The same falloff shape `playerGlowStrengthAt` already uses for
 * the player's carried torch light, applied to fog instead of darkness.
 */
export function fogPeekStrengthAt(x: number, y: number, player: Point): number {
  const radius = FOG_PEEK_RADIUS_PX;
  if (radius <= 0) return 0;

  const distance = Math.hypot(x - player.x, y - player.y);
  if (distance >= radius) return 0;

  const t = 1 - distance / radius;
  return t * t * (3 - 2 * t);
}

/** Soft glow radius in rendered pixels — roughly a 3.5-tile radius (FR-009). */
export const TORCH_LIGHT_RADIUS_PX = 3.5 * RENDERED_TILE_SIZE;

/** Radius of the player's own carried light, in rendered pixels — deliberately
 *  much smaller than a wall torch's so torches stay the landmarks (FR-023). */
export const PLAYER_LIGHT_RADIUS_PX = 1.75 * RENDERED_TILE_SIZE;

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

/** The player's own carried glow — a touch more orange and less yellow than the
 *  wall torches', and softer overall (FR-023). */
export const PLAYER_GLOW_COLOR = 'rgb(255, 145, 45)';

/** How strong the player's warm glow is relative to a torch's (FR-023). */
export const PLAYER_GLOW_INTENSITY = 0.7;

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
 * Whether `(col, row)`'s background material belongs to the `cave` family —
 * a direct grid lookup (FR-009), replacing the old AABB placement-footprint
 * scan. An empty cell (`backgroundAt` returns `null`) never darkens.
 */
export function isCellDarkening(level: LevelDef, col: number, row: number): boolean {
  const material = backgroundAt(level, col, row);
  return material !== null && backgroundMaterialFamily(material) === 'cave';
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
 * centre, falling smoothly (smoothstep) to `0` at `torchLightRadius`, and `0`
 * beyond it. Distance alone decides — no occlusion (FR-011).
 */
export function torchGlowStrengthAt(
  torch: TorchLight,
  x: number,
  y: number,
  worldElapsed: number,
): number {
  const radius = torchLightRadius(torch, worldElapsed);
  if (radius <= 0) return 0;

  const distance = Math.hypot(x - torch.x, y - torch.y);
  if (distance >= radius) return 0;

  const t = 1 - distance / radius;
  return t * t * (3 - 2 * t);
}

/**
 * The darkness left at `(x, y)` after torch light and the player's own carried
 * light: `clamp(darknessLevel - strongestLight, 0, darknessLevel)`. Uses the
 * **maximum** contribution, not a sum, so overlapping pools never
 * over-brighten; returns `darknessLevel` unchanged when there are no lights.
 */
export function localDarknessAt(
  x: number,
  y: number,
  darknessLevel: number,
  torches: readonly TorchLight[],
  worldElapsed: number,
  playerLight?: Point | null,
): number {
  let strongest = playerLight ? playerGlowStrengthAt(x, y, playerLight) : 0;
  for (const torch of torches) {
    const strength = torchGlowStrengthAt(torch, x, y, worldElapsed);
    if (strength > strongest) strongest = strength;
  }
  return Math.max(0, Math.min(darknessLevel, darknessLevel - strongest));
}

/**
 * The player's own carried light at `(x, y)` in `[0, 1]`: `1` at the player's
 * centre, falling smoothly (smoothstep) to `0` at `PLAYER_LIGHT_RADIUS_PX`.
 * Steady rather than pulsing, so the player's readability never flickers
 * (FR-023/FR-024).
 */
export function playerGlowStrengthAt(x: number, y: number, light: Point): number {
  const radius = PLAYER_LIGHT_RADIUS_PX;
  if (radius <= 0) return 0;

  const distance = Math.hypot(x - light.x, y - light.y);
  if (distance >= radius) return 0;

  const t = 1 - distance / radius;
  return t * t * (3 - 2 * t);
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
