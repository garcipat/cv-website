# Hint Signs (Roadmap Step 26) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new non-solid, non-collectible level entity — a signpost — sits at a
hand-authored position in the level. While the character overlaps it, a speech-bubble
tooltip with localized hint text appears near the character; it disappears when they
walk away. Signs are reusable (never consumed), carry no CV mapping, and never touch
`collectedFacts`/the journal. The first sign (marker `1`) sits near `level1`'s
one-way bridge, teaching the Down/`S` drop-through control.

**Architecture:** Each distinct hint gets its own single-digit marker character
(`1`–`9`), mapped directly to a `hintId` string in a new `SIGN_CHARS` table
(`LevelParser.ts`) — unlike coins/enemies, there's no CVData-order "zip": the marker
character itself carries the hint's identity, so editing the level layout can never
scramble which sign shows which text. `level1.ts` places one `1` marker near the
bridge and exports `SIGN_PLACEMENTS: SignDef[]` (via a new, simple `level/SignMapper.ts`
— no CVData involved, so no "def vs. placement" split like `CollectibleMapper.ts`/
`EnemyMapper.ts` need). Overlap detection reuses `Collision.ts`'s existing
`playerHitbox`/`aabbOverlap` helpers. The currently-overlapped sign's `hintId` lives in
a new `activeSignHintId` signal (`PlatformerState.ts`), updated every game-loop tick.
Both the static signpost sprite and the tooltip are drawn directly on the canvas in
`PlatformerPage.tsx`'s existing `render()` function (matching how collection-effect
text and the restart prompt are already drawn there) rather than as a DOM overlay —
the tooltip must track the character's screen position, which the canvas render loop
already computes every frame (`originX`/`originY`), while a DOM element would need its
own separate position-tracking effect. Hint text is resolved from the existing i18n
system (`platformer.hints.<hintId>`, via `currentUI.value`), read once per frame inside
`render()` — the same pattern the game loop already uses for fact labels — so it
updates for free when the locale changes.

**Tech Stack:** Vite + React 19 + TypeScript strict + `@preact/signals-react` +
Vitest/RTL (matches the rest of the platformer theme).

**Spec:** `specs/S-006-platformer-theme/spec.md` (FR-037–FR-040, User Story 9) and
`specs/S-006-platformer-theme/roadmap.md` (step 26).

## Global Constraints

- Typed data architecture: no `any` types; TypeScript strict mode stays clean.
- TDD: every new pure function/component gets a failing test first, per the constitution.
- Named arrow/function exports only, no default exports.
- No new dependencies, no backend/API calls, no new image asset — signs use the
  existing `world_tileset.png` (already loaded for terrain).
- Sign marker characters are single digits `1`–`9`, each mapped directly to one
  `hintId` — capped at 9 distinct hints total (accepted constraint, FR-037). This is
  deliberately NOT the CVData-order "zip" convention `C`/`F`/`E`/`M` markers use.
- Signs are non-solid (no terrain collision) and non-collectible: touching one never
  writes to `collectedFacts` or `collectedCollectibleIds`, and is not deduplicated —
  the tooltip can reappear every time the character re-overlaps the sign.
- The tooltip must not pause the game and must not block movement.
- Hint text comes from `src/i18n/locales/en.json`/`de.json` under
  `platformer.hints.<hintId>` — NOT a bespoke dictionary file.
- Signpost tile: `world_tileset.png` at pixel `(128, 48)` (tile col 8, row 3), 16×16,
  confirmed by decoding the sprite sheet directly — sits immediately right of the
  crate tile (col 7, row 3, already used by roadmap step 21).

---

## Task 1: `SIGN_CHARS` + `findSignTiles` in `LevelParser.ts`

**Files:**
- Modify: `src/themes/platformer/level/LevelParser.ts`
- Test: `src/themes/platformer/level/LevelParser.test.ts`

**Interfaces:**
- Produces: `SIGN_CHARS: Record<string, string | undefined>` (digit → hintId),
  `findSignTiles(layout: readonly string[]): { col: number; row: number; hintId: string }[]`
  — both consumed by Task 3's `level1.ts`/`SignMapper.ts`.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/level/LevelParser.test.ts`. First, add `SIGN_CHARS,
