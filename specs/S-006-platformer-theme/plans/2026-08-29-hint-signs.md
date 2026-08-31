# Hint Signs (Roadmap Step 26) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revised 2026-08-31** — this plan was originally written 2026-08-29 against a
> since-drifted codebase (before roadmap steps 20-23 reshaped `level.ts`; a
> `level1.ts` file it referenced never existed) and was rewritten from scratch,
> then iterated live with the user through several rounds of feedback into its
> current shape. Summary of what changed from the original draft, and why:
>
> - **Trigger is Up/`W`-press, not automatic overlap** — signs now work like
>   chests (spec.md FR-038 as originally written was auto-reveal-on-touch).
>   Since this step's whole point is teaching an obscure control, the trigger
>   itself can't assume the player already knows the interact convention — so
>   `ControlsOverlay.tsx` (Task 8) gains an "Interact" caption, positioned above
>   the sprite's Up key specifically, before this ships.
> - **Reveal is a comic speech bubble, not plain text** (Task 10's
>   `drawSignBubble`) — the user's explicit style pick from this session's
>   `hint-tooltip-styles` mockup artifact, once legibility (the original
>   objection to a bubble) stopped being a concern for a reader-triggered,
>   momentary reveal.
> - **Animation is a vertical grow, not a slide** (Task 5's
>   `engine/HintTooltip.ts`) — "shown from bottom to top like the sign is
>   starting to talk," anchored at the bubble's fixed tail tip; an earlier
>   facing-derived left/right slide was discarded once the trigger stopped
>   being automatic-on-approach.
> - **Level Editor support added** (Tasks 6-7) — a required fix
>   (`paletteTiles.ts`'s `Record<TileChar, ...>` maps must cover the new `'1'`
>   or the build breaks) plus, per explicit request, one "Sign" palette tool
>   that cycles to the next unused hint on repeat click and shows a dev-only
>   digit badge — authoring tooling only, doesn't change in-game behavior.

**Goal:** A new non-solid, non-collectible level entity — a signpost — sits at a
hand-authored position in the level. While the character stands near it and presses
Up (or `W`) — the same "interact" convention chests already use — a speech-bubble
tooltip with localized hint text appears near the character; it disappears when they
walk away. Signs are reusable (never consumed, re-revealable any number of times),
carry no CV mapping, and never touch `collectedFacts`/the journal. `ControlsOverlay.tsx`
(the one-time onboarding overlay) gains an "Interact" caption so a brand-new player
already knows what Up does before ever meeting a sign. The first sign (marker `1`)
sits near `level.ts`'s `LEVEL_1_LAYOUT`'s first one-way bridge (the ground-level pit
bridge at cols 2-4, right after spawn), teaching the Down/`S` drop-through control.

**Architecture:** Follows the exact `Def`/`Placement`/`*Mapper.ts` split every other
level entity already uses (`ChestDef`/`ChestPlacement`/`ChestMapper.ts`,
`BlockDef`/`BlockPlacement`/`BlockMapper.ts`) rather than inventing a new shape. Each
distinct hint gets its own single-digit marker character (`1`-`9`), mapped directly to
a `hintId` in a new `SIGN_CHARS` table (`LevelParser.ts`) — unlike coins/enemies,
there's no CVData-order "zip": the marker character itself carries the hint's
identity, so editing the level layout can never scramble which sign shows which text.
A new `hintId`-typed field is derived from the i18n JSON itself
(`keyof Translation['platformer']['hints']`) so every hintId reference — the level
marker table, `SignDef`, the collision check, the active-hint signal — is statically
checked against the real translation keys, with no runtime cast anywhere.

`level.ts` gains a `SIGN_TILES` computed signal (mirroring `CHEST_TILES` etc.) so hint
signs re-derive correctly if the Level Editor's Try button ever swaps `currentLayout`.
A new, minimal `level/SignMapper.ts` converts raw markers into `SignPlacement[]` — no
CVData involved at all, so there's no "def" stage to zip against a CVData-derived
list (unlike every other Mapper). `PlatformerState.ts` gets a `signPlacements`
computed (same non-reactive-to-CVData-but-reactive-to-layout pattern as
`chestPlacements`) and a new `checkSignOverlap` in `Collision.ts` (reusing the
existing `playerHitbox`/`aabbOverlap` helpers, same convention as
`chestPlayerIsStandingOn`) reports which sign (if any) the player currently overlaps —
this alone does NOT show anything; `PlatformerPage.tsx` (Task 11) only reveals the
tooltip once that overlap is combined with an Up/`W` press, same
`input.consumePress` edge-trigger already used for `chestPlayerIsStandingOn` +
Arrow Up.

`ControlsOverlay.tsx` (Task 8) needs to teach "Up = interact" BEFORE a sign can rely
on the player already knowing it — the whole point of the first sign is to teach an
obscure control (Down/drop-through) to someone who hasn't found it on their own, so
the sign's own trigger can't itself assume prior knowledge. A new "Interact" caption
is added to that existing overlay, positioned above the key sprite (unlike its three
existing captions, all below it) and horizontally centered on the sprite's Up key
specifically — reusing `MOVE_LABEL_CENTER_PERCENT` for that x-position, since the
sprite's inverted-T key layout already centers Up on the same horizontal midpoint as
the whole arrow cluster "Move" is captioned under.

Once revealed, the tooltip isn't a plain show/hide — per live user feedback, it
should animate in/out "like the sign is starting to talk," so it reads as a bubble
being spoken rather than popping. A new, small `engine/HintTooltip.ts` module
(Task 5) is a tick-based phase/elapsed state machine (`'entering' | 'shown' |
'exiting'`), the same shape `engine/CollectionEffects.ts`'s `FlightEffect` already
uses for the fact-flight text animation. Unlike `ControlsOverlay.tsx`'s own
horizontal fade+slide (a fixed left-to-right convention that works there because
it only ever appears once, at game start, before any real movement — and doesn't
apply here since a sign is no longer auto-triggered by approach direction at all),
this animation is a vertical GROW: 'entering' scales the bubble's height from 0 up
to full over `HINT_TOOLTIP_FADE_IN_SECONDS`, anchored at its tail's fixed tip (right
above the character) so the box visibly rises upward out of that point, like it's
being spoken; 'exiting' reverses this, shrinking back down to nothing at the same
anchor over `HINT_TOOLTIP_FADE_OUT_SECONDS`. `PlatformerState.ts`'s
`hintTooltipState` signal (replacing a plain `activeSignHintId`) holds this
machine's current state, updated every game-loop tick — but now only STARTED by an
Up/`W` press while overlapping, not by overlap alone; leaving overlap still begins
the exit shrink regardless of whether the bubble was ever revealed at all in that
visit.

Both the static signpost sprite and the tooltip are drawn directly on the canvas in
`PlatformerPage.tsx`'s existing `render()` function (matching how collection-effect
text and the restart prompt are already drawn there) rather than as a DOM overlay —
the tooltip must track the character's screen position, which the canvas render loop
already computes every frame (`originX`/`originY`), while a DOM element would need its
own separate position-tracking effect (see `ControlsOverlay.tsx`'s much more involved
DOM-based approach, needed there only because that overlay is fixed-viewport, not
character-tracking). Per the user's explicit style preference (option 3 of this
session's `hint-tooltip-styles` mockup artifact — legibility was the earlier
objection to a light bubble, no longer a concern once the reveal is
reader-triggered rather than constantly overlaid while walking past), the revealed
hint is a comic-style speech bubble: a cream box with a dark border and a small
tail pointing at the character, drawn via `drawSignBubble` (`Renderer.ts`, Task 10)
using only `fillRect`/path-fill primitives (a bigger dark rect/triangle behind a
smaller inset cream one, in place of `ctx.strokeRect`/`ctx.stroke`, so no new
canvas primitives need mocking beyond what a couple of existing tests already use).
The box's and tail's height (not their width — the bubble reveals at its full
width immediately, only its height grows) scale by `HintTooltip.ts`'s current
`growth` (0-1), and its overall opacity comes from that same module's `opacity`
(drawn via `ctx.globalAlpha`, the same mechanism `drawBlocks`'s crate-shatter fade
already uses) — both keep the box's BOTTOM edge (where the tail meets it) fixed in
place and only move the TOP edge, which is what makes it read as rising rather
than just scaling in place. Hint text is resolved from the existing i18n system
(`platformer.hints.<hintId>`, via `currentUI.value`), read once per frame inside
`render()` — the same pattern the game loop already uses for fact labels — so it
updates for free when the locale changes.

**Tech Stack:** Vite + React 19 + TypeScript strict + `@preact/signals-react` +
Vitest/RTL (matches the rest of the platformer theme).

**Spec:** `specs/S-006-platformer-theme/spec.md` (FR-037-FR-040, User Story 9) and
`specs/S-006-platformer-theme/roadmap.md` (step 26).

## Global Constraints

- Typed data architecture: no `any` types; TypeScript strict mode stays clean.
- TDD: every new pure function/component gets a failing test first, per the constitution.
- Named arrow/function exports only, no default exports.
- No new dependencies, no backend/API calls, no new image asset — signs use the
  existing `world_tileset.png` (already loaded for terrain, via `tilesetRef`).
- Sign marker characters are single digits `1`-`9`, each mapped directly to one
  `hintId` — capped at 9 distinct hints total (accepted constraint, FR-037). This is
  deliberately NOT the CVData-order "zip" convention `C`/`X`/`Q`/`F`/`E`/`M`/`T`
  markers use.
- Signs are non-solid (no terrain collision) and non-collectible: touching one never
  writes to `collectedFacts` or `collectedCollectibleIds`, and is not
  dedup-tracked — the tooltip can be revealed again every time the character
  re-overlaps the sign and presses Up/`W` again.
- The tooltip is revealed by pressing Up/`W` while overlapping the sign (same
  `input.consumePress` convention as chest-opening) — NOT automatically on mere
  overlap. It hides automatically as soon as the player leaves overlap, with no
  keypress needed to dismiss it.
- The tooltip must not pause the game and must not block movement.
- `ControlsOverlay.tsx` must teach "Up = interact" (a new caption) before this
  step ships, since a sign that teaches an obscure control can't itself depend
  on the player already knowing the interact convention.
- Hint text comes from `src/i18n/locales/en.json`/`de.json` under
  `platformer.hints.<hintId>` — NOT a bespoke dictionary file.
- Signpost tile: `world_tileset.png` at pixel `(128, 48)` (tile col 8, row 3), 16x16
  — sits immediately right of the crate tile (col 7, row 3, already used by roadmap
  step 21).

---

