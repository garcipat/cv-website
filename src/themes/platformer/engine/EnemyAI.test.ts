import { stepEnemyPatrol, stepEnemyHitReaction, HIT_REACTION_DURATION_SECONDS } from './EnemyAI';
import { toEnemyState } from '../entities/Enemy';
import type { EnemyState } from '../entities/Enemy';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { PHYSICS_CONFIG } from './PhysicsConfig';
import type { LevelDef, TileType } from '../level/LevelData';
import type { EnemyPlacement } from '../level/EnemyMapper';

/** Builds a one-row-tall-per-feature level: `groundRow` is solid everywhere
 *  except where noted, and `entityRow` (one tile above it) holds walls at the
 *  given columns and is otherwise empty — matching currentLevel's real convention
 *  of placing enemies/walls on the row above the ground they patrol on. */
function makeLevel(width: number, wallCols: number[], pitCols: number[]): LevelDef {
  const entityRow: TileType[] = Array.from({ length: width }, (_, c) =>
    wallCols.includes(c) ? 'wall' : 'empty',
  );
  const groundRow: TileType[] = Array.from({ length: width }, (_, c) =>
    pitCols.includes(c) ? 'empty' : 'groundRock',
  );
  return { terrain: [entityRow, groundRow], width, height: 2 };
}

function makeEnemyAt(col: number) {
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
    x: col * RENDERED_TILE_SIZE,
    y: 0, // entity row is row 0 in makeLevel's grid
  };
  return toEnemyState(placement);
}

function makeHitEnemy(hitPoints: number): EnemyState {
  return { ...makeEnemyAt(5), animState: 'hit', hitPoints, hitTimer: 0 };
}

const SPEED = PHYSICS_CONFIG.enemyPatrolSpeed;
const DT = 1 / 30;

