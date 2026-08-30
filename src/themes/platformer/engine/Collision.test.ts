import {
  playerHitbox,
  aabbOverlap,
  checkCollectibleCollisions,
  checkEnemyStompCollisions,
  checkEnemySideCollisions,
  checkBonusFruitCollisions,
  chestPlayerIsStandingOn,
} from './Collision';
import { PLAYER_SIDE_PADDING, PLAYER_HEAD_PADDING, PLAYER_RENDERED_SIZE } from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import { toEnemyState, ENEMY_RENDERED_SIZE } from '../entities/Enemy';
import type { EnemyState } from '../entities/Enemy';
import type { EnemyPlacement } from '../level/EnemyMapper';
import { spawnBonusFruit, tickBonusFruit, BONUS_FRUIT_RISE_DURATION_SECONDS } from '../entities/BonusFruit';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { ChestState } from '../entities/Chest';

function makePlayer(x: number, y: number): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 'right',
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

function makeEnemy(x: number, y: number, overrides: Partial<EnemyState> = {}): EnemyState {
  const placement: EnemyPlacement = {
    id: 'enemy-cert-x',
    spriteType: 'slimeGreen',
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

describe('checkEnemyStompCollisions', () => {
  it('playerFallingAndLandingOnTop-returnsEnemyId', () => {
    const enemy = makeEnemy(0, 100);
    // Player's hitbox bottom lands well inside the enemy's upper half —
    // playerHitbox's y offset (PLAYER_HEAD_PADDING) is applied to player.y,
    // so placing the player a bit above the enemy with vy > 0 (falling)
    // simulates "landing on top of it".
    const player = { ...makePlayer(0, 100 - PLAYER_RENDERED_SIZE / 2), vy: 300 };
    expect(checkEnemyStompCollisions(player, [enemy])).toEqual(['enemy-cert-x']);
  });

  it('playerRisingIntoEnemyFromBelow-returnsEmptyArray', () => {
    const enemy = makeEnemy(0, 100);
    const player = { ...makePlayer(0, 100 + ENEMY_RENDERED_SIZE - 10), vy: -300 };
    expect(checkEnemyStompCollisions(player, [enemy])).toEqual([]);
  });

  it('playerLevelWithEnemyNotFalling-returnsEmptyArray', () => {
    // vy === 0 (grounded, walking into it side-on) must not count as a stomp
    // — that is roadmap step 19's job, not this one's.
    const enemy = makeEnemy(0, 100);
    const player = { ...makePlayer(0, 100), vy: 0 };
    expect(checkEnemyStompCollisions(player, [enemy])).toEqual([]);
  });

  it('playerFallingButFarFromEnemy-returnsEmptyArray', () => {
    const enemy = makeEnemy(2000, 2000);
    const player = { ...makePlayer(0, 0), vy: 300 };
    expect(checkEnemyStompCollisions(player, [enemy])).toEqual([]);
  });

  it('enemyAlreadyDefeated-excludedEvenIfOverlapping', () => {
    const enemy = makeEnemy(0, 100, { defeated: true });
    const player = { ...makePlayer(0, 100 - PLAYER_RENDERED_SIZE / 2), vy: 300 };
    expect(checkEnemyStompCollisions(player, [enemy])).toEqual([]);
  });

  it('enemyHitPointsAlreadyZero-excludedEvenIfOverlapping', () => {
    // Already taken its fatal hit, just awaiting removal once its reaction
    // finishes — must not keep decrementing hitPoints arbitrarily below 0
    // every time the stomp's own bounce arcs back down onto it.
    const enemy = makeEnemy(0, 100, { animState: 'hit', hitPoints: 0 });
    const player = { ...makePlayer(0, 100 - PLAYER_RENDERED_SIZE / 2), vy: 300 };
    expect(checkEnemyStompCollisions(player, [enemy])).toEqual([]);
  });

  it('enemyMidHitReactionButHitPointsRemain-canBeStompedAgain', () => {
    // The whole point of the fix (found via live testing): a still-alive
    // (purple, 2 hit points, now down to 1) enemy mid-`hit`-reaction must be
    // a valid stomp target even entirely airborne from the first stomp's own
    // bounce — this engine has no double-jump, so "land on the same
    // still-alive enemy again while still airborne" is a deliberate
    // chain-stomp mechanic, not a bug to guard against.
    const enemy = makeEnemy(0, 100, { animState: 'hit', hitPoints: 1 });
    const player = { ...makePlayer(0, 100 - PLAYER_RENDERED_SIZE / 2), vy: 300 };
    expect(checkEnemyStompCollisions(player, [enemy])).toEqual(['enemy-cert-x']);
  });
});

describe('checkEnemySideCollisions', () => {
  it('playerWalkingIntoEnemyFromTheSide-groundedNotFalling-returnsEnemyId', () => {
    const enemy = makeEnemy(0, 100);
    const player = { ...makePlayer(0, 100), vy: 0 };
    expect(checkEnemySideCollisions(player, [enemy])).toEqual(['enemy-cert-x']);
  });

  it('playerRisingIntoEnemyFromBelow-returnsEnemyId', () => {
    const enemy = makeEnemy(0, 100);
    const player = { ...makePlayer(0, 100 + ENEMY_RENDERED_SIZE - 40), vy: -300 };
    expect(checkEnemySideCollisions(player, [enemy])).toEqual(['enemy-cert-x']);
  });

  it('playerFallingAndLandingOnTop-isAStompNotASideHit-returnsEmptyArray', () => {
    const enemy = makeEnemy(0, 100);
    const player = { ...makePlayer(0, 100 - PLAYER_RENDERED_SIZE / 2), vy: 300 };
    expect(checkEnemySideCollisions(player, [enemy])).toEqual([]);
  });

  it('playerFarFromEnemy-returnsEmptyArray', () => {
    const enemy = makeEnemy(2000, 2000);
    const player = { ...makePlayer(0, 0), vy: 0 };
    expect(checkEnemySideCollisions(player, [enemy])).toEqual([]);
  });

  it('enemyDefeated-excludedEvenIfOverlapping', () => {
    const enemy = makeEnemy(0, 100, { defeated: true });
    const player = { ...makePlayer(0, 100), vy: 0 };
    expect(checkEnemySideCollisions(player, [enemy])).toEqual([]);
  });

  it('enemyInHitReaction-excludedEvenIfOverlapping', () => {
    // Reversed from an earlier design decision after live testing: a
    // hit-reacting enemy must be harmless in every way, or bouncing off a
    // stomp while still overlapping the now-frozen enemy (rising, or
    // drifting beside it before separating) registers as a spurious side-hit
    // against the very enemy just stomped. Unlike stomp detection (which
    // only excludes an enemy once its `hitPoints` reach 0), side-hit
    // detection still gates on `animState === 'hit'` directly — a
    // hit-reacting enemy should stay harmless to side-touch for its whole
    // reaction, separated or not, since (unlike stomping) there's no
    // "legitimate repeat side-hit" the player would want to land sooner.
    const enemy = makeEnemy(0, 100, { animState: 'hit' });
    const player = { ...makePlayer(0, 100), vy: 0 };
    expect(checkEnemySideCollisions(player, [enemy])).toEqual([]);
  });
});

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
