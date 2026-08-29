import { blockFrameSource, BLOCK_FRAME_SIZE, BLOCK_RENDERED_SIZE } from './Block';
import { TILE_SIZE, RENDERED_TILE_SIZE } from '../level/Terrain';

describe('blockFrameSource', () => {
  it('crate-returnsWorldTilesetCrateTileCoords', () => {
    expect(blockFrameSource('crate')).toEqual({ sx: 112, sy: 48 });
  });

  it('questionMark-returnsWorldTilesetBrownQuestionMarkTileCoords', () => {
    expect(blockFrameSource('questionMark')).toEqual({ sx: 0, sy: 32 });
  });

  it('rock-returnsWorldTilesetPlainRockTileCoords', () => {
    expect(blockFrameSource('rock')).toEqual({ sx: 48, sy: 0 });
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
