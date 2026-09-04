# Foreground Decoration Tiles (Bush/Tree + Fence) — Step 36 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a level author paint a bush/tree tile (`n`) and a fence tile (`N`) into the
level layout exactly like any other terrain tile — non-solid, walked/jumped through
freely — where a lone `n` renders as a bush and stacking `n` vertically (no upper limit)
grows a tree from a root piece, a repeatable trunk segment, and a canopy piece.

**Architecture:** Two new `TileType` values (`bush`, `fence`) parsed from new
`TERRAIN_CHARS` entries (`n`, `N`), rendered by `drawTerrain` from a new sprite sheet
(`staticObjects.png`) via a new flat catalog (`StaticObjectsCatalog.ts`). A `bush` cell's
role in a vertical stack (`'only' | 'bottom' | 'middle' | 'top'`) is classified by a new
`verticalRunRole` helper that looks only at the immediate neighbour above/below — no
run-length counting, no cap, so height is naturally unbounded. Painting/erasing needs no
new code (the existing generic `paintCell.ts` already handles any `TERRAIN_CHARS`
character). The Level Editor's Foreground palette gets small subtitle groupings
("Terrain" / "Decoration" / "Entities" / "Tools") so the two new tiles read as their own
category instead of blending into the existing flat grid.

**Tech Stack:** React 19 + TypeScript strict, Vitest + React Testing Library, Canvas 2D
rendering.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-04-foreground-decoration-layer-design.md`
(architecture, rendering mechanism, rationale) and `specs/S-006-platformer-theme/roadmap.md`
(step 36).

## Global Constraints

- TypeScript `strict: true`, no `any`, no `@ts-ignore` (constitution Principle I / III).
- Tests first (constitution Principle II — TDD, NON-NEGOTIABLE). Test naming for new
  behaviour-specific tests follows `{method}-{Condition}-{ExpectedResult}` (see
  `Terrain.test.ts`'s `bridgeRunPosition-*` tests for the house style).
- Named arrow function exports, props interfaces in the same file, `cn()` for conditional
  Tailwind classes, no default exports (constitution Principle III).
- Relative imports (`./`, `../`) within `src/themes/platformer/`; `@/` only for
  cross-cutting app infrastructure (shadcn UI, shared app state) — matches this folder's
  existing convention.
- No new dependencies.
- `bush`/`fence` are purely visual: `isSolid`/`isClimbable` must never return `true` for
  either, and nothing in `Physics.ts` may reference them.

---

## File Structure

- **Modify** `src/themes/platformer/level/LevelData.ts` — add `'bush'` and `'fence'` to
  `TileType`.
- **Modify** `src/themes/platformer/level/LevelParser.ts` — add `n`/`N` to
  `TERRAIN_CHARS` and to the `TileChar` union.
- **Modify** `src/themes/platformer/level/LevelParser.test.ts` — extend the `TileChar`
  coverage test's hardcoded array with `n`/`N`.
- **Modify** `src/themes/platformer/level/Terrain.ts` — add `VerticalRunRole` and
  `verticalRunRole()`.
- **Modify** `src/themes/platformer/level/Terrain.test.ts` — cover `verticalRunRole` and
  extend the existing `isSolid`/`isClimbable` "returns false" assertions to include
  `'bush'`/`'fence'`.
- **Create** `src/themes/platformer/engine/StaticObjectsCatalog.ts` — the sprite catalog
  (one entry per role: bush/root/trunk/canopy/fence) plus `bushOrTreeEntry`/
  `staticObjectEntry` lookup functions.
- **Create** `src/themes/platformer/engine/StaticObjectsCatalog.test.ts`.
- **Modify** `src/themes/platformer/entities/sprites/sheets.ts` — add
  `STATIC_OBJECTS_SHEET`.
- **Modify** `src/themes/platformer/engine/Renderer.ts` — extend `drawTerrain` with the
  `fence`/`bush` branches and a new (optional, defaulted) `staticObjects` parameter.
- **Modify** `src/themes/platformer/engine/Renderer.test.ts` — cover the new branches.
- **Modify** `src/themes/platformer/editor/paletteTiles.ts` — add `n`/`N` entries to
  `PALETTE_TILE_SPRITES`, `PALETTE_TILE_LABELS`, `PALETTE_TILE_DESCRIPTIONS`.
- **Modify** `src/themes/platformer/editor/Palette.tsx` — group the Foreground tab's
  tiles under "Terrain"/"Decoration"/"Entities"/"Tools" subtitles.
- **Modify** `src/themes/platformer/editor/Palette.test.tsx` — cover the new grouping.
- **Modify** `src/themes/platformer/PlatformerPage.tsx` — load `STATIC_OBJECTS_SHEET`
  into a new `staticObjectsRef` and pass it to `drawTerrain`.
- **Modify** `src/themes/platformer/editor/EditorCanvas.tsx` — add `staticObjects` to
  `EditorImages` and pass it to `drawTerrain`.
- **Modify** `src/themes/platformer/editor/EditorCanvas.test.tsx` — add `staticObjects:
  null` to the file's `EditorImages` test fixture(s) so existing tests keep compiling.
- **Modify** `src/themes/platformer/editor/LevelEditorPage.tsx` — add `staticObjects` to
  `EMPTY_IMAGES` and `IMAGE_SOURCES`.

---

### Task 1: `bush`/`fence` tile types

**Files:**
- Modify: `src/themes/platformer/level/LevelData.ts`
- Modify: `src/themes/platformer/level/Terrain.test.ts`

**Interfaces:**
- Produces: `TileType` gains `'bush' | 'fence'`.

- [ ] **Step 1: Write the failing tests**

Add to `Terrain.test.ts`'s existing `isSolid`/`isClimbable` describe blocks (do not
create new ones — extend the existing `it('isSolid-patrol-returnsFalse', ...)`-style
assertions):

```typescript
it('isSolid-bushAndFence-returnFalse', () => {
  expect(isSolid('bush')).toBe(false);
  expect(isSolid('fence')).toBe(false);
});

