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

  it('blueprintWithABackgroundLayout-isAccepted', () => {
    expect(
      isBlueprint({
        id: 'room',
        name: 'Room',
        layout: ['#'],
        background: ['d'],
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

  it('backgroundThatIsNotAnArrayOfStrings-isRejected', () => {
    // The old flat BackgroundPlacement[] format (objects, not strings) and the
    // pre-O-014-revision array-of-arrays BackgroundGrid format both fail the
    // string[] shape check (FR-013).
    expect(
      isBlueprint({ id: 'r', name: 'R', layout: ['#'], background: [{ pieceId: 'dirtBlock3x3', col: 0, row: 0 }] }),
    ).toBe(false);
    expect(isBlueprint({ id: 'r', name: 'R', layout: ['#'], background: [['dirt']] })).toBe(false);
  });

  it('backgroundWithAnUnrecognizedCharacter-isStillAcceptedAtTheShapeLevel', () => {
    // Shape validation only — an unrecognized character is a parseBackgroundLayout
    // concern (it silently reads as empty), not a load-time rejection reason.
    expect(isBlueprint({ id: 'r', name: 'R', layout: ['#'], background: ['?'] })).toBe(true);
  });

  it('nullOrNonObject-isRejected', () => {
    expect(isBlueprint(null)).toBe(false);
    expect(isBlueprint('room')).toBe(false);
  });
});
