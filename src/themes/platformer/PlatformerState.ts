import * as playerStore from './state/playerStore';
import * as blockStore from './state/blockStore';
import * as enemyStore from './state/enemyStore';
import * as collectibleStore from './state/collectibleStore';
import * as deployableItemStore from './state/deployableItemStore';
import * as hazardTimerStore from './state/hazardTimerStore';
import * as checkpointStore from './state/checkpointStore';
import * as effectStore from './state/effectStore';
import * as progressStore from './state/progressStore';

// ---------------------------------------------------------------------------
// The assembly root.
//
// Every domain's state now lives in its own module under `state/`, each owning
// its own `reset(respawn)` / `resetFull()` rule. This file declares no state:
// it re-exports the moved-but-live symbols so every existing consumer (the
// page, the editor, the renderers, the effects and the tests) keeps its import
// path, and it defines the two frozen public reset seams as an ordered fan-out
// of those hooks.
// ---------------------------------------------------------------------------

export {
  playerStateAtTile,
  spawnPlayerState,
  playerState,
  cameraPositionX,
  cameraPositionY,
  darknessLevel,
  tickDarkness,
  fogLevel,
  tickFog,
  respawnPlayerState,
  respawnCenter,
  spawnCenter,
} from './state/playerStore';

export {
  checkpointPlacements,
  checkpointStates,
  activeCheckpointId,
  activeRespawnPlacement,
} from './state/checkpointStore';

export { blockPlacements, blockStates, cratesDestroyed } from './state/blockStore';

export { enemyPlacements, enemyStates, enemiesDefeated } from './state/enemyStore';

export {
  collectiblePlacements,
  baseCoinPlacements,
  skillFactPool,
  spawnedCoinPlacements,
  allCollectiblePlacements,
  fruitStates,
  heartPickupStates,
  keyPickupStates,
  collectedKeys,
  MAX_BOMBS,
  carriedBombs,
  bombPickupStates,
  pickupStores,
  pickupGroups,
} from './state/collectibleStore';
export type { PickupStore } from './state/collectibleStore';

export {
  chestPlacements,
  ropeLadderPlacements,
  deployableItems,
  chestStates,
  chestsOpened,
  activeLevel,
  tickDeployableItems,
  applyDeployableItemConsequences,
} from './state/deployableItemStore';
export type { DeployableItem } from './state/deployableItemStore';

export {
  hazardPlacements,
  mushroomSquashStates,
  tickMushroomSquashes,
  floorSpikeTimerStates,
  armHazardTrigger,
  tickFloorSpikes,
  crumblingFloorTimerStates,
  armCrumblingFloorTrigger,
  tickCrumblingFloors,
  fallingStalactiteTimerStates,
  tickFallingStalactites,
  hazardPlacementsForTick,
} from './state/hazardTimerStore';

export { activeEffects, spawnEffect, refreshSpeechBubbleText } from './state/effectStore';

export {
  collectedFacts,
  activeJournalSection,
  endingScreenShown,
  endingScreenOpen,
  controlsOverlayDismissed,
  lifecycleState,
} from './state/progressStore';

export { torchPositions, signPlacements } from './state/levelPlacements';

export { levelTotals } from './state/levelTotals';

/**
 * Resets the game world to its respawn state: player back at the active
 * checkpoint (or the level's spawn point when none is active), full health,
 * enemies revived in place at their spawn placements, camera scrolled back to
 * the level start. Does NOT touch `lifecycleState`, `collectedFacts`, the
 * collected pickup flags (the coin/fruit/key arrays, including
 * `baseCoinPlacements`, are kept — permanence is reset scope alone), or
 * checkpoint memory (`checkpointStates`/`activeCheckpointId`) — a death/respawn
 * preserves every raised flag and the active target; only the "Reset Game"
 * button clears those (see `resetGameProgress()` below). Callers
 * (restart-on-input and the debug Respawn button, both wired to the `intro`
 * iris-in) decide the lifecycle transition themselves, since not every
 * caller of a "reset" necessarily wants the iris animation.
 *
 * Enemies are revived via `reviveEnemy` on the existing `enemyStates` objects
 * rather than rebuilt from `enemyPlacements` — see `state/enemyStore.ts`.
 * Blocks whose kind declares `restoredOnRespawn` (today only the potion pot)
 * are the one exception to "blocks persist across a death/respawn" — see
 * `state/blockStore.ts`. Transient effects are deliberately not all cleared
 * here: only the `'death'`-scoped kinds — see `state/effectStore.ts`.
 *
 * This is the single reset seam a full "Reset Game" button extends: enemies
 * are reset here; `resetGameProgress()` additionally clears collected facts
 * and respawns coins/blocks.
 *
 * The body is an ordered fan-out of the domain hooks and contains no signal
 * writes of its own (FR-001). The phase order is frozen: reversing it, or
 * moving any domain's rule into this file, is a behaviour change.
 */
export function resetGame(): void {
  playerStore.reset(true);
  hazardTimerStore.reset(true);
  enemyStore.reset(true);
  blockStore.reset(true);
  collectibleStore.reset(true);
  deployableItemStore.reset(true);
  effectStore.reset(true);
}

/**
 * The "Reset Game" button's full reset — unlike
 * `resetGame()`, this is a deliberate action the visitor takes, not a
 * death/respawn, so it also clears everything `resetGame()` leaves alone:
 * collected facts, the collected pickup flags (re-deriving the base coins
 * uncollected and clearing the spawned/dropped arrays is what makes
 * already-collected coins/fruits reappear in the level, since the
 * render/collision loop reads them live), the remembered active journal
 * bookmark (falls back to Journal.tsx's default section afterward), and any
 * in-flight flying-text animation (`activeEffects`) so a pickup
 * triggered just before Reset Game is clicked doesn't keep animating after
 * the journal closes. This is also the level-change seam the editor's Try
 * routes through, so the mutable base coins follow a `currentLayout` change.
 * `lifecycleState` is deliberately left untouched: the
 * journal can only be opened from the `'playing'` phase
 * (`PlatformerPage.tsx`'s `handleJournalToggle`), so the phase is always
 * `'paused'` while Reset Game is clickable, and `resumeFromJournal` (already
 * called when the journal closes) correctly returns to `'playing'` — no
 * lifecycle transition is needed here, unlike `resetGame()`'s other callers
 * (death/respawn) which explicitly transition through `introState(...)`.
 *
 * The body is three ordered phases and contains no signal writes of its own
 * (FR-001):
 *
 * 1. `checkpointStore.resetFull()` FIRST — clearing checkpoint memory before
 *    the respawn pass is load-bearing, because `resetGame()`'s player reset
 *    reads the active respawn target (FR-003).
 * 2. the respawn pass, verbatim (`resetGame()`).
 * 3. the progress-only pass, each domain rebuilding from its placements.
 */
export function resetGameProgress(): void {
  // Clear checkpoint memory FIRST, so the `resetGame()` below sees no active
  // checkpoint and returns the character to the level spawn.
  checkpointStore.resetFull();
  resetGame();
  effectStore.resetFull();
  progressStore.resetFull();
  blockStore.resetFull();
  collectibleStore.resetFull();
  deployableItemStore.resetFull();
  enemyStore.resetFull();
}
