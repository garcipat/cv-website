# Contract: `engine/AmbientClouds.ts`

The pure, canvas-light module that owns the ambient cloud layer. It has **no
React and no signal dependency**; the only DOM type it touches is the 2D context
in its single draw function. All geometry is in screen-space rendered pixels.

## Types

```ts
export interface CloudSourceRect {
  readonly sx: number;
  readonly sy: number;
  readonly width: number;
  readonly height: number;
}

export interface AmbientCloud {
  shapeIndex: number;
  lane: number;
  x: number;      // left edge, screen-space rendered px
  y: number;      // top edge, screen-space rendered px
  speed: number;  // rendered px per second, positive (moves right → left)
}

export interface CloudField {
  readonly clouds: readonly AmbientCloud[];
  readonly rngState: number;
  readonly playAreaWidth: number;
  readonly skyTop: number;
  readonly openSkyBottom: number; // open-sky bottom = painted clouds band's top (≠ BackgroundBandGeometry.skyBottom)
}
```

## Constants

- `AMBIENT_CLOUD_SOURCE_RECTS: readonly CloudSourceRect[]` — the four authored
  shapes, addressed by explicit rect (the sheet is not a uniform frame grid).
- `CLOUD_SPACING_PX`, `MIN_CLOUD_COUNT` — population density and floor.
- `CLOUD_MIN_SPEED_PX_PER_SEC`, `CLOUD_MAX_SPEED_PX_PER_SEC` — drift-speed range.
- `CLOUD_RESPAWN_JITTER_PX` — re-entry offset range.
- `AMBIENT_CLOUD_PARALLAX_FACTOR` — fraction of the camera's x the layer follows at draw
  time, on top of each cloud's own drift; matches the painted clouds/hills band's factor.
- `AMBIENT_CLOUD_SEED` — default PRNG seed.
- `MIN_SHAPE_HEIGHT` — derived as
  `Math.min(...AMBIENT_CLOUD_SOURCE_RECTS.map(r => r.height))` (16 native px); the
  FR-013 fit threshold.

## `cloudPopulationFor(playAreaWidth): number`

- Returns `Math.max(MIN_CLOUD_COUNT, Math.round(playAreaWidth / CLOUD_SPACING_PX))`.
- Monotonically non-decreasing in `playAreaWidth`; never below `MIN_CLOUD_COUNT`
  (FR-015, SC-007).

## `createCloudField(playAreaWidth, skyTop, openSkyBottom, seed?): CloudField`

- Population = `cloudPopulationFor(playAreaWidth)`.
- Assigns each cloud its own **lane** (`0 … population-1`) so no two share a
  vertical line (FR-003), and an initial shape (cycling the four shapes) so more
  than one silhouette is present (FR-005, SC-002).
- Seeds each initial speed across `[MIN, MAX]` so at least three distinct speeds
  appear at the default population (SC-002).
- Spreads initial `x` across `[-maxShapeWidth, playAreaWidth)` so the sky is
  populated immediately (FR-006); later passes always cross an edge (FR-008).
- Computes each `y` from its lane's bottom and the shape's rendered height,
  clamped inside `[skyTop, openSkyBottom]` (FR-010).
- Returns an **empty** field (no clouds) when `openSkyBottom - skyTop` is smaller
  than the shortest shape's rendered height (FR-013).
- `seed` defaults to `AMBIENT_CLOUD_SEED`; passing the same seed and inputs
  yields an equal field (reproducible session — spec Assumption).

## `stepCloudField(field, dtSeconds, reducedMotion): CloudField`

- When `reducedMotion` is `true`, returns `field` unchanged (FR-014).
- Otherwise moves every cloud `x -= speed * dtSeconds` (right → left, FR-002).
- A cloud whose `x + renderedWidth < 0` respawns at the right edge:
  `x = playAreaWidth + rng * CLOUD_RESPAWN_JITTER_PX`, with a **new** speed and a
  **different** shape index, and `y` re-fit to the new shape's height (FR-005,
  FR-006, FR-007, FR-008).
- Never reads or receives a camera position — the drift itself is camera-independent
  (FR-002). The camera-linked parallax shift is a separate, draw-time concern.
- Pure: returns a new field; does not mutate the input.

## `drawAmbientClouds(ctx, image, field, cameraX): void`

- Returns immediately when `image` is `null` (FR-012) or `field.clouds` is empty
  (FR-013).
- Sets `ctx.imageSmoothingEnabled = false`.
- For each cloud, draws its source rect into
  `(Math.round(cloud.x - cameraX × AMBIENT_CLOUD_PARALLAX_FACTOR), cloud.y, width × BACKGROUND_RENDER_SCALE, height × BACKGROUND_RENDER_SCALE)`
  (FR-002, FR-004, FR-009).
- Applies the camera-linked parallax shift at the painted clouds/hills band's factor, so
  the layer reads at that band's depth while still carrying its own drift (FR-002).
- Does not touch HUD/UI, terrain, entities or the background tile layer — those
  are drawn after it by the caller (FR-011).
