# Terrain Rework (Autotiled Ground) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `groundGrass` with full 4-neighbour autotiling and a decoupled grass overlay, sourced from the purpose-built `tile_atlas.png`.

**Architecture:** A neighbour mask (4 bits, one per orthogonal side) is computed per ground cell. A pure data table maps each of the 16 masks to an atlas cell plus an optional quarter-turn rotation. A separate pure function expresses the vertical banding rule and a test asserts the table agrees with it, so the rule stays adjustable. Grass is a second draw pass keyed by horizontal run position, never baked into ground tiles.

**Tech Stack:** TypeScript (strict), Vitest + React Testing Library + jsdom, Canvas 2D.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-02-terrain-rework-design.md`

## Global Constraints

- TypeScript strict mode; **no `any`**.
- Named arrow-function or `function` exports; named exports only, no default exports.
- Test naming: `{method}-{Condition}-{ExpectedResult}`.
- Tests are written and run (failing) **before** implementation. `npm test` must pass before each commit.
- `npm run lint` must pass before each commit (lint-only rules are not caught by tests or `tsc`).
- Coverage targets: 100% for `src/lib/`, 80%+ for components. These modules are pure logic — cover every branch.
- Atlas geometry: 16px tiles, uniform **19px stride**, 7 columns × 3 rows, image 130×54.
- `RENDER_SCALE` is 2, so `RENDERED_TILE_SIZE` is 32.
- Grass sprites are **9px** tall, aligned to the top of their cell.
- Only `groundGrass` changes. `groundRock`, `wall`, `bridge`, `ladder` keep drawing from `world_tileset.png` unchanged.
- Do not commit unless the plan step says to. Never auto-commit outside these steps.

## Model assignment per task

Dispatch each task's subagent with the model named here.

| Task | Model | Why |
| --- | --- | --- |
| 1. Neighbour mask | `sonnet` | Small pure function, tests fully specified. |
| 2. Run position refactor | `sonnet` | Mechanical extraction; existing tests prove behaviour is preserved. |
| 3. Atlas table and banding rule | `sonnet` | Volume of exact data, but every value is given. |
| 4. Ground draw path | `opus` | The hard one: a rotation transform, a new required parameter, and a large pre-existing test file whose every `drawTerrain` call must be updated without weakening assertions. |
| 5. Grass overlay tests | `sonnet` | Tests are written out; failures here indicate a Task 4 bug to fix. |
| 6. Loading and call sites | `sonnet` | Six files, all edits given verbatim; `tsc -b` catches anything missed. |
| 7. Browser verification | `opus` | Visual judgement against the banding rule, and distinguishing the known art issue from real bugs. |
| 8. Roadmap and asset move | `sonnet` | Doc edit plus two `git mv`s. |

---

## Design decisions locked by this plan

Two predicates that the design doc leaves implicit. Both are one-line changes if they turn out wrong.

**1. An edge is "closed" when the neighbour is not solid.** `neighbourMask` uses the existing `isSolid`, so an edge facing a `wall`/`bridge`/`groundRock` counts as open (no border) and merges visually. This makes `isTopExposed(level, col, row)` exactly equivalent to "the UP bit is clear", so the ground mask and the grass condition cannot drift apart. Task 1 pins that equivalence with a test.

**2. Grass continues only into a grass-topped surface neighbour.** The grass run predicate is `tile === 'groundGrass' && isTopExposed(...)`, so grass caps off at a `groundRock` neighbour or where terrain steps up. This differs from the mask predicate deliberately: borders are about air, grass is about the same material being exposed.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/themes/platformer/level/Terrain.ts` (modify) | Level-grid geometry and neighbour queries. Gains `neighbourMask` + bit constants and `horizontalRunPosition`; `bridgeRunPosition` becomes a wrapper. Holds no atlas coordinates. |
| `src/themes/platformer/engine/GroundAtlas.ts` (create) | Atlas coordinates and the banding rule. The mask→cell table (data), `groundTileKind` (the rule), grass cell lookup, geometry constants. Holds no level-grid logic and no canvas calls. |
| `src/themes/platformer/engine/Renderer.ts` (modify) | Drawing only. Gains a `groundAtlas` parameter, a rotation-aware tile draw helper, the `groundGrass` branch, and the grass pass. Holds no banding knowledge. |
| `src/themes/platformer/entities/sprites/sheets.ts` (modify) | Registers `GROUND_ATLAS_SHEET` so the atlas is a first-class loadable sheet. |
| `src/themes/platformer/PlatformerPage.tsx` (modify) | Loads the atlas into a ref and passes it to `drawTerrain`. |
| `src/themes/platformer/editor/EditorCanvas.tsx` (modify) | `EditorImages` gains `groundAtlas`; passes it to `drawTerrain`. |
| `src/themes/platformer/editor/LevelEditorPage.tsx` (modify) | Adds the atlas to `IMAGE_SOURCES` and `EMPTY_IMAGES`. |
| `src/themes/platformer/editor/paletteTiles.ts` (modify) | The `G` palette icon points at the atlas instead of `world_tileset.png`. |

---

### Task 1: Neighbour mask in Terrain.ts

**Files:**
- Modify: `src/themes/platformer/level/Terrain.ts`
- Test: `src/themes/platformer/level/Terrain.test.ts`

