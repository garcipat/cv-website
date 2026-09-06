# Background Image Layers: Replacing the Procedural Sky with `backgrounds.png` — Design

## Roadmap status

Unscheduled in `roadmap.md` until this design is approved; on approval it becomes
**Step 43**. This is the follow-up anticipated by
`2026-09-03-background-tile-layer-design.md`'s Open items: "A future step can give
levels a selectable sky/backdrop from `backgrounds.png` (the 4 scene images) — that
would be its own design, built on top of this one."

## Revision (post-implementation, after a first look in the browser)

After implementing and viewing the first version in the running game, two changes to
the rendering approach in the section below:

- **Clouds/hills no longer tile vertically.** The original design tiled the clouds
  band repeatedly to fill the (variable, canvas-height-dependent) gap between the sky
  and the village layer. In practice this reads as a visibly repeating stack of
  identical cloud/hill bands on a tall window — worse than intended. Clouds/hills now
  draws exactly **once**, positioned directly under the sky; the remaining gap down to
  the village layer (whatever height it happens to be) is filled with a flat color
  sampled from the sky/clouds art's own light-blue, not a second repeat of the tile.
- **All 4 static layers (sky, clouds/hills, village, grass) render at a uniform 2x
  scale**, matching the foreground terrain's own `RENDERED_TILE_SIZE` (2x native) and
  the grass tile's scale from the final-review fix wave — previously only grass was
  scaled. The river overlay inherits the village layer's scale and position (its own
  destination offset scales proportionally, since it's positioned relative to the
  village band).

## Goal and scope

Replace the platformer's procedural sky (`drawSkyBackground` in `Renderer.ts` — solid
color rows + one recolored cloud tile, drawn from `world_tileset.png`) with a real
illustrated backdrop cropped from `public/sprites/backgrounds.png`'s day/green scene,
composited as four independently-scrolling depth layers (sky, clouds/hills,
village/treeline, grass) for a parallax effect. `backgrounds.png` itself is left
untouched as archive/source material — the feature consumes purpose-cropped exports of
it, following this repo's existing pattern of dedicated per-feature sheets
(`terrain_.png`, `staticObjects.png`, `tile_atlas.png`).

**Out of scope**: the other 3 scene variants (night, beach, desert) — not wired up, but
the asset pipeline established here (crop → chroma-key) applies to them unchanged
whenever a later step wants per-level backdrop selection. Also out of scope: the actual
river *animation* — this step only extracts and positions the river-wave sprite sheet as
a future hook at the village layer; animating it is a separate future step.

## Assets

Source: `public/sprites/backgrounds.png` (464×432, untouched), day/green scene at
**x:16–175, y:16–159** (160×144), measured directly from pixel data (magenta
`RGB(253,77,211)` everywhere else on the sheet). Within that scene, measured
per-row/column boundaries:

| Layer | Region (in `backgrounds.png` coords) | Notes |
|---|---|---|
| Sky | x16–175, y16–63 | dark-blue accent strip + light-blue fill |
| Clouds/hills | x16–175, y64–103 | white cloud puffs (peak reaches y64) over a cyan wave band |
| Village/treeline | x16–175, y104–119 | pine-silhouette row over an orange strip; a small blue river drip peeks in at the very bottom — intentional, matches the future river-animation hook |
| Grass | separate small tile, not a slice of the scene — see below | |
| River-wave (future) | x16–175, y200–259 | two frames of wave-line art on magenta, for a later river-animation step |

**Grass** is deliberately *not* a crop of the scene's original grass band (which has a
decorative river and bushes baked in that would look wrong repeating). Instead it's a
small standalone tileable swatch — confirmed by direct tiling test to repeat seamlessly
in both axes at **7×20px** (originally sampled at x40,y140 in `backgrounds.png`; the
user has since hand-cropped and relocated a clean copy of this tile as its own sprite,
alongside the village scene and river-wave strips, into a combined working file
(`background_village.png`) for this feature to slice from during implementation).

