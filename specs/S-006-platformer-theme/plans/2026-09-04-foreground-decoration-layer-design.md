# Foreground Decoration Tiles (Bush/Tree + Fence) — Design

## Roadmap status

Step **36** in `roadmap.md`, right after the background tile layer (35a/35b).
Independent of it — this reuses the existing single-character terrain-grid mechanism,
not the background layer's sparse placement-list mechanism.

## Goal and scope

Add two new purely-visual terrain tiles: a **bush/tree** tile (`n`) and a **fence** tile
(`N`), painted into the level layout exactly like any other terrain character. Both
occupy grid cells and never block movement (the player walks/jumps through them freely,
like `patrol`/`empty` already do).

**Bush/tree height comes from how many `n` are stacked in a column, with no upper
limit** — the same run-length idea `bridgeRunPosition`/`horizontalRunPosition` already
use for bridges of any length, just read vertically instead of horizontally and applied
per-tile instead of as one big multi-tile sprite (a tree can't have a fixed-size source
image if its height is unbounded):

- A lone `n` (nothing `n` directly above or below) renders as a **bush**.
- Two or more `n` stacked render as a **tree**: the bottom-most tile draws a root/stem
  piece, the top-most tile draws a canopy piece, and every tile strictly between them
  (none for a 2-stack, one for a 3-stack, more for taller stacks) draws a repeatable
  trunk piece. Each of the three roles is its own ordinary 16px tile draw at its own
  cell — there's no multi-tile source image or special draw-rect math, so height is
  naturally unbounded.

**Visual variety**: which sprite renders — independently for a lone bush, a root, a
trunk segment, or a canopy — is picked deterministically from that cell's column and
row, so a row of bushes, or a tall tree's run of trunk segments, doesn't look like one
sprite copy-pasted. Deterministic, not random, so a level always renders identically on
every load.

Because every stack height is a legitimate, complete shape, **there is no invalid state
to prevent**: painting a lone `n` is a finished bush, not a mistake waiting to be
completed, so the editor needs no special paint-time auto-completion, and erasing any
one tile of a stack (shrinking a tall tree by one tile, or a bush to nothing) never leaves
something broken behind. Both act exactly like painting/erasing any other terrain tile.

## Data model

Two new `TileType` values, added to the existing union in `LevelData.ts`:

```typescript
export type TileType =
  | 'groundGrass'
  | 'groundRock'
  | 'wall'
  | 'bridge'
  | 'ladder'
  | 'patrol'
  | 'bush'
  | 'fence'
  | 'empty';
```

(Named `'bush'` since that's the tile's default/minimum rendered form; a taller stack of
the same `TileType` renders as a tree — see Rendering.)

`Terrain.ts`'s `isSolid()` and `isClimbable()` are **not** touched — both already default
to `false` for any tile not explicitly listed, so `bush`/`fence` are non-solid,
non-climbable automatically, the same way `patrol` already is.

New `TERRAIN_CHARS` entries in `LevelParser.ts`:

| Element | Char |
|---|---|
| bush / tree (by stack height) | `n` |
| fence | `N` |

Both are unclaimed today (charset so far: `. G R W B L P` terrain, `S E M C X Q F T`
entities, `1`-`5` signs — case-sensitive, so lowercase `n` and uppercase `N` are both
free and independent of each other). No other existing character needs to move.

## Assets

`public/sprites/staticObjects.png`, 288×144px, currently unused anywhere in the
codebase — 16px source tiles, an 18×9 tile sheet. Holds fence art, every bush variant,
and the tree's three-piece set (root, repeatable trunk, canopy), each with one or more
variants. As with prior atlas work, this design fixes the *mechanism*; the exact
per-piece `sx`/`sy` table (including how many variants exist per piece) is pinned down
hands-on during implementation — if the sheet turns out to only hold one design per
piece, the position-based variant selection degenerates to always picking that one
entry, which is a valid, harmless outcome of the same mechanism.

