# Phase 1 Data Model: Platformer Background Tile Rework

## Entity: `BackgroundMaterialId`

Replaces `BackgroundPieceId` (10 piece ids) with 6 material ids.

```ts
export type BackgroundMaterialId =
  | 'dirt' | 'rust' | 'surfaceStone'
  | 'charcoal' | 'maroon' | 'caveStone';
```

## Entity: `BackgroundMaterialFamily`

Renames `BackgroundPieceFamily` (a piece no longer exists as a concept) to
`BackgroundMaterialFamily`. Same two values, same intrinsic-not-per-cell rule
O-010 depends on.

```ts
export type BackgroundMaterialFamily = 'surface' | 'cave';

export const BACKGROUND_MATERIAL_FAMILY: Record<BackgroundMaterialId, BackgroundMaterialFamily> = {
  dirt: 'surface',
  rust: 'surface',
  surfaceStone: 'surface',
  charcoal: 'cave',
  maroon: 'cave',
  caveStone: 'cave',
};

export function backgroundMaterialFamily(material: BackgroundMaterialId): BackgroundMaterialFamily {
  return BACKGROUND_MATERIAL_FAMILY[material];
}
```

Unlike the old `backgroundPieceFamily`, this does **not** need to return
`undefined` for an unknown id — `BackgroundMaterialId` is a closed union and
every grid cell is validated to that union at the type level. The "unknown
material in saved data" edge case (FR-012) is handled one layer up, where a
raw string from JSON is narrowed to `BackgroundMaterialId | null` (see
`BackgroundGrid` below) before anything calls `backgroundMaterialFamily`.

## Entity: `BackgroundGrid`

Replaces `BackgroundPlacement[]`. A dense grid, same shape as `TileMap`, one
entry per cell — `null` means empty (parallax/void shows through).

**Revision (storage-unification):** `BackgroundGrid` itself, and everything
below in this section (`backgroundAt`'s out-of-bounds contract, the
FR-012/FR-013 validation rules), is unchanged and still exactly what
`BackgroundAtlas`/`Renderer`/`Lighting` consume. What changed is where it
comes from: it is no longer stored directly. A level/blueprint file stores
`background` as a compact `readonly string[]` layout (`BACKGROUND_CHARS`,
mirroring how `layout` stores terrain), and `level/LevelParser.ts`'s
`parseBackgroundLayout(layout, terrainWidth, terrainHeight)` produces the
`BackgroundGrid` below from it at load time — the same relationship
`parseLevel` already has to `TileMap`. The editor's own in-memory background
grid is a parallel `BackgroundChar[][]` character grid, not `BackgroundGrid`
directly, mirroring `editorLevelSignal`'s `TileChar[][]` relationship to
`TileMap`. See `docs/themes/platformer/LevelFormat.md` for the full
character table and saved-file shape, and design.md's "Revision: background
storage unified with the foreground's `string[]` layout format" for the
rationale.

```ts
export type BackgroundGrid = (BackgroundMaterialId | null)[][];

export interface LevelDef {
  terrain: TileMap;
  width: number;
  height: number;
  background?: BackgroundGrid;   // was: BackgroundPlacement[]
}
```

**Access helper** (`level/Terrain.ts`, mirrors `tileAt`):

```ts
export function backgroundAt(level: LevelDef, col: number, row: number): BackgroundMaterialId | null {
  const row_ = level.background?.[row];
  if (!row_) return null;
  const cell = row_[col];
  return cell ?? null;
}
```

Out-of-bounds and missing `background` both resolve to `null` (empty),
mirroring `tileAt`'s out-of-bounds-returns-`'empty'` contract. An unrecognized
string surviving from old/malformed JSON is filtered to `null` at load time
(FR-012), not at read time — `backgroundAt` never has to guess.

**Validation / invariants**:
- Old `BackgroundPlacement[]` data (an array, not a 2D grid) fails the grid
  shape check at load and the level loads with `background` unset entirely —
  same effect as `null` everywhere (FR-013).
- The grid MAY be smaller than `terrain`'s bounds; `backgroundAt` treats any
  cell outside the grid's own bounds as `null`, the same way it treats a
  missing `background` field.

## Entity: `BackgroundNeighbourMask`

A 4-bit value per non-empty cell, computed the same way `neighbourMask`
computes it for terrain, but counting only **same-material** neighbours as
connected (FR-004). Reuses the existing bit constants from `Terrain.ts`:

