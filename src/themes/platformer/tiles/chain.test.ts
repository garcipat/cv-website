import { describe, it, expect } from 'vitest';
import { chainRunPieces } from './chain';
import type { ChainAttachment } from '../level/Terrain';

const ATTACHMENTS: readonly ChainAttachment[] = ['ceiling', 'left', 'right', 'floating'];

describe('chainRunPieces', () => {
  it.each(ATTACHMENTS)('%s-runLength1-isJustThatAttachmentsCap', (attachment) => {
    const pieces = chainRunPieces(attachment, 1);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].height).toBeGreaterThan(0);
    expect(pieces[0].width).toBeGreaterThan(0);
  });

  it('ceilingRunLength4-continuesThenOneMiddleThenBottom', () => {
    // continues(16) + middle(18) + bottom(15) = 49 <= 4*16=64;
    // a second middle would make 67 > 64, so exactly one middle fits.
    const pieces = chainRunPieces('ceiling', 4);
    expect(pieces).toHaveLength(3);
    expect(pieces[0]).toEqual({ sx: 91, sy: 120, width: 5, height: 16 });
    expect(pieces[1]).toEqual({ sx: 128, sy: 118, width: 5, height: 18 });
    expect(pieces[2]).toEqual({ sx: 137, sy: 118, width: 5, height: 15 });
  });

  it('leftRunLength2-continuesThenBottomWithNoMiddle', () => {
    // continues(15) + middle(18) + bottom(15) = 48 > 2*16=32, so no middle fits.
    const pieces = chainRunPieces('left', 2);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toEqual({ sx: 99, sy: 121, width: 7, height: 15 });
    expect(pieces[1]).toEqual({ sx: 137, sy: 118, width: 5, height: 15 });
  });

  it('rightRunLength3-fitsExactlyOneMiddle', () => {
    // continues(15) + middle(18) + bottom(15) = 48 == 3*16=48 exactly.
    const pieces = chainRunPieces('right', 3);
    expect(pieces).toHaveLength(3);
    expect(pieces[0]).toEqual({ sx: 110, sy: 121, width: 7, height: 15 });
    expect(pieces[1]).toEqual({ sx: 128, sy: 118, width: 5, height: 18 });
    expect(pieces[2]).toEqual({ sx: 137, sy: 118, width: 5, height: 15 });
  });

  it('floatingRunLength1-isTheFloatingCap', () => {
    expect(chainRunPieces('floating', 1)).toEqual([{ sx: 119, sy: 102, width: 5, height: 12 }]);
  });

  it('leftAndRight-are7pxWide-widerThanCeilingAndFloating', () => {
    // The extra 2px is the connector bar baked into the hook art itself.
    expect(chainRunPieces('left', 1)[0].width).toBe(7);
    expect(chainRunPieces('right', 1)[0].width).toBe(7);
    expect(chainRunPieces('ceiling', 1)[0].width).toBe(5);
    expect(chainRunPieces('floating', 1)[0].width).toBe(5);
  });
});
