# Contract — `TileAtlas` (`engine/TileAtlas.ts`) + shared `pickVariant`

## `engine/TileAtlas.ts`

```ts
export type QuarterTurns = 0 | 1 | 2 | 3;
export interface TileAtlasEntry {
  sx: number;
  sy: number;
  rotation: QuarterTurns;
}
export const ATLAS_STRIDE = 19;   // 16px tile + 3px gutter
export function atlasCell(col: number, row: number): { sx: number; sy: number };  // { sx: col*19, sy: row*19 }
```

## Import contract

| Module | Imports from TileAtlas | Keeps locally |
| --- | --- | --- |
| `GroundAtlas.ts` | `QuarterTurns`, `ATLAS_STRIDE`, `atlasCell` | `GroundTileKind`, `GROUND_ATLAS` table, `groundTileKind`, `GRASS_CELLS`, `GRASS_SOURCE_HEIGHT` |
| `BackgroundAtlas.ts` | `QuarterTurns`, `ATLAS_STRIDE`, `TileAtlasEntry` | `BACKGROUND_ATLAS_ROW_PITCH = 60`, its material-pitched `cell`, `BACKGROUND_ATLAS` table |

Each module defines its own entry type as an extension of `TileAtlasEntry`:
`GroundAtlasEntry extends TileAtlasEntry { kind: GroundTileKind }`, `BackgroundAtlasEntry extends
TileAtlasEntry`.

## Invariants

1. **One definition each** — `QuarterTurns`, `ATLAS_STRIDE`, and the `{sx,sy,rotation}` shape appear
   exactly once (SC-003). Neither atlas re-declares them.
2. **No behavior change** — the stride, rotation meanings, and mask→entry tables are unchanged; only
   the import source moves.
3. **BackgroundAtlas's `cell` is intentionally distinct** (it layers a material row pitch of 60px) and
   is not forced through `atlasCell` (research.md R3.1).

## Shared `pickVariant` (FR-011)

```ts
// exported from engine/StaticObjectsCatalog.ts; imported by engine/BackgroundDecorCatalog.ts
export function pickVariant<T>(variants: readonly T[], col: number, row: number): T;
```

- Backed by `hash2D` from `shared/math.ts`: `const hash = hash2D(col, row); const index = hash % variants.length;`.
- Preserves the empty-array guard (throws `'pickVariant: no variants provided'`).
- `BackgroundDecorCatalog` no longer holds its own copy.