describe('stepEnemyPatrol', () => {
  it('openFloorMovingRight-advancesXBySpeedTimesDtAndKeepsDirection', () => {
    const level = makeLevel(10, [], []);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = stepEnemyPatrol(enemy, level, DT, []);

    expect(next.x).toBeCloseTo(enemy.x + SPEED * DT);
    expect(next.direction).toBe('right');
    expect(next.vx).toBe(SPEED);
  });

  it('openFloorMovingLeft-advancesXNegativelyAndKeepsDirection', () => {
    const level = makeLevel(10, [], []);
    const enemy = { ...makeEnemyAt(5), direction: 'left' as const };

    const next = stepEnemyPatrol(enemy, level, DT, []);

    expect(next.x).toBeCloseTo(enemy.x - SPEED * DT);
    expect(next.direction).toBe('left');
    expect(next.vx).toBe(-SPEED);
  });

  it('wallAhead-movingRight-reversesAndClampsBeforeTheWall', () => {
    // Wall at col 7, enemy starting at col 5 moving right. dt=1s moves it
    // 60px (nextX=220) — far enough in one step that its leading edge (44px
    // ahead of the tile-anchor for a green slime: offsetX -8 + size 48 -
    // sidePadding 10) lands inside col 7 (wall), so the clamp/reversal is
    // exercised deterministically in a single call rather than relying on
    // many small frames adding up.
    const level = makeLevel(10, [7], []);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = stepEnemyPatrol(enemy, level, 1, []);

    expect(next.direction).toBe('left');
    expect(next.vx).toBe(-SPEED);
    // leadingCol(7)*TILE - offsetX(-8) - size(48) + sidePadding(10) = 224+8-48+10
    // = 194 — the sprite's actual VISIBLE (hitbox-padding-inset) right edge,
    // not its narrower tile-anchor nor its full (mostly transparent) render
    // frame, stops exactly at the wall (col 7's left boundary, x=224).
    expect(next.x).toBe(194);
  });

  it('wallAhead-movingLeft-reversesAndClampsBeforeTheWall', () => {
    // Wall at col 3, enemy starting at col 5 moving left. dt=1.1s moves it
    // 66px (nextX=94), landing the leading edge inside col 3 (wall).
    const level = makeLevel(10, [3], []);
    const enemy = { ...makeEnemyAt(5), direction: 'left' as const };

    const next = stepEnemyPatrol(enemy, level, 1.1, []);

    expect(next.direction).toBe('right');
    expect(next.vx).toBe(SPEED);
    // (leadingCol(3)+1)*TILE - offsetX(-8) - sidePadding(10) = 128+8-10 = 126
    // — the sprite's actual visible left edge stops at the wall (col 3's
    // right boundary, x=128).
    expect(next.x).toBe(126);
  });

  it('pitAheadMovingRight-noSolidGroundBelow-reversesAtTheEdgeInsteadOfFalling', () => {
    // Ground missing at col 7 (a pit, no wall tile at all) — same nextX=220
    // as the wall test above, but blocked by the ledge check instead.
    const level = makeLevel(10, [], [7]);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = stepEnemyPatrol(enemy, level, 1, []);

    expect(next.direction).toBe('left');
    expect(next.x).toBe(194);
  });

  it('pitAheadMovingLeft-noSolidGroundBelow-reversesAtTheEdge', () => {
    const level = makeLevel(10, [], [3]);
    const enemy = { ...makeEnemyAt(5), direction: 'left' as const };

    const next = stepEnemyPatrol(enemy, level, 1.1, []);

    expect(next.direction).toBe('right');
    expect(next.x).toBe(126);
  });

  it('wallOnLeftAndPitOnRight-patrolsBackAndForthWithoutEscaping', () => {
    // The user-requested "wall - enemy - pit" sandwich: wall at col 3, pit at
    // col 7, enemy starts at col 5. Bounds are the exact resting x values
    // from the two single-jump tests above (126 left, 194 right) — the
    // small-dt loop here approaches the same visible-edge-touches-wall
    // positions, just gradually instead of in one deterministic jump.
    const level = makeLevel(10, [3], [7]);
    let enemy: EnemyState = { ...makeEnemyAt(5), direction: 'right' };
    const minX = 126;
    const maxX = 194;

    for (let i = 0; i < 200; i++) {
      enemy = stepEnemyPatrol(enemy, level, DT, []);
      expect(enemy.x).toBeGreaterThanOrEqual(minX);
      expect(enemy.x).toBeLessThanOrEqual(maxX);
    }
  });

  it('pitAheadMovingRight-liveBlockFillsTheGap-continuesWalkingOntoIt', () => {
    // Ground missing at col 7 (a pit in the static terrain), but a live
    // block sits at (col 7, row 1) — the ground-ahead check should treat
    // that as solid ground and let the enemy keep walking rather than
    // reversing at the edge.
    const level = makeLevel(10, [], [7]);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = stepEnemyPatrol(enemy, level, 1, [{ col: 7, row: 1 }]);

    expect(next.direction).toBe('right');
    expect(next.x).toBeCloseTo(enemy.x + SPEED * 1);
  });

  it('blockDirectlyAhead-atEnemyRow-reversesLikeAWallTile', () => {
    // No static wall at col 7, but a live block occupies (col 7, row 0) —
    // the enemy's own patrol row — so the wall-ahead check should treat it
    // as solid and reverse, same as a static 'wall' tile would.
    const level = makeLevel(10, [], []);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = stepEnemyPatrol(enemy, level, 1, [{ col: 7, row: 0 }]);

    expect(next.direction).toBe('left');
    expect(next.vx).toBe(-SPEED);
    expect(next.x).toBe(194);
  });

  it('pitAheadMovingRight-blockedTilesDoNotCoverTheGap-stillReverses', () => {
    // Regression check: neither the static terrain nor blockedTiles provide
    // ground at col 7 — an unrelated block elsewhere must not affect the
    // outcome, and the pre-existing terrain-only reversal must still fire.
    const level = makeLevel(10, [], [7]);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = stepEnemyPatrol(enemy, level, 1, [{ col: 2, row: 1 }]);

    expect(next.direction).toBe('left');
    expect(next.x).toBe(194);
  });

  it('slimePurple-laneNarrowerThanItsOwnOverhangOnBothSides-standsStillInsteadOfFlipFlopping', () => {
    // Regression test: a render-scaled-up purple slime (sprite
    // renderScale 2) needs clearance on both sides before it may safely turn around —
    // scaling with its own visible-silhouette size, not a flat one-tile
    // assumption (see stepEnemyPatrol's own doc comment). Spawned here (col
    // 5) in a lane too narrow for that on BOTH sides at once — wall
    // immediately at col 4, pit immediately at col 6. Reported live:
    // without the stand-still fallback, this made the slime flip direction
    // every single call while barely moving — reading as violently
    // vibrating in place, never actually patrolling.
    const level = makeLevel(10, [4], [6]);
    const enemy: EnemyState = {
      id: 'e1',
      type: 'slimePurple',
      x: 5 * RENDERED_TILE_SIZE,
      y: 0,
      vx: 0,
      vy: 0,
      direction: 'right',
      animState: 'walk',
      animFrame: 0,
      animTimer: 0,
      hitPoints: 2,
      hitTimer: 0,
      spiked: false,
      spikeTimer: 0,
      alive: true,
      homeX: 5 * RENDERED_TILE_SIZE,
      homeY: 0,
      rewardGiven: false,
    };

    const first = stepEnemyPatrol(enemy, level, DT, []);
    expect(first.vx).toBe(0);

    // Stable, not just a one-off: re-running from the returned state must
    // keep reporting stuck (not flip direction, not start moving) — this is
    // what distinguishes "parked" from "flip-flops every OTHER call".
    const second = stepEnemyPatrol(first, level, DT, []);
    expect(second.vx).toBe(0);
    expect(second.x).toBe(first.x);
  });

  it('stepEnemyPatrol-slimePurple-movesSlowerThanGreen', () => {
    const level = makeLevel(10, [], []);
    const base = {
      id: 'e1',
      x: 3 * RENDERED_TILE_SIZE,
      y: 0,
      vx: 0,
      vy: 0,
      direction: 'right' as const,
      animState: 'walk' as const,
      animFrame: 0,
      animTimer: 0,
      hitPoints: 1,
      hitTimer: 0,
      spiked: false,
      spikeTimer: 0,
      alive: true,
      homeX: 3 * RENDERED_TILE_SIZE,
      homeY: 0,
      rewardGiven: false,
    };
    const green = stepEnemyPatrol({ ...base, type: 'slimeGreen' as const }, level, 1, []);
    const purple = stepEnemyPatrol({ ...base, type: 'slimePurple' as const }, level, 1, []);
    const greenDelta = green.x - base.x;
    const purpleDelta = purple.x - base.x;
    expect(purpleDelta).toBeCloseTo(greenDelta * 0.7, 5);
  });
});

