import {
  playerHitbox,
  aabbOverlap,
  checkCollectibleCollisions,
  resolveEnemyContacts,
  checkBonusFruitCollisions,
  chestPlayerIsStandingOn,
  checkSignOverlap,
  checkKeyPickupCollisions,
  checkHeartPickupCollisions,
  checkBombPickupCollisions,
  resolveHazardContacts,
  checkFloorSpikeTriggers,
  checkCrumblingFloorTriggers,
  overlappingTriggers,
} from './Collision';
import { playerInBlast } from './Blast';
import type { Box } from './Collision';
import { setSpearTipMask } from '../entities/hazards/SpearArt';
import type { SpearMask } from '../entities/hazards/SpearArt';
import {
  PLAYER_SIDE_PADDING,
  PLAYER_HEAD_PADDING,
  PLAYER_FOOT_PADDING,
  PLAYER_RENDERED_SIZE,
  PLAYER_HIT_REACTION_SECONDS,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import { ENEMY_HIT_REACTION_SECONDS } from '../entities/enemies/shared';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import { toEnemyState } from '../entities/Enemy';
import type { EnemyState } from '../entities/Enemy';
import { typeOf } from '../entities/enemies';
import type { SlimeGreenState } from '../entities/enemies/SlimeGreen';
import type { EnemyPlacement } from '../level/EnemyMapper';
import { spawnBonusFruit, tickBonusFruit, BONUS_FRUIT_RISE_DURATION_SECONDS } from '../entities/BonusFruit';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { ChestState } from '../entities/Chest';
import type { SignPlacement } from '../level/SignMapper';
import type { HazardPlacement } from '../level/HazardMapper';
import { parseLevel } from '../level/LevelParser';
import type { KeyPickupState } from '../entities/KeyPickup';
import { spawnHeartPickup } from '../entities/HeartPickup';
import { spawnBombPickup } from '../entities/BombPickup';
import { MAX_HALF_HEARTS, SIDE_HIT_DAMAGE } from '../entities/Health';
import { PHYSICS_CONFIG } from './PhysicsConfig';

function makePlayer(x: number, y: number): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: true,
    climbing: false,
    crouching: false,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    prevFeetY: y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    blockContacts: [],
    hitPoints: 6,
    alive: true,
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
  };
}

function makePlacement(id: string, x: number, y: number): CollectiblePlacement {
  return { id, spriteType: 'coin', x, y };
}

function makeEnemy(x: number, y: number, overrides: Partial<SlimeGreenState> = {}): EnemyState {
  const placement: EnemyPlacement = {
    id: 'enemy-cert-x',
    type: 'slimeGreen',
    fact: {
      id: 'enemy-cert-x',
      sectionId: 'certificates',
      sectionLabel: 'Certificates',
      data: { name: 'X', issuer: 'Y', date: '2020-01' },
      sourceType: 'enemy',
    },
    x,
    y,
  };
  return { ...toEnemyState(placement), ...overrides };
}

describe('playerHitbox', () => {
  it('playerAtOrigin-returns-boxNarrowerThanRenderedSize', () => {
    const box = playerHitbox(makePlayer(0, 0));
    expect(box.x).toBe(PLAYER_SIDE_PADDING);
    expect(box.y).toBe(PLAYER_HEAD_PADDING);
    expect(box.width).toBe(PLAYER_RENDERED_SIZE - 2 * PLAYER_SIDE_PADDING);
  });

  it('playerHitbox-crouchingFalse-returnsTheFullStandingBox', () => {
    const box = playerHitbox(makePlayer(0, 0));
    expect(box.y).toBe(PLAYER_HEAD_PADDING);
    expect(box.height).toBe(PLAYER_RENDERED_SIZE - PLAYER_HEAD_PADDING - PLAYER_FOOT_PADDING);
  });

  it('playerHitbox-crouchingTrue-returnsOneTileBoxWithIdenticalXWidthAndFeetLine', () => {
    const standing = playerHitbox(makePlayer(0, 0));
    const crouched = playerHitbox({ ...makePlayer(0, 0), crouching: true });
    expect(crouched.y).toBe(PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING - RENDERED_TILE_SIZE);
    expect(crouched.height).toBe(RENDERED_TILE_SIZE);
    expect(crouched.x).toBe(standing.x);
    expect(crouched.width).toBe(standing.width);
    // The box shrinks upward from the ground line: the feet do not move.
    expect(crouched.y + crouched.height).toBe(standing.y + standing.height);
  });
});

describe('aabbOverlap', () => {
  it('identicalBoxes-returns-true', () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    expect(aabbOverlap(box, box)).toBe(true);
  });

  it('touchingEdges-returns-false', () => {
    expect(aabbOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
  });

  it('farApart-returns-false', () => {
    expect(aabbOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 1000, y: 1000, width: 10, height: 10 })).toBe(false);
  });

  it('overlapping-returns-true', () => {
    expect(aabbOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });
});

/** A trigger item positioned by real `playerHitbox` arithmetic, so no case
 *  below can pass vacuously by never overlapping in the first place. */
interface TestTrigger {
  id: string;
  x: number;
  y: number;
}

const triggerBox = (item: TestTrigger): Box => ({ x: item.x, y: item.y, width: 32, height: 32 });

