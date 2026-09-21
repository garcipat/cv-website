import {
  SPEAR_TIP_ROWS,
  buildSpearMask,
  tipMaskFromMask,
  spearTipSweepHits,
  setSpearTipMask,
  getSpearTipMask,
} from './SpearArt';
import type { SpearMask } from './SpearArt';
import type { Rect } from '../geometry';

/** Builds an RGBA buffer whose alpha channel is given row-major (one byte per
 *  pixel); RGB is left at 0, since only alpha is ever read. */
function rgbaFromAlpha(alphas: readonly number[], width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4 + 3] = alphas[i];
  }
  return data;
}

/** Builds a mask directly from a row-major 0/1 grid. */
function maskFromRows(rows: readonly (readonly number[])[]): SpearMask {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels[y * width + x] = rows[y][x];
    }
  }
  return { width, height, pixels };
}

function drawnAt(mask: SpearMask, x: number, y: number): number {
  return mask.pixels[y * mask.width + x];
}

function totalDrawn(mask: SpearMask): number {
  return mask.pixels.reduce((sum, value) => sum + value, 0);
}

describe('SPEAR_TIP_ROWS', () => {
  it('pinnedToFour', () => {
    expect(SPEAR_TIP_ROWS).toBe(4);
  });
});

describe('buildSpearMask', () => {
  it('alphaAboveDefaultThreshold-marksPixelDrawn', () => {
    const data = rgbaFromAlpha([0, 1, 128, 129], 2, 2);
    expect(Array.from(buildSpearMask(data, 2, 2).pixels)).toEqual([0, 1, 1, 1]);
  });

  it('alphaExactlyAtThreshold-isNotDrawn', () => {
    // Strictly-greater-than: alpha === threshold is not drawn, alpha >
    // threshold is.
    const data = rgbaFromAlpha([0, 128, 129, 255], 2, 2);
    expect(Array.from(buildSpearMask(data, 2, 2, 128).pixels)).toEqual([0, 0, 1, 1]);
  });
});

describe('tipMaskFromMask', () => {
  // Two runs: cols 0-1 (top row 2) and cols 3-4 (top row 0), plus an empty
  // col 2 and col 5. Each run's tip is judged against its OWN top, so the
  // uneven tips are correct.
  const mask = maskFromRows([
    [0, 0, 0, 1, 0, 0],
    [0, 0, 0, 1, 1, 0],
    [1, 0, 0, 1, 1, 0],
    [1, 1, 0, 1, 1, 0],
    [1, 1, 0, 1, 1, 0],
    [1, 1, 0, 1, 1, 0],
  ]);

  it('keepsOnlyTheTopRowsOfEachRunJudgedAgainstItsOwnTop', () => {
    const tips = tipMaskFromMask(mask, 2);
    expect(Array.from(tips.pixels)).toEqual([
      0, 0, 0, 1, 0, 0, // run B top row 0
      0, 0, 0, 1, 1, 0, // run B second row
      1, 0, 0, 0, 0, 0, // run A top row 2
      1, 1, 0, 0, 0, 0, // run A second row
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0,
    ]);
  });

  it('clearsTheShaftBelowTheTipBand', () => {
    const fullColumn = maskFromRows([
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
    ]);
    const tips = tipMaskFromMask(fullColumn);
    expect(totalDrawn(tips)).toBe(SPEAR_TIP_ROWS);
    expect(drawnAt(tips, 0, 0)).toBe(1);
    expect(drawnAt(tips, 0, SPEAR_TIP_ROWS - 1)).toBe(1);
    expect(drawnAt(tips, 0, SPEAR_TIP_ROWS)).toBe(0);
    expect(drawnAt(tips, 0, 5)).toBe(0);
  });

  it('defaultsToThePinnedTipRowCount', () => {
    const fullColumn = maskFromRows([[1], [1], [1], [1], [1], [1]]);
    expect(tipMaskFromMask(fullColumn).pixels.length).toBe(6);
    expect(totalDrawn(tipMaskFromMask(fullColumn))).toBe(SPEAR_TIP_ROWS);
  });

  it('emptyMask-producesEmptyMask', () => {
    const empty = maskFromRows([
      [0, 0],
      [0, 0],
    ]);
    expect(totalDrawn(tipMaskFromMask(empty))).toBe(0);
  });
});

