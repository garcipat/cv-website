import { frameSource, collectSheetSources } from './SpriteSheet';
import type { SpriteDescriptor } from './SpriteSheet';
import { SLIME_GREEN_SHEET, SLIME_PURPLE_SHEET } from './sheets';

describe('frameSource', () => {
  it('indexZero-returnsTopLeftFrame', () => {
    expect(frameSource(SLIME_GREEN_SHEET, 0)).toEqual({ sx: 0, sy: 0 });
  });

  it('indexAtColumnCount-wrapsToTheNextRow', () => {
    // 4 columns of 24px: index 4 is row 1, column 0.
    expect(frameSource(SLIME_GREEN_SHEET, 4)).toEqual({ sx: 0, sy: 24 });
  });

  it('lastIndexOfTheSheet-returnsBottomRightFrame', () => {
    expect(frameSource(SLIME_GREEN_SHEET, 11)).toEqual({ sx: 72, sy: 48 });
  });
});

describe('frameSource equivalence with the existing coordinate lists', () => {
  // The walk loop deliberately crosses a sheet row boundary, so this
  // conversion from hand-written sx/sy pairs to frame indices is the one place
  // it could silently drift. These are the exact coordinates the renderer
  // draws today.
  it('walkFrameIndices-matchTodaysWalkCoordinates', () => {
    const expected = [
      { sx: 72, sy: 0 },
      { sx: 0, sy: 24 },
      { sx: 24, sy: 24 },
      { sx: 48, sy: 24 },
      { sx: 72, sy: 24 },
    ];
    expect([3, 4, 5, 6, 7].map((i) => frameSource(SLIME_GREEN_SHEET, i))).toEqual(expected);
  });

  it('hitFrameIndices-matchTodaysHitCoordinates', () => {
    const expected = [
      { sx: 0, sy: 48 },
      { sx: 24, sy: 48 },
      { sx: 48, sy: 48 },
      { sx: 72, sy: 48 },
    ];
    expect([8, 9, 10, 11].map((i) => frameSource(SLIME_GREEN_SHEET, i))).toEqual(expected);
  });
});

describe('collectSheetSources', () => {
  it('descriptorsSharingASheet-yieldThatSourceOnce', () => {
    const a: SpriteDescriptor = {
      sheet: SLIME_GREEN_SHEET,
      renderScale: 1,
      animations: { walk: { frames: [3], frameDuration: 0.15 } },
    };
    const b: SpriteDescriptor = { ...a };
    expect(collectSheetSources([a, b])).toEqual([SLIME_GREEN_SHEET.src]);
  });

  it('descriptorsWithDistinctSheets-yieldEverySourceOnce', () => {
    const green: SpriteDescriptor = {
      sheet: SLIME_GREEN_SHEET,
      renderScale: 1,
      animations: { walk: { frames: [3], frameDuration: 0.15 } },
    };
    const purple: SpriteDescriptor = { ...green, sheet: SLIME_PURPLE_SHEET };
    expect(collectSheetSources([green, purple]).sort()).toEqual(
      [SLIME_GREEN_SHEET.src, SLIME_PURPLE_SHEET.src].sort(),
    );
  });
});
