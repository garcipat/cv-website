# Background Tile Layer — Step 35a (Freeform Placement) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let level design paint a second, purely-visual tile layer (stone chunks from
`terrain_.png`, dirt and charcoal colours) behind the terrain layer, using the Level
Editor, and have it render in both the editor preview and the real game.

**Architecture:** A sparse list of `BackgroundPlacement` entries (`{ pieceId, col, row }`)
on `LevelDef`, resolved against a small hardcoded piece catalog (`BackgroundCatalog.ts`)
for their pixel rect and tile footprint. The renderer draws every placement's real pixels
at its anchor, inserted into the existing draw sequence right after the sky and before
the terrain. The Level Editor gets a Foreground/Background palette tab; painting calls
pure placement functions that mirror the existing foreground paint/erase conventions
(overlap replaces, right-click always erases).

**Tech Stack:** React 19 + TypeScript strict, Vitest + React Testing Library, Canvas 2D
rendering, `@preact/signals-react` for reactive level state.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-03-background-tile-layer-design.md`
(architecture, asset measurements, rationale) and
`specs/S-006-platformer-theme/roadmap.md` (step 35a/35b split).

## Global Constraints

- TypeScript `strict: true`, no `any`, no `@ts-ignore` (constitution Principle I / III).
- Tests first (constitution Principle II — TDD, NON-NEGOTIABLE). Test naming for new
  behaviour-specific tests follows `{method}-{Condition}-{ExpectedResult}` (see
  `paintCell.test.ts`'s second `describe` block for the house style).
- Named arrow function exports, props interfaces in the same file, `cn()` for conditional
  Tailwind classes, no default exports (constitution Principle III).
- Relative imports (`./`, `../`) within `src/themes/platformer/`; `@/` only for
  cross-cutting app infrastructure (shadcn UI, shared app state) — matches this folder's
  existing convention.
- No new dependencies.
- The background layer is purely visual: it must never be read by collision/physics code.
  Only the renderer and the editor consume it.

---

## File Structure

- **Create** `src/themes/platformer/engine/BackgroundCatalog.ts` — the piece catalog
  (pixel rect + tile footprint per `BackgroundPieceId`), pure data + one lookup function.
  Parallel in spirit to `GroundAtlas.ts`, but a flat table, not a neighbour-mask table.
- **Create** `src/themes/platformer/editor/paintBackgroundCell.ts` — pure functions
  `placeBackgroundPiece`/`eraseBackgroundCell` operating on a `BackgroundPlacement[]`,
  mirroring `paintCell.ts`'s "grow/replace, return the next array" shape.
- **Create** `src/themes/platformer/editor/backgroundPaletteTiles.ts` — the
  `TileSpriteSpec` table for background pieces, mirroring `paletteTiles.ts`'s pattern,
  kept separate so `paletteTiles.ts` (foreground-only today) doesn't grow a second,
  unrelated concern.
- **Modify** `src/themes/platformer/level/LevelData.ts` — add `BackgroundPieceId`,
  `BackgroundPlacement`, and `LevelDef.background`.
- **Modify** `src/themes/platformer/engine/Renderer.ts` — add `drawBackgroundTiles`.
- **Modify** `src/themes/platformer/editor/EditorCanvas.tsx` — draw the background layer
  before terrain; route painting to the background functions when that layer is active;
  add a `backgroundAtlas` image slot.
- **Modify** `src/themes/platformer/editor/Palette.tsx` — add the Foreground/Background
  tab and the background piece buttons.
- **Modify** `src/themes/platformer/editor/editorLevelState.ts` — three new persisted
  signals (background placements, active layer, selected background piece).
- **Modify** `src/themes/platformer/editor/LevelEditorPage.tsx` — wire the new state
  through load/export/save/Try, alongside the existing `grid`/`selectedTool` wiring.
- **Modify** `src/themes/platformer/level/level.ts` — add `currentBackground` and merge
  it into `currentLevel`.
- **Modify** `src/themes/platformer/PlatformerPage.tsx` — load the background atlas image
  and call `drawBackgroundTiles` in the real game's render loop.
- **Modify** `src/themes/platformer/level/levelRegistry.ts` — carry `background` through
  saved/loaded level entries.
- **Modify** `src/themes/platformer/editor/saveLevelFile.ts` — include `background` in
  the saved/downloaded JSON.

---

### Task 1: Background piece catalog

**Files:**
- Create: `src/themes/platformer/engine/BackgroundCatalog.ts`
- Create: `src/themes/platformer/engine/BackgroundCatalog.test.ts`
- Modify: `src/themes/platformer/level/LevelData.ts`

**Interfaces:**
- Produces: `BackgroundPieceId` (string literal union), `BackgroundCatalogEntry { sx: number; sy: number; widthTiles: number; heightTiles: number }`, `BACKGROUND_CATALOG: Record<BackgroundPieceId, BackgroundCatalogEntry>`, `backgroundCatalogEntry(pieceId: BackgroundPieceId): BackgroundCatalogEntry`.

`public/sprites/terrain_.png` (128×320px) was measured directly (16px tiles, no gutter,
pieces grid-aligned) in the design doc's Assets section. Two colour bands, each 80px
tall (`baseSy`: dirt = 0, charcoal = 80). Within a band, the block row-group starts at
`baseSy + 32` and is 48px (3 tile-rows) tall, holding four pieces side by side, confirmed
against a 16px grid overlay: a 3-wide chunk at `sx = 0`, a 2-wide chunk at `sx = 48`, and
two 1-wide columns at `sx = 80` and `sx = 96` — all 3 tiles tall.

- [ ] **Step 1: Write the failing test**

```typescript
// src/themes/platformer/engine/BackgroundCatalog.test.ts
import { describe, it, expect } from 'vitest';
import { BACKGROUND_CATALOG, backgroundCatalogEntry } from './BackgroundCatalog';
import type { BackgroundPieceId } from '../level/LevelData';

const SHEET_WIDTH = 128;
const SHEET_HEIGHT = 320;
const TILE_SIZE = 16;
const PIECE_IDS: BackgroundPieceId[] = [
  'dirtBlock3x3',
  'dirtBlock2x3',
  'dirtColumnA',
  'dirtColumnB',
  'charcoalBlock3x3',
  'charcoalBlock2x3',
  'charcoalColumnA',
  'charcoalColumnB',
];

