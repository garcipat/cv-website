import { isSolid, tileAt } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import { overlappingTriggers } from './Collision';
import { checkpointBox, activateCheckpoint } from '../entities/Checkpoint';
import type { CheckpointState } from '../entities/Checkpoint';
import type { CheckpointPlacement } from '../level/CheckpointMapper';
import type { PlayerState } from '../entities/Player';

/**
 * Whether a checkpoint at (`col`, `row`) has solid ground directly beneath it
 * — the placement requirement that makes stepping onto it a deliberate act
 * (FR-004). A checkpoint floating in mid-air is inert: it neither raises nor
 * becomes the respawn target.
 */
export function hasSolidGroundBelow(level: LevelDef, col: number, row: number): boolean {
  return isSolid(tileAt(level, col, row + 1));
}

/** The outcome of one tick's checkpoint contact resolution. */
export interface CheckpointResolution {
  /** The full state array, same length/order as the input; dormant entries
   *  that were stepped on this tick are raised. */
  states: CheckpointState[];
  /** The winning checkpoint's id, or `previousActiveId` when nothing eligible
   *  was entered this tick. */
  activeId: string | null;
  /** Dormant -> activated this tick, in reading order. The caller starts one
   *  puff and one label per id (FR-005/FR-006); the raise itself is derived
   *  from `activatedAt` and needs no start call. */
  activatedIds: string[];
}

/**
 * Resolves which checkpoints the player is standing on this tick and what
 * that means. Pure and deterministic:
 *
 * - A checkpoint is only ever affected when the interaction key was pressed
 *   this tick (`interact`, Up/W — the same explicit gesture chests use). With
 *   no press, nothing changes at all, so walking over a checkpoint is inert.
 * - Only checkpoints with solid ground directly below count (FR-004).
 * - Every dormant overlap is raised, stamped with `now` (the shared world
 *   clock), and reported in `activatedIds` in reading order.
 * - `activeId` is the first dormant winner in reading order; if none was
 *   dormant, the first entered already-raised checkpoint; if nothing eligible
 *   was entered at all, `previousActiveId` is kept unchanged (FR-007/FR-008/
 *   FR-009). This "dormant wins" tie-break makes a same-tick entry
 *   deterministic.
 * - Re-entering an already-raised checkpoint never appears in `activatedIds`
 *   (no replay, FR-008).
 * - The function returns new arrays and never mutates its inputs.
 */
export function resolveCheckpointContacts(
  player: PlayerState,
  placements: readonly CheckpointPlacement[],
  states: readonly CheckpointState[],
  level: LevelDef,
  previousActiveId: string | null,
  now: number,
  interact: boolean,
): CheckpointResolution {
  if (!interact) {
    return { states: states.slice(), activeId: previousActiveId, activatedIds: [] };
  }

  const stateById = new Map(states.map((state) => [state.id, state]));
  const pairs = placements
    .map((placement) => ({ placement, state: stateById.get(placement.id) }))
    .filter((pair): pair is { placement: CheckpointPlacement; state: CheckpointState } => pair.state !== undefined);

  const overlaps = overlappingTriggers(
    player,
    pairs,
    (pair) => checkpointBox(pair.state),
    (pair) => hasSolidGroundBelow(level, pair.placement.col, pair.placement.row),
  );

  if (overlaps.length === 0) {
    return { states: states.slice(), activeId: previousActiveId, activatedIds: [] };
  }

  const dormant = overlaps.filter((pair) => !pair.state.activated);
  const dormantIds = new Set(dormant.map((pair) => pair.state.id));

  return {
    states: states.map((state) => (dormantIds.has(state.id) ? activateCheckpoint(state, now) : state)),
    activeId: (dormant[0] ?? overlaps[0]).state.id,
    activatedIds: dormant.map((pair) => pair.state.id),
  };
}
