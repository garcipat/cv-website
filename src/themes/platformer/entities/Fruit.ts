import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { CollectedFact } from '../types';
import { clamp01 } from '../shared/math';

/** `fruit.png` is a 64x64 sheet, but only its first 3 columns hold icons
 *  (12 distinct fruits, 4 rows) — the 4th column is empty transparent space
 *  and is never addressed. Unlike coin.png, it's not an animation strip.
 *  Fruits bob (see Coin.ts's coinBobOffset, reused as-is — bobbing is
 *  visual, not coin-specific) but never change frame. */
export const FRUIT_FRAME_SIZE = 16;
export const FRUIT_RENDERED_SIZE = FRUIT_FRAME_SIZE * RENDER_SCALE;
export const FRUIT_ICON_COLUMNS = 3;
export const FRUIT_ICON_COUNT = 12;

/** Maps a logical fruit index (0-based, in *use* order) to its packed
 *  position (0-11, row-major over the sheet's 3 real columns — the empty
 *  4th column is skipped entirely rather than addressed). Live user
 *  feedback (2026-08-30): packed positions 0, 2, 3, 8, 9 read as the most
 *  realistic-looking icons and should appear first — everything else
 *  follows in its original sheet order as a reserve pool for future fruit
 *  types. */
export const FRUIT_ICON_ORDER = [0, 2, 3, 8, 9, 1, 4, 5, 6, 7, 10, 11];

/** Sprite-sheet source rect for a given logical icon index (wraps at
 *  FRUIT_ICON_COUNT; see FRUIT_ICON_ORDER for the logical-to-packed
 *  mapping). */
export function fruitFrameSource(index: number): { sx: number; sy: number } {
  const wrapped = ((index % FRUIT_ICON_COUNT) + FRUIT_ICON_COUNT) % FRUIT_ICON_COUNT;
  const packed = FRUIT_ICON_ORDER[wrapped];
  const col = packed % FRUIT_ICON_COLUMNS;
  const row = Math.floor(packed / FRUIT_ICON_COLUMNS);
  return { sx: col * FRUIT_FRAME_SIZE, sy: row * FRUIT_FRAME_SIZE };
}

/** How long a fruit takes to rise from its spawning block up into the empty
 *  tile directly above it before settling as a touchable pickup (spec.md
 *  Acceptance Scenario 3 — "pops upward into the space directly above the
 *  block"). */
export const FRUIT_RISE_DURATION_SECONDS = 0.3;

/**
 * A question-mark block's spawned reward (spec.md's "Bonus pickup" glossary
 * entry). Carries a CV fact — Certificates/Projects live on question-mark
 * blocks (see `BlockMapper.ts`'s `certificateToBlock`/`projectToBlock`) —
 * revealed the same way as any other collectible once picked up
 * (`PlatformerPage.tsx` pushes it into `collectedFacts` and flies it to the
 * journal). `fact` is `undefined` only for a question-mark marker beyond the
 * available Certificate/Project data (see `BlockMapper.ts`'s `placeBlocks`),
 * in which case picking it up stays a silent, factless removal. `x` is fixed
 * at the source block's x (fruits only rise straight up, never drift
 * horizontally); `restY` is one tile above the block's `y`, matching
 * currentLevel's reserved blank row above every `Q` marker. `iconIndex` picks
 * a `fruit.png` frame (see `fruitFrameSource`) so fruits visually vary from
 * spawn to spawn, distinguishing them from each other.
 *
 * Merged here (R-002 FR-022) from the former `entities/BonusFruit.ts`, which
 * the question-mark reward's `PickupType` also drew from.
 */
export interface FruitState {
  id: string;
  x: number;
  restY: number;
  /** Seconds elapsed since spawning — drives the rise tween via `fruitY`;
   *  once it reaches `FRUIT_RISE_DURATION_SECONDS` the fruit has finished
   *  rising and become a touchable pickup. */
  elapsed: number;
  /** The block's y at spawn time — `fruitY` eases from here to `restY`. */
  startY: number;
  fact?: CollectedFact;
  iconIndex: number;
}

/** Spawns a fruit at the position of the question-mark block that was just
 *  hit (`blockX`/`blockY`), reusing the block's own id as the fruit's id — a
 *  question-mark only ever spawns one fruit in its lifetime (it stops
 *  responding to hits after the first), so there's no collision risk. `fact`
 *  carries forward the source block's fact, if any (undefined for a
 *  question-mark marker beyond the available Certificate/Project data).
 *  `iconIndex` is caller-supplied (`PlatformerPage.tsx` cycles a counter, the
 *  same convention `createSlotAllocator` uses for text slots) rather than
 *  derived here, so successive spawns visibly differ without needing shared
 *  module state. */
export function spawnFruit(
  id: string,
  blockX: number,
  blockY: number,
  fact: CollectedFact | undefined,
  iconIndex: number,
): FruitState {
  return {
    id,
    x: blockX,
    startY: blockY,
    restY: blockY - RENDERED_TILE_SIZE,
    elapsed: 0,
    fact,
    iconIndex: ((iconIndex % FRUIT_ICON_COUNT) + FRUIT_ICON_COUNT) % FRUIT_ICON_COUNT,
  };
}

/** Advances the fruit's rise timer by `dt` seconds. Never removes/clamps
 *  anything itself — `fruitY` is what clamps the visual position once fully
 *  risen, and `Collision.ts`'s `checkFruitCollisions` is what gates pickup on
 *  the rise being finished. */
export function tickFruit(fruit: FruitState, dt: number): FruitState {
  return { ...fruit, elapsed: fruit.elapsed + dt };
}

/** Current world-space y for rendering/collision — eases linearly from the
 *  spawning block's y up to `restY` over `FRUIT_RISE_DURATION_SECONDS`, then
 *  holds at `restY` forever after. */
export function fruitY(fruit: FruitState): number {
  const progress = clamp01(fruit.elapsed / FRUIT_RISE_DURATION_SECONDS);
  return fruit.startY + (fruit.restY - fruit.startY) * progress;
}
