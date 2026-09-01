import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { FRUIT_ICON_COUNT } from './Fruit';
import type { CollectedFact } from '../types';

/** How long a bonus fruit takes to rise from its spawning block up into the
 *  empty tile directly above it before settling as a touchable pickup
 *  (spec.md Acceptance Scenario 3 — "pops upward into the space directly
 *  above the block"). */
export const BONUS_FRUIT_RISE_DURATION_SECONDS = 0.3;

/**
 * A question-mark block's spawned reward (spec.md's "Bonus pickup" glossary
 * entry). Carries a CV fact — Certificates/Projects live on question-mark
 * blocks (see `BlockMapper.ts`'s `certificateToBlock`/`projectToBlock`) —
 * revealed the same way as any other collectible once picked up
 * (`PlatformerPage.tsx` pushes it into `collectedFacts` and flies it to the
 * journal). `fact` is `undefined` only
 * for a question-mark marker beyond the available Certificate/Project data
 * (see `BlockMapper.ts`'s `placeBlocks`), in which case picking it up stays a
 * silent, factless removal. `x` is fixed at the source block's x (fruits
 * only rise straight up, never drift horizontally); `restY` is one tile
 * above the block's `y`, matching currentLevel's reserved blank row above every
 * `Q` marker. `iconIndex` picks a `fruit.png` frame (see `Fruit.ts`'s
 * `fruitFrameSource`) so bonus fruits visually vary from spawn to spawn,
 * distinguishing them from each other and from the fixed-icon Language
 * fruits (`F` markers) elsewhere in the level.
 */
export interface BonusFruitState {
  id: string;
  x: number;
  restY: number;
  /** Seconds elapsed since spawning — drives the rise tween via
   *  `bonusFruitY`; once it reaches `BONUS_FRUIT_RISE_DURATION_SECONDS` the
   *  fruit has finished rising and become a touchable pickup. */
  elapsed: number;
  /** The block's y at spawn time — `bonusFruitY` eases from here to `restY`. */
  startY: number;
  fact?: CollectedFact;
  iconIndex: number;
}

/** Spawns a bonus fruit at the position of the question-mark block that was
 *  just hit (`blockX`/`blockY`), reusing the block's own id as the fruit's id
 *  — a question-mark only ever spawns one fruit in its lifetime (it stops
 *  responding to hits after the first), so there's no collision risk. `fact`
 *  carries forward the source block's fact, if any (undefined for a
 *  question-mark marker beyond the available Certificate/Project data).
 *  `iconIndex` is caller-supplied (`PlatformerPage.tsx` cycles a counter,
 *  same convention as its `nextTextSlot`) rather than derived here, so
 *  successive spawns visibly differ without needing shared module state. */
export function spawnBonusFruit(
  id: string,
  blockX: number,
  blockY: number,
  fact: CollectedFact | undefined,
  iconIndex: number,
): BonusFruitState {
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
 *  anything itself — `bonusFruitY` is what clamps the visual position once
 *  fully risen, and `Collision.ts`'s `checkBonusFruitCollisions` is what
 *  gates pickup on the rise being finished. */
export function tickBonusFruit(fruit: BonusFruitState, dt: number): BonusFruitState {
  return { ...fruit, elapsed: fruit.elapsed + dt };
}

/** Current world-space y for rendering/collision — eases linearly from the
 *  spawning block's y up to `restY` over `BONUS_FRUIT_RISE_DURATION_SECONDS`,
 *  then holds at `restY` forever after. */
export function bonusFruitY(fruit: BonusFruitState): number {
  const progress = Math.max(0, Math.min(1, fruit.elapsed / BONUS_FRUIT_RISE_DURATION_SECONDS));
  return fruit.startY + (fruit.restY - fruit.startY) * progress;
}
