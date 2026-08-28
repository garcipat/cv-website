# Coins Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a scoped-down version of roadmap step 11 (Coins render): a
handful of hardcoded, animated coins render on `level1` (two above the
floating platform, two on the ground floor) for visual testing, plus a static
`0/max` coin counter next to the heart HUD. Coins spin and also bob a few
pixels up and down while doing so. Coins are visible but not collectible — no
hitbox, no CVData wiring.

**Architecture:** One new pure entity module (`entities/Coin.ts`, mirrors the
existing `entities/Player.ts` animation-frame-math pattern), one new pure data
module (`level/level1Coins.ts`, hardcoded placements — mirrors how
`level/level1.ts` derives `SPAWN_TILE` from the layout via `tileToPixel`), two
new pure draw functions in `Renderer.ts`, and orchestration wiring in
`PlatformerPage.tsx`'s render loop (a coin sprite ref + a plain elapsed-time
counter, not a signal — nothing outside rendering needs it this step).

**Key scope decision:** The roadmap's step 11 originally called for a
CollectibleMapper that places one coin per real `CVData` Skill/Language item,
with the level's coin count verified against that total. Per discussion, that
CVData wiring is deferred entirely to the next step (coin collection), since
that step needs the same data anyway to know what to display when a coin is
collected. This step only proves out rendering/animation with a small,
hand-placed test set. Roadmap step 11's checkbox and verify text are rewritten
by this plan's last task to reflect that split, and a note is added to step 12
about the future skills-are-coins / languages-are-fruit (`fruit.png`, already
in `public/sprites/`) mapping idea raised during planning — not built here.

**Tech Stack:** TypeScript strict, Vitest + React Testing Library + jsdom, raw
Canvas 2D API (no new dependencies). No signals needed for this step (the
counter is a static placeholder).

**Spec:** `specs/S-006-platformer-theme/spec.md` (collectibles section) and
`specs/S-006-platformer-theme/roadmap.md` (step 11, being rescoped by this
plan). This plan's phase-1/phase-2 split (render-only now, CollectibleMapper +
collection later) was worked out directly with the user in chat, per
`superpowers:brainstorming`'s bounded path.

## Global Constraints

- TDD: write the failing test before the implementation, for every task
  (constitution Principle II).
- No `any` types (TypeScript strict mode, constitution Principle I).
- Named arrow function exports / named function exports only, no default
  exports (constitution Principle III).
- Test naming: `{method}-{Condition}-{ExpectedResult}` (constitution
  Principle II).
- No hitbox/collision code in this step — nothing consumes it yet (that's the
  next roadmap step, coin collection). Adding it now would be untested,
  speculative code (constitution Principle IV, no feature bloat).
- Coin sprite: `public/sprites/coin.png`, 192×16px — 12 frames of 16×16,
  single row, a spin-cycle animation.
