import { signal, computed } from '@preact/signals-react';
import { CHEST_TILES, LADDER_BUNDLE_TILES, currentLevel } from './levelSession';
import { currentCV } from '@/state/locale';
import { createRopeLadderState } from '../entities/deployableItems/RopeLadder';
import type { RopeLadderState } from '../entities/deployableItems/RopeLadder';
import { DEPLOYABLE_ITEM_TYPES, applyDeployableItemTerrain } from '../entities/deployableItems';
import type {
  BlastRequest,
  DeployableItemTickContext,
} from '../entities/deployableItems/DeployableItemType';
import { mapCVDataToChests, placeChests } from '../level/ChestMapper';
import type { ChestPlacement } from '../level/ChestMapper';
import { toChestState, isChestState, isChestOpen } from '../entities/chests';
import type { ChestState } from '../entities/chests';
import type { PlacedBombState } from '../entities/deployableItems/Bomb';
import type { LevelDef } from '../level/LevelData';

/**
 * Every chest in the level, placed once at module load — same non-reactive,
 * marker-driven convention as blockPlacements above. One chest per real
 * Experience entry, zipped against currentLevel's `$` markers (see
 * ChestMapper.ts's placeChests).
 */
export const chestPlacements = computed<ChestPlacement[]>(() =>
  placeChests(mapCVDataToChests(currentCV.value), CHEST_TILES.value),
);

/**
 * Every deployable rope-ladder bundle in the level, from `currentLayout`'s `@`
 * markers (see `LADDER_BUNDLE_TILES`). A `computed`, so the Level Editor's
 * "Try" button updates it reactively like every other placement list. A
 * read-only seed source — the live bundle states live in `deployableItems`.
 */
export const ropeLadderPlacements = computed<RopeLadderState[]>(() =>
  LADDER_BUNDLE_TILES.value.map(({ col, row }) =>
    createRopeLadderState(currentLevel.value, col, row),
  ),
);

/** Every kind of live deployable item, discriminated by `kind`. */
export type DeployableItem = PlacedBombState | RopeLadderState | ChestState;

/**
 * THE one collection of live player-affected objects — a placed bomb, a live
 * rope ladder and a chest — discriminated by `kind`. Seeded at
 * module load from the authored ladder bundles (rolled) and chest placements
 * (closed), and rebuilt only by `resetGameProgress()` (Reset Game / editor Try
 * / theme-switch remount). `resetGame()` (death/respawn) filters out only the
 * kinds whose registry `resetScope` is `'death'` (today the bomb), so a
 * deployed ladder and an open chest survive a death.
 */
export const deployableItems = signal<DeployableItem[]>([
  ...ropeLadderPlacements.value.map((state) => ({ ...state })),
  ...chestPlacements.value.map(toChestState),
]);

/**
 * Live open/closed state for every chest — a read-only DERIVED projection over
 * the single `deployableItems` collection (never written). Feeds the HUD
 * counter, the completion trigger and any residual read; a chest, like a
 * block, is progress that persists across a death, and is rebuilt closed only
 * by resetGameProgress() (the Reset Game button / editor Try).
 */
export const chestStates = computed<ChestState[]>(() => deployableItems.value.filter(isChestState));

/** Open-chest count for the HUD — derived, so the page never imports a chest
 * helper to count them. */
export const chestsOpened = computed<number>(() => chestStates.value.filter(isChestOpen).length);

/**
 * The effective terrain grid the physics simulation reads: the raw level with
 * every live item's `effectiveTerrainCells` contribution folded in (the rope
 * ladder's deployed shaft today). Identical (same object) to
 * `currentLevel.value` when nothing contributes, so the common case allocates
 * nothing. Rendering and every other subsystem keep reading the raw
 * `currentLevel` — only `stepPlayerPhysics` consumes this.
 */
export const activeLevel = computed<LevelDef>(() =>
  applyDeployableItemTerrain(currentLevel.value, deployableItems.value),
);

/**
 * The one shared early (pre-physics) advance: maps every live item through its
 * own kind's `step` (a step-less kind, the chest, passes through unchanged).
 * Called once per game-loop tick in the `playing` phase (so it freezes with the
 * world during pause/death). O(items), not O(level).
 */
export function tickDeployableItems(dt: number): void {
  if (deployableItems.value.length === 0) return;
  deployableItems.value = deployableItems.value.map((item): DeployableItem => {
    const step = DEPLOYABLE_ITEM_TYPES[item.kind].step;
    // The registry erases each kind's concrete state to the shared base; the
    // step returns the same kind's state, so this narrows back to the union.
    return step ? (step(item, dt) as DeployableItem) : item;
  });
}

/**
 * The one shared late (post-physics, pre-persist) consequence pass: dispatches
 * each kind's declarative `onTick` outcome, drops every item that asks to be
 * removed, and returns the blasts the page must resolve. Allocates a survivor
 * array only when something is removed and a returned-blast array only when one
 * detonates.
 */
export function applyDeployableItemConsequences(): readonly BlastRequest[] {
  const items = deployableItems.value;
  if (items.length === 0) return [];
  const ctx: DeployableItemTickContext = { level: currentLevel.value };
  const blasts: BlastRequest[] = [];
  let removed = false;
  const survivors = items.filter((item) => {
    const outcome = DEPLOYABLE_ITEM_TYPES[item.kind].onTick?.(item, ctx);
    if (!outcome) return true;
    if (outcome.blasts) blasts.push(...outcome.blasts);
    if (outcome.disposition === 'remove') {
      removed = true;
      return false;
    }
    return true;
  });
  if (removed) deployableItems.value = survivors;
  return blasts;
}

/**
 * The deployable-items domain's respawn-pass hook. A death/respawn clears every
 * kind whose registry `resetScope` is `'death'` — today only the placed bomb,
 * removed without exploding it. A deployed rope ladder and an open chest both
 * declare `'progress'`, so they persist across the death. The full pass rebuilds
 * every ladder rolled and every chest closed, dropping any bomb the respawn
 * pass did not already clear.
 */
export function reset(respawn: boolean): void {
  if (respawn) {
    deployableItems.value = deployableItems.value.filter(
      (item) => DEPLOYABLE_ITEM_TYPES[item.kind].resetScope !== 'death',
    );
    return;
  }
  deployableItems.value = [
    ...ropeLadderPlacements.value.map((state) => ({ ...state })),
    ...chestPlacements.value.map(toChestState),
  ];
}

/** The full-reset hook — one body, shared with the respawn pass. */
export function resetFull(): void {
  reset(false);
}
