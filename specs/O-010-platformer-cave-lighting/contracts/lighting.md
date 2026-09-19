# Contract: `engine/Lighting.ts` (pure lighting module)

The lighting math is a **pure, canvas-free, DOM-free module** — mirroring
`engine/Torch.ts` and `level/Terrain.ts` — so it is fully unit-testable with
Vitest (constitution Principle II; [docs/TestingGuide.md](../../../docs/TestingGuide.md)).
It imports only types and the tile constants, never React, canvas, or signals.

## Types

```ts
/**
 * `BackgroundPieceFamily` is declared ONCE in `level/LevelData.ts` — the single
 * source of truth — and imported here and by `engine/BackgroundCatalog.ts`.
 * Do not re-declare it in this module.
 */
import type { BackgroundPieceFamily } from '../level/LevelData';

/** A grid cell. */
export interface Cell { col: number; row: number; }

/** A world-space point. */
export interface Point { x: number; y: number; }

/** A torch light source, derived from a `torch` terrain tile. */
export interface TorchLight extends Point {
  col: number;
  row: number;
}
```

## Exported constants

- `MAX_DARKNESS: number` — the darkness cap (≈ 0.97).
- `DARKNESS_FADE_SECONDS: number` — enter/exit fade duration (≈ 0.4).
- `TORCH_LIGHT_RADIUS_PX: number` — glow radius in rendered pixels (≈ 3.5 × `RENDERED_TILE_SIZE`).
- `PLAYER_LIGHT_RADIUS_PX: number` — the player's own carried light radius in rendered pixels (≈ 1.75 × `RENDERED_TILE_SIZE`), deliberately smaller than a torch's.
- `TORCH_PULSE_AMPLITUDE: number` — pulse depth (≈ 0.02).
- `TORCH_PULSE_PERIOD_SECONDS: number` — seconds per pulse breath (≈ 2.6), much slower than the flame loop.
- `TORCH_GLOW_COLOR: string` — warm orange/gold.
- `PLAYER_GLOW_COLOR: string` — the player's carried glow tone, more orange and softer than a torch's (FR-023).
- `PLAYER_GLOW_INTENSITY: number` — the player glow's strength relative to a torch's (≈ 0.7).
- `ENEMY_EYE_DARKNESS_THRESHOLD: number`
- `ENEMY_EYE_FADE_RANGE: number`
- `ENEMY_EYE_COLOR: string`
- `ENEMY_EYE_SIZE_PX: number` — eye square size in rendered pixels (2 native px = 4 rendered px).
- `ENEMY_EYE_GAP_PX: number` — centre-to-centre gap between the two eyes (4 native px = 8 rendered px).
- `ENEMY_EYE_BOB_PERIOD_SECONDS: number` — seconds per up-down bob (≈ 1.5).
- `ENEMY_EYE_BOB_AMPLITUDE_PX: number` — peak vertical travel of the bob, in rendered pixels (≈ 3).

## Functions

### `nextDarknessLevel(current: number, target: number, dt: number, fadeSeconds?: number): number`

- Returns `current` moved toward `target` by `(dt / fadeSeconds) * MAX_DARKNESS`,
  clamped so it never overshoots `target`.
- `target` is always `0` or `MAX_DARKNESS` in this feature, but the function is
  written for any target in `[0, MAX_DARKNESS]`.
- `dt <= 0` returns `current` unchanged.
- `fadeSeconds <= 0` snaps to `target`.
- Result is always clamped to `[0, MAX_DARKNESS]`.

### `isCellDarkening(background: readonly BackgroundPlacement[], col: number, row: number): boolean`

- `true` iff at least one placement whose piece family is `'cave'` has a
  footprint containing `(col, row)`.
- Unknown `pieceId` contributes nothing.
- Boolean result guarantees no compounding when pieces overlap (FR-007).
- Never throws for any integer `col`/`row`.

### `playerOccupiedCell(player: PlayerState): Cell`

