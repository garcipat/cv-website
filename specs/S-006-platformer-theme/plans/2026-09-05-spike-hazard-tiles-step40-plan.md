# Spike Hazard Tiles (Roadmap Step 40) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add spike hazard tiles that damage the player for 1 half-heart on any touch (no stomp-defeat, no instant death), authored in the level layout with 4 explicit directional characters (`^` up, `v` down, `<` left, `>` right), reusing the existing spike artwork already present in `staticObjects.png`.

**Architecture:** A hazard is modeled as its OWN lightweight placement family — like `SignPlacement`/`KeyPickupState`, not a `BlockType` or `EnemyType` — because touching-hurts-the-player is, in this codebase, exclusively an entity-contact concern (`resolveEnemyContacts` in `engine/Collision.ts`), while `BlockType` forces unused `Damageable`/patrol/`revive`/`heldItem` fields onto something that never takes damage or moves. Detection reuses the existing generic `overlappingTriggers()` helper (the same one `checkSignOverlap`/`checkKeyPickupCollisions` already use) rather than adding new collision machinery. A `HAZARD_TYPES` registry (mirroring `BLOCK_TYPES`/`ENEMY_TYPES`) carries a `hazardType` field per placement so a future hazard kind (fire, saw blade) is "one file plus one registry line" — `'spike'` is the only entry today. All 4 facings are pre-drawn art in `staticObjects.png` (columns 3-4, rows 6-7, 16px tiles) — no runtime sprite rotation needed.

**Tech Stack:** TypeScript, Vitest + React Testing Library (existing stack, no new dependencies).

**Spec:** This plan's own "Design" section below — the full design was worked out interactively in chat (terrain-vs-entity tradeoff, damage amount, sprite sourcing/coordinates confirmed against the actual `staticObjects.png` asset). The roadmap entry at `specs/S-006-platformer-theme/roadmap.md`'s step 40 is the one-line pointer.

## Design (agreed in chat before this plan was written)

