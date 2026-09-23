import { canStandUp, resolveCrouching } from './Crouch';
import type { CrouchContext } from './Crouch';
import { parseLevel } from '../level/LevelParser';
import { placeBlocks } from '../level/BlockMapper';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_HIT_REACTION_SECONDS,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';

function basePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: true,
    climbing: false,
    crouching: false,
    isDroppingThroughBridge: false,
    lastGroundedX: 0,
    lastGroundedY: 0,
    prevFeetY: PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    blockContacts: [],
    hitPoints: 6,
    alive: true,
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
    ...overrides,
  };
}

/** Y at which the player's feet rest exactly on the top edge of `row`. */
function standingYOnRow(row: number): number {
  return row * 32 - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
}

// Open sky above a solid floor: the standing box fits.
const OPEN_AIR_LEVEL = parseLevel(['..', '..', '..', 'GG']);

// A one-tile-high corridor: solid ceiling at row 0, empty corridor at row 1,
// solid floor at row 2. Standing on the floor, the standing box (38 px) reaches
// into the ceiling row while the crouched box (32 px) does not.
const ONE_TILE_CORRIDOR_LEVEL = parseLevel(['GG', '..', 'GG']);

const NO_BLOCKS = placeBlocks([], { crate: [], questionMark: [], fragileRock: [] });

function context(overrides: Partial<CrouchContext> = {}): CrouchContext {
  return {
    downHeld: false,
    grounded: true,
    currentlyCrouching: false,
    downClaimed: false,
    canStand: true,
    inHitReaction: false,
    ...overrides,
  };
}

describe('canStandUp', () => {
  it('canStandUp-openAir-returnsTrue', () => {
    const player = basePlayer({ y: standingYOnRow(3) });
    expect(canStandUp(OPEN_AIR_LEVEL, NO_BLOCKS, player)).toBe(true);
  });

  it('canStandUp-oneTileCeiling-returnsFalse', () => {
    const player = basePlayer({ y: standingYOnRow(2) });
    expect(canStandUp(ONE_TILE_CORRIDOR_LEVEL, NO_BLOCKS, player)).toBe(false);
  });

  it('canStandUp-crouchedPlayerUnderOneTileCeiling-returnsFalse', () => {
    // The headroom test always measures the STANDING box, crouched or not.
    const player = basePlayer({ y: standingYOnRow(2), crouching: true });
    expect(canStandUp(ONE_TILE_CORRIDOR_LEVEL, NO_BLOCKS, player)).toBe(false);
  });

  it('canStandUp-liveBlockOverlappingStandingBox-returnsFalse', () => {
    const player = basePlayer({ y: standingYOnRow(3) });
    const blocks = placeBlocks([], {
      crate: [],
      questionMark: [{ col: 0, row: 2 }],
      fragileRock: [],
    });
    expect(canStandUp(OPEN_AIR_LEVEL, blocks, player)).toBe(false);
  });

  it('canStandUp-blockBesideTheStandingBox-returnsTrue', () => {
    const player = basePlayer({ x: 0, y: standingYOnRow(3) });
    // Column 3 is well outside the 24px hitbox (cols 0-1 at x = 0).
    const blocks = placeBlocks([], {
      crate: [],
      questionMark: [{ col: 3, row: 2 }],
      fragileRock: [],
    });
    expect(canStandUp(OPEN_AIR_LEVEL, blocks, player)).toBe(true);
  });

  it('canStandUp-potAdjacentButNotOverlappingTheHitbox-returnsTrue', () => {
    // A potion pot (8px X inset) rests on the ground at col 1 / row 2. At
    // x = -4 the player is pressed exactly against the pot's *inset* collision
    // box (the 24px hitbox spans cols 0-1, right edge 39, while the pot's box
    // starts at 40) — so there is no actual overlap. The headroom test must use
    // the same per-kind inset Physics's horizontal collision does, not the
    // pot's full tile, or standing beside a pot is wrongly blocked.
    const player = basePlayer({ x: -4, y: standingYOnRow(3) });
    const blocks = placeBlocks([], {
      crate: [],
      questionMark: [],
      fragileRock: [],
      potionPot: [{ col: 1, row: 2 }],
    });
    expect(canStandUp(OPEN_AIR_LEVEL, blocks, player)).toBe(true);
  });

  it('canStandUp-coinPotAdjacentButNotOverlappingTheHitbox-returnsTrue', () => {
    // coinPot's inset is 6px, so its collision box starts at col1*32+6 = 38;
    // the resting position against it is x = -6 (hitbox right edge 37).
    const player = basePlayer({ x: -6, y: standingYOnRow(3) });
    const blocks = placeBlocks([], {
      crate: [],
      questionMark: [],
      fragileRock: [],
      coinPot: [{ col: 1, row: 2 }],
    });
    expect(canStandUp(OPEN_AIR_LEVEL, blocks, player)).toBe(true);
  });

  it('canStandUp-bombPotAdjacentButNotOverlappingTheHitbox-returnsTrue', () => {
    const player = basePlayer({ x: -4, y: standingYOnRow(3) });
    const blocks = placeBlocks([], {
      crate: [],
      questionMark: [],
      fragileRock: [],
      bombPot: [{ col: 1, row: 2 }],
    });
    expect(canStandUp(OPEN_AIR_LEVEL, blocks, player)).toBe(true);
  });

  it('canStandUp-outOfBoundsReads-returnsTrueWithoutThrowing', () => {
    const player = basePlayer({ x: -1000, y: -1000 });
    expect(canStandUp(OPEN_AIR_LEVEL, NO_BLOCKS, player)).toBe(true);
  });
});

