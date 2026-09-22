# Phase 1 Data Model: Ambient Background Clouds

This feature stores almost nothing. The cloud field is a small, loop-local value
built from engine constants plus a seeded PRNG; the sky region is **derived** from
the backdrop's own band geometry. That mirrors the spec's Key Entities, which are
all "derived, not stored".

## Entity: `CloudSourceRect`

One authored cloud silhouette within `public/sprites/ambient_clouds.png` (185×32).

| Field | Type | Rules |
| --- | --- | --- |
| sx / sy | `number` | Top-left of the shape's opaque bounds in the sheet. |
| width / height | `number` | Native (unscaled) shape size. Four shapes: 33×16, 43×20, 43×20, 42×32. |

**Relationships**: A `CloudSourceRect` is one entry in the exported
`AMBIENT_CLOUD_SOURCE_RECTS` tuple; every `AmbientCloud.shapeIndex` addresses it.

**Validation / invariants**:
- All four shapes are bottom-aligned at sheet row 31; shape heights differ, so a
  respawn must re-fit the new shape's height inside its lane.
- `shapeIndex` is always in `[0, AMBIENT_CLOUD_SOURCE_RECTS.length)`.

## Entity: `AmbientCloud`

One drifting cloud instance — the spec's "Ambient cloud".

| Field | Type | Rules |
| --- | --- | --- |
| shapeIndex | `number` | Index into `AMBIENT_CLOUD_SOURCE_RECTS` (FR-005). |
| lane | `number` | Vertical slot, `[0, population)`; distinct per cloud, so no two sit on the same line (FR-003). |
| x | `number` | Current left edge in screen-space rendered px; drifts right→left (FR-002). |
| speed | `number` | Rendered px per second, drawn from `[CLOUD_MIN_SPEED_PX_PER_SEC, CLOUD_MAX_SPEED_PX_PER_SEC]` (FR-003). |
| y | `number` | Top edge in screen-space rendered px, derived from `lane`, the region, and the shape's rendered height. |

**Derived reads**:
- `renderedWidth = shape.width × BACKGROUND_RENDER_SCALE`
- `renderedHeight = shape.height × BACKGROUND_RENDER_SCALE`
- `destX = Math.round(x - cameraX × AMBIENT_CLOUD_PARALLAX_FACTOR)` at draw time (FR-002,
  FR-009).

**Validation / invariants**:
- `y >= skyTop` and `y + renderedHeight <= openSkyBottom` (FR-010).
- The cloud is off-screen exactly when `x + renderedWidth < 0`, which is the
  respawn trigger.

## Entity: `CloudField`

The whole ambient layer's state — the only stored value this feature adds. Held as
a loop-local `let` in `PlatformerPage.tsx`, never a signal.

| Field | Type | Rules |
| --- | --- | --- |
| clouds | `readonly AmbientCloud[]` | Population is `cloudPopulationFor(playAreaWidth)`; empty when the region is too short (FR-013). |
| rngState | `number` | Seeded PRNG state, advanced on each respawn (spec Assumption "Variation is seeded"). |
| playAreaWidth | `number` | Width the field was built for; drives density and the right-edge respawn x. |
| skyTop / openSkyBottom | `number` | The open sky region's edges: `BackgroundBandGeometry.skyTop` and `.cloudsTop`. `openSkyBottom` is the region's bottom (the painted clouds band's top) and is deliberately named differently from `BackgroundBandGeometry.skyBottom` (the sky image's bottom). |

**State transitions** (per game-loop tick, `playing` phase only, via
`stepCloudField`):

```
for each cloud:
    cloud.x -= cloud.speed * dt
    if cloud.x + shapeWidth*SCALE < 0:
        advance rngState -> new speed, new shape (different from previous)
        cloud.x     = playAreaWidth + rng*RESPAWN_JITTER
        cloud.shapeIndex = newShape
        cloud.y     = laneBottom(lane) - shapeHeight(newShape)*SCALE
return field with the updated clouds and rngState
```

- Under `reducedMotion === true`, `stepCloudField` returns the field unchanged —
  the clouds stay drawn but stationary (FR-014, SC-006).
- The tick does not run during `paused` / `dying` / `awaitingRestart` /
  `ending-screen`, so the field freezes with the world.
