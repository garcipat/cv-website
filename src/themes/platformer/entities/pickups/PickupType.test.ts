import { frameSource } from '../sprites/SpriteSheet';
import { COIN_SHEET, FRUIT_SHEET } from '../sprites/sheets';
import { coinFrameSource, COIN_FRAME_COUNT } from '../Coin';
import { fruitFrameSource, FRUIT_ICON_COUNT, FRUIT_ICON_COLUMNS, FRUIT_ICON_ORDER } from '../Fruit';

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
    expect(FRUIT_SHEET.columns).toBe(FRUIT_ICON_COLUMNS);
  });

  it('everyLogicalIndex-matchesFruitFrameSourceAtItsPackedPosition', () => {
    // fruitFrameSource takes a LOGICAL index and maps it through
    // FRUIT_ICON_ORDER to a packed position; frameSource addresses the packed
    // position directly. Asserting rect equality at the corresponding packed
    // index (rather than membership anywhere in the set) proves the mapping
    // itself lines up, not just that the two sides produce the same rects in
    // some order.
    for (let logical = 0; logical < FRUIT_ICON_COUNT; logical++) {
      expect(frameSource(FRUIT_SHEET, FRUIT_ICON_ORDER[logical])).toEqual(
        fruitFrameSource(logical),
      );
    }
  });

  it('packedIndexThree-wrapsToTheSecondRow', () => {
    // The specific case a columns:4 sheet would get wrong.
    expect(frameSource(FRUIT_SHEET, 3)).toEqual({ sx: 0, sy: 16 });
  });
});
