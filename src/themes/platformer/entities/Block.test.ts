import {
  blockFrameSource,
  BLOCK_FRAME_SIZE,
  BLOCK_RENDERED_SIZE,
  toBlockState,
  maxHitsForBlock,
  isBlockUsedUp,
  isBlockRemoved,
  applyBlockHit,
  blockEffectAnchor,
} from './Block';
import { TILE_SIZE, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { BlockPlacement } from '../level/BlockMapper';

function placement(blockKind: BlockPlacement['blockKind']): BlockPlacement {
  return { id: `${blockKind}-1`, blockKind, x: 0, y: 0 };
}

describe('blockFrameSource', () => {
  it('crate-returnsWorldTilesetCrateTileCoords', () => {
    expect(blockFrameSource('crate')).toEqual({ sx: 112, sy: 48 });
  });

  it('questionMark-returnsWorldTilesetBrownQuestionMarkTileCoords', () => {
    expect(blockFrameSource('questionMark')).toEqual({ sx: 0, sy: 32 });
  });

  it('fragileRock-returnsWorldTilesetPlainRockTileCoords', () => {
    expect(blockFrameSource('fragileRock')).toEqual({ sx: 48, sy: 0 });
  });
});

describe('BLOCK_FRAME_SIZE and BLOCK_RENDERED_SIZE', () => {
  it('matchTerrainTileSizing', () => {
    // Blocks are drawn from the same tileset image as terrain, at the same
    // native/rendered tile size — no separate sprite dimensions needed.
    expect(BLOCK_FRAME_SIZE).toBe(TILE_SIZE);
    expect(BLOCK_RENDERED_SIZE).toBe(RENDERED_TILE_SIZE);
  });
});

describe('blockFrameSource with hitsTaken', () => {
  it('questionMark-hitsTakenZero-returnsIntactQuestionMarkTile', () => {
    expect(blockFrameSource('questionMark', 0)).toEqual({ sx: 0, sy: 32 });
  });

  it('questionMark-hitsTakenAtLeastOne-returnsPlainGroundRockTerrainTile', () => {
    // A used-up question-mark blends into ordinary ground terrain instead of
    // showing a distinct `!` indicator — same coordinates Renderer.ts's
    // tileSource uses for exposed groundRock.
    expect(blockFrameSource('questionMark', 1)).toEqual({ sx: 16, sy: 0 });
  });

  it('crate-anyHitsTaken-alwaysReturnsSameCrateTile', () => {
    expect(blockFrameSource('crate', 0)).toEqual({ sx: 112, sy: 48 });
    expect(blockFrameSource('crate', 1)).toEqual({ sx: 112, sy: 48 });
    expect(blockFrameSource('crate', 2)).toEqual({ sx: 112, sy: 48 });
  });

  it('fragileRock-anyHitsTaken-alwaysReturnsSameRockTile', () => {
    expect(blockFrameSource('fragileRock', 0)).toEqual({ sx: 48, sy: 0 });
    expect(blockFrameSource('fragileRock', 1)).toEqual({ sx: 48, sy: 0 });
  });

  it('noHitsTakenArgument-defaultsToZero', () => {
    expect(blockFrameSource('questionMark')).toEqual({ sx: 0, sy: 32 });
  });
});

describe('maxHitsForBlock', () => {
  it('crate-returnsTwo', () => expect(maxHitsForBlock('crate')).toBe(2));
  it('questionMark-returnsOne', () => expect(maxHitsForBlock('questionMark')).toBe(1));
  it('fragileRock-returnsOne', () => expect(maxHitsForBlock('fragileRock')).toBe(1));
});

describe('toBlockState', () => {
  it('freshPlacement-startsAtZeroHitsAndIdleAnimState', () => {
    const state = toBlockState(placement('crate'));
    expect(state.hitsTaken).toBe(0);
    expect(state.animState).toBe('idle');
    expect(state.animTimer).toBe(0);
    expect(state.blockKind).toBe('crate');
  });
});

describe('isBlockUsedUp', () => {
  it('crateBelowMaxHits-returnsFalse', () => {
    expect(isBlockUsedUp({ ...toBlockState(placement('crate')), hitsTaken: 1 })).toBe(false);
  });
  it('crateAtMaxHits-returnsTrue', () => {
    expect(isBlockUsedUp({ ...toBlockState(placement('crate')), hitsTaken: 2 })).toBe(true);
  });
  it('fragileRockAtMaxHits-returnsTrue', () => {
    expect(isBlockUsedUp({ ...toBlockState(placement('fragileRock')), hitsTaken: 1 })).toBe(true);
  });
});

describe('isBlockRemoved', () => {
  it('questionMarkAtMaxHitsIdleAnimState-neverRemoved', () => {
    const used = { ...toBlockState(placement('questionMark')), hitsTaken: 1, animState: 'idle' as const };
    expect(isBlockRemoved(used)).toBe(false);
  });
  it('fragileRockAtMaxHitsButStillBumping-notYetRemoved', () => {
    const bumping = { ...toBlockState(placement('fragileRock')), hitsTaken: 1, animState: 'bump' as const };
    expect(isBlockRemoved(bumping)).toBe(false);
  });
  it('fragileRockAtMaxHitsAnimStateIdle-isRemoved', () => {
    const done = { ...toBlockState(placement('fragileRock')), hitsTaken: 1, animState: 'idle' as const };
    expect(isBlockRemoved(done)).toBe(true);
  });
  it('crateAtMaxHitsStillShattering-notYetRemoved', () => {
    const shattering = { ...toBlockState(placement('crate')), hitsTaken: 2, animState: 'shatter' as const };
    expect(isBlockRemoved(shattering)).toBe(false);
  });
  it('crateAtMaxHitsShatterFinished-isRemoved', () => {
    const done = { ...toBlockState(placement('crate')), hitsTaken: 2, animState: 'idle' as const };
    expect(isBlockRemoved(done)).toBe(true);
  });
  it('crateBelowMaxHits-neverRemovedRegardlessOfAnimState', () => {
    const cracked = { ...toBlockState(placement('crate')), hitsTaken: 1, animState: 'idle' as const };
    expect(isBlockRemoved(cracked)).toBe(false);
  });
});

describe('applyBlockHit', () => {
  it('freshBlock-incrementsHitsTakenAndEntersBumpFromFrameZero', () => {
    const hit = applyBlockHit(toBlockState(placement('crate')));
    expect(hit.hitsTaken).toBe(1);
    expect(hit.animState).toBe('bump');
    expect(hit.animTimer).toBe(0);
  });
  it('alreadyUsedUpBlock-isANoOp', () => {
    const usedUp = { ...toBlockState(placement('fragileRock')), hitsTaken: 1, animState: 'idle' as const };
    expect(applyBlockHit(usedUp)).toBe(usedUp);
  });
});

describe('blockEffectAnchor', () => {
  it('anyBlock-centersOnItsOwnTile-notTopLeftCorner', () => {
    const block = toBlockState({ id: 'rock-1', blockKind: 'fragileRock', x: 320, y: 96 });
    const anchor = blockEffectAnchor(block);
    expect(anchor.x).toBe(320 + BLOCK_RENDERED_SIZE / 2);
    expect(anchor.y).toBe(96 + BLOCK_RENDERED_SIZE / 2);
  });

  it('anyBlock-scaleIsAlways1-blocksAreAllOneTileSize', () => {
    const block = toBlockState({ id: 'crate-1', blockKind: 'crate', x: 0, y: 0 });
    expect(blockEffectAnchor(block).scale).toBe(1);
  });
});
