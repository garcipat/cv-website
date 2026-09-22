# Phase 0 Research: Ambient Background Clouds

Every NEEDS CLARIFICATION from the spec's Technical Context is resolved below.
The spec's own Clarifications session already settled the two behavioural
questions (density scales with play-area width; every cloud drifts right to
left); these decisions cover the remaining implementation choices.

## D1 — Where the cloud state lives and how it advances

**Decision**: Add one pure module, `engine/AmbientClouds.ts`, exporting a small
`CloudField` value plus pure helpers:

```ts
cloudPopulationFor(playAreaWidth): number
createCloudField(playAreaWidth, skyTop, openSkyBottom, seed?): CloudField
stepCloudField(field, dtSeconds, reducedMotion): CloudField
drawAmbientClouds(ctx, image, field): void
```

`PlatformerPage.tsx` owns the field as a **loop-local variable** (the same
pattern as `worldAnimElapsed` / `nextBonusFruitIcon`), not a module-level signal:
nothing outside the render loop reads it. It is stepped only inside the
`playing` branch of the game loop, next to `worldAnimElapsed += dt`, so it
freezes with the world during `paused` / `dying` / `awaitingRestart` /
`ending-screen` for free (spec Edge Case "A pause or a stall in the game loop").

**Rationale**: Keeping the drift/lifecycle math pure and canvas-free makes it
directly unit-testable without a DOM (TestingGuide: unit layer for pure engine
modules) and keeps the render loop thin. Stepping by the loop's own clamped `dt`
(see `GameLoop.ts`'s `MAX_DT`) is what satisfies the "resumes where it was rather
than jumping forward" edge case — the field never sees wall-clock time.

**Alternatives considered**:

- *A module-level signal in `PlatformerState.ts`* — rejected: nothing outside the
  loop reads or reacts to it, so a signal would add observability nobody consumes;
  the loop-local convention already covers `worldAnimElapsed` and the bonus-fruit
  icon counter.
- *Deriving positions from `worldElapsed` inside the draw call* — rejected: the
  per-cloud respawn history (new speed/shape each pass) is genuine state, and
  recomputing it from a closed-form function of elapsed time would be more
  complicated than stepping it.
- *Mutating the field in place each frame* — rejected: returning a new field keeps
  the step function pure and the tests free of hidden state, at a negligible
  allocation cost (a handful of objects per frame).

## D2 — How the open sky region is derived

**Decision**: Extract a pure `backgroundBandGeometry(canvasHeight)` from
`BackgroundLayers.ts` returning the band edges (`skyTop`, `skyBottom`,
`cloudsTop`, `cloudsBottom`, `villageTop`, `villageBottom`), refactor
`drawBackgroundLayers` to consume it, and give the ambient layer the **open sky
region `[skyTop, cloudsTop]`** — from the bottom of the HUD's flat dark-blue top
margin (`SKY_TOP_MARGIN × BACKGROUND_RENDER_SCALE`) down to the top of the
painted clouds/hills band.

**Rationale**: The backdrop already computes exactly these edges; duplicating the
`VILLAGE_BOTTOM_OFFSET` / `CLOUDS_VILLAGE_GAP` / source-rect arithmetic in a
second module would let the two drift apart. Extracting one pure helper is a
behaviour-preserving refactor (existing `BackgroundLayers.test.ts` assertions are
unchanged) and makes the sky band testable on its own. The region's **bottom** is
the painted clouds band's top edge, satisfying FR-001 ("above the backdrop's
cloud/hills band").

The region's **top** is the bottom of the dark-blue HUD margin, not the canvas
edge — the spec words this as "below the heads-up display's dark top margin".
The dark margin is not sky — it exists specifically to give
the HUD (hearts, counters) contrast, and cream clouds drifting across it would
compete with that HUD and break the "decoration in the emptiest part of the
frame" intent of User Story 3. Every acceptance scenario still passes with this
bound: clouds never reach the treeline/grass/terrain and are always drawn behind
the level, its entities and the HUD.

**Alternatives considered**:

- *Recompute the band edges locally in `AmbientClouds.ts`* — rejected: two sources
  of truth for the backdrop's geometry; a future tweak to `VILLAGE_BOTTOM_OFFSET`
  or `CLOUDS_VILLAGE_GAP` would silently misplace the clouds.
- *Use `y = 0` as the region top* — rejected: it lets clouds cross the HUD's
  deliberate dark margin, which reads as a layering mistake and reduces HUD
  contrast. See the rationale above.
- *A `SKY_REGION` constant pair* — rejected: the edges are already derived from
  the canvas height each resize; hard-coding them would break on short viewports.

## D3 — How the cloud shapes are addressed

**Decision**: Address `public/sprites/ambient_clouds.png` (185×32) through four
explicit, tight source rects exported from `AmbientClouds.ts`:

| Shape | sx | sy | w | h | Rendered (×2) |
| --- | --- | --- | --- | --- | --- |
| 0 | 0 | 16 | 33 | 16 | 66 × 32 |
| 1 | 41 | 12 | 43 | 20 | 86 × 40 |
| 2 | 92 | 12 | 43 | 20 | 86 × 40 |
| 3 | 143 | 0 | 42 | 32 | 84 × 64 |

(Measured by scanning the PNG's opaque column/row bounds; all four shapes are
bottom-aligned at row 31 in the sheet, and shapes 1 and 2 share dimensions but
have distinct silhouettes.)

**Rationale**: The sheet is not a uniform frame grid — the clouds are different
widths — so, exactly like `BackgroundLayers.ts`'s sub-rects and
`StaticObjectsCatalog.ts`'s sx/sy rects, it is addressed by named rects rather
than `frameSource`'s stride maths. Registering it in `sheets.ts` is a
loading-only concern (same convention as `BACKGROUND_LAYERS_SHEET`). FR-005
("more than one silhouette") is satisfied by the four distinct shapes, and their
differing widths naturally vary the drift's visual rhythm.

**Alternatives considered**:

- *Force a uniform 32px cell grid* — rejected: it would either clip the wider
  clouds or pad the narrow one with transparent pixels, and would waste draw
  calls.
- *Generate the clouds procedurally* — rejected by the spec Assumption ("Art is
  authored, not generated at runtime") and by O-009's design rationale against a
  generated sky.

## D4 — Seeded variation and the respawn lifecycle

**Decision**: A tiny deterministic PRNG (mulberry32) carried on the field as a
`rngState: number`; `createCloudField` seeds it (default a fixed constant, so a
session is reproducible and tests are not flaky — spec Assumption "Variation is
seeded"). Each cloud has a fixed **lane** (its vertical slot), a shape index, a
drift speed in rendered px/s, and a current `x`. Every step:

```
x -= speed * dt
if (x + shapeWidth*SCALE < 0):        // fully past the left edge
    speed    = MIN + rand()*(MAX-MIN) // FR-007: new speed
    shape    = a different shape index
    x        = playAreaWidth + rand()*RESPAWN_JITTER   // FR-006/FR-007/FR-008
    y        = laneBottom - shapeHeight*SCALE          // re-fit the new height
```

Initial placement spreads the clouds across `[-maxWidth, playAreaWidth)` so the
sky is populated on the very first frame (FR-006: "never left without clouds")
while later passes always enter and leave by crossing an edge (FR-008).

**Rationale**: A fixed lane per cloud guarantees FR-003's "no two clouds move in
lockstep or sit on the same line" by construction, and prevents the "unreadable
blob" overlap of User Story 2. A seeded PRNG gives FR-007's per-pass variation
while keeping the whole field reproducible: a test can assert two different
passes differ *and* assert an exact sequence from a known seed.

**Alternatives considered**:

- *`Math.random()`* — rejected: non-reproducible, so the spec's own
  "assertable rather than flaky" assumption would fail.
- *Varying each cloud's lane on respawn* — rejected: it reintroduces the
  overlap risk the fixed lanes eliminate, for no stated requirement.
- *A third-party PRNG dependency* — rejected: a 4-line mulberry32 is sufficient
  and adds no bundle weight (Principle V).

## D5 — Population density

**Decision**: `cloudPopulationFor(width) = max(MIN_CLOUD_COUNT, round(width / CLOUD_SPACING_PX))`
with `CLOUD_SPACING_PX ≈ 300` rendered px and `MIN_CLOUD_COUNT = 3`, recomputed
whenever `resize()` rebuilds the field (FR-015, SC-007).

**Rationale**: The spec's clarification asks for "one cloud per fixed span of
width, subject to a minimum, recomputed when the play area resizes". The play
canvas width is already capped at `PLAY_CANVAS_COLS × RENDERED_TILE_SIZE`
(1280 px) by `CanvasSize.ts`, so the population is bounded (≈ 4 at the cap) and
never grows without limit. A wider window (up to the cap) shows proportionally
more clouds; a narrow one still shows the minimum.

**Alternatives considered**:

- *A fixed population for every width* — rejected: the spec clarification and
  SC-007 explicitly require density scaling.
- *A per-level density in level JSON* — rejected by the spec Assumption ("Density
  is a constant, not per-level data").

## D6 — Reduced motion

**Decision**: Read `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
**once** in `PlatformerPage.tsx`'s mount effect and thread it into
`stepCloudField(field, dt, reducedMotion)`. When true, the step returns the field
unchanged, so the clouds are still drawn but never drift (FR-014). The rest of
the game is untouched (SC-006).

**Rationale**: This mirrors the existing precedent in
`src/themes/space/SpacePage.tsx`, which reads the same query once with
`useMemo`. Passing the flag into the pure step keeps the behaviour testable
without a DOM (the test calls `stepCloudField(field, dt, true)` and asserts no
position change), and "read once" is consistent with how the site's other
animated themes already treat the preference.

**Alternatives considered**:

- *Subscribe to the media query's `change` event* — rejected: the site's existing
  themes read it once; a live listener is extra lifecycle machinery for a
  preference that is set before the page loads in practice. If the project later
  standardises live updates, that is a cross-theme change, not this feature's.
- *Suppress the layer entirely under reduced motion* — rejected by FR-014, which
  requires the clouds to be **drawn** but stationary.

## D7 — Draw order, scale and pixel rounding

**Decision**: Draw the layer in `PlatformerPage.tsx`'s `render()` immediately
after the `drawBackgroundLayers(...)` block and before `drawBackgroundTiles` /
`drawTerrain`, using the backdrop's own `BACKGROUND_RENDER_SCALE` and
`ctx.imageSmoothingEnabled = false`; each cloud's destination x is
`Math.round(cloud.x - cameraX × AMBIENT_CLOUD_PARALLAX_FACTOR)` (FR-002, FR-009; see
D9). The authoritative render order lives in
[contracts/rendering.md](./contracts/rendering.md).

**Rationale**: FR-011 requires the ambient layer behind the level's terrain,
entities, background tile layer and HUD; drawing it right after the backdrop —
the only thing it must sit on top of — puts it behind everything else. FR-004
requires the same uniform scale as the backdrop's other bands, so reusing
`BACKGROUND_RENDER_SCALE` is the single source of truth for that scale. Rounding
the destination x (the same technique `drawTiledRow` uses to kill its 1px seams)
stops a fractional position from shimmering against the flat sky once smoothing
is off (FR-009).

**Alternatives considered**:

- *Draw before the backdrop* — rejected: the flat sky-colour fill would paint
  over the clouds.
- *Draw with the world entities (full camera offset)* — rejected: the layer's own
  drift must stay camera-independent, so it is not world-space; it takes only the
  small parallax shift D9 describes.
- *Scale by a new local constant* — rejected: it would let the ambient grid drift
  away from the backdrop's, breaking FR-004.

## D8 — Degradation

**Decision**: `drawAmbientClouds` returns immediately when `image` is null
(FR-012), and `createCloudField` returns an empty field when the region's height
cannot fit the shortest shape (`openSkyBottom - skyTop < MIN_SHAPE_HEIGHT × SCALE`,
where `MIN_SHAPE_HEIGHT` is the shortest source-rect height, 16 native px; FR-013).
In both cases the rest of the frame renders unchanged.

**Rationale**: The sprite load already uses the repo's `.catch(() => {})`
convention, so a failed load leaves the ref null; the draw pass simply omits the
layer. A region too short to fit even the 32px-tall shortest cloud would place a
cloud over another band, so it is omitted instead (spec Edge Case). Both guards
are cheap and make the "purely decorative, never breaks the frame" success
criteria hold by construction.

**Alternatives considered**:

- *Shrink clouds to fit a short sky* — rejected: FR-004 forbids a different
  scale, and resizing would break the single pixel grid.
- *Draw anyway and clip* — rejected: it would violate FR-010 by spilling over the
  clouds band.

## D9 — Camera-linked parallax

**Decision**: Add `AMBIENT_CLOUD_PARALLAX_FACTOR = 0.2` and shift each cloud's draw x by
`-cameraX × factor`, matching `CLOUDS_PARALLAX_FACTOR` in `BackgroundLayers.ts`. The
layer keeps its own right→left drift; the camera adds a small horizontal shift on top.

**Rationale**: Drawn with no camera term at all, the clouds read as pasted on the screen
rather than part of the sky when the player moves. Matching the painted clouds/hills
band's factor makes the two share a depth, so the ambient clouds feel like they live in
the same sky plane instead of floating in front of it. The factor is a constant, not
level data, matching the feature's "density is a constant" assumption.

**Alternatives considered**:

- *No camera term (the original FR-002 wording)* — rejected: it made the clouds feel
  disconnected from the world when the player moved.
- *Full camera speed (factor 1)* — rejected: the clouds would scroll with the foreground
  and read as near objects, not distant sky.
- *A factor above the painted band's (e.g. 0.3)* — rejected as reading closer than the
  band they sit above; matching 0.2 keeps them in that same plane.

## Dependencies (existing code this builds on)

- **O-009 Platformer Background Layers** — supplies the backdrop bands, their
  `BACKGROUND_RENDER_SCALE`, the sky-colour fill, and the geometry this feature
  extracts (`BackgroundLayers.ts`); its `design.md` owns the band rationale.
- **F-015 Platformer Theme** — supplies the play canvas, the game loop, the
  bottom-anchored camera and `worldAnimElapsed`, all of which already exist.
- **F-001/F-002 project setup** — supplies `SpriteLoader`/`sheets.ts` asset
  loading conventions.
