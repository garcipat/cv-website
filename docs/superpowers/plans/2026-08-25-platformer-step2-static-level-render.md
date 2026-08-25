# Platformer Step 2: Static Level Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a hand-crafted starter level's terrain (two ground biomes with capped/fill tiles, a floating platform, a wall, and a bridge spanning a small pit) on the Platformer theme's canvas using real CC0 sprite tiles, with no player, physics, or camera yet.

**Architecture:** Pure-logic level data/types and tile helpers (`level/LevelData.ts`, `level/Terrain.ts`, `level/level1.ts`) feed a Canvas 2D renderer function (`engine/Renderer.ts`) that draws each solid tile by cropping the correct region out of a single preloaded spritesheet image (`engine/SpriteLoader.ts`). Ground tiles pick their sprite (capped "top" vs plain "fill") based on whether the tile directly above them is solid, so a ground strip automatically looks capped on its exposed surface and plain underneath. `PlatformerPage.tsx` loads the spritesheet once, then draws the background fill followed by the terrain on every resize/redraw.

**Tech Stack:** React 19, TypeScript strict, Vitest + React Testing Library + jsdom, Canvas 2D API, CC0-licensed sprite assets (Brackeys "2D Platformer Assets" pack — `public/sprites/world_tileset.png`, license copy at `public/sprites/LICENSE-sprites.txt`).

**Spec:** [specs/S-006-platformer-theme/spec.md](../../../specs/S-006-platformer-theme/spec.md) (FR-008, FR-010, FR-029), roadmap step 2 in [specs/S-006-platformer-theme/roadmap.md](../../../specs/S-006-platformer-theme/roadmap.md)

## Global Constraints

