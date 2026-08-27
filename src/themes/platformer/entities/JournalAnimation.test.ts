import { JOURNAL_OPEN_FRAME_COUNT, journalOpenFrameSrc } from './JournalAnimation';

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