**Interfaces:**
- Consumes: existing `tileAt`, `isSolid`, `isTopExposed` from the same file.
- Produces: `NEIGHBOUR_UP = 1`, `NEIGHBOUR_RIGHT = 2`, `NEIGHBOUR_DOWN = 4`, `NEIGHBOUR_LEFT = 8` (all `number`), and `neighbourMask(level: LevelDef, col: number, row: number): number`. A **set** bit means that neighbour is solid, i.e. the edge is open and gets no border.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('Terrain', ...)` block in `Terrain.test.ts`:

```typescript
  it('neighbourMask-isolatedTile-returnsZero', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    expect(neighbourMask(level, 0, 0)).toBe(0);
  });

  it('neighbourMask-solidAbove-setsUpBit', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    expect(neighbourMask(level, 0, 1)).toBe(NEIGHBOUR_UP);
  });

  it('neighbourMask-solidBelow-setsDownBit', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    expect(neighbourMask(level, 0, 0)).toBe(NEIGHBOUR_DOWN);
  });

  it('neighbourMask-solidLeftAndRight-setsBothHorizontalBits', () => {
    const level: LevelDef = {
      width: 3,
      height: 1,
      terrain: [['groundGrass', 'groundGrass', 'groundGrass']],
    };
    expect(neighbourMask(level, 1, 0)).toBe(NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT);
  });

  it('neighbourMask-surroundedBySolid-setsAllBits', () => {
    const level: LevelDef = {
      width: 3,
      height: 3,
      terrain: [
        ['groundGrass', 'groundGrass', 'groundGrass'],
        ['groundGrass', 'groundGrass', 'groundGrass'],
        ['groundGrass', 'groundGrass', 'groundGrass'],
      ],
    };
    expect(neighbourMask(level, 1, 1)).toBe(
      NEIGHBOUR_UP | NEIGHBOUR_RIGHT | NEIGHBOUR_DOWN | NEIGHBOUR_LEFT,
    );
  });

  it('neighbourMask-nonSolidNeighbour-leavesBitClear', () => {
    // A ladder is deliberately not solid, so it does not open the edge.
    const level: LevelDef = {
      width: 2,
      height: 1,
      terrain: [['groundGrass', 'ladder']],
    };
    expect(neighbourMask(level, 0, 0) & NEIGHBOUR_RIGHT).toBe(0);
  });

  it('neighbourMask-differentSolidMaterial-opensEdge', () => {
    // Borders are about facing air, so any solid neighbour opens the edge.
    const level: LevelDef = {
      width: 2,
      height: 1,
      terrain: [['groundGrass', 'wall']],
    };
    expect(neighbourMask(level, 0, 0) & NEIGHBOUR_RIGHT).toBe(NEIGHBOUR_RIGHT);
  });

  it('neighbourMask-upBitClear-matchesIsTopExposed', () => {
    // These two must never drift: the grass pass keys off the UP bit while
    // other code still calls isTopExposed.
    const level: LevelDef = {
      width: 2,
      height: 2,
      terrain: [
        ['groundGrass', 'empty'],
        ['groundGrass', 'groundGrass'],
      ],
    };
    for (let row = 0; row < level.height; row++) {
      for (let col = 0; col < level.width; col++) {
        const upClear = (neighbourMask(level, col, row) & NEIGHBOUR_UP) === 0;
        expect(upClear).toBe(isTopExposed(level, col, row));
      }
    }
  });
```

Add to the import list at the top of `Terrain.test.ts`: `neighbourMask`, `NEIGHBOUR_UP`, `NEIGHBOUR_RIGHT`, `NEIGHBOUR_DOWN`, `NEIGHBOUR_LEFT`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/Terrain.test.ts`
Expected: FAIL — `neighbourMask` is not exported / is not a function.

- [ ] **Step 3: Write the implementation**

Add to `src/themes/platformer/level/Terrain.ts`, directly below `isTopExposed`:

```typescript
/**
 * Neighbour-mask bits. A SET bit means the neighbour on that side is solid,
 * so the tile's edge there continues into more terrain and is drawn WITHOUT
 * a border ("open"). A CLEAR bit means that edge faces non-solid space and
 * is drawn WITH its dark border ("closed").
 *
 * Closure is deliberately about facing air rather than matching materials,
 * so `isTopExposed` is exactly "the UP bit is clear" — see
 * `neighbourMask-upBitClear-matchesIsTopExposed`.
 */
export const NEIGHBOUR_UP = 1;
export const NEIGHBOUR_RIGHT = 2;
export const NEIGHBOUR_DOWN = 4;
export const NEIGHBOUR_LEFT = 8;

export function neighbourMask(level: LevelDef, col: number, row: number): number {
  return (
    (isSolid(tileAt(level, col, row - 1)) ? NEIGHBOUR_UP : 0) |
    (isSolid(tileAt(level, col + 1, row)) ? NEIGHBOUR_RIGHT : 0) |
    (isSolid(tileAt(level, col, row + 1)) ? NEIGHBOUR_DOWN : 0) |
    (isSolid(tileAt(level, col - 1, row)) ? NEIGHBOUR_LEFT : 0)
  );
}
```

- [ ] **Step 4: Run tests and lint to verify they pass**

Run: `npx vitest run src/themes/platformer/level/Terrain.test.ts && npm run lint`
Expected: PASS, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/Terrain.ts src/themes/platformer/level/Terrain.test.ts
git commit -m "feat: add neighbour mask helper for terrain autotiling"
```

---

### Task 2: Generalize run position in Terrain.ts

**Files:**
- Modify: `src/themes/platformer/level/Terrain.ts:79-89` (the `BridgeRunPosition` type and `bridgeRunPosition`)
- Test: `src/themes/platformer/level/Terrain.test.ts`

**Interfaces:**
- Consumes: `tileAt` from the same file.
- Produces: `RunPosition = 'single' | 'left' | 'middle' | 'right'`; `horizontalRunPosition(level: LevelDef, col: number, row: number, matches: (level: LevelDef, col: number, row: number) => boolean): RunPosition`. `BridgeRunPosition` stays exported as an alias of `RunPosition`, and `bridgeRunPosition` keeps its existing signature and behaviour.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('Terrain', ...)` in `Terrain.test.ts`:

```typescript
  it('horizontalRunPosition-noMatchingNeighbours-returnsSingle', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const isGround = (l: LevelDef, c: number, r: number) => tileAt(l, c, r) === 'groundGrass';
    expect(horizontalRunPosition(level, 0, 0, isGround)).toBe('single');
  });

  it('horizontalRunPosition-onlyRightMatches-returnsLeft', () => {
    const level: LevelDef = {
      width: 2,
      height: 1,
      terrain: [['groundGrass', 'groundGrass']],
    };
    const isGround = (l: LevelDef, c: number, r: number) => tileAt(l, c, r) === 'groundGrass';
    expect(horizontalRunPosition(level, 0, 0, isGround)).toBe('left');
  });

  it('horizontalRunPosition-onlyLeftMatches-returnsRight', () => {
    const level: LevelDef = {
      width: 2,
      height: 1,
      terrain: [['groundGrass', 'groundGrass']],
    };
    const isGround = (l: LevelDef, c: number, r: number) => tileAt(l, c, r) === 'groundGrass';
    expect(horizontalRunPosition(level, 1, 0, isGround)).toBe('right');
  });

  it('horizontalRunPosition-bothNeighboursMatch-returnsMiddle', () => {
    const level: LevelDef = {
      width: 3,
      height: 1,
      terrain: [['groundGrass', 'groundGrass', 'groundGrass']],
    };
    const isGround = (l: LevelDef, c: number, r: number) => tileAt(l, c, r) === 'groundGrass';
    expect(horizontalRunPosition(level, 1, 0, isGround)).toBe('middle');
  });

  it('horizontalRunPosition-predicateRejectsNeighbour-capsTheRun', () => {
    // The predicate, not mere adjacency, decides continuity.
    const level: LevelDef = {
      width: 2,
      height: 1,
      terrain: [['groundGrass', 'groundRock']],
    };
    const isGround = (l: LevelDef, c: number, r: number) => tileAt(l, c, r) === 'groundGrass';
    expect(horizontalRunPosition(level, 0, 0, isGround)).toBe('single');
  });
```