describe('overlappingTriggers', () => {
  it('itemsOverlappingThePlayer-areReturnedInArrayOrder', () => {
    const player = makePlayer(100, 100);
    const box = playerHitbox(player);
    const near = { id: 'near', x: box.x, y: box.y };
    const far = { id: 'far', x: box.x + 500, y: box.y };
    const result = overlappingTriggers(player, [far, near], triggerBox, () => true);
    expect(result).toEqual([near]);
  });

  it('itemsFailingTheEligibilityPredicate-areSkippedEvenWhenOverlapping', () => {
    const player = makePlayer(100, 100);
    const box = playerHitbox(player);
    const item = { id: 'blocked', x: box.x, y: box.y };
    const result = overlappingTriggers(player, [item], triggerBox, () => false);
    expect(result).toEqual([]);
  });

  it('severalOverlappingItems-areReturnedInArrayOrderNotProximityOrder', () => {
    const player = makePlayer(100, 100);
    const box = playerHitbox(player);
    // Every one of these overlaps the player's hitbox: `last` sits exactly on
    // it, `first`/`second` are nudged left/right by less than their own width.
    const first: TestTrigger = { id: 'first', x: box.x + box.width - 4, y: box.y };
    const second: TestTrigger = { id: 'second', x: box.x - 28, y: box.y };
    const last: TestTrigger = { id: 'last', x: box.x, y: box.y };

    const result = overlappingTriggers(player, [first, second, last], triggerBox, () => true);

    expect(result.map((i) => i.id)).toEqual(['first', 'second', 'last']);
  });

  it('eligibleItemThatDoesNotOverlap-isSkipped', () => {
    const player = makePlayer(100, 100);
    const box = playerHitbox(player);
    // Touching edges only (aabbOverlap treats a zero-area intersection as a
    // miss), so this is eligible but genuinely not overlapping.
    const flush: TestTrigger = { id: 'flush', x: box.x + box.width, y: box.y };

    expect(overlappingTriggers(player, [flush], triggerBox, () => true)).toEqual([]);
  });

  it('matchingItems-areReturnedByReference', () => {
    const player = makePlayer(100, 100);
    const box = playerHitbox(player);
    const item: TestTrigger = { id: 'hit', x: box.x, y: box.y };

    const result = overlappingTriggers(player, [item], triggerBox, () => true);

    expect(result[0]).toBe(item);
  });

  it('noEligibilityPredicate-everyOverlappingItemMatches', () => {
    const player = makePlayer(100, 100);
    const box = playerHitbox(player);
    const item: TestTrigger = { id: 'always', x: box.x, y: box.y };

    expect(overlappingTriggers(player, [item], triggerBox)).toEqual([item]);
  });

  it('emptyItemList-returnsEmptyArray', () => {
    expect(overlappingTriggers(makePlayer(0, 0), [], triggerBox)).toEqual([]);
  });
});

describe('checkCollectibleCollisions', () => {
  it('playerOverlappingOnePlacement-returns-itsId', () => {
    const player = makePlayer(0, 0);
    const placements = [makePlacement('a', 0, 0)];
    expect(checkCollectibleCollisions(player, placements, new Set())).toEqual(['a']);
  });

  it('playerFarFromEveryPlacement-returns-emptyArray', () => {
    const player = makePlayer(0, 0);
    const placements = [makePlacement('a', 2000, 2000)];
    expect(checkCollectibleCollisions(player, placements, new Set())).toEqual([]);
  });

  it('overlappingButAlreadyCollected-excludesIt', () => {
    const player = makePlayer(0, 0);
    const placements = [makePlacement('a', 0, 0)];
    expect(checkCollectibleCollisions(player, placements, new Set(['a']))).toEqual([]);
  });

  it('overlappingTwoPlacements-returns-bothIds', () => {
    const player = makePlayer(0, 0);
    const placements = [makePlacement('a', 0, 0), makePlacement('b', 5, 5)];
    expect(checkCollectibleCollisions(player, placements, new Set())).toEqual(['a', 'b']);
  });
});

/**
 * Positions a player so its hitbox bottom lands a few px into the given
 * enemy's hitbox from the top — comfortably within its upper half (a
 * "landing on top" stomp), derived from the real enemy box/playerHitbox
 * geometry rather than a hand-computed magic number, so this stays correct
 * regardless of future padding/offset tuning. `overlapPx` must stay well
 * under half the enemy hitbox's height to guarantee an upper-half landing.
 */
function playerLandingOnTopOf(enemy: EnemyState, overlapPx = 4): PlayerState {
  const box = typeOf(enemy).box(enemy);
  const playerHitboxHeight = PLAYER_RENDERED_SIZE - PLAYER_HEAD_PADDING - PLAYER_FOOT_PADDING;
  const y = box.y + overlapPx - playerHitboxHeight - PLAYER_HEAD_PADDING;
  return makePlayer(enemy.x, y);
}