```ts
// already exported by Terrain.ts — reused, not redefined
export const NEIGHBOUR_UP = 1;
export const NEIGHBOUR_RIGHT = 2;
export const NEIGHBOUR_DOWN = 4;
export const NEIGHBOUR_LEFT = 8;

export function backgroundNeighbourMask(level: LevelDef, col: number, row: number): number {
  const material = backgroundAt(level, col, row);
  let mask = 0;
  if (backgroundAt(level, col, row - 1) === material) mask |= NEIGHBOUR_UP;
  if (backgroundAt(level, col + 1, row) === material) mask |= NEIGHBOUR_RIGHT;
  if (backgroundAt(level, col, row + 1) === material) mask |= NEIGHBOUR_DOWN;
  if (backgroundAt(level, col - 1, row) === material) mask |= NEIGHBOUR_LEFT;
  return mask;
}
```

Because `material` is compared by strict equality against the neighbour's own
`backgroundAt` result, a `null` cell (`material` itself being `null`) is
never passed to `backgroundAtlasCell` — the renderer only calls this for
non-`null` cells (User Story 2: a different material, or empty space, never
counts as connected — this falls out for free because `null !== 'dirt'` etc.).

## Entity: `BackgroundAtlasEntry` and the 16-mask rotation table

Structurally identical to `GroundAtlasEntry`, minus the `kind` (bright/dark)
field — the spec's "fully flat" clarification means every mask for a given
material has exactly one sprite, not two.

```ts
export type QuarterTurns = 0 | 1 | 2 | 3;  // reused from GroundAtlas.ts

export interface BackgroundAtlasEntry {
  sx: number;
  sy: number;
  rotation: QuarterTurns;
}
```

### Sheet layout (`public/sprites/background_tiles.png`)

- Tile size: 16×16px. Gutter: 3px between tiles, 6px between material rows.
- 4 columns × 3 rows per material (12 tiles/material), 6 materials stacked
  vertically. Column stride: 19px (`TILE + GAP` = 16 + 3). Row stride within a
  material: 19px. Material row pitch: 60px (`3*16 + 2*3 + 2*3` = 54 + 6).

| Material index | Material id |
| --- | --- |
| 0 | `dirt` |
| 1 | `rust` |
| 2 | `surfaceStone` |
| 3 | `caveStone` |
| 4 | `maroon` |
| 5 | `charcoal` |

Per-material 4×3 grid (`gx` 0–3, `gy` 0–2), pixel origin
`sx = gx * 19`, `sy = materialIndex * 60 + gy * 19`:

| gy \ gx | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| 0 | corner (TL) | edge (T) | corner (TR) | stripCap |
| 1 | edge (L) | middle | edge (R) | stripBody |
| 2 | corner (BL) | edge (B) | corner (BR) | isolated |

### The 16-entry mask table (identical shape for every material — only `sx`/`sy` differ)

Six physical tiles per material — `corner`, `edge`, `middle`, `stripCap`,
`stripBody`, `isolated` — cover all 16 masks via rotation, exactly the
technique `GroundAtlas` uses. Bit convention: a set bit means that side's
neighbour is the **same material** (open, no border drawn there); a clear bit
means that side is closed (border drawn) — an empty cell or a different
material both count as closed.

