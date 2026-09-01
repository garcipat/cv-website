import { frameSource } from '../sprites/SpriteSheet';
import { COIN_SHEET, FRUIT_SHEET } from '../sprites/sheets';
import { coinFrameSource, COIN_FRAME_COUNT } from '../Coin';
import { fruitFrameSource, FRUIT_ICON_COUNT } from '../Fruit';

describe('COIN_SHEET', () => {
  it('everyFrameIndex-matchesCoinFrameSource', () => {
    for (let i = 0; i < COIN_FRAME_COUNT; i++) {
      expect(frameSource(COIN_SHEET, i)).toEqual(coinFrameSource(i));
    }
  });
});

describe('FRUIT_SHEET', () => {
  // fruit.png is physically four 16px columns wide, but only its first THREE
  // hold icons and fruitFrameSource addresses them with a stride of 3. The
  // sheet's `columns` is that addressing stride, not the image width —
  // declaring 4 would shift every icon past index 2 onto the wrong row.
  it('columns-isTheAddressingStrideNotTheImageWidth', () => {
    expect(FRUIT_SHEET.columns).toBe(3);
  });

  it('everyPackedIndex-matchesFruitFrameSourceForItsLogicalIndex', () => {
    // fruitFrameSource takes a LOGICAL index and maps it through
    // FRUIT_ICON_ORDER to a packed position; frameSource addresses the packed
    // position directly. Comparing them proves the sheet reproduces the same
    // source rects, one packed slot at a time.
    for (let logical = 0; logical < FRUIT_ICON_COUNT; logical++) {
      const expected = fruitFrameSource(logical);
      const matches = Array.from({ length: FRUIT_ICON_COUNT }, (_, packed) =>
        frameSource(FRUIT_SHEET, packed),
      ).some((rect) => rect.sx === expected.sx && rect.sy === expected.sy);
      expect(matches).toBe(true);
    }
  });

  it('packedIndexThree-wrapsToTheSecondRow', () => {
    // The specific case a columns:4 sheet would get wrong.
    expect(frameSource(FRUIT_SHEET, 3)).toEqual({ sx: 0, sy: 16 });
  });
});
