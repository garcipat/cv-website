import { describe, it, expect } from 'vitest';
import { BOMB_DAMAGE, resolveBlasts, type BlastWorld } from './BombSystem';
import type { BlastRequest } from '../entities/deployableItems/DeployableItemType';
import { toBlockState, isBlockUsedUp } from '../entities/Block';
import type { BlockState } from '../entities/Block';
import { toEnemyState } from '../entities/Enemy';
import type { EnemyState } from '../entities/Enemy';
import type { PlayerState } from '../entities/Player';
import { PLAYER_HIT_REACTION_SECONDS } from '../entities/Player';
import { RENDERED_TILE_SIZE, tileToPixel } from '../level/Terrain';
import type { LevelDef, TileType } from '../level/LevelData';
import { DEFAULT_HIT_KNOCKBACK } from '../shared/knockback';

function makeLevel(width = 10, height = 10): LevelDef {
  const row: TileType[] = Array.from({ length: width }, () => 'empty');
  return { terrain: Array.from({ length: height }, () => [...row]), width, height };
}

function makePlayer(col: number, row: number, overrides: Partial<PlayerState> = {}): PlayerState {
  const { x, y } = tileToPixel(col, row);
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
    prevFeetY: y + RENDERED_TILE_SIZE,
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

function blockAt(kind: string, col: number, row: number, id = `${kind}-${col}-${row}`): BlockState {
  const { x, y } = tileToPixel(col, row);
  return toBlockState({ id, blockKind: kind as BlockState['blockKind'], x, y });
}

function enemyAt(
  id: string,
  type: 'slimeGreen' | 'slimePurple',
  col: number,
  row: number,
): EnemyState {
  const { x, y } = tileToPixel(col, row);
  return toEnemyState({ id, type, fact: undefined, x, y });
}

function blastAt(col: number, row: number, tag = 'a'): BlastRequest {
  const { x, y } = tileToPixel(col, row);
  return { col, row, x, y, effectId: `explosion-${tag}`, hitEffectId: `hit-${tag}` };
}

function world(overrides: Partial<BlastWorld> = {}): BlastWorld {
  return {
    level: makeLevel(),
    player: makePlayer(4, 4),
    blocks: [],
    enemies: [],
    ...overrides,
  };
}

function apply(worldIn: BlastWorld, blasts: readonly BlastRequest[]) {
  return resolveBlasts(blasts, worldIn);
}

describe('resolveBlasts — area and blocks', () => {
  it('anInteriorBlast-excludesTheFourCornerTiles', () => {
    // The (±2, ±2) corners are cut; the edge midpoints are kept.
    const corner = blockAt('crate', 3, 3, 'corner');
    const edge = blockAt('crate', 5, 3, 'edge');

    const delta = apply(world({ blocks: [corner, edge] }), [blastAt(5, 5)]);

    expect(delta.terminalBlockIds).toEqual(['edge']);
    expect(delta.blocks.find((b) => b.id === 'edge')?.hitsTaken).toBe(2);
    expect(delta.blocks.find((b) => b.id === 'corner')).toBe(corner);
  });

  it('aCrateInTheBlast-isDrivenToTerminalAndReportedOnce', () => {
    const crate = blockAt('crate', 4, 4);

    const delta = apply(world({ blocks: [crate] }), [blastAt(4, 4)]);

    const destroyed = delta.blocks.find((b) => b.id === crate.id)!;
    expect(isBlockUsedUp(destroyed)).toBe(true);
    expect(delta.terminalBlockIds).toEqual([crate.id]);
  });

  it('aQuestionMarkInTheBlast-isUntouched', () => {
    const questionMark = blockAt('questionMark', 4, 4);

    const delta = apply(world({ blocks: [questionMark] }), [blastAt(4, 4)]);

    expect(delta.blocks[0]).toBe(questionMark);
    expect(delta.blocks[0].hitsTaken).toBe(0);
    expect(delta.terminalBlockIds).toEqual([]);
  });

  it('aUsedUpBlockInTheBlast-isInertAndNotReported', () => {
    const usedUp = { ...blockAt('fragileRock', 4, 4), hitsTaken: 1 };

    const delta = apply(world({ blocks: [usedUp] }), [blastAt(4, 4)]);

    expect(delta.blocks[0]).toBe(usedUp);
    expect(delta.terminalBlockIds).toEqual([]);
  });

  it('twoOverlappingBlasts-driveAnEnclosedBlockToTerminalExactlyOnce', () => {
    const crate = blockAt('crate', 4, 4);

    const delta = apply(world({ blocks: [crate] }), [blastAt(4, 4, 'a'), blastAt(4, 5, 'b')]);

    expect(delta.terminalBlockIds).toEqual([crate.id]);
  });
});

describe('resolveBlasts — enemies', () => {
  it('aGreenSlimeInTheBlast-losesItsHitPointsAndEntersTheReaction', () => {
    const slime = enemyAt('green', 'slimeGreen', 4, 4);

    const delta = apply(world({ enemies: [slime] }), [blastAt(4, 4)]);

    const hit = delta.enemies.find((e) => e.id === 'green')!;
    expect(hit.hitPoints).toBeLessThanOrEqual(0);
    expect(hit.animState).toBe('hit');
    expect(delta.damagedEnemyIds).toEqual(['green']);
  });

  it('aPurpleSlimeInTheBlast-losesOnlyBombDamageAndSurvivesWithSpikes', () => {
    const slime = enemyAt('purple', 'slimePurple', 4, 4);

    const delta = apply(world({ enemies: [slime] }), [blastAt(4, 4)]);

    const hit = delta.enemies.find((e) => e.id === 'purple')!;
    expect(hit.hitPoints).toBe(3 - BOMB_DAMAGE);
    expect(hit.alive).toBe(true);
    expect(delta.damagedEnemyIds).toEqual(['purple']);
  });

  it('anEnemyOutsideTheBlast-isReturnedByReference', () => {
    const faraway = enemyAt('far', 'slimeGreen', 0, 0);

    const delta = apply(world({ enemies: [faraway] }), [blastAt(9, 9)]);

    expect(delta.enemies[0]).toBe(faraway);
    expect(delta.damagedEnemyIds).toEqual([]);
  });
});

describe('resolveBlasts — the player', () => {
  it('aCharacterInTheBlast-takesOneFullHeartAndIsPushedAway', () => {
    const player = makePlayer(4, 4);

    const delta = apply(world({ player }), [blastAt(4, 4)]);

    const effects = delta.playerEffects ?? [];
    expect(effects).toContainEqual({ type: 'damage', amount: BOMB_DAMAGE });
    expect(effects).toContainEqual({ type: 'reaction' });
    expect(effects.some((effect) => effect.type === 'velocity')).toBe(true);
    expect(delta.playerSplatter).toBeDefined();
  });

  it('aCrouchedCharacterInTheBlast-takesDamageAndShowsTheHitButNoPush', () => {
    const player = makePlayer(4, 4, { crouching: true });

    const delta = apply(world({ player }), [blastAt(4, 4)]);

    const effects = delta.playerEffects ?? [];
    expect(effects).toContainEqual({ type: 'damage', amount: BOMB_DAMAGE });
    expect(effects.some((effect) => effect.type === 'velocity')).toBe(false);
  });

  it('aCharacterOutsideTheBlast-takesNoPlayerEffects', () => {
    const player = makePlayer(0, 0);

    const delta = apply(world({ player }), [blastAt(9, 9)]);

    expect(delta.playerEffects).toBeUndefined();
    expect(delta.playerSplatter).toBeUndefined();
  });

  it('aCharacterAlreadyInvulnerable-takesNoPlayerEffects', () => {
    const player = makePlayer(4, 4, { hitTimer: 0 });

    const delta = apply(world({ player }), [blastAt(4, 4)]);

    expect(delta.playerEffects).toBeUndefined();
  });

  it('aBlastThatKillsTheCharacter-spawnsNoSplatter', () => {
    const player = makePlayer(4, 4, { hitPoints: BOMB_DAMAGE });

    const delta = apply(world({ player }), [blastAt(4, 4)]);

    expect(delta.playerSplatter).toBeUndefined();
  });

  it('twoOverlappingBlasts-damageTheCharacterOnlyOnce', () => {
    const player = makePlayer(4, 4);

    const delta = apply(world({ player }), [blastAt(4, 4, 'a'), blastAt(4, 4, 'b')]);

    const damageMembers = (delta.playerEffects ?? []).filter((effect) => effect.type === 'damage');
    expect(damageMembers).toHaveLength(1);
  });
});

describe('resolveBlasts — explosions', () => {
  it('eachBlast-emitsExactlyOneExplosionCentredOnTheBlast', () => {
    const { x, y } = tileToPixel(2, 3);

    const delta = apply(world(), [blastAt(2, 3, 'a'), blastAt(7, 7, 'b')]);

    expect(delta.explosions).toEqual([
      { id: 'explosion-a', x: x + RENDERED_TILE_SIZE / 2, y: y + RENDERED_TILE_SIZE / 2 },
      {
        id: 'explosion-b',
        x: tileToPixel(7, 7).x + RENDERED_TILE_SIZE / 2,
        y: tileToPixel(7, 7).y + RENDERED_TILE_SIZE / 2,
      },
    ]);
  });

  it('noBlasts-returnAnEmptyDelta', () => {
    const delta = apply(world({ blocks: [blockAt('crate', 0, 0)] }), []);

    expect(delta).toEqual({
      blocks: [blockAt('crate', 0, 0)],
      terminalBlockIds: [],
      enemies: [],
      damagedEnemyIds: [],
      playerEffects: undefined,
      playerSplatter: undefined,
      explosions: [],
    });
  });
});

describe('resolveBlasts — immutability', () => {
  it('called-neverMutatesTheWorldInputs', () => {
    const crate = blockAt('crate', 4, 4);
    const slime = enemyAt('green', 'slimeGreen', 4, 4);
    const player = makePlayer(4, 4);
    const worldIn = world({ blocks: [crate], enemies: [slime], player });

    apply(worldIn, [blastAt(4, 4)]);

    expect(worldIn.blocks[0]).toBe(crate);
    expect(crate.hitsTaken).toBe(0);
    expect(worldIn.enemies[0]).toBe(slime);
    expect(slime.hitPoints).toBe(1);
    expect(player.hitPoints).toBe(6);
  });
});

describe('resolveBlasts — push direction', () => {
  it('aCharacterLeftOfTheCentre-isPushedLeftAwayFromIt', () => {
    const player = makePlayer(3, 4);

    const delta = apply(world({ player }), [blastAt(4, 4)]);

    expect(delta.playerEffects).toContainEqual({
      type: 'velocity',
      x: -DEFAULT_HIT_KNOCKBACK.vx,
      duration: DEFAULT_HIT_KNOCKBACK.duration,
    });
  });

  it('aCharacterRightOfTheCentre-isPushedRightAwayFromIt', () => {
    const player = makePlayer(5, 4);

    const delta = apply(world({ player }), [blastAt(4, 4)]);

    expect(delta.playerEffects).toContainEqual({
      type: 'velocity',
      x: DEFAULT_HIT_KNOCKBACK.vx,
      duration: DEFAULT_HIT_KNOCKBACK.duration,
    });
  });
});