- Branch: create `S-006-step11-coins-render` off `S-006-platformer-theme`
  before starting (this plan assumes roadmap step 10's death/respawn wiring —
  `PlatformerPage.tsx`'s `lifecycleState`/iris overlay code — is already
  merged into `S-006-platformer-theme`, since steps are sequential per the
  roadmap's working agreement). PR target is `S-006-platformer-theme`, not
  `main`.

---

## Task 1: `entities/Coin.ts` — pure frame math

**Files:**
- Create: `src/themes/platformer/entities/Coin.ts`
- Test: `src/themes/platformer/entities/Coin.test.ts`

**Interfaces:**
- Consumes: `RENDER_SCALE: number` from `../level/Terrain`.
- Produces: `COIN_FRAME_SIZE: number`, `COIN_RENDERED_SIZE: number`,
  `COIN_FRAME_COUNT: number`, `COIN_FRAME_DURATION: number`,
  `COIN_BOB_AMPLITUDE: number`, `COIN_BOB_PERIOD_SECONDS: number`,
  `interface CoinPlacement { id: string; x: number; y: number }`,
  `coinFrameIndex(elapsedSeconds: number): number`,
  `coinFrameSource(frame: number): { sx: number; sy: number }`,
  `coinBobOffset(elapsedSeconds: number): number`.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/entities/Coin.test.ts`:

```typescript
import {
  COIN_FRAME_COUNT,
  COIN_FRAME_SIZE,
  COIN_BOB_AMPLITUDE,
  COIN_BOB_PERIOD_SECONDS,
  coinFrameIndex,
  coinFrameSource,
  coinBobOffset,
} from './Coin';

describe('coinFrameIndex', () => {
  it('elapsedZero-returnsFrameZero', () => {
    expect(coinFrameIndex(0)).toBe(0);
  });

  it('elapsedJustBeforeFrameDuration-staysFrameZero', () => {
    expect(coinFrameIndex(0.049)).toBe(0);
  });

  it('elapsedAtFrameDuration-advancesToFrameOne', () => {
    expect(coinFrameIndex(0.05)).toBe(1);
  });

  it('elapsedAfterFullCycle-wrapsBackToFrameZero', () => {
    expect(coinFrameIndex(0.05 * COIN_FRAME_COUNT)).toBe(0);
  });

  it('elapsedNegative-clampsToFrameZero', () => {
    expect(coinFrameIndex(-1)).toBe(0);
  });
});

describe('coinFrameSource', () => {
  it('frameZero-returnsTopLeftOfSheet', () => {
    expect(coinFrameSource(0)).toEqual({ sx: 0, sy: 0 });
  });

  it('frameFive-returnsFifthFrameOffset', () => {
    expect(coinFrameSource(5)).toEqual({ sx: 5 * COIN_FRAME_SIZE, sy: 0 });
  });

  it('frameEqualToFrameCount-wrapsToFirstFrame', () => {
    expect(coinFrameSource(COIN_FRAME_COUNT)).toEqual({ sx: 0, sy: 0 });
  });
});

describe('coinBobOffset', () => {
  it('elapsedZero-returnsZero', () => {
    expect(coinBobOffset(0)).toBe(0);
  });

  it('elapsedQuarterPeriod-returnsPositiveAmplitude', () => {
    expect(coinBobOffset(COIN_BOB_PERIOD_SECONDS / 4)).toBeCloseTo(COIN_BOB_AMPLITUDE);
  });

  it('elapsedHalfPeriod-returnsCloseToZero', () => {
    expect(coinBobOffset(COIN_BOB_PERIOD_SECONDS / 2)).toBeCloseTo(0);
  });

  it('elapsedThreeQuarterPeriod-returnsNegativeAmplitude', () => {
    expect(coinBobOffset((COIN_BOB_PERIOD_SECONDS * 3) / 4)).toBeCloseTo(-COIN_BOB_AMPLITUDE);
  });

  it('elapsedFullPeriod-returnsCloseToZero', () => {
    expect(coinBobOffset(COIN_BOB_PERIOD_SECONDS)).toBeCloseTo(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/entities/Coin.test.ts`
Expected: FAIL — `Cannot find module './Coin'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/themes/platformer/entities/Coin.ts`:

```typescript
import { RENDER_SCALE } from '../level/Terrain';

/** `coin.png` is a 192x16 sheet: 12 frames of 16x16, one spin cycle. */
export const COIN_FRAME_SIZE = 16;
export const COIN_RENDERED_SIZE = COIN_FRAME_SIZE * RENDER_SCALE;
export const COIN_FRAME_COUNT = 12;

/** Seconds each spin frame is held before advancing — a snappier cycle than
 *  the player's idle animation, since a coin's spin is a small ambient loop
 *  rather than a state-driven animation. */
export const COIN_FRAME_DURATION = 0.05;

/** A coin's fixed world-space top-left render position. No `collected` flag
 *  or per-coin animation state yet — this step only renders a hardcoded test
 *  set (see level/level1Coins.ts); collection state is the next roadmap
 *  step's job. */
export interface CoinPlacement {
  id: string;
  x: number;
  y: number;
}

/**
 * Spin-cycle frame index for a given elapsed time, shared by every coin (all
 * coins spin in sync, so no per-coin animation state is needed — unlike
 * Player.ts's animState/animFrame/animTimer, which vary per player). Clamps
 * negative elapsed time to frame 0 defensively, though callers only ever pass
 * an accumulated (non-negative) timer.
 */
export function coinFrameIndex(elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  const frame = Math.floor(elapsedSeconds / COIN_FRAME_DURATION);
  return frame % COIN_FRAME_COUNT;
}

/** Sprite-sheet source rect for a given frame index (wraps, matching
 *  Player.ts's playerFrameSource convention). */
export function coinFrameSource(frame: number): { sx: number; sy: number } {
  return { sx: (frame % COIN_FRAME_COUNT) * COIN_FRAME_SIZE, sy: 0 };
}

/** Vertical bob distance in rendered px, and the full up-down-up cycle's
 *  duration in seconds — a small ambient float layered on top of the spin,
 *  driven by the same shared elapsed clock as coinFrameIndex. */
export const COIN_BOB_AMPLITUDE = 3;
export const COIN_BOB_PERIOD_SECONDS = 1.6;

/**
 * Vertical offset (rendered px, positive = downward, matching the canvas y
 * axis) to add to every coin's y position for the current elapsed time — a
 * sine wave shared by every coin, so they all bob in sync just like they all
 * spin in sync (see coinFrameIndex). Independent of the spin frame's own
 * timing (COIN_FRAME_DURATION) since the two are unrelated cycles.
 */
export function coinBobOffset(elapsedSeconds: number): number {
  return COIN_BOB_AMPLITUDE * Math.sin((elapsedSeconds / COIN_BOB_PERIOD_SECONDS) * Math.PI * 2);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/Coin.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/Coin.ts src/themes/platformer/entities/Coin.test.ts
git commit -m "feat(platformer): add coin sprite frame math"
```

---

## Task 2: `level/level1Coins.ts` — hardcoded test placements

**Files:**
- Create: `src/themes/platformer/level/level1Coins.ts`
- Test: `src/themes/platformer/level/level1Coins.test.ts`

**Interfaces:**
- Consumes: `tileToPixel(col, row): { x: number; y: number }`,
  `RENDERED_TILE_SIZE: number`, `isSolid(tile): boolean`,
  `tileAt(level, col, row): TileType` from `./Terrain` (existing); `level1`
  from `./level1` (existing); `CoinPlacement` from `../entities/Coin`
  (Task 1).
- Produces: `level1Coins: CoinPlacement[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/level/level1Coins.test.ts`:

```typescript
import { level1Coins } from './level1Coins';
import { level1 } from './level1';
import { RENDERED_TILE_SIZE, isSolid, tileAt } from './Terrain';

describe('level1Coins', () => {
  it('called-returns-fourUniquelyIdentifiedCoins', () => {
    expect(level1Coins).toHaveLength(4);
    const ids = level1Coins.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('everyCoin-positioned-onAnEmptyTileDirectlyAboveASolidTile', () => {
    for (const coin of level1Coins) {
      const col = coin.x / RENDERED_TILE_SIZE;
      const row = coin.y / RENDERED_TILE_SIZE;
      expect(isSolid(tileAt(level1, col, row))).toBe(false);
      expect(isSolid(tileAt(level1, col, row + 1))).toBe(true);
    }
  });

  it('atLeastOneCoin-sitsAbovePlatformRow-andAtLeastOneAboveGroundRow', () => {
    // Row 7 is the floating platform row, row 10 is the ground row (see
    // level1.ts's LEVEL_1_LAYOUT comment) — the test set should cover both,
    // per the "place some on one platform ... or on the floor" testing goal.
    const rows = level1Coins.map((c) => c.y / RENDERED_TILE_SIZE);
    expect(rows).toContain(6); // one row above the platform row (7)
    expect(rows).toContain(9); // one row above the ground row (10)
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/level1Coins.test.ts`
Expected: FAIL — `Cannot find module './level1Coins'`.

- [ ] **Step 3: Write the implementation**

Create `src/themes/platformer/level/level1Coins.ts`:

```typescript
import { tileToPixel } from './Terrain';
import type { CoinPlacement } from '../entities/Coin';

interface CoinTile {
  id: string;
  col: number;
  row: number;
}

/**
 * Hardcoded test coins for level1, for visually verifying coin
 * rendering/animation before real CVData-driven placement exists (deferred
 * to the coin-collection roadmap step, which needs the same Skill/Language
 * data to know what to display on collection — see this plan's "Key scope
 * decision"). Two coins float above the row-7 floating platform (cols 8-14,
 * "PPPBBPP" — see level1.ts's LEVEL_1_LAYOUT comment) and two rest above the
 * row-10 rock ground floor, clear of the cols 2-4 pit.
 */
const LEVEL_1_COIN_TILES: readonly CoinTile[] = [
  { id: 'test-platform-1', col: 9, row: 6 },
  { id: 'test-platform-2', col: 13, row: 6 },
  { id: 'test-floor-1', col: 20, row: 9 },
  { id: 'test-floor-2', col: 30, row: 9 },
];

export const level1Coins: CoinPlacement[] = LEVEL_1_COIN_TILES.map(({ id, col, row }) => {
  const { x, y } = tileToPixel(col, row);
  return { id, x, y };
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/level1Coins.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/level1Coins.ts src/themes/platformer/level/level1Coins.test.ts
git commit -m "feat(platformer): add hardcoded test coin placements for level1"
```

---

## Task 3: `Renderer.ts` — `drawCoins` + `drawCoinCounter`

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `COIN_FRAME_SIZE, COIN_RENDERED_SIZE, coinFrameIndex,
  coinFrameSource, coinBobOffset` and `type CoinPlacement` from
  `../entities/Coin` (Task 1); existing `MAX_HEARTS, HEART_RENDERED_SIZE`
  from `../entities/Health` (already imported in this file).
- Produces: `drawCoins(ctx: CanvasRenderingContext2D, coins: CoinPlacement[],
  sprite: HTMLImageElement, elapsedSeconds: number, originX?: number, originY?:
  number): void`, `drawCoinCounter(ctx: CanvasRenderingContext2D, collected:
  number, max: number): void`.

- [ ] **Step 1: Write the failing tests**

In `src/themes/platformer/engine/Renderer.test.ts`, update the top import line:

```typescript
import { drawTerrain, drawPlayer, drawHearts, drawCoins, drawCoinCounter, drawIrisOverlay, drawRestartPrompt } from './Renderer';
import { coinBobOffset } from '../entities/Coin';
import type { CoinPlacement } from '../entities/Coin';
```

Then add these test blocks (anywhere after the existing `makeMockContext`
helper, e.g. right before the `describe('drawIrisOverlay', ...)` block):

```typescript
describe('drawCoins', () => {
  it('twoCoinsAtElapsedZero-drawsBothAtFirstFrameWithOriginOffset', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const coins: CoinPlacement[] = [
      { id: 'a', x: 100, y: 200 },
      { id: 'b', x: 300, y: 400 },
    ];
    const sprite = {} as HTMLImageElement;

    drawCoins(ctx as unknown as CanvasRenderingContext2D, coins, sprite, 0, 10, 20);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, sprite, 0, 0, 16, 16, 110, 220, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, sprite, 0, 0, 16, 16, 310, 420, 32, 32);
  });

  it('elapsedAdvancedOneFrameDuration-usesSecondSpriteFrame', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const coins: CoinPlacement[] = [{ id: 'a', x: 0, y: 0 }];
    const sprite = {} as HTMLImageElement;

    drawCoins(ctx as unknown as CanvasRenderingContext2D, coins, sprite, 0.05);

    // dy is omitted here — at elapsed=0.05 the bob offset (see the dedicated
    // 'appliesBobOffset' test below) is a non-round number, so this test only
    // pins down the parts unaffected by bobbing: sprite frame and dx/dw/dh.
    const call = ctx.drawImage.mock.calls[0];
    expect(call[0]).toBe(sprite);
    expect(call.slice(1, 6)).toEqual([16, 0, 16, 16, 0]); // sx, sy, sw, sh, dx
    expect(call.slice(7)).toEqual([32, 32]); // dw, dh
  });

  it('elapsedQuarterBobPeriod-appliesBobOffsetToDestY', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const coins: CoinPlacement[] = [{ id: 'a', x: 0, y: 100 }];
    const sprite = {} as HTMLImageElement;
    const elapsed = 0.4; // COIN_BOB_PERIOD_SECONDS / 4 — see Coin.ts

    drawCoins(ctx as unknown as CanvasRenderingContext2D, coins, sprite, elapsed, 0, 0);

    const dy = ctx.drawImage.mock.calls[0][6] as number;
    expect(dy).toBeCloseTo(100 + coinBobOffset(elapsed));
  });

  it('noCoins-doesNotCallDrawImage', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawCoins(ctx as unknown as CanvasRenderingContext2D, [], {} as HTMLImageElement, 0);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawCoinCounter', () => {
  it('called-drawsCollectedSlashMaxText', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };

    drawCoinCounter(ctx as unknown as CanvasRenderingContext2D, 0, 4);

    expect(ctx.fillText).toHaveBeenCalledWith('0/4', expect.any(Number), expect.any(Number));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL — `drawCoins`/`drawCoinCounter` are not exported from
`./Renderer` yet.

- [ ] **Step 3: Write the implementation**

Update the top of `src/themes/platformer/engine/Renderer.ts` to add the new
import (alongside the existing `Health`/`Player` imports):

```typescript
import {
  COIN_FRAME_SIZE,
  COIN_RENDERED_SIZE,
  coinFrameIndex,
  coinFrameSource,
  coinBobOffset,
} from '../entities/Coin';
import type { CoinPlacement } from '../entities/Coin';
```

Add to the end of `src/themes/platformer/engine/Renderer.ts` (after
`drawRestartPrompt`):

```typescript
/**
 * Draws every coin at the current shared spin frame, offset a few pixels up
 * or down by the current shared bob position (all coins spin and bob in sync
 * — see Coin.ts's coinFrameIndex/coinBobOffset). Same originX/originY
 * convention as drawTerrain/drawPlayer, since coins live in world space and
 * must scroll with the camera; the bob offset is applied on top of that, not
 * instead of it.
 */
export function drawCoins(
  ctx: CanvasRenderingContext2D,
  coins: CoinPlacement[],
  sprite: HTMLImageElement,
  elapsedSeconds: number,
  originX = 0,
  originY = 0,
): void {
  ctx.imageSmoothingEnabled = false;

  const frame = coinFrameIndex(elapsedSeconds);
  const { sx, sy } = coinFrameSource(frame);
  const bob = coinBobOffset(elapsedSeconds);

  for (const coin of coins) {
    ctx.drawImage(
      sprite,
      sx,
      sy,
      COIN_FRAME_SIZE,
      COIN_FRAME_SIZE,
      coin.x + originX,
      coin.y + originY + bob,
      COIN_RENDERED_SIZE,
      COIN_RENDERED_SIZE,
    );
  }
}

const COIN_COUNTER_GAP = 12;

/**
 * Draws a "collected/max" text counter at a fixed screen position, to the
 * right of the heart HUD (see drawHearts's HUD_MARGIN/HEART_SPACING). This
 * step always passes `collected = 0` (a static placeholder — coins aren't
 * collectible yet); a later roadmap step wires a real collected count in.
 */
export function drawCoinCounter(
  ctx: CanvasRenderingContext2D,
  collected: number,
  max: number,
): void {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const heartsWidth = MAX_HEARTS * (HEART_RENDERED_SIZE + HEART_SPACING);
  const x = HUD_MARGIN + heartsWidth + COIN_COUNTER_GAP;
  const y = HUD_MARGIN + HEART_RENDERED_SIZE / 2;
  ctx.fillText(`${collected}/${max}`, x, y);
  ctx.restore();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS (all cases, old and new, green).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): add coin and coin-counter rendering"
```

---

## Task 4: `PlatformerPage.tsx` — wire coin sprite loading, animation timer, and render calls

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `drawCoins, drawCoinCounter` from `./engine/Renderer` (Task 3);
  `level1Coins` from `./level/level1Coins` (Task 2); `COIN_RENDERED_SIZE` from
  `./entities/Coin` (Task 1, test-only).

This task assumes roadmap step 10's death/respawn wiring is already merged
into `S-006-platformer-theme` (per this plan's branch note) — the game loop's
tick callback already has an early-return pause for the `dying`/
`awaitingRestart` lifecycle phases, and `render()` already draws the iris
overlay. If step 10 isn't merged yet when this task runs, adapt the anchors
below to the current file (the coin-specific additions don't depend on any
lifecycle logic, only on the existing `loadImage`/`render()`/tick-callback
shape both versions share).

- [ ] **Step 1: Write the failing tests**

In `src/themes/platformer/PlatformerPage.test.tsx`, add to the top imports:

```typescript
import { level1Coins } from './level/level1Coins';
import { COIN_RENDERED_SIZE } from './entities/Coin';
```

Then add these test blocks at the end of the `describe('PlatformerPage', ...)`
block, right before its closing `});`:

```typescript
  it('render-default-showsCoinCounterPlaceholder', () => {
    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as { fillText: ReturnType<typeof vi.fn> };

    expect(ctx.fillText).toHaveBeenCalledWith(
      `0/${level1Coins.length}`,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('render-afterCoinSpriteLoads-drawsEveryTestCoinAtRenderedSize', async () => {
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as { drawImage: ReturnType<typeof vi.fn> };

    await waitFor(() =>
      expect(
        ctx.drawImage.mock.calls.some(
          (call: unknown[]) => (call[0] as MockTilesetImage).src === '/sprites/coin.png',
        ),
      ).toBe(true),
    );

    const coinCalls = ctx.drawImage.mock.calls.filter(
      (call: unknown[]) => (call[0] as MockTilesetImage).src === '/sprites/coin.png',
    );
    expect(coinCalls).toHaveLength(level1Coins.length);
    expect(coinCalls.every((call: unknown[]) => call[7] === COIN_RENDERED_SIZE)).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: FAIL — no coin counter text is drawn, and no `drawImage` call has
`src === '/sprites/coin.png'` (coin sprite isn't loaded or drawn yet).

- [ ] **Step 3: Write the implementation**

In `src/themes/platformer/PlatformerPage.tsx`:

Update the `Renderer` import to add `drawCoins, drawCoinCounter`, and add a new
import for `level1Coins`:

```typescript
import {
  drawTerrain,
  drawPlayer,
  drawHearts,
  drawCoins,
  drawCoinCounter,
  drawIrisOverlay,
  drawRestartPrompt,
} from './engine/Renderer';
```

```typescript
import { level1Coins } from './level/level1Coins';
```

Add a new ref alongside the existing sprite refs (near
`const heartsSpriteRef = useRef<HTMLImageElement | null>(null);`):

```typescript
  const coinSpriteRef = useRef<HTMLImageElement | null>(null);
```

Inside the `useEffect`, add a plain (non-signal) elapsed-time accumulator
alongside the existing `let backgroundColor = '#000';`:

```typescript
    // Shared spin-cycle timer for every coin (see Coin.ts's coinFrameIndex) —
    // a plain variable, not a signal, since nothing outside this render loop
    // needs to read or react to it.
    let coinAnimElapsed = 0;
```

In `render()`, add the coin draw call right after the existing `drawPlayer`
block (before the `debugHitboxes` line):

```typescript
      if (coinSpriteRef.current) {
        drawCoins(ctx, level1Coins, coinSpriteRef.current, coinAnimElapsed, originX, originY);
      }
```

Add the counter draw call right after the existing `drawHearts` block. It has
no sprite-loaded guard (it's text-only, like `drawRestartPrompt`) so it always
shows, even before any image has loaded:

```typescript
      drawCoinCounter(ctx, 0, level1Coins.length);
```

In the game loop's tick callback, accumulate `coinAnimElapsed` once per
physics-active frame. Add this line right after the two lifecycle
early-returns (i.e. as the first line of the "normal gameplay" branch, before
the `horizontal` input reads):

```typescript
      coinAnimElapsed += dt;
```

Add the coin sprite load call alongside the other `loadImage(...)` calls (near
the end of the effect, after the existing `hearts.png` load):

```typescript
    loadImage('/sprites/coin.png')
      .then((img) => {
        if (cancelled) return;
        coinSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Coins simply won't render if the sprite fails to load; the rest of
        // the game still shows.
      });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS (all cases, old and new, green).

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: PASS — every existing test in the repo still passes.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): render animated test coins and coin counter placeholder"
```

---

## Task 5: Manual browser verification + roadmap update

**Files:**
- Modify: `specs/S-006-platformer-theme/roadmap.md`

- [ ] **Step 1: Manual browser check**

Start the dev server and open the Platformer theme. Verify:

1. Two coins are visible spinning above the floating platform (row 7, cols
   8-14 — walk/jump up there to see them close).
2. Two coins are visible spinning on the ground floor further right (cols 20
   and 30 — walk right from spawn to reach them).
3. All four coins visibly cycle through their spin animation continuously
   (not frozen on one frame), in sync with each other, and also bob a few
   pixels up and down while spinning (in sync with each other too).
4. A `0/4` counter is visible next to the heart HUD (top-left) at all times,
   including before the coin sprite finishes loading.
5. Walking through/into a coin does nothing yet (no collection, no removal,
   no counter change) — confirms this step correctly stopped short of
   collection.
6. Confirm the floating theme/locale controls and existing hearts/pit-fall
   behavior are unaffected.

- [ ] **Step 2: Rescope roadmap step 11 and note the follow-up for step 12**

In `specs/S-006-platformer-theme/roadmap.md`, change:

```markdown
- [ ] **11. Coins render + CollectibleMapper** — coins placed from real `CVData`
  (Skills/Languages), visible but not yet collectible.
  *Verify: coin count in the level matches the number of Skills + Languages
  items.*
```

to:

```markdown
- [x] **11. Coins render** — a small hardcoded set of animated coins (spin +
  a few pixels of up/down bob) render on `level1` (two above the floating
  platform, two on the ground floor) for visual/animation testing, plus a
  static `0/max` coin counter next to the heart HUD. Not yet collectible, and
  not yet driven by real `CVData` —
  placing one coin per real Skill/Language item (the CollectibleMapper
  originally scoped here) moves into step 12 below, since that step needs the
  same data to know what to display on collection anyway.
  *Verify: the hardcoded test coins are visible and animate on the platform
  and the floor; the `0/max` counter shows next to the hearts.*
```

Then update step 12's line to note the deferred mapping work and the
skills-are-coins/languages-are-fruit idea raised during planning:

```markdown
- [ ] **12. Coin collection** — touching a coin removes it, fact text floats up and
  flies toward the journal icon, `collectedFacts` state updates.
  *Verify: collect a coin, see the fact text animate off.*
```

to:

```markdown
- [ ] **12. CollectibleMapper + coin collection** — extends step 11's hardcoded
  test coins into real placements: a CollectibleMapper flattens `CVData`
  Skills and Languages into facts and places one collectible per fact across
  the level. Touching a collectible removes it, fact text floats up and flies
  toward the journal icon, `collectedFacts` state updates, and the coin
  counter added in step 11 starts reflecting the real collected/max count.
  Worth deciding here: Skills as `coin.png`, Languages as the already-present
  `fruit.png` (raised during step 11 planning, not decided yet) — two visually
  distinct collectible types instead of one.
  *Verify: coin count in the level matches the number of Skills + Languages
  items; collect one, see the fact text animate off and the counter update.*
```

- [ ] **Step 3: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs(platformer): check off roadmap step 11 (coins render) and rescope step 12"
```

---

## After this plan

Per the roadmap's branch strategy, open a PR from `S-006-step11-coins-render`
into `S-006-platformer-theme` (not `main`) once all tasks are done and
verified.