- **Authoring:** 4 new level-layout characters — `^` (up-facing, floor spike), `v` (down-facing, ceiling spike), `<` (left-facing, right-wall spike), `>` (right-facing, left-wall spike). None collide with any existing `TERRAIN_CHARS`/`ENTITY_CHARS`/`SIGN_CHARS` key.
- **Facing is purely cosmetic for collision purposes:** touching ANY part of a spike's tile hurts the player regardless of which face was touched — facing only selects which of the 4 pre-drawn sprites is shown. This keeps the hitbox a plain full-tile box, identical to `signBox`.
- **Damage:** 1 half-heart (`Health.ts`'s `SIDE_HIT_DAMAGE`), same as a pit fall or an enemy side/below touch. No instant-death mechanic exists anywhere in this game and none is introduced.
- **Reusable, not consumed:** like a sign, a spike is never removed or deduplicated — walking into it again after the invulnerability window costs another half-heart.
- **Sprite source (confirmed against the real asset):** `public/sprites/staticObjects.png`, 16px native tiles, `STATIC_OBJECTS_SHEET` (already registered in `entities/sprites/sheets.ts`, already loaded — `CoinPot.ts`/fence use the same sheet). The 2x2 block at columns 3-4, rows 6-7 (0-indexed) holds all 4 facings pre-drawn by the artist:
  - up (floor spike, tip up): column 3, row 7 → `sx=48, sy=112`
  - down (ceiling spike, tip down): column 4, row 6 → `sx=64, sy=96`
  - right (mounted on a left wall, tip right): column 3, row 6 → `sx=48, sy=96`
  - left (mounted on a right wall, tip left): column 4, row 7 → `sx=64, sy=112`
- **Explicitly out of scope:** any hazard kind beyond `'spike'` (the registry just leaves room for one), instant death, partial/per-face hitboxes, moving or animated spikes.

## Global Constraints

- TypeScript strict mode, no `any` (constitution Principle I).
- TDD: tests before implementation, every test passing before moving on (constitution Principle II).
- Named arrow function exports / plain named function exports (matching this codebase's existing convention in `src/themes/platformer/`), typed props/params inline, no default exports (constitution Principle III).
- No new dependencies.
- Update `specs/S-006-platformer-theme/roadmap.md` (check off step 40) once implementation + tests are done and manually verified in the browser. This roadmap step has no matching `docs/Features.md` entry (confirmed: no "spike"/"hazard" hit in that file) — only the roadmap checkbox needs updating.

---

## File Structure

New files:
- `src/themes/platformer/level/HazardMapper.ts` — `HazardPlacement` interface + `hazardBox` + `placeHazards`, mirroring `SignMapper.ts`.
- `src/themes/platformer/level/HazardMapper.test.ts`
- `src/themes/platformer/entities/hazards/HazardType.ts` — the `HazardType<S>` interface (mirrors `BlockType`/`EnemyType`, minus anything `Damageable`).
- `src/themes/platformer/entities/hazards/Spike.ts` — the `'spike'` `HazardType` implementation.
- `src/themes/platformer/entities/hazards/Spike.test.ts`
- `src/themes/platformer/entities/hazards/index.ts` — `HAZARD_TYPES` registry + `typeOf`-style lookup.
- `src/themes/platformer/entities/hazards/index.test.ts`

Modified files (grouped by task below): `level/LevelParser.ts` + its test, `engine/Collision.ts` + its test, `PlatformerState.ts` + its test, `engine/Renderer.ts`, `PlatformerPage.tsx`, `editor/paletteTiles.ts`, `level/level.ts`'s `LEVEL_1_LAYOUT` + marker-table comment, `specs/S-006-platformer-theme/roadmap.md`.

---

### Task 1: `HAZARD_CHARS` + `findHazardTiles` + `TileChar` in `LevelParser.ts`

**Files:**
- Modify: `src/themes/platformer/level/LevelParser.ts`
- Modify: `src/themes/platformer/level/LevelParser.test.ts`

**Interfaces:**
- Produces: `export type HazardFacing = 'up' | 'down' | 'left' | 'right'`, `HAZARD_CHARS: Record<string, { hazardType: 'spike'; facing: HazardFacing } | undefined>`, `findHazardTiles(layout): { col: number; row: number; hazardType: 'spike'; facing: HazardFacing }[]`, `TileChar` widened with `'^' | 'v' | '<' | '>'`. Consumed by Task 2 (`HazardMapper.ts`) and Task 5 (`level.ts`'s `HAZARD_TILES`).

- [ ] **Step 1: Write the failing tests**

In `LevelParser.test.ts`, add (mirroring the existing `SIGN_CHARS`/`findSignTiles` describe blocks — import `HAZARD_CHARS`, `findHazardTiles` alongside the existing `SIGN_CHARS`/`findSignTiles` import):

```ts
describe('HAZARD_CHARS', () => {
  it('eachDirectionCharacter-mapsToSpikeWithItsFacing', () => {
    expect(HAZARD_CHARS['^']).toEqual({ hazardType: 'spike', facing: 'up' });
    expect(HAZARD_CHARS.v).toEqual({ hazardType: 'spike', facing: 'down' });
    expect(HAZARD_CHARS['<']).toEqual({ hazardType: 'spike', facing: 'left' });
    expect(HAZARD_CHARS['>']).toEqual({ hazardType: 'spike', facing: 'right' });
  });

  it('noOverlapWithTerrainEntityOrSignChars-documentedByTheModuleLoadGuard', () => {
    const keys = Object.keys(HAZARD_CHARS);
    expect(keys.filter((char) => char in TERRAIN_CHARS)).toEqual([]);
    expect(keys.filter((char) => char in ENTITY_CHARS)).toEqual([]);
    expect(keys.filter((char) => char in SIGN_CHARS)).toEqual([]);
  });
});

describe('parseLevel — hazard markers', () => {
  it('hazardMarker-parsesAsEmptyWalkableTile', () => {
    const result = parseLevel(['^.', 'GG']);
    expect(result.terrain[0][0]).toBe('empty');
  });
});

describe('findHazardTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findHazardTiles(['GG', 'GG'])).toEqual([]);
  });

  it('oneOfEachDirection-returnsAllWithTheirFacing', () => {
    expect(findHazardTiles(['^v', '<>'])).toEqual([
      { col: 0, row: 0, hazardType: 'spike', facing: 'up' },
      { col: 1, row: 0, hazardType: 'spike', facing: 'down' },
      { col: 0, row: 1, hazardType: 'spike', facing: 'left' },
      { col: 1, row: 1, hazardType: 'spike', facing: 'right' },
    ]);
  });
});
```

Also add `'^'`, `'v'`, `'<'`, `'>'` to the existing `TileChar` describe block's literal array (currently ending `..., '1', '2', '3', '4', '5', 'n', 'N',`):

```ts
      '.', 'G', 'R', '#', 'B', 'H', 'P', 'S', 'M', 'm', 'o', 'X', 'Q', 'F', 'T', 'u',
      '1', '2', '3', '4', '5', 'n', 'N', '^', 'v', '<', '>',
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- LevelParser.test.ts -t "HAZARD|hazard"`
Expected: FAIL — `HAZARD_CHARS is not defined` / `findHazardTiles is not a function`.

- [ ] **Step 3: Implement in `LevelParser.ts`**

Add right after `SIGN_CHARS`'s declaration (before the `charOwners` guard block):

```ts
/** A spike hazard's facing — which of the 4 pre-drawn sprites in
 *  `staticObjects.png` (columns 3-4, rows 6-7) is shown. Purely cosmetic for
 *  collision purposes: touching any part of a spike's tile damages the
 *  player regardless of which face was touched (see Spike.ts's `box`) —
 *  facing only selects the sprite. */
export type HazardFacing = 'up' | 'down' | 'left' | 'right';

/**
 * Maps each hazard-marker character to the hazard it places. Same
 * hand-authored-content convention as SIGN_CHARS (the character itself
 * carries the identity directly, no CVData zip) — a level author picks the
 * exact facing per cell, the same way every other tile is placed explicitly.
 * `hazardType` is carried on every entry (not hardcoded to `'spike'`
 * elsewhere) so a future hazard kind beyond spike only needs a new entry
 * here plus a new `HAZARD_TYPES` registry line (entities/hazards/index.ts) —
 * nothing else in this file changes.
 */
export const HAZARD_CHARS: Record<string, { hazardType: 'spike'; facing: HazardFacing } | undefined> = {
  '^': { hazardType: 'spike', facing: 'up' },
  v: { hazardType: 'spike', facing: 'down' },
  '<': { hazardType: 'spike', facing: 'left' },
  '>': { hazardType: 'spike', facing: 'right' },
};
```

Update the `charOwners` uniqueness guard to include hazard chars:

```ts
for (const char of Object.keys(TERRAIN_CHARS)) (charOwners[char] ??= []).push('terrain');
for (const char of Object.keys(ENTITY_CHARS)) (charOwners[char] ??= []).push('entity');
for (const char of Object.keys(SIGN_CHARS)) (charOwners[char] ??= []).push('sign');
for (const char of Object.keys(HAZARD_CHARS)) (charOwners[char] ??= []).push('hazard');
```

Widen `TileChar` (add to the union): `| '^' | 'v' | '<' | '>'`.

Update `parseLevel`'s char resolution (currently `if (ENTITY_CHARS[char] || SIGN_CHARS[char]) return 'empty';`) to also treat a hazard marker as empty terrain:

```ts
      if (ENTITY_CHARS[char] || SIGN_CHARS[char] || HAZARD_CHARS[char]) return 'empty';
```

Add the finder function, mirroring `findSignTiles` (after it):

```ts
/**
 * Finds every hazard marker's position in a level layout, in reading order,
 * paired with its hazard kind and facing (HAZARD_CHARS) — same
 * scan-for-any-key convention as findSignTiles, since a hazard marker's
 * identity is fully carried by its character, not zipped against a
 * CVData-derived list.
 */
export function findHazardTiles(
  layout: readonly string[],
): { col: number; row: number; hazardType: 'spike'; facing: HazardFacing }[] {
  const tiles: { col: number; row: number; hazardType: 'spike'; facing: HazardFacing }[] = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      const hazard = HAZARD_CHARS[layout[row][col]];
      if (hazard) tiles.push({ col, row, ...hazard });
    }
  }
  return tiles;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- LevelParser.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/LevelParser.ts src/themes/platformer/level/LevelParser.test.ts
git commit -m "feat(platformer): add hazard markers (^v<>) to LevelParser"
```

---

### Task 2: `HazardMapper.ts`

**Files:**
- Create: `src/themes/platformer/level/HazardMapper.ts`
- Create: `src/themes/platformer/level/HazardMapper.test.ts`

**Interfaces:**
- Consumes: `HazardFacing` (from `./LevelParser`), `tileToPixel`/`RENDERED_TILE_SIZE` (from `./Terrain`), `Box` (from `../engine/Collision`).
- Produces: `HazardPlacement { id: string; hazardType: 'spike'; facing: HazardFacing; x: number; y: number }`, `hazardBox(hazard): Box`, `placeHazards(markers): HazardPlacement[]`. Consumed by Task 4 (`Collision.ts`), Task 5 (`PlatformerState.ts`), Task 6 (`Renderer.ts`).

- [ ] **Step 1: Write the failing tests**

Create `HazardMapper.test.ts`:

```ts
import { hazardBox, placeHazards } from './HazardMapper';
import { RENDERED_TILE_SIZE } from './Terrain';

describe('placeHazards', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(placeHazards([])).toEqual([]);
  });

  it('oneMarker-placesItAtItsTilePixelPosition', () => {
    const placed = placeHazards([{ col: 2, row: 3, hazardType: 'spike', facing: 'up' }]);
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({
      hazardType: 'spike',
      facing: 'up',
      x: 2 * RENDERED_TILE_SIZE,
      y: 3 * RENDERED_TILE_SIZE,
    });
  });

  it('multipleMarkers-eachGetsADistinctId', () => {
    const placed = placeHazards([
      { col: 0, row: 0, hazardType: 'spike', facing: 'up' },
      { col: 1, row: 0, hazardType: 'spike', facing: 'down' },
    ]);
    expect(new Set(placed.map((h) => h.id)).size).toBe(2);
  });
});

describe('hazardBox', () => {
  it('anyFacing-returnsTheFullTileRect', () => {
    // Facing is cosmetic only — every facing's hitbox is the same full tile,
    // touching any part of it damages the player regardless of which face.
    const hazard = { id: 'h1', hazardType: 'spike' as const, facing: 'left' as const, x: 32, y: 48 };
    expect(hazardBox(hazard)).toEqual({ x: 32, y: 48, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- HazardMapper.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement `HazardMapper.ts`**

```ts
import { tileToPixel, RENDERED_TILE_SIZE } from './Terrain';
import type { Box } from '../engine/Collision';
import type { HazardFacing } from './LevelParser';

export interface HazardPlacement {
  id: string;
  hazardType: 'spike';
  facing: HazardFacing;
  x: number;
  y: number;
}

/**
 * A hazard's collision box — the full rendered tile, regardless of facing:
 * touching any part of a spike's tile damages the player, so facing only
 * ever selects which sprite Spike.ts draws (see its own doc comment), never
 * the hitbox shape. Same "one rendered tile, no per-instance variation
 * beyond a payload field" shape as SignMapper.ts's signBox.
 */
export function hazardBox(hazard: HazardPlacement): Box {
  return { x: hazard.x, y: hazard.y, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE };
}

/**
 * Places a `HazardPlacement` at every hand-authored hazard marker — same
 * direct marker-to-placement conversion as SignMapper.ts's placeSigns (a
 * marker's character already fully determines its hazardType/facing via
 * LevelParser.ts's HAZARD_CHARS, so there's no CVData-derived defs list to
 * zip against).
 */
export function placeHazards(
  markers: readonly { col: number; row: number; hazardType: 'spike'; facing: HazardFacing }[],
): HazardPlacement[] {
  return markers.map(({ col, row, hazardType, facing }) => {
    const { x, y } = tileToPixel(col, row);
    return { id: `hazard-${hazardType}-${col}-${row}`, hazardType, facing, x, y };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- HazardMapper.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/HazardMapper.ts src/themes/platformer/level/HazardMapper.test.ts
git commit -m "feat(platformer): add HazardMapper (placeHazards/hazardBox)"
```

---

### Task 3: `HazardType` interface + `Spike.ts` + `HAZARD_TYPES` registry

**Files:**
- Create: `src/themes/platformer/entities/hazards/HazardType.ts`
- Create: `src/themes/platformer/entities/hazards/Spike.ts`
- Create: `src/themes/platformer/entities/hazards/Spike.test.ts`
- Create: `src/themes/platformer/entities/hazards/index.ts`
- Create: `src/themes/platformer/entities/hazards/index.test.ts`

**Interfaces:**
- Consumes: `HazardPlacement` (Task 2), `STATIC_OBJECTS_SHEET` (`../sprites/sheets.ts`, already registered/loaded), `SIDE_HIT_DAMAGE` (`../Health`), `TILE_SIZE`/`RENDERED_TILE_SIZE` (`../../level/Terrain`), `DrawContext` (`../../engine/DrawContext`), `WorldType`/`Boxed` (`../WorldType`).
- Produces: `HazardType<S>` interface (`key`, `damage`, `box`, `draw`), `spike: HazardType<HazardPlacement>`, `HAZARD_TYPES = { spike }`, `HazardTypeKey = keyof typeof HAZARD_TYPES`, `typeOf(hazard): HazardType<...>`. Consumed by Task 4 (`Collision.ts` via `hazardBox`, already generic — this task's registry is consumed directly by Task 6/7's draw/damage lookups).

- [ ] **Step 1: Write the failing tests**

Create `Spike.test.ts`:

```ts
import { spike } from './Spike';
import { SIDE_HIT_DAMAGE } from '../Health';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';
import type { HazardPlacement } from '../../level/HazardMapper';

function hazardAt(facing: HazardPlacement['facing']): HazardPlacement {
  return { id: 'h1', hazardType: 'spike', facing, x: 16, y: 32 };
}

describe('spike', () => {
  it('key-isSpike', () => {
    expect(spike.key).toBe('spike');
  });

  it('damage-isOneHalfHeartSameAsAnyOtherHit', () => {
    expect(spike.damage).toBe(SIDE_HIT_DAMAGE);
  });

  it('box-isTheFullTileRegardlessOfFacing', () => {
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      expect(spike.box(hazardAt(facing))).toEqual({
        x: 16,
        y: 32,
        width: RENDERED_TILE_SIZE,
        height: RENDERED_TILE_SIZE,
      });
    }
  });
});

describe('spike facing sprite coordinates', () => {
  // Pins the 4 facings against the actual pre-drawn art in
  // staticObjects.png (columns 3-4, rows 6-7, 16px native tiles) confirmed
  // against the real asset before this plan was written — a regression here
  // would silently swap which facing shows which sprite.
  it.each([
    ['up', 48, 112],
    ['down', 64, 96],
    ['left', 64, 112],
    ['right', 48, 96],
  ] as const)('%s-mapsToTheConfirmedSpriteCoordinates', (facing, sx, sy) => {
    expect(spike.spriteCoords(facing)).toEqual({ sx, sy });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- Spike.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement `HazardType.ts`**

```ts
import type { WorldType, Boxed } from '../WorldType';

/**
 * Everything the engine needs to know about one hazard kind, owned entirely
 * by that kind's own module — same "one file + one registry line" promise
 * as `BlockType`/`EnemyType`, but WITHOUT anything from `Damageable`: a
 * hazard is never damaged, never dies, and never moves, so forcing those
 * fields on it the way `BlockType` would (hitPoints, revive, patrol) would
 * mean faking an entire interface a static hazard has no use for.
 */
export interface HazardType<S> extends WorldType<S>, Boxed<S> {
  /** Must equal this module's slot in HAZARD_TYPES. */
  key: string;
  /** Half-heart units a single touch costs — see Health.ts's SIDE_HIT_DAMAGE
   *  for the shared convention every other damage source already uses. */
  damage: number;
}
```

- [ ] **Step 4: Implement `Spike.ts`**

```ts
import type { HazardType } from './HazardType';
import type { HazardPlacement } from '../../level/HazardMapper';
import type { HazardFacing } from '../../level/LevelParser';
import { STATIC_OBJECTS_SHEET } from '../sprites/sheets';
import { TILE_SIZE, RENDERED_TILE_SIZE } from '../../level/Terrain';
import { SIDE_HIT_DAMAGE } from '../Health';

/**
 * Native tile coordinates (columns 3-4, rows 6-7 of staticObjects.png, 16px
 * tiles) of each facing's pre-drawn sprite — the artist already drew all 4
 * orientations, so no runtime rotation is needed. Confirmed against the
 * actual asset before this module was written:
 *   up    (floor spike, tip up):    column 3, row 7
 *   down  (ceiling spike, tip down): column 4, row 6
 *   right (mounted on a left wall):  column 3, row 6
 *   left  (mounted on a right wall): column 4, row 7
 */
const FACING_TILE: Record<HazardFacing, { col: number; row: number }> = {
  up: { col: 3, row: 7 },
  down: { col: 4, row: 6 },
  right: { col: 3, row: 6 },
  left: { col: 4, row: 7 },
};

function spriteCoords(facing: HazardFacing): { sx: number; sy: number } {
  const { col, row } = FACING_TILE[facing];
  return { sx: col * TILE_SIZE, sy: row * TILE_SIZE };
}

export const spike: HazardType<HazardPlacement> & { spriteCoords: typeof spriteCoords } = {
  key: 'spike',
  damage: SIDE_HIT_DAMAGE,
  spriteCoords,
  box: (hazard) => ({ x: hazard.x, y: hazard.y, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE }),
  draw: (hazard, dc) => {
    const image = dc.sprites[STATIC_OBJECTS_SHEET.src];
    if (!image) return;
    const { sx, sy } = spriteCoords(hazard.facing);
    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      sx,
      sy,
      TILE_SIZE,
      TILE_SIZE,
      hazard.x + dc.originX,
      hazard.y + dc.originY,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
  },
};
```

- [ ] **Step 5: Run `Spike.test.ts` to verify it passes**

Run: `npm test -- Spike.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing registry test**

Create `index.test.ts`:

```ts
import { HAZARD_TYPES, typeOf } from './index';
import type { HazardPlacement } from '../../level/HazardMapper';

describe('HAZARD_TYPES', () => {
  it('everyEntry-keyMatchesItsRegistrySlot', () => {
    for (const [slot, type] of Object.entries(HAZARD_TYPES)) {
      expect(type.key).toBe(slot);
    }
  });
});

describe('typeOf', () => {
  it('spikeHazard-returnsTheSpikeType', () => {
    const hazard: HazardPlacement = { id: 'h1', hazardType: 'spike', facing: 'up', x: 0, y: 0 };
    expect(typeOf(hazard).key).toBe('spike');
  });
});
```

- [ ] **Step 7: Run the registry test to verify it fails**

Run: `npm test -- entities/hazards/index.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 8: Implement `index.ts`**

```ts
import { spike } from './Spike';
import type { HazardType } from './HazardType';
import type { HazardPlacement } from '../../level/HazardMapper';

/** Every hazard kind in the game. Adding one is one line here plus its
 *  module — nothing else in the codebase changes. */
export const HAZARD_TYPES = { spike };

export type HazardTypeKey = keyof typeof HAZARD_TYPES;

/** The module owning `hazard` — same cast convention as entities/enemies/
 *  index.ts's typeOf, for the same reason (HAZARD_TYPES is heterogeneous
 *  once a second kind is added). Only one member exists today, so the cast
 *  is currently a no-op in practice, but the shape is here so a second
 *  hazard kind costs nothing beyond its own file plus a registry line. */
export function typeOf(hazard: HazardPlacement): HazardType<HazardPlacement> {
  return HAZARD_TYPES[hazard.hazardType as HazardTypeKey] as unknown as HazardType<HazardPlacement>;
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm test -- entities/hazards`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/themes/platformer/entities/hazards
git commit -m "feat(platformer): add spike hazard type + HAZARD_TYPES registry"
```

---

### Task 4: `checkHazardCollisions` in `Collision.ts`

**Files:**
- Modify: `src/themes/platformer/engine/Collision.ts`
- Modify: `src/themes/platformer/engine/Collision.test.ts`

**Interfaces:**
- Consumes: `HazardPlacement`/`hazardBox` (Task 2), `overlappingTriggers` (already in this file).
- Produces: `checkHazardCollisions(player, hazards): HazardPlacement[]` — returns the full placement (not just an id), since the damage-application call site (Task 7) needs the touched hazard's `hazardType` to look up its damage amount. Consumed by Task 7 (`PlatformerPage.tsx`).

- [ ] **Step 1: Write the failing tests**

In `Collision.test.ts`, add (mirroring the existing `checkSignOverlap` describe block — import `checkHazardCollisions` and `HazardPlacement` alongside the existing `SignPlacement` import):

```ts
describe('checkHazardCollisions', () => {
  const hazard: HazardPlacement = { id: 'h1', hazardType: 'spike', facing: 'up', x: 100, y: 100 };

  it('playerOverlappingHazard-returnsIt', () => {
    const player = makePlayer(100, 100);
    expect(checkHazardCollisions(player, [hazard])).toEqual([hazard]);
  });

  it('playerFarFromHazard-returnsEmpty', () => {
    const player = makePlayer(1000, 1000);
    expect(checkHazardCollisions(player, [hazard])).toEqual([]);
  });

  it('noHazardsInLevel-returnsEmpty', () => {
    const player = makePlayer(100, 100);
    expect(checkHazardCollisions(player, [])).toEqual([]);
  });

  it('touchingAnyFacing-stillReturnsIt', () => {
    // Facing is cosmetic only — hazardBox ignores it, so every facing must
    // damage on overlap exactly the same as 'up' does above.
    const player = makePlayer(100, 100);
    const leftFacing: HazardPlacement = { ...hazard, facing: 'left' };
    expect(checkHazardCollisions(player, [leftFacing])).toEqual([leftFacing]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- Collision.test.ts -t checkHazardCollisions`
Expected: FAIL — `checkHazardCollisions is not a function`.

- [ ] **Step 3: Implement in `Collision.ts`**

Add the import alongside the existing `SignPlacement`/`signBox` import:

```ts
import { hazardBox } from '../level/HazardMapper';
import type { HazardPlacement } from '../level/HazardMapper';
```

Add the function, after `checkSignOverlap` (before `checkKeyPickupCollisions`):

```ts
/**
 * Returns every hazard placement the player's hitbox currently overlaps.
 * Unlike checkSignOverlap (which returns only the first hint), every
 * touched hazard is returned — the caller (PlatformerPage.tsx) only ever
 * acts on the first one this tick (at most one hit registers per tick,
 * gated by the same invulnerability window every other damage source
 * uses), but needs the full placement (not just an id) to look up its
 * hazardType's own damage amount. Not destructive/dedup-tracked — a hazard
 * is reusable, like a sign, not consumed like a coin.
 */
export function checkHazardCollisions(
  player: PlayerState,
  hazards: readonly HazardPlacement[],
): HazardPlacement[] {
  return overlappingTriggers(player, hazards, hazardBox);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- Collision.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Collision.ts src/themes/platformer/engine/Collision.test.ts
git commit -m "feat(platformer): add checkHazardCollisions"
```

---

### Task 5: `HAZARD_TILES`/`hazardPlacements` in `level.ts`/`PlatformerState.ts`

**Files:**
- Modify: `src/themes/platformer/level/level.ts`
- Modify: `src/themes/platformer/PlatformerState.ts`
- Modify: `src/themes/platformer/PlatformerState.test.ts` (only if it asserts an exhaustive list of exported signals/computeds — check first with `grep -n "signPlacements" PlatformerState.test.ts`; if no such exhaustive assertion exists, this task has no test file changes of its own, matching how `SIGN_TILES`/`signPlacements` needed none beyond `LevelParser.test.ts`/`HazardMapper.test.ts`, already covered by Tasks 1-2).

**Interfaces:**
- Produces: `HAZARD_TILES: Signal<{col,row,hazardType,facing}[]>` (level.ts), `hazardPlacements: Signal<HazardPlacement[]>` (PlatformerState.ts). Consumed by Task 6 (`Renderer.ts`/`PlatformerPage.tsx` draw call) and Task 7 (`PlatformerPage.tsx` damage-application block).

- [ ] **Step 1: Check for an exhaustive-signal-list test**

Run: `grep -n "signPlacements\|SIGN_TILES" src/themes/platformer/PlatformerState.test.ts src/themes/platformer/level/level.test.ts 2>/dev/null`

If this returns nothing, proceed directly to Step 2 (no failing test to write first for this plumbing task — same as the precedent `SIGN_TILES`/`signPlacements` themselves, which added no dedicated test). If it DOES return a match, add `hazardPlacements`/`HAZARD_TILES` to whatever list that test asserts, following that test's own existing pattern, before proceeding.

- [ ] **Step 2: Add `HAZARD_TILES` in `level.ts`**

Add `findHazardTiles` to the existing import from `./LevelParser`:

```ts
import {
  parseLevel,
  findSpawnTile,
  findGreenEnemyTiles,
  findPurpleEnemyTiles,
  findCoinTiles,
  findCrateTiles,
  findQuestionMarkTiles,
  findFragileRockTiles,
  findCoinPotTiles,
  findChestTiles,
  findSignTiles,
  findHazardTiles,
} from './LevelParser';
```

Add after `SIGN_TILES`'s declaration:

```ts
/** Hand-placed spike-hazard positions, from `currentLayout`'s `^`/`v`/`<`/`>`
 *  markers (LevelParser.ts's HAZARD_CHARS) — purely positional/cosmetic-
 *  facing, no CVData binding, same convention as SIGN_TILES. */
export const HAZARD_TILES = computed(() => findHazardTiles(currentLayout.value));
```

- [ ] **Step 3: Add `hazardPlacements` in `PlatformerState.ts`**

Add the import alongside the existing `SIGN_TILES`/`placeSigns` imports:

```ts
import { placeHazards } from './level/HazardMapper';
import type { HazardPlacement } from './level/HazardMapper';
```

(Add `HAZARD_TILES` to the existing `import { ..., SIGN_TILES } from './level/level'`-style import block.)

Add after `signPlacements`'s declaration:

```ts
/**
 * Every spike hazard in the level, placed once at module load — same
 * non-reactive-to-CVData-but-reactive-to-`currentLayout` convention as
 * signPlacements above (a marker's character alone determines its
 * hazardType/facing, see HazardMapper.ts's placeHazards).
 */
export const hazardPlacements = computed<HazardPlacement[]>(() => placeHazards(HAZARD_TILES.value));
```

- [ ] **Step 4: Typecheck and run the full suite**

Run: `npx tsc --noEmit -p tsconfig.app.json` then `npm test`
Expected: PASS (this task only adds new exports; nothing existing reads them yet).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/level.ts src/themes/platformer/PlatformerState.ts
git commit -m "feat(platformer): plumb hazard placements through level.ts/PlatformerState.ts"
```

---

### Task 6: `drawHazards` in `Renderer.ts` + render call in `PlatformerPage.tsx`

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`
- Modify: `src/themes/platformer/PlatformerPage.tsx`

**Interfaces:**
- Consumes: `HAZARD_TYPES`/`typeOf` (Task 3), `hazardPlacements` (Task 5).
- Produces: `drawHazards(ctx, hazards, dc): void`. Consumed directly by `PlatformerPage.tsx`'s render pass (this task).

- [ ] **Step 1: Write the failing test**

In `Renderer.test.ts`, add (mirroring the existing `drawKeyPickups` test — check its exact assertion style first with `grep -n "describe('drawKeyPickups'" -A 15 Renderer.test.ts` and match it; the shape below is the minimum):

```ts
describe('drawHazards', () => {
  it('everyHazard-callsItsTypesDrawWithItself', () => {
    const dc = makeDrawContext(); // reuse this file's existing DrawContext test helper
    const drawSpy = vi.spyOn(spike, 'draw');
    const hazards: HazardPlacement[] = [{ id: 'h1', hazardType: 'spike', facing: 'up', x: 0, y: 0 }];

    drawHazards(dc.ctx, hazards, dc);

    expect(drawSpy).toHaveBeenCalledWith(hazards[0], dc);
  });
});
```

(Adjust the `makeDrawContext()` call to whatever this file's actual existing `DrawContext`-construction helper is named — inspect the top of `Renderer.test.ts` for it; every other `drawX` test in this file already builds one the same way.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- Renderer.test.ts -t drawHazards`
Expected: FAIL — `drawHazards is not a function`.

- [ ] **Step 3: Implement `drawHazards` in `Renderer.ts`**

Add the import alongside the existing `typeOf`/enemy imports:

```ts
import { typeOf as hazardTypeOf } from '../entities/hazards';
import type { HazardPlacement } from '../level/HazardMapper';
```

Add the function, after `drawKeyPickups` (same shape — no alive/collected filter, a hazard is never removed):

```ts
/** Draws every spike hazard. Knows nothing about any specific hazard kind —
 *  each one renders itself (see entities/hazards/). */
export function drawHazards(
  ctx: CanvasRenderingContext2D,
  hazards: readonly HazardPlacement[],
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const hazard of hazards) {
    hazardTypeOf(hazard).draw(hazard, dc);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- Renderer.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the render call in `PlatformerPage.tsx`**

Add `drawHazards` to the existing import from `./engine/Renderer`, and `hazardPlacements` to whatever existing import brings in `signPlacements`/`blockStates` from `./PlatformerState`.

Add the call right after the existing `drawBlocks(ctx, blockStates.value, drawContext);` line (a spike reads visually as a fixture on/near the terrain, like a block):

```ts
      drawBlocks(ctx, blockStates.value, drawContext);

      drawHazards(ctx, hazardPlacements.value, drawContext);

      drawChests(ctx, chestStates.value, drawContext);
```

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npx tsc --noEmit -p tsconfig.app.json` then `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts src/themes/platformer/PlatformerPage.tsx
git commit -m "feat(platformer): render spike hazards"
```

---

### Task 7: Damage application in `PlatformerPage.tsx`'s tick handler

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `checkHazardCollisions` (Task 4), `HAZARD_TYPES` (Task 3), `hazardPlacements` (Task 5), `takeDamage`/`applyKnockback`/`isInvulnerable`/`PLAYER_HIT_REACTION_SECONDS` (already imported in this file — see the existing enemy-damage block).
- Produces: nothing new exported — this is the terminal consumer.

- [ ] **Step 1: Write the failing test**

In `PlatformerPage.test.tsx`, find the existing test(s) covering the enemy-damage block (search `damagePlayer` / `takeDamage` in this file) to match its exact render/tick-driving harness, then add (adjust the harness calls — `renderGame()`/`advanceFrame()`/whatever this file's own helpers are named — to match that pattern exactly):

```ts
it('playerTouchingASpikeHazard-losesOneHalfHeartAndIsKnockedBack', () => {
  // Arrange a level whose layout places the player directly on a hazard tile.
  currentLayout.value = ['S^', 'GG'];
  const { rerenderTick } = renderGame(); // match this file's existing harness name/shape

  const before = playerState.value.hitPoints;
  rerenderTick(1 / 60);

  expect(playerState.value.hitPoints).toBe(before - 1);
});

it('playerAlreadyInvulnerable-touchingASpikeHazard-takesNoDamage', () => {
  currentLayout.value = ['S^', 'GG'];
  playerState.value = { ...playerState.value, hitTimer: 0 }; // mid-refractory window
  const { rerenderTick } = renderGame();

  const before = playerState.value.hitPoints;
  rerenderTick(1 / 60);

  expect(playerState.value.hitPoints).toBe(before);
});
```

(These two tests are a starting shape — before writing them for real, read this file's existing enemy-contact-damage test(s) in full and match its exact setup/render helpers; `PlatformerPage.test.tsx` is large enough that the precise harness API isn't restated here to avoid drifting from whatever it actually is by the time this task runs.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- PlatformerPage.test.tsx -t "spike"`
Expected: FAIL — hitPoints unchanged (no hazard damage logic exists yet).

- [ ] **Step 3: Implement in `PlatformerPage.tsx`**

Add the import alongside the existing `resolveEnemyContacts`/`checkSignOverlap` import from `./engine/Collision`:

```ts
  checkHazardCollisions,
```

Add the import for the registry:

```ts
import { HAZARD_TYPES } from './entities/hazards';
```

Add the block right after the existing enemy-damage block (after the closing brace of the `if (contacts.damagePlayer > 0 && !isInvulnerable(...))` block, i.e. right after the code shown in this plan's Design-research — the block ending `...bounceAscending: true };\n        }\n      }` for the `awayAndUp` branch):

```ts
      // Spike hazards: an entirely separate, independent damage source from
      // enemy contacts above. Sequencing after the enemy block (rather than
      // merging the two) is deliberate and safe: applyKnockback resets
      // hitTimer to 0, and isInvulnerable(player, PLAYER_HIT_REACTION_SECONDS)
      // treats hitTimer 0 as WITHIN the refractory window (0 < 1.2) — so if
      // an enemy contact already damaged the player this very tick, this
      // block's own isInvulnerable check reads that just-updated state and
      // correctly skips, giving "at most one hit per tick" for free with no
      // shared aggregation code.
      const touchedHazards = checkHazardCollisions(playerState.value, hazardPlacements.value);
      if (touchedHazards.length > 0 && !isInvulnerable(playerState.value, PLAYER_HIT_REACTION_SECONDS)) {
        const hazard = touchedHazards[0];
        const damage = HAZARD_TYPES[hazard.hazardType].damage;
        const hitPoints = takeDamage(playerState.value.hitPoints, damage);
        playerState.value = { ...playerState.value, hitPoints, alive: hitPoints > 0 };
        const playerCenterX = playerHitbox(playerState.value).x + playerHitbox(playerState.value).width / 2;
        const hazardCenterX = hazard.x + RENDERED_TILE_SIZE / 2;
        const knockbackDirection: -1 | 1 = playerCenterX <= hazardCenterX ? -1 : 1;
        playerState.value = applyKnockback(
          playerState.value,
          knockbackDirection,
          PHYSICS_CONFIG.sideHitKnockbackVx,
          PHYSICS_CONFIG.sideHitKnockbackDuration,
        );
      }
```

(Add `playerHitbox` to the existing import from `./engine/Collision` if not already imported in this file, and `RENDERED_TILE_SIZE` to the existing import from `./level/Terrain` if not already present — check both with `grep -n "playerHitbox\|RENDERED_TILE_SIZE" PlatformerPage.tsx` before adding, since one or both may already be imported for unrelated reasons.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- PlatformerPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json` then `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): damage the player on touching a spike hazard"
```

---

### Task 8: Level Editor palette entries

**Files:**
- Modify: `src/themes/platformer/editor/paletteTiles.ts`

**Interfaces:**
- Produces: `PALETTE_TILE_SPRITES`/`PALETTE_TILE_DESCRIPTIONS`/`PALETTE_TILE_LABELS` each gain 4 entries (`'^'`, `'v'`, `'<'`, `'>'`). No test file exists for this module beyond what `TileChar` exhaustiveness already forces at the TYPE level (`Record<TileChar, ...>` — a missing key is a compile error, not a runtime one).

- [ ] **Step 1: Verify the compile error exists (this task's own "failing test")**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: FAIL — `Property '^' is missing in type ... Record<TileChar, ...>` (three times, once per exhaustive `Record`), confirming `TileChar`'s Task-1 widening already forces this file to be updated.

- [ ] **Step 2: Add the 4 entries to `PALETTE_TILE_SPRITES`**

Add after the `'5'` entry (before the closing `};`), using the same confirmed coordinates as `Spike.ts`'s `FACING_TILE`:

```ts
  '^': {
    sheet: '/sprites/staticObjects.png',
    sheetWidth: 288,
    sheetHeight: 144,
    sx: 48,
    sy: 112,
    frameWidth: 16,
    frameHeight: 16,
  },
  v: {
    sheet: '/sprites/staticObjects.png',
    sheetWidth: 288,
    sheetHeight: 144,
    sx: 64,
    sy: 96,
    frameWidth: 16,
    frameHeight: 16,
  },
  '<': {
    sheet: '/sprites/staticObjects.png',
    sheetWidth: 288,
    sheetHeight: 144,
    sx: 64,
    sy: 112,
    frameWidth: 16,
    frameHeight: 16,
  },
  '>': {
    sheet: '/sprites/staticObjects.png',
    sheetWidth: 288,
    sheetHeight: 144,
    sx: 48,
    sy: 96,
    frameWidth: 16,
    frameHeight: 16,
  },
```

- [ ] **Step 3: Add the 4 entries to `PALETTE_TILE_DESCRIPTIONS`**

```ts
  '^': 'Spike (floor); damages the player on touch',
  v: 'Spike (ceiling); damages the player on touch',
  '<': 'Spike (right wall); damages the player on touch',
  '>': 'Spike (left wall); damages the player on touch',
```

- [ ] **Step 4: Add the 4 entries to `PALETTE_TILE_LABELS`**

```ts
  '^': 'Spike Up',
  v: 'Spike Down',
  '<': 'Spike Left',
  '>': 'Spike Right',
```

- [ ] **Step 5: Run typecheck and the full suite**

Run: `npx tsc --noEmit -p tsconfig.app.json` then `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/editor/paletteTiles.ts
git commit -m "feat(platformer): add spike hazard entries to the Level Editor palette"
```

---

### Task 9: Place real hazard markers in `LEVEL_1_LAYOUT` + roadmap update

**Files:**
- Modify: `src/themes/platformer/level/level.ts`
- Modify: `specs/S-006-platformer-theme/roadmap.md`

This task has no automated test of its own — it is manual-verification setup, matching how the coin-pot step (37) required real level placement to exercise the feature in the browser. `LEVEL_1_LAYOUT` is a hand-typed fixed asset; this task hand-edits a few of its rows.

- [ ] **Step 1: Add one hazard of each facing to `LEVEL_1_LAYOUT`**

Pick 4 currently-`.` (empty) cells in `LEVEL_1_LAYOUT` — one per facing — that read naturally in the existing zones (e.g. an up-facing spike on open BASE ground in Zone A, a down-facing one under a ceiling in a cave gallery, left/right-facing ones flanking a narrow corridor). Read the full current layout (`src/themes/platformer/level/level.ts`) and its Zone-by-zone doc comment before picking cells, to avoid overwriting an existing marker or blocking the only route through a zone.

Update the marker-table doc comment (the block currently listing `S 1 spawn`, `M 12 green slime`, etc.) to add a line for each facing, e.g.:

```
//   ^  1   spike (floor) — damages the player on touch, no stomp-defeat
//   v  1   spike (ceiling)
//   <  1   spike (right wall)
//   >  1   spike (left wall)
```

- [ ] **Step 2: Run the full suite and typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json` then `npm test`
Expected: PASS (placing valid markers in an already-valid layout changes nothing structurally).

- [ ] **Step 3: Manually verify in the browser**

Start the dev server, load the game, and confirm: each of the 4 placed spikes renders with the correct facing sprite, touching any one costs exactly 1 half-heart (a full heart segment goes from full to half), the player is knocked back away from it, and repeated contact during the invulnerability window does not cost a second hit.

- [ ] **Step 4: Check off roadmap step 40**

In `specs/S-006-platformer-theme/roadmap.md`, change:

```
- [ ] **40. Spike hazard tiles** — a hazard that damages the player (and presumably
```

to:

```
- [x] **40. Spike hazard tiles** — a hazard that damages the player (and presumably
```

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/level.ts specs/S-006-platformer-theme/roadmap.md
git commit -m "feat(platformer): place spike hazards in LEVEL_1_LAYOUT, check off roadmap step 40"
```
