import {
  playerHitbox,
  aabbOverlap,
  checkCollectibleCollisions,
  resolveEnemyContacts,
  checkBonusFruitCollisions,
  chestPlayerIsStandingOn,
  checkSignOverlap,
  enemyHitbox,
  checkKeyPickupCollisions,
  overlappingPickups,
} from './Collision';
import {
  PLAYER_SIDE_PADDING,
  PLAYER_HEAD_PADDING,
  PLAYER_FOOT_PADDING,
  PLAYER_RENDERED_SIZE,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import {
  toEnemyState,
  enemyRenderedSize,
  enemyTileOffsetX,
  enemyTileOffsetY,
  enemyHitboxSidePadding,
  enemyHitboxTopPadding,
} from '../entities/Enemy';
import type { EnemyState } from '../entities/Enemy';
import type { SlimeGreenState } from '../entities/enemies/SlimeGreen';
import type { EnemyPlacement } from '../level/EnemyMapper';
import { spawnBonusFruit, tickBonusFruit, BONUS_FRUIT_RISE_DURATION_SECONDS } from '../entities/BonusFruit';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { ChestState } from '../entities/Chest';
import type { SignPlacement } from '../level/SignMapper';
import type { KeyPickupState } from '../entities/KeyPickup';

function makePlayer(x: number, y: number): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: true,
    climbing: false,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    invincibleTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    hitBlockIds: [],
  };
}

