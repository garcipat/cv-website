# Coin Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement roadmap step 12: a `CollectibleMapper` that flattens real
`CVData` (Skills grouped by category, Languages individually) into placed,
collectible game objects — skill categories as spinning `coin.png` pickups,
languages as bobbing `fruit.png` pickups — with touch-to-collect detection,
a hover-then-fly-to-journal fact animation with a sparkle burst, two real HUD
counters (coins, fruits), and `collectedFacts`/collected-state that survives
death/respawn but not a full game reset.

**Architecture:** Five new pure engine/data modules (`level/CollectibleMapper.ts`,
`engine/Collision.ts`, `entities/Fruit.ts`, `engine/CollectionEffects.ts`, plus
a widened `types.ts`), extensions to `Renderer.ts`'s draw functions, new
signals in `PlatformerState.ts`, and orchestration wiring in
`PlatformerPage.tsx`. Mirrors the existing split between pure, independently
tested engine logic (`Physics.ts`, `GameLifecycle.ts`, `Coin.ts`) and thin
React wiring. `level/level1Coins.ts` and `entities/Coin.ts`'s `CoinPlacement`
(step 11's hardcoded test data) are superseded by this step's real,
CVData-driven placements and deleted.

**Tech Stack:** TypeScript strict, Vitest + React Testing Library + jsdom,
`@preact/signals-react` for shared state, raw Canvas 2D API (no new
dependencies — `fruit.png` and `coin.png` are already in `public/sprites/`).

**Spec:** `specs/S-006-platformer-theme/spec.md` (FR-009, FR-011, FR-012,
FR-013, FR-017b [counters — out of scope here, that's step 15], FR-020c
[respawn-preserves-facts, coins-stay-collected]) and
`specs/S-006-platformer-theme/roadmap.md` (step 12).

## Key design decisions (from chat discussion, not written to a separate spec doc per superpowers:brainstorming's bounded/architectural path — captured here instead, matching this project's precedent for the death-respawn and coins-render plans)

- **Skill coins are grouped by category, not per individual skill.** The real
  CV data has 187 individual skills — one coin per skill would need a level
  far longer than `level1` and doesn't match how skills are grouped anywhere
  else in the app (`themes/space/parade-utils.ts`'s `buildCircleEntries`
  already groups skills by `SkillCategory`, never per-individual-skill). This
  plan follows that precedent: one `coin`-type collectible per `SkillCategory`
  (~16, including any `sections`), collecting one reveals that whole
  category's skill list in the journal at once. Languages stay one collectible
  each (only 3 total) — no grouping needed there.
- **Languages render as `fruit.png`, not `coin.png`.** Both are still "coin"
  collectibles in FR-009's sense (Skills/Languages → coins, as opposed to
  Certificates/Projects → enemies or Experience/Education/Courses → blocks in
  later steps) — `fruit.png` is purely a visual variant (`spriteType` field)
  distinguishing the two content types on screen, not a new `CollectibleDef`
  category. `fruit.png` is a 64×64 grid of 16×16 static icons (4×4), not a
  spin strip like `coin.png` — fruits bob but don't spin, which doubles as a
  free visual cue that they're a different kind of pickup.
- **The flying fact-text shows the category/language name, not every
  individual skill.** A category can hold 25+ skills — the full list is only
  reasonable to show in the journal (already handles arbitrary-length lists
  via scrolling), not in a few words of flight-animation text.
- **Two separate HUD counters** (coins `x/16`, fruits `x/3`), each with a
  small icon of its own sprite so it's clear which counter measures what —
  bigger HUD footprint than step 11's single counter, but explicitly chosen
  over a combined count.
- **Full flight sequence, cheap sparkle.** Fact text hovers near the
  collection point (~0.5s), then flies to the journal icon's real screen
  position (read via a DOM ref, since the icon is a fixed-position button,
  not part of the canvas) and fades. "Sparkle" is 6 small fading dots
  radiating from the collection point over ~0.4s — not a particle system.
- **`collectedCollectibleIds` (new signal) is never touched by `resetGame()`.**
  Per FR-020c, an already-collected coin/fruit stays gone for the rest of the
  session across a death/respawn. Only a future "Reset Game" button (roadmap
  step 15, not built here) clears it and `collectedFacts` together.
- **Per-section journal counters (FR-017b) are out of scope.** That's roadmap
  step 15's job ("Bookmark tabs + counters + pagination + Reset button").
  This step only makes `Journal.tsx` render the new `SkillCategoryFact` shape
  correctly.

## Global Constraints

- TDD: write the failing test before the implementation, for every task
  (constitution Principle II).
- No `any` types (TypeScript strict mode, constitution Principle I).
- Named arrow function exports / named function exports only, no default
  exports (constitution Principle III).
- Test naming: `{method}-{Condition}-{ExpectedResult}` (constitution
  Principle II).
- No new dependencies — `coin.png`/`fruit.png` are already committed assets.
- Branch: create `S-006-step12-coin-collection` off `S-006-platformer-theme`
  (already up to date with steps 10/11/13 merged in). PR target (or direct
  merge, per this project's current preference) is `S-006-platformer-theme`,
  not `main`.

---

## Task 1: `types.ts` — `SkillCategoryFact`, widened `CollectedFact`, `CollectibleDef`

**Files:**
- Modify: `src/themes/platformer/types.ts`
- Test: `src/themes/platformer/types.test.ts` (new — `types.ts` has no test
  file yet since it previously only declared types with no runtime logic;
  this task adds one runtime-checkable helper, so a test file is now
  warranted)

**Interfaces:**
- Consumes: `Skill`, `Language` from `@/types/cv` (already imported in this
  file).
- Produces: `interface SkillCategoryFact { category: string; skills: Skill[] }`,
  widened `CollectedFact.data: CVItemData | SkillCategoryFact`,
  `isSkillCategoryFact(data: CVItemData | SkillCategoryFact): data is SkillCategoryFact`,
  `interface CollectibleDef { id: string; spriteType: 'coin' | 'fruit'; fact: CollectedFact }`.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/types.test.ts`:

```typescript
import { isSkillCategoryFact } from './types';
import type { SkillCategoryFact } from './types';
import type { Skill } from '@/types/cv';

describe('isSkillCategoryFact', () => {
  it('skillCategoryShape-returns-true', () => {
    const data: SkillCategoryFact = {
      category: 'DevOps & Tools',
      skills: [{ name: 'Docker', level: 90 }],
    };
    expect(isSkillCategoryFact(data)).toBe(true);
  });

  it('singleSkillShape-returns-false', () => {
    const data: Skill = { name: 'TypeScript', level: 90 };
    expect(isSkillCategoryFact(data)).toBe(false);
  });

  it('languageShape-returns-false', () => {
    expect(isSkillCategoryFact({ name: 'German', flag: '🇩🇪', level: 100 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/types.test.ts`
Expected: FAIL — `isSkillCategoryFact` is not exported from `./types` yet.

- [ ] **Step 3: Write the implementation**

In `src/themes/platformer/types.ts`, add after the existing `CVItemData`
union export:

```typescript
/**
 * A whole skill category's worth of skills, collected as one unit (see this
 * plan's "Key design decisions" — the real CV data has too many individual
 * skills to reasonably place one collectible each). `Skill` stays the
 * per-item shape used inside; only the fact wrapping it is category-level.
 */
export interface SkillCategoryFact {
  category: string;
  skills: Skill[];
}

/** Distinguishes a category-level skill fact from every other single-item
 *  `CVItemData` shape at runtime (needed since `data`'s type alone doesn't
 *  narrow reliably — `SkillCategoryFact` and e.g. `Project` are both plain
 *  objects with no shared discriminant field). */
export function isSkillCategoryFact(
  data: CVItemData | SkillCategoryFact,
): data is SkillCategoryFact {
  return (
    typeof data === 'object' &&
    data !== null &&
    'category' in data &&
    'skills' in data &&
    Array.isArray((data as SkillCategoryFact).skills)
  );
}
```

Then update the existing `CollectedFact` interface's `data` field:

```typescript
export interface CollectedFact {
  id: string;
  sectionId: SectionId;
  sectionLabel: string;
  data: CVItemData | SkillCategoryFact;
  sourceType: 'coin' | 'enemy' | 'block';
}
```

Finally, add at the end of the file:

```typescript
/**
 * One mapped, not-yet-placed collectible — `CollectibleMapper.ts` produces
 * these from `CVData`; `placeCollectibles` adds x/y to turn each into a
 * `CollectiblePlacement`. `id` is the dedup key `collectedCollectibleIds`
 * (PlatformerState.ts) tracks and MUST equal `fact.id` (FR-020c: collected
 * state is deduplicated by the source collectible's id) — enforced by
 * construction in `CollectibleMapper.ts`, not re-validated here.
 */
export interface CollectibleDef {
  id: string;
  spriteType: 'coin' | 'fruit';
  fact: CollectedFact;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/types.test.ts`
Expected: PASS (all 3 cases green).

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npx vitest run`
Expected: PASS — widening `CollectedFact.data`'s type is additive (union
grows), so nothing that already type-checked against the old narrower type
should break. `Journal.tsx`'s `factItemLabel` (Task 9 fixes this properly)
may show a TypeScript error here since it casts `fact.data` — if `tsc`
complains, that's expected and Task 9 fixes it; this task only needs the
*test suite* green, not `tsc` clean yet.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/types.ts src/themes/platformer/types.test.ts
git commit -m "feat(platformer): add SkillCategoryFact and CollectibleDef types"
```

---

## Task 2: `level/CollectibleMapper.ts` — CVData → placed collectibles

**Files:**
- Create: `src/themes/platformer/level/CollectibleMapper.ts`
- Test: `src/themes/platformer/level/CollectibleMapper.test.ts`

**Interfaces:**
- Consumes: `CollectibleDef` from `../types` (Task 1); `CVData`,
  `SkillCategory`, `Language` from `@/types/cv`; `tileToPixel`,
  `RENDERED_TILE_SIZE`, `isSolid`, `tileAt` from `./Terrain`; `LevelDef` from
  `./LevelData`.
- Produces: `mapCVDataToCollectibles(cv: CVData): CollectibleDef[]`,
  `interface CollectiblePlacement extends CollectibleDef { x: number; y: number }`,
  `placeCollectibles(defs: CollectibleDef[], level: LevelDef): CollectiblePlacement[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/level/CollectibleMapper.test.ts`:

```typescript
import { mapCVDataToCollectibles, placeCollectibles } from './CollectibleMapper';
import { level1 } from './level1';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from './Terrain';
import { isSkillCategoryFact } from '../types';
import type { CVData } from '@/types/cv';

const cv: CVData = {
  personality: { name: 'Test', title: 'Test', summary: '' },
  experience: [],
  skills: [
    {
      category: 'Backend',
      skills: [
        { name: 'C#', level: 90 },
        { name: '.NET', level: 85 },
      ],
    },
    {
      category: 'Frontend',
      skills: [{ name: 'React', level: 80 }],
      sections: [{ title: 'Tooling', skills: [{ name: 'Vite', level: 70 }] }],
    },
  ],
  courses: [],
  education: [],
  certificates: [],
  languages: [
    { name: 'German', flag: '🇩🇪', level: 100 },
    { name: 'English', flag: '🇬🇧', level: 90 },
  ],
  projects: [],
};

describe('mapCVDataToCollectibles', () => {
  it('called-returns-oneCoinPerCategoryPlusOneFruitPerLanguage', () => {
    const defs = mapCVDataToCollectibles(cv);
    const coins = defs.filter((d) => d.spriteType === 'coin');
    const fruits = defs.filter((d) => d.spriteType === 'fruit');
    expect(coins).toHaveLength(2); // Backend, Frontend
    expect(fruits).toHaveLength(2); // German, English
  });

  it('called-returns-uniqueIds', () => {
    const defs = mapCVDataToCollectibles(cv);
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('categoryWithSections-includesSectionSkillsInFactSkillList', () => {
    const defs = mapCVDataToCollectibles(cv);
    const frontend = defs.find((d) => d.spriteType === 'coin' && d.fact.data && isSkillCategoryFact(d.fact.data) && d.fact.data.category === 'Frontend');
    expect(frontend).toBeDefined();
    if (!frontend || !isSkillCategoryFact(frontend.fact.data)) throw new Error('unreachable');
    const names = frontend.fact.data.skills.map((s) => s.name);
    expect(names).toEqual(['React', 'Vite']);
  });

  it('languageEntry-buildsSingleLanguageFact', () => {
    const defs = mapCVDataToCollectibles(cv);
    const german = defs.find((d) => d.spriteType === 'fruit' && d.fact.sectionLabel === 'Languages' && !isSkillCategoryFact(d.fact.data) && 'name' in d.fact.data && d.fact.data.name === 'German');
    expect(german).toBeDefined();
    expect(german?.fact.sourceType).toBe('coin'); // FR-009: languages are still "coin" collectibles, spriteType is the visual-only distinction
  });

  it('noLanguages-returnsNoFruitCollectibles', () => {
    const defs = mapCVDataToCollectibles({ ...cv, languages: undefined });
    expect(defs.filter((d) => d.spriteType === 'fruit')).toHaveLength(0);
  });

  it('everyCollectedFactId-matchesItsCollectibleId', () => {
    const defs = mapCVDataToCollectibles(cv);
    expect(defs.every((d) => d.id === d.fact.id)).toBe(true);
  });
});

describe('placeCollectibles', () => {
  it('nDefs-returns-nPlacementsWithMatchingIds', () => {
    const defs = mapCVDataToCollectibles(cv);
    const placed = placeCollectibles(defs, level1);
    expect(placed).toHaveLength(defs.length);
    expect(placed.map((p) => p.id)).toEqual(defs.map((d) => d.id));
  });

  it('everyPlacement-sitsOnAnEmptyTileDirectlyAboveASolidTile', () => {
    const defs = mapCVDataToCollectibles(cv);
    const placed = placeCollectibles(defs, level1);
    for (const p of placed) {
      const col = p.x / RENDERED_TILE_SIZE;
      const row = p.y / RENDERED_TILE_SIZE;
      expect(isSolid(tileAt(level1, col, row))).toBe(false);
      expect(isSolid(tileAt(level1, col, row + 1))).toBe(true);
    }
  });

  it('manyDefs-returns-noTwoPlacementsAtTheSamePosition', () => {
    // 40 fake defs, well beyond level1's ~19 real collectibles, to exercise
    // wrapping/spacing logic without depending on real CVData volume.
    const manyDefs = Array.from({ length: 40 }, (_, i) => ({
      id: `fake-${i}`,
      spriteType: 'coin' as const,
      fact: {
        id: `fake-${i}`,
        sectionId: 'skills' as const,
        sectionLabel: 'Skills',
        data: { category: `Cat ${i}`, skills: [] },
        sourceType: 'coin' as const,
      },
    }));
    const placed = placeCollectibles(manyDefs, level1);
    const positions = placed.map((p) => `${p.x},${p.y}`);
    expect(new Set(positions).size).toBe(positions.length);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/CollectibleMapper.test.ts`
Expected: FAIL — `Cannot find module './CollectibleMapper'`.

- [ ] **Step 3: Write the implementation**

Create `src/themes/platformer/level/CollectibleMapper.ts`:

```typescript
import { tileToPixel, RENDERED_TILE_SIZE, isSolid, tileAt } from './Terrain';
import type { LevelDef } from './LevelData';
import type { CVData, SkillCategory, Skill, Language } from '@/types/cv';
import type { CollectibleDef } from '../types';

/** Lowercases and hyphenates a label into a stable id fragment (e.g.
 *  "DevOps & Tools" -> "devops-tools"). Not full slugify (no unicode
 *  normalization) — CV category/language names are plain ASCII today. */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function categoryToCollectible(category: SkillCategory): CollectibleDef {
  const skills: Skill[] = [
    ...category.skills,
    ...(category.sections?.flatMap((s) => s.skills) ?? []),
  ];
  const id = `coin-${slugify(category.category)}`;
  return {
    id,
    spriteType: 'coin',
    fact: {
      id,
      sectionId: 'skills',
      sectionLabel: 'Skills',
      data: { category: category.category, skills },
      sourceType: 'coin',
    },
  };
}

function languageToCollectible(language: Language): CollectibleDef {
  const id = `fruit-${slugify(language.name)}`;
  return {
    id,
    spriteType: 'fruit',
    fact: {
      id,
      sectionId: 'languages',
      sectionLabel: 'Languages',
      data: language,
      sourceType: 'coin', // FR-009: languages are "coin" collectibles too — spriteType is the visual-only split
    },
  };
}

/**
 * Flattens CVData into one collectible per skill category (rendered as
 * coin.png) and one per language (rendered as fruit.png) — see this plan's
 * "Key design decisions" for why categories aren't split further. Empty
 * `skills`/`languages` arrays simply produce no collectibles of that kind
 * (matches FR-013's "empty CV sections produce no collectibles").
 */
export function mapCVDataToCollectibles(cv: CVData): CollectibleDef[] {
  return [
    ...cv.skills.map(categoryToCollectible),
    ...(cv.languages ?? []).map(languageToCollectible),
  ];
}

export interface CollectiblePlacement extends CollectibleDef {
  x: number;
  y: number;
}

/**
 * Auto-distributes collectibles across the level's solid-ground columns —
 * for each column left to right, place the next collectible one tile above
 * the first solid tile in that column, skipping columns with no solid tile
 * at all (pits) and spacing placements COLLECTIBLE_SPACING_COLS apart so
 * they don't crowd. Wraps to reuse columns (offset by
 * COLLECTIBLE_SPACING_COLS / 2) if there are more collectibles than spaced
 * columns — level1 isn't designed with a specific collectible count in mind
 * yet (see this plan's "Key design decisions"), so this needs to degrade
 * gracefully rather than throw.
 */
const COLLECTIBLE_SPACING_COLS = 3;

export function placeCollectibles(
  defs: CollectibleDef[],
  level: LevelDef,
): CollectiblePlacement[] {
  const candidateCols: number[] = [];
  for (let col = 0; col < level.width; col++) {
    for (let row = 0; row < level.height - 1; row++) {
      if (!isSolid(tileAt(level, col, row)) && isSolid(tileAt(level, col, row + 1))) {
        candidateCols.push(col);
        break; // first empty-above-solid row in this column is enough
      }
    }
  }

  const spacedCols = candidateCols.filter((_, i) => i % COLLECTIBLE_SPACING_COLS === 0);
  const pool = spacedCols.length > 0 ? spacedCols : candidateCols;

  return defs.map((def, i) => {
    const col = pool[i % pool.length];
    // Re-derive the row for this column (cheap; candidateCols doesn't carry
    // row along, and a column can only match once per the break above).
    let row = 0;
    for (let r = 0; r < level.height - 1; r++) {
      if (!isSolid(tileAt(level, col, r)) && isSolid(tileAt(level, col, r + 1))) {
        row = r;
        break;
      }
    }
    // When wrapping past the pool once, offset onto a second candidate row
    // in the same column isn't tracked — instead nudge vertically by one
    // extra tile per full wrap so repeated columns don't stack exactly.
    const wrapOffset = Math.floor(i / pool.length);
    const { x, y } = tileToPixel(col, row - wrapOffset);
    return { ...def, x, y };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/CollectibleMapper.test.ts`
Expected: PASS. If `manyDefs-returns-noTwoPlacementsAtTheSamePosition` fails
because `level1`'s solid-column count times wrap offsets still collides,
increase the wrap vertical nudge (e.g. 2 tiles instead of 1) until it's
unique — the test's job is to catch exactly this, so trust it over the
sketch above.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/CollectibleMapper.ts src/themes/platformer/level/CollectibleMapper.test.ts
git commit -m "feat(platformer): add CollectibleMapper — CVData to placed collectibles"
```

---

## Task 3: `engine/Collision.ts` — player/collectible AABB overlap

**Files:**
- Create: `src/themes/platformer/engine/Collision.ts`
- Test: `src/themes/platformer/engine/Collision.test.ts`

**Interfaces:**
- Consumes: `PLAYER_RENDERED_SIZE, PLAYER_SIDE_PADDING, PLAYER_HEAD_PADDING, PLAYER_FOOT_PADDING` from `../entities/Player`; `PlayerState` type from `../entities/Player`; `COIN_RENDERED_SIZE` from `../entities/Coin`; `CollectiblePlacement` from `../level/CollectibleMapper` (Task 2).
- Produces: `interface Box { x: number; y: number; width: number; height: number }`,
  `playerHitbox(player: PlayerState): Box`,
  `aabbOverlap(a: Box, b: Box): boolean`,
  `checkCollectibleCollisions(player: PlayerState, placements: CollectiblePlacement[], collectedIds: ReadonlySet<string>): string[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/engine/Collision.test.ts`:

```typescript
import { playerHitbox, aabbOverlap, checkCollectibleCollisions } from './Collision';
import { PLAYER_SIDE_PADDING, PLAYER_HEAD_PADDING, PLAYER_RENDERED_SIZE } from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import type { CollectiblePlacement } from '../level/CollectibleMapper';

function makePlayer(x: number, y: number): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 'right',
    grounded: true,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
  };
}

function makePlacement(id: string, x: number, y: number): CollectiblePlacement {
  return {
    id,
    spriteType: 'coin',
    fact: { id, sectionId: 'skills', sectionLabel: 'Skills', data: { category: 'X', skills: [] }, sourceType: 'coin' },
    x,
    y,
  };
}

describe('playerHitbox', () => {
  it('playerAtOrigin-returns-boxNarrowerThanRenderedSize', () => {
    const box = playerHitbox(makePlayer(0, 0));
    expect(box.x).toBe(PLAYER_SIDE_PADDING);
    expect(box.y).toBe(PLAYER_HEAD_PADDING);
    expect(box.width).toBe(PLAYER_RENDERED_SIZE - 2 * PLAYER_SIDE_PADDING);
  });
});

describe('aabbOverlap', () => {
  it('identicalBoxes-returns-true', () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    expect(aabbOverlap(box, box)).toBe(true);
  });

  it('touchingEdges-returns-false', () => {
    expect(aabbOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
  });

  it('farApart-returns-false', () => {
    expect(aabbOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 1000, y: 1000, width: 10, height: 10 })).toBe(false);
  });

  it('overlapping-returns-true', () => {
    expect(aabbOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });
});

describe('checkCollectibleCollisions', () => {
  it('playerOverlappingOnePlacement-returns-itsId', () => {
    const player = makePlayer(0, 0);
    const placements = [makePlacement('a', 0, 0)];
    expect(checkCollectibleCollisions(player, placements, new Set())).toEqual(['a']);
  });

  it('playerFarFromEveryPlacement-returns-emptyArray', () => {
    const player = makePlayer(0, 0);
    const placements = [makePlacement('a', 2000, 2000)];
    expect(checkCollectibleCollisions(player, placements, new Set())).toEqual([]);
  });

  it('overlappingButAlreadyCollected-excludesIt', () => {
    const player = makePlayer(0, 0);
    const placements = [makePlacement('a', 0, 0)];
    expect(checkCollectibleCollisions(player, placements, new Set(['a']))).toEqual([]);
  });

  it('overlappingTwoPlacements-returns-bothIds', () => {
    const player = makePlayer(0, 0);
    const placements = [makePlacement('a', 0, 0), makePlacement('b', 5, 5)];
    expect(checkCollectibleCollisions(player, placements, new Set())).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Collision.test.ts`
Expected: FAIL — `Cannot find module './Collision'`.

- [ ] **Step 3: Write the implementation**

Create `src/themes/platformer/engine/Collision.ts`:

```typescript
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_SIDE_PADDING,
  PLAYER_HEAD_PADDING,
  PLAYER_FOOT_PADDING,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import { COIN_RENDERED_SIZE } from '../entities/Coin';
import type { CollectiblePlacement } from '../level/CollectibleMapper';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The player's collision box — same narrower-than-render-slot box
 * Physics.ts's terrain collision already uses (PLAYER_SIDE_PADDING on each
 * side, PLAYER_HEAD_PADDING off the top, PLAYER_FOOT_PADDING off the
 * bottom), so a coin the player's sprite art doesn't actually touch never
 * registers as collected.
 */
export function playerHitbox(player: PlayerState): Box {
  return {
    x: player.x + PLAYER_SIDE_PADDING,
    y: player.y + PLAYER_HEAD_PADDING,
    width: PLAYER_RENDERED_SIZE - 2 * PLAYER_SIDE_PADDING,
    height: PLAYER_RENDERED_SIZE - PLAYER_HEAD_PADDING - PLAYER_FOOT_PADDING,
  };
}

/** Standard axis-aligned bounding box overlap — touching edges (zero-area
 *  intersection) do not count as overlapping. */
export function aabbOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Returns the ids of every placement the player's hitbox currently overlaps,
 * excluding ids already in `collectedIds` — collision against an
 * already-collected (visually removed) collectible is a no-op, not a
 * duplicate-collect (FR-020c). Uses each placement's fixed x/y, ignoring the
 * cosmetic bob offset (Renderer.ts's drawCoins/drawCollectibles) so the
 * hitbox doesn't jitter a few pixels every frame independent of the sprite.
 */
export function checkCollectibleCollisions(
  player: PlayerState,
  placements: CollectiblePlacement[],
  collectedIds: ReadonlySet<string>,
): string[] {
  const hitbox = playerHitbox(player);
  const collected: string[] = [];
  for (const placement of placements) {
    if (collectedIds.has(placement.id)) continue;
    const box: Box = {
      x: placement.x,
      y: placement.y,
      width: COIN_RENDERED_SIZE,
      height: COIN_RENDERED_SIZE,
    };
    if (aabbOverlap(hitbox, box)) collected.push(placement.id);
  }
  return collected;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Collision.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Collision.ts src/themes/platformer/engine/Collision.test.ts
git commit -m "feat(platformer): add player/collectible AABB collision detection"
```

---

## Task 4: `entities/Fruit.ts` — static fruit icon frame math

**Files:**
- Create: `src/themes/platformer/entities/Fruit.ts`
- Test: `src/themes/platformer/entities/Fruit.test.ts`

**Interfaces:**
- Produces: `FRUIT_FRAME_SIZE: number`, `FRUIT_RENDERED_SIZE: number`,
  `FRUIT_ICON_COUNT: number`, `fruitFrameSource(index: number): { sx: number; sy: number }`.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/entities/Fruit.test.ts`:

```typescript
import { FRUIT_FRAME_SIZE, FRUIT_ICON_COUNT, fruitFrameSource } from './Fruit';

describe('fruitFrameSource', () => {
  it('indexZero-returnsTopLeftOfSheet', () => {
    expect(fruitFrameSource(0)).toEqual({ sx: 0, sy: 0 });
  });

  it('indexOne-returnsSecondColumn', () => {
    expect(fruitFrameSource(1)).toEqual({ sx: FRUIT_FRAME_SIZE, sy: 0 });
  });

  it('indexEqualToRowWidth-wrapsToSecondRow', () => {
    // fruit.png is a 4x4 grid (64x64 / 16px frames) — index 4 is the start
    // of row 2.
    const rowWidth = 4;
    expect(fruitFrameSource(rowWidth)).toEqual({ sx: 0, sy: FRUIT_FRAME_SIZE });
  });

  it('indexBeyondIconCount-wraps', () => {
    expect(fruitFrameSource(FRUIT_ICON_COUNT)).toEqual(fruitFrameSource(0));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/entities/Fruit.test.ts`
Expected: FAIL — `Cannot find module './Fruit'`.

- [ ] **Step 3: Write the implementation**

Create `src/themes/platformer/entities/Fruit.ts`:

```typescript
import { RENDER_SCALE } from '../level/Terrain';

/** `fruit.png` is a 64x64 grid of static 16x16 icons (4x4 = 16 distinct
 *  fruits) — unlike coin.png, it's not an animation strip. Fruits bob (see
 *  Coin.ts's coinBobOffset, reused as-is — bobbing is visual, not
 *  coin-specific) but never change frame. */
export const FRUIT_FRAME_SIZE = 16;
export const FRUIT_RENDERED_SIZE = FRUIT_FRAME_SIZE * RENDER_SCALE;
const FRUIT_GRID_COLUMNS = 4;
export const FRUIT_ICON_COUNT = 16;

/** Sprite-sheet source rect for a given icon index (wraps at
 *  FRUIT_ICON_COUNT, row-major left-to-right top-to-bottom). */
export function fruitFrameSource(index: number): { sx: number; sy: number } {
  const wrapped = ((index % FRUIT_ICON_COUNT) + FRUIT_ICON_COUNT) % FRUIT_ICON_COUNT;
  const col = wrapped % FRUIT_GRID_COLUMNS;
  const row = Math.floor(wrapped / FRUIT_GRID_COLUMNS);
  return { sx: col * FRUIT_FRAME_SIZE, sy: row * FRUIT_FRAME_SIZE };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/Fruit.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/Fruit.ts src/themes/platformer/entities/Fruit.test.ts
git commit -m "feat(platformer): add static fruit icon frame math"
```

---

## Task 5: `engine/CollectionEffects.ts` — fact-flight + sparkle animation math

**Files:**
- Create: `src/themes/platformer/engine/CollectionEffects.ts`
- Test: `src/themes/platformer/engine/CollectionEffects.test.ts`

**Interfaces:**
- Produces: `HOVER_DURATION_SECONDS: number`, `FLIGHT_DURATION_SECONDS: number`,
  `SPARKLE_DURATION_SECONDS: number`,
  `interface FlightEffect { id: string; text: string; startX: number; startY: number; targetX: number; targetY: number; elapsed: number; phase: 'hover' | 'flying' | 'done' }`,
  `startFlightEffect(id: string, text: string, startX: number, startY: number, targetX: number, targetY: number): FlightEffect`,
  `tickFlightEffect(effect: FlightEffect, dt: number): FlightEffect`,
  `flightEffectPosition(effect: FlightEffect): { x: number; y: number; opacity: number }`,
  `interface SparkleParticle { dx: number; dy: number; opacity: number }`,
  `sparkleParticles(elapsedSinceCollect: number): SparkleParticle[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/engine/CollectionEffects.test.ts`:

```typescript
import {
  HOVER_DURATION_SECONDS,
  FLIGHT_DURATION_SECONDS,
  SPARKLE_DURATION_SECONDS,
  startFlightEffect,
  tickFlightEffect,
  flightEffectPosition,
  sparkleParticles,
} from './CollectionEffects';

describe('startFlightEffect', () => {
  it('called-returns-hoverPhaseAtZeroElapsed', () => {
    const effect = startFlightEffect('a', 'German', 10, 20, 500, 600);
    expect(effect).toEqual({
      id: 'a',
      text: 'German',
      startX: 10,
      startY: 20,
      targetX: 500,
      targetY: 600,
      elapsed: 0,
      phase: 'hover',
    });
  });
});

describe('tickFlightEffect', () => {
  it('withinHoverDuration-staysHoverPhase', () => {
    const effect = tickFlightEffect(startFlightEffect('a', 't', 0, 0, 0, 0), HOVER_DURATION_SECONDS / 2);
    expect(effect.phase).toBe('hover');
  });

  it('pastHoverDuration-transitionsToFlyingPhase', () => {
    const effect = tickFlightEffect(startFlightEffect('a', 't', 0, 0, 0, 0), HOVER_DURATION_SECONDS + 0.01);
    expect(effect.phase).toBe('flying');
  });

  it('pastHoverPlusFlightDuration-transitionsToDonePhase', () => {
    const effect = tickFlightEffect(
      startFlightEffect('a', 't', 0, 0, 0, 0),
      HOVER_DURATION_SECONDS + FLIGHT_DURATION_SECONDS + 0.01,
    );
    expect(effect.phase).toBe('done');
  });

  it('donePhase-tickedAgain-returnsSameReference', () => {
    const done = tickFlightEffect(
      startFlightEffect('a', 't', 0, 0, 0, 0),
      HOVER_DURATION_SECONDS + FLIGHT_DURATION_SECONDS + 0.01,
    );
    expect(tickFlightEffect(done, 1)).toBe(done);
  });
});

describe('flightEffectPosition', () => {
  it('hoverPhase-staysNearStartWithFullOpacity', () => {
    const effect = tickFlightEffect(startFlightEffect('a', 't', 100, 100, 900, 900), HOVER_DURATION_SECONDS / 2);
    const pos = flightEffectPosition(effect);
    expect(pos.x).toBeCloseTo(100, 0);
    expect(pos.opacity).toBe(1);
  });

  it('flightStart-positionedAtStart', () => {
    const effect = tickFlightEffect(startFlightEffect('a', 't', 100, 100, 900, 900), HOVER_DURATION_SECONDS);
    const pos = flightEffectPosition(effect);
    expect(pos.x).toBeCloseTo(100);
    expect(pos.y).toBeCloseTo(100);
  });

  it('flightEnd-positionedAtTargetWithZeroOpacity', () => {
    const effect = tickFlightEffect(
      startFlightEffect('a', 't', 100, 100, 900, 900),
      HOVER_DURATION_SECONDS + FLIGHT_DURATION_SECONDS,
    );
    const pos = flightEffectPosition(effect);
    expect(pos.x).toBeCloseTo(900);
    expect(pos.y).toBeCloseTo(900);
    expect(pos.opacity).toBeCloseTo(0, 1);
  });

  it('donePhase-returnsZeroOpacity', () => {
    const effect = tickFlightEffect(startFlightEffect('a', 't', 0, 0, 0, 0), 100);
    expect(flightEffectPosition(effect).opacity).toBe(0);
  });
});

describe('sparkleParticles', () => {
  it('elapsedZero-returnsSixParticlesAtFullOpacity', () => {
    const particles = sparkleParticles(0);
    expect(particles).toHaveLength(6);
    expect(particles.every((p) => p.opacity === 1)).toBe(true);
    expect(particles.every((p) => p.dx === 0 && p.dy === 0)).toBe(true);
  });

  it('midway-particlesHaveMovedAndFadedPartially', () => {
    const particles = sparkleParticles(SPARKLE_DURATION_SECONDS / 2);
    expect(particles.some((p) => p.dx !== 0 || p.dy !== 0)).toBe(true);
    expect(particles[0].opacity).toBeCloseTo(0.5);
  });

  it('pastDuration-returnsEmptyArray', () => {
    expect(sparkleParticles(SPARKLE_DURATION_SECONDS + 0.01)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/CollectionEffects.test.ts`
Expected: FAIL — `Cannot find module './CollectionEffects'`.

- [ ] **Step 3: Write the implementation**

Create `src/themes/platformer/engine/CollectionEffects.ts`:

```typescript
/** Seconds the fact text lingers near the collection point before flying
 *  off, and how long the flight itself takes. */
export const HOVER_DURATION_SECONDS = 0.5;
export const FLIGHT_DURATION_SECONDS = 0.6;

/**
 * One in-flight collected-fact animation. `startX/startY` and
 * `targetX/targetY` are both SCREEN-space (not world-space) — computed once
 * at collection time by the caller (PlatformerPage.tsx, Task 8) using the
 * camera origin at that instant, since the animation is short-lived (~1.1s)
 * and re-deriving world-to-screen every frame isn't worth the complexity for
 * an effect this brief. `text` is the short label shown while flying (the
 * category or language name — see this plan's "Key design decisions" for
 * why it's not the full skill list).
 */
export interface FlightEffect {
  id: string;
  text: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  elapsed: number;
  phase: 'hover' | 'flying' | 'done';
}

export function startFlightEffect(
  id: string,
  text: string,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
): FlightEffect {
  return { id, text, startX, startY, targetX, targetY, elapsed: 0, phase: 'hover' };
}

/** Advances the effect by `dt` seconds, transitioning hover -> flying ->
 *  done as HOVER_DURATION_SECONDS then FLIGHT_DURATION_SECONDS elapse.
 *  No-op (same reference) once `done`. */
export function tickFlightEffect(effect: FlightEffect, dt: number): FlightEffect {
  if (effect.phase === 'done') return effect;
  const elapsed = effect.elapsed + dt;
  if (elapsed >= HOVER_DURATION_SECONDS + FLIGHT_DURATION_SECONDS) {
    return { ...effect, elapsed, phase: 'done' };
  }
  return { ...effect, elapsed, phase: elapsed >= HOVER_DURATION_SECONDS ? 'flying' : 'hover' };
}

/** A gentle upward drift while hovering, so the text doesn't feel frozen in
 *  place even before it starts flying. */
const HOVER_RISE_PX = 12;

/**
 * Current screen-space position and opacity (0-1) to draw the fact text at.
 * `hover`: drifts upward from startY, full opacity. `flying`: linearly
 * interpolates start -> target, fading out over the final 40% of the flight
 * so it doesn't pop out of existence right at the icon. `done`: invisible.
 */
export function flightEffectPosition(effect: FlightEffect): { x: number; y: number; opacity: number } {
  if (effect.phase === 'done') {
    return { x: effect.targetX, y: effect.targetY, opacity: 0 };
  }
  if (effect.phase === 'hover') {
    const progress = Math.min(1, effect.elapsed / HOVER_DURATION_SECONDS);
    return { x: effect.startX, y: effect.startY - HOVER_RISE_PX * progress, opacity: 1 };
  }
  const flightElapsed = effect.elapsed - HOVER_DURATION_SECONDS;
  const progress = Math.min(1, flightElapsed / FLIGHT_DURATION_SECONDS);
  const x = effect.startX + (effect.targetX - effect.startX) * progress;
  const y = effect.startY - HOVER_RISE_PX + (effect.targetY - (effect.startY - HOVER_RISE_PX)) * progress;
  const opacity = progress < 0.6 ? 1 : 1 - (progress - 0.6) / 0.4;
  return { x, y, opacity };
}

export const SPARKLE_DURATION_SECONDS = 0.4;
const SPARKLE_COUNT = 6;
const SPARKLE_MAX_RADIUS = 18;

export interface SparkleParticle {
  dx: number;
  dy: number;
  opacity: number;
}

/**
 * A fixed ring of small dots radiating outward from a collection point and
 * fading, in place of a full particle system — see this plan's "Key design
 * decisions". Returns offsets (dx/dy) relative to the collection point, not
 * absolute positions, so the caller (Renderer.ts, Task 6) just adds them to
 * wherever the collectible was.
 */
export function sparkleParticles(elapsedSinceCollect: number): SparkleParticle[] {
  if (elapsedSinceCollect < 0 || elapsedSinceCollect > SPARKLE_DURATION_SECONDS) return [];
  const progress = elapsedSinceCollect / SPARKLE_DURATION_SECONDS;
  const radius = SPARKLE_MAX_RADIUS * progress;
  const opacity = 1 - progress;
  return Array.from({ length: SPARKLE_COUNT }, (_, i) => {
    const angle = (i / SPARKLE_COUNT) * Math.PI * 2;
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius, opacity };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/CollectionEffects.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/CollectionEffects.ts src/themes/platformer/engine/CollectionEffects.test.ts
git commit -m "feat(platformer): add fact-flight and sparkle collection-effect math"
```

---

## Task 6: `Renderer.ts` — draw collectibles, effects, and two counters

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `CollectiblePlacement` from `../level/CollectibleMapper` (Task 2);
  `FlightEffect, flightEffectPosition, SparkleParticle, sparkleParticles` from
  `./CollectionEffects` (Task 5); `FRUIT_FRAME_SIZE, FRUIT_RENDERED_SIZE, fruitFrameSource`
  from `../entities/Fruit` (Task 4); existing `COIN_FRAME_SIZE, COIN_RENDERED_SIZE,
  coinFrameIndex, coinFrameSource, coinBobOffset` from `../entities/Coin`.
- Produces: `drawCollectibles(ctx, placements: CollectiblePlacement[], coinSprite: HTMLImageElement, fruitSprite: HTMLImageElement, collectedIds: ReadonlySet<string>, elapsedSeconds: number, originX?, originY?): void`
  (replaces `drawCoins` — same call sites, wider signature),
  `drawCollectionEffects(ctx, effects: FlightEffect[]): void` (screen-space,
  no origin params — effect positions are already screen-space per Task 5),
  `drawCollectibleCounter(ctx, icon: HTMLImageElement, iconFrame: { sx: number; sy: number; size: number }, collected: number, max: number, x: number, y: number): void`
  (replaces `drawCoinCounter` — generalized to take an explicit position so
  it can be called twice).

This task ADDS `drawCollectibles`/`drawCollectionEffects`/`drawCollectibleCounter`
alongside the still-in-use `drawCoins`/`drawCoinCounter` — it does NOT remove
the old functions yet. `PlatformerPage.tsx` still calls
`drawCoins`/`drawCoinCounter` until Task 8 rewires it; deleting them here
would leave the build broken between this task's commit and Task 8's. Task 8
removes `drawCoins`/`drawCoinCounter` (and their tests, and the now-dead
`CoinPlacement` type in `entities/Coin.ts`) as part of switching
`PlatformerPage.tsx` over to the new functions, so every task's commit stays
independently green.

- [ ] **Step 1: Write the failing tests for the new draw functions**

Add to `src/themes/platformer/engine/Renderer.test.ts`'s top imports:

```typescript
import {
  drawTerrain,
  drawPlayer,
  drawHearts,
  drawCollectibles,
  drawCollectionEffects,
  drawCollectibleCounter,
  drawIrisOverlay,
  drawRestartPrompt,
  RESTART_PROMPT_FONT_FAMILY,
} from './Renderer';
import { startFlightEffect, tickFlightEffect, HOVER_DURATION_SECONDS } from './CollectionEffects';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
```

Then add these test blocks (anywhere after `makeMockContext`):

```typescript
function makePlacement(id: string, spriteType: 'coin' | 'fruit', x: number, y: number): CollectiblePlacement {
  return {
    id,
    spriteType,
    fact: { id, sectionId: 'skills', sectionLabel: 'Skills', data: { category: 'X', skills: [] }, sourceType: 'coin' },
    x,
    y,
  };
}

describe('drawCollectibles', () => {
  it('coinAndFruit-drawEachFromItsOwnSprite', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const coinSprite = { tag: 'coin' } as unknown as HTMLImageElement;
    const fruitSprite = { tag: 'fruit' } as unknown as HTMLImageElement;
    const placements = [makePlacement('a', 'coin', 100, 100), makePlacement('b', 'fruit', 300, 300)];

    drawCollectibles(ctx as unknown as CanvasRenderingContext2D, placements, coinSprite, fruitSprite, new Set(), 0);

    const calls = ctx.drawImage.mock.calls;
    expect(calls.some((c: unknown[]) => c[0] === coinSprite)).toBe(true);
    expect(calls.some((c: unknown[]) => c[0] === fruitSprite)).toBe(true);
  });

  it('collectedId-isSkipped', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const placements = [makePlacement('a', 'coin', 100, 100)];

    drawCollectibles(
      ctx as unknown as CanvasRenderingContext2D,
      placements,
      {} as HTMLImageElement,
      {} as HTMLImageElement,
      new Set(['a']),
      0,
    );

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawCollectionEffects', () => {
  it('hoveringEffect-drawsTextAtStartPosition', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effect = tickFlightEffect(startFlightEffect('a', 'German', 50, 60, 900, 900), HOVER_DURATION_SECONDS / 2);

    drawCollectionEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.fillText).toHaveBeenCalledWith('German', 50, expect.any(Number));
  });

  it('noEffects-doesNotCallFillText', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    drawCollectionEffects(ctx as unknown as CanvasRenderingContext2D, []);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});

describe('drawCollectibleCounter', () => {
  it('called-drawsIconThenSpacedText', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
      font: string;
    };
    const icon = {} as HTMLImageElement;

    drawCollectibleCounter(ctx as unknown as CanvasRenderingContext2D, icon, { sx: 0, sy: 0, size: 16 }, 3, 16, 200, 20);

    expect(ctx.drawImage).toHaveBeenCalledWith(icon, 0, 0, 16, 16, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('3 / 16', expect.any(Number), expect.any(Number));
    expect(ctx.font).toBe(`16px "${RESTART_PROMPT_FONT_FAMILY}", monospace`);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL — `drawCollectibles`/`drawCollectionEffects`/`drawCollectibleCounter`
are not exported from `./Renderer` yet.

- [ ] **Step 3: Write the implementation**

Add to the top of `src/themes/platformer/engine/Renderer.ts` (alongside the
existing `../entities/Coin` import):

```typescript
import { FRUIT_FRAME_SIZE, fruitFrameSource } from '../entities/Fruit';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import { flightEffectPosition } from './CollectionEffects';
import type { FlightEffect } from './CollectionEffects';
```

Add where `drawCoins`/`drawCoinCounter` used to be (see Step 1):

```typescript
/**
 * Draws every not-yet-collected placement — coins spin (Coin.ts's
 * coinFrameIndex/coinFrameSource) from `coinSprite`, fruits stay on one
 * fixed icon frame (Fruit.ts's fruitFrameSource, keyed by a stable index
 * derived from the placement's position in the array — good enough for
 * visual variety without needing to store a chosen index per placement)
 * from `fruitSprite`. Both bob (Coin.ts's coinBobOffset, shared — bobbing
 * isn't coin-specific). Same originX/originY convention as
 * drawTerrain/drawPlayer.
 */
export function drawCollectibles(
  ctx: CanvasRenderingContext2D,
  placements: CollectiblePlacement[],
  coinSprite: HTMLImageElement,
  fruitSprite: HTMLImageElement,
  collectedIds: ReadonlySet<string>,
  elapsedSeconds: number,
  originX = 0,
  originY = 0,
): void {
  ctx.imageSmoothingEnabled = false;

  const coinFrame = coinFrameIndex(elapsedSeconds);
  const coinSource = coinFrameSource(coinFrame);
  const bob = coinBobOffset(elapsedSeconds);

  let fruitIndex = 0;
  for (const placement of placements) {
    if (collectedIds.has(placement.id)) continue;

    if (placement.spriteType === 'coin') {
      ctx.drawImage(
        coinSprite,
        coinSource.sx,
        coinSource.sy,
        COIN_FRAME_SIZE,
        COIN_FRAME_SIZE,
        placement.x + originX,
        placement.y + originY + bob,
        COIN_RENDERED_SIZE,
        COIN_RENDERED_SIZE,
      );
    } else {
      const { sx, sy } = fruitFrameSource(fruitIndex);
      fruitIndex += 1;
      ctx.drawImage(
        fruitSprite,
        sx,
        sy,
        FRUIT_FRAME_SIZE,
        FRUIT_FRAME_SIZE,
        placement.x + originX,
        placement.y + originY + bob,
        COIN_RENDERED_SIZE,
        COIN_RENDERED_SIZE,
      );
    }
  }
}

const COLLECTION_EFFECT_FONT_SIZE = 14;

/** Draws every active collection-effect's fact text at its current
 *  hover/flight position and opacity (see CollectionEffects.ts). Positions
 *  are already screen-space (no originX/originY here — unlike
 *  drawCollectibles, this doesn't scroll with the camera; see
 *  CollectionEffects.ts's FlightEffect doc comment). */
export function drawCollectionEffects(ctx: CanvasRenderingContext2D, effects: FlightEffect[]): void {
  for (const effect of effects) {
    const { x, y, opacity } = flightEffectPosition(effect);
    if (opacity <= 0) continue;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#fff';
    ctx.font = `${COLLECTION_EFFECT_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(effect.text, x, y);
    ctx.restore();
  }
}

const COUNTER_ICON_SIZE = 20;
const COUNTER_TEXT_GAP = 6;

/**
 * Draws one "[icon] collected / max" counter at a caller-chosen fixed screen
 * position — generalized from step 11's single hardcoded-position
 * drawCoinCounter so PlatformerPage.tsx (Task 8) can place a coin counter
 * and a fruit counter side by side, each with its own sprite icon so it's
 * visually unambiguous which counter measures what.
 */
export function drawCollectibleCounter(
  ctx: CanvasRenderingContext2D,
  icon: HTMLImageElement,
  iconFrame: { sx: number; sy: number; size: number },
  collected: number,
  max: number,
  x: number,
  y: number,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    icon,
    iconFrame.sx,
    iconFrame.sy,
    iconFrame.size,
    iconFrame.size,
    x,
    y - COUNTER_ICON_SIZE / 2,
    COUNTER_ICON_SIZE,
    COUNTER_ICON_SIZE,
  );

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `16px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${collected} / ${max}`, x + COUNTER_ICON_SIZE + COUNTER_TEXT_GAP, y);
  ctx.restore();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS (all cases — the pre-existing `drawCoins`/`drawCoinCounter`
tests AND this task's new ones — green; `drawCoins`/`drawCoinCounter`
themselves are untouched by this task).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): render collectibles, collection effects, and two counters"
```

---

## Task 7: `PlatformerState.ts` — real collectibles, collected-ids, active effects

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`
- Modify: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Consumes: `mapCVDataToCollectibles, placeCollectibles` from
  `./level/CollectibleMapper` (Task 2); `currentCV` from `@/state/locale`
  (existing signal, see `themes/space/parade-utils.ts`'s usage for
  precedent); `FlightEffect` from `./engine/CollectionEffects` (Task 5);
  `level1` from `./level/level1`.
- Produces: `collectiblePlacements: CollectiblePlacement[]` (plain constant,
  not a signal — computed once from `currentCV.value` at module load, same
  as `level1` itself is a plain constant, not locale-reactive; theme-switch
  reset, roadmap step 25, is the eventual place to make this locale-aware),
  `collectedCollectibleIds: Signal<Set<string>>` (starts empty, NEVER reset
  by `resetGame()` — see Task 8), `activeEffects: Signal<FlightEffect[]>`
  (starts empty). Removes: `SEED_COLLECTED_FACTS`, changes `collectedFacts`'s
  initial value to `[]`.

- [ ] **Step 1: Write the failing tests**

In `src/themes/platformer/PlatformerState.test.ts`, add to the existing
import from `./PlatformerState`:

```typescript
import {
  playerState,
  cameraPositionX,
  healthState,
  lifecycleState,
  collectedFacts,
  collectiblePlacements,
  collectedCollectibleIds,
  activeEffects,
  resetGame,
} from './PlatformerState';
```

Add these test blocks:

```typescript
  it('collectedFacts-initial-isEmpty', () => {
    expect(collectedFacts.value).toEqual([]);
  });

  it('collectiblePlacements-initial-isNonEmptyAndMatchesCVData', () => {
    // Real CVData has skill categories + languages — exact count isn't
    // pinned here (that's CollectibleMapper.test.ts's job against fixture
    // data), just that real data produces a real, non-trivial list.
    expect(collectiblePlacements.length).toBeGreaterThan(0);
  });

  it('collectedCollectibleIds-initial-isEmptySet', () => {
    expect(collectedCollectibleIds.value.size).toBe(0);
  });

  it('activeEffects-initial-isEmptyArray', () => {
    expect(activeEffects.value).toEqual([]);
  });

  it('resetGame-calledAfterCollectingAndFactsAdded-doesNotClearCollectedStateOrFacts', () => {
    collectedCollectibleIds.value = new Set(['coin-backend']);
    collectedFacts.value = [
      { id: 'coin-backend', sectionId: 'skills', sectionLabel: 'Skills', data: { category: 'Backend', skills: [] }, sourceType: 'coin' },
    ];

    resetGame();

    // FR-020c: collected coins/facts survive a death/respawn reset.
    expect(collectedCollectibleIds.value.has('coin-backend')).toBe(true);
    expect(collectedFacts.value).toHaveLength(1);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: FAIL — `collectiblePlacements`, `collectedCollectibleIds`,
`activeEffects` are not exported yet; `collectedFacts.value` is currently
the 2-item seed data, not `[]`.

- [ ] **Step 3: Write the implementation**

In `src/themes/platformer/PlatformerState.ts`:

Add imports (alongside the existing ones):

```typescript
import { currentCV } from '@/state/locale';
import { mapCVDataToCollectibles, placeCollectibles } from './level/CollectibleMapper';
import { level1 } from './level/level1';
import type { CollectiblePlacement } from './level/CollectibleMapper';
import type { FlightEffect } from './engine/CollectionEffects';
```

Replace the entire `SEED_COLLECTED_FACTS` constant and the `collectedFacts`
export with:

```typescript
/**
 * Every collectible in the level, placed once at module load from the
 * current locale's CVData (see `@/state/locale`'s `currentCV`) — a plain
 * constant, not a signal, matching `level1`: neither is locale-reactive yet
 * (switching EN/DE mid-session doesn't re-place collectibles or change
 * which are already collected; that's roadmap step 25's theme-switch-reset
 * job, not this step's).
 */
export const collectiblePlacements: CollectiblePlacement[] = placeCollectibles(
  mapCVDataToCollectibles(currentCV.value),
  level1,
);

/**
 * Facts discovered so far this session (see spec.md FR-032). Starts empty —
 * step 12 (this step) is what actually populates it via real coin/fruit
 * collection; the temporary two-item seed data step 13 relied on to verify
 * the journal skeleton is gone.
 */
export const collectedFacts = signal<CollectedFact[]>([]);

/**
 * Ids of every collected-and-removed collectible this session (dedup key,
 * FR-020c) — kept separate from `collectedFacts` since a collectible's
 * removal-from-the-world state and its fact-content-in-the-journal state,
 * while always updated together (see PlatformerPage.tsx's collection
 * handler, Task 8), are conceptually different concerns, matching how
 * `healthState`/`playerState` are already kept separate.
 */
export const collectedCollectibleIds = signal<Set<string>>(new Set());

/** Currently animating fact-flight/sparkle effects (see engine/CollectionEffects.ts). */
export const activeEffects = signal<FlightEffect[]>([]);
```

Update `resetGame()`'s doc comment to note the new exception (the function
body itself needs no code change — it already only touches
`playerState`/`healthState`/`cameraPositionX`):

```typescript
/**
 * Resets the game world to its spawn state: player back at the spawn point,
 * full health, camera scrolled back to the level start. Does NOT touch
 * `lifecycleState`, `collectedFacts`, or `collectedCollectibleIds` — per
 * FR-020c, a death/respawn preserves everything already discovered; only a
 * future "Reset Game" button (roadmap step 15) clears those. Callers
 * (Task 5's restart-on-input and debug Respawn button, both wired to the
 * `intro` iris-in) decide the lifecycle transition themselves, since not
 * every future caller of a "reset" necessarily wants the iris animation.
 *
 * This is the single reset seam other roadmap steps extend: step 15's
 * "Reset Game" button will additionally need to clear collected facts and
 * respawn enemies/coins/blocks once those exist — this task doesn't build
 * any of that, it only resets what already exists (position, health,
 * camera).
 */
export function resetGame(): void {
  playerState.value = spawnPlayerState();
  healthState.value = MAX_HALF_HEARTS;
  cameraPositionX.value = 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: PASS (all cases, old and new, green).

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npx vitest run`
Expected: `PlatformerPage.test.tsx` and `Journal.test.tsx` will very likely
now FAIL — both currently assert against the 2-item `SEED_COLLECTED_FACTS`
(e.g. a test asserting the journal shows "TypeScript" or "German" from seed
data on mount with no collection happening). This is expected at this point
in the plan — Task 8 and Task 9 fix `PlatformerPage.test.tsx` and
`Journal.test.tsx` respectively. Do not attempt to fix them in this task;
just confirm the *only* new failures are in those two files and that the
failure reason is specifically the removed seed data (e.g. "expected to find
element with text: TypeScript" type failures), not something else — if
anything else fails, stop and investigate before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): wire real collectible placements and collected-state signals"
```

---

## Task 8: `PlatformerPage.tsx` — collision detection, collection handling, rendering

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/PlatformerPage.test.tsx`
- Modify: `src/themes/platformer/engine/Renderer.ts`,
  `src/themes/platformer/engine/Renderer.test.ts` (remove the now-superseded
  `drawCoins`/`drawCoinCounter` and their tests — see Step 4)
- Modify: `src/themes/platformer/entities/Coin.ts` (remove the now-unused
  `CoinPlacement` type — see Step 4)
- Delete: `src/themes/platformer/level/level1Coins.ts`,
  `src/themes/platformer/level/level1Coins.test.ts` (superseded by
  `collectiblePlacements`)

**Interfaces:**
- Consumes: `drawCollectibles, drawCollectionEffects, drawCollectibleCounter`
  from `./engine/Renderer` (Task 6); `checkCollectibleCollisions` from
  `./engine/Collision` (Task 3); `startFlightEffect, tickFlightEffect` from
  `./engine/CollectionEffects` (Task 5); `fruitFrameSource, FRUIT_FRAME_SIZE`
  from `./entities/Fruit` (Task 4); `coinFrameSource, COIN_FRAME_SIZE` from
  `./entities/Coin` (existing); `collectiblePlacements, collectedCollectibleIds,
  activeEffects, collectedFacts` from `./PlatformerState` (Task 7);
  `isSkillCategoryFact` from `./types` (Task 1, for building the flight
  text's label).

- [ ] **Step 1: Write the failing tests**

In `src/themes/platformer/PlatformerPage.test.tsx`, replace the
`level1Coins`/`COIN_RENDERED_SIZE` import (from the deleted `level1Coins.ts`
and the still-valid `entities/Coin.ts`) with:

```typescript
import { collectiblePlacements, collectedCollectibleIds, collectedFacts } from './PlatformerState';
```

(Remove the old `import { level1Coins } from './level/level1Coins';` and
`import { COIN_RENDERED_SIZE } from './entities/Coin';` lines — the two
coin-counter-placeholder tests from step 11 that used them are being
replaced below.)

In the `beforeEach`, add resets for the two new signals (alongside the
existing `lifecycleState.value = initialLifecycleState;` etc.):

```typescript
    collectedCollectibleIds.value = new Set();
    collectedFacts.value = [];
```

Remove the two step-11 tests that no longer apply
(`render-default-showsCoinCounterPlaceholder` and
`render-afterCoinSpriteLoads-drawsEveryTestCoinAtRenderedSize` — both
asserted against the deleted static `0/N` placeholder and the deleted
`level1Coins`/`coin.png`-only rendering path). Add these in their place, at
the same location:

```typescript
  it('render-default-showsBothCollectibleCountersAtZero', () => {
    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as { fillText: ReturnType<typeof vi.fn> };

    const coinTotal = collectiblePlacements.filter((p) => p.spriteType === 'coin').length;
    const fruitTotal = collectiblePlacements.filter((p) => p.spriteType === 'fruit').length;

    expect(ctx.fillText).toHaveBeenCalledWith(`0 / ${coinTotal}`, expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith(`0 / ${fruitTotal}`, expect.any(Number), expect.any(Number));
  });

  it('playerOverlapsACollectible-tick-marksItCollectedAndAddsFact', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = collectiblePlacements[0];
    playerState.value = { ...playerState.value, x: target.x, y: target.y };

    frameCallback!(16);

    expect(collectedCollectibleIds.value.has(target.id)).toBe(true);
    expect(collectedFacts.value.some((f) => f.id === target.id)).toBe(true);
  });

  it('alreadyCollected-touchedAgainAfterRespawn-doesNotDuplicateFact', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    const target = collectiblePlacements[0];
    playerState.value = { ...playerState.value, x: target.x, y: target.y };
    frameCallback!(16);
    expect(collectedFacts.value).toHaveLength(1);

    // Simulate a respawn (per FR-020c, collected state survives it) and
    // touch the same spot again.
    healthState.value = 0;
    frameCallback!(32); // enters 'dying'
    // Fast-forward through dying+awaitingRestart, then restart.
    let t = 32;
    for (let i = 0; i < 200; i++) {
      t += 16;
      frameCallback!(t);
    }
    fireEvent.keyDown(window, { code: 'Enter' });
    playerState.value = { ...playerState.value, x: target.x, y: target.y };
    frameCallback!(t + 16);

    expect(collectedFacts.value).toHaveLength(1); // still just the one — no duplicate
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: FAIL — no collision detection or fact-adding exists yet; the two
removed step-11 tests are gone so their absence isn't a failure, but the
three new tests above fail, plus every remaining test that imports the now
partially-stale file still needs the source changes below to compile at all
(TypeScript errors block the whole file's tests from running until Step 3
lands).

- [ ] **Step 3: Write the implementation**

In `src/themes/platformer/PlatformerPage.tsx`:

Update the `Renderer` import:

```typescript
import {
  drawTerrain,
  drawPlayer,
  drawHearts,
  drawCollectibles,
  drawCollectionEffects,
  drawCollectibleCounter,
  drawIrisOverlay,
  drawRestartPrompt,
  RESTART_PROMPT_FONT_FAMILY,
  RESTART_PROMPT_FONT_URL,
} from './engine/Renderer';
```

Replace `import { level1Coins } from './level/level1Coins';` with:

```typescript
import { checkCollectibleCollisions } from './engine/Collision';
import { startFlightEffect, tickFlightEffect } from './engine/CollectionEffects';
import { coinFrameSource, COIN_FRAME_SIZE } from './entities/Coin';
import { fruitFrameSource, FRUIT_FRAME_SIZE } from './entities/Fruit';
import { isSkillCategoryFact } from './types';
```

Update the `PlatformerState` import to add the new signals:

```typescript
import {
  playerState,
  cameraPositionX,
  healthState,
  lifecycleState,
  spawnCenter,
  resetGame,
  collectiblePlacements,
  collectedCollectibleIds,
  activeEffects,
  collectedFacts,
} from './PlatformerState';
```

Add a ref for the fruit sprite alongside the existing `coinSpriteRef` (from
step 11's wiring):

```typescript
  const fruitSpriteRef = useRef<HTMLImageElement | null>(null);
```

Add a ref for the journal button (needed to compute the fact-flight's real
target position). The button element already exists in the JSX return —
attach a ref to it:

```typescript
  const journalButtonRef = useRef<HTMLButtonElement>(null);
```

then find the existing journal button JSX:

```typescript
      <button
        type="button"
        onClick={handleJournalToggle}
        data-testid="journal-open-button"
```

and add `ref={journalButtonRef}` to it:

```typescript
      <button
        ref={journalButtonRef}
        type="button"
        onClick={handleJournalToggle}
        data-testid="journal-open-button"
```

In `render()`, replace the coin-drawing block:

```typescript
      if (coinSpriteRef.current) {
        drawCoins(ctx, level1Coins, coinSpriteRef.current, coinAnimElapsed, originX, originY);
      }
```

with:

```typescript
      if (coinSpriteRef.current && fruitSpriteRef.current) {
        drawCollectibles(
          ctx,
          collectiblePlacements,
          coinSpriteRef.current,
          fruitSpriteRef.current,
          collectedCollectibleIds.value,
          coinAnimElapsed,
          originX,
          originY,
        );
      }

      drawCollectionEffects(ctx, activeEffects.value);
```

Replace the single `drawCoinCounter(ctx, 0, level1Coins.length);` call with
two `drawCollectibleCounter` calls (one per type, laid out to the right of
the hearts and each other):

```typescript
      const coinFrame0 = coinFrameSource(0);
      const coinTotal = collectiblePlacements.filter((p) => p.spriteType === 'coin').length;
      const coinCollected = collectiblePlacements.filter(
        (p) => p.spriteType === 'coin' && collectedCollectibleIds.value.has(p.id),
      ).length;
      if (coinSpriteRef.current) {
        drawCollectibleCounter(
          ctx,
          coinSpriteRef.current,
          { sx: coinFrame0.sx, sy: coinFrame0.sy, size: COIN_FRAME_SIZE },
          coinCollected,
          coinTotal,
          16 + MAX_HEARTS_COUNTER_WIDTH,
          32,
        );
      }

      const fruitFrame0 = fruitFrameSource(0);
      const fruitTotal = collectiblePlacements.filter((p) => p.spriteType === 'fruit').length;
      const fruitCollected = collectiblePlacements.filter(
        (p) => p.spriteType === 'fruit' && collectedCollectibleIds.value.has(p.id),
      ).length;
      if (fruitSpriteRef.current) {
        drawCollectibleCounter(
          ctx,
          fruitSpriteRef.current,
          { sx: fruitFrame0.sx, sy: fruitFrame0.sy, size: FRUIT_FRAME_SIZE },
          fruitCollected,
          fruitTotal,
          16 + MAX_HEARTS_COUNTER_WIDTH + COLLECTIBLE_COUNTER_SPACING,
          32,
        );
      }
```

Add the two new layout constants near the top of the file (module scope,
alongside no existing similar constant — add them just above the component
export):

```typescript
// Horizontal HUD layout: hearts occupy roughly the first 130px from the left
// margin (3 hearts x 32px + spacing, per drawHearts's own HUD_MARGIN/
// HEART_SPACING in Renderer.ts) — these two constants position the coin and
// fruit counters after that, side by side, without duplicating Renderer.ts's
// private layout constants here.
const MAX_HEARTS_COUNTER_WIDTH = 130;
const COLLECTIBLE_COUNTER_SPACING = 90;
```

Add the collision-check + collection handling in the game loop's tick
callback, right after the existing `coinAnimElapsed += dt;` line (still
inside the "normal gameplay" branch, after the three lifecycle
early-returns):

```typescript
      coinAnimElapsed += dt;

      activeEffects.value = activeEffects.value
        .map((effect) => tickFlightEffect(effect, dt))
        .filter((effect) => effect.phase !== 'done');

      const touchedIds = checkCollectibleCollisions(
        playerState.value,
        collectiblePlacements,
        collectedCollectibleIds.value,
      );
      if (touchedIds.length > 0) {
        const nextCollected = new Set(collectedCollectibleIds.value);
        const newFacts = [...collectedFacts.value];
        const newEffects = [...activeEffects.value];
        const journalRect = journalButtonRef.current?.getBoundingClientRect();
        const targetX = journalRect ? journalRect.left + journalRect.width / 2 : canvas.width - 32;
        const targetY = journalRect ? journalRect.top + journalRect.height / 2 : canvas.height - 32;

        for (const id of touchedIds) {
          const placement = collectiblePlacements.find((p) => p.id === id);
          if (!placement) continue;
          nextCollected.add(id);
          newFacts.push(placement.fact);

          const label = isSkillCategoryFact(placement.fact.data)
            ? placement.fact.data.category
            : ('name' in placement.fact.data ? placement.fact.data.name : placement.fact.sectionLabel);
          newEffects.push(
            startFlightEffect(
              id,
              label,
              placement.x + originX,
              placement.y + originY,
              targetX,
              targetY,
            ),
          );
        }

        collectedCollectibleIds.value = nextCollected;
        collectedFacts.value = newFacts;
        activeEffects.value = newEffects;
      }
```

Add the fruit sprite load call alongside the existing `coin.png` load (after
it, before the `loadFont(...)` call):

```typescript
    loadImage('/sprites/fruit.png')
      .then((img) => {
        if (cancelled) return;
        fruitSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Fruits simply won't render if the sprite fails to load; coins and
        // the rest of the game still show.
      });
```

- [ ] **Step 4: Remove the now-superseded `drawCoins`/`drawCoinCounter`**

Now that `PlatformerPage.tsx` (Step 3, above) calls `drawCollectibles`/
`drawCollectibleCounter` instead, the step-11 functions they replaced are
dead code. In `src/themes/platformer/engine/Renderer.ts`, delete the
`drawCoins` and `drawCoinCounter` functions and the `COIN_COUNTER_GAP`
constant. Remove the now-unused
`import type { CoinPlacement } from '../entities/Coin';` line, but keep the
rest of the `../entities/Coin` import (`COIN_FRAME_SIZE` etc. are still used
by `drawCollectibles`).

Also remove the now-fully-unused `CoinPlacement` interface from
`src/themes/platformer/entities/Coin.ts` (its only consumers were
`level1Coins.ts` — deleted in Step 6 below — and the import just removed) —
dead exported types are exactly what constitution Principle IV's "no feature
bloat" warns against. Leave the rest of `Coin.ts` untouched.

In `src/themes/platformer/engine/Renderer.test.ts`, delete the
`describe('drawCoins', ...)` and `describe('drawCoinCounter', ...)` blocks
and their now-unused imports (`drawCoins, drawCoinCounter` from the top
import, the `type CoinPlacement` import line).

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS — removing dead code/tests, nothing new; confirms the
deletion didn't accidentally remove something Task 6's new functions still
depend on.

- [ ] **Step 5: Delete the superseded step-11 test-data files**

```bash
rm src/themes/platformer/level/level1Coins.ts src/themes/platformer/level/level1Coins.test.ts
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS (all cases, old and new, green).

- [ ] **Step 7: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: PASS except `Journal.test.tsx` (Task 9 fixes it — it still expects
the old single-`CVItemData` fact shape in a couple of assertions once real
category facts start flowing through instead of the deleted seed data).

- [ ] **Step 8: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx \
  src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts \
  src/themes/platformer/entities/Coin.ts
git rm src/themes/platformer/level/level1Coins.ts src/themes/platformer/level/level1Coins.test.ts
git commit -m "feat(platformer): wire collision detection, collection, and effect rendering"
```

---

## Task 9: `Journal.tsx` — render `SkillCategoryFact`

**Files:**
- Modify: `src/themes/platformer/components/Journal.tsx`
- Modify: `src/themes/platformer/components/Journal.test.tsx`

**Interfaces:**
- Consumes: `isSkillCategoryFact` from `../types` (Task 1).

- [ ] **Step 1: Write the failing test**

In `src/themes/platformer/components/Journal.test.tsx`, add a test using a
`SkillCategoryFact`-shaped `CollectedFact` (check the existing file's
imports/helpers first — it likely already has a way to set `collectedFacts.value`
for a test; follow that same pattern):

```typescript
  it('skillCategoryFact-rendered-showsCategoryNameAndSkillCount', () => {
    collectedFacts.value = [
      {
        id: 'coin-backend',
        sectionId: 'skills',
        sectionLabel: 'Skills',
        data: { category: 'Backend', skills: [{ name: 'C#', level: 90 }, { name: '.NET', level: 85 }] },
        sourceType: 'coin',
      },
    ];

    render(<Journal onClose={() => {}} />);

    expect(screen.getByText(/Backend/)).toBeInTheDocument();
    expect(screen.getByText(/C#/)).toBeInTheDocument();
    expect(screen.getByText(/\.NET/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/components/Journal.test.tsx`
Expected: FAIL — `factItemLabel`'s current fallback logic doesn't know about
`SkillCategoryFact` (no `name`/`title`/`company` field on it), so it falls
back to `fact.sectionLabel` ("Skills") and neither "Backend" nor "C#"
appear.

- [ ] **Step 3: Write the implementation**

In `src/themes/platformer/components/Journal.tsx`, add the import:

```typescript
import { isSkillCategoryFact } from '../types';
```

Replace `factItemLabel` and its single call site in the `<li>` with a
function that branches on the new shape:

```typescript
/**
 * Best-effort single-line label for a fact's underlying CV item. A
 * SkillCategoryFact (roadmap step 12 — skills are collected as a whole
 * category, not individually, see CollectibleMapper.ts) lists every skill
 * name; every other `CVItemData` variant has a `name` or `title` field
 * except `Experience` (`company`) and `Personality` (also `name`, already
 * covered).
 */
const factItemLabel = (fact: CollectedFact): string => {
  if (isSkillCategoryFact(fact.data)) {
    return fact.data.skills.map((s) => s.name).join(', ');
  }
  const data = fact.data as Record<string, unknown>;
  if (typeof data.name === 'string') return data.name;
  if (typeof data.title === 'string') return data.title;
  if (typeof data.company === 'string') return data.company;
  return fact.sectionLabel;
};

const factHeading = (fact: CollectedFact): string =>
  isSkillCategoryFact(fact.data) ? fact.data.category : fact.sectionLabel;
```

Update the `<li>` rendering (find the existing
`{fact.sectionLabel}: {factItemLabel(fact)}` line) to use the new heading
helper:

```typescript
              <li key={fact.id} data-testid="journal-fact-item">
                {factHeading(fact)}: {factItemLabel(fact)}
              </li>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/components/Journal.test.tsx`
Expected: PASS (all cases, old and new, green).

- [ ] **Step 5: Run the full suite to confirm everything is green now**

Run: `npx vitest run`
Expected: PASS — every test in the repo, including the ones Task 7/8 flagged
as expected-to-fail-until-now.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/components/Journal.tsx src/themes/platformer/components/Journal.test.tsx
git commit -m "feat(platformer): render SkillCategoryFact entries in the journal"
```

---

## Task 10: Manual browser verification + roadmap checkoff

**Files:**
- Modify: `specs/S-006-platformer-theme/roadmap.md`

- [ ] **Step 1: Manual browser check**

Start the dev server and open the Platformer theme. Verify:

1. Coins (spinning) and fruits (bobbing, not spinning) are both visible
   across the level, distinct from each other at a glance.
2. Two counters show in the HUD next to the hearts — one with a coin icon
   (`0 / 16`-ish), one with a fruit icon (`0 / 3`) — both start at 0.
3. Walk into a coin: it disappears, a small sparkle burst plays at the spot,
   the category name floats up, hovers briefly, then flies to the journal
   icon (bottom-right) and fades. The coin counter increments.
4. Walk into a fruit: same sequence, the fruit counter increments instead.
5. Open the journal (`J` or the icon) — the collected category's fact shows
   its category name and every skill it contains; a collected language shows
   its name.
6. Kill the character (or fall into enough pits) to trigger a respawn.
   Confirm: already-collected coins/fruits do NOT reappear, the journal
   still shows everything collected before the death, and the two HUD
   counters keep their pre-death counts (not reset to 0).
7. Touch an already-collected coin's now-empty spot again — confirm nothing
   happens (no error, no duplicate journal entry, counters don't change).
8. Confirm existing behavior is unaffected: hearts/pit-falls, the death
   iris, journal open/close pause, floating theme/locale controls.

- [ ] **Step 2: Check off roadmap step 12**

In `specs/S-006-platformer-theme/roadmap.md`, change:

```markdown
- [ ] **12. CollectibleMapper + coin collection** — extends step 11's hardcoded
```

to:

```markdown
- [x] **12. CollectibleMapper + coin collection** — extends step 11's hardcoded
```

- [ ] **Step 3: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs(platformer): check off roadmap step 12 (coin collection) — verified in browser"
```

---

## After this plan

Per the roadmap's branch strategy, merge `S-006-step12-coin-collection` into
`S-006-platformer-theme` once all tasks are done and verified (directly, per
current preference — no PR required).