- TypeScript strict mode, no `any` types, no `@ts-ignore` (constitution Principle I / spec SC-007).
- Named arrow function exports (except where a plain `function` is idiomatic for a pure helper — keep consistent with this plan's code blocks), named exports only (constitution Principle III).
- Tests use Vitest + React Testing Library + jsdom; test naming follows `{method}-{Condition}-{ExpectedResult}` (constitution Principle II).
- No backend, no API calls, no new npm dependencies.
- Sprite tile size is 16×16 native pixels (`TILE_SIZE`), rendered at a 2× scale (`RENDER_SCALE`) for crisp retro pixel art — matches the spec's "Fixed sprite sizes" assumption.
- Axis-aligned tile types only for this step (slopes mentioned in FR-008 are explicitly deferred to a later step).
- No camera/horizontal scrolling yet. The level is no longer drawn at a literal fixed origin: `PlatformerPage.tsx` computes a vertical `originY` offset (`canvas.height - levelPixelHeight`) so the level is bottom-anchored to the canvas, showing more sky above the ground on taller viewports instead of empty space below it.

## Exact Sprite Coordinates (from `public/sprites/world_tileset.png`, confirmed by direct pixel inspection, 16×16 grid)

| Tile | Column, Row | Pixel (sx, sy) |
|---|---|---|
| Grass top (capped) | (0, 0) | (0, 0) |
| Grass fill (plain) | (0, 1) | (0, 16) |
| Rock top (capped) | (1, 0) | (16, 0) |
| Rock fill (plain) | (1, 1) | (16, 16) |
| Wall (gray stone) | (8, 0) | (128, 0) |
| Bridge ramp down (left end) | (9, 2) | (144, 32) |
| Bridge low/middle (or lone single tile) | (10, 2) | (160, 32) |
| Bridge ramp up (right end) | (11, 2) | (176, 32) |

---

### Task 1: Level data types and terrain helpers

**Files:**
- Create: `src/themes/platformer/level/LevelData.ts`
- Create: `src/themes/platformer/level/Terrain.ts`
- Test: `src/themes/platformer/level/Terrain.test.ts`

**Interfaces:**
- Produces: `TileType`, `TileMap`, `LevelDef` (from `LevelData.ts`); `TILE_SIZE`, `RENDER_SCALE`, `RENDERED_TILE_SIZE`, `tileAt(level, col, row)`, `isSolid(tile)`, `isTopExposed(level, col, row)`, `tileToPixel(col, row)` (from `Terrain.ts`). Task 2 (`level1.ts`) imports `LevelDef`/`TileMap`/`TileType`. Task 4 (`Renderer.ts`) imports everything from `Terrain.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/level/Terrain.test.ts`:

```ts
import { tileAt, isSolid, isTopExposed, tileToPixel, TILE_SIZE, RENDER_SCALE, RENDERED_TILE_SIZE } from './Terrain';
import type { LevelDef } from './LevelData';

const testLevel: LevelDef = {
  width: 3,
  height: 3,
  terrain: [
    ['empty', 'groundGrass', 'wall'],
    ['bridge', 'empty', 'empty'],
    ['groundGrass', 'groundRock', 'empty'],
  ],
};

describe('Terrain', () => {
  it('tileAt-inBounds-returnsTile', () => {
    expect(tileAt(testLevel, 1, 0)).toBe('groundGrass');
    expect(tileAt(testLevel, 0, 1)).toBe('bridge');
  });

  it('tileAt-outOfBounds-returnsEmpty', () => {
    expect(tileAt(testLevel, -1, 0)).toBe('empty');
    expect(tileAt(testLevel, 3, 0)).toBe('empty');
    expect(tileAt(testLevel, 0, -1)).toBe('empty');
    expect(tileAt(testLevel, 0, 3)).toBe('empty');
  });

  it('isSolid-groundPlatformWallBridge-returnsTrue', () => {
    expect(isSolid('groundGrass')).toBe(true);
    expect(isSolid('groundRock')).toBe(true);
    expect(isSolid('platform')).toBe(true);
    expect(isSolid('wall')).toBe(true);
    expect(isSolid('bridge')).toBe(true);
  });

  it('isSolid-empty-returnsFalse', () => {
    expect(isSolid('empty')).toBe(false);
  });

  it('isTopExposed-emptyAbove-returnsTrue', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['empty'], ['groundGrass']],
    };
    expect(isTopExposed(level, 0, 1)).toBe(true);
  });

  it('isTopExposed-solidTileAbove-returnsFalse', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    expect(isTopExposed(level, 0, 1)).toBe(false);
  });

  it('isTopExposed-topRowOfLevel-returnsTrue', () => {
    const level: LevelDef = {
      width: 1,
      height: 1,
      terrain: [['groundGrass']],
    };
    expect(isTopExposed(level, 0, 0)).toBe(true);
  });

  it('tileToPixel-scalesByRenderedTileSize', () => {
    expect(RENDERED_TILE_SIZE).toBe(TILE_SIZE * RENDER_SCALE);
    expect(tileToPixel(2, 3)).toEqual({ x: 2 * RENDERED_TILE_SIZE, y: 3 * RENDERED_TILE_SIZE });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/themes/platformer/level/Terrain.test.ts`
Expected: FAIL — `./Terrain` (and `./LevelData`) do not exist yet.

- [ ] **Step 3: Write `LevelData.ts`**

Create `src/themes/platformer/level/LevelData.ts`:

```ts
export type TileType =
  | 'groundGrass'
  | 'groundRock'
  | 'platform'
  | 'wall'
  | 'bridge'
  | 'empty';

export type TileMap = TileType[][];

export interface LevelDef {
  terrain: TileMap;
  width: number;
  height: number;
}
```

- [ ] **Step 4: Write `Terrain.ts`**

Create `src/themes/platformer/level/Terrain.ts`:

```ts
import type { LevelDef, TileType } from './LevelData';

export const TILE_SIZE = 16;
export const RENDER_SCALE = 2;
export const RENDERED_TILE_SIZE = TILE_SIZE * RENDER_SCALE;

export function tileAt(level: LevelDef, col: number, row: number): TileType {
  if (row < 0 || row >= level.height || col < 0 || col >= level.width) {
    return 'empty';
  }
  return level.terrain[row][col];
}

export function isSolid(tile: TileType): boolean {
  return (
    tile === 'groundGrass' ||
    tile === 'groundRock' ||
    tile === 'platform' ||
    tile === 'wall' ||
    tile === 'bridge'
  );
}

export function isTopExposed(level: LevelDef, col: number, row: number): boolean {
  return !isSolid(tileAt(level, col, row - 1));
}

export function tileToPixel(col: number, row: number): { x: number; y: number } {
  return { x: col * RENDERED_TILE_SIZE, y: row * RENDERED_TILE_SIZE };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- src/themes/platformer/level/Terrain.test.ts`
Expected: PASS (8/8)

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/level/LevelData.ts src/themes/platformer/level/Terrain.ts src/themes/platformer/level/Terrain.test.ts
git commit -m "feat(platformer): add level data types and terrain helpers"
```

---

### Task 2: Level 1 starter data

**Files:**
- Create: `src/themes/platformer/level/level1.ts`
- Test: `src/themes/platformer/level/level1.test.ts`

**Interfaces:**
- Consumes: `LevelDef`, `TileMap`, `TileType` (from Task 1's `LevelData.ts`).
- Produces: `export const level1: LevelDef`. Task 5 imports this directly into `PlatformerPage.tsx`.

Level layout (20 tiles wide × 12 tiles tall):
- Rows 10-11 (bottom two rows) are the ground strip, EXCEPT columns 2-3 which are a 2-tile pit (left empty on both rows).
- Columns 0-11 of the ground strip use `groundGrass`; columns 12-19 use `groundRock` (two biomes side by side for visual variety).
- Row 10, columns 2-3 are `bridge` tiles spanning the pit (row 11 at columns 2-3 stays `empty` — the pit is one tile deep for this static-render step, no falling-in-pit behavior yet).
- A 3-tile floating `platform` at row 7, columns 8-10 (within the grass zone).
- A 3-tile-tall `wall` at column 15, rows 7-9 (within the rock zone).

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/level/level1.test.ts`:

```ts
import { level1 } from './level1';

describe('level1', () => {
  it('dimensions-matchTerrainGridShape', () => {
    expect(level1.terrain).toHaveLength(level1.height);
    for (const row of level1.terrain) {
      expect(row).toHaveLength(level1.width);
    }
  });

  it('groundStrip-usesGrassBiomeOnLeftAndRockBiomeOnRight', () => {
    const lastRow = level1.terrain[level1.height - 1];
    expect(lastRow[0]).toBe('groundGrass');
    expect(lastRow[11]).toBe('groundGrass');
    expect(lastRow[12]).toBe('groundRock');
    expect(lastRow[19]).toBe('groundRock');
  });

  it('pit-atColumns2And3-isEmptyOnBothGroundRows', () => {
    expect(level1.terrain[level1.height - 1][2]).toBe('empty');
    expect(level1.terrain[level1.height - 1][3]).toBe('empty');
  });

  it('bridge-spansThePitAtRowAboveBottomRow', () => {
    expect(level1.terrain[level1.height - 2][2]).toBe('bridge');
    expect(level1.terrain[level1.height - 2][3]).toBe('bridge');
  });

  it('containsAtLeastOnePlatformTile', () => {
    const hasPlatform = level1.terrain.some((row) => row.includes('platform'));
    expect(hasPlatform).toBe(true);
  });

  it('containsAtLeastOneWallTile', () => {
    const hasWall = level1.terrain.some((row) => row.includes('wall'));
    expect(hasWall).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/themes/platformer/level/level1.test.ts`
Expected: FAIL — `./level1` does not exist yet.

- [ ] **Step 3: Write `level1.ts`**

Create `src/themes/platformer/level/level1.ts`:

```ts
import type { LevelDef, TileMap, TileType } from './LevelData';

const WIDTH = 20;
const HEIGHT = 12;
const GRASS_ROCK_BOUNDARY_COL = 12; // columns < this use groundGrass, >= use groundRock
const PIT_COLS = [2, 3];

function emptyGrid(width: number, height: number): TileMap {
  return Array.from({ length: height }, () => Array<TileType>(width).fill('empty'));
}

function buildLevel1(): LevelDef {
  const terrain = emptyGrid(WIDTH, HEIGHT);

  for (let col = 0; col < WIDTH; col++) {
    if (PIT_COLS.includes(col)) continue;

    const groundType: TileType = col < GRASS_ROCK_BOUNDARY_COL ? 'groundGrass' : 'groundRock';
    terrain[HEIGHT - 2][col] = groundType;
    terrain[HEIGHT - 1][col] = groundType;
  }

  for (const col of PIT_COLS) {
    terrain[HEIGHT - 2][col] = 'bridge';
    // terrain[HEIGHT - 1][col] stays 'empty' -- the pit
  }

  terrain[7][8] = 'platform';
  terrain[7][9] = 'platform';
  terrain[7][10] = 'platform';

  terrain[7][15] = 'wall';
  terrain[8][15] = 'wall';
  terrain[9][15] = 'wall';

  return { terrain, width: WIDTH, height: HEIGHT };
}

export const level1: LevelDef = buildLevel1();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/themes/platformer/level/level1.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/level1.ts src/themes/platformer/level/level1.test.ts
git commit -m "feat(platformer): add level1 starter terrain data"
```

---

### Task 3: Sprite image loader

**Files:**
- Create: `src/themes/platformer/engine/SpriteLoader.ts`
- Test: `src/themes/platformer/engine/SpriteLoader.test.ts`

**Interfaces:**
- Produces: `export function loadImage(src: string): Promise<HTMLImageElement>`. Task 5 calls this with `'/sprites/world_tileset.png'`.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/engine/SpriteLoader.test.ts`:

```ts
import { loadImage } from './SpriteLoader';

class MockImageSuccess {
  onload: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  private _src = '';
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
}

class MockImageFailure {
  onload: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  private _src = '';
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onerror?.(new Error('load failed')));
  }
}

