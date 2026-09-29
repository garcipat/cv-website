import { signal, computed } from '@preact/signals-react';
import { COIN_TILES } from './levelSession';
import { currentCV } from '@/state/locale';
import { mapCVDataToSkillFactPool, placeCollectibles } from '../level/CollectibleMapper';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import type { CollectedFact } from '../types';
import type { FruitState } from '../entities/pickups/Fruit';
import type { KeyPickupState } from '../entities/pickups/Key';
import type { HeartPickupState } from '../entities/pickups/Heart';
import type { BombPickupState } from '../entities/deployableItems/Bomb';
import type { Pickup, PickupGroups } from '../contracts/Pickup';
import type { PickupKind } from '../contracts/PickupKind';

/**
 * Every collectible in the level — purely positional now (see
 * `CollectibleMapper.ts`'s `mapCVDataToSkillFactPool` doc comment for why a
 * coin carries no CVData binding of its own), so this needs only the level's
 * hand-placed `o` markers (see COIN_TILES), not `currentCV` at all.
 * placeCollectibles has no auto-placement, same as placeEnemies.
 */
export const collectiblePlacements = computed<CollectiblePlacement[]>(() =>
  placeCollectibles(COIN_TILES.value),
);

/**
 * The mutable, flag-carrying base coins — the `collected: true` entries the
 * pure `collectiblePlacements` cannot hold because it is level-derived.
 * Initialised from `collectiblePlacements` (each entry normalised to
 * `collected: false`) and re-derived uncollected only by
 * `resetGameProgress()` (the Level Editor's Try button and the Reset Game
 * button both route through it) — so a placed coin's flag survives
 * death/respawn, and a level change clears it. There is no signals effect;
 * the re-derivation seam is explicit. Reset Game / level change only, never
 * `resetGame()` (death/respawn).
 *
 * `collectiblePlacements` stays the pure source for `levelTotals`'s coin
 * count, which is deliberately not invalidated by a collect or a pot drop.
 */
export const baseCoinPlacements = signal<CollectiblePlacement[]>(
  collectiblePlacements.value.map((placement) => ({ ...placement, collected: false })),
);

/**
 * The ordered pool of skill-category facts a coin pickup can reveal — see
 * `CollectibleMapper.ts`'s `mapCVDataToSkillFactPool` doc comment.
 * `PlatformerPage.tsx` resolves how many of this pool's entries have been
 * revealed so far (and therefore which one a given pickup reveals) from
 * this via `level/SkillFactPacing.ts`'s `revealedFactCountFor` — proportional
 * across every coin the level has, not "the next entry in order" — for both
 * a walk-over coin and a coin dropped by a broken coin-pot.
 */
export const skillFactPool = computed<CollectedFact[]>(() =>
  mapCVDataToSkillFactPool(currentCV.value),
);

/**
 * Coins dropped by a destroyed coin-pot this session — starts empty. Unlike
 * every other collectible (placed once at load time via
 * `collectiblePlacements`), a coin-pot's reward coin doesn't exist — and
 * isn't reachable/collectible — until its block is destroyed;
 * `PlatformerPage.tsx` appends to this the instant that happens. Reset to
 * `[]` by `resetGameProgress()` alongside `blockStates`, so a full "Reset
 * Game" also re-hides these behind their (now-restored) pots.
 */
export const spawnedCoinPlacements = signal<CollectiblePlacement[]>([]);

/**
 * Every currently-collectible coin: the mutable, flag-carrying
 * `baseCoinPlacements` plus any coin-pot drops so far this session. Every
 * player-facing read (collision, rendering, totals) that used to read
 * `collectiblePlacements` directly now reads this instead, so a dropped coin
 * behaves exactly like any other one.
 */
export const allCollectiblePlacements = computed<CollectiblePlacement[]>(() => [
  ...baseCoinPlacements.value,
  ...spawnedCoinPlacements.value,
]);

/**
 * Question-mark blocks' spawned fruits — starts empty; `PlatformerPage.tsx`
 * appends one each time a question-mark block is hit. Persists across a
 * death/respawn (same reasoning as `blockStates` above); cleared only by
 * `resetGameProgress()`.
 */
export const fruitStates = signal<FruitState[]>([]);

/**
 * Hearts dropped by destroyed potion-pots this session — starts empty, same
 * lifecycle as `fruitStates` above: `PlatformerPage.tsx` appends one each time
 * a potion-pot block is hit. A touched heart is retained and flagged
 * `collected` (skipped on draw/collision, never removed), and the array is
 * cleared by `resetGame()` (a dropped heart is tied to its now-restored pot).
 */
export const heartPickupStates = signal<HeartPickupState[]>([]);

/**
 * Dropped-key pickups (one per purple-slime finishing stomp) — starts empty.
 * Collected entries stay in this array flagged `collected: true` rather than
 * being removed, so the shared skip-if-collected logic (see
 * entities/pickups/Key.ts) keeps working across a death/respawn. The
 * guarantee that a defeated purple slime can never drop a second key lives
 * elsewhere now: on the source enemy's own `rewardGiven` flag (Enemy.ts), not
 * on anything read from this array. Persists across a death/respawn
 * (resetGame()), same as blockStates/fruitStates — cleared only by
 * resetGameProgress().
 */
export const keyPickupStates = signal<KeyPickupState[]>([]);

