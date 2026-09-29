import { signal, computed } from '@preact/signals-react';
import { CHECKPOINT_TILES } from './levelSession';
import { placeCheckpoints } from '../level/CheckpointMapper';
import type { CheckpointPlacement } from '../level/CheckpointMapper';
import { toCheckpointState } from '../entities/Checkpoint';
import type { CheckpointState } from '../entities/Checkpoint';

/**
 * Every checkpoint in the level, placed from `currentLayout`'s `C` markers
 * (see CHECKPOINT_TILES) — purely positional, no CVData binding. A `computed`
 * so the Level Editor's "Try" button updates it reactively like every other
 * placement list. The shipped level has none (checkpoints are authorable,
 * not shipped).
 */
export const checkpointPlacements = computed<CheckpointPlacement[]>(() =>
  placeCheckpoints(CHECKPOINT_TILES.value),
);

/**
 * Live per-instance checkpoint state — seeded dormant from
 * `checkpointPlacements`. Unlike blocks/chests, a raised flag survives a
 * death/respawn (`resetGame()` leaves this untouched); only Reset
 * Game (`resetGameProgress()`) rebuilds it dormant.
 */
export const checkpointStates = signal<CheckpointState[]>(
  checkpointPlacements.value.map(toCheckpointState),
);

/**
 * The id of the checkpoint a death currently respawns at, or `null` when the
 * level's own spawn point is used. At most one id: set by the tick resolver
 * (engine/CheckpointLogic.ts) to the winning checkpoint — the first dormant
 * one entered this tick, else the first already-raised one entered
 *. Persists across death/respawn; cleared only by
 * `resetGameProgress()`.
 */
export const activeCheckpointId = signal<string | null>(null);

/**
 * The active checkpoint's static placement, or `null` when the level spawn is
 * the respawn point. Derived (not stored) so it reacts to
 * `activeCheckpointId`/`checkpointStates` like every other derived value.
 */
export const activeRespawnPlacement = computed<CheckpointPlacement | null>(() => {
  const id = activeCheckpointId.value;
  if (id === null) return null;
  const state = checkpointStates.value.find((checkpoint) => checkpoint.id === id);
  if (!state) return null;
  return { id: state.id, col: state.col, row: state.row, x: state.x, y: state.y };
});

/**
 * Checkpoint memory's full-reset hook — the only hook this domain has: a
 * death/respawn deliberately preserves every raised flag and the active
 * target, so there is no respawn-scoped `reset`.
 *
 * Clearing `activeCheckpointId` FIRST is load-bearing: `resetGame()`'s
 * `playerState = respawnPlayerState` reads `activeRespawnPlacement`, so a full
 * reset must forget the checkpoint before the respawn fan-out runs or the
 * character would return to the checkpoint instead of the level spawn.
 */
export function resetFull(): void {
  activeCheckpointId.value = null;
  checkpointStates.value = checkpointPlacements.value.map(toCheckpointState);
}
