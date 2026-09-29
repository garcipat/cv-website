import { signal, computed } from '@preact/signals-react';
import {
  CRATE_TILES,
  QUESTIONMARK_TILES,
  FRAGILE_ROCK_TILES,
  COIN_POT_TILES,
  POTION_POT_TILES,
  BOMB_POT_TILES,
} from './levelSession';
import { currentCV } from '@/state/locale';
import { mapCVDataToBlocks, placeBlocks } from '../level/BlockMapper';
import type { BlockPlacement } from '../level/BlockMapper';
import { toBlockState, isBlockUsedUp, restoredOnRespawnForBlock } from '../entities/Block';
import type { BlockState } from '../entities/Block';

/**
 * Every block in the level, placed once at module load — same
 * non-reactive, marker-driven convention as collectiblePlacements/
 * enemyPlacements above. Crates come from
 * `mapCVDataToBlocks` zipped against currentLevel's `X` markers; question-mark,
 * fragileRock, and coinPot blocks have no CVData mapping and are placed
 * directly from their `Q`/`F`/`u` markers (see BlockMapper.ts's placeBlocks)
 * — a coin-pot's eventual reward comes from the coin it drops, resolved
 * dynamically at pickup time, not from anything bound to the block. This
 * placement carries no live per-instance state (no hitsTaken/broken) — that
 * lives in `blockStates` below, once blocks respond to hits.
 */
export const blockPlacements = computed<BlockPlacement[]>(() =>
  placeBlocks(mapCVDataToBlocks(currentCV.value), {
    crate: CRATE_TILES.value,
    questionMark: QUESTIONMARK_TILES.value,
    fragileRock: FRAGILE_ROCK_TILES.value,
    coinPot: COIN_POT_TILES.value,
    potionPot: POTION_POT_TILES.value,
    bombPot: BOMB_POT_TILES.value,
  }),
);

/**
 * Live, per-frame hit/animation state for every block — mirrors
 * `enemyStates` above. Seeded from `blockPlacements` (module load) and
 * reset back to that seed only by `resetGameProgress()` (the Reset Game
 * button), NOT by `resetGame()` (death/respawn) — blocks behave like
 * collectibles (progress persists across a respawn), not like enemies (which
 * do revive on respawn).
 */
export const blockStates = signal<BlockState[]>(blockPlacements.value.map(toBlockState));

/**
 * How many crates have been destroyed this session — read by
 * `PlatformerPage.tsx`'s crates counter popup and `Journal.tsx`'s summary
 * row, so the two can never disagree.
 *
 * Checks each of `blockPlacements`'s real crates by id rather than filtering
 * `blockStates` directly, for two reasons: (1) a destroyed crate is spliced
 * out of `blockStates` entirely once its shatter animation finishes (see
 * `isBlockRemoved`, applied in `PlatformerPage.tsx`'s per-tick block-state
 * update) — a placement whose id is no longer found there is destroyed just
 * as much as one still present with `isBlockUsedUp` true (mid-shatter), so
 * both must count immediately, not just the latter; and (2) `blockStates`
 * can carry EXTRA crate-kind entries beyond the level's real placements
 * (test helpers inject synthetic ones, id-distinct from any real crate)
 * counting by placement id ignores those rather than corrupting the total.
 */
export const cratesDestroyed = computed<number>(
  () =>
    blockPlacements.value.filter((placement) => {
      if (placement.blockKind !== 'crate') return false;
      const live = blockStates.value.find((b) => b.id === placement.id);
      return !live || isBlockUsedUp(live);
    }).length,
);

/**
 * The blocks domain's respawn-pass hook. Blocks behave like collectibles, not
 * enemies: they persist across a death/respawn, with the single exception of
 * kinds that declare `restoredOnRespawn` (today only the potion pot). Every
 * such placement is rebuilt back to intact — carrying over its `rewardGiven`
 * flag from the prior instance with the same id, the block analog of
 * `reviveEnemy` preserving `rewardGiven`, so a restored 'once' pot never
 * drops a second pickup. Every other block kind (crate/questionMark/
 * fragileRock/coinPot) is left untouched. The flag is read from the registry
 * (`restoredOnRespawnForBlock`) so a future restored kind needs no edit here.
 */
export function reset(respawn: boolean): void {
  if (respawn) {
    blockStates.value = [
      ...blockStates.value.filter((b) => !restoredOnRespawnForBlock(b.blockKind)),
      ...blockPlacements.value
        .filter((p) => restoredOnRespawnForBlock(p.blockKind))
        .map((p) => {
          const restored = toBlockState(p);
          const prior = blockStates.value.find((b) => b.id === p.id);
          return prior ? { ...restored, rewardGiven: prior.rewardGiven } : restored;
        }),
    ];
    return;
  }
  blockStates.value = blockPlacements.value.map(toBlockState);
}

/** The full-reset hook — one body, shared with the respawn pass. */
export function resetFull(): void {
  reset(false);
}
