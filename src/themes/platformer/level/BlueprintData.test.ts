import { describe, it, expect } from 'vitest';
import { BLANK_BLUEPRINT, isBlueprint } from './BlueprintData';

describe('BLANK_BLUEPRINT', () => {
  it('theBlankEntry-isASingleEmptyCellNamedNew', () => {
    expect(BLANK_BLUEPRINT).toEqual({ id: 'new', name: 'new', layout: ['.'] });
  });
});

describe('isBlueprint', () => {
  it('minimalWellFormedBlueprint-isAccepted', () => {
    expect(isBlueprint({ id: 'room', name: 'Room', layout: ['#'] })).toBe(true);
  });

  it('blueprintWithABackgroundList-isAccepted', () => {
    expect(
      isBlueprint({
        id: 'room',
        name: 'Room',
        layout: ['#'],
        background: [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }],
      }),
    ).toBe(true);
  });

  it('emptyLayoutArray-isRejected', () => {
    // parseLevel cannot represent a zero-row layout, and exportLayout never
    // produces one (it returns ['.'] for an empty grid instead).
    expect(isBlueprint({ id: 'room', name: 'Room', layout: [] })).toBe(false);
  });

  it('layoutRowThatIsNotAString-isRejected', () => {
    expect(isBlueprint({ id: 'room', name: 'Room', layout: ['#', 7] })).toBe(false);
  });

  it('missingIdOrName-isRejected', () => {
    expect(isBlueprint({ name: 'Room', layout: ['#'] })).toBe(false);
    expect(isBlueprint({ id: 'room', layout: ['#'] })).toBe(false);
  });

  it('backgroundThatIsNotAPlacementList-isRejected', () => {
    expect(isBlueprint({ id: 'r', name: 'R', layout: ['#'], background: [{ col: 0 }] })).toBe(
      false,
    );
  });

  it('nullOrNonObject-isRejected', () => {
    expect(isBlueprint(null)).toBe(false);
    expect(isBlueprint('room')).toBe(false);
  });
});
