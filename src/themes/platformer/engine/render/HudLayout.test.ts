import { describe, expect, it } from 'vitest';
import {
  CHEST_COUNTER_ICON_HEIGHT,
  CHEST_COUNTER_TEXT_GAP,
  CHEST_COUNTER_X,
  CHEST_COUNTER_Y,
  HEARTS_START_X,
  HUD_GROUP_GAP,
  KEY_COUNTER_ICON_HEIGHT,
  KEY_COUNTER_Y,
  drawHud,
  hudCounterWidth,
  hudCounterX,
  layoutHud,
  scaledImageCounter,
} from './HudLayout';
import type { HudCounterSlot, HudModel } from './HudLayout';
import { makeMockContext } from './renderTestContext';

const CHEST_SOURCE_WIDTH = 20;
const CHEST_SOURCE_HEIGHT = 20;
const KEY_SOURCE_WIDTH = 14;
const KEY_SOURCE_HEIGHT = 22;
// ctx.measureText is mocked to return { width: 10 } in makeMockContext.
const MEASURED_TEXT_WIDTH = 10;

const image = () => ({}) as unknown as CanvasImageSource;

const chestSlot = (overrides: Partial<HudCounterSlot> = {}): HudCounterSlot => ({
  key: 'chests',
  image: image(),
  icon: {
    kind: 'scaledImage',
    sourceWidth: CHEST_SOURCE_WIDTH,
    sourceHeight: CHEST_SOURCE_HEIGHT,
    height: CHEST_COUNTER_ICON_HEIGHT,
  },
  count: 2,
  total: 5,
  textGap: CHEST_COUNTER_TEXT_GAP,
  visible: true,
  advancesWhenHidden: true,
  ...overrides,
});

const keySlot = (overrides: Partial<HudCounterSlot> = {}): HudCounterSlot => ({
  key: 'keys',
  image: image(),
  icon: {
    kind: 'scaledImage',
    sourceWidth: KEY_SOURCE_WIDTH,
    sourceHeight: KEY_SOURCE_HEIGHT,
    height: KEY_COUNTER_ICON_HEIGHT,
  },
  count: 1,
  textGap: CHEST_COUNTER_TEXT_GAP,
  visible: true,
  advancesWhenHidden: false,
  ...overrides,
});

const bombSlot = (overrides: Partial<HudCounterSlot> = {}): HudCounterSlot => ({
  key: 'bombs',
  image: image(),
  icon: {
    kind: 'scaledImage',
    sourceWidth: KEY_SOURCE_WIDTH,
    sourceHeight: KEY_SOURCE_HEIGHT,
    height: KEY_COUNTER_ICON_HEIGHT,
  },
  count: 1,
  textGap: CHEST_COUNTER_TEXT_GAP,
  visible: true,
  advancesWhenHidden: false,
  ...overrides,
});

const model = (counters: HudCounterSlot[]): HudModel => ({
  hearts: null,
  counters,
  popupIcons: {},
});

const descriptorWidth = (slot: HudCounterSlot) =>
  hudCounterWidth(makeMockContext(), {
    image: slot.image,
    icon: slot.icon,
    advanceWidth:
      slot.icon.kind === 'scaledImage'
        ? (slot.icon.sourceWidth / slot.icon.sourceHeight) * slot.icon.height
        : slot.icon.displaySize,
    count: slot.count,
    total: slot.total,
    textGap: slot.textGap,
  });

