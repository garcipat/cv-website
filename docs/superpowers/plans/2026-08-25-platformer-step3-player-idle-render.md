# Platformer Step 3: Player Idle Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw the pixel-art player character standing still (idle animation, frame 0) on the ground at the level's spawn point, with no physics, input, or animation cycling yet.

**Architecture:** A new `entities/Player.ts` module holds pure sprite-sheet geometry (frame size, frame-to-source-rect lookup) and the `PlayerState` type, mirroring how `level/Terrain.ts` holds pure tile geometry for terrain. A new `PlatformerState.ts` (flat, next to `PlatformerPage.tsx` — same placement as the existing `src/themes/space/SpaceState.ts`) exposes a `@preact/signals-react` `signal<PlayerState>` initialized to stand on the level's hand-picked spawn tile, computed via the same `tileToPixel` helper terrain rendering already uses. `engine/Renderer.ts` gains a `drawPlayer` function alongside the existing `drawTerrain`, following the same "look up source rect, `ctx.drawImage` into the bottom-anchored `originY`" pattern. `PlatformerPage.tsx` loads the new `knight.png` sprite sheet the same way it already loads `world_tileset.png`, and draws the player after the terrain on every redraw.

**Tech Stack:** React 19, TypeScript strict, Vitest + React Testing Library + jsdom, Canvas 2D API, `@preact/signals-react` (already a dependency, already used elsewhere for theme-scoped state — e.g. `src/themes/space/SpaceState.ts`), CC0-licensed sprite asset (`public/sprites/knight.png`, license already covered by `public/sprites/LICENSE-sprites.txt`).

**Spec:** [specs/S-006-platformer-theme/spec.md](../../../specs/S-006-platformer-theme/spec.md) (FR-005, FR-028, FR-029, FR-032), roadmap step 3 in [specs/S-006-platformer-theme/roadmap.md](../../../specs/S-006-platformer-theme/roadmap.md)

## Global Constraints

