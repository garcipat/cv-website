# Phase 1 Data Model: Platformer Deployable Ladders

This feature adds two `TileType` members and one piece of per-instance session
state (one entry per placed bundle). Everything else — the deployed shaft and
the effective terrain physics reads — is **derived** from that state plus the
existing level grid.

## Entity: `ladderBundle` (a `TileType`)

The author-placeable rolled bundle. A value in `LevelDef.terrain`, not an
entity; it has no identity of its own.

| Field | Type | Rules |
| --- | --- | --- |
| tile | `'ladderBundle'` | Placed by the level character `@` (`TERRAIN_CHARS`). |
| solid | `false` | `isSolid`/`isSolidExcludingBridge` return false. |
| climbable | `false` | `isClimbable` returns false. |
| standable | from above only | `isStandableLadderBundleTop` returns true for every bundle cell; `Physics.ts`'s ground scan treats it as ground. |

**Validation**:
- `@` MUST appear in `TERRAIN_CHARS` and in `TileChar`; the existing
  map/`TileChar` sync test covers the latter automatically.
- `ladderBundle` MUST NOT be a member of `ENTITY_CHARS`/`SIGN_CHARS`/
  `HAZARD_CHARS` (the module-load shared-key guard would throw).

## Entity: `ropeLadder` (a `TileType`)

One deployed rung cell. **Never** author-placeable: absent from
`TERRAIN_CHARS` and `TileChar`, and produced only by the runtime override.

| Field | Type | Rules |
| --- | --- | --- |
| tile | `'ropeLadder'` | Produced only by `applyDeployedLadders`. |
| solid | `false` | `isSolid` returns false. |
| climbable | `true` | `isClimbable` returns true; behaves exactly like `ladder`/`chain`. |
| standable | top rung only | `isStandableLadderTop` applies unchanged (nothing solid/climbable directly above). |

## Entity: `DeployableLadderState`

The per-bundle runtime state — the only new stored value. One entry per `@`
cell, seeded once from the layout and rebuilt only by `resetGameProgress()`.

| Field | Type | Rules |
| --- | --- | --- |
| id | `string` | Stable per cell: `ladder-bundle-${col}-${row}`. |
| col / row | `number` | The bundle's grid cell. |
| landRow | `number` | `ladderLandingRow(level, col, row)`: the lowest rung's row (`>= row`). Fixed at creation from the level's layout. |
| phase | `'rolled' \| 'deploying' \| 'deployed'` | Starts `rolled`. |
| elapsed | `number` | Seconds since the deploy began; `0` while `rolled`, capped at `UNROLL_SECONDS` once `deployed`. |

**State transitions** (per game-loop tick, `playing` phase only):

```
rolled  --Up press on/at the bundle-->  deploying (elapsed = 0)
deploying --elapsed >= UNROLL_SECONDS--> deployed
deployed --(no transition: one-way, permanent for the session)-->
```

- `resetGame()` (death/respawn) leaves the state untouched (FR-013).
- `resetGameProgress()` (Reset Game, editor Try, theme-switch mount) rebuilds
  every entry back to `rolled` (FR-013).
- Two bundles in one column are independent entries (FR-012).

**Derived reads**:
- `activeLevel` (see below) turns `deployed` entries into `ropeLadder` cells.
- `drawDeployableLadders` reads `phase` + `revealedStepCount` to draw the
  rolled bundle, the partial reveal, or the completed shaft.
- `ladderBundleForPlayer` reads only `rolled` entries for the Up trigger.

## Entity: `DeployedShaft` (derived, not stored)

The set of cells a deployed bundle makes climbable.

| Field | Type | Rules |
| --- | --- | --- |
| col | `number` | The bundle's column. |
| topRow / landRow | `number` | `topRow === row`; `landRow` as above. |
| cells | `{ col, row }[]` | Every row from `topRow` to `landRow` inclusive at `col`. |

**Validation / invariants**:
- A zero-length landing has exactly one cell (the bundle cell itself) and is
  still a valid, climbable lone rung (FR-010).
- A `bridge` below the bundle stops the shaft above it (FR-005).
- The shaft length is decided at creation by the level layout, never by the
  author (spec Key Entities).

## Entity: `EffectiveLevel` (derived `LevelDef`)

The runtime terrain override physics reads. Not stored; a `computed`.

| Field | Type | Rules |
| --- | --- | --- |
| terrain | `TileType[][]` | The raw terrain with each deployed shaft's cells replaced by `'ropeLadder'`. |
| width / height / background | unchanged | Copied from the raw `LevelDef`. |

**Validation / invariants**:
- With no `deployed` state, `applyDeployedLadders` returns the **same object**
  (identity), so no allocation and no signal churn.
- Cells outside the grid are never written; a shaft is always in bounds by
  construction.
- Overwriting a cell that held a decorative/other non-solid tile is intended:
  the override changes behaviour (adds climbability) without changing
  solidity, and rendering still draws the original art beneath the rope.
- Only `stepPlayerPhysics` consumes this; the renderer, enemies, lighting and
  camera read the raw `currentLevel`.

## Relationships

```
LevelDef.terrain[][] ──(char '@')──▶ ladderBundle
        │
        │ one per '@' cell
        ▼
deployableLadderPlacements (computed) ──▶ DeployableLadderState[] (signal)
        │                                        │
        │ Up + grounded + at/above the bundle    │ advance(dt) while deploying
        ▼                                        ▼
    beginDeploy() ───────────────────────▶ phase: rolled→deploying→deployed
                                                 │
                                                 │ deployed
                                                 ▼
                        applyDeployedLadders(level, states) ──▶ EffectiveLevel
                                                 │                 │
                                                 │                 ▼
                                                 │        stepPlayerPhysics (ropeLadder)
                                                 ▼
                                     drawDeployableLadders (rolled / steps / caps)
```

## Constants (single source of truth, `engine/DeployableLadder.ts`)

| Constant | Value (tunable) | Meaning |
| --- | --- | --- |
| `UNROLL_SECONDS` | `0.5` | Fixed deploy duration, any shaft length (FR-004, SC-004). |
| `LADDER_STEP_NATIVE_PX` | `8` | Native height of one reveal step; a 16 px tile is two steps. |
| `STEPS_PER_TILE` | `2` | `TILE_SIZE / LADDER_STEP_NATIVE_PX`. |

Sprite rects (single source of truth, `engine/StaticObjectsCatalog.ts`):

| Constant | Rect (native px) | Meaning |
| --- | --- | --- |
| `ROPE_BUNDLE` | (0, 0, 16×16) | Rolled bundle, shown while rolled/deploying. |
| `ROPE_TOP_CAP` | (16, 0, 16×8) | Deployed top cap at the bundle cell. |
| `ROPE_STEP` | (16, 8, 16×8) | The repeat unit; two per rung cell. |
| `ROPE_BOTTOM_CAP` | (16, 24, 16×8) | The shaft's lowest 8 px. |
