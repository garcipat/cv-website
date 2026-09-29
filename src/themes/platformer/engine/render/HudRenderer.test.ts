import {
  drawHearts,
  drawHudCounter,
  drawIrisOverlay,
  drawRestartPrompt,
  drawLowHealthGlow,
  lowHealthGlowAlpha,
  LOW_HEALTH_GLOW_WIDTH_PX,
  LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS,
} from './HudRenderer';
import {
  formatHudCounterText,
  hudCounterWidth,
  hudCounterX,
  scaledImageCounter,
  sheetFrameCounter,
  BOMB_COUNTER_ICON_HEIGHT,
  CHEST_COUNTER_ICON_HEIGHT,
  CHEST_COUNTER_TEXT_GAP,
  CHEST_COUNTER_X,
  CHEST_COUNTER_Y,
  HEARTS_START_X,
  HUD_GROUP_GAP,
  KEY_COUNTER_ICON_HEIGHT,
  KEY_COUNTER_Y,
} from './HudLayout';
import { RESTART_PROMPT_FONT_FAMILY } from '../textDraw';
import { MAX_HALF_HEARTS, HEART_RENDERED_SIZE } from '../../entities/Health';
import { BOMB_SHEET } from '../../entities/sprites/sheets';
import { CHEST_CLOSED_WIDTH, CHEST_CLOSED_HEIGHT } from '../../entities/chests';
import { KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT } from '../../entities/pickups/Key';
import { makeMockContext } from './renderTestContext';

// The intrinsic scaled icon widths the old per-kind counters measured, now the
// scaledImageCounter descriptor's default advanceWidth.
const CHEST_ICON_WIDTH = (CHEST_CLOSED_WIDTH / CHEST_CLOSED_HEIGHT) * CHEST_COUNTER_ICON_HEIGHT;
const KEY_ICON_WIDTH = (KEY_FRAME_WIDTH / KEY_FRAME_HEIGHT) * KEY_COUNTER_ICON_HEIGHT;
const BOMB_ICON_WIDTH = (BOMB_SHEET.frameWidth / BOMB_SHEET.frameHeight) * BOMB_COUNTER_ICON_HEIGHT;

// ctx.measureText is mocked to return { width: 10 } in makeMockContext.
const MEASURED_TEXT_WIDTH = 10;

function chestDescriptor(
  image: CanvasImageSource | null,
  count: number,
  total?: number,
): ReturnType<typeof scaledImageCounter> {
  return scaledImageCounter({
    image,
    sourceWidth: CHEST_CLOSED_WIDTH,
    sourceHeight: CHEST_CLOSED_HEIGHT,
    height: CHEST_COUNTER_ICON_HEIGHT,
    count,
    total,
    textGap: CHEST_COUNTER_TEXT_GAP,
  });
}

function keyDescriptor(
  image: CanvasImageSource | null,
  count: number,
): ReturnType<typeof scaledImageCounter> {
  return scaledImageCounter({
    image,
    sourceWidth: KEY_FRAME_WIDTH,
    sourceHeight: KEY_FRAME_HEIGHT,
    height: KEY_COUNTER_ICON_HEIGHT,
    count,
    textGap: CHEST_COUNTER_TEXT_GAP,
  });
}

function bombDescriptor(
  image: CanvasImageSource | null,
  count: number,
): ReturnType<typeof scaledImageCounter> {
  return scaledImageCounter({
    image,
    sourceWidth: BOMB_SHEET.frameWidth,
    sourceHeight: BOMB_SHEET.frameHeight,
    height: BOMB_COUNTER_ICON_HEIGHT,
    count,
    textGap: CHEST_COUNTER_TEXT_GAP,
  });
}

describe('formatHudCounterText', () => {
  it('withTotal-formatsCountSlashTotal', () => {
    expect(formatHudCounterText(2, 5)).toBe('2 / 5');
  });

  it('withoutTotal-formatsTheBareCount', () => {
    expect(formatHudCounterText(3)).toBe('3');
  });
});