describe('resolveCrouching', () => {
  it('resolveCrouching-downHeldGrounded-returnsTrue', () => {
    expect(resolveCrouching(context({ downHeld: true, grounded: true }))).toBe(true);
  });

  it('resolveCrouching-freshAirborneEntry-returnsFalse', () => {
    expect(
      resolveCrouching(
        context({ downHeld: true, grounded: false, currentlyCrouching: false, canStand: true }),
      ),
    ).toBe(false);
  });

  it('resolveCrouching-alreadyCrouchedAirborneHoldingDown-keepsCrouch', () => {
    expect(
      resolveCrouching(
        context({ downHeld: true, grounded: false, currentlyCrouching: true, canStand: true }),
      ),
    ).toBe(true);
  });

  it('resolveCrouching-downReleasedInOpenAir-standsUp', () => {
    expect(
      resolveCrouching(
        context({ downHeld: false, grounded: true, currentlyCrouching: true, canStand: true }),
      ),
    ).toBe(false);
  });

  it('resolveCrouching-inHitReactionWhileCrouching-returnsCurrentlyCrouchingTrue', () => {
    expect(
      resolveCrouching(
        context({ inHitReaction: true, currentlyCrouching: true, canStand: false }),
      ),
    ).toBe(true);
  });

  it('resolveCrouching-inHitReactionWhileStanding-returnsCurrentlyCrouchingFalse', () => {
    expect(
      resolveCrouching(
        context({ inHitReaction: true, currentlyCrouching: false, downHeld: true, canStand: false }),
      ),
    ).toBe(false);
  });

  it('resolveCrouching-downClaimedByLadderWhileStanding-ignoresHeldDown', () => {
    expect(
      resolveCrouching(
        context({ downHeld: true, grounded: true, currentlyCrouching: false, downClaimed: true }),
      ),
    ).toBe(false);
  });

  it('resolveCrouching-downClaimedAndCannotStandWhileCrouching-keepsCrouch', () => {
    expect(
      resolveCrouching(
        context({
          downHeld: true,
          grounded: true,
          currentlyCrouching: true,
          downClaimed: true,
          canStand: false,
        }),
      ),
    ).toBe(true);
  });

  it('resolveCrouching-cannotStandAndAlreadyCrouchingDownReleased-keepsCrouch', () => {
    expect(
      resolveCrouching(
        context({ downHeld: false, currentlyCrouching: true, canStand: false }),
      ),
    ).toBe(true);
  });

  it('resolveCrouching-cannotStandButNotCurrentlyCrouching-neverStartsCrouch', () => {
    expect(
      resolveCrouching(
        context({ downHeld: false, currentlyCrouching: false, canStand: false }),
      ),
    ).toBe(false);
  });
});