- TypeScript strict mode, no `any` types, no `@ts-ignore` (constitution Principle I / spec SC-007).
- Named arrow function exports (except where a plain `function` is idiomatic for a pure helper — keep consistent with this plan's code blocks and with `Terrain.ts`/`Renderer.ts`), named exports only (constitution Principle III).
- Tests use Vitest + React Testing Library + jsdom; test naming follows `{method}-{Condition}-{ExpectedResult}` (constitution Principle II).
- No backend, no API calls, no new npm dependencies.
- No physics, no input handling, no animation-frame cycling in this step — the player renders exactly one static idle frame (`animFrame: 0`). Gravity/collision is roadmap step 4; walk animation is step 5; jump is step 6.
- Player state (`PlayerState`) only carries the fields this step actually reads (`x`, `y`, `animState`, `animFrame`). Do not add `vx`/`vy`/`grounded`/`facing` yet — those are introduced by the roadmap steps that first use them (4, 4, 4, 5 respectively), each as a small extension of the same signal.

## Exact Sprite Coordinates (from `public/sprites/knight.png`, confirmed by direct pixel inspection, 32×32 grid, 8 cols × 8 rows)

| Row | Content | Cols with sprite frames | Wired up in roadmap step |
|---|---|---|---|
| 0 (y=0) | Idle (4 frames) | 0–3 | **3 (this plan)** |
| 2–3 (y=64, y=96) | Run (8 frames each row) | 0–7 | 5 (walk animation) |
| 5 (y=160) | Roll | 0–7 | not used — no roll mechanic in spec |
| 6 (y=192) | Hit | 0–3 | 16 (side/below damage knockback) |
| 7 (y=224) | Death | 0–3 | 8 (pit-fall respawn), reused in 16 (heart depletion) |

Idle frame `n` (0-3) source rect: `(sx, sy, sw, sh) = (n * 32, 0, 32, 32)`. Same formula applies to run/hit/death rows when their steps wire them up (`sy` becomes that row's `y` offset from the table above).

This step only uses the idle row. `PlayerAnimState` (`entities/Player.ts`, Task 1) is `'idle'` only for now — it grows to include `'run'`, `'hit'`, `'death'` as steps 5, 16, and 8 respectively implement them; each addition is a one-line union extension plus a new `case` in `playerFrameSource`, not a restructure. No jump row exists in this sheet — step 6 (jump) needs a separate sprite source, out of scope for this plan.

---

### Task 1: Player entity — sprite geometry and state type

**Files:**
- Create: `src/themes/platformer/entities/Player.ts`
- Test: `src/themes/platformer/entities/Player.test.ts`

**Interfaces:**
- Consumes: `RENDER_SCALE` from `../level/Terrain.ts` (already exists: `export const RENDER_SCALE = 2`).
- Produces: `PLAYER_FRAME_SIZE`, `PLAYER_RENDERED_SIZE`, `PlayerAnimState`, `PlayerState`, `playerFrameSource(animState, frame)`. Task 2 (`PlatformerState.ts`) imports `PlayerState` and `PLAYER_RENDERED_SIZE`. Task 3 (`Renderer.ts`) imports `PLAYER_FRAME_SIZE`, `PLAYER_RENDERED_SIZE`, `playerFrameSource`, and the `PlayerState` type.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/entities/Player.test.ts`:

```ts
import { playerFrameSource, PLAYER_FRAME_SIZE, PLAYER_RENDERED_SIZE } from './Player';
import { RENDER_SCALE } from '../level/Terrain';

describe('Player', () => {
  it('playerRenderedSize-scalesByRenderScale', () => {
    expect(PLAYER_RENDERED_SIZE).toBe(PLAYER_FRAME_SIZE * RENDER_SCALE);
  });

  it('playerFrameSource-idleFrame0-returnsFirstColumnSource', () => {
    expect(playerFrameSource('idle', 0)).toEqual({ sx: 0, sy: 0 });
  });

  it('playerFrameSource-idleFrame2-returnsThirdColumnSource', () => {
    expect(playerFrameSource('idle', 2)).toEqual({ sx: 2 * PLAYER_FRAME_SIZE, sy: 0 });
  });

  it('playerFrameSource-idleFrame4-wrapsToFirstColumnSource', () => {
    expect(playerFrameSource('idle', 4)).toEqual({ sx: 0, sy: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/Player.test.ts`
Expected: FAIL — `Cannot find module './Player'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/themes/platformer/entities/Player.ts`:

```ts
import { RENDER_SCALE } from '../level/Terrain';

export const PLAYER_FRAME_SIZE = 32;
export const PLAYER_RENDERED_SIZE = PLAYER_FRAME_SIZE * RENDER_SCALE;

export type PlayerAnimState = 'idle';

export interface PlayerState {
  x: number;
  y: number;
  animState: PlayerAnimState;
  animFrame: number;
}

const IDLE_FRAME_COUNT = 4;

export function playerFrameSource(
  animState: PlayerAnimState,
  frame: number,
): { sx: number; sy: number } {
  switch (animState) {
    case 'idle':
      return { sx: (frame % IDLE_FRAME_COUNT) * PLAYER_FRAME_SIZE, sy: 0 };
    default: {
      const _exhaustive: never = animState;
      return _exhaustive;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/entities/Player.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/Player.ts src/themes/platformer/entities/Player.test.ts
git commit -m "feat(platformer): add Player entity sprite geometry and state type"
```

---

### Task 2: Spawn tile + player state signal

**Files:**
- Modify: `src/themes/platformer/level/level1.ts` (add exported `SPAWN_TILE` constant)
- Modify: `src/themes/platformer/level/level1.test.ts` (add spawn tile assertions)
- Create: `src/themes/platformer/PlatformerState.ts`
- Test: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Consumes: `level1` (from `level/level1.ts`, already exists), `tileAt`, `isTopExposed`, `tileToPixel`, `RENDERED_TILE_SIZE` (from `level/Terrain.ts`, already exist), `PlayerState`, `PLAYER_RENDERED_SIZE` (from `entities/Player.ts`, Task 1).
- Produces: `SPAWN_TILE: { col: number; row: number }` (from `level1.ts`); `playerState: Signal<PlayerState>` (from `PlatformerState.ts`). Task 3 (`PlatformerPage.tsx`) imports `playerState`.

`level1`'s bottom two rows are `'GGBBGGGGGGGGRRRRRRRR'` (row 10, the ground surface) and `'GG..GGGGGGGGRRRRRRRR'` (row 11). Column 1 of row 10 is `groundGrass` with nothing above it (top-exposed), one tile left of the bridged pit at columns 2-3 — a safe, unambiguous spawn spot near the level's left edge.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/level/level1.test.ts` (new `it` inside the existing `describe('level1', ...)` block, alongside the other `level1` assertions):

```ts
  it('spawnTile-isTopExposedGroundGrass', () => {
    const { col, row } = SPAWN_TILE;
    expect(level1.terrain[row][col]).toBe('groundGrass');
    expect(isTopExposed(level1, col, row)).toBe(true);
  });
```

Update the top of `src/themes/platformer/level/level1.test.ts` to add the two new imports:

```ts
import { level1, parseLevel, TILE_CHARS, SPAWN_TILE } from './level1';
import { isTopExposed } from './Terrain';
```

Create `src/themes/platformer/PlatformerState.test.ts`:

```ts
import { playerState } from './PlatformerState';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import { SPAWN_TILE } from './level/level1';
import { PLAYER_RENDERED_SIZE } from './entities/Player';

describe('PlatformerState', () => {
  it('playerState-initial-hasIdleAnimAtFrameZero', () => {
    expect(playerState.value.animState).toBe('idle');
    expect(playerState.value.animFrame).toBe(0);
  });

  it('playerState-initial-standsHorizontallyCenteredOnSpawnTile', () => {
    const spawnTop = tileToPixel(SPAWN_TILE.col, SPAWN_TILE.row);
    const expectedX = spawnTop.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
    expect(playerState.value.x).toBe(expectedX);
  });

  it('playerState-initial-feetRestOnSpawnTileTop', () => {
    const spawnTop = tileToPixel(SPAWN_TILE.col, SPAWN_TILE.row);
    const expectedY = spawnTop.y - PLAYER_RENDERED_SIZE;
    expect(playerState.value.y).toBe(expectedY);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/level1.test.ts src/themes/platformer/PlatformerState.test.ts`
Expected: FAIL — `level1.test.ts` fails with `SPAWN_TILE is not exported` / import error; `PlatformerState.test.ts` fails with `Cannot find module './PlatformerState'`.

- [ ] **Step 3: Write minimal implementation**

Add to `src/themes/platformer/level/level1.ts`, after the `level1` export at the bottom of the file:

```ts
/**
 * Player spawn point: one tile left of the bridged pit, on the
 * top-exposed grass ground strip.
 */
export const SPAWN_TILE = { col: 1, row: 10 };
```

Create `src/themes/platformer/PlatformerState.ts`:

```ts
import { signal } from '@preact/signals-react';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import { SPAWN_TILE } from './level/level1';
import { PLAYER_RENDERED_SIZE } from './entities/Player';
import type { PlayerState } from './entities/Player';

function initialPlayerState(): PlayerState {
  const spawnTop = tileToPixel(SPAWN_TILE.col, SPAWN_TILE.row);
  return {
    x: spawnTop.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2,
    y: spawnTop.y - PLAYER_RENDERED_SIZE,
    animState: 'idle',
    animFrame: 0,
  };
}

/** Player position/animation state — mutated by the game loop (added in later steps). */
export const playerState = signal<PlayerState>(initialPlayerState());
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/level1.test.ts src/themes/platformer/PlatformerState.test.ts`
Expected: PASS (all `level1.test.ts` tests including the new one, all 3 new `PlatformerState.test.ts` tests)

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/level1.ts src/themes/platformer/level/level1.test.ts src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): add spawn tile and player state signal"
```

---

### Task 3: `drawPlayer` renderer function

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `PLAYER_FRAME_SIZE`, `PLAYER_RENDERED_SIZE`, `playerFrameSource`, `PlayerState` (from `../entities/Player.ts`, Task 1).
- Produces: `drawPlayer(ctx, player, spriteSheet, originY = 0)`. Task 4 (`PlatformerPage.tsx`) imports it.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/engine/Renderer.test.ts` (new `describe` block, after the existing `describe('drawTerrain', ...)` block). Replace the existing `import { drawTerrain } from './Renderer';` line at the top of the file with:

```ts
import { drawTerrain, drawPlayer } from './Renderer';
import type { PlayerState } from '../entities/Player';
```

```ts
describe('drawPlayer', () => {
  const fakeSpriteSheet = {} as HTMLImageElement;
  const idlePlayer: PlayerState = { x: 16, y: 256, animState: 'idle', animFrame: 0 };

  it('idleFrame0-draws-fromFirstIdleSource', () => {
    const ctx = makeMockContext();

    drawPlayer(ctx, idlePlayer, fakeSpriteSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeSpriteSheet, 0, 0, 32, 32, 16, 256, 64, 64);
  });

  it('idleFrame2-draws-fromThirdIdleSource', () => {
    const ctx = makeMockContext();
    const player: PlayerState = { ...idlePlayer, animFrame: 2 };

    drawPlayer(ctx, player, fakeSpriteSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeSpriteSheet, 64, 0, 32, 32, 16, 256, 64, 64);
  });

  it('originY-shiftsPlayerVertically', () => {
    const ctx = makeMockContext();

    drawPlayer(ctx, idlePlayer, fakeSpriteSheet, 100);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeSpriteSheet, 0, 0, 32, 32, 16, 356, 64, 64);
  });

  it('draws-setsImageSmoothingEnabledFalse', () => {
    const ctx = makeMockContext();

    drawPlayer(ctx, idlePlayer, fakeSpriteSheet);

    expect(ctx.imageSmoothingEnabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL — `drawPlayer is not exported from './Renderer'`.

- [ ] **Step 3: Write minimal implementation**

In `src/themes/platformer/engine/Renderer.ts`, add to the existing import block and append the new function at the end of the file:

```ts
import { PLAYER_FRAME_SIZE, PLAYER_RENDERED_SIZE, playerFrameSource } from '../entities/Player';
import type { PlayerState } from '../entities/Player';
```

```ts
/**
 * Draws the player sprite. `originY` shifts it vertically by the same
 * amount as `drawTerrain`'s `originY`, so the player stays aligned with
 * the bottom-anchored level.
 */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  spriteSheet: HTMLImageElement,
  originY = 0,
): void {
  ctx.imageSmoothingEnabled = false;

  const { sx, sy } = playerFrameSource(player.animState, player.animFrame);
  ctx.drawImage(
    spriteSheet,
    sx,
    sy,
    PLAYER_FRAME_SIZE,
    PLAYER_FRAME_SIZE,
    player.x,
    player.y + originY,
    PLAYER_RENDERED_SIZE,
    PLAYER_RENDERED_SIZE,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS (all existing `drawTerrain` tests plus the 4 new `drawPlayer` tests)

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): add drawPlayer renderer function"
```

---

### Task 4: Wire the player sprite into `PlatformerPage`

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `playerState` (from `./PlatformerState.ts`, Task 2), `drawPlayer` (from `./engine/Renderer.ts`, Task 3), `PLAYER_RENDERED_SIZE` (from `./entities/Player.ts`, Task 1, test-only), `loadImage` (already imported).

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/PlatformerPage.test.tsx` (new `it` blocks inside the existing `describe('PlatformerPage', ...)` block; add the import at the top of the file):

```ts
import { PLAYER_RENDERED_SIZE } from './entities/Player';
```

```ts
  it('render-afterPlayerSpriteLoads-drawsPlayerAtIdleSize', async () => {
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as { drawImage: ReturnType<typeof vi.fn> };

    await waitFor(() => expect(ctx.drawImage).toHaveBeenCalled());

    const playerCalls = ctx.drawImage.mock.calls.filter(
      (call: unknown[]) => call[7] === PLAYER_RENDERED_SIZE,
    );
    expect(playerCalls.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: FAIL — no `drawImage` call has `dWidth === PLAYER_RENDERED_SIZE` (player sprite is never loaded/drawn yet).

- [ ] **Step 3: Write minimal implementation**

Modify `src/themes/platformer/PlatformerPage.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { FloatingControls } from './components/FloatingControls';
import { loadImage } from './engine/SpriteLoader';
import { drawTerrain, drawPlayer } from './engine/Renderer';
import { level1 } from './level/level1';
import { RENDERED_TILE_SIZE } from './level/Terrain';
import { playerState } from './PlatformerState';

export const PlatformerPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tilesetRef = useRef<HTMLImageElement | null>(null);
  const playerSpriteRef = useRef<HTMLImageElement | null>(null);

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

      // Anchor the level to the bottom of the canvas so a taller viewport
      // shows more sky above the ground instead of empty space below it.
      const levelPixelHeight = level1.height * RENDERED_TILE_SIZE;
      const originY = canvas.height - levelPixelHeight;

      if (tilesetRef.current) {
        drawTerrain(ctx, level1, tilesetRef.current, originY);
      }

      if (playerSpriteRef.current) {
        drawPlayer(ctx, playerState.value, playerSpriteRef.current, originY);
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
    loadImage('/sprites/knight.png')
      .then((img) => {
        if (cancelled) return;
        playerSpriteRef.current = img;
        draw();
      })
      .catch(() => {
        // Player simply won't render if the sprite fails to load; the
        // terrain still shows.
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

Note: `originY` is now computed once per `draw()` call and reused for both `drawTerrain` and `drawPlayer` (previously it was computed inline only inside the `tilesetRef.current` branch).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS (all existing tests plus the new one)

- [ ] **Step 5: Run the full platformer test suite**

Run: `npx vitest run src/themes/platformer`
Expected: PASS (all files)

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): render idle player sprite on the level"
```

---

### Task 5: Manual browser verification + roadmap checkoff

**Files:**
- Modify: `specs/S-006-platformer-theme/roadmap.md`

- [ ] **Step 1: Start the dev server and open the Platformer theme**

Use the preview tools to start the project's dev server, navigate to the app, and switch to the Platformer theme (same manual flow used to verify steps 1-2).

- [ ] **Step 2: Visually confirm**

Confirm the knight character is visible standing on the grass ground near the left edge of the level, just left of the small bridged pit, positioned above the top-exposed grass tile. Resize the browser window (or check a couple of viewport sizes) and confirm the player stays correctly anchored to the ground alongside the terrain (no floating above or sinking below the tile).

- [ ] **Step 3: Check off the roadmap step**

In `specs/S-006-platformer-theme/roadmap.md`, change:

```
- [ ] **3. Player idle render** — sprite drawn standing on the ground, no physics.
```

to:

```
- [x] **3. Player idle render** — sprite drawn standing on the ground, no physics.
```

- [ ] **Step 4: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "Check off roadmap step 3 — verified in browser"
```