Add `horizontalRunPosition` to the `Terrain.test.ts` import list.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/Terrain.test.ts`
Expected: FAIL — `horizontalRunPosition` is not exported.

- [ ] **Step 3: Write the implementation**

Replace the existing type and function at `Terrain.ts:79-89` with:

```typescript
export type RunPosition = 'single' | 'left' | 'middle' | 'right';

/**
 * Position of a tile within a horizontal run of neighbours the caller
 * considers continuous. `matches` decides continuity, so the same traversal
 * serves bridges (same tile type) and grass (same type AND top-exposed).
 */
export function horizontalRunPosition(
  level: LevelDef,
  col: number,
  row: number,
  matches: (level: LevelDef, col: number, row: number) => boolean,
): RunPosition {
  const left = matches(level, col - 1, row);
  const right = matches(level, col + 1, row);

  if (!left && !right) return 'single';
  if (!left && right) return 'left';
  if (left && !right) return 'right';
  return 'middle';
}

/**
 * Position of a `bridge` tile within its horizontal run of contiguous
 * bridge tiles, used to pick the ramp-down/low/ramp-up sprite. A lone
 * bridge tile (no bridge neighbour on either side) is 'single'.
 */
export type BridgeRunPosition = RunPosition;

export function bridgeRunPosition(level: LevelDef, col: number, row: number): RunPosition {
  return horizontalRunPosition(level, col, row, (l, c, r) => tileAt(l, c, r) === 'bridge');
}
```

- [ ] **Step 4: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: PASS — the pre-existing `bridgeRunPosition-*` tests must still pass unchanged, proving the refactor preserved behaviour.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/Terrain.ts src/themes/platformer/level/Terrain.test.ts
git commit -m "refactor: generalize bridgeRunPosition into horizontalRunPosition"
```

---

### Task 3: The ground atlas table and banding rule

**Files:**
- Create: `src/themes/platformer/engine/GroundAtlas.ts`
- Test: `src/themes/platformer/engine/GroundAtlas.test.ts`

**Interfaces:**
- Consumes: `NEIGHBOUR_UP`, `NEIGHBOUR_DOWN` and the `RunPosition` type from `../level/Terrain`.
- Produces:
  - `ATLAS_STRIDE = 19`, `GRASS_SOURCE_HEIGHT = 9`
  - `GroundTileKind = 'bright' | 'gradient' | 'dark'`
  - `QuarterTurns = 0 | 1 | 3`
  - `GroundAtlasEntry { sx: number; sy: number; rotation: QuarterTurns; kind: GroundTileKind }`
  - `groundTileKind(mask: number): GroundTileKind`
  - `groundAtlasCell(mask: number): GroundAtlasEntry`
  - `grassCell(position: RunPosition): { sx: number; sy: number }`

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/engine/GroundAtlas.test.ts`:

```typescript
import {
  ATLAS_STRIDE,
  GRASS_SOURCE_HEIGHT,
  groundTileKind,
  groundAtlasCell,
  grassCell,
} from './GroundAtlas';
import {
  NEIGHBOUR_UP,
  NEIGHBOUR_RIGHT,
  NEIGHBOUR_DOWN,
  NEIGHBOUR_LEFT,
} from '../level/Terrain';

const ALL_MASKS = Array.from({ length: 16 }, (_, mask) => mask);

describe('groundTileKind', () => {
  it('topOpen-returnsDark', () => {
    // Anything with terrain above it is buried, however deep.
    expect(groundTileKind(NEIGHBOUR_UP)).toBe('dark');
    expect(groundTileKind(NEIGHBOUR_UP | NEIGHBOUR_DOWN)).toBe('dark');
    expect(groundTileKind(15)).toBe('dark');
  });

  it('topClosedBottomOpen-returnsBright', () => {
    // Topmost cell of a run two or more cells tall.
    expect(groundTileKind(NEIGHBOUR_DOWN)).toBe('bright');
    expect(groundTileKind(NEIGHBOUR_DOWN | NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT)).toBe('bright');
  });

  it('topAndBottomClosed-returnsGradient', () => {
    // A run exactly one cell tall carries the whole ramp in one tile.
    expect(groundTileKind(0)).toBe('gradient');
    expect(groundTileKind(NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT)).toBe('gradient');
  });
});

