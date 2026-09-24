import { computePotRenderPlan } from './potRenderPlan';
import { createPotType } from './pot';
import { BLOCK_TYPES } from './index';
import { toBlockState } from '../Block';
import type { BlockState } from '../Block';
import type { BlockPlacement } from '../../level/BlockMapper';
import { RENDERED_TILE_SIZE, tileToPixel } from '../../level/Terrain';
import { STATIC_OBJECTS_SHEET } from '../sprites/sheets';
import { PHYSICS_CONFIG } from '../../contracts/PhysicsConfig';

function blockAt(kind: string, col: number, row: number, id = `${kind}-${col}-${row}`): BlockState {
  const { x, y } = tileToPixel(col, row);
  return toBlockState({ id, blockKind: kind as BlockPlacement['blockKind'], x, y });
}

function coinPotAt(col: number, row: number, id?: string): BlockState {
  return blockAt('coinPot', col, row, id);
}

function potionPotAt(col: number, row: number, id?: string): BlockState {
  return blockAt('potionPot', col, row, id);
}

describe('computePotRenderPlan', () => {
  it('noPotBlocks-returnsEmptyPlan', () => {
    const plan = computePotRenderPlan([]);
    expect(plan.ownerBlockId.size).toBe(0);
    expect(plan.runsByOwnerId.size).toBe(0);
  });

  it('oneIsolatedPot-isItsOwnOwnerWithNoFillers', () => {
    const block = coinPotAt(5, 2);
    const plan = computePotRenderPlan([block]);
    expect(plan.ownerBlockId.get(block.id)).toBe(block.id);
    const run = plan.runsByOwnerId.get(block.id)!;
    expect(run.blocks.map((m) => m.block.id)).toEqual([block.id]);
    expect(run.fillers).toEqual([]);
  });

  it('twoAdjacentSameKindPots-shareOneRunWithOneCentredFiller', () => {
    const left = coinPotAt(5, 2);
    const right = coinPotAt(6, 2);
    const plan = computePotRenderPlan([left, right]);
    expect(plan.ownerBlockId.get(left.id)).toBe(left.id);
    expect(plan.ownerBlockId.get(right.id)).toBe(left.id);
    const run = plan.runsByOwnerId.get(left.id)!;
    expect(run.blocks.map((m) => m.block.id)).toEqual([left.id, right.id]);
    expect(run.fillers).toHaveLength(1);
    expect(run.fillers[0].x).toBe(left.x + RENDERED_TILE_SIZE / 2);
    expect(run.fillers[0].y).toBe(left.y);
  });

  it('mixedCoinAndPotionRun-mergesWithAFillerAtEverySeam', () => {
    const coin = coinPotAt(5, 2);
    const potion = potionPotAt(6, 2);
    const plan = computePotRenderPlan([coin, potion]);
    const run = plan.runsByOwnerId.get(coin.id)!;
    expect(run.blocks.map((m) => m.block.id)).toEqual([coin.id, potion.id]);
    expect(run.blocks.map((m) => m.kind.drop)).toEqual(['coin', 'heart']);
    expect(run.fillers).toHaveLength(1);
    expect(run.fillers[0].x).toBe(coin.x + RENDERED_TILE_SIZE / 2);
  });

  it('potsInDifferentRows-eachFormsItsOwnRun', () => {
    const a = coinPotAt(5, 2);
    const b = coinPotAt(5, 3);
    const plan = computePotRenderPlan([a, b]);
    expect(plan.ownerBlockId.get(a.id)).toBe(a.id);
    expect(plan.ownerBlockId.get(b.id)).toBe(b.id);
    expect(plan.runsByOwnerId.size).toBe(2);
  });

  it('potsWithAGapBetweenThem-eachFormsItsOwnRun', () => {
    const a = coinPotAt(5, 2);
    const c = coinPotAt(7, 2); // col 6 missing — not adjacent
    const plan = computePotRenderPlan([a, c]);
    expect(plan.ownerBlockId.get(a.id)).toBe(a.id);
    expect(plan.ownerBlockId.get(c.id)).toBe(c.id);
    expect(plan.runsByOwnerId.size).toBe(2);
  });

  it('aNonPotBlockBetweenPots-neverAppearsInThePlanAndEndsTheRun', () => {
    const left = coinPotAt(5, 2);
    const crate = blockAt('crate', 6, 2);
    const right = coinPotAt(7, 2);
    const plan = computePotRenderPlan([left, crate, right]);
    expect(plan.ownerBlockId.has(crate.id)).toBe(false);
    expect(plan.ownerBlockId.get(left.id)).toBe(left.id);
    expect(plan.ownerBlockId.get(right.id)).toBe(right.id);
  });

  it('aUsedUpPot-isExcludedImmediatelyAndIsolatesItsFormerNeighbours', () => {
    // A block becomes "used up" the instant its terminal hit lands
    // (isBlockUsedUp), well before its bump animation finishes and it is
    // actually removed from the world — the plan must stop counting it as a
    // live neighbour immediately (FR-010, SC-004).
    const left = coinPotAt(5, 2);
    const middleHit = { ...coinPotAt(6, 2), hitsTaken: 1 };
    const right = coinPotAt(7, 2);
    const plan = computePotRenderPlan([left, middleHit, right]);
    expect(plan.ownerBlockId.get(left.id)).toBe(left.id);
    expect(plan.ownerBlockId.get(right.id)).toBe(right.id);
    expect(plan.ownerBlockId.has(middleHit.id)).toBe(false);
    expect(plan.runsByOwnerId.get(left.id)!.fillers).toEqual([]);
  });

  it('aNonPotOnlyList-producesNoRuns', () => {
    const crate = blockAt('crate', 0, 0);
    const questionMark = blockAt('questionMark', 1, 0);
    const plan = computePotRenderPlan([crate, questionMark]);
    expect(plan.ownerBlockId.size).toBe(0);
    expect(plan.runsByOwnerId.size).toBe(0);
  });

  it('mixedOrderRow-coinPotionCoin-mergesIntoOneRunWithAFillerAtEachSeam', () => {
    const a = coinPotAt(5, 2);
    const b = potionPotAt(6, 2);
    const c = coinPotAt(7, 2);
    const plan = computePotRenderPlan([a, b, c]);
    const run = plan.runsByOwnerId.get(a.id)!;
    expect(run.blocks.map((m) => m.block.id)).toEqual([a.id, b.id, c.id]);
    expect(run.fillers).toHaveLength(2);
    expect(run.fillers[0].x).toBe(a.x + RENDERED_TILE_SIZE / 2);
    expect(run.fillers[1].x).toBe(b.x + RENDERED_TILE_SIZE / 2);
  });

  it('twoAdjacentBottles-mergeWithAFillerAndNeitherIsDropped', () => {
    const left = potionPotAt(5, 2);
    const right = potionPotAt(6, 2);
    const plan = computePotRenderPlan([left, right]);
    const run = plan.runsByOwnerId.get(left.id)!;
    expect(run.blocks.map((m) => m.block.id)).toEqual([left.id, right.id]);
    expect(run.blocks.every((m) => m.kind.drop === 'heart')).toBe(true);
    expect(run.fillers).toHaveLength(1);
    expect(plan.ownerBlockId.get(right.id)).toBe(left.id);
  });

  it('lonePot-rendersIsolatedWithNoFiller', () => {
    const only = potionPotAt(9, 4);
    const plan = computePotRenderPlan([only]);
    const run = plan.runsByOwnerId.get(only.id)!;
    expect(run.blocks.map((m) => m.block.id)).toEqual([only.id]);
    expect(run.fillers).toEqual([]);
  });
});