function makePlacement(id: string, x: number, y: number): CollectiblePlacement {
  return {
    id,
    spriteType: 'coin',
    fact: { id, sectionId: 'skills', sectionLabel: 'Skills', data: { category: 'X', skills: [] }, sourceType: 'coin' },
    x,
    y,
  };
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

describe('overlappingPickups', () => {
  it('itemsOverlappingThePlayer-areReturnedInArrayOrder', () => {
    const player = makePlayer(100, 100);
    const box = playerHitbox(player);
    const near = { id: 'near', x: box.x, y: box.y };
    const far = { id: 'far', x: box.x + 500, y: box.y };
    const result = overlappingPickups(
      player,
      [far, near],
      (i) => ({ x: i.x, y: i.y, width: 32, height: 32 }),
      () => true,
    );
    expect(result).toEqual([near]);
  });

  it('itemsFailingTheEligibilityPredicate-areSkippedEvenWhenOverlapping', () => {
    const player = makePlayer(100, 100);
    const box = playerHitbox(player);
    const item = { id: 'blocked', x: box.x, y: box.y };
    const result = overlappingPickups(
      player,
      [item],
      (i) => ({ x: i.x, y: i.y, width: 32, height: 32 }),
      () => false,
    );
    expect(result).toEqual([]);
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
 * "landing on top" stomp), derived from the real enemyHitbox/playerHitbox
 * geometry rather than a hand-computed magic number, so this stays correct
 * regardless of future padding/offset tuning. `overlapPx` must stay well
 * under half the enemy hitbox's height to guarantee an upper-half landing.
 */
function playerLandingOnTopOf(enemy: EnemyState, overlapPx = 4): PlayerState {
  const box = enemyHitbox(enemy);
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

function makeSpikedPurpleEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    id: 'e1', type: 'slimePurple', x: 10, y: 20, vx: 0, vy: 0,
    direction: 'right', animState: 'walk', animFrame: 0,
    animTimer: 0, hitPoints: 2, hitTimer: 0, alive: true,
    spiked: true, spikeTimer: 0.1, homeX: 10, homeY: 20,
    rewardGiven: false,
    ...overrides,
  };
}

/**
 * Multi-enemy aggregation. Single-enemy outcomes are pinned by
 * EnemyContact.contract.test.ts; what these cover is what the engine — and
 * only the engine — decides when more than one enemy is contacted in the same
 * tick.
 *
 * Positions come from the hitbox arithmetic anchored in 'enemyHitbox per type'
 * below: a green slime at (x, y) has a hitbox of (x+2, y+2, 28x30), a purple
 * one (x-12, y-28, 56x60), and the player's is (x+20, y+18, 24x38).
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
    expect(result.bouncePlayer).toBe(false);
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

    expect(result.bouncePlayer).toBe(true);
    expect(result.enemies[0].hitPoints).toBe(green.hitPoints - 1);
    expect(result.damagePlayer).toBe(1);
    expect(result.knockback).toBe('awayAndUp');
    expect(result.enemies[1]).toBe(spikedPurple);
  });

  it('enemiesNotTouched-areReturnedByReference', () => {
    const stomped = makeEnemy(0, 100);
    const faraway = makeEnemy(2000, 2000);
    const player = { ...playerLandingOnTopOf(stomped), vy: 300, grounded: false };

    const result = resolveEnemyContacts(player, [stomped, faraway]);

    expect(result.enemies[1]).toBe(faraway);
    expect(result.enemies[0]).not.toBe(stomped);
  });
});

describe('enemyHitbox per type', () => {
  it('enemyHitbox-slimeGreen-insetFromRenderSlotByMeasuredSpriteConstants', () => {
    // Concrete anchor values (not derived from the functions under test):
    // size=48, tileOffsetX=-8, tileOffsetY=-16, sidePad=10, topPad=18 ->
    // x=enemy.x+2, y=enemy.y+2, width=28, height=30.
    const enemy = {
      id: 'e1', type: 'slimeGreen' as const, x: 10, y: 20, vx: 0, vy: 0,
      direction: 'right' as const, animState: 'walk' as const, animFrame: 0,
      animTimer: 0, hitPoints: 1, hitTimer: 0, alive: true,
      spiked: false, spikeTimer: 0, homeX: 10, homeY: 20, rewardGiven: false,
    };
    expect(enemyHitbox(enemy)).toEqual({ x: 12, y: 22, width: 28, height: 30 });
  });

  it('enemyHitbox-slimePurple-scalesOffsetAndInsetWithRenderScale', () => {
    // size=96, tileOffsetX=-32, tileOffsetY=-64, sidePad=20, topPad=36 ->
    // x=enemy.x-22, y=enemy.y-28, width=56, height=60.
    const enemy = {
      id: 'e1', type: 'slimePurple' as const, x: 10, y: 20, vx: 0, vy: 0,
      direction: 'right' as const, animState: 'walk' as const, animFrame: 0,
      animTimer: 0, hitPoints: 3, hitTimer: 0, alive: true,
      spiked: false, spikeTimer: 0, homeX: 10, homeY: 20, rewardGiven: false,
    };
    expect(enemyHitbox(enemy)).toEqual({ x: -2, y: -8, width: 56, height: 60 });
  });

  it('enemyHitbox-anySpriteType-matchesTheRenderedSpritesBoundingBox', () => {
    // Cross-checks against the same offset/padding helpers drawEnemies
    // itself uses, so the hitbox and the visible sprite can never silently
    // drift apart again.
    for (const type of ['slimeGreen', 'slimePurple'] as const) {
      const enemy = {
        id: 'e1', type, x: 100, y: 200, vx: 0, vy: 0,
        direction: 'right' as const, animState: 'walk' as const, animFrame: 0,
        animTimer: 0, hitPoints: 1, hitTimer: 0, alive: true,
        spiked: false, spikeTimer: 0, homeX: 100, homeY: 200, rewardGiven: false,
      };
      const size = enemyRenderedSize(type);
      const sidePad = enemyHitboxSidePadding(type);
      const topPad = enemyHitboxTopPadding(type);
      expect(enemyHitbox(enemy)).toEqual({
        x: 100 + enemyTileOffsetX(type) + sidePad,
        y: 200 + enemyTileOffsetY(type) + topPad,
        width: size - 2 * sidePad,
        height: size - topPad,
      });
    }
  });
});

describe('checkKeyPickupCollisions', () => {
  const player = {
    x: 0, y: 0, vx: 0, vy: 0, direction: 'right' as const, grounded: true, climbing: false,
    isDroppingThroughBridge: false, lastGroundedX: 0, lastGroundedY: 0, animState: 'idle' as const,
    animFrame: 0, animTimer: 0, invincibleTimer: 0, knockbackTimer: 0, bounceAscending: false, hitBlockIds: [],
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