describe('groundAtlasCell', () => {
  it('everyMask-hasAnEntry', () => {
    for (const mask of ALL_MASKS) {
      expect(groundAtlasCell(mask)).toBeDefined();
    }
  });

  it('everyEntry-kindAgreesWithBandingRule', () => {
    // The table is the source of truth for rendering; this pins it to the
    // rule so changing groundTileKind reveals which entries need re-pointing.
    for (const mask of ALL_MASKS) {
      expect(groundAtlasCell(mask).kind).toBe(groundTileKind(mask));
    }
  });

  it('everyEntry-coordinatesLieOnTheAtlasGrid', () => {
    for (const mask of ALL_MASKS) {
      const { sx, sy } = groundAtlasCell(mask);
      expect(sx % ATLAS_STRIDE).toBe(0);
      expect(sy % ATLAS_STRIDE).toBe(0);
      expect(sx / ATLAS_STRIDE).toBeLessThanOrEqual(6);
      expect(sy / ATLAS_STRIDE).toBeLessThanOrEqual(2);
    }
  });

  it('noNeighbours-returnsIsolatedGradientTileAtC0R0', () => {
    expect(groundAtlasCell(0)).toEqual({ sx: 0, sy: 0, rotation: 0, kind: 'gradient' });
  });

  it('allNeighbours-returnsBuriedInteriorAtC5R1', () => {
    expect(groundAtlasCell(15)).toEqual({
      sx: 5 * ATLAS_STRIDE,
      sy: 1 * ATLAS_STRIDE,
      rotation: 0,
      kind: 'dark',
    });
  });

  it('onlyLeftEdgeClosed-rotatesTheBottomEdgeTileOneQuarterTurnClockwise', () => {
    const mask = NEIGHBOUR_UP | NEIGHBOUR_RIGHT | NEIGHBOUR_DOWN;
    expect(groundAtlasCell(mask)).toEqual({
      sx: 1 * ATLAS_STRIDE,
      sy: 1 * ATLAS_STRIDE,
      rotation: 1,
      kind: 'dark',
    });
  });

  it('onlyRightEdgeClosed-rotatesTheBottomEdgeTileThreeQuarterTurnsClockwise', () => {
    const mask = NEIGHBOUR_UP | NEIGHBOUR_DOWN | NEIGHBOUR_LEFT;
    expect(groundAtlasCell(mask)).toEqual({
      sx: 1 * ATLAS_STRIDE,
      sy: 1 * ATLAS_STRIDE,
      rotation: 3,
      kind: 'dark',
    });
  });

  it('onlyBrightAndDarkTilesAreRotated', () => {
    // A vertical brightness ramp turned sideways reads as broken, so the
    // gradient tiles must never carry a rotation.
    for (const mask of ALL_MASKS) {
      const entry = groundAtlasCell(mask);
      if (entry.kind === 'gradient') expect(entry.rotation).toBe(0);
    }
  });

  it('oneWideColumn-topMiddleBottom-useDistinctCells', () => {
    const top = groundAtlasCell(NEIGHBOUR_DOWN);
    const middle = groundAtlasCell(NEIGHBOUR_UP | NEIGHBOUR_DOWN);
    const bottom = groundAtlasCell(NEIGHBOUR_UP);
    expect(top.kind).toBe('bright');
    expect(middle.kind).toBe('dark');
    expect(bottom.kind).toBe('dark');
    const key = (e: { sx: number; sy: number }) => `${e.sx},${e.sy}`;
    expect(new Set([key(top), key(middle), key(bottom)]).size).toBe(3);
  });
});