describe('stepEnemyHitReaction', () => {
  it('walkState-isUnaffected-returnsSameReference', () => {
    const enemy = makeEnemyAt(5);
    const next = stepEnemyHitReaction(enemy, 1 / 30);
    expect(next).toBe(enemy);
  });

  it('midReaction-accumulatesHitTimerAndStaysInHitState', () => {
    const enemy = makeHitEnemy(0);
    const next = stepEnemyHitReaction(enemy, 0.1);
    expect(next.animState).toBe('hit');
    expect(next.hitTimer).toBeCloseTo(0.1);
    expect(next.alive).toBe(true);
  });

  it('reactionDurationElapsed-hitPointsRemaining-revertsToWalk', () => {
    const enemy = makeHitEnemy(1);
    const next = stepEnemyHitReaction(enemy, HIT_REACTION_DURATION_SECONDS);
    expect(next.animState).toBe('walk');
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
    expect(next.hitTimer).toBe(0);
    expect(next.alive).toBe(true);
  });

  it('reactionDurationElapsed-noHitPointsRemaining-flagsDefeated', () => {
    const enemy = makeHitEnemy(0);
    const next = stepEnemyHitReaction(enemy, HIT_REACTION_DURATION_SECONDS);
    expect(next.alive).toBe(false);
    expect(next.animState).toBe('hit'); // stays on its last frame until removed
  });

  it('reactionDuration-splitAcrossTwoTicks-stillCompletesCorrectly', () => {
    let enemy = makeHitEnemy(0);
    enemy = stepEnemyHitReaction(enemy, HIT_REACTION_DURATION_SECONDS / 2);
    expect(enemy.alive).toBe(true);
    enemy = stepEnemyHitReaction(enemy, HIT_REACTION_DURATION_SECONDS / 2);
    expect(enemy.alive).toBe(false);
  });

  it('reactionFinishedWithNoHitPoints-flagsNotAlive', () => {
    const enemy = makeHitEnemy(0);
    const stepped = stepEnemyHitReaction(enemy, HIT_REACTION_DURATION_SECONDS);
    expect(stepped.alive).toBe(false);
  });

  it('reactionFinishedWithHitPointsRemaining-staysAlive', () => {
    const enemy = makeHitEnemy(2);
    const stepped = stepEnemyHitReaction(enemy, HIT_REACTION_DURATION_SECONDS);
    expect(stepped.alive).toBe(true);
    expect(stepped.animState).toBe('walk');
  });
});
