# Contract: `engine/DeployableLadder.ts` (pure deployment module)

The deployment math and state are a **pure, canvas-free, DOM-free module** —
mirroring `engine/Torch.ts`, `engine/Lighting.ts` and `level/Terrain.ts` — so it
is fully unit-testable with Vitest (constitution Principle II;
[docs/TestingGuide.md](../../../docs/TestingGuide.md)). It imports only types,
tile predicates and the player geometry constants; never React, canvas or
signals.

## Types

```ts
import type { LevelDef } from '../level/LevelData';

export type DeployableLadderPhase = 'rolled' | 'deploying' | 'deployed';

export interface DeployableLadderState {
  id: string;                 // `ladder-bundle-${col}-${row}`
  col: number;
  row: number;
  landRow: number;            // >= row
  phase: DeployableLadderPhase;
  elapsed: number;            // seconds; 0 while rolled, capped at UNROLL_SECONDS
}
```

## Exported constants

- `UNROLL_SECONDS: number` — `0.5`.
- `LADDER_STEP_NATIVE_PX: number` — `8`.
- `STEPS_PER_TILE: number` — `2`.

## Functions

### `ladderLandingRow(level: LevelDef, col: number, row: number): number`

- Returns the lowest row a bundle at `(col, row)` unrolls to: scan `r` from
  `row + 1` while `r < level.height` and `!isSolid(tileAt(level, col, r))`,
  returning the last such `r`; if none, returns `row`.
- `isSolid` includes `bridge`, so a bridge stops the unroll (FR-005).
- A bundle on the level's bottom row returns `row` (FR-010).
- Never throws for any in-bounds `col`/`row`; out-of-bounds reads via `tileAt`
  resolve to `'empty'`, but the loop is bounded by `level.height` regardless.

### `createDeployableLadderState(level: LevelDef, col: number, row: number): DeployableLadderState`

- Returns `{ id: 'ladder-bundle-${col}-${row}', col, row, landRow:
  ladderLandingRow(level, col, row), phase: 'rolled', elapsed: 0 }`.
- Pure; called once per `@` cell when the state array is seeded/rebuilt.

### `beginDeploy(state: DeployableLadderState): DeployableLadderState`

- If `state.phase !== 'rolled'`, returns `state` unchanged (idempotent).
- Otherwise returns `{ ...state, phase: 'deploying', elapsed: 0 }`.

### `advanceDeployableLadder(state: DeployableLadderState, dt: number): DeployableLadderState`

- If `state.phase !== 'deploying'`, returns `state` unchanged.
- Otherwise advances `elapsed` by `dt`; if `elapsed >= UNROLL_SECONDS` returns
  `{ ...state, phase: 'deployed', elapsed: UNROLL_SECONDS }`, else returns the
  advanced state.
- `dt <= 0` returns `state` unchanged.
- One-way: never returns to `rolled`/`deploying` from `deployed`.

### `shaftCellCount(state: DeployableLadderState): number`

- `state.landRow - state.row` — the number of rung cells **below** the bundle
  cell (0 for a zero-length landing). The bundle cell itself is always rung one.

### `totalStepCount(state: DeployableLadderState): number`

- `shaftCellCount(state) * STEPS_PER_TILE`.

### `revealedStepCount(state: DeployableLadderState): number`

- `deployed` → `totalStepCount(state)`.
- `rolled` → `0`.
- `deploying` → `floor(totalStepCount(state) * clamp(elapsed / UNROLL_SECONDS, 0, 1))`.
- Never exceeds `totalStepCount`; never negative.

### `ladderBundleForPlayer(level: LevelDef, states: readonly DeployableLadderState[], player: PlayerState): DeployableLadderState | null`

- Returns the first `rolled` bundle such that:
  - `player.grounded` is true, **and**
  - `bundle.col` is within the player's hitbox columns
    (`floor((player.x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE)` …
    `floor((player.x + PLAYER_RENDERED_SIZE - PLAYER_SIDE_PADDING - 1) /
    RENDERED_TILE_SIZE)`), **and**
  - `bundle.row === feetRow || bundle.row === feetRow - 1`, where `feetRow =
    floor((player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING) /
    RENDERED_TILE_SIZE)` — the same feet row `Physics.ts` uses (`footRow`), so
    standing on the bundle (`bundle.row === feetRow`) and standing in the
    bundle's own cell (`bundle.row === feetRow - 1`) both match.
- Returns `null` when no such bundle exists; never throws.

### `applyDeployedLadders(level: LevelDef, states: readonly DeployableLadderState[]): LevelDef`

- Filters to `deployed` states. If there are none, returns `level` **unchanged**
  (same object identity).
- Otherwise returns a new `LevelDef` (`{ ...level, terrain }`) whose `terrain`
  is a row-wise shallow copy of `level.terrain`, with `'ropeLadder'` written
  into every cell from `state.row` to `state.landRow` at `state.col`.
- Never mutates `level` or any state entry.

## Invariants (asserted by `DeployableLadder.test.ts`)

1. `applyDeployedLadders` returns the identical `level` object when no state is
   deployed, and never mutates its input.
2. `landRow >= row` always; `landRow === row` exactly when the cell below is
   solid (including `bridge`) or `row` is the bottom row.
3. The unroll never completes before `UNROLL_SECONDS` and is always `deployed`
   at or after it, for any shaft length.
4. `revealedStepCount` is monotonically non-decreasing while `deploying`, `0`
   while `rolled`, and `totalStepCount` once `deployed`.
5. `beginDeploy` and `advanceDeployableLadder` are idempotent for states already
   past their input phase, and the lifecycle is strictly one-way.
6. `ladderBundleForPlayer` returns `null` whenever the player is airborne, off
   the bundle's column, or more than one row from it, and never returns a
   non-`rolled` bundle.
7. No function mutates its arguments and none throws on integer inputs.