## Task 1: `SIGN_CHARS` + `findSignTiles` in `LevelParser.ts`, `HintId`/`SignDef` in `types.ts`

**Files:**
- Modify: `src/themes/platformer/types.ts`
- Modify: `src/themes/platformer/level/LevelParser.ts`
- Test: `src/themes/platformer/level/LevelParser.test.ts`

**Interfaces:**
- Consumes: `Translation` (`@/i18n/translations`, existing).
- Produces: `HintId` type, `SignDef` interface (`types.ts`); `SIGN_CHARS: Record<string, HintId | undefined>`,
  `findSignTiles(layout: readonly string[]): { col: number; row: number; hintId: HintId }[]`
  (`LevelParser.ts`) — all consumed by Task 2's `SignMapper.ts`.

- [ ] **Step 1: Add `HintId` and `SignDef` to `types.ts`**

In `src/themes/platformer/types.ts`, add near the top (after the existing imports) and
after `EnemyDef`:

```ts
import type { Translation } from '@/i18n/translations';
```

```ts
/**
 * Every hint id a hand-authored sign can show — derived directly from the
 * i18n JSON's own keys (`platformer.hints.<hintId>` in en.json/de.json) so a
 * typo or a stale hintId reference fails to compile instead of silently
 * resolving to `undefined` at runtime.
 */
export type HintId = keyof Translation['platformer']['hints'];

/**
 * A hand-authored hint sign (roadmap step 26, FR-037). Unlike CollectibleDef/
 * EnemyDef/BlockDef/ChestDef, a sign carries no CV mapping at all — no
 * `fact`, no `cvSection`/`cvIndex` — its only content is `hintId`, which
 * `SignMapper.ts`'s `placeSigns` turns into a `SignPlacement` (adds x/y),
 * mirroring every other Def/Placement pair in this codebase.
 */
export interface SignDef {
  id: string;
  hintId: HintId;
}
```

- [ ] **Step 2: Write the failing tests**

