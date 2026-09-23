import { describe, it, expect } from 'vitest';
import {
  createDoorState,
  toggleDoor,
  applyOpenedDoors,
  doorPlayerIsAdjacentTo,
  type DoorState,
} from './DoorState';
import type { LevelDef } from '../level/LevelData';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { PlayerState } from '../entities/Player';

function makeLevel(): LevelDef {
  return {
    width: 5,
    height: 3,
    terrain: [
      ['empty', 'empty', 'empty', 'empty', 'empty'],
      ['empty', 'doorLeft', 'doorRight', 'empty', 'empty'],
      ['empty', 'empty', 'empty', 'empty', 'empty'],
    ],
  };
}

describe('createDoorState-anchorCell-seedsClosed', () => {
  it('starts closed with a stable id', () => {
    const state = createDoorState(1, 1);
    expect(state).toEqual({ id: 'door-1-1', col: 1, row: 1, phase: 'closed' });
  });
});

describe('toggleDoor-closed-becomesOpen', () => {
  it('flips closed to open', () => {
    expect(toggleDoor(createDoorState(1, 1)).phase).toBe('open');
  });
});

describe('toggleDoor-open-becomesClosed', () => {
  it('flips open back to closed', () => {
    const opened = toggleDoor(createDoorState(1, 1));
    expect(toggleDoor(opened).phase).toBe('closed');
  });
});

describe('applyOpenedDoors-noOpenDoors-returnsSameLevelByReference', () => {
  it('is a no-op identity when every door is closed', () => {
    const level = makeLevel();
    const result = applyOpenedDoors(level, [createDoorState(1, 1)]);
    expect(result).toBe(level);
  });
});

describe('applyOpenedDoors-oneOpenDoor-rewritesBothLeafCells', () => {
  it('rewrites both leaf cells to their open tile', () => {
    const level = makeLevel();
    const opened = toggleDoor(createDoorState(1, 1));
    const result = applyOpenedDoors(level, [opened]);
    expect(result.terrain[1][1]).toBe('doorLeftOpen');
    expect(result.terrain[1][2]).toBe('doorRightOpen');
    expect(level.terrain[1][1]).toBe('doorLeft'); // original untouched
  });
});

function makePlayer(x: number, y: number): PlayerState {
  return { x, y, vx: 0, vy: 0, grounded: true, facing: 'right' } as PlayerState;
}

// The door pair below is always createDoorState(1, 1): left leaf at col 1,
// right leaf at col 2 (= state.col + 1), row 1. The player hitbox is
// PLAYER_RENDERED_SIZE (64px = 2 columns) wide, inset by PLAYER_SIDE_PADDING
// (20px) on each side (same convention ladderBundleForPlayer's leftCol/
// rightCol already use) — so a player pressed up against a closed door's
// face already has its hitbox touching the door's own column, not sitting a
// whole clear column away. "Adjacent" therefore means the player's inset
// hitbox TOUCHES the door pair's outer edge: playerRightCol === state.col
// (left leaf, from the left) OR playerLeftCol === state.col + 1 (right
// leaf, from the right) — not "one clear column apart", which a
// 2-column-wide sprite could never satisfy.
//
// Worked arithmetic (RENDERED_TILE_SIZE=32, PLAYER_RENDERED_SIZE=64,
// PLAYER_SIDE_PADDING=20 — verified against the real constants):
// playerLeftCol(x) = floor((x+20)/32),
// playerRightCol(x) = floor((x+64-20-1)/32) = floor((x+43)/32).
//   x=0  (test 1): playerRightCol = floor(43/32)  = 1 = state.col.       MATCH (left leaf, from the left).
//   x=64 (test 2): playerLeftCol  = floor(84/32)  = 2 = state.col + 1.   MATCH (right leaf, from the right).
//   x=-64(test 3): playerLeftCol=-2, playerRightCol=-1 — neither is 1 or 2. NO MATCH.

describe('doorPlayerIsAdjacentTo-playerPressedAgainstLeftLeafFromTheLeft-returnsDoorId', () => {
  it("matches a hitbox touching the left leaf's column from the left, same row", () => {
    const state = createDoorState(1, 1);
    const player = makePlayer(0 * RENDERED_TILE_SIZE, 1 * RENDERED_TILE_SIZE);
    expect(doorPlayerIsAdjacentTo([state], player)).toBe(state.id);
  });
});

describe('doorPlayerIsAdjacentTo-playerPressedAgainstRightLeafFromTheRight-returnsDoorId', () => {
  it("matches a hitbox touching the right leaf's column from the right, same row", () => {
    const state = createDoorState(1, 1);
    const player = makePlayer(2 * RENDERED_TILE_SIZE, 1 * RENDERED_TILE_SIZE);
    expect(doorPlayerIsAdjacentTo([state], player)).toBe(state.id);
  });
});

describe('doorPlayerIsAdjacentTo-playerAColumnAwayFromTouching-returnsNull', () => {
  it('does not match when the hitbox does not reach either leaf\'s column', () => {
    const state = createDoorState(1, 1);
    const player = makePlayer(-2 * RENDERED_TILE_SIZE, 1 * RENDERED_TILE_SIZE);
    expect(doorPlayerIsAdjacentTo([state], player)).toBeNull();
  });
});

describe('doorPlayerIsAdjacentTo-playerDifferentRow-returnsNull', () => {
  it('does not match a different row even when touching in column', () => {
    const state = createDoorState(1, 1);
    const player = makePlayer(0 * RENDERED_TILE_SIZE, 0 * RENDERED_TILE_SIZE);
    expect(doorPlayerIsAdjacentTo([state], player)).toBeNull();
  });
});
