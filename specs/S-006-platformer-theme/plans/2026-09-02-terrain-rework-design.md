# Terrain Rework: Autotiled Ground from a Purpose-Built Atlas — Design

> Supersedes `2026-08-29-terrain-rework-notes.md`.

## Roadmap status

`roadmap.md` marks step 32 (Terrain rework) as "Blocked on step 31 landing first".
Step 31 (Level Selection) is not designed and no code exists for it. **Step 32 proceeds
anyway**, implemented against the current single hardcoded level
(`src/themes/platformer/level/level.ts`). `roadmap.md`'s step 32 note drops the
blocked-on-31 language when this lands.

## Goal and scope

Re-theme `groundGrass` (`'G'` in level data) from a fixed single-sprite-per-tile look
(one "top" sprite, one "under" sprite, no neighbour awareness — `Terrain.ts`'s
`isTopExposed`) to full 4-neighbour autotiling with a decoupled grass overlay.

**In scope**: `groundGrass` only.

**Out of scope**: `groundRock`, `wall`, `bridge`, `ladder` all keep drawing from
`world_tileset.png` unchanged. No new `TileType`, no cave background, no level-format
change. `level.ts`'s existing `G` characters pick up the new rendering with no layout
edit.

## The atlas

`public/sprites/tile_atlas.png` — a purpose-built sheet, 130×54, **16px tiles on a
uniform 19px stride** (16px tile + 3px transparent gutter), laid out 7 columns × 3 rows.
Cell `(c, r)` is at `sx = c * 19`, `sy = r * 19`.

Ground tiles are drawn with a dark border on each edge that faces **air**, and no border
on edges where the ground continues. A tile's borders are always drawn, including its
top edge — the grass overlay is allowed to cover it.

### Vertical banding rule

A *vertical run* is a maximal stretch of contiguous ground cells in one column. Every
run is banded the same way regardless of its height:

- The **bright band is always exactly one tile tall** — the topmost cell of the run.
- Everything below it is **dark**, however deep the run goes.
- The **gradient** (a bright-to-dark ramp inside a single tile) is used **only** when the
  run is one cell tall, because that cell is simultaneously the surface and the underside.
- Neither the bright band nor the gradient ever spans more than one tile, so no mid-tone
  transition tiles exist and the bright→dark boundary always falls between the first and
  second cell of a run.

| Run height | Cell index from top | Colour |
| --- | --- | --- |
| 1 | 0 (the only cell) | gradient |
| ≥ 2 | 0 | bright |
| ≥ 2 | ≥ 1 | dark |

Each column is banded independently, so on a stepped hillside every column gets its own
bright cap. A column broken by a gap contains two runs and is banded twice — once per
run — which is correct, since each run has its own exposed surface.

**This rule needs no row counting.** It follows entirely from the cell's own two vertical
edges, so the 4-neighbour mask already determines colour:

| Top edge | Bottom edge | Colour |
| --- | --- | --- |
| closed (faces air) | open | **bright** — topmost cell of a run of 2+ |
| closed | closed | **gradient** — a run exactly one cell tall |
| open (ground above) | either | **dark** — anything below the top cell |

### Ground tile table

Closed sides are listed as T/B/L/R; a side is closed when the neighbour in that
direction is not ground.

| Closed sides | Cell | Colour | Role |
| --- | --- | --- | --- |
| — | `c5r1` | dark | fully buried interior |
| T | `c4r0` | bright | top edge of a wide mass |
| B | `c1r1` | dark | bottom edge |
| L | *rotate `c1r1` +90°* | dark | left edge below the corner |
| R | *rotate `c1r1` −90°* | dark | right edge below the corner |
| T B | `c3r1` | dark | middle of a one-tile-tall strip |
| L R | `c4r1` | dark | middle of a one-tile-wide column |
| T L | `c3r0` | bright | top-left corner |
| T R | `c5r0` | bright | top-right corner |
| B L | `c0r1` | dark | bottom-left corner |
| B R | `c2r1` | dark | bottom-right corner |
| T L R | `c6r0` | bright | top of a one-tile-wide column |
| T B L | `c1r0` | gradient | left end of a one-tile-tall strip |
| T B R | `c2r0` | gradient | right end of a one-tile-tall strip |
| B L R | `c0r2` | dark | bottom of a one-tile-wide column |
| T B L R | `c0r0` | gradient | isolated single tile |

`c5r2` and `c6r2` are free. `c6r1` holds a bright L+R tile that the colour rule above
never selects (L+R means the top edge is open, which is a buried tile).

**Rotation** is safe for the dark tiles, whose texture is flat and direction-neutral, and
is how L-only and R-only are obtained. It must not be applied to the bright or gradient
tiles, whose vertical brightness ramp would end up running sideways.

### Grass overlay

Row 2 columns 1–4 hold the grass, **9px tall**, aligned to the top of the cell. It is a
separate draw pass over the ground tile, so ground tiles carry no grass of their own and
any ground tile can be grassed.

| Cell | Run position |
| --- | --- |
| `c1r2` | left end |
| `c2r2` | middle |
| `c3r2` | right end |
| `c4r2` | single (isolated) |

