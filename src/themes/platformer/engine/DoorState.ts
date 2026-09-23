import type { Signal } from '@preact/signals-react';
import type { LevelDef } from '../level/LevelData';
import { applyTerrainOverrides } from '../level/TerrainOverrides';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { PLAYER_RENDERED_SIZE, PLAYER_SIDE_PADDING } from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import type { Interactable } from './Interact';

/** Reversible — unlike DeployableLadderPhase's one-way progression, a door
 *  toggles freely between exactly two phases (spec FR-008/FR-012). */
export type DoorPhase = 'closed' | 'open';

/** Per-pair runtime state, keyed by the pair's LEFT-leaf anchor cell. Tiles
 *  stay stateless; this lives alongside chestStates/deployableLadderStates
 *  in PlatformerState.ts (Terrain.md's runtime-override exception, now a
 *  third instance). */
export interface DoorState {
  /** `door-${col}-${row}`, stable per authored left-leaf cell. */
  id: string;
  col: number;
  row: number;
  phase: DoorPhase;
}

/** Seeds one closed state for an authored left-leaf cell. Pure. */
export function createDoorState(col: number, row: number): DoorState {
  return { id: `door-${col}-${row}`, col, row, phase: 'closed' };
}

/** Flips a door's phase. Pure, unconditional — unlike beginDeploy, there is
 *  no "already past this phase" guard, because there is no one-way
 *  ordering to protect (spec FR-010: unlimited toggles). */
export function toggleDoor(state: DoorState): DoorState {
  return { ...state, phase: state.phase === 'closed' ? 'open' : 'closed' };
}

/**
 * The effective terrain grid: the raw level with every open door's two
 * leaf cells written as their non-solid `*Open` tile. Built on the shared
 * `applyTerrainOverrides` (Task 5) — see design.md's "A shared
 * applyTerrainOverrides helper". Returns the SAME `level` object (identity)
 * when every door is closed, so the common case allocates nothing.
 */
export function applyOpenedDoors(level: LevelDef, states: readonly DoorState[]): LevelDef {
  return applyTerrainOverrides(
    level,
    states,
    (state) => state.phase === 'open',
    (state) => [
      { col: state.col, row: state.row, tile: 'doorLeftOpen' as const },
      { col: state.col + 1, row: state.row, tile: 'doorRightOpen' as const },
    ],
  );
}

/**
 * The id of the first door the player can interact with right now, or
 * `null`. A door is SOLID while closed (unlike a chest), so the player can
 * never overlap its cells the way `chestPlayerIsStandingOn` overlaps a
 * chest's trigger box — "standing next to it" instead means: same row as
 * the door (player's foot row equals the door's row), and the player's
 * (inset) collision hitbox TOUCHES the door pair's outer edge — its right
 * column reaches the left leaf's own column (pressed against it from the
 * left), or its left column reaches the right leaf's own column (pressed
 * against it from the right). This is deliberately "touching", not "one
 * clear column away": `PLAYER_RENDERED_SIZE` is 64px — two tile columns —
 * so a player's hitbox pressed flush against a closed door already reaches
 * into the door's own column; there is no clear gap column to test for the
 * way there would be for a one-tile-wide sprite. The column math mirrors
 * `ladderBundleForPlayer`'s own inset-hitbox convention (`PLAYER_SIDE_PADDING`),
 * not Collision.ts's generic `overlappingTriggers` (which only tests actual
 * box overlap, impossible here since a closed door is solid).
 */
export function doorPlayerIsAdjacentTo(
  states: readonly DoorState[],
  player: PlayerState,
): string | null {
  const playerRow = Math.floor(player.y / RENDERED_TILE_SIZE);
  const playerLeftCol = Math.floor((player.x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE);
  const playerRightCol = Math.floor(
    (player.x + PLAYER_RENDERED_SIZE - PLAYER_SIDE_PADDING - 1) / RENDERED_TILE_SIZE,
  );
  for (const state of states) {
    if (state.row !== playerRow) continue;
    if (playerRightCol === state.col || playerLeftCol === state.col + 1) {
      return state.id;
    }
  }
  return null;
}

/**
 * Adapts `doorPlayerIsAdjacentTo`/`toggleDoor` to the generic `Interactable`
 * shape (Task 15's `applyInteract` dispatcher) — the candidate/effect logic
 * itself is unchanged, just wrapped so `PlatformerPage.tsx` can call this
 * factory instead of branching on kind inline.
 */
export function doorInteractable(states: Signal<DoorState[]>, player: PlayerState): Interactable {
  return {
    kind: 'door',
    findCandidate: () => doorPlayerIsAdjacentTo(states.value, player),
    applyInteract: (id) => {
      states.value = states.value.map((d) => (d.id === id ? toggleDoor(d) : d));
    },
  };
}
