# Contract: terrain types, predicates and the runtime override

This contract covers the tile-level surface in
`src/themes/platformer/level/`: the two new `TileType` members, the predicate
changes, and the effective-grid override. It is the "how a tile's runtime
override is resolved" knowledge the spec's Key Entities section points at, and
must be reflected in
[docs/themes/platformer/Terrain.md](../../../docs/themes/platformer/Terrain.md)
and [docs/themes/platformer/LevelFormat.md](../../../docs/themes/platformer/LevelFormat.md).

## `level/LevelData.ts`

```ts
export type TileType =
  | /* …existing members… */
  | 'ladderBundle'  // NEW
  | 'ropeLadder';   // NEW
```

- `'ladderBundle'` — the author-placeable rolled bundle. Non-solid, not
  climbable, standable from above only.
- `'ropeLadder'` — one deployed rung cell. Non-solid, climbable. Never
  author-placeable; produced only by `applyDeployedLadders`.

## `level/LevelParser.ts`

```ts
// TERRAIN_CHARS gains:
'@': 'ladderBundle',

// TileChar gains:
| '@'

export function findLadderBundleTiles(
  layout: readonly string[],
): { col: number; row: number }[];
```

- `'ropeLadder'` is deliberately **absent** from `TERRAIN_CHARS` and
  `TileChar`: a level file must never contain it.
- `findLadderBundleTiles` scans for `TERRAIN_CHARS[char] === 'ladderBundle'`,
  the same shape as `findTorchTiles`.
- The existing test asserting every map key appears in `TileChar` covers `@`
  automatically.

## `level/Terrain.ts`

```ts
export function isClimbable(tile: TileType): boolean;
// true for 'ladder' | 'chain' | 'ropeLadder'

export function isStandableLadderBundleTop(
  level: LevelDef,
  col: number,
  row: number,
): boolean;
// true iff tileAt(level, col, row) === 'ladderBundle'
```

- `'ropeLadder'` is added to `isClimbable`, so every existing consumer
  (`isStandableLadderTop`, the climb branch in `Physics.ts`) treats a deployed
  rung exactly like an authored `ladder`/`chain` — no new climbing code.
- `isStandableLadderBundleTop` is deliberately unconditional on the cell above:
  FR-002/FR-009 make a rolled bundle standable from above at all times,
  including mid-unroll. (Once deployed, the effective grid replaces the cell
  with `ropeLadder` and the usual `isStandableLadderTop` blocked-top rule
  applies, per the spec Edge Case.)
- `isSolid`/`isSolidExcludingBridge` are unchanged: neither new type is solid.

## `engine/Physics.ts`

`columnIsGround` in the landing branch gains one term, mirroring
`isStandableLadderTop`:

```ts
const columnIsGround = (col: number): boolean =>
  groundIsSolid(tileAt(level, col, footRow)) ||
  isStandableLadderTop(level, col, footRow) ||
  isStandableLadderBundleTop(level, col, footRow) ||   // NEW
  isBlockOccupied(blockPlacements, col, footRow);
```

- No other physics change: the climb entry/exit code already goes through
  `isClimbable`/`isStandableLadderTop`, so a `ropeLadder` shaft climbs for free.
- The `level` passed in is the effective level (see below), so a rolled bundle
  remains `ladderBundle` (standable, not climbable) and a deployed shaft is
  `ropeLadder` (climbable).

## `engine/DeployableLadder.ts` — the override

`applyDeployedLadders(level, states): LevelDef` is specified in
[deployable-ladder.md](./deployable-ladder.md). Its contract, restated at the
terrain layer:

- The raw `LevelDef` is never mutated; a new object is returned only when at
  least one bundle is `deployed`.
- Every cell of a deployed shaft becomes `'ropeLadder'`, including the bundle
  cell itself (the shaft's top rung).
- Because the override is applied to the level handed to `stepPlayerPhysics`
  only, the renderer and every other subsystem keep reading the raw grid.

## `PlatformerState.ts` wiring

```ts
export const deployableLadderPlacements: Computed<DeployableLadderState[]>;
export const deployableLadderStates: Signal<DeployableLadderState[]>;
export const activeLevel: Computed<LevelDef>;   // applyDeployedLadders(currentLevel, states)
export function tickDeployableLadders(dt: number): void;
```

- `deployableLadderStates` is seeded once from `deployableLadderPlacements`,
  following `checkpointPlacements`/`checkpointStates`.
- `tickDeployableLadders(dt)` maps every state through
  `advanceDeployableLadder`; it is called only in the `playing` phase, so the
  unroll freezes with the world while paused/dying.
- `resetGame()` leaves `deployableLadderStates` untouched (FR-013).
- `resetGameProgress()` sets it back to `deployableLadderPlacements.value`
  (FR-013; same lifetime as blocks/chests — see research D3).

## Tests

- `level/LevelParser.test.ts` — `@` maps to `ladderBundle`; `findLadderBundleTiles`
  finds every `@`; `ropeLadder` is not a `TileChar`.
- `level/Terrain.test.ts` — `isClimbable('ropeLadder')`; `isClimbable('ladderBundle')`
  is false; `isStandableLadderBundleTop` is true for the bundle and false for
  every other type.
- `engine/Physics.test.ts` — a player lands and stands on a rolled bundle; the
  bundle is not climbable while rolled; a deployed `ropeLadder` shaft climbs and
  its top is standable; a partial shaft is not climbable.
- `PlatformerState.test.ts` — states seed from `@` cells, `resetGame` preserves
  them, `resetGameProgress` rolls them back.