describe('BackgroundCatalog', () => {
  it.each(PIECE_IDS)('%s-resolvesToARectInsideTheSheetOnA16pxGrid', (pieceId) => {
    const entry = backgroundCatalogEntry(pieceId);

    expect(entry.sx % TILE_SIZE).toBe(0);
    expect(entry.sy % TILE_SIZE).toBe(0);
    expect(entry.sx + entry.widthTiles * TILE_SIZE).toBeLessThanOrEqual(SHEET_WIDTH);
    expect(entry.sy + entry.heightTiles * TILE_SIZE).toBeLessThanOrEqual(SHEET_HEIGHT);
  });

  it('everyPieceFootprint-isNoBiggerThan3x3Tiles', () => {
    for (const pieceId of PIECE_IDS) {
      const entry = BACKGROUND_CATALOG[pieceId];
      expect(entry.widthTiles).toBeLessThanOrEqual(3);
      expect(entry.heightTiles).toBeLessThanOrEqual(3);
    }
  });

  it('dirtAndCharcoalVariants-shareTheSameShapeAt80pxApart', () => {
    const dirt = backgroundCatalogEntry('dirtBlock3x3');
    const charcoal = backgroundCatalogEntry('charcoalBlock3x3');
    expect(charcoal.sx).toBe(dirt.sx);
    expect(charcoal.sy).toBe(dirt.sy + 80);
    expect(charcoal.widthTiles).toBe(dirt.widthTiles);
    expect(charcoal.heightTiles).toBe(dirt.heightTiles);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/BackgroundCatalog.test.ts`
Expected: FAIL — `Cannot find module './BackgroundCatalog'`.

- [ ] **Step 3: Add the type additions to `LevelData.ts`**

```typescript
// src/themes/platformer/level/LevelData.ts — add below the existing TileType/TileMap/LevelDef
export type BackgroundPieceId =
  | 'dirtBlock3x3'
  | 'dirtBlock2x3'
  | 'dirtColumnA'
  | 'dirtColumnB'
  | 'charcoalBlock3x3'
  | 'charcoalBlock2x3'
  | 'charcoalColumnA'
  | 'charcoalColumnB';

/** One stone piece anchored at its top-left cell. Purely decorative — never
 *  read by collision/physics; only the renderer and the Level Editor
 *  consume it. See BackgroundCatalog.ts for each piece's pixel rect and
 *  tile footprint. */
export interface BackgroundPlacement {
  pieceId: BackgroundPieceId;
  col: number;
  row: number;
}
```

Then add `background?: BackgroundPlacement[];` as a new field on the `LevelDef`
interface (alongside `terrain`, `width`, `height`).

- [ ] **Step 4: Write the minimal implementation**

```typescript
// src/themes/platformer/engine/BackgroundCatalog.ts
import { TILE_SIZE } from '../level/Terrain';
import type { BackgroundPieceId } from '../level/LevelData';

export interface BackgroundCatalogEntry {
  sx: number;
  sy: number;
  widthTiles: number;
  heightTiles: number;
}

type Variant = 'dirt' | 'charcoal';

const VARIANT_BASE_SY: Record<Variant, number> = {
  dirt: 0,
  charcoal: 80,
};

const BLOCK_ROW_OFFSET = 32;

function block(variant: Variant, col: number, widthTiles: number, heightTiles: number): BackgroundCatalogEntry {
  return {
    sx: col * TILE_SIZE,
    sy: VARIANT_BASE_SY[variant] + BLOCK_ROW_OFFSET,
    widthTiles,
    heightTiles,
  };
}

export const BACKGROUND_CATALOG: Record<BackgroundPieceId, BackgroundCatalogEntry> = {
  dirtBlock3x3: block('dirt', 0, 3, 3),
  dirtBlock2x3: block('dirt', 3, 2, 3),
  dirtColumnA: block('dirt', 5, 1, 3),
  dirtColumnB: block('dirt', 6, 1, 3),
  charcoalBlock3x3: block('charcoal', 0, 3, 3),
  charcoalBlock2x3: block('charcoal', 3, 2, 3),
  charcoalColumnA: block('charcoal', 5, 1, 3),
  charcoalColumnB: block('charcoal', 6, 1, 3),
};

export function backgroundCatalogEntry(pieceId: BackgroundPieceId): BackgroundCatalogEntry {
  return BACKGROUND_CATALOG[pieceId];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/engine/BackgroundCatalog.test.ts`
Expected: PASS (10 tests: 8 from `it.each` + 2).

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/engine/BackgroundCatalog.ts src/themes/platformer/engine/BackgroundCatalog.test.ts src/themes/platformer/level/LevelData.ts
git commit -m "feat(platformer): add background tile piece catalog"
```

---

### Task 2: Pure placement functions (place/erase)

**Files:**
- Create: `src/themes/platformer/editor/paintBackgroundCell.ts`
- Create: `src/themes/platformer/editor/paintBackgroundCell.test.ts`

**Interfaces:**
- Consumes: `BackgroundPlacement`, `BackgroundPieceId` (Task 1's `LevelData.ts`), `backgroundCatalogEntry` (Task 1).
- Produces: `placeBackgroundPiece(placements: readonly BackgroundPlacement[], pieceId: BackgroundPieceId, col: number, row: number): BackgroundPlacement[]`, `eraseBackgroundCell(placements: readonly BackgroundPlacement[], col: number, row: number): BackgroundPlacement[]`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/themes/platformer/editor/paintBackgroundCell.test.ts
import { describe, it, expect } from 'vitest';
import { placeBackgroundPiece, eraseBackgroundCell } from './paintBackgroundCell';
import type { BackgroundPlacement } from '../level/LevelData';

describe('placeBackgroundPiece', () => {
  it('placingOnAnEmptyList-addsTheSinglePlacement', () => {
    const result = placeBackgroundPiece([], 'dirtColumnA', 2, 3);
    expect(result).toEqual([{ pieceId: 'dirtColumnA', col: 2, row: 3 }]);
  });

  it('placingNextToAnExistingPlacement-keepsBothWhenFootprintsDoNotOverlap', () => {
    const existing: BackgroundPlacement[] = [{ pieceId: 'dirtColumnA', col: 0, row: 0 }];
    // dirtColumnA is 1x3 tiles, so (5, 0) doesn't overlap it.
    const result = placeBackgroundPiece(existing, 'dirtColumnA', 5, 0);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ pieceId: 'dirtColumnA', col: 0, row: 0 });
    expect(result).toContainEqual({ pieceId: 'dirtColumnA', col: 5, row: 0 });
  });

  it('placingOverAnExistingPlacementsFootprint-replacesTheExistingOne', () => {
    // dirtBlock3x3 anchored at (0,0) covers cols 0-2, rows 0-2.
    const existing: BackgroundPlacement[] = [{ pieceId: 'dirtBlock3x3', col: 0, row: 0 }];
    const result = placeBackgroundPiece(existing, 'dirtColumnA', 1, 1);
    expect(result).toEqual([{ pieceId: 'dirtColumnA', col: 1, row: 1 }]);
  });
});

describe('eraseBackgroundCell', () => {
  it('erasingACellInsideAMultiTilePiecesFootprint-removesTheWholePiece', () => {
    // dirtBlock2x3 anchored at (0,0) covers cols 0-1, rows 0-2.
    const existing: BackgroundPlacement[] = [{ pieceId: 'dirtBlock2x3', col: 0, row: 0 }];
    const result = eraseBackgroundCell(existing, 1, 2);
    expect(result).toEqual([]);
  });

  it('erasingACellWithNoPlacementThere-leavesTheListUnchanged', () => {
    const existing: BackgroundPlacement[] = [{ pieceId: 'dirtColumnA', col: 0, row: 0 }];
    const result = eraseBackgroundCell(existing, 9, 9);
    expect(result).toEqual(existing);
  });

  it('erasingOneOfSeveralPlacements-removesOnlyThatOne', () => {
    const existing: BackgroundPlacement[] = [
      { pieceId: 'dirtColumnA', col: 0, row: 0 },
      { pieceId: 'dirtColumnB', col: 5, row: 0 },
    ];
    const result = eraseBackgroundCell(existing, 5, 1);
    expect(result).toEqual([{ pieceId: 'dirtColumnA', col: 0, row: 0 }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/paintBackgroundCell.test.ts`
Expected: FAIL — `Cannot find module './paintBackgroundCell'`.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/themes/platformer/editor/paintBackgroundCell.ts
import type { BackgroundPlacement, BackgroundPieceId } from '../level/LevelData';
import { backgroundCatalogEntry } from '../engine/BackgroundCatalog';

interface Cell {
  col: number;
  row: number;
}

function footprintCells(placement: BackgroundPlacement): Cell[] {
  const { widthTiles, heightTiles } = backgroundCatalogEntry(placement.pieceId);
  const cells: Cell[] = [];
  for (let dr = 0; dr < heightTiles; dr++) {
    for (let dc = 0; dc < widthTiles; dc++) {
      cells.push({ col: placement.col + dc, row: placement.row + dr });
    }
  }
  return cells;
}

function coversCell(placement: BackgroundPlacement, col: number, row: number): boolean {
  return footprintCells(placement).some((cell) => cell.col === col && cell.row === row);
}

function footprintsOverlap(a: BackgroundPlacement, b: BackgroundPlacement): boolean {
  const bCells = footprintCells(b);
  return footprintCells(a).some((cellA) => bCells.some((cellB) => cellA.col === cellB.col && cellA.row === cellB.row));
}

/** Stamps `pieceId` at `(col, row)`. Any existing placement whose footprint
 *  overlaps the new piece's footprint is removed first — the same silent
 *  overwrite-on-paint convention `paintCell.ts` uses for the foreground
 *  layer. */
export function placeBackgroundPiece(
  placements: readonly BackgroundPlacement[],
  pieceId: BackgroundPieceId,
  col: number,
  row: number,
): BackgroundPlacement[] {
  const next: BackgroundPlacement = { pieceId, col, row };
  const withoutOverlaps = placements.filter((existing) => !footprintsOverlap(existing, next));
  return [...withoutOverlaps, next];
}

/** Removes whichever placement's footprint contains `(col, row)`, regardless
 *  of which piece is currently selected — matching the foreground layer's
 *  right-click-always-erases convention. A no-op (same contents) if nothing
 *  covers that cell. */
export function eraseBackgroundCell(
  placements: readonly BackgroundPlacement[],
  col: number,
  row: number,
): BackgroundPlacement[] {
  return placements.filter((placement) => !coversCell(placement, col, row));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/paintBackgroundCell.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/paintBackgroundCell.ts src/themes/platformer/editor/paintBackgroundCell.test.ts
git commit -m "feat(platformer): add background placement place/erase functions"
```

---

### Task 3: `drawBackgroundTiles` in the renderer

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts` (create if it does not already exist — check first with `ls src/themes/platformer/engine/Renderer.test.ts`)

**Interfaces:**
- Consumes: `LevelDef.background` (Task 1), `backgroundCatalogEntry` (Task 1), `TILE_SIZE`/`RENDERED_TILE_SIZE` from `../level/Terrain` (already imported by `Renderer.ts`).
- Produces: `drawBackgroundTiles(ctx: CanvasRenderingContext2D, level: LevelDef, backgroundAtlas: HTMLImageElement, originX?: number, originY?: number): void`.

- [ ] **Step 1: Write the failing test**

```typescript
// add to Renderer.test.ts (or create it with this content if it doesn't exist)
import { describe, it, expect, vi } from 'vitest';
import { drawBackgroundTiles } from './Renderer';
import type { LevelDef } from '../level/LevelData';

function fakeCtx() {
  return { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
}

describe('drawBackgroundTiles', () => {
  it('levelWithNoBackgroundField-drawsNothing', () => {
    const ctx = fakeCtx();
    const level: LevelDef = { terrain: [], width: 0, height: 0 };
    drawBackgroundTiles(ctx, level, {} as HTMLImageElement);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('onePlacement-drawsItScaledToRenderedTileSizeAtItsGridPosition', () => {
    const ctx = fakeCtx();
    const level: LevelDef = {
      terrain: [],
      width: 0,
      height: 0,
      background: [{ pieceId: 'dirtColumnA', col: 2, row: 1 }],
    };
    drawBackgroundTiles(ctx, level, {} as HTMLImageElement, 0, 0);

    // dirtColumnA: sx=80, sy=32, 1x3 tiles (16x48 source).
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      80, 32, 16, 48,
      2 * 32, 1 * 32,
      1 * 32, 3 * 32,
    );
  });

  it('originOffset-shiftsTheDestinationRect', () => {
    const ctx = fakeCtx();
    const level: LevelDef = {
      terrain: [],
      width: 0,
      height: 0,
      background: [{ pieceId: 'dirtColumnA', col: 0, row: 0 }],
    };
    drawBackgroundTiles(ctx, level, {} as HTMLImageElement, 100, -50);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      80, 32, 16, 48,
      100, -50,
      32, 96,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts -t drawBackgroundTiles`
Expected: FAIL — `drawBackgroundTiles is not exported`.

- [ ] **Step 3: Write the minimal implementation**

Add to `Renderer.ts` (near `drawTerrain`, after its closing brace). Add the import at the
top of the file alongside the existing `GroundAtlas`/`Terrain` imports:

```typescript
import { backgroundCatalogEntry } from './BackgroundCatalog';
```

```typescript
/**
 * Draws every placement in the level's purely-decorative background layer —
 * stone chunks anchored at their top-left cell, scaled from their catalog
 * source rect to RENDERED_TILE_SIZE. Same originX/originY convention as
 * drawTerrain. Levels with no `background` field draw nothing.
 */
export function drawBackgroundTiles(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  backgroundAtlas: HTMLImageElement,
  originX = 0,
  originY = 0,
): void {
  const placements = level.background ?? [];
  for (const placement of placements) {
    const entry = backgroundCatalogEntry(placement.pieceId);
    ctx.drawImage(
      backgroundAtlas,
      entry.sx,
      entry.sy,
      entry.widthTiles * TILE_SIZE,
      entry.heightTiles * TILE_SIZE,
      placement.col * RENDERED_TILE_SIZE + originX,
      placement.row * RENDERED_TILE_SIZE + originY,
      entry.widthTiles * RENDERED_TILE_SIZE,
      entry.heightTiles * RENDERED_TILE_SIZE,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts -t drawBackgroundTiles`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): draw the background tile layer"
```

---

### Task 4: Background palette sprite table

**Files:**
- Create: `src/themes/platformer/editor/backgroundPaletteTiles.ts`
- Create: `src/themes/platformer/editor/backgroundPaletteTiles.test.ts`

**Interfaces:**
- Consumes: `BackgroundPieceId` (Task 1), `BACKGROUND_CATALOG` (Task 1), `TileSpriteSpec` (from `./paletteTiles.ts`, already exported there).
- Produces: `BACKGROUND_PALETTE_SPRITES: Record<BackgroundPieceId, TileSpriteSpec>`, `BACKGROUND_PALETTE_LABELS: Record<BackgroundPieceId, string>`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/themes/platformer/editor/backgroundPaletteTiles.test.ts
import { describe, it, expect } from 'vitest';
import { BACKGROUND_PALETTE_SPRITES, BACKGROUND_PALETTE_LABELS } from './backgroundPaletteTiles';
import { BACKGROUND_CATALOG } from '../engine/BackgroundCatalog';
import type { BackgroundPieceId } from '../level/LevelData';

describe('backgroundPaletteTiles', () => {
  it.each(Object.keys(BACKGROUND_CATALOG) as BackgroundPieceId[])(
    '%s-hasASpriteSpecMatchingItsCatalogEntry',
    (pieceId) => {
      const catalogEntry = BACKGROUND_CATALOG[pieceId];
      const sprite = BACKGROUND_PALETTE_SPRITES[pieceId];

      expect(sprite.sheet).toBe('/sprites/terrain_.png');
      expect(sprite.sheetWidth).toBe(128);
      expect(sprite.sheetHeight).toBe(320);
      expect(sprite.sx).toBe(catalogEntry.sx);
      expect(sprite.sy).toBe(catalogEntry.sy);
      expect(sprite.frameWidth).toBe(catalogEntry.widthTiles * 16);
      expect(sprite.frameHeight).toBe(catalogEntry.heightTiles * 16);
    },
  );

  it.each(Object.keys(BACKGROUND_CATALOG) as BackgroundPieceId[])('%s-hasANonEmptyLabel', (pieceId) => {
    expect(BACKGROUND_PALETTE_LABELS[pieceId].length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/editor/backgroundPaletteTiles.test.ts`
Expected: FAIL — `Cannot find module './backgroundPaletteTiles'`.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/themes/platformer/editor/backgroundPaletteTiles.ts
import type { TileSpriteSpec } from './paletteTiles';
import { BACKGROUND_CATALOG } from '../engine/BackgroundCatalog';
import type { BackgroundPieceId } from '../level/LevelData';

const SHEET = '/sprites/terrain_.png';
const SHEET_WIDTH = 128;
const SHEET_HEIGHT = 320;

function spriteFor(pieceId: BackgroundPieceId): TileSpriteSpec {
  const entry = BACKGROUND_CATALOG[pieceId];
  return {
    sheet: SHEET,
    sheetWidth: SHEET_WIDTH,
    sheetHeight: SHEET_HEIGHT,
    sx: entry.sx,
    sy: entry.sy,
    frameWidth: entry.widthTiles * 16,
    frameHeight: entry.heightTiles * 16,
  };
}

const PIECE_IDS = Object.keys(BACKGROUND_CATALOG) as BackgroundPieceId[];

export const BACKGROUND_PALETTE_SPRITES: Record<BackgroundPieceId, TileSpriteSpec> = Object.fromEntries(
  PIECE_IDS.map((pieceId) => [pieceId, spriteFor(pieceId)]),
) as Record<BackgroundPieceId, TileSpriteSpec>;

export const BACKGROUND_PALETTE_LABELS: Record<BackgroundPieceId, string> = {
  dirtBlock3x3: 'Dirt Block (3×3)',
  dirtBlock2x3: 'Dirt Block (2×3)',
  dirtColumnA: 'Dirt Column A',
  dirtColumnB: 'Dirt Column B',
  charcoalBlock3x3: 'Charcoal Block (3×3)',
  charcoalBlock2x3: 'Charcoal Block (2×3)',
  charcoalColumnA: 'Charcoal Column A',
  charcoalColumnB: 'Charcoal Column B',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/editor/backgroundPaletteTiles.test.ts`
Expected: PASS (16 tests).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/backgroundPaletteTiles.ts src/themes/platformer/editor/backgroundPaletteTiles.test.ts
git commit -m "feat(platformer): add background palette sprite table"
```

---

### Task 5: Persisted editor signals for the background layer

**Files:**
- Modify: `src/themes/platformer/editor/editorLevelState.ts`
- Create: `src/themes/platformer/editor/editorLevelState.test.ts` (add to it if it already covers other signals — check first)

**Interfaces:**
- Consumes: `BackgroundPlacement`, `BackgroundPieceId` (Task 1), `createLocalStorageSignal` (already imported from `@/lib/utils`).
- Produces: `editorBackgroundSignal: Signal<BackgroundPlacement[]>`, `editorActiveLayerSignal: Signal<'foreground' | 'background'>`, `editorSelectedBackgroundPieceSignal: Signal<BackgroundPieceId | null>`.

- [ ] **Step 1: Write the failing test**

```typescript
// add to editorLevelState.test.ts
import { describe, it, expect } from 'vitest';
import {
  editorBackgroundSignal,
  editorActiveLayerSignal,
  editorSelectedBackgroundPieceSignal,
} from './editorLevelState';

describe('editorLevelState — background layer signals', () => {
  it('editorBackgroundSignal-defaultsToAnEmptyList', () => {
    expect(editorBackgroundSignal.value).toEqual([]);
  });

  it('editorActiveLayerSignal-defaultsToForeground', () => {
    expect(editorActiveLayerSignal.value).toBe('foreground');
  });

  it('editorSelectedBackgroundPieceSignal-defaultsToNull', () => {
    expect(editorSelectedBackgroundPieceSignal.value).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/editor/editorLevelState.test.ts -t "background layer signals"`
Expected: FAIL — the three exports don't exist.

- [ ] **Step 3: Write the minimal implementation**

Add to `editorLevelState.ts`, alongside the existing signals (after the imports, add
`BackgroundPlacement`/`BackgroundPieceId` to the existing type-only import from
`'../level/LevelData'`, adding that import if it isn't already there):

```typescript
import type { BackgroundPlacement, BackgroundPieceId } from '../level/LevelData';
```

```typescript
/** The Level Editor's background-layer placements, persisted the same way
 *  `editorLevelSignal` is above. */
export const editorBackgroundSignal = createLocalStorageSignal<BackgroundPlacement[]>(
  'platformer-editor-background',
  [],
);

/** Which layer the palette and canvas clicks currently target. */
export const editorActiveLayerSignal = createLocalStorageSignal<'foreground' | 'background'>(
  'platformer-editor-active-layer',
  'foreground',
);

/** The currently-selected background piece, persisted like
 *  `editorSelectedToolSignal` above — `null` until the developer picks one. */
export const editorSelectedBackgroundPieceSignal = createLocalStorageSignal<BackgroundPieceId | null>(
  'platformer-editor-selected-background-piece',
  null,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/editor/editorLevelState.test.ts`
Expected: PASS (all tests in the file, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/editorLevelState.ts src/themes/platformer/editor/editorLevelState.test.ts
git commit -m "feat(platformer): add persisted editor signals for the background layer"
```

---

### Task 6: Background layer in `EditorCanvas`

**Files:**
- Modify: `src/themes/platformer/editor/EditorCanvas.tsx`
- Modify: `src/themes/platformer/editor/EditorCanvas.test.tsx`

**Interfaces:**
- Consumes: `drawBackgroundTiles` (Task 3), `placeBackgroundPiece`/`eraseBackgroundCell` (Task 2), `BackgroundPlacement`/`BackgroundPieceId` (Task 1).
- Produces: `EditorCanvas` gains props `backgroundPlacements: BackgroundPlacement[]`, `activeLayer: 'foreground' | 'background'`, `selectedBackgroundPiece: BackgroundPieceId | null`, `onPaintBackground: (next: BackgroundPlacement[]) => void`; `EditorImages` gains `backgroundAtlas: HTMLImageElement | null`.

Before writing this task, read the current `src/themes/platformer/editor/EditorCanvas.tsx`
in full — its exact line numbers may have shifted since this plan was written. Locate:
the `EditorImages` interface, the main draw `useEffect`, `handleMouseDown`, and
`handleMouseMove`.

- [ ] **Step 1: Write the failing tests**

```typescript
// add to EditorCanvas.test.tsx — follow the file's existing mocking pattern for
// drawTerrain/drawPlayer/etc. (vi.mock('../engine/Renderer', ...)); add
// drawBackgroundTiles to that same mock.
import { drawBackgroundTiles } from '../engine/Renderer';
// ... (drawBackgroundTiles: vi.fn() added to the existing vi.mock('../engine/Renderer', ...) factory)

describe('EditorCanvas — background layer', () => {
  it('backgroundAtlasLoaded-callsDrawBackgroundTilesBeforeDrawTerrain', () => {
    const calls: string[] = [];
    (drawBackgroundTiles as ReturnType<typeof vi.fn>).mockImplementation(() => calls.push('background'));
    (drawTerrain as ReturnType<typeof vi.fn>).mockImplementation(() => calls.push('terrain'));

    render(
      <EditorCanvas
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={{ ...baseImages, backgroundAtlas: {} as HTMLImageElement }}
        backgroundPlacements={[]}
        activeLayer="foreground"
        selectedBackgroundPiece={null}
        onPaint={vi.fn()}
        onPaintBackground={vi.fn()}
        onPan={vi.fn()}
      />,
    );

    expect(calls.indexOf('background')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('background')).toBeLessThan(calls.indexOf('terrain'));
  });

  it('leftClickWithBackgroundLayerActiveAndAPieceSelected-callsOnPaintBackgroundWithThePlacementAdded', () => {
    const onPaintBackground = vi.fn();
    const { container } = render(
      <EditorCanvas
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={baseImages}
        backgroundPlacements={[]}
        activeLayer="background"
        selectedBackgroundPiece="dirtColumnA"
        onPaint={vi.fn()}
        onPaintBackground={onPaintBackground}
        onPan={vi.fn()}
      />,
    );

    const canvas = container.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0, button: 0 });

    expect(onPaintBackground).toHaveBeenCalledWith([{ pieceId: 'dirtColumnA', col: 0, row: 0 }]);
  });

  it('rightClickWithBackgroundLayerActive-callsOnPaintBackgroundWithThePlacementErased', () => {
    const onPaintBackground = vi.fn();
    const { container } = render(
      <EditorCanvas
        grid={[['.']]}
        selectedTool="."
        panOffset={{ x: 0, y: 0 }}
        images={baseImages}
        backgroundPlacements={[{ pieceId: 'dirtColumnA', col: 0, row: 0 }]}
        activeLayer="background"
        selectedBackgroundPiece={null}
        onPaint={vi.fn()}
        onPaintBackground={onPaintBackground}
        onPan={vi.fn()}
      />,
    );

    const canvas = container.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0, button: 2 });

    expect(onPaintBackground).toHaveBeenCalledWith([]);
  });
});
```

Add `backgroundAtlas: null` to whatever `baseImages` fixture the existing test file
already defines for `EditorImages`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/EditorCanvas.test.tsx -t "background layer"`
Expected: FAIL — the new props don't exist yet / `drawBackgroundTiles` isn't called.

- [ ] **Step 3: Implement**

In `EditorCanvas.tsx`:

1. Add to the `EditorImages` interface: `backgroundAtlas: HTMLImageElement | null;`
2. Add to `EditorCanvasProps`: `backgroundPlacements: BackgroundPlacement[]; activeLayer: 'foreground' | 'background'; selectedBackgroundPiece: BackgroundPieceId | null; onPaintBackground: (next: BackgroundPlacement[]) => void;`
3. Import `drawBackgroundTiles` from `'../engine/Renderer'` (add to the existing import from that module) and `placeBackgroundPiece`, `eraseBackgroundCell` from `'./paintBackgroundCell'`.
4. In the main draw `useEffect`, immediately before the existing
   `if (images.tileset && images.groundAtlas) { drawTerrain(...) }` block, add:

```typescript
if (images.backgroundAtlas) {
  drawBackgroundTiles(ctx, { terrain: [], width: 0, height: 0, background: backgroundPlacements }, images.backgroundAtlas, panOffset.x, panOffset.y);
}
```

5. In `handleMouseDown` (and the equivalent branch in `handleMouseMove` for drag), add a
   branch at the top that checks `activeLayer === 'background'` before the existing
   foreground logic runs:

```typescript
if (activeLayer === 'background') {
  const { col, row } = cellFromEvent(event);
  const isErase = event.button === 2;
  const next = isErase
    ? eraseBackgroundCell(backgroundPlacements, col, row)
    : selectedBackgroundPiece
      ? placeBackgroundPiece(backgroundPlacements, selectedBackgroundPiece, col, row)
      : backgroundPlacements;
  onPaintBackground(next);
  return;
}
```

Place this as the first statement inside `handleMouseDown` (before it reads
`selectedTool`/calls `paintCell`), and add the matching branch at the top of the
drag-continuation branch inside `handleMouseMove` — read the current file to match its
exact existing drag-tracking variable names (e.g. `dragRef`) so the background branch
participates in the same drag-continues-painting behaviour the foreground layer already
has, calling `onPaintBackground` again per new cell the drag crosses (do not call
`onPaint`, the foreground-only callback, from this branch).

6. **Dim the foreground terrain while the Background layer is active**, so the painter
   can see where the foreground platforms will sit without the background pieces being
   hidden underneath them (mid-execution addition, requested directly by the project
   owner while this plan was running — not from the original design doc). In the same
   draw `useEffect`, wrap the existing `drawTerrain(...)` call (and nothing else — not
   `drawBackgroundTiles`, not the entity/sign draws) with a globalAlpha toggle keyed on
   `activeLayer`:

```typescript
const foregroundAlpha = activeLayer === 'background' ? 0.35 : 1;
if (images.tileset && images.groundAtlas) {
  ctx.save();
  ctx.globalAlpha = foregroundAlpha;
  drawTerrain(/* ...unchanged existing arguments... */);
  ctx.restore();
}
```

Add one test alongside the others in this task's `describe('EditorCanvas — background
layer', ...)` block:

```typescript
it('backgroundLayerActive-drawsForegroundTerrainAtReducedOpacity', () => {
  const saveSpy = vi.spyOn(HTMLCanvasElement.prototype.getContext('2d')!, 'save');
  // Simpler and more robust: assert on the ctx passed to drawTerrain's mock call by
  // reading ctx.globalAlpha at the moment drawTerrain was invoked.
  let alphaDuringDrawTerrain: number | undefined;
  (drawTerrain as ReturnType<typeof vi.fn>).mockImplementation((ctx: CanvasRenderingContext2D) => {
    alphaDuringDrawTerrain = ctx.globalAlpha;
  });

  render(
    <EditorCanvas
      grid={[['.']]}
      selectedTool="."
      panOffset={{ x: 0, y: 0 }}
      images={baseImages}
      backgroundPlacements={[]}
      activeLayer="background"
      selectedBackgroundPiece={null}
      onPaint={vi.fn()}
      onPaintBackground={vi.fn()}
      onPan={vi.fn()}
    />,
  );

  expect(alphaDuringDrawTerrain).toBe(0.35);
  saveSpy.mockRestore();
});
```

Drop the unused `saveSpy` line if your test environment's canvas mock doesn't expose
`getContext('2d')` the way this sketch assumes — adapt the assertion mechanism to
whatever canvas mock this test file already uses elsewhere (check the file's existing
`vi.mock` setup for `HTMLCanvasElement`/`getContext` before writing this), but keep the
core assertion: `ctx.globalAlpha` is `0.35` during the `drawTerrain` call when
`activeLayer === 'background'`, and `1` (or unset/default) when `activeLayer ===
'foreground'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/EditorCanvas.test.tsx`
Expected: PASS (new tests plus every pre-existing test in the file — confirm nothing
foreground-related regressed).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/EditorCanvas.tsx src/themes/platformer/editor/EditorCanvas.test.tsx
git commit -m "feat(platformer): paint and render the background layer in the editor canvas"
```

---

### Task 7: Foreground/Background tab in `Palette`

**Files:**
- Modify: `src/themes/platformer/editor/Palette.tsx`
- Modify: `src/themes/platformer/editor/Palette.test.tsx`

**Interfaces:**
- Consumes: `BACKGROUND_PALETTE_SPRITES`, `BACKGROUND_PALETTE_LABELS` (Task 4), `BackgroundPieceId` (Task 1), `PaletteTile` (existing, reused unchanged).
- Produces: `Palette` gains props `activeLayer: 'foreground' | 'background'`, `onSelectLayer: (layer: 'foreground' | 'background') => void`, `selectedBackgroundPiece: BackgroundPieceId | null`, `onSelectBackgroundPiece: (pieceId: BackgroundPieceId) => void`.

- [ ] **Step 1: Write the failing tests**

```typescript
// add to Palette.test.tsx — follow the file's existing render-with-default-props pattern
import { BACKGROUND_CATALOG } from '../engine/BackgroundCatalog';

const defaultProps = {
  selectedTool: '.' as const,
  onSelectTool: vi.fn(),
  activeLayer: 'foreground' as const,
  onSelectLayer: vi.fn(),
  selectedBackgroundPiece: null,
  onSelectBackgroundPiece: vi.fn(),
};

describe('Palette — layer tab', () => {
  it('foregroundLayerActive-showsTheExistingTerrainAndEntityButtonsOnly', () => {
    render(<Palette {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /Dirt Block/ })).not.toBeInTheDocument();
  });

  it('backgroundLayerActive-showsOneButtonPerCatalogPiece', () => {
    render(<Palette {...defaultProps} activeLayer="background" />);
    for (const pieceId of Object.keys(BACKGROUND_CATALOG)) {
      expect(screen.getByRole('button', { name: new RegExp(pieceId, 'i') })).toBeInTheDocument();
    }
  });

  it('clickingABackgroundLayerTab-callsOnSelectLayerWithBackground', () => {
    const onSelectLayer = vi.fn();
    render(<Palette {...defaultProps} onSelectLayer={onSelectLayer} />);
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    expect(onSelectLayer).toHaveBeenCalledWith('background');
  });

  it('clickingABackgroundPieceButton-callsOnSelectBackgroundPieceWithItsId', () => {
    const onSelectBackgroundPiece = vi.fn();
    render(<Palette {...defaultProps} activeLayer="background" onSelectBackgroundPiece={onSelectBackgroundPiece} />);
    fireEvent.click(screen.getByRole('button', { name: /Dirt Column A/ }));
    expect(onSelectBackgroundPiece).toHaveBeenCalledWith('dirtColumnA');
  });
});
```

Note: the test file will need `BACKGROUND_PALETTE_LABELS`' actual label text
(`'Dirt Column A'` etc. from Task 4) to match its `getByRole(... name: ...)` queries —
use the labels exactly as defined there.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/Palette.test.tsx -t "layer tab"`
Expected: FAIL — the new props/UI don't exist.

- [ ] **Step 3: Implement**

```tsx
// Palette.tsx — replace the existing PaletteProps and component body
import { TERRAIN_CHARS, ENTITY_CHARS, SIGN_CHARS } from '../level/LevelParser';
import type { TileChar } from '../level/LevelParser';
import {
  PALETTE_TILE_SPRITES,
  PALETTE_TILE_LABELS,
  PALETTE_TILE_GLYPHS,
  PALETTE_TILE_DESCRIPTIONS,
} from './paletteTiles';
import { BACKGROUND_PALETTE_SPRITES, BACKGROUND_PALETTE_LABELS } from './backgroundPaletteTiles';
import { BACKGROUND_CATALOG } from '../engine/BackgroundCatalog';
import type { BackgroundPieceId } from '../level/LevelData';
import { PaletteTile } from './PaletteTile';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PaletteProps {
  selectedTool: TileChar;
  onSelectTool: (tool: TileChar) => void;
  activeLayer: 'foreground' | 'background';
  onSelectLayer: (layer: 'foreground' | 'background') => void;
  selectedBackgroundPiece: BackgroundPieceId | null;
  onSelectBackgroundPiece: (pieceId: BackgroundPieceId) => void;
}

const EMPTY_CHAR: TileChar = '.';
const BACKGROUND_PIECE_IDS = Object.keys(BACKGROUND_CATALOG) as BackgroundPieceId[];

export const Palette = ({
  selectedTool,
  onSelectTool,
  activeLayer,
  onSelectLayer,
  selectedBackgroundPiece,
  onSelectBackgroundPiece,
}: PaletteProps) => {
  const terrainKeys = (Object.keys(TERRAIN_CHARS) as TileChar[]).filter((key) => key !== EMPTY_CHAR);
  const entityKeys = Object.keys(ENTITY_CHARS) as TileChar[];
  const [firstSignKey] = Object.keys(SIGN_CHARS) as TileChar[];
  const signKeys: TileChar[] = firstSignKey ? [firstSignKey] : [];
  const tileKeys = [...terrainKeys, ...entityKeys, ...signKeys, EMPTY_CHAR];

  return (
    <Card role="toolbar" aria-label="Palette">
      <CardHeader>
        <CardTitle>Palette</CardTitle>
        <div className="flex gap-2" role="tablist" aria-label="Layer">
          <button
            type="button"
            role="tab"
            aria-selected={activeLayer === 'foreground'}
            className={cn('rounded px-2 py-1 text-sm', activeLayer === 'foreground' && 'bg-muted font-medium')}
            onClick={() => onSelectLayer('foreground')}
          >
            Foreground
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeLayer === 'background'}
            className={cn('rounded px-2 py-1 text-sm', activeLayer === 'background' && 'bg-muted font-medium')}
            onClick={() => onSelectLayer('background')}
          >
            Background
          </button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {activeLayer === 'foreground'
          ? tileKeys.map((key) => (
              <PaletteTile
                key={key}
                label={PALETTE_TILE_LABELS[key]}
                description={PALETTE_TILE_DESCRIPTIONS[key]}
                sprite={PALETTE_TILE_SPRITES[key]}
                glyph={PALETTE_TILE_GLYPHS[key]}
                selected={selectedTool === key}
                onClick={() => onSelectTool(key)}
              />
            ))
          : BACKGROUND_PIECE_IDS.map((pieceId) => (
              <PaletteTile
                key={pieceId}
                label={BACKGROUND_PALETTE_LABELS[pieceId]}
                sprite={BACKGROUND_PALETTE_SPRITES[pieceId]}
                selected={selectedBackgroundPiece === pieceId}
                onClick={() => onSelectBackgroundPiece(pieceId)}
              />
            ))}
      </CardContent>
    </Card>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/Palette.test.tsx`
Expected: PASS (new tests plus every pre-existing test in the file).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/Palette.tsx src/themes/platformer/editor/Palette.test.tsx
git commit -m "feat(platformer): add Foreground/Background layer tab to the palette"
```

---

### Task 8: Wire the background layer through `LevelEditorPage`

**Files:**
- Modify: `src/themes/platformer/editor/LevelEditorPage.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.test.tsx`

**Interfaces:**
- Consumes: `editorBackgroundSignal`, `editorActiveLayerSignal`, `editorSelectedBackgroundPieceSignal` (Task 5), the updated `Palette` (Task 7), the updated `EditorCanvas` (Task 6).
- Produces: no new exports — this task is wiring, verified by its own tests.

Before writing this task, read the current `src/themes/platformer/editor/LevelEditorPage.tsx`
in full — its exact line numbers may have shifted. Locate: the `grid`/`selectedTool`
`useState` + debounced-sync `useEffect` pair, `loadLevel`, `saveCurrentLevel`,
`tryLayout`, and the `<Palette>`/`<EditorCanvas>` JSX.

- [ ] **Step 1: Write the failing tests**

```typescript
// add to LevelEditorPage.test.tsx — follow the file's existing render/interaction pattern
describe('LevelEditorPage — background layer', () => {
  it('selectingTheBackgroundLayerTabThenAPieceThenPaintingOnCanvas-addsAPlacement', async () => {
    render(<LevelEditorPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Background' }));
    fireEvent.click(await screen.findByRole('button', { name: /Dirt Column A/ }));

    const canvas = (await screen.findAllByRole('img', { hidden: true }))[0]?.closest('canvas')
      ?? document.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0, button: 0 });

    // The debounced sync writes editorBackgroundSignal — wait for it.
    await waitFor(() => expect(editorBackgroundSignal.value.length).toBeGreaterThan(0));
  });

  it('tryingTheLevelWithBackgroundPlacementsPainted-carriesThemIntoCurrentBackground', async () => {
    render(<LevelEditorPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Background' }));
    fireEvent.click(await screen.findByRole('button', { name: /Dirt Column A/ }));
    const canvas = document.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0, button: 0 });

    fireEvent.click(screen.getByRole('button', { name: /Try/i }));

    expect(currentBackground.value.length).toBeGreaterThan(0);
  });
});
```

Adjust the exact queries above once the real file is open in front of you — match
whatever `role`/`name` the existing test file already uses to find the canvas and the
Try button (this plan's snippets are best-effort based on the researched file contents,
not a byte-for-byte read at execution time).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx -t "background layer"`
Expected: FAIL — no background state is wired up yet.

- [ ] **Step 3: Implement**

In `LevelEditorPage.tsx`:

1. Import the three signals from `./editorLevelState` (add to the existing import from
   that module) and `placeBackgroundPiece`/`eraseBackgroundCell` are NOT needed here
   (that logic lives in `EditorCanvas` per Task 6) — only the signals and the
   `BackgroundPlacement`/`BackgroundPieceId` types (from `../level/LevelData`) are
   needed in this file.
2. Add local state mirroring the existing `grid`/`selectedTool` pattern:

```typescript
const [backgroundPlacements, setBackgroundPlacements] = useState<BackgroundPlacement[]>(
  editorBackgroundSignal.value,
);
const [activeLayer, setActiveLayer] = useState<'foreground' | 'background'>(editorActiveLayerSignal.value);
const [selectedBackgroundPiece, setSelectedBackgroundPiece] = useState<BackgroundPieceId | null>(
  editorSelectedBackgroundPieceSignal.value,
);
```

3. Add the debounced sync for `backgroundPlacements` alongside the existing `grid` sync
   `useEffect` (same `EDITOR_LEVEL_SYNC_DEBOUNCE_MS` debounce, writing
   `editorBackgroundSignal.value = backgroundPlacements` and setting `editorDirtySignal`
   the same way the grid effect already does). Write `editorActiveLayerSignal.value =
   activeLayer` and `editorSelectedBackgroundPieceSignal.value = selectedBackgroundPiece`
   directly (not debounced), matching how `selectedTool` is handled today.
4. Pass the new props through to `<Palette>` and `<EditorCanvas>`:

```tsx
<Palette
  selectedTool={selectedTool}
  onSelectTool={setSelectedTool}
  activeLayer={activeLayer}
  onSelectLayer={setActiveLayer}
  selectedBackgroundPiece={selectedBackgroundPiece}
  onSelectBackgroundPiece={setSelectedBackgroundPiece}
/>
```

```tsx
<EditorCanvas
  /* ...existing props... */
  backgroundPlacements={backgroundPlacements}
  activeLayer={activeLayer}
  selectedBackgroundPiece={selectedBackgroundPiece}
  onPaintBackground={setBackgroundPlacements}
/>
```

5. In `loadLevel`, also set `setBackgroundPlacements(level.background ?? [])` (this
   requires `LevelEntry.background` to exist — added in Task 10; until that task lands,
   use `[]` as a placeholder default here and revisit this line when Task 10 is done,
   noting it explicitly in this step so it isn't silently forgotten).
6. In `tryLayout`, alongside the existing `currentLayout.value = exportLayout(grid)`,
   add `currentBackground.value = backgroundPlacements;` (this requires
   `currentBackground` to exist — added in Task 9; sequence Task 9 before this step if
   executing out of order, or leave a clearly-marked follow-up line here).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx`
Expected: PASS (new tests plus every pre-existing test in the file).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/LevelEditorPage.tsx src/themes/platformer/editor/LevelEditorPage.test.tsx
git commit -m "feat(platformer): wire the background layer through the level editor page"
```

---

### Task 9: `currentBackground` signal in `level.ts`

**Files:**
- Modify: `src/themes/platformer/level/level.ts`
- Create: `src/themes/platformer/level/level.test.ts` (add to it if it already exists — check first)

**Interfaces:**
- Consumes: `BackgroundPlacement` (Task 1).
- Produces: `currentBackground: Signal<BackgroundPlacement[]>`; `currentLevel` now includes `background: currentBackground.value`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/themes/platformer/level/level.test.ts (or add to the existing file)
import { describe, it, expect, afterEach } from 'vitest';
import { currentBackground, currentLevel } from './level';

describe('currentBackground', () => {
  afterEach(() => {
    currentBackground.value = [];
  });

  it('defaultValue-isAnEmptyList', () => {
    expect(currentBackground.value).toEqual([]);
  });

  it('settingCurrentBackground-appearsOnCurrentLevelsBackgroundField', () => {
    currentBackground.value = [{ pieceId: 'dirtColumnA', col: 0, row: 0 }];
    expect(currentLevel.value.background).toEqual([{ pieceId: 'dirtColumnA', col: 0, row: 0 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/level/level.test.ts`
Expected: FAIL — `currentBackground` is not exported, and/or `currentLevel.value.background` is `undefined`.

- [ ] **Step 3: Write the minimal implementation**

In `level.ts`, add near `currentLayout`:

```typescript
import type { LevelDef, BackgroundPlacement } from './LevelData';
```

```typescript
/** The GAME's background-layer placements — parallel to `currentLayout`
 *  above, and reset the same way (in-memory only, not localStorage-backed).
 *  Written by the Level Editor's Try button, the only place that sets it. */
export const currentBackground = signal<BackgroundPlacement[]>([]);
```

Then change the existing `currentLevel` definition from:

```typescript
export const currentLevel = computed<LevelDef>(() => parseLevel(currentLayout.value));
```

to:

```typescript
export const currentLevel = computed<LevelDef>(() => ({
  ...parseLevel(currentLayout.value),
  background: currentBackground.value,
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/level/level.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/level.ts src/themes/platformer/level/level.test.ts
git commit -m "feat(platformer): add currentBackground signal, merged into currentLevel"
```

Now that `currentBackground` exists, go back to Task 8 Step 3.6 (`tryLayout`) and confirm
`currentBackground.value = backgroundPlacements;` was added — add it now if it was left
as a follow-up marker.

---

### Task 10: Background field in the level registry

**Files:**
- Modify: `src/themes/platformer/level/levelRegistry.ts`
- Modify: `src/themes/platformer/level/levelRegistry.test.ts` (create if it does not already exist — check first)

**Interfaces:**
- Consumes: `BackgroundPlacement` (Task 1).
- Produces: `LevelEntry.background?: readonly BackgroundPlacement[]`; `parseLevelModules` carries it through when present and valid.

- [ ] **Step 1: Write the failing tests**

```typescript
// add to levelRegistry.test.ts
import { parseLevelModules } from './levelRegistry';

describe('parseLevelModules — background field', () => {
  it('moduleWithAValidBackgroundArray-carriesItOntoTheEntry', () => {
    const modules = {
      './levels/cave.json': {
        name: 'Cave',
        layout: ['.S.', 'GGG'],
        background: [{ pieceId: 'dirtColumnA', col: 0, row: 0 }],
      },
    };
    const [entry] = parseLevelModules(modules);
    expect(entry.background).toEqual([{ pieceId: 'dirtColumnA', col: 0, row: 0 }]);
  });

  it('moduleWithNoBackgroundField-hasUndefinedBackgroundOnTheEntry', () => {
    const modules = { './levels/plain.json': { name: 'Plain', layout: ['.S.', 'GGG'] } };
    const [entry] = parseLevelModules(modules);
    expect(entry.background).toBeUndefined();
  });

  it('moduleWithAMalformedBackgroundField-dropsOnlyTheBackgroundFieldNotTheWholeEntry', () => {
    const modules = {
      './levels/broken-bg.json': { name: 'Broken', layout: ['.S.', 'GGG'], background: 'not-an-array' },
    };
    const [entry] = parseLevelModules(modules);
    expect(entry).toBeDefined();
    expect(entry.background).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/levelRegistry.test.ts -t "background field"`
Expected: FAIL — `entry.background` is never set today.

- [ ] **Step 3: Implement**

```typescript
// levelRegistry.ts
import type { BackgroundPlacement } from './LevelData';
```

Add `readonly background?: readonly BackgroundPlacement[];` to the `LevelEntry`
interface.

Add a validator next to `isLayout`:

```typescript
const isBackgroundPlacement = (value: unknown): value is BackgroundPlacement =>
  value !== null &&
  typeof value === 'object' &&
  typeof (value as { pieceId?: unknown }).pieceId === 'string' &&
  typeof (value as { col?: unknown }).col === 'number' &&
  typeof (value as { row?: unknown }).row === 'number';

const isBackground = (value: unknown): value is BackgroundPlacement[] =>
  Array.isArray(value) && value.every(isBackgroundPlacement);
```

In `parseLevelModules`, after `const { name, layout } = raw as { name?: unknown; layout?: unknown };`,
change the destructure to also pull `background`, and build the entry conditionally:

```typescript
const { name, layout, background } = raw as { name?: unknown; layout?: unknown; background?: unknown };
if (!isLayout(layout)) return null;

const id = idFromPath(path);
return {
  id,
  name: typeof name === 'string' && name !== '' ? name : id,
  layout,
  ...(isBackground(background) ? { background } : {}),
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/levelRegistry.test.ts`
Expected: PASS (new tests plus every pre-existing test in the file).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/levelRegistry.ts src/themes/platformer/level/levelRegistry.test.ts
git commit -m "feat(platformer): carry the background field through the level registry"
```

Now that `LevelEntry.background` exists, go back to Task 8 Step 3.5 (`loadLevel`) and
confirm `setBackgroundPlacements(level.background ?? [])` was added — add it now if it
was left as a follow-up marker.

---

### Task 11: Save the background layer to level JSON

**Files:**
- Modify: `src/themes/platformer/editor/saveLevelFile.ts`
- Modify: `src/themes/platformer/editor/saveLevelFile.test.ts`

**Interfaces:**
- Consumes: `BackgroundPlacement` (Task 1).
- Produces: `levelFileJson(name: string, grid: TileChar[][], background: BackgroundPlacement[]): string`; `saveLevel(name: string, grid: TileChar[][], background: BackgroundPlacement[]): Promise<SaveLevelResult>`; `downloadLevelFile(name: string, grid: TileChar[][], background: BackgroundPlacement[]): void`.

- [ ] **Step 1: Write the failing test**

```typescript
// add to saveLevelFile.test.ts
import { levelFileJson } from './saveLevelFile';

describe('levelFileJson — background field', () => {
  it('nonEmptyBackground-isIncludedInTheSerializedJson', () => {
    const json = levelFileJson('Cave', [['S']], [{ pieceId: 'dirtColumnA', col: 0, row: 0 }]);
    expect(JSON.parse(json)).toEqual({
      name: 'Cave',
      layout: ['S'],
      background: [{ pieceId: 'dirtColumnA', col: 0, row: 0 }],
    });
  });

  it('emptyBackground-isOmittedFromTheSerializedJson', () => {
    const json = levelFileJson('Plain', [['S']], []);
    expect(JSON.parse(json)).toEqual({ name: 'Plain', layout: ['S'] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/editor/saveLevelFile.test.ts -t "background field"`
Expected: FAIL — `levelFileJson` doesn't accept a third argument yet, TypeScript error on
the extra call argument.

- [ ] **Step 3: Implement**

```typescript
// saveLevelFile.ts
import type { BackgroundPlacement } from '../level/LevelData';
```

Change `levelFileJson`:

```typescript
export const levelFileJson = (name: string, grid: TileChar[][], background: BackgroundPlacement[]): string =>
  `${JSON.stringify(
    { name, layout: exportLayout(grid), ...(background.length > 0 ? { background } : {}) },
    null,
    2,
  )}\n`;
```

Update `saveLevel` and `downloadLevelFile` to accept and thread through the same
`background: BackgroundPlacement[]` parameter (mirroring exactly how `grid` is already
threaded), and update every call site of these three functions (`LevelEditorPage.tsx`'s
`saveCurrentLevel`, Task 8) to pass `backgroundPlacements` as the new argument.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/editor/saveLevelFile.test.ts`
Expected: PASS (new tests plus every pre-existing test in the file). Also run
`npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx` to confirm Task
8's call site update didn't break its save-flow tests.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/saveLevelFile.ts src/themes/platformer/editor/saveLevelFile.test.ts src/themes/platformer/editor/LevelEditorPage.tsx
git commit -m "feat(platformer): save the background layer alongside the level layout"
```

---

### Task 12: Render the background layer in the real game

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`

**Interfaces:**
- Consumes: `drawBackgroundTiles` (Task 3), `currentLevel` (now carrying `background`, Task 9), `loadImage` (existing `SpriteLoader` helper already used for the other sprite refs).

Before writing this task, read the current `src/themes/platformer/PlatformerPage.tsx`
in full — its exact line numbers may have shifted. Locate: the block of `useRef<HTMLImageElement | null>(null)` declarations and their `loadImage(...)` calls in the mount
effect (near where `tilesetRef`/`groundAtlasRef` are loaded), and line 419's
`drawSkyBackground` call inside `render()`.

- [ ] **Step 1: Implement (no new unit test — this task is a rendering call-site wire-up covered by manual browser verification in Task 13; Task 3's `drawBackgroundTiles` unit tests already cover its own drawing logic)**

1. Add a new ref alongside `tilesetRef`/`groundAtlasRef`:

```typescript
const backgroundAtlasRef = useRef<HTMLImageElement | null>(null);
```

2. In the same mount effect that loads `tilesetRef.current = await loadImage(...)` etc.,
   add:

```typescript
backgroundAtlasRef.current = await loadImage('/sprites/terrain_.png');
```

3. In `render()`, immediately after the existing `drawSkyBackground(...)` call (line 419)
   and before the `drawTerrain(...)` block (lines 420-429), add:

```typescript
if (backgroundAtlasRef.current) {
  drawBackgroundTiles(ctx, currentLevel.value, backgroundAtlasRef.current, originX, originY);
}
```

4. Add `drawBackgroundTiles` to the existing import from `./engine/Renderer`.

- [ ] **Step 2: Run the existing PlatformerPage test suite to confirm nothing broke**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS — every pre-existing test still passes (this task adds a new image load
and a new guarded draw call; it does not change any existing behaviour when
`currentLevel.value.background` is empty, which it is for `LEVEL_1_LAYOUT` today).

- [ ] **Step 3: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx
git commit -m "feat(platformer): render the background tile layer in the real game"
```

---

### Task 13: Manual browser verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server and open the Level Editor**

Run: `npm run dev`, then open `/platformer/editor` in the browser.

- [ ] **Step 2: Verify catalog rendering**

Click the "Background" tab. Confirm all 8 piece buttons render a real cropped sprite
(not a blank/broken image) — each should visibly be a stone chunk, not a garbled or
transparent square.

- [ ] **Step 3: Verify painting and erasing**

Select a piece (e.g. Dirt Block 3×3), left-click a cell on the canvas — confirm it draws
there, anchored at the clicked cell, correctly scaled (visually about 2 tile-widths
larger than a single foreground tile for the 3×3 piece). Click a different, non-adjacent
cell and place another piece — confirm both remain. Left-click on top of the first
piece's footprint with a different piece selected — confirm the first is replaced, not
duplicated. Right-click anywhere inside a placed piece's footprint — confirm the whole
piece disappears.

- [ ] **Step 4: Verify draw order**

Paint a foreground platform (e.g. a short run of Ground Grass) with a gap in it, and
paint a background piece so it's visible both behind the platform and through the gap.
Confirm the background piece is hidden under the platform and visible through the gap —
matching `specs/S-006-platformer-theme/level example.gif`'s depth effect.

- [ ] **Step 5: Verify save/load round-trip**

Save the level under a test name. Confirm the dev-server-written (or downloaded, if the
endpoint is unreachable) JSON file's `background` field matches what was painted. Reload
the editor, select that level from the dropdown, confirm the background placements
reappear exactly as saved.

- [ ] **Step 6: Verify the real game**

Click "Try". Confirm the background layer renders in the actual running game (not just
the editor canvas), behind the terrain and behind the player/enemies, at the same
positions painted in the editor.

- [ ] **Step 7: Run the full test suite and lint**

Run: `npm run test` and `npm run lint` (or this repo's equivalent scripts — check
`package.json` if the names differ). Expected: all green, no new lint errors.

---

### Task 14: Move the layer toggle out of the Palette

**Files:**
- Modify: `src/themes/platformer/editor/Palette.tsx`
- Modify: `src/themes/platformer/editor/Palette.test.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.test.tsx`

**Interfaces:**
- `Palette` keeps `activeLayer: 'foreground' | 'background'` as a read-only prop (it still needs to know which piece set to render) but DROPS `onSelectLayer` and the tab-button markup it currently renders for switching layers.
- `LevelEditorPage.tsx` renders the Foreground/Background toggle itself (a small control, sibling to `<Palette>`, not inside it), using its existing `activeLayer`/`setActiveLayer` state (added in Task 8) — no new state needed, just moved UI.

Requested directly by the project owner during manual verification (mid-execution addition, not from the original design doc): the layer toggle reads more naturally as a page-level control than as something nested inside the Palette card.

- [ ] **Step 1: Update `Palette.test.tsx`** — remove any test asserting `onSelectLayer` is called by clicking a tab inside `Palette` (that control no longer lives there); keep/adjust tests asserting `Palette` renders the correct piece set for a given `activeLayer` value.
- [ ] **Step 2: Remove the tab UI from `Palette.tsx`** — delete the `role="tablist"`/button markup and the `onSelectLayer` prop; `Palette`'s `PaletteProps` keeps `activeLayer`, `selectedTool`, `onSelectTool`, `selectedBackgroundPiece`, `onSelectBackgroundPiece`.
- [ ] **Step 3: Add the toggle to `LevelEditorPage.tsx`** — a small control rendered directly by this page (sibling to `<Palette>` in the JSX, e.g. immediately above it), with two buttons ("Foreground"/"Background") wired to the existing `activeLayer`/`setActiveLayer` state — reuse the exact button markup/styling `Palette.tsx` used to have, just relocated.
- [ ] **Step 4: Update `LevelEditorPage.test.tsx`** — move any test that clicked the layer toggle to target the new page-level control instead of a control inside the palette region.
- [ ] **Step 5: Run tests** — `npx vitest run src/themes/platformer/editor/Palette.test.tsx src/themes/platformer/editor/LevelEditorPage.test.tsx`, then the full suite (`npm test`).
- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/editor/Palette.tsx src/themes/platformer/editor/Palette.test.tsx src/themes/platformer/editor/LevelEditorPage.tsx src/themes/platformer/editor/LevelEditorPage.test.tsx
git commit -m "refactor(platformer): move the layer toggle out of the palette"
```

---

### Task 15: Dim every foreground draw while the Background layer is active, not just terrain

**Files:**
- Modify: `src/themes/platformer/editor/EditorCanvas.tsx`
- Modify: `src/themes/platformer/editor/EditorCanvas.test.tsx`

**Interfaces:** none new — this widens an existing `ctx.globalAlpha` wrapper's scope.

Requested directly by the project owner during manual verification: currently only `drawTerrain` (`EditorCanvas.tsx:296-308` as of Task 6's landing) is dimmed to 0.35 alpha while `activeLayer === 'background'`; `drawSigns`, `drawSignBadges`, `drawPatrolMarkers`, `drawCollectibles`, `drawEnemies`, `drawBlocks`, `drawChests`, and `drawPlayer` (`EditorCanvas.tsx:310-343`) all still draw at full opacity, which reads inconsistently — the whole foreground scene (terrain AND every entity/marker) should dim together, so the background pieces being painted stand out against a uniformly de-emphasized foreground. `drawBackgroundTiles` itself (drawn earlier, before this block) must stay at full opacity always — it's the layer being emphasized, never dimmed.

- [ ] **Step 1: Write the failing test** — add to `EditorCanvas.test.tsx`'s existing `describe('EditorCanvas — background layer', ...)` block:

```typescript
it('backgroundLayerActive-drawsPlayerAtReducedOpacityToo', () => {
  let alphaDuringDrawPlayer: number | undefined;
  (drawPlayer as ReturnType<typeof vi.fn>).mockImplementation((ctx: CanvasRenderingContext2D) => {
    alphaDuringDrawPlayer = ctx.globalAlpha;
  });

  render(
    <EditorCanvas
      grid={[['S']]}
      selectedTool="."
      panOffset={{ x: 0, y: 0 }}
      images={baseImages}
      backgroundPlacements={[]}
      activeLayer="background"
      selectedBackgroundPiece={null}
      onPaint={vi.fn()}
      onPaintBackground={vi.fn()}
      onPan={vi.fn()}
    />,
  );

  expect(alphaDuringDrawPlayer).toBe(0.35);
});
```

  Adapt to whatever mocking pattern the file already uses for `drawPlayer` (it should already be mocked, given the existing `EditorImages`/entity-draw tests) and to whatever grid content reliably synthesizes a player marker (check `synthesizePlayerState`'s expectations if `'S'` alone isn't enough).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/editor/EditorCanvas.test.tsx -t "drawsPlayerAtReducedOpacityToo"`
Expected: FAIL — `alphaDuringDrawPlayer` is `1` (or `undefined`), not `0.35`.

- [ ] **Step 3: Widen the `ctx.save()/globalAlpha/ctx.restore()` wrapper** to cover the ENTIRE foreground draw section — every draw call currently between (and including) `drawTerrain` and `drawPlayer` (i.e. lines 296-343 as of Task 6's landing: `drawTerrain`, `drawSigns`, `drawSignBadges`, `drawPatrolMarkers`, `drawCollectibles`, `drawEnemies`, `drawBlocks`, `drawChests`, `drawPlayer`), not just `drawTerrain` alone. `drawBackgroundTiles` (drawn earlier, lines 281-289) and the background fill/grid lines (lines 277-279) stay OUTSIDE this wrapper, unaffected. Read the current real file first — line numbers above are as of this plan's writing and may have shifted from Task 14's edits.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/EditorCanvas.test.tsx`
Expected: PASS (new test plus every pre-existing test in the file, including the original `foregroundLayerActive-drawsForegroundTerrainAtFullOpacity` test from Task 6 — confirm it still passes under the wider wrapper).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/EditorCanvas.tsx src/themes/platformer/editor/EditorCanvas.test.tsx
git commit -m "fix(platformer): dim every foreground draw, not just terrain, while painting the background layer"
```

---

### Task 16: Trim the catalog to 2 clean pieces per color

**Files:**
- Modify: `src/themes/platformer/engine/BackgroundCatalog.ts`
- Modify: `src/themes/platformer/engine/BackgroundCatalog.test.ts`
- Modify: `src/themes/platformer/editor/backgroundPaletteTiles.ts`
- Modify: `src/themes/platformer/editor/backgroundPaletteTiles.test.ts`
- Modify: `src/themes/platformer/level/LevelData.ts`

**Interfaces:**
- `BackgroundPieceId` narrows from 8 members to 4: `'dirtBlock3x3' | 'dirtColumnA' | 'charcoalBlock3x3' | 'charcoalColumnA'`.
- `BACKGROUND_CATALOG` and `BACKGROUND_PALETTE_SPRITES`/`BACKGROUND_PALETTE_LABELS` drop the `Block2x3`/`ColumnB` entries for both colors.

Requested directly by the project owner after seeing the palette rendered live: `dirtBlock2x3`/`charcoalBlock2x3` look like two different pieces (roughly a 1×1 and a 1×2, or a 2×2 and a 2×1) fused together at measurement time rather than one genuine piece, and `dirtColumnB`/`charcoalColumnB` are thin partial "half tiles" rather than clean solid columns — confirmed by the project owner's own screenshot marking exactly these four pieces with a red X. Rather than re-measure and split the fused piece right now, the project owner chose to drop both problem pieces and keep only the two already-confirmed-clean ones (`Block3x3`, `ColumnA`) per color. Expanding the catalog again later (with correctly split/measured pieces) remains a small, low-risk addition, same as it was before this trim.

- [ ] **Step 1: Update the failing tests first** — in `BackgroundCatalog.test.ts`, `backgroundPaletteTiles.test.ts`: remove every reference to `dirtBlock2x3`, `dirtColumnB`, `charcoalBlock2x3`, `charcoalColumnB` (both from any `PIECE_IDS` array/list and from any individual test cases naming them directly), leaving only the four survivors. Keep the existing `dirtAndCharcoalVariants-shareTheSameShapeAt80pxApart` -style test but re-target it at `dirtBlock3x3`/`charcoalBlock3x3` (or whichever surviving pair it already used — check the real file) if it isn't already.
- [ ] **Step 2: Run tests to verify they fail** (referencing removed keys should now be type errors under `Record<BackgroundPieceId, ...>` once Step 3 narrows the type, or reference errors if you update tests before the type — do Step 1 first as instructed, confirm via `npx tsc --noEmit` and/or `npx vitest run` that referencing the four dropped ids now fails).
- [ ] **Step 3: Narrow `BackgroundPieceId`** in `LevelData.ts` to the 4 remaining members.
- [ ] **Step 4: Remove the 4 dropped entries** from `BACKGROUND_CATALOG` (`BackgroundCatalog.ts`) and from `BACKGROUND_PALETTE_LABELS` (`backgroundPaletteTiles.ts`) — `BACKGROUND_PALETTE_SPRITES` is derived automatically from `BACKGROUND_CATALOG`'s keys, so it shrinks on its own once the catalog does; verify this is still true in the real file rather than assuming.
- [ ] **Step 5: Run tests to verify they pass** — `npx vitest run src/themes/platformer/engine/BackgroundCatalog.test.ts src/themes/platformer/editor/backgroundPaletteTiles.test.ts`, then `npx tsc --noEmit` (a narrowed `BackgroundPieceId` union can surface compile errors anywhere the 4 dropped ids were referenced elsewhere in the codebase — e.g. any test fixture in `EditorCanvas.test.tsx`/`paintBackgroundCell.test.ts`/`Palette.test.tsx` that happened to use `dirtBlock2x3` etc. as example data must be updated to use a surviving id instead), then the full suite (`npm test`).
- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/engine/BackgroundCatalog.ts src/themes/platformer/engine/BackgroundCatalog.test.ts src/themes/platformer/editor/backgroundPaletteTiles.ts src/themes/platformer/editor/backgroundPaletteTiles.test.ts src/themes/platformer/level/LevelData.ts
git commit -m "fix(platformer): trim the background catalog to 2 clean pieces per color"
```

(Add any other files Step 5's `tsc`/test pass reveals needed updating to this same commit.)

---

### Task 17: Rebuild the catalog from pixel-verified piece boundaries (5 pieces per color)

**Files:**
- Modify: `src/themes/platformer/engine/BackgroundCatalog.ts`
- Modify: `src/themes/platformer/engine/BackgroundCatalog.test.ts`
- Modify: `src/themes/platformer/editor/backgroundPaletteTiles.ts`
- Modify: `src/themes/platformer/editor/backgroundPaletteTiles.test.ts`
- Modify: `src/themes/platformer/level/LevelData.ts`

**Interfaces:**
- `BackgroundPieceId` changes from the 4-member union (`dirtBlock3x3 | dirtColumnA | charcoalBlock3x3 | charcoalColumnA`) to a 10-member union: `dirtBlock3x3 | dirtBlockTop2x1 | dirtBlockBottom2x2 | dirtColumnTop1x1 | dirtColumnBottom1x2 | charcoalBlock3x3 | charcoalBlockTop2x1 | charcoalBlockBottom2x2 | charcoalColumnTop1x1 | charcoalColumnBottom1x2`.

The project owner marked up a copy of `terrain_.png` showing 5 real pieces per color (not the previous 4): the 3×3 block stays one piece, but what was previously treated as one fused "2×3" and one fused "1×3 column" are each actually TWO separate pieces — confirmed by direct pixel measurement (not guesswork this time): scanning row-by-row transparency within the 2-wide and 1-wide column regions (`sx 48-80` and `sx 80-96`, blocksRow starting at `baseSy+32`) shows a real seam 16px down from the top of those columns — a full transparent gap for the dirt variant, a partial dip (a border stroke) for charcoal, at the identical relative row for both colors. Above the seam: a 1-tile-tall piece (16px). Below it: a 2-tile-tall piece (32px). The 3-wide block has NO such seam (verified: fully populated straight through all 48px) — it stays one piece, unchanged from before.

Verified pixel coordinates (both colors share `sx`; `sy = baseSy + 32` for the top row, `baseSy + 48` for the bottom row; `baseSy`: dirt = 0, charcoal = 80):

| Piece | `sx` | `sy` (relative to `baseSy`) | `widthTiles` | `heightTiles` |
|---|---|---|---|---|
| `Block3x3` | 0 | `+32` | 3 | 3 |
| `BlockTop2x1` | 48 | `+32` | 2 | 1 |
| `BlockBottom2x2` | 48 | `+48` | 2 | 2 |
| `ColumnTop1x1` | 80 | `+32` | 1 | 1 |
| `ColumnBottom1x2` | 80 | `+48` | 1 | 2 |

This is a ripple-risk task like Task 16: `dirtColumnA`/`charcoalColumnA` are being removed (split into two new ids each) — any file using them as example/fixture data (not testing the catalog itself) needs updating. `dirtBlock3x3`/`charcoalBlock3x3` are UNCHANGED (same id, same coordinates) — no ripple from those two.

- [ ] **Step 1: Update the failing tests first** — in `BackgroundCatalog.test.ts` and `backgroundPaletteTiles.test.ts`, update the piece-id list to the 10 new members, and add/adjust assertions for the two new pieces per color using the exact `sx`/`sy`/`widthTiles`/`heightTiles` values in the table above (mirror whatever assertion style Task 1's original tests already used for the surviving `Block3x3` pair, e.g. `dirtAndCharcoalVariants-shareTheSameShapeAt80pxApart` extended or duplicated to cover all 5 shapes, not just one).
- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run src/themes/platformer/engine/BackgroundCatalog.test.ts src/themes/platformer/editor/backgroundPaletteTiles.test.ts` (or `npx tsc --noEmit` if the failure is a compile error from the widened union) — confirm it fails referencing the not-yet-added ids.
- [ ] **Step 3: Update `BackgroundPieceId`** in `LevelData.ts` to the 10-member union above.
- [ ] **Step 4: Update `BACKGROUND_CATALOG`** in `BackgroundCatalog.ts` — remove the two `ColumnA` entries, add the 4 new split-piece entries (2 per color) using the table's exact values. Keep `Block3x3` entries unchanged. Consider whether the existing `block(variant, col, widthTiles, heightTiles)` helper can be reused/extended with a `rowOffset` parameter (currently hardcoded to `BLOCK_ROW_OFFSET = 32`) rather than duplicating the sx/sy math inline — use your judgment on the cleanest way to express "same column, two different row-offsets" without overengineering a helper for only 2 use cases.
- [ ] **Step 5: Update `BACKGROUND_PALETTE_LABELS`** in `backgroundPaletteTiles.ts` — remove the two `Column A` labels, add 4 new ones (e.g. `'Dirt Block Top (2×1)'`, `'Dirt Block Bottom (2×2)'`, `'Dirt Column Top (1×1)'`, `'Dirt Column Bottom (1×2)'`, and the charcoal equivalents) — `BACKGROUND_PALETTE_SPRITES` derives automatically from `BACKGROUND_CATALOG`'s keys, verify this is still true rather than assuming, per Task 16's note.
- [ ] **Step 6: Sweep for ripple effects** — grep `src/themes/platformer/` for `dirtColumnA` and `charcoalColumnA` (the two ids being removed); fix every remaining reference (test fixtures using them as generic example data) by substituting an appropriate surviving id — prefer `dirtColumnTop1x1`/`charcoalColumnTop1x1` as the natural 1-wide-footprint replacement unless a specific test's semantics call for something else. Run `npx tsc --noEmit` afterward as the primary tool for finding every reference the grep might miss (e.g. any place the union member appears only in a type position).
- [ ] **Step 7: Run tests to verify they pass** — the two test files from Step 1, then `npx tsc --noEmit`, then the full suite (`npm test`).
- [ ] **Step 8: Manually verify in the browser** — open `/platformer/editor`, switch to the Background layer, and visually confirm all 10 palette buttons render real, distinct, correctly-shaped pieces (no blank buttons, no pieces that look cut off mid-shape) before committing.
- [ ] **Step 9: Commit**

```bash
git add src/themes/platformer/engine/BackgroundCatalog.ts src/themes/platformer/engine/BackgroundCatalog.test.ts src/themes/platformer/editor/backgroundPaletteTiles.ts src/themes/platformer/editor/backgroundPaletteTiles.test.ts src/themes/platformer/level/LevelData.ts
git commit -m "fix(platformer): rebuild background catalog with pixel-verified 5-piece-per-color split"
```

(Add any other files Step 6/7 reveal needed updating to this same commit.)

---

### Task 18: Increase the foreground dim strength from 0.35 to 0.2

**Files:**
- Modify: `src/themes/platformer/editor/EditorCanvas.tsx`
- Modify: `src/themes/platformer/editor/EditorCanvas.test.tsx`

**Interfaces:** none new — a single constant value change.

Requested directly by the project owner: at 0.35 opacity the dimmed foreground is still too visible to see the background tiles clearly while painting them. Lower the value so the foreground is dimmer.

- [ ] **Step 1: Update the failing test(s)** — find every existing test asserting `foregroundAlpha`/`ctx.globalAlpha` equals `0.35` when `activeLayer === 'background'` (added across Tasks 6 and 15) and change the expected value to `0.2`.
- [ ] **Step 2: Run tests to verify they fail** against the still-unchanged `0.35` in the source.
- [ ] **Step 3: Change the constant** — `const foregroundAlpha = activeLayer === 'background' ? 0.2 : 1;` (find its exact current location and surrounding comment in the real file; update the comment too if it mentions the old value).
- [ ] **Step 4: Run tests to verify they pass**, then the full suite (`npm test`).
- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/EditorCanvas.tsx src/themes/platformer/editor/EditorCanvas.test.tsx
git commit -m "fix(platformer): dim the foreground further (0.35 -> 0.2) while painting the background layer"
```

---

### Task 19: Degrade gracefully instead of crashing on an unknown `pieceId`

**Files:**
- Modify: `src/themes/platformer/engine/BackgroundCatalog.ts`
- Modify: `src/themes/platformer/engine/BackgroundCatalog.test.ts`
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- `backgroundCatalogEntry(pieceId: BackgroundPieceId): BackgroundCatalogEntry | undefined` — return type changes from always-present to possibly-`undefined` (the lookup was always a plain `BACKGROUND_CATALOG[pieceId]`; this just makes its already-true runtime behavior visible in the type, since `pieceId` values that reach this function at runtime aren't guaranteed to be a *current* `BackgroundPieceId` — they can come from `localStorage` or a saved level JSON file written before a catalog trim).
- `drawBackgroundTiles` skips any placement whose `pieceId` doesn't resolve to a catalog entry, instead of crashing.

Found during Task 17's manual verification and confirmed by that task's reviewer as a real, reproducible gap, not a one-off testing artifact: a `pieceId` persisted before a catalog trim (in the Level Editor's `localStorage`-backed signals, or in a saved `levels/*.json` file) reaches `backgroundCatalogEntry` unguarded, which returns `undefined`, which `drawBackgroundTiles` immediately dereferences (`entry.sx`) — crashing the whole canvas render (and, in the Level Editor, tripping `EditorCanvas`'s error boundary) instead of just silently not drawing that one placement. This is the second time in this branch's history a catalog trim has produced a stale id (Tasks 16 and 17 both removed entries) — treat this as a permanent property of the system, not a one-time cleanup: catalogs are data that can shrink again later, and stale references to old ids should never be fatal.

**Explicitly out of scope for this task**: validating `pieceId` at the point placements are LOADED (`levelRegistry.ts`'s `isBackgroundPlacement`, or the Level Editor's `loadLevel`) and dropping/warning about stale entries there. That's a legitimate follow-up but a different, larger change (deciding whether to silently drop, warn, or auto-migrate stale placements at load time) — this task's scope is narrower and lower-risk: make the RENDER path never crash on one, regardless of where a stale id came from or whether load-time cleanup ever happens.

- [ ] **Step 1: Write the failing tests**

```typescript
// add to BackgroundCatalog.test.ts
it('unknownPieceId-returnsUndefinedInsteadOfThrowing', () => {
  expect(backgroundCatalogEntry('notARealPieceId' as BackgroundPieceId)).toBeUndefined();
});
```

```typescript
// add to Renderer.test.ts, in the existing describe('drawBackgroundTiles', ...) block
it('placementWithAnUnknownPieceId-isSkippedRatherThanThrown', () => {
  const ctx = fakeCtx(); // reuse whatever mock helper the existing tests in this block already use
  const level: LevelDef = {
    terrain: [],
    width: 0,
    height: 0,
    background: [
      { pieceId: 'notARealPieceId' as BackgroundPieceId, col: 0, row: 0 },
      { pieceId: 'dirtBlock3x3', col: 5, row: 0 },
    ],
  };
  expect(() => drawBackgroundTiles(ctx, level, {} as HTMLImageElement)).not.toThrow();
  expect(ctx.drawImage).toHaveBeenCalledTimes(1); // only the valid placement drew
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/BackgroundCatalog.test.ts src/themes/platformer/engine/Renderer.test.ts -t "unknownPieceId\|isSkippedRatherThanThrown"`
Expected: FAIL — the current `backgroundCatalogEntry` throws or returns an `any`-shaped `undefined` inconsistently with its declared always-present return type, and `drawBackgroundTiles` throws on the missing `.sx`.

- [ ] **Step 3: Change `backgroundCatalogEntry`'s return type and implementation** in `BackgroundCatalog.ts`:

```typescript
export function backgroundCatalogEntry(pieceId: BackgroundPieceId): BackgroundCatalogEntry | undefined {
  return BACKGROUND_CATALOG[pieceId];
}
```

(This is likely already its actual runtime behavior — the only change may be the declared return type. Read the current real file first; if the function currently has different logic, adapt accordingly, but the end state is: never throws, returns `undefined` for an unrecognized id.)

- [ ] **Step 4: Update `drawBackgroundTiles`** in `Renderer.ts` to skip a placement whose entry is `undefined`:

```typescript
for (const placement of placements) {
  const entry = backgroundCatalogEntry(placement.pieceId);
  if (!entry) continue;
  // ...existing ctx.drawImage(...) call, unchanged
}
```

- [ ] **Step 5: Check `paintBackgroundCell.ts`** (from an earlier completed task) — `footprintCells`/`coversCell`/`footprintsOverlap` also call `backgroundCatalogEntry` and read `.widthTiles`/`.heightTiles` off its result without a null check. Since `backgroundCatalogEntry`'s return type is now honestly `| undefined`, this file will fail to compile under `strict: true` once Step 3 lands. Decide the right behavior for THIS file's context (placing/erasing pieces in the editor, where every `pieceId` passed in is always a real, currently-selected catalog piece — never a stale persisted one) and apply the smallest correct fix: either a type-safe fallback (e.g. treat an unresolvable placement's footprint as empty, so it's simply ignored) or a justified non-null assertion with a comment explaining why this call site's `pieceId` is always valid, unlike the render path's. Read the current file yourself and use your judgment — this isn't prescribed exactly because the right answer depends on how the function is actually structured today.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/BackgroundCatalog.test.ts src/themes/platformer/engine/Renderer.test.ts src/themes/platformer/editor/paintBackgroundCell.test.ts`, then `npx tsc --noEmit` (the widened return type may surface other call sites needing the same treatment as Step 5 — fix every one `tsc` finds), then the full suite (`npm test`).

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/engine/BackgroundCatalog.ts src/themes/platformer/engine/BackgroundCatalog.test.ts src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "fix(platformer): never crash rendering on a stale/unknown background piece id"
```

(Add `paintBackgroundCell.ts`/its test, or any other file Step 6's `tsc` pass reveals needed updating, to this same commit.)

---

### Task 20: Keep the foreground grid and background placements from drifting apart

> **Scope correction (mid-task, from the project owner)**: background placements must
> NEVER cause the foreground grid to grow, and export/save must NEVER extend or resize
> the stored layout to accommodate background content — "you don't have to extend the
> level layout for the background... only on render, not on storing the level." This
> narrows the task to just two things: (1) when the foreground grid grows from a
> foreground paint (existing mechanism, unchanged), shift existing `backgroundPlacements`
> by the same `colShift`/`rowShift` so they don't drift from the foreground content they
> sit near; (2) when export/save crops the foreground to its own content bounds
> (unchanged — foreground-only, no union with background), shift `backgroundPlacements`
> by that same crop origin so they stay aligned to whatever foreground survived the crop.
> Background placement coordinates going negative or beyond the cropped layout's nominal
> size afterward is fine and expected — they're draw anchors, not array indices. Steps 3
> and 5 below (originally: union-bounds cropping, background-triggered grid growth) are
> **superseded by this correction** — do not implement them as originally written; see the
> corrected Step 3/6 description inline below instead.

**Files:**
- Modify: `src/themes/platformer/editor/EditorCanvas.tsx`
- Modify: `src/themes/platformer/editor/EditorCanvas.test.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.test.tsx`
- Create: `src/themes/platformer/editor/cropLevelForExport.ts`
- Create: `src/themes/platformer/editor/cropLevelForExport.test.ts`

**Interfaces:**
- `cropLevelForExport(grid: TileChar[][], backgroundPlacements: readonly BackgroundPlacement[]): { layout: readonly string[]; background: BackgroundPlacement[] }` — replaces the direct `exportLayout(grid)` calls in `tryLayout`/`saveCurrentLevel`.
- `EditorCanvas`'s background-paint path starts calling `growGrid` too, and its `onPaintBackground` callback signature grows to also report `colShift`/`rowShift` (mirroring `onPaint`'s existing `{ grid, colShift, rowShift }` shape), so `LevelEditorPage.tsx` can compensate `panOffset` for a background-triggered growth exactly like it already does for foreground growth.

Confirmed directly by the project owner: the foreground grid and the background placement list should never be able to drift apart — the level's effective bounds are the UNION of whatever either layer occupies, not the foreground's bounds alone. Two concrete gaps close this:

1. **Existing background placements don't shift when the foreground grid grows.** `growGrid` (see `growGrid.ts`) prepends `.`-filled rows/columns when painting crosses the grid's left/top edge, and reports `colShift`/`rowShift` so the caller can remap indices. `LevelEditorPage.tsx`'s `onPaint` handler (search for `colShift !== 0 || rowShift !== 0`) already compensates `panOffset` with this, but never touches `backgroundPlacements` — so an existing background piece visually shifts relative to the foreground the moment a foreground paint grows the grid leftward/upward.
2. **Painting a background piece never grows the grid at all** — background placements are a totally unbounded sparse list today, with no connection to the foreground grid's size. A piece painted far outside the current foreground bounds just sits there, disconnected from what `growGrid`/export consider the level's extent.
3. **Export/Save/Try crop to the foreground's content only.** `exportLayout(grid)` computes its bounding box from non-`.` foreground cells alone; a background piece sitting outside that box (or inside it, but closer to an edge that gets cropped) gets silently mis-offset in the exported/saved result, since the crop re-bases the foreground's origin to `(0,0)` without moving `backgroundPlacements` by the same amount.

- [ ] **Step 1: Write the failing tests first** — cover, at minimum:
  - `cropLevelForExport`: given a grid with foreground content in one area and background placements extending further right/down (or further left/up) than any foreground cell, the returned `layout` is cropped to the UNION bounding box (foreground non-`.` cells + every background placement's full footprint, using `backgroundCatalogEntry` for footprint size), and every returned `background` placement's `col`/`row` is reduced by the same origin the layout was cropped to. Include a case where background sits entirely within the foreground's own bounds (result should be unaffected — this is the common case).
  - `EditorCanvas` background-paint path: placing a background piece at a cell outside the current `grid`'s bounds grows the grid (verify via a captured `onPaintBackground` call now receiving non-zero `colShift`/`rowShift`, mirroring the existing `onPaint` test pattern from a completed task).
  - `LevelEditorPage`: when `onPaintBackground` reports a non-zero `colShift`/`rowShift` (from a background paint that grew the grid), `panOffset` is compensated exactly like the existing foreground `onPaint` test already verifies for `colShift`/`rowShift` from a foreground paint. Also: when a FOREGROUND paint grows the grid, existing `backgroundPlacements` are shifted by the same `colShift`/`rowShift` (a new test — this is gap #1 above, and no existing test covers it since it wasn't a requirement until now).

- [ ] **Step 2: Run tests to verify they fail.**

- [ ] **Step 3: Implement `cropLevelForExport.ts`** — read `exportLayout.ts`'s current cropping logic first (the bounding-box-scan-then-crop pattern) and reuse its approach, extended to also scan background placement footprints into the same min/max. Reuse `backgroundCatalogEntry` (from `../engine/BackgroundCatalog`) to know each placement's footprint; if a placement's `pieceId` is unresolvable (Task 19's graceful-degradation case), fall back to treating it as a 1×1 footprint at its anchor for bounding-box purposes only, so a stale placement still counts toward the union bounds without crashing this function too. Do not modify `exportLayout.ts` itself — it stays as the plain foreground-only crop (still used, if anywhere, for cases with no background involved; check whether anything else calls it directly before deciding whether it's now fully superseded by this new function for the editor's own export/save/try paths specifically).

- [ ] **Step 4: Make foreground grid growth shift `backgroundPlacements` too** — in `LevelEditorPage.tsx`'s `onPaint` handler, in the same `if (colShift !== 0 || rowShift !== 0)` block that already compensates `panOffset`, also update `backgroundPlacements` by mapping every placement's `col`/`row` by `+colShift`/`+rowShift` (same sign as the existing `panOffset` compensation's inputs — read the current code carefully to match the sign convention exactly, since `panOffset` moves by the *negative* of the shift while placement coordinates should move by the shift itself, matching how existing foreground grid cells are remapped inside `growGrid`).

- [ ] **Step 5: Make background painting trigger grid growth** — in `EditorCanvas.tsx`'s background-paint branch (in `handleMouseDown`/`handleMouseMove`), before calling `placeBackgroundPiece`, call `growGrid` for the piece's full footprint, not just its anchor cell: look up the piece's `widthTiles`/`heightTiles` via `backgroundCatalogEntry`, then grow to fit both the anchor `(col, row)` and the far corner `(col + widthTiles - 1, row + heightTiles - 1)` (two sequential `growGrid` calls, accumulating any `colShift`/`rowShift` from each, is a reasonable approach — read `growGrid`'s actual signature/behavior first). If growth occurred, remap the placement's own `col`/`row` by the accumulated shift before calling `placeBackgroundPiece`, and also remap every EXISTING `backgroundPlacements` entry by the same shift (mirroring what Step 4 does for foreground-triggered growth) before adding the new one. Update `EditorCanvas`'s `onPaintBackground` prop type to `(next: BackgroundPlacement[], colShift: number, rowShift: number) => void` (or an equivalent shape — your call on the exact signature, as long as it reports the shift) so `LevelEditorPage.tsx` can compensate `panOffset` the same way it already does for foreground growth. Erasing a background cell never needs to grow the grid (removing content only shrinks the meaningful area, never extends it) — only placement does.

- [ ] **Step 6: Wire `cropLevelForExport` into `tryLayout` and `saveCurrentLevel`** — replace their direct `exportLayout(grid)` calls with `cropLevelForExport(grid, backgroundPlacements)`, using its returned `layout` where `exportLayout(grid)`'s result was used, and its returned `background` in place of the raw `backgroundPlacements` (for `currentBackground.value =` in `tryLayout`, and for the `saveLevel(...)` call's background argument in `saveCurrentLevel`).

- [ ] **Step 7: Run tests to verify they pass** — the new/changed test files, then `npx tsc --noEmit`, then the full suite (`npm test`), then `npm run build` (per the final review's finding that `npm test` alone isn't a sufficient gate — always run `tsc`/`build` on a task like this that changes call signatures across files).

- [ ] **Step 8: Manually verify in the browser** — open `/platformer/editor`, paint a background piece near the level's current edge, then paint a foreground tile further out to grow the grid, and confirm the background piece stays visually anchored to whatever foreground content it was placed near (doesn't jump). Then paint a background piece, click Export, and confirm (via the exported text's dimensions, or by reloading the saved level) that cropping didn't silently offset it.

- [ ] **Step 9: Commit**

```bash
git add src/themes/platformer/editor/EditorCanvas.tsx src/themes/platformer/editor/EditorCanvas.test.tsx src/themes/platformer/editor/LevelEditorPage.tsx src/themes/platformer/editor/LevelEditorPage.test.tsx src/themes/platformer/editor/cropLevelForExport.ts src/themes/platformer/editor/cropLevelForExport.test.ts
git commit -m "fix(platformer): keep foreground and background coordinates from drifting apart on grid growth and export"
```

---

### Task 21: Drop unresolvable background placements when a level loads

**Files:**
- Modify: `src/themes/platformer/editor/LevelEditorPage.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.test.tsx`

**Interfaces:** none new — filters `level.background` in `loadLevel`.

Confirmed directly by the project owner: fix now, not deferred. Task 19 made the RENDER path safe against a stale/unresolvable `pieceId` (skips it rather than crashing), but a stale placement loaded from `localStorage` or a saved level JSON currently stays invisible AND permanently un-erasable in the editor (`paintBackgroundCell.ts`'s empty-footprint fallback means right-click can never find it), and round-trips through every subsequent save forever. This branch's own catalog has already been trimmed twice, so stale placements in the project owner's real `localStorage`/saved levels are likely already present, not hypothetical.

- [ ] **Step 1: Write the failing test** — in `LevelEditorPage.test.tsx`, add a test that loads a level (via whatever mechanism existing "loadLevel" tests already use) whose `background` array contains one placement with a valid, current `pieceId` and one with an unresolvable one (e.g. `'notARealPieceId'`), and asserts the resulting `backgroundPlacements` state (and the persisted `editorBackgroundSignal.value`) contains ONLY the valid placement — the unresolvable one is silently dropped, not kept, not crashed on.

- [ ] **Step 2: Run test to verify it fails.**

- [ ] **Step 3: Filter in `loadLevel`** — read the current real `loadLevel` function in `LevelEditorPage.tsx` (it currently does something like `level.background ?? []`) and change it to filter out any placement whose `pieceId` doesn't resolve via `backgroundCatalogEntry` (import from `../engine/BackgroundCatalog`), e.g.:

```typescript
const validBackground = (level.background ?? []).filter(
  (placement) => backgroundCatalogEntry(placement.pieceId) !== undefined,
);
```

  then use `validBackground` everywhere `level.background ?? []` was used (both the local state setter and `editorBackgroundSignal.value =`).

- [ ] **Step 4: Run test to verify it passes**, then the full suite (`npm test`) and `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/LevelEditorPage.tsx src/themes/platformer/editor/LevelEditorPage.test.tsx
git commit -m "fix(platformer): drop unresolvable background placements when a level loads"
```

---

## Self-Review Notes (for whoever executes this plan)

- The catalog in Task 1 covers 8 pieces (2 colours × 4 shapes: a 3×3 block, a 2×3 block,
  and 2 single-column 1×3 pieces) — deliberately a small, high-confidence starting set
  measured directly against a 16px grid overlay on the real sheet. The design doc's
  "outer ring should be 1×1 fillers" guidance (for the later Step 35b pattern block)
  isn't achievable with this catalog alone, since it has no 1×1 pieces yet. Expanding the
  catalog with the sheet's smaller edge-strip and pebble pieces (visible but not
  pixel-measured with full confidence during planning) is a fast follow-up — add entries
  to `BACKGROUND_CATALOG` and `BACKGROUND_PALETTE_LABELS`, no other code changes needed
  — once their exact rects are confirmed visually in the running palette (Task 13, Step
  2 is exactly where that confirmation happens).
- Tasks 8, 9, and 10 have a real circular dependency (`LevelEditorPage`'s `loadLevel`
  needs `LevelEntry.background` from Task 10; its `tryLayout` needs `currentBackground`
  from Task 9) — resolved by doing those two wire-up lines as explicit follow-up steps
  at the end of Tasks 9 and 10 rather than reordering the whole task list. Whoever
  executes Task 8 should not consider it fully done until both follow-ups are checked.