describe('checkBonusFruitCollisions', () => {
  it('playerOverlapsRestedFruit-returnsItsId', () => {
    let fruit = spawnBonusFruit('bf1', 0, 100, undefined, 0);
    fruit = tickBonusFruit(fruit, BONUS_FRUIT_RISE_DURATION_SECONDS);
    const player = makePlayer(0, 100 - RENDERED_TILE_SIZE);
    expect(checkBonusFruitCollisions(player, [fruit])).toEqual(['bf1']);
  });

  it('playerOverlapsStillRisingFruit-notYetCollectible', () => {
    const fruit = spawnBonusFruit('bf1', 0, 100, undefined, 0); // elapsed 0, mid-rise
    const player = makePlayer(0, 100 - RENDERED_TILE_SIZE);
    expect(checkBonusFruitCollisions(player, [fruit])).toEqual([]);
  });

  it('playerFarFromFruit-returnsNoIds', () => {
    let fruit = spawnBonusFruit('bf1', 0, 100, undefined, 0);
    fruit = tickBonusFruit(fruit, BONUS_FRUIT_RISE_DURATION_SECONDS);
    const player = makePlayer(1000, 1000);
    expect(checkBonusFruitCollisions(player, [fruit])).toEqual([]);
  });
});

describe('checkHeartPickupCollisions', () => {
  it('playerBelowMaxHealthOverlapsHeart-returnsItsId', () => {
    const heart = spawnHeartPickup('h1', 0, 100);
    const player = { ...makePlayer(0, 100 - RENDERED_TILE_SIZE), hitPoints: 4 };
    expect(checkHeartPickupCollisions(player, [heart])).toEqual(['h1']);
  });

  it('playerFarFromHeart-returnsNoIds', () => {
    const heart = spawnHeartPickup('h1', 0, 100);
    const player = { ...makePlayer(1000, 1000), hitPoints: 4 };
    expect(checkHeartPickupCollisions(player, [heart])).toEqual([]);
  });

  it('playerAtFullHealthOverlapsHeart-returnsNoIds', () => {
    // The heart waits in the world rather than being consumed for nothing —
    // see Health.ts's MAX_HALF_HEARTS.
    const heart = spawnHeartPickup('h1', 0, 100);
    const player = { ...makePlayer(0, 100 - RENDERED_TILE_SIZE), hitPoints: MAX_HALF_HEARTS };
    expect(checkHeartPickupCollisions(player, [heart])).toEqual([]);
  });
});

describe('chestPlayerIsStandingOn', () => {
  const closedChest: ChestState = {
    id: 'chest-1',
    x: 100,
    y: 100,
    state: 'closed',
    fact: {
      id: 'chest-1',
      sectionId: 'experience',
      sectionLabel: 'Experience',
      data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
      sourceType: 'chest',
    },
  };

  it('playerOverlappingClosedChest-returnsItsId', () => {
    const player = { ...makePlayer(closedChest.x, closedChest.y) };
    expect(chestPlayerIsStandingOn(player, [closedChest])).toBe('chest-1');
  });

  it('playerFarFromAnyChest-returnsUndefined', () => {
    const player = { ...makePlayer(closedChest.x + 1000, closedChest.y) };
    expect(chestPlayerIsStandingOn(player, [closedChest])).toBeUndefined();
  });

  it('alreadyOpenChest-isIgnored-evenWhileOverlapping', () => {
    const openChestState: ChestState = { ...closedChest, state: 'open' };
    const player = { ...makePlayer(openChestState.x, openChestState.y) };
    expect(chestPlayerIsStandingOn(player, [openChestState])).toBeUndefined();
  });

  it('noChests-returnsUndefined', () => {
    const player = makePlayer(0, 0);
    expect(chestPlayerIsStandingOn(player, [])).toBeUndefined();
  });

  it('playerOverlappingOnlyTheOffsetShiftedRegion-stillReturnsItsId', () => {
    // The closed box's x is chest.x + CHEST_CLOSED_OFFSET_X (a negative
    // number — see entities/Chest.ts), so its left edge sits to the LEFT of
    // chest.x. A player hitbox at x 72..96 overlaps that shifted-left sliver
    // (box spans 93.6..138.4) but would miss a box that started at chest.x
    // unshifted (100..144.8) entirely — this is the case a dropped offset
    // breaks.
    const player = makePlayer(52, closedChest.y);
    expect(chestPlayerIsStandingOn(player, [closedChest])).toBe('chest-1');
  });
});

describe('checkSignOverlap', () => {
  const sign: SignPlacement = { id: 'sign-bridgeDropThrough-1-1', hintId: 'bridgeDropThrough', x: 100, y: 100 };

  it('playerOverlappingSign-returnsItsHintId', () => {
    const player = makePlayer(100, 100);

    expect(checkSignOverlap(player, [sign])).toBe('bridgeDropThrough');
  });

  it('playerFarFromSign-returnsUndefined', () => {
    const player = makePlayer(1000, 1000);

    expect(checkSignOverlap(player, [sign])).toBeUndefined();
  });

  it('noSignsInLevel-returnsUndefined', () => {
    const player = makePlayer(100, 100);

    expect(checkSignOverlap(player, [])).toBeUndefined();
  });
});