- `resize()` rebuilds the field from scratch for the new `playAreaWidth` and
  region (FR-015, SC-007).

## Entity: `SkyRegion` (derived)

The open band the clouds live in. Not stored; returned by the extracted
`backgroundBandGeometry(canvasHeight)`.

| Field | Type | Rules |
| --- | --- | --- |
| skyTop | `number` | Bottom of the HUD dark margin = `SKY_TOP_MARGIN × BACKGROUND_RENDER_SCALE`. |
| openSkyBottom | `number` | The painted clouds/hills band's top edge (exposed as `cloudsTop`); the open-sky bottom (FR-001). |
| height | `number` | `openSkyBottom - skyTop`; when `< MIN_SHAPE_HEIGHT × BACKGROUND_RENDER_SCALE` the field is empty (FR-013). |

**Validation / invariants**:
- `openSkyBottom` is exactly the `cloudsTop` `drawBackgroundLayers` uses — one source
  of truth, no duplicated band arithmetic (see [research D2](./research.md)).

## Entity: `DriftSpeed` (derived)

A cloud's own horizontal speed. Distinct from the layer's camera-linked parallax shift
(`AMBIENT_CLOUD_PARALLAX_FACTOR`) and from the backdrop bands' parallax factors. The
speed itself is never a function of the camera (FR-002); the camera only adds a separate
draw-time shift.

| Field | Type | Rules |
| --- | --- | --- |
| speed | `number` | `CLOUD_MIN_SPEED_PX_PER_SEC … CLOUD_MAX_SPEED_PX_PER_SEC`; a respawn draws a new value (FR-007). |

## Relationships

```
public/sprites/ambient_clouds.png ──▶ CloudSourceRect[4] ──┐
                                                           │ shapeIndex
BackgroundLayers.backgroundBandGeometry(canvasHeight) ──┐  │
        │ skyTop / cloudsTop (= openSkyBottom)               ▼  ▼
        └──────────────────────────────▶ createCloudField(width, skyTop, openSkyBottom, seed)
                                                           │
                                                           ▼
                                            CloudField { clouds[], rngState, playAreaWidth, skyTop, openSkyBottom }
                                                           │  stepCloudField(dt, reducedMotion)
                                                           ▼
                                            drawAmbientClouds(ctx, image, field)
                                                           │
                                             (screen-space, ×BACKGROUND_RENDER_SCALE,
                                              destX = round(x))
```

## Constants (single source of truth, `engine/AmbientClouds.ts`)

| Constant | Value (tunable) | Meaning |
| --- | --- | --- |
| `AMBIENT_CLOUD_SOURCE_RECTS` | 4 rects (see above) | The authored cloud shapes (FR-005). |
| `MIN_SHAPE_HEIGHT` | 16 (derived) | `Math.min(...AMBIENT_CLOUD_SOURCE_RECTS.map(r => r.height))` — the shortest native shape height, the FR-013 fit threshold. |
| `CLOUD_SPACING_PX` | ≈ 300 | Rendered px of play-area width per cloud (FR-015). |
| `MIN_CLOUD_COUNT` | 3 | Floor on the population, so a narrow viewport is never empty (FR-015, SC-007). |
| `CLOUD_MIN_SPEED_PX_PER_SEC` | ≈ 3 | Slowest drift; visibly moves over seconds, unrelated to the camera (FR-002/FR-003). |
| `CLOUD_MAX_SPEED_PX_PER_SEC` | ≈ 7 | Fastest drift; gives a visible spread of speeds (SC-002). |
| `CLOUD_RESPAWN_JITTER_PX` | ≈ 160 | Range of the re-entry x offset beyond the right edge (FR-007). |
| `AMBIENT_CLOUD_PARALLAX_FACTOR` | 0.2 | Fraction of the camera's x the layer follows, on top of each cloud's drift; matches the painted clouds/hills band's factor (FR-002). |
| `AMBIENT_CLOUD_SEED` | fixed constant | Default seed; makes a session's variation reproducible (spec Assumption). |

The render scale is **not** a local constant — the layer reuses
`BACKGROUND_RENDER_SCALE` from `BackgroundLayers.ts` (FR-004).
