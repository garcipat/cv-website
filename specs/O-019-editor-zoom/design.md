# Level Editor Zoom — Design Rationale

Why the zoom feature is shaped the way [spec.md](./spec.md) describes. Behavior lives in the spec;
the mechanism, once built, belongs in a `docs/themes/platformer/` reference doc, not here.

## A canvas transform for the shared renderer, screen-space multiplication for the rest

`EditorCanvas.tsx` draws through two different paths, and they need two different treatments.

**The game's own renderer** (`drawTerrain`, `drawBlocks`, `drawEnemies`, and the rest of the
`drawX` functions imported from `../engine/Renderer`) hardcodes `RENDERED_TILE_SIZE` internally, for
both tile position and `drawImage` destination size. Since that file is shared with the live game and
this feature must not touch it (see below), the only way to scale what it draws is a canvas transform:
wrapping those specific calls in `ctx.save(); ctx.scale(zoom, zoom); /* calls, origin divided by zoom
*/ ctx.restore();`. Everything those functions draw is subject to the current transform matrix
regardless of how their internals compute coordinates, so this scales them for free. The origin
argument each call already takes (`panOffset.x`, `panOffset.y`) has to become `panOffset.x / zoom`,
`panOffset.y / zoom` for these calls specifically — the transform will re-multiply it by `zoom`, and
since `panOffset` itself must stay in raw, zoom-independent screen pixels (see below), the division
cancels that back out.

**The editor's own overlay drawing** (`drawGridLines`, `drawSignBadges`, `drawTileMarkers`,
`drawMarkerGlyph`, `drawPlacementPreview` — all local to `EditorCanvas.tsx`) computes screen positions
by hand: `tileToPixel(col, row)` plus a raw pixel origin, with no canvas transform involved. Wrapping
these in the same `ctx.scale()` would double-scale anything that also depends on `panOffset` un-scaled,
and `drawGridLines`'s screen-space modulo alignment (see below) specifically depends on staying outside
any transform. So these five functions instead take `zoom` as a plain parameter and multiply their own
tile-space quantities by it before adding the (still-raw) origin: a position becomes
`tileToPixel(col, row).x * zoom + originX`, and a `RENDERED_TILE_SIZE`-sized rectangle or step becomes
`RENDERED_TILE_SIZE * zoom`. This is a small, mechanical, same-shape change to each of the five
functions — never a rewrite of what they draw or why.

Threading a zoom factor into `Renderer.ts`, `gridRenderState.ts`, or `paintCell.ts` themselves was
considered and rejected: it would touch the shared renderer the live game also uses, for no benefit
the transform doesn't already provide, and would multiply the number of call sites that need to agree
on a value instead of leaving that job to a canvas transform for the calls that need one.

The remaining coordinate-math change is the inverse: converting a pointer position back into a grid
cell (`cellFromEvent`). Today it divides the pointer's canvas-relative position by
`RENDERED_TILE_SIZE`; it now also divides by `zoom` first, since a screen-space distance has to be
converted back to world space before it can be converted to a cell. This is a one-line change to a
pure function that is already easy to unit test at each zoom level.

## Grid lines stay in screen space, on purpose

`drawGridLines` aligns its lines using `panOffset.x % RENDERED_TILE_SIZE` (and the `y` equivalent) —
screen-space modulo arithmetic that finds the right starting offset without ever needing to know the
true world-space bounds of what's visible. That trick still works with zoom in the picture: replacing
`RENDERED_TILE_SIZE` with `RENDERED_TILE_SIZE * zoom` throughout is the entire change, because the
modulo is computed against `panOffset`, which stays in raw, unscaled screen pixels regardless of zoom
(see the next section). Moving this function inside a canvas transform instead would have required
computing the visible viewport's true world-space rectangle from `panOffset`, `zoom`, and the canvas
size — solvable, but a genuine rewrite for a line-drawing routine that doesn't need one.

## Anchored zoom is one small formula, not a re-centering system

The transform model makes cursor-anchored zoom cheap rather than the "large, diffuse change" the
original O-006 design note warned about — because zoom lives entirely in the canvas transform and the
pan offset, keeping a point fixed under a zoom change is a single closed-form adjustment to that same
pan offset, not a new coordinate system.

A screen point maps to a world (tile-space) point as `world = (screen - pan) / zoom` (this is exactly
`cellFromEvent`'s own math, one level up before dividing by tile size). Keeping a chosen screen anchor
fixed across a zoom change from `zoomFrom` to `zoomTo` means solving for the new pan that maps the same
world point back to the same screen anchor:

```
newPan = anchor - (zoomTo / zoomFrom) * (anchor - oldPan)
```

This is a single pure function, `anchoredPan(pan, anchor, zoomFrom, zoomTo)`, taking a screen-space
anchor point and returning the adjusted pan offset. It has no dependency on which trigger called it:

- **Wheel zoom** passes the pointer's canvas-relative position (the same `x`/`y` `cellFromEvent`
  computes before its own division) as the anchor.
- **Slider zoom** passes the canvas's own center (`canvasSize.width / 2`, `canvasSize.height / 2`),
  since a slider interaction has no cursor-over-canvas position to anchor to.

Both call sites feed the same function, so the two triggers can never drift into inconsistent
behavior, and the formula itself is small enough to unit test exhaustively (a handful of
`(pan, anchor, zoomFrom, zoomTo) → newPan` cases) without touching a canvas at all.