describe('resolveHazardContacts — ordinary hazard resolution', () => {
  const hazard: HazardPlacement = { id: 'h1', hazardType: 'spike', facing: 'up', x: 100, y: 100 };

  it('playerOverlappingHazard-returnsItsDamageAndTheHazard', () => {
    const player = makePlayer(100, 100);
    const result = resolveHazardContacts(player, [hazard]);
    expect(result.hazard).toBe(hazard);
    expect(result.damage).toBe(SIDE_HIT_DAMAGE);
    expect(result.lethal).toBeUndefined();
  });

  it('playerFarFromHazard-returnsNoContact', () => {
    const player = makePlayer(1000, 1000);
    const result = resolveHazardContacts(player, [hazard]);
    expect(result.hazard).toBeUndefined();
    expect(result.damage).toBe(0);
    expect(result.lethal).toBeUndefined();
  });

  it('noHazardsInLevel-returnsNoContact', () => {
    const player = makePlayer(100, 100);
    const result = resolveHazardContacts(player, []);
    expect(result.hazard).toBeUndefined();
    expect(result.damage).toBe(0);
  });

  it('facingChangesWhichPartOfTheTileIsHazardous-sameOverlapMissesADifferentFacing', () => {
    // resolveHazardContacts dispatches through the HAZARD_TYPES registry
    // (hazardTypeOf(h).box(h)), so each facing's own narrower hitbox — the
    // band of the tile its visible spikes actually occupy, see Spike.ts's
    // facingBox — is what gets checked, not a facing-agnostic full tile.
    // 'up's band is the tile's bottom 10 rendered px; the player position
    // above (which overlaps it) sits well below the tile's TOP edge, so a
    // 'down'-facing hazard (band at the top instead) at the same spot must
    // miss.
    const player = makePlayer(100, 100);
    const downFacing: HazardPlacement = { ...hazard, facing: 'down' };
    const result = resolveHazardContacts(player, [downFacing]);
    expect(result.hazard).toBeUndefined();
    expect(result.damage).toBe(0);
  });

  it('twoOverlappingOrdinaryHazards-appliesAtMostOneDamage', () => {
    const player = makePlayer(100, 100);
    const second: HazardPlacement = { id: 'h2', hazardType: 'spike', facing: 'up', x: 100, y: 100 };
    const result = resolveHazardContacts(player, [hazard, second]);
    expect(result.hazard).toBe(hazard);
    expect(result.damage).toBe(SIDE_HIT_DAMAGE);
  });
});

/** A mask with one lethal tip pixel at (1, 1) — world (101, 101) for a spear
 *  placement at (100, 100). */
function oneTipSpearMask(): SpearMask {
  const pixels = new Uint8Array(16);
  pixels[1 * 4 + 1] = 1;
  return { width: 4, height: 4, pixels };
}

function emptySpearMask(): SpearMask {
  return { width: 4, height: 4, pixels: new Uint8Array(16) };
}

describe('resolveHazardContacts — lethal spear contact (US1)', () => {
  const spearHazard: HazardPlacement = { id: 's1', hazardType: 'spear', facing: 'up', x: 100, y: 100 };

  afterEach(() => {
    setSpearTipMask(emptySpearMask());
  });

  it('descendingTipSweep-returnsLethalWithZeroDamage', () => {
    setSpearTipMask(oneTipSpearMask());
    const player = makePlayer(80, 46);
    player.vy = 120;
    player.prevFeetY = 95;

    const result = resolveHazardContacts(player, [spearHazard]);

    expect(result.lethal).toBe(spearHazard);
    expect(result.damage).toBe(0);
    expect(result.hazard).toBeUndefined();
  });

  it('lethalContact-isReportedEvenWhileInvulnerable', () => {
    setSpearTipMask(oneTipSpearMask());
    const player = makePlayer(80, 46);
    player.vy = 120;
    player.prevFeetY = 95;
    player.hitTimer = 0; // inside the refractory window

    const result = resolveHazardContacts(player, [spearHazard]);

    expect(result.lethal).toBe(spearHazard);
  });

  it('lethalContact-takesPrecedenceOverASameTickOrdinarySpikeOverlap', () => {
    setSpearTipMask(oneTipSpearMask());
    // The player's hitbox (x 100..124, y 64..102) overlaps both the 'up'
    // spike's bottom band (82..92) and the spear's tip at (101, 101).
    const spike: HazardPlacement = { id: 'h1', hazardType: 'spike', facing: 'up', x: 100, y: 60 };
    const player = makePlayer(80, 46);
    player.vy = 120;
    player.prevFeetY = 95;

    const result = resolveHazardContacts(player, [spike, spearHazard]);

    expect(result.lethal).toBe(spearHazard);
    expect(result.damage).toBe(0);
    expect(result.hazard).toBeUndefined();
  });
});

