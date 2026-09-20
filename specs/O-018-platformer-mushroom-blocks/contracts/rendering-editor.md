# Contract: rendering, sprite sheet and editor

This contract covers the sprite asset, the draw branch, the editor palette and
the documentation updates.

## Sprite sheet — `entities/sprites/sheets.ts`

```ts
/** `mushroom.png` is a 64x64 sheet: a 4x4 grid of 16px cells, one row per cap
 *  colour (red/orange/purple/green). O-018 uses only the red cap variant
 *  (row 0): col 0 is the complete mushroom, col 1 the cap + connector, col 2
 *  the small decorative mushroom, and col 3 the plain stalk at row 0. The one
 *  cross-row read is the `bottom` foot at (48, 16) — row 1 is the orange row,
 *  but that cell holds only the shared, colour-neutral tan stem/foot art (no
 *  orange cap pixels), identical in palette to the red row's own stalk at
 *  (48, 0); it is therefore not an orange-variant use (see spec FR-003).
 *  `StaticObjectsCatalog.ts` addresses it through its own sx/sy lookup, not by
 *  frame index — like `DECORATIONS_SHEET`, this registration exists for
 *  loading, not addressing. */
export const MUSHROOM_SHEET: SpriteSheet = {
  src: '/sprites/mushroom.png',
  frameWidth: TILE_SIZE,   // 16 — loading-only registration
  frameHeight: TILE_SIZE,  // 16 — NOT used for addressing
  columns: 4,
};
```

Load it in both `PlatformerPage.tsx` (a `mushroomRef`, drawn from the
`playing` render pass) and `EditorCanvasPane.tsx` (an `EditorImages.mushroom`
field added to `EMPTY_IMAGES` and `IMAGE_SOURCES`), the same dual-load
convention `DECORATIONS_SHEET`/`TORCH_SHEET` already use.

## Sprite rects — `engine/StaticObjectsCatalog.ts`

```ts
/** The cap rows of an `only`/`top` cell; rows 11-15 are the stem/connector. */
export const MUSHROOM_CAP_SOURCE_HEIGHT = 11;

const MUSHROOM_ROLE_ENTRIES: Record<VerticalRunRole, StaticObjectEntry> = {
  only: { sx: 0, sy: 0 },
  top: { sx: 16, sy: 0 },
  middle: { sx: 48, sy: 0 },
  bottom: { sx: 48, sy: 16 },
};

export function mushroomEntry(role: VerticalRunRole): StaticObjectEntry;
export function mushroomHasCap(role: VerticalRunRole): boolean; // only | top
export const MUSHROOM_DECORATIVE_ENTRY: StaticObjectEntry;      // { sx: 32, sy: 0 }
```

## Renderer — `engine/Renderer.ts`

- `tileSource` gains `case 'bouncyMushroom'` and `case 'decorativeMushroom'`,
  both returning `null` with a comment pointing at `drawTerrain`'s mushroom
  branch (the exhaustiveness check forces these cases).
- `drawTerrain` gains two trailing optional parameters:
  `mushroom: HTMLImageElement | null = null` and
  `mushroomSquashes: readonly MushroomSquashState[] = []`.
- A new branch in the cell loop, inserted **immediately after the torch branch
  and before the `chain` branch** (the `chain` branch is what sits directly
  before the generic `tileSource` lookup). Within the mushroom branch,
  `decorativeMushroom` is handled first, then `bouncyMushroom`, giving the
  loop order `groundGrass` → `bush` → `fence` → `cobweb` → `crystalCluster` →
  `stalactite` → `stalagmite` → `torch` → `decorativeMushroom` →
  `bouncyMushroom` → `chain` → `tileSource`:

```ts
if (mushroom && tile === 'decorativeMushroom') {
  // Single fixed cell; art already sits in the lower part of the tile.
  ctx.drawImage(mushroom, 32, 0, TILE_SIZE, TILE_SIZE,
    destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
  continue;
}

if (mushroom && tile === 'bouncyMushroom') {
  const role = verticalRunRole(level, col, row, 'bouncyMushroom');
  const entry = mushroomEntry(role);
  if (mushroomHasCap(role)) {
    const dip = mushroomSquashDipAt(mushroomSquashes, col, row); // rendered px
    const capH = MUSHROOM_CAP_SOURCE_HEIGHT;
    // Stem/connector first, unshifted, so only the cap moves.
    ctx.drawImage(mushroom, entry.sx, entry.sy + capH, TILE_SIZE, TILE_SIZE - capH,
      destX, destY + capH * RENDER_SCALE, RENDERED_TILE_SIZE, (TILE_SIZE - capH) * RENDER_SCALE);
    // Cap, dipped.
    ctx.drawImage(mushroom, entry.sx, entry.sy, TILE_SIZE, capH,
      destX, destY + dip, RENDERED_TILE_SIZE, capH * RENDER_SCALE);
  } else {
    ctx.drawImage(mushroom, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
      destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
  }
  continue;
}
```