describe('drawHudCounter', () => {
  it('sheetFrameDescriptor-drawsTheCroppedIconAtTheAdvanceSlotThenTheSpacedText', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
      font: string;
    };
    const icon = {} as HTMLImageElement;
    const descriptor = sheetFrameCounter({
      image: icon,
      sx: 0,
      sy: 0,
      frameSize: 16,
      count: 3,
      total: 16,
      textGap: 6,
    });

    drawHudCounter(ctx as unknown as CanvasRenderingContext2D, descriptor, 200, 20);

    expect(ctx.drawImage).toHaveBeenCalledWith(icon, 0, 0, 16, 16, 200, 4, 32, 32);
    expect(ctx.fillText).toHaveBeenCalledWith('3 / 16', 200 + 32 + 6, 20);
    expect(ctx.font).toBe(`22px "${RESTART_PROMPT_FONT_FAMILY}", monospace`);
  });

  it('sheetFrameDescriptorWithDisplaySizeAndOffset-shrinksTheIconButKeepsTheAdvanceSlot', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };
    const icon = {} as HTMLImageElement;
    const descriptor = sheetFrameCounter({
      image: icon,
      sx: 0,
      sy: 0,
      frameSize: 16,
      displaySize: 24,
      yOffset: -4,
      count: 1,
      textGap: 6,
    });

    drawHudCounter(ctx as unknown as CanvasRenderingContext2D, descriptor, 100, 50);

    expect(ctx.drawImage).toHaveBeenCalledWith(icon, 0, 0, 16, 16, 104, 34, 24, 24);
    expect(ctx.fillText).toHaveBeenCalledWith('1', 100 + 32 + 6, 50);
  });

  it('scaledImageDescriptor-drawsTheWholeImageAtItsIntrinsicScaledWidthThenTheText', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };
    const sprite = {} as HTMLImageElement;

    drawHudCounter(
      ctx as unknown as CanvasRenderingContext2D,
      chestDescriptor(sprite, 2, 5),
      100,
      50,
    );

    expect(ctx.drawImage).toHaveBeenCalledWith(
      sprite,
      0,
      0,
      CHEST_CLOSED_WIDTH,
      CHEST_CLOSED_HEIGHT,
      100,
      50 - CHEST_COUNTER_ICON_HEIGHT / 2,
      CHEST_ICON_WIDTH,
      CHEST_COUNTER_ICON_HEIGHT,
    );
    expect(ctx.fillText).toHaveBeenCalledWith(
      '2 / 5',
      100 + CHEST_ICON_WIDTH + CHEST_COUNTER_TEXT_GAP,
      50,
    );
  });

  it('nullImage-measurementOnlyDescriptor-drawsNothingAtAll', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };

    drawHudCounter(ctx as unknown as CanvasRenderingContext2D, chestDescriptor(null, 0, 3), 0, 0);

    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('withAnIcon-setsImageSmoothingEnabledFalseBeforeDrawingIt', () => {
    const ctx = makeMockContext();

    drawHudCounter(ctx, chestDescriptor({} as HTMLImageElement, 2, 5), 100, 50);

    expect(ctx.imageSmoothingEnabled).toBe(false);
  });
});

describe('hudCounterWidth', () => {
  it('chestDescriptor-equalsTheOldChestCounterWidth', () => {
    const ctx = makeMockContext();
    expect(hudCounterWidth(ctx, chestDescriptor({} as HTMLImageElement, 2, 5))).toBe(
      CHEST_ICON_WIDTH + CHEST_COUNTER_TEXT_GAP + MEASURED_TEXT_WIDTH,
    );
  });

  it('keyDescriptor-equalsTheOldKeyCounterWidth', () => {
    const ctx = makeMockContext();
    expect(hudCounterWidth(ctx, keyDescriptor({} as HTMLImageElement, 3))).toBe(
      KEY_ICON_WIDTH + CHEST_COUNTER_TEXT_GAP + MEASURED_TEXT_WIDTH,
    );
  });

  it('multiDigitText-usesTheMeasuredTextWidthNotAConstantGuess', () => {
    const ctx = makeMockContext() as unknown as { measureText: ReturnType<typeof vi.fn> };
    ctx.measureText.mockReturnValue({ width: 70 } as unknown as TextMetrics);

    expect(
      hudCounterWidth(ctx as unknown as CanvasRenderingContext2D, chestDescriptor(null, 12, 34)),
    ).toBe(CHEST_ICON_WIDTH + CHEST_COUNTER_TEXT_GAP + 70);
  });
});