describe('resolveHazardContacts — everything but a tip landing is safe (US2)', () => {
  const spearHazard: HazardPlacement = { id: 's1', hazardType: 'spear', facing: 'up', x: 100, y: 100 };

  beforeEach(() => {
    setSpearTipMask(oneTipSpearMask());
  });

  afterEach(() => {
    setSpearTipMask(emptySpearMask());
  });

  it('walkingThroughTheTileVyZero-returnsNoContact', () => {
    // Hitbox (x 100..124, y 118..156) overlaps the full-tile box, but the
    // character is grounded and not descending.
    const player = makePlayer(80, 100);
    player.vx = 200;
    player.vy = 0;
    player.grounded = true;

    const result = resolveHazardContacts(player, [spearHazard]);

    expect(result.lethal).toBeUndefined();
    expect(result.damage).toBe(0);
  });

  it('standingInsideTheTile-returnsNoContact', () => {
    const player = makePlayer(80, 100);
    player.vy = 0;
    player.grounded = true;

    const result = resolveHazardContacts(player, [spearHazard]);

    expect(result.lethal).toBeUndefined();
    expect(result.damage).toBe(0);
  });

  it('risingOrJumpingUpThroughTheTileVyNegative-returnsNoContact', () => {
    const player = makePlayer(80, 100);
    player.vy = -250;
    player.prevFeetY = 200;

    const result = resolveHazardContacts(player, [spearHazard]);

    expect(result.lethal).toBeUndefined();
    expect(result.damage).toBe(0);
  });

  it('transparentMarginOverlapWhileDescending-returnsNoContact', () => {
    // Hitbox (x 120..144, y 118..156) overlaps the tile's box (100..132) but
    // not the drawn tip at world (101, 101).
    const player = makePlayer(100, 100);
    player.vy = 300;
    player.prevFeetY = 110;

    const result = resolveHazardContacts(player, [spearHazard]);

    expect(result.lethal).toBeUndefined();
    expect(result.damage).toBe(0);
  });

  it('descendingSideOrShaftGraze-returnsNoContact', () => {
    // The feet are already below the tip row (101) at the start of the step,
    // so the sweep never crosses it — a side/shaft graze.
    const player = makePlayer(80, 70);
    player.vy = 120;
    player.prevFeetY = 118;

    const result = resolveHazardContacts(player, [spearHazard]);

    expect(result.lethal).toBeUndefined();
    expect(result.damage).toBe(0);
  });

  it('emptyMaskWhileDescending-returnsNoContact', () => {
    setSpearTipMask(emptySpearMask());
    const player = makePlayer(80, 46);
    player.vy = 120;
    player.prevFeetY = 95;

    const result = resolveHazardContacts(player, [spearHazard]);

    expect(result.lethal).toBeUndefined();
    expect(result.damage).toBe(0);
  });
});

describe('resolveHazardContacts — floor spike is only a contact while full-extend', () => {
  // Regression: floorSpike.box() is a constant rect (not phase-gated — see
  // its own doc comment), so a floor spike's `isContact` is what must
  // exclude it outside full-extend; without `isContact`, aabbOverlap's
  // strict comparisons would report the standing-on-the-tile overlap below
  // as a contact regardless of phase.
  it('playerStandingOnAChargingFloorSpike-isExcludedRegardlessOfBoxOverlap', () => {
    const floorSpikeHazard: HazardPlacement = {
      id: 'fs1',
      hazardType: 'floorSpike',
      facing: 'up',
      x: 100,
      y: 100,
      floorSpikePhase: 'delay',
    };
    const player = makePlayer(100, 100);
    const result = resolveHazardContacts(player, [floorSpikeHazard]);
    expect(result.hazard).toBeUndefined();
    expect(result.damage).toBe(0);
  });

  it('playerStandingOnAFullyExtendedFloorSpike-isIncluded', () => {
    const floorSpikeHazard: HazardPlacement = {
      id: 'fs1',
      hazardType: 'floorSpike',
      facing: 'up',
      x: 100,
      y: 100,
      floorSpikePhase: 'fullExtend',
    };
    const player = makePlayer(100, 100);
    const result = resolveHazardContacts(player, [floorSpikeHazard]);
    expect(result.hazard).toBe(floorSpikeHazard);
    expect(result.damage).toBe(SIDE_HIT_DAMAGE);
  });
});

describe('checkFloorSpikeTriggers', () => {
  function floorSpikeHazard(id: string, x: number, y: number): HazardPlacement {
    return { id, hazardType: 'floorSpike', facing: 'up', x, y };
  }

  it('playerOverlappingAnUnarmedFloorSpike-returnsItsId', () => {
    const hazard = floorSpikeHazard('fs1', 16, 32);
    const player = makePlayer(hazard.x, hazard.y);
    expect(checkFloorSpikeTriggers(player, [hazard], [])).toEqual(['fs1']);
  });

  it('playerOverlappingAnAlreadyArmedFloorSpike-returnsEmpty', () => {
    const hazard = floorSpikeHazard('fs1', 16, 32);
    const player = makePlayer(hazard.x, hazard.y);
    expect(checkFloorSpikeTriggers(player, [hazard], [{ id: 'fs1', elapsed: 0.1 }])).toEqual([]);
  });

  it('playerFarFromEveryFloorSpike-returnsEmpty', () => {
    const hazard = floorSpikeHazard('fs1', 1600, 1600);
    const player = makePlayer(0, 0);
    expect(checkFloorSpikeTriggers(player, [hazard], [])).toEqual([]);
  });

  it('staticSpikePlacements-areIgnored', () => {
    const hazard: HazardPlacement = { id: 's1', hazardType: 'spike', facing: 'up', x: 16, y: 32 };
    const player = makePlayer(hazard.x, hazard.y);
    expect(checkFloorSpikeTriggers(player, [hazard], [])).toEqual([]);
  });
});

/** The y that plants the player's feet exactly on `row`'s top edge — same
 *  arithmetic as Physics.test.ts's `standingYOnRow`, duplicated locally
 *  rather than imported since this file builds its players via the local
 *  `makePlayer(x, y)` positional helper, not Physics.test.ts's
 *  overrides-object `basePlayer`. */