- `dip` is in rendered pixels and defaults to 0 (no active squash), so the
  unsquashed draw is exactly the whole sprite.
- Uses `imageSmoothingEnabled = false` (already set at the top of
  `drawTerrain`) and the same `originX`/`originY` convention as every other
  branch.

## Game wiring — `PlatformerPage.tsx`

- Call `drawTerrain(..., worldAnimElapsed, mushroomRef.current,
  mushroomSquashStates.value)` with the same camera origin as today.

## Editor — `editor/`

### `EditorCanvas.tsx`

- `EditorImages` (defined here) gains `mushroom: HTMLImageElement | null`.
- Pass `images.mushroom` to `drawTerrain`; the squash list is omitted (the
  editor preview is static, `worldElapsed = 0`), so every mushroom renders
  unsquashed.

### `EditorCanvasPane.tsx`

```ts
// EMPTY_IMAGES
mushroom: null,
// IMAGE_SOURCES
{ key: 'mushroom', src: MUSHROOM_SHEET.src },
```

`EditorCanvas.test.tsx`'s own `EMPTY_IMAGES` fixture gains the same
`mushroom: null` field. Its three exact-argument `toHaveBeenCalledWith`
assertions for `drawTerrain` (the "both the tileset and the ground atlas"
case and the `staticObjectsLoaded`/`torchLoaded` pass-through cases) MUST also
be extended with the new trailing `images.mushroom` argument — `toHaveBeenCalledWith`
requires an exact argument-count match, so they fail otherwise.

### `paletteTiles.ts`

```ts
'§': {
  sheet: '/sprites/mushroom.png',
  sheetWidth: 64,
  sheetHeight: 64,
  sx: 0,
  sy: 0,
  frameWidth: 16,
  frameHeight: 16,
},
s: {
  sheet: '/sprites/mushroom.png',
  sheetWidth: 64,
  sheetHeight: 64,
  sx: 32,
  sy: 0,
  frameWidth: 16,
  frameHeight: 16,
},
// PALETTE_TILE_LABELS['§']        = 'Bouncy Mushroom'
// PALETTE_TILE_LABELS['s']        = 'Small Mushroom'
// PALETTE_TILE_DESCRIPTIONS['§']  = 'Land on its cap to be launched upward;
//                                     walk and jump through it freely'
// PALETTE_TILE_DESCRIPTIONS['s']  = 'Small mushroom; purely decorative, no effect'
```

Note `'§'` is quoted because `§` is not a valid JS identifier; `s` stays
unquoted. Both entries are keyed by `TileChar`.

### `Palette.tsx`

- Add `'s'` to `DECORATION_CHARS` so the small mushroom lands in the
  **Decoration** group. `'§'` is ordinary terrain and appears in **Terrain**
  automatically. No `toolKeys` change.

## Documentation — `docs/themes/platformer/`

- `Terrain.md`: add `bouncyMushroom`/`decorativeMushroom` to the `TileType`
  table; add `isStandableMushroomCap` to the standable/one-way section beside
  `isStandableLadderTop`; note the mushroom in the run-helpers section; record
  the cap squash as the one piece of transient per-cell state (and that the
  "terrain kinds do not own their own rules" gap stays open).
- `LevelFormat.md`: add `§` → `bouncyMushroom` and `s` → `decorativeMushroom`
  to the terrain character table, with behaviour notes.

## Tests

- `engine/StaticObjectsCatalog.test.ts` — role entries and `mushroomHasCap`;
  `MUSHROOM_CAP_SOURCE_HEIGHT` stays within the 16px cell.
- `engine/Renderer.test.ts` — the four roles draw the expected crops; an
  active squash shifts only the cap; `decorativeMushroom` draws its fixed cell;
  no sheet → mushrooms draw nothing but the rest of the terrain still renders.
- `editor/paletteTiles.test.ts` — `§`/`s` sprite/label/description entries.
- `editor/Palette.test.tsx` — `s` renders in the Decoration group, `§` in
  Terrain.
