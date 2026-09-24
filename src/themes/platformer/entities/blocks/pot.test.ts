import { createPotType } from './pot';
import type { PotTypeConfig } from './pot';
import { computePotRenderPlan } from './potRenderPlan';
import { coinPot } from './CoinPot';
import { BLOCK_TYPES } from './index';
import { toBlockState } from '../Block';
import type { BlockState } from '../Block';
import type { BlockPlacement } from '../../level/BlockMapper';
import { PHYSICS_CONFIG } from '../../contracts/PhysicsConfig';
import { STATIC_OBJECTS_SHEET } from '../sprites/sheets';
import { tileToPixel } from '../../level/Terrain';
import type { DrawContext } from '../../contracts/DrawContext';
import type { PotRenderPlan } from './potTypes';

function makeDc(overrides: Partial<DrawContext<PotRenderPlan>> = {}): DrawContext<PotRenderPlan> {
  return {
    ctx: { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D,
    sprites: { [STATIC_OBJECTS_SHEET.src]: {} as unknown as HTMLImageElement },
    originX: 0,
    originY: 0,
    worldElapsed: 0,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<PotTypeConfig> = {}): PotTypeConfig {
  return {
    key: 'testPot',
    sprite: { sheet: STATIC_OBJECTS_SHEET, renderScale: 1, animations: {} },
    drop: 'coin',
    dropPolicy: 'once',
    restoredOnRespawn: false,
    drawPot: vi.fn(),
    ...overrides,
  };
}

function potBlockAt(kind: string, col: number, row: number, id = `${kind}-${col}-${row}`): BlockState {
  const { x, y } = tileToPixel(col, row);
  return toBlockState({ id, blockKind: kind as BlockPlacement['blockKind'], x, y });
}

describe('createPotType — shared behavior', () => {
  it('anyKind-fixesOneHitTopTriggerAndRemoval', () => {
    const type = createPotType(makeConfig());
    expect(type.maxHits).toBe(1);
    expect(type.removeWhenUsedUp).toBe(true);
    expect(type.triggerSides).toEqual(['top']);
    expect(typeof type.onHit).toBe('function');
    expect(type.pot).toBeDefined();
  });

  it('anyKind-carriesItsOwnDropDropPolicyAndRespawnFlagOntoThePotDescriptor', () => {
    const type = createPotType(
      makeConfig({ drop: 'heart', dropPolicy: 'everyBreak', restoredOnRespawn: true }),
    );
    expect(type.pot).toMatchObject({
      drop: 'heart',
      dropPolicy: 'everyBreak',
      restoredOnRespawn: true,
    });
  });

  it('noFrameIndexGiven-defaultsToAFixedFallbackFrame', () => {
    const type = createPotType(makeConfig());
    expect(type.frameIndex(0)).toBe(type.frameIndex(1));
  });

  it('testOnlyKind-builtWithTheFactory-getsTheFullSharedContract', () => {
    // SC-005: a third kind declared with only its own facts gets the shared
    // trigger/removal/bounce and its own drop policy for free.
    const type = createPotType(
      makeConfig({ key: 'thirdKind', drop: 'key', dropPolicy: 'everyBreak', restoredOnRespawn: true }),
    );

    expect(type).toMatchObject({ maxHits: 1, removeWhenUsedUp: true, triggerSides: ['top'] });
    expect(type.pot).toMatchObject({
      drop: 'key',
      dropPolicy: 'everyBreak',
      restoredOnRespawn: true,
    });

    const block = potBlockAt('thirdKind', 0, 0);
    expect(type.onHit!({ ...block, hitsTaken: 1, rewardGiven: true })).toEqual({
      spawnPickup: 'key',
      bounceVelocity: PHYSICS_CONFIG.potBounceVelocity,
    });
  });
});

describe('createPotType — drop policy honors BlockState.rewardGiven', () => {
  it('onceKindWhileRewardNotGiven-dropsItsPickupWithTheSharedBounce', () => {
    const type = createPotType(makeConfig({ drop: 'coin', dropPolicy: 'once' }));
    const block = potBlockAt(type.key, 0, 0);

    const outcome = type.onHit!({ ...block, hitsTaken: 1, rewardGiven: false });

    expect(outcome).toEqual({
      spawnPickup: 'coin',
      bounceVelocity: PHYSICS_CONFIG.potBounceVelocity,
    });
  });

  it('onceKindAfterRewardGiven-doesNotDropButStillReturnsTheSharedBounce', () => {
    const type = createPotType(makeConfig({ drop: 'coin', dropPolicy: 'once' }));
    const block = potBlockAt(type.key, 0, 0);

    const outcome = type.onHit!({ ...block, hitsTaken: 1, rewardGiven: true });

    expect(outcome).toEqual({ bounceVelocity: PHYSICS_CONFIG.potBounceVelocity });
    expect(outcome.spawnPickup).toBeUndefined();
  });

  it('everyBreakKindAfterRewardGiven-stillDropsOnEveryDestruction', () => {
    const type = createPotType(makeConfig({ drop: 'heart', dropPolicy: 'everyBreak' }));
    const block = potBlockAt(type.key, 0, 0);

    const outcome = type.onHit!({ ...block, hitsTaken: 1, rewardGiven: true });

    expect(outcome).toEqual({
      spawnPickup: 'heart',
      bounceVelocity: PHYSICS_CONFIG.potBounceVelocity,
    });
  });
});

describe('drawPotBunch — owner draws the run, absent plan falls back', () => {
  it('noPlan-drawsItselfAloneThroughItsOwnKind', () => {
    const drawPot = vi.fn();
    const type = createPotType(makeConfig({ drawPot }));
    const block = potBlockAt(type.key, 5, 2);
    const dc = makeDc();

    type.draw(block, dc);

    expect(drawPot).toHaveBeenCalledTimes(1);
    expect(drawPot).toHaveBeenCalledWith(block, dc);
  });

  it('mixedRunFromTheOwner-drawsEveryMemberThroughItsOwnKindPlusEveryFiller', () => {
    const drawCoin = vi.fn();
    const drawPotion = vi.fn();
    const coinType = createPotType(makeConfig({ key: 'testCoin', drawPot: drawCoin }));
    const potionType = createPotType(
      makeConfig({ key: 'testPotion', drop: 'heart', dropPolicy: 'everyBreak', drawPot: drawPotion }),
    );
    const left = potBlockAt('testCoin', 5, 2);
    const right = potBlockAt('testPotion', 6, 2);
    const plan = computePotRenderPlan([left, right], {
      testCoin: coinType,
      testPotion: potionType,
    });
    const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    const dc = makeDc({ ctx, potPlan: plan });

    coinType.draw(left, dc);

    expect(drawCoin).toHaveBeenCalledWith(left, dc);
    expect(drawPotion).toHaveBeenCalledWith(right, dc);
    // One clay filler blit on the seam.
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('nonOwnerMember-drawsNothingBecauseTheOwnerAlreadyDid', () => {
    const drawCoin = vi.fn();
    const drawPotion = vi.fn();
    const coinType = createPotType(makeConfig({ key: 'testCoin', drawPot: drawCoin }));
    const potionType = createPotType(
      makeConfig({ key: 'testPotion', drop: 'heart', dropPolicy: 'everyBreak', drawPot: drawPotion }),
    );
    const left = potBlockAt('testCoin', 5, 2);
    const right = potBlockAt('testPotion', 6, 2);
    const plan = computePotRenderPlan([left, right], {
      testCoin: coinType,
      testPotion: potionType,
    });
    const dc = makeDc({ potPlan: plan });

    potionType.draw(right, dc);

    expect(drawCoin).not.toHaveBeenCalled();
    expect(drawPotion).not.toHaveBeenCalled();
  });

  it('realCoinPotOwner-drawsANeighbouringBottleThroughTheStoredKindWithNoKindBranch', () => {
    const drawBottle = vi.fn();
    const bottleType = createPotType(
      makeConfig({
        key: 'testBottle',
        drop: 'heart',
        dropPolicy: 'everyBreak',
        restoredOnRespawn: true,
        drawPot: drawBottle,
      }),
    );
    const coin = potBlockAt('coinPot', 5, 2);
    const bottle = potBlockAt('testBottle', 6, 2);
    const plan = computePotRenderPlan([coin, bottle], {
      ...BLOCK_TYPES,
      testBottle: bottleType,
    });
    const dc = makeDc({ potPlan: plan });

    coinPot.draw(coin, dc);

    expect(drawBottle).toHaveBeenCalledWith(bottle, dc);
  });
});
