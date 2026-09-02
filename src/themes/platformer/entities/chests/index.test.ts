import { CHEST_TYPE } from './index';
import { CHEST_CLOSED_SHEET, CHEST_OPEN_SHEET } from '../sprites/sheets';

describe('CHEST_TYPE', () => {
  it('closedAndOpen-pointAtTheirOwnSheets', () => {
    expect(CHEST_TYPE.closed.sheet).toBe(CHEST_CLOSED_SHEET);
    expect(CHEST_TYPE.open.sheet).toBe(CHEST_OPEN_SHEET);
  });

  it('theTwoStates-haveDifferentNativeWidths', () => {
    // A chest's open and closed art are different sizes, which is why each is
    // its own sheet with its own centering offset.
    expect(CHEST_TYPE.closed.sheet.frameWidth).not.toBe(CHEST_TYPE.open.sheet.frameWidth);
  });
});
