# Phase 1 Data Model: Platformer Cave Lighting

This feature stores almost no new state. Darkness and both light-driven
visuals are **derived** from existing data (the level's background placements,
its `torch` terrain tiles, the player position, and the living-enemy list) plus
one eased scalar. That mirrors the spec's Key Entities, which are all
"derived, not stored".

## Entity: `BackgroundPieceFamily`

The intrinsic family of a background piece — the single fact that decides
whether a piece darkens the view.

| Field | Type | Rules |
| --- | --- | --- |
| family | `'surface' \| 'cave'` | Required on every catalog entry. `dirt*` pieces are `'surface'`; `charcoal*` pieces are `'cave'`. |

**Relationships**: One `BackgroundCatalogEntry` (existing) gains exactly one
`family`. A `BackgroundPlacement` inherits its family from its `pieceId`'s
catalog entry; there is no per-placement flag (FR-001, FR-021).

**Validation**:
- Every entry in `BACKGROUND_CATALOG` MUST declare a family; the catalog test
  asserts dirt → surface and charcoal → cave for all ten pieces.
- `backgroundPieceFamily(pieceId)` MUST return `undefined` for an unknown id
  rather than throw (matching `backgroundCatalogEntry`'s stale-id contract).

## Entity: `DarkeningPiece` (derived)

A background placement whose family is `'cave'`. Not stored separately.

| Field | Type | Rules |
| --- | --- | --- |
| pieceId | `BackgroundPieceId` | Must resolve to a catalog entry. |
| col / row | `number` | Anchor (top-left) cell. |
| widthTiles / heightTiles | `number` | Footprint, read from the catalog. |
| family | `'cave'` | Derived; a placement is a darkening piece iff its entry's family is `'cave'`. |

**Validation / invariants**:
- A cell `(col, row)` is darkening iff **any** cave placement's footprint
  contains it. The result is a boolean, so overlapping cave pieces never
  compound (FR-007).
- An unknown/stale `pieceId` contributes no footprint (never throws), matching
  `paintBackgroundCell.ts` and `drawBackgroundTiles`.

## Entity: `DarknessLevel`

A single world scalar describing how dark the view currently is. The only new
stored value.

| Field | Type | Rules |
| --- | --- | --- |
| darknessLevel | `number` (signal) | `0 … MAX_DARKNESS` (≈ 0.85). 0 = fully bright. |

**State transitions** (per game-loop tick, `playing` phase only):

```
const cell = playerOccupiedCell(player)
target = isCellDarkening(background, cell.col, cell.row) ? MAX_DARKNESS : 0
darknessLevel = nextDarknessLevel(darknessLevel, target, dt, DARKNESS_FADE_SECONDS)
```

- The transition is a linear move-toward-target completing in
  `DARKNESS_FADE_SECONDS` (≈ 0.4 s) — gradual, never an instant snap (FR-003).
- On `resetGame()` the value is set to 0 (a respawn must not begin under a
  stale dark overlay).
- The tick does not run during `paused` / `dying` / `awaitingRestart` /
  `ending-screen`, so the value freezes with the world.

**Derived reads**:
- The render pass reads it to size the overlay alpha.
- `localDarknessAt` reads it as the base from which torch light is subtracted.

## Entity: `TorchLightSource` (derived)

One per `torch` terrain tile in the level. Not stored as a separate authorable
list.

| Field | Type | Rules |
| --- | --- | --- |
| col / row | `number` | Grid cell of the `torch` tile. |
| x / y | `number` | World-space centre (`tileToPixel`). |
| phase | `number` | Deterministic per-cell phase (`torchPhase`), reused for the pulse. |

**Validation / invariants**:
- Discovery mirrors every other placement kind: `findTorchTiles` →
  `TORCH_TILES` computed → `torchPositions` computed.
- Zero torches is valid: a cave with none still darkens but stays faintly
  readable (FR-005, spec Edge Case).

## Entity: `EnemyEyeMarker` (derived, no stored state)

A visual attached to a living enemy while that enemy's own position is dark.

| Field | Type | Rules |
| --- | --- | --- |
| enemyId | `string` | Identity only; never stored on the marker. |
| x / y | `number` | Derived from the enemy's collision box / effect anchor each frame. |
| opacity | `number` | `0 … 1`, from `enemyEyeOpacity(localDarknessAt(enemy))`. |

**Validation / invariants**:
- Drawn only for enemies with `alive === true` (FR-017); a defeated/removed
  enemy shows nothing.
- Opacity is 0 at/below `ENEMY_EYE_DARKNESS_THRESHOLD` and rises to 1 as local
  darkness increases (FR-015, FR-016), so an enemy inside a torch pool renders
  normally with no marker.
- The marker never obscures the normal sprite at full brightness because its
  opacity is 0 there (FR-018, SC-005).

## Relationships

```
BackgroundCatalogEntry 1 ─── 1 family
        ▲
        │ pieceId
BackgroundPlacement ──(cave)──▶ DarkeningPiece ──▶ isCellDarkening(cell)
                                                          │
playerOccupiedCell(player) ───────────────────────────────┴──▶ darknessLevel (signal)
                                                                     │
TorchLightSource[] ───────────────────────────────▶ localDarknessAt(x, y) ──▶ enemyEyeOpacity
                                                                     │
                                                          render overlay + warm glow
                                                                     │
                                                            EnemyEyeMarker (drawn pass)
```

## Constants (single source of truth, `engine/Lighting.ts`)

| Constant | Value (tunable) | Meaning |
| --- | --- | --- |
| `MAX_DARKNESS` | ≈ 0.85 | Brightness floor; playability wins over mood (FR-005). |
| `DARKNESS_FADE_SECONDS` | ≈ 0.4 | Enter/exit fade duration (FR-003, SC-001). |
| `TORCH_LIGHT_RADIUS_PX` | ≈ 2.5 × `RENDERED_TILE_SIZE` | Soft glow radius in rendered pixels (FR-009). |
| `TORCH_PULSE_AMPLITUDE` | ≈ 0.06 | Pulse depth (FR-013, SC-007). |
| `TORCH_GLOW_COLOR` | warm orange/gold | Distinct from the neutral darkness (FR-014). |
| `ENEMY_EYE_DARKNESS_THRESHOLD` | ≈ 0.25 | Below this, no eye marker (FR-015). |
| `ENEMY_EYE_FADE_RANGE` | ≈ 0.25 | Width of the fade band above the threshold (FR-016). |
| `ENEMY_EYE_COLOR` | glowing yellow | Eye marker colour (FR-015). |
| `ENEMY_EYE_SIZE_PX` | ≈ 2 | Eye square size in rendered pixels (FR-018). |
| `ENEMY_EYE_GAP_PX` | ≈ 3 | Centre-to-centre gap between the two eyes (FR-018). |