describe('grassCell', () => {
  it('everyRunPosition-mapsToRowTwo', () => {
    for (const position of ['single', 'left', 'middle', 'right'] as const) {
      expect(grassCell(position).sy).toBe(2 * ATLAS_STRIDE);
    }
  });

  it('runPositions-mapToDistinctColumnsInSheetOrder', () => {
    expect(grassCell('left')).toEqual({ sx: 1 * ATLAS_STRIDE, sy: 2 * ATLAS_STRIDE });
    expect(grassCell('middle')).toEqual({ sx: 2 * ATLAS_STRIDE, sy: 2 * ATLAS_STRIDE });
    expect(grassCell('right')).toEqual({ sx: 3 * ATLAS_STRIDE, sy: 2 * ATLAS_STRIDE });
    expect(grassCell('single')).toEqual({ sx: 4 * ATLAS_STRIDE, sy: 2 * ATLAS_STRIDE });
  });

  it('grassSourceHeight-isNinePixels', () => {
    expect(GRASS_SOURCE_HEIGHT).toBe(9);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/GroundAtlas.test.ts`
Expected: FAIL — cannot resolve `./GroundAtlas`.

- [ ] **Step 3: Write the implementation**

Create `src/themes/platformer/engine/GroundAtlas.ts`:

```typescript
import { NEIGHBOUR_UP, NEIGHBOUR_DOWN } from '../level/Terrain';
import type { RunPosition } from '../level/Terrain';

/**
 * `tile_atlas.png` holds 16px tiles on a uniform 19px stride (16px tile plus
 * a 3px transparent gutter), 7 columns by 3 rows. The gutter is why the
 * stride is not the tile size — a cell's origin is `index * ATLAS_STRIDE`,
 * while the source rect drawn from it stays `TILE_SIZE` square.
 */
export const ATLAS_STRIDE = 19;

/** Grass sprites occupy only the top 9px of their cell; the rest is
 *  transparent so the ground tile beneath shows through. */
export const GRASS_SOURCE_HEIGHT = 9;

function cell(col: number, row: number): { sx: number; sy: number } {
  return { sx: col * ATLAS_STRIDE, sy: row * ATLAS_STRIDE };
}

export type GroundTileKind = 'bright' | 'gradient' | 'dark';

/** Quarter-turns clockwise applied when drawing. Only 90 degrees either way
 *  is ever needed, and only for the flat dark tiles. */
export type QuarterTurns = 0 | 1 | 3;

export interface GroundAtlasEntry {
  sx: number;
  sy: number;
  rotation: QuarterTurns;
  kind: GroundTileKind;
}

/**
 * The vertical banding rule: the bright band is always exactly the topmost
 * cell of a vertical run, everything below it is dark, and the gradient is
 * used only when a run is a single cell tall (that cell being both the
 * surface and the underside). Both facts follow from the cell's own two
 * vertical edges, so no row counting is needed.
 *
 * This is deliberately independent of `GROUND_ATLAS` below.
 * `GroundAtlas.test.ts` asserts every table entry's `kind` agrees with it, so
 * editing this function surfaces exactly which entries need re-pointing.
 */
export function groundTileKind(mask: number): GroundTileKind {
  const topClosed = (mask & NEIGHBOUR_UP) === 0;
  if (!topClosed) return 'dark';

  const bottomClosed = (mask & NEIGHBOUR_DOWN) === 0;
  return bottomClosed ? 'gradient' : 'bright';
}

/**
 * Which atlas cell each of the 16 neighbour masks draws from. Pure data, so
 * re-pointing a shape — or swapping the whole sheet for another material —
 * is an edit to values only.
 *
 * Comments name the sides whose borders ARE drawn (the mask's clear bits).
 */
const GROUND_ATLAS: Record<number, GroundAtlasEntry> = {
  0: { ...cell(0, 0), rotation: 0, kind: 'gradient' }, // T B L R - isolated single cell
  1: { ...cell(0, 2), rotation: 0, kind: 'dark' }, //     B L R - bottom of a one-wide column
  2: { ...cell(1, 0), rotation: 0, kind: 'gradient' }, // T B L   - left end of a one-tall strip
  3: { ...cell(0, 1), rotation: 0, kind: 'dark' }, //     B L   - bottom-left corner
  4: { ...cell(6, 0), rotation: 0, kind: 'bright' }, //   T L R - top of a one-wide column
  5: { ...cell(4, 1), rotation: 0, kind: 'dark' }, //       L R - middle of a one-wide column
  6: { ...cell(3, 0), rotation: 0, kind: 'bright' }, //   T L   - top-left corner
  7: { ...cell(1, 1), rotation: 1, kind: 'dark' }, //       L   - left edge, bottom-edge tile turned CW
  8: { ...cell(2, 0), rotation: 0, kind: 'gradient' }, // T B R - right end of a one-tall strip
  9: { ...cell(2, 1), rotation: 0, kind: 'dark' }, //     B R   - bottom-right corner
  10: { ...cell(3, 1), rotation: 0, kind: 'gradient' }, // T B  - middle of a one-tall strip
  11: { ...cell(1, 1), rotation: 0, kind: 'dark' }, //     B    - bottom edge
  12: { ...cell(5, 0), rotation: 0, kind: 'bright' }, //  T   R - top-right corner
  13: { ...cell(1, 1), rotation: 3, kind: 'dark' }, //         R - right edge, bottom-edge tile turned CCW
  14: { ...cell(4, 0), rotation: 0, kind: 'bright' }, //  T     - top edge
  15: { ...cell(5, 1), rotation: 0, kind: 'dark' }, //  (none)  - fully buried interior
};

export function groundAtlasCell(mask: number): GroundAtlasEntry {
  const entry = GROUND_ATLAS[mask];
  if (!entry) {
    throw new Error(`No ground atlas entry for neighbour mask ${mask}`);
  }
  return entry;
}

/** Grass is a separate overlay keyed by horizontal run position, so no
 *  ground tile carries grass of its own. */
const GRASS_CELLS: Record<RunPosition, { sx: number; sy: number }> = {
  left: cell(1, 2),
  middle: cell(2, 2),
  right: cell(3, 2),
  single: cell(4, 2),
};

export function grassCell(position: RunPosition): { sx: number; sy: number } {
  return GRASS_CELLS[position];
}
```

- [ ] **Step 4: Run tests and lint**

Run: `npx vitest run src/themes/platformer/engine/GroundAtlas.test.ts && npm run lint`
Expected: PASS, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/GroundAtlas.ts src/themes/platformer/engine/GroundAtlas.test.ts
git commit -m "feat: add ground atlas mask table and vertical banding rule"
```

---

### Task 4: Draw autotiled ground from the atlas

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts` (imports, `tileSource` at 45-77, `drawTerrain` at 253-283)
- Test: `src/themes/platformer/engine/Renderer.test.ts` (the `describe('drawTerrain', ...)` block at 1129)

**Interfaces:**
- Consumes: `neighbourMask`, `NEIGHBOUR_UP`, `horizontalRunPosition`, `isTopExposed`, `RENDER_SCALE` from `../level/Terrain`; `groundAtlasCell`, `grassCell`, `GRASS_SOURCE_HEIGHT` from `./GroundAtlas`.
- Produces: `drawTerrain(ctx, level, tileset, groundAtlas, originX?, originY?)` — `groundAtlas: HTMLImageElement` is the **new 4th positional parameter**, so `originX`/`originY` move to 5th/6th.

- [ ] **Step 1: Update the existing groundGrass tests and add new ones**

Two preparatory edits to `Renderer.test.ts` first.

`makeMockContext` (line 91) has `save`, `translate`, `scale` and `restore` spies but **no `rotate`** — the rotated draw path would throw on `ctx.rotate is not a function`. Add it beside `scale`:

```typescript
    rotate: vi.fn(),
```

Then add beside `const fakeTileset = {} as HTMLImageElement;` (line 176), matching that file's existing fake-image style:

```typescript
const fakeGroundAtlas = {} as HTMLImageElement;
```

Both fakes are distinct object identities, so assertions can tell the two images apart with `c[0] === fakeGroundAtlas`.

Every `drawTerrain(ctx, level, fakeTileset, ...)` call in the file then gains a 4th argument.

**Reading `drawImage` call arguments.** `makeMockContext()` returns a value cast to `CanvasRenderingContext2D`, so `ctx.drawImage.mock` does not typecheck. Where a test below inspects `.mock.calls`, use the convention this file already uses (see the `drawCollectibles` tests around line 233) — declare the mock-typed handle and cast when passing it in:

```typescript
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawTerrain(
      ctx as unknown as CanvasRenderingContext2D,
      level,
      fakeTileset,
      fakeGroundAtlas,
    );

    const calls = ctx.drawImage.mock.calls as unknown[][];
```

Tests that only use `expect(ctx.drawImage).toHaveBeenCalledWith(...)` need no cast and can keep `const ctx = makeMockContext();`. Where a test below asserts on `ctx.rotate`, it needs the same treatment: widen the handle to `{ drawImage: ReturnType<typeof vi.fn>; rotate: ReturnType<typeof vi.fn> }`.

Replace the two existing groundGrass cases in `describe('drawTerrain', ...)` with:

```typescript
  it('groundGrassIsolatedTile-draws-fromGradientCellC0R0', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      1, fakeGroundAtlas, 0, 0, 16, 16, 0, 0, 32, 32,
    );
  });

  it('groundGrassTopOfTwoTallColumn-draws-fromBrightColumnTopCellC6R0', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    // Down neighbour only -> closed T L R -> c6r0 at 6*19 = 114.
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      1, fakeGroundAtlas, 114, 0, 16, 16, 0, 0, 32, 32,
    );
  });

  it('groundGrassBottomOfTwoTallColumn-draws-fromDarkColumnBottomCellC0R2', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    // Up neighbour only -> closed B L R -> c0r2 at sx 0, sy 2*19 = 38, drawn
    // into the second row. Asserted in full rather than by filtering on sy,
    // because the grass row shares sy = 38.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeGroundAtlas, 0, 38, 16, 16, 0, 32, 32, 32,
    );
  });

  it('groundGrassBuriedInterior-draws-fromDarkInteriorCellC5R1', () => {
    const level: LevelDef = {
      width: 3,
      height: 3,
      terrain: [
        ['groundGrass', 'groundGrass', 'groundGrass'],
        ['groundGrass', 'groundGrass', 'groundGrass'],
        ['groundGrass', 'groundGrass', 'groundGrass'],
      ],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    // The centre cell has all four neighbours -> c5r1 at 5*19, 1*19.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeGroundAtlas, 95, 19, 16, 16, 32, 32, 32, 32,
    );
  });

  it('groundGrassLeftEdgeOfTallMass-rotatesTheBottomEdgeTile', () => {
    const level: LevelDef = {
      width: 2,
      height: 3,
      terrain: [
        ['groundGrass', 'groundGrass'],
        ['groundGrass', 'groundGrass'],
        ['groundGrass', 'groundGrass'],
      ],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    // Cell (0,1): up, down and right are ground -> closed L only -> the
    // bottom-edge tile c1r1 turned a quarter-turn clockwise, so it is drawn
    // through a rotated transform centred on the cell rather than at its
    // top-left corner.
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeGroundAtlas, 19, 19, 16, 16, -16, -16, 32, 32,
    );
  });

  it('nonGroundGrassTiles-stillDrawFromTheWorldTileset', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['wall']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 128, 0, 16, 16, 0, 0, 32, 32);
  });