describe('hudCounterX', () => {
  it('chestChain-equalsTheOldKeyCounterX', () => {
    const ctx = makeMockContext();
    expect(hudCounterX(ctx, chestDescriptor(null, 2, 5), CHEST_COUNTER_X)).toBe(
      CHEST_COUNTER_X + hudCounterWidth(ctx, chestDescriptor(null, 2, 5)) + HUD_GROUP_GAP,
    );
  });

  it('keyHidden-bombTakesTheKeyCountersXBecauseTheHiddenGroupDoesNotAdvance', () => {
    const ctx = makeMockContext();
    const keyX = hudCounterX(ctx, chestDescriptor(null, 0, 0), CHEST_COUNTER_X);
    const keyCount = 0;
    const bombX = keyCount > 0 ? hudCounterX(ctx, keyDescriptor(null, keyCount), keyX) : keyX;

    expect(bombX).toBe(keyX);
  });

  it('keyShown-bombSitsStrictlyPastTheKeyCountersMeasuredWidth', () => {
    const ctx = makeMockContext();
    const keyX = hudCounterX(ctx, chestDescriptor(null, 0, 0), CHEST_COUNTER_X);
    const keyDescriptorShown = keyDescriptor(null, 3);
    const bombX = hudCounterX(ctx, keyDescriptorShown, keyX);

    expect(bombX).toBe(
      keyX + KEY_ICON_WIDTH + CHEST_COUNTER_TEXT_GAP + MEASURED_TEXT_WIDTH + HUD_GROUP_GAP,
    );
    expect(bombX).toBeGreaterThan(keyX);
  });

  it('bombChain-equalsTheOldBombCounterXIncludingTheKeysHiddenCase', () => {
    const ctx = makeMockContext();
    const keyX = hudCounterX(ctx, chestDescriptor(null, 0, 0), CHEST_COUNTER_X);
    const hiddenKeyCount = 0;
    const hiddenBombX =
      hiddenKeyCount > 0 ? hudCounterX(ctx, keyDescriptor(null, hiddenKeyCount), keyX) : keyX;
    const shownBombX = hudCounterX(ctx, keyDescriptor(null, 3), keyX);

    // Old bombCounterX(ctx, chestCollected, chestTotal, keyCount).
    const oldBombCounterX = (keyCount: number): number =>
      keyCount <= 0
        ? keyX
        : keyX + (KEY_ICON_WIDTH + CHEST_COUNTER_TEXT_GAP + MEASURED_TEXT_WIDTH) + HUD_GROUP_GAP;

    expect(hiddenBombX).toBe(oldBombCounterX(0));
    expect(shownBombX).toBe(oldBombCounterX(3));
  });
});