/**
 * Count of keys currently held, spent one at a time to open a chest
 *. Persists across a death/respawn, same as
 * keyPickupStates above — cleared only by resetGameProgress().
 */
export const collectedKeys = signal<number>(0);

/** The maximum number of bombs the character can carry. */
export const MAX_BOMBS = 5;

/**
 * How many bombs the character is carrying — always an integer in
 * `[0, MAX_BOMBS]`. Collecting a bomb pickup increments this by one while
 * below the cap; placing consumes exactly one. A `signal`
 * like `collectedKeys`.
 */
export const carriedBombs = signal<number>(0);

/**
 * Bombs dropped by destroyed bomb-pots this session — starts empty, same
 * lifecycle as `heartPickupStates`: appended when a bomb-pot breaks, retained
 * and flagged `collected` when collected, and cleared by `resetGame()` (a
 * dropped bomb is tied to its now-restored pot). A pickup at the cap is left
 * in the world, still bobbing, until the count drops below the cap
 * the bomb kind's `maxPerTick` yields nothing at the cap.
 */
export const bombPickupStates = signal<BombPickupState[]>([]);

/** One kind's live array adapter — the kind→store seam the generic applier
 * and spawn path use without naming a kind. `items` is the live read view. */
export interface PickupStore {
  readonly items: readonly Pickup[];
  /** Appends a freshly spawned pickup to this kind's live array. */
  append(item: Pickup): void;
  /** The shared applier's ONE collect-once action: flags every id `collected`,
   * retaining the entry. */
  markCollected(ids: ReadonlySet<string>): void;
}

function markCollectedIn<S extends Pickup>(items: S[], ids: ReadonlySet<string>): S[] {
  return items.map((item) => (ids.has(item.id) ? { ...item, collected: true } : item));
}

const coinStore: PickupStore = {
  get items() {
    return allCollectiblePlacements.value;
  },
  append(item) {
    spawnedCoinPlacements.value = [...spawnedCoinPlacements.value, item as CollectiblePlacement];
  },
  markCollected(ids) {
    // A coin id may live in the base set or in this session's pot drops
    // flag both so `allCollectiblePlacements` (their union) sees it.
    baseCoinPlacements.value = markCollectedIn(baseCoinPlacements.value, ids);
    spawnedCoinPlacements.value = markCollectedIn(spawnedCoinPlacements.value, ids);
  },
};

const fruitStore: PickupStore = {
  get items() {
    return fruitStates.value;
  },
  append(item) {
    fruitStates.value = [...fruitStates.value, item as FruitState];
  },
  markCollected(ids) {
    fruitStates.value = markCollectedIn(fruitStates.value, ids);
  },
};

const keyStore: PickupStore = {
  get items() {
    return keyPickupStates.value;
  },
  append(item) {
    keyPickupStates.value = [...keyPickupStates.value, item as KeyPickupState];
  },
  markCollected(ids) {
    keyPickupStates.value = markCollectedIn(keyPickupStates.value, ids);
  },
};

const heartStore: PickupStore = {
  get items() {
    return heartPickupStates.value;
  },
  append(item) {
    heartPickupStates.value = [...heartPickupStates.value, item as HeartPickupState];
  },
  markCollected(ids) {
    heartPickupStates.value = markCollectedIn(heartPickupStates.value, ids);
  },
};

const bombStore: PickupStore = {
  get items() {
    return bombPickupStates.value;
  },
  append(item) {
    bombPickupStates.value = [...bombPickupStates.value, item as BombPickupState];
  },
  markCollected(ids) {
    bombPickupStates.value = markCollectedIn(bombPickupStates.value, ids);
  },
};

/**
 * Kind→array adapter for the generic collect applier and spawn path — the
 * per-kind arrays stay separate (each with its own reset scope), but the page
 * reaches them by kind instead of naming them.
 */
export const pickupStores: Record<PickupKind, PickupStore> = {
  coin: coinStore,
  fruit: fruitStore,
  key: keyStore,
  heart: heartStore,
  bomb: bombStore,
};

/** The single per-kind groups value the page passes to both
 * `checkPickupCollisions` and `drawPickups`. */
export const pickupGroups = computed<PickupGroups>(() => ({
  coin: allCollectiblePlacements.value,
  fruit: fruitStates.value,
  key: keyPickupStates.value,
  heart: heartPickupStates.value,
  bomb: bombPickupStates.value,
}));

/**
 * The collectibles domain's respawn-pass hook. A dropped heart/bomb is tied to
 * its now-restored pot, so both arrays and the carried count clear; every
 * placed coin/fruit/key and both counters persist (permanence is reset scope
 * alone). The full pass additionally re-derives the mutable base coins
 * uncollected from the pure `collectiblePlacements` — a full "Reset Game"
 * makes every placed coin reappear — and clears the session's pot drops,
 * fruits, keys and the held-key count.
 */
export function reset(respawn: boolean): void {
  heartPickupStates.value = [];
  bombPickupStates.value = [];
  carriedBombs.value = 0;
  if (respawn) return;
  baseCoinPlacements.value = collectiblePlacements.value.map((placement) => ({
    ...placement,
    collected: false,
  }));
  spawnedCoinPlacements.value = [];
  fruitStates.value = [];
  keyPickupStates.value = [];
  collectedKeys.value = 0;
}

/** The full-reset hook — one body, shared with the respawn pass. */
export function resetFull(): void {
  reset(false);
}
