import { FRUIT_FRAME_SIZE, FRUIT_ICON_COUNT, fruitFrameSource } from './Fruit';

describe('fruitFrameSource', () => {
  it('indexZero-returnsTopLeftOfSheet', () => {
    expect(fruitFrameSource(0)).toEqual({ sx: 0, sy: 0 });
  });

  it('indexOne-returnsSecondColumn', () => {
    expect(fruitFrameSource(1)).toEqual({ sx: FRUIT_FRAME_SIZE, sy: 0 });
  });

  it('indexEqualToRowWidth-wrapsToSecondRow', () => {
    // fruit.png is a 4x4 grid (64x64 / 16px frames) — index 4 is the start
    // of row 2.
    const rowWidth = 4;
    expect(fruitFrameSource(rowWidth)).toEqual({ sx: 0, sy: FRUIT_FRAME_SIZE });
  });

  it('indexBeyondIconCount-wraps', () => {
    expect(fruitFrameSource(FRUIT_ICON_COUNT)).toEqual(fruitFrameSource(0));
  });
});