describe('layoutHud', () => {
  it('visibleChestAndKey-bombsXIsChainedPastBoth', () => {
    // Arrange
    const ctx = makeMockContext();
    const chest = chestSlot();
    const key = keySlot();
    const bomb = bombSlot();

    // Act
    const layout = layoutHud(ctx, model([chest, key, bomb]));

    // Assert
    const expectedKeyX = CHEST_COUNTER_X + descriptorWidth(chest) + HUD_GROUP_GAP;
    expect(layout.counters[0].x).toBe(CHEST_COUNTER_X);
    expect(layout.counters[0].y).toBe(CHEST_COUNTER_Y);
    expect(layout.counters[1].x).toBe(expectedKeyX);
    expect(layout.counters[2].x).toBe(expectedKeyX + descriptorWidth(key) + HUD_GROUP_GAP);
    expect(layout.counters[2].y).toBe(KEY_COUNTER_Y);
  });

  it('hiddenChest-stillAdvancesTheKeysX', () => {
    // Arrange
    const ctx = makeMockContext();
    const chest = chestSlot({ count: 0, total: 0, visible: false });
    const key = keySlot({ count: 0, visible: false });

    // Act
    const layout = layoutHud(ctx, model([chest, key]));

    // Assert — the asymmetric frozen rule: a hidden chest group advances,
    // because the chest's descriptor is always measured.
    expect(layout.counters[1].x).toBe(
      hudCounterX(ctx, layout.counters[0].descriptor, CHEST_COUNTER_X),
    );
  });

  it('hiddenKey-doesNotAdvanceTheBombsX', () => {
    // Arrange
    const ctx = makeMockContext();
    const chest = chestSlot();
    const key = keySlot({ count: 0, visible: false });
    const bomb = bombSlot();

    // Act
    const layout = layoutHud(ctx, model([chest, key, bomb]));

    // Assert — the hidden key group does not advance the bomb's X.
    const keyX = layout.counters[1].x;
    expect(layout.counters[2].x).toBe(keyX);
  });

  it('visibleKey-advancesTheBombsX', () => {
    // Arrange
    const ctx = makeMockContext();
    const chest = chestSlot();
    const key = keySlot({ count: 3, visible: true });
    const bomb = bombSlot();

    // Act
    const layout = layoutHud(ctx, model([chest, key, bomb]));

    // Assert
    const keyX = layout.counters[1].x;
    expect(layout.counters[2].x).toBeGreaterThan(keyX);
  });

  it('nullImageSlot-drawsNothingButStillChainsPerTheRule', () => {
    // Arrange
    const ctx = makeMockContext();
    const chest = chestSlot({ image: null, visible: false });
    const key = keySlot();

    // Act
    const layout = layoutHud(ctx, model([chest, key]));

    // Assert
    expect(layout.counters[0].visible).toBe(false);
    expect(layout.counters[1].x).toBe(
      hudCounterX(ctx, layout.counters[0].descriptor, CHEST_COUNTER_X),
    );
  });

  it('heartsPresent-laysThemOutAtHeartsStartX', () => {
    // Arrange
    const sprite = image();

    // Act
    const layout = layoutHud(makeMockContext(), {
      hearts: { hitPoints: 5, sprite },
      counters: [],
      popupIcons: {},
    });

    // Assert
    expect(layout.hearts).toEqual({ x: HEARTS_START_X, sprite });
  });

  it('heartsSpriteMissing-laysOutNoHearts', () => {
    // Arrange / Act
    const layout = layoutHud(makeMockContext(), {
      hearts: { hitPoints: 5, sprite: null },
      counters: [],
      popupIcons: {},
    });

    // Assert
    expect(layout.hearts).toBeNull();
  });
});

describe('drawHud', () => {
  it('visibleSlots-drawsEachIconAndNoHiddenOne', () => {
    // Arrange
    const ctx = makeMockContext();

    // Act
    drawHud(ctx, model([chestSlot(), keySlot({ visible: false, count: 0 }), bombSlot()]));

    // Assert
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  });

  it('nullImageSlot-drawsNothing', () => {
    // Arrange
    const ctx = makeMockContext();

    // Act
    drawHud(ctx, model([chestSlot({ image: null, visible: false })]));

    // Assert
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('handBuiltModelWithoutAnyGameState-drawsTheWholeRow', () => {
    // Arrange
    const ctx = makeMockContext();

    // Act — the model carries all the data; the drawer reads no signals
    // (US4 scenario 4).
    drawHud(ctx, model([chestSlot(), keySlot(), bombSlot()]));

    // Assert
    expect(ctx.drawImage).toHaveBeenCalledTimes(3);
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('scaledImageDescriptor-defaultsItsAdvanceWidthToTheIntrinsicRatio', () => {
    // Arrange / Act
    const descriptor = scaledImageCounter({
      image: null,
      sourceWidth: CHEST_SOURCE_WIDTH,
      sourceHeight: CHEST_SOURCE_HEIGHT,
      height: CHEST_COUNTER_ICON_HEIGHT,
      count: 1,
      textGap: CHEST_COUNTER_TEXT_GAP,
    });

    // Assert — pinned against the same arithmetic the layout uses.
    expect(descriptor.advanceWidth).toBe(
      (CHEST_SOURCE_WIDTH / CHEST_SOURCE_HEIGHT) * CHEST_COUNTER_ICON_HEIGHT,
    );
    expect(hudCounterWidth(makeMockContext(), descriptor)).toBe(
      descriptor.advanceWidth + CHEST_COUNTER_TEXT_GAP + MEASURED_TEXT_WIDTH,
    );
  });
});
