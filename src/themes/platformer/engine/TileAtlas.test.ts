import { describe, it, expect } from 'vitest';
import {
  ATLAS_STRIDE,
  atlasCell,
  type QuarterTurns,
  type TileAtlasEntry,
} from './TileAtlas';

describe('ATLAS_STRIDE', () => {
  it('value-isTheSixteenPixelTilePlusThreePixelGutter', () => {
    expect(ATLAS_STRIDE).toBe(19);
  });
});

describe('atlasCell', () => {
  it('origin-returnsTheAtlasOrigin', () => {
    expect(atlasCell(0, 0)).toEqual({ sx: 0, sy: 0 });
  });

  it('columnAndRow-multiplyByTheUniformStride', () => {
    expect(atlasCell(3, 2)).toEqual({ sx: 3 * ATLAS_STRIDE, sy: 2 * ATLAS_STRIDE });
  });

  it('anyCell-isByteEqualToTheFormerGroundAtlasCell', () => {
    for (const [col, row] of [
      [0, 0],
      [1, 2],
      [6, 1],
    ] as const) {
      const legacy = { sx: col * 19, sy: row * 19 };
      expect(atlasCell(col, row)).toEqual(legacy);
    }
  });
});

describe('TileAtlasEntry', () => {
  it('sampleEntry-carriesSourceRectAndQuarterTurns', () => {
    const entry: TileAtlasEntry = { ...atlasCell(1, 1), rotation: 2 };
    expect(entry).toEqual({ sx: ATLAS_STRIDE, sy: ATLAS_STRIDE, rotation: 2 });
  });

  it('quarterTurns-coverTheFourClockwiseTurns', () => {
    const turns: QuarterTurns[] = [0, 1, 2, 3];
    expect(turns).toHaveLength(4);
  });
});
