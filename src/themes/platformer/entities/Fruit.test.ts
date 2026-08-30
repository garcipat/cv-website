import { FRUIT_FRAME_SIZE, FRUIT_ICON_COUNT, fruitFrameSource } from './Fruit';

describe('fruitFrameSource', () => {
  it('indexZero-returnsFirstPriorityFruit', () => {
    expect(fruitFrameSource(0)).toEqual({ sx: 0, sy: 0 });
  });

  it('indicesWithinPriorityOrder-returnHandPickedFruitsFirst', () => {
    // Sheet positions 0, 2, 4, 10, 12 were hand-picked as the most
    // realistic-looking icons and take logical indices 0-4.
    expect(fruitFrameSource(1)).toEqual({ sx: 2 * FRUIT_FRAME_SIZE, sy: 0 });
    expect(fruitFrameSource(2)).toEqual({ sx: 0, sy: FRUIT_FRAME_SIZE });
    expect(fruitFrameSource(3)).toEqual({ sx: 2 * FRUIT_FRAME_SIZE, sy: 2 * FRUIT_FRAME_SIZE });
    expect(fruitFrameSource(4)).toEqual({ sx: 0, sy: 3 * FRUIT_FRAME_SIZE });
  });

  it('indicesBeyondPriorityOrder-returnRemainingFruitsInSheetOrder', () => {
    // The remaining sheet positions (1, 5, 6, 8, 9, 13, 14) follow as the
    // reserve pool, in their original left-to-right, top-to-bottom order.
    expect(fruitFrameSource(5)).toEqual({ sx: FRUIT_FRAME_SIZE, sy: 0 });
    expect(fruitFrameSource(6)).toEqual({ sx: FRUIT_FRAME_SIZE, sy: FRUIT_FRAME_SIZE });
    expect(fruitFrameSource(11)).toEqual({ sx: 2 * FRUIT_FRAME_SIZE, sy: 3 * FRUIT_FRAME_SIZE });
  });

  it('indexBeyondIconCount-wraps', () => {
    expect(fruitFrameSource(FRUIT_ICON_COUNT)).toEqual(fruitFrameSource(0));
  });
});