Add to `src/themes/platformer/level/LevelParser.test.ts`. Add `SIGN_CHARS,
findSignTiles` to the existing import from `./LevelParser`:

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

  it('multipleMarkersOfTheSameHint-returnsAllInReadingOrder', () => {
    // Only '1' is registered today — placing it twice is still valid (a
    // hint can be shown at more than one spot in the level).
    expect(findSignTiles(['1.', '.1'])).toEqual([
      { col: 0, row: 0, hintId: 'bridgeDropThrough' },
      { col: 1, row: 1, hintId: 'bridgeDropThrough' },
    ]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- LevelParser.test.ts`
Expected: FAIL — `SIGN_CHARS`/`findSignTiles` are not exported yet.

- [ ] **Step 4: Implement**

In `src/themes/platformer/level/LevelParser.ts`:

1. Add the import (alongside the existing `LevelDef`/`TileMap`/`TileType` import):

```ts
import type { HintId } from '../types';
```

2. Add, after the existing `ENTITY_CHARS` block and before the current
   `sharedChars` guard:

```ts
/**
 * Maps each sign-marker character to the hint it shows. Unlike ENTITY_CHARS
 * (coins/enemies/blocks/chests, whose specific CV fact comes from zipping
 * marker discovery order against CVData), a sign's content is hand-authored,
 * not derived from CVData — so the character itself carries the hint's
 * identity directly. This means the level layout can be freely edited
 * (rows/columns added, removed, reordered) without ever scrambling which
 * sign shows which text — a zip-by-discovery-order approach couldn't
 * guarantee that. Capped at digits 1-9 (an accepted constraint, FR-037):
 * this level is expected to need only a handful of distinct hints ever.
 */
export const SIGN_CHARS: Record<string, HintId | undefined> = {
  '1': 'bridgeDropThrough',
};
```

3. Replace the existing `sharedChars` guard block with a version that also
   covers `SIGN_CHARS` (three maps instead of two):

```ts
// A character can only mean one thing — guard against TERRAIN_CHARS,
// ENTITY_CHARS, and SIGN_CHARS accidentally sharing a key, which three
// independent maps don't prevent on their own the way one unified table
// would.
const charOwners: Record<string, string[]> = {};
for (const char of Object.keys(TERRAIN_CHARS)) (charOwners[char] ??= []).push('terrain');
for (const char of Object.keys(ENTITY_CHARS)) (charOwners[char] ??= []).push('entity');
for (const char of Object.keys(SIGN_CHARS)) (charOwners[char] ??= []).push('sign');
const sharedChars = Object.entries(charOwners)
  .filter(([, owners]) => owners.length > 1)
  .map(([char]) => char);
if (sharedChars.length > 0) {
  throw new Error(
    `Level character(s) defined as more than one of terrain/entity/sign: ${sharedChars.join(', ')}`,
  );
}
```

4. In `parseLevel`, add a branch for sign markers (same treatment as entity
   markers — resolves to `empty` terrain). The existing code reads:

```ts
    const chars = row.split('').map((char) => {
      const tile = TERRAIN_CHARS[char];
      if (tile) return tile;
      if (ENTITY_CHARS[char]) return 'empty';
      throw new Error(`Unknown level tile character: "${char}"`);
    });
```

   Change the middle line to also check `SIGN_CHARS`:

```ts
      if (ENTITY_CHARS[char] || SIGN_CHARS[char]) return 'empty';
```

5. Add the `'1'` literal to the `TileChar` union (keep every other line
   unchanged):

```ts
export type TileChar =
  | '.'
  | 'G'
  | 'R'
  | 'P'
  | 'W'
  | 'B'
  | 'L'
  | 'S'
  | 'E'
  | 'M'
  | 'C'
  | 'X'
  | 'Q'
  | 'F'
  | 'T'
  | '1';
```

6. Add, after `findChestTiles` at the end of the file:

```ts
/**
 * Finds every sign marker's position in a level layout, in reading order,
 * paired with the hint it shows (SIGN_CHARS). Unlike findCoinTiles/
 * findChestTiles/findGreenEnemyTiles/etc. (which all look for one specific
 * EntityKind), this scans for ANY key of SIGN_CHARS at once and returns the
 * resolved hintId directly — there's no separate CVData-derived list to zip
 * these positions against.
 */
export function findSignTiles(
  layout: readonly string[],
): { col: number; row: number; hintId: HintId }[] {
  const tiles: { col: number; row: number; hintId: HintId }[] = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      const hintId = SIGN_CHARS[layout[row][col]];
      if (hintId) tiles.push({ col, row, hintId });
    }
  }
  return tiles;
}
```

- [ ] **Step 5: Add `'1'` to the existing `TileChar` completeness test**

In `src/themes/platformer/level/LevelParser.test.ts`, find the `describe('TileChar', ...)`
block near the end of the file and update its `tileChars` array and key list to also
cover `SIGN_CHARS`:

```ts
describe('TileChar', () => {
  it('includes every TERRAIN_CHARS, ENTITY_CHARS, and SIGN_CHARS key', () => {
    const tileChars: readonly TileChar[] = [
      '.', 'G', 'R', 'P', 'W', 'B', 'L', 'S', 'E', 'M', 'C', 'X', 'Q', 'F', 'T', '1',
    ];
    const allKeys = [...Object.keys(TERRAIN_CHARS), ...Object.keys(ENTITY_CHARS), ...Object.keys(SIGN_CHARS)];
    for (const key of allKeys) {
      expect(tileChars).toContain(key);
    }
  });
});
```

(Add `SIGN_CHARS` to that file's top import from `./LevelParser` too.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- LevelParser.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/types.ts src/themes/platformer/level/LevelParser.ts src/themes/platformer/level/LevelParser.test.ts
git commit -m "feat(platformer): add HintId/SignDef types and sign markers to LevelParser"
```

---

## Task 2: `level/SignMapper.ts`

**Files:**
- Create: `src/themes/platformer/level/SignMapper.ts`
- Test: `src/themes/platformer/level/SignMapper.test.ts`

**Interfaces:**
- Consumes: `tileToPixel` (`./Terrain`, existing); `SignDef`, `HintId` (`../types`, Task 1).
- Produces: `SignPlacement` interface, `placeSigns(markers: readonly { col: number; row: number; hintId: HintId }[]): SignPlacement[]`
  — consumed by Task 3's `level.ts`/`PlatformerState.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/level/SignMapper.test.ts`:

```ts
import { placeSigns } from './SignMapper';
import { tileToPixel } from './Terrain';

describe('placeSigns', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(placeSigns([])).toEqual([]);
  });

  it('oneMarker-returnsSignPlacementAtItsPixelPosition', () => {
    const result = placeSigns([{ col: 1, row: 1, hintId: 'bridgeDropThrough' }]);
    const { x, y } = tileToPixel(1, 1);
    expect(result).toEqual([{ id: 'sign-bridgeDropThrough-1-1', hintId: 'bridgeDropThrough', x, y }]);
  });

  it('twoMarkersOfTheSameHint-getDistinctIds', () => {
    const result = placeSigns([
      { col: 0, row: 0, hintId: 'bridgeDropThrough' },
      { col: 1, row: 1, hintId: 'bridgeDropThrough' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].id).not.toBe(result[1].id);
    expect(result.every((s) => s.hintId === 'bridgeDropThrough')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SignMapper.test.ts`
Expected: FAIL — `./SignMapper` does not exist yet.

- [ ] **Step 3: Implement**

Create `src/themes/platformer/level/SignMapper.ts`:

```ts
import { tileToPixel } from './Terrain';
import type { SignDef, HintId } from '../types';

export interface SignPlacement extends SignDef {
  x: number;
  y: number;
}

/**
 * Places a `SignPlacement` at every hand-authored sign marker — unlike
 * placeCollectibles/placeEnemies/placeBlocks/placeChests, there's no
 * CVData-derived "def" to zip against a marker queue: a sign marker's
 * character already fully determines its hintId (LevelParser.ts's
 * SIGN_CHARS), so this is a direct marker-to-placement conversion, same
 * shape as the other *Mapper.ts files' own placeX function but with no
 * `defs` parameter. The id includes col/row so two signs showing the same
 * hint at different spots in the level get distinct ids.
 */
export function placeSigns(
  markers: readonly { col: number; row: number; hintId: HintId }[],
): SignPlacement[] {
  return markers.map(({ col, row, hintId }) => {
    const { x, y } = tileToPixel(col, row);
    return { id: `sign-${hintId}-${col}-${row}`, hintId, x, y };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- SignMapper.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/SignMapper.ts src/themes/platformer/level/SignMapper.test.ts
git commit -m "feat(platformer): add SignMapper's placeSigns"
```

---

## Task 3: `SIGN_TILES` in `level.ts` + place a sign marker in `LEVEL_1_LAYOUT`

**Files:**
- Modify: `src/themes/platformer/level/level.ts`
- Test: `src/themes/platformer/level/level.test.ts`

**Interfaces:**
- Consumes: `findSignTiles` (`./LevelParser`, Task 1).
- Produces: `SIGN_TILES: Signal<{ col: number; row: number; hintId: HintId }[]>`
  — consumed by Task 4's `PlatformerState.ts`.

- [ ] **Step 1: Write the failing tests**

In `src/themes/platformer/level/level.test.ts`, add `SIGN_TILES` to the existing
import from `./level`, then add a new describe block (near the existing
`describe('CHEST_TILES', ...)` block):

```ts
describe('SIGN_TILES', () => {
  it('level1Layout-hasExactlyOneBridgeDropThroughSign', () => {
    expect(SIGN_TILES.value).toHaveLength(1);
    expect(SIGN_TILES.value[0].hintId).toBe('bridgeDropThrough');
  });

  it('signMarker-sitsDirectlyAboveTheFirstBridgeNearSpawn', () => {
    const [sign] = SIGN_TILES.value;
    expect(currentLevel.value.terrain[sign.row][sign.col]).toBe('empty');
    expect(currentLevel.value.terrain[sign.row + 1][sign.col]).toBe('bridge');
  });
});
```

Then, in the existing `describe('currentLayout reactivity', ...)` block's
`'changingCurrentLayout-recomputesLevel1AndEveryMarkerTileSignal'` test, add one more
assertion alongside the other `*_TILES` checks:

```ts
    expect(SIGN_TILES.value).toEqual([]);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- level.test.ts`
Expected: FAIL — `SIGN_TILES` is not exported yet, and no `'1'` marker exists in
`LEVEL_1_LAYOUT` yet.

- [ ] **Step 3: Implement**

In `src/themes/platformer/level/level.ts`:

1. Add `findSignTiles` to the existing import from `./LevelParser`.

2. In `LEVEL_1_LAYOUT`, find the entity-marker row (currently, 6 lines into the
   array — the row starting `'.S....T...C.T.....C.......W.E..'`):

```ts
  '.S....T...C.T.....C.......W.E..W....W.M....C.C..................................',
```

   Change the character at index 3 (currently `'.'`, two tiles right of the `S`
   spawn marker at index 1) to `'1'`. This sits directly above the ground-level pit
   bridge (`'B'` at cols 2-4 in the very next row) — the level's first one-way
   bridge, right after spawn — a natural spot to explain the Down/`S` drop-through
   before the player even needs to use it elsewhere. The resulting row is:

```ts
  '.S.1..T...C.T.....C.......W.E..W....W.M....C.C..................................',
```

   (Only the character at index 3 changes; every other row, and every other
   character in this row, is unchanged.)

3. Add, after `CHEST_TILES`'s export at the end of the file:

```ts
/** Hand-placed hint-sign positions, from `currentLayout`'s digit markers
 *  (`1`-`9`, see LevelParser.ts's SIGN_CHARS). Only one marker (`1`,
 *  bridgeDropThrough) exists today — placed right above `currentLayout`'s
 *  first ground-level pit bridge (spec.md FR-040). */
export const SIGN_TILES = computed(() => findSignTiles(currentLayout.value));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- level.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full LevelParser/level suite to check for regressions**

Run: `npm test -- level.test.ts LevelParser.test.ts`
Expected: PASS — confirms the row-index-3 character change didn't break any existing
spawn/enemy/coin/chest position assertions (none of them reference index 3 in that
row, which was previously `.`/empty).

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/level/level.ts src/themes/platformer/level/level.test.ts
git commit -m "feat(platformer): place a bridge hint sign in level1 and add SIGN_TILES"
```

---

## Task 4: `signPlacements` in `PlatformerState.ts`, `checkSignOverlap` in `Collision.ts`

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`
- Modify: `src/themes/platformer/engine/Collision.ts`
- Test: `src/themes/platformer/PlatformerState.test.ts`
- Test: `src/themes/platformer/engine/Collision.test.ts`

**Interfaces:**
- Consumes: `placeSigns` (`./level/SignMapper`, Task 2), `SIGN_TILES` (`./level/level`,
  Task 3); `playerHitbox`, `aabbOverlap`, `Box` (existing, same file), `RENDERED_TILE_SIZE`
  (`../level/Terrain`), `SignPlacement` (`../level/SignMapper`), `HintId` (`../types`).
- Produces: `signPlacements: Signal<SignPlacement[]>` (`PlatformerState.ts`);
  `checkSignOverlap(player: PlayerState, signs: readonly SignPlacement[]): HintId | undefined`
  (`Collision.ts`) — both consumed by Task 5's `hintTooltipState` transition logic and
  Task 8's `PlatformerPage.tsx`.

- [ ] **Step 1: Write the failing `Collision.ts` tests**

The file already has a local `makePlayer(x, y): PlayerState` helper (used by the
existing `checkCollectibleCollisions`/`checkEnemyStompCollisions` tests) — reuse it.
Add `checkSignOverlap` to the import from `./Collision` and `SignPlacement` from
`../level/SignMapper` in `Collision.test.ts`:

```ts
import type { SignPlacement } from '../level/SignMapper';

describe('checkSignOverlap', () => {
  const sign: SignPlacement = { id: 'sign-bridgeDropThrough-1-1', hintId: 'bridgeDropThrough', x: 100, y: 100 };

  it('playerOverlappingSign-returnsItsHintId', () => {
    const player = makePlayer(100, 100);

    expect(checkSignOverlap(player, [sign])).toBe('bridgeDropThrough');
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

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- Collision.test.ts`
Expected: FAIL — `checkSignOverlap` is not exported yet.

- [ ] **Step 3: Implement `checkSignOverlap`**

In `src/themes/platformer/engine/Collision.ts`, add to the existing imports:

```ts
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { SignPlacement } from '../level/SignMapper';
import type { HintId } from '../types';
```

Then add at the end of the file:

```ts
/**
 * Returns the `hintId` of the first sign the player's hitbox currently
 * overlaps, or `undefined` if none. Unlike checkCollectibleCollisions, this
 * is NOT destructive/dedup-tracked — a sign is reusable, so the same sign
 * returns its hintId every tick the player stands on it, and again the next
 * time they walk back onto it. A sign's box is exactly one rendered tile
 * (RENDERED_TILE_SIZE square), matching how it's drawn (Renderer.ts).
 */
export function checkSignOverlap(
  player: PlayerState,
  signs: readonly SignPlacement[],
): HintId | undefined {
  const hitbox = playerHitbox(player);
  for (const sign of signs) {
    const box: Box = { x: sign.x, y: sign.y, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE };
    if (aabbOverlap(hitbox, box)) return sign.hintId;
  }
  return undefined;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- Collision.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing `PlatformerState.ts` test**

Add `signPlacements` to the existing import from `./PlatformerState` in
`PlatformerState.test.ts`, then add:

```ts
describe('signPlacements', () => {
  it('level1-hasExactlyOneSignPlacement', () => {
    expect(signPlacements.value).toHaveLength(1);
    expect(signPlacements.value[0].hintId).toBe('bridgeDropThrough');
  });
});
```

Also add one more assertion to the existing
`'changingCurrentLayoutToALayoutWithNoMarkers-recomputesEveryPlacementSignalToEmpty'`
test in the `describe('marker-derived placements react to currentLayout', ...)`
block:

```ts
    expect(signPlacements.value).toEqual([]);
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- PlatformerState.test.ts`
Expected: FAIL — `signPlacements` is not exported yet.

- [ ] **Step 7: Implement**

In `src/themes/platformer/PlatformerState.ts`:

1. Add `SIGN_TILES` to the existing import from `./level/level`.
2. Add:

```ts
import { placeSigns } from './level/SignMapper';
import type { SignPlacement } from './level/SignMapper';
```

3. Add, near `chestPlacements`:

```ts
/**
 * Every hint sign in the level, placed once at module load — same
 * non-reactive-to-CVData-but-reactive-to-`currentLayout` convention as
 * chestPlacements/blockPlacements above (roadmap step 26). Unlike those,
 * there's no CVData to zip against: a marker's character alone determines
 * its hintId (see SignMapper.ts's placeSigns).
 */
export const signPlacements = computed<SignPlacement[]>(() => placeSigns(SIGN_TILES.value));
```

(The player-overlap-driven `hintTooltipState` signal that reads `signPlacements`
every tick is added separately in Task 5, alongside the animation machinery it
depends on.)

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- PlatformerState.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/engine/Collision.ts src/themes/platformer/PlatformerState.test.ts src/themes/platformer/engine/Collision.test.ts
git commit -m "feat(platformer): add signPlacements state and checkSignOverlap"
```

---

## Task 5: `engine/HintTooltip.ts` animation state + `hintTooltipState` in `PlatformerState.ts`

**Files:**
- Create: `src/themes/platformer/engine/HintTooltip.ts`
- Modify: `src/themes/platformer/PlatformerState.ts`
- Test: `src/themes/platformer/engine/HintTooltip.test.ts`
- Test: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Consumes: `HintId` (`../types`, Task 1).
- Produces: `HintTooltipState`, `startHintTooltip`, `beginHintTooltipExit`,
  `tickHintTooltip`, `hintTooltipGrowthAndOpacity` (`HintTooltip.ts`);
  `hintTooltipState: Signal<HintTooltipState | null>` (`PlatformerState.ts`) — all
  consumed by Task 11's `PlatformerPage.tsx`.

- [ ] **Step 1: Write the failing `HintTooltip.ts` tests**

Create `src/themes/platformer/engine/HintTooltip.test.ts`:

```ts
import {
  startHintTooltip,
  beginHintTooltipExit,
  tickHintTooltip,
  hintTooltipGrowthAndOpacity,
  HINT_TOOLTIP_FADE_IN_SECONDS,
  HINT_TOOLTIP_FADE_OUT_SECONDS,
} from './HintTooltip';

describe('startHintTooltip', () => {
  it('createsAnEnteringStateAtZeroElapsed', () => {
    expect(startHintTooltip('bridgeDropThrough')).toEqual({
      hintId: 'bridgeDropThrough',
      phase: 'entering',
      elapsed: 0,
    });
  });
});

describe('tickHintTooltip', () => {
  it('entering-beforeFadeInCompletes-staysEnteringAndAdvancesElapsed', () => {
    const state = startHintTooltip('bridgeDropThrough');

    const ticked = tickHintTooltip(state, HINT_TOOLTIP_FADE_IN_SECONDS / 2);

    expect(ticked).toEqual({ ...state, elapsed: HINT_TOOLTIP_FADE_IN_SECONDS / 2 });
  });

  it('entering-onceFadeInCompletes-becomesShownAndResetsElapsed', () => {
    const state = startHintTooltip('bridgeDropThrough');

    const ticked = tickHintTooltip(state, HINT_TOOLTIP_FADE_IN_SECONDS);

    expect(ticked).toEqual({ ...state, phase: 'shown', elapsed: 0 });
  });

  it('shown-ticking-staysShownIndefinitely', () => {
    const state = { hintId: 'bridgeDropThrough' as const, phase: 'shown' as const, elapsed: 0 };

    const ticked = tickHintTooltip(state, 5);

    expect(ticked).toEqual({ ...state, elapsed: 5 });
  });

  it('exiting-beforeFadeOutCompletes-staysExitingAndAdvancesElapsed', () => {
    const state = beginHintTooltipExit({ hintId: 'bridgeDropThrough', phase: 'shown', elapsed: 0 });

    const ticked = tickHintTooltip(state, HINT_TOOLTIP_FADE_OUT_SECONDS / 2);

    expect(ticked).toEqual({ ...state, elapsed: HINT_TOOLTIP_FADE_OUT_SECONDS / 2 });
  });

  it('exiting-onceFadeOutCompletes-returnsNull', () => {
    const state = beginHintTooltipExit({ hintId: 'bridgeDropThrough', phase: 'shown', elapsed: 0 });

    const ticked = tickHintTooltip(state, HINT_TOOLTIP_FADE_OUT_SECONDS);

    expect(ticked).toBeNull();
  });
});

describe('beginHintTooltipExit', () => {
  it('fromShown-switchesToExitingAtZeroElapsed', () => {
    const shown = { hintId: 'bridgeDropThrough' as const, phase: 'shown' as const, elapsed: 3 };

    expect(beginHintTooltipExit(shown)).toEqual({ ...shown, phase: 'exiting', elapsed: 0 });
  });
});

describe('hintTooltipGrowthAndOpacity', () => {
  it('entering-atStart-isFullyCollapsedAndInvisible', () => {
    const state = startHintTooltip('bridgeDropThrough');

    expect(hintTooltipGrowthAndOpacity(state)).toEqual({ growth: 0, opacity: 0 });
  });

  it('entering-halfwayThroughFadeIn-isHalfGrownAndHalfOpaque', () => {
    const state = { ...startHintTooltip('bridgeDropThrough'), elapsed: HINT_TOOLTIP_FADE_IN_SECONDS / 2 };

    const result = hintTooltipGrowthAndOpacity(state);

    expect(result.growth).toBeCloseTo(0.5);
    expect(result.opacity).toBeCloseTo(0.5);
  });

  it('shown-isFullyGrownAndFullyOpaque', () => {
    const state = { hintId: 'bridgeDropThrough' as const, phase: 'shown' as const, elapsed: 0 };

    expect(hintTooltipGrowthAndOpacity(state)).toEqual({ growth: 1, opacity: 1 });
  });

  it('exiting-atStart-isFullyGrownAndFullyOpaque', () => {
    const state = beginHintTooltipExit({ hintId: 'bridgeDropThrough', phase: 'shown', elapsed: 0 });

    expect(hintTooltipGrowthAndOpacity(state)).toEqual({ growth: 1, opacity: 1 });
  });

  it('exiting-halfwayThroughFadeOut-isHalfGrownAndHalfOpaque', () => {
    const exiting = beginHintTooltipExit({ hintId: 'bridgeDropThrough', phase: 'shown', elapsed: 0 });
    const halfway = { ...exiting, elapsed: HINT_TOOLTIP_FADE_OUT_SECONDS / 2 };

    const result = hintTooltipGrowthAndOpacity(halfway);

    expect(result.growth).toBeCloseTo(0.5);
    expect(result.opacity).toBeCloseTo(0.5);
  });

  it('exiting-onceFadeOutWouldExceedOne-staysClampedAtFullyCollapsed', () => {
    // hintTooltipGrowthAndOpacity is a pure function of elapsed — it doesn't
    // know tickHintTooltip would have already returned null by this point,
    // so it still needs to behave sanely (clamped, not negative) if ever
    // called with an elapsed value past the fade-out duration.
    const exiting = beginHintTooltipExit({ hintId: 'bridgeDropThrough', phase: 'shown', elapsed: 0 });
    const pastEnd = { ...exiting, elapsed: HINT_TOOLTIP_FADE_OUT_SECONDS * 2 };

    expect(hintTooltipGrowthAndOpacity(pastEnd)).toEqual({ growth: 0, opacity: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- HintTooltip.test.ts`
Expected: FAIL — `./HintTooltip` does not exist yet.

- [ ] **Step 3: Implement**

Create `src/themes/platformer/engine/HintTooltip.ts`:

```ts
import type { HintId } from '../types';

/**
 * Grow+fade animation state for the hint-sign tooltip (roadmap step 26,
 * live UX feedback: "the bubble should be shown from bottom to top like the
 * sign is starting to talk... and disappears the same way") — mirrors the
 * phase/elapsed shape `engine/CollectionEffects.ts`'s `FlightEffect` already
 * uses for the fact-flight text animation, generalized here to just two
 * transitions instead of three.
 */
export type HintTooltipPhase = 'entering' | 'shown' | 'exiting';

export interface HintTooltipState {
  hintId: HintId;
  phase: HintTooltipPhase;
  elapsed: number;
}

/**
 * Kept short and roughly equal (unlike ControlsOverlay.tsx's much longer
 * 400ms/600ms — that overlay is a one-time, whole-session event; a sign's
 * tooltip can be re-revealed every time the player walks back onto it and
 * presses Up again, so a snappier transition reads better for a
 * frequently-repeated interaction).
 */
export const HINT_TOOLTIP_FADE_IN_SECONDS = 0.2;
export const HINT_TOOLTIP_FADE_OUT_SECONDS = 0.25;

/** Starts a fresh tooltip in its 'entering' phase (roadmap step 26: only
 *  called once the player presses Up/`W` while overlapping a sign, not on
 *  mere overlap — see PlatformerPage.tsx). */
export function startHintTooltip(hintId: HintId): HintTooltipState {
  return { hintId, phase: 'entering', elapsed: 0 };
}

/** Switches an already-active tooltip into its 'exiting' phase, resetting
 *  elapsed. Called as soon as the player leaves the sign's overlap zone,
 *  regardless of whether Up was ever pressed while they were on it. */
export function beginHintTooltipExit(state: HintTooltipState): HintTooltipState {
  return { ...state, phase: 'exiting', elapsed: 0 };
}

/**
 * Advances the animation by `dt` seconds. 'entering' becomes 'shown' (elapsed
 * reset to 0) once HINT_TOOLTIP_FADE_IN_SECONDS elapses; 'shown' just
 * accumulates elapsed with no transition (the caller decides when to call
 * beginHintTooltipExit); 'exiting' returns `null` once
 * HINT_TOOLTIP_FADE_OUT_SECONDS elapses — the caller clears its signal to
 * `null` at that point, same convention as CollectionEffects.ts's
 * tickFlightEffect/tickCounterPopup returning a sentinel for "done".
 */
export function tickHintTooltip(state: HintTooltipState, dt: number): HintTooltipState | null {
  const elapsed = state.elapsed + dt;
  if (state.phase === 'entering') {
    if (elapsed >= HINT_TOOLTIP_FADE_IN_SECONDS) return { ...state, phase: 'shown', elapsed: 0 };
    return { ...state, elapsed };
  }
  if (state.phase === 'exiting') {
    if (elapsed >= HINT_TOOLTIP_FADE_OUT_SECONDS) return null;
    return { ...state, elapsed };
  }
  return { ...state, elapsed };
}

/**
 * Current vertical growth (0-1) and opacity (0-1) for the given state — the
 * caller (Renderer.ts's `drawSignBubble`) scales the bubble's HEIGHT by
 * `growth` while keeping its bottom edge (where the tail meets it) fixed, so
 * the whole thing visibly rises out of that fixed point rather than just
 * scaling in place — reading as "the sign starting to talk." 'entering'
 * interpolates growth/opacity 0 -> 1 as HINT_TOOLTIP_FADE_IN_SECONDS elapses;
 * 'shown' is always fully grown/opaque; 'exiting' interpolates the exact
 * reverse, 1 -> 0, over HINT_TOOLTIP_FADE_OUT_SECONDS — collapsing back down
 * into the same fixed point it grew from. Both progress ratios are clamped to
 * [0, 1] so a stale `elapsed` past either duration still returns a sane
 * (fully collapsed, not negative) result.
 */
export function hintTooltipGrowthAndOpacity(state: HintTooltipState): { growth: number; opacity: number } {
  if (state.phase === 'entering') {
    const progress = Math.min(1, state.elapsed / HINT_TOOLTIP_FADE_IN_SECONDS);
    return { growth: progress, opacity: progress };
  }
  if (state.phase === 'exiting') {
    const progress = Math.min(1, state.elapsed / HINT_TOOLTIP_FADE_OUT_SECONDS);
    return { growth: 1 - progress, opacity: 1 - progress };
  }
  return { growth: 1, opacity: 1 };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- HintTooltip.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing `PlatformerState.ts` test**

Add `hintTooltipState` to the existing import from `./PlatformerState` in
`PlatformerState.test.ts`, then add:

```ts
describe('hintTooltipState', () => {
  afterEach(() => {
    hintTooltipState.value = null;
  });

  it('initialValue-onModuleLoad-isNull', () => {
    expect(hintTooltipState.value).toBeNull();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- PlatformerState.test.ts`
Expected: FAIL — `hintTooltipState` is not exported yet.

- [ ] **Step 7: Implement**

In `src/themes/platformer/PlatformerState.ts`, add:

```ts
import type { HintTooltipState } from './engine/HintTooltip';
```

Then add, near `activeJournalSection`:

```ts
/**
 * The hint-sign tooltip's current grow+fade animation state (roadmap step
 * 26, live UX feedback — see engine/HintTooltip.ts), or `null` when no
 * tooltip is active/animating. Updated every game-loop tick (see
 * PlatformerPage.tsx's transition/tick logic) and read by `render()` to
 * decide whether/what/where to draw. Not reset by
 * `resetGame()`/`resetGameProgress()`: like the old `activeSignHintId` this
 * replaces, it reflects a purely positional, always-current fact about this
 * frame and the last few, not session progress.
 */
export const hintTooltipState = signal<HintTooltipState | null>(null);
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- PlatformerState.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/themes/platformer/engine/HintTooltip.ts src/themes/platformer/engine/HintTooltip.test.ts src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): add HintTooltip grow+fade animation state machine"
```

---

## Task 6: One "Sign" tool in the editor palette + rendering it on the canvas

**Files:**
- Modify: `src/themes/platformer/editor/paletteTiles.ts`
- Modify: `src/themes/platformer/editor/Palette.tsx`
- Modify: `src/themes/platformer/editor/gridRenderState.ts`
- Modify: `src/themes/platformer/editor/EditorCanvas.tsx`
- Test: `src/themes/platformer/editor/paletteTiles.test.ts`
- Test: `src/themes/platformer/editor/gridRenderState.test.ts`

**Why the `paletteTiles.ts` change is required, not optional:**
`editor/paletteTiles.ts` declares `PALETTE_TILE_SPRITES`/`PALETTE_TILE_LABELS` as
`Record<TileChar, ...>` — TypeScript requires every union member to have an
entry. Task 1 adds `'1'` to `TileChar`, so **`npm run build` fails immediately
once Task 1 lands** unless both Records also get a `'1'` entry.

**Why the palette gets exactly ONE "Sign" tile, not one per registered
hint:** per live feedback, clicking the same tile repeatedly cycles through
registered hints (Task 7) instead of needing a separate palette entry per
digit — the palette only ever needs a single representative tool
(`SIGN_CHARS`'s first key, `'1'` today) to select "the sign tool," regardless
of how many distinct hints get registered later.

**Interfaces:**
- Consumes: `SIGN_CHARS` (`../level/LevelParser`, Task 1); `SignPlacement`
  (`../level/SignMapper`, Task 2); `drawSigns` (`../engine/Renderer`, Task 10).
- Produces: a `'1'` entry in `PALETTE_TILE_SPRITES`/`PALETTE_TILE_LABELS`; the
  "Sign" tile appearing in `Palette.tsx`'s rendered tool list;
  `synthesizeSignPlacements(grid: TileChar[][]): SignPlacement[]`
  (`gridRenderState.ts`) — consumed by `EditorCanvas.tsx`'s render effect
  (this task) and reused by Task 7's tests. Task 1 depends on THIS task's
  `paletteTiles.ts` change shipping alongside it, or the build breaks.

- [ ] **Step 1: Write the failing `paletteTiles.ts` test**

In `src/themes/platformer/editor/paletteTiles.test.ts`, add:

```ts
describe('sign marker', () => {
  it('digitOne-hasASpriteMatchingTheInGameSignpostTile', () => {
    expect(PALETTE_TILE_SPRITES['1']).toEqual({
      sheet: '/sprites/world_tileset.png',
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 128,
      sy: 48,
      frameWidth: 16,
      frameHeight: 16,
    });
  });

  it('digitOne-hasAHumanReadableLabel', () => {
    expect(PALETTE_TILE_LABELS['1']).toBe('Sign');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- paletteTiles.test.ts`
Expected: FAIL — `PALETTE_TILE_SPRITES['1']`/`PALETTE_TILE_LABELS['1']` are
`undefined` (and, separately, `npm run build` would already be failing at this
point once Task 1 has landed — this test just gives the same problem a fast
feedback loop without waiting on a full build).

- [ ] **Step 3: Implement the `paletteTiles.ts`/`Palette.tsx` changes**

In `src/themes/platformer/editor/paletteTiles.ts`, add to `PALETTE_TILE_SPRITES`
(matching the in-game signpost tile's exact position — `Renderer.ts`'s
`SIGN_TILE_SX`/`SIGN_TILE_SY`, Task 10):

```ts
  '1': {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 128,
    sy: 48,
    frameWidth: 16,
    frameHeight: 16,
  },
```

and to `PALETTE_TILE_LABELS`:

```ts
  '1': 'Sign',
```

In `src/themes/platformer/editor/Palette.tsx`, add `SIGN_CHARS` to the existing
import from `../level/LevelParser`, then add exactly ONE representative sign
tile to the rendered tool list:

```ts
// Only the FIRST registered sign character becomes a palette tile — clicking
// it repeatedly on the canvas cycles through every other registered hint
// (Task 7's paintCell.ts), so the palette itself never needs to grow past one
// "Sign" entry no matter how many distinct hints get registered later.
const [firstSignKey] = Object.keys(SIGN_CHARS) as TileChar[];
const signKeys: TileChar[] = firstSignKey ? [firstSignKey] : [];
const tileKeys = [...terrainKeys, ...entityKeys, ...signKeys, EMPTY_CHAR];
```

(Replaces the existing `const tileKeys = [...terrainKeys, ...entityKeys, EMPTY_CHAR];`
line.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- paletteTiles.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing `gridRenderState.ts` test**

In `src/themes/platformer/editor/gridRenderState.test.ts`, add `SignPlacement`
to whatever type imports the file already has from the level modules, and add
`synthesizeSignPlacements` to the import from `./gridRenderState`:

```ts
describe('synthesizeSignPlacements', () => {
  it('noSignMarkers-returnsEmptyArray', () => {
    expect(synthesizeSignPlacements([['G', 'G']])).toEqual([]);
  });

  it('oneSignMarker-returnsItsHintIdAndPixelPosition', () => {
    const result = synthesizeSignPlacements([
      ['.', '.'],
      ['.', '1'],
    ]);
    const { x, y } = tileToPixel(1, 1);
    expect(result).toEqual([{ id: 'editor-sign-1-1', hintId: 'bridgeDropThrough', x, y }]);
  });
});
```

(`tileToPixel` is already imported at the top of this test file — reuse it,
don't re-import.)

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- gridRenderState.test.ts`
Expected: FAIL — `synthesizeSignPlacements` is not exported yet.

- [ ] **Step 7: Implement `synthesizeSignPlacements`**

In `src/themes/platformer/editor/gridRenderState.ts`, add `SIGN_CHARS` to the
existing import from `../level/LevelParser`, and `SignPlacement` type-only from
`../level/SignMapper`, then add near the other `synthesizeX` functions:

```ts
/** Returns a `SignPlacement` for every cell whose character is registered in
 *  `SIGN_CHARS` — unlike `findAllPositions` (used by every other
 *  `synthesizeX` function above), this scans for ANY sign character at once
 *  and resolves each one's own `hintId` directly, mirroring
 *  `LevelParser.ts`'s `findSignTiles`/`SignMapper.ts`'s `placeSigns` (the
 *  real game's own sign-placement path) rather than duplicating a
 *  one-char-at-a-time helper that wouldn't generalize past a single digit. */
export function synthesizeSignPlacements(grid: TileChar[][]): SignPlacement[] {
  const placements: SignPlacement[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const hintId = SIGN_CHARS[grid[row][col]];
      if (!hintId) continue;
      const { x, y } = tileToPixel(col, row);
      placements.push({ id: `editor-sign-${col}-${row}`, hintId, x, y });
    }
  }
  return placements;
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- gridRenderState.test.ts`
Expected: PASS

- [ ] **Step 9: Wire sign rendering (+ a dev-only hint-number badge) into `EditorCanvas.tsx`**

In `src/themes/platformer/editor/EditorCanvas.tsx`:

1. Add `synthesizeSignPlacements` to the existing import from `./gridRenderState`.
2. Add `drawSigns` to the existing import from `../engine/Renderer`.
3. Add `SIGN_CHARS` to a new import from `../level/LevelParser` (this file
   doesn't currently import anything from there).
4. Inside the render effect, right after the existing `if (images.tileset) {
   drawTerrain(...) }` block, draw the sign sprites using that same tileset
   (no new image needed — matches the real game's own `drawSigns` call site):

```ts
    if (images.tileset) {
      drawSigns(ctx, synthesizeSignPlacements(grid), images.tileset, panOffset.x, panOffset.y);
    }
```

5. Add, after the render effect's other helper functions (e.g. near
   `drawGridLines`), a dev-tool-only badge renderer — this is deliberately
   NOT shared with `Renderer.ts`'s `drawSigns`/`drawSignBubble`: a number
   overlay is an authoring aid for telling placed signs apart at a glance,
   not something the real game should ever show a player:

```ts
const SIGN_BADGE_FONT_SIZE = 12;

/** Draws each sign marker's own digit character in its tile's top-left
 *  corner — lets an author tell apart otherwise-identical signpost sprites
 *  at a glance while placing/cycling them (Task 7). Editor-only: the real
 *  game's own drawSigns/drawSignBubble never show this. */
function drawSignBadges(
  ctx: CanvasRenderingContext2D,
  grid: TileChar[][],
  originX: number,
  originY: number,
): void {
  ctx.save();
  ctx.font = `${SIGN_BADGE_FONT_SIZE}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const char = grid[row][col];
      if (!SIGN_CHARS[char]) continue;
      const { x, y } = tileToPixel(col, row);
      ctx.fillStyle = '#000';
      ctx.fillText(char, x + originX + 1, y + originY + 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(char, x + originX, y + originY);
    }
  }
  ctx.restore();
}
```

   (`tileToPixel` is already imported at the top of this file via
   `RENDERED_TILE_SIZE`'s import line — add `tileToPixel` to that same
   import.)

6. Call it right after the `drawSigns(...)` call added in step 4:

```ts
    drawSignBadges(ctx, grid, panOffset.x, panOffset.y);
```

- [ ] **Step 10: Run the editor test suite to check for regressions**

Run: `npm test -- editor`
Expected: PASS — `Palette.test.tsx` (if it asserts an exact rendered tile
count/order) may need its expected list updated to include the new "Sign"
entry; if so, update that expectation to match, same convention as any other
test asserting a specific tile list.

- [ ] **Step 11: Commit**

```bash
git add src/themes/platformer/editor/paletteTiles.ts src/themes/platformer/editor/paletteTiles.test.ts src/themes/platformer/editor/Palette.tsx src/themes/platformer/editor/gridRenderState.ts src/themes/platformer/editor/gridRenderState.test.ts src/themes/platformer/editor/EditorCanvas.tsx
git commit -m "feat(platformer): render placeable sign markers (with a dev badge) in the level editor"
```

---

## Task 7: Cycling + no-duplicate-hint painting in `paintCell.ts`

**Files:**
- Modify: `src/themes/platformer/editor/paintCell.ts`
- Test: `src/themes/platformer/editor/paintCell.test.ts`

**Why:** per live feedback, clicking the palette's single "Sign" tool onto an
empty cell should place a hint the level doesn't already use elsewhere (not
always the same digit — "it doesn't make sense placing multiple signs with
the same text"), and clicking an ALREADY-placed sign again should cycle
forward to the next hint not already used elsewhere in the level, wrapping
around, rather than either doing nothing or blindly reassigning the tool's
own fixed digit. If every registered hint is already placed somewhere else in
the level (an edge case, since today only one hint exists at all), it falls
back to reusing a digit rather than leaving the cell unpainted — signs are
capped at 9 distinct hints total (spec.md FR-037's accepted constraint), so
this situation is expected to be rare/temporary as more hints get authored.

**Interfaces:**
- Consumes: `SIGN_CHARS` (`../level/LevelParser`, Task 1).
- Produces: `paintCell`'s existing signature is unchanged — this task only
  changes what character actually gets written for a sign-tool paint, an
  internal behavior change with no new exports.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/editor/paintCell.test.ts`:

```ts
describe('paintCell — sign markers', () => {
  it('paintingSignToolOnEmptyCell-placesTheFirstUnusedRegisteredHint', () => {
    // Only '1' (bridgeDropThrough) is registered today, so this is
    // necessarily a same-digit assertion until a second hint exists — see
    // the next test for the actually-interesting "skip what's already
    // placed" case once there's something to skip.
    const grid: TileChar[][] = [['.', '.']];

    const result = paintCell(grid, 1, 0, '1');

    expect(result.grid[0][1]).toBe('1');
  });

  it('clickingAnAlreadyPlacedSign-cyclesToTheNextRegisteredHint', () => {
    // With only one hint registered, cycling a lone placed sign is
    // necessarily a same-digit no-op — this test documents that behavior
    // explicitly rather than leaving it unasserted, so a future second
    // SIGN_CHARS entry (which would make this actually cycle somewhere new)
    // has an existing test it visibly changes instead of silently gaining
    // new behavior nothing ever exercised.
    const grid: TileChar[][] = [['1', '.']];

    const result = paintCell(grid, 0, 0, '1');

    expect(result.grid[0][0]).toBe('1');
  });

  it('paintingSignToolOnEmptyCell-doesNotDisturbAnUnrelatedExistingSign', () => {
    const grid: TileChar[][] = [['1', '.']];

    const result = paintCell(grid, 1, 0, '1');

    // Today's single-hint registry means the second sign is forced to reuse
    // '1' too (the documented "every registered hint is already used
    // elsewhere" fallback) — but the FIRST sign must be left completely
    // untouched by painting the second one.
    expect(result.grid[0][0]).toBe('1');
    expect(result.grid[0][1]).toBe('1');
  });

  it('paintingNonSignTool-behavesExactlyAsBefore', () => {
    const grid: TileChar[][] = [['1', '.']];

    const result = paintCell(grid, 1, 0, 'G');

    expect(result.grid[0][1]).toBe('G');
    expect(result.grid[0][0]).toBe('1'); // unrelated cell untouched
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- paintCell.test.ts`
Expected: FAIL — today's `paintCell` just writes `tool` verbatim, so the
"doesNotDisturb"/"cycles" tests happen to already pass by coincidence with
only one registered hint, but the intent (and the code path) isn't there yet;
implement anyway so the behavior is real, not accidental — see the note in
Step 3 about why this matters once a second hint is added.

- [ ] **Step 3: Implement**

In `src/themes/platformer/editor/paintCell.ts`:

1. Add `SIGN_CHARS` to the existing import from `../level/LevelParser`.

2. Add, above `paintCell`:

```ts
const SIGN_KEYS = Object.keys(SIGN_CHARS) as TileChar[];

/**
 * The character to actually paint when `tool` is a registered sign marker.
 * Scans the WHOLE grid (excluding the target cell itself, which is about to
 * be overwritten) for hints already placed elsewhere, then returns the
 * first registered hint — starting from `startFrom` and wrapping — that
 * ISN'T already used elsewhere. Falls back to `startFrom` itself only if
 * every registered hint is already placed somewhere else (an expected-rare
 * edge case, not a hard failure).
 */
function firstUnusedSignChar(
  grid: TileChar[][],
  excludeCol: number,
  excludeRow: number,
  startFrom: TileChar,
): TileChar {
  const usedElsewhere = new Set<TileChar>();
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (r === excludeRow && c === excludeCol) continue;
      const char = grid[r][c];
      if (SIGN_KEYS.includes(char)) usedElsewhere.add(char);
    }
  }
  const startIndex = SIGN_KEYS.indexOf(startFrom);
  for (let i = 0; i < SIGN_KEYS.length; i++) {
    const candidate = SIGN_KEYS[(startIndex + i) % SIGN_KEYS.length];
    if (!usedElsewhere.has(candidate)) return candidate;
  }
  return startFrom;
}
```

3. In `paintCell`, replace the final `nextGrid[targetRow][targetCol] = tool;`
   line with sign-aware logic. The full function becomes:

```ts
export function paintCell(
  grid: TileChar[][],
  col: number,
  row: number,
  tool: TileChar,
): PaintResult {
  const { grid: grownGrid, colShift, rowShift } = growGrid(grid, col, row);
  const targetCol = col + colShift;
  const targetRow = row + rowShift;

  const nextGrid = grownGrid.map((r) => [...r]);

  if (tool === 'S') {
    for (let r = 0; r < nextGrid.length; r++) {
      for (let c = 0; c < nextGrid[r].length; c++) {
        if (nextGrid[r][c] === 'S') {
          nextGrid[r][c] = '.';
        }
      }
    }
  }

  if (SIGN_KEYS.includes(tool)) {
    const existing = nextGrid[targetRow][targetCol];
    // Cycling (clicking an already-placed sign again) starts its search
    // right AFTER the existing digit; a fresh placement (anything else
    // already there) starts at the tool's own default digit.
    const startFrom = SIGN_KEYS.includes(existing)
      ? SIGN_KEYS[(SIGN_KEYS.indexOf(existing) + 1) % SIGN_KEYS.length]
      : tool;
    nextGrid[targetRow][targetCol] = firstUnusedSignChar(nextGrid, targetCol, targetRow, startFrom);
  } else {
    nextGrid[targetRow][targetCol] = tool;
  }

  return { grid: nextGrid, colShift, rowShift };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- paintCell.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full editor test suite to check for regressions**

Run: `npm test -- editor`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/editor/paintCell.ts src/themes/platformer/editor/paintCell.test.ts
git commit -m "feat(platformer): cycle sign markers to the next unused hint on repeat click"
```

---

## Task 8: "Interact" caption in `ControlsOverlay.tsx`

**Files:**
- Modify: `src/themes/platformer/components/ControlsOverlay.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/de.json`
- Test: `src/themes/platformer/components/ControlsOverlay.test.tsx`

**Interfaces:**
- Produces: `platformer.controlsOverlay.interact` translation key, a new caption
  rendered above the key sprite in `ControlsOverlay.tsx` — standalone from every
  other task (no other task depends on this one, and this one depends on nothing
  from Tasks 1-5).

- [ ] **Step 1: Add the English and German strings**

In `src/i18n/locales/en.json`, inside the existing `"platformer.controlsOverlay"`
object, add `"interact"` alongside the existing `"move"`/`"jump"`/`"journal"` keys:

```json
    "controlsOverlay": {
      "move": "Move",
      "jump": "Jump",
      "journal": "Journal",
      "interact": "Interact"
    }
```

In `src/i18n/locales/de.json`, same location:

```json
    "controlsOverlay": {
      "move": "Bewegen",
      "jump": "Springen",
      "journal": "Journal",
      "interact": "Interagieren"
    }
```

- [ ] **Step 2: Write the failing test**

In `src/themes/platformer/components/ControlsOverlay.test.tsx`, find the existing
test that asserts the Move/Jump/Journal captions render (it renders
`<ControlsOverlay />` with `lifecycleState.value.phase` set to `'playing'` — reuse
that same setup) and add an assertion for the new caption alongside the existing
ones:

```ts
    expect(screen.getByText('Interact')).toBeInTheDocument();
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- ControlsOverlay.test.tsx`
Expected: FAIL — no "Interact" text rendered yet.

- [ ] **Step 4: Implement**

In `src/themes/platformer/components/ControlsOverlay.tsx`:

1. Add a new position constant alongside the existing
   `MOVE_LABEL_CENTER_PERCENT`/`JUMP_LABEL_CENTER_PERCENT`/`JOURNAL_LABEL_CENTER_PERCENT`:

```ts
// The "Interact" caption sits ABOVE the key sprite (every other caption sits
// below it) and horizontally centered on the arrow cluster's Up key
// specifically, not the whole cluster's "Move" caption position reused
// as-is by coincidence — the sprite's inverted-T layout already centers Up
// on that same horizontal midpoint as the whole cluster, so no new
// pixel-decoding pass is needed to find Up's own sub-position.
const INTERACT_LABEL_CENTER_PERCENT = MOVE_LABEL_CENTER_PERCENT;
```

2. Add a new caption `<span>` inside the `<div className="relative w-fit">`
   wrapper, as a sibling of the existing `<img>` and the below-image caption
   `<div>` — this one is its own absolutely-positioned block ABOVE the image
   instead of joining the below-image captions row:

```tsx
        <div
          className="absolute bottom-full mb-1.5 w-full text-xl whitespace-nowrap text-white"
          style={{
            fontFamily: `"${RESTART_PROMPT_FONT_FAMILY}", sans-serif`,
            textShadow: '1px 1px 0 rgba(0,0,0,0.8), -1px -1px 0 rgba(0,0,0,0.8), 1px -1px 0 rgba(0,0,0,0.8), -1px 1px 0 rgba(0,0,0,0.8)',
          }}
        >
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${INTERACT_LABEL_CENTER_PERCENT}%` }}
          >
            {ui.platformer.controlsOverlay.interact}
          </span>
        </div>
```

   Place this new `<div>` immediately before the existing `<img src="/sprites/controls_overlay_keys.png" ... />` line (so it sits above the image in both DOM order and, via `bottom-full`, visually) — the existing below-image caption `<div>` (with `top-full`) stays completely unchanged, still holding Move/Jump/Journal.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- ControlsOverlay.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the build to catch any i18n type drift**

Run: `npm run build`
Expected: PASS — confirms `en.json`/`de.json` still have matching shapes (the
`Translation` type is inferred from `en.json`; a shape mismatch with `de.json`
fails the build, not just a test).

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/components/ControlsOverlay.tsx src/themes/platformer/components/ControlsOverlay.test.tsx src/i18n/locales/en.json src/i18n/locales/de.json
git commit -m "feat(platformer): teach Up=interact in the controls overlay"
```

---

## Task 9: i18n content for hint text

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/de.json`

**Interfaces:**
- Produces: `platformer.hints.bridgeDropThrough` translation key, which also makes
  `HintId` (Task 1) resolve to `'bridgeDropThrough'` — consumed by Task 11's
  `PlatformerPage.tsx` via `currentUI.value.platformer.hints`.

- [ ] **Step 1: Add the English string**

In `src/i18n/locales/en.json`, inside the existing `"platformer"` object, add a
`"hints"` block as the first key (immediately before the existing `"journal"` key):

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
Expected: PASS with no type errors — this is also what confirms `HintId` (Task 1)
now resolves to the real `'bridgeDropThrough'` key instead of `never`.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/de.json
git commit -m "feat(platformer): add bridge drop-through hint i18n strings"
```

---

## Task 10: `drawSigns` and `drawSignBubble` in `Renderer.ts`

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `TILE_SIZE`, `RENDERED_TILE_SIZE` (existing imports), `RESTART_PROMPT_FONT_FAMILY`
  (existing, same file), `SignPlacement` (`../level/SignMapper`).
- Produces: `drawSigns(ctx, signs: readonly SignPlacement[], tileset: HTMLImageElement, originX?, originY?): void`,
  `drawSignBubble(ctx, text: string, anchorX: number, anchorBottomY: number, growth?: number, opacity?: number): void`
  — both consumed by Task 6's `EditorCanvas.tsx` (`drawSigns` only) and Task 11's
  `PlatformerPage.tsx` (both).

- [ ] **Step 1: Write the failing tests**

Add `drawSigns, drawSignBubble` to the existing import from `./Renderer` in
`Renderer.test.ts`, and `import type { SignPlacement } from '../level/SignMapper';`.
The file's local `makeMockContext()` helper already includes `fillText`/`measureText`
— add `fillRect: vi.fn()`, `lineTo: vi.fn()`, `closePath: vi.fn()`, and
`globalAlpha: 1` to it too (none of the four are there yet):

```ts
describe('drawSigns', () => {
  it('onePlacement-drawsSignpostTileAtItsPosition', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const sign: SignPlacement = { id: 'sign-bridgeDropThrough-1-1', hintId: 'bridgeDropThrough', x: 64, y: 96 };

    drawSigns(ctx as unknown as CanvasRenderingContext2D, [sign], fakeTileset, 10, 20);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 128, 48, 16, 16, 64 + 10, 96 + 20, 32, 32);
  });

  it('noPlacements-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawSigns(ctx as unknown as CanvasRenderingContext2D, [], fakeTileset);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawSignBubble', () => {
  it('growth1-drawsBorderAndBubbleRectsPlusCenteredText', () => {
    const ctx = makeMockContext() as unknown as {
      fillRect: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hold Down to drop through a bridge.', 200, 300);

    expect(ctx.fillRect).toHaveBeenCalledTimes(2); // border rect, then the inset bubble rect on top
    expect(ctx.fillText).toHaveBeenCalledWith(
      'Hold Down to drop through a bridge.',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('growthZero-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as {
      fillRect: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 0);

    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('halfGrowth-drawsABubbleRectHalfAsTallAsFullGrowth', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 1);
    const [, , , fullHeight] = ctx.fillRect.mock.calls[1]; // index 1: the inset bubble rect, not the border rect
    ctx.fillRect.mockClear();

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 0.5);
    const [, , , halfHeight] = ctx.fillRect.mock.calls[1];

    expect(halfHeight).toBeCloseTo(fullHeight / 2);
  });

  it('everyGrowth-keepsTheBoxsBottomEdgeFixed', () => {
    // The bubble must grow UPWARD from a fixed bottom edge (where the tail
    // meets it), not scale symmetrically — this is what makes it read as
    // "rising out of" the anchor point rather than just scaling in place.
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 1);
    const [, fullTop, , fullHeight] = ctx.fillRect.mock.calls[1];
    const fullBottom = fullTop + fullHeight;
    ctx.fillRect.mockClear();

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 0.5);
    const [, halfTop, , halfHeight] = ctx.fillRect.mock.calls[1];
    const halfBottom = halfTop + halfHeight;

    expect(halfBottom).toBeCloseTo(fullBottom);
  });

  it('withOpacity-setsGlobalAlphaBeforeDrawing', () => {
    const ctx = makeMockContext() as unknown as { globalAlpha: number; fillRect: ReturnType<typeof vi.fn> };
    // Capture globalAlpha at the moment fillRect is called — save()/restore()
    // are no-ops in the mock, so without capturing mid-call, reading
    // ctx.globalAlpha afterward could reflect whatever restore() reset it to.
    let alphaDuringDraw: number | undefined;
    ctx.fillRect.mockImplementation(() => {
      if (alphaDuringDraw === undefined) alphaDuringDraw = ctx.globalAlpha;
    });

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 1, 0.4);

    expect(alphaDuringDraw).toBe(0.4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Renderer.test.ts`
Expected: FAIL — `drawSigns`/`drawSignBubble` are not exported yet.

- [ ] **Step 3: Implement**

In `src/themes/platformer/engine/Renderer.ts`, add near the top:

```ts
import type { SignPlacement } from '../level/SignMapper';
```

Then add (e.g. after `drawRestartPrompt`):

```ts
/** Tile coordinates of the signpost sprite within world_tileset.png (col 8,
 *  row 3 -> pixel 128,48) — sits immediately right of the crate tile (col 7,
 *  row 3, roadmap step 21). */
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
  signs: readonly SignPlacement[],
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

const BUBBLE_FONT_SIZE = 16;
const BUBBLE_PADDING_X = 10;
const BUBBLE_PADDING_Y = 6;
const BUBBLE_BORDER_WIDTH = 2;
/** Vertical gap between the bubble tail's tip and its anchor point
 *  (anchorBottomY), so it floats just above the character's head rather
 *  than overlapping it. */
const BUBBLE_GAP_ABOVE_ANCHOR = 40;
const BUBBLE_TAIL_HALF_WIDTH = 6;
const BUBBLE_TAIL_HEIGHT = 8;
const BUBBLE_BG_COLOR = '#f4ecd8';
const BUBBLE_BORDER_COLOR = '#241a0e';
const BUBBLE_TEXT_COLOR = '#241a0e';

/**
 * Draws a comic-style speech bubble with `text` — a cream box, a dark
 * border, and a small tail pointing down at (`anchorX`, `anchorBottomY`),
 * already origin-shifted screen-space coordinates (same convention as
 * drawPlayer's own position). Per the user's explicit style preference (see
 * this session's `hint-tooltip-styles` mockup artifact, option 3). Uses a
 * bigger dark rect/triangle behind a smaller inset cream one for both the
 * box and the tail, instead of `ctx.strokeRect`/`ctx.stroke` — reads as a
 * BUBBLE_BORDER_WIDTH-thick outline with only fill-based primitives.
 *
 * `growth` (default 1, roadmap step 26 live UX feedback: "shown from bottom
 * to top like the sign is starting to talk") scales the box's and tail's
 * HEIGHT from 0 to their full size while keeping the box's BOTTOM edge
 * fixed (where the tail meets it) — the caller passes
 * `hintTooltipGrowthAndOpacity`'s `growth` straight through. `growth <= 0`
 * draws nothing at all. `opacity` (default 1) is applied via
 * `ctx.globalAlpha`, the same mechanism `drawBlocks`'s crate-shatter fade
 * already uses.
 */
export function drawSignBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchorX: number,
  anchorBottomY: number,
  growth = 1,
  opacity = 1,
): void {
  if (growth <= 0) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.font = `${BUBBLE_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const boxWidth = ctx.measureText(text).width + BUBBLE_PADDING_X * 2;
  const fullBoxHeight = BUBBLE_FONT_SIZE + BUBBLE_PADDING_Y * 2;
  const boxHeight = fullBoxHeight * growth;
  const tailHeight = BUBBLE_TAIL_HEIGHT * growth;
  const tailHalfWidth = BUBBLE_TAIL_HALF_WIDTH * growth;

  // Anchored at the tail's fixed tip — the box and tail both grow UPWARD
  // from there, so the whole bubble reads as rising out of that point
  // rather than scaling in place.
  const tailTipY = anchorBottomY - BUBBLE_GAP_ABOVE_ANCHOR;
  const boxBottom = tailTipY - tailHeight;
  const boxTop = boxBottom - boxHeight;
  const boxLeft = anchorX - boxWidth / 2;

  ctx.fillStyle = BUBBLE_BORDER_COLOR;
  ctx.fillRect(
    boxLeft - BUBBLE_BORDER_WIDTH,
    boxTop - BUBBLE_BORDER_WIDTH,
    boxWidth + BUBBLE_BORDER_WIDTH * 2,
    boxHeight + BUBBLE_BORDER_WIDTH * 2,
  );
  ctx.fillStyle = BUBBLE_BG_COLOR;
  ctx.fillRect(boxLeft, boxTop, boxWidth, boxHeight);

  ctx.fillStyle = BUBBLE_BORDER_COLOR;
  ctx.beginPath();
  ctx.moveTo(anchorX - tailHalfWidth - BUBBLE_BORDER_WIDTH, boxBottom);
  ctx.lineTo(anchorX, tailTipY + BUBBLE_BORDER_WIDTH);
  ctx.lineTo(anchorX + tailHalfWidth + BUBBLE_BORDER_WIDTH, boxBottom);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = BUBBLE_BG_COLOR;
  ctx.beginPath();
  ctx.moveTo(anchorX - tailHalfWidth, boxBottom);
  ctx.lineTo(anchorX, tailTipY);
  ctx.lineTo(anchorX + tailHalfWidth, boxBottom);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = BUBBLE_TEXT_COLOR;
  ctx.fillText(text, anchorX, boxTop + boxHeight / 2);
  ctx.restore();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Renderer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): add drawSigns and drawSignBubble"
```

---

## Task 11: Wire into `PlatformerPage.tsx`

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `signPlacements` (`./PlatformerState`, Task 4); `hintTooltipState`
  (`./PlatformerState`, Task 5); `checkSignOverlap` (`./engine/Collision`, Task 4);
  `startHintTooltip`, `beginHintTooltipExit`, `tickHintTooltip`,
  `hintTooltipGrowthAndOpacity` (`./engine/HintTooltip`, Task 5); `drawSigns`,
  `drawSignBubble` (`./engine/Renderer`, Task 10); `currentUI` (`@/state/locale`,
  existing).

- [ ] **Step 1: Write the failing tests**

In `src/themes/platformer/PlatformerPage.test.tsx`, add `signPlacements,
hintTooltipState` to the existing import from `./PlatformerState`, and reset
`hintTooltipState` in the `beforeEach` (alongside the other module-level signal
resets):

```ts
    hintTooltipState.value = null;
```

Then add a new `describe` block. Every test below reuses the exact
`fireEvent.keyDown(window, { code: 'ArrowUp' }); frameCallback!(...)` pattern
this file's existing chest-interact tests already use
(`arrowUpPressed-whileStandingOnClosedChest-...`):

```tsx
describe('PlatformerPage — hint signs', () => {
  it('render-tilesetLoaded-drawsSignpostAtItsPosition', async () => {
    render(<PlatformerPage />);

    const ctx = platformerPage.context;
    const sign = signPlacements.value[0];
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

  it('overlappingSignWithoutPressingUp-neverStartsTheTooltip', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    const sign = signPlacements.value[0];
    playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
    frameCallback!(0);
    frameCallback!(16);

    expect(hintTooltipState.value).toBeNull();
  });

  it('arrowUpPressed-whileOverlappingSign-startsEnteringAndEventuallyDrawsBubbleText', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    const sign = signPlacements.value[0];
    playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
    fireEvent.keyDown(window, { code: 'ArrowUp' });
    frameCallback!(0);
    frameCallback!(16); // one ~16ms tick: starts 'entering'

    expect(hintTooltipState.value?.hintId).toBe('bridgeDropThrough');
    expect(hintTooltipState.value?.phase).toBe('entering');

    // Advance well past HINT_TOOLTIP_FADE_IN_SECONDS (0.2s) — several more
    // 16ms ticks — so it settles into 'shown' and the text actually paints.
    for (let t = 32; t <= 320; t += 16) frameCallback!(t);

    expect(hintTooltipState.value?.phase).toBe('shown');
    const ctx = platformerPage.context;
    expect(ctx.fillText).toHaveBeenCalledWith(
      'Hold Down to drop through a bridge.',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('keyWPressed-whileOverlappingSign-alsoRevealsTheBubble', () => {
    // KeyW is an accepted alternate for ArrowUp's interact action (same
    // convention chest-opening already uses).
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    const sign = signPlacements.value[0];
    playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
    fireEvent.keyDown(window, { code: 'KeyW' });
    frameCallback!(0);
    frameCallback!(16);

    expect(hintTooltipState.value?.hintId).toBe('bridgeDropThrough');
  });

  it('playerWalksAwayAfterRevealing-gameLoopTicks-entersExitingThenClearsToNull', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    const sign = signPlacements.value[0];
    playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
    fireEvent.keyDown(window, { code: 'ArrowUp' });
    let t = 0;
    frameCallback!(t);
    for (let i = 0; i < 20; i++) {
      t += 16;
      frameCallback!(t);
    }
    expect(hintTooltipState.value?.phase).toBe('shown');

    playerState.value = { ...playerState.value, x: sign.x + 2000, y: sign.y };
    t += 16;
    frameCallback!(t);
    expect(hintTooltipState.value?.phase).toBe('exiting');

    // Advance well past HINT_TOOLTIP_FADE_OUT_SECONDS (0.25s).
    for (let i = 0; i < 20; i++) {
      t += 16;
      frameCallback!(t);
    }

    expect(hintTooltipState.value).toBeNull();
  });

  it('playerWalksAwayWithoutEverPressingUp-staysNull', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    const sign = signPlacements.value[0];
    playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
    frameCallback!(0);
    frameCallback!(16);
    expect(hintTooltipState.value).toBeNull();

    playerState.value = { ...playerState.value, x: sign.x + 2000, y: sign.y };
    frameCallback!(32);

    expect(hintTooltipState.value).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- PlatformerPage.test.tsx -t "hint signs"`
Expected: FAIL — nothing draws signs or updates `hintTooltipState` yet.

- [ ] **Step 3: Implement**

In `src/themes/platformer/PlatformerPage.tsx`:

1. Add `signPlacements, hintTooltipState` to the existing import from
   `./PlatformerState`.
2. Add `drawSigns, drawSignBubble` to the existing import from `./engine/Renderer`.
3. Add `checkSignOverlap` to the existing import from `./engine/Collision`
   (alongside `checkCollectibleCollisions`, etc. — one existing import block, not a
   new line).
4. Add a new import (this file does not currently import from `@/state/locale` —
   `currentCV`/`currentUI` reads happen inside `Journal.tsx` today):

```ts
import { currentUI } from '@/state/locale';
```

5. Add a new import for the animation helpers:

```ts
import {
  startHintTooltip,
  beginHintTooltipExit,
  tickHintTooltip,
  hintTooltipGrowthAndOpacity,
} from './engine/HintTooltip';
```

6. Inside `render()`, right after the existing `drawTerrain(...)` call, draw signs
   using the same already-loaded tileset (no new image load needed):

```ts
      if (tilesetRef.current) {
        drawTerrain(ctx, currentLevel.value, tilesetRef.current, originX, originY);
        drawSigns(ctx, signPlacements.value, tilesetRef.current, originX, originY);
      }
```

7. Still inside `render()`, after the existing `drawPlayer(...)` block (so the
   bubble draws on top of the player, not underneath), draw it whenever
   `hintTooltipState` is non-null, at whatever growth/opacity its current
   animation phase gives:

```ts
      const tooltip = hintTooltipState.value;
      if (tooltip) {
        const hintText = currentUI.value.platformer.hints[tooltip.hintId];
        const anchorX = playerState.value.x + PLAYER_RENDERED_SIZE / 2 + originX;
        const anchorBottomY = playerState.value.y + originY;
        const { growth, opacity } = hintTooltipGrowthAndOpacity(tooltip);
        drawSignBubble(ctx, hintText, anchorX, anchorBottomY, growth, opacity);
      }
```

   (`tooltip.hintId` is typed `HintId`, so `currentUI.value.platformer.hints[tooltip.hintId]`
   is fully type-checked — no cast needed, and no `undefined` branch to handle since
   every `HintId` is guaranteed to have a matching translation key.)

8. Inside the game loop's `createGameLoop((dt) => { ... })` callback, find the
   existing chest-interact block:

```ts
      const arrowUpPressed = input.consumePress('ArrowUp');
      const wPressed = input.consumePress('KeyW');
      const interactPressed = arrowUpPressed || wPressed;
      if (interactPressed) {
        const standingChestId = chestPlayerIsStandingOn(playerState.value, chestStates.value);
        // ...
      }
```

   Add the hint-sign logic RIGHT AFTER that whole `if (interactPressed) { ... }`
   block closes — it reuses the SAME already-computed `interactPressed` value
   (do not call `input.consumePress` again for signs; each key's pending press
   is drained the first time it's read this tick). Ticking BEFORE checking for
   a new enter/exit transition matches this file's existing `activeEffects`
   convention (ticked before that tick's own newly-`push`ed effects are
   added) — a tooltip that just started this same frame isn't double-advanced:

```ts
      // FR-038, revised per live UX feedback: revealed like a chest — stand
      // on a sign and press Up/W (interactPressed, computed above for
      // chest-opening) — but reusable (not dedup-tracked) and hidden again
      // automatically the instant the player leaves overlap, with no
      // keypress needed to dismiss it.
      if (hintTooltipState.value) {
        hintTooltipState.value = tickHintTooltip(hintTooltipState.value, dt);
      }
      const overlappingSignHintId = checkSignOverlap(playerState.value, signPlacements.value);
      const currentTooltip = hintTooltipState.value;
      if (overlappingSignHintId && interactPressed) {
        if (!currentTooltip || currentTooltip.hintId !== overlappingSignHintId) {
          hintTooltipState.value = startHintTooltip(overlappingSignHintId);
        } else if (currentTooltip.phase === 'exiting') {
          // Pressed Up again before the previous reveal finished leaving —
          // restart the entrance rather than leaving it stuck exiting.
          hintTooltipState.value = { ...currentTooltip, phase: 'entering', elapsed: 0 };
        }
        // Already 'entering'/'shown' for this exact sign: a repeat press
        // while it's already up is a harmless no-op.
      } else if (!overlappingSignHintId && currentTooltip && currentTooltip.phase !== 'exiting') {
        hintTooltipState.value = beginHintTooltipExit(currentTooltip);
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- PlatformerPage.test.tsx`
Expected: PASS (full file — confirms the new tests pass and nothing else regressed)

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): reveal hint signs like a chest, with a grow+fade bubble"
```

---

## Task 12: Full verification + roadmap checkbox

**Files:**
- Modify: `specs/S-006-platformer-theme/roadmap.md`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions anywhere in the platformer theme or elsewhere.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: PASS — zero TypeScript errors.

- [ ] **Step 3: Manual browser verification**

Start the dev server and open the Platformer theme (unlock the
`platformerPrototypeUnlocked` flag first if needed):
- Confirm the controls overlay (shown once at game start) now includes an
  "Interact" caption above the Up arrow, alongside the existing Move/Jump/Journal
  captions.
- Confirm a signpost sprite is visible on the ground a couple of tiles right of
  spawn, right above the first pit's bridge.
- Walk onto the sign WITHOUT pressing Up — confirm nothing appears (no automatic
  reveal).
- Press Up (or `W`) while standing on it — confirm a speech bubble ("Hold Down to
  drop through a bridge." or the German equivalent if the locale toggle is set to
  DE) grows upward from the sign, like it's starting to talk, and settles above
  the character.
- Keep standing on the sign — confirm the bubble stays fully visible with no
  timeout.
- Walk away — confirm the bubble shrinks back down the same way it grew,
  disappearing at the same fixed point it rose from.
- Walk back onto the sign and press Up again — confirm it reveals again (signs
  are reusable, not one-time like a chest).
- Walk back onto the sign before its exit shrink fully finishes — confirm it
  smoothly restarts growing instead of getting stuck mid-shrink.
- Switch locale while the bubble is showing — confirm its text updates
  immediately.
- Confirm the game does not pause and the character can still move/jump while the
  bubble is showing.
- Open the journal — confirm nothing new appears there (signs are not CV facts).
- Open the Level Editor (debug menu's "Editor" button) — confirm a single "Sign"
  tile appears in the palette, placing it paints a visible signpost with a small
  digit badge in its corner, and clicking an already-placed sign again cycles
  its digit (a no-op today with only one hint registered, but shouldn't error or
  remove the sign).

- [ ] **Step 4: Check off the roadmap step**

In `specs/S-006-platformer-theme/roadmap.md`, change step 26's `- [ ]` to `- [x]`, and
append a short note of anything discovered/adjusted during implementation, matching
the style of prior completed steps' entries, if applicable.

- [ ] **Step 5: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs: check off roadmap step 26 (hint signs)"
```