it('isClimbable-bushAndFence-returnFalse', () => {
  expect(isClimbable('bush')).toBe(false);
  expect(isClimbable('fence')).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/Terrain.test.ts`
Expected: FAIL — TypeScript error, `'bush'`/`'fence'` are not assignable to `TileType`.

- [ ] **Step 3: Add the two tile types**

In `LevelData.ts`, extend the `TileType` union (insert alongside the other terrain
values, before `'empty'`):

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/Terrain.test.ts`
Expected: PASS (all tests in the file, including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/LevelData.ts src/themes/platformer/level/Terrain.test.ts
git commit -m "feat(platformer): add bush and fence tile types"
```

---

### Task 2: `n`/`N` level layout characters

**Files:**
- Modify: `src/themes/platformer/level/LevelParser.ts`
- Modify: `src/themes/platformer/level/LevelParser.test.ts`

**Interfaces:**
- Consumes: `'bush' | 'fence'` (Task 1).
- Produces: `TERRAIN_CHARS.n === 'bush'`, `TERRAIN_CHARS.N === 'fence'`; `TileChar` gains
  `'n' | 'N'`.

- [ ] **Step 1: Write the failing tests**

Add to `LevelParser.test.ts`, in the same describe block as the existing
`TERRAIN_CHARS.B`/`.G`/etc. assertions (around line 36-40):

```typescript
it('TERRAIN_CHARS-n-mapsToBush', () => {
  expect(TERRAIN_CHARS.n).toBe('bush');
});

it('TERRAIN_CHARS-N-mapsToFence', () => {
  expect(TERRAIN_CHARS.N).toBe('fence');
});
```

Also update the `TileChar` coverage test (the hardcoded array in the `describe('TileChar'
...)` block at the end of the file) to include the two new characters:

```typescript
const tileChars: readonly TileChar[] = [
  '.', 'G', 'R', 'W', 'B', 'L', 'P', 'S', 'E', 'M', 'C', 'X', 'Q', 'F', 'T',
  '1', '2', '3', '4', '5', 'n', 'N',
];
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/LevelParser.test.ts`
Expected: FAIL — `TERRAIN_CHARS.n`/`.N` are `undefined`; TypeScript error on `'n' | 'N'`
not being assignable to `TileChar` in the updated test array.

- [ ] **Step 3: Add the characters**

In `LevelParser.ts`, add to `TERRAIN_CHARS` (after `P: 'patrol',`):

```typescript
export const TERRAIN_CHARS: Record<string, TileType | undefined> = {
  '.': 'empty',
  G: 'groundGrass',
  R: 'groundRock',
  W: 'wall',
  B: 'bridge',
  L: 'ladder',
  P: 'patrol',
  n: 'bush',
  N: 'fence',
};
```

Add `n`/`N` to the `TileChar` union (after `'T'`, before `'1'`):

```typescript
export type TileChar =
  | '.'
  | 'G'
  | 'R'
  | 'W'
  | 'B'
  | 'L'
  | 'P'
  | 'S'
  | 'E'
  | 'M'
  | 'C'
  | 'X'
  | 'Q'
  | 'F'
  | 'T'
  | 'n'
  | 'N'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/LevelParser.test.ts`
Expected: PASS. This will also surface TypeScript errors in
`src/themes/platformer/editor/paletteTiles.ts` (its three `Record<TileChar, ...>`
exports are now missing `n`/`N` keys) — that's expected and fixed in Task 6; run
`npx tsc --noEmit` now to confirm exactly those errors are the only ones, then continue.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/LevelParser.ts src/themes/platformer/level/LevelParser.test.ts
git commit -m "feat(platformer): add n/N level layout characters for bush and fence"
```

---

### Task 3: `verticalRunRole` classification helper

**Files:**
- Modify: `src/themes/platformer/level/Terrain.ts`
- Modify: `src/themes/platformer/level/Terrain.test.ts`

**Interfaces:**
- Consumes: `tileAt`, `LevelDef`, `TileType` (existing).
- Produces: `VerticalRunRole = 'only' | 'bottom' | 'middle' | 'top'`,
  `verticalRunRole(level: LevelDef, col: number, row: number, tile: TileType):
  VerticalRunRole`.

- [ ] **Step 1: Write the failing tests**

Add a new describe block to `Terrain.test.ts`:

```typescript
describe('verticalRunRole', () => {
  it('noMatchingTileAboveOrBelow-returnsOnly', () => {
    const level: LevelDef = { terrain: [['empty'], ['bush'], ['empty']], width: 1, height: 3 };
    expect(verticalRunRole(level, 0, 1, 'bush')).toBe('only');
  });

  it('matchingTileBelowButNotAbove-returnsBottom', () => {
    const level: LevelDef = { terrain: [['empty'], ['bush'], ['bush']], width: 1, height: 3 };
    expect(verticalRunRole(level, 0, 2, 'bush')).toBe('bottom');
  });

  it('matchingTileAboveButNotBelow-returnsTop', () => {
    const level: LevelDef = { terrain: [['bush'], ['bush'], ['empty']], width: 1, height: 3 };
    expect(verticalRunRole(level, 0, 0, 'bush')).toBe('top');
  });

  it('matchingTilesAboveAndBelow-returnsMiddle', () => {
    const level: LevelDef = { terrain: [['bush'], ['bush'], ['bush']], width: 1, height: 3 };
    expect(verticalRunRole(level, 0, 1, 'bush')).toBe('middle');
  });

  it('topOfLevel-outOfBoundsAboveCountsAsEmpty-returnsBottomNotMiddle', () => {
    const level: LevelDef = { terrain: [['bush'], ['bush']], width: 1, height: 2 };
    expect(verticalRunRole(level, 0, 0, 'bush')).toBe('bottom');
  });

  it('bottomOfLevel-outOfBoundsBelowCountsAsEmpty-returnsTopNotMiddle', () => {
    const level: LevelDef = { terrain: [['bush'], ['bush']], width: 1, height: 2 };
    expect(verticalRunRole(level, 0, 1, 'bush')).toBe('top');
  });

  it('differentTileTypeAboveAndBelow-doesNotCountAsAMatch', () => {
    const level: LevelDef = { terrain: [['wall'], ['bush'], ['wall']], width: 1, height: 3 };
    expect(verticalRunRole(level, 0, 1, 'bush')).toBe('only');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/Terrain.test.ts -t verticalRunRole`
Expected: FAIL — `verticalRunRole is not exported`.

- [ ] **Step 3: Write the minimal implementation**

Add to `Terrain.ts`, after `bridgeRunPosition`:

```typescript
export type VerticalRunRole = 'only' | 'bottom' | 'middle' | 'top';

/**
 * Classifies `(col, row)`'s position within a vertical run of `tile`-typed
 * cells, by comparing only its immediate neighbours above and below —
 * unlike `horizontalRunPosition`, this never counts a run's full length, so
 * an arbitrarily tall stack (e.g. a tree with no height cap) costs no more
 * to classify than a lone tile. `tileAt` already returns `'empty'` for any
 * out-of-bounds row, so a cell at the top or bottom of the level correctly
 * reads as having no matching neighbour there.
 */
export function verticalRunRole(
  level: LevelDef,
  col: number,
  row: number,
  tile: TileType,
): VerticalRunRole {
  const above = tileAt(level, col, row - 1) === tile;
  const below = tileAt(level, col, row + 1) === tile;

  if (!above && !below) return 'only';
  if (!above && below) return 'bottom';
  if (above && !below) return 'top';
  return 'middle';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/Terrain.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/Terrain.ts src/themes/platformer/level/Terrain.test.ts
git commit -m "feat(platformer): add verticalRunRole for stacked-tile classification"
```

---

### Task 4: Static objects sprite catalog

**Files:**
- Modify: `src/themes/platformer/entities/sprites/sheets.ts`
- Create: `src/themes/platformer/engine/StaticObjectsCatalog.ts`
- Create: `src/themes/platformer/engine/StaticObjectsCatalog.test.ts`

**Interfaces:**
- Consumes: `TILE_SIZE` (from `../level/Terrain`), `VerticalRunRole` (Task 3).
- Produces: `STATIC_OBJECTS_SHEET: SpriteSheet`; `StaticObjectEntry { sx: number; sy:
  number }`; `bushOrTreeEntry(role: VerticalRunRole, col: number, row: number):
  StaticObjectEntry`; `staticObjectEntry(tile: 'fence', col: number, row: number):
  StaticObjectEntry`.

`public/sprites/staticObjects.png` is 288×144px, an 18×9 grid of 16px tiles, currently
unused by the codebase. Visual inspection of the sheet places a round bushy shape at the
top-left (`sx: 0, sy: 0`), a small pine-tree-shaped sprite two tiles further right
(`sx: 32, sy: 0`), and a lattice/grid-pattern piece near the bottom-right (`sx: 96, sy:
128`) that reads as a fence. This task uses one entry per role to start (bush, root,
trunk, canopy, fence) — the design's variant-selection mechanism still gets built (so
adding more variants later needs no mechanism change), but with exactly one entry per
role today, selecting a "variant" always resolves to that one entry. If these coordinates
don't line up with the intended art once seen at full size in the running editor, adjust
the `sx`/`sy` constants in this file — the tests only assert the mechanism (role → entry,
determinism, variety, sheet-bounds), not that these particular numbers are the final
word on which pixels look best.

- [ ] **Step 1: Write the failing test for `STATIC_OBJECTS_SHEET`**

```typescript
// add to a new describe block in an existing sheets-related test file if one exists —
// check first with: ls src/themes/platformer/entities/sprites/*.test.ts
// If none exists, skip this step (sheets.ts has no existing test file convention to
// follow) and proceed straight to Step 3's addition — it's plain data, covered
// indirectly by StaticObjectsCatalog.test.ts consuming STATIC_OBJECTS_SHEET.src below.
```

- [ ] **Step 2: Add `STATIC_OBJECTS_SHEET`**

In `sheets.ts`, add after `GROUND_ATLAS_SHEET`:

```typescript
/** `staticObjects.png` is a 288x144 sheet of 16px tiles: bush/tree pieces and
 *  a fence piece for the foreground decoration tiles. `StaticObjectsCatalog.ts`
 *  addresses it through its own sx/sy lookup, not by frame index — like
 *  `TERRAIN_BACKGROUND_SHEET`, this registration exists for loading, not
 *  addressing. */
export const STATIC_OBJECTS_SHEET: SpriteSheet = {
  src: '/sprites/staticObjects.png',
  frameWidth: TILE_SIZE,
  frameHeight: TILE_SIZE,
  columns: 18,
};
```

- [ ] **Step 3: Write the failing catalog tests**

```typescript
// src/themes/platformer/engine/StaticObjectsCatalog.test.ts
import { describe, it, expect } from 'vitest';
import { bushOrTreeEntry, staticObjectEntry } from './StaticObjectsCatalog';

const SHEET_WIDTH = 288;
const SHEET_HEIGHT = 144;
const TILE_SIZE = 16;
const ROLES = ['only', 'bottom', 'middle', 'top'] as const;

describe('StaticObjectsCatalog', () => {
  it.each(ROLES)('bushOrTreeEntry-%s-resolvesToARectInsideTheSheetOnA16pxGrid', (role) => {
    const entry = bushOrTreeEntry(role, 0, 0);
    expect(entry.sx % TILE_SIZE).toBe(0);
    expect(entry.sy % TILE_SIZE).toBe(0);
    expect(entry.sx + TILE_SIZE).toBeLessThanOrEqual(SHEET_WIDTH);
    expect(entry.sy + TILE_SIZE).toBeLessThanOrEqual(SHEET_HEIGHT);
  });

  it('bushOrTreeEntry-sameRoleAndPosition-isDeterministic', () => {
    expect(bushOrTreeEntry('bottom', 3, 5)).toEqual(bushOrTreeEntry('bottom', 3, 5));
  });

  it('bushOrTreeEntry-differentRoles-resolveToDifferentEntries', () => {
    const only = bushOrTreeEntry('only', 0, 0);
    const bottom = bushOrTreeEntry('bottom', 0, 0);
    const middle = bushOrTreeEntry('middle', 0, 0);
    const top = bushOrTreeEntry('top', 0, 0);
    expect(only).not.toEqual(bottom);
    expect(bottom).not.toEqual(middle);
    expect(middle).not.toEqual(top);
    expect(top).not.toEqual(only);
  });

  it('staticObjectEntry-fence-resolvesToARectInsideTheSheetOnA16pxGrid', () => {
    const entry = staticObjectEntry('fence', 0, 0);
    expect(entry.sx % TILE_SIZE).toBe(0);
    expect(entry.sy % TILE_SIZE).toBe(0);
    expect(entry.sx + TILE_SIZE).toBeLessThanOrEqual(SHEET_WIDTH);
    expect(entry.sy + TILE_SIZE).toBeLessThanOrEqual(SHEET_HEIGHT);
  });

  it('staticObjectEntry-fence-ignoresPositionAndAlwaysReturnsTheSameEntry', () => {
    expect(staticObjectEntry('fence', 1, 1)).toEqual(staticObjectEntry('fence', 9, 9));
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/StaticObjectsCatalog.test.ts`
Expected: FAIL — `Cannot find module './StaticObjectsCatalog'`.

- [ ] **Step 5: Write the minimal implementation**

```typescript
// src/themes/platformer/engine/StaticObjectsCatalog.ts
import { TILE_SIZE } from '../level/Terrain';
import type { VerticalRunRole } from '../level/Terrain';

export interface StaticObjectEntry {
  sx: number;
  sy: number;
}

/** One or more sprite variants per role. A cell's variant is picked
 *  deterministically from its own column and row (see `pickVariant`) so
 *  neighbouring cells of the same role don't all look identical once a
 *  role gains more than one variant — with exactly one variant per role
 *  today, every position resolves to that single entry. */
const BUSH_OR_TREE_VARIANTS: Record<VerticalRunRole, StaticObjectEntry[]> = {
  only: [{ sx: 0, sy: 0 }],
  bottom: [{ sx: 0, sy: 48 }],
  middle: [{ sx: 0, sy: 64 }],
  top: [{ sx: 0, sy: 16 }],
};

const FENCE_VARIANTS: StaticObjectEntry[] = [{ sx: 96, sy: 128 }];

function pickVariant<T>(variants: readonly T[], col: number, row: number): T {
  const index = (col * 31 + row * 17) % variants.length;
  return variants[index];
}

export function bushOrTreeEntry(role: VerticalRunRole, col: number, row: number): StaticObjectEntry {
  return pickVariant(BUSH_OR_TREE_VARIANTS[role], col, row);
}

export function staticObjectEntry(tile: 'fence', col: number, row: number): StaticObjectEntry {
  void tile; // only one static-object kind uses this function today
  return pickVariant(FENCE_VARIANTS, col, row);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/StaticObjectsCatalog.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/entities/sprites/sheets.ts src/themes/platformer/engine/StaticObjectsCatalog.ts src/themes/platformer/engine/StaticObjectsCatalog.test.ts
git commit -m "feat(platformer): add static objects sprite catalog for bush/tree/fence"
```

---

### Task 5: Render bush/fence in `drawTerrain`

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `verticalRunRole` (Task 3), `bushOrTreeEntry`/`staticObjectEntry` (Task 4).
- Produces: `drawTerrain`'s signature becomes `drawTerrain(ctx, level, tileset,
  groundAtlas, originX = 0, originY = 0, staticObjects: HTMLImageElement | null =
  null): void` — the new parameter is appended at the end with a default, so every one
  of the ~25 existing calls in `Renderer.test.ts` (which omit it) keeps compiling and
  passing unchanged (they simply exercise other tile types, so `bush`/`fence` never
  render in those tests — expected).

- [ ] **Step 1: Write the failing tests**

Add a new describe block to `Renderer.test.ts` — check the file's existing `drawTerrain`
tests (search for `function fakeCtx` or similar helper near the top) and reuse whatever
fake-canvas-context helper they already use instead of redefining one:

```typescript
describe('drawTerrain — bush/fence', () => {
  it('fenceTile-drawnFromStaticObjectsAtTheRightDestination', () => {
    const ctx = fakeCtx(); // reuse the file's existing fake context helper
    const level: LevelDef = { terrain: [['fence']], width: 1, height: 1 };
    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 96, 128, 16, 16,
      0, 0, 32, 32,
    );
  });

  it('loneBushTile-drawsTheOnlyRoleArt', () => {
    const ctx = fakeCtx();
    const level: LevelDef = { terrain: [['bush']], width: 1, height: 1 };
    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 0, 0, 16, 16,
      0, 0, 32, 32,
    );
  });

  it('twoStackedBushTiles-drawBottomAndTopRoleArtAtTheirOwnCells', () => {
    const ctx = fakeCtx();
    const level: LevelDef = { terrain: [['bush'], ['bush']], width: 1, height: 2 };
    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // row 0 (top of the level, top of the run) draws canopy art at sy: 16
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 0, 16, 16, 16,
      0, 0, 32, 32,
    );
    // row 1 (bottom of the run) draws root art at sy: 48
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 0, 48, 16, 16,
      0, 32, 32, 32,
    );
  });

  it('threeStackedBushTiles-middleTileDrawsTrunkRoleArt', () => {
    const ctx = fakeCtx();
    const level: LevelDef = { terrain: [['bush'], ['bush'], ['bush']], width: 1, height: 3 };
    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // row 1 (middle of the run) draws trunk art at sy: 64
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 0, 64, 16, 16,
      0, 32, 32, 32,
    );
  });

  it('staticObjectsNotLoaded-bushAndFenceDrawNothingButOtherTerrainStillRenders', () => {
    const ctx = fakeCtx();
    const level: LevelDef = { terrain: [['bush', 'wall']], width: 2, height: 1 };
    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas, 0, 0, null);

    // wall (sx: 8*16=128, sy: 0) still draws from the tileset.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset, 128, 0, 16, 16,
      32, 0, 32, 32,
    );
    expect(ctx.drawImage).not.toHaveBeenCalledWith(
      expect.anything(), 0, expect.anything(), expect.anything(), expect.anything(),
      0, 0, expect.anything(), expect.anything(),
    );
  });
});
```

Add `const fakeStaticObjects = {} as HTMLImageElement;` near wherever the file already
declares `fakeTileset`/`fakeGroundAtlas`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts -t "drawTerrain — bush/fence"`
Expected: FAIL — `bush`/`fence` don't render (no matching `drawImage` call); TypeScript
error on the extra `drawTerrain` argument until Step 3 lands.

