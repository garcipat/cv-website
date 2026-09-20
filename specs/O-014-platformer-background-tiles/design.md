# Design Rationale: Platformer Background Tile Rework

## Why a dense per-cell grid instead of a smarter placement model

O-003's freeform `BackgroundPlacement[]` (anchor + footprint) was chosen because it let one editor action stamp a multi-tile chunk of art at once — cheap to author, cheap to render (one `drawImage` per placement). The cost of that choice showed up later, in O-003's own still-open "visual clarity" requirement: because a "cell" was never independently addressable in the background layer, there was no way to reason about *coverage* without scanning every placement's footprint (as `isCellDarkening` and `paintBackgroundCell`'s overlap logic both had to do), and there was no way to make edges close cleanly against arbitrary neighbours, because neighbours weren't a concept the data model had.

The foreground terrain solved exactly this problem years earlier with a dense `TileType[][]` grid plus `GroundAtlas`'s neighbour-mask autotiling. Rather than invent a second approach, O-014 applies the same one to backgrounds. The payoff is structural, not just visual: `isCellDarkening` becomes a grid lookup instead of an AABB scan, `paintBackgroundCell`'s footprint/overlap machinery (five helper functions) collapses to the same single-cell write `paintCell` already does for terrain, and "does this cell connect to its neighbour" becomes answerable in O(1) instead of "which placement, if any, covers this cell."

## Why fully flat (no bright/dark split)

`GroundAtlas` splits every mask into a `bright`/`dark` variant because grass-topped ground has a real, meaningful visual distinction between "exposed at the surface" and "buried." Backgrounds don't carry that meaning — a background wall reads as one continuous material regardless of depth, and the issue's own framing ("stops competing with the foreground") argues for *less* visual incident in the background layer, not more. A lit top edge was considered (it would have been cheap — same UP-bit rule, different sprite selection) but rejected because it re-introduces the kind of visual event the whole feature exists to remove. This can be revisited later as a separate, additive change if the fully-flat result reads as too dead — nothing in the FR-005 atlas structure forecloses adding a bright/dark axis later, it would just be a new sprite dimension per material.

## Why materials are an open set, not a hardcoded pair

The issue named `dirt`→surface and `charcoal`→cave as the two materials directly inherited from the old catalog. Mid-design, inspecting the actual source art (`docs/assets/tilesets/terrain_.png`) revealed four fully-drawn, distinct-colored bands already existed (dirt, rust, charcoal, gray) rather than two — and a fifth (maroon) and a sixth (a second, lighter gray) were producible from the same sheet with minor hand-tuning. Restricting the spec to two materials would have thrown away already-available art variety for no benefit. The requirement that matters for O-010 is narrower than "exactly two materials": every material has exactly one family (`surface` or `cave`), and the editor palette derives its Surface/Cave grouping from that per-material field rather than a hand-maintained list (mirroring how `backgroundPaletteTiles.ts` already derives section membership today). Adding a seventh material later is a catalog entry, not a design change.

## Why the art was authored by cropping + rotating the existing sheet, not drawing new art

The `GroundAtlas` precedent already established a working technique: draw a handful of tiles whose art survives a 90°/180°/270° rotation, and let the mask table reuse them across all the shapes that differ only by orientation. Inspecting the existing 3×3 stamped background blocks showed they already contained real corner/edge/middle geometry (a black outline border tracing the block's outer silhouette, an interior with no border) — they just had never been sliced apart and used that way, because the old renderer only ever drew them as whole stamped rectangles. Cropping `corner`/`edge`/`middle` from a 3×3 block, and `strip-cap`/`strip-body` from the existing "column" pieces, recovered six of the required shapes directly from art that already existed with zero new drawing. Only the fully-isolated single-tile shape (bordered on all four sides) had no direct source, since nothing in the old catalog was ever meant to stand alone — that one tile was synthesized by compositing the same border strips (already extracted for the edge/corner pieces) onto the borderless middle texture, rather than hand-drawn.

One artifact of that source material surfaced during cleanup: the block's lower-middle region carried a third, darker "fleck" shading color baked into the source pixels (visible once cropped in isolation) that isn't present in the corner/edge tiles. An automated flat-color replace of that fleck (attempted mid-session) produced worse results — it turned shaped shading into a flat blocky patch — than the hand cleanup the art's owner ultimately did directly in GIMP. The lesson carried into this design: cropping and rotating existing art via script is reliable (it's a pure, lossless pixel operation), but color/shading cleanup is a judgment call better left to a human editing by eye once the art is wrong at the pixel level, not just the wrong color.

