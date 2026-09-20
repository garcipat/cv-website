# Phase 1 Data Model: Platformer Bouncy Mushroom Blocks

This feature adds two stateless `TileType` members, one pure query and one
piece of per-cell transient state (the cap squash). Everything else — the art
role, standability, the bounce and the dip — is **derived** from the terrain
grid, the player position and the squash list.

## Entity: `bouncyMushroom` (a `TileType`)

The red bouncy mushroom. A value in `LevelDef.terrain`, not an entity; it has
no identity and no per-instance state of its own.

| Field | Type | Rules |
| --- | --- | --- |
| tile | `'bouncyMushroom'` | Placed by the level character `§` (`TERRAIN_CHARS`). |
| solid | `false` | `isSolid`/`isSolidExcludingBridge` return false — passable from the side and from below (FR-004). |
| climbable | `false` | `isClimbable` returns false. |
| standable | top cap only, open sky only | `isStandableMushroomCap(level, col, row)` — see below. |
| art role | derived | `verticalRunRole(level, col, row, 'bouncyMushroom')` → `only`/`top`/`middle`/`bottom` (FR-002). |

**`isStandableMushroomCap(level, col, row)`** is true iff the cell is a
`bouncyMushroom`, the cell above is **not** a `bouncyMushroom` (it is the run's
top), and the cell above is **not** `isSolid` (FR-005/FR-006). Out-of-bounds
above resolves to `'empty'` via `tileAt`, so a top-row cap is standable.

**Validation**:
- `§` MUST appear in `TERRAIN_CHARS` and in `TileChar`; because `§` is not a
  valid JS identifier its `TERRAIN_CHARS` key is quoted (`'§'`) and its `TileChar`
  member is `| '§'`. The existing map/union sync test covers the union
  automatically.
- `bouncyMushroom` MUST NOT be a key of `ENTITY_CHARS`/`SIGN_CHARS`/
  `HAZARD_CHARS` (the module-load shared-key guard would throw).
- A cap with solid terrain directly above is **not** standable, but its art role
  is unchanged (it still renders as its run position implies) — nothing special
  happens where no landing can occur.

## Entity: `decorativeMushroom` (a `TileType`)

The small non-solid dressing mushroom. Placed by `s`.

| Field | Type | Rules |
| --- | --- | --- |
| tile | `'decorativeMushroom'` | Placed by the level character `s` (`TERRAIN_CHARS`). |
| solid | `false` | `isSolid` returns false (FR-013). |
| climbable | `false` | `isClimbable` returns false. |
| standable | `false` | Never a ground term; the character falls straight through. |
| behaviour | none | Never bounces, never awards, never changes state (FR-013). |

## Entity: `MushroomCapSquash` (the only stored state)

The transient cosmetic dip of one cap that has just bounced. One entry per
recently-bounced cap cell. Declared in `engine/MushroomSquash.ts`.

| Field | Type | Rules |
| --- | --- | --- |
| col | `number` | The cap's grid column. |
| row | `number` | The cap's grid row (the run's top cell). |
| elapsed | `number` | Seconds since the bounce; `0` on start, pruned at `>= MUSHROOM_SQUASH_DURATION_SECONDS`. |

**Lifecycle** (per game-loop tick, `playing` phase only):

```
(none) --downward cap contact--> squash{elapsed: 0}
squash --elapsed >= DURATION--> (pruned, removed)
squash --another contact on the same cap--> squash{elapsed: 0}   (restarted, not queued)
squash --resetGame() / resetGameProgress()--> (cleared)
```

- `startMushroomSquash(states, col, row)` replaces any existing entry for the
  same cell, then appends the fresh one.
- `advanceMushroomSquashes(states, dt)` advances every entry and drops those at
  or past the duration.
- `mushroomSquashDip(state)` = `MUSHROOM_SQUASH_DIP_PX · (1 − clamp(elapsed /
  MUSHROOM_SQUASH_DURATION_SECONDS, 0, 1))`, in **rendered** pixels.
- The squash never affects collision, standability or bounce strength (FR-011).

## Entity: `CapContact` (derived, not stored)

The cap the player is standing on this tick, or nothing.

| Field | Type | Rules |
| --- | --- | --- |
| col | `number` | The player's centre column: `floor((x + PLAYER_RENDERED_SIZE / 2) / RENDERED_TILE_SIZE)`. |
| row | `number` | The player's feet row: `floor((y + PLAYER_RENDERED_SIZE − PLAYER_FOOT_PADDING) / RENDERED_TILE_SIZE)`. |

`playerOnMushroomCap(level, player)` returns this only when `player.grounded`
and `isStandableMushroomCap(level, col, row)`; otherwise `null`. Because the
caller immediately launches the player, `grounded` is true for exactly the
contact tick.

## Derived values and their consumers

| Value | Derived from | Consumer |
| --- | --- | --- |
| Art role | `verticalRunRole` over `bouncyMushroom` cells | `Renderer.ts` |
| Standability / one-way ground | `isStandableMushroomCap` | `Physics.ts` ground scan |
| Cap contact | `playerOnMushroomCap` | `PlatformerPage.tsx` |
| Bounce impulse | `PHYSICS_CONFIG.mushroomBounceVelocity` (`-650`) | `PlatformerPage.tsx`, via `strongerBounce` |
| Cap dip | `mushroomSquashDipAt(mushroomSquashStates, col, row)` | `Renderer.ts` |

## Constants (single source of truth)

`engine/PhysicsConfig.ts`:

| Constant | Value | Meaning |
| --- | --- | --- |
| `mushroomBounceVelocity` | `-650` px/s | Dedicated super-jump; peak ≈ 176 px ≈ 5.5 tiles at gravity 1200 (FR-007). |

`engine/MushroomSquash.ts`:

| Constant | Value (tunable) | Meaning |
| --- | --- | --- |
| `MUSHROOM_SQUASH_DURATION_SECONDS` | `0.1` | How long the cap takes to return (FR-010). |
| `MUSHROOM_SQUASH_DIP_PX` | `2` (rendered px) | Maximum downward offset of the cap. |

`engine/StaticObjectsCatalog.ts`:

| Constant | Value | Meaning |
| --- | --- | --- |
| `MUSHROOM_CAP_SOURCE_HEIGHT` | `11` native px | The cap rows of an `only`/`top` cell; the stem is rows 11–15. |

## Sprite mapping (`public/sprites/mushroom.png`, red row)

| Role | `sx` | `sy` | Cell contents |
| --- | --- | --- | --- |
| `only` | 0 | 0 | complete mushroom (cap, stem, foot) |
| `top` | 16 | 0 | cap + straight stem connector |
| `middle` | 48 | 0 | plain straight stem |
| `bottom` | 48 | 16 | stem + foot |
| decorative | 32 | 0 | small complete mushroom |

## Relationships

```
LevelDef.terrain[][] ──(char '§')──▶ bouncyMushroom ──▶ verticalRunRole ──▶ art cell
        │                                    │
        │                                    └──▶ isStandableMushroomCap ──▶ Physics ground term
        │                                                                        │
        │                                                        playerOnMushroomCap (post-physics)
        │                                                                        │
        │                              PHYSICS_CONFIG.mushroomBounceVelocity ────┤
        │                                                                        ▼
        │                                                     next.vy (strongerBounce with pots)
        │                                                                        │
        │                              startMushroomSquash ──▶ mushroomSquashStates (signal)
        │                                                                        │
        └──(char 's')──▶ decorativeMushroom                              mushroomSquashDipAt
                                                                                 │
                                                                                 ▼
                                                                     drawTerrain mushroom branch
```
