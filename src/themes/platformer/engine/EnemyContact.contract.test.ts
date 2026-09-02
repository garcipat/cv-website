import { resolveEnemyContacts } from './Collision';
import type { EnemyState } from '../entities/Enemy';
import { ENEMY_TYPES } from '../entities/enemies';
import type { SlimePurpleState } from '../entities/enemies/SlimePurple';
import type { EnemyPlacement } from '../level/EnemyMapper';
import type { PlayerState } from '../entities/Player';

/**
 * Characterization of enemy/player contact as it behaves today, expressed in
 * terms of OUTCOMES (stomped / damaged / bounced off spikes) rather than the
 * names of the functions that produce them, so a behavior drift in
 * `resolveEnemyContacts` or in any enemy type's `onPlayerCollide` fails here
 * rather than silently landing.
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
    direction: 'right',
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

/** A type-guard, not a cast: it lets TypeScript actually narrow `overrides`
 *  to `Partial<SlimePurpleState>` in the branch below, rather than merely
 *  asserting it. */
function isPurpleOverride(overrides: Partial<EnemyState>): overrides is Partial<SlimePurpleState> {
  return overrides.type === 'slimePurple';
}

/**
 * Builds a fresh enemy via its own type module's `create` (rather than a
 * hand-written literal), so the base shape is always exactly what that type
 * declares — a green enemy never gets a `spiked` field, a purple one always
 * does — before `overrides` (e.g. `{ type: 'slimePurple', spiked: true }`)
 * is applied on top. Branching on `isPurpleOverride(overrides)` (rather than
 * computing a single shared `type` variable up front) is what lets
 * TypeScript narrow `overrides` itself to the matching type's own
 * `Partial<...>` in each branch, so the merged result is provably one
 * concrete enemy type — never a green base carrying a leftover `spiked`
 * override, nor a purple base missing the `spiked` field it requires.
 */
function makeEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  if (isPurpleOverride(overrides)) {
    const placement: EnemyPlacement = { id: 'enemy-under-test', type: 'slimePurple', x: 100, y: 100 };
    return { ...ENEMY_TYPES.slimePurple.create(placement, 0), ...overrides };
  }
  const placement: EnemyPlacement = { id: 'enemy-under-test', type: 'slimeGreen', x: 100, y: 100 };
  return { ...ENEMY_TYPES.slimeGreen.create(placement, 0), ...overrides };
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
    enemy: { type: 'slimePurple', hitPoints: 3 },
    playerX: 90,
    playerY: 40,
    playerVy: 200,
    expected: { stomped: true, damaged: false, spikedTopLanding: false },
  },
  {
    name: 'purpleSpikedUpperHalfWhileFalling-isDamageWithUpwardKnockback',
    enemy: { type: 'slimePurple', hitPoints: 2, spiked: true },
    playerX: 90,
    playerY: 40,
    playerVy: 200,
    expected: { stomped: false, damaged: true, spikedTopLanding: true },
  },
  {
    name: 'purpleSpikedLowerHalfWhileFalling-isPlainDamage',
    enemy: { type: 'slimePurple', hitPoints: 2, spiked: true },
    playerX: 90,
    playerY: 80,
    playerVy: 200,
    expected: { stomped: false, damaged: true, spikedTopLanding: false },
  },
  {
    name: 'purpleSpikedUpperHalfWhileRising-isPlainDamage',
    enemy: { type: 'slimePurple', hitPoints: 2, spiked: true },
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

      const resolved = resolveEnemyContacts(player, [enemy]);
      const after = resolved.enemies[0];

      expect({
        stomped: after.hitPoints < enemy.hitPoints,
        damaged: resolved.damagePlayer > 0,
        spikedTopLanding: resolved.knockback === 'awayAndUp',
      }).toEqual(testCase.expected);
    });
  }
});
