import {
  JOURNAL_OPEN_FRAME_COUNT,
  journalOpenFrameSrc,
  journalOpenFrameWidthPercent,
  journalOpenFrameCenteringShiftPercent,
} from './JournalAnimation';

describe('journalOpenFrameSrc', () => {
  it('called-withFrameOne-returnsFirstFrameSpritePath', () => {
    expect(journalOpenFrameSrc(1)).toBe('/sprites/journal_open_1.png');
  });

  it('called-withFinalFrame-returnsFinalFrameSpritePath', () => {
    expect(journalOpenFrameSrc(JOURNAL_OPEN_FRAME_COUNT)).toBe(
      `/sprites/journal_open_${JOURNAL_OPEN_FRAME_COUNT}.png`,
    );
  });

  it('called-withFrameBelowOne-clampsToFrameOne', () => {
    expect(journalOpenFrameSrc(0)).toBe('/sprites/journal_open_1.png');
    expect(journalOpenFrameSrc(-5)).toBe('/sprites/journal_open_1.png');
  });

  it('called-withFrameAboveCount-clampsToFinalFrame', () => {
    expect(journalOpenFrameSrc(JOURNAL_OPEN_FRAME_COUNT + 3)).toBe(
      `/sprites/journal_open_${JOURNAL_OPEN_FRAME_COUNT}.png`,
    );
  });
});

describe('journalOpenFrameWidthPercent', () => {
  it('called-withFrameOne-returnsClosedCoverPercentBelowHundred', () => {
    // 720x900 closed cover against the 900x439 final frame's box.
    expect(journalOpenFrameWidthPercent(1)).toBeCloseTo((720 / 900) * (439 / 900) * 100);
  });

  it('called-withFinalFrame-returnsExactlyOneHundred', () => {
    expect(journalOpenFrameWidthPercent(JOURNAL_OPEN_FRAME_COUNT)).toBeCloseTo(100);
  });

  it('called-acrossAllFrames-neverExceedsOneHundred', () => {
    for (let frame = 1; frame <= JOURNAL_OPEN_FRAME_COUNT; frame++) {
      expect(journalOpenFrameWidthPercent(frame)).toBeLessThanOrEqual(100.001);
    }
  });

  it('called-withOutOfRangeFrame-clampsBeforeLookup', () => {
    expect(journalOpenFrameWidthPercent(0)).toBe(journalOpenFrameWidthPercent(1));
    expect(journalOpenFrameWidthPercent(99)).toBe(journalOpenFrameWidthPercent(JOURNAL_OPEN_FRAME_COUNT));
  });
});

describe('journalOpenFrameCenteringShiftPercent', () => {
  it('called-withFinalFrame-returnsExactlyZero', () => {
    expect(journalOpenFrameCenteringShiftPercent(JOURNAL_OPEN_FRAME_COUNT)).toBeCloseTo(0);
  });

  it('called-withClosedCover-returnsNegativeShiftHalfOfMissingWidth', () => {
    const missingWidth = 100 - journalOpenFrameWidthPercent(1);
    expect(journalOpenFrameCenteringShiftPercent(1)).toBeCloseTo(-missingWidth / 2);
  });

  it('called-acrossAllFrames-neverShiftsRight', () => {
    for (let frame = 1; frame <= JOURNAL_OPEN_FRAME_COUNT; frame++) {
      expect(journalOpenFrameCenteringShiftPercent(frame)).toBeLessThanOrEqual(0);
    }
  });
});
