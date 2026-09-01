import {
  checkEnemyStompCollisions,
  checkEnemySideCollisions,
  isSpikedTopLanding,
} from './Collision';
import type { EnemyState } from '../entities/Enemy';
import type { PlayerState } from '../entities/Player';

/**
 * Characterization of enemy/player contact as it behaves today, expressed in
 * terms of OUTCOMES (stomped / damaged / bounced off spikes) rather than the
 * names of the three functions that currently produce them. Plan 2 collapses
 * those three into one `resolveEnemyContacts` and re-runs this exact table,
 * so a behavior drift fails here rather than silently landing.
 *
 * Positions are chosen from the hitbox arithmetic documented in this plan's
 * "Reference values" table: with an enemy at (100, 100), a player at y = 60
 * lands on a green slime's upper half, y = 80 contacts its lower half, and
 * y = 40 lands on a purple slime's upper half.
 */

function makePlayer(x: number, y: number, vy: number): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy,
    facing: 'right',
    grounded: false,
    climbing: false,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    animState: 'jump',
    animFrame: 0,
    animTimer: 0,
    invincibleTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    hitBlockIds: [],
  };
}

function makeEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    id: 'enemy-under-test',
    spriteType: 'slimeGreen',
    x: 100,
    y: 100,
    vx: 0,
    direction: 'right',
    animState: 'walk',
    animFrame: 0,
    animTimer: 0,
    hitPoints: 1,
    hitTimer: 0,
    spiked: false,
    spikeTimer: 0,
    alive: true,
    ...overrides,
  };
}

export interface ContactCase {
  name: string;
  enemy: Partial<EnemyState>;
  /** Player render-slot top-left. */
  playerX: number;
  playerY: number;
  playerVy: number;
  expected: {
    stomped: boolean;
    damaged: boolean;
    /** A failed stomp against spikes — damage plus an upward knockback. */
    spikedTopLanding: boolean;
  };
}

export const CONTACT_CASES: ContactCase[] = [
  {
    name: 'greenUpperHalfWhileFalling-isAStomp',
    enemy: {},
    playerX: 90,
    playerY: 60,
    playerVy: 200,
    expected: { stomped: true, damaged: false, spikedTopLanding: false },
  },
  {
    name: 'greenLowerHalfWhileFalling-isDamage',
    enemy: {},
    playerX: 90,
    playerY: 80,
    playerVy: 200,
    expected: { stomped: false, damaged: true, spikedTopLanding: false },
  },
  {
    name: 'greenUpperHalfWhileRising-isDamage',
    enemy: {},
    playerX: 90,
    playerY: 60,
    playerVy: -200,
    expected: { stomped: false, damaged: true, spikedTopLanding: false },
  },
  {
    name: 'greenAlreadyOutOfHitPoints-isNeitherStompNorDamage',
    // hitPoints 0 always coincides with the 'hit' reaction in practice, and a
    // reacting enemy is harmless in every way until its reaction ends.
    enemy: { hitPoints: 0, animState: 'hit' },
    playerX: 90,
    playerY: 60,
    playerVy: 200,
    expected: { stomped: false, damaged: false, spikedTopLanding: false },
  },
  {
    name: 'greenDead-isNeitherStompNorDamage',
    enemy: { alive: false, hitPoints: 0 },
    playerX: 90,
    playerY: 60,
    playerVy: 200,
    expected: { stomped: false, damaged: false, spikedTopLanding: false },
  },
  {
    name: 'purpleUnspikedUpperHalfWhileFalling-isAStomp',
    enemy: { spriteType: 'slimePurple', hitPoints: 3 },
    playerX: 90,
    playerY: 40,
    playerVy: 200,
    expected: { stomped: true, damaged: false, spikedTopLanding: false },
  },
  {
    name: 'purpleSpikedUpperHalfWhileFalling-isDamageWithUpwardKnockback',
    enemy: { spriteType: 'slimePurple', hitPoints: 2, spiked: true },
    playerX: 90,
    playerY: 40,
    playerVy: 200,
    expected: { stomped: false, damaged: true, spikedTopLanding: true },
  },
  {
    name: 'purpleSpikedLowerHalfWhileFalling-isPlainDamage',
    enemy: { spriteType: 'slimePurple', hitPoints: 2, spiked: true },
    playerX: 90,
    playerY: 80,
    playerVy: 200,
    expected: { stomped: false, damaged: true, spikedTopLanding: false },
  },
  {
    name: 'purpleSpikedUpperHalfWhileRising-isPlainDamage',
    enemy: { spriteType: 'slimePurple', hitPoints: 2, spiked: true },
    playerX: 90,
    playerY: 40,
    playerVy: -200,
    expected: { stomped: false, damaged: true, spikedTopLanding: false },
  },
  {
    name: 'noOverlap-isNeitherStompNorDamage',
    enemy: {},
    playerX: 400,
    playerY: 60,
    playerVy: 200,
    expected: { stomped: false, damaged: false, spikedTopLanding: false },
  },
];

describe('enemy contact characterization', () => {
  for (const testCase of CONTACT_CASES) {
    it(testCase.name, () => {
      const enemy = makeEnemy(testCase.enemy);
      const player = makePlayer(testCase.playerX, testCase.playerY, testCase.playerVy);

      const stomped = checkEnemyStompCollisions(player, [enemy]).includes(enemy.id);
      const damaged = checkEnemySideCollisions(player, [enemy]).includes(enemy.id);

      expect({
        stomped,
        damaged,
        spikedTopLanding: isSpikedTopLanding(player, enemy),
      }).toEqual(testCase.expected);
    });
  }
});