## Panning stays in raw pixels, outside the scale

The existing pan offset is applied as a `ctx.translate()` before tiles are drawn, and it is defined in
raw screen pixels — not grid cells. Ordering the transform as translate-then-scale keeps the pan
offset meaning exactly what it means today, regardless of zoom: it is applied before the scale takes
effect, so a drag of N screen pixels pans by the same N screen pixels at every zoom level, whatever the
zoom level was set to or however it got there. This is why panning itself (FR-005's last sentence)
needs no zoom-specific code at all — only a *zoom change* touches the pan offset, via `anchoredPan`
above, and only by the amount anchoring requires.

## Zoom-out only, discrete steps

The issue that raised this feature is explicit about the problem: a fixed 1:1 canvas shows only a
small window of a level that can be hundreds of tiles wide. That is a request for *overview*, not
magnification, so 100% is the ceiling rather than the middle of a range — there is no case in the
issue, or raised since, for seeing a tile larger than it already renders today.

Discrete steps (100/75/50%) were chosen over a continuous slider range for two reasons. First,
predictability: a small set of fixed levels is easy to reason about, easy to test exhaustively, and
easy for an author to return to (100% always means "today's canvas," not "whatever I last dragged
to"). Second, rendering quality: a continuous factor risks sub-pixel tile boundaries and blurrier
`drawImage` scaling at arbitrary factors, while power-of-a-simple-fraction steps like these keep the
scaled tile size closer to whole pixels. 50% is the floor: it already gives enough overview to line a
piece of level up against its surroundings, without the canvas going so small that individual tiles
stop being useful to click on.

## Wheel zoom needs no modifier

The canvas has no scrollable content today, and its container (`EditorCanvasPane`'s wrapping `div`) is
a fixed flex-layout region with nothing to scroll — panning is middle-click-drag, not wheel-scroll —
so a plain wheel event over the canvas currently does nothing at all. That makes a `Ctrl`/`Cmd` gate
unnecessary: there is no existing scroll behavior to protect the pointer from hijacking, and gating the
gesture behind a modifier would only cost discoverability for no offsetting safety. Because there is
nothing to suppress, the handler does not call `event.preventDefault()` either — doing so on a React
`onWheel` handler risks a "cannot preventDefault inside a passive listener" warning depending on how
React attaches the underlying DOM listener, for a scroll that was never going to happen anyway. The
handler reads `event.deltaY`'s sign to pick the next or previous of the three levels, and passes the
event's canvas-relative position as the anchor to `anchoredPan` (see above) — so the wheel gesture
itself supplies the one thing the slider cannot: a cursor position to zoom toward.

## One slider per canvas, not a shared setting

The level canvas and the blueprint canvas ([O-006](../O-006-platformer-blueprints/spec.md)) already
keep independent pan state — panning one has never affected the other, because they are separate
views over separate content. Zoom follows the same precedent: an author might want a wide overview of
the level while authoring a small, detail-focused blueprint room, or vice versa, so coupling the two
sliders would fight that use case for no gain.

## No persistence

Zoom is deliberately view-only (FR-008, FR-009). A saved level or blueprint file describes content,
not how an editor happened to be looking at it when it was saved — persisting zoom would mean a level
file's shape depends on an unrelated UI preference, and a second author opening the same file would
see a zoom level that was never theirs to choose. Resetting to 100% on every open keeps the file format
and the editor's opening state both simple and predictable.

## The darkness preview is the one pass that takes zoom as a parameter

`drawDarkness` (`Renderer.ts`) is the exception to the "scale the canvas, don't thread a factor through
the shared renderer" rule above, because it is the only pass whose output is not uniformly subject to
the active transform. It punches torch-shaped holes into a full-canvas darkness fill on an offscreen
layer — in that layer's own, always-unscaled context — and then composites the result with a single
`ctx.drawImage(layer, 0, 0, canvasWidth, canvasHeight)`, whose destination rect *is* subject to the
transform. A canvas transform therefore cannot fix both halves at once: inside a `ctx.scale(zoom, zoom)`
the holes land correctly but the composite covers only the zoomed fraction of the physical canvas, and
outside it the coverage is right but every hole is off by an amount that depends on that torch's own
world position, which a translation cannot express.

So this one function takes a `zoom` parameter and the editor calls it at identity transform, passing the
raw (undivided) pan. It multiplies each world-space position and radius by `zoom` itself, and leaves
`canvasWidth`/`canvasHeight` raw so the composite still covers the whole canvas. The parameter defaults
to `1`, which makes every expression in the function algebraically identical to its pre-zoom form, so
the live game's call site — which scales nothing and passes no zoom — is untouched.

The two neighbouring editor-only passes stay where they were: `drawHeldTorch` and `drawEnemyEyes` size
sprites and markers from `RENDERED_TILE_SIZE` with no offscreen indirection, so a canvas transform
handles them correctly and they remain inside scaled segments, with `drawDarkness` composited between
them at identity.

## Superseded: O-006's "the editor has no zoom" note

[O-006's design rationale](../O-006-platformer-blueprints/design.md) previously explained why the
blueprint canvas shipped without zoom, pointing at [issue #48](https://github.com/garcipat/cv-website/issues/48)
as a parked idea. That issue is this feature; the note there should be read as historical context for
why O-006 didn't need to solve zoom itself, not as a statement of the editor's current capability.