function standingYOnRow(row: number): number {
  return row * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
}

describe('checkCrumblingFloorTriggers', () => {
  // Row 0 is a crumbling floor tile ('g'), row 1 solid ground beneath it
  // ('G') — the player's feet are planted on row 0's top edge.
  const level = parseLevel(['g', 'G']);

  it('unarmedCrumblingFloorUnderfoot-isReturnedAsATrigger', () => {
    const player = makePlayer(0, standingYOnRow(0));
    expect(checkCrumblingFloorTriggers(player, level, [])).toEqual([{ col: 0, row: 0 }]);
  });

  it('alreadyArmedCrumblingFloorUnderfoot-isNotReturnedAgain', () => {
    const player = makePlayer(0, standingYOnRow(0));
    const states = [{ col: 0, row: 0, elapsed: 0.1 }];
    expect(checkCrumblingFloorTriggers(player, level, states)).toEqual([]);
  });

  it('playerNotOverACrumblingFloorTile-returnsNothing', () => {
    const plainLevel = parseLevel(['.', 'G']);
    const player = makePlayer(0, standingYOnRow(0));
    expect(checkCrumblingFloorTriggers(player, plainLevel, [])).toEqual([]);
  });

  it('notGrounded-returnsNothingEvenWithFootRowOverlap', () => {
    // Same feet-row position as the triggering test above, but airborne
    // (e.g. mid-jump-arc passing through this row rather than landing on
    // it) — must not arm the tile.
    const player = { ...makePlayer(0, standingYOnRow(0)), grounded: false };
    expect(checkCrumblingFloorTriggers(player, level, [])).toEqual([]);
  });
});

function makeSpikedPurpleEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    id: 'e1', type: 'slimePurple', x: 10, y: 20, vx: 0, vy: 0,
    direction: 'right', animState: 'walk', animFrame: 0,
    animTimer: 0, hitPoints: 2, hitTimer: ENEMY_HIT_REACTION_SECONDS, alive: true,
    spiked: true, spikeTimer: 0.1, homeX: 10, homeY: 20,
    rewardGiven: false,
    deathEffectGiven: false,
    ...overrides,
  };
}

/**
 * Multi-enemy aggregation. Single-enemy outcomes are pinned by
 * EnemyContact.contract.test.ts; what these cover is what the engine — and
 * only the engine — decides when more than one enemy is contacted in the same
 * tick.
 *
 * Positions come from the hitbox arithmetic anchored in WorldType.test.ts's
 * 'enemy box equivalence': a green slime at (x, y) has a hitbox of
 * (x+2, y+2, 28x30), a purple one (x-12, y-28, 56x60), and the player's is
 * (x+20, y+18, 24x38).
 */