describe('computePotRenderPlan — test-only kind through the registry seam', () => {
  it('testOnlyKindRegisteredLocally-mergesIntoARunAndDropsItsPickupWithNoSharedEdit', () => {
    // SC-005: a kind built with the same factory, registered only in a local
    // registry (never the global BLOCK_TYPES), merges and breaks like the
    // built-in kinds.
    const testPot = createPotType({
      key: 'testPot',
      sprite: { sheet: STATIC_OBJECTS_SHEET, renderScale: 1, animations: {} },
      drop: 'coin',
      dropPolicy: 'once',
      restoredOnRespawn: false,
      drawPot: () => {},
    });
    const coin = coinPotAt(5, 2);
    const test = blockAt('testPot', 6, 2);

    const plan = computePotRenderPlan([coin, test], { ...BLOCK_TYPES, testPot });

    const run = plan.runsByOwnerId.get(coin.id)!;
    expect(run.blocks.map((m) => m.block.id)).toEqual([coin.id, test.id]);
    expect(run.fillers).toHaveLength(1);
    expect(testPot.onHit!({ ...test, hitsTaken: 1, rewardGiven: false })).toEqual({
      spawnPickup: 'coin',
      bounceVelocity: PHYSICS_CONFIG.potBounceVelocity,
    });
  });
});
