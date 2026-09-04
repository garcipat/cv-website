import { computeCoinPotRenderPlan, permutationForColumn } from './coinPotRenderPlan';
import { toBlockState } from '../Block';
import type { BlockPlacement } from '../../level/BlockMapper';
import { RENDERED_TILE_SIZE, tileToPixel } from '../../level/Terrain';

function coinPotAt(col: number, row: number, id = `cp-${col}-${row}`) {
  const { x, y } = tileToPixel(col, row);
  const placement: BlockPlacement = { id, blockKind: 'coinPot', x, y };
  return toBlockState(placement);
}

describe('permutationForColumn', () => {
  it('anyColumn-returnsAPermutationOfZeroOneTwo', () => {
    for (let col = 0; col < 30; col++) {
      const perm = [...permutationForColumn(col)].sort();
      expect(perm).toEqual([0, 1, 2]);
    }
  });

  it('sameColumn-returnsTheSamePermutationEveryCall', () => {
    expect(permutationForColumn(7)).toEqual(permutationForColumn(7));
  });
});

describe('computeCoinPotRenderPlan', () => {
  it('noCoinPotBlocks-returnsEmptyPlan', () => {
    const plan = computeCoinPotRenderPlan([]);
    expect(plan.variantByBlockId.size).toBe(0);
    expect(plan.runsByOwnerId.size).toBe(0);
  });

  it('oneIsolatedTile-isItsOwnOwnerWithNoFillers', () => {
    const block = coinPotAt(5, 2);
    const plan = computeCoinPotRenderPlan([block]);
    expect(plan.ownerBlockId.get(block.id)).toBe(block.id);
    const run = plan.runsByOwnerId.get(block.id)!;
    expect(run.blocks).toEqual([block]);
    expect(run.fillers).toEqual([]);
  });

  it('twoAdjacentTiles-shareOneRunWithOneFillerBetweenThem', () => {
    const left = coinPotAt(5, 2);
    const right = coinPotAt(6, 2);
    const plan = computeCoinPotRenderPlan([left, right]);
    expect(plan.ownerBlockId.get(left.id)).toBe(left.id);
    expect(plan.ownerBlockId.get(right.id)).toBe(left.id);
    const run = plan.runsByOwnerId.get(left.id)!;
    expect(run.blocks.map((b) => b.id)).toEqual([left.id, right.id]);
    expect(run.fillers).toHaveLength(1);
    expect(run.fillers[0].x).toBe(left.x + RENDERED_TILE_SIZE / 2);
    expect(run.fillers[0].y).toBe(left.y);
  });

  it('twoAdjacentTiles-useAllThreeVariantsExactlyOnceAcrossBaseFillerBase', () => {
    const left = coinPotAt(5, 2);
    const right = coinPotAt(6, 2);
    const plan = computeCoinPotRenderPlan([left, right]);
    const run = plan.runsByOwnerId.get(left.id)!;
    const sequence = [
      plan.variantByBlockId.get(left.id),
      run.fillers[0].variantIndex,
      plan.variantByBlockId.get(right.id),
    ];
    expect([...sequence].sort()).toEqual([0, 1, 2]);
  });

  it('threeAdjacentTiles-noTwoConsecutiveRenderedPotsShareAVariant', () => {
    const a = coinPotAt(5, 2);
    const b = coinPotAt(6, 2);
    const c = coinPotAt(7, 2);
    const plan = computeCoinPotRenderPlan([a, b, c]);
    const run = plan.runsByOwnerId.get(a.id)!;
    const sequence = [
      plan.variantByBlockId.get(a.id)!,
      run.fillers[0].variantIndex,
      plan.variantByBlockId.get(b.id)!,
      run.fillers[1].variantIndex,
      plan.variantByBlockId.get(c.id)!,
    ];
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i]).not.toBe(sequence[i - 1]);
    }
  });

  it('twoTilesInDifferentRows-eachFormsItsOwnIsolatedRun', () => {
    const a = coinPotAt(5, 2);
    const b = coinPotAt(5, 3);
    const plan = computeCoinPotRenderPlan([a, b]);
    expect(plan.ownerBlockId.get(a.id)).toBe(a.id);
    expect(plan.ownerBlockId.get(b.id)).toBe(b.id);
    expect(plan.runsByOwnerId.size).toBe(2);
  });

  it('twoTilesWithAGapBetweenThem-eachFormsItsOwnIsolatedRun', () => {
    const a = coinPotAt(5, 2);
    const c = coinPotAt(7, 2); // col 6 missing — not adjacent
    const plan = computeCoinPotRenderPlan([a, c]);
    expect(plan.ownerBlockId.get(a.id)).toBe(a.id);
    expect(plan.ownerBlockId.get(c.id)).toBe(c.id);
    expect(plan.runsByOwnerId.size).toBe(2);
  });

  it('aUsedUpCoinPot-isExcludedFromEveryRunEvenBeforeRemoval', () => {
    // A block becomes "used up" the instant its terminal hit lands
    // (isBlockUsedUp), well before its bump animation finishes and
    // PlatformerPage.tsx actually removes it from the world — the plan
    // must stop counting it as a live neighbor immediately, so destroying
    // the middle of a 3-run leaves its former neighbors isolated on the
    // very next frame.
    const left = coinPotAt(5, 2);
    const middleHit = { ...coinPotAt(6, 2), hitsTaken: 1 };
    const right = coinPotAt(7, 2);
    const plan = computeCoinPotRenderPlan([left, middleHit, right]);
    expect(plan.ownerBlockId.get(left.id)).toBe(left.id);
    expect(plan.ownerBlockId.get(right.id)).toBe(right.id);
    expect(plan.variantByBlockId.has(middleHit.id)).toBe(false);
    expect(plan.runsByOwnerId.get(left.id)!.fillers).toEqual([]);
  });

  it('nonCoinPotBlocks-areIgnoredEntirely', () => {
    const crate = toBlockState({ id: 'x1', blockKind: 'crate', x: 0, y: 0 });
    const plan = computeCoinPotRenderPlan([crate]);
    expect(plan.variantByBlockId.size).toBe(0);
  });
});