- [ ] **Step 3: Implement**

In `Renderer.ts`, add the import (alongside the existing `backgroundCatalogEntry`
import):

```typescript
import { bushOrTreeEntry, staticObjectEntry } from './StaticObjectsCatalog';
```

Also add `verticalRunRole` to the existing `import { tileAt, ... } from '../level/Terrain'`
line (whatever that import currently lists — add `verticalRunRole` to it).

Change `drawTerrain`'s signature and add the two new branches, inserted right before the
existing `const source = tileSource(level, tile, col, row);` line inside the loop body:

```typescript
export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  tileset: HTMLImageElement,
  groundAtlas: HTMLImageElement,
  originX = 0,
  originY = 0,
  staticObjects: HTMLImageElement | null = null,
): void {
  ctx.imageSmoothingEnabled = false;

  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const tile = tileAt(level, col, row);
      const { x, y } = tileToPixel(col, row);
      const destX = x + originX;
      const destY = y + originY;

      if (tile === 'groundGrass') {
        // ...unchanged existing groundGrass branch...
        continue;
      }

      if (staticObjects && (tile === 'fence' || tile === 'bush')) {
        const entry =
          tile === 'fence'
            ? staticObjectEntry('fence', col, row)
            : bushOrTreeEntry(verticalRunRole(level, col, row, 'bush'), col, row);
        ctx.drawImage(
          staticObjects, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
          destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
        );
        continue;
      }

      const source = tileSource(level, tile, col, row);
      if (!source) continue;

      // ...unchanged existing ctx.drawImage(tileset, ...) call...
    }
  }
}
```