describe('spearTipSweepHits', () => {
  // One tip pixel at mask (1, 1) — world (101, 101) for a spear at (100, 100).
  const oneTip = maskFromRows([
    [0, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const spear = { x: 100, y: 100 };

  it('feetSweepDownThroughTheTipRow-withHorizontalOverlap-isAHit', () => {
    const hitbox: Rect = { x: 100, y: 90, width: 4, height: 20 };
    expect(spearTipSweepHits(hitbox, spear, oneTip, 95, 102)).toBe(true);
  });

  it('feetAlreadyBelowTheTipRow-sideGraze-isNotAHit', () => {
    const hitbox: Rect = { x: 100, y: 90, width: 4, height: 40 };
    expect(spearTipSweepHits(hitbox, spear, oneTip, 102, 110)).toBe(false);
  });

  it('hitboxOutsideTheTile-isNotAHit', () => {
    const hitbox: Rect = { x: 0, y: 90, width: 4, height: 20 };
    expect(spearTipSweepHits(hitbox, spear, oneTip, 95, 102)).toBe(false);
  });

  it('feetStillAboveTheTileTopNotYetEntered-isNotAHit', () => {
    const hitbox: Rect = { x: 100, y: 90, width: 4, height: 20 };
    // Feet are above the tile top (100) at both the start and end of the
    // step — they have not entered the tile yet, so nothing is crossed.
    expect(spearTipSweepHits(hitbox, spear, oneTip, 60, 90)).toBe(false);
  });

  it('emptyMask-isNeverAHit', () => {
    const empty = maskFromRows([
      [0, 0],
      [0, 0],
    ]);
    const hitbox: Rect = { x: 100, y: 90, width: 4, height: 20 };
    expect(spearTipSweepHits(hitbox, spear, empty, 95, 102)).toBe(false);
  });

  it('singleTickFastFallSkippingTheWholeTipBand-isStillAHit', () => {
    // Feet were above the tile at the start of the step and are below the
    // tips by the end — a non-swept point-in-band test would miss this.
    const hitbox: Rect = { x: 100, y: 90, width: 4, height: 200 };
    expect(spearTipSweepHits(hitbox, spear, oneTip, 50, 200)).toBe(true);
  });

  // A side spear's tip (row 8, world y 108) — the bug case: a jump from
  // inside the tile clears this tip but not the spear's own top (world y 100).
  const sideTip = maskFromRows([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);

  it('descentCrossingATipWithoutEverRisingAboveTheTileTop-isNotAHit', () => {
    const hitbox: Rect = { x: 100, y: 90, width: 4, height: 20 };
    // Feet sweep 106 -> 110, crossing the side tip row (108). But 106 is
    // already below the tile top (100), so the player jumped from inside the
    // tile and never reached the spear's full height — not a landing.
    expect(spearTipSweepHits(hitbox, spear, sideTip, 106, 110)).toBe(false);
  });

  it('descentCrossingATipAfterRisingAboveTheTileTop-isAHit', () => {
    const hitbox: Rect = { x: 100, y: 90, width: 4, height: 40 };
    // Feet sweep 98 -> 110, crossing the tile top (100) downward first, so
    // the spear's full height was cleared — a genuine fall onto the tips.
    expect(spearTipSweepHits(hitbox, spear, sideTip, 98, 110)).toBe(true);
  });
});

describe('spear tip mask store', () => {
  it('startsEmptySoAnUnloadedSpearIsInert', () => {
    expect(totalDrawn(getSpearTipMask())).toBe(0);
  });

  it('setThenGet-roundTripsTheMask', () => {
    const mask = maskFromRows([
      [1, 0],
      [0, 0],
    ]);
    setSpearTipMask(mask);
    expect(getSpearTipMask()).toBe(mask);
  });
});
