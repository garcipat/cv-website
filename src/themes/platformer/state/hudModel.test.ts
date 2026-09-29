import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildHudModel } from './hudModel';
import { playerState } from './playerStore';
import { carriedBombs, collectedKeys } from './collectibleStore';
import { deployableItems } from './deployableItemStore';
import { levelTotals } from './levelTotals';
import {
  BOMB_COUNTER_ICON_HEIGHT,
  CHEST_COUNTER_ICON_HEIGHT,
  CHEST_COUNTER_TEXT_GAP,
  KEY_COUNTER_ICON_HEIGHT,
} from '../engine/render/HudLayout';
import {
  BOMB_SHEET,
  CHEST_CLOSED_SHEET,
  COIN_SHEET,
  FRUIT_SHEET,
  HEARTS_SHEET,
  KEY_SHEET,
  SLIME_GREEN_SHEET,
  WORLD_TILESET_SHEET,
} from '../entities/sprites/sheets';
import { frameSource } from '../entities/sprites/SpriteSheet';
import { fruitFrameSource, FRUIT_FRAME_SIZE } from '../entities/pickups/Fruit';
import { COIN_FRAME_SIZE } from '../entities/pickups/Coin';
import { blockFrameSource, BLOCK_FRAME_SIZE } from '../entities/Block';
import { CHEST_CLOSED_WIDTH, CHEST_CLOSED_HEIGHT } from '../entities/chests';
import { KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT } from '../entities/pickups/Key';
import type { SpriteLookup } from '../contracts/SpriteLookup';

const image = () => ({}) as unknown as HTMLImageElement;

/** The full lookup the manifest produces, every key present. */
const fullLookup = (): SpriteLookup => ({
  [CHEST_CLOSED_SHEET.src]: image(),
  [KEY_SHEET.src]: image(),
  [BOMB_SHEET.src]: image(),
  [HEARTS_SHEET.src]: image(),
  [COIN_SHEET.src]: image(),
  [FRUIT_SHEET.src]: image(),
  [SLIME_GREEN_SHEET.src]: image(),
  [WORLD_TILESET_SHEET.src]: image(),
});

const initialDeployables = deployableItems.value;
const initialPlayerState = playerState.value;

/** Opens every chest through the one `deployableItems` collection. */
function openFirstChest(): void {
  let opened = false;
  deployableItems.value = deployableItems.value.map((item) => {
    if (!opened && item.kind === 'chest') {
      opened = true;
      return { ...item, state: 'open' as const };
    }
    return item;
  });
}