describe('scaledImage counters at the page positions', () => {
  it('chestAtChestCounterXAndY-drawsTheIconThenTheCollectedOverTotalText', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };
    const sprite = {} as HTMLImageElement;

    drawHudCounter(
      ctx as unknown as CanvasRenderingContext2D,
      chestDescriptor(sprite, 2, 5),
      CHEST_COUNTER_X,
      CHEST_COUNTER_Y,
    );

    expect(ctx.drawImage).toHaveBeenCalledWith(
      sprite,
      0,
      0,
      CHEST_CLOSED_WIDTH,
      CHEST_CLOSED_HEIGHT,
      CHEST_COUNTER_X,
      CHEST_COUNTER_Y - CHEST_COUNTER_ICON_HEIGHT / 2,
      CHEST_ICON_WIDTH,
      CHEST_COUNTER_ICON_HEIGHT,
    );
    expect(ctx.fillText).toHaveBeenCalledWith(
      '2 / 5',
      CHEST_COUNTER_X + CHEST_ICON_WIDTH + CHEST_COUNTER_TEXT_GAP,
      CHEST_COUNTER_Y,
    );
  });

  it('keyAtItsChainedX-drawsTheIconAndTheBareCountText', () => {
    const ctx = makeMockContext();
    const keyX = hudCounterX(ctx, chestDescriptor(null, 0, 0), CHEST_COUNTER_X);
    const sprite = {} as HTMLImageElement;

    drawHudCounter(ctx, keyDescriptor(sprite, 3), keyX, KEY_COUNTER_Y);

    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(
      '3',
      keyX + KEY_ICON_WIDTH + CHEST_COUNTER_TEXT_GAP,
      KEY_COUNTER_Y,
    );
  });

  it('bombAtItsChainedX-drawsTheUnlitBombIconAndTheBareCountText', () => {
    const ctx = makeMockContext();
    const keyX = hudCounterX(ctx, chestDescriptor(null, 0, 0), CHEST_COUNTER_X);
    const bombX = hudCounterX(ctx, keyDescriptor(null, 0), keyX);
    const sprite = {} as HTMLImageElement;

    drawHudCounter(ctx, bombDescriptor(sprite, 3), bombX, KEY_COUNTER_Y);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      sprite,
      0,
      0,
      BOMB_SHEET.frameWidth,
      BOMB_SHEET.frameHeight,
      bombX,
      KEY_COUNTER_Y - BOMB_COUNTER_ICON_HEIGHT / 2,
      BOMB_ICON_WIDTH,
      BOMB_COUNTER_ICON_HEIGHT,
    );
    expect(ctx.fillText).toHaveBeenCalledWith(
      '3',
      bombX + BOMB_ICON_WIDTH + CHEST_COUNTER_TEXT_GAP,
      KEY_COUNTER_Y,
    );
  });
});

describe('lowHealthGlowAlpha', () => {
  it('atPulsePeak-returnsBasePlusFullPulse', () => {
    const peakT = LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS / 4; // sin(2π·0.25) = 1
    expect(lowHealthGlowAlpha(peakT)).toBeCloseTo(0.25 + 0.45);
  });

  it('atPulseTrough-returnsBaseAlphaOnly', () => {
    const troughT = (LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS * 3) / 4; // sin(2π·0.75) = -1
    expect(lowHealthGlowAlpha(troughT)).toBeCloseTo(0.25);
  });
});

describe('drawLowHealthGlow', () => {
  it('anyElapsed-drawsFourEdgeFillRects', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    drawLowHealthGlow(ctx as unknown as CanvasRenderingContext2D, 800, 600, 0);
    expect(ctx.fillRect).toHaveBeenCalledTimes(4);
  });

  it('anyElapsed-callsCreateLinearGradientFourTimes', () => {
    const ctx = makeMockContext() as unknown as { createLinearGradient: ReturnType<typeof vi.fn> };
    drawLowHealthGlow(ctx as unknown as CanvasRenderingContext2D, 800, 600, 0);
    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(4);
  });

  it('canvasSize-edgeRectsSpanTheFullWidthOrHeight', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    drawLowHealthGlow(ctx as unknown as CanvasRenderingContext2D, 800, 600, 0);
    const calls = ctx.fillRect.mock.calls as number[][];
    // Left/right edges: height 600. Top/bottom edges: width 800.
    expect(calls.some(([, , w, h]) => w === LOW_HEALTH_GLOW_WIDTH_PX && h === 600)).toBe(true);
    expect(calls.some(([, , w, h]) => w === 800 && h === LOW_HEALTH_GLOW_WIDTH_PX)).toBe(true);
  });
});