describe('resolveEnemyContacts aggregation', () => {
  it('twoDamagingEnemiesTouchedAtOnce-appliesDamageOnce', () => {
    // Player hitbox spans x 20..44; the two green hitboxes span 2..30 and
    // 26..54, so it is walking into both at once.
    const left = makeEnemy(0, 100);
    const right = makeEnemy(24, 100);
    const player = makePlayer(0, 100); // vy 0 — a side touch, not a landing

    const result = resolveEnemyContacts(player, [left, right]);

    expect(result.damagePlayer).toBe(1);
    expect(result.knockback).toBe('away');
    expect(result.bounceVelocity).toBeUndefined();
  });

  it('oneStompableAndOneDamagingEnemy-appliesBothBounceAndDamage', () => {
    // The player's hitbox bottom (106) is inside the green slime's upper half
    // (its hitbox spans y 102..132) and also inside the spiked purple one's
    // upper half beside it (77..137), so both register a top contact — a
    // stomp on the green, a failed stomp against the purple's spikes.
    const green = makeEnemy(0, 100);
    const spikedPurple = makeSpikedPurpleEnemy({ x: 30, y: 105, homeX: 30, homeY: 105 });
    const player = { ...playerLandingOnTopOf(green), vy: 300, grounded: false };

    const result = resolveEnemyContacts(player, [green, spikedPurple]);

    expect(result.bounceVelocity).toBe(PHYSICS_CONFIG.stompBounceVelocity);
    expect(result.enemies[0].hitPoints).toBe(green.hitPoints - 1);
    expect(result.damagePlayer).toBe(1);
    expect(result.knockback).toBe('awayAndUp');
    expect(result.enemies[1]).toBe(spikedPurple);
  });

  it('survivingStompOnAPurpleSlime-appliesItsOnDamagedHook', () => {
    // The engine applies a landed hit's consequences through the type's
    // `onDamaged`: without that wiring the slime takes the hit but never
    // grows its spikes. Purple hitbox spans y 72..132 (midpoint 102); the
    // player's hitbox bottom at 96 lands on its upper half.
    const purple = makeSpikedPurpleEnemy({ x: 100, y: 100, homeX: 100, homeY: 100, hitPoints: 3, spiked: false, spikeTimer: 0 });
    const player = { ...makePlayer(90, 40), vy: 200, grounded: false };

    const result = resolveEnemyContacts(player, [purple]);

    expect(result.enemies[0].hitPoints).toBe(2);
    expect(result.enemies[0]).toMatchObject({ spiked: true, spikeTimer: 0 });
  });

  it('killingStompOnAPurpleSlime-leavesTheCorpseUnspiked', () => {
    const purple = makeSpikedPurpleEnemy({ x: 100, y: 100, homeX: 100, homeY: 100, hitPoints: 1, spiked: false, spikeTimer: 0 });
    const player = { ...makePlayer(90, 40), vy: 200, grounded: false };

    const result = resolveEnemyContacts(player, [purple]);

    expect(result.enemies[0].hitPoints).toBe(0);
    expect(result.enemies[0]).toMatchObject({ spiked: false });
  });

  it('enemiesNotTouched-areReturnedByReference', () => {
    const stomped = makeEnemy(0, 100);
    const faraway = makeEnemy(2000, 2000);
    const player = { ...playerLandingOnTopOf(stomped), vy: 300, grounded: false };

    const result = resolveEnemyContacts(player, [stomped, faraway]);

    expect(result.enemies[1]).toBe(faraway);
    expect(result.enemies[0]).not.toBe(stomped);
  });

  it('twoStompedEnemiesInOneTick-appliesTheStrongestBounce', () => {
    // Covers that a bounce actually propagates through the real multi-enemy
    // contact path, NOT the most-negative-wins tie-break itself: both green
    // slimes bounce with the identical stompBounceVelocity constant, so this
    // case can't distinguish most-negative-wins from first-wins/last-wins.
    // The tie-break rule is pinned with genuinely differing values against
    // `strongerBounce` directly in Outcome.test.ts.
    //
    // Positions follow the same hitbox arithmetic the surrounding aggregation
    // tests use: the two green hitboxes span x 2..30 and 26..54, and the
    // player's spans 20..44, so it lands on both at once.
    const left = makeEnemy(0, 100);
    const right = makeEnemy(24, 100);
    const player = { ...playerLandingOnTopOf(left), vy: 300, grounded: false };

    const result = resolveEnemyContacts(player, [left, right]);

    expect(result.bounceVelocity).toBe(PHYSICS_CONFIG.stompBounceVelocity);
  });

  it('killingStompOnAPurpleSlime-includesItInDamagedEnemyIds', () => {
    const purple = makeSpikedPurpleEnemy({
      x: 100, y: 100, homeX: 100, homeY: 100, hitPoints: 1, spiked: false, spikeTimer: 0,
    });
    const player = { ...makePlayer(90, 40), vy: 200, grounded: false };

    const result = resolveEnemyContacts(player, [purple]);

    expect(result.damagedEnemyIds).toEqual([purple.id]);
  });

  it('survivingStompOnAPurpleSlime-alsoIncludesItInDamagedEnemyIds', () => {
    // A hit that does NOT defeat the enemy must still be reported — this is
    // exactly the case that previously had no visible feedback at all
    // (spec.md User Story 2).
    const purple = makeSpikedPurpleEnemy({
      x: 100, y: 100, homeX: 100, homeY: 100, hitPoints: 3, spiked: false, spikeTimer: 0,
    });
    const player = { ...makePlayer(90, 40), vy: 200, grounded: false };

    const result = resolveEnemyContacts(player, [purple]);

    expect(result.damagedEnemyIds).toEqual([purple.id]);
  });

  it('enemiesNotTouched-areNotInDamagedEnemyIds', () => {
    const stomped = makeEnemy(0, 100);
    const faraway = makeEnemy(2000, 2000);
    const player = { ...playerLandingOnTopOf(stomped), vy: 300, grounded: false };

    const result = resolveEnemyContacts(player, [stomped, faraway]);

    expect(result.damagedEnemyIds).toEqual([stomped.id]);
  });

  it('failedStompAgainstSpikes-doesNotCountAsDamage', () => {
    // A spiked purple slime survives a failed stomp with no hit-point loss
    // (it damages the PLAYER instead) — must not appear in damagedEnemyIds.
    const green = makeEnemy(0, 100);
    const spikedPurple = makeSpikedPurpleEnemy({ x: 30, y: 105, homeX: 30, homeY: 105 });
    const player = { ...playerLandingOnTopOf(green), vy: 300, grounded: false };

    const result = resolveEnemyContacts(player, [green, spikedPurple]);

    expect(result.damagedEnemyIds).toEqual([green.id]);
  });
});

describe('checkKeyPickupCollisions', () => {
  const player = {
    x: 0, y: 0, vx: 0, vy: 0, direction: 'right' as const, grounded: true, climbing: false,
    crouching: false,
    isDroppingThroughBridge: false, lastGroundedX: 0, lastGroundedY: 0, animState: 'idle' as const,
    prevFeetY: PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING,
    animFrame: 0, animTimer: 0, knockbackTimer: 0, bounceAscending: false, blockContacts: [],
    hitPoints: 6, alive: true, hitTimer: PLAYER_HIT_REACTION_SECONDS,
  };

  it('checkKeyPickupCollisions-overlappingUncollectedPickup-returnsItsId', () => {
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 0, y: 0, collected: false }];
    expect(checkKeyPickupCollisions(player, pickups)).toEqual(['k1']);
  });

  it('checkKeyPickupCollisions-alreadyCollectedPickup-isExcluded', () => {
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 0, y: 0, collected: true }];
    expect(checkKeyPickupCollisions(player, pickups)).toEqual([]);
  });

  it('checkKeyPickupCollisions-noOverlap-returnsEmpty', () => {
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 1000, y: 1000, collected: false }];
    expect(checkKeyPickupCollisions(player, pickups)).toEqual([]);
  });
});