## Rendering

`drawTerrain` (`Renderer.ts`) currently draws from two images: `tileset`
(`world_tileset.png`, generic tiles via `tileSource()`) and `groundAtlas`
(`groundGrass`'s own autotiled path, special-cased before the generic fallback). It
gains a third image parameter, `staticObjects`, and a third special-cased branch — same
shape as the existing `groundGrass` branch — for `bush`/`fence`, added right before the
generic `tileSource` fallback:

```typescript
if (tile === 'fence') {
  const entry = staticObjectEntry('fence', col, row);
  ctx.drawImage(
    staticObjects, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
    destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
  );
  continue;
}
if (tile === 'bush') {
  const role = verticalRunRole(level, col, row, 'bush'); // 'only' | 'bottom' | 'middle' | 'top'
  const entry = bushOrTreeEntry(role, col, row); // variant picked from (col, row)
  ctx.drawImage(
    staticObjects, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
    destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
  );
  continue;
}
```

Every `bush` cell draws its own ordinary single-tile slice — no multi-tile draw rect, no
skipping cells in a run. `role` is `'only'` (a lone tile, drawn as a bush), `'bottom'`
(the lowest tile of a run of 2+, drawn as a root/stem), `'top'` (the highest tile of a
run of 2+, drawn as a canopy), or `'middle'` (any tile strictly between bottom and top,
drawn as a repeatable trunk segment — only appears for runs of 3 or more). Anything
genuinely layered above terrain (player, entities, blocks) still draws in a later pass
than `drawTerrain`, so it correctly renders in front of a tall tree's canopy wherever
the two overlap — same as it already does over ordinary terrain.

New `engine/StaticObjectsCatalog.ts` (parallel in spirit to `BackgroundCatalog.ts`):

```typescript
export type VerticalRunRole = 'only' | 'bottom' | 'middle' | 'top';

export function staticObjectEntry(tile: 'fence', col: number, row: number): { sx: number; sy: number };

export function bushOrTreeEntry(
  role: VerticalRunRole,
  col: number,
  row: number,
): { sx: number; sy: number };

export function verticalRunRole(
  level: LevelDef,
  col: number,
  row: number,
  tile: TileType,
): VerticalRunRole;
```

`verticalRunRole` is a small, generic, pure helper (lives alongside `Terrain.ts`'s other
neighbour-inspecting helpers like `isTopExposed`/`bridgeRunPosition`): compares
`tileAt(level, col, row - 1)` and `tileAt(level, col, row + 1)` against `tile` to
classify the cell — matching neither → `'only'`; matching below but not above →
`'bottom'`; matching above but not below → `'top'`; matching both → `'middle'`. No cap,
no run-length counting needed at all — classification only ever looks at the immediate
neighbour above and below, so an arbitrarily tall stack costs no more per cell than a
short one. `bushOrTreeEntry` and `staticObjectEntry`/`fence` index into small fixed
catalog arrays (one array per role, for `bushOrTreeEntry`) using a deterministic formula
on `col`/`row` (e.g. `(col * 31 + row * 17) % variantCount` — exact constants are an
implementation detail, not a design commitment; any formula mixing both axes and
avoiding an obvious short-period repeat pattern qualifies) — pulled out as pure,
unit-testable functions rather than inlined in `tileSource`.

`PlatformerPage.tsx` and `EditorCanvas.tsx` each need a new loaded-image ref
(`staticObjectsRef`, following the exact loading pattern already used for
`groundAtlasRef`/`backgroundAtlasRef`) threaded into their `drawTerrain` calls.

## Editor UX

No new layer, no new tab — `bush`/`fence` are `TERRAIN_CHARS` entries, so they
automatically appear in the existing Foreground palette tab via `Palette.tsx`'s current
`terrainKeys` derivation. The only change: `Palette.tsx` groups the Foreground tab's
tiles under small subtitle headers instead of one flat grid — "Terrain" (the existing
ground-like chars: grass, rock, wall, bridge, ladder, patrol), "Decoration" (bush/tree,
fence), and "Entities" (the existing `ENTITY_CHARS` group) — addressing the palette
readability point from earlier discussion without introducing any new placement
mechanism. This needs one small addition: an explicit `DECORATION_TILE_CHARS` list (or
similar) so `Palette.tsx` can partition `terrainKeys` into "Terrain" vs "Decoration" for
display purposes only — it carries no runtime meaning beyond the palette's own grouping.

Painting/erasing `bush`/`fence` needs **no new code at all** — `paintCell.ts` already
handles every `TERRAIN_CHARS` character uniformly, and because every stack height is a
valid shape, there's nothing special to guarantee: painting a lone `n` is a complete
bush; painting a second `n` above it grows a complete short tree; erasing any one tile
of a stack leaves behind another complete, valid shape (or nothing).

The palette button for `n` can only show one static thumbnail — the bush (height-1)
art, same as every other `PaletteTile` today (`PALETTE_TILE_SPRITES`, one fixed sprite
per char). It can't preview "what this looks like stacked," since that depends on
what's painted next to it on the canvas — the tree behavior is discovered by painting a
stack, not by looking at the palette icon. This is a one-time expectation-setting detail
(worth a line in the palette tile's description tooltip) rather than a design gap.

## Testing

Tests first, per the constitution:

- `Terrain.ts` — `isSolid('bush' | 'fence')` and `isClimbable(...)` are both `false`.
  `verticalRunRole` returns `'only'` for an isolated tile, `'bottom'`/`'top'` for the two
  ends of a 2-stack, and `'bottom'`/`'middle'`/`'top'` for a 3+ stack (with as many
  `'middle'` classifications as the stack needs), and handles the top of the level
  correctly (out-of-bounds reads as `'empty'`, so a tile at row 0 can never see a match
  above it) without throwing.
- `LevelParser.ts` — `n`/`N` parse to the right `TileType`; the char-collision guard
  still passes.
- `StaticObjectsCatalog.ts` — `fence` resolves to a fixed entry regardless of position;
  `bushOrTreeEntry` is deterministic per role (same `(role, col, row)` always yields the
  same variant) and actually varies across different positions within a role; each role
  (`only`/`bottom`/`middle`/`top`) picks from its own distinct variant set.
- `Renderer.ts` — `drawTerrain` draws `fence` from the `staticObjects` image at the
  right destination; a lone `bush` cell draws the `'only'` art; a 2-stack draws
  `'bottom'` then `'top'`; a 4-stack draws `'bottom'`, two `'middle'` tiles, then `'top'`
  — confirming height genuinely has no upper limit.
- `Palette.tsx` — Foreground tab renders bush/fence under a "Decoration" subtitle,
  distinct from the existing "Terrain" and "Entities" groups.

Manual verification: in the Level Editor, paint a lone bush, a 2-stack, and a tall
(5+) stack in the same level and confirm each renders as a distinct, complete tree
shape with a visible root, repeated trunk, and canopy; paint a fence tile; confirm the
player walks straight through all of them, including through a tall tree's canopy and
trunk; erase one tile from the middle of a tall stack and confirm the two remaining
pieces re-classify correctly (e.g. the piece that's now at the top redraws as a canopy).

## Open items

- Pin down the exact `staticObjects.png` sx/sy table for each of the four roles
  (bush/root/trunk/canopy), including how many variants exist per role, during
  implementation.
- Whether fence also eventually wants position-based (or neighbour-based, like autotiled
  grass — e.g. connecting fence posts into a continuous rail) is left open — only
  bush/tree have a stated need right now.
- An entity or sign placed in the `empty` cell(s) a tall tree's canopy/trunk draws over
  will render in front of it (entities/signs draw after terrain) — a minor visual
  overlap left as an authoring consideration rather than something the engine prevents.