| mask | connects | source tile | rotation |
| --- | --- | --- | --- |
| 0 | none | `isolated` | 0 |
| 1 | up | `stripCap` | 180 |
| 2 | right | `stripCap` | 270 |
| 3 | up+right | `corner` (BL) | 0 *(the sheet's own BL corner art, not a re-rotation — see note)* |
| 4 | down | `stripCap` | 0 |
| 5 | up+down | `stripBody` | 0 |
| 6 | right+down | `corner` (TL) | 0 |
| 7 | up+right+down | `edge` (L) | 0 |
| 8 | left | `stripCap` | 90 |
| 9 | up+left | `corner` (BR) | 0 |
| 10 | left+right | `stripBody` | 90 |
| 11 | up+right+left | `edge` (B) | 0 |
| 12 | down+left | `corner` (TR) | 0 |
| 13 | up+down+left | `edge` (R) | 0 |
| 14 | right+down+left | `edge` (T) | 0 |
| 15 | up+right+down+left | `middle` | 0 |

**Note on corner/edge rotation**: the sheet already contains all four corner
orientations and all four edge orientations as distinct crops (see the 4×3
grid above), each already the correctly-rotated art (they were produced by
rotating one source crop when the art was authored — see design.md). The
`BackgroundAtlas` table therefore references each of the four corner sprites
and four edge sprites directly by their sheet position with `rotation: 0`; it
does not re-rotate them again at render time. Only `stripCap` (used for masks
1, 2, 4, 8) and `stripBody` (used for masks 5, 10) are reused across multiple
masks via an actual `rotation` value, because the sheet only contains one
orientation of each of those two shapes.

Concretely, `BACKGROUND_ATLAS[material]`:

```ts
const BACKGROUND_ATLAS: Record<BackgroundMaterialId, Record<number, BackgroundAtlasEntry>> = {
  dirt: {
    0:  { ...cell(0, 3, 2), rotation: 0 },  // isolated
    1:  { ...cell(0, 3, 0), rotation: 2 },  // stripCap, 180
    2:  { ...cell(0, 3, 0), rotation: 3 },  // stripCap, 270
    3:  { ...cell(0, 0, 2), rotation: 0 },  // corner BL
    4:  { ...cell(0, 3, 0), rotation: 0 },  // stripCap
    5:  { ...cell(0, 3, 1), rotation: 0 },  // stripBody
    6:  { ...cell(0, 0, 0), rotation: 0 },  // corner TL
    7:  { ...cell(0, 0, 1), rotation: 0 },  // edge L
    8:  { ...cell(0, 3, 0), rotation: 1 },  // stripCap, 90
    9:  { ...cell(0, 2, 2), rotation: 0 },  // corner BR
    10: { ...cell(0, 3, 1), rotation: 1 },  // stripBody, 90
    11: { ...cell(0, 1, 2), rotation: 0 },  // edge B
    12: { ...cell(0, 2, 0), rotation: 0 },  // corner TR
    13: { ...cell(0, 2, 1), rotation: 0 },  // edge R
    14: { ...cell(0, 1, 0), rotation: 0 },  // edge T
    15: { ...cell(0, 1, 1), rotation: 0 },  // middle
  },
  // rust: cell(1, gx, gy) for every entry above, same mask->(gx,gy,rotation) shape
  // surfaceStone: cell(2, gx, gy), caveStone: cell(3, gx, gy),
  // maroon: cell(4, gx, gy), charcoal: cell(5, gx, gy)
};

function cell(materialIndex: number, gx: number, gy: number) {
  return { sx: gx * 19, sy: materialIndex * 60 + gy * 19 };
}
```

Since the `(gx, gy, rotation)` shape is identical for every material (only
`materialIndex` changes), the real implementation builds this table with one
small loop over `BACKGROUND_MATERIAL_FAMILY`'s keys plus one shared
`mask -> (gx, gy, rotation)` table, rather than repeating the 16-entry object
six times — the six-material repetition shown above is for exposition; Task
work in `tasks.md` will specify the deduplicated form.

**Validation / invariants**:
- `backgroundAtlasCell(material, mask)` MUST have an entry for every mask
  0–15 for every material (SC-005) — test asserts completeness the same way
  `GroundAtlas.test.ts` asserts it for `groundAtlasCell`.
- No `kind` field — the spec's "fully flat" clarification means a mask's
  sprite is the same regardless of what's above the cell.

## Entity: `BackgroundDecorEntry` (rocks)

```ts
export interface BackgroundDecorEntry {
  sx: number;
  sy: number;
}

export function backgroundRockEntry(col: number, row: number): BackgroundDecorEntry {
  return pickVariant(ROCK_VARIANTS, col, row); // reuses the same hash as StaticObjectsCatalog.pickVariant
}
```

**Placement rule** (FR-008): the renderer only calls `backgroundRockEntry` for
a cell whose `backgroundNeighbourMask` is 15 (fully interior/`middle`) — the
one shape guaranteed to have no border art a rock could overlap.

## Relationships

```
LevelDef.background: BackgroundGrid
        │
        ├─ backgroundAt(level,col,row) ──▶ BackgroundMaterialId | null
        │                                        │
        │                          backgroundMaterialFamily(material)
        │                                        │
        │                          isCellDarkening(level,col,row) ──▶ boolean (O-010)
        │
        └─ backgroundNeighbourMask(level,col,row) ──▶ 0..15
                                    │
                      backgroundAtlasCell(material, mask) ──▶ {sx,sy,rotation}
                                    │
                              drawBackgroundTiles (Renderer.ts)
                                    │
                    mask===15 ? backgroundRockEntry(col,row) : (nothing)
```

## Constants (single source of truth, `engine/BackgroundAtlas.ts`)

| Constant | Value | Meaning |
| --- | --- | --- |
| `BACKGROUND_ATLAS_STRIDE` | 19 | Tile size (16) + gutter (3), matches the authored sheet. |
| `BACKGROUND_ATLAS_ROW_PITCH` | 60 | Vertical distance between one material's block and the next (`3*16 + 2*3 + 2*3`). |
| `BACKGROUND_MATERIAL_ROW_INDEX` | see table above | `Record<BackgroundMaterialId, number>`, 0–5. |