- Returns the cell under the player's **bottom-centre** point:
  `col = floor((player.x + PLAYER_RENDERED_SIZE / 2) / RENDERED_TILE_SIZE)`,
  `row = floor((player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING) / RENDERED_TILE_SIZE)`.
- Pure and deterministic; never throws.

### `torchPulseScale(torch: TorchLight, worldElapsed: number): number`

- Returns a multiplier around `1` whose depth is `TORCH_PULSE_AMPLITUDE` and
  whose period is the slow `TORCH_PULSE_PERIOD_SECONDS`, with a per-torch phase
  offset from `torchPhase` (so neighbouring torches never breathe in unison).
- Always within `[1 - TORCH_PULSE_AMPLITUDE, 1 + TORCH_PULSE_AMPLITUDE]`.
- Deterministic for any `worldElapsed >= 0`.

### `torchGlowStrengthAt(torch: TorchLight, x: number, y: number, worldElapsed: number): number`

- Returns a light contribution in `[0, 1]`: `1` at the torch centre, falling
  smoothly to `0` at `TORCH_LIGHT_RADIUS_PX × torchPulseScale`, and `0`
  outside it.
- Soft falloff (smoothstep-style), never a hard edge (FR-009).
- No occlusion: distance alone decides (FR-011).

### `localDarknessAt(x: number, y: number, darknessLevel: number, torches: readonly TorchLight[], worldElapsed: number, playerLight?: Point | null): number`

- Returns `clamp(darknessLevel - strongestLight, 0, darknessLevel)`, where
  `strongestLight` is the **maximum** of every torch contribution and, when
  given, the player's own glow.
- Uses the maximum, not a sum, so overlapping pools do not over-brighten.
- Returns `darknessLevel` unchanged when there are no lights.

### `playerGlowStrengthAt(x: number, y: number, light: Point): number`

- Returns the player's carried-light contribution in `[0, 1]`: `1` at the
  player's centre, falling smoothly (smoothstep) to `0` at
  `PLAYER_LIGHT_RADIUS_PX`, and `0` beyond it.
- Steady (no pulse), so the player's readability never flickers (FR-023/FR-024).

### `enemyEyeOpacity(localDarkness: number): number`

- Returns `0` for `localDarkness <= ENEMY_EYE_DARKNESS_THRESHOLD`.
- Rises smoothly to `1` at
  `ENEMY_EYE_DARKNESS_THRESHOLD + ENEMY_EYE_FADE_RANGE`.
- Clamped to `[0, 1]`; never negative.

### `enemyEyeBobOffset(worldElapsed: number): number`

- Returns a small vertical offset in rendered pixels that makes the eye marker
  bob gently up and down, driven by the shared world clock (so it freezes with
  the world).
- Always within `[-ENEMY_EYE_BOB_AMPLITUDE_PX, ENEMY_EYE_BOB_AMPLITUDE_PX]`.
- Deterministic for any `worldElapsed >= 0`.

## Invariants (asserted by `Lighting.test.ts`)

1. Full brightness in ⇒ full brightness out: `nextDarknessLevel(0, 0, dt) === 0`.
2. The fade never overshoots its target and never snaps except at
   `fadeSeconds <= 0`.
3. `isCellDarkening` is `true` for every cell in a cave footprint, `false`
   outside it, and `false` for surface-only backgrounds.
4. Overlapping cave pieces produce the same boolean as one — never a value > 1
   or a deeper state.
5. `localDarknessAt` is monotonic in `darknessLevel` and non-increasing as
   torch light strength rises.
6. `enemyEyeOpacity` is `0` inside a torch pool and at full brightness.
7. No function mutates its arguments and none throws on integer inputs.
8. `ENEMY_EYE_SIZE_PX` and `ENEMY_EYE_GAP_PX` are positive integers, so the marker stays small and integer-aligned (FR-018).
9. `playerGlowStrengthAt` is `1` at the light's centre, `0` at or beyond `PLAYER_LIGHT_RADIUS_PX`, and monotonically decreasing between (FR-023/FR-024).