## Revision: background storage unified with the foreground's `string[]` layout format

The first implementation pass stored `background` as a JSON array-of-arrays of
material-name strings (`[[null,"charcoal",null],...]`), separate in shape from
`terrain`'s compact `string[]` ASCII layout. Once the background became a
dense per-cell grid (the whole point of this feature), that shape difference
stopped being justified by anything — both are "one value per grid cell,
aligned to the same bounds." Keeping them in different JSON shapes meant
`paintBackgroundCell.ts`'s `growBackgroundGrid` and
`cropLevelForExport.ts`'s background-slicing loop were near-duplicates of
`editor/growGrid.ts` and `editor/exportLayout.ts`, reimplemented rather than
reused, purely because the value type differed (`BackgroundMaterialId | null`
vs `TileChar`).

The fix: background gets its own single-character map (`BACKGROUND_CHARS`,
mirroring `TERRAIN_CHARS`) and its own compact `string[]` layout, parsed by a
`parseBackgroundLayout` that mirrors `parseLevel`'s terrain loop exactly. The
editor's in-memory background grid becomes a character grid
(`BackgroundChar[][]`), the same relationship `editorLevelSignal`'s
`TileChar[][]` already has to the game's `TileType[][]` — painting/erasing/
growing all become the *same* generic grid operations terrain already has,
not a parallel implementation. `BackgroundGrid` (the material-id grid
`BackgroundAtlas`/`Renderer`/`Lighting` consume) stays exactly as it is; it's
now produced by `parseBackgroundLayout` at load time instead of stored
directly, the same way `TileMap` is produced by `parseLevel` rather than
stored directly.

This does not touch rendering, autotiling, or the O-010 lighting lookup at
all — `BackgroundAtlas`, `drawBackgroundTiles`, and `isCellDarkening` all
still consume the same `BackgroundGrid` shape they always have. Only the
authoring/storage boundary (editor grid shape, save/export JSON shape, parse
function) changes.

**Saved-file shape, before and after:**

```json
// before
{ "name": "Cave Run", "layout": [".S.", "GGG"], "background": [[null, "charcoal", null], [null, null, null]] }

// after
{ "name": "Cave Run", "layout": [".S.", "GGG"], "background": ["...", ".c."] }
```

**Export dialog**: the editor's manual "Export Layout" dialog
(`EditorToolbar.tsx`) is not the Save-to-JSON-file path (`saveLevelFile.ts`
already handles that) — it's a developer convenience that formats the
foreground layout as a TypeScript array-literal (`  'ROW',` per line,
indented) meant to be copy-pasted straight into `level.ts`'s
`LEVEL_1_LAYOUT` source constant. Background was never in it, since it
wasn't a comparable `string[]` shape before now, and `LEVEL_1_BACKGROUND` had
to be hand-authored as a `BackgroundGrid` map expression instead. Now that
background is also a `string[]` layout, `LEVEL_1_BACKGROUND` becomes a
literal `readonly string[]` constant too, so the same one textarea grows a
second labelled section (`  'ROW',` lines for `background`, under a comment
marking where they go) rather than gaining a second side-by-side box — one
copy-pasteable block covering both constants that need updating in
`level.ts`, not two the author has to keep straight by hand.

## Why rocks are a new small catalog instead of extending `StaticObjectsCatalog`

`StaticObjectsCatalog` already provides the exact mechanism needed (`pickVariant(col, row)`, a deterministic position hash) but its existing entries are all foreground terrain decor (bushes, stalactites, cobwebs) with their own tile-type semantics. Routing background rocks through the same catalog would couple two independent concerns — foreground tile decoration and background mass decoration — for no shared benefit beyond the one small hashing function, which is cheap to duplicate (a handful of lines) and already proven correct by `StaticObjectsCatalog`'s own tests. A new `BackgroundDecorCatalog` keeps the foreground catalog's scope unchanged.
