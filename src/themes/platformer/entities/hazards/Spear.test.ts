import { spear } from './Spear';
import { setSpearTipMask } from './SpearArt';
import type { SpearMask } from './SpearArt';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';
import { PLAYER_HIT_REACTION_SECONDS } from '../Player';
import type { PlayerState } from '../Player';
import type { HazardPlacement } from '../../level/HazardMapper';
import type { Rect } from '../geometry';

const EMPTY_MASK: SpearMask = { width: 4, height: 4, pixels: new Uint8Array(16) };

/** A mask with one lethal tip pixel at (1, 1) — world (101, 101) for the
 *  spear at (100, 100) used throughout. */
function oneTipMask(): SpearMask {
  const pixels = new Uint8Array(16);
  pixels[1 * 4 + 1] = 1;
  return { width: 4, height: 4, pixels };
}

const hazard: HazardPlacement = { id: 'h1', hazardType: 'spear', facing: 'up', x: 100, y: 100 };

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 80,
    y: 46,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: false,
    climbing: false,
    isDroppingThroughBridge: false,
    lastGroundedX: 80,
    lastGroundedY: 46,
    prevFeetY: 95,
    animState: 'jump',
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

/** A hitbox covering the tip pixel at (101, 101). */
const coveringHitbox: Rect = { x: 100, y: 90, width: 24, height: 20 };

beforeEach(() => {
  setSpearTipMask(EMPTY_MASK);
});

describe('spear', () => {
  it('key-isSpear', () => {
    expect(spear.key).toBe('spear');
  });

  it('lethal-isTrue', () => {
    expect(spear.lethal).toBe(true);
  });

  it('damage-isZeroSinceALethalContactIsKillOrNothing', () => {
    expect(spear.damage).toBe(0);
  });

  it('box-isTheFullRenderedTile', () => {
    expect(spear.box(hazard)).toEqual({
      x: 100,
      y: 100,
      width: RENDERED_TILE_SIZE,
      height: RENDERED_TILE_SIZE,
    });
  });
});

describe('spear.isContact', () => {
  it('descendingTipSweepFromAbove-isAContact', () => {
    setSpearTipMask(oneTipMask());
    const player = makePlayer({ vy: 120, prevFeetY: 95 });
    expect(spear.isContact!(hazard, player, coveringHitbox)).toBe(true);
  });

  it('groundedVyZero-isNotAContact', () => {
    setSpearTipMask(oneTipMask());
    const player = makePlayer({ vy: 0, prevFeetY: 95, grounded: true });
    expect(spear.isContact!(hazard, player, coveringHitbox)).toBe(false);
  });

  it('risingVyNegative-isNotAContact', () => {
    setSpearTipMask(oneTipMask());
    const player = makePlayer({ vy: -200, prevFeetY: 130 });
    expect(spear.isContact!(hazard, player, coveringHitbox)).toBe(false);
  });

  it('horizontallyPassingAtGroundLevel-isNotAContact', () => {
    setSpearTipMask(oneTipMask());
    const player = makePlayer({ vx: 200, vy: 0, grounded: true, prevFeetY: 95 });
    expect(spear.isContact!(hazard, player, coveringHitbox)).toBe(false);
  });

  it('sweepingPastOnlyTheSideOrShaft-isNotAContact', () => {
    setSpearTipMask(oneTipMask());
    // The feet cross a shaft row well below the tip row (world row 101), so
    // the tip is above prevFeetY and is not part of this step's swept band.
    const player = makePlayer({ y: 70, vy: 120, prevFeetY: 118 });
    const hitbox: Rect = { x: 100, y: 90, width: 24, height: 40 };
    expect(spear.isContact!(hazard, player, hitbox)).toBe(false);
  });

  it('emptyMask-isNotAContact', () => {
    const player = makePlayer({ vy: 120, prevFeetY: 95 });
    expect(spear.isContact!(hazard, player, coveringHitbox)).toBe(false);
  });
});
