import { describe, it, expect } from 'vitest';
import { crystalClusterEntry } from './crystalCluster';

// decorations.png is hand-spaced, not a uniform 16px grid — each entry carries
// its own width/height, so tests below check against those rather than assuming
// every crop is TILE_SIZE square or grid-aligned.
const DECORATIONS_SHEET_WIDTH = 67;
const DECORATIONS_SHEET_HEIGHT = 35;
const TILE_SIZE = 16;

describe('crystalClusterEntry', () => {
  it('resolvesToARectInsideTheDecorationsSheet', () => {
    const entry = crystalClusterEntry(0, 0);
    expect(entry.sx + (entry.width ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_WIDTH);
    expect(entry.sy + (entry.height ?? TILE_SIZE)).toBeLessThanOrEqual(DECORATIONS_SHEET_HEIGHT);
  });

  it('ignoresPositionAndAlwaysReturnsTheSameEntry', () => {
    expect(crystalClusterEntry(1, 1)).toEqual(crystalClusterEntry(9, 9));
  });
});