describe('checkBombPickupCollisions', () => {
  const player = { ...makePlayer(0, 100 - RENDERED_TILE_SIZE) };

  it('belowTheCap-overlappingPickup-returnsItsId', () => {
    const bomb = spawnBombPickup('b1', 0, 100);
    expect(checkBombPickupCollisions(player, [bomb], 0, 5)).toEqual(['b1']);
  });

  it('atTheCap-overlappingPickup-isLeftInTheWorld', () => {
    const bomb = spawnBombPickup('b1', 0, 100);
    expect(checkBombPickupCollisions(player, [bomb], 5, 5)).toEqual([]);
  });

  it('severalPickupsInOneTick-clampsToTheRemainingCapacityInArrayOrder', () => {
    const bombs = [
      spawnBombPickup('b1', 0, 100),
      spawnBombPickup('b2', 0, 100),
      spawnBombPickup('b3', 0, 100),
    ];
    expect(checkBombPickupCollisions(player, bombs, 4, 5)).toEqual(['b1']);
    expect(checkBombPickupCollisions(player, bombs, 3, 5)).toEqual(['b1', 'b2']);
  });

  it('noOverlap-returnsEmpty', () => {
    const bomb = spawnBombPickup('b1', 1000, 1000);
    expect(checkBombPickupCollisions(player, [bomb], 0, 5)).toEqual([]);
  });
});

describe('every consumer reads the one crouched box (US1 / SC-008)', () => {
  // A pickup in the standing box's head band — the 6px strip (18..24) only the
  // standing box reaches. The 32px coin's bottom sits at 20, above the crouched
  // top at 24, so only the standing box overlaps it.
  it('checkCollectibleCollisions-coinInTheHeadBand-collectedStandingMissedCrouched', () => {
    const coin = makePlacement('head-coin', PLAYER_SIDE_PADDING, -12);
    const standing = makePlayer(0, 0);
    const crouched = { ...makePlayer(0, 0), crouching: true };
    expect(checkCollectibleCollisions(standing, [coin], new Set())).toEqual(['head-coin']);
    expect(checkCollectibleCollisions(crouched, [coin], new Set())).toEqual([]);
  });

  it('resolveEnemyContacts-enemyReachableOnlyByTheStandingHeadBand-contactsStandingOnly', () => {
    // A green slime's hitbox is (x+2, y+2, 28x30); at placement y = -10 it spans
    // -8..22, overlapping the standing box (18..56) but not the crouched one
    // (24..56).
    const green = makeEnemy(0, -10);
    const standing = makePlayer(0, 0);
    const crouched = { ...makePlayer(0, 0), crouching: true };
    expect(resolveEnemyContacts(standing, [green]).damagePlayer).toBeGreaterThan(0);
    expect(resolveEnemyContacts(crouched, [green]).damagePlayer).toBe(0);
  });

  it('resolveHazardContacts-spikeBandInTheHeadBand-hitsStandingOnly', () => {
    // An 'up' spike's band is its tile's bottom 10 rendered px; at y = -10 it
    // spans 12..22 — inside the standing box's head band, above the crouched
    // top at 24.
    const hazard: HazardPlacement = {
      id: 'head-spike',
      hazardType: 'spike',
      facing: 'up',
      x: PLAYER_SIDE_PADDING,
      y: -10,
    };
    const standing = makePlayer(0, 0);
    const crouched = { ...makePlayer(0, 0), crouching: true };
    expect(resolveHazardContacts(standing, [hazard]).damage).toBeGreaterThan(0);
    expect(resolveHazardContacts(crouched, [hazard]).damage).toBe(0);
  });

  it('checkFloorSpikeTriggers-triggerBandInTheHeadBand-armsStandingOnly', () => {
    const hazard: HazardPlacement = {
      id: 'head-fs',
      hazardType: 'floorSpike',
      facing: 'up',
      x: PLAYER_SIDE_PADDING,
      y: -10,
    };
    const standing = makePlayer(0, 0);
    const crouched = { ...makePlayer(0, 0), crouching: true };
    expect(checkFloorSpikeTriggers(standing, [hazard], [])).toEqual(['head-fs']);
    expect(checkFloorSpikeTriggers(crouched, [hazard], [])).toEqual([]);
  });

  it('playerInBlast-tileReachableOnlyByTheTallerBox-hitsStandingOnly', () => {
    // Player at y = 8: the standing box spans 26..64 (row 0 included), the
    // crouched box 32..64 (row 1 onward). A row-0 blast tile (0..32) is touched
    // only by the standing box.
    const standingBox = playerHitbox(makePlayer(0, 8));
    const crouchedBox = playerHitbox({ ...makePlayer(0, 8), crouching: true });
    const tiles = [{ col: 0, row: 0 }];
    expect(playerInBlast(standingBox, tiles, RENDERED_TILE_SIZE)).toBe(true);
    expect(playerInBlast(crouchedBox, tiles, RENDERED_TILE_SIZE)).toBe(false);
  });
});