Run position is computed over horizontally adjacent tiles that are themselves ground
**and** top-exposed, so grass caps off wherever the terrain steps up or ends. This yields
the run-length cases directly: a run of 1 uses `c4r2`; a run of 2 uses `c1r2` + `c3r2`;
a run of 3 or more uses `c1r2`, `c2r2` repeated, then `c3r2`.

## Render algorithm

For each `groundGrass` cell:

1. Determine which of the four orthogonal neighbours are ground. Encode as a mask —
   `UP=1, RIGHT=2, DOWN=4, LEFT=8`; a **clear** bit means that edge is closed.
2. Look the mask up in the ground tile table for the `(sx, sy)` and any rotation.
3. Draw the ground tile.
4. If the top edge is closed, compute the grass run position and draw the matching grass
   sprite over the top 9px of the cell.

Both lookups are pure functions of the level grid, so the same level always renders
identically — no randomness, no per-tile variant hashing.

## Keeping the banding rule adjustable

The banding rule is expected to change (a two-cell bright band, or a ramp that deepens
with depth, are both plausible later). Three structural requirements keep that cheap:

- **The shape table is data, not control flow.** A `Record` keyed by neighbour mask
  yielding `{ sx, sy, rotation }`. Swapping atlas cells, or the whole atlas for a
  different material, is then an edit to values only.
- **The banding rule is one pure function**, separate from the table and from the render
  loop — `groundTileKind(mask)` returning `'bright' | 'gradient' | 'dark'`. Changing which
  closure gets which colour touches this function alone.
- **Nothing else reads the mask.** `Renderer.ts` asks for a tile source and draws it; it
  holds no banding knowledge, so a rule change never reaches it.

Cost of the likely changes, for reference: re-pointing cells or reassigning colours is a
table/function edit. A depth-dependent rule additionally needs `groundTileKind` to take
`(level, col, row)` and a small depth-count helper (capped, so it stays cheap) — one
signature change and one call site. In every case the dominant cost is new **art**, not
code: a two-cell bright band needs three tiles drawn, and the atlas would have to grow
past its two free slots (`c5r2`, `c6r2`) for anything larger.

## Implementation touch points

- **`Terrain.ts`** — add a neighbour-mask helper and generalize `bridgeRunPosition` into
  `horizontalRunPosition(level, col, row, matches)` taking a neighbour predicate, with
  `bridgeRunPosition` becoming a one-line wrapper. The grass pass uses it with a
  "ground and top-exposed" predicate. `isSolid`, `isSolidExcludingBridge` and the
  bridge/ladder helpers are unchanged.
- **`Renderer.ts`** — `tileSource`'s `groundGrass` branch consults the mask table instead
  of the fixed top/under lookup; `drawTerrain` takes the atlas as an additional image
  (only `groundGrass` sources from it) and gains a grass pass plus rotation support for
  the two rotated shapes. Re-read this file before editing rather than assuming its
  current shape.
- **No changes** to `LevelData.ts`, `LevelParser.ts`, or `level.ts`.

## Testing

Tests first, per the constitution:

- `Terrain.ts` — the neighbour-mask helper across all 16 configurations, and
  `horizontalRunPosition` for single/left/middle/right including the "neighbour is ground
  but not top-exposed" step-up case.
- `Renderer.ts` — `groundGrass` resolves to the expected atlas coordinates for
  representative masks, and the grass pass fires only on top-exposed tiles.

Manual verification uses the existing dev-only level editor to draw arbitrary terrain —
columns, thin platforms, overhangs, staircases, isolated tiles — and confirm each renders
correctly in the running game.

## Required art fix

`c3r1` (closed T+B) is the middle of a one-cell-tall run, so the banding rule assigns it
the **gradient**. It is currently flat dark, while the other T+B shapes (`c0r0`, `c1r0`,
`c2r0`) carry the full ramp. Until it matches them, a thin platform three or more cells
wide renders gradient ends around flat-dark middles.

## Open items

- The bright→dark step at a run's first/second cell boundary is abrupt: `c4r0` ends near
  brightness 152 and `c5r1` begins near 116. A crisp topsoil line is idiomatic for the
  genre, so this is left as is. If a softer transition is wanted, deepen only the bottom
  one or two pixel rows of the four bright tiles (`c3r0`, `c4r0`, `c5r0`, `c6r0`) toward
  ~130 — no new shapes and no renderer change.
- `c6r1` (bright L+R) is unreachable under the banding rule, since L+R means the top edge
  is open and therefore dark. Treated as a spare slot.
- L-only and R-only rely on rotating `c1r1`. If its mild vertical ramp reads badly
  rotated, draw them explicitly into `c5r2` / `c6r2`.

Note for any future gradient tiles: **mirror horizontally, never rotate.** A horizontal
mirror preserves a vertical brightness ramp; rotation turns it sideways.

## Retained reference material

`spring_.png` stays in the repository as a tile catalog even though the atlas replaces it
for `groundGrass`. It should not live under `public/` — Vite copies that directory
verbatim into `dist/`, shipping an unused sheet to the deployed site. Move it somewhere
version-controlled but not deployed, such as `docs/assets/`.

Two properties of `spring_.png` are worth recording, since they drove the atlas's design:
its material bands cannot be mixed (tiles from different bands do not align and leave
visible gaps), and its baked grass-top tiles are self-contained capped columns rather
than tileable strips, so runs built from them read as uneven humps.
