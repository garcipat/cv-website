import type { PickupSpawnSource, PickupType } from './PickupType';
import type { Pickup } from '../../contracts/Pickup';
import { FRUIT_SHEET } from '../sprites/sheets';
import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../../level/Terrain';
import type { CollectedFact } from '../../types';
import { clamp01 } from '../../shared/math';

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
 * in which case picking it up stays a silent, factless collection. `x` is
 * fixed at the source block's x (fruits only rise straight up, never drift
 * horizontally); `restY` is one tile above the block's `y`, matching
 * currentLevel's reserved blank row above every `Q` marker. `iconIndex` picks
 * a `fruit.png` frame (see `fruitFrameSource`) so fruits visually vary from
 * spawn to spawn, distinguishing them from each other.
 *
 * Composes the shared `Pickup` base: `y` is the STORED rise position (kept in
 * sync with `fruitY`'s easing by `tickFruit`) and `collected` is the shared
 * collect-once flag. The former `entities/Fruit.ts` merged into this module
 * (R-006 US3); it is the single reward-fruit module.
 */
export interface FruitState extends Pickup {
  kind: 'fruit';
  restY: number;
  /** Seconds elapsed since spawning — drives the rise tween via `fruitY`; the
   *  stored `y` is re-derived from this on every `tickFruit`. */
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
    kind: 'fruit',
    x: blockX,
    y: blockY,
    collected: false,
    startY: blockY,
    restY: blockY - RENDERED_TILE_SIZE,
    elapsed: 0,
    fact,
    iconIndex: ((iconIndex % FRUIT_ICON_COUNT) + FRUIT_ICON_COUNT) % FRUIT_ICON_COUNT,
  };
}

/** Advances the fruit's rise timer by `dt` seconds and re-derives its stored
 *  `y` from `fruitY`'s easing, so every position read is the stored one and
 *  stays byte-identical to the former compute-on-read `fruitY(fruit)`. Never
 *  removes/clamps anything itself — `fruitY` clamps the visual position once
 *  fully risen, and the fruit kind's `isCollectible` gates collection on the
 *  rise being finished. */
export function tickFruit(fruit: FruitState, dt: number): FruitState {
  const next = { ...fruit, elapsed: fruit.elapsed + dt };
  return { ...next, y: fruitY(next) };
}

/** Current world-space y for rendering/collision — eases linearly from the
 *  spawning block's y up to `restY` over `FRUIT_RISE_DURATION_SECONDS`, then
 *  holds at `restY` forever after. `tickFruit` keeps the state's stored `y`
 *  equal to this easing. */
export function fruitY(fruit: Pick<FruitState, 'startY' | 'restY' | 'elapsed'>): number {
  const progress = clamp01(fruit.elapsed / FRUIT_RISE_DURATION_SECONDS);
  return fruit.startY + (fruit.restY - fruit.startY) * progress;
}

/**
 * The `PickupType` view of a question-mark block's spawned fruit — the live
 * reward kind (the literal "drop `'fruit'`" wording in issue #94 is superseded
 * by the spec's clarification; see the plan's Documented Deviation). `box`'s
 * `y` is the STORED rise position (kept in sync by `tickFruit`). A rising
 * fruit is not collectible until `elapsed >= FRUIT_RISE_DURATION_SECONDS`, and
 * it draws in the `belowBlocks` band so its source block occludes it mid-rise.
 * `frameIndex` returns the fruit's own `iconIndex` as-is — already the LOGICAL
 * index; packed-slot mapping via `FRUIT_ICON_ORDER` happens at draw time.
 */
export const fruit: PickupType<FruitState> = {
  key: 'fruit',
  drawLayer: 'belowBlocks',
  sprite: {
    sheet: FRUIT_SHEET,
    renderScale: 1,
    // Frame selection goes through frameIndex (fruit.iconIndex), not through
    // named animations — this stays empty rather than restating unread
    // frame/duration data.
    animations: {},
  },
  box: (fruitState) => ({
    x: fruitState.x,
    y: fruitState.y,
    width: FRUIT_RENDERED_SIZE,
    height: FRUIT_RENDERED_SIZE,
  }),
  frameIndex: (fruitState) => fruitState.iconIndex,
  bobOffset: () => 0,
  spawn: (source: PickupSpawnSource): FruitState =>
    spawnFruit(source.id, source.x, source.y, source.fact, source.iconIndex?.() ?? 0),
  isCollectible: (fruitState) => fruitState.elapsed >= FRUIT_RISE_DURATION_SECONDS,
  onPickup: (fruitState) =>
    fruitState.fact
      ? { facts: [{ fact: fruitState.fact, effectId: fruitState.id, counterKey: 'fruits' }] }
      : {},
  // No bob offset added (see bobOffset above): the fruit's own rise tween is
  // its vertical motion.
  draw: (fruitState, dc) => {
    const image = dc.sprites[FRUIT_SHEET.src];
    if (!image) return;

    const { sx, sy } = fruitFrameSource(fruit.frameIndex(fruitState, dc.worldElapsed, 0));

    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      sx,
      sy,
      FRUIT_FRAME_SIZE,
      FRUIT_FRAME_SIZE,
      fruitState.x + dc.originX,
      fruitState.y + dc.originY,
      FRUIT_RENDERED_SIZE,
      FRUIT_RENDERED_SIZE,
    );
  },
};