```

Then update every remaining `drawTerrain(...)` call in the file to pass `fakeGroundAtlas` as the 4th argument, keeping the origin arguments in 5th/6th position (e.g. `drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas, 0, 100)`).

Confirm `makeMockContext()` provides `save`, `restore`, `translate` and `rotate` spies. If `rotate` or `translate` is missing, add them as `vi.fn()` alongside the existing ones.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL — groundGrass still draws from `fakeTileset` at `0,0`, and `ctx.rotate` is never called.

- [ ] **Step 3: Write the implementation**

In `Renderer.ts`, extend the `../level/Terrain` import to add `neighbourMask`, `NEIGHBOUR_UP`, `horizontalRunPosition` and `RENDER_SCALE`, and add:

```typescript
import { groundAtlasCell, grassCell, GRASS_SOURCE_HEIGHT } from './GroundAtlas';
import type { GroundAtlasEntry } from './GroundAtlas';
```

Replace the `groundGrass` case in `tileSource` with:

```typescript
    case 'groundGrass':
      // Drawn by drawTerrain's own atlas path — it sources from a different
      // image and may be rotated, neither of which this shared lookup models.
      return null;
```

Add above `drawTerrain`:

```typescript
/**
 * Draws one atlas cell into a terrain cell, applying the entry's rotation
 * about the cell's own centre. Only the flat dark tiles are ever rotated
 * (see GroundAtlas.ts) — a vertical brightness ramp turned sideways reads as
 * broken.
 */
function drawGroundTile(
  ctx: CanvasRenderingContext2D,
  groundAtlas: HTMLImageElement,
  entry: GroundAtlasEntry,
  destX: number,
  destY: number,
): void {
  if (entry.rotation === 0) {
    ctx.drawImage(
      groundAtlas, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
      destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
    );
    return;
  }

  const half = RENDERED_TILE_SIZE / 2;
  ctx.save();
  ctx.translate(destX + half, destY + half);
  ctx.rotate((entry.rotation * Math.PI) / 2);
  ctx.drawImage(
    groundAtlas, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
    -half, -half, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
  );
  ctx.restore();
}

/**
 * Grass continues into a horizontal neighbour only when that neighbour is
 * itself a grass-topped surface cell. A `groundRock` neighbour, or a
 * `groundGrass` one that is buried because the terrain steps up, caps the
 * run instead — which is why this is not the same predicate the ground
 * mask uses (that one is about facing air, not matching material).
 */
function isGrassSurface(level: LevelDef, col: number, row: number): boolean {
  return tileAt(level, col, row) === 'groundGrass' && isTopExposed(level, col, row);
}
```

Replace `drawTerrain` with:

```typescript
export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  tileset: HTMLImageElement,
  groundAtlas: HTMLImageElement,
  originX = 0,
  originY = 0,
): void {
  ctx.imageSmoothingEnabled = false;

  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const tile = tileAt(level, col, row);
      const { x, y } = tileToPixel(col, row);
      const destX = x + originX;
      const destY = y + originY;

      if (tile === 'groundGrass') {
        const mask = neighbourMask(level, col, row);
        drawGroundTile(ctx, groundAtlas, groundAtlasCell(mask), destX, destY);

        if ((mask & NEIGHBOUR_UP) === 0) {
          const grass = grassCell(horizontalRunPosition(level, col, row, isGrassSurface));
          ctx.drawImage(
            groundAtlas, grass.sx, grass.sy, TILE_SIZE, GRASS_SOURCE_HEIGHT,
            destX, destY, RENDERED_TILE_SIZE, GRASS_SOURCE_HEIGHT * RENDER_SCALE,
          );
        }
        continue;
      }

      const source = tileSource(level, tile, col, row);
      if (!source) continue;

      ctx.drawImage(
        tileset, source.sx, source.sy, TILE_SIZE, TILE_SIZE,
        destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
      );
    }
  }
}
```

- [ ] **Step 4: Run the Renderer tests**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS. Type errors at the three `drawTerrain` call sites outside tests are expected and fixed in Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat: draw groundGrass from the autotiled atlas"
```

---

### Task 5: The grass overlay pass

The draw code landed in Task 4; this task pins its behaviour with its own tests.