describe('drawHearts', () => {
  const fakeHeartsSheet = {} as HTMLImageElement;

  it('fullHealth-drawsThreeFullHeartFrames', () => {
    const ctx = makeMockContext();

    drawHearts(ctx, MAX_HALF_HEARTS, fakeHeartsSheet);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeHeartsSheet, 0, 0, 16, 16, 16, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeHeartsSheet, 0, 0, 16, 16, 52, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(3, fakeHeartsSheet, 0, 0, 16, 16, 88, 16, 32, 32);
  });

  it('threeHalfHearts-drawsOneFullOneHalfOneEmpty', () => {
    const ctx = makeMockContext();

    drawHearts(ctx, 3, fakeHeartsSheet);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeHeartsSheet, 0, 0, 16, 16, 16, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      2,
      fakeHeartsSheet,
      16,
      0,
      16,
      16,
      52,
      16,
      32,
      32,
    );
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      3,
      fakeHeartsSheet,
      32,
      0,
      16,
      16,
      88,
      16,
      32,
      32,
    );
  });

  it('zeroHealth-drawsAllEmptyFrames', () => {
    const ctx = makeMockContext();

    drawHearts(ctx, 0, fakeHeartsSheet);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      1,
      fakeHeartsSheet,
      32,
      0,
      16,
      16,
      16,
      16,
      32,
      32,
    );
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      2,
      fakeHeartsSheet,
      32,
      0,
      16,
      16,
      52,
      16,
      32,
      32,
    );
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      3,
      fakeHeartsSheet,
      32,
      0,
      16,
      16,
      88,
      16,
      32,
      32,
    );
  });

  it('draws-setsImageSmoothingEnabledFalse', () => {
    const ctx = makeMockContext();

    drawHearts(ctx, MAX_HALF_HEARTS, fakeHeartsSheet);

    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('called-withCustomStartX-offsetsAllHeartsHorizontally', () => {
    const ctx = makeMockContext();

    drawHearts(ctx, MAX_HALF_HEARTS, fakeHeartsSheet, HEARTS_START_X);

    const firstCall = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls[0];
    const secondCall = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(firstCall[5]).toBe(HEARTS_START_X); // dx
    expect(secondCall[5]).toBe(HEARTS_START_X + HEART_RENDERED_SIZE + 4); // + spacing
  });
});

describe('drawIrisOverlay', () => {
  it('positiveRadius-fillsRectAndCutsCircularHoleWithEvenOdd', () => {
    const ctx = makeMockContext() as unknown as {
      rect: ReturnType<typeof vi.fn>;
      moveTo: ReturnType<typeof vi.fn>;
      arc: ReturnType<typeof vi.fn>;
      fill: ReturnType<typeof vi.fn>;
    };

    drawIrisOverlay(ctx as unknown as CanvasRenderingContext2D, 800, 600, 400, 300, 100);

    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.arc).toHaveBeenCalledWith(400, 300, 100, 0, Math.PI * 2, true);
    expect(ctx.fill).toHaveBeenCalledWith('evenodd');
  });

  it('zeroRadius-fillsRectWithoutDrawingCircle', () => {
    const ctx = makeMockContext() as unknown as {
      rect: ReturnType<typeof vi.fn>;
      arc: ReturnType<typeof vi.fn>;
      fill: ReturnType<typeof vi.fn>;
    };

    drawIrisOverlay(ctx as unknown as CanvasRenderingContext2D, 800, 600, 400, 300, 0);

    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalledWith('evenodd');
  });
});

describe('drawRestartPrompt', () => {
  it('called-drawsPromptTextCenteredOnCanvas', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };

    drawRestartPrompt(ctx as unknown as CanvasRenderingContext2D, 800, 600);

    expect(ctx.fillText).toHaveBeenCalledWith('Press any button to restart', 400, 300);
  });

  it('called-usesRestartPromptFontFamilyWithSansSerifFallback', () => {
    const ctx = makeMockContext() as unknown as { font: string };

    drawRestartPrompt(ctx as unknown as CanvasRenderingContext2D, 800, 600);

    expect(ctx.font).toContain(RESTART_PROMPT_FONT_FAMILY);
    expect(ctx.font).toContain('sans-serif');
  });
});