Do not touch `tileSource`'s own `switch` — it stays exhaustive over `TileType`, so add a
`case 'bush':` and `case 'fence':` returning `null` there too (matching `'patrol'`'s
existing `return null;` case), otherwise the `default: { const _exhaustive: never =
type; ... }` branch fails to compile once `TileType` includes the two new values (this
is only reachable when `staticObjects` is `null`, since the new branch above already
`continue`s past it otherwise).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS — the 5 new tests, plus every pre-existing `drawTerrain` test in the file
(confirm none of the ~25 calls that omit the new parameter regressed).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): render bush and fence tiles in drawTerrain"
```

---

### Task 6: Palette entries and subtitle grouping

**Files:**
- Modify: `src/themes/platformer/editor/paletteTiles.ts`
- Modify: `src/themes/platformer/editor/Palette.tsx`
- Modify: `src/themes/platformer/editor/Palette.test.tsx`

**Interfaces:**
- Consumes: `TileChar` (Task 2, now including `n`/`N`).
- Produces: `PALETTE_TILE_SPRITES.n`/`.N`, `PALETTE_TILE_LABELS.n`/`.N`,
  `PALETTE_TILE_DESCRIPTIONS.n`/`.N`; `Palette` renders four labeled groups
  ("Terrain", "Decoration", "Entities", "Tools") instead of one flat grid.

- [ ] **Step 1: Write the failing tests for the palette sprite table**

Add to `paletteTiles.test.ts` if one exists (`ls
src/themes/platformer/editor/paletteTiles.test.ts` first — if it doesn't exist, add
these as a new file with that name importing from `./paletteTiles`):

```typescript
import { describe, it, expect } from 'vitest';
import { PALETTE_TILE_SPRITES, PALETTE_TILE_LABELS, PALETTE_TILE_DESCRIPTIONS } from './paletteTiles';

