# Contract: editor background palette sections

The Level Editor's background-layer palette (`editor/Palette.tsx`) is split
into two labelled, collapsible sections driven by the catalog family.

## `engine/BackgroundCatalog.ts`

```ts
// `BackgroundPieceFamily` is declared once in `level/LevelData.ts` and imported
// here; the catalog does not re-declare it.
import type { BackgroundPieceFamily } from '../level/LevelData';

export interface BackgroundCatalogEntry {
  sx: number;
  sy: number;
  widthTiles: number;
  heightTiles: number;
  family: BackgroundPieceFamily; // NEW
}

export function backgroundPieceFamily(
  pieceId: BackgroundPieceId,
): BackgroundPieceFamily | undefined;
```

- `dirt*` entries → `'surface'`; `charcoal*` entries → `'cave'`.
- `backgroundPieceFamily` returns `undefined` for an unknown/stale id, never
  throws (same contract as `backgroundCatalogEntry`).

## `editor/backgroundPaletteTiles.ts`

```ts
export interface BackgroundPaletteSection {
  title: string;                       // 'Surface' | 'Cave'
  pieceIds: BackgroundPieceId[];
}

export const BACKGROUND_PALETTE_SECTIONS: readonly BackgroundPaletteSection[];
```

- Every catalog piece appears in exactly one section.
- `Surface` contains all `dirt*` pieces; `Cave` contains all `charcoal*`
  pieces (FR-020).
- Section order is stable and does not depend on `Object.keys` ordering at the
  call site.

## `editor/Palette.tsx` (background layer)

- Renders one `PaletteGroup` per `BACKGROUND_PALETTE_SECTIONS` entry instead of
  the current flat grid.
- Each piece keeps its existing label and click behaviour
  (`onSelectBackgroundPiece`).
- The foreground layer is unchanged; the torch stays in the foreground
  `Decoration` group (FR-022 needs no change).

## Tests (`Palette.test.tsx`, `backgroundPaletteTiles.test.ts`)

- The background layer renders a `Surface` heading and a `Cave` heading.
- Every `dirt*` piece is inside the `Surface` section and no `charcoal*` piece
  is; the reverse holds for `Cave`.
- Clicking a piece in either section still calls
  `onSelectBackgroundPiece(pieceId)`.
- Section membership is total and disjoint over the catalog.
