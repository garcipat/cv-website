# Background Tile Layer: A Second, Purely Visual Depth Layer — Design

## Roadmap status

Unscheduled in `roadmap.md` until this design is approved; on approval it becomes the
next Iteration 4 step ("Background tile layer"), after step 34. Delivered in two steps:
**Step 35a** (freeform placement, this plan's immediate target) and **Step 35b**
(pattern capture + repeat-expansion tool, later).

## Goal and scope

Give level design a way to paint a second, decorative tile layer behind the existing
foreground/terrain layer — stone/dirt "fill" that reads as the solid mass a platform
sits on, instead of terrain floating over flat sky. Reference:
`specs/S-006-platformer-theme/level example.gif`, whose lower two-thirds shows exactly
this: a tan/grass crust in front, with darker dirt/stone filling the depth behind and
below it.

**This feature delivers**: a new `background` placement list on `LevelDef`, a renderer
pass that draws it behind everything else, and a Level Editor layer toggle with a
catalog of real stone pieces to paint with. The layer stays purely visual — painting it
only changes what's drawn, the same way the existing sky does.

`backgrounds.png` (the 4 full parallax scene backdrops pushed alongside `terrain_.png`)
belongs to a separate, later design — see Open items.

## Assets

`public/sprites/terrain_.png`, 128×320px, 16px source tiles (drawn at 32px like
`world_tileset.png`'s `RENDERED_TILE_SIZE`). Measured directly from the pixel data (no
gutter between tiles, unlike `tile_atlas.png`'s 19px stride — art is packed edge to
edge):

- **4 colour variants** on the sheet: dirt-brown, charcoal, grey-brown, red-brown, top
  to bottom. This feature uses the first 2 (dirt-brown, charcoal).
- Each variant occupies an 80px-tall band: a 7px gap, an 18px-tall row-group (thin
  edge-strip pieces), another 7px gap, then a 48px-tall row-group (the larger block
  pieces).
- Horizontally: a 105px-wide main content area, a 14px gap, then a 9px-wide column of
  small round pebble/detail pieces.
- **The piece layout is identical across both variants** — only the y-offset changes
  (`sy = baseSy + variantIndex * 80`). One shared piece table, reused for each colour.

Piece footprints available: 1×1, 1×2, 2×1, 2×2, and 3×3, packed irregularly (not a
uniform grid of same-size cells) — a genuine jigsaw of variously-sized chunks, plus the
1×1 pebble accents. The exact sx/sy for each individual piece is pinned down hands-on
during implementation (same as any atlas-driven `writing-plans` task), the way
`2026-09-02-terrain-rework-design.md`'s `tile_atlas.png` table was — this design fixes
the *mechanism*, not every pixel coordinate.

## Data model: a sparse placement list, not a dense grid

A dense per-cell grid (one entry per foreground cell) is awkward once pieces can span
multiple cells — a multi-tile piece needs either duplicate entries or "covered by
neighbour" markers at every cell it occupies. Instead, `LevelDef` gains a flat list of
placements:

```typescript
type BackgroundPieceId = string;  // catalog key, e.g. 'dirt_block3x3_a', 'charcoal_pebble_1'

interface BackgroundPlacement {
  pieceId: BackgroundPieceId;
  col: number;
  row: number;   // top-left cell the piece is anchored at
}

background?: BackgroundPlacement[];
```

A piece's footprint (`sx`, `sy`, `widthTiles`, `heightTiles`) lives in a catalog keyed by
`BackgroundPieceId`, built from the Assets section's shared piece table times 2 colours
— not repeated per placement. Each placement stores only which piece and where.

- Omitting the field (or an empty array) preserves today's behaviour exactly — existing
  level JSON keeps working with no migration.
- The renderer draws every placement's real pixels at its anchor; gameplay and collision
  continue to read solidity from `TileType`/`Terrain.ts`'s existing terrain grid alone —
  the background list is consumed only by rendering and the editor.

## Rendering

New `BackgroundCatalog.ts` (parallel in spirit to `GroundAtlas.ts`, but a flat piece
table rather than a neighbour-mask table): maps each `BackgroundPieceId` to its atlas
source rect and tile footprint.

New `drawBackgroundTiles()` in `Renderer.ts`, drawing every entry in `LevelDef`'s
`background` list at its anchor. Verified actual current draw order in
`PlatformerPage.tsx`:

```
drawSkyBackground → drawTerrain → drawBlocks/drawChests → drawPlayer → drawEnemies → drawWaterForeground
```

`drawBackgroundTiles` is inserted right after `drawSkyBackground` and before
`drawTerrain`, so the painted mass sits behind the foreground terrain and every entity,
visible only through gaps — exactly like the reference gif. `EditorCanvas.tsx` gets the
same call in the same relative position, so the editor preview matches gameplay.

## Editor UX (Step 35a — freeform placement)

`Palette.tsx` gains a Foreground/Background tab above the tile buttons. Background mode
lists every catalog piece from both colours as its own button — a real catalog to pick
from, mirroring how the palette already generates one button per `TERRAIN_CHARS`/
`ENTITY_CHARS` key.

Painting follows the editor's existing conventions:

- **Left-click** stamps the selected piece with its top-left anchored at the clicked
  cell. If the piece's footprint overlaps any existing placement(s), those placements
  are removed and the new one takes their place — the same silent-overwrite convention
  the foreground layer already uses.
- **Right-click** erases: it removes whichever placement's footprint contains the
  clicked cell, regardless of the selected tool — matching the foreground's existing
  right-click-always-erases convention.

No new grid, no new pan/zoom logic — same `EditorCanvas`, same coordinates, painting
into the `background` list instead of the terrain grid.

## Step 35b (later): pattern capture and repeat-expansion

Once a hand-drawn arrangement in the editor looks right, its placements (restricted to
one bounding rectangle) become a reusable "pattern" — still just
`BackgroundPlacement[]`, offset to a local origin. A new editor action takes that pattern
plus a target rectangle and *expands* it into concrete placements across that area, with
a staggered horizontal offset per pattern-row repeat (like brick coursing) so the
repeat's seam breaks into a diagonal instead of a straight line. This is purely an
editor-time convenience — it writes ordinary placements into `background`, so the
renderer and data model from Step 35a need no changes at all. Levels can still be painted
placement-by-placement; the repeat tool just makes covering a large area fast once a
pattern is settled.

## Testing

Tests first, per the constitution:

- `BackgroundCatalog.ts` — every `BackgroundPieceId` resolves to a valid atlas rect and
  footprint; the two colours share the same footprint table at different y-offsets.
- `LevelParser`/`LevelData` — round-trips the new optional `background` field; a level
  with the field omitted (or empty) parses identically to today.
- `Renderer.ts` — `drawBackgroundTiles` draws every placement in the level's background
  list at its anchor, and fires before `drawTerrain` in the real draw sequence.
- `EditorCanvas`/`LevelEditorPage` — the Foreground/Background tab swaps the palette;
  placing a piece overlapping existing placement(s) replaces them; right-click erases the
  placement under the cursor; `LevelEditorPage`'s export/save round-trips `background`.

Manual verification: paint a background patch (mixing single tiles and bigger chunks)
behind a terrain platform with a gap, as in the reference gif, in the running game and
confirm it reads as depth, not a flat texture.

## Open items

- Pin down the exact `terrain_.png` sx/sy-per-piece table during implementation, the way
  `tile_atlas.png`'s table was pinned down for the terrain rework.
- Step 35b's exact repeat/stagger tool UX (how a pattern's bounding rectangle is
  selected, how the target area is selected) is designed when that step starts, informed
  by whatever pattern is actually drawn in Step 35a.
- A future step can give levels a selectable sky/backdrop from `backgrounds.png` (the 4
  scene images) — that would be its own design, built on top of this one.
