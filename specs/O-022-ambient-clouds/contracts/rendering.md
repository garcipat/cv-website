# Contract: backdrop geometry + render order

## `backgroundBandGeometry(canvasHeight): BackgroundBandGeometry` (`engine/BackgroundLayers.ts`)

A behaviour-preserving extraction of the band arithmetic already inside
`drawBackgroundLayers`, so the backdrop and the ambient layer share one source of
truth.

```ts
export interface BackgroundBandGeometry {
  skyTop: number;        // bottom of the HUD dark margin
  skyBottom: number;     // bottom of the sky image
  cloudsTop: number;     // top of the painted clouds/hills band
  cloudsBottom: number;
  villageTop: number;
  villageBottom: number;
}
```

- Returns the same y values `drawBackgroundLayers` computes today; the function
  is refactored to consume it, and the existing `BackgroundLayers.test.ts`
  assertions must remain green.
- Depends only on `canvasHeight` (the bands are bottom-anchored or top-anchored;
  none of them depends on the canvas width).

## Ambient layer's region

- The ambient layer's open sky region is **`[geometry.skyTop, geometry.cloudsTop]`**
  — the flat sky area above the painted clouds/hills band.
- `skyTop` excludes the HUD's dark-blue top margin, which is not sky (see
  [research D2](../research.md)).
- If `cloudsTop - skyTop` cannot fit the shortest shape at
  `BACKGROUND_RENDER_SCALE`, the field is empty and nothing is drawn (FR-013).

## Render order contract

Inside `PlatformerPage.tsx`'s `render()`, immediately after the
`drawBackgroundLayers(...)` block and before `drawBackgroundTiles(...)`:

```
ctx.fillRect(background color)
drawBackgroundLayers(...)        // backdrop bands + flat sky fills
drawAmbientClouds(...)           // NEW — own drift + small camera parallax, behind all else
drawBackgroundTiles(...)         // O-014 background mass
drawTerrain(...)                 // terrain + decorations + torches
... entities, player, pickups, water ...
drawDarkness(...) / effects / counters / HUD / hearts / iris
```

- The ambient layer MUST be drawn **behind** the level's terrain, its entities,
  its background tile layer and the heads-up display (FR-011).
- The ambient layer MUST stay inside `[skyTop, cloudsTop]` and never reach the
  treeline, grass, terrain or the level's content (FR-010).
- It MUST be drawn at `BACKGROUND_RENDER_SCALE`, the same uniform scale as every
  other backdrop band (FR-004).
- It carries a small camera-linked parallax shift —
  `cameraX × AMBIENT_CLOUD_PARALLAX_FACTOR`, the painted clouds/hills band's own factor —
  rather than the world's `originX`/`originY`: the layer's own drift is camera-independent,
  but the parallax shift makes it read at the painted band's depth (FR-002).

## Game-loop contract (`PlatformerPage.tsx`)

- The `CloudField` is a loop-local `let`, created in `resize()` from the current
  canvas width and `backgroundBandGeometry(canvas.height)`, and rebuilt on every
  resize (FR-015, SC-007).
- It is stepped inside the `playing` branch, alongside `worldAnimElapsed += dt`:
  `cloudField = stepCloudField(cloudField, dt, prefersReducedMotion)`.
- Because the step lives only in the `playing` branch, the layer freezes with the
  world during `paused` / `dying` / `awaitingRestart` / `ending-screen` and
  resumes from where it was after a stall (spec Edge Cases).
- `prefersReducedMotion` is read once in the mount effect from
  `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and passed into
  the step (FR-014).

## Asset contract (`entities/sprites/sheets.ts`)

- `AMBIENT_CLOUDS_SHEET` registers `/sprites/ambient_clouds.png` for **loading
  only** (same convention as `BACKGROUND_LAYERS_SHEET`); `AmbientClouds.ts`
  addresses the image through its own `AMBIENT_CLOUD_SOURCE_RECTS`, not through
  `frameSource`.
- `PlatformerPage.tsx` loads it with the existing
  `loadImage(...).then(...).catch(() => {})` pattern into an
  `ambientCloudsRef`; a failed load leaves the ref null and the draw pass omits
  the layer without breaking the frame (FR-012).