Each of the 3 scene bands (sky, clouds/hills, village) plus the grass tile plus the
river-wave strips gets chroma-keyed from magenta to transparent using this repo's
existing `scripts/chroma_key_sprite.py` pipeline (same one used for other
magenta-background AI-generated sprites, documented in
`.claude/skills/nano-banana/SKILL.md`), then saved as their own dedicated PNGs under
`public/sprites/` (exact filenames/counts decided during implementation — likely one
file per band plus the grass tile, or one sheet with sub-rects; whichever keeps
`sheets.ts` registration simplest).

## Rendering

New module (e.g. `BackgroundLayers.ts`, parallel to `BackgroundCatalog.ts`) replaces the
`drawSkyBackground` call in `PlatformerPage.tsx` (currently line 458). The old
`drawSkyBackground`/`recoloredCloudTile` functions and their cloud-recolor cache in
`Renderer.ts`, plus their `describe('drawSkyBackground', …)` test suite in
`Renderer.test.ts` (~150 lines), are deleted as dead code rather than left unused.

Each frame, draw 4 layers back-to-front:

1. **Sky** — stretched to canvas width, pinned to y=0, canvas-fixed (no horizontal
   scroll, matching today's sky behavior exactly).
2. **Clouds/hills** — tiled horizontally, slow parallax (a fraction of camera-x
   movement). Stretched/tiled vertically to fill the gap between the bottom of the sky
   band and the top of the village band — this gap is not fixed-height; it grows or
   shrinks with canvas height and with how far down the village layer sits.
3. **Village/treeline** — tiled horizontally, medium parallax (slower than the
   foreground terrain, faster than clouds/hills). Pinned at a fixed height above the
   canvas bottom (exact offset decided during implementation, informed by how tall
   real levels' foreground terrain typically is, so the village layer isn't fully
   hidden behind it).
4. **Grass** — the 7×20 tile, tiled both horizontally and vertically to fill from the
   bottom of the village layer down to the canvas bottom, at full camera-x speed
   (matching the foreground terrain's own scroll speed exactly, since visually it's an
   extension of the same ground). Drawn last, so it naturally covers any seam where the
   village layer's crop ends — no special-cased overlap/padding needed in the village
   asset itself.

Parallax is implemented as: each layer's draw-x offset = `-(cameraX * layerSpeedFactor) mod tileWidth`,
with `layerSpeedFactor` per layer: sky `0`, clouds/hills `<1` (slow), village
`<1` but closer to `1` than clouds (medium), grass `1` (full speed). Exact factors tuned
visually during implementation against a real level.

`EditorCanvas.tsx` gets the same background draw call in the same relative position (as
`drawSkyBackground` has today), so the level editor preview matches gameplay.

## Testing

Tests first, per the constitution. New unit tests replacing the deleted
`drawSkyBackground` suite, covering the new compositing function:

- Sky is pinned to y=0 and fills the canvas width regardless of canvas size.
- Village layer is pinned at its fixed offset from the canvas bottom.
- Clouds/hills fills exactly the gap between sky and village at various canvas
  heights (including degenerate small heights).
- Grass fills exactly from the village layer's bottom to the canvas bottom.
- Each layer's horizontal tiling wraps seamlessly (no visible gap/seam at the tile
  boundary) at arbitrary camera-x values.
- Parallax offsets scale correctly with `cameraX` per layer's speed factor; sky's
  offset is always `0` regardless of `cameraX`.

Manual verification: run the dev server's `?debug`/`?level` routes, walk through a real
level, confirm the parallax reads as depth (clouds/village visibly lag the camera, grass
matches foreground terrain movement exactly) and that grass sufficiently covers typical
foreground terrain heights without the village layer showing an awkward gap above it.

## Open items

- Exact pixel offsets for the village layer's fixed height above the canvas bottom, and
  the clouds/village parallax speed factors, are tuned visually during implementation —
  this design fixes the mechanism, not the exact numbers (same convention as the
  background-tile-layer design's atlas coordinates).
- Final asset filenames/layout for the chroma-keyed exports (one file per band vs. a
  combined sheet with sub-rects) decided during implementation.
- River animation itself (using the already-positioned river-wave strips) is a separate
  future step, once this one lands.
- The other 3 `backgrounds.png` scene variants (night/beach/desert) and any future
  per-level backdrop selection remain out of scope, same as noted in the prior design.
