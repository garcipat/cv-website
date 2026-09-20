# Contract: `engine/PlacedBomb.ts` (pure fuse + fall module)

A **pure, canvas-free, DOM-free** module — mirroring `engine/DeployableLadder.ts`
and `level/Terrain.ts` — so it is fully unit-testable with Vitest (constitution
Principle II; [docs/TestingGuide.md](../../../docs/TestingGuide.md)). It imports
only types, tile predicates and block-occupancy helpers; never React, canvas or
signals.

## Types

```ts
import type { LevelDef } from '../level/LevelData';
import type { BlockPlacement } from '../level/BlockMapper';

export interface PlacedBombState {
  id: string;                 // `bomb-${col}-${row}-${seq}`
  x: number;                  // world px, tile top-left
  y: number;                  // world px, current (falls under gravity)
  vy: number;                 // px/s, positive down
  col: number;
  row: number;
  landingRow: number | null;  // resting row, or null when the column has no floor
  fuseElapsed: number;        // seconds; advances even while falling
  landed: boolean;
}

export interface BombFrame {
  frame: number;              // bomb.png frame index, 1..5
  scale: number;              // 1, or BOMB_PULSE_SCALE on the orange frame
}
```

## Exported constants

- `BOMB_FUSE_SECONDS: number` — `2`.
- `BOMB_GRAVITY: number` — falling acceleration (px/s²); reuse the physics config
  value if a suitable one exists, else a local constant.
- `BOMB_TERMINAL_VELOCITY: number` — falling speed cap.
- `BOMB_PULSE_SCALE: number` — `1.25`.
- `BOMB_FUSE_SEQUENCE: readonly number[]` — `[1, 2, 3, 4, 5, 4, 5, 4, 5]`.

## Functions

### `bombLandingRow(level, blocks, col, row): number | null`

- Scans `r` from `row + 1` while `r < level.height`; the first row whose cell is
  solid for a bomb is the floor.
- Solid for a bomb: `isSolid(tileAt(level, col, r)) || isBlockOccupied(blocks, col, r)`.
  `isSolid` includes `bridge` (so a bridge stops a bomb); `ladder` is not solid
  and `isStandableLadderTop` is **not** consulted (so a ladder tile is open air).
- Returns `r - 1` (the resting row; equals `row` when the cell directly below is
  solid).
- Returns `null` when no floor exists before the level's bottom.
- Never throws; out-of-bounds reads via `tileAt` resolve to `'empty'`.

### `createPlacedBomb(id, level, blocks, col, row): PlacedBombState`

- Returns a bomb at `tileToPixel(col, row)` with `vy: 0`, `landed: false`,
  `fuseElapsed: 0`, and `landingRow: bombLandingRow(...)`.
- Pure; called once when the bomb is placed.

### `stepPlacedBomb(state, level, blocks, dt): PlacedBombState`

- Always advances `fuseElapsed += dt` (the fuse keeps ticking while falling,
  FR-015).
- If `landingRow !== null` and not yet landed: apply gravity to `vy`
  (`min(vy + BOMB_GRAVITY * dt, BOMB_TERMINAL_VELOCITY)`), advance `y`; when the
  bomb reaches the resting surface's top edge, snap `y` and set
  `vy = 0, landed = true`.
- If `landingRow === null`: keep falling (no snap). The caller removes the bomb
  once its bottom passes the level's bottom (`checkBombFellOut`).
- `dt <= 0` returns `state` unchanged.
- Never mutates its input.

### `checkBombFellOut(state, level): boolean`

- True when the bomb's bottom edge is below `level.height * RENDERED_TILE_SIZE`.
- Only meaningful when `landingRow === null`; the caller removes the bomb and
  does **not** explode it (FR-015).

### `bombFuseFrame(fuseElapsed): BombFrame`

- `progress = clamp(fuseElapsed / BOMB_FUSE_SECONDS, 0, 1)`.
- `index = min(floor(progress * BOMB_FUSE_SEQUENCE.length), BOMB_FUSE_SEQUENCE.length - 1)`.
- `frame = BOMB_FUSE_SEQUENCE[index]`.
- `scale = frame === 5 ? BOMB_PULSE_SCALE : 1`.
- `bombFuseFrame(0)` → frame `1`; the final segment's frame is `5` (FR-017).

### `hasDetonated(state): boolean`

- `state.fuseElapsed >= BOMB_FUSE_SECONDS` (FR-016). The caller detonates exactly
  once and removes the bomb.

## Invariants (asserted by `PlacedBomb.test.ts`)

1. `bombLandingRow` treats `bridge` as a floor and `ladder` as open air.
2. `landingRow === row` exactly when the cell directly below is solid, and
   `null` exactly when the column has no floor.
3. A falling bomb's `y` is monotonically non-decreasing and never passes its
   resting surface; once landed it stays put.
4. `fuseElapsed` advances by exactly `dt` on every step, landed or not.
5. `bombFuseFrame` never returns frame 0, always returns frame 5 in the final
   segment, and only ever scales frame 5.
6. `hasDetonated` is false before `BOMB_FUSE_SECONDS` and true at/after it.
7. No function mutates its arguments and none throws on integer inputs.