describe('paletteTiles — bush/fence', () => {
  it('n-hasANonNullSprite', () => {
    expect(PALETTE_TILE_SPRITES.n).not.toBeNull();
  });

  it('N-hasANonNullSprite', () => {
    expect(PALETTE_TILE_SPRITES.N).not.toBeNull();
  });

  it('nAndN-haveNonEmptyLabelsAndDescriptions', () => {
    expect(PALETTE_TILE_LABELS.n.length).toBeGreaterThan(0);
    expect(PALETTE_TILE_LABELS.N.length).toBeGreaterThan(0);
    expect(PALETTE_TILE_DESCRIPTIONS.n.length).toBeGreaterThan(0);
    expect(PALETTE_TILE_DESCRIPTIONS.N.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/paletteTiles.test.ts`
Expected: FAIL — TypeScript error, `PALETTE_TILE_SPRITES`/`_LABELS`/`_DESCRIPTIONS` are
missing the `n`/`N` keys their `Record<TileChar, ...>` type now requires (since Task 2
added `n`/`N` to `TileChar`).

- [ ] **Step 3: Add the palette entries**

In `paletteTiles.ts`, add to `PALETTE_TILE_SPRITES` (after the `T: {...}` entry, before
`'1': {...}`):

```typescript
n: {
  sheet: '/sprites/staticObjects.png',
  sheetWidth: 288,
  sheetHeight: 144,
  sx: 0,
  sy: 0,
  frameWidth: 16,
  frameHeight: 16,
},
N: {
  sheet: '/sprites/staticObjects.png',
  sheetWidth: 288,
  sheetHeight: 144,
  sx: 96,
  sy: 128,
  frameWidth: 16,
  frameHeight: 16,
},
```

Add to `PALETTE_TILE_DESCRIPTIONS`:

```typescript
n: 'Bush; stack vertically to grow a tree (root, trunk, canopy)',
N: 'Fence',
```

Add to `PALETTE_TILE_LABELS`:

```typescript
n: 'Bush / Tree',
N: 'Fence',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/paletteTiles.test.ts`
Expected: PASS (4 tests). Also run `npx tsc --noEmit` to confirm the `Record<TileChar,
...>` errors from Task 2 are now gone.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/paletteTiles.ts src/themes/platformer/editor/paletteTiles.test.ts
git commit -m "feat(platformer): add bush/fence palette entries"
```

- [ ] **Step 6: Write the failing tests for subtitle grouping**

Read the current `Palette.tsx` and `Palette.test.tsx` in full before this step — their
exact structure may have shifted since this plan was written. Add to `Palette.test.tsx`:

```typescript
describe('Palette — subtitle groups', () => {
  it('foregroundLayer-rendersFourGroupHeadings', () => {
    render(<Palette {...defaultProps} />); // reuse this file's existing defaultProps
    expect(screen.getByText('Terrain')).toBeInTheDocument();
    expect(screen.getByText('Decoration')).toBeInTheDocument();
    expect(screen.getByText('Entities')).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
  });

  it('decorationGroup-containsBushAndFenceButNoOtherTerrainChar', () => {
    render(<Palette {...defaultProps} />);
    const decorationHeading = screen.getByText('Decoration');
    const decorationGroup = decorationHeading.closest('section') ?? decorationHeading.parentElement!;
    expect(within(decorationGroup).getByRole('button', { name: /Bush/ })).toBeInTheDocument();
    expect(within(decorationGroup).getByRole('button', { name: /Fence/ })).toBeInTheDocument();
    expect(within(decorationGroup).queryByRole('button', { name: 'Wall' })).not.toBeInTheDocument();
  });
});
```

Add `import { within } from '@testing-library/react';` to the test file's existing
`@testing-library/react` import if `within` isn't already imported there.

- [ ] **Step 7: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/Palette.test.tsx -t "subtitle groups"`
Expected: FAIL — no "Terrain"/"Decoration"/"Entities"/"Tools" text exists yet.

- [ ] **Step 8: Implement the grouping**

In `Palette.tsx`, replace the `terrainKeys`/`tileKeys` derivation and the single
`tileKeys.map(...)` render with four grouped sections. Read the file's current imports
first — this keeps the existing `TERRAIN_CHARS`/`ENTITY_CHARS`/`SIGN_CHARS` imports and
`PaletteTile` usage, only restructuring how the foreground branch renders:

```typescript
const DECORATION_CHARS: TileChar[] = ['n', 'N'];

// ...inside the component, replacing the existing terrainKeys/entityKeys/signKeys/tileKeys lines:
const allTerrainKeys = (Object.keys(TERRAIN_CHARS) as TileChar[]).filter((key) => key !== EMPTY_CHAR);
const terrainKeys = allTerrainKeys.filter((key) => !DECORATION_CHARS.includes(key));
const decorationKeys = allTerrainKeys.filter((key) => DECORATION_CHARS.includes(key));
const entityKeys = Object.keys(ENTITY_CHARS) as TileChar[];
const [firstSignKey] = Object.keys(SIGN_CHARS) as TileChar[];
const toolKeys: TileChar[] = [...(firstSignKey ? [firstSignKey] : []), EMPTY_CHAR];

const renderGroup = (title: string, keys: TileChar[]) => (
  <section key={title}>
    <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
    <div className="grid grid-cols-2 gap-2">
      {keys.map((key) => (
        <PaletteTile
          key={key}
          label={PALETTE_TILE_LABELS[key]}
          description={PALETTE_TILE_DESCRIPTIONS[key]}
          sprite={PALETTE_TILE_SPRITES[key]}
          glyph={PALETTE_TILE_GLYPHS[key]}
          selected={selectedTool === key}
          onClick={() => onSelectTool(key)}
        />
      ))}
    </div>
  </section>
);
```

Replace the `CardContent`'s foreground branch (the `tileKeys.map((key) => ...)` JSX) with:

```typescript
{activeLayer === 'foreground' ? (
  <div className="flex flex-col gap-3">
    {renderGroup('Terrain', terrainKeys)}
    {renderGroup('Decoration', decorationKeys)}
    {renderGroup('Entities', entityKeys)}
    {renderGroup('Tools', toolKeys)}
  </div>
) : (
  // ...unchanged existing BACKGROUND_PIECE_IDS.map(...) branch...
)}
```

Keep the outer `CardContent` element itself (drop its `grid grid-cols-2 gap-2` className
since that grid now lives per-group inside `renderGroup`, not on `CardContent` directly).

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/Palette.test.tsx`
Expected: PASS — the 2 new tests, plus every pre-existing test in the file (confirm the
background-layer tab and every existing foreground tile button still render correctly
under their new group).

- [ ] **Step 10: Commit**

```bash
git add src/themes/platformer/editor/Palette.tsx src/themes/platformer/editor/Palette.test.tsx
git commit -m "feat(platformer): group the palette into Terrain/Decoration/Entities/Tools"
```

---

### Task 7: Wire the static objects image into the game and editor

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/editor/EditorCanvas.tsx`
- Modify: `src/themes/platformer/editor/EditorCanvas.test.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.tsx`

**Interfaces:**
- Consumes: `STATIC_OBJECTS_SHEET` (Task 4), `drawTerrain`'s new `staticObjects`
  parameter (Task 5).
- Produces: `EditorImages` gains `staticObjects: HTMLImageElement | null`.

This task has no new unit-testable pure logic of its own (it's wiring — loading an image
and threading a ref through to an already-tested `drawTerrain` call), so it's covered by
one `EditorCanvas` test plus the manual browser verification at the end, rather than a
new TDD cycle per file.

- [ ] **Step 1: Write the failing test**

Read the current `EditorCanvas.test.tsx` in full first — locate its `baseImages` (or
equivalently-named) `EditorImages` fixture used across its existing tests.

```typescript
// add to EditorCanvas.test.tsx
it('staticObjectsLoaded-passedThroughToDrawTerrain', () => {
  const fakeStaticObjects = {} as HTMLImageElement;
  render(
    <EditorCanvas
      grid={[['.']]}
      selectedTool="."
      panOffset={{ x: 0, y: 0 }}
      images={{ ...baseImages, staticObjects: fakeStaticObjects }}
      backgroundPlacements={[]}
      activeLayer="foreground"
      selectedBackgroundPiece={null}
      onPaint={vi.fn()}
      onPaintBackground={vi.fn()}
      onPan={vi.fn()}
    />,
  );

  expect(drawTerrain).toHaveBeenCalledWith(
    expect.anything(), expect.anything(), expect.anything(), expect.anything(),
    expect.anything(), expect.anything(), fakeStaticObjects,
  );
});
```

Add `staticObjects: null` to every existing `EditorImages` object literal in this test
file (`baseImages`, `EMPTY_IMAGES`, or whatever it's named) so they keep type-checking
once `EditorImages` gains the new required field in Step 2.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/editor/EditorCanvas.test.tsx -t staticObjectsLoaded`
Expected: FAIL — TypeScript error (`staticObjects` missing from `EditorImages` literals)
until this step's edits land, then a runtime FAIL (`drawTerrain` not called with the 7th
argument) until Step 3 lands.

- [ ] **Step 3: Implement `EditorCanvas.tsx`**

Add to the `EditorImages` interface:

```typescript
staticObjects: HTMLImageElement | null;
```

In the main draw `useEffect`, change the existing `drawTerrain` call:

```typescript
if (images.tileset && images.groundAtlas) {
  drawTerrain(
    ctx,
    gridToLevelDef(grid),
    images.tileset,
    images.groundAtlas,
    panOffset.x,
    panOffset.y,
    images.staticObjects,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/editor/EditorCanvas.test.tsx`
Expected: PASS — the new test, plus every pre-existing test in the file.

- [ ] **Step 5: Wire `LevelEditorPage.tsx`**

Add `staticObjects: null,` to `EMPTY_IMAGES` (alongside the existing `backgroundAtlas:
null,`).

Add to `IMAGE_SOURCES` (after the `backgroundAtlas` entry):

```typescript
{ key: 'staticObjects', src: STATIC_OBJECTS_SHEET.src },
```

Add `STATIC_OBJECTS_SHEET` to the existing `import { TERRAIN_BACKGROUND_SHEET } from
'../entities/sprites/sheets';` line.

- [ ] **Step 6: Wire `PlatformerPage.tsx`**

Add a new ref alongside the existing image refs (after `backgroundAtlasRef` at line
178):

```typescript
const staticObjectsRef = useRef<HTMLImageElement | null>(null);
```

Add a new `loadImage` call in the mount effect, alongside the existing
`TERRAIN_BACKGROUND_SHEET` one (after it):

```typescript
loadImage(STATIC_OBJECTS_SHEET.src)
  .then((img) => {
    if (cancelled) return;
    staticObjectsRef.current = img;
    render();
  })
  .catch(() => {
    // Bush/fence are purely decorative — they simply won't render if this
    // atlas fails to load; the rest of the level still shows.
  });
```

Add `STATIC_OBJECTS_SHEET` to the existing import from `'./entities/sprites/sheets'`.

Update the existing `drawTerrain` call (inside `if (groundAtlasRef.current) { ... }`) to
pass the new ref:

```typescript
drawTerrain(
  ctx,
  currentLevel.value,
  tilesetRef.current,
  groundAtlasRef.current,
  originX,
  originY,
  staticObjectsRef.current,
);
```

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run src/themes/platformer`
Expected: PASS — every test across the whole `platformer` folder, confirming this
wiring change didn't regress anything else. Also run `npx tsc --noEmit` to confirm the
whole project still type-checks.

- [ ] **Step 8: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/editor/EditorCanvas.tsx src/themes/platformer/editor/EditorCanvas.test.tsx src/themes/platformer/editor/LevelEditorPage.tsx
git commit -m "feat(platformer): load and wire the static objects atlas into the game and editor"
```

- [ ] **Step 9: Manual browser verification**

Start the dev server and open the Level Editor (the platformer theme must be unlocked —
see `roadmap.md`'s Branch strategy section for the `platformerPrototypeUnlocked` flag).
In the Foreground palette, confirm the "Terrain"/"Decoration"/"Entities"/"Tools" subtitle
groups all render with their expected tiles. Paint a lone `n` (bush) tile and confirm it
shows recognizable bush-like art; paint a stack of 3+ `n` tiles in one column and confirm
the bottom, middle, and top tiles each look distinct (root/trunk/canopy) rather than
identical copies; paint an `N` (fence) tile and confirm it renders. If any of these look
wrong or misaligned against `public/sprites/staticObjects.png`'s actual art, adjust the
`sx`/`sy` constants in `StaticObjectsCatalog.ts` (Task 4) and re-run its test suite — the
tests only pin the mechanism, not these specific numbers. Switch to the running game (Try
button, or the real level) and confirm the player walks/jumps straight through both tile
types with no collision.

---

## Self-Review

**Spec coverage:**
- Two new `TileType`s (`bush`, `fence`), non-solid/non-climbable — Task 1. ✓
- `n`/`N` `TERRAIN_CHARS` entries, `TileChar` union — Task 2. ✓
- Height from vertical stacking, no cap, classified by immediate-neighbour lookup only
  (`verticalRunRole`) — Task 3. ✓
- Root/trunk/canopy per-cell rendering from a new sprite sheet, position-based variant
  selection mechanism — Task 4 (catalog) + Task 5 (renderer wiring). ✓
- No new editor paint/erase code needed (confirmed against `paintCell.ts` in the design
  research — it already handles any `TERRAIN_CHARS` character generically). ✓ (no task
  needed)
- Palette subtitle grouping (Terrain/Decoration/Entities/Tools) — Task 6. ✓
- Image loading in both the real game and the editor — Task 7. ✓
- Manual verification of visual variety, layering, and walk-through collision — Task 7,
  Step 9. ✓

**Placeholder scan:** No "TBD"/"TODO" — the one open-ended item (exact sprite
coordinates) is called out explicitly in Task 4 with a concrete starting catalog and a
concrete correction path (adjust constants, re-run the pinned test suite), not a
placeholder.

**Type consistency:** `VerticalRunRole` (Task 3) is imported and used identically in
Task 4 (`bushOrTreeEntry(role: VerticalRunRole, ...)`) and Task 5
(`verticalRunRole(level, col, row, 'bush')` feeding directly into `bushOrTreeEntry`).
`StaticObjectEntry { sx, sy }` (Task 4) matches the `{ sx, sy }` shape `drawTerrain`
(Task 5) already destructures from every other tile-source lookup in the file.
`EditorImages.staticObjects` (Task 7) matches the `HTMLImageElement | null` type used
for every other optional atlas in that interface.

---

**Plan complete and saved to `specs/S-006-platformer-theme/plans/2026-09-04-foreground-decoration-tiles-step36-plan.md`.** Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