describe('buildHudModel', () => {
  beforeEach(() => {
    deployableItems.value = initialDeployables;
    playerState.value = initialPlayerState;
    collectedKeys.value = 0;
    carriedBombs.value = 0;
  });

  afterEach(() => {
    deployableItems.value = initialDeployables;
    playerState.value = initialPlayerState;
    collectedKeys.value = 0;
    carriedBombs.value = 0;
  });

  it('counters-areInTheFrozenChestKeyBombOrder', () => {
    // Arrange / Act
    const model = buildHudModel(fullLookup());

    // Assert
    expect(model.counters.map((slot) => slot.key)).toEqual(['chests', 'keys', 'bombs']);
  });

  it('chestSlot-usesTheFrozenChestLiterals', () => {
    // Arrange / Act
    const chest = buildHudModel(fullLookup()).counters[0];

    // Assert
    expect(chest.image).toBeDefined();
    expect(chest.icon).toEqual({
      kind: 'scaledImage',
      sourceWidth: CHEST_CLOSED_WIDTH,
      sourceHeight: CHEST_CLOSED_HEIGHT,
      height: CHEST_COUNTER_ICON_HEIGHT,
    });
    expect(chest.textGap).toBe(CHEST_COUNTER_TEXT_GAP);
    expect(chest.total).toBe(levelTotals.value.chests);
    expect(chest.advancesWhenHidden).toBe(true);
  });

  it('keyAndBombSlots-useTheFrozenKeyBombLiterals', () => {
    // Arrange / Act
    const [, key, bomb] = buildHudModel(fullLookup()).counters;

    // Assert
    expect(key.icon).toEqual({
      kind: 'scaledImage',
      sourceWidth: KEY_FRAME_WIDTH,
      sourceHeight: KEY_FRAME_HEIGHT,
      height: KEY_COUNTER_ICON_HEIGHT,
    });
    expect(key.textGap).toBe(CHEST_COUNTER_TEXT_GAP);
    expect(key.advancesWhenHidden).toBe(false);
    expect(bomb.icon).toEqual({
      kind: 'scaledImage',
      sourceWidth: BOMB_SHEET.frameWidth,
      sourceHeight: BOMB_SHEET.frameHeight,
      height: BOMB_COUNTER_ICON_HEIGHT,
    });
    expect(bomb.textGap).toBe(CHEST_COUNTER_TEXT_GAP);
    expect(bomb.advancesWhenHidden).toBe(false);
  });

  it('keyAndBombCounts-followTheLiveCarriedSignals', () => {
    // Arrange
    collectedKeys.value = 3;
    carriedBombs.value = 2;

    // Act
    const [, key, bomb] = buildHudModel(fullLookup()).counters;

    // Assert
    expect(key.count).toBe(3);
    expect(bomb.count).toBe(2);
  });

  it('chestSlot-visibilityNeedsAPresentImageAndAPositiveTotal', () => {
    // Arrange
    const noChestImage = fullLookup();
    noChestImage[CHEST_CLOSED_SHEET.src] = null;

    // Act / Assert — the shipped level has chests, so the image is the gate
    // that can be varied here.
    expect(levelTotals.value.chests).toBeGreaterThan(0);
    expect(buildHudModel(fullLookup()).counters[0].visible).toBe(true);
    expect(buildHudModel(noChestImage).counters[0].visible).toBe(false);
    expect(buildHudModel(noChestImage).counters[0].image).toBeNull();
  });

  it('keySlot-visibilityNeedsAPresentImageAndAPositiveCount', () => {
    // Arrange
    const noKeyImage = fullLookup();
    noKeyImage[KEY_SHEET.src] = null;
    collectedKeys.value = 0;

    // Act / Assert
    expect(buildHudModel(fullLookup()).counters[1].visible).toBe(false);
    collectedKeys.value = 1;
    expect(buildHudModel(fullLookup()).counters[1].visible).toBe(true);
    expect(buildHudModel(noKeyImage).counters[1].visible).toBe(false);
  });

  it('bombSlot-visibilityNeedsAPresentImageAndAPositiveCount', () => {
    // Arrange
    const noBombImage = fullLookup();
    noBombImage[BOMB_SHEET.src] = null;
    carriedBombs.value = 1;

    // Act / Assert
    expect(buildHudModel(fullLookup()).counters[2].visible).toBe(true);
    expect(buildHudModel(noBombImage).counters[2].visible).toBe(false);
  });

  it('openChest-countsThroughTheDerivedChestsOpenedSignal', () => {
    // Arrange
    openFirstChest();

    // Act
    const chest = buildHudModel(fullLookup()).counters[0];

    // Assert
    expect(chest.count).toBeGreaterThan(0);
  });

  it('hearts-areNullWithoutTheHeartsImageAndCarryHitPointsWithIt', () => {
    // Arrange
    const lookup = fullLookup();
    const withHearts = { ...lookup };
    const withoutHearts = { ...lookup, [HEARTS_SHEET.src]: null };
    playerState.value = { ...playerState.value, hitPoints: 3 };

    // Act / Assert
    expect(buildHudModel(withoutHearts).hearts).toBeNull();
    expect(buildHudModel(withHearts).hearts).toEqual({
      hitPoints: 3,
      sprite: withHearts[HEARTS_SHEET.src],
    });
  });

  it('popupIcons-carryTheFrozenFramesAndSizes', () => {
    // Arrange / Act
    const lookup = fullLookup();
    const { popupIcons } = buildHudModel(lookup);

    // Assert
    expect(popupIcons.coins).toEqual({
      icon: lookup[COIN_SHEET.src],
      iconFrame: { ...frameSource(COIN_SHEET, 0), size: COIN_FRAME_SIZE },
      iconYOffset: undefined,
    });
    expect(popupIcons.fruits).toEqual({
      icon: lookup[FRUIT_SHEET.src],
      iconFrame: { ...fruitFrameSource(0), size: FRUIT_FRAME_SIZE },
      iconYOffset: undefined,
    });
    expect(popupIcons.enemies).toEqual({
      icon: lookup[SLIME_GREEN_SHEET.src],
      iconFrame: { ...frameSource(SLIME_GREEN_SHEET, 2), size: SLIME_GREEN_SHEET.frameWidth },
      iconYOffset: -6,
    });
    expect(popupIcons.crates).toEqual({
      icon: lookup[WORLD_TILESET_SHEET.src],
      iconFrame: { ...blockFrameSource('crate'), size: BLOCK_FRAME_SIZE },
      iconYOffset: undefined,
    });
  });

  it('popupIconImageMissing-omitsThatKeyEntirely', () => {
    // Arrange — the level ships no fruit marker, so drop the fruit image and
    // the coin image; both keys vanish, the rest stay.
    const lookup = fullLookup();
    lookup[COIN_SHEET.src] = null;
    lookup[FRUIT_SHEET.src] = null;

    // Act
    const { popupIcons } = buildHudModel(lookup);

    // Assert
    expect(Object.keys(popupIcons).sort()).toEqual(['crates', 'enemies']);
  });

  it('everyPopupIconImageMissing-omitsEveryKey', () => {
    // Arrange / Act
    const { popupIcons } = buildHudModel({});

    // Assert
    expect(popupIcons).toEqual({});
  });

  it('model-isDataOnlyWithNoFunctionsAtAnyDepth', () => {
    // Arrange
    const model = buildHudModel(fullLookup());

    // Act
    const walk = (value: unknown): boolean => {
      if (typeof value === 'function') return false;
      if (value && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).every(walk);
      }
      return true;
    };

    // Assert
    expect(walk(model)).toBe(true);
    expect(walk(model.counters)).toBe(true);
    expect(walk(model.popupIcons)).toBe(true);
  });
});