**Files:**
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `drawTerrain` from Task 4, `grassCell`/`GRASS_SOURCE_HEIGHT` semantics from Task 3.
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('drawTerrain', ...)`:

```typescript
  it('grassPass-topExposedSingleTile-drawsSingleGrassVariantOverTheGroundTile', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    // c4r2 at 4*19 = 76, 2*19 = 38; 9px tall source, 18px tall destination.
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      2, fakeGroundAtlas, 76, 38, 16, 9, 0, 0, 32, 18,
    );
  });

  it('grassPass-threeWideRun-drawsLeftMiddleRightVariants', () => {
    const level: LevelDef = {
      width: 3,
      height: 1,
      terrain: [['groundGrass', 'groundGrass', 'groundGrass']],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    const grassSx = ctx.drawImage.mock.calls
      .filter((c: unknown[]) => c[0] === fakeGroundAtlas && c[4] === 9)
      .map((c: unknown[]) => c[1] as number);
    expect(grassSx).toEqual([19, 38, 57]);
  });

  it('grassPass-buriedTile-drawsNoGrass', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    // Only the top cell is top-exposed, so exactly one grass sprite is drawn.
    const grassCalls = ctx.drawImage.mock.calls.filter(
      (c: unknown[]) => c[0] === fakeGroundAtlas && c[4] === 9,
    );
    expect(grassCalls).toHaveLength(1);
    expect(grassCalls[0][6]).toBe(0);
  });

  it('grassPass-neighbourIsRock-capsTheRunAsSingle', () => {
    const level: LevelDef = {
      width: 2,
      height: 1,
      terrain: [['groundGrass', 'groundRock']],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    const grassCalls = ctx.drawImage.mock.calls.filter(
      (c: unknown[]) => c[0] === fakeGroundAtlas && c[4] === 9,
    );
    expect(grassCalls).toHaveLength(1);
    expect(grassCalls[0][1]).toBe(76); // the 'single' variant, c4r2
  });

  it('grassPass-stepUpNeighbour-capsTheRunEvenThoughItIsGround', () => {
    // The right neighbour is groundGrass but buried under more ground, so the
    // grass must cap rather than run into it.
    const level: LevelDef = {
      width: 2,
      height: 2,
      terrain: [
        ['empty', 'groundGrass'],
        ['groundGrass', 'groundGrass'],
      ],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    // Cell (0,1) is top-exposed; its right neighbour (1,1) is not.
    const grassAtBottomLeft = ctx.drawImage.mock.calls.find(
      (c: unknown[]) => c[0] === fakeGroundAtlas && c[4] === 9 && c[5] === 0 && c[6] === 32,
    );
    expect(grassAtBottomLeft![1]).toBe(76); // 'single', not 'left'
  });
```

- [ ] **Step 2: Run tests to verify they fail or pass as expected**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS if Task 4's implementation is correct. Any failure here is a genuine bug in the grass pass — fix `drawTerrain`, do not weaken the test.

- [ ] **Step 3: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: Renderer and Terrain suites PASS. The editor and page suites may still fail on the missing 4th argument — that is Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/themes/platformer/engine/Renderer.test.ts
git commit -m "test: pin grass overlay pass behaviour"
```

---

### Task 6: Load the atlas and update every call site

**Files:**
- Modify: `src/themes/platformer/entities/sprites/sheets.ts`
- Modify: `src/themes/platformer/PlatformerPage.tsx:173` (refs), `:414-419` (draw), `:1426-1436` (loading)
- Modify: `src/themes/platformer/editor/EditorCanvas.tsx:35-44` (`EditorImages`), `:175-177` (draw)
- Modify: `src/themes/platformer/editor/LevelEditorPage.tsx:27-36` (`EMPTY_IMAGES`), `:38-47` (`IMAGE_SOURCES`)
- Modify: `src/themes/platformer/editor/paletteTiles.ts` (the `G` entry)
- Test: `src/themes/platformer/editor/EditorCanvas.test.tsx:28` (`EMPTY_IMAGES`), `:196-231`

**Interfaces:**
- Consumes: `drawTerrain`'s new signature from Task 4.
- Produces: `GROUND_ATLAS_SHEET: SpriteSheet` from `sheets.ts`; `EditorImages.groundAtlas: HTMLImageElement | null`.

- [ ] **Step 1: Update the editor tests to expect the atlas**

In `EditorCanvas.test.tsx`, add `groundAtlas: null,` to the `EMPTY_IMAGES` object (line 28, after `tileset: null,`).

Replace the existing `'calls drawTerrain with the tileset image when it is loaded'` test (line 196) with the version below, and add the second test after it. These render `<EditorCanvas />` directly, matching the file's existing style — there is no `renderCanvas` helper.

```typescript
  it('calls drawTerrain with both the tileset and the ground atlas when they are loaded', () => {
    stubCanvasContext();
    const tileset = {} as HTMLImageElement;
    const groundAtlas = {} as HTMLImageElement;
    const grid: TileChar[][] = [['G']];
    render(
      <EditorCanvas
        grid={grid}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, tileset, groundAtlas }}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(drawTerrain).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 1, height: 1 }),
      tileset,
      groundAtlas,
      0,
      0,
    );
  });

  it('skips drawTerrain when the ground atlas has not loaded yet', () => {
    stubCanvasContext();
    const tileset = {} as HTMLImageElement;
    render(
      <EditorCanvas
        grid={[['G']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={{ ...EMPTY_IMAGES, tileset, groundAtlas: null }}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );
    expect(drawTerrain).not.toHaveBeenCalled();
  });
```

Keep the existing `'skips drawTerrain when the tileset image has not loaded yet'` test unchanged.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/EditorCanvas.test.tsx`
Expected: FAIL — `groundAtlas` is not a property of `EditorImages`, and `drawTerrain` receives origins in the 4th/5th positions.

- [ ] **Step 3: Register the sheet**

Append to `src/themes/platformer/entities/sprites/sheets.ts`:

```typescript
/** `tile_atlas.png` is the purpose-built ground sheet: 16px tiles on a 19px
 *  stride, 7 columns by 3 rows. Terrain addresses it through its own
 *  neighbour-mask table in `GroundAtlas.ts` rather than by frame index — the
 *  3px gutter means `frameSource`'s stride maths does not apply — so this
 *  registration exists for loading, not addressing. */
export const GROUND_ATLAS_SHEET: SpriteSheet = {
  src: '/sprites/tile_atlas.png',
  frameWidth: TILE_SIZE,
  frameHeight: TILE_SIZE,
  columns: 7,
};
```

- [ ] **Step 4: Wire up the game page**

In `PlatformerPage.tsx`, add beside `tilesetRef` at line 173:

```typescript
  const groundAtlasRef = useRef<HTMLImageElement | null>(null);
```

Change the guarded draw block at lines 414-419 so terrain waits for both images while the sky and signs keep needing only the tileset:

```typescript
      if (tilesetRef.current) {
        // Fixed to the viewport, not the camera — drawn over the plain
        // fillRect fallback above, once the tileset has actually loaded.
        drawSkyBackground(ctx, tilesetRef.current, canvas.width, canvas.height, backgroundColor);
        if (groundAtlasRef.current) {
          drawTerrain(
            ctx,
            currentLevel.value,
            tilesetRef.current,
            groundAtlasRef.current,
            originX,
            originY,
          );
        }
        drawSigns(ctx, signPlacements.value, tilesetRef.current, originX, originY);
      }
```

Add beside the `world_tileset.png` load at line 1426:

```typescript
    loadImage(GROUND_ATLAS_SHEET.src)
      .then((img) => {
        if (cancelled) return;
        groundAtlasRef.current = img;
        render();
      })
      .catch(() => {
        // Ground simply won't render if the atlas fails to load; the sky and
        // the background fill still show so the page isn't blank.
      });
```

Add `GROUND_ATLAS_SHEET` to the existing multi-line named import from `'./entities/sprites/sheets'` that already ends at line 108 — do not add a second import statement for the same module.

- [ ] **Step 5: Wire up the editor**

In `EditorCanvas.tsx`, add to `EditorImages` after `tileset`:

```typescript
  groundAtlas: HTMLImageElement | null;
```

and change the terrain draw at lines 175-177 to:

```typescript
    if (images.tileset && images.groundAtlas) {
      drawTerrain(
        ctx,
        gridToLevelDef(grid),
        images.tileset,
        images.groundAtlas,
        panOffset.x,
        panOffset.y,
      );
    }
```

In `LevelEditorPage.tsx`, add `groundAtlas: null,` to `EMPTY_IMAGES` and add to `IMAGE_SOURCES`:

```typescript
  { key: 'groundAtlas', src: '/sprites/tile_atlas.png' },
```

- [ ] **Step 6: Point the palette icon at the atlas**

In `paletteTiles.ts`, add beside the `WORLD_TILESET` constant:

```typescript
const TILE_ATLAS = '/sprites/tile_atlas.png';
```

and replace the `G` entry with the atlas's plain top-edge tile (`c4r0`), which is the most representative single icon for grassy ground:

```typescript
  G: {
    sheet: TILE_ATLAS,
    sheetWidth: 130,
    sheetHeight: 54,
    sx: 76,
    sy: 0,
    frameWidth: 16,
    frameHeight: 16,
  },
```

No test change is needed here: `paletteTiles.test.ts` asserts sprite coordinates only for the `'1'` sign marker, never for `G`. Its other tests check that every key has a label and a truthy entry, which this edit preserves.

- [ ] **Step 7: Run the full suite, lint and typecheck**

Run: `npm test && npm run lint && npx tsc -b`
Expected: PASS on all three. `tsc` is the check that no `drawTerrain` call site was missed.

- [ ] **Step 8: Commit**

```bash
git add src/themes/platformer/entities/sprites/sheets.ts \
        src/themes/platformer/PlatformerPage.tsx \
        src/themes/platformer/editor/EditorCanvas.tsx \
        src/themes/platformer/editor/EditorCanvas.test.tsx \
        src/themes/platformer/editor/LevelEditorPage.tsx \
        src/themes/platformer/editor/paletteTiles.ts
git commit -m "feat: load the ground atlas in the game and level editor"
```

---

### Task 7: Verify in the browser

**Files:** none — this is the manual gate the roadmap's working agreement requires.

- [ ] **Step 1: Start the dev server**

Use the Browser pane, never a raw shell command. `.claude/launch.json` already defines the server:

```
preview_start({ name: 'cv-website-dev' })
```

It runs `npm run dev` on port 5173 with `autoPort`, so take the URL from the tool result rather than assuming 5173.

- [ ] **Step 2: Unlock and open the Platformer theme**

The theme is hidden behind a localStorage flag (`src/state/theme.ts`), default `false`, so no theme switcher lists it until it is set. Set it directly and reload:

```javascript
localStorage.setItem('platformerPrototypeUnlocked', 'true');
location.reload();
```

Then switch to the Platformer theme. Check `read_console_messages` for errors before judging anything visually — a failed atlas load shows as missing ground rather than an obvious error.

- [ ] **Step 3: Check the ground renders correctly**

Confirm on the existing level: grass runs cap correctly at both ends and step-ups, the bright band is exactly one tile everywhere, deeper cells are dark, and no unexpected dark border lines appear inside a solid mass. Take a screenshot as evidence.

- [ ] **Step 4: Draw the awkward shapes in the level editor**

Navigate to `/platformer/editor` (the route is registered in `App.tsx`). Draw and confirm each shape: an isolated single tile, a one-wide column three or more tall, a one-tile-tall platform three or more wide, a staircase, and a wide solid mass. Compare against the "Vertical banding rule" section of the design doc, and screenshot the result.

- [ ] **Step 5: Judge the two rotated tiles specifically**

Masks 7 and 13 (left-edge and right-edge of a tall mass) are `c1r1` turned 90°. On the wide solid mass from the previous step, check its left and right edges: the border should read as a clean vertical line with no brightness ramp running sideways. If it looks wrong, report it — the fix is drawing explicit tiles into `c5r2`/`c6r2`, which is an art change plus two table entries, not a code redesign.

- [ ] **Step 6: Note any art mismatches**

The design doc's "Required art fix" flags `c3r1` (the middle of a one-tile-tall strip) as still flat dark rather than a gradient. If a thin platform three or more wide shows gradient ends around flat middles, that is the known art issue, not a code bug — report it rather than working around it in code.

---

### Task 8: Update the roadmap and retire the superseded reference

**Files:**
- Modify: `specs/S-006-platformer-theme/roadmap.md:84-86`
- Move: `public/sprites/spring_.png`, `public/sprites/terrain_.png`

- [ ] **Step 1: Check off the roadmap step**

Replace the step 32 entry with:

```markdown
- [x] **32. Terrain rework** — `groundGrass` is autotiled from `tile_atlas.png` via a
  4-neighbour mask, with grass drawn as a decoupled overlay pass. Design in
  `plans/2026-09-02-terrain-rework-design.md`.
```

- [ ] **Step 2: Move the retired sheets out of the deployed bundle**

`public/` is copied verbatim into `dist/`, so unused sheets ship to the site. Neither file is referenced by any code.

```bash
mkdir -p docs/assets/tilesets
git mv public/sprites/spring_.png docs/assets/tilesets/spring_.png
git mv public/sprites/terrain_.png docs/assets/tilesets/terrain_.png
```

- [ ] **Step 3: Verify nothing referenced them**

Run: `grep -rn "spring_\.png\|terrain_\.png" --include=*.ts --include=*.tsx --include=*.css src/`
Expected: no matches.

- [ ] **Step 4: Run the full suite and build**

Run: `npm test && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md docs/assets/tilesets
git commit -m "docs: check off terrain rework and move retired tilesets out of public"
```

---

## Notes for the executor

- `docs/Features.md` tracking (the CLAUDE.md completion ritual) applies to numbered
  features `F-NNN`/`S-NNN`/`O-NNN`. This is roadmap step 32 within the already-tracked
  `S-006` feature, so Task 8's roadmap tick is the tracking update — do not add a new
  `Features.md` row.
- Branch: per the roadmap's branch strategy, work on `S-006-step32-terrain-rework` off
  `main` and open a PR into `main`. Do not commit directly to `main`.
- The atlas is currently untracked (`public/sprites/tile_atlas.png`). Task 6 is the first
  task that references it, so make sure it is added to git — `git add
  public/sprites/tile_atlas.png` — as part of that task's commit if it is not already
  tracked.