describe('SpriteLoader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadImage-onLoad-resolvesWithImageElement', async () => {
    vi.stubGlobal('Image', MockImageSuccess);
    const img = await loadImage('/sprites/world_tileset.png');
    expect(img).toBeInstanceOf(MockImageSuccess);
    expect((img as unknown as MockImageSuccess).src).toBe('/sprites/world_tileset.png');
  });

  it('loadImage-onError-rejects', async () => {
    vi.stubGlobal('Image', MockImageFailure);
    await expect(loadImage('/sprites/missing.png')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/themes/platformer/engine/SpriteLoader.test.ts`
Expected: FAIL — `./SpriteLoader` does not exist yet.

- [ ] **Step 3: Write `SpriteLoader.ts`**

Create `src/themes/platformer/engine/SpriteLoader.ts`:

```ts
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/themes/platformer/engine/SpriteLoader.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/SpriteLoader.ts src/themes/platformer/engine/SpriteLoader.test.ts
git commit -m "feat(platformer): add sprite image loader"
```

---

### Task 4: Terrain renderer

**Files:**
- Create: `src/themes/platformer/engine/Renderer.ts`
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `isSolid`, `tileAt`, `isTopExposed`, `tileToPixel`, `TILE_SIZE`, `RENDERED_TILE_SIZE` (from Task 1's `Terrain.ts`); `LevelDef`, `TileType` (from Task 1's `LevelData.ts`).
- Produces: `export function drawTerrain(ctx: CanvasRenderingContext2D, level: LevelDef, tileset: HTMLImageElement): void`. Task 5 calls this from `PlatformerPage.tsx`.

Use the exact sprite coordinates from the table at the top of this plan.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/engine/Renderer.test.ts`:

```ts
import { drawTerrain } from './Renderer';
import type { LevelDef } from '../level/LevelData';

function makeMockContext() {
  return {
    imageSmoothingEnabled: true,
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const fakeTileset = {} as HTMLImageElement;

describe('drawTerrain', () => {
  it('groundGrassTopExposed-draws-fromGrassTopSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 0, 0, 16, 16, 0, 0, 32, 32);
  });

  it('groundGrassNotExposed-draws-fromGrassFillSource', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeTileset, 0, 16, 16, 16, 0, 32, 32, 32);
  });

  it('groundRockTopExposed-draws-fromRockTopSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundRock']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 16, 0, 16, 16, 0, 0, 32, 32);
  });

  it('wallTile-draws-fromStoneBlockSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['wall']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 128, 0, 16, 16, 0, 0, 32, 32);
  });

  it('bridgeTile-draws-fromLowestChainLinkSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['bridge']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 144, 32, 16, 16, 0, 0, 32, 32);
  });

  it('platformTile-draws-fromGrassTopSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['platform']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 0, 0, 16, 16, 0, 0, 32, 32);
  });

  it('emptyTile-doesNotDraw', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['empty']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('multiTileLevel-draws-atCorrectPixelPositions', () => {
    const level: LevelDef = { width: 2, height: 1, terrain: [['groundGrass', 'wall']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeTileset, 0, 0, 16, 16, 0, 0, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeTileset, 128, 0, 16, 16, 32, 0, 32, 32);
  });

  it('draws-setsImageSmoothingEnabledFalse', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.imageSmoothingEnabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL — `./Renderer` does not exist yet.

- [ ] **Step 3: Write `Renderer.ts`**

Create `src/themes/platformer/engine/Renderer.ts`:

```ts
import { isSolid, tileAt, isTopExposed, tileToPixel, TILE_SIZE, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef, TileType } from '../level/LevelData';

function tileSource(
  level: LevelDef,
  type: TileType,
  col: number,
  row: number,
): { sx: number; sy: number } | null {
  switch (type) {
    case 'groundGrass':
      return isTopExposed(level, col, row)
        ? { sx: 0, sy: 0 }
        : { sx: 0, sy: TILE_SIZE };
    case 'groundRock':
      return isTopExposed(level, col, row)
        ? { sx: TILE_SIZE, sy: 0 }
        : { sx: TILE_SIZE, sy: TILE_SIZE };
    case 'platform':
      return { sx: 0, sy: 0 };
    case 'wall':
      return { sx: 8 * TILE_SIZE, sy: 0 };
    case 'bridge':
      return { sx: 9 * TILE_SIZE, sy: 2 * TILE_SIZE };
    default:
      return null;
  }
}

export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  tileset: HTMLImageElement,
): void {
  ctx.imageSmoothingEnabled = false;

  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const tile = tileAt(level, col, row);
      if (!isSolid(tile)) continue;

      const source = tileSource(level, tile, col, row);
      if (!source) continue;

      const { x, y } = tileToPixel(col, row);
      ctx.drawImage(
        tileset,
        source.sx,
        source.sy,
        TILE_SIZE,
        TILE_SIZE,
        x,
        y,
        RENDERED_TILE_SIZE,
        RENDERED_TILE_SIZE,
      );
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS (9/9)

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): add terrain renderer"
```

---

### Task 5: Wire terrain rendering into PlatformerPage

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/PlatformerPage.test.tsx`
- Modify: `src/test/setup.ts`

**Interfaces:**
- Consumes: `loadImage` (Task 3), `drawTerrain` (Task 4), `level1` (Task 2).
- Produces: `PlatformerPage` now draws terrain once the tileset image resolves. No new exports.

The current `src/test/setup.ts` canvas mock returns a **new** mock context object on every `getContext('2d')` call, which doesn't match real browser behavior (a canvas returns the *same* context object every time) and makes it impossible for a test to grab the same `drawImage` spy the component's internal code used. This step fixes that by caching one mock context per canvas element.

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/PlatformerPage.test.tsx` (read the current file first — it already has `render-default-showsFullViewportCanvas`, `windowResize-afterMount-updatesCanvasDimensions`, and `render-default-showsFloatingControlsOverCanvas` tests; add this as a new one, and add `waitFor` to the existing `@testing-library/react` import if not already present):

```tsx
class MockTilesetImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
}

it('render-afterTilesetLoads-drawsTerrainTiles', async () => {
  vi.stubGlobal('Image', MockTilesetImage);

  render(<PlatformerPage />);
  const canvas = screen.getByTestId('platformer-canvas');
  const ctx = canvas.getContext('2d') as unknown as { drawImage: ReturnType<typeof vi.fn> };

  await waitFor(() => expect(ctx.drawImage).toHaveBeenCalled());

  vi.unstubAllGlobals();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/themes/platformer/PlatformerPage.test.tsx`
Expected: FAIL — either `drawImage` doesn't exist on the mock context yet (setup.ts not updated), or it's never called (PlatformerPage doesn't load/draw the tileset yet).

- [ ] **Step 3: Update the canvas mock in `src/test/setup.ts` to cache one context per canvas**

Read the current file first, then replace its contents with:

```ts
import '@testing-library/jest-dom/vitest';

// jsdom does not implement canvas rendering (no `canvas` npm package
// installed). Without a stub, calling `HTMLCanvasElement.prototype.getContext`
// logs a "Not implemented" error with a full stack trace to the virtual
// console on every call, polluting test output. Stub the 2d context with a
// minimal mock covering the methods/properties the app actually uses, and
// return null for any other context type to preserve jsdom's existing
// (unimplemented) behavior there.
//
// A real canvas returns the SAME context object on every getContext('2d')
// call for a given canvas — cache one mock context per canvas element so
// tests can retrieve the exact object the component under test drew to.
const mockContexts = new WeakMap<HTMLCanvasElement, unknown>();

HTMLCanvasElement.prototype.getContext = function (
  this: HTMLCanvasElement,
  contextId: string,
) {
  if (contextId !== '2d') return null;

  if (!mockContexts.has(this)) {
    mockContexts.set(this, {
      fillStyle: '',
      imageSmoothingEnabled: true,
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    });
  }

  return mockContexts.get(this);
} as typeof HTMLCanvasElement.prototype.getContext;
```

- [ ] **Step 4: Update `PlatformerPage.tsx`**

Read the current file first (it has a `resize` function inside a `useEffect` that fills the background). Replace its contents with:

```tsx
import { useEffect, useRef } from 'react';
import { FloatingControls } from './components/FloatingControls';
import { loadImage } from './engine/SpriteLoader';
import { drawTerrain } from './engine/Renderer';
import { level1 } from './level/level1';

export const PlatformerPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tilesetRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const backgroundColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim();
      ctx.fillStyle = backgroundColor || '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (tilesetRef.current) {
        drawTerrain(ctx, level1, tilesetRef.current);
      }
    };

    draw();
    window.addEventListener('resize', draw);

    let cancelled = false;
    loadImage('/sprites/world_tileset.png')
      .then((img) => {
        if (cancelled) return;
        tilesetRef.current = img;
        draw();
      })
      .catch(() => {
        // Terrain simply won't render if the tileset fails to load; the
        // background fill still shows so the page isn't blank.
      });

    return () => {
      cancelled = true;
      window.removeEventListener('resize', draw);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" />
      <FloatingControls />
    </div>
  );
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npm run test && npx tsc --noEmit`
Expected: All PASS, zero type errors. Pay attention to whether the `src/test/setup.ts` change affects any other test file that touches canvas (currently only the platformer theme does) — if any other test breaks, read it and fix the assertion to match the new (more correct) shared-context behavior; do not revert the setup.ts change.

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx src/test/setup.ts
git commit -m "feat(platformer): render level1 terrain on the canvas"
```

- [ ] **Step 8: Manual browser verification**

Run: `npm run dev`

In the browser:
1. Switch the theme selector to "Platformer".
2. Confirm the sky-blue background still fills the canvas.
3. Confirm a ground strip renders along the bottom, with a visible color/style difference between the left ~60% (grass biome, green cap) and right ~40% (rock biome, gray cap).
4. Confirm a small 2-tile gap (pit) is visible in the ground near the left side, with a bridge (chain-link tiles) spanning across it at the ground's top surface level.
5. Confirm a small floating platform (3 tiles) is visible above the ground, in the grass zone.
6. Confirm a short wall (3 tiles tall) is visible standing on the ground, in the rock zone.
7. Confirm tiles render crisp (not blurry) — pixel art should look sharp, not smoothed.
8. Resize the browser window — confirm the level redraws correctly without artifacts.

If all checks pass, check off roadmap step 2 in `specs/S-006-platformer-theme/roadmap.md`.

---

## Self-Review Notes

- **Spec coverage**: FR-008 (terrain tiles — ground, platforms, walls; slopes explicitly deferred) → Tasks 1, 2, 4. FR-010 (level data as a structured grid with width/height) → Tasks 1, 2. FR-029 (sprite sheet atlas, not per-tile images) → Task 4 draws all tile types from one `world_tileset.png` image. No collision/physics, camera, player, or collectibles in this step — correctly out of scope per the roadmap (steps 3-9 cover those). The pit at columns 2-3 has no fall-in behavior yet (that's step 4's gravity/collision and step 8's respawn) — it's purely a visual/level-data feature at this step.
- **Placeholder scan**: no TBD/TODO; every step has concrete code or an exact command. Fixed the scratch/contradictory test noted inline in Task 1 Step 1.
- **Type consistency**: `LevelDef`/`TileMap`/`TileType` (Task 1) are the single source of truth consumed by `level1.ts` (Task 2) and `Renderer.ts` (Task 4). `tileAt`/`isSolid`/`isTopExposed`/`tileToPixel`/`TILE_SIZE`/`RENDERED_TILE_SIZE` (Task 1) are consumed by `Renderer.ts` (Task 4) with matching names throughout. The six `TileType` values (`groundGrass`, `groundRock`, `platform`, `wall`, `bridge`, `empty`) are used identically across `LevelData.ts`, `Terrain.ts`, `level1.ts`, and `Renderer.ts`.
- **Scope check**: this plan covers only roadmap step 2. It does not touch player rendering, physics, camera, or collectibles — those are separate future steps/plans per the roadmap.
- **Asset licensing**: `world_tileset.png` is CC0-licensed (Brackeys "2D Platformer Assets" pack, originally by RottingPixels), already copied to `public/sprites/world_tileset.png` with the license file at `public/sprites/LICENSE-sprites.txt` for traceability.