findSignTiles` to the existing import from `./LevelParser`. Then add:

```ts
describe('SIGN_CHARS', () => {
  it('digitOne-mapsToBridgeDropThroughHint', () => {
    expect(SIGN_CHARS['1']).toBe('bridgeDropThrough');
  });

  it('noOverlapWithTerrainOrEntityChars-documentedByTheModuleLoadGuard', () => {
    // Same convention as the existing TERRAIN_CHARS/ENTITY_CHARS overlap
    // guard (see LevelParser.ts) — this file having loaded at all is that
    // guard having already passed.
    const overlapsTerrain = Object.keys(SIGN_CHARS).filter((char) => char in TERRAIN_CHARS);
    const overlapsEntity = Object.keys(SIGN_CHARS).filter((char) => char in ENTITY_CHARS);
    expect(overlapsTerrain).toEqual([]);
    expect(overlapsEntity).toEqual([]);
  });
});

describe('parseLevel — sign markers', () => {
  it('signMarker-parsesAsEmptyWalkableTile', () => {
    const result = parseLevel(['1.', 'GG']);
    expect(result.terrain[0][0]).toBe('empty');
  });
});

describe('findSignTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findSignTiles(['GG', 'GG'])).toEqual([]);
  });

  it('oneMarker-returnsItsColRowAndHintId', () => {
    expect(findSignTiles(['..', '.1'])).toEqual([{ col: 1, row: 1, hintId: 'bridgeDropThrough' }]);
  });

  it('multipleDistinctMarkers-returnsAllInReadingOrder', () => {
    // '1' and a hypothetical second digit would need a second SIGN_CHARS
    // entry to resolve — today only '1' is registered, so this exercises
    // multiple placements of the SAME hint, which is valid (a hint can be
    // shown at more than one spot in the level).
    expect(findSignTiles(['1.', '.1'])).toEqual([
      { col: 0, row: 0, hintId: 'bridgeDropThrough' },
      { col: 1, row: 1, hintId: 'bridgeDropThrough' },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- LevelParser.test.ts`
Expected: FAIL — `SIGN_CHARS`/`findSignTiles` are not exported yet.

- [ ] **Step 3: Implement**

In `src/themes/platformer/level/LevelParser.ts`:

1. Add, after the existing `ENTITY_CHARS` block and its overlap guard:

```ts
/**
 * Maps each sign-marker character to the hint it shows. Unlike
 * ENTITY_CHARS (coins/enemies, whose specific CV fact comes from zipping
 * marker discovery order against CVData), a sign's content is hand-authored,
 * not derived from CVData — so the character itself carries the hint's
 * identity directly. This means the level layout can be freely edited
 * (rows/columns added, removed, reordered) without ever scrambling which
 * sign shows which text — a zip-by-discovery-order approach couldn't
 * guarantee that. Capped at digits 1-9 (an accepted constraint, FR-037):
 * this level is expected to need only a handful of distinct hints ever.
 */
export const SIGN_CHARS: Record<string, string | undefined> = {
  '1': 'bridgeDropThrough',
};

// A sign-marker character must not also mean a terrain tile or another
// entity marker — same guard convention as TERRAIN_CHARS/ENTITY_CHARS above,
// kept separate since it's a distinct table with its own meaning.
const sharedWithSignChars = [
  ...Object.keys(TERRAIN_CHARS).filter((char) => char in SIGN_CHARS),
  ...Object.keys(ENTITY_CHARS).filter((char) => char in SIGN_CHARS),
];
if (sharedWithSignChars.length > 0) {
  throw new Error(
    `Level character(s) defined as both a terrain/entity marker and a sign marker: ${sharedWithSignChars.join(', ')}`,
  );
}
```

2. In `parseLevel`, add a branch for sign markers (same treatment as entity
   markers — resolves to `empty` terrain):

```ts
  const terrain: TileMap = layout.map((row) =>
    row.split('').map((char) => {
      const tile = TERRAIN_CHARS[char];
      if (tile) return tile;
      if (ENTITY_CHARS[char]) return 'empty';
      if (SIGN_CHARS[char]) return 'empty';
      throw new Error(`Unknown level tile character: "${char}"`);
    }),
  );
```

3. Add, after `findFruitTiles`:

```ts
/**
 * Finds every sign marker's position in a level layout, in reading order,
 * paired with the hint it shows (SIGN_CHARS). Unlike findCoinTiles/
 * findFruitTiles/findGreenEnemyTiles/findPurpleEnemyTiles, this scans for
 * ANY key of SIGN_CHARS at once (not one specific EntityKind) and returns
 * the resolved hintId directly — there's no separate CVData-derived list to
 * zip these positions against.
 */
export function findSignTiles(
  layout: readonly string[],
): { col: number; row: number; hintId: string }[] {
  const tiles: { col: number; row: number; hintId: string }[] = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      const hintId = SIGN_CHARS[layout[row][col]];
      if (hintId) tiles.push({ col, row, hintId });
    }
  }
  return tiles;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- LevelParser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/LevelParser.ts src/themes/platformer/level/LevelParser.test.ts
git commit -m "feat(platformer): add sign markers to LevelParser"
```

---

## Task 2: `SignDef` type + `SignMapper.ts`

**Files:**
- Modify: `src/themes/platformer/types.ts`
- Create: `src/themes/platformer/level/SignMapper.ts`
- Test: `src/themes/platformer/level/SignMapper.test.ts`

**Interfaces:**
- Consumes: `findSignTiles` (Task 1), `tileToPixel` (`./Terrain`, existing).
- Produces: `SignDef` type (`../types.ts`); `placeSigns(layout: readonly string[]): SignDef[]`
  — consumed by Task 3's `level1.ts`, Task 4's `Collision.ts`, Task 7's `Renderer.ts`.

- [ ] **Step 1: Add the `SignDef` type**

In `src/themes/platformer/types.ts`, add after `EnemyDef`:

```ts
/**
 * A placed hint sign (roadmap step 26, FR-037). Unlike CollectibleDef/
 * EnemyDef, there's no separate "not yet placed" def stage — a sign marker's
 * character already fully determines both its position and its hintId (see
 * LevelParser.ts's SIGN_CHARS), so SignMapper.ts's placeSigns produces
 * SignDef directly. No `fact`/`cvSection`/`cvIndex` — signs carry no CV
 * mapping at all.
 */
export interface SignDef {
  id: string;
  x: number;
  y: number;
  hintId: string;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/themes/platformer/level/SignMapper.test.ts`:

```ts
import { placeSigns } from './SignMapper';
import { tileToPixel } from './Terrain';

describe('placeSigns', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(placeSigns(['GG', 'GG'])).toEqual([]);
  });

  it('oneMarker-returnsSignDefAtItsPixelPosition', () => {
    const result = placeSigns(['..', '.1']);
    const { x, y } = tileToPixel(1, 1);
    expect(result).toEqual([{ id: 'sign-bridgeDropThrough-1-1', x, y, hintId: 'bridgeDropThrough' }]);
  });

  it('twoMarkersOfSameHint-returnsTwoDistinctlyIdentifiedSignDefs', () => {
    const result = placeSigns(['1.', '.1']);
    expect(result).toHaveLength(2);
    expect(result[0].id).not.toBe(result[1].id);
    expect(result.every((s) => s.hintId === 'bridgeDropThrough')).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- SignMapper.test.ts`
Expected: FAIL — `./SignMapper` does not exist yet.

- [ ] **Step 4: Implement**

Create `src/themes/platformer/level/SignMapper.ts`:

```ts
import { findSignTiles } from './LevelParser';
import { tileToPixel } from './Terrain';
import type { SignDef } from '../types';

/**
 * Places a `SignDef` at every sign marker in a level layout. Unlike
 * placeCollectibles/placeEnemies, there's no CVData-derived "def" to zip
 * against a marker queue — a sign marker's character already fully
 * determines its hintId (LevelParser.ts's SIGN_CHARS), so this is a direct
 * marker-to-placement conversion. The id includes col/row so two signs
 * showing the same hint at different spots in the level get distinct ids.
 */
export function placeSigns(layout: readonly string[]): SignDef[] {
  return findSignTiles(layout).map(({ col, row, hintId }) => {
    const { x, y } = tileToPixel(col, row);
    return { id: `sign-${hintId}-${col}-${row}`, x, y, hintId };
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- SignMapper.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/types.ts src/themes/platformer/level/SignMapper.ts src/themes/platformer/level/SignMapper.test.ts
git commit -m "feat(platformer): add SignDef type and placeSigns mapper"
```

---

## Task 3: Place a sign marker in `level1.ts`

**Files:**
- Modify: `src/themes/platformer/level/level1.ts`
- Test: `src/themes/platformer/level/level1.test.ts`

**Interfaces:**
- Consumes: `placeSigns` (Task 2).
- Produces: `SIGN_PLACEMENTS: SignDef[]` — consumed by Task 6's `PlatformerState.ts`
  and Task 8's `PlatformerPage.tsx`.

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/level/level1.test.ts` (add `SIGN_PLACEMENTS` to the
existing import from `./level1`):

```ts
describe('SIGN_PLACEMENTS', () => {
  it('level1-hasExactlyOneBridgeDropThroughSign', () => {
    expect(SIGN_PLACEMENTS).toHaveLength(1);
    expect(SIGN_PLACEMENTS[0].hintId).toBe('bridgeDropThrough');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- level1.test.ts`
Expected: FAIL — `SIGN_PLACEMENTS` is not exported yet.

- [ ] **Step 3: Implement**

In `src/themes/platformer/level/level1.ts`:

1. Add `placeSigns` to the import from `./SignMapper`, and `SignDef` isn't needed as
   an explicit import (inferred from `placeSigns`'s return type).

2. In `LEVEL_1_LAYOUT`'s row 2 (the entity-marker row — currently
   `'.S........C...............W.E..W....W.M...........C....F....C.........C....F....'`),
   change the character at index 9 (currently `'.'`, two tiles left of the `C` at
   index 10) to `'1'`. This sits at column 9, directly below the floating
   platform/bridge structure (row 0, columns 8-14) the player must jump onto — a
   natural spot to explain the Down/`S` drop-through before they reach it. The
   resulting row is:

```ts
  '.S.......1C...............W.E..W....W.M...........C....F....C.........C....F....',
```

   (Only the character at index 9 changes; every other row is unchanged.)

3. Add the import and export, after the existing `FRUIT_TILES` export:

```ts
import { placeSigns } from './SignMapper';
// ...(add alongside the existing imports from './LevelParser')

/** Hand-placed hint signs, from `LEVEL_1_LAYOUT`'s digit markers (`1`-`9`). */
export const SIGN_PLACEMENTS = placeSigns(LEVEL_1_LAYOUT);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- level1.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full level1/LevelParser suite to check for regressions**

Run: `npm test -- level1.test.ts LevelParser.test.ts`
Expected: PASS — confirms the row-2 character change didn't break any existing
spawn/enemy/coin/fruit position assertions (none of them reference index 9, which was
previously `.`/empty).

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/level/level1.ts src/themes/platformer/level/level1.test.ts
git commit -m "feat(platformer): place a bridge hint sign in level1"
```

---

## Task 4: `checkSignOverlap` in `Collision.ts`

**Files:**
- Modify: `src/themes/platformer/engine/Collision.ts`
- Test: `src/themes/platformer/engine/Collision.test.ts`

**Interfaces:**
- Consumes: `playerHitbox`, `aabbOverlap` (existing, same file); `RENDERED_TILE_SIZE`
  (`../level/Terrain`); `SignDef` (`../types`).
- Produces: `checkSignOverlap(player: PlayerState, signs: SignDef[]): SignDef | undefined`
  — consumed by Task 8's `PlatformerPage.tsx`.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/engine/Collision.test.ts`. The file already has a local
`makePlayer(x, y): PlayerState` helper (used by the existing
`checkCollectibleCollisions`/`checkEnemyStompCollisions` tests) — reuse it. Add
`checkSignOverlap` to the import from `./Collision` and `SignDef` from `../types`:

```ts
describe('checkSignOverlap', () => {
  const sign: SignDef = { id: 'sign-bridgeDropThrough-1-1', x: 100, y: 100, hintId: 'bridgeDropThrough' };

  it('playerOverlappingSign-returnsThatSign', () => {
    const player = makePlayer(100, 100);

    expect(checkSignOverlap(player, [sign])).toBe(sign);
  });

  it('playerFarFromSign-returnsUndefined', () => {
    const player = makePlayer(1000, 1000);

    expect(checkSignOverlap(player, [sign])).toBeUndefined();
  });

  it('noSignsInLevel-returnsUndefined', () => {
    const player = makePlayer(100, 100);

    expect(checkSignOverlap(player, [])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Collision.test.ts`
Expected: FAIL — `checkSignOverlap` is not exported yet.

- [ ] **Step 3: Implement**

In `src/themes/platformer/engine/Collision.ts`, add the import `RENDERED_TILE_SIZE`
from `'../level/Terrain'` and `SignDef` from `'../types'`, then add at the end of the
file:

```ts
/**
 * Returns the first sign the player's hitbox currently overlaps, or
 * `undefined` if none. Unlike checkCollectibleCollisions, this is NOT
 * destructive/dedup-tracked — a sign is reusable, so the same sign can
 * return every tick the player stands on it, and again the next time they
 * walk back onto it. A sign's box is exactly one rendered tile
 * (RENDERED_TILE_SIZE square), matching how it's drawn (Renderer.ts).
 */
export function checkSignOverlap(player: PlayerState, signs: SignDef[]): SignDef | undefined {
  const hitbox = playerHitbox(player);
  for (const sign of signs) {
    const box: Box = { x: sign.x, y: sign.y, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE };
    if (aabbOverlap(hitbox, box)) return sign;
  }
  return undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Collision.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Collision.ts src/themes/platformer/engine/Collision.test.ts
git commit -m "feat(platformer): add checkSignOverlap collision check"
```

---

## Task 5: i18n content for hint text

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/de.json`

**Interfaces:**
- Produces: `platformer.hints.bridgeDropThrough` translation key, consumed by Task 8's
  `PlatformerPage.tsx` via `currentUI.value.platformer.hints`.

- [ ] **Step 1: Add the English string**

In `src/i18n/locales/en.json`, inside the existing `"platformer"` object, add a
`"hints"` block as a sibling of `"journal"` (and of `"controlsOverlay"`, if the
Controls Overlay plan has already added it — either way, insert immediately before
the existing `"journal"` key):

```json
"platformer": {
  "hints": {
    "bridgeDropThrough": "Hold Down to drop through a bridge."
  },
  "journal": {
```

- [ ] **Step 2: Add the German string**

In `src/i18n/locales/de.json`, same location, same key:

```json
"platformer": {
  "hints": {
    "bridgeDropThrough": "Halte Runter gedrückt, um durch eine Brücke zu fallen."
  },
  "journal": {
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build`
Expected: PASS with no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/de.json
git commit -m "feat(platformer): add bridge drop-through hint i18n strings"
```

---

## Task 6: `activeSignHintId` signal in `PlatformerState.ts`

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`
- Test: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Produces: `activeSignHintId: Signal<string | undefined>` — consumed by Task 8's
  `PlatformerPage.tsx` (written every tick) and its `render()` (read to draw the
  tooltip).

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/PlatformerState.test.ts` (add `activeSignHintId` to the
existing import):

```ts
describe('activeSignHintId', () => {
  afterEach(() => {
    activeSignHintId.value = undefined;
  });

  it('initialValue-onModuleLoad-isUndefined', () => {
    expect(activeSignHintId.value).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PlatformerState.test.ts`
Expected: FAIL — `activeSignHintId` is not exported yet.

- [ ] **Step 3: Implement**

In `src/themes/platformer/PlatformerState.ts`, add near `activeJournalSection`:

```ts
/**
 * The `hintId` of the sign the player currently overlaps (roadmap step 26,
 * FR-038), or `undefined` when not overlapping any sign — updated every game
 * loop tick (see PlatformerPage.tsx's `checkSignOverlap` call) and read by
 * `render()` to decide whether/what to draw as the speech-bubble tooltip.
 * Not reset by `resetGame()`/`resetGameProgress()`: it reflects a purely
 * positional, always-current fact about this frame, not session progress.
 */
export const activeSignHintId = signal<string | undefined>(undefined);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PlatformerState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): add activeSignHintId signal"
```

---

## Task 7: `drawSigns` and `drawSignTooltip` in `Renderer.ts`

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `TILE_SIZE`, `RENDERED_TILE_SIZE`, `tileToPixel` (existing imports);
  `RESTART_PROMPT_FONT_FAMILY` (existing, same file); `SignDef` (`../types`).
- Produces: `drawSigns(ctx, signs: SignDef[], tileset: HTMLImageElement, originX?, originY?): void`,
  `drawSignTooltip(ctx, text: string, playerScreenX: number, playerScreenY: number): void`
  — both consumed by Task 8's `PlatformerPage.tsx`.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/engine/Renderer.test.ts`. Add `drawSigns,
drawSignTooltip` to the existing import from `./Renderer`, add `fillRect: vi.fn()` to
the file's local `makeMockContext()` helper (it isn't there yet), and add `SignDef` to
imports from `'../types'`:

```ts
describe('drawSigns', () => {
  it('onePlacement-drawsSignpostTileAtItsPosition', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const sign: SignDef = { id: 'sign-bridgeDropThrough-1-1', x: 64, y: 96, hintId: 'bridgeDropThrough' };

    drawSigns(ctx as unknown as CanvasRenderingContext2D, [sign], fakeTileset, 10, 20);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset,
      128,
      48,
      16,
      16,
      64 + 10,
      96 + 20,
      32,
      32,
    );
  });

  it('noPlacements-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawSigns(ctx as unknown as CanvasRenderingContext2D, [], fakeTileset);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawSignTooltip', () => {
  it('called-drawsBackgroundRectAndCenteredText', () => {
    const ctx = makeMockContext() as unknown as {
      fillRect: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };

    drawSignTooltip(ctx as unknown as CanvasRenderingContext2D, 'Hold Down to drop through a bridge.', 200, 300);

    expect(ctx.fillRect).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
    expect(ctx.fillText).toHaveBeenCalledWith(
      'Hold Down to drop through a bridge.',
      expect.any(Number),
      expect.any(Number),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Renderer.test.ts`
Expected: FAIL — `drawSigns`/`drawSignTooltip` are not exported yet.

- [ ] **Step 3: Implement**

In `src/themes/platformer/engine/Renderer.ts`, add `import type { SignDef } from
'../types';` near the top, then add (e.g. after `drawRestartPrompt`):

```ts
/** Tile coordinates of the signpost sprite within world_tileset.png (col 8,
 *  row 3 → pixel 128,48), confirmed by decoding the sheet's pixels directly —
 *  sits immediately right of the crate tile (col 7, row 3, roadmap step 21). */
const SIGN_TILE_SX = 8 * TILE_SIZE;
const SIGN_TILE_SY = 3 * TILE_SIZE;

/**
 * Draws every hint sign's static signpost sprite. Same originX/originY
 * convention as drawTerrain/drawPlayer/drawCollectibles. Signs have no
 * animation and no collected/removed state (unlike collectibles) — every
 * placement in `signs` is always drawn.
 */
export function drawSigns(
  ctx: CanvasRenderingContext2D,
  signs: SignDef[],
  tileset: HTMLImageElement,
  originX = 0,
  originY = 0,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const sign of signs) {
    ctx.drawImage(
      tileset,
      SIGN_TILE_SX,
      SIGN_TILE_SY,
      TILE_SIZE,
      TILE_SIZE,
      sign.x + originX,
      sign.y + originY,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
  }
}

const SIGN_TOOLTIP_FONT_SIZE = 16;
const SIGN_TOOLTIP_PADDING_X = 10;
const SIGN_TOOLTIP_PADDING_Y = 6;
/** Vertical gap between the tooltip's bottom edge and the player's anchor
 *  point (playerScreenY), so it floats above the character's head rather
 *  than overlapping it. */
const SIGN_TOOLTIP_OFFSET_Y = 48;

/**
 * Draws a speech-bubble tooltip with `text`, horizontally centered on and
 * floating above `playerScreenX`/`playerScreenY` (already origin-shifted
 * screen-space coordinates, same convention as drawPlayer's own position —
 * the caller passes `player.x + originX`, `player.y + originY`). Uses
 * `fillRect` for the background (not a rounded rect) since that's the
 * primitive already available/mocked everywhere else in this codebase's
 * tests — a plain rectangle reads perfectly fine as a tooltip.
 */
export function drawSignTooltip(
  ctx: CanvasRenderingContext2D,
  text: string,
  playerScreenX: number,
  playerScreenY: number,
): void {
  ctx.save();
  ctx.font = `${SIGN_TOOLTIP_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textWidth = ctx.measureText(text).width;
  const boxWidth = textWidth + SIGN_TOOLTIP_PADDING_X * 2;
  const boxHeight = SIGN_TOOLTIP_FONT_SIZE + SIGN_TOOLTIP_PADDING_Y * 2;
  const boxX = playerScreenX - boxWidth / 2;
  const boxY = playerScreenY - SIGN_TOOLTIP_OFFSET_Y - boxHeight;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, boxX + boxWidth / 2, boxY + boxHeight / 2);
  ctx.restore();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Renderer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): add drawSigns and drawSignTooltip"
```

---

## Task 8: Wire into `PlatformerPage.tsx`

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `SIGN_PLACEMENTS` (`./level/level1`, Task 3); `checkSignOverlap`
  (`./engine/Collision`, Task 4); `activeSignHintId` (`./PlatformerState`, Task 6);
  `drawSigns`, `drawSignTooltip` (`./engine/Renderer`, Task 7); `currentUI`
  (`@/state/locale`, existing).

- [ ] **Step 1: Write the failing tests**

Add `SIGN_PLACEMENTS` to the existing import from `./level/level1`, `activeSignHintId`
to the import from `./PlatformerState`, and reset it in the `beforeEach` (alongside
the other module-level signal resets):

```ts
activeSignHintId.value = undefined;
```

Then add a new `describe` block to `src/themes/platformer/PlatformerPage.test.tsx`:

```tsx
describe('PlatformerPage — hint signs', () => {
  it('render-signSpriteLoaded-drawsSignpostAtItsPosition', async () => {
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);

    const ctx = platformerPage.context;
    const sign = SIGN_PLACEMENTS[0];
    await waitFor(() =>
      expect(ctx.drawImage).toHaveBeenCalledWith(
        expect.anything(),
        128,
        48,
        16,
        16,
        expect.any(Number),
        expect.any(Number),
        32,
        32,
      ),
    );
    // Sanity: the level actually has the one bridge sign this test expects.
    expect(sign.hintId).toBe('bridgeDropThrough');
  });

  it('playerOverlapsSign-gameLoopTicks-drawsTooltipWithHintText', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    const sign = SIGN_PLACEMENTS[0];
    playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
    frameCallback!(0);
    frameCallback!(16);

    expect(activeSignHintId.value).toBe('bridgeDropThrough');
    const ctx = platformerPage.context;
    expect(ctx.fillText).toHaveBeenCalledWith(
      'Hold Down to drop through a bridge.',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('playerWalksAwayFromSign-gameLoopTicks-clearsActiveSignHintId', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    const sign = SIGN_PLACEMENTS[0];
    playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
    frameCallback!(0);
    frameCallback!(16);
    expect(activeSignHintId.value).toBe('bridgeDropThrough');

    playerState.value = { ...playerState.value, x: sign.x + 2000, y: sign.y };
    frameCallback!(32);

    expect(activeSignHintId.value).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- PlatformerPage.test.tsx -t "hint signs"`
Expected: FAIL — nothing draws signs or updates `activeSignHintId` yet.

- [ ] **Step 3: Implement**

In `src/themes/platformer/PlatformerPage.tsx`:

1. Add `SIGN_PLACEMENTS` to the import from `./level/level1` (alongside `level1`).
2. Add `activeSignHintId` to the import from `./PlatformerState`.
3. Add `drawSigns, drawSignTooltip` to the import from `./engine/Renderer`.
4. Add `import { checkSignOverlap } from './engine/Collision';` — Note:
   `checkCollectibleCollisions` etc. are already imported from `'./engine/Collision'`
   in an existing `import { ... } from './engine/Collision';` block — add
   `checkSignOverlap` to that same block instead of a new import line.
5. Add `import { currentUI } from '@/state/locale';` if not already imported (check
   first — `PlatformerPage.tsx` may not currently import from `@/state/locale` at all,
   since `currentCV`/`currentUI` reads happen inside `Journal.tsx` instead).

6. Inside `render()`, right after the `drawTerrain(...)` call, draw signs using the
   same tileset (no new image load needed):

```ts
      if (tilesetRef.current) {
        drawTerrain(ctx, level1, tilesetRef.current, originX, originY);
        drawSigns(ctx, SIGN_PLACEMENTS, tilesetRef.current, originX, originY);
      }
```

7. Still inside `render()`, after the existing `drawPlayer(...)` block (so the
   tooltip draws on top of the player, not underneath), draw the tooltip when a sign
   is active:

```ts
      const activeHintId = activeSignHintId.value;
      if (activeHintId) {
        const hintText = currentUI.value.platformer.hints[activeHintId as keyof typeof currentUI.value.platformer.hints];
        if (hintText) {
          const playerScreenX = playerState.value.x + PLAYER_RENDERED_SIZE / 2 + originX;
          const playerScreenY = playerState.value.y + originY;
          drawSignTooltip(ctx, hintText, playerScreenX, playerScreenY);
        }
      }
```

8. Inside the game loop's `createGameLoop((dt) => { ... })` callback, right after the
   existing collectible-collision block (after the closing `}` of the `if
   (touchedIds.length > 0) { ... }` block, before the stomp-collision block), add:

```ts
      // FR-038: track which sign (if any) the player currently overlaps —
      // NOT dedup-tracked like collectibles; the same sign can become active
      // again every time the player walks back onto it.
      activeSignHintId.value = checkSignOverlap(playerState.value, SIGN_PLACEMENTS)?.hintId;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- PlatformerPage.test.tsx`
Expected: PASS (full file — confirms the new tests pass and nothing else regressed)

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): render hint signs and their overlap tooltip"
```

---

## Task 9: Full verification + roadmap checkbox

**Files:**
- Modify: `specs/S-006-platformer-theme/roadmap.md`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions anywhere in the platformer theme or elsewhere.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: PASS — zero TypeScript errors (SC-007).

- [ ] **Step 3: Manual browser verification**

Start the dev server and open the Platformer theme:
- Confirm a signpost sprite is visible near the ground, a couple tiles left of the
  floating platform/bridge structure.
- Walk the character into it — confirm a speech-bubble tooltip appears above the
  character reading "Hold Down to drop through a bridge." (or the German equivalent
  if the locale toggle is set to DE).
- Walk away — confirm the tooltip disappears.
- Switch locale while standing on the sign — confirm the tooltip text updates
  immediately.
- Confirm the game does not pause and the character can still move/jump while the
  tooltip is showing.
- Open the journal — confirm nothing new appears there (signs are not CV facts).

- [ ] **Step 4: Check off the roadmap step**

In `specs/S-006-platformer-theme/roadmap.md`, change step 26's `- [ ]` to `- [x]`, and
append a short note of anything discovered/adjusted during implementation, matching
the style of prior completed steps' entries, if applicable.

- [ ] **Step 5: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs: check off roadmap step 26 (hint signs)"
```
